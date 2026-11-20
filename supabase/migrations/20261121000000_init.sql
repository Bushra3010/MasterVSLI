-- MasterVLSI ERP — initial schema
-- Modules: students, courses/batches, three-way attendance, fees + vendor/sub-vendor split,
-- training validity & expiry, centralized access control, placement drives, letters/certificates.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type app_role as enum ('admin', 'staff', 'student', 'vendor');
create type student_status as enum ('active', 'on_hold', 'expired', 'completed', 'dropped');
create type training_mode as enum ('online', 'offline', 'hybrid');
create type access_channel as enum ('zoom', 'teamviewer', 'biometric', 'placement', 'portal');
create type attendance_source as enum ('zoom', 'teamviewer', 'biometric', 'manual');
create type installment_status as enum ('pending', 'partial', 'paid', 'overdue');
create type drive_status as enum ('upcoming', 'open', 'closed');
create type drive_response as enum ('pending', 'yes', 'no');
create type letter_template as enum (
  'training_certificate', 'internship_offer', 'internship_completion',
  'admission_confirmation', 'placement_confirmation', 'student_id_card', 'visiting_card',
  'staff_offer', 'payslip', 'service_agreement', 'experience_letter'
);

-- ---------------------------------------------------------------------------
-- Users / roles
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role app_role not null default 'student',
  created_at timestamptz not null default now()
);

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'staff') from profiles where id = auth.uid()), false)
$$;

-- New auth users get a profile (role defaults to student; promote in SQL/dashboard).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Courses, batches, vendors
-- ---------------------------------------------------------------------------
create table courses (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  duration_months int not null default 6,
  validity_months int not null default 12,
  fee numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table batches (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id),
  name text not null,
  mode training_mode not null default 'hybrid',
  start_date date,
  zoom_meeting_id text,
  created_at timestamptz not null default now()
);

-- A vendor with parent_id set is a sub-vendor.
create table vendors (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references vendors (id),
  name text not null,
  contact_person text,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------
create table students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  enrollment_no text unique not null,
  status student_status not null default 'active',

  -- personal
  full_name text not null,
  dob date,
  gender text,
  marital_status text,
  blood_group text,
  nationality text default 'Indian',
  languages text[],
  native_place text,

  -- contact
  phone text,
  alt_phone text,
  email text,
  alt_email text,
  linkedin text,
  resume_url text,

  -- grouped details
  address jsonb not null default '{}'::jsonb,       -- {line, city, district, state, pincode}
  family jsonb not null default '{}'::jsonb,        -- {father_name, father_occupation, father_phone, mother_name, ...}
  spouse jsonb not null default '{}'::jsonb,        -- {name, occupation, phone}
  emergency jsonb not null default '{}'::jsonb,     -- {name, relation, phone}
  professional jsonb not null default '{}'::jsonb,  -- {working_status, company, total_exp, relevant_exp, current_ctc, expected_ctc, notice_period, preferred_location, relocate}

  -- course & admission
  course_id uuid references courses (id),
  batch_id uuid references batches (id),
  training_mode training_mode not null default 'hybrid',
  admission_date date not null default current_date,
  validity_end date,
  total_fee numeric(12, 2) not null default 0,
  payment_plan text,
  referred_by text,
  lead_source text,

  -- placement
  placement_consent boolean not null default false,
  placement_eligible boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index students_status_idx on students (status);
create index students_validity_idx on students (validity_end);

create table student_education (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  level text not null,              -- 10th, 12th/Diploma, UG, PG
  institution text,
  board text,
  stream text,
  year_of_passing int,
  score text,                       -- "9.2 CGPA" / "86%"
  location text
);

create table student_documents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  kind text not null,               -- resume, photo, id_proof, certificate
  storage_path text not null,       -- Supabase Storage key (bucket: student-docs)
  verified boolean not null default false,
  uploaded_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Centralized access control
-- ---------------------------------------------------------------------------
create table student_access (
  student_id uuid not null references students (id) on delete cascade,
  channel access_channel not null,
  enabled boolean not null default true,
  external_ref text,                -- zoom email / teamviewer id / biometric code
  updated_at timestamptz not null default now(),
  primary key (student_id, channel)
);

create table access_events (
  id bigserial primary key,
  student_id uuid not null references students (id) on delete cascade,
  action text not null,             -- hold | activate | renew | expire
  reason text,
  actor uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- Seed all channels for each new student.
create or replace function public.seed_student_access() returns trigger
language plpgsql as $$
begin
  insert into student_access (student_id, channel, enabled)
  select new.id, c, new.status = 'active'
  from unnest(enum_range(null::access_channel)) c
  on conflict do nothing;
  return new;
end $$;
create trigger students_seed_access after insert on students
  for each row execute function public.seed_student_access();

-- One switch: hold / activate / expire flips every channel at once.
create or replace function public.set_student_status(p_student uuid, p_status student_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() and auth.uid() is not null then
    raise exception 'not allowed';
  end if;
  update students set status = p_status, updated_at = now() where id = p_student;
  update student_access set enabled = (p_status = 'active'), updated_at = now() where student_id = p_student;
  insert into access_events (student_id, action, reason, actor)
  values (p_student,
          case p_status when 'active' then 'activate' when 'on_hold' then 'hold' when 'expired' then 'expire' else p_status::text end,
          p_reason, auth.uid());
end $$;

-- ---------------------------------------------------------------------------
-- Attendance (Zoom + TeamViewer + Biometric → one table)
-- ---------------------------------------------------------------------------
create table attendance_records (
  id bigserial primary key,
  student_id uuid not null references students (id) on delete cascade,
  source attendance_source not null,
  session_date date not null,
  check_in timestamptz,
  check_out timestamptz,
  duration_minutes int not null default 0,
  external_ref text,                -- meeting uuid / recording id / device id
  raw jsonb,
  created_at timestamptz not null default now(),
  unique (student_id, source, session_date, external_ref)
);
create index attendance_date_idx on attendance_records (session_date);

-- Working days = distinct days any student of the batch had a session; simple % per student.
create or replace view student_attendance_summary as
with days as (
  select s.id as student_id, count(distinct a.session_date) as attended_days,
         max(a.session_date) as last_seen
  from students s left join attendance_records a on a.student_id = s.id
  group by s.id
), total as (
  select count(distinct session_date)::numeric as total_days from attendance_records
  where session_date >= current_date - 30
)
select d.student_id, d.attended_days, d.last_seen,
       case when t.total_days = 0 then 0
            else round(100 * (select count(distinct session_date) from attendance_records r
                              where r.student_id = d.student_id and r.session_date >= current_date - 30) / t.total_days, 1)
       end as pct_30d
from days d cross join total t;

-- ---------------------------------------------------------------------------
-- Fees: student total → vendor allocations → installments (paid to sub-vendors)
-- ---------------------------------------------------------------------------
create table fee_allocations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  vendor_id uuid not null references vendors (id),
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create table installments (
  id uuid primary key default gen_random_uuid(),
  allocation_id uuid not null references fee_allocations (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  sub_vendor_id uuid references vendors (id),
  seq int not null,
  due_date date not null,
  amount numeric(12, 2) not null,
  paid_amount numeric(12, 2) not null default 0,
  status installment_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references installments (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  mode text not null default 'UPI',
  reference text,
  paid_at timestamptz not null default now(),
  recorded_by uuid references auth.users (id)
);

create or replace function public.apply_payment() returns trigger
language plpgsql as $$
begin
  update installments i set
    paid_amount = i.paid_amount + new.amount,
    status = case when i.paid_amount + new.amount >= i.amount then 'paid'::installment_status else 'partial'::installment_status end
  where i.id = new.installment_id;
  return new;
end $$;
create trigger payments_apply after insert on payments for each row execute function public.apply_payment();

create or replace view student_fee_summary as
select s.id as student_id, s.total_fee,
       coalesce(sum(i.paid_amount), 0) as paid,
       s.total_fee - coalesce(sum(i.paid_amount), 0) as balance,
       min(i.due_date) filter (where i.status <> 'paid') as next_due
from students s left join installments i on i.student_id = s.id
group by s.id;

-- ---------------------------------------------------------------------------
-- Validity & expiry notifications
-- ---------------------------------------------------------------------------
create table notifications (
  id bigserial primary key,
  student_id uuid not null references students (id) on delete cascade,
  kind text not null,               -- expiry_30 | expiry_15 | expiry_7 | expiry_1 | expired
  channel text not null default 'email',
  payload jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, kind)
);

-- Called daily by the Cloudflare cron worker (via /api/cron/expiry).
create or replace function public.process_expiry() returns table (student_id uuid, kind text)
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select s.id, (s.validity_end - current_date) as days_left from students s
    where s.validity_end is not null and s.status in ('active', 'on_hold')
  loop
    if r.days_left <= 0 then
      perform set_student_status(r.id, 'expired', 'Training validity ended');
      insert into notifications (student_id, kind) values (r.id, 'expired') on conflict do nothing;
      student_id := r.id; kind := 'expired'; return next;
    elsif r.days_left in (30, 15, 7, 1) then
      insert into notifications (student_id, kind) values (r.id, 'expiry_' || r.days_left) on conflict do nothing;
      student_id := r.id; kind := 'expiry_' || r.days_left; return next;
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Placements
-- ---------------------------------------------------------------------------
create table placement_drives (
  id uuid primary key default gen_random_uuid(),
  company text not null,
  job_role text not null,
  location text,
  drive_date date,
  interview_mode text default 'Online',
  ctc text,
  eligibility text,
  status drive_status not null default 'open',
  sheet_id text,                    -- Google Sheet id; responses append here
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table drive_responses (
  drive_id uuid not null references placement_drives (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  response drive_response not null default 'pending',
  stage text default 'Applied',     -- Applied | Shortlisted | Interview | Offered | Rejected
  synced_to_sheet boolean not null default false,
  synced_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (drive_id, student_id)
);

-- ---------------------------------------------------------------------------
-- Staff + issued letters (QR verifiable)
-- ---------------------------------------------------------------------------
create table staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  employee_code text unique not null,
  full_name text not null,
  designation text,
  department text,
  joining_date date,
  monthly_salary numeric(12, 2),
  email text,
  phone text
);

create table issued_letters (
  id uuid primary key default gen_random_uuid(),
  serial_no text unique not null,
  template letter_template not null,
  student_id uuid references students (id) on delete set null,
  staff_id uuid references staff (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  issued_by uuid references auth.users (id),
  issued_at timestamptz not null default now(),
  revoked boolean not null default false
);

-- Public verification by serial (used by the QR code) without exposing the table.
create or replace function public.verify_letter(p_serial text)
returns table (serial_no text, template letter_template, holder text, issued_at timestamptz, revoked boolean)
language sql stable security definer set search_path = public as $$
  select l.serial_no, l.template, coalesce(s.full_name, st.full_name), l.issued_at, l.revoked
  from issued_letters l
  left join students s on s.id = l.student_id
  left join staff st on st.id = l.staff_id
  where l.serial_no = p_serial
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table courses enable row level security;
alter table batches enable row level security;
alter table vendors enable row level security;
alter table students enable row level security;
alter table student_education enable row level security;
alter table student_documents enable row level security;
alter table student_access enable row level security;
alter table access_events enable row level security;
alter table attendance_records enable row level security;
alter table fee_allocations enable row level security;
alter table installments enable row level security;
alter table payments enable row level security;
alter table notifications enable row level security;
alter table placement_drives enable row level security;
alter table drive_responses enable row level security;
alter table staff enable row level security;
alter table issued_letters enable row level security;

create or replace function public.my_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from students where user_id = auth.uid()
$$;

create policy "own profile" on profiles for select using (id = auth.uid() or is_staff());
create policy "staff manage profiles" on profiles for all using (is_staff()) with check (is_staff());

-- reference data: everyone signed in can read, staff write
create policy "read courses" on courses for select using (auth.uid() is not null);
create policy "staff courses" on courses for all using (is_staff()) with check (is_staff());
create policy "read batches" on batches for select using (auth.uid() is not null);
create policy "staff batches" on batches for all using (is_staff()) with check (is_staff());
create policy "staff vendors" on vendors for all using (is_staff()) with check (is_staff());
create policy "staff staff" on staff for all using (is_staff()) with check (is_staff());

-- student-owned data: staff all, student reads own
create policy "staff students" on students for all using (is_staff()) with check (is_staff());
create policy "own student" on students for select using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['student_education','student_documents','student_access','access_events',
                           'attendance_records','fee_allocations','installments','payments',
                           'notifications','issued_letters']
  loop
    execute format('create policy "staff %1$s" on %1$I for all using (is_staff()) with check (is_staff())', t);
    execute format('create policy "own %1$s" on %1$I for select using (student_id = my_student_id())', t);
  end loop;
end $$;

-- Drives: visible to all signed-in users; students only see drives while placement access is enabled.
create policy "staff drives" on placement_drives for all using (is_staff()) with check (is_staff());
create policy "students see drives" on placement_drives for select using (
  exists (select 1 from student_access a where a.student_id = my_student_id() and a.channel = 'placement' and a.enabled)
);
create policy "staff responses" on drive_responses for all using (is_staff()) with check (is_staff());
create policy "own responses read" on drive_responses for select using (student_id = my_student_id());
create policy "own responses write" on drive_responses for insert with check (
  student_id = my_student_id()
  and exists (select 1 from student_access a where a.student_id = my_student_id() and a.channel = 'placement' and a.enabled)
);
create policy "own responses update" on drive_responses for update using (student_id = my_student_id())
  with check (
    student_id = my_student_id()
    and exists (select 1 from student_access a where a.student_id = my_student_id() and a.channel = 'placement' and a.enabled)
  );

-- Views run with the caller's rights.
alter view student_attendance_summary set (security_invoker = true);
alter view student_fee_summary set (security_invoker = true);

-- Storage bucket for student documents (private).
insert into storage.buckets (id, name, public) values ('student-docs', 'student-docs', false)
on conflict do nothing;

-- Leads, HR contacts CRM, colleges (TPO / MoU / campus drives), brand ambassador, learning & assessments,
-- placement terms & consent, alerts & escalation, branches, student categories, Paka/Kacha fee accounts,
-- Enrich Silicon (employees, clients, projects, timesheets, invoices). Additive only.

-- ---------------------------------------------------------------------------
-- Roles: super admin (sees Kacha fees). Compared as text so the new enum value can be used in this script.
-- ---------------------------------------------------------------------------
alter type app_role add value if not exists 'super_admin';

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role::text in ('admin', 'staff', 'super_admin') from profiles where id = auth.uid()), false)
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role::text = 'super_admin' from profiles where id = auth.uid()), false)
$$;

-- ---------------------------------------------------------------------------
-- Branches / domains and companies
-- ---------------------------------------------------------------------------
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  domain text,
  company text not null default 'mastervlsi' check (company in ('mastervlsi', 'enrich')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Colleges, TPO contacts, MoUs, campus drives
-- ---------------------------------------------------------------------------
create table if not exists colleges (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  city text,
  state text,
  affiliation text,
  college_type text,
  since date,
  status text not null default 'partner' check (status in ('partner', 'prospect', 'inactive')),
  created_at timestamptz not null default now()
);

create table if not exists tpo_contacts (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges (id) on delete cascade,
  name text not null,
  designation text,
  phone text,
  alt_phone text,
  email text,
  is_primary boolean not null default false,
  active boolean not null default true,
  remarks text,
  next_follow_up timestamptz,
  last_interaction date,
  created_at timestamptz not null default now()
);

create table if not exists mous (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges (id) on delete cascade,
  mou_no text unique,
  agreement_type text not null,
  start_date date,
  end_date date,
  scope text,
  status text not null default 'draft' check (status in ('draft', 'review', 'shared', 'active', 'expired')),
  document_url text,
  created_at timestamptz not null default now()
);

create table if not exists campus_drives (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges (id) on delete cascade,
  company text not null,
  job_role text,
  drive_date date,
  mode text default 'onsite',
  eligibility text,
  package text,
  registered int not null default 0,
  attended int not null default 0,
  shortlisted int not null default 0,
  selected int not null default 0,
  status text not null default 'upcoming' check (status in ('upcoming', 'ongoing', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Enrich Silicon: corporate clients, projects, timesheets, invoices
-- ---------------------------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  email text,
  phone text,
  gstin text,
  kind text not null default 'services' check (kind in ('services', 'corporate_training')),
  created_at timestamptz not null default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients (id) on delete set null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'on_hold', 'completed')),
  start_date date,
  end_date date,
  hourly_rate numeric(10, 2),
  created_at timestamptz not null default now()
);

create table if not exists timesheets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  staff_id uuid not null references staff (id) on delete cascade,
  work_date date not null,
  hours numeric(4, 1) not null check (hours > 0 and hours <= 24),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_no text unique not null,
  company text not null default 'enrich' check (company in ('mastervlsi', 'enrich')),
  client_id uuid references clients (id) on delete set null,
  issue_date date not null default current_date,
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  gst_pct numeric(5, 2) not null default 18,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid', 'cancelled')),
  paid_on date,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Student categories, branch, college / corporate link, placement agreement
-- ---------------------------------------------------------------------------
alter table students add column if not exists category text not null default 'normal';
alter table students add column if not exists branch_id uuid references branches (id) on delete set null;
alter table students add column if not exists college_id uuid references colleges (id) on delete set null;
alter table students add column if not exists client_id uuid references clients (id) on delete set null;
alter table students add column if not exists placement_group text not null default 'none';
do $$ begin
  alter table students add constraint students_category_check check (category in ('normal', 'college', 'corporate'));
exception when duplicate_object then null; end $$;

alter table staff add column if not exists company text not null default 'mastervlsi';
alter table staff add column if not exists branch_id uuid references branches (id) on delete set null;
alter table staff add column if not exists source_student_id uuid references students (id) on delete set null;
alter table finance_entries add column if not exists company text not null default 'mastervlsi';

-- ---------------------------------------------------------------------------
-- Paka (institute account) / Kacha (other accounts) — Kacha only visible to super admins
-- ---------------------------------------------------------------------------
alter table fee_allocations add column if not exists account text not null default 'paka';
do $$ begin
  alter table fee_allocations add constraint fee_allocations_account_check check (account in ('paka', 'kacha'));
exception when duplicate_object then null; end $$;

drop policy if exists "hide kacha allocations" on fee_allocations;
create policy "hide kacha allocations" on fee_allocations as restrictive for all
  using (account <> 'kacha' or is_super_admin());
drop policy if exists "hide kacha installments" on installments;
create policy "hide kacha installments" on installments as restrictive for all
  using (exists (select 1 from fee_allocations a where a.id = allocation_id and (a.account <> 'kacha' or is_super_admin())));
drop policy if exists "hide kacha payments" on payments;
create policy "hide kacha payments" on payments as restrictive for all
  using (exists (select 1 from installments i join fee_allocations a on a.id = i.allocation_id
                 where i.id = installment_id and (a.account <> 'kacha' or is_super_admin())));

-- ---------------------------------------------------------------------------
-- Leads: Lead → Interested → Visited → Enroll
-- ---------------------------------------------------------------------------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  lead_no text unique,
  full_name text not null,
  phone text,
  email text,
  city text,
  source text not null default 'manual',
  course_code text,
  stage text not null default 'lead' check (stage in ('lead', 'interested', 'visited', 'enrolled', 'lost')),
  assigned_to text,
  next_follow_up timestamptz,
  follow_up_note text,
  batch_pref text,
  mode_pref text,
  fee_plan text,
  education text,
  remarks text,
  referred_by_student uuid references students (id) on delete set null,
  student_id uuid references students (id) on delete set null,
  stage_dates jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  kind text not null,
  summary text not null,
  outcome text,
  by_name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- HR contacts at hiring companies (placement CRM)
-- ---------------------------------------------------------------------------
create table if not exists hr_contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  designation text,
  department text,
  phone text,
  email text,
  linkedin text,
  city text,
  current_company text,
  company_type text,
  joined_on date,
  reference_note text,
  created_at timestamptz not null default now()
);

create table if not exists hr_company_history (
  id uuid primary key default gen_random_uuid(),
  hr_id uuid not null references hr_contacts (id) on delete cascade,
  company text not null,
  designation text,
  from_date date,
  to_date date
);

create table if not exists hr_calls (
  id uuid primary key default gen_random_uuid(),
  hr_id uuid not null references hr_contacts (id) on delete cascade,
  call_date date not null default current_date,
  activity text not null,
  outcome text,
  remarks text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Brand ambassador & earn program
-- ---------------------------------------------------------------------------
create table if not exists ambassador_activities (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  kind text not null check (kind in ('referral', 'review', 'social', 'mentor')),
  details text not null,
  proof_url text,
  reward_amount numeric(10, 2) not null default 0,
  gift text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'credited', 'delivered', 'rejected')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Learning: course modules, per-student progress, assessments
-- ---------------------------------------------------------------------------
create table if not exists course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete cascade,
  seq int not null,
  name text not null,
  total_videos int not null default 0
);

create table if not exists module_progress (
  student_id uuid not null references students (id) on delete cascade,
  module_id uuid not null references course_modules (id) on delete cascade,
  videos_done int not null default 0,
  test_score numeric(6, 2),
  test_max numeric(6, 2),
  updated_at timestamptz not null default now(),
  primary key (student_id, module_id)
);

create table if not exists assessments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  module_id uuid references course_modules (id) on delete set null,
  title text not null,
  marks numeric(6, 2) not null,
  max_marks numeric(6, 2) not null,
  taken_on date not null default current_date
);

-- ---------------------------------------------------------------------------
-- Terms & conditions (general + placement) and student consent records
-- ---------------------------------------------------------------------------
create table if not exists terms (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('general', 'placement')),
  version int not null,
  title text not null,
  items jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (kind, version)
);

create table if not exists consents (
  id uuid primary key default gen_random_uuid(),
  consent_no text unique not null,
  student_id uuid not null references students (id) on delete cascade,
  kind text not null,
  version int not null,
  accepted_at timestamptz not null default now(),
  user_agent text,
  unique (student_id, kind, version)
);

-- ---------------------------------------------------------------------------
-- Alerts & escalation
-- ---------------------------------------------------------------------------
create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  ref_id text not null,
  title text not null,
  details text,
  owner_role text not null,
  level int not null default 1,
  status text not null default 'open' check (status in ('open', 'resolved')),
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_note text
);
create unique index if not exists alerts_open_unique on alerts (kind, ref_id) where status = 'open';

-- messages: allow SMS
alter table messages drop constraint if exists messages_channel_check;
alter table messages add constraint messages_channel_check check (channel in ('email', 'whatsapp', 'sms'));

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['branches', 'colleges', 'tpo_contacts', 'mous', 'campus_drives', 'clients', 'projects',
                           'timesheets', 'invoices', 'leads', 'lead_activities', 'hr_contacts', 'hr_company_history',
                           'hr_calls', 'ambassador_activities', 'course_modules', 'module_progress', 'assessments',
                           'terms', 'consents', 'alerts'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff %1$s" on %1$I', t);
    execute format('create policy "staff %1$s" on %1$I for all using (is_staff()) with check (is_staff())', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
  end loop;
end $$;

-- Students read their own learning, ambassador activity and consents; everyone signed in reads terms and modules.
drop policy if exists "own ambassador" on ambassador_activities;
create policy "own ambassador" on ambassador_activities for select using (student_id = my_student_id());
drop policy if exists "own progress" on module_progress;
create policy "own progress" on module_progress for select using (student_id = my_student_id());
drop policy if exists "own assessments" on assessments;
create policy "own assessments" on assessments for select using (student_id = my_student_id());
drop policy if exists "own consents" on consents;
create policy "own consents" on consents for select using (student_id = my_student_id());
drop policy if exists "read terms" on terms;
create policy "read terms" on terms for select using (auth.uid() is not null);
drop policy if exists "read modules" on course_modules;
create policy "read modules" on course_modules for select using (auth.uid() is not null);

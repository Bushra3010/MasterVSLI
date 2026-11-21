-- Remaining gaps: assignments, college portal logins, alert contacts, project milestones, audit log,
-- TPO interaction history, staff appraisals, company legal profiles, TDS on invoices, branch-level access.
-- Additive only.

alter type app_role add value if not exists 'college';

-- ---------------------------------------------------------------------------
-- Assignments + submissions
-- ---------------------------------------------------------------------------
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid references courses (id) on delete cascade,
  batch_id uuid references batches (id) on delete set null,
  module_id uuid references course_modules (id) on delete set null,
  title text not null,
  instructions text,
  due_date date,
  max_marks numeric(6, 2) not null default 10,
  created_at timestamptz not null default now()
);

create table if not exists assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  link text,
  note text,
  submitted_at timestamptz not null default now(),
  marks numeric(6, 2),
  feedback text,
  status text not null default 'submitted' check (status in ('submitted', 'graded', 'resubmit')),
  unique (assignment_id, student_id)
);

-- ---------------------------------------------------------------------------
-- College portal logins (a TPO signs in and sees only their college)
-- ---------------------------------------------------------------------------
create table if not exists college_logins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  college_id uuid not null references colleges (id) on delete cascade,
  tpo_id uuid references tpo_contacts (id) on delete set null,
  created_at timestamptz not null default now()
);

-- MoU signed copies stored in the private bucket
alter table mous add column if not exists document_path text;

-- ---------------------------------------------------------------------------
-- TPO interaction history
-- ---------------------------------------------------------------------------
create table if not exists tpo_interactions (
  id uuid primary key default gen_random_uuid(),
  tpo_id uuid not null references tpo_contacts (id) on delete cascade,
  on_date date not null default current_date,
  mode text not null default 'call',
  summary text not null,
  next_follow_up date,
  by_name text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Alerts: who gets notified at each escalation level; project milestones
-- ---------------------------------------------------------------------------
create table if not exists alert_contacts (
  id uuid primary key default gen_random_uuid(),
  role_name text not null,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);
alter table alerts add column if not exists notified_level int not null default 0;

create table if not exists project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  title text not null,
  due_date date not null,
  done boolean not null default false,
  done_on date
);

-- ---------------------------------------------------------------------------
-- Enrich Silicon / both companies: appraisals, legal profiles, TDS
-- ---------------------------------------------------------------------------
create table if not exists staff_appraisals (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id) on delete cascade,
  period text not null,
  rating int not null check (rating between 1 and 5),
  increment_pct numeric(5, 2) not null default 0,
  comments text,
  created_at timestamptz not null default now()
);

create table if not exists company_profiles (
  company text primary key check (company in ('mastervlsi', 'enrich')),
  legal_name text not null,
  address text,
  gstin text,
  pan text,
  bank_name text,
  bank_account text,
  bank_ifsc text,
  email text,
  phone text
);
insert into company_profiles (company, legal_name) values ('mastervlsi', 'MasterVLSI'), ('enrich', 'Enrich Silicon')
on conflict (company) do nothing;

alter table invoices add column if not exists tds_pct numeric(5, 2) not null default 0;

-- ---------------------------------------------------------------------------
-- Audit log: every insert / update / delete on key tables, with who did it
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  user_id uuid,
  user_email text,
  table_name text not null,
  action text not null,
  record_id text,
  changes jsonb
);
create index if not exists audit_log_at on audit_log (at desc);

create or replace function public.audit_row() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  diff jsonb;
begin
  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(k, jsonb_build_array(to_jsonb(old) -> k, v)), '{}'::jsonb) into diff
    from jsonb_each(to_jsonb(new)) as e(k, v) where (to_jsonb(old) -> k) is distinct from v and k not in ('updated_at');
    if diff = '{}'::jsonb then return new; end if;
  else
    diff := rec;
  end if;
  insert into audit_log (user_id, user_email, table_name, action, record_id, changes)
  values (auth.uid(), auth.email(), tg_table_name, lower(tg_op),
          coalesce(rec ->> 'id', rec ->> 'student_id', rec ->> 'company'), diff);
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['students', 'fee_allocations', 'installments', 'payments', 'vendors', 'courses', 'batches', 'staff',
                           'payroll', 'finance_entries', 'invoices', 'issued_letters', 'student_access', 'profiles', 'terms',
                           'leads', 'colleges', 'mous'] loop
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Branch-level access: a staff member linked to a branch sees only that branch's students.
-- Admins / super admins (and staff with no branch) see everyone.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role::text in ('admin', 'super_admin') from profiles where id = auth.uid()), false)
$$;

create or replace function public.staff_branch() returns uuid
language sql stable security definer set search_path = public as $$
  select branch_id from staff
  where user_id = auth.uid() or (user_id is null and lower(email) = lower(auth.email()))
  limit 1
$$;

drop policy if exists "branch scope" on students;
create policy "branch scope" on students as restrictive for select
  using (not is_staff() or is_admin() or staff_branch() is null or branch_id is null or branch_id = staff_branch());

-- ---------------------------------------------------------------------------
-- RLS for new tables (staff full access; students their own submissions; audit log admins only)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['assignments', 'assignment_submissions', 'college_logins', 'tpo_interactions', 'alert_contacts',
                           'project_milestones', 'staff_appraisals', 'company_profiles'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff %1$s" on %1$I', t);
    execute format('create policy "staff %1$s" on %1$I for all using (is_staff()) with check (is_staff())', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
  end loop;
end $$;

alter table audit_log enable row level security;
drop policy if exists "admins read audit" on audit_log;
create policy "admins read audit" on audit_log for select using (is_admin());
grant select on audit_log to authenticated;
grant select, insert on audit_log to service_role;
grant usage, select on sequence audit_log_id_seq to service_role;

drop policy if exists "own submissions" on assignment_submissions;
create policy "own submissions" on assignment_submissions for select using (student_id = my_student_id());
drop policy if exists "read assignments" on assignments;
create policy "read assignments" on assignments for select using (auth.uid() is not null);

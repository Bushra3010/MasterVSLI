-- HR Management 360°: permanent HR identity, relationship pipeline and staff ownership,
-- employment history that is never overwritten when an HR changes company, per-staff
-- communication history that survives the staff member leaving, and hiring requirements.

-- ---------------------------------------------------------------------------
-- HR identity, pipeline and ownership

alter table hr_contacts add column if not exists hr_code text;
alter table hr_contacts add column if not exists stage text not null default 'new_hr' check (stage in (
  'new_hr', 'not_connected', 'connected', 'rapport_building', 'future_hiring',
  'active_hiring', 'profiles_shared', 'drive_scheduled'));
alter table hr_contacts add column if not exists relationship_status text not null default 'new' check (relationship_status in (
  'new', 'developing', 'good', 'strong', 'lost'));
alter table hr_contacts add column if not exists hiring_status text not null default 'unknown' check (hiring_status in (
  'unknown', 'not_hiring', 'future_hiring', 'active_hiring'));
alter table hr_contacts add column if not exists assigned_to text;
alter table hr_contacts add column if not exists alt_assigned_to text;
alter table hr_contacts add column if not exists introduced_by text;
alter table hr_contacts add column if not exists source text;
alter table hr_contacts add column if not exists personal_email text;
alter table hr_contacts add column if not exists previous_company text;
alter table hr_contacts add column if not exists preferred_contact text;
alter table hr_contacts add column if not exists next_follow_up timestamptz;
alter table hr_contacts add column if not exists follow_up_note text;
alter table hr_contacts add column if not exists last_verified date;
alter table hr_contacts add column if not exists active boolean not null default true;

-- Permanent HR id (HR-0001). Backfilled in creation order; new rows get theirs from the app.
do $$
declare r record; n int := 0;
begin
  for r in select id from hr_contacts where hr_code is null order by created_at nulls last, id loop
    n := n + 1;
    update hr_contacts set hr_code = 'HR-' || lpad(n::text, 4, '0') where id = r.id;
  end loop;
end $$;

create unique index if not exists hr_contacts_code on hr_contacts (hr_code);
create index if not exists hr_contacts_stage on hr_contacts (stage, assigned_to);
create index if not exists hr_contacts_phone on hr_contacts (phone);

-- ---------------------------------------------------------------------------
-- Employment history: keep the email and the replacement HR per company, never overwrite.

alter table hr_company_history add column if not exists official_email text;
alter table hr_company_history add column if not exists location text;
alter table hr_company_history add column if not exists replacement_hr_id uuid references hr_contacts (id) on delete set null;
alter table hr_company_history add column if not exists created_at timestamptz not null default now();
create index if not exists hr_company_history_hr on hr_company_history (hr_id, from_date desc);
create index if not exists hr_company_history_company on hr_company_history (company);

-- ---------------------------------------------------------------------------
-- Communication history: who spoke to the HR, how, and what came of it.
-- by_name is stored as text so the record survives the staff member leaving.

alter table hr_calls add column if not exists by_name text;
alter table hr_calls add column if not exists mode text not null default 'call' check (mode in (
  'call', 'email', 'meeting', 'whatsapp', 'linkedin', 'other'));
alter table hr_calls add column if not exists created_at timestamptz not null default now();
create index if not exists hr_calls_hr on hr_calls (hr_id, call_date desc);

-- ---------------------------------------------------------------------------
-- System log for stage moves and allocation, separate from the communication history.

create table if not exists hr_activities (
  id uuid primary key default gen_random_uuid(),
  hr_id uuid not null references hr_contacts (id) on delete cascade,
  kind text not null,
  summary text not null,
  outcome text,
  by_name text,
  created_at timestamptz not null default now()
);
create index if not exists hr_activities_hr on hr_activities (hr_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Upcoming hiring requirements raised by an HR.

create table if not exists hr_requirements (
  id uuid primary key default gen_random_uuid(),
  hr_id uuid not null references hr_contacts (id) on delete cascade,
  company text not null,
  role text not null,
  vacancies int not null default 0 check (vacancies >= 0),
  expected_period text,
  expected_date date,
  qualification text,
  branches text,
  package text,
  experience text,
  location text,
  assigned_to text,
  status text not null default 'pending' check (status in ('pending', 'expected', 'tentative', 'confirmed', 'closed', 'lost')),
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists hr_requirements_hr on hr_requirements (hr_id, status);

-- ---------------------------------------------------------------------------
-- RLS, grants and audit, matching every other staff-facing table.

do $$
declare t text;
begin
  foreach t in array array['hr_activities', 'hr_requirements'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff %1$s" on %1$I', t);
    execute format('create policy "staff %1$s" on %1$I for all using (is_staff()) with check (is_staff())', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;

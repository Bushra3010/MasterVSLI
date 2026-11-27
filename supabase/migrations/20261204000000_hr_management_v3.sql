-- HR Management 360° phase 2: drives owned by an HR with their full configuration,
-- the automatic reminder sequence as real tasks, Excel submissions to the company,
-- and HR feedback with the corrective action taken.

-- ---------------------------------------------------------------------------
-- §10 Drive configuration. The drive already exists; this is what the HR module adds.

alter table placement_drives add column if not exists hr_id uuid references hr_contacts (id) on delete set null;
alter table placement_drives add column if not exists coordinator text;
alter table placement_drives add column if not exists vacancies int not null default 0 check (vacancies >= 0);
alter table placement_drives add column if not exists qualification text;
alter table placement_drives add column if not exists branches text;
alter table placement_drives add column if not exists passout text;
alter table placement_drives add column if not exists experience text;
alter table placement_drives add column if not exists interest_close_at timestamptz;
alter table placement_drives add column if not exists excel_due_at timestamptz;
alter table placement_drives add column if not exists sending_mode text not null default 'after_approval' check (sending_mode in ('after_approval', 'automatic'));
alter table placement_drives add column if not exists jd_url text;
alter table placement_drives add column if not exists excel_format text;
alter table placement_drives add column if not exists consent_required boolean not null default true;
alter table placement_drives add column if not exists reminder_lead_days int not null default 7 check (reminder_lead_days between 1 and 60);
alter table placement_drives add column if not exists confirmation text not null default 'pending' check (confirmation in ('pending', 'tentative', 'confirmed', 'postponed', 'cancelled'));
create index if not exists placement_drives_hr on placement_drives (hr_id, drive_date);

-- ---------------------------------------------------------------------------
-- §11 / §12 The reminder sequence, stored as tasks so staff can tick them off
-- and the pending-activity dashboard has something real to count.

create table if not exists hr_drive_tasks (
  id uuid primary key default gen_random_uuid(),
  drive_id uuid references placement_drives (id) on delete cascade,
  hr_id uuid references hr_contacts (id) on delete cascade,
  step text not null,
  title text not null,
  detail text,
  due_on date not null,
  assigned_to text,
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  completed_by text,
  completed_at timestamptz,
  -- The company's own deadline wins over the generated sequence.
  hard_deadline boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists hr_drive_tasks_step on hr_drive_tasks (drive_id, step);
create index if not exists hr_drive_tasks_owner on hr_drive_tasks (assigned_to, status, due_on);

-- ---------------------------------------------------------------------------
-- §13 The student sheet sent to the company.

create table if not exists hr_submissions (
  id uuid primary key default gen_random_uuid(),
  drive_id uuid not null references placement_drives (id) on delete cascade,
  hr_id uuid references hr_contacts (id) on delete set null,
  recipient_email text not null,
  student_count int not null default 0 check (student_count >= 0),
  file_name text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'awaiting_approval', 'scheduled', 'sent', 'failed')),
  failure_reason text,
  prepared_by text,
  approved_by text,
  created_at timestamptz not null default now()
);
create index if not exists hr_submissions_drive on hr_submissions (drive_id);

-- ---------------------------------------------------------------------------
-- §17 Feedback from the HR and what we did about it.

create table if not exists hr_feedback (
  id uuid primary key default gen_random_uuid(),
  hr_id uuid not null references hr_contacts (id) on delete cascade,
  drive_id uuid references placement_drives (id) on delete set null,
  company text,
  feedback text not null,
  sentiment text not null default 'neutral' check (sentiment in ('positive', 'neutral', 'concern')),
  action text,
  assigned_to text,
  due_on date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'closed')),
  closed_by text,
  closed_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists hr_feedback_hr on hr_feedback (hr_id, created_at desc);

-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['hr_drive_tasks', 'hr_submissions', 'hr_feedback'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff %1$s" on %1$I', t);
    execute format('create policy "staff %1$s" on %1$I for all using (is_staff()) with check (is_staff())', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- Lead Management 360° (V7): ten pipeline stages, allocation with deadline / priority / instructions,
-- counsellor tasks (separate from lead closure), allocation history, archive, counsellor settings,
-- and the daily lead report for the super admin.

alter table leads drop constraint if exists leads_stage_check;
alter table leads add constraint leads_stage_check check (stage in (
  'lead', 'non_connected', 'connected', 'interested', 'visit_scheduled', 'visited',
  'admission_pending', 'enrolled', 'lost', 'future_follow_up'));
alter table leads add column if not exists priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent'));
alter table leads add column if not exists allocation_deadline timestamptz;
alter table leads add column if not exists allocation_note text;
alter table leads add column if not exists allocated_at timestamptz;
alter table leads add column if not exists allocated_by text;
alter table leads add column if not exists archived boolean not null default false;
alter table leads add column if not exists archived_at timestamptz;
alter table leads add column if not exists archive_reason text;
alter table leads add column if not exists duplicate_of uuid references leads (id) on delete set null;
create index if not exists leads_phone on leads (phone);
create index if not exists leads_assigned on leads (assigned_to, stage);

create table if not exists lead_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  assigned_to text not null,
  title text not null,
  due_at timestamptz,
  priority text not null default 'normal',
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  completed_at timestamptz,
  completed_by text,
  remarks text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists lead_tasks_owner on lead_tasks (assigned_to, status, due_at);

create table if not exists lead_allocations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads (id) on delete cascade,
  from_staff text,
  to_staff text not null,
  stage text,
  deadline timestamptz,
  priority text not null default 'normal',
  instructions text,
  mode text not null default 'individual' check (mode in ('individual', 'bulk', 'stage', 'reallocation', 'upload')),
  allocated_by text,
  created_at timestamptz not null default now()
);
create index if not exists lead_allocations_to on lead_allocations (to_staff, created_at);

create table if not exists lead_settings (
  id int primary key default 1 check (id = 1),
  report_time text not null default '20:30',
  report_email text,
  attend_hours int not null default 24,
  updated_at timestamptz not null default now()
);
insert into lead_settings (id) values (1) on conflict (id) do nothing;

create table if not exists lead_daily_reports (
  report_date date primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Counsellors: removed staff keep their history (deactivated, never deleted).
alter table staff add column if not exists active boolean not null default true;
alter table staff add column if not exists counsellor boolean not null default false;
alter table staff add column if not exists lead_capacity int not null default 30;

do $$
declare t text;
begin
  foreach t in array array['lead_tasks', 'lead_allocations', 'lead_settings', 'lead_daily_reports'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff %1$s" on %1$I', t);
    execute format('create policy "staff %1$s" on %1$I for all using (is_staff()) with check (is_staff())', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
  end loop;
  foreach t in array array['lead_tasks', 'lead_allocations', 'lead_settings'] loop
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;

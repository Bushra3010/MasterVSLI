-- College Management 360°: pipeline stage and staff allocation per college, student strength and targets,
-- contact call status, conversation history, incoming (public) college data, reference network,
-- opportunities, seminars, feedback, college finance and documents. Student leads link to their college.

alter table colleges add column if not exists stage text not null default 'new' check (stage in (
  'new', 'non_connected', 'connected', 'interested', 'meeting_scheduled', 'meeting_completed',
  'proposal_sent', 'mou_pending', 'mou_signed', 'not_interested', 'future_follow_up'));
alter table colleges add column if not exists assigned_to text;
alter table colleges add column if not exists student_strength int not null default 0;
alter table colleges add column if not exists target_students int not null default 0;
alter table colleges add column if not exists departments text;
alter table colleges add column if not exists website text;
alter table colleges add column if not exists next_follow_up timestamptz;
alter table colleges add column if not exists follow_up_note text;
alter table colleges add column if not exists source text;
-- Partner colleges with an MoU start in the "MoU signed" stage.
update colleges set stage = 'mou_signed' where status = 'partner' and stage = 'new';

alter table tpo_contacts add column if not exists department text;
alter table tpo_contacts add column if not exists call_status text not null default 'not_called' check (call_status in ('not_called', 'connected', 'non_connected'));

alter table leads add column if not exists college_id uuid references colleges (id) on delete set null;

create table if not exists college_activities (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges (id) on delete cascade,
  kind text not null,
  summary text not null,
  outcome text,
  by_name text,
  created_at timestamptz not null default now()
);
create index if not exists college_activities_college on college_activities (college_id, created_at desc);

create table if not exists college_submissions (
  id uuid primary key default gen_random_uuid(),
  college_name text not null,
  city text,
  state text,
  contact_name text,
  designation text,
  department text,
  phone text,
  email text,
  source text not null default 'public_form',
  submitted_by text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  college_id uuid references colleges (id) on delete set null,
  decided_by text,
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists college_references (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges (id) on delete cascade,
  student_id uuid references students (id) on delete set null,
  person_name text not null,
  person_type text not null default 'active_student' check (person_type in ('active_student', 'alumni', 'placed_alumni', 'faculty', 'other')),
  department text,
  batch text,
  reference_to text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists college_opportunities (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges (id) on delete cascade,
  kind text not null default 'training',
  title text not null,
  students int not null default 0,
  value numeric(12, 2) not null default 0,
  expected_date date,
  status text not null default 'open' check (status in ('open', 'proposed', 'won', 'lost')),
  owner text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists college_events (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges (id) on delete cascade,
  kind text not null default 'seminar',
  title text not null,
  event_date date,
  speaker text,
  attendees int not null default 0,
  leads_generated int not null default 0,
  status text not null default 'planned' check (status in ('planned', 'done', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists college_feedback (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges (id) on delete cascade,
  given_by text,
  rating int not null check (rating between 1 and 5),
  comments text,
  on_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists college_finance (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges (id) on delete cascade,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  kind text not null default 'invoice' check (kind in ('invoice', 'payment')),
  due_date date,
  paid_on date,
  reference text,
  created_at timestamptz not null default now()
);

create table if not exists college_documents (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references colleges (id) on delete cascade,
  title text not null,
  kind text not null default 'other',
  url text,
  storage_path text,
  uploaded_by text,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['college_activities', 'college_submissions', 'college_references', 'college_opportunities', 'college_events', 'college_feedback', 'college_finance', 'college_documents'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff %1$s" on %1$I', t);
    execute format('create policy "staff %1$s" on %1$I for all using (is_staff()) with check (is_staff())', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;
-- The public registration page inserts through the server (service role); anonymous users get no table access.

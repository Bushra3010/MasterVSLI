-- Student Management 360°: interviews (upcoming / missed with explanation), resume library,
-- student payment submissions verified by the office, requests & support (certificates,
-- validity extensions, tickets), reminder acknowledgements, and the resume chosen for a drive.

create table if not exists student_resumes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  title text not null,
  domain text,
  version text not null default 'v1',
  document_id uuid references student_documents (id) on delete set null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists student_resumes_student on student_resumes (student_id);

create table if not exists student_interviews (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  drive_id uuid references placement_drives (id) on delete set null,
  company text not null,
  role text,
  round text,
  scheduled_at timestamptz not null,
  mode text,
  location text,
  call_letter_url text,
  status text not null default 'scheduled' check (status in ('scheduled', 'attended', 'missed', 'cancelled')),
  explanation text,
  explained_at timestamptz,
  outcome text,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists student_interviews_student on student_interviews (student_id, scheduled_at);

create table if not exists payment_submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  installment_id uuid references installments (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  mode text not null default 'UPI',
  reference text,
  paid_on date not null default current_date,
  document_id uuid references student_documents (id) on delete set null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  office_note text,
  decided_by text,
  decided_at timestamptz,
  payment_id uuid references payments (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists payment_submissions_student on payment_submissions (student_id);

create table if not exists student_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  kind text not null check (kind in ('certificate', 'validity_extension', 'support', 'feedback', 'document', 'other')),
  subject text not null,
  details text,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'in_progress', 'approved', 'rejected', 'closed')),
  response text,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists student_requests_student on student_requests (student_id);

create table if not exists reminder_acks (
  student_id uuid not null references students (id) on delete cascade,
  key text not null,
  acked_at timestamptz not null default now(),
  primary key (student_id, key)
);

alter table drive_responses add column if not exists resume_id uuid references student_resumes (id) on delete set null;

do $$
declare t text;
begin
  foreach t in array array['student_resumes', 'student_interviews', 'payment_submissions', 'student_requests', 'reminder_acks'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff %1$s" on %1$I', t);
    execute format('create policy "staff %1$s" on %1$I for all using (is_staff()) with check (is_staff())', t);
    execute format('drop policy if exists "own %1$s" on %1$I', t);
    execute format('create policy "own %1$s" on %1$I for select using (student_id = my_student_id())', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
  end loop;
  foreach t in array array['student_resumes', 'student_interviews', 'payment_submissions', 'student_requests'] loop
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;

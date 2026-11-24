-- Enhanced student profile & admission:
-- master dropdown options (admin add/remove), applications & interview tracking, notes & remarks,
-- profile verification, education duration/state, company location, and flexible extra profile fields.

create table if not exists master_options (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('board', 'university', 'stream', 'contact_position', 'validity_months', 'designation')),
  value text not null,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (category, value)
);

insert into master_options (category, value, sort) values
  ('board', 'CBSE', 1), ('board', 'ICSE', 2), ('board', 'State Board (Karnataka)', 3), ('board', 'State Board (AP)', 4),
  ('board', 'State Board (Telangana)', 5), ('board', 'State Board (Tamil Nadu)', 6), ('board', 'State Board (Kerala)', 7),
  ('board', 'State Board (Maharashtra)', 8), ('board', 'NIOS', 9),
  ('university', 'VTU', 1), ('university', 'JNTU Hyderabad', 2), ('university', 'JNTU Anantapur', 3), ('university', 'JNTU Kakinada', 4),
  ('university', 'Anna University', 5), ('university', 'Osmania University', 6), ('university', 'Andhra University', 7), ('university', 'Autonomous / Deemed', 8),
  ('stream', 'Science (PCM)', 1), ('stream', 'Science (PCB)', 2), ('stream', 'Commerce', 3), ('stream', 'ECE', 4), ('stream', 'EEE', 5),
  ('stream', 'EIE', 6), ('stream', 'CSE', 7), ('stream', 'VLSI Design', 8), ('stream', 'Embedded Systems', 9),
  ('contact_position', 'TPO', 1), ('contact_position', 'HOD', 2), ('contact_position', 'Principal', 3), ('contact_position', 'Faculty', 4),
  ('validity_months', '3', 1), ('validity_months', '6', 2), ('validity_months', '9', 3), ('validity_months', '12', 4),
  ('designation', 'Design Engineer', 1), ('designation', 'DV Engineer', 2), ('designation', 'Physical Design Engineer', 3), ('designation', 'Graduate Engineer Trainee', 4)
on conflict (category, value) do nothing;

create table if not exists student_applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  drive_id uuid references placement_drives (id) on delete set null,
  company text not null,
  role text,
  applied_on date not null default current_date,
  rounds int not null default 0,
  status text not null default 'applied' check (status in ('applied', 'in_process', 'shortlisted', 'rejected', 'selected', 'placed')),
  package text,
  doj date,
  hr_name text,
  hr_email text,
  job_location text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists student_applications_student on student_applications (student_id);

create table if not exists student_notes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  note text not null,
  by_name text,
  created_at timestamptz not null default now()
);

alter table students add column if not exists extra jsonb not null default '{}'::jsonb;
alter table students add column if not exists profile_verified_by text;
alter table students add column if not exists profile_verified_at timestamptz;
alter table student_education add column if not exists start_year int;
alter table student_education add column if not exists end_year int;
alter table student_education add column if not exists state text;
alter table clients add column if not exists city text;
alter table clients add column if not exists state text;

-- Access: everyone signed in reads the dropdown options; staff add/remove.
alter table master_options enable row level security;
drop policy if exists "read master options" on master_options;
create policy "read master options" on master_options for select using (auth.uid() is not null);
drop policy if exists "staff master options" on master_options;
create policy "staff master options" on master_options for all using (is_staff()) with check (is_staff());
grant select, insert, update, delete on master_options to authenticated, service_role;

-- Applications: staff manage, students read their own. Notes: staff only.
alter table student_applications enable row level security;
drop policy if exists "staff student_applications" on student_applications;
create policy "staff student_applications" on student_applications for all using (is_staff()) with check (is_staff());
drop policy if exists "own student_applications" on student_applications;
create policy "own student_applications" on student_applications for select using (student_id = my_student_id());
grant select, insert, update, delete on student_applications to authenticated, service_role;

alter table student_notes enable row level security;
drop policy if exists "staff student_notes" on student_notes;
create policy "staff student_notes" on student_notes for all using (is_staff()) with check (is_staff());
grant select, insert, update, delete on student_notes to authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['master_options', 'student_applications', 'student_notes'] loop
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;

-- Core modules added after launch: course syllabus, system/lab management, staff & HR
-- (attendance, leave, payroll), accounts & finance, and the communication log.
-- Additive only: no existing table or row is changed.

alter table courses add column if not exists syllabus text;

-- ---------------------------------------------------------------------------
-- System / lab management (a lab PC can be assigned to one student; its
-- TeamViewer ID is copied to that student's TeamViewer access mapping)
-- ---------------------------------------------------------------------------
create table if not exists lab_systems (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  location text,
  specs text,
  teamviewer_id text,
  status text not null default 'available' check (status in ('available', 'assigned', 'maintenance')),
  student_id uuid references students (id) on delete set null,
  assigned_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Staff & HR
-- ---------------------------------------------------------------------------
create table if not exists staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id) on delete cascade,
  att_date date not null,
  status text not null check (status in ('present', 'absent', 'half_day', 'leave')),
  unique (staff_id, att_date)
);

create table if not exists leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id) on delete cascade,
  from_date date not null,
  to_date date not null,
  leave_type text not null default 'casual',
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists payroll (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id) on delete cascade,
  month text not null,                 -- YYYY-MM
  working_days int not null,
  paid_days numeric(5, 1) not null,
  gross numeric(12, 2) not null,
  deductions numeric(12, 2) not null default 0,
  net numeric(12, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  unique (staff_id, month)
);

-- ---------------------------------------------------------------------------
-- Accounts & finance: other income, expenses and vendor settlements
-- (student fee payments come from the payments table)
-- ---------------------------------------------------------------------------
create table if not exists finance_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('income', 'expense', 'settlement')),
  category text not null,
  amount numeric(12, 2) not null check (amount > 0),
  entry_date date not null default current_date,
  vendor_id uuid references vendors (id) on delete set null,
  reference text,
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Communication log (WhatsApp / email broadcasts to students)
-- ---------------------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('email', 'whatsapp')),
  audience text not null,
  subject text,
  body text not null,
  recipients int not null default 0,
  sent int not null default 0,
  status text not null default 'logged',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: staff only
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['lab_systems', 'staff_attendance', 'leave_requests', 'payroll', 'finance_entries', 'messages'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff %1$s" on %1$I', t);
    execute format('create policy "staff %1$s" on %1$I for all using (is_staff()) with check (is_staff())', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
  end loop;
end $$;

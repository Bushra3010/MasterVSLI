-- Staff self-service (daily tasks), online fee payments (UPI / Razorpay payment links)
-- and website admission enquiries. Additive only.

create table if not exists staff_tasks (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

-- One row per online payment attempt for an installment.
create table if not exists payment_requests (
  id uuid primary key default gen_random_uuid(),
  installment_id uuid not null references installments (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  provider text not null check (provider in ('razorpay', 'upi')),
  external_id text,
  url text,
  status text not null default 'created' check (status in ('created', 'paid', 'cancelled')),
  paid_reference text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create unique index if not exists payment_requests_external on payment_requests (external_id) where external_id is not null;

-- Enquiries posted by the public website form (/apply or /api/public/admission).
create table if not exists admission_enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  course_code text,
  city text,
  message text,
  source text not null default 'website',
  status text not null default 'new' check (status in ('new', 'contacted', 'admitted', 'closed')),
  student_id uuid references students (id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['staff_tasks', 'payment_requests', 'admission_enquiries'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff %1$s" on %1$I', t);
    execute format('create policy "staff %1$s" on %1$I for all using (is_staff()) with check (is_staff())', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
  end loop;
end $$;

-- Students can see their own payment requests (to show "Pay now" status in the portal).
drop policy if exists "own payment_requests" on payment_requests;
create policy "own payment_requests" on payment_requests for select using (student_id = my_student_id());

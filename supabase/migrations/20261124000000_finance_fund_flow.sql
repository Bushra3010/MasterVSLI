-- Finance & fund flow: three entities (MasterVLSI institute, Enrich Silicon company, rental property),
-- bank/cash accounts, tenants & rental income, expenses with approvals, multi-source payments,
-- inter-entity settlements, fund transfers, recurring payments and budgets.
-- Admin-only (super_admin / admin) at the database level.

-- Money sources/destinations are written as a "ref":
--   'account:<uuid>'  a bank / cash / UPI account in fin_accounts
--   'pool:rent'       rent collected but not yet banked (rental property)
--   'pool:fees'       student fees collected but not yet banked (MasterVLSI)

-- is_admin() and audit_row() come from 20261122000300_gaps.sql.

create table if not exists fin_accounts (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('mastervlsi', 'enrich', 'property')),
  name text not null,
  kind text not null default 'bank' check (kind in ('bank', 'cash', 'upi', 'wallet')),
  bank_name text,
  account_no text,
  ifsc text,
  opening_balance numeric(14, 2) not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---- rental property -------------------------------------------------------------------
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists property_units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties (id) on delete cascade,
  code text not null,                 -- "Home 03"
  unit_type text,                     -- "2BHK"
  floor text,
  area_sqft numeric(10, 2),
  status text not null default 'vacant' check (status in ('vacant', 'occupied', 'maintenance')),
  created_at timestamptz not null default now(),
  unique (property_id, code)
);

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  alt_phone text,
  email text,
  id_proof_type text,
  id_proof_no text,
  occupation text,
  family_members int,
  permanent_address text,
  emergency_name text,
  emergency_phone text,
  kyc_verified boolean not null default false,
  police_verified boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists tenancies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  unit_id uuid not null references property_units (id),
  agreement_no text,
  start_date date not null,
  end_date date,
  monthly_rent numeric(12, 2) not null,
  due_day int not null default 5 check (due_day between 1 and 28),
  maintenance_charge numeric(12, 2) not null default 0,
  security_deposit numeric(12, 2) not null default 0,
  escalation_pct numeric(5, 2) not null default 0,
  notice_days int not null default 30,
  status text not null default 'active' check (status in ('active', 'notice', 'ended')),
  exit_date date,
  deductions numeric(12, 2) not null default 0,
  refund_amount numeric(12, 2),
  settled_on date,
  settlement_note text,
  created_at timestamptz not null default now()
);

create table if not exists rent_dues (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references tenancies (id) on delete cascade,
  period text not null,               -- YYYY-MM
  due_date date not null,
  rent numeric(12, 2) not null default 0,
  maintenance numeric(12, 2) not null default 0,
  utilities numeric(12, 2) not null default 0,
  other numeric(12, 2) not null default 0,
  paid numeric(12, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'partial', 'paid')),
  created_at timestamptz not null default now(),
  unique (tenancy_id, period)
);

create table if not exists tenant_payments (
  id uuid primary key default gen_random_uuid(),
  tenancy_id uuid not null references tenancies (id) on delete cascade,
  rent_due_id uuid references rent_dues (id) on delete set null,
  kind text not null default 'rent' check (kind in ('rent', 'deposit', 'utility', 'maintenance', 'other', 'refund')),
  amount numeric(12, 2) not null check (amount > 0),
  mode text not null default 'UPI',
  reference text,
  paid_on date not null default current_date,
  account_id uuid references fin_accounts (id) on delete set null,  -- null = held in pool:rent
  note text,
  created_at timestamptz not null default now()
);

create table if not exists utility_bills (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references property_units (id) on delete cascade,
  tenancy_id uuid references tenancies (id) on delete set null,
  utility text not null check (utility in ('electricity', 'water', 'gas', 'internet', 'other')),
  bill_month text not null,           -- YYYY-MM
  meter_no text,
  prev_reading numeric(12, 2),
  curr_reading numeric(12, 2),
  amount numeric(12, 2) not null default 0,
  payer text not null default 'tenant' check (payer in ('tenant', 'owner')),
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  paid_on date,
  created_at timestamptz not null default now()
);

create table if not exists maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references property_units (id) on delete cascade,
  tenancy_id uuid references tenancies (id) on delete set null,
  title text not null,
  category text,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  raised_on date not null default current_date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  cost numeric(12, 2) not null default 0,
  charge_to text not null default 'owner' check (charge_to in ('owner', 'tenant')),
  vendor_id uuid references vendors (id) on delete set null,
  completed_on date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists tenant_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants (id) on delete cascade,
  kind text not null,
  storage_path text not null,
  verified boolean not null default false,
  uploaded_at timestamptz not null default now()
);

-- ---- expenses, payments, settlements ---------------------------------------------------------
create table if not exists recurring_payments (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('mastervlsi', 'enrich', 'property')),
  category text not null,
  vendor_id uuid references vendors (id) on delete set null,
  payee text,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  frequency text not null default 'monthly' check (frequency in ('monthly', 'quarterly', 'yearly')),
  next_due date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('mastervlsi', 'enrich', 'property')),
  category text not null,
  vendor_id uuid references vendors (id) on delete set null,
  payee text,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null default current_date,
  due_date date,
  invoice_no text,
  unit_id uuid references property_units (id) on delete set null,
  status text not null default 'approved' check (status in ('pending_approval', 'approved', 'paid', 'rejected')),
  paid_amount numeric(12, 2) not null default 0,
  approved_by text,
  approved_at timestamptz,
  recurring_id uuid references recurring_payments (id) on delete set null,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists expenses_date_idx on expenses (expense_date);

create table if not exists fund_payments (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid references expenses (id) on delete set null,
  vendor_id uuid references vendors (id) on delete set null,
  payee text not null,
  total numeric(12, 2) not null check (total > 0),
  paid_on date not null default current_date,
  reference text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists payment_sources (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references fund_payments (id) on delete cascade,
  source_ref text not null,           -- account:<id> | pool:rent | pool:fees
  entity text not null check (entity in ('mastervlsi', 'enrich', 'property')),
  tenancy_id uuid references tenancies (id) on delete set null,   -- which tenant's rent, when from pool:rent
  amount numeric(12, 2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists inter_entity_settlements (
  id uuid primary key default gen_random_uuid(),
  from_entity text not null check (from_entity in ('mastervlsi', 'enrich', 'property')),   -- owes
  to_entity text not null check (to_entity in ('mastervlsi', 'enrich', 'property')),       -- is owed
  amount numeric(12, 2) not null check (amount > 0),
  reason text,
  payment_id uuid references fund_payments (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'settled')),
  settled_on date,
  created_at timestamptz not null default now()
);

create table if not exists fund_transfers (
  id uuid primary key default gen_random_uuid(),
  from_ref text not null,
  to_ref text not null,
  amount numeric(12, 2) not null check (amount > 0),
  transfer_date date not null default current_date,
  reference text,
  note text,
  settlement_id uuid references inter_entity_settlements (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  entity text not null check (entity in ('mastervlsi', 'enrich', 'property')),
  category text not null,
  month text not null,                -- YYYY-MM
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (entity, category, month)
);

-- Other income (and legacy expenses) in the existing cash book can be tied to an account.
alter table finance_entries add column if not exists account_id uuid references fin_accounts (id) on delete set null;

-- ---- access: admins only, plus audit trail --------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['fin_accounts', 'properties', 'property_units', 'tenants', 'tenancies', 'rent_dues',
                           'tenant_payments', 'utility_bills', 'maintenance_requests', 'tenant_documents',
                           'recurring_payments', 'expenses', 'fund_payments', 'payment_sources',
                           'inter_entity_settlements', 'fund_transfers', 'budgets'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "admins %1$s" on %1$I', t);
    execute format('create policy "admins %1$s" on %1$I for all using (is_admin()) with check (is_admin())', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;

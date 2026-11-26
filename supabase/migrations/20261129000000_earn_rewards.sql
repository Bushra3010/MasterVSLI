-- Earn & Rewards redesign: more activity kinds (institute feedback, incident reports), activity details,
-- admin-configurable targets & rewards, program settings, and goodies earned / collected.

alter table ambassador_activities drop constraint if exists ambassador_activities_kind_check;
alter table ambassador_activities add constraint ambassador_activities_kind_check
  check (kind in ('referral', 'review', 'social', 'mentor', 'feedback', 'incident'));
alter table ambassador_activities add column if not exists data jsonb not null default '{}'::jsonb;
alter table ambassador_activities add column if not exists decided_by text;
alter table ambassador_activities add column if not exists decided_at timestamptz;

create table if not exists reward_settings (
  key text primary key check (key in ('institute_feedback', 'google_review', 'social_media', 'referral', 'mentorship', 'incident')),
  label text not null,
  target numeric(14, 2),
  reward_type text not null default 'goodie' check (reward_type in ('goodie', 'amount', 'mentorship', 'none')),
  reward_amount numeric(12, 2) not null default 0,
  active boolean not null default true,
  paused boolean not null default false,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);
insert into reward_settings (key, label, target, reward_type, reward_amount, sort) values
  ('institute_feedback', 'Institute Feedback', 4, 'goodie', 0, 1),
  ('google_review', 'Google Review (Voluntary)', null, 'none', 0, 2),
  ('social_media', 'Social Media Activity', 10000, 'goodie', 0, 3),
  ('referral', 'Referral (Admission)', 1, 'amount', 2000, 4),
  ('mentorship', 'Mentorship (Min. 4 Months)', null, 'goodie', 0, 5),
  ('incident', 'Incident Report (Verified)', null, 'goodie', 0, 6)
on conflict (key) do nothing;

create table if not exists reward_program (
  id int primary key default 1 check (id = 1),
  academic_year text not null default '2026 / 2027',
  valid_from date,
  valid_to date,
  branch_id uuid references branches (id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into reward_program (id) values (1) on conflict (id) do nothing;

create table if not exists reward_goodies (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  source text not null,
  ref text not null,
  reason text not null,
  status text not null default 'earned' check (status in ('earned', 'collected')),
  earned_at timestamptz not null default now(),
  collected_at timestamptz,
  unique (student_id, source, ref)
);

alter table reward_settings enable row level security;
alter table reward_program enable row level security;
alter table reward_goodies enable row level security;
do $$
declare t text;
begin
  foreach t in array array['reward_settings', 'reward_program', 'reward_goodies'] loop
    execute format('drop policy if exists "staff %1$s" on %1$I', t);
    execute format('create policy "staff %1$s" on %1$I for all using (is_staff()) with check (is_staff())', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;
drop policy if exists "read reward_settings" on reward_settings;
create policy "read reward_settings" on reward_settings for select using (auth.uid() is not null);
drop policy if exists "read reward_program" on reward_program;
create policy "read reward_program" on reward_program for select using (auth.uid() is not null);
drop policy if exists "own reward_goodies" on reward_goodies;
create policy "own reward_goodies" on reward_goodies for select using (student_id = my_student_id());

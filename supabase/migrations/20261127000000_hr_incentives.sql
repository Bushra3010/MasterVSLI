-- HR incentives: commission rules (admin configurable), commission ledger per staff member,
-- monthly targets, and milestone incentives. Lead-stage and admission commissions are credited
-- automatically by the app; other activities are logged by HR and approved by an admin.

create table if not exists hr_commission_rules (
  key text primary key,
  label text not null,
  amount numeric(12, 2) not null default 0,
  unit text not null default 'per activity',
  metric text,
  kind text not null default 'activity' check (kind in ('auto', 'activity', 'milestone')),
  threshold numeric(14, 2),
  loggable boolean not null default true,
  active boolean not null default true,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

insert into hr_commission_rules (key, label, amount, unit, metric, kind, threshold, loggable, sort) values
  ('lead_interested', 'Lead → Interested', 300, 'per lead', null, 'auto', null, false, 1),
  ('interested_visited', 'Interested → Visited', 300, 'per lead', null, 'auto', null, false, 2),
  ('visited_admission', 'Visited → Admission', 400, 'per student', 'admissions', 'auto', null, false, 3),
  ('admission_individual', 'Individual admission (Normal / College / Corporate)', 1000, 'per student', 'admissions', 'activity', null, true, 4),
  ('admission_bulk', 'Bulk admission (College / Corporate)', 500, 'per student', 'admissions', 'activity', null, true, 5),
  ('review', 'Student review (internal)', 10, 'per review', 'reviews', 'activity', null, true, 6),
  ('feedback_video', 'Feedback video (student)', 10, 'per video', 'feedback_videos', 'activity', null, true, 7),
  ('video_views', 'Video views', 0, 'per view', 'video_views', 'activity', null, true, 8),
  ('interview', 'Interview scheduled', 100, 'per interview', 'interviews', 'activity', null, true, 9),
  ('college_tieup', 'College tie-up / MoU', 0, 'admin configurable', 'tieups', 'activity', null, true, 10),
  ('corporate_training', 'Corporate training tie-up – admission', 1000, 'per student', 'admissions', 'activity', null, true, 11),
  ('corporate_placement', 'Corporate placement tie-up', 100, 'per placed student', 'tieups', 'activity', null, true, 12),
  ('milestone_reviews', 'Milestone: 50 reviews', 500, 'extra incentive', 'reviews', 'milestone', 50, false, 13),
  ('milestone_videos', 'Milestone: 50 feedback videos', 500, 'extra incentive', 'feedback_videos', 'milestone', 50, false, 14),
  ('milestone_views', 'Milestone: 10,000 video views', 100, 'extra incentive', 'video_views', 'milestone', 10000, false, 15)
on conflict (key) do nothing;

create table if not exists hr_commissions (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff (id) on delete cascade,
  rule_key text not null,
  label text not null,
  quantity numeric(14, 2) not null default 1,
  amount numeric(12, 2) not null default 0,
  category text check (category in ('normal', 'college', 'corporate')),
  ref_id text,
  ref_label text,
  occurred_on date not null default current_date,
  status text not null default 'pending' check (status in ('pending', 'approved', 'paid', 'rejected')),
  proof_url text,
  note text,
  created_by text,
  decided_by text,
  decided_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists hr_commissions_staff_date on hr_commissions (staff_id, occurred_on);
create index if not exists hr_commissions_ref on hr_commissions (rule_key, ref_id);

create table if not exists hr_targets (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid references staff (id) on delete cascade,
  month text,
  metric text not null check (metric in ('admissions', 'reviews', 'feedback_videos', 'video_views', 'interviews', 'tieups')),
  target numeric(14, 2) not null,
  created_at timestamptz not null default now()
);
insert into hr_targets (staff_id, month, metric, target)
select null, null, m, t from (values ('admissions', 40), ('reviews', 50), ('feedback_videos', 50), ('video_views', 10000), ('interviews', 15), ('tieups', 5)) v(m, t)
where not exists (select 1 from hr_targets where staff_id is null and month is null);

-- Lead-to-admission credit needs to know which HR admitted a direct admission.
alter table students add column if not exists counsellor_id uuid references staff (id) on delete set null;

do $$
declare t text;
begin
  foreach t in array array['hr_commission_rules', 'hr_commissions', 'hr_targets'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "staff %1$s" on %1$I', t);
    execute format('create policy "staff %1$s" on %1$I for all using (is_staff()) with check (is_staff())', t);
    execute format('grant select, insert, update, delete on %I to authenticated, service_role', t);
    execute format('drop trigger if exists audit_%1$s on %1$I', t);
    execute format('create trigger audit_%1$s after insert or update or delete on %1$I for each row execute function public.audit_row()', t);
  end loop;
end $$;

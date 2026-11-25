-- Staff Calendar & Reminders: events/tasks with category, assignee, priority,
-- reminders (1 day before / same day / 1 hour before) on dashboard, WhatsApp and email.

create table if not exists calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'task',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  assignee_id uuid references staff (id) on delete set null,
  location text,
  reminders text[] not null default '{}',
  channels text[] not null default '{dashboard}',
  reminders_sent text[] not null default '{}',
  done boolean not null default false,
  done_at timestamptz,
  done_by text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calendar_events_start on calendar_events (start_at);
create index if not exists calendar_events_assignee on calendar_events (assignee_id);

alter table calendar_events enable row level security;
drop policy if exists "staff calendar_events" on calendar_events;
create policy "staff calendar_events" on calendar_events for all using (is_staff()) with check (is_staff());
grant select, insert, update, delete on calendar_events to authenticated, service_role;

drop trigger if exists audit_calendar_events on calendar_events;
create trigger audit_calendar_events after insert or update or delete on calendar_events for each row execute function public.audit_row();

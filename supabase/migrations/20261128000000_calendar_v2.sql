-- Staff calendar v2: "Urgent" priority and a linked record (student / company / college) per reminder.
alter table calendar_events drop constraint if exists calendar_events_priority_check;
alter table calendar_events add constraint calendar_events_priority_check check (priority in ('low', 'medium', 'high', 'urgent'));
alter table calendar_events add column if not exists linked_label text;
alter table calendar_events add column if not exists linked_href text;

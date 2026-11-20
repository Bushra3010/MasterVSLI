-- Reference data to start with. Students are created from the ERP's "New admission" form.
insert into courses (code, name, duration_months, validity_months, fee) values
  ('DV',  'ASIC Design Verification (SV + UVM)', 6, 12, 30000),
  ('PD',  'Physical Design (RTL to GDSII)',      6, 12, 35000),
  ('DFT', 'Design for Testability',              5, 10, 28000),
  ('AL',  'Analog Layout',                       4,  9, 25000)
on conflict (code) do nothing;

insert into batches (course_id, name, mode, start_date)
select id, code || '-Hybrid-Jan26', 'hybrid', date '2026-01-05' from courses
on conflict do nothing;

with v1 as (insert into vendors (name, contact_person) values ('Vendor 1', 'Accounts') returning id),
     v2 as (insert into vendors (name, contact_person) values ('Vendor 2', 'Accounts') returning id)
insert into vendors (parent_id, name)
select id, 'Sub Vendor A' from v1 union all
select id, 'Sub Vendor B' from v1 union all
select id, 'Sub Vendor C' from v2;

-- After creating your first user in Supabase Auth, promote it:
--   update profiles set role = 'admin' where id = (select id from auth.users where email = '<you>');
-- Link a student login to a student record:
--   update students set user_id = (select id from auth.users where email = '<student email>') where enrollment_no = 'MVL2026001';

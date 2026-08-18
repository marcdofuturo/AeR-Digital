-- Task zero: panel hardening, configuration, task synchronization and pitching jobs.

update registrations
set status = 'pendente'
where status = 'na';

alter table registrations drop constraint if exists registrations_status_check;

alter table registrations
  add constraint registrations_status_check
  check (status in ('pendente', 'em_andamento', 'concluido', 'rejeitado'));

alter table tenants add column if not exists responsible_name text;
alter table tenants add column if not exists contact_email text;
alter table tenants add column if not exists contact_phone text;

create index if not exists memberships_user_tenant_role_idx
  on memberships (user_id, tenant_id, role);

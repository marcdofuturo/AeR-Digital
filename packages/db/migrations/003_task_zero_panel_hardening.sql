-- Task zero: panel hardening, configuration, task synchronization and pitching jobs.

update registrations
set status = 'pendente'
where status = 'na';

alter table registrations drop constraint if exists registrations_status_check;

alter table registrations
  add constraint registrations_status_check
  check (status in ('pendente', 'em_andamento', 'concluido', 'rejeitado'));

-- Release pipeline v3: analysis -> authorization -> work/fonogram registration -> distribution -> ECAD.

update releases
set stage = case stage
  when 'recebido' then 'em_analise'
  when 'autorizado' then 'registrar_obra'
  when 'registrado' then 'situacao_ecad'
  else stage
end
where stage in ('recebido', 'autorizado', 'registrado');

alter table releases drop constraint if exists releases_stage_check;

alter table releases
  add constraint releases_stage_check
  check (stage in (
    'em_analise',
    'autorizacao_pendente',
    'registrar_obra',
    'registrar_fonograma',
    'pronto_p_distribuir',
    'distribuido',
    'situacao_ecad',
    'concluido',
    'arquivado'
  ));

alter table releases alter column stage set default 'em_analise';

-- Grupos de prueba (aplicado en producción el 2026-11-03).
-- Un grupo con is_test = true no cuenta en Reportes GCX, /reportes, los
-- reportes de asistencia, el Panel GCX ni el catálogo: cada consulta de
-- groups del front lo filtra con .eq('is_test', false). Sólo lo ve su
-- anfitrión en /mis-grupos. Ver instrucciones_ia.md, sección 37.
--
-- Hay que correrlo ANTES de publicar un front que nombre la columna.

alter table public.groups add column if not exists is_test boolean not null default false;

comment on column public.groups.is_test is
  'Grupo de prueba: no cuenta en Reportes GCX, /reportes ni el Panel GCX; sólo lo ve su anfitrión en /mis-grupos.';

-- Rollback: alter table public.groups drop column if exists is_test;

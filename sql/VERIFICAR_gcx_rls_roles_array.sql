-- Correr DESPUÉS de aplicar fix_gcx_rls_roles_array.sql.
-- Esperado: pasa_ahora = true y pendientes_visibles = 17 para el encargado.
with u as (
  select id, role::text as role_singular, roles
  from users where 'ADMIN_GROUPS' = any(coalesce(roles,'{}')) limit 1
)
select
  u.role_singular,
  u.roles,
  (u.role_singular = any(array['SUPER_ADMIN','ADMIN_GROUPS','ENCARGADO_GRUPOS','PASTOR']))          as pasaba_antes,
  (u.role_singular = any(array['SUPER_ADMIN','ADMIN_GROUPS','ENCARGADO_GRUPOS','PASTOR'])
   or u.roles && array['SUPER_ADMIN','ADMIN_GROUPS','ENCARGADO_GRUPOS','PASTOR'])                   as pasa_ahora,
  (select count(*) from groups where status='pending')                                              as pendientes_visibles,
  (select count(*) from groups)                                                                     as grupos_visibles,
  -- ninguna política debe seguir mirando solo la columna singular
  (select count(*) from pg_policy p join pg_class c on c.oid=p.polrelid
    where c.relname in ('groups','group_dropout_requests','group_transfer_requests')
      and (coalesce(pg_get_expr(p.polqual,p.polrelid),'')||' '||coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')) ~* 'users\.role[^s]')
                                                                                                    as politicas_aun_rotas
from u;

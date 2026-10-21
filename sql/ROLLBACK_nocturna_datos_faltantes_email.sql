-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK de sql/nocturna_datos_faltantes_email.sql
-- 2026-10-21
--
-- OJO: borrar la columna borra el registro de a quién ya se le mandó el email.
-- Si después se vuelve a aplicar, todas quedan en NULL y la función les
-- mandaría el pedido DE NUEVO a familias que ya lo recibieron. Antes de
-- correr esto, guardarse los ids que la tengan cargada.
-- ════════════════════════════════════════════════════════════════════════════

drop index if exists public.nocturna_insc_datos_faltantes_idx;

alter table public.nocturna_inscripciones
    drop column if exists datos_faltantes_email_at;

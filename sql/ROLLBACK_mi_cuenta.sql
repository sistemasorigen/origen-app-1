-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK de sql/mi_cuenta.sql
-- 2026-10-22
--
-- OJO CON LO QUE BORRA. Las dos tablas nuevas guardan cosas que no se pueden
-- volver a juntar:
--   · solicitudes_datos  — es la constancia de que alguien ejerció un derecho
--     de la Ley 25.326 y de cuándo se le respondió. Borrarla es borrar la
--     prueba. Antes de correr esto, exportarla.
--   · reportes_problemas — lo que la gente se tomó el trabajo de escribir.
-- Las capturas del bucket se borran aparte, a mano, y recién después del
-- bucket (si quedan objetos, el delete del bucket falla).
--
-- Las 4 columnas de ventas_voluntarios y las 2 de nocturna_config están
-- comentadas al final: borrarlas pierde qué pedidos ya se entregaron.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 4 · Reportes ────────────────────────────────────────────────────────────
drop policy if exists reportes_capturas_select on storage.objects;
drop policy if exists reportes_capturas_insert on storage.objects;
-- delete from storage.objects where bucket_id = 'reportes-capturas';
-- delete from storage.buckets where id = 'reportes-capturas';

drop trigger if exists trg_reportes_problemas_avisar on public.reportes_problemas;
drop function if exists public.reportes_problemas_avisar();
drop function if exists public.crear_reporte_problema(text, text, text, text, text);
drop function if exists public.mis_reportes();
drop table if exists public.reportes_problemas;
drop sequence if exists public.reportes_problemas_numero_seq;

-- ── 3 · Solicitudes ─────────────────────────────────────────────────────────
drop trigger if exists trg_solicitudes_datos_avisar on public.solicitudes_datos;
drop trigger if exists trg_solicitudes_datos_limite on public.solicitudes_datos;
drop function if exists public.solicitudes_datos_avisar();
drop function if exists public.solicitudes_datos_limite();
drop function if exists public.crear_solicitud_datos(text, text, text);
drop function if exists public.mis_solicitudes_datos();
drop table if exists public.solicitudes_datos;
drop sequence if exists public.solicitudes_datos_numero_seq;

-- ── 2 · Inscripciones ───────────────────────────────────────────────────────
drop function if exists public.mi_inscripcion_detalle(uuid);
drop function if exists public.mis_inscripciones_eventos();
drop function if exists public.nocturna_email_verificado();

-- ── 1 · Entrega de pedidos ──────────────────────────────────────────────────
drop function if exists public.marcar_venta(uuid, text);
drop function if exists public.estado_venta(timestamptz, timestamptz);
drop index if exists public.idx_ventas_voluntarios_pendientes;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- Descomentar SÓLO a conciencia: esto borra qué pedidos se entregaron y
-- cuándo es el evento.
-- ════════════════════════════════════════════════════════════════════════════
-- alter table public.ventas_voluntarios
--     drop column if exists retirada_por,
--     drop column if exists retirada_at,
--     drop column if exists lista_por,
--     drop column if exists lista_at;
--
-- alter table public.nocturna_config
--     drop column if exists evento_hora,
--     drop column if exists evento_fecha;

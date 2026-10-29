-- ════════════════════════════════════════════════════════════════════════════
-- DESHACER sql/notif_programadas.sql
--
-- Vuelve el trigger de push y notif_alertas_admin() a su definición EXACTA de
-- antes (copiada de pg_proc el 2026-10-29, antes de aplicar), y borra el
-- reloj, el lote, las RPC nuevas, el CHECK y las columnas.
--
-- OJO: BORRA LAS PROGRAMADAS (las filas de notif_alertas con tipo
-- 'programada'). Sin el reloj no se mandarían nunca, y sin eliminada_at las
-- dadas de baja volverían a aparecer en la lista. Los avisos que ya llegaron
-- quedan en app_notifications (con type PROGRAMADA); lo único que se les cae
-- es la columna envio_id.
--
-- ORDEN PARA DESHACER DE VERDAD
--   1 · Correr este archivo.
--   2 · (Opcional) volver a desplegar send-push sin el modo lote. No hace
--       falta: sin programadas nadie le pide un lote.
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · El cron del reloj ───────────────────────────────────────────────────
SELECT cron.unschedule('notif-programadas')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notif-programadas');


-- ── 2 · El trigger de push, como antes ──────────────────────────────────────
DROP TRIGGER IF EXISTS trg_app_notifications_push ON public.app_notifications;
CREATE TRIGGER trg_app_notifications_push
    AFTER INSERT ON public.app_notifications
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL)
    EXECUTE FUNCTION public.app_notifications_push();


-- ── 3 · notif_alertas_admin, como antes ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notif_alertas_admin()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_personas integer;
BEGIN
    IF auth.uid() IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    SELECT count(DISTINCT p.user_id) INTO v_personas
      FROM public.push_suscripciones p
      JOIN public.users u ON u.id = p.user_id
     WHERE u.is_active IS NOT FALSE;

    RETURN jsonb_build_object(
        'ok', true,
        'personas_con_push', v_personas,
        'alertas', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', a.id,
                'clave', a.clave,
                'tipo', a.tipo,
                'nombre', a.nombre,
                'descripcion_evento', a.descripcion_evento,
                'destinatario_texto', a.destinatario_texto,
                'variables', COALESCE(a.variables, '{}'),
                'titulo_plantilla', a.titulo_plantilla,
                'mensaje_plantilla', a.mensaje_plantilla,
                'url_plantilla', a.url_plantilla,
                'type_legacy', a.type_legacy,
                'activa', a.activa,
                'no_molestar', a.no_molestar,
                'no_molestar_desde', a.no_molestar_desde,
                'no_molestar_hasta', a.no_molestar_hasta,
                'max_por_dia', a.max_por_dia,
                'siempre_activa', a.siempre_activa,
                'desde', a.desde,
                'hasta', a.hasta,
                'cada_n_dias', a.cada_n_dias,
                'horas', a.horas,
                'audiencia_todos', a.audiencia_todos,
                'audiencia_roles', a.audiencia_roles,
                'audiencia_usuarios', a.audiencia_usuarios,
                'updated_at', a.updated_at,
                'enviados_7d', COALESCE((
                    SELECT count(*) FROM public.notif_push_log l
                     WHERE l.alerta_clave = a.clave
                       AND l.resultado = 'enviado'
                       AND l.enviado_at > now() - interval '7 days'), 0),
                'personas_con_push', v_personas
            ) ORDER BY a.tipo, a.nombre)
            FROM public.notif_alertas a
        ), '[]'::jsonb));
END;
$function$;

REVOKE ALL ON FUNCTION public.notif_alertas_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_alertas_admin() TO authenticated;


-- ── 4 · Las funciones nuevas ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.notif_programadas_tick(timestamptz);
DROP FUNCTION IF EXISTS public.notif_programada_emitir(uuid);
DROP FUNCTION IF EXISTS public.notif_lote_encolar(uuid);
DROP FUNCTION IF EXISTS public.notif_lote_tomar(uuid, integer);
DROP FUNCTION IF EXISTS public.notif_lote_hechos(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.notif_guardar_programada(uuid, text, text, text, text, boolean, date, date, integer, time[], boolean, text[], uuid[], boolean, time, time, integer, boolean);
DROP FUNCTION IF EXISTS public.notif_cambiar_estado(uuid, boolean);
DROP FUNCTION IF EXISTS public.notif_eliminar_programada(uuid);
DROP FUNCTION IF EXISTS public.notif_estimar_audiencia(boolean, text[], uuid[]);
DROP FUNCTION IF EXISTS public.notif_roles_disponibles();
DROP FUNCTION IF EXISTS public.notif_proximo_envio(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.notif_programada_sale_el(date, date, date, boolean, integer);
DROP FUNCTION IF EXISTS public.notif_alcance_programada(integer, time[], boolean, date, date);
DROP FUNCTION IF EXISTS public.notif_audiencia(boolean, text[], uuid[]);
DROP FUNCTION IF EXISTS public.notif_roles_validos();
DROP FUNCTION IF EXISTS public.notif_tope_por_emision();


-- ── 5 · Las tablas del reloj y del lote ─────────────────────────────────────
DROP TABLE IF EXISTS public.notif_lote_cola;
DROP TABLE IF EXISTS public.notif_lotes;
DROP TABLE IF EXISTS public.notif_programadas_hechas;


-- ── 6 · Las programadas, el CHECK, audit_logs y las columnas ────────────────
DELETE FROM public.notif_alertas WHERE tipo = 'programada';
ALTER TABLE public.notif_alertas DROP CONSTRAINT IF EXISTS notif_alertas_programada_ok;
DROP FUNCTION IF EXISTS public.notif_horas_ok(time[]);
DROP TRIGGER IF EXISTS audit_notif_alertas_changes ON public.notif_alertas;

ALTER TABLE public.notif_alertas
    DROP COLUMN IF EXISTS eliminada_at,
    DROP COLUMN IF EXISTS eliminada_por,
    DROP COLUMN IF EXISTS reloj_desde;

DROP INDEX IF EXISTS public.app_notifications_envio_idx;
ALTER TABLE public.app_notifications DROP COLUMN IF EXISTS envio_id;

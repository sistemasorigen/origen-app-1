-- ════════════════════════════════════════════════════════════════════════════
-- Avisos seguros · se cierra la creación libre de app_notifications
-- 2026-10-28 · ✅ APLICADO el 2026-10-28 (PROBAR_ 11/11 en el ensayo y después de aplicar)
--
-- EL PROBLEMA
--   La policy "Authenticated users can insert notifications" era
--   WITH CHECK (true): cualquiera con sesión podía crear un aviso con
--   cualquier texto para cualquier otra persona. Desde las notificaciones
--   push (sql/push_notificaciones.sql) eso llega a la pantalla bloqueada del
--   teléfono de esa persona.
--
-- LO QUE CAMBIA
--   1 · Columna creado_por: quién creó el aviso desde la app (para el tope).
--   2 · crear_aviso(): la ÚNICA forma de crear un aviso desde el frontend.
--       Valida sesión, tipo, textos, ruta y —sobre todo— que quien avisa
--       tenga una relación real con quien recibe (ver las reglas abajo).
--   3 · Se borra la policy de INSERT abierta y se le saca el permiso de
--       INSERT a anon y authenticated. Los triggers y funciones que ya
--       insertaban (Agenda, reportes, solicitudes de datos, pedidos, push de
--       prueba, recordatorio de asistencia) son SECURITY DEFINER de postgres,
--       el dueño de la tabla, así que siguen andando (probado en PROBAR_).
--   4 · UPDATE: sólo is_read e is_pinned, y sólo de lo propio.
--
-- LAS REGLAS, sacadas del inventario del frontend (sección 12 / reporte):
--   · ATTENDANCE                         → sólo a uno mismo.
--   · REGISTRATION                       → quien tiene una inscripción en un
--                                          grupo, al anfitrión o co-anfitrión.
--   · REGISTRATION_APPROVED / _REJECTED  → anfitrión o co-anfitrión del grupo
--                                          (o un gestor de grupos), a quien
--                                          está inscripto o figura de pareja.
--   · GROUP_APPROVED / GROUP_REJECTED    → un gestor de grupos, al anfitrión
--                                          o co-anfitrión de un grupo.
--   Gestor de grupos = SUPER_ADMIN, ADMIN_GROUPS, ENCARGADO_GRUPOS o PASTOR:
--   los mismos roles que ya aprueban inscripciones
--   (manage_group_registration_v3) y grupos (groups_update_admin).
--
-- Pruebas: sql/PROBAR_avisos_seguros.sql · Deshacer: sql/ROLLBACK_avisos_seguros.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ── 1 · Quién lo creó ───────────────────────────────────────────────────────
ALTER TABLE public.app_notifications
    ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS app_notifications_creado_por_idx
    ON public.app_notifications (creado_por, created_at)
    WHERE creado_por IS NOT NULL;

COMMENT ON COLUMN public.app_notifications.creado_por IS
    'Quién creó el aviso con crear_aviso(). NULL si lo creó la base (triggers, funciones).';


-- ── 2 · crear_aviso ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.crear_aviso(
    p_destinatario uuid,
    p_tipo         text,
    p_titulo       text,
    p_mensaje      text,
    p_url          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid     uuid := auth.uid();
    v_titulo  text := btrim(COALESCE(p_titulo, ''));
    v_mensaje text := btrim(COALESCE(p_mensaje, ''));
    v_url     text := NULLIF(btrim(COALESCE(p_url, '')), '');
    v_gestor  boolean;
    v_ok      boolean := false;
    n integer;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;

    -- Los tipos que crea el frontend, y ninguno más. Los demás (Agenda,
    -- reportes, PUSH_PRUEBA…) los crea sólo la base.
    IF p_tipo IS NULL OR p_tipo NOT IN (
        'ATTENDANCE', 'REGISTRATION', 'REGISTRATION_APPROVED', 'REGISTRATION_REJECTED',
        'GROUP_APPROVED', 'GROUP_REJECTED'
    ) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tipo_invalido');
    END IF;

    IF v_titulo = '' OR v_mensaje = '' OR length(v_titulo) > 120 OR length(v_mensaje) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido');
    END IF;

    -- Una ruta interna de la app: "/algo", sin dominio, sin "//", sin
    -- espacios ni caracteres de control.
    IF v_url IS NOT NULL AND (
           left(v_url, 1) <> '/'
        OR left(v_url, 2) = '//'
        OR v_url ~* 'https?:'
        OR v_url ~ '[[:space:][:cntrl:]\\]'
        OR length(v_url) > 300
    ) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'url_invalida');
    END IF;

    v_gestor := public.tiene_rol(ARRAY['SUPER_ADMIN', 'ADMIN_GROUPS', 'ENCARGADO_GRUPOS', 'PASTOR']);

    -- La relación entre quien avisa y quien recibe. Un destinatario que no
    -- existe cae acá también: la respuesta es la misma, "sin_permiso", así no
    -- se puede usar para averiguar si alguien tiene cuenta.
    IF p_tipo = 'ATTENDANCE' THEN
        v_ok := p_destinatario = v_uid;

    ELSIF p_tipo = 'REGISTRATION' THEN
        v_ok := EXISTS (
            SELECT 1
              FROM public.group_registrations r
              JOIN public.groups g ON g.id = r.group_id
             WHERE (r.user_id = v_uid OR r.partner_user_id = v_uid)
               AND p_destinatario IN (g.host_id, g.co_host_id)
        );

    ELSIF p_tipo IN ('REGISTRATION_APPROVED', 'REGISTRATION_REJECTED') THEN
        v_ok := EXISTS (
            SELECT 1
              FROM public.group_registrations r
              JOIN public.groups g ON g.id = r.group_id
             WHERE p_destinatario IN (r.user_id, r.partner_user_id)
               AND (v_gestor OR v_uid IN (g.host_id, g.co_host_id))
        );

    ELSIF p_tipo IN ('GROUP_APPROVED', 'GROUP_REJECTED') THEN
        v_ok := v_gestor AND EXISTS (
            SELECT 1 FROM public.groups g WHERE p_destinatario IN (g.host_id, g.co_host_id)
        );
    END IF;

    IF NOT COALESCE(v_ok, false) OR NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_destinatario) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    -- Tope: 60 por hora por quien avisa (SUPER_ADMIN sin tope). Alcanza de
    -- sobra para el uso normal y frena a quien quiera llenarle el teléfono
    -- de avisos a alguien.
    IF NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        SELECT count(*) INTO n FROM public.app_notifications
         WHERE creado_por = v_uid AND created_at > now() - interval '1 hour';
        IF n >= 60 THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'limite');
        END IF;
    END IF;

    INSERT INTO public.app_notifications (user_id, title, message, type, action_url, creado_por)
    VALUES (p_destinatario, v_titulo, v_mensaje, p_tipo, v_url, v_uid);

    RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.crear_aviso(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_aviso(uuid, text, text, text, text) TO authenticated;

COMMENT ON FUNCTION public.crear_aviso(uuid, text, text, text, text) IS
    'La única forma de crear un aviso desde la app: valida tipo, textos, ruta, la relación entre quien avisa y quien recibe, y un tope de 60 por hora.';


-- ── 3 · Se cierra el INSERT directo ─────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.app_notifications;
REVOKE INSERT ON public.app_notifications FROM anon, authenticated;


-- ── 4 · UPDATE: sólo leído y fijado, sólo lo propio ─────────────────────────
-- La policy ya pedía user_id = auth.uid() para elegir la fila; con el
-- WITH CHECK explícito, la fila tampoco puede pasar a ser de otro. Y por
-- columnas, lo único que se puede cambiar es lo que cambia la app.
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.app_notifications;
CREATE POLICY "Users can update their own notifications" ON public.app_notifications
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

REVOKE UPDATE ON public.app_notifications FROM anon, authenticated;
GRANT UPDATE (is_read, is_pinned) ON public.app_notifications TO authenticated;

-- anon no tiene ninguna policy (no ve ni toca nada), pero tampoco le quedan
-- permisos de escritura por si algún día alguien agrega una.
REVOKE DELETE, TRUNCATE ON public.app_notifications FROM anon;
REVOKE TRUNCATE ON public.app_notifications FROM authenticated;


-- ── 5 · Limpieza pedida: los 3 avisos del GCX de prueba (20 y 21 de octubre) ─
-- Por id, y sólo si siguen siendo los mismos (fecha y "PRUEBA" en el texto).
DELETE FROM public.app_notifications
 WHERE id IN ('422cfdea-9154-48b1-a3c3-c1e4ad6af689',
              'b9b62e75-34ac-4a5c-97fc-33a9f61f89db',
              '52ddcfeb-65cb-41f5-9743-74fb1fbb9eda')
   AND created_at >= '2026-10-20' AND created_at < '2026-10-22'
   AND (title ILIKE '%PRUEBA%' OR message ILIKE '%PRUEBA%');

-- ════════════════════════════════════════════════════════════════════════════
-- GESTIÓN DE NOTIFICACIONES · "Enviarme una prueba" con el texto del editor
-- 2026-10-29 · prompt 3 de 4 (la pantalla de Sistemas)
-- ✅ APLICADO el 2026-10-29 (20:00 UTC). PROBAR_ 18/18 contra producción.
--
-- POR QUÉ HACE FALTA
--   notif_enviar_prueba(p_id, p_vars) (sql/notif_catalogo.sql) manda el texto
--   GUARDADO de una alerta que ya existe. En el editor hace falta probar lo que
--   se está escribiendo, antes de guardar, y también una programada que todavía
--   no tiene id.
--
-- LO QUE HACE notif_probar_texto(titulo, mensaje, url, alerta_id)
--   · Sólo SUPER_ADMIN (es la pantalla de Sistemas).
--   · Emite SOLAMENTE a auth.uid(): no recibe destinatario, así que no hay forma
--     de apuntarla a otra persona, ni tocando el front.
--   · Reemplaza las {variables} con los mismos ejemplos de notif_enviar_prueba
--     (notif_ejemplos(), que la pantalla copia para la vista previa).
--   · Máximo 10 por día y por persona, contando todas las pruebas del día
--     (notif_push_log, resultado 'prueba', hora argentina).
--   · El aviso va SIN alerta_clave: no lo frena el no molestar ni el tope de la
--     alerta que se está probando. El type es el de la alerta (para que se vea
--     con su ícono) o PROGRAMADA si todavía no existe.
--   · Sin ningún dispositivo con push activado, no crea nada: devuelve
--     sin_dispositivos.
--
-- Pruebas: sql/PROBAR_notif_prueba.sql · Deshacer: sql/ROLLBACK_notif_prueba.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ── Los ejemplos de las variables ───────────────────────────────────────────
-- Los mismos que tiene notif_enviar_prueba adentro.
CREATE OR REPLACE FUNCTION public.notif_ejemplos()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
    SELECT jsonb_build_object(
        'nombre', 'Sofía Ejemplo',
        'pareja', 'Martín Ejemplo',
        'grupo', 'GCX Palermo Martes',
        'fecha', '28/10',
        'horario', '20:00 – 21:30',
        'presentes', '7',
        'dia', 'Martes',
        'motivo', ' Motivo: faltan el día y el horario.',
        'tarea', 'Armar la mesa de bienvenida',
        'departamento', 'Bienvenida',
        'subdepartamento', 'Recepción',
        'detalle', 'Necesitamos un flyer para el anuncio del domingo',
        'codigo', 'REP-0001',
        'numero', '0001',
        'tipo', 'Acceso a mis datos',
        'pantalla', 'Eventos',
        'resultado', 'aprobado',
        'pedido', 'la baja');
$fn$;


CREATE OR REPLACE FUNCTION public.notif_probar_texto(
    p_titulo    text,
    p_mensaje   text,
    p_url       text DEFAULT NULL,
    p_alerta_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    TOPE constant integer := 10;
    v_uid uuid := auth.uid();
    v_hoy timestamptz := date_trunc('day', now() AT TIME ZONE ZONA) AT TIME ZONE ZONA;
    v_titulo text := btrim(COALESCE(p_titulo, ''));
    v_mensaje text := btrim(COALESCE(p_mensaje, ''));
    v_url text := NULLIF(btrim(COALESCE(p_url, '')), '');
    v_tipo text;
    v_clave text;
    v_id uuid;
    n integer;
BEGIN
    IF v_uid IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    IF v_titulo = '' OR length(v_titulo) > 120 OR v_mensaje = '' OR length(v_mensaje) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido');
    END IF;
    IF v_url IS NOT NULL AND NOT public.notif_url_interna(v_url) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'url_invalida');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.push_suscripciones WHERE user_id = v_uid) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_dispositivos');
    END IF;

    SELECT count(*) INTO n FROM public.notif_push_log
     WHERE user_id = v_uid AND resultado = 'prueba' AND enviado_at >= v_hoy;
    IF n >= TOPE THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope', 'quedan', 0);
    END IF;

    SELECT type_legacy, clave INTO v_tipo, v_clave
      FROM public.notif_alertas WHERE id = p_alerta_id AND eliminada_at IS NULL;

    v_titulo  := public.notif_render(v_titulo,  public.notif_ejemplos(), 120);
    v_mensaje := public.notif_render(v_mensaje, public.notif_ejemplos(), 500);
    IF v_titulo = '' OR v_mensaje = '' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido');
    END IF;

    -- A quien la pide y a nadie más. Sin alerta_clave ni envio_id: el trigger
    -- de push la manda como un aviso suelto.
    INSERT INTO public.app_notifications (user_id, title, message, type, action_url, creado_por)
    VALUES (v_uid, v_titulo, v_mensaje, COALESCE(v_tipo, 'PROGRAMADA'), v_url, v_uid)
    RETURNING id INTO v_id;

    INSERT INTO public.notif_push_log (notificacion_id, alerta_clave, user_id, resultado)
    VALUES (v_id, v_clave, v_uid, 'prueba');

    RETURN jsonb_build_object('ok', true, 'quedan', TOPE - 1 - n, 'titulo', v_titulo, 'mensaje', v_mensaje);
END;
$fn$;


-- ── Permisos ────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.notif_ejemplos() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_probar_texto(text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_probar_texto(text, text, text, uuid) TO authenticated;

COMMENT ON FUNCTION public.notif_probar_texto(text, text, text, uuid) IS
    'Manda el texto que está en el editor (con las variables de ejemplo) SÓLO a quien la pide: no recibe destinatario. Máx. 10 pruebas por día. Sólo SUPER_ADMIN.';

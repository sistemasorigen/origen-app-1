-- ════════════════════════════════════════════════════════════════════════════
-- GESTIÓN DE NOTIFICACIONES · catálogo de alertas y emisor central
-- 2026-10-29 · prompt 1 de 4 (diseño: design-claude/Sistemas - Gestion de notificaciones.dc.html)
--
-- EL PROBLEMA
--   Hoy cada aviso lo arma su productor a su manera: 7 funciones de la base,
--   8 llamados del frontend por crear_aviso() y la Edge Function notify-host.
--   El texto está escrito en cada uno. No hay forma de pausar una alerta, de
--   ponerle un tope, ni de saber cuáles existen.
--
-- LO QUE AGREGA
--   1 · notif_alertas: el catálogo. Una fila por alerta, con su plantilla,
--       sus variables, su horario de no molestar y su tope por día.
--   2 · app_notifications.alerta_clave: de qué alerta salió cada aviso.
--   3 · notif_emitir(): el emisor central. TODOS los avisos pasan por acá.
--       Renderiza la plantilla con las variables y crea la fila.
--   4 · Las reglas de envío (notif_puede_enviar, notif_push_log,
--       notif_push_diferidos) + el cron que manda los diferidos.
--   5 · Las RPC que van a usar las pantallas de los prompts 3 y 4.
--   6 · Migra los 17 productores al emisor, SIN cambiar una coma de lo que
--       ve la gente.
--
-- LAS REGLAS DE PRODUCTO (decididas por Ignacio)
--   · Pausar una alerta = NO sale push. El aviso SIGUE creándose en la app
--     (la campanita), para que nadie pierda algo que tiene que hacer.
--   · No molestar: el push que cae en ese horario no se pierde, se manda
--     apenas termina el horario (hora argentina).
--   · Máximo por día: por persona y por alerta. Pasado el tope no sale push;
--     el aviso en la app sí.
--
-- LA SEMILLA NO CAMBIA NADA. Las 20 alertas quedan activas, sin horario de no
-- molestar y sin tope, con el texto EXACTO de hoy. Nadie nota nada hasta que
-- Ignacio toque algo desde la pantalla.
--
-- ORDEN DE APLICACIÓN (ninguna ventana pierde avisos)
--   1 · Este archivo. notify-host viejo sigue insertando directo (anda igual,
--       sin clave) y send-push viejo manda todo (como hoy).
--   2 · Desplegar send-push (empieza a aplicar las reglas; con la semilla de
--       arriba el resultado es idéntico a hoy).
--   3 · Desplegar notify-host (sus dos avisos pasan a tener clave).
--   El frontend nuevo (la firma nueva de crear_aviso) necesita que esto esté
--   aplicado ANTES del próximo `npm run deploy`. Igual no rompe: el bundle
--   nuevo reintenta con la firma vieja si la nueva no existe.
--
-- Pruebas: sql/PROBAR_notif_catalogo.sql · Deshacer: sql/ROLLBACK_notif_catalogo.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1 · EL CATÁLOGO                                                          ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS public.notif_alertas (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- La clave con la que la nombra el código ('gcx_solicitud_ingreso').
    clave       text NOT NULL UNIQUE CHECK (clave ~ '^[a-z][a-z0-9_]{2,63}$'),
    tipo        text NOT NULL CHECK (tipo IN ('automatica', 'programada')),

    -- Lo que muestra la tabla de la pantalla.
    nombre              text NOT NULL CHECK (length(btrim(nombre)) BETWEEN 1 AND 120),
    -- Automáticas: cuándo sale ("alguien se anota a un grupo"). Se lee
    -- después de "Sale cuando…", así que va en minúscula y sin punto.
    descripcion_evento  text,
    -- Automáticas: a quién le llega ("El anfitrión y el co-anfitrión").
    destinatario_texto  text,

    -- Las variables que la plantilla puede usar, sin las llaves.
    variables   text[] NOT NULL DEFAULT '{}',
    titulo_plantilla  text NOT NULL CHECK (length(btrim(titulo_plantilla)) BETWEEN 1 AND 120),
    mensaje_plantilla text NOT NULL CHECK (length(btrim(mensaje_plantilla)) BETWEEN 1 AND 500),
    -- Ruta interna de la app. Si el productor pasa una ruta con un id
    -- adentro, la suya gana; ésta es la que muestra la pantalla.
    url_plantilla     text,

    -- El `type` con el que se sigue escribiendo en app_notifications: los
    -- íconos de pages/user/Notificaciones.tsx y los filtros lo miran.
    type_legacy text NOT NULL,

    activa      boolean NOT NULL DEFAULT true,
    no_molestar boolean NOT NULL DEFAULT false,
    no_molestar_desde time,
    no_molestar_hasta time,
    -- NULL = sin tope. Por persona y por día (hora argentina).
    max_por_dia integer CHECK (max_por_dia IS NULL OR max_por_dia BETWEEN 1 AND 20),

    -- ── Columnas de las programadas (prompt 2). NULL en las automáticas ────
    siempre_activa    boolean,
    desde             date,
    hasta             date,
    cada_n_dias       integer CHECK (cada_n_dias IS NULL OR cada_n_dias BETWEEN 1 AND 365),
    horas             time[],
    audiencia_todos   boolean,
    audiencia_roles   text[],
    audiencia_usuarios uuid[],

    created_at  timestamptz NOT NULL DEFAULT now(),
    created_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
    updated_at  timestamptz,
    updated_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,

    -- Con no molestar prendido hacen falta las dos horas, y distintas: un
    -- horario de 0 minutos no frena nada y uno de 24 h frenaría para siempre.
    CONSTRAINT notif_alertas_no_molestar_ok CHECK (
        NOT no_molestar
        OR (no_molestar_desde IS NOT NULL AND no_molestar_hasta IS NOT NULL
            AND no_molestar_desde <> no_molestar_hasta)
    )
);

CREATE INDEX IF NOT EXISTS notif_alertas_tipo_idx ON public.notif_alertas (tipo, nombre);

ALTER TABLE public.notif_alertas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notif_alertas FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.notif_alertas IS
    'El catálogo de alertas push: automáticas (las que ya existen) y programadas. Sin policies: todo pasa por las RPC notif_*.';


-- ── De qué alerta salió cada aviso ──────────────────────────────────────────
-- Los avisos viejos quedan en NULL y se mandan siempre (ver notif_puede_enviar).
ALTER TABLE public.app_notifications
    ADD COLUMN IF NOT EXISTS alerta_clave text;

CREATE INDEX IF NOT EXISTS app_notifications_alerta_idx
    ON public.app_notifications (alerta_clave, user_id, created_at DESC)
    WHERE alerta_clave IS NOT NULL;

COMMENT ON COLUMN public.app_notifications.alerta_clave IS
    'notif_alertas.clave de la alerta que lo generó. NULL en los avisos de antes del 2026-10-29 y en las pruebas.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2 · EL EMISOR CENTRAL                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Recortar, igual que lo hace el frontend ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.notif_recortar(p_texto text, p_largo integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
    SELECT CASE
        WHEN p_texto IS NULL THEN NULL
        WHEN length(p_texto) <= p_largo THEN p_texto
        ELSE rtrim(left(p_texto, p_largo - 1)) || '…'
    END;
$fn$;


-- ── ¿Es una ruta interna de la app? ─────────────────────────────────────────
-- La misma validación que crear_aviso usaba escrita a mano: "/algo", sin
-- dominio, sin "//", sin espacios ni caracteres de control.
CREATE OR REPLACE FUNCTION public.notif_url_interna(p_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
    SELECT p_url IS NOT NULL
       AND left(p_url, 1) = '/'
       AND left(p_url, 2) <> '//'
       AND p_url !~* 'https?:'
       AND p_url !~ '[[:space:][:cntrl:]\\]'
       AND length(p_url) <= 300;
$fn$;


-- ── Renderizar una plantilla ────────────────────────────────────────────────
-- Reemplaza {variable} por su valor, como texto plano: nada de HTML, ni
-- llaves adentro de los valores (si no, un nombre con "{grupo}" se
-- reemplazaría en la pasada siguiente). Una variable sin valor queda vacía.
CREATE OR REPLACE FUNCTION public.notif_render(p_plantilla text, p_vars jsonb, p_largo integer)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
    v_out text := COALESCE(p_plantilla, '');
    v_k   text;
    v_v   text;
BEGIN
    IF p_vars IS NOT NULL AND jsonb_typeof(p_vars) = 'object' THEN
        FOR v_k IN SELECT k FROM jsonb_object_keys(p_vars) k LOOP
            CONTINUE WHEN v_k !~ '^[a-z][a-z0-9_]{0,29}$';
            v_v := COALESCE(p_vars->>v_k, '');
            -- Saltos de línea, tabs y llaves afuera; los espacios de más se
            -- juntan en uno (sin recortar los de las puntas: alguna
            -- plantilla termina en una variable que trae su propio espacio).
            v_v := regexp_replace(translate(v_v, E'{}\n\r\t', '   '), '\s+', ' ', 'g');
            v_out := replace(v_out, '{' || v_k || '}', v_v);
        END LOOP;
    END IF;

    -- Lo que quedó sin valor: se va, no se muestra "{nombre}".
    v_out := regexp_replace(v_out, '\{[a-z][a-z0-9_]{0,29}\}', '', 'g');
    RETURN public.notif_recortar(btrim(regexp_replace(v_out, '\s+', ' ', 'g')), p_largo);
END;
$fn$;


-- ── El emisor, con el texto ya armado ───────────────────────────────────────
-- Lo usa la firma VIEJA de crear_aviso, que recibe el texto hecho del bundle
-- del frontend: así un teléfono con la app vieja abierta sigue mandando
-- exactamente lo que mandaba, y el aviso igual queda con su clave.
CREATE OR REPLACE FUNCTION public.notif_emitir_texto(
    p_clave        text,
    p_destinatario uuid,
    p_titulo       text,
    p_mensaje      text,
    p_url          text DEFAULT NULL,
    p_creado_por   uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_tipo   text;
    v_titulo text := public.notif_recortar(btrim(COALESCE(p_titulo, '')), 120);
    v_msg    text := public.notif_recortar(btrim(COALESCE(p_mensaje, '')), 500);
    v_url    text := NULLIF(btrim(COALESCE(p_url, '')), '');
    v_id     uuid;
BEGIN
    IF p_destinatario IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT type_legacy INTO v_tipo FROM public.notif_alertas WHERE clave = p_clave;
    IF v_tipo IS NULL THEN
        -- Una clave que no está en el catálogo es un error de programación,
        -- no algo que tenga que romperle la pantalla a nadie.
        RAISE WARNING '[notif] no existe la alerta %: no se creó el aviso', p_clave;
        RETURN NULL;
    END IF;

    IF v_titulo = '' OR v_msg = '' THEN
        RAISE WARNING '[notif] % quedó sin título o sin mensaje: no se creó el aviso', p_clave;
        RETURN NULL;
    END IF;

    IF v_url IS NOT NULL AND NOT public.notif_url_interna(v_url) THEN
        RAISE WARNING '[notif] % traía una ruta que no es interna: el aviso va sin link', p_clave;
        v_url := NULL;
    END IF;

    INSERT INTO public.app_notifications (user_id, title, message, type, action_url, creado_por, alerta_clave)
    VALUES (p_destinatario, v_titulo, v_msg, v_tipo, v_url, p_creado_por, p_clave)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$fn$;


-- ── El emisor central ───────────────────────────────────────────────────────
-- Por acá pasan TODOS los avisos. Crea la fila aunque la alerta esté pausada:
-- la pausa la resuelve el push (notif_puede_enviar), no la campanita.
CREATE OR REPLACE FUNCTION public.notif_emitir(
    p_clave        text,
    p_destinatario uuid,
    p_vars         jsonb,
    p_url          text DEFAULT NULL,
    p_creado_por   uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_a record;
BEGIN
    IF p_destinatario IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT titulo_plantilla, mensaje_plantilla, url_plantilla
      INTO v_a
      FROM public.notif_alertas WHERE clave = p_clave;

    IF NOT FOUND THEN
        RAISE WARNING '[notif] no existe la alerta %: no se creó el aviso', p_clave;
        RETURN NULL;
    END IF;

    RETURN public.notif_emitir_texto(
        p_clave,
        p_destinatario,
        public.notif_render(v_a.titulo_plantilla,  p_vars, 120),
        public.notif_render(v_a.mensaje_plantilla, p_vars, 500),
        COALESCE(NULLIF(btrim(COALESCE(p_url, '')), ''),
                 NULLIF(public.notif_render(v_a.url_plantilla, p_vars, 300), '')),
        p_creado_por
    );
END;
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3 · LA SEMILLA · una fila por evento del inventario                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Las plantillas son el texto EXACTO de hoy, con las variables en llaves.
-- Donde dos productores mandan lo mismo, cada uno tiene su clave: así se
-- puede pausar el repetido sin tocar el bueno.
INSERT INTO public.notif_alertas
    (clave, tipo, nombre, descripcion_evento, destinatario_texto, variables,
     titulo_plantilla, mensaje_plantilla, url_plantilla, type_legacy)
VALUES
-- ── Grupos de Conexión ──────────────────────────────────────────────────────
('gcx_solicitud_ingreso', 'automatica',
 'Nueva solicitud de ingreso a un GCX',
 'alguien se anota a un grupo',
 'El anfitrión y el co-anfitrión',
 ARRAY['nombre', 'grupo'],
 'Nueva solicitud de ingreso 👤',
 '{nombre} quiere unirse a "{grupo}". Revisá las solicitudes pendientes.',
 '/', 'info'),

('gcx_solicitud_ingreso_app', 'automatica',
 'Nueva solicitud de ingreso (aviso repetido)',
 'alguien se anota a un grupo desde el catálogo. Es el mismo hecho que la alerta de arriba: hoy el anfitrión recibe los dos avisos',
 'El anfitrión y el co-anfitrión',
 ARRAY['nombre', 'grupo'],
 'Nueva solicitud de miembro',
 '{nombre} se unió a {grupo}.',
 '/panel-admin/groups', 'REGISTRATION'),

('gcx_solicitud_pareja_app', 'automatica',
 'Nueva solicitud de pareja (aviso repetido)',
 'una pareja se anota a un grupo desde el catálogo. El anfitrión recibe también el aviso de "Nueva solicitud de ingreso a un GCX"',
 'El anfitrión y el co-anfitrión',
 ARRAY['nombre', 'pareja', 'grupo'],
 'Nueva solicitud de pareja',
 '{nombre} y {pareja} se inscribieron como pareja en {grupo}.',
 '/panel-admin/groups', 'REGISTRATION'),

('gcx_inscripcion_aprobada', 'automatica',
 'Inscripción aprobada',
 'el anfitrión aprueba una inscripción',
 'La persona inscripta (y su pareja)',
 ARRAY['grupo'],
 'Solicitud Aprobada',
 'Tu solicitud para unirte a {grupo} ha sido aprobada.',
 '/', 'REGISTRATION_APPROVED'),

('gcx_inscripcion_rechazada', 'automatica',
 'Inscripción rechazada',
 'el anfitrión rechaza una inscripción',
 'La persona inscripta (y su pareja)',
 ARRAY['grupo'],
 'Solicitud Rechazada',
 'Tu solicitud para unirte a {grupo} no ha podido ser aceptada en este momento.',
 '/', 'REGISTRATION_REJECTED'),

('gcx_asistencia_guardada', 'automatica',
 'Asistencia guardada',
 'el anfitrión toma la asistencia de una reunión por primera vez',
 'El mismo anfitrión',
 ARRAY['presentes', 'grupo', 'fecha'],
 '✅ Asistencia registrada',
 'Registraste {presentes} presente(s) en {grupo} el {fecha}. ¡Seguí así!',
 '/mis-grupos', 'ATTENDANCE'),

('gcx_recordatorio_asistencia', 'automatica',
 'Recordatorio de asistencia',
 'pasaron más de 3 horas de la reunión y el grupo todavía no cargó la asistencia',
 'El anfitrión, cuando abre la app',
 ARRAY['grupo'],
 'Recordatorio: Pasá asistencia 📋',
 'La reunión de "{grupo}" terminó hace más de 3 horas. Registrá la asistencia.',
 '/groups/host', 'attendance_reminder'),

('gcx_grupo_aprobado', 'automatica',
 'Tu grupo fue aprobado',
 'un grupo pasa a aprobado',
 'El anfitrión y el co-anfitrión',
 ARRAY['grupo'],
 '¡Tu grupo fue aprobado! 🎉',
 'El grupo "{grupo}" fue aprobado y ya está visible en la app.',
 '/', 'success'),

('gcx_grupo_aprobado_app', 'automatica',
 'Tu grupo fue aprobado (aviso repetido)',
 'se aprueba un grupo desde Gestión de grupos. Es el mismo hecho que la alerta de arriba: hoy el anfitrión recibe los dos avisos, con el mismo título',
 'El anfitrión y el co-anfitrión',
 ARRAY['grupo', 'dia'],
 '¡Tu grupo fue aprobado! 🎉',
 'Tu grupo "{grupo}" ha sido aprobado. Recuerda registrar asistencia cada {dia}.',
 '/mis-grupos', 'GROUP_APPROVED'),

('gcx_grupo_rechazado_app', 'automatica',
 'Tu grupo no fue aprobado',
 'se rechaza un grupo desde Gestión de grupos',
 'El anfitrión y el co-anfitrión',
 ARRAY['grupo', 'motivo'],
 'Actualización sobre tu grupo',
 'Tu grupo "{grupo}" no ha podido ser aprobado en este momento.{motivo}',
 '/mis-grupos', 'GROUP_REJECTED'),

-- ── Agenda Origen ───────────────────────────────────────────────────────────
('agenda_tarea_asignada', 'automatica',
 'Nueva tarea asignada (Agenda)',
 'se asigna una tarea a un sub-departamento',
 'Quien dirige el sub-departamento y sus miembros, sin los encargados del departamento',
 ARRAY['tarea', 'subdepartamento', 'fecha', 'horario'],
 'Nueva tarea: {tarea}',
 '{subdepartamento} · {fecha} · {horario}',
 '/agenda', 'AGENDA_TAREA_ASIGNADA'),

('agenda_tarea_completada', 'automatica',
 'Tarea completada (Agenda)',
 'una tarea pasa a completada',
 'Los encargados del departamento, menos quien la completó',
 ARRAY['tarea', 'subdepartamento', 'nombre'],
 'Tarea completada: {tarea}',
 '{subdepartamento} · por {nombre}',
 '/agenda', 'AGENDA_TAREA_COMPLETADA'),

('agenda_solicitud_nueva', 'automatica',
 'Nueva solicitud a tu departamento (Agenda)',
 'alguien le pide algo a un departamento',
 'Los encargados del departamento, menos quien la pidió',
 ARRAY['departamento', 'nombre', 'detalle'],
 'Solicitud nueva para {departamento}',
 '{nombre} · {detalle}',
 '/departamentos', 'AGENDA_SOLICITUD_NUEVA'),

('agenda_solicitud_aceptada', 'automatica',
 'Tu solicitud fue aceptada (Agenda)',
 'el departamento acepta una solicitud',
 'Quien la pidió',
 ARRAY['departamento'],
 'Tu solicitud a {departamento} fue aceptada',
 'El equipo ya la tiene en cuenta para organizarla. ¡Gracias por escribir!',
 '/perfil/solicitudes', 'AGENDA_SOLICITUD_REVISADA'),

('agenda_solicitud_rechazada', 'automatica',
 'Tu solicitud no fue aceptada (Agenda)',
 'el departamento rechaza una solicitud',
 'Quien la pidió',
 ARRAY['departamento'],
 'Tu solicitud a {departamento} no fue aceptada',
 'Esta vez no la pueden tomar. Gracias por escribirles.',
 '/perfil/solicitudes', 'AGENDA_SOLICITUD_REVISADA'),

-- ── Punto de Información ────────────────────────────────────────────────────
('punto_pedido_listo', 'automatica',
 'Tu pedido está listo (Voluntarios)',
 'en el Punto marcan una compra como lista',
 'Quien compró',
 ARRAY['codigo'],
 'Tu pedido {codigo} está listo',
 'Retiralo en el Punto de Información.',
 '/perfil/compras', 'PEDIDO_LISTO'),

-- ── Sistemas ────────────────────────────────────────────────────────────────
('sistemas_reporte_problema', 'automatica',
 'Nuevo reporte de problema',
 'alguien reporta un problema desde la app',
 'Sistemas (SUPER_ADMIN)',
 ARRAY['codigo', 'pantalla', 'detalle'],
 'Nuevo reporte {codigo}',
 '{pantalla} · {detalle}',
 '/panel-admin/reportes', 'REPORTE_PROBLEMA'),

('sistemas_solicitud_datos', 'automatica',
 'Pedido de datos personales',
 'alguien pide acceso, corrección o la baja de sus datos',
 'Sistemas (SUPER_ADMIN)',
 ARRAY['numero', 'tipo'],
 'Nueva solicitud de datos N.º {numero}',
 '{tipo}',
 '/panel-admin/solicitudes-datos', 'SOLICITUD_DATOS'),

-- ── La app ──────────────────────────────────────────────────────────────────
('app_version_nueva', 'automatica',
 'Hay una versión nueva de la app',
 'se publica una versión nueva (cada `npm run deploy`)',
 'Todos los que tienen la app instalada con notificaciones',
 '{}',
 'Hay una versión nueva',
 'Tocá acá y fijate si ya la tenés.',
 '/perfil/app', 'info'),

('push_prueba', 'automatica',
 'Notificación de prueba',
 'alguien toca "Enviar notificación de prueba" en Mi cuenta',
 'Quien la pide, en sus propios dispositivos',
 '{}',
 'Notificación de prueba',
 'Si ves esto, las notificaciones de Origen llegan a este dispositivo.',
 '/notificaciones', 'PUSH_PRUEBA')

ON CONFLICT (clave) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4 · LAS REGLAS DE ENVÍO                                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Qué se mandó y qué no ───────────────────────────────────────────────────
-- Cuenta el tope por día y deja las métricas de la pantalla. Lo escribe
-- send-push con la clave de servicio.
CREATE TABLE IF NOT EXISTS public.notif_push_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notificacion_id uuid,
    alerta_clave    text,
    user_id         uuid,
    enviado_at      timestamptz NOT NULL DEFAULT now(),
    -- enviado: salió al teléfono · pausada / tope / diferido: no salió ·
    -- fallo: el servicio de push lo rechazó · prueba: "Enviarme una prueba".
    resultado       text NOT NULL CHECK (resultado IN ('enviado', 'pausada', 'tope', 'diferido', 'fallo', 'prueba'))
);

CREATE INDEX IF NOT EXISTS notif_push_log_tope_idx
    ON public.notif_push_log (user_id, alerta_clave, enviado_at DESC)
    WHERE resultado IN ('enviado', 'prueba');
CREATE INDEX IF NOT EXISTS notif_push_log_metricas_idx
    ON public.notif_push_log (alerta_clave, enviado_at DESC);

ALTER TABLE public.notif_push_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notif_push_log FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.notif_push_log IS
    'Un renglón por push decidido: enviado, pausada, tope, diferido, fallo o prueba. Cuenta el tope diario y alimenta las métricas.';


-- ── Los que cayeron en "no molestar" ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notif_push_diferidos (
    notificacion_id uuid PRIMARY KEY,
    enviar_en       timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notif_push_diferidos_cuando_idx
    ON public.notif_push_diferidos (enviar_en);

ALTER TABLE public.notif_push_diferidos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notif_push_diferidos FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.notif_push_diferidos IS
    'Pushes que cayeron en el horario de no molestar. El cron notif-push-diferidos los manda cuando el horario termina.';


-- ── ¿Este momento cae en el horario de no molestar? ─────────────────────────
-- Devuelve CUÁNDO termina el horario (y entonces hay que diferir hasta ahí),
-- o NULL si no cae adentro. Toma el instante por parámetro a propósito: así
-- se puede probar a las 23:30 y a las 02:00 sin esperar a esa hora.
-- El horario puede cruzar la medianoche (23:00 → 08:00). Argentina no tiene
-- horario de verano, así que no hay días de 23 ni de 25 horas.
CREATE OR REPLACE FUNCTION public.notif_no_molestar_hasta(
    p_ahora timestamptz,
    p_desde time,
    p_hasta time
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $fn$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    v_local timestamp;
    v_hora  time;
    v_dentro boolean;
    v_dia date;
BEGIN
    -- Sin horario, o uno de duración cero: no frena nada.
    IF p_ahora IS NULL OR p_desde IS NULL OR p_hasta IS NULL OR p_desde = p_hasta THEN
        RETURN NULL;
    END IF;

    v_local := p_ahora AT TIME ZONE ZONA;
    v_hora  := v_local::time;

    v_dentro := CASE
        WHEN p_desde < p_hasta THEN v_hora >= p_desde AND v_hora < p_hasta
        ELSE v_hora >= p_desde OR v_hora < p_hasta
    END;

    IF NOT v_dentro THEN
        RETURN NULL;
    END IF;

    -- Termina hoy si el "hasta" todavía no pasó, mañana si ya pasó (el caso
    -- de las 23:30 con un horario de 23:00 a 08:00).
    v_dia := CASE WHEN v_hora < p_hasta THEN v_local::date ELSE v_local::date + 1 END;
    RETURN (v_dia::timestamp + p_hasta) AT TIME ZONE ZONA;
END;
$fn$;


-- ── ¿Se puede mandar este push? ─────────────────────────────────────────────
-- La llama send-push antes de mandar. Devuelve
--   { decision: 'enviar' | 'pausada' | 'tope' | 'diferir', enviar_en }
-- Un aviso sin alerta_clave (de antes del catálogo, o una prueba) se manda
-- siempre: ninguna regla puede hacer desaparecer un aviso que no sabemos de
-- dónde salió.
CREATE OR REPLACE FUNCTION public.notif_puede_enviar(p_notificacion_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    v_n record;
    v_a record;
    v_hoy timestamptz;
    v_hasta timestamptz;
    v_usados integer;
BEGIN
    SELECT user_id, alerta_clave INTO v_n
      FROM public.app_notifications WHERE id = p_notificacion_id;

    IF NOT FOUND OR v_n.alerta_clave IS NULL THEN
        RETURN jsonb_build_object('decision', 'enviar');
    END IF;

    SELECT activa, no_molestar, no_molestar_desde, no_molestar_hasta, max_por_dia
      INTO v_a
      FROM public.notif_alertas WHERE clave = v_n.alerta_clave;

    -- Una clave que ya no está en el catálogo tampoco frena nada.
    IF NOT FOUND THEN
        RETURN jsonb_build_object('decision', 'enviar');
    END IF;

    IF NOT v_a.activa THEN
        RETURN jsonb_build_object('decision', 'pausada');
    END IF;

    -- El tope, contado sobre lo que REALMENTE salió hoy (hora argentina).
    IF v_a.max_por_dia IS NOT NULL THEN
        v_hoy := (date_trunc('day', now() AT TIME ZONE ZONA)) AT TIME ZONE ZONA;
        SELECT count(*) INTO v_usados
          FROM public.notif_push_log
         WHERE user_id = v_n.user_id
           AND alerta_clave = v_n.alerta_clave
           AND resultado = 'enviado'
           AND enviado_at >= v_hoy;
        IF v_usados >= v_a.max_por_dia THEN
            RETURN jsonb_build_object('decision', 'tope');
        END IF;
    END IF;

    -- No molestar: el push no se pierde, se manda cuando el horario termina.
    IF v_a.no_molestar THEN
        v_hasta := public.notif_no_molestar_hasta(now(), v_a.no_molestar_desde, v_a.no_molestar_hasta);
        IF v_hasta IS NOT NULL THEN
            RETURN jsonb_build_object('decision', 'diferir', 'enviar_en', v_hasta);
        END IF;
    END IF;

    RETURN jsonb_build_object('decision', 'enviar');
END;
$fn$;


-- ── Los diferidos que ya vencieron ──────────────────────────────────────────
-- Los saca de la tabla y los devuelve en la misma operación: si el cron se
-- superpone con el anterior, nadie recibe el push dos veces.
CREATE OR REPLACE FUNCTION public.notif_diferidos_tomar(p_tope integer DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_ids jsonb;
BEGIN
    WITH elegidos AS (
        SELECT notificacion_id
          FROM public.notif_push_diferidos
         WHERE enviar_en <= now()
         ORDER BY enviar_en
         LIMIT GREATEST(COALESCE(p_tope, 100), 1)
         FOR UPDATE SKIP LOCKED
    ), sacados AS (
        DELETE FROM public.notif_push_diferidos d
         USING elegidos e
         WHERE d.notificacion_id = e.notificacion_id
        RETURNING d.notificacion_id
    )
    SELECT COALESCE(jsonb_agg(notificacion_id), '[]'::jsonb) INTO v_ids FROM sacados;

    RETURN jsonb_build_object('ok', true, 'ids', v_ids);
END;
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5 · MIGRACIÓN DE LOS PRODUCTORES                                         ║
-- ║   Mismo texto, mismos destinatarios, misma ruta. Lo único que cambia es  ║
-- ║   que el texto ahora sale del catálogo y el aviso queda con su clave.    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── 5.1 · Agenda: tareas ────────────────────────────────────────────────────
-- agenda_registrar_avisos cambia de firma: recibe la clave y las variables en
-- vez del texto armado. La llama sólo agenda_tareas_avisar.
DROP FUNCTION IF EXISTS public.agenda_registrar_avisos(uuid, text, uuid[], text, text, text);

CREATE OR REPLACE FUNCTION public.agenda_registrar_avisos(
    p_tarea uuid,
    p_tipo  text,
    p_users uuid[],
    p_clave text,
    p_vars  jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_uid uuid;
    v_id uuid;
    v_nuevas integer := 0;
BEGIN
    FOREACH v_uid IN ARRAY COALESCE(p_users, '{}'::uuid[]) LOOP
        CONTINUE WHEN v_uid IS NULL;

        -- El INSERT con ON CONFLICT es el que decide: si esta persona ya fue
        -- avisada de esto por esta tarea, no hay fila nueva y no hay
        -- notificación. Reasignar y volver, o reabrir y completar otra vez,
        -- no repite nada.
        v_id := NULL;
        INSERT INTO public.agenda_avisos (tarea_id, user_id, tipo, canal, estado, enviado_at)
        VALUES (p_tarea, v_uid, p_tipo, 'app', 'enviado', now())
        ON CONFLICT (tarea_id, user_id, tipo, canal) DO NOTHING
        RETURNING id INTO v_id;

        IF v_id IS NOT NULL THEN
            PERFORM public.notif_emitir(p_clave, v_uid, p_vars, '/agenda?tarea=' || p_tarea);
            v_nuevas := v_nuevas + 1;
        END IF;
    END LOOP;
    RETURN v_nuevas;
END;
$fn$;


CREATE OR REPLACE FUNCTION public.agenda_tareas_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_sub_nombre text;
    v_users uuid[];
    v_horario text;
    v_fecha text;
    v_quien text;
BEGIN
    SELECT nombre INTO v_sub_nombre FROM public.agenda_subdepartamentos WHERE id = NEW.subdepartamento_id;

    -- ASIGNADA: se crea con sub, o le cambia asignada_at (reasignar, editar
    -- el sub, asignar una que esperaba). También si cambia el sub: dentro de
    -- una misma transacción now() no avanza y asignada_at quedaría igual.
    IF NEW.subdepartamento_id IS NOT NULL
       AND (TG_OP = 'INSERT'
            OR NEW.asignada_at IS DISTINCT FROM OLD.asignada_at
            OR NEW.subdepartamento_id IS DISTINCT FROM OLD.subdepartamento_id) THEN

        SELECT array_agg(DISTINCT x.uid) INTO v_users
          FROM (SELECT s.lider_id AS uid FROM public.agenda_subdepartamentos s
                 WHERE s.id = NEW.subdepartamento_id AND s.lider_id IS NOT NULL
                UNION
                SELECT m.user_id FROM public.agenda_subdepartamento_miembros m
                 WHERE m.subdepartamento_id = NEW.subdepartamento_id) x
          JOIN public.users u ON u.id = x.uid AND u.is_active IS NOT FALSE
         WHERE NOT EXISTS (SELECT 1 FROM public.agenda_departamento_encargados e
                            WHERE e.departamento_id = NEW.departamento_id AND e.user_id = x.uid);

        v_fecha := (ARRAY['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'])[extract(dow FROM NEW.fecha)::int + 1]
                   || ' ' || to_char(NEW.fecha, 'DD/MM');
        v_horario := CASE WHEN NEW.todo_el_dia OR NEW.hora_desde IS NULL THEN 'Todo el día'
                          ELSE to_char(NEW.hora_desde, 'HH24:MI')
                               || COALESCE(' – ' || to_char(NEW.hora_hasta, 'HH24:MI'), '') END;

        PERFORM public.agenda_registrar_avisos(
            NEW.id, 'asignada', v_users, 'agenda_tarea_asignada',
            jsonb_build_object(
                'tarea', NEW.nombre,
                'subdepartamento', COALESCE(v_sub_nombre, 'Tu equipo'),
                'fecha', v_fecha,
                'horario', v_horario));
    END IF;

    -- COMPLETADA: pasa a 'completada' desde otro estado.
    IF TG_OP = 'UPDATE' AND NEW.estado = 'completada' AND OLD.estado IS DISTINCT FROM 'completada' THEN
        SELECT array_agg(e.user_id) INTO v_users
          FROM public.agenda_departamento_encargados e
          JOIN public.users u ON u.id = e.user_id AND u.is_active IS NOT FALSE
         WHERE e.departamento_id = NEW.departamento_id
           AND e.user_id IS DISTINCT FROM COALESCE(auth.uid(), NEW.completada_por);

        SELECT NULLIF(btrim(COALESCE(name, '')), '') INTO v_quien FROM public.users WHERE id = NEW.completada_por;

        PERFORM public.agenda_registrar_avisos(
            NEW.id, 'completada', v_users, 'agenda_tarea_completada',
            jsonb_build_object(
                'tarea', NEW.nombre,
                'subdepartamento', COALESCE(v_sub_nombre, 'Sin equipo'),
                'nombre', COALESCE(v_quien, 'alguien del equipo')));
    END IF;

    RETURN NULL;
END;
$fn$;


-- ── 5.2 · Agenda: solicitudes ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.agenda_solicitudes_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_dep text;
    v_quien text;
    v_enc record;
BEGIN
    SELECT nombre INTO v_dep FROM public.agenda_departamentos WHERE id = NEW.departamento_id;

    IF TG_OP = 'INSERT' THEN
        SELECT NULLIF(btrim(COALESCE(name, '')), '') INTO v_quien FROM public.users WHERE id = NEW.solicitante_id;
        -- A cada encargado. Si quien la pide es encargado de ese mismo
        -- departamento, a él no: ya sabe lo que pidió.
        FOR v_enc IN
            SELECT e.user_id
              FROM public.agenda_departamento_encargados e
             WHERE e.departamento_id = NEW.departamento_id
               AND e.user_id IS DISTINCT FROM NEW.solicitante_id
        LOOP
            PERFORM public.notif_emitir('agenda_solicitud_nueva', v_enc.user_id,
                jsonb_build_object(
                    'departamento', COALESCE(v_dep, 'tu departamento'),
                    'nombre', COALESCE(v_quien, 'Alguien de la iglesia'),
                    'detalle', left(btrim(regexp_replace(NEW.detalles, '\s+', ' ', 'g')), 90)),
                '/departamentos/' || NEW.departamento_id || '?tab=solicitudes');
        END LOOP;

    ELSIF OLD.estado = 'nueva' AND NEW.estado IN ('aceptada', 'rechazada')
          AND NEW.solicitante_id IS NOT NULL
          AND NEW.solicitante_id IS DISTINCT FROM NEW.revisada_por THEN
        PERFORM public.notif_emitir(
            CASE NEW.estado WHEN 'aceptada' THEN 'agenda_solicitud_aceptada'
                            ELSE 'agenda_solicitud_rechazada' END,
            NEW.solicitante_id,
            jsonb_build_object('departamento', COALESCE(v_dep, 'el departamento')));
    END IF;
    RETURN NULL;
END;
$fn$;


-- ── 5.3 · Sistemas: reportes de problemas ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.reportes_problemas_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_admin record;
    v_vars jsonb;
BEGIN
    v_vars := jsonb_build_object(
        'codigo', public.codigo_reporte(NEW.numero),
        'pantalla', COALESCE(NULLIF(btrim(NEW.pantalla), ''), 'Sin pantalla'),
        'detalle', left(btrim(NEW.descripcion), 90));

    FOR v_admin IN
        SELECT id FROM public.users
         WHERE (role)::text = 'SUPER_ADMIN'
            OR COALESCE(roles, '{}') && ARRAY['SUPER_ADMIN']
    LOOP
        PERFORM public.notif_emitir('sistemas_reporte_problema', v_admin.id, v_vars,
                                    '/panel-admin/reportes?id=' || NEW.id);
    END LOOP;
    RETURN NULL;
END;
$fn$;


-- ── 5.4 · Sistemas: pedidos de datos personales ─────────────────────────────
CREATE OR REPLACE FUNCTION public.solicitudes_datos_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_admin record;
    v_vars jsonb;
BEGIN
    v_vars := jsonb_build_object(
        'numero', lpad(NEW.numero::text, 4, '0'),
        'tipo', CASE NEW.tipo
            WHEN 'acceso' THEN 'Acceso a mis datos'
            WHEN 'rectificacion' THEN 'Corrección de datos'
            ELSE 'Eliminar mi cuenta' END);

    FOR v_admin IN
        SELECT id FROM public.users
         WHERE (role)::text = 'SUPER_ADMIN'
            OR COALESCE(roles, '{}') && ARRAY['SUPER_ADMIN']
    LOOP
        PERFORM public.notif_emitir('sistemas_solicitud_datos', v_admin.id, v_vars);
    END LOOP;
    RETURN NULL;
END;
$fn$;


-- ── 5.5 · Punto de Información: pedido listo ────────────────────────────────
CREATE OR REPLACE FUNCTION public.marcar_venta(p_id uuid, p_estado text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
declare
    v_uid uuid := auth.uid();
    v_venta record;
    v_aviso boolean := false;
    v_codigo text;
    v_quien uuid;
begin
    if not public.atiende_el_punto() then
        return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    end if;

    if p_estado is null or p_estado not in ('lista', 'retirada') then
        return jsonb_build_object('ok', false, 'motivo', 'estado_invalido');
    end if;

    select id, codigo, user_id, lista_at, retirada_at
      into v_venta
      from public.ventas_voluntarios
     where id = p_id
       for update;

    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    if p_estado = 'lista' then
        if v_venta.lista_at is null then
            update public.ventas_voluntarios
               set lista_at = now(), lista_por = v_uid
             where id = p_id;
            v_aviso := true;
        end if;
    else
        if v_venta.retirada_at is null then
            update public.ventas_voluntarios
               set retirada_at = now(),
                   retirada_por = v_uid,
                   -- Se lo llevó: si nunca se marcó listo, lo estuvo igual.
                   lista_at = coalesce(lista_at, now()),
                   lista_por = coalesce(lista_por, v_uid)
             where id = p_id;
        end if;
    end if;

    if v_aviso and v_venta.user_id is not null then
        v_codigo := v_venta.codigo;
        v_quien := v_venta.user_id;
        perform public.notif_emitir('punto_pedido_listo', v_quien,
            jsonb_build_object('codigo', v_codigo),
            '/perfil/compras/' || p_id::text);
    end if;

    select lista_at, retirada_at into v_venta
      from public.ventas_voluntarios where id = p_id;

    return jsonb_build_object(
        'ok', true,
        'estado', public.estado_venta(v_venta.lista_at, v_venta.retirada_at),
        'lista_at', v_venta.lista_at,
        'retirada_at', v_venta.retirada_at
    );
end;
$fn$;


-- ── 5.6 · GCX: recordatorio de asistencia ───────────────────────────────────
-- Ojo: la ruta '/groups/host?group=<id>' es también la marca de que a ese
-- grupo ya se le recordó hoy. Si se cambia, hay que cambiar el chequeo de
-- arriba o el anfitrión recibe el recordatorio cada vez que abre la app.
CREATE OR REPLACE FUNCTION public.check_attendance_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_host_id uuid;
  v_now timestamptz;
  v_today date;
  v_current_minutes integer;
  v_es_day_names text[] := ARRAY['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  v_today_day_es text;
  v_group RECORD;
  v_meeting_hour integer;
  v_meeting_minute integer;
  v_meeting_total_minutes integer;
  v_minutes_since integer;
  v_has_attendance boolean;
  v_already_notified boolean;
  v_notified_count integer := 0;
  v_url text;
BEGIN
  -- Argentina timezone: UTC-3
  v_now := NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires';
  v_today := v_now::date;
  v_current_minutes := EXTRACT(HOUR FROM v_now)::integer * 60 + EXTRACT(MINUTE FROM v_now)::integer;

  -- Day of week in Spanish (0=Sunday)
  v_today_day_es := v_es_day_names[EXTRACT(DOW FROM v_now)::integer + 1];

  -- Only run for the currently authenticated user who is a host
  v_host_id := auth.uid();
  IF v_host_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_group IN
    SELECT g.id, g.name, g.host_id, g.co_host_id, g.meeting_time
    FROM groups g
    WHERE g.meeting_day = v_today_day_es
      AND g.status = 'approved'
      AND (g.host_id = v_host_id OR g.co_host_id = v_host_id)
  LOOP
    -- Parse meeting_time (HH:MM)
    BEGIN
      v_meeting_hour   := SPLIT_PART(v_group.meeting_time, ':', 1)::integer;
      v_meeting_minute := SPLIT_PART(v_group.meeting_time, ':', 2)::integer;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    v_meeting_total_minutes := v_meeting_hour * 60 + v_meeting_minute;
    v_minutes_since := v_current_minutes - v_meeting_total_minutes;

    -- Window: 3h to 4h after meeting start
    IF v_minutes_since < 180 OR v_minutes_since >= 240 THEN
      CONTINUE;
    END IF;

    -- Check if attendance already registered today
    SELECT EXISTS (
      SELECT 1 FROM group_attendance
      WHERE group_id = v_group.id AND date = v_today
    ) INTO v_has_attendance;

    IF v_has_attendance THEN
      CONTINUE;
    END IF;

    v_url := '/groups/host?group=' || v_group.id;

    -- Check if reminder already sent today for this group (dedup)
    SELECT EXISTS (
      SELECT 1 FROM app_notifications
      WHERE user_id = v_host_id
        AND type = 'attendance_reminder'
        AND action_url = v_url
        AND created_at >= (v_today::timestamptz AT TIME ZONE 'UTC')
    ) INTO v_already_notified;

    IF v_already_notified THEN
      CONTINUE;
    END IF;

    PERFORM public.notif_emitir('gcx_recordatorio_asistencia', v_host_id,
                                jsonb_build_object('grupo', v_group.name), v_url);

    v_notified_count := v_notified_count + 1;
  END LOOP;

  RETURN v_notified_count;
END;
$fn$;


-- ── 5.7 · La notificación de prueba del dispositivo ─────────────────────────
CREATE OR REPLACE FUNCTION public.push_enviar_prueba()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
    v_hoy timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires';
    n integer;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.push_suscripciones WHERE user_id = v_uid) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_dispositivos');
    END IF;

    SELECT count(*) INTO n FROM public.app_notifications
     WHERE user_id = v_uid AND type = 'PUSH_PRUEBA' AND created_at >= v_hoy;
    IF n >= 5 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope', 'quedan', 0);
    END IF;

    PERFORM public.notif_emitir('push_prueba', v_uid, '{}'::jsonb);

    RETURN jsonb_build_object('ok', true, 'quedan', 4 - n);
END;
$fn$;


-- ── 5.8 · El push de "hay una versión nueva" ────────────────────────────────
-- p_titulo y p_mensaje pasan a ser opcionales: sin ellos, el texto sale del
-- catálogo (y entonces se puede editar desde la pantalla). notify-deploy.js
-- la llama sólo con p_horas, así que a partir de ahora usa la plantilla.
CREATE OR REPLACE FUNCTION public.avisar_actualizacion(
    p_titulo  text    DEFAULT NULL,
    p_mensaje text    DEFAULT NULL,
    p_horas   integer DEFAULT 0
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_a record;
    v_titulo text;
    v_mensaje text;
    v_p record;
    v_n integer := 0;
BEGIN
    SELECT titulo_plantilla, mensaje_plantilla, url_plantilla INTO v_a
      FROM public.notif_alertas WHERE clave = 'app_version_nueva';

    v_titulo  := public.notif_recortar(btrim(COALESCE(NULLIF(btrim(COALESCE(p_titulo, '')), ''), v_a.titulo_plantilla, 'Hay una versión nueva')), 120);
    v_mensaje := public.notif_recortar(btrim(COALESCE(NULLIF(btrim(COALESCE(p_mensaje, '')), ''), v_a.mensaje_plantilla, 'Tocá acá y fijate si ya la tenés.')), 500);

    FOR v_p IN
        SELECT DISTINCT p.user_id
          FROM public.push_suscripciones p
          JOIN public.users u ON u.id = p.user_id
         WHERE u.is_active IS NOT FALSE
           AND NOT EXISTS (
                SELECT 1
                  FROM public.app_notifications a
                 WHERE a.user_id = p.user_id
                   AND a.title = v_titulo
                   AND a.created_at > now() - make_interval(hours => GREATEST(COALESCE(p_horas, 0), 0))
           )
    LOOP
        IF public.notif_emitir_texto('app_version_nueva', v_p.user_id, v_titulo, v_mensaje,
                                     COALESCE(v_a.url_plantilla, '/perfil/app')) IS NOT NULL THEN
            v_n := v_n + 1;
        END IF;
    END LOOP;

    RETURN v_n;
END;
$fn$;

COMMENT ON FUNCTION public.avisar_actualizacion(text, text, integer) IS
    'Crea el aviso "hay una versión nueva" para quien tiene la app instalada con push activado, y el trigger lo manda al teléfono. La llama scripts/notify-deploy.js en cada deploy. Sin p_titulo/p_mensaje usa la plantilla de notif_alertas. No repite dentro de p_horas. Sólo service_role.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6 · crear_aviso · la firma nueva y la vieja                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- Las reglas de relación y el tope son los mismos para las dos firmas, así
-- que viven una sola vez acá. Devuelve el motivo del rechazo, o NULL si está
-- todo bien.
CREATE OR REPLACE FUNCTION public.crear_aviso_permitido(p_destinatario uuid, p_tipo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_uid    uuid := auth.uid();
    v_gestor boolean;
    v_ok     boolean := false;
    n integer;
BEGIN
    IF v_uid IS NULL THEN
        RETURN 'sin_sesion';
    END IF;

    -- Los tipos que crea el frontend, y ninguno más. Los demás (Agenda,
    -- reportes, PUSH_PRUEBA…) los crea sólo la base.
    IF p_tipo IS NULL OR p_tipo NOT IN (
        'ATTENDANCE', 'REGISTRATION', 'REGISTRATION_APPROVED', 'REGISTRATION_REJECTED',
        'GROUP_APPROVED', 'GROUP_REJECTED'
    ) THEN
        RETURN 'tipo_invalido';
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
        RETURN 'sin_permiso';
    END IF;

    -- Tope: 60 por hora por quien avisa (SUPER_ADMIN sin tope). Alcanza de
    -- sobra para el uso normal y frena a quien quiera llenarle el teléfono
    -- de avisos a alguien.
    IF NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        SELECT count(*) INTO n FROM public.app_notifications
         WHERE creado_por = v_uid AND created_at > now() - interval '1 hour';
        IF n >= 60 THEN
            RETURN 'limite';
        END IF;
    END IF;

    RETURN NULL;
END;
$fn$;


-- ── La firma nueva: la clave de la alerta y sus variables ───────────────────
CREATE OR REPLACE FUNCTION public.crear_aviso(
    p_destinatario uuid,
    p_clave        text,
    p_vars         jsonb,
    p_url          text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_uid    uuid := auth.uid();
    v_tipo   text;
    v_permitidas text[];
    v_motivo text;
    v_url    text := NULLIF(btrim(COALESCE(p_url, '')), '');
    v_usadas text[];
BEGIN
    SELECT type_legacy, variables INTO v_tipo, v_permitidas
      FROM public.notif_alertas WHERE clave = p_clave AND tipo = 'automatica';
    IF v_tipo IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'alerta_invalida');
    END IF;

    v_motivo := public.crear_aviso_permitido(p_destinatario, v_tipo);
    IF v_motivo IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
    END IF;

    -- Variables que no son de esta alerta: mejor frenar que mandar un texto
    -- con un hueco donde iba un dato.
    IF p_vars IS NOT NULL AND jsonb_typeof(p_vars) = 'object' THEN
        SELECT array_agg(k) INTO v_usadas
          FROM jsonb_object_keys(p_vars) k
         WHERE NOT (k = ANY (COALESCE(v_permitidas, '{}')));
        IF v_usadas IS NOT NULL THEN
            RETURN jsonb_build_object('ok', false, 'motivo', 'variable_invalida');
        END IF;
    END IF;

    IF v_url IS NOT NULL AND NOT public.notif_url_interna(v_url) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'url_invalida');
    END IF;

    IF public.notif_emitir(p_clave, p_destinatario, p_vars, v_url, v_uid) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_se_pudo');
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$fn$;


-- ── La firma vieja: sigue andando ───────────────────────────────────────────
-- Un teléfono con la app vieja abierta la va a seguir llamando por un rato.
-- Recibe el texto ya armado, así que ese texto es el que se manda (no la
-- plantilla): lo que ve la gente no cambia ni un carácter. Lo que sí hace es
-- anotarle la clave que le corresponde a su `type`, para que las reglas de
-- envío también valgan para esos avisos.
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
AS $fn$
DECLARE
    v_uid     uuid := auth.uid();
    v_titulo  text := btrim(COALESCE(p_titulo, ''));
    v_mensaje text := btrim(COALESCE(p_mensaje, ''));
    v_url     text := NULLIF(btrim(COALESCE(p_url, '')), '');
    v_motivo  text;
    v_clave   text;
BEGIN
    v_motivo := public.crear_aviso_permitido(p_destinatario, p_tipo);
    IF v_motivo IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', v_motivo);
    END IF;

    IF v_titulo = '' OR v_mensaje = '' OR length(v_titulo) > 120 OR length(v_mensaje) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido');
    END IF;

    IF v_url IS NOT NULL AND NOT public.notif_url_interna(v_url) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'url_invalida');
    END IF;

    -- La clave que le toca a cada `type` de la firma vieja. REGISTRATION
    -- tiene dos plantillas (miembro y pareja): las separa el título, que es
    -- el que mandó el bundle.
    v_clave := CASE p_tipo
        WHEN 'ATTENDANCE'            THEN 'gcx_asistencia_guardada'
        WHEN 'REGISTRATION'          THEN CASE WHEN v_titulo ILIKE '%pareja%'
                                               THEN 'gcx_solicitud_pareja_app'
                                               ELSE 'gcx_solicitud_ingreso_app' END
        WHEN 'REGISTRATION_APPROVED' THEN 'gcx_inscripcion_aprobada'
        WHEN 'REGISTRATION_REJECTED' THEN 'gcx_inscripcion_rechazada'
        WHEN 'GROUP_APPROVED'        THEN 'gcx_grupo_aprobado_app'
        WHEN 'GROUP_REJECTED'        THEN 'gcx_grupo_rechazado_app'
    END;

    IF public.notif_emitir_texto(v_clave, p_destinatario, v_titulo, v_mensaje, v_url, v_uid) IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_se_pudo');
    END IF;

    RETURN jsonb_build_object('ok', true);
END;
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 7 · LAS RPC DE LA PANTALLA (prompts 3 y 4)                               ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── El listado ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notif_alertas_admin()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
$fn$;


-- ── Guardar una automática ──────────────────────────────────────────────────
-- El nombre, el evento y el destinatario NO se editan: los define la app.
CREATE OR REPLACE FUNCTION public.notif_guardar_automatica(
    p_id          uuid,
    p_titulo      text,
    p_mensaje     text,
    p_activa      boolean,
    p_no_molestar boolean,
    p_desde       time DEFAULT NULL,
    p_hasta       time DEFAULT NULL,
    p_max_por_dia integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
    v_a record;
    v_titulo  text := btrim(COALESCE(p_titulo, ''));
    v_mensaje text := btrim(COALESCE(p_mensaje, ''));
    v_sueltas text[];
BEGIN
    IF v_uid IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    SELECT * INTO v_a FROM public.notif_alertas WHERE id = p_id AND tipo = 'automatica';
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;

    IF v_titulo = '' OR length(v_titulo) > 120 OR v_mensaje = '' OR length(v_mensaje) > 500 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido');
    END IF;

    -- Sólo las variables de esta alerta: una {que_no_existe} llegaría al
    -- teléfono como un hueco.
    SELECT array_agg(DISTINCT m[1]) INTO v_sueltas
      FROM regexp_matches(v_titulo || ' ' || v_mensaje, '\{([a-z][a-z0-9_]{0,29})\}', 'g') m
     WHERE NOT (m[1] = ANY (COALESCE(v_a.variables, '{}')));
    IF v_sueltas IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'variable_invalida', 'variables', v_sueltas);
    END IF;

    IF p_max_por_dia IS NOT NULL AND p_max_por_dia NOT BETWEEN 1 AND 20 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope_invalido');
    END IF;

    IF COALESCE(p_no_molestar, false) AND (p_desde IS NULL OR p_hasta IS NULL OR p_desde = p_hasta) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'horario_invalido');
    END IF;

    UPDATE public.notif_alertas
       SET titulo_plantilla  = v_titulo,
           mensaje_plantilla = v_mensaje,
           activa            = COALESCE(p_activa, true),
           no_molestar       = COALESCE(p_no_molestar, false),
           no_molestar_desde = CASE WHEN COALESCE(p_no_molestar, false) THEN p_desde END,
           no_molestar_hasta = CASE WHEN COALESCE(p_no_molestar, false) THEN p_hasta END,
           max_por_dia       = p_max_por_dia,
           updated_at        = now(),
           updated_by        = v_uid
     WHERE id = p_id;

    RETURN jsonb_build_object('ok', true);
END;
$fn$;


-- ── Enviarme una prueba ─────────────────────────────────────────────────────
-- Sólo a quien la pide. El aviso de prueba va SIN alerta_clave: así no lo
-- frena el horario de no molestar ni el tope de la alerta que se está
-- probando (si no, tocar "probar" a las 23:30 no mostraría nada).
CREATE OR REPLACE FUNCTION public.notif_enviar_prueba(p_id uuid, p_vars jsonb DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    EJEMPLOS constant jsonb := jsonb_build_object(
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
    v_uid uuid := auth.uid();
    v_a record;
    v_hoy timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Argentina/Buenos_Aires') AT TIME ZONE 'America/Argentina/Buenos_Aires';
    v_vars jsonb;
    v_titulo text;
    v_mensaje text;
    v_id uuid;
    n integer;
BEGIN
    IF v_uid IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    SELECT * INTO v_a FROM public.notif_alertas WHERE id = p_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.push_suscripciones WHERE user_id = v_uid) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_dispositivos');
    END IF;

    SELECT count(*) INTO n FROM public.notif_push_log
     WHERE user_id = v_uid AND resultado = 'prueba' AND enviado_at >= v_hoy;
    IF n >= 5 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope', 'quedan', 0);
    END IF;

    v_vars := EJEMPLOS || COALESCE(CASE WHEN jsonb_typeof(p_vars) = 'object' THEN p_vars END, '{}'::jsonb);
    v_titulo  := public.notif_render(v_a.titulo_plantilla,  v_vars, 120);
    v_mensaje := public.notif_render(v_a.mensaje_plantilla, v_vars, 500);

    IF v_titulo = '' OR v_mensaje = '' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido');
    END IF;

    INSERT INTO public.app_notifications (user_id, title, message, type, action_url, creado_por)
    VALUES (v_uid, v_titulo, v_mensaje, v_a.type_legacy,
            CASE WHEN public.notif_url_interna(v_a.url_plantilla) THEN v_a.url_plantilla END,
            v_uid)
    RETURNING id INTO v_id;

    INSERT INTO public.notif_push_log (notificacion_id, alerta_clave, user_id, resultado)
    VALUES (v_id, v_a.clave, v_uid, 'prueba');

    RETURN jsonb_build_object('ok', true, 'quedan', 4 - n, 'titulo', v_titulo, 'mensaje', v_mensaje);
END;
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 8 · EL CRON DE LOS DIFERIDOS                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Cada 5 minutos le pide a send-push que mande los que ya vencieron. La clave
-- sale de Vault (molde del cron welcome-form-reminders).
SELECT cron.unschedule('notif-push-diferidos')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notif-push-diferidos');

SELECT cron.schedule(
    'notif-push-diferidos',
    '*/5 * * * *',
    $cron$
    SELECT net.http_post(
        url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'webhook_service_role_key')
        ),
        body := '{"modo":"diferidos"}'::jsonb,
        timeout_milliseconds := 60000
    );
    $cron$
);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 9 · PERMISOS                                                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- CREATE OR REPLACE vuelve a darle EXECUTE a PUBLIC (sección 12, regla 3).

-- Helpers: nadie los llama de afuera.
REVOKE ALL ON FUNCTION public.notif_recortar(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_url_interna(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_render(text, jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_no_molestar_hasta(timestamptz, time, time) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crear_aviso_permitido(uuid, text) FROM PUBLIC, anon, authenticated;

-- El emisor: lo llaman las funciones de la base (que corren como postgres) y
-- las Edge Functions con la clave de servicio. Nunca una persona.
REVOKE ALL ON FUNCTION public.notif_emitir(text, uuid, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_emitir_texto(text, uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_emitir(text, uuid, jsonb, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.notif_emitir_texto(text, uuid, text, text, text, uuid) TO service_role;

-- Las reglas de envío: sólo send-push.
REVOKE ALL ON FUNCTION public.notif_puede_enviar(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_diferidos_tomar(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_puede_enviar(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.notif_diferidos_tomar(integer) TO service_role;

-- Las tablas nuevas, sólo por RPC y por la clave de servicio.
REVOKE ALL ON public.notif_alertas FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.notif_push_log FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.notif_push_diferidos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_alertas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_push_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_push_diferidos TO service_role;

-- Los productores: trigger functions y funciones internas.
REVOKE ALL ON FUNCTION public.agenda_registrar_avisos(uuid, text, uuid[], text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_tareas_avisar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agenda_solicitudes_avisar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reportes_problemas_avisar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.solicitudes_datos_avisar() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.avisar_actualizacion(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.avisar_actualizacion(text, text, integer) TO service_role;

-- Las que llama el frontend con sesión.
REVOKE ALL ON FUNCTION public.marcar_venta(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_venta(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.check_attendance_reminders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_attendance_reminders() TO authenticated;
REVOKE ALL ON FUNCTION public.push_enviar_prueba() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_enviar_prueba() TO authenticated;
REVOKE ALL ON FUNCTION public.crear_aviso(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_aviso(uuid, text, text, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.crear_aviso(uuid, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_aviso(uuid, text, jsonb, text) TO authenticated;

-- Las de la pantalla de Sistemas: el rol se chequea adentro.
REVOKE ALL ON FUNCTION public.notif_alertas_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_alertas_admin() TO authenticated;
REVOKE ALL ON FUNCTION public.notif_guardar_automatica(uuid, text, text, boolean, boolean, time, time, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_guardar_automatica(uuid, text, text, boolean, boolean, time, time, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.notif_enviar_prueba(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_enviar_prueba(uuid, jsonb) TO authenticated;


-- ── Comentarios ─────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.notif_emitir(text, uuid, jsonb, text, uuid) IS
    'El emisor central: renderiza la plantilla de la alerta con p_vars y crea el aviso. Crea la fila aunque la alerta esté pausada (la pausa la resuelve el push). Sólo la base y service_role.';
COMMENT ON FUNCTION public.notif_emitir_texto(text, uuid, text, text, text, uuid) IS
    'Como notif_emitir pero con el texto ya armado: lo usa la firma vieja de crear_aviso, que recibe el texto del bundle del frontend.';
COMMENT ON FUNCTION public.notif_puede_enviar(uuid) IS
    'Si el push de ese aviso sale, no sale o se difiere: {decision, enviar_en}. La llama send-push. Un aviso sin alerta_clave se manda siempre.';
COMMENT ON FUNCTION public.notif_diferidos_tomar(integer) IS
    'Saca de notif_push_diferidos los que ya vencieron y devuelve sus ids, en una sola operación (dos corridas del cron no duplican).';
COMMENT ON FUNCTION public.crear_aviso(uuid, text, jsonb, text) IS
    'La forma nueva de crear un aviso desde la app: la clave de la alerta y sus variables. Mismas reglas de relación y mismo tope que la firma vieja.';
COMMENT ON FUNCTION public.crear_aviso(uuid, text, text, text, text) IS
    'Firma vieja (type + texto armado), para los bundles viejos que siguen abiertos. Manda el texto tal como lo recibe y le anota la clave que le corresponde al type.';
COMMENT ON FUNCTION public.notif_alertas_admin() IS
    'El catálogo completo para la pantalla de Sistemas, con los envíos de los últimos 7 días. Sólo SUPER_ADMIN.';
COMMENT ON FUNCTION public.notif_guardar_automatica(uuid, text, text, boolean, boolean, time, time, integer) IS
    'Edita una alerta automática: texto, pausa, no molestar y tope por día. El nombre, el evento y el destinatario los define la app. Sólo SUPER_ADMIN.';
COMMENT ON FUNCTION public.notif_enviar_prueba(uuid, jsonb) IS
    'Manda la alerta renderizada con datos de ejemplo SÓLO a quien la pide (máx. 5 por día). Sólo SUPER_ADMIN.';

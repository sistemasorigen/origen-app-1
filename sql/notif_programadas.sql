-- ════════════════════════════════════════════════════════════════════════════
-- GESTIÓN DE NOTIFICACIONES · las alertas PROGRAMADAS (las que crea Sistemas)
-- 2026-10-29 · prompt 2 de 4 (diseño: design-claude/Sistemas - Gestion de notificaciones.dc.html)
-- ⏳ PENDIENTE
--
-- LO QUE AGREGA
--   1 · notif_alertas: baja lógica (eliminada_at / eliminada_por), reloj_desde
--       y el CHECK de las programadas.
--   2 · Las RPC de Sistemas: guardar, pausar/activar, eliminar, estimar la
--       audiencia, los roles para los chips. notif_alertas_admin() deja afuera
--       las eliminadas y suma, de cada programada, el alcance en texto, las
--       personas y el próximo envío.
--   3 · El reloj: notif_programadas_hechas + notif_programadas_tick(), que
--       corre cada 5 minutos (cron notif-programadas).
--   4 · El envío en lote: los avisos de una programada se crean de una, con
--       un envio_id; el trigger de push NO hace un pedido por fila para ellos,
--       y en su lugar sale UN pedido a send-push {modo:'lote'}.
--   5 · audit_logs: cada alta, edición, pausa y baja de notif_alertas.
--
-- LAS REGLAS DE PRODUCTO (decididas por Ignacio)
--   · Programación: siempre activa o desde/hasta; cada N días contando desde
--     "desde"; de 1 a 5 horarios por día, hora argentina.
--   · Audiencia: todos, o roles, y/o personas. Se suman, sin repetir, sólo
--     cuentas activas.
--   · Una programada PAUSADA no emite nada: ni push ni aviso en la campanita.
--     (Distinto de las automáticas, que crean el aviso igual.)
--   · Eliminar es lógico: queda el historial y el log.
--   · No molestar y tope por día: los mismos del prompt 1, sin tocar nada.
--
-- LO QUE NO CAMBIA
--   Las automáticas mandan exactamente igual. El trigger de push sólo deja de
--   mirar los avisos que traen envio_id, y ninguna automática lo pone.
--
-- ORDEN DE APLICACIÓN
--   1 · Este archivo. Hasta que no haya programadas no cambia nada.
--   2 · Desplegar send-push (agrega el modo lote). Al revés también anda: el
--       send-push nuevo atiende igual los pedidos de siempre.
--
-- Pruebas: sql/PROBAR_notif_programadas.sql · Deshacer: sql/ROLLBACK_notif_programadas.sql
-- ════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 1 · LAS COLUMNAS Y EL CHECK                                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

ALTER TABLE public.notif_alertas
    ADD COLUMN IF NOT EXISTS eliminada_at  timestamptz,
    ADD COLUMN IF NOT EXISTS eliminada_por uuid REFERENCES public.users(id) ON DELETE SET NULL,
    -- Desde cuándo valen los horarios: el alta, la última vez que se activó o
    -- que se cambió la programación. Un horario de antes no sale, así crear
    -- una programada a las 11:00 con un horario a las 10:00 no la manda en el
    -- momento (ver notif_programadas_tick).
    ADD COLUMN IF NOT EXISTS reloj_desde   timestamptz;

COMMENT ON COLUMN public.notif_alertas.eliminada_at IS
    'Baja lógica (sólo programadas): deja de aparecer y de enviarse, el historial queda.';
COMMENT ON COLUMN public.notif_alertas.reloj_desde IS
    'Programadas: los horarios anteriores a este momento (menos 10 minutos de gracia) no salen. Se pone al crear, al activar y al cambiar la programación.';

-- El aviso sabe de qué envío en lote salió. NULL en todo lo demás: es lo que
-- usa el trigger de push para no hacer un pedido por fila.
ALTER TABLE public.app_notifications
    ADD COLUMN IF NOT EXISTS envio_id uuid;

CREATE INDEX IF NOT EXISTS app_notifications_envio_idx
    ON public.app_notifications (envio_id) WHERE envio_id IS NOT NULL;

COMMENT ON COLUMN public.app_notifications.envio_id IS
    'El envío en lote de una alerta programada. Con valor, el trigger de push no manda nada: lo manda send-push {modo:''lote''}.';


-- ── Los horarios: de 1 a 5, sin repetir ni vacíos ───────────────────────────
-- Función aparte porque un CHECK no admite subconsultas.
CREATE OR REPLACE FUNCTION public.notif_horas_ok(p_horas time[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
    SELECT p_horas IS NOT NULL
       AND cardinality(p_horas) BETWEEN 1 AND 5
       AND array_position(p_horas, NULL) IS NULL
       AND (SELECT count(DISTINCT h) FROM unnest(p_horas) h) = cardinality(p_horas);
$fn$;

ALTER TABLE public.notif_alertas DROP CONSTRAINT IF EXISTS notif_alertas_programada_ok;
ALTER TABLE public.notif_alertas ADD CONSTRAINT notif_alertas_programada_ok CHECK (
    tipo <> 'programada' OR (
        type_legacy = 'PROGRAMADA'
        AND clave ~ '^prog_[a-z0-9]{6,32}$'
        AND length(titulo_plantilla) <= 60
        AND length(mensaje_plantilla) <= 160
        AND siempre_activa IS NOT NULL
        AND desde IS NOT NULL
        AND (siempre_activa OR (hasta IS NOT NULL AND hasta >= desde))
        AND cada_n_dias IS NOT NULL AND cada_n_dias BETWEEN 1 AND 365
        AND public.notif_horas_ok(horas)
        AND (COALESCE(audiencia_todos, false)
             OR cardinality(COALESCE(audiencia_roles, '{}')) > 0
             OR cardinality(COALESCE(audiencia_usuarios, '{}')) > 0)
    )
);


-- ── audit_logs, con el mismo trigger que users, groups y group_registrations ─
DROP TRIGGER IF EXISTS audit_notif_alertas_changes ON public.notif_alertas;
CREATE TRIGGER audit_notif_alertas_changes
    AFTER INSERT OR UPDATE OR DELETE ON public.notif_alertas
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 2 · LA AUDIENCIA                                                         ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── A quién le llega ────────────────────────────────────────────────────────
-- La usan la estimación de la pantalla Y la emisión: así el número que ve
-- Sistemas es el mismo que después sale. Una fila por persona (sin repetir
-- aunque esté en dos roles y además elegida a mano), sólo cuentas activas.
-- Los roles miran las dos columnas, role y roles[] (sección 12).
CREATE OR REPLACE FUNCTION public.notif_audiencia(p_todos boolean, p_roles text[], p_usuarios uuid[])
RETURNS TABLE (user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT u.id
      FROM public.users u
     WHERE u.is_active IS NOT FALSE
       AND (COALESCE(p_todos, false)
            OR (cardinality(COALESCE(p_roles, '{}')) > 0
                AND ((u.role)::text = ANY (p_roles) OR COALESCE(u.roles, '{}') && p_roles))
            OR u.id = ANY (COALESCE(p_usuarios, '{}')));
$fn$;


-- ── Los roles que existen ───────────────────────────────────────────────────
-- Los del enum más los que hay cargados en users.roles aunque no estén en el
-- enum (PRODE, ADMIN_CUIDADO_PASTORAL…): roles[] es text[] y tiene valores
-- de afuera (sección 12).
CREATE OR REPLACE FUNCTION public.notif_roles_validos()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
    SELECT array_agg(DISTINCT r ORDER BY r) FROM (
        SELECT e.enumlabel::text AS r FROM pg_enum e WHERE e.enumtypid = 'public.user_role'::regtype
        UNION
        SELECT x FROM public.users u, unnest(COALESCE(u.roles, '{}')) x
    ) t WHERE r IS NOT NULL AND r <> '';
$fn$;


-- ── Una emisión no puede pasar de esta cantidad de personas ─────────────────
-- En una función y no escrito adentro de la emisión para que la prueba pueda
-- bajarlo dentro de su transacción (no hay 5000 cuentas para probarlo).
-- STABLE y no IMMUTABLE: si no, el plan de quien la llama podría quedarse
-- con el 5000 ya calculado.
CREATE OR REPLACE FUNCTION public.notif_tope_por_emision()
RETURNS integer
LANGUAGE sql
STABLE
AS $fn$ SELECT 5000 $fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 3 · CÓMO SE LEE UNA PROGRAMADA                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── El alcance, en palabras ─────────────────────────────────────────────────
-- Lo mismo que muestra el diseño: "Cada 7 días · 2 veces por día", y por
-- separado los horarios y la vigencia.
CREATE OR REPLACE FUNCTION public.notif_alcance_programada(
    p_cada    integer,
    p_horas   time[],
    p_siempre boolean,
    p_desde   date,
    p_hasta   date
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $fn$
DECLARE
    v_horas text[];
    v_n integer := COALESCE(cardinality(p_horas), 0);
    v_frec text;
    v_veces text;
    v_horario text;
    v_vig text;
BEGIN
    SELECT array_agg(to_char(h, 'HH24:MI') ORDER BY h) INTO v_horas FROM unnest(p_horas) h;

    v_frec := CASE WHEN p_cada = 1 THEN 'Todos los días' ELSE 'Cada ' || p_cada || ' días' END;
    v_veces := v_n || CASE WHEN v_n = 1 THEN ' vez por día' ELSE ' veces por día' END;
    v_horario := CASE
        WHEN v_n = 0 THEN ''
        WHEN v_n = 1 THEN v_horas[1]
        ELSE array_to_string(v_horas[1:v_n - 1], ', ') || ' y ' || v_horas[v_n]
    END;
    v_vig := CASE
        WHEN p_siempre THEN 'Siempre activa'
        ELSE 'Del ' || to_char(p_desde, 'FMDD/FMMM') || ' al ' || to_char(p_hasta, 'FMDD/FMMM')
    END;

    RETURN jsonb_build_object(
        'alcance', v_frec || ' · ' || v_veces,
        'frecuencia', v_frec,
        'veces', v_veces,
        'horario', v_horario,
        'vigencia', v_vig);
END;
$fn$;


-- ── ¿Ese día sale? ──────────────────────────────────────────────────────────
-- Vigente ese día y (día − desde) múltiplo de cada_n_dias.
CREATE OR REPLACE FUNCTION public.notif_programada_sale_el(
    p_dia     date,
    p_desde   date,
    p_hasta   date,
    p_siempre boolean,
    p_cada    integer
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
    SELECT p_dia IS NOT NULL AND p_desde IS NOT NULL AND p_cada >= 1
       AND p_dia >= p_desde
       AND (COALESCE(p_siempre, false) OR p_dia <= p_hasta)
       AND (p_dia - p_desde) % p_cada = 0;
$fn$;


-- ── El próximo envío ────────────────────────────────────────────────────────
-- El primer horario que todavía no salió y que es posterior a p_ahora. NULL
-- si está pausada, eliminada o ya no tiene días por delante. Alcanza con
-- mirar dos días que salen: el de hoy (o el primero desde "desde") y el
-- siguiente.
CREATE OR REPLACE FUNCTION public.notif_proximo_envio(p_id uuid, p_ahora timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    v_a record;
    v_hoy date := (p_ahora AT TIME ZONE ZONA)::date;
    v_dia date;
    v_k integer;
    v_h time;
    v_inst timestamptz;
BEGIN
    SELECT * INTO v_a FROM public.notif_alertas
     WHERE id = p_id AND tipo = 'programada' AND eliminada_at IS NULL;
    IF NOT FOUND OR NOT v_a.activa THEN
        RETURN NULL;
    END IF;

    -- El primer día que sale a partir de hoy.
    IF v_hoy <= v_a.desde THEN
        v_dia := v_a.desde;
    ELSE
        v_k := ceil((v_hoy - v_a.desde)::numeric / v_a.cada_n_dias)::integer;
        v_dia := v_a.desde + v_k * v_a.cada_n_dias;
    END IF;

    FOR i IN 0..1 LOOP
        EXIT WHEN NOT v_a.siempre_activa AND v_dia > v_a.hasta;
        FOR v_h IN SELECT h FROM unnest(v_a.horas) h ORDER BY h LOOP
            v_inst := (v_dia + v_h) AT TIME ZONE ZONA;
            CONTINUE WHEN v_inst <= p_ahora;
            CONTINUE WHEN EXISTS (SELECT 1 FROM public.notif_programadas_hechas
                                   WHERE alerta_id = p_id AND fecha = v_dia AND hora = v_h);
            RETURN v_inst;
        END LOOP;
        v_dia := v_dia + v_a.cada_n_dias;
    END LOOP;

    RETURN NULL;
END;
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 4 · EL RELOJ Y EL LOTE · las tablas                                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Qué horario ya salió ────────────────────────────────────────────────────
-- El UNIQUE es lo que garantiza que un horario sale UNA vez: el reloj reserva
-- con INSERT … ON CONFLICT DO NOTHING antes de emitir, así que dos corridas
-- superpuestas no pueden emitir las dos.
CREATE TABLE IF NOT EXISTS public.notif_programadas_hechas (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alerta_id  uuid NOT NULL REFERENCES public.notif_alertas(id) ON DELETE CASCADE,
    fecha      date NOT NULL,
    hora       time NOT NULL,
    envio_id   uuid,
    personas   integer,
    con_push   integer,
    -- emitida · sin_audiencia (nadie activo) · excedida (más que el tope:
    -- no se emitió nada).
    resultado  text NOT NULL DEFAULT 'emitida'
               CHECK (resultado IN ('emitida', 'sin_audiencia', 'excedida')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (alerta_id, fecha, hora)
);

ALTER TABLE public.notif_programadas_hechas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notif_programadas_hechas FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.notif_programadas_hechas IS
    'Un renglón por horario de una programada que ya salió (o que no salió por el tope). UNIQUE(alerta_id, fecha, hora): ningún horario sale dos veces.';


-- ── Los envíos en lote ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notif_lotes (
    envio_id         uuid PRIMARY KEY,
    alerta_clave     text NOT NULL,
    personas         integer NOT NULL DEFAULT 0,
    con_push         integer NOT NULL DEFAULT 0,
    creado_at        timestamptz NOT NULL DEFAULT now(),
    -- Cuándo se le pidió algo a send-push por última vez (o cuándo tomó
    -- avisos). Si pasan 10 minutos sin novedad y quedan avisos, el reloj lo
    -- vuelve a pedir: una invocación que se murió no deja el envío colgado.
    ultimo_pedido_at timestamptz,
    pedidos          integer NOT NULL DEFAULT 0,
    terminado_at     timestamptz
);

-- ── Lo que falta mandar de cada lote ────────────────────────────────────────
-- Sólo los avisos de personas con algún dispositivo: a los demás no hay a
-- quién mandarles push (igual que el trigger de siempre). Es el cursor del
-- lote: send-push toma, manda y borra. tomado_at es la "reserva": nadie más
-- lo toma mientras tanto, y si a los 10 minutos sigue ahí es que esa
-- invocación se murió y se puede volver a tomar.
CREATE TABLE IF NOT EXISTS public.notif_lote_cola (
    notificacion_id uuid PRIMARY KEY,
    envio_id        uuid NOT NULL REFERENCES public.notif_lotes(envio_id) ON DELETE CASCADE,
    tomado_at       timestamptz
);

CREATE INDEX IF NOT EXISTS notif_lote_cola_envio_idx
    ON public.notif_lote_cola (envio_id, notificacion_id);

ALTER TABLE public.notif_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notif_lote_cola ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notif_lotes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.notif_lote_cola FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.notif_lotes IS
    'Un envío en lote de una programada: cuántas personas, cuántas con push, cuántos pedidos a send-push y cuándo terminó.';
COMMENT ON TABLE public.notif_lote_cola IS
    'Los avisos de un lote que send-push todavía no mandó. Toma con reserva (tomado_at), borra al terminar: dos invocaciones no mandan el mismo.';


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 5 · EL TRIGGER DE PUSH IGNORA LOS AVISOS DE UN LOTE                      ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Misma función, misma condición de antes más "envio_id IS NULL". Ninguna
-- automática pone envio_id, así que para ellas no cambia nada.
DROP TRIGGER IF EXISTS trg_app_notifications_push ON public.app_notifications;
CREATE TRIGGER trg_app_notifications_push
    AFTER INSERT ON public.app_notifications
    FOR EACH ROW
    WHEN (NEW.user_id IS NOT NULL AND NEW.envio_id IS NULL)
    EXECUTE FUNCTION public.app_notifications_push();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 6 · EL LOTE · las funciones que usa send-push                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Pedirle a send-push que mande (o que siga mandando) un lote ─────────────
-- Con la clave de Vault, como el trigger de push y el cron de los diferidos.
-- pg_net manda el pedido recién cuando la transacción confirma: si algo se
-- tira atrás, no sale nada.
CREATE OR REPLACE FUNCTION public.notif_lote_encolar(p_envio uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_key text;
BEGIN
    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets WHERE name = 'webhook_service_role_key';
    IF v_key IS NULL THEN
        RAISE WARNING '[notif] falta el secreto webhook_service_role_key: el lote % no sale', p_envio;
        RETURN false;
    END IF;

    PERFORM net.http_post(
        url := 'https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/send-push',
        body := jsonb_build_object('modo', 'lote', 'envio_id', p_envio),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key),
        -- send-push contesta en ~30 s como mucho (ver LOTE_PRESUPUESTO_MS).
        timeout_milliseconds := 120000
    );

    UPDATE public.notif_lotes
       SET ultimo_pedido_at = now(), pedidos = pedidos + 1
     WHERE envio_id = p_envio;
    RETURN true;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notif] no se pudo pedir el lote %: %', p_envio, SQLERRM;
    RETURN false;
END;
$fn$;


-- ── Tomar los próximos avisos de un lote ────────────────────────────────────
-- Devuelve hasta p_tope ids y los deja reservados. FOR UPDATE SKIP LOCKED:
-- dos invocaciones a la vez se reparten la cola, no se pisan. Un aviso
-- reservado hace más de 10 minutos (la invocación se murió) se puede volver a
-- tomar, salvo que ya figure en notif_push_log: ése ya se mandó y sólo faltó
-- borrarlo de la cola.
CREATE OR REPLACE FUNCTION public.notif_lote_tomar(p_envio uuid, p_tope integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_ids jsonb;
    v_quedan integer;
BEGIN
    UPDATE public.notif_lotes SET ultimo_pedido_at = now() WHERE envio_id = p_envio;

    DELETE FROM public.notif_lote_cola c
     WHERE c.envio_id = p_envio
       AND c.tomado_at < now() - interval '10 minutes'
       AND EXISTS (SELECT 1 FROM public.notif_push_log l WHERE l.notificacion_id = c.notificacion_id);

    WITH elegidos AS (
        SELECT notificacion_id
          FROM public.notif_lote_cola
         WHERE envio_id = p_envio
           AND (tomado_at IS NULL OR tomado_at < now() - interval '10 minutes')
         ORDER BY notificacion_id
         LIMIT LEAST(GREATEST(COALESCE(p_tope, 50), 1), 500)
         FOR UPDATE SKIP LOCKED
    ), tomados AS (
        UPDATE public.notif_lote_cola c
           SET tomado_at = now()
          FROM elegidos e
         WHERE c.notificacion_id = e.notificacion_id
        RETURNING c.notificacion_id
    )
    SELECT COALESCE(jsonb_agg(notificacion_id ORDER BY notificacion_id), '[]'::jsonb) INTO v_ids FROM tomados;

    SELECT count(*) INTO v_quedan FROM public.notif_lote_cola
     WHERE envio_id = p_envio AND tomado_at IS NULL;

    RETURN jsonb_build_object('ok', true, 'ids', v_ids, 'quedan', v_quedan);
END;
$fn$;


-- ── Los que ya se procesaron salen de la cola ───────────────────────────────
-- Cuando no queda ninguno, el lote queda terminado.
CREATE OR REPLACE FUNCTION public.notif_lote_hechos(p_envio uuid, p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_quedan integer;
    v_total integer;
BEGIN
    DELETE FROM public.notif_lote_cola
     WHERE envio_id = p_envio AND notificacion_id = ANY (COALESCE(p_ids, '{}'));

    SELECT count(*) FILTER (WHERE tomado_at IS NULL), count(*)
      INTO v_quedan, v_total
      FROM public.notif_lote_cola WHERE envio_id = p_envio;

    IF v_total = 0 THEN
        UPDATE public.notif_lotes SET terminado_at = COALESCE(terminado_at, now())
         WHERE envio_id = p_envio;
    END IF;

    RETURN jsonb_build_object('ok', true, 'quedan', v_quedan);
END;
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 7 · LA EMISIÓN Y EL RELOJ                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Emitir un horario ya reservado ──────────────────────────────────────────
-- Crea los avisos de una sola vez (uno por persona, con alerta_clave y
-- envio_id), arma la cola con los que tienen dispositivo y pide UN lote.
-- Más personas que el tope: no emite nada y lo deja anotado.
CREATE OR REPLACE FUNCTION public.notif_programada_emitir(p_hecha uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_h record;
    v_a record;
    v_ids uuid[];
    v_n integer;
    v_envio uuid;
    v_push integer;
    v_url text;
BEGIN
    SELECT * INTO v_h FROM public.notif_programadas_hechas WHERE id = p_hecha;
    SELECT * INTO v_a FROM public.notif_alertas WHERE id = v_h.alerta_id;

    SELECT array_agg(x.user_id) INTO v_ids
      FROM public.notif_audiencia(v_a.audiencia_todos, v_a.audiencia_roles, v_a.audiencia_usuarios) x;
    v_n := COALESCE(cardinality(v_ids), 0);

    IF v_n = 0 THEN
        UPDATE public.notif_programadas_hechas SET resultado = 'sin_audiencia', personas = 0, con_push = 0
         WHERE id = p_hecha;
        RETURN jsonb_build_object('resultado', 'sin_audiencia', 'personas', 0);
    END IF;

    IF v_n > public.notif_tope_por_emision() THEN
        RAISE WARNING '[notif] % iba a % personas (tope %): no se emitió', v_a.clave, v_n, public.notif_tope_por_emision();
        UPDATE public.notif_programadas_hechas SET resultado = 'excedida', personas = v_n
         WHERE id = p_hecha;
        RETURN jsonb_build_object('resultado', 'excedida', 'personas', v_n);
    END IF;

    v_envio := gen_random_uuid();
    v_url := CASE WHEN public.notif_url_interna(v_a.url_plantilla) THEN v_a.url_plantilla END;

    INSERT INTO public.notif_lotes (envio_id, alerta_clave, personas) VALUES (v_envio, v_a.clave, v_n);

    WITH nuevos AS (
        INSERT INTO public.app_notifications (user_id, title, message, type, action_url, alerta_clave, envio_id)
        SELECT x, v_a.titulo_plantilla, v_a.mensaje_plantilla, 'PROGRAMADA', v_url, v_a.clave, v_envio
          FROM unnest(v_ids) x
        RETURNING id, user_id
    ), encolados AS (
        INSERT INTO public.notif_lote_cola (notificacion_id, envio_id)
        SELECT n.id, v_envio FROM nuevos n
         WHERE EXISTS (SELECT 1 FROM public.push_suscripciones p WHERE p.user_id = n.user_id)
        RETURNING 1
    )
    SELECT count(*) INTO v_push FROM encolados;

    UPDATE public.notif_lotes SET con_push = v_push,
                                  terminado_at = CASE WHEN v_push = 0 THEN now() END
     WHERE envio_id = v_envio;
    UPDATE public.notif_programadas_hechas
       SET resultado = 'emitida', envio_id = v_envio, personas = v_n, con_push = v_push
     WHERE id = p_hecha;

    -- Un solo pedido a send-push por emisión, y ninguno si nadie tiene
    -- dispositivo (no habría a quién mandarle).
    IF v_push > 0 THEN
        PERFORM public.notif_lote_encolar(v_envio);
    END IF;

    RETURN jsonb_build_object('resultado', 'emitida', 'envio_id', v_envio, 'personas', v_n, 'con_push', v_push);
END;
$fn$;


-- ── El reloj ────────────────────────────────────────────────────────────────
-- Para cada programada activa, no eliminada y que sale hoy (hora argentina),
-- cada horario ya cumplido que no esté en notif_programadas_hechas se reserva
-- y se emite. Si el cron estuvo caído, salen los atrasados DE HOY, una vez;
-- los de días anteriores no salen nunca (sólo se mira hoy).
--
-- p_ahora es para probar sin esperar. La gracia de 10 minutos sobre
-- reloj_desde es para que editar a las 10:02 no se coma el horario de las
-- 10:00 que el cron todavía no mandó.
CREATE OR REPLACE FUNCTION public.notif_programadas_tick(p_ahora timestamptz DEFAULT now())
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    v_local timestamp := p_ahora AT TIME ZONE ZONA;
    v_hoy date := v_local::date;
    v_hora time := v_local::time;
    v_a record;
    v_h time;
    v_inst timestamptz;
    v_hecha uuid;
    v_res jsonb;
    v_salidas jsonb := '[]'::jsonb;
    v_e record;
    v_relanzados integer := 0;
BEGIN
    FOR v_a IN
        SELECT id, clave, horas, reloj_desde
          FROM public.notif_alertas
         WHERE tipo = 'programada'
           AND activa
           AND eliminada_at IS NULL
           AND public.notif_programada_sale_el(v_hoy, desde, hasta, siempre_activa, cada_n_dias)
         ORDER BY created_at
    LOOP
        FOR v_h IN SELECT h FROM unnest(v_a.horas) h WHERE h <= v_hora ORDER BY h LOOP
            v_inst := (v_hoy + v_h) AT TIME ZONE ZONA;
            CONTINUE WHEN v_a.reloj_desde IS NOT NULL AND v_inst < v_a.reloj_desde - interval '10 minutes';

            BEGIN
                v_hecha := NULL;
                INSERT INTO public.notif_programadas_hechas (alerta_id, fecha, hora)
                VALUES (v_a.id, v_hoy, v_h)
                ON CONFLICT (alerta_id, fecha, hora) DO NOTHING
                RETURNING id INTO v_hecha;

                IF v_hecha IS NOT NULL THEN
                    v_res := public.notif_programada_emitir(v_hecha);
                    v_salidas := v_salidas || jsonb_build_object(
                        'clave', v_a.clave, 'hora', to_char(v_h, 'HH24:MI')) || v_res;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- Se deshace también la reserva: el horario se reintenta en la
                -- próxima vuelta (siempre del mismo día).
                RAISE WARNING '[notif] no se pudo emitir % de las %: %', v_a.clave, v_h, SQLERRM;
            END;
        END LOOP;
    END LOOP;

    -- Lotes trabados: quedan avisos y hace 10 minutos que nadie los toca.
    FOR v_e IN
        SELECT l.envio_id
          FROM public.notif_lotes l
         WHERE l.terminado_at IS NULL
           AND COALESCE(l.ultimo_pedido_at, l.creado_at) < now() - interval '10 minutes'
           AND EXISTS (SELECT 1 FROM public.notif_lote_cola c WHERE c.envio_id = l.envio_id)
    LOOP
        IF public.notif_lote_encolar(v_e.envio_id) THEN
            v_relanzados := v_relanzados + 1;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('ok', true, 'emitidas', v_salidas, 'relanzados', v_relanzados);
END;
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 8 · LAS RPC DE LA PANTALLA (sólo SUPER_ADMIN)                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

-- ── Crear o editar una programada ───────────────────────────────────────────
-- El id lo genera el cliente: mandar dos veces lo mismo (un doble toque, un
-- reintento) deja una sola programada.
CREATE OR REPLACE FUNCTION public.notif_guardar_programada(
    p_id                 uuid,
    p_nombre             text,
    p_titulo             text,
    p_mensaje            text,
    p_url                text,
    p_siempre_activa     boolean,
    p_desde              date,
    p_hasta              date,
    p_cada_n_dias        integer,
    p_horas              time[],
    p_audiencia_todos    boolean,
    p_audiencia_roles    text[],
    p_audiencia_usuarios uuid[],
    p_no_molestar        boolean DEFAULT false,
    p_nm_desde           time DEFAULT NULL,
    p_nm_hasta           time DEFAULT NULL,
    p_max_por_dia        integer DEFAULT NULL,
    p_activa             boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    ZONA constant text := 'America/Argentina/Buenos_Aires';
    v_uid     uuid := auth.uid();
    v_id      uuid := COALESCE(p_id, gen_random_uuid());
    v_nombre  text := btrim(COALESCE(p_nombre, ''));
    v_titulo  text := btrim(COALESCE(p_titulo, ''));
    v_mensaje text := btrim(COALESCE(p_mensaje, ''));
    v_url     text := NULLIF(btrim(COALESCE(p_url, '')), '');
    v_siempre boolean := COALESCE(p_siempre_activa, true);
    v_desde   date := COALESCE(p_desde, (now() AT TIME ZONE ZONA)::date);
    v_hasta   date := CASE WHEN COALESCE(p_siempre_activa, true) THEN NULL ELSE p_hasta END;
    v_todos   boolean := COALESCE(p_audiencia_todos, false);
    v_roles   text[];
    v_users   uuid[];
    v_horas   time[];
    v_malos   text[];
    v_malos_u uuid[];
    v_nm      boolean := COALESCE(p_no_molestar, false);
    v_activa  boolean := COALESCE(p_activa, true);
    v_actual  record;
    v_clave   text;
BEGIN
    IF v_uid IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    -- ── El texto ──
    IF length(v_nombre) NOT BETWEEN 1 AND 120 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido', 'campo', 'nombre');
    END IF;
    IF length(v_titulo) NOT BETWEEN 1 AND 60 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido', 'campo', 'titulo');
    END IF;
    IF length(v_mensaje) NOT BETWEEN 1 AND 160 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'texto_invalido', 'campo', 'mensaje');
    END IF;
    -- Texto fijo: una programada no tiene de dónde sacar un {nombre}.
    IF (v_titulo || ' ' || v_mensaje) ~ '\{[^{}]*\}' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'variable_invalida');
    END IF;
    IF v_url IS NOT NULL AND NOT public.notif_url_interna(v_url) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'url_invalida');
    END IF;

    -- ── La programación ──
    IF NOT v_siempre AND (v_hasta IS NULL OR v_hasta < v_desde) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'fechas_invalidas');
    END IF;
    IF p_cada_n_dias IS NULL OR p_cada_n_dias NOT BETWEEN 1 AND 365 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'frecuencia_invalida');
    END IF;
    -- Al minuto: "10:00:30" es "10:00". Así dos horarios del mismo minuto
    -- cuentan como repetidos.
    SELECT array_agg(make_time(extract(hour FROM h)::int, extract(minute FROM h)::int, 0) ORDER BY h)
      INTO v_horas FROM unnest(p_horas) h;
    IF v_horas IS NULL OR cardinality(v_horas) NOT BETWEEN 1 AND 5 OR array_position(v_horas, NULL) IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'horas_invalidas');
    END IF;
    IF NOT public.notif_horas_ok(v_horas) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'horas_repetidas');
    END IF;

    -- ── La audiencia ──
    IF NOT v_todos THEN
        SELECT array_agg(DISTINCT btrim(r)) INTO v_roles
          FROM unnest(COALESCE(p_audiencia_roles, '{}')) r WHERE btrim(COALESCE(r, '')) <> '';
        SELECT array_agg(DISTINCT u) INTO v_users
          FROM unnest(COALESCE(p_audiencia_usuarios, '{}')) u WHERE u IS NOT NULL;
    END IF;
    IF NOT v_todos AND v_roles IS NULL AND v_users IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'audiencia_vacia');
    END IF;
    SELECT array_agg(r) INTO v_malos FROM unnest(COALESCE(v_roles, '{}')) r
     WHERE NOT (r = ANY (public.notif_roles_validos()));
    IF v_malos IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'rol_invalido', 'roles', v_malos);
    END IF;
    SELECT array_agg(u) INTO v_malos_u FROM unnest(COALESCE(v_users, '{}')) u
     WHERE NOT EXISTS (SELECT 1 FROM public.users x WHERE x.id = u);
    IF v_malos_u IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'usuario_invalido', 'usuarios', v_malos_u);
    END IF;

    -- ── No molestar y tope (las mismas reglas que las automáticas) ──
    IF p_max_por_dia IS NOT NULL AND p_max_por_dia NOT BETWEEN 1 AND 20 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'tope_invalido');
    END IF;
    IF v_nm AND (p_nm_desde IS NULL OR p_nm_hasta IS NULL OR p_nm_desde = p_nm_hasta) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'horario_invalido');
    END IF;

    -- ── Crear o editar ──
    SELECT * INTO v_actual FROM public.notif_alertas WHERE id = v_id FOR UPDATE;

    IF FOUND AND v_actual.tipo <> 'programada' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_es_programada');
    END IF;
    IF FOUND AND v_actual.eliminada_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'eliminada');
    END IF;

    IF NOT FOUND THEN
        v_clave := 'prog_' || left(replace(v_id::text, '-', ''), 12);
        IF EXISTS (SELECT 1 FROM public.notif_alertas WHERE clave = v_clave) THEN
            v_clave := 'prog_' || replace(v_id::text, '-', '');
        END IF;

        BEGIN
            INSERT INTO public.notif_alertas (
                id, clave, tipo, nombre, variables, titulo_plantilla, mensaje_plantilla,
                url_plantilla, type_legacy, activa, no_molestar, no_molestar_desde,
                no_molestar_hasta, max_por_dia, siempre_activa, desde, hasta, cada_n_dias,
                horas, audiencia_todos, audiencia_roles, audiencia_usuarios, reloj_desde,
                created_by)
            VALUES (
                v_id, v_clave, 'programada', v_nombre, '{}', v_titulo, v_mensaje,
                v_url, 'PROGRAMADA', v_activa, v_nm,
                CASE WHEN v_nm THEN p_nm_desde END, CASE WHEN v_nm THEN p_nm_hasta END,
                p_max_por_dia, v_siempre, v_desde, v_hasta, p_cada_n_dias,
                v_horas, v_todos, COALESCE(v_roles, '{}'), COALESCE(v_users, '{}'), now(),
                v_uid);
        EXCEPTION WHEN unique_violation THEN
            -- Otro pedido con el mismo id ganó la carrera: ya está creada.
            RETURN jsonb_build_object('ok', true, 'id', v_id, 'creada', false);
        END;

        RETURN jsonb_build_object('ok', true, 'id', v_id, 'clave', v_clave, 'creada', true);
    END IF;

    UPDATE public.notif_alertas
       SET nombre             = v_nombre,
           titulo_plantilla   = v_titulo,
           mensaje_plantilla  = v_mensaje,
           url_plantilla      = v_url,
           activa             = v_activa,
           no_molestar        = v_nm,
           no_molestar_desde  = CASE WHEN v_nm THEN p_nm_desde END,
           no_molestar_hasta  = CASE WHEN v_nm THEN p_nm_hasta END,
           max_por_dia        = p_max_por_dia,
           siempre_activa     = v_siempre,
           desde              = v_desde,
           hasta              = v_hasta,
           cada_n_dias        = p_cada_n_dias,
           horas              = v_horas,
           audiencia_todos    = v_todos,
           audiencia_roles    = COALESCE(v_roles, '{}'),
           audiencia_usuarios = COALESCE(v_users, '{}'),
           -- El reloj vuelve a contar si se activó o si cambió cuándo sale.
           reloj_desde = CASE
               WHEN (v_activa AND NOT v_actual.activa)
                 OR v_siempre IS DISTINCT FROM v_actual.siempre_activa
                 OR v_desde IS DISTINCT FROM v_actual.desde
                 OR v_hasta IS DISTINCT FROM v_actual.hasta
                 OR p_cada_n_dias IS DISTINCT FROM v_actual.cada_n_dias
                 OR v_horas IS DISTINCT FROM v_actual.horas
               THEN now() ELSE v_actual.reloj_desde END,
           updated_at = now(),
           updated_by = v_uid
     WHERE id = v_id;

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'clave', v_actual.clave, 'creada', false);
END;
$fn$;


-- ── Pausar o activar cualquier alerta ───────────────────────────────────────
-- Automáticas: pausada = no sale push (el aviso queda en la campanita).
-- Programadas: pausada = no se emite nada.
CREATE OR REPLACE FUNCTION public.notif_cambiar_estado(p_id uuid, p_activa boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
    v_a record;
BEGIN
    IF v_uid IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;
    IF p_activa IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'estado_invalido');
    END IF;

    SELECT * INTO v_a FROM public.notif_alertas WHERE id = p_id AND eliminada_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;

    IF v_a.activa IS DISTINCT FROM p_activa THEN
        UPDATE public.notif_alertas
           SET activa = p_activa,
               reloj_desde = CASE WHEN tipo = 'programada' AND p_activa THEN now() ELSE reloj_desde END,
               updated_at = now(),
               updated_by = v_uid
         WHERE id = p_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'activa', p_activa);
END;
$fn$;


-- ── Eliminar una programada (baja lógica) ───────────────────────────────────
-- También la pausa: los push que hubieran quedado diferidos o en un lote a
-- medio mandar ya no salen (notif_puede_enviar contesta "pausada").
CREATE OR REPLACE FUNCTION public.notif_eliminar_programada(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_uid uuid := auth.uid();
    v_a record;
BEGIN
    IF v_uid IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    SELECT * INTO v_a FROM public.notif_alertas WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR v_a.eliminada_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe');
    END IF;
    IF v_a.tipo <> 'programada' THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_eliminable');
    END IF;

    UPDATE public.notif_alertas
       SET eliminada_at = now(), eliminada_por = v_uid,
           activa = false, updated_at = now(), updated_by = v_uid
     WHERE id = p_id;

    RETURN jsonb_build_object('ok', true);
END;
$fn$;


-- ── "Le llega a aprox. N personas · M tienen las notificaciones activadas" ──
CREATE OR REPLACE FUNCTION public.notif_estimar_audiencia(p_todos boolean, p_roles text[], p_usuarios uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
    v_personas integer;
    v_push integer;
BEGIN
    IF auth.uid() IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    SELECT count(*), count(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM public.push_suscripciones p WHERE p.user_id = x.user_id))
      INTO v_personas, v_push
      FROM public.notif_audiencia(p_todos, p_roles, p_usuarios) x;

    RETURN jsonb_build_object('ok', true, 'personas', v_personas, 'con_push', v_push,
                              'tope', public.notif_tope_por_emision());
END;
$fn$;


-- ── Los roles para los chips, con cuántas personas activas tiene cada uno ───
CREATE OR REPLACE FUNCTION public.notif_roles_disponibles()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
    IF auth.uid() IS NULL OR NOT public.tiene_rol(ARRAY['SUPER_ADMIN']) THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    END IF;

    RETURN jsonb_build_object('ok', true, 'roles', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('rol', t.rol, 'personas', t.n) ORDER BY t.n DESC, t.rol)
          FROM (SELECT r AS rol,
                       (SELECT count(*) FROM public.users u
                         WHERE u.is_active IS NOT FALSE
                           AND ((u.role)::text = r OR COALESCE(u.roles, '{}') @> ARRAY[r])) AS n
                  FROM unnest(public.notif_roles_validos()) r) t
         WHERE t.n > 0), '[]'::jsonb));
END;
$fn$;


-- ── El listado, sin las eliminadas y con lo que necesita cada programada ────
-- Mismas claves que antes (las automáticas no cambian) más, en las
-- programadas: alcance, alcance_detalle, audiencia_personas,
-- audiencia_con_push, audiencia_detalle (nombre de las personas elegidas) y
-- proximo_envio.
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
            ) || CASE WHEN a.tipo = 'programada' THEN (
                SELECT jsonb_build_object(
                    'alcance', al->>'alcance',
                    'alcance_detalle', al - 'alcance',
                    'audiencia_personas', au.personas,
                    'audiencia_con_push', au.con_push,
                    'audiencia_detalle', COALESCE((
                        SELECT jsonb_agg(jsonb_build_object('id', u.id, 'nombre', u.name,
                                                            'activa', u.is_active IS NOT FALSE)
                                         ORDER BY lower(COALESCE(u.name, '')))
                          FROM public.users u WHERE u.id = ANY (COALESCE(a.audiencia_usuarios, '{}'))), '[]'::jsonb),
                    'proximo_envio', public.notif_proximo_envio(a.id))
                  FROM public.notif_alcance_programada(a.cada_n_dias, a.horas, a.siempre_activa, a.desde, a.hasta) al,
                       LATERAL (SELECT count(*) AS personas,
                                       count(*) FILTER (WHERE EXISTS (
                                           SELECT 1 FROM public.push_suscripciones p WHERE p.user_id = x.user_id)) AS con_push
                                  FROM public.notif_audiencia(a.audiencia_todos, a.audiencia_roles, a.audiencia_usuarios) x) au
            ) ELSE '{}'::jsonb END
            ORDER BY a.tipo, a.nombre)
            FROM public.notif_alertas a
           WHERE a.eliminada_at IS NULL
        ), '[]'::jsonb));
END;
$fn$;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 9 · EL CRON DEL RELOJ                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- Cada 5 minutos. Corre SQL directo (no un pedido HTTP): la clave de Vault la
-- usa notif_lote_encolar() recién cuando hay algo que mandar.
SELECT cron.unschedule('notif-programadas')
 WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notif-programadas');

SELECT cron.schedule(
    'notif-programadas',
    '*/5 * * * *',
    $cron$ SELECT public.notif_programadas_tick(); $cron$
);


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║ 10 · PERMISOS                                                            ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
-- CREATE OR REPLACE vuelve a darle EXECUTE a PUBLIC (sección 12, regla 3).

-- Internas: sólo la base.
REVOKE ALL ON FUNCTION public.notif_horas_ok(time[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_audiencia(boolean, text[], uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_roles_validos() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_tope_por_emision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_alcance_programada(integer, time[], boolean, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_programada_sale_el(date, date, date, boolean, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_proximo_envio(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_programada_emitir(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_programadas_tick(timestamptz) FROM PUBLIC, anon, authenticated;

-- El lote: send-push con la clave de servicio.
REVOKE ALL ON FUNCTION public.notif_lote_encolar(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_lote_tomar(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notif_lote_hechos(uuid, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notif_lote_encolar(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.notif_lote_tomar(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.notif_lote_hechos(uuid, uuid[]) TO service_role;

-- Las tablas nuevas: sólo por RPC y por la clave de servicio.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_programadas_hechas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_lotes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notif_lote_cola TO service_role;

-- Las de la pantalla de Sistemas: el rol se chequea adentro.
REVOKE ALL ON FUNCTION public.notif_guardar_programada(uuid, text, text, text, text, boolean, date, date, integer, time[], boolean, text[], uuid[], boolean, time, time, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_guardar_programada(uuid, text, text, text, text, boolean, date, date, integer, time[], boolean, text[], uuid[], boolean, time, time, integer, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.notif_cambiar_estado(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_cambiar_estado(uuid, boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.notif_eliminar_programada(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_eliminar_programada(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.notif_estimar_audiencia(boolean, text[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_estimar_audiencia(boolean, text[], uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.notif_roles_disponibles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_roles_disponibles() TO authenticated;
REVOKE ALL ON FUNCTION public.notif_alertas_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notif_alertas_admin() TO authenticated;


-- ── Comentarios ─────────────────────────────────────────────────────────────
COMMENT ON FUNCTION public.notif_programadas_tick(timestamptz) IS
    'El reloj de las programadas (cron notif-programadas, cada 5 min). Emite los horarios de hoy ya cumplidos que no estén en notif_programadas_hechas, una vez cada uno; los de días anteriores nunca. Relanza lotes trabados. p_ahora es para probar.';
COMMENT ON FUNCTION public.notif_programada_emitir(uuid) IS
    'Emite un horario reservado: un aviso por persona con envio_id, la cola con los que tienen dispositivo y UN pedido a send-push {modo:lote}. Más personas que notif_tope_por_emision(): no emite y lo anota.';
COMMENT ON FUNCTION public.notif_guardar_programada(uuid, text, text, text, text, boolean, date, date, integer, time[], boolean, text[], uuid[], boolean, time, time, integer, boolean) IS
    'Crea (con el id del cliente: idempotente) o edita una programada. Texto fijo (sin {variables}), título ≤ 60, mensaje ≤ 160, ruta interna, 1 a 5 horarios sin repetir, roles y personas que existan. Sólo SUPER_ADMIN.';
COMMENT ON FUNCTION public.notif_cambiar_estado(uuid, boolean) IS
    'Pausa o activa cualquier alerta no eliminada. Sólo SUPER_ADMIN.';
COMMENT ON FUNCTION public.notif_eliminar_programada(uuid) IS
    'Baja lógica de una programada (también la pausa). En una automática devuelve no_eliminable. Sólo SUPER_ADMIN.';
COMMENT ON FUNCTION public.notif_estimar_audiencia(boolean, text[], uuid[]) IS
    'Cuántas personas activas recibirían una programada y cuántas tienen push. Es la misma cuenta que usa la emisión. Sólo SUPER_ADMIN.';
COMMENT ON FUNCTION public.notif_roles_disponibles() IS
    'Los roles (del enum y los cargados en users.roles) con cuántas personas activas tiene cada uno; sólo los que tienen alguna. Sólo SUPER_ADMIN.';
COMMENT ON FUNCTION public.notif_lote_tomar(uuid, integer) IS
    'send-push: toma y reserva hasta p_tope avisos de un lote (SKIP LOCKED; una reserva de más de 10 min se puede retomar si no está en el log).';
COMMENT ON FUNCTION public.notif_lote_hechos(uuid, uuid[]) IS
    'send-push: saca de la cola los avisos ya procesados; sin cola, el lote queda terminado.';
COMMENT ON FUNCTION public.notif_lote_encolar(uuid) IS
    'Pide a send-push {modo:lote} con la clave de Vault (pg_net: sale al confirmar la transacción).';
COMMENT ON FUNCTION public.notif_alertas_admin() IS
    'El catálogo para la pantalla de Sistemas, sin las eliminadas; en las programadas suma alcance, personas y próximo envío. Sólo SUPER_ADMIN.';

-- ════════════════════════════════════════════════════════════════════════════
-- ✅ APLICADO el 2026-10-27.
--
-- El aviso "Tu solicitud a <Dep> fue aceptada / no fue aceptada" lleva a
-- /perfil/solicitudes (Mi cuenta → Solicitudes), donde quien pidió ve en qué
-- quedó. Antes llevaba a /solicitudes, que es el formulario para pedir otra
-- cosa: desde que existe /perfil/solicitudes, ése es el lugar.
--
-- Es la misma función de sql/agenda_avisos.sql, sacada de la base con
-- pg_get_functiondef: sólo cambia ese link. Las notificaciones viejas no se
-- tocan (al aplicarlo no había ninguna).
-- Deshacer: el mismo CREATE OR REPLACE con '/solicitudes'.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.agenda_solicitudes_avisar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_dep text;
    v_quien text;
BEGIN
    SELECT nombre INTO v_dep FROM public.agenda_departamentos WHERE id = NEW.departamento_id;

    IF TG_OP = 'INSERT' THEN
        SELECT NULLIF(btrim(COALESCE(name, '')), '') INTO v_quien FROM public.users WHERE id = NEW.solicitante_id;
        -- A cada encargado. Si quien la pide es encargado de ese mismo
        -- departamento, a él no: ya sabe lo que pidió.
        INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
        SELECT e.user_id,
               'Solicitud nueva para ' || COALESCE(v_dep, 'tu departamento'),
               COALESCE(v_quien, 'Alguien de la iglesia') || ' · '
                   || left(btrim(regexp_replace(NEW.detalles, '\s+', ' ', 'g')), 90),
               'AGENDA_SOLICITUD_NUEVA',
               '/departamentos/' || NEW.departamento_id || '?tab=solicitudes'
          FROM public.agenda_departamento_encargados e
         WHERE e.departamento_id = NEW.departamento_id
           AND e.user_id IS DISTINCT FROM NEW.solicitante_id;

    ELSIF OLD.estado = 'nueva' AND NEW.estado IN ('aceptada', 'rechazada')
          AND NEW.solicitante_id IS NOT NULL
          AND NEW.solicitante_id IS DISTINCT FROM NEW.revisada_por THEN
        INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
        VALUES (
            NEW.solicitante_id,
            CASE NEW.estado
                WHEN 'aceptada' THEN 'Tu solicitud a ' || COALESCE(v_dep, 'el departamento') || ' fue aceptada'
                ELSE 'Tu solicitud a ' || COALESCE(v_dep, 'el departamento') || ' no fue aceptada'
            END,
            CASE NEW.estado
                WHEN 'aceptada' THEN 'El equipo ya la tiene en cuenta para organizarla. ¡Gracias por escribir!'
                ELSE 'Esta vez no la pueden tomar. Gracias por escribirles.'
            END,
            'AGENDA_SOLICITUD_REVISADA',
            '/perfil/solicitudes'
        );
    END IF;
    RETURN NULL;
END;
$function$;

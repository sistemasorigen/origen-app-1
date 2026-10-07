-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — el adulto responsable ya no se acredita
-- 2026-10-07
--
-- En la puerta se acredita SÓLO a los adolescentes. El adulto los deja y se
-- va; a las 6 AM vuelve quien figure en el retiro, que es otro momento y otro
-- dato (nocturna_jovenes.retiro_*).
--
-- Qué cambia en esta función:
--   · La regla de estados válidos pasa de "nadie, o el adulto y al menos un
--     adolescente" a "nadie, o al menos un adolescente".
--   · `aprobado_at` deja de mirar `adulto_acreditado_at`.
--
-- Qué NO cambia, a propósito:
--   · La firma. El frontend publicado sigue llamando con los mismos seis
--     argumentos.
--   · `p_adulto`: si llega en true se sigue guardando. El frontend de hoy
--     todavía lo manda, y si dejara de guardarse de golpe, la puerta
--     mostraría al adulto sin marcar para siempre. Cuando salga el frontend
--     nuevo deja de mandarse y la columna se queda en NULL.
--   · La columna `adulto_acreditado_at` no se borra: es dato de lo que pasó.
--   · Los QR no se tocan. El QR lleva el id de la inscripción y lo resuelve
--     `get_nocturna_para_acreditar`, que no cambia.
--
-- Al aplicarlo no hay nadie acreditado todavía (el evento es el 30/10), así
-- que no hay estado viejo que arreglar.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.set_nocturna_acreditacion(p_inscripcion_id uuid, p_adulto boolean, p_jovenes uuid[], p_modo text DEFAULT 'exacto'::text, p_visto_adulto boolean DEFAULT NULL::boolean, p_visto_jovenes uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_i             public.nocturna_inscripciones%ROWTYPE;
    v_lista         UUID[] := COALESCE(p_jovenes, ARRAY[]::UUID[]);
    v_ajenos        INTEGER;
    v_adulto_ahora  BOOLEAN;
    v_chicos_ahora  UUID[];
    v_chicos_vistos UUID[];
    v_adulto_final  BOOLEAN;
    v_chicos_final  UUID[];
    v_marcados      INTEGER;
BEGIN
    IF NOT public.is_nocturna_staff() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No tenés permisos para acreditar.');
    END IF;

    IF COALESCE(p_modo, 'exacto') NOT IN ('exacto', 'sumar') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Modo de acreditación desconocido.');
    END IF;

    SELECT * INTO v_i FROM public.nocturna_inscripciones WHERE id = p_inscripcion_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Esta entrada no existe o fue eliminada.');
    END IF;

    -- Ningún id ajeno a esta inscripción.
    SELECT count(*) INTO v_ajenos
    FROM unnest(v_lista) AS u
    WHERE NOT EXISTS (
        SELECT 1 FROM public.nocturna_jovenes j
        WHERE j.id = u AND j.inscripcion_id = p_inscripcion_id
    );
    IF v_ajenos > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Alguno de los adolescentes no pertenece a esta entrada.');
    END IF;

    -- ── El estado que hay ahora ─────────────────────────────────────────────
    v_adulto_ahora := v_i.adulto_acreditado_at IS NOT NULL;
    v_chicos_ahora := ARRAY(
        SELECT j.id FROM public.nocturna_jovenes j
        WHERE j.inscripcion_id = p_inscripcion_id AND j.acreditado_at IS NOT NULL
        ORDER BY j.id
    );

    -- ── ¿Cambió desde que el cliente miró? ──────────────────────────────────
    -- Se comparan conjuntos y no relojes: sin depender de la hora del celular,
    -- y detecta tanto un ingreso nuevo como uno que alguien borró.
    IF p_modo = 'exacto' AND p_visto_adulto IS NOT NULL THEN
        v_chicos_vistos := ARRAY(
            SELECT DISTINCT u FROM unnest(COALESCE(p_visto_jovenes, ARRAY[]::UUID[])) AS u ORDER BY u
        );

        IF v_adulto_ahora <> p_visto_adulto OR v_chicos_ahora <> v_chicos_vistos THEN
            RETURN jsonb_build_object(
                'ok', false,
                'motivo', 'cambio',
                'error', 'Alguien registró el ingreso de esta familia mientras tenías la ficha abierta. Mirá cómo quedó antes de guardar.',
                -- El estado de verdad viaja con el rechazo: la pantalla se
                -- actualiza sin tener que volver a preguntar.
                'estado', public.get_nocturna_para_acreditar(p_inscripcion_id)
            );
        END IF;
    END IF;

    -- ── El estado que va a quedar ───────────────────────────────────────────
    -- El modo decide el objetivo; de ahí para abajo hay un solo camino de
    -- escritura. En `sumar` el objetivo incluye lo que ya estaba, así que el
    -- ELSE NULL de abajo no borra nada.
    IF p_modo = 'sumar' THEN
        v_adulto_final := (p_adulto IS TRUE) OR v_adulto_ahora;
        v_chicos_final := ARRAY(
            SELECT DISTINCT u FROM unnest(v_chicos_ahora || v_lista) AS u ORDER BY u
        );
    ELSE
        v_adulto_final := p_adulto IS TRUE;
        v_chicos_final := ARRAY(SELECT DISTINCT u FROM unnest(v_lista) AS u ORDER BY u);
    END IF;

    -- Estados válidos: nadie adentro, o al menos un adolescente.
    --
    -- Hasta el 2026-10-07 el adulto era obligatorio: un adolescente acreditado
    -- sin su adulto se rechazaba. En la puerta eso no se sostiene —el adulto
    -- deja a los chicos y se va, y a las 6 AM vuelve quien figure en el
    -- retiro—, así que ahora se acredita SÓLO a los adolescentes.
    --
    -- El adulto sigue pudiendo marcarse (p_adulto) y se guarda si llega en
    -- true: el frontend publicado todavía lo manda, y si dejara de guardarse
    -- de golpe, la pantalla de la puerta mostraría al adulto sin marcar para
    -- siempre. Lo que cambió es que ya no hace falta.
    IF cardinality(v_chicos_final) = 0 AND NOT v_adulto_final THEN
        NULL;                                   -- limpiar todo: válido
    ELSIF cardinality(v_chicos_final) >= 1 THEN
        NULL;                                   -- al menos un adolescente: válido
    ELSE
        RETURN jsonb_build_object('ok', false, 'error',
            'Marcá al menos un adolescente.');
    END IF;

    -- ── Escribir ────────────────────────────────────────────────────────────
    -- Las horas que ya estaban no se pisan: la familia que llega incompleta y
    -- se completa después conserva la hora de los primeros.
    UPDATE public.nocturna_inscripciones
    SET adulto_acreditado_at = CASE
            WHEN v_adulto_final THEN COALESCE(adulto_acreditado_at, now())
            ELSE NULL
        END
    WHERE id = p_inscripcion_id;

    UPDATE public.nocturna_jovenes j
    SET acreditado_at = CASE
            WHEN j.id = ANY (v_chicos_final) THEN COALESCE(j.acreditado_at, now())
            ELSE NULL
        END
    WHERE j.inscripcion_id = p_inscripcion_id;

    -- aprobado_at: se fija la primera vez que entra algún adolescente, y
    -- vuelve a NULL si se desmarca a todos. El adulto no cuenta.
    SELECT count(*) INTO v_marcados
    FROM public.nocturna_jovenes j
    WHERE j.inscripcion_id = p_inscripcion_id AND j.acreditado_at IS NOT NULL;

    UPDATE public.nocturna_inscripciones
    SET aprobado_at = CASE
            WHEN v_marcados >= 1 THEN COALESCE(aprobado_at, now())
            ELSE NULL
        END
    WHERE id = p_inscripcion_id;

    RETURN public.get_nocturna_para_acreditar(p_inscripcion_id);
END;
$function$
;


REVOKE EXECUTE ON FUNCTION public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[], TEXT, BOOLEAN, UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[], TEXT, BOOLEAN, UUID[]) FROM anon;
GRANT  EXECUTE ON FUNCTION public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[], TEXT, BOOLEAN, UUID[]) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

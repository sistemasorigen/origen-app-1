-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — que dos personas del staff no se pisen al acreditar
-- 2026-10-02
--
-- EL PROBLEMA
-- `set_nocturna_acreditacion` fija el estado EXACTO: los chicos que no están
-- en la lista quedan con `acreditado_at = NULL`. Eso es lo correcto para la
-- ficha, donde alguien mira la familia entera y desmarca a propósito. En la
-- puerta no: ahí hay dos celulares escaneando la misma fila.
--
-- Reproducido el 2026-10-02 contra esta misma base:
--   1. El staff A abre la familia: no entró nadie.
--   2. El staff B, en la puerta, acredita al adulto y a un chico.
--   3. El staff A, con la pantalla de hace dos minutos, marca a otro chico
--      y guarda.
--   → Los dos que ya habían entrado vuelven a NULL. La RPC devuelve ok:true.
--
-- A las 6 de la mañana eso es una familia que figura afuera estando adentro,
-- y nadie se entera hasta que falta alguien.
--
-- LA SOLUCIÓN — dos modos, porque son dos intenciones distintas
--
--   · `sumar`  — la puerta. Agrega y nunca borra. Dos escáneres con pantallas
--                viejas no pueden pisarse: lo peor que pasa es que uno vuelva
--                a marcar a quien ya estaba marcado, que no cambia nada
--                (el COALESCE conserva la hora original).
--
--   · `exacto` — la ficha. Sigue fijando el estado completo, pero ahora puede
--                decir QUÉ estado creía que había: si cambió desde que abrió
--                la pantalla, se rechaza el guardado y se devuelve el estado
--                de verdad para que lo vea antes de decidir.
--
-- Los parámetros nuevos tienen default, y los defaults son exactamente el
-- comportamiento de hoy. Un cliente viejo que llame con tres argumentos
-- —el frontend que está publicado ahora mismo— sigue funcionando igual.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Se borra la firma de tres argumentos antes de crear la nueva: si quedaran
-- las dos, PostgREST no sabría cuál elegir en una llamada de tres y devuelve
-- "Could not choose the best candidate function". Va en la misma transacción
-- para que no exista un instante sin función.
DROP FUNCTION IF EXISTS public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[]);

CREATE OR REPLACE FUNCTION public.set_nocturna_acreditacion(
    p_inscripcion_id UUID,
    p_adulto         BOOLEAN,
    p_jovenes        UUID[],
    -- 'exacto' (la ficha) o 'sumar' (la puerta).
    p_modo           TEXT    DEFAULT 'exacto',
    -- Lo que el cliente tenía en pantalla ANTES de tocar nada. Sólo lo manda
    -- la ficha. En NULL no se compara nada y se guarda como siempre.
    p_visto_adulto   BOOLEAN DEFAULT NULL,
    p_visto_jovenes  UUID[]  DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        RETURN jsonb_build_object('ok', false, 'error', 'Alguno de los chicos no pertenece a esta entrada.');
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

    -- Estados válidos: nadie adentro, o el adulto y al menos un chico. Un
    -- chico acreditado sin su adulto no es un estado real.
    IF NOT v_adulto_final AND cardinality(v_chicos_final) = 0 THEN
        NULL;                                   -- limpiar todo: válido
    ELSIF v_adulto_final AND cardinality(v_chicos_final) >= 1 THEN
        NULL;                                   -- adulto + al menos un chico: válido
    ELSIF v_adulto_final THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Marcá al menos un chico además del adulto.');
    ELSE
        RETURN jsonb_build_object('ok', false, 'error',
            'No se puede acreditar a un chico sin el adulto responsable.');
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

    -- aprobado_at: se fija la primera vez que el estado es "acreditado", y
    -- vuelve a NULL si se desmarca todo.
    SELECT count(*) INTO v_marcados
    FROM public.nocturna_jovenes j
    WHERE j.inscripcion_id = p_inscripcion_id AND j.acreditado_at IS NOT NULL;

    UPDATE public.nocturna_inscripciones
    SET aprobado_at = CASE
            WHEN adulto_acreditado_at IS NOT NULL AND v_marcados >= 1 THEN COALESCE(aprobado_at, now())
            ELSE NULL
        END
    WHERE id = p_inscripcion_id;

    RETURN public.get_nocturna_para_acreditar(p_inscripcion_id);
END;
$$;

-- CREATE OR REPLACE vuelve a otorgarle permiso a PUBLIC: hay que revocarlo de
-- nuevo, y de anon aparte, porque anon no hereda de PUBLIC en todos los casos.
REVOKE EXECUTE ON FUNCTION public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[], TEXT, BOOLEAN, UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[], TEXT, BOOLEAN, UUID[]) FROM anon;
GRANT  EXECUTE ON FUNCTION public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[], TEXT, BOOLEAN, UUID[]) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';


-- ════════════════════════════════════════════════════════════════════════════
-- Verificación
-- ════════════════════════════════════════════════════════════════════════════
-- SELECT p.oid::regprocedure AS firma, p.proacl::text
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'set_nocturna_acreditacion';
--
-- Tiene que haber UNA sola firma, la de seis argumentos.

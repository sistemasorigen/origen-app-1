-- ════════════════════════════════════════════════════════════════════════════
-- NOTIFICACIONES — una programada para un solo día
-- 2026-10-30 · ✅ APLICADO el 2026-10-30 (PROBAR_ 6/6 contra producción)
--
-- El editor suma, en "Cuándo se repite", la opción "Un solo día": guarda
-- desde = hasta = ese día, cada 1 día y sin "siempre activa". La base ya lo
-- acepta así (notif_guardar_programada pide hasta >= desde, y el reloj sale
-- ese día y ningún otro): no cambia nada de lo que se manda.
--
-- Lo único que cambia es cómo se LEE en la lista y en las preferencias: en
-- vez de "Todos los días · Del 30/10 al 30/10", "Un solo día · El 30/10".
-- notif_alcance_programada parte de la definición viva del 2026-10-30
-- (igual a sql/notif_programadas.sql); las únicas líneas nuevas son las del
-- caso desde = hasta.
--
-- Pruebas: sql/PROBAR_notif_un_solo_dia.sql
-- Deshacer: sql/ROLLBACK_notif_un_solo_dia.sql
-- ════════════════════════════════════════════════════════════════════════════

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
    -- Sale un solo día: con fecha de fin, y la misma que la de inicio.
    v_un_dia boolean := NOT COALESCE(p_siempre, false) AND p_desde IS NOT NULL AND p_hasta = p_desde;
BEGIN
    SELECT array_agg(to_char(h, 'HH24:MI') ORDER BY h) INTO v_horas FROM unnest(p_horas) h;

    v_frec := CASE
        WHEN v_un_dia THEN 'Un solo día'
        WHEN p_cada = 1 THEN 'Todos los días'
        ELSE 'Cada ' || p_cada || ' días'
    END;
    v_veces := v_n || CASE WHEN v_n = 1 THEN ' vez por día' ELSE ' veces por día' END;
    v_horario := CASE
        WHEN v_n = 0 THEN ''
        WHEN v_n = 1 THEN v_horas[1]
        ELSE array_to_string(v_horas[1:v_n - 1], ', ') || ' y ' || v_horas[v_n]
    END;
    v_vig := CASE
        WHEN p_siempre THEN 'Siempre activa'
        WHEN v_un_dia THEN 'El ' || to_char(p_desde, 'FMDD/FMMM')
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

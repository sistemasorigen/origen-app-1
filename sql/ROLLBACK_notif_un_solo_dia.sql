-- DESHACER sql/notif_un_solo_dia.sql (2026-10-30): vuelve notif_alcance_programada
-- a la definición viva de antes del cambio (igual a sql/notif_programadas.sql).

CREATE OR REPLACE FUNCTION public.notif_alcance_programada(p_cada integer, p_horas time without time zone[], p_siempre boolean, p_desde date, p_hasta date)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
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
$function$
;

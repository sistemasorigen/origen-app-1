-- ════════════════════════════════════════════════════════════════════════════
-- PRUEBA de sql/notif_un_solo_dia.sql
-- 2026-10-30
--
-- Sólo lee: la función es pura. Termina SIEMPRE en RAISE EXCEPTION, así que
-- si viaja junta con la migración (con un BEGIN adelante) también se deshace.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
    v_r     jsonb;
    v_mal   text[] := '{}';
    v_casos integer := 0;
begin
    -- 1 · Un solo día, una hora
    v_r := public.notif_alcance_programada(1, array['10:00']::time[], false, '2026-10-30', '2026-10-30');
    v_casos := v_casos + 1;
    if v_r->>'alcance' <> 'Un solo día · 1 vez por día' or v_r->>'vigencia' <> 'El 30/10'
       or v_r->>'horario' <> '10:00' then
        v_mal := v_mal || ('1 un día: ' || v_r::text);
    end if;

    -- 2 · Un solo día, dos horas (el "cada" no importa)
    v_r := public.notif_alcance_programada(7, array['18:00', '09:30']::time[], false, '2026-11-08', '2026-11-08');
    v_casos := v_casos + 1;
    if v_r->>'frecuencia' <> 'Un solo día' or v_r->>'veces' <> '2 veces por día'
       or v_r->>'horario' <> '09:30 y 18:00' or v_r->>'vigencia' <> 'El 8/11' then
        v_mal := v_mal || ('2 un día, dos horas: ' || v_r::text);
    end if;

    -- 3 · Lo de siempre no cambia
    v_r := public.notif_alcance_programada(1, array['10:00']::time[], false, '2026-10-29', '2026-10-30');
    v_casos := v_casos + 1;
    if v_r->>'alcance' <> 'Todos los días · 1 vez por día' or v_r->>'vigencia' <> 'Del 29/10 al 30/10' then
        v_mal := v_mal || ('3 rango: ' || v_r::text);
    end if;
    v_r := public.notif_alcance_programada(7, array['10:00']::time[], true, '2026-10-30', null);
    v_casos := v_casos + 1;
    if v_r->>'alcance' <> 'Cada 7 días · 1 vez por día' or v_r->>'vigencia' <> 'Siempre activa' then
        v_mal := v_mal || ('4 siempre: ' || v_r::text);
    end if;

    -- 5 · Siempre activa con una "hasta" vieja igual a desde: manda siempre
    v_r := public.notif_alcance_programada(1, array['10:00']::time[], true, '2026-10-30', '2026-10-30');
    v_casos := v_casos + 1;
    if v_r->>'vigencia' <> 'Siempre activa' or v_r->>'frecuencia' <> 'Todos los días' then
        v_mal := v_mal || ('5 siempre con hasta: ' || v_r::text);
    end if;

    -- 6 · Y la base lo manda ese día y ningún otro
    v_casos := v_casos + 1;
    if not public.notif_programada_sale_el('2026-10-30', '2026-10-30', '2026-10-30', false, 1)
       or public.notif_programada_sale_el('2026-10-31', '2026-10-30', '2026-10-30', false, 1)
       or public.notif_programada_sale_el('2026-10-29', '2026-10-30', '2026-10-30', false, 1) then
        v_mal := v_mal || '6 sale_el'::text;
    end if;

    if cardinality(v_mal) = 0 then
        raise exception 'RESULTADO ✅ % casos en verde (todo deshecho)', v_casos;
    else
        raise exception 'RESULTADO ❌ % de % fallaron: %', cardinality(v_mal), v_casos, array_to_string(v_mal, ' | ');
    end if;
end;
$$;

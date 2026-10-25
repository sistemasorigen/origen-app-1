-- ════════════════════════════════════════════════════════════════════════════
-- PRUEBA de sql/punto_remeras_servolucion.sql
-- 2026-10-25
--
-- Un solo bloque que termina SIEMPRE en RAISE EXCEPTION: todo se deshace
-- (la migración incluida, si viajó en el mismo pedido). El mensaje es el
-- resultado. Los productos que crea son SERVOLUCION-PRUEBA-*, y los precios
-- que toca vuelven a su lugar con el rollback.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
    v_staff   uuid;
    v_remera  numeric;
    v_p       numeric;
    v_r       jsonb;
    v_conteo  jsonb;
    v_mal     text[] := '{}';
    v_casos   integer := 0;
    v_stock   integer;
begin
    select price into v_remera from public.info_products where type = 'Remeras' limit 1;

    -- 1 · Un talle nuevo toma el precio de las remeras, aunque llegue con otro
    insert into public.info_products (code, name, type, size, price, stock, "minStock")
    values ('SERVOLUCION-PRUEBA-1', 'Remeras Servolución Talle 1', 'Remeras Servolución', '1', 1, 5, 1);
    select price into v_p from public.info_products where code = 'SERVOLUCION-PRUEBA-1';
    v_casos := v_casos + 1;
    if v_p is distinct from v_remera then v_mal := v_mal || ('1 precio al crear: ' || v_p || ' ≠ ' || v_remera); end if;

    -- 2 · Cambia el precio de las remeras (como "Precios" del panel): la
    --     Servolución lo sigue
    update public.info_products set price = 31234 where type = 'Remeras';
    select price into v_p from public.info_products where code = 'SERVOLUCION-PRUEBA-1';
    v_casos := v_casos + 1;
    if v_p <> 31234 then v_mal := v_mal || ('2 sigue a remeras: ' || v_p); end if;

    -- 3 · Los buzos no arrastran a nadie
    update public.info_products set price = 45678 where type = 'Buzos';
    select price into v_p from public.info_products where code = 'SERVOLUCION-PRUEBA-1';
    v_casos := v_casos + 1;
    if v_p <> 31234 then v_mal := v_mal || ('3 buzos la movieron: ' || v_p); end if;

    -- 4 · Reportar: "no conté las Servolución" se acepta y no la toca;
    --     un tipo inventado se sigue rechazando
    select u.id into v_staff from public.users u
    where coalesce(u.roles, array[]::text[]) && array['SUPER_ADMIN']::text[] or u.role::text = 'SUPER_ADMIN' limit 1;
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

    select coalesce(jsonb_agg(jsonb_build_object('code', code, 'cantidad', coalesce(stock, 0))), '[]'::jsonb)
      into v_conteo from public.info_products where type in ('Remeras', 'Buzos') and coalesce(stock, 0) > 0;
    v_r := public.registrar_reporte_stock(gen_random_uuid(), v_conteo, array['Remeras Servolución']);
    select stock into v_stock from public.info_products where code = 'SERVOLUCION-PRUEBA-1';
    v_casos := v_casos + 1;
    if not coalesce((v_r ->> 'ok')::boolean, true) or v_stock <> 5 then
        v_mal := v_mal || ('4 reportar sin contar servolución: ' || coalesce(v_r::text, 'null') || ' stock=' || v_stock);
    end if;

    v_casos := v_casos + 1;
    begin
        perform public.registrar_reporte_stock(gen_random_uuid(), v_conteo, array['Camperas']);
        v_mal := v_mal || '5 aceptó un tipo inventado'::text;
    exception when others then
        if sqlerrm not like 'conteo_invalido%' then v_mal := v_mal || ('5 error raro: ' || sqlerrm); end if;
    end;

    -- 6 · Reportar contando la Servolución: el stock queda en lo contado
    select coalesce(jsonb_agg(jsonb_build_object('code', code,
               'cantidad', case when code = 'SERVOLUCION-PRUEBA-1' then 2 else coalesce(stock, 0) end)), '[]'::jsonb)
      into v_conteo from public.info_products
     where coalesce(stock, 0) > 0 or code = 'SERVOLUCION-PRUEBA-1';
    v_r := public.registrar_reporte_stock(gen_random_uuid(), v_conteo, '{}');
    select stock into v_stock from public.info_products where code = 'SERVOLUCION-PRUEBA-1';
    v_casos := v_casos + 1;
    if v_stock <> 2 then v_mal := v_mal || ('6 reportar contando servolución: stock=' || v_stock); end if;

    if cardinality(v_mal) = 0 then
        raise exception 'RESULTADO ✅ % casos en verde (todo deshecho)', v_casos;
    else
        raise exception 'RESULTADO ❌ % de % fallaron: %', cardinality(v_mal), v_casos, array_to_string(v_mal, ' | ');
    end if;
end;
$$;

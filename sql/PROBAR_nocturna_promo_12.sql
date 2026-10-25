-- ════════════════════════════════════════════════════════════════════════════
-- PRUEBA de sql/nocturna_promo_12.sql
-- 2026-10-25
--
-- Un solo bloque que termina SIEMPRE en RAISE EXCEPTION: todo se deshace (la
-- migración incluida, si viajó junta). Las inscripciones que crea son PRUEBA.
-- La edad que cuenta es la de la noche del evento (30/10/2026).
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
    v_lunes   timestamptz := '2026-10-26 23:59:59-03';
    v_martes  timestamptz := '2026-10-27 00:00:00-03';
    v_coord   uuid;
    v_r       jsonb;
    v_insc    uuid;
    v_fila    record;
    v_n       numeric;
    v_mal     text[] := '{}';
    v_casos   integer := 0;
    v_adulto  jsonb := jsonb_build_object('nombre', 'Prueba', 'apellido', 'PRUEBA Promo', 'dni', '99886611',
                         'email', 'prueba.promo@example.test', 'telefono', '1155550111', 'fechaNacimiento', '1984-04-04');
    v_chico   jsonb;
begin
    update public.nocturna_config set inscripciones_abiertas = true where id = 1;

    -- 1 · Nadie que ya estaba inscripto cambia de total
    v_casos := v_casos + 1;
    select count(*) into v_n from public.nocturna_inscripciones i
     where i.total is distinct from (select sum(j.precio) from public.nocturna_jovenes j where j.inscripcion_id = i.id)
       and exists (select 1 from public.nocturna_jovenes j where j.inscripcion_id = i.id);
    if v_n > 0 then v_mal := v_mal || ('1 inscripciones con total distinto a la suma: ' || v_n); end if;
    v_casos := v_casos + 1;
    if exists (select 1 from public.nocturna_jovenes where precio is null) then
        v_mal := v_mal || '2 hay chicos sin precio'::text;
    end if;

    -- 3 · Los precios por fecha y edad (edad al 30/10/2026)
    v_casos := v_casos + 1;
    if public.nocturna_precio_para('2014-01-01', v_lunes) <> 40000      -- 12
       or public.nocturna_precio_para('2014-06-30', v_lunes) <> 40000   -- 12, el más chico que entra
       or public.nocturna_precio_para('2013-10-31', v_lunes) <> 40000   -- 12: cumple 13 el 31
       or public.nocturna_precio_para('2013-10-30', v_lunes) <> 50000   -- 13 justo el día del evento
       or public.nocturna_precio_para('2011-03-15', v_lunes) <> 50000   -- 15
       or public.nocturna_precio_para('2014-01-01', v_martes) <> 60000  -- 12, ya sin promo
       or public.nocturna_precio_para('2011-03-15', v_martes) <> 60000 then
        v_mal := v_mal || ('3 precios: ' || public.nocturna_precio_para('2014-01-01', v_lunes) || '/' ||
            public.nocturna_precio_para('2013-10-30', v_lunes) || '/' || public.nocturna_precio_para('2014-01-01', v_martes));
    end if;

    -- 4 · Hoy (antes del martes): una familia con uno de 12 y uno de 15
    v_chico := jsonb_build_object('apellido','PRUEBA Promo','tribu','Sin tribu','retiroTipo','adulto','sinCelular',true);
    v_r := public.register_nocturna(jsonb_build_object(
        'adulto', v_adulto,
        'jovenes', jsonb_build_array(
            v_chico || jsonb_build_object('nombre','Doce','dni','99886601','fechaNacimiento','2014-01-01'),
            v_chico || jsonb_build_object('nombre','Quince','dni','99886602','fechaNacimiento','2011-03-15')),
        'autorizaAsistencia', true, 'aceptaFotos', true, 'declaracionesVersion', 'prueba', 'comprobantePath', 'PRUEBA/x.jpg'));
    select id, total, precio_unitario into v_fila from public.nocturna_inscripciones where adulto_dni = '99886611';
    v_insc := v_fila.id;
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or v_fila.total <> 90000 or (v_r->>'total')::numeric <> 90000
       or v_fila.precio_unitario <> 50000
       or (select precio from public.nocturna_jovenes where dni = '99886601') <> 40000
       or (select precio from public.nocturna_jovenes where dni = '99886602') <> 50000 then
        v_mal := v_mal || ('4 alta mezclada: ' || v_r::text || ' total=' || coalesce(v_fila.total::text, 'null'));
    end if;

    -- 5 · Suman un hermano de 12 (promo) y uno de 16 (precio de la familia)
    v_r := public.nocturna_agregar_jovenes(jsonb_build_object(
        'adulto', v_adulto,
        'jovenes', jsonb_build_array(
            v_chico || jsonb_build_object('nombre','OtroDoce','dni','99886603','fechaNacimiento','2014-03-03'),
            v_chico || jsonb_build_object('nombre','Dieciseis','dni','99886604','fechaNacimiento','2010-02-02')),
        'autorizaAsistencia', true, 'aceptaFotos', true, 'declaracionesVersion', 'prueba', 'comprobantePath', 'PRUEBA/y.jpg'));
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or (v_r->>'aPagar')::numeric <> 90000 or (v_r->>'total')::numeric <> 180000
       or (select total from public.nocturna_inscripciones where id = v_insc) <> 180000
       or (select monto from public.nocturna_comprobantes where inscripcion_id = v_insc) <> 90000 then
        v_mal := v_mal || ('5 sumar: ' || v_r::text);
    end if;

    -- 6 · El panel edita: saca al de 16 y agrega uno de 14 (precio de la familia)
    select u.id into v_coord from public.users u
    where coalesce(u.roles, array[]::text[]) && array['SUPER_ADMIN']::text[] or u.role::text = 'SUPER_ADMIN' limit 1;
    perform set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);
    v_r := public.admin_editar_nocturna(v_insc, jsonb_build_object(
        'adulto', v_adulto,
        'jovenes', (select jsonb_agg(v_chico || jsonb_build_object('id', j.id, 'nombre', j.nombre, 'dni', j.dni,
                        'fechaNacimiento', j.fecha_nacimiento::text))
                      from public.nocturna_jovenes j where j.inscripcion_id = v_insc and j.dni <> '99886604')
                   || jsonb_build_array(v_chico || jsonb_build_object('nombre','Catorce','dni','99886605','fechaNacimiento','2012-05-05')),
        'autorizaAsistencia', true, 'aceptaFotos', true, 'declaracionesVersion', 'prueba'));
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or (v_r->>'total')::numeric <> 180000
       or (select total from public.nocturna_inscripciones where id = v_insc) <> 180000
       or (select precio from public.nocturna_jovenes where dni = '99886605') <> 50000 then
        v_mal := v_mal || ('6 editar: ' || v_r::text);
    end if;

    -- 7 · Lo que ve la inscripción pública hoy
    v_r := public.nocturna_precios();
    v_casos := v_casos + 1;
    if (v_r->>'general')::numeric <> 50000 or (v_r->'promo'->>'precio')::numeric <> 40000
       or (v_r->'promo'->>'edad')::int <> 12 or (v_r->'proximo'->>'precio')::numeric <> 60000 then
        v_mal := v_mal || ('7 precios públicos: ' || v_r::text);
    end if;
    v_casos := v_casos + 1;
    if not has_function_privilege('anon', 'public.nocturna_precios()', 'execute')
       or has_function_privilege('anon', 'public.nocturna_precio_para(date, timestamptz)', 'execute') then
        v_mal := v_mal || '8 permisos de las funciones'::text;
    end if;

    -- 9 · Editar el precio ANTES del martes: el aumento sigue programado
    v_r := public.update_nocturna_precio(55000);
    select precio_entrada, precio_siguiente, precio_siguiente_desde into v_fila from public.nocturna_config where id = 1;
    v_casos := v_casos + 1;
    if v_fila.precio_entrada <> 55000 or v_fila.precio_siguiente <> 60000 or v_fila.precio_siguiente_desde is null then
        v_mal := v_mal || ('9 editar antes: ' || v_r::text);
    end if;

    -- 10 · Ya es martes: una inscripción nueva con uno de 12 paga 60.000
    update public.nocturna_config
       set promo_hasta = now() - interval '1 minute', precio_siguiente_desde = now() - interval '1 minute'
     where id = 1;
    perform set_config('request.jwt.claims', '', true);
    v_r := public.register_nocturna(jsonb_build_object(
        'adulto', v_adulto || jsonb_build_object('dni', '99886612'),
        'jovenes', jsonb_build_array(v_chico || jsonb_build_object('nombre','DoceTarde','dni','99886606','fechaNacimiento','2014-01-01')),
        'autorizaAsistencia', true, 'aceptaFotos', true, 'declaracionesVersion', 'prueba', 'comprobantePath', 'PRUEBA/z.jpg'));
    v_casos := v_casos + 1;
    if (v_r->>'total')::numeric <> 60000 or (public.nocturna_precios()->>'general')::numeric <> 60000
       or public.nocturna_precios()->'promo' <> 'null'::jsonb and public.nocturna_precios()->'promo' is not null then
        v_mal := v_mal || ('10 martes: ' || v_r::text || ' ' || public.nocturna_precios()::text);
    end if;

    -- 11 · Editar el precio DESPUÉS del martes: queda ese y el aumento se borra
    perform set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);
    v_r := public.update_nocturna_precio(65000);
    select precio_entrada, precio_siguiente into v_fila from public.nocturna_config where id = 1;
    v_casos := v_casos + 1;
    if v_fila.precio_entrada <> 65000 or v_fila.precio_siguiente is not null
       or public.nocturna_precio_general() <> 65000 then
        v_mal := v_mal || ('11 editar después: ' || v_r::text);
    end if;

    if cardinality(v_mal) = 0 then
        raise exception 'RESULTADO ✅ % casos en verde (todo deshecho)', v_casos;
    else
        raise exception 'RESULTADO ❌ % de % fallaron: %', cardinality(v_mal), v_casos, array_to_string(v_mal, ' | ');
    end if;
end;
$$;

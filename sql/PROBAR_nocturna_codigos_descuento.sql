-- ════════════════════════════════════════════════════════════════════════════
-- PRUEBA de sql/nocturna_codigos_descuento.sql
-- 2026-10-30
--
-- Un solo bloque que termina SIEMPRE en RAISE EXCEPTION: todo se deshace (la
-- migración incluida, si viajó junta con un BEGIN adelante). Las
-- inscripciones que crea son PRUEBA (DNI 99887xxx) y no quedan.
-- Los precios esperados salen de nocturna_precio_general() en el momento de
-- correrla, no están escritos a mano.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
    v_g       numeric := public.nocturna_precio_general();
    v_coord   uuid;
    v_r       jsonb;
    v_rep     jsonb;
    v_fila    record;
    v_id      uuid;
    v_n       numeric;
    v_leyo    boolean;
    v_mal     text[] := '{}';
    v_casos   integer := 0;
    v_adulto  jsonb := jsonb_build_object('nombre', 'Prueba', 'apellido', 'PRUEBA Codigos',
                         'email', 'prueba.codigos@example.test', 'telefono', '1155550199', 'fechaNacimiento', '1984-04-04');
    v_chico   jsonb := jsonb_build_object('apellido', 'PRUEBA Codigos', 'tribu', 'Sin tribu', 'retiroTipo', 'adulto',
                         'sinCelular', true, 'fechaNacimiento', '2011-03-15');
    v_resto   jsonb := jsonb_build_object('autorizaAsistencia', true, 'aceptaFotos', true,
                         'declaracionesVersion', 'prueba', 'comprobantePath', 'PRUEBA/codigos.jpg');
begin
    update public.nocturna_config set inscripciones_abiertas = true where id = 1;
    select u.id into v_coord from public.users u
    where coalesce(u.roles, array[]::text[]) && array['SUPER_ADMIN']::text[] or u.role::text = 'SUPER_ADMIN' limit 1;

    if v_g is null or v_g <= 50000 then
        raise exception 'RESULTADO ❌ la entrada general es % y las pruebas suponen más de $50.000', v_g;
    end if;

    -- 1 · Sin código: como siempre
    v_r := public.register_nocturna(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887001"}',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Uno","dni":"99887101"}')));
    select * into v_fila from public.nocturna_inscripciones where adulto_dni = '99887001';
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or v_fila.total <> v_g or v_fila.codigo_descuento is not null
       or v_fila.descuento_total <> 0 or v_fila.precio_sin_codigo is not null or v_fila.precio_unitario <> v_g
       or (select descuento from public.nocturna_jovenes where dni = '99887101') <> 0 then
        v_mal := v_mal || ('1 sin código: ' || v_r::text);
    end if;

    -- 2 · NOC40 con un adolescente
    v_r := public.register_nocturna(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887002"}', 'codigo_descuento', 'NOC40',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Dos","dni":"99887102"}')));
    select * into v_fila from public.nocturna_inscripciones where adulto_dni = '99887002';
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or (v_r->>'total')::numeric <> 40000 or v_fila.total <> 40000
       or v_r->>'codigo_descuento' <> 'NOC40' or v_fila.codigo_descuento <> 'NOC40'
       or v_fila.descuento_total <> v_g - 40000 or v_fila.precio_unitario <> 40000 or v_fila.precio_sin_codigo <> v_g
       or (select precio from public.nocturna_jovenes where dni = '99887102') <> 40000
       or (select descuento from public.nocturna_jovenes where dni = '99887102') <> v_g - 40000 then
        v_mal := v_mal || ('2 NOC40: ' || v_r::text);
    end if;

    -- 3 · NOCTURNA50 con dos: vale para todos
    v_r := public.register_nocturna(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887003"}', 'codigo_descuento', 'NOCTURNA50',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Tres","dni":"99887103"}',
                                     v_chico || '{"nombre":"Cuatro","dni":"99887104"}')));
    select * into v_fila from public.nocturna_inscripciones where adulto_dni = '99887003';
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or v_fila.total <> 100000 or v_fila.codigo_descuento <> 'NOCTURNA50'
       or v_fila.descuento_total <> 2 * (v_g - 50000) then
        v_mal := v_mal || ('3 NOCTURNA50 x2: ' || v_r::text);
    end if;

    -- 4 · En minúscula y con espacios
    v_r := public.register_nocturna(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887004"}', 'codigo_descuento', '  noc 40 ',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Cinco","dni":"99887105"}')));
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or (v_r->>'total')::numeric <> 40000
       or (select codigo_descuento from public.nocturna_inscripciones where adulto_dni = '99887004') <> 'NOC40' then
        v_mal := v_mal || ('4 "  noc 40 ": ' || v_r::text);
    end if;

    -- 5 · Un código que no existe: no se crea nada
    v_r := public.register_nocturna(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887005"}', 'codigo_descuento', 'NOC99',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Seis","dni":"99887106"}')));
    v_casos := v_casos + 1;
    if coalesce((v_r->>'ok')::boolean, true) or v_r->>'motivo' is distinct from 'codigo_invalido'
       or exists (select 1 from public.nocturna_inscripciones where adulto_dni = '99887005')
       or exists (select 1 from public.nocturna_jovenes where dni = '99887106') then
        v_mal := v_mal || ('5 inválido: ' || v_r::text);
    end if;

    -- 5b · Sólo espacios es lo mismo que no poner código
    v_r := public.register_nocturna(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887006"}', 'codigo_descuento', '   ',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Siete","dni":"99887107"}')));
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or (v_r->>'total')::numeric <> v_g
       or (select codigo_descuento from public.nocturna_inscripciones where adulto_dni = '99887006') is not null then
        v_mal := v_mal || ('5b vacío: ' || v_r::text);
    end if;

    -- 6 · Sumar un hermano a la familia del NOC40: paga 40.000 solo
    v_r := public.nocturna_agregar_jovenes(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887002"}', 'comprobantePath', 'PRUEBA/codigos-2.jpg',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Ocho","dni":"99887108"}')));
    select * into v_fila from public.nocturna_inscripciones where adulto_dni = '99887002';
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or (v_r->>'aPagar')::numeric <> 40000 or (v_r->>'total')::numeric <> 80000
       or v_r->>'codigoDescuento' <> 'NOC40' or v_fila.total <> 80000 or v_fila.codigo_descuento <> 'NOC40'
       or v_fila.descuento_total <> 2 * (v_g - 40000)
       or (select monto from public.nocturna_comprobantes where inscripcion_id = v_fila.id and path = 'PRUEBA/codigos-2.jpg') <> 40000
       or (select descuento from public.nocturna_jovenes where dni = '99887108') <> v_g - 40000 then
        v_mal := v_mal || ('6 sumar a familia con código: ' || v_r::text);
    end if;

    -- 6b · Sumar escribiendo el mismo código de la familia: entra igual
    v_r := public.nocturna_agregar_jovenes(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887002"}', 'codigo_descuento', 'noc40',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Nueve","dni":"99887109"}')));
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or (v_r->>'aPagar')::numeric <> 40000 or (v_r->>'total')::numeric <> 120000 then
        v_mal := v_mal || ('6b mismo código: ' || v_r::text);
    end if;

    -- 6c · Sumar con OTRO código: uno solo por inscripción
    v_r := public.nocturna_agregar_jovenes(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887002"}', 'codigo_descuento', 'NOCTURNA50',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Diez","dni":"99887110"}')));
    v_casos := v_casos + 1;
    if coalesce((v_r->>'ok')::boolean, true) or v_r->>'motivo' is distinct from 'codigo_ya_usado'
       or exists (select 1 from public.nocturna_jovenes where dni = '99887110')
       or (select codigo_descuento from public.nocturna_inscripciones where adulto_dni = '99887002') <> 'NOC40' then
        v_mal := v_mal || ('6c otro código: ' || v_r::text);
    end if;

    -- 7 · Sumar con código a la familia sin código: sólo para el que se suma
    v_r := public.nocturna_agregar_jovenes(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887001"}', 'codigo_descuento', 'NOCTURNA50',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Once","dni":"99887111"}')));
    select * into v_fila from public.nocturna_inscripciones where adulto_dni = '99887001';
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or (v_r->>'aPagar')::numeric <> 50000 or (v_r->>'total')::numeric <> v_g + 50000
       or v_fila.codigo_descuento <> 'NOCTURNA50' or v_fila.precio_unitario <> 50000 or v_fila.precio_sin_codigo <> v_g
       or v_fila.descuento_total <> v_g - 50000
       or (select precio from public.nocturna_jovenes where dni = '99887101') <> v_g
       or (select descuento from public.nocturna_jovenes where dni = '99887101') <> 0
       or (select precio from public.nocturna_jovenes where dni = '99887111') <> 50000 then
        v_mal := v_mal || ('7 sumar con código a familia sin código: ' || v_r::text);
    end if;

    -- 7b · Sumar con un código que no existe: no se suma nadie
    v_r := public.nocturna_agregar_jovenes(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887006"}', 'codigo_descuento', 'NOC-XX',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Doce","dni":"99887112"}')));
    v_casos := v_casos + 1;
    if coalesce((v_r->>'ok')::boolean, true) or v_r->>'motivo' is distinct from 'codigo_invalido'
       or exists (select 1 from public.nocturna_jovenes where dni = '99887112')
       or (select codigo_descuento from public.nocturna_inscripciones where adulto_dni = '99887006') is not null then
        v_mal := v_mal || ('7b sumar con inválido: ' || v_r::text);
    end if;

    -- 8 · El panel edita la familia del NOCTURNA50: saca a uno, agrega otro y
    --     cambia el nombre del adulto. El código y el precio no se pierden.
    perform set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);
    select id into v_id from public.nocturna_inscripciones where adulto_dni = '99887003';
    v_r := public.admin_editar_nocturna(v_id, v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887003","nombre":"PruebaEditada"}',
        'jovenes', (select jsonb_agg(v_chico || jsonb_build_object('id', j.id, 'nombre', j.nombre, 'dni', j.dni,
                        'fechaNacimiento', j.fecha_nacimiento::text))
                      from public.nocturna_jovenes j where j.inscripcion_id = v_id and j.dni = '99887103')
                   || jsonb_build_array(v_chico || '{"nombre":"Trece","dni":"99887113"}')));
    select * into v_fila from public.nocturna_inscripciones where id = v_id;
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or (v_r->>'total')::numeric <> 100000
       or v_r->>'codigo_descuento' <> 'NOCTURNA50' or (v_r->>'precio_unitario')::numeric <> 50000
       or v_fila.codigo_descuento <> 'NOCTURNA50' or v_fila.adulto_nombre <> 'PruebaEditada' or v_fila.total <> 100000
       or v_fila.descuento_total <> 2 * (v_g - 50000)
       or (select precio from public.nocturna_jovenes where dni = '99887113') <> 50000
       or (select descuento from public.nocturna_jovenes where dni = '99887113') <> v_g - 50000
       or exists (select 1 from public.nocturna_jovenes where dni = '99887104') then
        v_mal := v_mal || ('8 editar: ' || v_r::text);
    end if;

    -- 8b · Y si saca a uno sin agregar, el descuento baja con él
    v_r := public.admin_editar_nocturna(v_id, v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887003","nombre":"PruebaEditada"}',
        'jovenes', (select jsonb_agg(v_chico || jsonb_build_object('id', j.id, 'nombre', j.nombre, 'dni', j.dni,
                        'fechaNacimiento', j.fecha_nacimiento::text))
                      from public.nocturna_jovenes j where j.inscripcion_id = v_id and j.dni = '99887103')));
    select * into v_fila from public.nocturna_inscripciones where id = v_id;
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or v_fila.total <> 50000 or v_fila.descuento_total <> v_g - 50000
       or v_fila.codigo_descuento <> 'NOCTURNA50' then
        v_mal := v_mal || ('8b editar quitando: ' || v_r::text);
    end if;
    perform set_config('request.jwt.claims', '', true);

    -- 9 · Un código más caro que la entrada no sube el precio
    insert into public.nocturna_codigos_descuento (codigo, precio) values ('PRUEBACARO', 999999), ('PRUEBACERO', 1);
    v_r := public.register_nocturna(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887007"}', 'codigo_descuento', 'pruebacaro',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Catorce","dni":"99887114"}')));
    select * into v_fila from public.nocturna_inscripciones where adulto_dni = '99887007';
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or v_fila.total <> v_g or v_fila.descuento_total <> 0
       or v_fila.precio_unitario <> v_g then
        v_mal := v_mal || ('9 código caro: ' || v_r::text);
    end if;

    -- 10 · Apagado: no sirve para inscripciones nuevas, la familia que lo usó
    --      conserva su precio
    update public.nocturna_codigos_descuento set activo = false where codigo = 'NOC40';
    v_r := public.register_nocturna(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887008"}', 'codigo_descuento', 'NOC40',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Quince","dni":"99887115"}')));
    v_casos := v_casos + 1;
    if coalesce((v_r->>'ok')::boolean, true) or v_r->>'motivo' is distinct from 'codigo_invalido'
       or coalesce((public.nocturna_probar_codigo('NOC40')->>'ok')::boolean, true) then
        v_mal := v_mal || ('10 apagado, alta: ' || v_r::text);
    end if;
    v_r := public.nocturna_agregar_jovenes(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887002"}',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Dieciseis","dni":"99887116"}')));
    v_casos := v_casos + 1;
    if not coalesce((v_r->>'ok')::boolean, false) or (v_r->>'aPagar')::numeric <> 40000 then
        v_mal := v_mal || ('10 apagado, hermano: ' || v_r::text);
    end if;
    update public.nocturna_codigos_descuento set activo = true where codigo = 'NOC40';

    -- 11 · Con las inscripciones cerradas, el código no abre nada
    update public.nocturna_config set inscripciones_abiertas = false where id = 1;
    v_r := public.register_nocturna(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887009"}', 'codigo_descuento', 'NOC40',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Diecisiete","dni":"99887117"}')));
    v_casos := v_casos + 1;
    if coalesce((v_r->>'ok')::boolean, true) or v_r->>'error' <> 'Las inscripciones están cerradas.'
       or exists (select 1 from public.nocturna_inscripciones where adulto_dni = '99887009') then
        v_mal := v_mal || ('11 cerradas, alta: ' || v_r::text);
    end if;
    v_r := public.nocturna_agregar_jovenes(v_resto || jsonb_build_object(
        'adulto', v_adulto || '{"dni":"99887002"}', 'codigo_descuento', 'NOC40',
        'jovenes', jsonb_build_array(v_chico || '{"nombre":"Dieciocho","dni":"99887118"}')));
    v_casos := v_casos + 1;
    if coalesce((v_r->>'ok')::boolean, true) or v_r->>'error' <> 'Las inscripciones están cerradas.'
       or exists (select 1 from public.nocturna_jovenes where dni = '99887118') then
        v_mal := v_mal || ('11 cerradas, sumar: ' || v_r::text);
    end if;
    update public.nocturna_config set inscripciones_abiertas = true where id = 1;

    -- 12 · Lo que ve el formulario antes de transferir
    v_casos := v_casos + 1;
    if public.nocturna_probar_codigo('NOC40') <> '{"ok":true,"codigo":"NOC40","precio":40000.00}'::jsonb
       or public.nocturna_probar_codigo(' nocturna 50 ')->>'codigo' <> 'NOCTURNA50'
       or (public.nocturna_probar_codigo(' nocturna 50 ')->>'precio')::numeric <> 50000
       or public.nocturna_probar_codigo('NOC41') <> '{"ok":false,"motivo":"codigo_invalido"}'::jsonb
       or (public.nocturna_probar_codigo(null)->>'ok')::boolean
       or (public.nocturna_probar_codigo('')->>'ok')::boolean then
        v_mal := v_mal || ('12 probar: ' || public.nocturna_probar_codigo('NOC40')::text);
    end if;

    -- 13 · Nadie de afuera lee la tabla de códigos
    v_casos := v_casos + 1;
    if has_table_privilege('anon', 'public.nocturna_codigos_descuento', 'select')
       or has_table_privilege('authenticated', 'public.nocturna_codigos_descuento', 'select')
       or not has_function_privilege('anon', 'public.nocturna_probar_codigo(text)', 'execute')
       or has_function_privilege('anon', 'public.nocturna_reporte_codigos()', 'execute')
       or has_function_privilege('anon', 'public.nocturna_precio_de_codigo(text)', 'execute')
       or has_function_privilege('authenticated', 'public.nocturna_precio_de_codigo(text)', 'execute') then
        v_mal := v_mal || '13 permisos'::text;
    end if;
    v_casos := v_casos + 1;
    begin
        execute 'set local role anon';
        perform count(*) from public.nocturna_codigos_descuento;
        v_leyo := true;
    exception when insufficient_privilege then
        v_leyo := false;
    end;
    execute 'reset role';
    if v_leyo then v_mal := v_mal || '13b anon leyó la tabla'::text; end if;

    -- 14 · Reportes: una fila por código, también los que nadie usó, y los
    --      números son los de la tabla
    perform set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);
    v_rep := public.nocturna_reporte_codigos();
    v_casos := v_casos + 1;
    select count(*) into v_n
      from jsonb_array_elements(v_rep->'codigos') e
      join (select c.codigo,
                   count(i.id) as usos,
                   coalesce(sum(i.total), 0) as recaudado,
                   coalesce(sum(i.descuento_total), 0) as descontado,
                   coalesce(sum((select count(*) from public.nocturna_jovenes j where j.inscripcion_id = i.id)), 0) as chicos
              from public.nocturna_codigos_descuento c
              left join public.nocturna_inscripciones i
                on i.codigo_descuento = c.codigo
               and i.edicion = (select edicion from public.nocturna_config where id = 1)
             group by c.codigo) t on t.codigo = e->>'codigo'
     where (e->>'usos')::numeric = t.usos and (e->>'recaudado')::numeric = t.recaudado
       and (e->>'descontado')::numeric = t.descontado and (e->>'adolescentes')::numeric = t.chicos;
    if not coalesce((v_rep->>'ok')::boolean, false)
       or v_n <> (select count(*) from public.nocturna_codigos_descuento)
       or jsonb_array_length(v_rep->'codigos') <> v_n
       or not exists (select 1 from jsonb_array_elements(v_rep->'codigos') e where e->>'codigo' = 'PRUEBACERO' and (e->>'usos')::int = 0)
       or (select (e->>'usos')::int from jsonb_array_elements(v_rep->'codigos') e where e->>'codigo' = 'NOC40')
            < 2
       or (v_rep->'sin_codigo'->>'usos')::numeric <> (select count(*) from public.nocturna_inscripciones
                                                       where codigo_descuento is null
                                                         and edicion = (select edicion from public.nocturna_config where id = 1)) then
        v_mal := v_mal || ('14 reporte: ' || v_rep::text);
    end if;
    perform set_config('request.jwt.claims', '', true);
    v_casos := v_casos + 1;
    if coalesce((public.nocturna_reporte_codigos()->>'ok')::boolean, true) then
        v_mal := v_mal || '14b el reporte se ve sin ser staff'::text;
    end if;

    -- 15 · Las cuentas cierran en TODAS las inscripciones, reales y de prueba
    v_casos := v_casos + 1;
    select count(*) into v_n from public.nocturna_inscripciones i
     where i.descuento_total <> (select coalesce(sum(j.descuento), 0) from public.nocturna_jovenes j where j.inscripcion_id = i.id)
        or (i.codigo_descuento is null and (i.descuento_total <> 0 or i.precio_sin_codigo is not null));
    if v_n > 0 then v_mal := v_mal || ('15 inscripciones con el descuento descuadrado: ' || v_n); end if;
    v_casos := v_casos + 1;
    select count(*) into v_n from public.nocturna_inscripciones i
     where i.codigo_descuento is not null
       and i.total is distinct from (select sum(j.precio) from public.nocturna_jovenes j where j.inscripcion_id = i.id);
    if v_n > 0 then v_mal := v_mal || ('15b inscripciones con código y total distinto a la suma: ' || v_n); end if;

    if cardinality(v_mal) = 0 then
        raise exception 'RESULTADO ✅ % casos en verde (todo deshecho)', v_casos;
    else
        raise exception 'RESULTADO ❌ % de % fallaron: %', cardinality(v_mal), v_casos, array_to_string(v_mal, ' | ');
    end if;
end;
$$;

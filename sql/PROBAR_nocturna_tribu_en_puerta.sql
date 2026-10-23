-- ════════════════════════════════════════════════════════════════════════════
-- PRUEBA de sql/nocturna_tribu_en_puerta.sql
-- 2026-10-22
--
-- Se corre en el MISMO pedido que la migración (o después de aplicarla). Es un
-- solo bloque que termina SIEMPRE en RAISE EXCEPTION: todo lo que hizo —la
-- migración incluida, si viajó junta— se deshace. El mensaje del error es el
-- resultado: 'RESULTADO ✅ …' o 'RESULTADO ❌ …' con los casos que fallaron.
--
-- Las filas que crea son PRUEBA. Para simular quién llama se escribe
-- request.jwt.claims, que es de donde auth.uid() saca el usuario.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
    v_staff   uuid;
    v_comun   uuid;
    v_edicion integer;
    v_insc    uuid;
    v_sin     uuid;   -- llega 'Sin tribu'
    v_con     uuid;   -- la familia eligió Garra al inscribirse
    v_r       jsonb;
    v_fila    record;
    v_mal     text[] := '{}';
    v_casos   integer := 0;
begin
    select edicion into v_edicion from public.nocturna_config where id = 1;

    select u.id into v_staff from public.users u
    where u.role::text = any (array['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS','ACREDITACION'])
       or coalesce(u.roles, array[]::text[]) && array['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS','ACREDITACION']::text[]
    limit 1;
    select u.id into v_comun from public.users u
    where not (
        u.role::text = any (array['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS','ACREDITACION'])
        or coalesce(u.roles, array[]::text[]) && array['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS','ACREDITACION']::text[]
    )
    limit 1;

    insert into public.nocturna_inscripciones (
        edicion, codigo_entrada, adulto_nombre, adulto_apellido, adulto_dni,
        adulto_email, adulto_fecha_nacimiento, autoriza_asistencia, acepta_fotos,
        declaraciones_version, declaraciones_aceptadas_at, precio_unitario, total,
        adulto_telefono
    ) values (
        v_edicion, 'PRUTR7', 'Marcela PRUEBA', 'Tribu PRUEBA', '30.111.777',
        'prueba.tribu@example.test', '1985-05-05', true, true,
        '1', now(), 50000, 100000, '1155550000'
    ) returning id into v_insc;

    insert into public.nocturna_jovenes (inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu, retiro_tipo)
    values (v_insc, v_edicion, 'Ana PRUEBA', 'Tribu PRUEBA', '55107001', '2010-05-05', 'Sin tribu', 'adulto')
    returning id into v_sin;
    insert into public.nocturna_jovenes (inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu, retiro_tipo)
    values (v_insc, v_edicion, 'Bruno PRUEBA', 'Tribu PRUEBA', '55107002', '2011-05-05', 'Garra', 'adulto')
    returning id into v_con;

    -- 1 · Sin rol: no puede
    perform set_config('request.jwt.claims', json_build_object('sub', v_comun, 'role', 'authenticated')::text, true);
    v_r := public.nocturna_asignar_tribu(v_sin, 'Garra', 'Sin tribu');
    v_casos := v_casos + 1;
    if v_r ->> 'motivo' is distinct from 'sin_permiso' then v_mal := v_mal || ('1 sin rol: ' || v_r::text); end if;

    -- Desde acá llama el staff
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff, 'role', 'authenticated')::text, true);

    -- 2 · Tribu inventada
    v_r := public.nocturna_asignar_tribu(v_sin, 'Fuego', 'Sin tribu');
    v_casos := v_casos + 1;
    if v_r ->> 'motivo' is distinct from 'tribu' then v_mal := v_mal || ('2 tribu inválida: ' || v_r::text); end if;

    -- 3 · Sin tribu → Garra, con la marca de quién y cuándo
    v_r := public.nocturna_asignar_tribu(v_sin, 'Garra', 'Sin tribu');
    select tribu, tribu_asignada_at, tribu_asignada_por into v_fila from public.nocturna_jovenes where id = v_sin;
    v_casos := v_casos + 1;
    if not (v_r ->> 'ok')::boolean or v_fila.tribu <> 'Garra' or v_fila.tribu_asignada_at is null
       or v_fila.tribu_asignada_por is distinct from v_staff or (v_r ->> 'en_puerta')::boolean is not true then
        v_mal := v_mal || ('3 asignar: ' || v_r::text);
    end if;

    -- 4 · Otro escáner con la pantalla vieja (todavía ve 'Sin tribu'): no pisa
    v_r := public.nocturna_asignar_tribu(v_sin, 'Trueno', 'Sin tribu');
    select tribu into v_fila from public.nocturna_jovenes where id = v_sin;
    v_casos := v_casos + 1;
    if v_r ->> 'motivo' is distinct from 'cambio' or v_r ->> 'tribu' <> 'Garra' or v_fila.tribu <> 'Garra' then
        v_mal := v_mal || ('4 pantalla vieja: ' || v_r::text);
    end if;

    -- 5 · Corregir el toque: Garra → Trueno, porque se eligió en la puerta
    v_r := public.nocturna_asignar_tribu(v_sin, 'Trueno', 'Garra');
    select tribu into v_fila from public.nocturna_jovenes where id = v_sin;
    v_casos := v_casos + 1;
    if not (v_r ->> 'ok')::boolean or v_fila.tribu <> 'Trueno' then v_mal := v_mal || ('5 corregir: ' || v_r::text); end if;

    -- 6 · Deshacer: vuelve a Sin tribu y la marca se borra
    v_r := public.nocturna_asignar_tribu(v_sin, 'Sin tribu', 'Trueno');
    select tribu, tribu_asignada_at, tribu_asignada_por into v_fila from public.nocturna_jovenes where id = v_sin;
    v_casos := v_casos + 1;
    if not (v_r ->> 'ok')::boolean or v_fila.tribu <> 'Sin tribu' or v_fila.tribu_asignada_at is not null or v_fila.tribu_asignada_por is not null then
        v_mal := v_mal || ('6 deshacer: ' || v_r::text);
    end if;

    -- 7 · La tribu que eligió la familia no se toca
    v_r := public.nocturna_asignar_tribu(v_con, 'Trueno', 'Garra');
    select tribu into v_fila from public.nocturna_jovenes where id = v_con;
    v_casos := v_casos + 1;
    if v_r ->> 'motivo' is distinct from 'ya_tiene' or v_fila.tribu <> 'Garra' then
        v_mal := v_mal || ('7 la de la familia: ' || v_r::text);
    end if;

    -- 8 · Un id que no existe
    v_r := public.nocturna_asignar_tribu(gen_random_uuid(), 'Garra', 'Sin tribu');
    v_casos := v_casos + 1;
    if v_r ->> 'motivo' is distinct from 'no_existe' then v_mal := v_mal || ('8 no existe: ' || v_r::text); end if;

    -- 9 · El escáner ve la marca
    perform public.nocturna_asignar_tribu(v_sin, 'Garra', 'Sin tribu');
    v_r := public.get_nocturna_para_acreditar(v_insc);
    v_casos := v_casos + 1;
    if not exists (
        select 1 from jsonb_array_elements(v_r -> 'jovenes') e
        where (e ->> 'id')::uuid = v_sin and e ->> 'tribu' = 'Garra' and (e ->> 'tribu_en_puerta')::boolean
    ) or not exists (
        select 1 from jsonb_array_elements(v_r -> 'jovenes') e
        where (e ->> 'id')::uuid = v_con and not (e ->> 'tribu_en_puerta')::boolean
    ) then
        v_mal := v_mal || ('9 escáner: ' || (v_r -> 'jovenes')::text);
    end if;

    -- 10 · anon no tiene la función
    v_casos := v_casos + 1;
    if has_function_privilege('anon', 'public.nocturna_asignar_tribu(uuid, text, text)', 'execute') then
        v_mal := v_mal || '10 anon puede ejecutarla'::text;
    end if;

    if cardinality(v_mal) = 0 then
        raise exception 'RESULTADO ✅ % casos en verde (todo deshecho)', v_casos;
    else
        raise exception 'RESULTADO ❌ % de % fallaron: %', cardinality(v_mal), v_casos, array_to_string(v_mal, ' | ');
    end if;
end;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- PRUEBA de sql/nocturna_completar_staff.sql
-- 2026-10-21
--
-- Entera adentro de una transacción que SIEMPRE termina en ROLLBACK: las
-- inscripciones de las familias no se tocan ni por un instante. Las filas que
-- crea son PRUEBA y desaparecen con el rollback.
--
-- Deja una línea por caso en `prueba_resultado`, que se imprime al final. Si
-- aparece una sola que empiece con MAL, no se aplica nada.
--
-- Para simular a quién llama, se escribe `request.jwt.claims`, que es de donde
-- auth.uid() saca el usuario: con el de un staff PRUEBA, con el de uno sin
-- rol, y sin nadie.
-- ════════════════════════════════════════════════════════════════════════════

begin;

create temp table prueba_resultado (n serial, linea text) on commit drop;
grant insert on prueba_resultado to anon;
grant usage, select on sequence prueba_resultado_n_seq to anon;

do $$
declare
    -- Dos usuarios que YA existen: uno con rol de Nocturna y otro sin. Sólo
    -- se leen sus ids para simular quién llama; no se los toca ni se los
    -- imprime. Inventarlos no se puede: public.users tiene un FK a auth.users.
    v_staff   uuid;
    v_comun   uuid;
    v_insc    uuid;
    v_otra    uuid;
    v_j1      uuid;   -- sin teléfono: se lo carga el staff
    v_j2      uuid;   -- sin teléfono: "no tiene celular"
    v_j3      uuid;   -- ya tiene teléfono: no se toca
    v_jajeno  uuid;
    v_edicion integer;
    v_r       jsonb;
    v_fallas  integer := 0;
    v_tel     text;
    v_ok      boolean;
    v_n       integer;
begin
    select edicion into v_edicion from public.nocturna_config where id = 1;

    -- ── Quien llama ────────────────────────────────────────────────────────
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

    if v_staff is null or v_comun is null then
        insert into prueba_resultado (linea) values ('MAL · no hay con qué simular staff y no-staff');
        return;
    end if;

    -- ── Dos inscripciones PRUEBA ────────────────────────────────────────────
    insert into public.nocturna_inscripciones (
        edicion, codigo_entrada, adulto_nombre, adulto_apellido, adulto_dni,
        adulto_email, adulto_fecha_nacimiento, autoriza_asistencia, acepta_fotos,
        declaraciones_version, declaraciones_aceptadas_at, precio_unitario, total,
        adulto_telefono
    ) values (
        v_edicion, 'PRUEB4', 'Marcela PRUEBA', 'Gonzalez PRUEBA', '30.111.482',
        'prueba.staff@example.test', '1985-05-05', true, true,
        '1', now(), 50000, 150000, null
    ) returning id into v_insc;

    insert into public.nocturna_jovenes (inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu, retiro_tipo, telefono)
    values (v_insc, v_edicion, 'Ana PRUEBA', 'Gonzalez PRUEBA', '55100001', '2010-05-05', 'Sin tribu', 'adulto', null)
    returning id into v_j1;

    insert into public.nocturna_jovenes (inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu, retiro_tipo, telefono)
    values (v_insc, v_edicion, 'Bruno PRUEBA', 'Gonzalez PRUEBA', '55100002', '2011-05-05', 'Sin tribu', 'adulto', null)
    returning id into v_j2;

    insert into public.nocturna_jovenes (inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu, retiro_tipo, telefono)
    values (v_insc, v_edicion, 'Carla PRUEBA', 'Gonzalez PRUEBA', '55100003', '2009-05-05', 'Sin tribu', 'adulto', '1155550000')
    returning id into v_j3;

    insert into public.nocturna_inscripciones (
        edicion, codigo_entrada, adulto_nombre, adulto_apellido, adulto_dni,
        adulto_email, adulto_fecha_nacimiento, autoriza_asistencia, acepta_fotos,
        declaraciones_version, declaraciones_aceptadas_at, precio_unitario, total
    ) values (
        v_edicion, 'PRUEB5', 'Ajena PRUEBA', 'Otra PRUEBA', '28999111',
        'prueba.ajena2@example.test', '1980-01-01', true, true,
        '1', now(), 50000, 50000
    ) returning id into v_otra;

    insert into public.nocturna_jovenes (inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu, retiro_tipo, telefono)
    values (v_otra, v_edicion, 'Ajeno PRUEBA', 'Otra PRUEBA', '55100004', '2010-01-01', 'Sin tribu', 'adulto', null)
    returning id into v_jajeno;

    -- ── 1 · Las columnas ────────────────────────────────────────────────────
    select count(*) into v_n from information_schema.columns
    where table_name = 'nocturna_jovenes' and column_name in ('sin_celular_at', 'sin_celular_por');
    v_ok := v_n = 2;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end || '1 · las dos columnas existen');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- ── 2 · Sin rol → sin_permiso ───────────────────────────────────────────
    perform set_config('request.jwt.claims', json_build_object('sub', v_comun)::text, true);
    v_r := public.nocturna_completar_datos_staff(v_insc, '1161234567', '[]'::jsonb);
    v_ok := not (v_r ->> 'ok')::boolean and v_r ->> 'motivo' = 'sin_permiso';
    select adulto_telefono into v_tel from public.nocturna_inscripciones where id = v_insc;
    v_ok := v_ok and v_tel is null;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end || '2 · un usuario sin rol → sin_permiso, y no escribe nada');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- ── Desde acá, el staff ─────────────────────────────────────────────────
    perform set_config('request.jwt.claims', json_build_object('sub', v_staff)::text, true);

    -- ── 3 · Teléfono inválido → NO guarda NADA ──────────────────────────────
    v_r := public.nocturna_completar_datos_staff(
        v_insc,
        '1161234567',                       -- éste es válido
        jsonb_build_array(
            jsonb_build_object('id', v_j1, 'telefono', '1151112233'),   -- válido
            jsonb_build_object('id', v_j2, 'telefono', '123')           -- inválido
        ));
    v_ok := not (v_r ->> 'ok')::boolean
            and v_r ->> 'motivo' = 'telefono'
            and v_r ->> 'campo' = v_j2::text;
    select adulto_telefono into v_tel from public.nocturna_inscripciones where id = v_insc;
    v_ok := v_ok and v_tel is null;
    select telefono into v_tel from public.nocturna_jovenes where id = v_j1;
    v_ok := v_ok and v_tel is null;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '3 · un teléfono inválido no guarda NINGUNO (todo o nada)');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- ── 4 · La carga de verdad ──────────────────────────────────────────────
    v_r := public.nocturna_completar_datos_staff(
        v_insc,
        '+54 9 11 6123-4567',
        jsonb_build_array(
            jsonb_build_object('id', v_j1, 'telefono', '011 15 5111-2233'),
            jsonb_build_object('id', v_j2, 'sin_celular', true),
            jsonb_build_object('id', v_j3, 'telefono', '1199999999'),   -- ya tiene: no se toca
            jsonb_build_object('id', v_jajeno, 'telefono', '1177778888') -- de otra familia
        ));

    select adulto_telefono into v_tel from public.nocturna_inscripciones where id = v_insc;
    v_ok := (v_r ->> 'ok')::boolean and v_tel = '1161234567';
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '4a · el teléfono del adulto, normalizado — quedó ' || coalesce(v_tel, 'NULL'));
    if not v_ok then v_fallas := v_fallas + 1; end if;

    select telefono into v_tel from public.nocturna_jovenes where id = v_j1;
    v_ok := v_tel = '1151112233';
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '4b · el del adolescente, con el 0 y el 15 sacados — quedó ' || coalesce(v_tel, 'NULL'));
    if not v_ok then v_fallas := v_fallas + 1; end if;

    select (sin_celular_at is not null and sin_celular_por = v_staff and telefono is null)
      into v_ok from public.nocturna_jovenes where id = v_j2;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '4c · "no tiene celular" queda marcado, con quién lo marcó');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    select telefono into v_tel from public.nocturna_jovenes where id = v_j3;
    v_ok := v_tel = '1155550000';
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '4d · el que YA tenía teléfono no se pisa — quedó ' || coalesce(v_tel, 'NULL'));
    if not v_ok then v_fallas := v_fallas + 1; end if;

    select telefono into v_tel from public.nocturna_jovenes where id = v_jajeno;
    v_ok := v_tel is null;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '4e · un adolescente de otra inscripción se ignora');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- ── 5 · Las tres lecturas respetan la marca ─────────────────────────────
    -- a) el escáner
    v_r := public.get_nocturna_para_acreditar(v_insc);
    v_ok := (v_r ->> 'ok')::boolean
            and (select bool_or((x ->> 'sin_celular')::boolean)
                 from jsonb_array_elements(v_r -> 'jovenes') x
                 where x ->> 'id' = v_j2::text)
            and (select not bool_or((x ->> 'sin_celular')::boolean)
                 from jsonb_array_elements(v_r -> 'jovenes') x
                 where x ->> 'id' = v_j1::text)
            -- y nada más de la respuesta cambió
            and jsonb_array_length(v_r -> 'jovenes') = 3
            and (v_r -> 'inscripcion' ->> 'codigo_entrada') = 'PRUEB4';
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '5a · get_nocturna_para_acreditar trae sin_celular, y el resto igual');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- b) la página: ya no falta nadie
    v_r := public.nocturna_ver_entrada('PRUEB4', '482');
    v_ok := (v_r ->> 'ok')::boolean
            and not (v_r -> 'faltantes' ->> 'adulto_telefono')::boolean
            and jsonb_array_length(v_r -> 'faltantes' -> 'jovenes_sin_telefono') = 0;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '5b · nocturna_ver_entrada: el marcado ya no figura como faltante');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- c) completar desde la página: tampoco lo cuenta
    v_r := public.nocturna_completar_datos('PRUEB4', '482', null, '[]'::jsonb);
    v_ok := (v_r ->> 'ok')::boolean
            and jsonb_array_length(v_r -> 'faltantes' -> 'jovenes_sin_telefono') = 0;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '5c · nocturna_completar_datos: tampoco lo cuenta');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- ── 6 · Si la familia carga el teléfono, la marca se va ─────────────────
    v_r := public.nocturna_completar_datos('PRUEB4', '482', null,
        jsonb_build_array(jsonb_build_object('id', v_j2, 'telefono', '1166667777')));
    select (telefono = '1166667777' and sin_celular_at is null and sin_celular_por is null)
      into v_ok from public.nocturna_jovenes where id = v_j2;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '6 · un teléfono real borra la marca de "no tiene"');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- ── 7 · La RPC pública, igual que antes para lo de siempre ──────────────
    -- La otra inscripción no tiene ninguna marca: tiene que seguir faltando
    -- el adulto y el único adolescente, como antes de este cambio.
    v_r := public.nocturna_ver_entrada('PRUEB5', '111');
    v_ok := (v_r ->> 'ok')::boolean
            and (v_r -> 'faltantes' ->> 'adulto_telefono')::boolean
            and jsonb_array_length(v_r -> 'faltantes' -> 'jovenes_sin_telefono') = 1;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '7 · sin marcas, la RPC pública responde igual que antes');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- ── 8 · Inscripción que no existe ───────────────────────────────────────
    v_r := public.nocturna_completar_datos_staff(
        '00000000-0000-4000-8000-000000000000'::uuid, '1161234567', '[]'::jsonb);
    v_ok := not (v_r ->> 'ok')::boolean and v_r ->> 'motivo' = 'no_existe';
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end || '8 · inscripción inexistente → no_existe');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    insert into prueba_resultado (linea) values (
        case when v_fallas = 0 then '───── TODO BIEN ─────' else '───── ' || v_fallas || ' CASOS MAL ─────' end);
end;
$$;

-- ── 9 · Lo que puede `anon` ─────────────────────────────────────────────────
set local role anon;

do $$
declare v_txt text;
begin
    begin
        perform public.nocturna_completar_datos_staff(
            '00000000-0000-4000-8000-000000000000'::uuid, '1161234567', '[]'::jsonb);
        v_txt := 'MAL · 9 · anon PUDO ejecutar la RPC del staff';
    exception when insufficient_privilege then
        v_txt := 'OK  · 9 · anon no puede ejecutar la RPC del staff';
    when others then
        v_txt := 'OK  · 9 · anon no puede ejecutar la RPC del staff (' || SQLSTATE || ')';
    end;
    insert into prueba_resultado (linea) values (v_txt);
end;
$$;

reset role;

select linea from prueba_resultado order by n;

-- NUNCA un commit acá.
rollback;

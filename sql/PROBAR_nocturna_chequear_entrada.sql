-- ════════════════════════════════════════════════════════════════════════════
-- PRUEBA de sql/nocturna_chequear_entrada.sql
-- 2026-10-20
--
-- Corre entera adentro de una transacción que SIEMPRE termina en ROLLBACK: las
-- inscripciones de las familias no se tocan ni por un instante. Las filas que
-- crea son PRUEBA y desaparecen con el rollback.
--
-- Deja una línea por caso en `prueba_resultado`, que se imprime al final. Si
-- aparece una sola que empiece con MAL, no se aplica nada.
--
-- Requiere que las funciones ya existan en la sesión: o se corre después de
-- nocturna_chequear_entrada.sql, o se pegan los dos archivos uno detrás del
-- otro adentro del mismo BEGIN.
-- ════════════════════════════════════════════════════════════════════════════

begin;

create temp table prueba_resultado (n serial, linea text) on commit drop;
-- Para el caso 7, que corre con el rol anon.
grant insert on prueba_resultado to anon;
grant usage, select on sequence prueba_resultado_n_seq to anon;

do $$
declare
    v_insc    uuid;
    v_ajena   uuid;
    v_j1      uuid;
    v_j2      uuid;
    v_jajeno  uuid;
    v_edicion integer;
    v_r       jsonb;
    v_fallas  integer := 0;
    v_tel     text;
    v_i       integer;
    v_cuantos integer;
    v_ok      boolean;
    v_txt     text;
begin
    select edicion into v_edicion from public.nocturna_config where id = 1;

    -- ── Dos inscripciones PRUEBA ────────────────────────────────────────────
    -- Los códigos usan sólo caracteres del alfabeto real (sin 0, O, 1, I, L).
    insert into public.nocturna_inscripciones (
        edicion, codigo_entrada, adulto_nombre, adulto_apellido, adulto_dni,
        adulto_email, adulto_fecha_nacimiento, autoriza_asistencia, acepta_fotos,
        declaraciones_version, declaraciones_aceptadas_at, precio_unitario, total,
        adulto_telefono
    ) values (
        v_edicion, 'PRUEB2', 'Marcela PRUEBA', 'Gonzalez PRUEBA', '30.111.482',
        'prueba.chequeo@example.test', '1985-05-05', true, true,
        '1', now(), 50000, 100000, null
    ) returning id into v_insc;

    insert into public.nocturna_jovenes (inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu, retiro_tipo, telefono)
    values (v_insc, v_edicion, 'Tomas PRUEBA', 'Gonzalez PRUEBA', '55000001', '2010-05-05', 'Sin tribu', 'adulto', null)
    returning id into v_j1;

    insert into public.nocturna_jovenes (inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu, retiro_tipo, telefono)
    values (v_insc, v_edicion, 'Valentina PRUEBA', 'Gonzalez PRUEBA', '55000002', '2011-05-05', 'Sin tribu', 'adulto', '1155550000')
    returning id into v_j2;

    insert into public.nocturna_inscripciones (
        edicion, codigo_entrada, adulto_nombre, adulto_apellido, adulto_dni,
        adulto_email, adulto_fecha_nacimiento, autoriza_asistencia, acepta_fotos,
        declaraciones_version, declaraciones_aceptadas_at, precio_unitario, total
    ) values (
        v_edicion, 'PRUEB3', 'Ajena PRUEBA', 'Otra PRUEBA', '28999111',
        'prueba.ajena@example.test', '1980-01-01', true, true,
        '1', now(), 50000, 50000
    ) returning id into v_ajena;

    insert into public.nocturna_jovenes (inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu, retiro_tipo, telefono)
    values (v_ajena, v_edicion, 'Ajeno PRUEBA', 'Otra PRUEBA', '55000003', '2010-01-01', 'Sin tribu', 'adulto', null)
    returning id into v_jajeno;

    -- ── 1 · Código válido → sólo el nombre de pila ──────────────────────────
    v_r := public.nocturna_chequear_codigo('prueb2');   -- en minúsculas a propósito
    v_ok := (v_r ->> 'ok')::boolean
            and v_r ->> 'nombre' = 'Marcela PRUEBA'
            and not (v_r ? 'apellido') and not (v_r ? 'dni')
            and not (v_r ? 'email') and not (v_r ? 'id');
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '1 · código válido devuelve sólo el nombre — claves: '
        || (select string_agg(k, ',') from jsonb_object_keys(v_r) k));
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- ── 2 · Inexistente y formato ───────────────────────────────────────────
    v_r := public.nocturna_chequear_codigo('ZZZZZZ');
    v_ok := not (v_r ->> 'ok')::boolean and v_r ->> 'motivo' = 'no_existe';
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end || '2a · código inexistente → no_existe');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    v_ok := true;
    v_txt := '';
    foreach v_txt in array array['PRUEB0', 'PRUEBO', 'PRUEB1', 'PRUEBI', 'PRUEBL', 'PRUE', 'PRUEB22', '']
    loop
        v_r := public.nocturna_chequear_codigo(v_txt);
        if (v_r ->> 'motivo') is distinct from 'formato' then
            v_ok := false;
        end if;
    end loop;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '2b · 0/O/1/I/L, los largos raros y el vacío → formato');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- ── 3 · El DNI ──────────────────────────────────────────────────────────
    -- El DNI guardado es '30.111.482': los últimos tres dígitos son 482.
    v_r := public.nocturna_ver_entrada('PRUEB2', '482');
    v_ok := (v_r ->> 'ok')::boolean
            and v_r ->> 'id' = v_insc::text
            and v_r ->> 'codigo' = 'PRUEB2'
            and v_r ->> 'adulto' = 'Marcela PRUEBA G.'
            and jsonb_array_length(v_r -> 'jovenes') = 2
            and (v_r -> 'faltantes' ->> 'adulto_telefono')::boolean
            and jsonb_array_length(v_r -> 'faltantes' -> 'jovenes_sin_telefono') = 1;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end || '3a · DNI correcto → datos mínimos y faltantes');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    v_r := public.nocturna_ver_entrada('PRUEB2', '999');
    v_ok := not (v_r ->> 'ok')::boolean and v_r ->> 'motivo' = 'dni';
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end || '3b · DNI incorrecto → dni');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- ── 8 · Nada sensible en ninguna respuesta ──────────────────────────────
    v_txt := public.nocturna_ver_entrada('PRUEB2', '482')::text;
    v_ok := position('30.111.482' in v_txt) = 0
            and position('30111482' in v_txt) = 0
            and position('example.test' in v_txt) = 0
            and position('Gonzalez PRUEBA' in v_txt) = 0
            and position('55000001' in v_txt) = 0;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '8 · sin DNI, sin email, sin apellido completo y sin DNI de menores');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- ── 5 · Completar ───────────────────────────────────────────────────────
    v_r := public.nocturna_completar_datos(
        'PRUEB2', '482',
        '+54 9 11 6123-4567',
        jsonb_build_array(
            jsonb_build_object('id', v_j1, 'telefono', '011 15 5111-2233'),
            jsonb_build_object('id', v_j2, 'telefono', '1199999999')
        )
    );

    select adulto_telefono into v_tel from public.nocturna_inscripciones where id = v_insc;
    v_ok := (v_r ->> 'ok')::boolean and v_tel = '1161234567';
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '5a · el teléfono del adulto se guarda normalizado — quedó ' || coalesce(v_tel, 'NULL'));
    if not v_ok then v_fallas := v_fallas + 1; end if;

    select telefono into v_tel from public.nocturna_jovenes where id = v_j1;
    v_ok := v_tel = '1151112233';
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '5b · el 0 y el 15 se sacan — quedó ' || coalesce(v_tel, 'NULL'));
    if not v_ok then v_fallas := v_fallas + 1; end if;

    select telefono into v_tel from public.nocturna_jovenes where id = v_j2;
    v_ok := v_tel = '1155550000';
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '5c · el que YA tenía teléfono no se pisa — quedó ' || coalesce(v_tel, 'NULL'));
    if not v_ok then v_fallas := v_fallas + 1; end if;

    v_r := public.nocturna_completar_datos('PRUEB2', '482', '1100000000', '[]'::jsonb);
    select adulto_telefono into v_tel from public.nocturna_inscripciones where id = v_insc;
    v_ok := (v_r ->> 'ok')::boolean and v_tel = '1161234567';
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '5d · un segundo intento no cambia el que ya está — quedó ' || coalesce(v_tel, 'NULL'));
    if not v_ok then v_fallas := v_fallas + 1; end if;

    v_r := public.nocturna_completar_datos('PRUEB3', '111', '1234', '[]'::jsonb);
    v_ok := not (v_r ->> 'ok')::boolean and v_r ->> 'motivo' = 'telefono' and v_r ->> 'campo' = 'adulto';
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end || '5e · teléfono corto → telefono/adulto');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- ── 6 · Ids de otra inscripción ─────────────────────────────────────────
    v_r := public.nocturna_completar_datos(
        'PRUEB3', '111', null,
        jsonb_build_array(jsonb_build_object('id', v_jajeno, 'telefono', '1177778888')));
    select telefono into v_tel from public.nocturna_jovenes where id = v_jajeno;
    v_ok := (v_r ->> 'ok')::boolean and v_tel = '1177778888';
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end || '6a · un id propio sí se guarda');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    update public.nocturna_jovenes set telefono = null where id = v_jajeno;
    v_r := public.nocturna_completar_datos(
        'PRUEB2', '482', null,
        jsonb_build_array(jsonb_build_object('id', v_jajeno, 'telefono', '1166665555')));
    select telefono into v_tel from public.nocturna_jovenes where id = v_jajeno;
    v_ok := (v_r ->> 'ok')::boolean and v_tel is null;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '6b · un id de otra inscripción se ignora — quedó ' || coalesce(v_tel, 'NULL'));
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- ── 4 · El bloqueo ──────────────────────────────────────────────────────
    delete from public.nocturna_chequeo_intentos where codigo in ('PRUEB2', 'PRUEB3', 'ZZZZZZ');

    for v_i in 1..5 loop
        v_r := public.nocturna_ver_entrada('PRUEB2', '000');
    end loop;

    v_r := public.nocturna_ver_entrada('PRUEB2', '482');   -- con el DNI correcto
    v_ok := not (v_r ->> 'ok')::boolean
            and v_r ->> 'motivo' = 'bloqueado'
            and (v_r ->> 'segundos')::integer between 1 and 300;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '4a · 5 fallos → bloqueado, faltan ' || coalesce(v_r ->> 'segundos', '?') || ' s');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    select count(*) into v_cuantos from public.nocturna_chequeo_intentos where codigo = 'PRUEB2';
    v_r := public.nocturna_ver_entrada('PRUEB2', '111');
    v_ok := (select count(*) from public.nocturna_chequeo_intentos where codigo = 'PRUEB2') = v_cuantos;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end
        || '4b · bloqueado no suma intentos (si no, el bloqueo no terminaría nunca)');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    -- Envejecer los intentos equivale a esperar los 5 minutos.
    update public.nocturna_chequeo_intentos
       set created_at = created_at - interval '6 minutes'
     where codigo = 'PRUEB2';

    v_r := public.nocturna_ver_entrada('PRUEB2', '482');
    v_ok := (v_r ->> 'ok')::boolean;
    insert into prueba_resultado (linea) values (
        case when v_ok then 'OK  · ' else 'MAL · ' end || '4c · pasado el tiempo, vuelve a andar');
    if not v_ok then v_fallas := v_fallas + 1; end if;

    insert into prueba_resultado (linea) values (
        case when v_fallas = 0 then '───── TODO BIEN ─────' else '───── ' || v_fallas || ' CASOS MAL ─────' end);
end;
$$;

-- ── 7 · Lo que ve `anon` ────────────────────────────────────────────────────
-- Las tablas no se leen desde afuera: RLS prendida, y la de intentos además
-- sin ninguna policy y sin GRANT.

set local role anon;

do $$
declare
    v_n integer;
    v_insc text; v_jov text; v_int text;
begin
    begin
        select count(*) into v_n from public.nocturna_inscripciones;
        v_insc := v_n || ' filas';
    exception when others then v_insc := 'rechazado'; end;

    begin
        select count(*) into v_n from public.nocturna_jovenes;
        v_jov := v_n || ' filas';
    exception when others then v_jov := 'rechazado'; end;

    begin
        select count(*) into v_n from public.nocturna_chequeo_intentos;
        v_int := v_n || ' filas';
    exception when others then v_int := 'rechazado'; end;

    insert into prueba_resultado (linea) values (
        case when v_insc in ('0 filas', 'rechazado')
              and v_jov  in ('0 filas', 'rechazado')
              and v_int  in ('0 filas', 'rechazado')
             then 'OK  · ' else 'MAL · ' end
        || '7 · anon — inscripciones: ' || v_insc || ' · adolescentes: ' || v_jov || ' · intentos: ' || v_int);
end;
$$;

reset role;

select linea from prueba_resultado order by n;

-- NUNCA un commit acá.
rollback;

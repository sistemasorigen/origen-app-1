-- ════════════════════════════════════════════════════════════════════════════
-- PRUEBA de sql/nocturna_puerta_y_celular.sql
-- 2026-10-22
--
-- Se corre en el MISMO pedido que la migración (o después de aplicarla). Es un
-- solo bloque que termina SIEMPRE en RAISE EXCEPTION: todo se deshace, la
-- migración incluida si viajó junta. El mensaje es el resultado.
--
-- Todo lo que crea es PRUEBA. Para simular quién llama se escribe
-- request.jwt.claims; para que la RLS cuente, SET LOCAL ROLE authenticated.
-- Los roles de la cuenta "de la puerta" se ponen acá adentro y se deshacen.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
    v_coord   uuid;
    v_puerta  uuid;
    v_r       jsonb;
    v_insc    uuid;
    v_a uuid; v_b uuid; v_c uuid;
    v_fila    record;
    v_n       integer;
    v_mal     text[] := '{}';
    v_casos   integer := 0;
    v_adulto  jsonb := jsonb_build_object('nombre', 'Prueba', 'apellido', 'PRUEBA Celular', 'dni', '99887711',
                         'email', 'prueba.celular@example.test', 'telefono', '1155550111', 'fechaNacimiento', '1984-04-04');
begin
    -- Abiertas, por si justo están cerradas: se deshace con todo lo demás.
    update public.nocturna_config set inscripciones_abiertas = true where id = 1;

    select u.id into v_coord from public.users u
    where coalesce(u.roles, array[]::text[]) && array['SUPER_ADMIN']::text[] or u.role::text = 'SUPER_ADMIN' limit 1;
    -- Una cuenta común que, sólo dentro de esta prueba, es de la puerta.
    select u.id into v_puerta from public.users u
    where not (coalesce(u.roles, array[]::text[]) && array['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS','ACREDITACION']::text[])
      and u.role::text not in ('SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS','ACREDITACION')
    limit 1;
    update public.users set roles = array['VIEWER','ACREDITACION'] where id = v_puerta;

    -- ── 1 · Inscripción pública: "no tiene" queda guardado ──────────────────
    v_r := public.register_nocturna(jsonb_build_object(
        'adulto', v_adulto,
        'jovenes', jsonb_build_array(
            jsonb_build_object('nombre','Ana','apellido','PRUEBA Celular','dni','99881101','fechaNacimiento','2011-01-01','tribu','Sin tribu','sinCelular',true,'retiroTipo','adulto'),
            jsonb_build_object('nombre','Beto','apellido','PRUEBA Celular','dni','99881102','fechaNacimiento','2011-02-02','tribu','Garra','telefono','1155550222','retiroTipo','adulto'),
            jsonb_build_object('nombre','Ciro','apellido','PRUEBA Celular','dni','99881103','fechaNacimiento','2012-03-03','tribu','Trueno','retiroTipo','adulto')
        ),
        'autorizaAsistencia', true, 'aceptaFotos', true, 'declaracionesVersion', 'prueba', 'comprobantePath', 'PRUEBA/no-existe.jpg'));
    v_casos := v_casos + 1;
    if not coalesce((v_r ->> 'ok')::boolean, false) then
        v_mal := v_mal || ('1 alta: ' || v_r::text);
        raise exception 'RESULTADO ❌ no se pudo dar de alta la inscripción de prueba: %', v_r;
    end if;
    select id into v_insc from public.nocturna_inscripciones where adulto_dni = '99887711';
    select id into v_a from public.nocturna_jovenes where dni = '99881101';
    select id into v_b from public.nocturna_jovenes where dni = '99881102';
    select id into v_c from public.nocturna_jovenes where dni = '99881103';
    if (select sin_celular_at is null or sin_celular_por is not null from public.nocturna_jovenes where id = v_a)
       or (select sin_celular_at is not null from public.nocturna_jovenes where id = v_b)
       or (select sin_celular_at is not null from public.nocturna_jovenes where id = v_c) then
        v_mal := v_mal || '1 alta: la marca no quedó como se esperaba'::text;
    end if;

    -- 2 · La página pública ya no se lo pide a Ana (sí a Ciro)
    v_casos := v_casos + 1;
    select count(*) into v_n from public.nocturna_jovenes j
    where j.inscripcion_id = v_insc and (j.telefono is null or btrim(j.telefono) = '') and j.sin_celular_at is null;
    if v_n <> 1 then v_mal := v_mal || ('2 faltantes: ' || v_n)::text; end if;

    -- ── 3 · Sumar un chico: también ─────────────────────────────────────────
    v_r := public.nocturna_agregar_jovenes(jsonb_build_object(
        'adulto', v_adulto,
        'jovenes', jsonb_build_array(
            jsonb_build_object('nombre','Dani','apellido','PRUEBA Celular','dni','99881104','fechaNacimiento','2013-04-04','tribu','Sin tribu','sinCelular',true,'retiroTipo','adulto')),
        'autorizaAsistencia', true, 'aceptaFotos', true, 'declaracionesVersion', 'prueba', 'comprobantePath', 'PRUEBA/no-existe-2.jpg'));
    v_casos := v_casos + 1;
    if not coalesce((v_r ->> 'ok')::boolean, false)
       or (select sin_celular_at is null from public.nocturna_jovenes where dni = '99881104') then
        v_mal := v_mal || ('3 sumar: ' || v_r::text);
    end if;

    -- ── 4 · Editar desde la ficha ───────────────────────────────────────────
    -- Ana ahora tiene número (la marca se va); Ciro sigue sin número y la
    -- ficha manda "sinCelular": al editar no se marca.
    perform set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);
    v_r := public.admin_editar_nocturna(v_insc, jsonb_build_object(
        'adulto', v_adulto,
        'jovenes', jsonb_build_array(
            jsonb_build_object('id',v_a,'nombre','Ana','apellido','PRUEBA Celular','dni','99881101','fechaNacimiento','2011-01-01','tribu','Sin tribu','telefono','1155550333','retiroTipo','adulto'),
            jsonb_build_object('id',v_b,'nombre','Beto','apellido','PRUEBA Celular','dni','99881102','fechaNacimiento','2011-02-02','tribu','Garra','telefono','1155550222','retiroTipo','adulto'),
            jsonb_build_object('id',v_c,'nombre','Ciro','apellido','PRUEBA Celular','dni','99881103','fechaNacimiento','2012-03-03','tribu','Trueno','sinCelular',true,'retiroTipo','adulto'),
            jsonb_build_object('id',(select id from public.nocturna_jovenes where dni = '99881104'),'nombre','Dani','apellido','PRUEBA Celular','dni','99881104','fechaNacimiento','2013-04-04','tribu','Sin tribu','sinCelular',true,'retiroTipo','adulto')
        ),
        'autorizaAsistencia', true, 'aceptaFotos', true, 'declaracionesVersion', 'prueba'));
    v_casos := v_casos + 1;
    select
        (select sin_celular_at from public.nocturna_jovenes where id = v_a) as a,
        (select sin_celular_at from public.nocturna_jovenes where id = v_c) as c,
        (select sin_celular_at from public.nocturna_jovenes where dni = '99881104') as d
    into v_fila;
    if not coalesce((v_r ->> 'ok')::boolean, false) or v_fila.a is not null or v_fila.c is not null or v_fila.d is null then
        v_mal := v_mal || ('4 editar: ' || v_r::text || ' a=' || coalesce(v_fila.a::text,'null') || ' c=' || coalesce(v_fila.c::text,'null') || ' d=' || coalesce(v_fila.d::text,'null'));
    end if;

    -- ── 5 · El que figuraba ausente y llegó (lo que hace la puerta) ─────────
    perform set_config('request.jwt.claims', json_build_object('sub', v_puerta, 'role', 'authenticated')::text, true);
    v_r := public.set_nocturna_acreditacion(v_insc, false, array[v_a], 'sumar', null, null, array[v_c]);
    v_r := public.set_nocturna_acreditacion(v_insc, false, array[v_a, v_c], 'sumar', null, null, array[]::uuid[]);
    v_casos := v_casos + 1;
    if (select acreditado_at is null or ausente_at is not null from public.nocturna_jovenes where id = v_c) then
        v_mal := v_mal || ('5 llegó tarde: ' || v_r::text);
    end if;

    -- ── 6 · La puerta no borra ──────────────────────────────────────────────
    v_casos := v_casos + 1;
    if public.is_nocturna_coordinacion() or not public.is_nocturna_staff() then
        v_mal := v_mal || '6 roles de la puerta mal leídos'::text;
    end if;
    set local role authenticated;
    delete from public.nocturna_inscripciones where id = v_insc;
    get diagnostics v_n = row_count;
    reset role;
    v_casos := v_casos + 1;
    if v_n <> 0 or not exists (select 1 from public.nocturna_inscripciones where id = v_insc) then
        v_mal := v_mal || ('7 la puerta borró: ' || v_n)::text;
    end if;

    -- ── 8 · Coordinación sí ─────────────────────────────────────────────────
    perform set_config('request.jwt.claims', json_build_object('sub', v_coord, 'role', 'authenticated')::text, true);
    set local role authenticated;
    delete from public.nocturna_inscripciones where id = v_insc;
    get diagnostics v_n = row_count;
    reset role;
    v_casos := v_casos + 1;
    if v_n <> 1 then v_mal := v_mal || ('8 coordinación no pudo borrar: ' || v_n)::text; end if;

    -- ── 9 · Las reglas quedaron como deben ──────────────────────────────────
    v_casos := v_casos + 1;
    if exists (select 1 from pg_policies where policyname in ('nocturna_insc_delete_staff', 'nocturna_comprobantes_delete_staff'))
       or not exists (select 1 from pg_policies where policyname = 'nocturna_comprobantes_delete_coordinacion')
       or has_function_privilege('anon', 'public.is_nocturna_coordinacion()', 'execute') then
        v_mal := v_mal || '9 reglas'::text;
    end if;

    if cardinality(v_mal) = 0 then
        raise exception 'RESULTADO ✅ % casos en verde (todo deshecho)', v_casos;
    else
        raise exception 'RESULTADO ❌ % de % fallaron: %', cardinality(v_mal), v_casos, array_to_string(v_mal, ' | ');
    end if;
end;
$$;

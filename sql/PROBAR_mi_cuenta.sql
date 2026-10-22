-- ════════════════════════════════════════════════════════════════════════════
-- PRUEBAS de sql/mi_cuenta.sql — BEGIN … ROLLBACK, nada queda aplicado
-- 2026-10-22
--
-- Se corre DESPUÉS de aplicar mi_cuenta.sql. Todo adentro de una transacción
-- que termina en ROLLBACK: las filas PRUEBA, los avisos que disparan los
-- triggers y hasta el email que se "desverifica" a propósito vuelven solos.
--
-- Las personas NO se inventan: public.users tiene FK a auth.users, así que se
-- eligen tres que ya existen (una de Sistemas, una del Punto y una común) y
-- se las simula con request.jwt.claims. No se imprime ningún dato de nadie:
-- sólo el resultado de cada chequeo.
--
-- Para que las policies se apliquen hay que dejar de ser postgres: cada
-- chequeo de RLS hace `set local role authenticated` y después `reset role`.
-- Como postgres las policies ni se miran y la prueba diría que sí a todo.
-- ════════════════════════════════════════════════════════════════════════════

begin;

create temp table prueba_resultado (
    n int, paso text, ok boolean, detalle text
) on commit drop;

do $$
declare
    v_super  uuid;
    v_punto  uuid;
    v_comun  uuid;
    v_otro   uuid;
    v_email  text;

    v_venta1 uuid := gen_random_uuid();
    v_venta2 uuid := gen_random_uuid();
    v_insc1  uuid := gen_random_uuid();   -- por user_id
    v_insc2  uuid := gen_random_uuid();   -- por email verificado
    v_insc3  uuid := gen_random_uuid();   -- de otra persona
    v_ed     integer;

    v_r      jsonb;
    v_txt    text;
    v_n      integer;
    v_sol    uuid;
    v_rep    uuid;
    v_fallo  boolean;
begin
    -- ── Personas ────────────────────────────────────────────────────────────
    select id into v_super from public.users
     where (role)::text = 'SUPER_ADMIN' or coalesce(roles, '{}') && array['SUPER_ADMIN']
     order by id limit 1;

    select id into v_punto from public.users
     where ((role)::text in ('ADMIN_PUNTO', 'ENCARGADO_PUNTO', 'VOLUNTARIO_INFO')
            or coalesce(roles, '{}') && array['ADMIN_PUNTO', 'ENCARGADO_PUNTO', 'VOLUNTARIO_INFO'])
       and id <> v_super
     order by id limit 1;

    -- Común de verdad: ni Sistemas, ni Punto, ni anfitrión del Punto. Y con
    -- el email verificado, que es lo que hace falta para la prueba 6.
    select u.id, lower(btrim(a.email)) into v_comun, v_email
      from public.users u
      join auth.users a on a.id = u.id
     where a.email_confirmed_at is not null
       and coalesce(btrim(a.email), '') <> ''
       and not ((u.role)::text in ('SUPER_ADMIN', 'ADMIN_PUNTO', 'ENCARGADO_PUNTO', 'VOLUNTARIO_INFO')
                or coalesce(u.roles, '{}') && array['SUPER_ADMIN', 'ADMIN_PUNTO', 'ENCARGADO_PUNTO', 'VOLUNTARIO_INFO'])
       and not (((u.role)::text = 'ANFITRION' or u.roles && array['ANFITRION'])
                and (u.volunteer_roles && array['PUNTO'] or u.linked_group_id::text = 'PUNTO'))
     order by u.id limit 1;

    select u.id into v_otro
      from public.users u
     where u.id not in (v_super, v_punto, v_comun)
     order by u.id limit 1;

    insert into prueba_resultado values (0, 'Hay las 4 personas para simular',
        v_super is not null and v_punto is not null and v_comun is not null and v_otro is not null,
        'super/punto/comun/otro');

    select edicion into v_ed from public.nocturna_config where id = 1;

    -- ════════════════════════════════════════════════════════════════════
    -- 1 · ENTREGA DE PEDIDOS
    -- ════════════════════════════════════════════════════════════════════
    insert into public.ventas_voluntarios
        (id, codigo, user_id, nombre, apellido, telefono, email, total, unidades, comprobante_path)
    values
        (v_venta1, 'VOL-PRUA', v_comun, 'PRUEBA', 'PRUEBA', '1100000000',
         'prueba1@origen.test', 1000, 1, v_comun::text || '/prueba1.jpg'),
        (v_venta2, 'VOL-PRUB', v_comun, 'PRUEBA', 'PRUEBA', '1100000000',
         'prueba2@origen.test', 2000, 2, v_comun::text || '/prueba2.jpg');

    -- 1 · El Punto marca listo
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_punto, 'role', 'authenticated')::text, true);
    v_r := public.marcar_venta(v_venta1, 'lista');
    insert into prueba_resultado values (1, 'El Punto marca listo',
        (v_r->>'ok')::boolean and v_r->>'estado' = 'Listo', v_r::text);

    -- 2 · Le llega el aviso al comprador, con el link al detalle
    select count(*) into v_n from public.app_notifications
     where user_id = v_comun and type = 'PEDIDO_LISTO'
       and action_url = '/perfil/compras/' || v_venta1::text
       and title like '%VOL-PRUA%';
    insert into prueba_resultado values (2, 'Aviso al comprador con action_url',
        v_n = 1, v_n || ' aviso(s)');

    -- 3 · Marcarlo listo otra vez no manda un segundo aviso
    v_r := public.marcar_venta(v_venta1, 'lista');
    select count(*) into v_n from public.app_notifications
     where user_id = v_comun and type = 'PEDIDO_LISTO'
       and action_url = '/perfil/compras/' || v_venta1::text;
    insert into prueba_resultado values (3, 'Marcar dos veces no duplica el aviso',
        v_n = 1, v_n || ' aviso(s)');

    -- 4 · Un usuario común no puede marcar
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_comun, 'role', 'authenticated')::text, true);
    v_r := public.marcar_venta(v_venta2, 'lista');
    insert into prueba_resultado values (4, 'Usuario común NO puede marcar',
        (v_r->>'ok')::boolean is false and v_r->>'motivo' = 'sin_permiso', v_r::text);

    -- 5 · Retirada sin pasar por listo completa las dos, y no manda aviso
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_punto, 'role', 'authenticated')::text, true);
    v_r := public.marcar_venta(v_venta2, 'retirada');
    select count(*) into v_n from public.app_notifications
     where user_id = v_comun and action_url = '/perfil/compras/' || v_venta2::text;
    insert into prueba_resultado values (5, 'Retirada directa completa las dos fechas',
        (v_r->>'ok')::boolean
        and v_r->>'estado' = 'Retirado'
        and v_r->>'lista_at' is not null
        and v_r->>'retirada_at' is not null
        and v_n = 0,
        v_r::text || ' · avisos=' || v_n);

    -- ════════════════════════════════════════════════════════════════════
    -- 2 · MIS INSCRIPCIONES
    -- ════════════════════════════════════════════════════════════════════
    insert into public.nocturna_inscripciones
        (id, edicion, codigo_entrada, user_id, adulto_nombre, adulto_apellido, adulto_dni,
         adulto_email, adulto_fecha_nacimiento, autoriza_asistencia, acepta_fotos,
         declaraciones_version, declaraciones_aceptadas_at, precio_unitario, total, adulto_telefono)
    values
        (v_insc1, v_ed, 'PRUEBX', v_comun, 'Ada', 'PRUEBA', '90000001',
         'nada@origen.test', date '1990-01-01', true, true, '1', now(), 1, 1, '1100000001'),
        (v_insc2, v_ed, 'PRUEBY', null, 'Bea', 'PRUEBA', '90000002',
         v_email, date '1990-01-01', true, true, '1', now(), 1, 1, null),
        (v_insc3, v_ed, 'PRUEBZ', v_otro, 'Cris', 'PRUEBA', '90000003',
         'ajena@origen.test', date '1990-01-01', true, true, '1', now(), 1, 1, '1100000003');

    insert into public.nocturna_jovenes
        (id, inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu,
         retiro_tipo, retiro_nombre, retiro_apellido, retiro_dni, retiro_telefono, restriccion)
    values
        (gen_random_uuid(), v_insc1, v_ed, 'Tomas', 'PRUEBA', '55000001', date '2010-05-05',
         'Sin tribu', 'adulto', null, null, null, null, 'ninguna'),
        (gen_random_uuid(), v_insc1, v_ed, 'Valentina', 'PRUEBA', '55000002', date '2010-05-05',
         'Sin tribu', 'otra_persona', 'Juan', 'Perez', '28000000', '1155551111', 'ninguna');

    -- 6 · Aparece la propia por user_id, y la del email verificado
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_comun, 'role', 'authenticated')::text, true);
    v_r := public.mis_inscripciones_eventos();
    insert into prueba_resultado values (6, 'Mis inscripciones: por user_id y por email verificado',
        (select count(*) from jsonb_array_elements(v_r) e
          where e->>'id' in (v_insc1::text, v_insc2::text)) = 2
        and (select count(*) from jsonb_array_elements(v_r) e
              where e->>'id' = v_insc3::text) = 0,
        'trajo ' || jsonb_array_length(v_r) || ', ninguna ajena');

    -- 7 · Con el email SIN verificar, la del email desaparece
    update auth.users set email_confirmed_at = null where id = v_comun;
    v_r := public.mis_inscripciones_eventos();
    insert into prueba_resultado values (7, 'Email NO verificado: la del email no aparece',
        (select count(*) from jsonb_array_elements(v_r) e where e->>'id' = v_insc2::text) = 0
        and (select count(*) from jsonb_array_elements(v_r) e where e->>'id' = v_insc1::text) = 1,
        'queda sólo la que tiene user_id');

    -- 8 · Y su detalle tampoco se puede abrir
    v_r := public.mi_inscripcion_detalle(v_insc2);
    insert into prueba_resultado values (8, 'Detalle por email sin verificar: no_existe',
        (v_r->>'ok')::boolean is false and v_r->>'motivo' = 'no_existe', v_r::text);

    update auth.users set email_confirmed_at = now() where id = v_comun;

    -- 9 · El detalle ajeno no existe
    v_r := public.mi_inscripcion_detalle(v_insc3);
    insert into prueba_resultado values (9, 'Detalle ajeno: no_existe',
        (v_r->>'ok')::boolean is false and v_r->>'motivo' = 'no_existe', v_r::text);

    -- 10 · El detalle propio no trae DNI ni datos de terceros
    v_r := public.mi_inscripcion_detalle(v_insc1);
    v_txt := v_r::text;
    insert into prueba_resultado values (10, 'El detalle no filtra DNI, teléfono ni apellido de terceros',
        (v_r->>'ok')::boolean
        and v_txt not like '%90000001%'     -- DNI del adulto
        and v_txt not like '%55000001%'     -- DNI del adolescente
        and v_txt not like '%28000000%'     -- DNI de quien retira
        and v_txt not like '%1155551111%'   -- su teléfono
        and v_txt not like '%Perez%'        -- su apellido entero
        and v_txt like '%Juan P.%'          -- sí: nombre e inicial
        and v_txt like '%"nombre": "Tomas"%',  -- sí: nombre de pila
        'sin DNI ni teléfonos de terceros');

    -- 11 · Trae los faltantes con la misma regla que nocturna_ver_entrada
    insert into prueba_resultado values (11, 'Faltantes: adulto con teléfono, 2 adolescentes sin',
        (v_r->'faltantes'->>'adulto_telefono')::boolean is false
        and jsonb_array_length(v_r->'faltantes'->'jovenes_sin_telefono') = 2,
        (v_r->'faltantes')::text);

    -- ════════════════════════════════════════════════════════════════════
    -- 3 · SOLICITUDES DE DATOS
    -- ════════════════════════════════════════════════════════════════════
    -- El alta va por RPC. Un `insert ... returning` desde el cliente NO anda:
    -- el RETURNING exige pasar tambien la policy de SELECT, y la persona no
    -- tiene lectura sobre esta tabla a proposito (por la nota_interna).
    v_r := public.crear_solicitud_datos('acceso', 'PRUEBA: quiero una copia');
    v_sol := (v_r->>'id')::uuid;
    insert into prueba_resultado values (12, 'Crea su solicitud y recibe el numero',
        (v_r->>'ok')::boolean and v_sol is not null
        and v_r->>'numero' ~ '^[0-9]{4}$',
        v_r::text);

    -- 13 · La ve, sin nota_interna
    update public.solicitudes_datos set nota_interna = 'PRUEBA interna' where id = v_sol;
    v_r := public.mis_solicitudes_datos();
    insert into prueba_resultado values (13, 'Ve la suya y NO ve nota_interna',
        (select count(*) from jsonb_array_elements(v_r) e where e->>'id' = v_sol::text) = 1
        and v_r::text not like '%nota_interna%'
        and v_r::text not like '%PRUEBA interna%',
        'sin nota_interna');

    -- 14 · Otro no la ve, ni por RPC ni por la tabla
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_otro, 'role', 'authenticated')::text, true);
    v_r := public.mis_solicitudes_datos();
    set local role authenticated;
    select count(*) into v_n from public.solicitudes_datos where id = v_sol;
    reset role;
    insert into prueba_resultado values (14, 'Otra persona no la ve (ni RPC ni tabla)',
        (select count(*) from jsonb_array_elements(v_r) e where e->>'id' = v_sol::text) = 0
        and v_n = 0,
        'RPC vacía y la tabla no la deja ver');

    -- 15 · Una segunda de acceso antes de los 6 meses falla
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_comun, 'role', 'authenticated')::text, true);
    v_r := public.crear_solicitud_datos('acceso');
    insert into prueba_resultado values (15, 'Segunda de acceso antes de 6 meses: rechazada',
        (v_r->>'ok')::boolean is false
        and v_r->>'motivo' = 'limite_6_meses'
        and v_r->>'detalle' like '%6 meses%',
        left(coalesce(v_r->>'detalle', ''), 90));

    -- 16 · Pero una de otro tipo sí entra
    v_r := public.crear_solicitud_datos('supresion', null, 'PRUEBA: ya no voy a Origen');
    select count(*) into v_n from public.solicitudes_datos
     where user_id = v_comun and tipo = 'supresion';
    insert into prueba_resultado values (16, 'Una supresion si entra',
        (v_r->>'ok')::boolean and v_n = 1, v_n || ' fila(s)');

    -- 16b · Un tipo inventado, no
    v_r := public.crear_solicitud_datos('lo_que_sea');
    insert into prueba_resultado values (161, 'Un tipo inventado: rechazado',
        (v_r->>'ok')::boolean is false and v_r->>'motivo' = 'tipo_invalido', v_r::text);

    -- 17 · No se puede nacer en otro estado que no sea 'recibida'
    v_fallo := false;
    begin
        set local role authenticated;
        insert into public.solicitudes_datos (tipo, estado) values ('rectificacion', 'resuelta');
        reset role;
    exception when others then v_fallo := true;
    end;
    reset role;
    insert into prueba_resultado values (17, 'No puede crearla ya resuelta',
        v_fallo, 'rechazado por la policy');

    -- 17b · Ni a nombre de otra persona
    v_fallo := false;
    begin
        set local role authenticated;
        insert into public.solicitudes_datos (user_id, tipo) values (v_otro, 'rectificacion');
        reset role;
    exception when others then v_fallo := true;
    end;
    reset role;
    insert into prueba_resultado values (171, 'No puede crearla a nombre de otro',
        v_fallo and (select count(*) from public.solicitudes_datos where user_id = v_otro) = 0,
        'rechazado por la policy');

    -- 18 · Sistemas las ve todas y las resuelve
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from public.solicitudes_datos where id = v_sol;
    update public.solicitudes_datos
       set estado = 'resuelta', resuelta_at = now(), resuelta_por = v_super,
           nota_interna = 'PRUEBA: resuelta'
     where id = v_sol;
    reset role;
    insert into prueba_resultado values (18, 'SUPER_ADMIN ve todas y resuelve',
        v_n = 1
        and (select estado from public.solicitudes_datos where id = v_sol) = 'resuelta',
        've ' || v_n || ' y la resolvió');

    -- 19 · Nadie borra
    v_fallo := false;
    begin
        set local role authenticated;
        delete from public.solicitudes_datos where id = v_sol;
        reset role;
        if (select count(*) from public.solicitudes_datos where id = v_sol) = 0 then
            v_fallo := false;
        else
            v_fallo := true;   -- no borró: es lo que queremos
        end if;
    exception when others then v_fallo := true;
    end;
    reset role;
    insert into prueba_resultado values (19, 'Ni Sistemas puede borrar una solicitud',
        v_fallo and (select count(*) from public.solicitudes_datos where id = v_sol) = 1,
        'la fila sigue');

    -- 20 · A Sistemas le llegó el aviso, con el número formateado
    select numero into v_n from public.solicitudes_datos where id = v_sol;
    insert into prueba_resultado values (20, 'Aviso a cada SUPER_ADMIN con el N.º',
        (select count(*) from public.app_notifications
          where type = 'SOLICITUD_DATOS'
            and title = 'Nueva solicitud de datos N.º ' || lpad(v_n::text, 4, '0'))
        = (select count(*) from public.users
            where (role)::text = 'SUPER_ADMIN' or coalesce(roles, '{}') && array['SUPER_ADMIN']),
        'un aviso por cada Sistemas');

    -- ════════════════════════════════════════════════════════════════════
    -- 4 · REPORTES DE PROBLEMAS
    -- ════════════════════════════════════════════════════════════════════
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_comun, 'role', 'authenticated')::text, true);

    v_r := public.crear_reporte_problema(
        'PRUEBA: el boton no hace nada', 'Mi cuenta',
        v_comun::text || '/captura.jpg', '2.14.0', 'Android 14 - Chrome 130');
    v_rep := (v_r->>'id')::uuid;

    update public.reportes_problemas set nota_interna = 'PRUEBA interna' where id = v_rep;
    v_r := public.mis_reportes();
    insert into prueba_resultado values (21, 'Crea su reporte y lo ve sin nota_interna',
        v_rep is not null
        and (select count(*) from jsonb_array_elements(v_r) e where e->>'id' = v_rep::text) = 1
        and v_r::text not like '%PRUEBA interna%',
        'ok');

    -- 22 · Vacio: lo rechaza la RPC y tambien el check de la tabla
    v_r := public.crear_reporte_problema('   ');
    v_fallo := false;
    begin
        set local role authenticated;
        insert into public.reportes_problemas (descripcion) values ('   ');
        reset role;
    exception when others then v_fallo := true;
    end;
    reset role;
    insert into prueba_resultado values (22, 'Descripcion vacia: la frenan la RPC y el check',
        (v_r->>'ok')::boolean is false and v_r->>'motivo' = 'sin_descripcion' and v_fallo,
        'RPC y check');

    -- 22b · Una captura en la carpeta de otro ni siquiera se guarda en la fila
    v_r := public.crear_reporte_problema('PRUEBA: con captura ajena', 'Otra',
        v_otro::text || '/robada.jpg');
    insert into prueba_resultado values (221, 'Captura de carpeta ajena: rechazada',
        (v_r->>'ok')::boolean is false and v_r->>'motivo' = 'captura_ajena', v_r::text);

    -- 23 · Otro no lo ve
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_otro, 'role', 'authenticated')::text, true);
    v_r := public.mis_reportes();
    set local role authenticated;
    select count(*) into v_n from public.reportes_problemas where id = v_rep;
    reset role;
    insert into prueba_resultado values (23, 'Otra persona no ve el reporte',
        (select count(*) from jsonb_array_elements(v_r) e where e->>'id' = v_rep::text) = 0
        and v_n = 0, 'ni RPC ni tabla');

    -- 24 · Sistemas lo ve y lo marca visto
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_super, 'role', 'authenticated')::text, true);
    set local role authenticated;
    select count(*) into v_n from public.reportes_problemas where id = v_rep;
    update public.reportes_problemas set estado = 'visto' where id = v_rep;
    reset role;
    insert into prueba_resultado values (24, 'SUPER_ADMIN ve el reporte y lo marca visto',
        v_n = 1 and (select estado from public.reportes_problemas where id = v_rep) = 'visto',
        'ok');

    -- 25 · Aviso a Sistemas
    select numero into v_n from public.reportes_problemas where id = v_rep;
    insert into prueba_resultado values (25, 'Aviso del reporte a cada SUPER_ADMIN',
        (select count(*) from public.app_notifications
          where type = 'REPORTE_PROBLEMA'
            and title = 'Problema reportado N.º ' || lpad(v_n::text, 4, '0'))
        = (select count(*) from public.users
            where (role)::text = 'SUPER_ADMIN' or coalesce(roles, '{}') && array['SUPER_ADMIN']),
        'ok');

    -- 26 · La captura va a la carpeta propia y no a la ajena
    perform set_config('request.jwt.claims',
        json_build_object('sub', v_comun, 'role', 'authenticated')::text, true);

    v_fallo := false;
    begin
        set local role authenticated;
        insert into storage.objects (bucket_id, name, owner)
        values ('reportes-capturas', v_otro::text || '/robada.jpg', v_comun);
        reset role;
    exception when others then v_fallo := true;
    end;
    reset role;

    v_n := 0;
    begin
        set local role authenticated;
        insert into storage.objects (bucket_id, name, owner)
        values ('reportes-capturas', v_comun::text || '/propia.jpg', v_comun);
        reset role;
        v_n := 1;
    exception when others then
        reset role;
        v_n := 0;
    end;
    reset role;

    insert into prueba_resultado values (26, 'Captura: carpeta ajena rechazada, propia aceptada',
        v_fallo and v_n = 1, 'ajena ✗ · propia ✓');

end $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 27 · ANON: nada de nada
-- ════════════════════════════════════════════════════════════════════════════
insert into prueba_resultado
select 27, 'anon no puede ejecutar ninguna RPC nueva',
       not bool_or(puede), string_agg(f || '=' || puede::text, ' · ')
  from (
    select 'marcar_venta' as f,
           has_function_privilege('anon', 'public.marcar_venta(uuid, text)', 'execute') as puede
    union all select 'mis_inscripciones_eventos',
           has_function_privilege('anon', 'public.mis_inscripciones_eventos()', 'execute')
    union all select 'mi_inscripcion_detalle',
           has_function_privilege('anon', 'public.mi_inscripcion_detalle(uuid)', 'execute')
    union all select 'mis_solicitudes_datos',
           has_function_privilege('anon', 'public.mis_solicitudes_datos()', 'execute')
    union all select 'mis_reportes',
           has_function_privilege('anon', 'public.mis_reportes()', 'execute')
    union all select 'crear_solicitud_datos',
           has_function_privilege('anon', 'public.crear_solicitud_datos(text, text, text)', 'execute')
    union all select 'crear_reporte_problema',
           has_function_privilege('anon', 'public.crear_reporte_problema(text, text, text, text, text)', 'execute')
  ) q;

insert into prueba_resultado
select 28, 'anon no puede tocar las tablas nuevas',
       not bool_or(puede), string_agg(t || '/' || p || '=' || puede::text, ' · ')
  from (
    select 'solicitudes_datos' as t, p, has_table_privilege('anon', 'public.solicitudes_datos', p) as puede
      from unnest(array['select', 'insert', 'update', 'delete']) p
    union all
    select 'reportes_problemas', p, has_table_privilege('anon', 'public.reportes_problemas', p)
      from unnest(array['select', 'insert', 'update', 'delete']) p
  ) q;

insert into prueba_resultado
select 29, 'authenticated sí puede, pero sin DELETE',
       has_table_privilege('authenticated', 'public.solicitudes_datos', 'insert')
       and has_table_privilege('authenticated', 'public.solicitudes_datos', 'select')
       and not has_table_privilege('authenticated', 'public.solicitudes_datos', 'delete')
       and has_table_privilege('authenticated', 'public.reportes_problemas', 'insert')
       and not has_table_privilege('authenticated', 'public.reportes_problemas', 'delete'),
       'insert/select sí, delete no';

-- ════════════════════════════════════════════════════════════════════════════
select n, case when ok then 'OK  ' else 'FALLA' end as r, paso, detalle
  from prueba_resultado order by n;

select count(*) filter (where not ok) as fallas, count(*) as total from prueba_resultado;

rollback;

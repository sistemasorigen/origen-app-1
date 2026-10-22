-- ════════════════════════════════════════════════════════════════════════════
-- MI CUENTA — la base que necesitan las 5 pantallas
-- 2026-10-22
--
-- Cuatro cosas, en este orden:
--   1 · Entrega de pedidos de /voluntarios (Pagado → Listo → Retirado)
--   2 · Mis inscripciones a eventos (sólo lectura de lo propio)
--   3 · Solicitudes de datos (Ley 25.326)
--   4 · Reportes de problemas
--
-- DÓNDE VAN LOS AVISOS. El prompt decía "tabla notifications, como hacen los
-- triggers existentes". Son dos tablas distintas y la vieja no sirve:
--   · public.notifications      — 1007 filas, la usan dos triggers viejos,
--                                 NO tiene action_url y NADIE la lee: el
--                                 centro de notificaciones (NotificationContext)
--                                 no la consulta.
--   · public.app_notifications  — 1968 filas, tiene action_url, y es la que
--                                 leen la campana y el menú.
-- Se escribe en app_notifications: en la vieja, el aviso existiría sin que
-- nadie lo vea nunca. El formato (un INSERT por persona, recorriendo los
-- roles) sí se copia de notify_admins_on_new_group.
--
-- TODO lo que lee datos de otro va por RPC SECURITY DEFINER que devuelve lo
-- mínimo. Ninguna policy nueva para anon.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ════════════════════════════════════════════════════════════════════════════
-- 1 · ENTREGA DE PEDIDOS
-- ════════════════════════════════════════════════════════════════════════════

alter table public.ventas_voluntarios
    add column if not exists lista_at     timestamptz,
    add column if not exists lista_por    uuid references public.users(id),
    add column if not exists retirada_at  timestamptz,
    add column if not exists retirada_por uuid references public.users(id);

comment on column public.ventas_voluntarios.lista_at is
    'Cuándo el Punto marcó el pedido listo para retirar. NULL = todavía no.';
comment on column public.ventas_voluntarios.lista_por is
    'Quién lo marcó listo.';
comment on column public.ventas_voluntarios.retirada_at is
    'Cuándo se lo llevaron. NULL = todavía está en el Punto.';
comment on column public.ventas_voluntarios.retirada_por is
    'Quién lo entregó.';

-- Los pendientes de entregar son los que el Punto mira todo el tiempo.
create index if not exists idx_ventas_voluntarios_pendientes
    on public.ventas_voluntarios (lista_at)
 where retirada_at is null;

/**
 * El estado de un pedido, derivado. No hay columna `estado`: dos fechas
 * alcanzan y no se pueden contradecir entre sí.
 */
create or replace function public.estado_venta(
    p_lista_at timestamptz,
    p_retirada_at timestamptz
) returns text
language sql
immutable
as $$
    select case
        when p_retirada_at is not null then 'Retirado'
        when p_lista_at is not null then 'Listo'
        else 'Pagado'
    end;
$$;

comment on function public.estado_venta(timestamptz, timestamptz) is
    'Pagado → Listo → Retirado, a partir de las dos fechas de la venta.';

/**
 * El Punto marca un pedido listo o retirado.
 *
 * Es idempotente: volver a marcar lo que ya está marcado no cambia la fecha
 * ni manda un segundo aviso. En la mesa, el mismo pedido se escanea dos veces
 * más seguido de lo que parece.
 *
 * Marcar 'retirada' sobre un pedido que nunca se marcó listo completa las
 * dos fechas: lo que pasó es que se lo llevaron, y un pedido retirado que
 * nunca estuvo listo no es un estado que exista. En ese caso NO se manda el
 * aviso de "está listo": la persona lo tiene en la mano.
 */
create or replace function public.marcar_venta(
    p_id uuid,
    p_estado text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_venta record;
    v_aviso boolean := false;
begin
    if not public.atiende_el_punto() then
        return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    end if;

    if p_estado is null or p_estado not in ('lista', 'retirada') then
        return jsonb_build_object('ok', false, 'motivo', 'estado_invalido');
    end if;

    select id, codigo, user_id, lista_at, retirada_at
      into v_venta
      from public.ventas_voluntarios
     where id = p_id
       for update;

    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    if p_estado = 'lista' then
        if v_venta.lista_at is null then
            update public.ventas_voluntarios
               set lista_at = now(), lista_por = v_uid
             where id = p_id;
            v_aviso := true;
        end if;
    else
        if v_venta.retirada_at is null then
            update public.ventas_voluntarios
               set retirada_at = now(),
                   retirada_por = v_uid,
                   -- Se lo llevó: si nunca se marcó listo, lo estuvo igual.
                   lista_at = coalesce(lista_at, now()),
                   lista_por = coalesce(lista_por, v_uid)
             where id = p_id;
        end if;
    end if;

    if v_aviso and v_venta.user_id is not null then
        insert into public.app_notifications (user_id, title, message, type, action_url)
        values (
            v_venta.user_id,
            'Tu pedido ' || v_venta.codigo || ' está listo',
            'Retiralo en el Punto de Información.',
            'PEDIDO_LISTO',
            '/perfil/compras/' || p_id::text
        );
    end if;

    select lista_at, retirada_at into v_venta
      from public.ventas_voluntarios where id = p_id;

    return jsonb_build_object(
        'ok', true,
        'estado', public.estado_venta(v_venta.lista_at, v_venta.retirada_at),
        'lista_at', v_venta.lista_at,
        'retirada_at', v_venta.retirada_at
    );
end;
$$;

comment on function public.marcar_venta(uuid, text) is
    'El Punto marca un pedido listo o retirado. Sólo atiende_el_punto().';

-- ════════════════════════════════════════════════════════════════════════════
-- 2 · MIS INSCRIPCIONES A EVENTOS
-- ════════════════════════════════════════════════════════════════════════════

-- Cuándo es el evento. Hasta hoy vivía repartido en el código
-- (services/reportesNocturna.ts, ChequearEntrada.tsx, la declaración del
-- formulario), así que la pantalla no tenía de dónde leerlo.
alter table public.nocturna_config
    add column if not exists evento_fecha date,
    add column if not exists evento_hora  time;

comment on column public.nocturna_config.evento_fecha is
    'El día del evento de esta edición. Lo usa Mi cuenta para decir si ya pasó.';
comment on column public.nocturna_config.evento_hora is
    'La hora de comienzo.';

update public.nocturna_config
   set evento_fecha = coalesce(evento_fecha, date '2026-10-30'),
       evento_hora  = coalesce(evento_hora, time '22:00')
 where id = 1;

/**
 * A qué le pertenece una inscripción de Nocturna.
 *
 * Dos caminos, y el segundo tiene candado: muchas familias se inscribieron
 * sin cuenta, así que la inscripción no tiene user_id y lo único que las ata
 * a la persona es el email. Por eso ese camino exige que el email de la
 * cuenta esté VERIFICADO: si no, cualquiera que se registre escribiendo el
 * email de otro vería las inscripciones ajenas, con los datos de sus hijos.
 */
create or replace function public.nocturna_email_verificado()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select case when u.email_confirmed_at is not null
                then lower(btrim(u.email))
                else null end
      from auth.users u
     where u.id = auth.uid();
$$;

comment on function public.nocturna_email_verificado() is
    'El email de la cuenta, sólo si está verificado. NULL si no lo está.';

/**
 * Las inscripciones a eventos de quien está mirando.
 *
 * Devuelve una lista; vacía si no tiene ninguna. Nada de otra persona.
 */
create or replace function public.mis_inscripciones_eventos()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_email text;
    v_cfg record;
    v_hoy date;
    v_salida jsonb;
begin
    if v_uid is null then
        return '[]'::jsonb;
    end if;

    v_email := public.nocturna_email_verificado();
    select edicion, evento_fecha, evento_hora into v_cfg
      from public.nocturna_config where id = 1;
    v_hoy := (now() at time zone 'America/Argentina/Buenos_Aires')::date;

    select coalesce(jsonb_agg(x order by x->>'fecha' desc nulls last), '[]'::jsonb)
      into v_salida
      from (
        select jsonb_build_object(
                   'id', i.id,
                   'evento', 'Nocturna ' || i.edicion::text,
                   'edicion', i.edicion,
                   'fecha', case when i.edicion = v_cfg.edicion then v_cfg.evento_fecha end,
                   'hora',  case when i.edicion = v_cfg.edicion then to_char(v_cfg.evento_hora, 'HH24:MI') end,
                   'adolescentes', (select count(*) from public.nocturna_jovenes j
                                     where j.inscripcion_id = i.id),
                   'estado', case
                       when i.edicion <> v_cfg.edicion then 'pasado'
                       when v_cfg.evento_fecha is null then null
                       when v_cfg.evento_fecha > v_hoy then 'proximo'
                       when v_cfg.evento_fecha = v_hoy then 'hoy'
                       else 'pasado' end
               ) as x
          from public.nocturna_inscripciones i
         where i.user_id = v_uid
            or (v_email is not null and lower(btrim(i.adulto_email)) = v_email)
      ) q;

    return v_salida;
end;
$$;

comment on function public.mis_inscripciones_eventos() is
    'Las inscripciones a eventos de auth.uid(). Por email sólo si está verificado.';

/**
 * El detalle de UNA inscripción propia.
 *
 * Lo mínimo para dibujar la entrada:
 *   · del adulto, su nombre (es quien está mirando),
 *   · de cada adolescente, su NOMBRE DE PILA y cómo se retira,
 *   · de quien lo retira, si es otra persona, nombre e inicial.
 * Ni un DNI, ni un email, ni un teléfono de nadie.
 */
create or replace function public.mi_inscripcion_detalle(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_email text;
    v_cfg record;
    v_hoy date;
    v_i record;
    v_jovenes jsonb;
    v_sin_tel jsonb;
begin
    if v_uid is null or p_id is null then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    v_email := public.nocturna_email_verificado();

    select i.* into v_i
      from public.nocturna_inscripciones i
     where i.id = p_id
       and (i.user_id = v_uid
            or (v_email is not null and lower(btrim(i.adulto_email)) = v_email));

    -- Ajena o inexistente dan lo mismo: no se le dice a nadie que existe.
    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    select edicion, evento_fecha, evento_hora into v_cfg
      from public.nocturna_config where id = 1;
    v_hoy := (now() at time zone 'America/Argentina/Buenos_Aires')::date;

    select coalesce(jsonb_agg(
               jsonb_build_object(
                   'nombre', split_part(btrim(j.nombre), ' ', 1),
                   'retiro_tipo', j.retiro_tipo,
                   'retira', case
                       when j.retiro_tipo = 'otra_persona'
                            and coalesce(btrim(j.retiro_nombre), '') <> ''
                       then btrim(j.retiro_nombre)
                            || case when coalesce(btrim(j.retiro_apellido), '') <> ''
                                    then ' ' || left(btrim(j.retiro_apellido), 1) || '.'
                                    else '' end
                       end,
                   'acreditado_at', j.acreditado_at,
                   'retirado_at', j.retirado_at,
                   'ausente_at', j.ausente_at
               ) order by j.nombre), '[]'::jsonb)
      into v_jovenes
      from public.nocturna_jovenes j
     where j.inscripcion_id = v_i.id;

    -- Los mismos faltantes que nocturna_ver_entrada, con la misma regla:
    -- el que el staff marcó "no tiene celular" no falta, la respuesta está.
    select coalesce(jsonb_agg(split_part(btrim(j.nombre), ' ', 1) order by j.nombre), '[]'::jsonb)
      into v_sin_tel
      from public.nocturna_jovenes j
     where j.inscripcion_id = v_i.id
       and (j.telefono is null or btrim(j.telefono) = '')
       and j.sin_celular_at is null;

    return jsonb_build_object(
        'ok', true,
        'id', v_i.id,
        'codigo_entrada', v_i.codigo_entrada,
        'evento', 'Nocturna ' || v_i.edicion::text,
        'edicion', v_i.edicion,
        'fecha', case when v_i.edicion = v_cfg.edicion then v_cfg.evento_fecha end,
        'hora',  case when v_i.edicion = v_cfg.edicion then to_char(v_cfg.evento_hora, 'HH24:MI') end,
        'estado', case
            when v_i.edicion <> v_cfg.edicion then 'pasado'
            when v_cfg.evento_fecha is null then null
            when v_cfg.evento_fecha > v_hoy then 'proximo'
            when v_cfg.evento_fecha = v_hoy then 'hoy'
            else 'pasado' end,
        'adulto', btrim(v_i.adulto_nombre) || ' ' || btrim(v_i.adulto_apellido),
        'jovenes', v_jovenes,
        'faltantes', jsonb_build_object(
            'adulto_telefono', (v_i.adulto_telefono is null or btrim(v_i.adulto_telefono) = ''),
            'jovenes_sin_telefono', v_sin_tel
        )
    );
end;
$$;

comment on function public.mi_inscripcion_detalle(uuid) is
    'El detalle de una inscripción propia. Sin DNI ni datos de terceros.';

-- ════════════════════════════════════════════════════════════════════════════
-- 3 · SOLICITUDES DE DATOS (Ley 25.326)
-- ════════════════════════════════════════════════════════════════════════════

create sequence if not exists public.solicitudes_datos_numero_seq as integer start 1;

create table if not exists public.solicitudes_datos (
    id           uuid primary key default gen_random_uuid(),
    -- Una sola serie para los tres tipos: el diseño numera 0039, 0041, 0042…
    numero       integer not null unique
                 default nextval('public.solicitudes_datos_numero_seq'),
    user_id      uuid not null default auth.uid() references public.users(id),
    tipo         text not null check (tipo in ('acceso', 'rectificacion', 'supresion')),
    mensaje      text check (mensaje is null or char_length(mensaje) <= 1000),
    -- Sólo para la supresión: por qué se va. Es opcional, lo dice la pantalla.
    motivo       text check (motivo is null or char_length(motivo) <= 1000),
    estado       text not null default 'recibida'
                 check (estado in ('recibida', 'en_curso', 'resuelta')),
    created_at   timestamptz not null default now(),
    resuelta_at  timestamptz,
    resuelta_por uuid references public.users(id),
    -- Lo que escribe Sistemas para sí mismo. NO se le muestra a la persona:
    -- por eso lo propio se lee por RPC y no por policy.
    nota_interna text
);

comment on table public.solicitudes_datos is
    'Pedidos de acceso, rectificación o supresión de datos (Ley 25.326).';

create index if not exists idx_solicitudes_datos_mias
    on public.solicitudes_datos (user_id, created_at desc);
create index if not exists idx_solicitudes_datos_abiertas
    on public.solicitudes_datos (created_at desc)
 where estado <> 'resuelta';

alter table public.solicitudes_datos enable row level security;

-- La persona crea las suyas, y siempre nacen 'recibida': el estado lo mueve
-- Sistemas, no quien pide.
drop policy if exists solicitudes_datos_insert_propia on public.solicitudes_datos;
create policy solicitudes_datos_insert_propia
    on public.solicitudes_datos for insert to authenticated
    with check (user_id = auth.uid() and estado = 'recibida');

-- Leer lo propio NO va por policy: la fila tiene nota_interna. Va por
-- public.mis_solicitudes_datos(), que la deja afuera.
drop policy if exists solicitudes_datos_select_admin on public.solicitudes_datos;
create policy solicitudes_datos_select_admin
    on public.solicitudes_datos for select to authenticated
    using (public.check_is_super_admin());

drop policy if exists solicitudes_datos_update_admin on public.solicitudes_datos;
create policy solicitudes_datos_update_admin
    on public.solicitudes_datos for update to authenticated
    using (public.check_is_super_admin())
    with check (public.check_is_super_admin());

-- Sin policy de DELETE: nadie borra una solicitud, ni Sistemas. Es la
-- constancia de que la persona ejerció su derecho.

/**
 * El acceso es gratis cada 6 meses (art. 14 de la 25.326). Antes de eso, el
 * insert falla con un texto que la pantalla puede mostrar tal cual.
 */
create or replace function public.solicitudes_datos_limite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_previa timestamptz;
begin
    if new.tipo <> 'acceso' then
        return new;
    end if;

    select max(created_at) into v_previa
      from public.solicitudes_datos
     where user_id = new.user_id
       and tipo = 'acceso';

    if v_previa is not null and v_previa > now() - interval '6 months' then
        raise exception
            'Ya pediste una copia de tus datos el %. El acceso es gratis una vez cada 6 meses: vas a poder pedirla de nuevo a partir del %.',
            to_char(v_previa at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY'),
            to_char((v_previa + interval '6 months') at time zone 'America/Argentina/Buenos_Aires', 'DD/MM/YYYY')
            using errcode = 'check_violation';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_solicitudes_datos_limite on public.solicitudes_datos;
create trigger trg_solicitudes_datos_limite
    before insert on public.solicitudes_datos
    for each row execute function public.solicitudes_datos_limite();

/**
 * Avisarle a Sistemas. Un INSERT por persona, como notify_admins_on_new_group.
 */
create or replace function public.solicitudes_datos_avisar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_admin record;
    v_tipo text := case new.tipo
        when 'acceso' then 'Acceso a mis datos'
        when 'rectificacion' then 'Corrección de datos'
        else 'Eliminar mi cuenta' end;
begin
    for v_admin in
        select id from public.users
         where (role)::text = 'SUPER_ADMIN'
            or coalesce(roles, '{}') && array['SUPER_ADMIN']
    loop
        insert into public.app_notifications (user_id, title, message, type, action_url)
        values (
            v_admin.id,
            'Nueva solicitud de datos N.º ' || lpad(new.numero::text, 4, '0'),
            v_tipo,
            'SOLICITUD_DATOS',
            '/panel-admin/solicitudes-datos'
        );
    end loop;
    return null;
end;
$$;

drop trigger if exists trg_solicitudes_datos_avisar on public.solicitudes_datos;
create trigger trg_solicitudes_datos_avisar
    after insert on public.solicitudes_datos
    for each row execute function public.solicitudes_datos_avisar();

/**
 * Las solicitudes propias, sin nota_interna.
 */
create or replace function public.mis_solicitudes_datos()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(jsonb_agg(
               jsonb_build_object(
                   'id', s.id,
                   'numero', lpad(s.numero::text, 4, '0'),
                   'tipo', s.tipo,
                   'estado', s.estado,
                   'mensaje', s.mensaje,
                   'motivo', s.motivo,
                   'created_at', s.created_at,
                   'resuelta_at', s.resuelta_at
               ) order by s.created_at desc), '[]'::jsonb)
      from public.solicitudes_datos s
     where auth.uid() is not null
       and s.user_id = auth.uid();
$$;

comment on function public.mis_solicitudes_datos() is
    'Las solicitudes de auth.uid(), sin nota_interna.';

/**
 * Crear una solicitud, y saber con que numero quedo.
 *
 * POR QUE NO SE INSERTA DESDE LA APP. La fila tiene nota_interna, asi que la
 * persona NO tiene policy de SELECT sobre la tabla. Y un
 * `insert ... returning` exige que la fila pase tambien la policy de lectura:
 * desde el cliente, el alta con `.select()` encadenado falla con "new row
 * violates row-level security policy", que no dice nada de todo esto. Por
 * eso el alta va por aca, que devuelve el numero sin abrir la lectura.
 *
 * Y de paso el limite de 6 meses sale como un motivo que la pantalla puede
 * mostrar, en vez de como una excepcion de Postgres.
 */
create or replace function public.crear_solicitud_datos(
    p_tipo text,
    p_mensaje text default null,
    p_motivo text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_id uuid;
    v_numero integer;
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    end if;
    if p_tipo is null or p_tipo not in ('acceso', 'rectificacion', 'supresion') then
        return jsonb_build_object('ok', false, 'motivo', 'tipo_invalido');
    end if;
    if p_mensaje is not null and char_length(p_mensaje) > 1000 then
        return jsonb_build_object('ok', false, 'motivo', 'mensaje_largo');
    end if;

    begin
        insert into public.solicitudes_datos (user_id, tipo, mensaje, motivo)
        values (v_uid, p_tipo, nullif(btrim(p_mensaje), ''), nullif(btrim(p_motivo), ''))
        returning id, numero into v_id, v_numero;
    exception when check_violation then
        -- El unico check_violation que se levanta a mano es el de los 6 meses,
        -- y su texto esta escrito para mostrarse tal cual.
        return jsonb_build_object('ok', false, 'motivo', 'limite_6_meses',
                                  'detalle', sqlerrm);
    end;

    return jsonb_build_object('ok', true, 'id', v_id,
                              'numero', lpad(v_numero::text, 4, '0'));
end;
$$;

comment on function public.crear_solicitud_datos(text, text, text) is
    'Alta de una solicitud de datos. Devuelve el numero ya formateado.';

-- ════════════════════════════════════════════════════════════════════════════
-- 4 · REPORTES DE PROBLEMAS
-- ════════════════════════════════════════════════════════════════════════════

create sequence if not exists public.reportes_problemas_numero_seq as integer start 1;

create table if not exists public.reportes_problemas (
    id           uuid primary key default gen_random_uuid(),
    numero       integer not null unique
                 default nextval('public.reportes_problemas_numero_seq'),
    user_id      uuid not null default auth.uid() references public.users(id),
    descripcion  text not null
                 check (char_length(btrim(descripcion)) between 1 and 2000),
    pantalla     text check (pantalla is null or char_length(pantalla) <= 60),
    -- La ruta dentro del bucket privado reportes-capturas. Siempre <uid>/…
    captura_path text,
    version_app  text check (version_app is null or char_length(version_app) <= 60),
    dispositivo  text check (dispositivo is null or char_length(dispositivo) <= 200),
    created_at   timestamptz not null default now(),
    estado       text not null default 'nuevo'
                 check (estado in ('nuevo', 'visto', 'resuelto')),
    nota_interna text
);

comment on table public.reportes_problemas is
    'Lo que la gente reporta desde Mi cuenta · Reportar un problema.';

create index if not exists idx_reportes_problemas_mios
    on public.reportes_problemas (user_id, created_at desc);
create index if not exists idx_reportes_problemas_abiertos
    on public.reportes_problemas (created_at desc)
 where estado <> 'resuelto';

alter table public.reportes_problemas enable row level security;

drop policy if exists reportes_problemas_insert_propio on public.reportes_problemas;
create policy reportes_problemas_insert_propio
    on public.reportes_problemas for insert to authenticated
    with check (user_id = auth.uid() and estado = 'nuevo');

-- Lo propio tampoco va por policy, por la nota_interna: mis_reportes().
drop policy if exists reportes_problemas_select_admin on public.reportes_problemas;
create policy reportes_problemas_select_admin
    on public.reportes_problemas for select to authenticated
    using (public.check_is_super_admin());

drop policy if exists reportes_problemas_update_admin on public.reportes_problemas;
create policy reportes_problemas_update_admin
    on public.reportes_problemas for update to authenticated
    using (public.check_is_super_admin())
    with check (public.check_is_super_admin());

create or replace function public.reportes_problemas_avisar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_admin record;
begin
    for v_admin in
        select id from public.users
         where (role)::text = 'SUPER_ADMIN'
            or coalesce(roles, '{}') && array['SUPER_ADMIN']
    loop
        insert into public.app_notifications (user_id, title, message, type, action_url)
        values (
            v_admin.id,
            'Problema reportado N.º ' || lpad(new.numero::text, 4, '0'),
            coalesce(nullif(btrim(new.pantalla), ''), 'Sin pantalla')
                || ' · ' || left(btrim(new.descripcion), 90),
            'REPORTE_PROBLEMA',
            '/panel-admin/reportes'
        );
    end loop;
    return null;
end;
$$;

drop trigger if exists trg_reportes_problemas_avisar on public.reportes_problemas;
create trigger trg_reportes_problemas_avisar
    after insert on public.reportes_problemas
    for each row execute function public.reportes_problemas_avisar();

create or replace function public.mis_reportes()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(jsonb_agg(
               jsonb_build_object(
                   'id', r.id,
                   'numero', lpad(r.numero::text, 4, '0'),
                   'descripcion', r.descripcion,
                   'pantalla', r.pantalla,
                   'estado', r.estado,
                   'created_at', r.created_at
               ) order by r.created_at desc), '[]'::jsonb)
      from public.reportes_problemas r
     where auth.uid() is not null
       and r.user_id = auth.uid();
$$;

comment on function public.mis_reportes() is
    'Los reportes de auth.uid(), sin nota_interna.';

/**
 * Crear un reporte. Mismo motivo que arriba: la persona no lee la tabla.
 */
create or replace function public.crear_reporte_problema(
    p_descripcion text,
    p_pantalla text default null,
    p_captura_path text default null,
    p_version_app text default null,
    p_dispositivo text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid uuid := auth.uid();
    v_id uuid;
    v_numero integer;
begin
    if v_uid is null then
        return jsonb_build_object('ok', false, 'motivo', 'sin_sesion');
    end if;
    if coalesce(btrim(p_descripcion), '') = '' then
        return jsonb_build_object('ok', false, 'motivo', 'sin_descripcion');
    end if;
    if char_length(btrim(p_descripcion)) > 2000 then
        return jsonb_build_object('ok', false, 'motivo', 'descripcion_larga');
    end if;
    -- La captura tiene que estar en la carpeta propia, igual que en el bucket.
    if p_captura_path is not null
       and split_part(p_captura_path, '/', 1) <> v_uid::text then
        return jsonb_build_object('ok', false, 'motivo', 'captura_ajena');
    end if;

    insert into public.reportes_problemas
        (user_id, descripcion, pantalla, captura_path, version_app, dispositivo)
    values (v_uid, btrim(p_descripcion), nullif(btrim(p_pantalla), ''),
            nullif(btrim(p_captura_path), ''), nullif(btrim(p_version_app), ''),
            nullif(btrim(p_dispositivo), ''))
    returning id, numero into v_id, v_numero;

    return jsonb_build_object('ok', true, 'id', v_id,
                              'numero', lpad(v_numero::text, 4, '0'));
end;
$$;

comment on function public.crear_reporte_problema(text, text, text, text, text) is
    'Alta de un reporte de problema. Devuelve el numero ya formateado.';

-- ── El bucket de las capturas, privado ──────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reportes-capturas', 'reportes-capturas', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
   set public = false,
       file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

-- Mismo molde que voluntarios-comprobantes: cada uno sube a su carpeta.
drop policy if exists reportes_capturas_insert on storage.objects;
create policy reportes_capturas_insert
    on storage.objects for insert to authenticated
    with check (bucket_id = 'reportes-capturas'
                and (storage.foldername(name))[1] = (auth.uid())::text);

drop policy if exists reportes_capturas_select on storage.objects;
create policy reportes_capturas_select
    on storage.objects for select to authenticated
    using (bucket_id = 'reportes-capturas'
           and (public.check_is_super_admin()
                or (storage.foldername(name))[1] = (auth.uid())::text));

-- ════════════════════════════════════════════════════════════════════════════
-- 5 · PERMISOS — nada para anon, nada para PUBLIC
-- ════════════════════════════════════════════════════════════════════════════

revoke all on function public.marcar_venta(uuid, text) from public, anon;
revoke all on function public.mis_inscripciones_eventos() from public, anon;
revoke all on function public.mi_inscripcion_detalle(uuid) from public, anon;
revoke all on function public.mis_solicitudes_datos() from public, anon;
revoke all on function public.mis_reportes() from public, anon;
revoke all on function public.nocturna_email_verificado() from public, anon;
revoke all on function public.estado_venta(timestamptz, timestamptz) from public, anon;

grant execute on function public.marcar_venta(uuid, text) to authenticated;
grant execute on function public.mis_inscripciones_eventos() to authenticated;
grant execute on function public.mi_inscripcion_detalle(uuid) to authenticated;
grant execute on function public.mis_solicitudes_datos() to authenticated;
grant execute on function public.mis_reportes() to authenticated;
grant execute on function public.estado_venta(timestamptz, timestamptz) to authenticated;
-- nocturna_email_verificado es un ayudante interno: nadie la llama de afuera.

revoke all on public.solicitudes_datos from public, anon;
revoke all on public.reportes_problemas from public, anon;

-- OJO: este proyecto tiene `alter default privileges ... grant all to
-- authenticated`, asi que una tabla nueva nace con TODO otorgado, DELETE
-- incluido. No alcanza con "no otorgarlo": hay que sacarlo.
revoke delete, truncate, references, trigger on public.solicitudes_datos from authenticated;
revoke delete, truncate, references, trigger on public.reportes_problemas from authenticated;
grant select, insert, update on public.solicitudes_datos to authenticated;
grant select, insert, update on public.reportes_problemas to authenticated;

grant execute on function public.crear_solicitud_datos(text, text, text) to authenticated;
grant execute on function public.crear_reporte_problema(text, text, text, text, text) to authenticated;
revoke all on function public.crear_solicitud_datos(text, text, text) from public, anon;
revoke all on function public.crear_reporte_problema(text, text, text, text, text) from public, anon;

commit;

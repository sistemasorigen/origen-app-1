-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — "Chequeá tu entrada" (/nocturna-entrada)
-- 2026-10-20
--
-- La familia entra con el código de 6 caracteres que le llegó por email,
-- confirma los últimos 3 dígitos del DNI del adulto responsable, ve que su
-- entrada es válida y completa lo que falta (hoy: 9 inscripciones sin teléfono
-- del adulto).
--
-- POR QUÉ TRES RPC Y NINGUNA POLICY NUEVA
--
-- La pantalla es pública: la abre cualquiera con el link, sin cuenta. Darle a
-- `anon` un SELECT sobre nocturna_inscripciones —aunque fuera filtrado por
-- código— le daría de hecho la tabla entera: 6 caracteres de un alfabeto de 31
-- son 887 millones de combinaciones, pero el que prueba no necesita adivinar
-- un código al azar, necesita UNO, y con la tabla expuesta puede leer DNI,
-- emails y nombres de los adolescentes. Así que no hay lectura directa: las
-- tres funciones son SECURITY DEFINER, devuelven lo mínimo que la pantalla
-- necesita para dibujarse, y nada más.
--
-- LO QUE CADA UNA DEVUELVE, Y LO QUE NO
--   · chequear_codigo  → el nombre de pila del adulto. Sirve para decir "Hola,
--     María" y que se note que el código es de quien dice ser.
--   · ver_entrada      → el id (que es lo que lleva el QR), el código, el
--     adulto con la inicial del apellido, los nombres de pila de los
--     adolescentes y qué datos faltan.
--   · completar_datos  → los teléfonos que falten, y sólo los que falten.
-- Ninguna devuelve DNI, email, apellido completo ni datos de retiro.
--
-- EL FRENO
-- Los últimos 3 dígitos del DNI son 1000 combinaciones: a mano no se prueban,
-- con un script sí. Por eso cada fallo queda registrado y:
--   · 5 fallos sobre el mismo código en 5 minutos lo bloquean 5 minutos;
--   · 20 fallos desde la misma IP en 10 minutos la bloquean 5 minutos.
-- Mientras está bloqueado NO se registran más intentos: si no, seguir
-- intentando estiraría el bloqueo para siempre y alguien podría dejar afuera a
-- una familia a propósito tirándole fallos a su código. El bloqueo corre desde
-- el último fallo que sí contó.
--
-- LA IP
-- Sale de request.headers, que PostgREST llena con las cabeceras del pedido.
-- CONFIRMADO EN PRODUCCIÓN el 2026-10-20 llamando la RPC por la API: llegan
-- las dos, cf-connecting-ip y x-forwarded-for. Se usa la de Cloudflare primero
-- porque es la única que el cliente no puede escribir él mismo —x-forwarded-for
-- la puede mandar cualquiera en el pedido—. Si no hay ninguna (por ejemplo si
-- la función se llama desde una consola SQL y no por la API) queda NULL y sólo
-- corre el límite por código.
--
-- EL FORMATO DEL TELÉFONO
-- 10 dígitos, sin separadores. Es el formato que ya escribe la app: los 4
-- teléfonos de adolescentes y los 4 de adultos cargados DESDE el formulario
-- son exactamente 10 dígitos. Los irregulares (9, 11, 12 y 14 caracteres) son
-- todos los que se copiaron del perfil del usuario en sql/nocturna_telefonos.sql,
-- donde cada uno había escrito lo que quiso.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · Los intentos ────────────────────────────────────────────────────────

create table if not exists public.nocturna_chequeo_intentos (
    id          bigint generated always as identity primary key,
    -- El código probado, ya normalizado. Puede no existir: justamente.
    codigo      text,
    -- NULL cuando la cabecera no llegó. Ver el comentario de arriba.
    ip          text,
    exitoso     boolean     not null default false,
    created_at  timestamptz not null default now()
);

comment on table public.nocturna_chequeo_intentos is
    'Intentos de /nocturna-entrada. Sólo la escriben y la leen las RPC de chequeo; no tiene policies y nadie la consulta directo.';

alter table public.nocturna_chequeo_intentos enable row level security;

-- Sin policies a propósito: con RLS prendida y ninguna policy, nadie llega a
-- esta tabla salvo las funciones SECURITY DEFINER de abajo.

-- Los dos índices son los dos conteos del bloqueo. Sin ellos, cada chequeo
-- recorre la tabla entera, que sólo crece.
create index if not exists nocturna_chequeo_codigo_idx
    on public.nocturna_chequeo_intentos (codigo, created_at desc)
    where exitoso = false;

create index if not exists nocturna_chequeo_ip_idx
    on public.nocturna_chequeo_intentos (ip, created_at desc)
    where exitoso = false;

-- ── 2 · Piezas internas ─────────────────────────────────────────────────────

/**
 * La IP de quien está llamando, o NULL.
 *
 * `request.headers` sólo existe cuando el llamado entró por PostgREST. Desde
 * una consola SQL no está, y current_setting(..., true) devuelve NULL en vez
 * de romper.
 */
create or replace function public.nocturna_ip_actual()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_crudo text;
    v_cabeceras json;
    v_ip text;
begin
    v_crudo := current_setting('request.headers', true);
    if v_crudo is null or btrim(v_crudo) = '' then
        return null;
    end if;

    begin
        v_cabeceras := v_crudo::json;
    exception when others then
        return null;
    end;

    -- Cloudflare primero: es la que no se puede falsear desde el cliente.
    v_ip := nullif(btrim(coalesce(v_cabeceras ->> 'cf-connecting-ip', '')), '');
    if v_ip is not null then
        return v_ip;
    end if;

    -- x-forwarded-for puede traer varias separadas por coma; la primera es la
    -- del cliente.
    v_ip := nullif(btrim(split_part(coalesce(v_cabeceras ->> 'x-forwarded-for', ''), ',', 1)), '');
    return v_ip;
end;
$$;

/**
 * El código, en mayúsculas y sin espacios, o NULL si no tiene la forma.
 *
 * El alfabeto no lleva 0, O, 1, I ni L: se confunden al leer un código de un
 * email o de un papel, y por eso tampoco se generan.
 */
create or replace function public.nocturna_normalizar_codigo(p_codigo text)
returns text
language sql
immutable
as $$
    select case
        when upper(btrim(coalesce(p_codigo, ''))) ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$'
        then upper(btrim(p_codigo))
        else null
    end;
$$;

/**
 * Un teléfono argentino llevado a sus 10 dígitos, o NULL si no llega.
 *
 * Misma lógica que normalizarArgentino() de services/reportesPuntoInfo.ts: se
 * sacan el 0054, el 54, el 9 de los móviles, el 0 de larga distancia y el 15
 * que va DESPUÉS del código de área (11 15 5555 0000). Lo que queda tiene que
 * ser exactamente 10.
 */
create or replace function public.nocturna_normalizar_telefono(p_tel text)
returns text
language plpgsql
immutable
as $$
declare
    n text;
    partes text[];
begin
    n := regexp_replace(coalesce(p_tel, ''), '\D', '', 'g');
    if n = '' then
        return null;
    end if;

    if left(n, 4) = '0054' then n := substr(n, 5); end if;
    if left(n, 2) = '54'   then n := substr(n, 3); end if;
    if left(n, 1) = '9'    then n := substr(n, 2); end if;
    if left(n, 1) = '0'    then n := substr(n, 2); end if;

    partes := regexp_match(n, '^(\d{2,4})15(\d{6,8})$');
    if partes is not null then
        n := partes[1] || partes[2];
    end if;

    return case when n ~ '^\d{10}$' then n else null end;
end;
$$;

/**
 * Cuántos segundos falta para que se pueda volver a intentar. 0 = no bloqueado.
 *
 * El bloqueo corre desde el ÚLTIMO fallo que contó, no desde el primero: así
 * la cuenta regresiva que ve la familia baja hasta cero y no se mueve sola.
 */
create or replace function public.nocturna_bloqueo_segundos(p_codigo text, p_ip text)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_hasta timestamptz;
    v_ultimo timestamptz;
    v_cuantos integer;
begin
    -- Por código: 5 fallos en 5 minutos.
    select count(*), max(created_at) into v_cuantos, v_ultimo
    from public.nocturna_chequeo_intentos
    where exitoso = false
      and codigo = p_codigo
      and created_at > now() - interval '5 minutes';

    if v_cuantos >= 5 then
        v_hasta := v_ultimo + interval '5 minutes';
    end if;

    -- Por IP: 20 fallos en 10 minutos. Con IP nula no corre.
    if p_ip is not null then
        select count(*), max(created_at) into v_cuantos, v_ultimo
        from public.nocturna_chequeo_intentos
        where exitoso = false
          and ip = p_ip
          and created_at > now() - interval '10 minutes';

        if v_cuantos >= 20 then
            v_hasta := greatest(coalesce(v_hasta, to_timestamp(0)), v_ultimo + interval '5 minutes');
        end if;
    end if;

    if v_hasta is null or v_hasta <= now() then
        return 0;
    end if;

    return ceil(extract(epoch from (v_hasta - now())))::integer;
end;
$$;

/** Deja asentado un intento. Siempre con el código ya normalizado. */
create or replace function public.nocturna_registrar_intento(p_codigo text, p_ip text, p_exitoso boolean)
returns void
language sql
security definer
set search_path = public
as $$
    insert into public.nocturna_chequeo_intentos (codigo, ip, exitoso)
    values (p_codigo, p_ip, p_exitoso);
$$;

-- ── 3 · Paso 1: el código ───────────────────────────────────────────────────

/**
 * ¿Existe una entrada con este código?
 *
 * Devuelve el nombre de pila del adulto y nada más. Todavía no hubo ninguna
 * prueba de identidad: lo único que confirma es que el código existe.
 */
create or replace function public.nocturna_chequear_codigo(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_codigo text;
    v_ip text;
    v_seg integer;
    v_edicion integer;
    v_fila record;
begin
    v_codigo := public.nocturna_normalizar_codigo(p_codigo);
    if v_codigo is null then
        return jsonb_build_object('ok', false, 'motivo', 'formato');
    end if;

    v_ip := public.nocturna_ip_actual();

    v_seg := public.nocturna_bloqueo_segundos(v_codigo, v_ip);
    if v_seg > 0 then
        return jsonb_build_object('ok', false, 'motivo', 'bloqueado', 'segundos', v_seg);
    end if;

    select id, edicion, adulto_nombre into v_fila
    from public.nocturna_inscripciones
    where codigo_entrada = v_codigo;

    if not found then
        perform public.nocturna_registrar_intento(v_codigo, v_ip, false);
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    select edicion into v_edicion from public.nocturna_config where id = 1;

    -- Una entrada de otra edición no es un intento fallido: el código es real
    -- y quien lo tiene es su dueño. Sólo está mirando el email del año pasado.
    if v_fila.edicion is distinct from v_edicion then
        return jsonb_build_object('ok', false, 'motivo', 'otra_edicion');
    end if;

    return jsonb_build_object('ok', true, 'nombre', btrim(v_fila.adulto_nombre));
end;
$$;

-- ── 4 · Paso 2: el DNI, y la entrada ────────────────────────────────────────

/**
 * Los últimos 3 del DNI del adulto. Si coinciden, la entrada.
 *
 * `adulto_dni` es texto y puede venir con puntos, así que se compara sólo
 * contra sus dígitos.
 */
create or replace function public.nocturna_ver_entrada(p_codigo text, p_dni3 text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_codigo text;
    v_dni3 text;
    v_ip text;
    v_seg integer;
    v_edicion integer;
    v_fila record;
    v_jovenes jsonb;
    v_sin_tel jsonb;
begin
    v_codigo := public.nocturna_normalizar_codigo(p_codigo);
    v_dni3 := regexp_replace(coalesce(p_dni3, ''), '\D', '', 'g');

    if v_codigo is null or v_dni3 !~ '^\d{3}$' then
        return jsonb_build_object('ok', false, 'motivo', 'formato');
    end if;

    v_ip := public.nocturna_ip_actual();

    v_seg := public.nocturna_bloqueo_segundos(v_codigo, v_ip);
    if v_seg > 0 then
        return jsonb_build_object('ok', false, 'motivo', 'bloqueado', 'segundos', v_seg);
    end if;

    select id, edicion, codigo_entrada, adulto_nombre, adulto_apellido, adulto_dni, adulto_telefono
      into v_fila
    from public.nocturna_inscripciones
    where codigo_entrada = v_codigo;

    if not found then
        perform public.nocturna_registrar_intento(v_codigo, v_ip, false);
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    select edicion into v_edicion from public.nocturna_config where id = 1;
    if v_fila.edicion is distinct from v_edicion then
        return jsonb_build_object('ok', false, 'motivo', 'otra_edicion');
    end if;

    if right(regexp_replace(coalesce(v_fila.adulto_dni, ''), '\D', '', 'g'), 3) <> v_dni3 then
        perform public.nocturna_registrar_intento(v_codigo, v_ip, false);
        return jsonb_build_object('ok', false, 'motivo', 'dni');
    end if;

    perform public.nocturna_registrar_intento(v_codigo, v_ip, true);

    -- Sólo el nombre de pila de cada adolescente. Ni apellido, ni DNI, ni
    -- fecha de nacimiento, ni con quién se retira.
    select coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'nombre', btrim(j.nombre)) order by j.nombre), '[]'::jsonb)
      into v_jovenes
    from public.nocturna_jovenes j
    where j.inscripcion_id = v_fila.id;

    select coalesce(jsonb_agg(j.id order by j.nombre), '[]'::jsonb)
      into v_sin_tel
    from public.nocturna_jovenes j
    where j.inscripcion_id = v_fila.id
      and (j.telefono is null or btrim(j.telefono) = '');

    return jsonb_build_object(
        'ok', true,
        -- El id es lo que lleva el QR, igual que la entrada que sale al
        -- inscribirse.
        'id', v_fila.id,
        'codigo', v_fila.codigo_entrada,
        'adulto', btrim(v_fila.adulto_nombre) || ' ' || left(btrim(v_fila.adulto_apellido), 1) || '.',
        'jovenes', v_jovenes,
        'faltantes', jsonb_build_object(
            'adulto_telefono', (v_fila.adulto_telefono is null or btrim(v_fila.adulto_telefono) = ''),
            'jovenes_sin_telefono', v_sin_tel
        )
    );
end;
$$;

-- ── 5 · Paso 3: completar lo que falta ──────────────────────────────────────

/**
 * Guarda los teléfonos que faltan. SÓLO los que faltan.
 *
 * El UPDATE lleva la condición de vacío adentro: si el dato ya estaba, la fila
 * no se toca. Esto no es una cortesía, es el límite de la pantalla — con el
 * código y 3 dígitos del DNI cualquiera de la familia entra, y eso alcanza
 * para COMPLETAR un dato que falta, no para cambiar uno que ya está.
 *
 * p_jovenes es un array [{id, telefono}]. Un id que no sea de esta inscripción
 * se ignora sin decir nada: no hay por qué confirmarle a nadie que ese id
 * existe en otra familia.
 */
create or replace function public.nocturna_completar_datos(
    p_codigo text,
    p_dni3 text,
    p_adulto_telefono text default null,
    p_jovenes jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_codigo text;
    v_dni3 text;
    v_ip text;
    v_seg integer;
    v_edicion integer;
    v_fila record;
    v_tel text;
    v_item jsonb;
    v_id uuid;
begin
    v_codigo := public.nocturna_normalizar_codigo(p_codigo);
    v_dni3 := regexp_replace(coalesce(p_dni3, ''), '\D', '', 'g');

    if v_codigo is null or v_dni3 !~ '^\d{3}$' then
        return jsonb_build_object('ok', false, 'motivo', 'formato');
    end if;

    v_ip := public.nocturna_ip_actual();

    v_seg := public.nocturna_bloqueo_segundos(v_codigo, v_ip);
    if v_seg > 0 then
        return jsonb_build_object('ok', false, 'motivo', 'bloqueado', 'segundos', v_seg);
    end if;

    select id, edicion, adulto_dni into v_fila
    from public.nocturna_inscripciones
    where codigo_entrada = v_codigo;

    if not found then
        perform public.nocturna_registrar_intento(v_codigo, v_ip, false);
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    select edicion into v_edicion from public.nocturna_config where id = 1;
    if v_fila.edicion is distinct from v_edicion then
        return jsonb_build_object('ok', false, 'motivo', 'otra_edicion');
    end if;

    if right(regexp_replace(coalesce(v_fila.adulto_dni, ''), '\D', '', 'g'), 3) <> v_dni3 then
        perform public.nocturna_registrar_intento(v_codigo, v_ip, false);
        return jsonb_build_object('ok', false, 'motivo', 'dni');
    end if;

    -- El teléfono del adulto.
    if p_adulto_telefono is not null and btrim(p_adulto_telefono) <> '' then
        v_tel := public.nocturna_normalizar_telefono(p_adulto_telefono);
        if v_tel is null then
            return jsonb_build_object('ok', false, 'motivo', 'telefono', 'campo', 'adulto');
        end if;

        update public.nocturna_inscripciones
           set adulto_telefono = v_tel
         where id = v_fila.id
           and (adulto_telefono is null or btrim(adulto_telefono) = '');
    end if;

    -- Los de los adolescentes.
    for v_item in select * from jsonb_array_elements(coalesce(p_jovenes, '[]'::jsonb))
    loop
        begin
            v_id := (v_item ->> 'id')::uuid;
        exception when others then
            continue;
        end;

        if v_item ->> 'telefono' is null or btrim(v_item ->> 'telefono') = '' then
            continue;
        end if;

        v_tel := public.nocturna_normalizar_telefono(v_item ->> 'telefono');
        if v_tel is null then
            return jsonb_build_object('ok', false, 'motivo', 'telefono', 'campo', v_item ->> 'id');
        end if;

        update public.nocturna_jovenes
           set telefono = v_tel
         where id = v_id
           and inscripcion_id = v_fila.id
           and (telefono is null or btrim(telefono) = '');
    end loop;

    -- Lo que quedó faltando, recalculado contra la base y no contra lo que
    -- mandó la pantalla.
    return jsonb_build_object(
        'ok', true,
        'faltantes', jsonb_build_object(
            'adulto_telefono', (
                select (i.adulto_telefono is null or btrim(i.adulto_telefono) = '')
                from public.nocturna_inscripciones i where i.id = v_fila.id
            ),
            'jovenes_sin_telefono', (
                select coalesce(jsonb_agg(j.id order by j.nombre), '[]'::jsonb)
                from public.nocturna_jovenes j
                where j.inscripcion_id = v_fila.id
                  and (j.telefono is null or btrim(j.telefono) = '')
            )
        )
    );
end;
$$;

-- ── 6 · Permisos ────────────────────────────────────────────────────────────

-- Las tres que llama la pantalla, y nada más. El helper de IP, el de bloqueo y
-- el de registrar intentos quedan sólo para uso interno de estas funciones.
revoke all on function public.nocturna_chequear_codigo(text) from public;
revoke all on function public.nocturna_ver_entrada(text, text) from public;
revoke all on function public.nocturna_completar_datos(text, text, text, jsonb) from public;
revoke all on function public.nocturna_ip_actual() from public;
revoke all on function public.nocturna_bloqueo_segundos(text, text) from public;
revoke all on function public.nocturna_registrar_intento(text, text, boolean) from public;
revoke all on function public.nocturna_normalizar_codigo(text) from public;
revoke all on function public.nocturna_normalizar_telefono(text) from public;

grant execute on function public.nocturna_chequear_codigo(text) to anon, authenticated;
grant execute on function public.nocturna_ver_entrada(text, text) to anon, authenticated;
grant execute on function public.nocturna_completar_datos(text, text, text, jsonb) to anon, authenticated;

-- La tabla de intentos no la toca nadie de afuera.
revoke all on table public.nocturna_chequeo_intentos from anon, authenticated;

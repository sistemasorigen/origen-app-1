-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — el staff completa los datos que faltan, desde el escáner
-- 2026-10-21
--
-- Plan B de /nocturna-entrada: la familia que no completó el teléfono desde el
-- email lo completa en la puerta, con el staff adelante. El escáner lee la
-- entrada, ve que falta algo y lo pide antes de abrir el panel de siempre.
--
-- "NO TIENE CELULAR" ES UN DATO, NO UN HUECO
-- Hasta hoy, `telefono IS NULL` en un adolescente quería decir dos cosas
-- distintas: "no se lo preguntamos todavía" y "se lo preguntamos y no tiene".
-- Mientras el único que cargaba era la familia eso no molestaba —el formulario
-- pregunta "¿tiene?" y el que contesta que no, no escribe nada—, pero con el
-- staff preguntando en la puerta sí: sin la marca, a la misma familia se le
-- vuelve a pedir el teléfono en cada escaneo de la noche.
--
-- Por eso `sin_celular_at`: cuándo alguien del staff preguntó y la respuesta
-- fue que no. Y `sin_celular_por`: quién. No se deduce NUNCA —ni por edad ni
-- por nada—; sólo la escribe esta RPC cuando el staff la marca a mano.
--
-- Si después aparece un teléfono (lo carga la familia desde la página, o el
-- staff en otro escaneo), la marca vuelve a NULL: el dato real gana.
--
-- LO QUE SE TOCA DE LO QUE YA ESTABA
--   · get_nocturna_para_acreditar: agrega `sin_celular` por adolescente. Nada
--     más de su respuesta cambia.
--   · nocturna_ver_entrada y nocturna_completar_datos: un adolescente marcado
--     deja de contar como faltante. Para todo lo demás responden igual que
--     antes — está probado en PROBAR_nocturna_completar_staff.sql.
--
-- `nocturna_normalizar_telefono` ya existía desde
-- sql/nocturna_chequear_entrada.sql y no se toca: es la misma función que usan
-- las dos RPC públicas, así que staff y familia guardan el teléfono idéntico.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · La marca ────────────────────────────────────────────────────────────

alter table public.nocturna_jovenes
    add column if not exists sin_celular_at  timestamptz,
    add column if not exists sin_celular_por uuid references public.users(id);

comment on column public.nocturna_jovenes.sin_celular_at is
    'Cuándo el staff preguntó en la puerta y la respuesta fue que no tiene celular. NULL = todavía no se preguntó. Vuelve a NULL si aparece un teléfono.';
comment on column public.nocturna_jovenes.sin_celular_por is
    'Quién del staff lo marcó.';

-- ── 2 · La RPC del staff ────────────────────────────────────────────────────

/**
 * Completa, desde la puerta, los datos que falten de una inscripción.
 *
 * p_jovenes es [{id, telefono?, sin_celular?}].
 *
 * TODO O NADA: si un teléfono no es válido, no se guarda ninguno. En la puerta
 * hay una fila esperando y el staff no va a leer un resultado parcial; es
 * mejor que la pantalla diga cuál está mal y se vuelva a mandar entero.
 * La función es una sola transacción, así que alcanza con salir con RETURN
 * antes de escribir nada: para eso se valida todo primero.
 *
 * SÓLO COMPLETA VACÍOS. Con el QR en la mano cualquiera del staff puede
 * agregar lo que falta, y eso está bien; cambiar un teléfono que la familia ya
 * cargó, no. Para eso está la ficha de la inscripción.
 */
create or replace function public.nocturna_completar_datos_staff(
    p_inscripcion_id uuid,
    p_adulto_telefono text default null,
    p_jovenes jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_edicion integer;
    v_insc record;
    v_item jsonb;
    v_id uuid;
    v_tel text;
    v_quien uuid;
    -- Lo que se va a escribir, ya validado. Recién después se toca la base.
    v_adulto text;
    v_altas jsonb := '[]'::jsonb;
begin
    if not public.is_nocturna_staff() then
        return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    end if;

    select id, edicion, adulto_telefono into v_insc
    from public.nocturna_inscripciones
    where id = p_inscripcion_id;

    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    select edicion into v_edicion from public.nocturna_config where id = 1;
    if v_insc.edicion is distinct from v_edicion then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    -- ── Validar TODO antes de escribir NADA ─────────────────────────────────
    if p_adulto_telefono is not null and btrim(p_adulto_telefono) <> '' then
        v_adulto := public.nocturna_normalizar_telefono(p_adulto_telefono);
        if v_adulto is null then
            return jsonb_build_object('ok', false, 'motivo', 'telefono', 'campo', 'adulto');
        end if;
    end if;

    for v_item in select * from jsonb_array_elements(coalesce(p_jovenes, '[]'::jsonb))
    loop
        begin
            v_id := (v_item ->> 'id')::uuid;
        exception when others then
            continue;   -- un id que no es un uuid se ignora, como el de otra familia
        end;

        -- Sólo los de ESTA inscripción. Un id de otra familia no existe para
        -- esta llamada, y no se dice que no existe: no hay por qué confirmarle
        -- a nadie dónde está ese id.
        if not exists (
            select 1 from public.nocturna_jovenes
            where id = v_id and inscripcion_id = v_insc.id
        ) then
            continue;
        end if;

        if coalesce((v_item ->> 'sin_celular')::boolean, false) then
            v_altas := v_altas || jsonb_build_array(jsonb_build_object('id', v_id, 'sin_celular', true));
        elsif v_item ->> 'telefono' is not null and btrim(v_item ->> 'telefono') <> '' then
            v_tel := public.nocturna_normalizar_telefono(v_item ->> 'telefono');
            if v_tel is null then
                return jsonb_build_object('ok', false, 'motivo', 'telefono', 'campo', v_item ->> 'id');
            end if;
            v_altas := v_altas || jsonb_build_array(jsonb_build_object('id', v_id, 'telefono', v_tel));
        end if;
    end loop;

    -- ── Recién acá se escribe ───────────────────────────────────────────────
    v_quien := auth.uid();

    if v_adulto is not null then
        update public.nocturna_inscripciones
           set adulto_telefono = v_adulto
         where id = v_insc.id
           and (adulto_telefono is null or btrim(adulto_telefono) = '');
    end if;

    for v_item in select * from jsonb_array_elements(v_altas)
    loop
        v_id := (v_item ->> 'id')::uuid;

        if (v_item ? 'telefono') then
            -- Con un teléfono real, la marca de "no tiene" deja de valer.
            update public.nocturna_jovenes
               set telefono = v_item ->> 'telefono',
                   sin_celular_at = null,
                   sin_celular_por = null
             where id = v_id
               and inscripcion_id = v_insc.id
               and (telefono is null or btrim(telefono) = '');
        else
            update public.nocturna_jovenes
               set sin_celular_at = now(),
                   sin_celular_por = v_quien
             where id = v_id
               and inscripcion_id = v_insc.id
               and (telefono is null or btrim(telefono) = '');
        end if;
    end loop;

    -- ── Cómo quedó, leído de la base ────────────────────────────────────────
    return jsonb_build_object(
        'ok', true,
        'adulto_telefono', (
            select i.adulto_telefono from public.nocturna_inscripciones i where i.id = v_insc.id
        ),
        'jovenes', (
            select coalesce(jsonb_agg(jsonb_build_object(
                'id', j.id,
                'telefono', j.telefono,
                'sin_celular', (j.sin_celular_at is not null)
            ) order by j.nombre), '[]'::jsonb)
            from public.nocturna_jovenes j
            where j.inscripcion_id = v_insc.id
        )
    );
end;
$$;

revoke all on function public.nocturna_completar_datos_staff(uuid, text, jsonb) from public, anon;
grant execute on function public.nocturna_completar_datos_staff(uuid, text, jsonb) to authenticated;

-- ── 3 · Que el escáner vea la marca ─────────────────────────────────────────
-- Igual que estaba, con una línea más en el objeto de cada adolescente.

create or replace function public.get_nocturna_para_acreditar(p_inscripcion_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
DECLARE
    v_i public.nocturna_inscripciones%ROWTYPE;
    v_jovenes JSONB;
BEGIN
    IF NOT public.is_nocturna_staff() THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_permiso',
            'error', 'No tenés permisos para acreditar.');
    END IF;

    SELECT * INTO v_i FROM public.nocturna_inscripciones WHERE id = p_inscripcion_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'no_existe',
            'error', 'Esta entrada no existe o fue eliminada.');
    END IF;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', j.id,
        'nombre', j.nombre,
        'apellido', j.apellido,
        'dni', j.dni,
        'fecha_nacimiento', j.fecha_nacimiento,
        'edad', date_part('year', age(current_date, j.fecha_nacimiento))::INTEGER,
        'tribu', j.tribu,
        'telefono', j.telefono,
        -- Lo único que se agregó: si el staff ya preguntó y no tiene.
        'sin_celular', (j.sin_celular_at IS NOT NULL),
        'retiro_tipo', j.retiro_tipo,
        'retiro_nombre', j.retiro_nombre,
        'retiro_apellido', j.retiro_apellido,
        'retiro_dni', j.retiro_dni,
        'retiro_telefono', j.retiro_telefono,
        'acreditado_at', j.acreditado_at,
        'ausente_at', j.ausente_at,
        'retirado_at', j.retirado_at
    ) ORDER BY j.nombre), '[]'::jsonb)
    INTO v_jovenes
    FROM public.nocturna_jovenes j
    WHERE j.inscripcion_id = v_i.id;

    RETURN jsonb_build_object(
        'ok', true,
        'inscripcion', jsonb_build_object(
            'id', v_i.id,
            'codigo_entrada', v_i.codigo_entrada,
            'edicion', v_i.edicion,
            'adulto_nombre', v_i.adulto_nombre,
            'adulto_apellido', v_i.adulto_apellido,
            'adulto_dni', v_i.adulto_dni,
            'adulto_email', v_i.adulto_email,
            'adulto_telefono', v_i.adulto_telefono,
            'acepta_fotos', v_i.acepta_fotos,
            'adulto_acreditado_at', v_i.adulto_acreditado_at,
            'aprobado_at', v_i.aprobado_at,
            'total', v_i.total
        ),
        'jovenes', v_jovenes
    );
END;
$$;

-- ── 4 · Que la página pública también la respete ────────────────────────────
-- Las dos funciones son las de sql/nocturna_chequear_entrada.sql con UN
-- cambio cada una: el que está marcado como "no tiene" ya no figura entre los
-- que faltan. Todo lo demás —formato, bloqueo, qué devuelven— queda igual.

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

    select coalesce(jsonb_agg(jsonb_build_object('id', j.id, 'nombre', btrim(j.nombre)) order by j.nombre), '[]'::jsonb)
      into v_jovenes
    from public.nocturna_jovenes j
    where j.inscripcion_id = v_fila.id;

    select coalesce(jsonb_agg(j.id order by j.nombre), '[]'::jsonb)
      into v_sin_tel
    from public.nocturna_jovenes j
    where j.inscripcion_id = v_fila.id
      and (j.telefono is null or btrim(j.telefono) = '')
      -- El que el staff ya marcó como "no tiene" no falta: la respuesta está.
      and j.sin_celular_at is null;

    return jsonb_build_object(
        'ok', true,
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

        -- Si la familia carga el teléfono, el dato real pisa la marca que el
        -- staff puso en la puerta.
        update public.nocturna_jovenes
           set telefono = v_tel,
               sin_celular_at = null,
               sin_celular_por = null
         where id = v_id
           and inscripcion_id = v_fila.id
           and (telefono is null or btrim(telefono) = '');
    end loop;

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
                  and j.sin_celular_at is null
            )
        )
    );
end;
$$;

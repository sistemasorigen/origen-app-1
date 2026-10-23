-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — el staff le asigna tribu en la puerta a los "Sin tribu"
-- 2026-10-22 · ✅ APLICADO el 2026-10-22 (pruebas de PROBAR_ en verde)
--
-- Quien acredita decide la tribu del adolescente que llegó sin una. No es
-- obligatorio: se puede acreditar sin elegir nada.
--
-- QUÉ SE PUEDE Y QUÉ NO
--   · Sólo a los que están en 'Sin tribu', o a los que ya se les asignó en la
--     puerta (para corregir un toque equivocado). La tribu que eligió la
--     familia al inscribirse NO se cambia desde la puerta: eso va en la ficha.
--   · Volver a 'Sin tribu' sólo deshace una asignación de la puerta.
--   · p_desde es la tribu que el staff tenía en pantalla. Si en la base ya es
--     otra (otro escáner la asignó en el medio), no se pisa: vuelve
--     motivo 'cambio' con la tribu actual, y la pantalla se pone al día.
--
-- LA MARCA
--   tribu_asignada_at / tribu_asignada_por: cuándo y quién la eligió en la
--   puerta. NULL = la tribu es la de la inscripción. Es lo que distingue una
--   tribu que se puede corregir desde la puerta de una que no.
--
-- LO QUE SE TOCA DE LO QUE YA ESTABA
--   get_nocturna_para_acreditar: agrega `tribu_en_puerta` por adolescente.
--   Es la versión que está en la base hoy (sql/nocturna_completar_staff.sql)
--   con esa sola línea más.
--
-- Pruebas: sql/PROBAR_nocturna_tribu_en_puerta.sql
-- Deshacer: sql/ROLLBACK_nocturna_tribu_en_puerta.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · La marca ────────────────────────────────────────────────────────────

alter table public.nocturna_jovenes
    add column if not exists tribu_asignada_at  timestamptz,
    add column if not exists tribu_asignada_por uuid references public.users(id);

comment on column public.nocturna_jovenes.tribu_asignada_at is
    'Cuándo el staff le eligió la tribu en la puerta. NULL = la tribu es la de la inscripción.';
comment on column public.nocturna_jovenes.tribu_asignada_por is
    'Quién del staff la eligió.';

-- ── 2 · La RPC ──────────────────────────────────────────────────────────────

create or replace function public.nocturna_asignar_tribu(
    p_joven_id uuid,
    p_tribu text,
    p_desde text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_edicion integer;
    v_j record;
begin
    if not public.is_nocturna_staff() then
        return jsonb_build_object('ok', false, 'motivo', 'sin_permiso');
    end if;

    if p_tribu is null or p_tribu not in ('Garra', 'Trueno', 'Sin tribu') then
        return jsonb_build_object('ok', false, 'motivo', 'tribu');
    end if;

    -- FOR UPDATE: dos escáneres sobre el mismo chico se ordenan acá, y el
    -- segundo ve lo que dejó el primero.
    select id, edicion, tribu, tribu_asignada_at into v_j
    from public.nocturna_jovenes
    where id = p_joven_id
    for update;

    if not found then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    select edicion into v_edicion from public.nocturna_config where id = 1;
    if v_j.edicion is distinct from v_edicion then
        return jsonb_build_object('ok', false, 'motivo', 'no_existe');
    end if;

    -- La tribu que eligió la familia no se toca desde la puerta.
    if v_j.tribu <> 'Sin tribu' and v_j.tribu_asignada_at is null then
        return jsonb_build_object('ok', false, 'motivo', 'ya_tiene',
            'tribu', v_j.tribu, 'en_puerta', false);
    end if;

    -- Otro escáner la cambió desde que esta pantalla la leyó.
    if p_desde is distinct from v_j.tribu then
        return jsonb_build_object('ok', false, 'motivo', 'cambio',
            'tribu', v_j.tribu, 'en_puerta', (v_j.tribu_asignada_at is not null));
    end if;

    update public.nocturna_jovenes
       set tribu = p_tribu,
           tribu_asignada_at  = case when p_tribu = 'Sin tribu' then null else now() end,
           tribu_asignada_por = case when p_tribu = 'Sin tribu' then null else auth.uid() end
     where id = v_j.id;

    return jsonb_build_object('ok', true,
        'tribu', p_tribu, 'en_puerta', (p_tribu <> 'Sin tribu'));
end;
$$;

revoke all on function public.nocturna_asignar_tribu(uuid, text, text) from public, anon;
grant execute on function public.nocturna_asignar_tribu(uuid, text, text) to authenticated;

-- ── 3 · Que el escáner sepa cuáles se eligieron en la puerta ────────────────

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
        -- Lo único que se agregó: si la tribu la eligió el staff en la puerta.
        'tribu_en_puerta', (j.tribu_asignada_at IS NOT NULL),
        'telefono', j.telefono,
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

-- ════════════════════════════════════════════════════════════════════════════
-- EVENTO "NOCTURNA" — esquema completo
-- 2026-09-30
--
-- Una familia se inscribe en una sola operación: un adulto responsable y uno o
-- más chicos. El id de la inscripción es lo que codifica el QR; el
-- `codigo_entrada` es el respaldo legible por si el QR no escanea.
--
-- DECISIÓN DE ARQUITECTURA — acá hay DNI, fecha de nacimiento y datos de
-- contacto de MENORES. Por eso:
--   · `nocturna_inscripciones` y `nocturna_jovenes` no tienen NINGUNA policy
--     para `anon`. Ni SELECT. El público escribe sólo a través de una RPC
--     acotada, que devuelve el id y el código y nada más.
--   · `nocturna_config` es la única tabla que el público lee, y a propósito no
--     guarda nada sensible: es el precio y si las inscripciones están abiertas.
--   · Los comprobantes van a un bucket PRIVADO. Un comprobante de transferencia
--     lleva nombre, CBU y monto.
--
-- Las dos fugas que tuvo este proyecto (`group_registrations`,
-- `influos_attendees`) salieron de una policy `FOR SELECT TO anon`. Acá no hay.
--
-- Nada de lo que manda el cliente se usa para decidir: el precio, el total, la
-- edad del adulto y la unicidad de los DNI se calculan y se validan en la base.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 1 — Rol de staff
-- ════════════════════════════════════════════════════════════════════════════
-- Mira las DOS columnas de rol: `role` (enum singular) y `roles` (text[]).
-- Es imprescindible: alguien de Eventos suele tenerlo en `roles[]` mientras su
-- `role` singular es otro, así que mirar una sola lo dejaría afuera. Mismo
-- criterio que hasRole() en services/authUtils.ts.
--
-- El cast a ::text[] no es decorativo: `users.roles` es text[] y sin él el
-- operador && contra un ARRAY de literales aborta el CREATE POLICY.
--
-- ACREDITACION ya existe en el enum user_role (verificado contra pg_enum el
-- 2026-09-30, junto a ENCARGADO_NINEZ).

CREATE OR REPLACE FUNCTION public.is_nocturna_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND (
                u.role::text = ANY (ARRAY['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS','ACREDITACION'])
             OR COALESCE(u.roles, ARRAY[]::text[])
                && ARRAY['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS','ACREDITACION']::text[]
          )
    );
$$;

REVOKE EXECUTE ON FUNCTION public.is_nocturna_staff() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_nocturna_staff() FROM anon;
GRANT  EXECUTE ON FUNCTION public.is_nocturna_staff() TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 2 — Tablas
-- ════════════════════════════════════════════════════════════════════════════

-- ── Configuración ───────────────────────────────────────────────────────────
-- Una sola fila. Es lo único que lee el público.
CREATE TABLE IF NOT EXISTS public.nocturna_config (
    id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    edicion               INTEGER NOT NULL,
    precio_entrada        NUMERIC(12,2) NOT NULL CHECK (precio_entrada >= 0),
    inscripciones_abiertas BOOLEAN NOT NULL DEFAULT true,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by            UUID REFERENCES public.users(id)
);

INSERT INTO public.nocturna_config (id, edicion, precio_entrada, inscripciones_abiertas)
VALUES (1, 2026, 40000, true)
ON CONFLICT (id) DO NOTHING;


-- ── Inscripciones ───────────────────────────────────────────────────────────
-- Una fila por familia. `id` es lo que viaja en el QR.
CREATE TABLE IF NOT EXISTS public.nocturna_inscripciones (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    edicion       INTEGER NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Respaldo en texto del QR. 6 caracteres sin ambiguos (ver
    -- nocturna_generar_codigo): nadie tiene que distinguir O de 0 a las 6 AM.
    codigo_entrada TEXT NOT NULL UNIQUE CHECK (codigo_entrada ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$'),

    -- Si se inscribió con sesión iniciada. NULL si entró sin cuenta.
    user_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Adulto responsable
    adulto_nombre           TEXT NOT NULL CHECK (btrim(adulto_nombre) <> ''),
    adulto_apellido         TEXT NOT NULL CHECK (btrim(adulto_apellido) <> ''),
    adulto_dni              TEXT NOT NULL CHECK (btrim(adulto_dni) <> ''),
    adulto_email            TEXT NOT NULL CHECK (btrim(adulto_email) <> ''),
    adulto_fecha_nacimiento DATE NOT NULL,

    -- Sin autorización no hay inscripción. También a nivel base: que la única
    -- forma de guardar un `false` sea romper el CHECK.
    autoriza_asistencia BOOLEAN NOT NULL CHECK (autoriza_asistencia = true),

    -- Este sí puede ser false, y queda registrado: hay familias que no quieren
    -- que su hijo salga en fotos, y el staff tiene que poder verlo.
    acepta_fotos        BOOLEAN NOT NULL,

    -- Constancia de QUÉ texto se aceptó y cuándo. Si mañana cambia el texto de
    -- las declaraciones, lo firmado por esta familia sigue siendo identificable.
    declaraciones_version       TEXT NOT NULL CHECK (btrim(declaraciones_version) <> ''),
    declaraciones_aceptadas_at  TIMESTAMPTZ NOT NULL,

    -- Foto del precio al momento de inscribirse. Si después se edita el precio,
    -- lo que pagó esta familia no cambia.
    precio_unitario NUMERIC(12,2) NOT NULL CHECK (precio_unitario >= 0),
    total           NUMERIC(12,2) NOT NULL CHECK (total >= 0),

    comprobante_path   TEXT,          -- ruta dentro del bucket privado
    cargado_por_admin  UUID REFERENCES public.users(id),

    adulto_acreditado_at TIMESTAMPTZ,
    aprobado_at          TIMESTAMPTZ,

    -- Para la FK compuesta de nocturna_jovenes: garantiza que la `edicion`
    -- denormalizada del chico sea siempre la de su inscripción.
    CONSTRAINT nocturna_inscripciones_id_edicion_key UNIQUE (id, edicion)
);

CREATE INDEX IF NOT EXISTS idx_nocturna_insc_edicion    ON public.nocturna_inscripciones(edicion);
CREATE INDEX IF NOT EXISTS idx_nocturna_insc_codigo     ON public.nocturna_inscripciones(codigo_entrada);
CREATE INDEX IF NOT EXISTS idx_nocturna_insc_adulto_dni ON public.nocturna_inscripciones(adulto_dni);
CREATE INDEX IF NOT EXISTS idx_nocturna_insc_user       ON public.nocturna_inscripciones(user_id);


-- ── Chicos ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.nocturna_jovenes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Sin REFERENCES en la columna: la FK va abajo, compuesta con `edicion`.
    -- Declarar las dos deja DOS claves foráneas entre las mismas tablas y
    -- PostgREST no sabe cuál usar para embeber los chicos — el select
    -- `jovenes:nocturna_jovenes(*)` falla con "more than one relationship".
    inscripcion_id UUID NOT NULL,

    -- Denormalizada para el índice único por edición. La FK compuesta de abajo
    -- impide que se desincronice de la inscripción.
    edicion        INTEGER NOT NULL,

    nombre            TEXT NOT NULL CHECK (btrim(nombre) <> ''),
    apellido          TEXT NOT NULL CHECK (btrim(apellido) <> ''),
    dni               TEXT NOT NULL CHECK (btrim(dni) <> ''),
    -- La edad NO se guarda: se calcula de la fecha. Guardada, queda vieja.
    fecha_nacimiento  DATE NOT NULL,

    tribu TEXT NOT NULL CHECK (tribu IN ('Trueno','Garra','Sin tribu')),

    -- Retiro, modelado por chico. El diseño de inscripción pregunta una sola
    -- vez para toda la familia ("Una respuesta para... Salen juntos.") y la
    -- interfaz escribe lo mismo en cada fila; modelarlo así deja la puerta
    -- abierta a que un hermano se retire distinto sin tocar la base.
    retiro_tipo      TEXT NOT NULL CHECK (retiro_tipo IN ('solo','adulto','otra_persona')),
    retiro_nombre    TEXT,
    retiro_apellido  TEXT,
    retiro_dni       TEXT,
    retiro_telefono  TEXT,

    acreditado_at TIMESTAMPTZ,

    -- Si lo retira un tercero, sus datos son obligatorios: es la persona a la
    -- que se le entrega un menor a las 6 de la mañana.
    CONSTRAINT nocturna_jovenes_retiro_otro_completo CHECK (
        retiro_tipo <> 'otra_persona'
        OR (
            btrim(COALESCE(retiro_nombre, ''))   <> ''
        AND btrim(COALESCE(retiro_apellido, '')) <> ''
        AND btrim(COALESCE(retiro_dni, ''))      <> ''
        AND btrim(COALESCE(retiro_telefono, '')) <> ''
        )
    ),

    CONSTRAINT nocturna_jovenes_insc_edicion_fk
        FOREIGN KEY (inscripcion_id, edicion)
        REFERENCES public.nocturna_inscripciones(id, edicion) ON DELETE CASCADE
);

-- El mismo chico no se inscribe dos veces en la misma edición.
-- El DNI del adulto SÍ puede repetirse: un padre que se olvidó de un hijo hace
-- una segunda inscripción.
CREATE UNIQUE INDEX IF NOT EXISTS idx_nocturna_jovenes_dni_edicion
    ON public.nocturna_jovenes(edicion, btrim(dni));

CREATE INDEX IF NOT EXISTS idx_nocturna_jovenes_insc ON public.nocturna_jovenes(inscripcion_id);

COMMENT ON TABLE public.nocturna_config IS
    'Nocturna: una sola fila. Única tabla del módulo que lee el público; a propósito no guarda nada sensible.';
COMMENT ON TABLE public.nocturna_inscripciones IS
    'Nocturna: una fila por familia. El id es lo que codifica el QR. Sin policies para anon — contiene datos de menores.';
COMMENT ON TABLE public.nocturna_jovenes IS
    'Nocturna: un chico por fila. La edad se calcula de fecha_nacimiento, no se guarda. El retiro se modela por chico aunque el formulario pregunte una vez por familia.';


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 3 — RLS
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.nocturna_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nocturna_inscripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nocturna_jovenes       ENABLE ROW LEVEL SECURITY;

-- Config: la lee cualquiera (precio y si está abierto), la escribe sólo staff.
DROP POLICY IF EXISTS nocturna_config_select_todos ON public.nocturna_config;
CREATE POLICY nocturna_config_select_todos ON public.nocturna_config
    FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS nocturna_config_update_staff ON public.nocturna_config;
CREATE POLICY nocturna_config_update_staff ON public.nocturna_config
    FOR UPDATE TO authenticated
    USING (public.is_nocturna_staff())
    WITH CHECK (public.is_nocturna_staff());

-- Inscripciones y chicos: SÓLO staff, y sólo authenticated.
-- Ninguna policy de INSERT a propósito: se inserta únicamente por las RPCs,
-- que son las que validan. Sin policy de INSERT, un INSERT directo no pasa ni
-- siendo staff.
DROP POLICY IF EXISTS nocturna_insc_select_staff ON public.nocturna_inscripciones;
CREATE POLICY nocturna_insc_select_staff ON public.nocturna_inscripciones
    FOR SELECT TO authenticated USING (public.is_nocturna_staff());

DROP POLICY IF EXISTS nocturna_insc_update_staff ON public.nocturna_inscripciones;
CREATE POLICY nocturna_insc_update_staff ON public.nocturna_inscripciones
    FOR UPDATE TO authenticated
    USING (public.is_nocturna_staff()) WITH CHECK (public.is_nocturna_staff());

DROP POLICY IF EXISTS nocturna_insc_delete_staff ON public.nocturna_inscripciones;
CREATE POLICY nocturna_insc_delete_staff ON public.nocturna_inscripciones
    FOR DELETE TO authenticated USING (public.is_nocturna_staff());

DROP POLICY IF EXISTS nocturna_jov_select_staff ON public.nocturna_jovenes;
CREATE POLICY nocturna_jov_select_staff ON public.nocturna_jovenes
    FOR SELECT TO authenticated USING (public.is_nocturna_staff());

DROP POLICY IF EXISTS nocturna_jov_update_staff ON public.nocturna_jovenes;
CREATE POLICY nocturna_jov_update_staff ON public.nocturna_jovenes
    FOR UPDATE TO authenticated
    USING (public.is_nocturna_staff()) WITH CHECK (public.is_nocturna_staff());

DROP POLICY IF EXISTS nocturna_jov_delete_staff ON public.nocturna_jovenes;
CREATE POLICY nocturna_jov_delete_staff ON public.nocturna_jovenes
    FOR DELETE TO authenticated USING (public.is_nocturna_staff());


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 4 — Bucket privado para los comprobantes
-- ════════════════════════════════════════════════════════════════════════════
-- NO se usa el bucket `images`: está marcado public = true (verificado contra
-- storage.buckets). Un comprobante lleva nombre, CBU y monto.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'nocturna-comprobantes',
    'nocturna-comprobantes',
    false,
    5242880,                                     -- 5 MB
    ARRAY['image/jpeg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Subir: cualquiera, porque la inscripción pública sube el comprobante sin
-- sesión. Leer: sólo staff — el panel usa URLs firmadas, nunca públicas.
DROP POLICY IF EXISTS nocturna_comprobantes_insert ON storage.objects;
CREATE POLICY nocturna_comprobantes_insert ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'nocturna-comprobantes');

DROP POLICY IF EXISTS nocturna_comprobantes_select_staff ON storage.objects;
CREATE POLICY nocturna_comprobantes_select_staff ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'nocturna-comprobantes' AND public.is_nocturna_staff());

DROP POLICY IF EXISTS nocturna_comprobantes_delete_staff ON storage.objects;
CREATE POLICY nocturna_comprobantes_delete_staff ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'nocturna-comprobantes' AND public.is_nocturna_staff());


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 5 — RPCs
-- ════════════════════════════════════════════════════════════════════════════

-- ── Auxiliar: código de entrada ─────────────────────────────────────────────
-- 6 caracteres de un alfabeto sin ambiguos: sin 0/O, sin 1/I/L. Se lee en voz
-- alta y se tipea de madrugada.
CREATE OR REPLACE FUNCTION public.nocturna_generar_codigo()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_alfabeto CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    v_codigo TEXT;
    v_intento INTEGER;
    v_pos INTEGER;
BEGIN
    -- 31^6 ≈ 887 millones: con unos miles de inscripciones el choque es
    -- improbable, pero el UNIQUE manda y por eso se reintenta.
    FOR v_intento IN 1..50 LOOP
        v_codigo := '';
        FOR v_pos IN 1..6 LOOP
            v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
        END LOOP;
        IF NOT EXISTS (SELECT 1 FROM public.nocturna_inscripciones WHERE codigo_entrada = v_codigo) THEN
            RETURN v_codigo;
        END IF;
    END LOOP;
    RAISE EXCEPTION 'No se pudo generar un código de entrada único';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.nocturna_generar_codigo() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.nocturna_generar_codigo() FROM anon;
REVOKE EXECUTE ON FUNCTION public.nocturna_generar_codigo() FROM authenticated;


-- ── Auxiliar: el alta, compartida por la pública y la del panel ─────────────
-- No se expone: la llaman register_nocturna y admin_crear_nocturna, que son
-- las que deciden si el comprobante es obligatorio y quién la ejecuta.
--
-- Forma de p_payload:
-- {
--   "adulto": { "nombre","apellido","dni","email","fechaNacimiento":"YYYY-MM-DD" },
--   "jovenes": [ { "nombre","apellido","dni","fechaNacimiento","tribu",
--                  "retiroTipo":"solo|adulto|otra_persona",
--                  "retiroNombre","retiroApellido","retiroDni","retiroTelefono" } ],
--   "autorizaAsistencia": true,
--   "aceptaFotos": true,
--   "declaracionesVersion": "2026-09-30",
--   "comprobantePath": "…"      -- opcional en el alta del panel
-- }
CREATE OR REPLACE FUNCTION public.nocturna_alta(
    p_payload JSONB,
    p_exigir_comprobante BOOLEAN,
    p_admin UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cfg            public.nocturna_config%ROWTYPE;
    v_adulto         JSONB;
    v_jovenes        JSONB;
    v_j              JSONB;
    v_nac            DATE;
    v_edad           INTEGER;
    v_n              INTEGER;
    v_dni            TEXT;
    v_dnis           TEXT[] := ARRAY[]::TEXT[];
    v_dup            TEXT;
    v_codigo         TEXT;
    v_insc_id        UUID;
    v_comprobante    TEXT;
    v_tribu          TEXT;
    v_retiro         TEXT;
BEGIN
    SELECT * INTO v_cfg FROM public.nocturna_config WHERE id = 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La configuración del evento no está cargada.');
    END IF;

    IF NOT v_cfg.inscripciones_abiertas AND p_admin IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Las inscripciones están cerradas.');
    END IF;

    v_adulto  := p_payload -> 'adulto';
    v_jovenes := COALESCE(p_payload -> 'jovenes', '[]'::jsonb);

    IF v_adulto IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Faltan los datos del adulto responsable.');
    END IF;

    -- Campos del adulto
    IF btrim(COALESCE(v_adulto->>'nombre',''))   = ''
    OR btrim(COALESCE(v_adulto->>'apellido','')) = ''
    OR btrim(COALESCE(v_adulto->>'dni',''))      = ''
    OR btrim(COALESCE(v_adulto->>'email',''))    = ''
    OR COALESCE(v_adulto->>'fechaNacimiento','') = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Completá todos los datos del adulto responsable.');
    END IF;

    BEGIN
        v_nac := (v_adulto->>'fechaNacimiento')::DATE;
    EXCEPTION WHEN others THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La fecha de nacimiento del adulto no es válida.');
    END;

    -- Mayoría de edad. Es EL chequeo que no puede vivir sólo en el navegador:
    -- quien firma la autorización de un menor tiene que ser mayor.
    v_edad := date_part('year', age(current_date, v_nac))::INTEGER;
    IF v_edad < 18 THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'El adulto responsable tiene que ser mayor de 18 años.');
    END IF;

    -- Al menos un chico
    v_n := jsonb_array_length(v_jovenes);
    IF v_n IS NULL OR v_n < 1 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Agregá al menos un chico a la inscripción.');
    END IF;

    -- Declaraciones. autoriza tiene que ser true; acepta_fotos tiene que venir
    -- (true o false), y se distingue "false" de "no vino" a propósito.
    IF COALESCE((p_payload->>'autorizaAsistencia')::BOOLEAN, false) IS NOT TRUE THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Sin la autorización de asistencia no se puede completar la inscripción.');
    END IF;

    IF p_payload->'aceptaFotos' IS NULL OR jsonb_typeof(p_payload->'aceptaFotos') <> 'boolean' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Falta responder sobre el uso de imágenes.');
    END IF;

    IF btrim(COALESCE(p_payload->>'declaracionesVersion','')) = '' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Falta la versión de las declaraciones.');
    END IF;

    -- Comprobante: obligatorio en la pública, opcional en el alta del panel.
    v_comprobante := NULLIF(btrim(COALESCE(p_payload->>'comprobantePath','')), '');
    IF p_exigir_comprobante AND v_comprobante IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Subí el comprobante de pago para terminar.');
    END IF;

    -- ── Chicos: validar TODO antes de insertar nada ─────────────────────────
    FOR v_j IN SELECT * FROM jsonb_array_elements(v_jovenes)
    LOOP
        IF btrim(COALESCE(v_j->>'nombre',''))   = ''
        OR btrim(COALESCE(v_j->>'apellido','')) = ''
        OR btrim(COALESCE(v_j->>'dni',''))      = ''
        OR COALESCE(v_j->>'fechaNacimiento','') = '' THEN
            RETURN jsonb_build_object('ok', false, 'error', 'Completá nombre, apellido, DNI y fecha de nacimiento de cada chico.');
        END IF;

        BEGIN
            PERFORM (v_j->>'fechaNacimiento')::DATE;
        EXCEPTION WHEN others THEN
            RETURN jsonb_build_object('ok', false, 'error',
                format('La fecha de nacimiento de %s no es válida.', btrim(v_j->>'nombre')));
        END;

        v_tribu := COALESCE(v_j->>'tribu', 'Sin tribu');
        IF v_tribu NOT IN ('Trueno','Garra','Sin tribu') THEN
            RETURN jsonb_build_object('ok', false, 'error',
                format('La tribu de %s no es válida.', btrim(v_j->>'nombre')));
        END IF;

        v_retiro := COALESCE(v_j->>'retiroTipo', '');
        IF v_retiro NOT IN ('solo','adulto','otra_persona') THEN
            RETURN jsonb_build_object('ok', false, 'error',
                format('Falta indicar cómo se retira %s.', btrim(v_j->>'nombre')));
        END IF;

        IF v_retiro = 'otra_persona' AND (
               btrim(COALESCE(v_j->>'retiroNombre',''))   = ''
            OR btrim(COALESCE(v_j->>'retiroApellido','')) = ''
            OR btrim(COALESCE(v_j->>'retiroDni',''))      = ''
            OR btrim(COALESCE(v_j->>'retiroTelefono','')) = ''
        ) THEN
            RETURN jsonb_build_object('ok', false, 'error',
                format('Faltan los datos de quien retira a %s.', btrim(v_j->>'nombre')));
        END IF;

        v_dnis := v_dnis || btrim(v_j->>'dni');
    END LOOP;

    -- DNI repetido dentro del mismo envío
    SELECT d INTO v_dup FROM unnest(v_dnis) AS d GROUP BY d HAVING count(*) > 1 LIMIT 1;
    IF v_dup IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            format('El DNI %s está cargado dos veces en esta inscripción.', v_dup));
    END IF;

    -- DNI ya inscripto en esta edición
    SELECT btrim(j.dni) INTO v_dup
    FROM public.nocturna_jovenes j
    WHERE j.edicion = v_cfg.edicion AND btrim(j.dni) = ANY (v_dnis)
    LIMIT 1;
    IF v_dup IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            format('Ya hay una inscripción con el DNI %s.', v_dup));
    END IF;

    -- ── Insertar ────────────────────────────────────────────────────────────
    -- El total se CALCULA acá. Si el cliente mandó un total, se ignora.
    v_codigo := public.nocturna_generar_codigo();

    BEGIN
        INSERT INTO public.nocturna_inscripciones (
            edicion, codigo_entrada, user_id,
            adulto_nombre, adulto_apellido, adulto_dni, adulto_email, adulto_fecha_nacimiento,
            autoriza_asistencia, acepta_fotos,
            declaraciones_version, declaraciones_aceptadas_at,
            precio_unitario, total,
            comprobante_path, cargado_por_admin
        ) VALUES (
            -- user_id es la cuenta de quien se inscribe, no la del admin que
            -- carga: en el alta del panel queda NULL aunque haya sesión.
            v_cfg.edicion, v_codigo, CASE WHEN p_admin IS NULL THEN auth.uid() ELSE NULL END,
            btrim(v_adulto->>'nombre'), btrim(v_adulto->>'apellido'),
            btrim(v_adulto->>'dni'), btrim(v_adulto->>'email'), v_nac,
            true, (p_payload->'aceptaFotos')::BOOLEAN,
            btrim(p_payload->>'declaracionesVersion'), now(),
            v_cfg.precio_entrada, v_cfg.precio_entrada * v_n,
            v_comprobante, p_admin
        )
        RETURNING id INTO v_insc_id;

        FOR v_j IN SELECT * FROM jsonb_array_elements(v_jovenes)
        LOOP
            INSERT INTO public.nocturna_jovenes (
                inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu,
                retiro_tipo, retiro_nombre, retiro_apellido, retiro_dni, retiro_telefono
            ) VALUES (
                v_insc_id, v_cfg.edicion,
                btrim(v_j->>'nombre'), btrim(v_j->>'apellido'), btrim(v_j->>'dni'),
                (v_j->>'fechaNacimiento')::DATE,
                COALESCE(v_j->>'tribu','Sin tribu'),
                v_j->>'retiroTipo',
                NULLIF(btrim(COALESCE(v_j->>'retiroNombre','')),''),
                NULLIF(btrim(COALESCE(v_j->>'retiroApellido','')),''),
                NULLIF(btrim(COALESCE(v_j->>'retiroDni','')),''),
                NULLIF(btrim(COALESCE(v_j->>'retiroTelefono','')),'')
            );
        END LOOP;
    EXCEPTION
        WHEN unique_violation THEN
            -- Carrera: dos envíos simultáneos con el mismo DNI que pasaron la
            -- validación de arriba. Postgres revierte los dos INSERT.
            RETURN jsonb_build_object('ok', false, 'error',
                'Alguno de los DNI ya quedó inscripto recién. Revisá los datos.');
    END;

    RETURN jsonb_build_object(
        'ok', true,
        'inscripcion_id', v_insc_id,
        'codigo_entrada', v_codigo,
        'total', v_cfg.precio_entrada * v_n
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.nocturna_alta(JSONB, BOOLEAN, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.nocturna_alta(JSONB, BOOLEAN, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.nocturna_alta(JSONB, BOOLEAN, UUID) FROM authenticated;


-- ── 5A · register_nocturna — pública ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_nocturna(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.nocturna_alta(p_payload, true, NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_nocturna(JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.register_nocturna(JSONB) TO anon, authenticated;


-- ── 5B · admin_crear_nocturna — sólo staff ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_crear_nocturna(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_nocturna_staff() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No tenés permisos para cargar inscripciones.');
    END IF;
    RETURN public.nocturna_alta(p_payload, false, auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_crear_nocturna(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_crear_nocturna(JSONB) FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_crear_nocturna(JSONB) TO authenticated;


-- ── 5C · get_nocturna_para_acreditar — sólo staff ───────────────────────────
-- Lo que lee el escáner. Distingue "no existe" de "no tenés permiso": el
-- operador tiene que saber si el QR es inválido o si le falta el rol.
CREATE OR REPLACE FUNCTION public.get_nocturna_para_acreditar(p_inscripcion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
        'retiro_tipo', j.retiro_tipo,
        'retiro_nombre', j.retiro_nombre,
        'retiro_apellido', j.retiro_apellido,
        'retiro_dni', j.retiro_dni,
        'retiro_telefono', j.retiro_telefono,
        'acreditado_at', j.acreditado_at
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
            'acepta_fotos', v_i.acepta_fotos,
            'adulto_acreditado_at', v_i.adulto_acreditado_at,
            'aprobado_at', v_i.aprobado_at,
            'total', v_i.total
        ),
        'jovenes', v_jovenes
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_nocturna_para_acreditar(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_nocturna_para_acreditar(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_nocturna_para_acreditar(UUID) TO authenticated;


-- ── 5D · set_nocturna_acreditacion — sólo staff ─────────────────────────────
-- Fija el estado EXACTO: lo usan el escáner y los tildes de "Ver detalles",
-- que marcan y desmarcan.
--
-- Estados válidos: nadie acreditado, o el adulto y al menos un chico. Un chico
-- acreditado sin el adulto no es un estado real — nadie entra sin su
-- responsable.
--
-- Los acreditado_at que ya estaban NO se pisan: la familia que llega
-- incompleta y se completa después conserva la hora de los primeros.
CREATE OR REPLACE FUNCTION public.set_nocturna_acreditacion(
    p_inscripcion_id UUID,
    p_adulto BOOLEAN,
    p_jovenes UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_i        public.nocturna_inscripciones%ROWTYPE;
    v_lista    UUID[] := COALESCE(p_jovenes, ARRAY[]::UUID[]);
    v_cuantos  INTEGER;
    v_ajenos   INTEGER;
    v_marcados INTEGER;
BEGIN
    IF NOT public.is_nocturna_staff() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No tenés permisos para acreditar.');
    END IF;

    SELECT * INTO v_i FROM public.nocturna_inscripciones WHERE id = p_inscripcion_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Esta entrada no existe o fue eliminada.');
    END IF;

    -- Duplicados en la lista no cambian el resultado, pero sí el conteo.
    SELECT count(DISTINCT u) INTO v_cuantos FROM unnest(v_lista) AS u;

    -- Ningún id ajeno a esta inscripción.
    SELECT count(*) INTO v_ajenos
    FROM unnest(v_lista) AS u
    WHERE NOT EXISTS (
        SELECT 1 FROM public.nocturna_jovenes j
        WHERE j.id = u AND j.inscripcion_id = p_inscripcion_id
    );
    IF v_ajenos > 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Alguno de los chicos no pertenece a esta entrada.');
    END IF;

    -- Estado válido. IS NOT TRUE y no "= false": p_adulto puede venir NULL.
    IF p_adulto IS NOT TRUE AND v_cuantos = 0 THEN
        NULL;                                   -- limpiar todo: válido
    ELSIF p_adulto IS TRUE AND v_cuantos >= 1 THEN
        NULL;                                   -- adulto + al menos un chico: válido
    ELSIF p_adulto IS TRUE THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'Marcá al menos un chico además del adulto.');
    ELSE
        RETURN jsonb_build_object('ok', false, 'error',
            'No se puede acreditar a un chico sin el adulto responsable.');
    END IF;

    -- Adulto: se fija la hora sólo si no la tenía.
    UPDATE public.nocturna_inscripciones
    SET adulto_acreditado_at = CASE
            WHEN p_adulto IS TRUE THEN COALESCE(adulto_acreditado_at, now())
            ELSE NULL
        END
    WHERE id = p_inscripcion_id;

    -- Chicos: los de la lista quedan acreditados (sin pisar la hora previa),
    -- los que no están se desmarcan.
    UPDATE public.nocturna_jovenes j
    SET acreditado_at = CASE
            WHEN j.id = ANY (v_lista) THEN COALESCE(j.acreditado_at, now())
            ELSE NULL
        END
    WHERE j.inscripcion_id = p_inscripcion_id;

    -- aprobado_at: se fija la primera vez que el estado es "acreditado", y
    -- vuelve a NULL si se desmarca todo.
    SELECT count(*) INTO v_marcados
    FROM public.nocturna_jovenes j
    WHERE j.inscripcion_id = p_inscripcion_id AND j.acreditado_at IS NOT NULL;

    UPDATE public.nocturna_inscripciones
    SET aprobado_at = CASE
            WHEN adulto_acreditado_at IS NOT NULL AND v_marcados >= 1 THEN COALESCE(aprobado_at, now())
            ELSE NULL
        END
    WHERE id = p_inscripcion_id;

    RETURN public.get_nocturna_para_acreditar(p_inscripcion_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[]) FROM anon;
GRANT  EXECUTE ON FUNCTION public.set_nocturna_acreditacion(UUID, BOOLEAN, UUID[]) TO authenticated;


-- ── 5E · update_nocturna_precio — sólo staff ────────────────────────────────
-- Cambia el precio de acá en adelante. Las inscripciones ya hechas conservan su
-- precio_unitario: es una foto, no una referencia.
CREATE OR REPLACE FUNCTION public.update_nocturna_precio(p_precio NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_nocturna_staff() THEN
        RETURN jsonb_build_object('ok', false, 'error', 'No tenés permisos para cambiar el precio.');
    END IF;

    IF p_precio IS NULL OR p_precio < 0 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'El precio no puede ser negativo.');
    END IF;

    UPDATE public.nocturna_config
    SET precio_entrada = p_precio, updated_at = now(), updated_by = auth.uid()
    WHERE id = 1;

    RETURN jsonb_build_object('ok', true, 'precio_entrada', p_precio);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_nocturna_precio(NUMERIC) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_nocturna_precio(NUMERIC) FROM anon;
GRANT  EXECUTE ON FUNCTION public.update_nocturna_precio(NUMERIC) TO authenticated;


-- La edición completa de una inscripción y el borrado van por las policies de
-- staff, sin RPC.

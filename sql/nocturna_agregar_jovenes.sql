-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — sumar un hermano a una inscripción que ya existe
-- 2026-10-02
--
-- Desde que un adulto no puede inscribirse dos veces (nocturna_sin_duplicados),
-- la familia que se olvidó de anotar a un hijo quedaba sin salida: el
-- formulario le dice que no y la única puerta era la mesa de ayuda.
--
-- Acá se abre la puerta correcta: en vez de una segunda inscripción, los
-- chicos nuevos se suman a la que ya tiene. Una familia, una entrada, un QR.
--
-- EL TRATO, que es lo que hay que entender antes de tocar esto:
--
--   · Para ver a los chicos de una inscripción no alcanza con el DNI. Son
--     menores: si bastara el DNI, cualquiera que tipee números ve nombres de
--     chicos. Hace falta DNI **y** fecha de nacimiento del adulto, que son
--     los dos datos que esa persona ya escribe en el primer paso.
--   · Con el DNI solo se contesta "hay una inscripción con ese DNI" y nada
--     más — ni el id, ni un nombre. Eso ya lo decía el error del final del
--     formulario, así que no agrega nada nuevo.
--   · Por acá se AGREGA, no se edita. Los chicos cargados no se tocan: ni se
--     renombran, ni se borran, ni se les cambia el retiro. Para eso está el
--     panel del evento, que pide sesión y rol.
--   · Se paga sólo por los que se agregan, al precio que pagó esa familia, no
--     al de hoy. El comprobante nuevo se guarda APARTE del original: los dos
--     pagos tienen que poder verificarse por separado.
--   · La inscripción vuelve a quedar pendiente de aprobación, porque hay un
--     pago nuevo que nadie miró todavía.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 1 — Los pagos que vienen después del primero
-- ════════════════════════════════════════════════════════════════════════════
-- `nocturna_inscripciones.comprobante_path` es el comprobante del alta y sigue
-- siéndolo: no se migra nada. Esta tabla guarda los que llegan después, que
-- antes no tenían dónde ir.

CREATE TABLE IF NOT EXISTS public.nocturna_comprobantes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inscripcion_id UUID NOT NULL
                   REFERENCES public.nocturna_inscripciones(id) ON DELETE CASCADE,

    path   TEXT NOT NULL CHECK (btrim(path) <> ''),

    -- Cuánto cubre este pago y por cuántos chicos. Guardados y no calculados:
    -- si mañana cambia el precio, lo que pagó esta familia no cambia.
    monto  NUMERIC(12,2) NOT NULL CHECK (monto >= 0),
    chicos INTEGER       NOT NULL CHECK (chicos > 0),

    -- La constancia de ESTE agregado. El adulto autoriza a los chicos nuevos,
    -- y eso no lo cubre lo que firmó al inscribirse: esos chicos no existían
    -- en el formulario. Qué texto aceptó y cuándo, igual que en el alta.
    declaraciones_version      TEXT        NOT NULL CHECK (btrim(declaraciones_version) <> ''),
    declaraciones_aceptadas_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    subido_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Para una base donde este archivo ya corrió sin las dos columnas de arriba.
ALTER TABLE public.nocturna_comprobantes
    ADD COLUMN IF NOT EXISTS declaraciones_version      TEXT        NOT NULL DEFAULT 'desconocida',
    ADD COLUMN IF NOT EXISTS declaraciones_aceptadas_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.nocturna_comprobantes ALTER COLUMN declaraciones_version DROP DEFAULT;

CREATE INDEX IF NOT EXISTS idx_nocturna_comprobantes_insc
    ON public.nocturna_comprobantes(inscripcion_id);

COMMENT ON TABLE public.nocturna_comprobantes IS
    'Pagos posteriores al alta (chicos agregados). El comprobante del alta vive en nocturna_inscripciones.comprobante_path.';

ALTER TABLE public.nocturna_comprobantes ENABLE ROW LEVEL SECURITY;

-- Sólo lectura, y sólo staff. Escribe nocturna_agregar_jovenes, que es
-- SECURITY DEFINER: nadie inserta acá desde el cliente.
DROP POLICY IF EXISTS nocturna_comp_select_staff ON public.nocturna_comprobantes;
CREATE POLICY nocturna_comp_select_staff ON public.nocturna_comprobantes
    FOR SELECT TO authenticated USING (public.is_nocturna_staff());


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 2 — Buscar el grupo familiar
-- ════════════════════════════════════════════════════════════════════════════
-- La llama el formulario público al terminar el paso del adulto, para avisarle
-- ANTES de que llene todo y transfiera, no después.
--
-- Tres respuestas posibles, y la del medio es la que protege a los chicos:
--   { existe: false }                        → seguí normal
--   { existe: true, verificado: false }      → hay algo con ese DNI, y nada más
--   { existe: true, verificado: true, ... }  → es tu inscripción, acá está

CREATE OR REPLACE FUNCTION public.nocturna_buscar_grupo(
    p_dni              TEXT,
    p_fecha_nacimiento DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_edicion INTEGER;
    v_i       public.nocturna_inscripciones%ROWTYPE;
    v_chicos  JSONB;
BEGIN
    SELECT edicion INTO v_edicion FROM public.nocturna_config LIMIT 1;
    IF v_edicion IS NULL OR btrim(COALESCE(p_dni, '')) = '' THEN
        RETURN jsonb_build_object('existe', false);
    END IF;

    SELECT * INTO v_i
      FROM public.nocturna_inscripciones i
     WHERE i.edicion = v_edicion
       AND btrim(i.adulto_dni) = btrim(p_dni)
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('existe', false);
    END IF;

    -- El portón. Ojo al orden: acá no se devuelve NADA de la inscripción, ni
    -- siquiera el id. Quien escribió un DNI ajeno se entera de que existe
    -- —cosa que el error del formulario ya le decía— y hasta ahí llega.
    IF p_fecha_nacimiento IS NULL OR v_i.adulto_fecha_nacimiento <> p_fecha_nacimiento THEN
        RETURN jsonb_build_object('existe', true, 'verificado', false);
    END IF;

    SELECT COALESCE(jsonb_agg(
               jsonb_build_object(
                   'nombre',   j.nombre,
                   'apellido', j.apellido,
                   -- Enmascarado: para reconocerlo alcanza, para copiárselo no.
                   'dni',      '••••' || right(btrim(j.dni), 3),
                   'tribu',    j.tribu
               ) ORDER BY j.nombre), '[]'::jsonb)
      INTO v_chicos
      FROM public.nocturna_jovenes j
     WHERE j.inscripcion_id = v_i.id;

    RETURN jsonb_build_object(
        'existe',          true,
        'verificado',      true,
        'inscripcionId',   v_i.id,
        'adultoNombre',    v_i.adulto_nombre,
        'precioUnitario',  v_i.precio_unitario,
        'chicos',          v_chicos
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.nocturna_buscar_grupo(TEXT, DATE) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.nocturna_buscar_grupo(TEXT, DATE) TO anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- PASO 3 — Agregar los chicos
-- ════════════════════════════════════════════════════════════════════════════
-- Payload:
--   { "adulto": { "dni", "fechaNacimiento" },
--     "jovenes": [ { … igual que en el alta … } ],
--     "declaracionesVersion": "…",
--     "comprobantePath": "…" }
--
-- Es el mismo objeto que arma armarPayloadNocturna para el alta: los campos
-- que acá no se usan se ignoran, y así el formulario no necesita otra forma
-- de armar lo mismo.
--
-- Del adulto sólo se leen esos dos campos, y son para identificarlo. Lo demás
-- de la inscripción —nombre, email, declaraciones, precio— sale de la fila que
-- ya está guardada: lo que mande el cliente no puede cambiar nada de eso.

CREATE OR REPLACE FUNCTION public.nocturna_agregar_jovenes(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cfg          public.nocturna_config%ROWTYPE;
    v_i            public.nocturna_inscripciones%ROWTYPE;
    v_jovenes      JSONB;
    v_j            JSONB;
    v_dni          TEXT;
    v_nac          DATE;
    v_comprobante  TEXT;
    v_version      TEXT;
    v_error        TEXT;
    v_n            INTEGER;
    v_dnis         TEXT[];
    v_repetido     TEXT;
    v_total_chicos INTEGER;
BEGIN
    SELECT * INTO v_cfg FROM public.nocturna_config LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'error', 'La configuración de Nocturna no está cargada.');
    END IF;

    IF NOT v_cfg.inscripciones_abiertas THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Las inscripciones están cerradas.');
    END IF;

    -- ── Quién dice ser ──────────────────────────────────────────────────────
    v_dni := btrim(COALESCE(p_payload->'adulto'->>'dni', ''));
    BEGIN
        v_nac := (p_payload->'adulto'->>'fechaNacimiento')::DATE;
    EXCEPTION WHEN others THEN
        v_nac := NULL;
    END;

    SELECT * INTO v_i
      FROM public.nocturna_inscripciones i
     WHERE i.edicion = v_cfg.edicion
       AND btrim(i.adulto_dni) = v_dni
     LIMIT 1;

    -- Un solo mensaje para "no existe" y para "la fecha no coincide": decir
    -- cuál de las dos falló es decirle a quien prueba números si acertó.
    IF NOT FOUND OR v_nac IS NULL OR v_i.adulto_fecha_nacimiento <> v_nac THEN
        RETURN jsonb_build_object('ok', false, 'error',
            'No encontramos una inscripción con ese DNI y esa fecha de nacimiento.');
    END IF;

    -- ── Lo que se agrega ────────────────────────────────────────────────────
    v_comprobante := NULLIF(btrim(COALESCE(p_payload->>'comprobantePath', '')), '');
    IF v_comprobante IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Subí el comprobante de pago para terminar.');
    END IF;

    v_version := NULLIF(btrim(COALESCE(p_payload->>'declaracionesVersion', '')), '');
    IF v_version IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Falta la versión de las declaraciones.');
    END IF;

    v_jovenes := COALESCE(p_payload->'jovenes', '[]'::jsonb);
    v_n := jsonb_array_length(v_jovenes);
    IF v_n IS NULL OR v_n < 1 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Agregá al menos un adolescente.');
    END IF;

    -- La misma validación que el alta, con el adulto REAL de la inscripción
    -- —no el que vino en el payload— y excluyendo a esta inscripción, que si
    -- no chocaría contra sí misma.
    v_error := public.nocturna_validar_payload(
        jsonb_build_object(
            'adulto', jsonb_build_object(
                'nombre',          v_i.adulto_nombre,
                'apellido',        v_i.adulto_apellido,
                'dni',             v_i.adulto_dni,
                'email',           v_i.adulto_email,
                'fechaNacimiento', v_i.adulto_fecha_nacimiento),
            'jovenes',            v_jovenes,
            'autorizaAsistencia', true,
            'aceptaFotos',        v_i.acepta_fotos),
        v_cfg.edicion, false, false, v_i.id);

    IF v_error IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', v_error);
    END IF;

    -- Excluir la inscripción apagó, para estos DNI, el chequeo contra sus
    -- propios chicos. Es justo el error más probable de este formulario: "no
    -- me acuerdo si ya lo anoté".
    SELECT array_agg(btrim(x->>'dni')) INTO v_dnis
      FROM jsonb_array_elements(v_jovenes) AS x;

    SELECT j.nombre INTO v_repetido
      FROM public.nocturna_jovenes j
     WHERE j.inscripcion_id = v_i.id
       AND btrim(j.dni) = ANY (v_dnis)
     LIMIT 1;
    IF v_repetido IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'error',
            format('%s ya está anotado en esta inscripción.', v_repetido));
    END IF;

    -- ── Agregar ─────────────────────────────────────────────────────────────
    BEGIN
        FOR v_j IN SELECT * FROM jsonb_array_elements(v_jovenes)
        LOOP
            INSERT INTO public.nocturna_jovenes (
                inscripcion_id, edicion, nombre, apellido, dni, fecha_nacimiento, tribu,
                retiro_tipo, retiro_nombre, retiro_apellido, retiro_dni, retiro_telefono
            ) VALUES (
                v_i.id, v_cfg.edicion,
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

        SELECT count(*) INTO v_total_chicos
          FROM public.nocturna_jovenes WHERE inscripcion_id = v_i.id;

        -- El total, con el precio que pagó esta familia. `aprobado_at` vuelve
        -- a NULL: hay un pago nuevo que nadie verificó.
        UPDATE public.nocturna_inscripciones
           SET total       = v_i.precio_unitario * v_total_chicos,
               aprobado_at = NULL
         WHERE id = v_i.id;

        INSERT INTO public.nocturna_comprobantes (
            inscripcion_id, path, monto, chicos,
            declaraciones_version, declaraciones_aceptadas_at)
        VALUES (
            v_i.id, v_comprobante, v_i.precio_unitario * v_n, v_n,
            v_version, now());
    EXCEPTION
        WHEN unique_violation THEN
            RETURN jsonb_build_object('ok', false, 'error',
                'Alguno de los DNI ya quedó inscripto recién. Revisá los datos.');
    END;

    RETURN jsonb_build_object(
        'ok',             true,
        'inscripcionId',  v_i.id,
        'codigoEntrada',  v_i.codigo_entrada,
        'agregados',      v_n,
        'aPagar',         v_i.precio_unitario * v_n,
        'total',          v_i.precio_unitario * v_total_chicos
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.nocturna_agregar_jovenes(JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.nocturna_agregar_jovenes(JSONB) TO anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- VOLUNTARIOS · comprar remeras y buzos del Punto con una transferencia
-- ════════════════════════════════════════════════════════════════════════════
--
-- /voluntarios deja que CUALQUIER persona con sesión arme un pedido, lo pague
-- con una transferencia y suba el comprobante. No se mira el rol: el que
-- compra es cualquiera, no el que atiende el stand.
--
-- Todo el trabajo lo hace la base, en registrar_venta_voluntario(). Desde el
-- cliente no se puede: descontar stock, fijar el precio o decidir el total.
-- Tres razones:
--
--   · El precio sale SIEMPRE de info_products. Si el cliente mandara el
--     total, cualquiera compraría un buzo a un peso.
--   · El stock se reserva con FOR UPDATE. Dos personas comprando el último
--     talle 3 al mismo tiempo: una lo lleva y la otra ve "sin stock", en vez
--     de vender dos veces lo que hay una vez.
--   · O entra todo —venta, ítems, movimientos y stock— o no entra nada. Una
--     venta a medias deja plata cobrada sin prenda descontada.
--
-- El id de la venta lo manda el cliente, como en registrar_reporte_stock: si
-- el envío se corta y se reintenta, el segundo llega con el mismo id y la
-- base devuelve la venta que ya había, en vez de cobrar dos veces.
--
-- El comprobante lleva nombre, CBU y monto, así que va a un bucket PRIVADO y
-- cada uno sube sólo a su propia carpeta. Se lee con URL firmada.
--
-- camelCase entre comillas sólo en movements, que así está esa tabla. Las
-- tablas nuevas van en snake_case, como el resto del esquema.
--
-- Vuelta atrás: sql/ROLLBACK_voluntarios_ventas.sql
-- Pruebas:      sql/PROBAR_voluntarios_ventas.sql
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- PASO 1 — Las dos tablas
-- ════════════════════════════════════════════════════════════════════════════

-- ── La venta ────────────────────────────────────────────────────────────────
--
-- El nombre, el apellido, el teléfono y el email se copian EN EL MOMENTO.
-- No es redundancia: el Punto tiene que poder decir a quién le entrega una
-- prenda aunque esa persona después se renombre o se borre. Y así el panel no
-- depende de users, que tiene su propia RLS.
CREATE TABLE IF NOT EXISTS public.ventas_voluntarios (
    -- SIN default: lo genera el cliente para que el reintento sea idempotente.
    id   UUID PRIMARY KEY,

    -- 'VOL-' + 4 caracteres sin ambiguos. Es lo que la persona muestra en el
    -- stand: nadie tiene que distinguir una O de un cero.
    codigo TEXT NOT NULL UNIQUE
           CHECK (codigo ~ '^VOL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$'),

    -- Sin FK a users: si alguien se borra, su compra no se borra con él. El
    -- Punto ya entregó la prenda y la venta tiene que seguir existiendo.
    user_id  UUID NOT NULL,
    nombre   TEXT,
    apellido TEXT,
    telefono TEXT,
    email    TEXT,

    total    NUMERIC NOT NULL CHECK (total >= 0),
    unidades INTEGER NOT NULL CHECK (unidades > 0),

    -- Dónde quedó el comprobante dentro del bucket privado.
    comprobante_path TEXT NOT NULL CHECK (btrim(comprobante_path) <> ''),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ventas_voluntarios IS
    'Compras de remeras y buzos hechas desde /voluntarios y pagadas por transferencia.';
COMMENT ON COLUMN public.ventas_voluntarios.id IS
    'Lo genera el cliente. Reintentar con el mismo id devuelve la venta que ya estaba, no cobra de nuevo.';
COMMENT ON COLUMN public.ventas_voluntarios.nombre IS
    'Copia del momento: el Punto tiene que saber a quién entregar aunque la persona se renombre o se borre.';

CREATE INDEX IF NOT EXISTS ventas_voluntarios_user_idx
    ON public.ventas_voluntarios (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ventas_voluntarios_fecha_idx
    ON public.ventas_voluntarios (created_at DESC);

-- ── Los renglones del pedido ────────────────────────────────────────────────
--
-- El precio se copia acá también: dentro de un mes el precio de la remera va
-- a ser otro y esta venta tiene que seguir diciendo cuánto se pagó.
CREATE TABLE IF NOT EXISTS public.ventas_voluntarios_items (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    venta_id UUID NOT NULL
             REFERENCES public.ventas_voluntarios(id) ON DELETE CASCADE,

    product_code TEXT NOT NULL REFERENCES public.info_products(code),
    product_name TEXT,
    type         TEXT,
    size         TEXT,

    -- Hasta 5 por talle: esto es para voluntarios, no para revender.
    cantidad         INTEGER NOT NULL CHECK (cantidad BETWEEN 1 AND 5),
    precio_unitario  NUMERIC NOT NULL CHECK (precio_unitario >= 0),
    subtotal         NUMERIC NOT NULL CHECK (subtotal >= 0),

    -- Un talle aparece una sola vez por pedido: dos renglones del mismo talle
    -- serían dos cantidades peleando por el mismo stock.
    UNIQUE (venta_id, product_code)
);

COMMENT ON TABLE public.ventas_voluntarios_items IS
    'Qué se llevó en cada compra, con el precio del momento.';

CREATE INDEX IF NOT EXISTS ventas_voluntarios_items_venta_idx
    ON public.ventas_voluntarios_items (venta_id);

-- ════════════════════════════════════════════════════════════════════════════
-- PASO 2 — movements: la transferencia y de qué venta salió
-- ════════════════════════════════════════════════════════════════════════════
--
-- El CHECK real se llama movements_payment_method_check (verificado contra
-- pg_constraint). Hasta ahora sólo aceptaba Efectivo y Mercado Pago: una
-- compra de voluntario se paga por transferencia y sin esto el alta no entra.
ALTER TABLE public.movements
    DROP CONSTRAINT IF EXISTS movements_payment_method_check;

ALTER TABLE public.movements
    ADD CONSTRAINT movements_payment_method_check
    CHECK ("paymentMethod" = ANY (ARRAY['Efectivo'::text, 'Mercado Pago'::text, 'Transferencia'::text]));

-- De qué venta salió este movimiento. ON DELETE SET NULL, igual que
-- "reportId": borrar una venta no puede borrar el historial de stock, que es
-- lo que explica por qué hoy hay 7 remeras y no 9.
ALTER TABLE public.movements
    ADD COLUMN IF NOT EXISTS "ventaId" UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'movements_ventaId_fkey'
    ) THEN
        ALTER TABLE public.movements
            ADD CONSTRAINT "movements_ventaId_fkey"
            FOREIGN KEY ("ventaId")
            REFERENCES public.ventas_voluntarios(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON COLUMN public.movements."ventaId" IS
    'La compra de /voluntarios que generó este movimiento. NULL si se cargó en el stand.';

CREATE INDEX IF NOT EXISTS "movements_ventaId_idx"
    ON public.movements ("ventaId") WHERE "ventaId" IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- PASO 3 — El código de la venta
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.voluntarios_generar_codigo()
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
    -- 31^4 ≈ 923 mil. Son pocas compras al año, pero el UNIQUE manda y por
    -- eso se reintenta.
    FOR v_intento IN 1..50 LOOP
        v_codigo := 'VOL-';
        FOR v_pos IN 1..4 LOOP
            v_codigo := v_codigo || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
        END LOOP;
        IF NOT EXISTS (SELECT 1 FROM public.ventas_voluntarios WHERE codigo = v_codigo) THEN
            RETURN v_codigo;
        END IF;
    END LOOP;
    RAISE EXCEPTION 'No se pudo generar un código de compra único';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.voluntarios_generar_codigo() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.voluntarios_generar_codigo() FROM anon;
REVOKE EXECUTE ON FUNCTION public.voluntarios_generar_codigo() FROM authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- PASO 4 — La compra
-- ════════════════════════════════════════════════════════════════════════════
--
-- Devuelve jsonb. Dos clases de respuesta, distintas a propósito:
--
--   · Lo que la persona puede resolver mirando la pantalla —se agotó un
--     talle, cambió el precio— vuelve como {ok:false, motivo} y la pantalla
--     lo explica sin perder el pedido ni el comprobante.
--   · Lo que no debería pasar nunca si el cliente está bien hecho —sin
--     sesión, pedido inválido, comprobante ajeno— es RAISE: que falle fuerte
--     y quede en los logs.
CREATE OR REPLACE FUNCTION public.registrar_venta_voluntario(
    p_id                UUID,
    p_items             JSONB,
    p_comprobante_path  TEXT,
    p_total_esperado    NUMERIC,
    p_telefono          TEXT DEFAULT NULL,
    p_guardar_telefono  BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    quien         UUID := auth.uid();
    ya            public.ventas_voluntarios%ROWTYPE;
    cuantos       INTEGER;
    item          JSONB;
    producto      RECORD;
    v_total       NUMERIC := 0;
    v_unidades    INTEGER := 0;
    v_codigo      TEXT;
    v_nombre      TEXT;
    v_apellido    TEXT;
    v_telefono    TEXT;
    v_email       TEXT;
    v_name_entero TEXT;
    faltantes     JSONB := '[]'::jsonb;
    pedido        JSONB;
BEGIN
    -- ── a · Sin sesión no hay compra ────────────────────────────────────────
    IF quien IS NULL THEN
        RAISE EXCEPTION 'sin_sesion';
    END IF;

    -- ── b · ¿Ya estaba? El reintento no cobra de nuevo ─────────────────────
    SELECT * INTO ya FROM public.ventas_voluntarios WHERE id = p_id;
    IF FOUND THEN
        -- Del mismo usuario: es su reintento. De otro: alguien mandó un id
        -- que no le pertenece.
        IF ya.user_id <> quien THEN
            RAISE EXCEPTION 'pedido_invalido: el id de la compra ya existe';
        END IF;
        RETURN jsonb_build_object(
            'ok', true, 'repetido', true,
            'id', ya.id, 'codigo', ya.codigo, 'total', ya.total,
            'unidades', ya.unidades, 'created_at', ya.created_at
        );
    END IF;

    -- ── c · El pedido tiene que tener forma de pedido ──────────────────────
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'pedido_invalido: no hay nada en el pedido';
    END IF;

    FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        IF item->>'code' IS NULL OR btrim(item->>'code') = '' THEN
            RAISE EXCEPTION 'pedido_invalido: falta el código de un producto';
        END IF;
        -- Entero entre 1 y 5. El ~ '^\d+$' atrapa los decimales: '2.5' no es
        -- una cantidad de remeras.
        IF item->>'cantidad' IS NULL OR (item->>'cantidad') !~ '^\d+$' THEN
            RAISE EXCEPTION 'pedido_invalido: la cantidad tiene que ser un número entero';
        END IF;
        IF (item->>'cantidad')::int NOT BETWEEN 1 AND 5 THEN
            RAISE EXCEPTION 'pedido_invalido: se pueden llevar entre 1 y 5 por talle';
        END IF;
    END LOOP;

    -- Un talle repetido serían dos renglones peleando por el mismo stock.
    SELECT count(DISTINCT e->>'code') INTO cuantos FROM jsonb_array_elements(p_items) e;
    IF cuantos <> jsonb_array_length(p_items) THEN
        RAISE EXCEPTION 'pedido_invalido: hay un talle repetido';
    END IF;

    -- Todos los códigos tienen que existir.
    SELECT count(*) INTO cuantos
      FROM jsonb_array_elements(p_items) e
      JOIN public.info_products p ON p.code = e->>'code';
    IF cuantos <> jsonb_array_length(p_items) THEN
        RAISE EXCEPTION 'pedido_invalido: hay un producto que no existe';
    END IF;

    -- ── d · El comprobante tiene que ser suyo y tiene que existir ──────────
    IF p_comprobante_path IS NULL
       OR p_comprobante_path NOT LIKE quien::text || '/%'
       OR NOT EXISTS (
            SELECT 1 FROM storage.objects
             WHERE bucket_id = 'voluntarios-comprobantes'
               AND name = p_comprobante_path
       )
    THEN
        RAISE EXCEPTION 'comprobante_invalido';
    END IF;

    -- ── h · El teléfono ────────────────────────────────────────────────────
    SELECT u.phone, u.email, u.name INTO v_telefono, v_email, v_name_entero
      FROM public.users u WHERE u.id = quien;

    IF btrim(COALESCE(p_telefono, '')) <> '' THEN
        v_telefono := btrim(p_telefono);
        -- Se guarda en el perfil sólo si estaba vacío y la persona lo pidió:
        -- una compra no es el lugar para pisarle el teléfono a nadie.
        IF p_guardar_telefono AND btrim(COALESCE((SELECT u.phone FROM public.users u WHERE u.id = quien), '')) = '' THEN
            UPDATE public.users SET phone = v_telefono WHERE id = quien;
        END IF;
    END IF;

    IF btrim(COALESCE(v_telefono, '')) = '' THEN
        RAISE EXCEPTION 'falta_telefono';
    END IF;

    -- ── i · Nombre y apellido ──────────────────────────────────────────────
    -- users.name guarda el nombre entero. Se parte como lo hace el resto de
    -- la app (ModalCrearGrupo): la primera palabra es el nombre, el resto el
    -- apellido.
    v_name_entero := btrim(COALESCE(v_name_entero, ''));
    IF v_name_entero = '' THEN
        v_nombre := NULL;
        v_apellido := NULL;
    ELSE
        v_nombre := split_part(v_name_entero, ' ', 1);
        v_apellido := NULLIF(btrim(substr(v_name_entero, length(v_nombre) + 1)), '');
    END IF;

    -- ── e · El stock, trabado hasta el final de la transacción ─────────────
    --
    -- ORDER BY code: si dos compras se cruzan, las dos piden las filas en el
    -- mismo orden y una espera a la otra. Sin ese orden se abrazan y una
    -- muere por deadlock.
    FOR producto IN
        SELECT p.code, p.name, p.type, p.size,
               COALESCE(p.stock, 0) AS stock,
               COALESCE(p.price, 0) AS price,
               (SELECT (e->>'cantidad')::int
                  FROM jsonb_array_elements(p_items) e
                 WHERE e->>'code' = p.code) AS pedido
          FROM public.info_products p
         WHERE p.code IN (SELECT e->>'code' FROM jsonb_array_elements(p_items) e)
         ORDER BY p.code
           FOR UPDATE
    LOOP
        -- ── f · ¿Alcanza? ──────────────────────────────────────────────────
        IF producto.stock < producto.pedido THEN
            faltantes := faltantes || jsonb_build_object(
                'code', producto.code,
                'type', producto.type,
                'size', producto.size,
                'disponible', producto.stock
            );
        END IF;

        v_total    := v_total + (producto.price * producto.pedido);
        v_unidades := v_unidades + producto.pedido;
    END LOOP;

    IF jsonb_array_length(faltantes) > 0 THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'sin_stock', 'items', faltantes);
    END IF;

    -- ── g · El precio lo pone la base, no el cliente ───────────────────────
    IF p_total_esperado IS NULL OR v_total <> p_total_esperado THEN
        RETURN jsonb_build_object('ok', false, 'motivo', 'precio_cambio', 'total', v_total);
    END IF;

    -- ── j · El código ──────────────────────────────────────────────────────
    v_codigo := public.voluntarios_generar_codigo();

    -- ── k · La venta, los renglones, los movimientos y el stock ────────────
    INSERT INTO public.ventas_voluntarios
        (id, codigo, user_id, nombre, apellido, telefono, email,
         total, unidades, comprobante_path)
    VALUES
        (p_id, v_codigo, quien, v_nombre, v_apellido, v_telefono, v_email,
         v_total, v_unidades, p_comprobante_path);

    FOR producto IN
        SELECT p.code, p.name, p.type, p.size,
               COALESCE(p.price, 0) AS price,
               (SELECT (e->>'cantidad')::int
                  FROM jsonb_array_elements(p_items) e
                 WHERE e->>'code' = p.code) AS pedido
          FROM public.info_products p
         WHERE p.code IN (SELECT e->>'code' FROM jsonb_array_elements(p_items) e)
         ORDER BY p.code
    LOOP
        INSERT INTO public.ventas_voluntarios_items
            (venta_id, product_code, product_name, type, size,
             cantidad, precio_unitario, subtotal)
        VALUES
            (p_id, producto.code, producto.name, producto.type, producto.size,
             producto.pedido, producto.price, producto.price * producto.pedido);

        -- Primero el movimiento, después el stock: el disparador
        -- completar_movimiento lee info_products para guardar el
        -- "previousStock", y si el stock ya bajó guardaría el de después.
        INSERT INTO public.movements
            (id, "productCode", "productName", type, quantity, date, "paymentMethod", "ventaId")
        VALUES
            (gen_random_uuid()::text, producto.code, producto.name, 'Salida',
             producto.pedido, now(), 'Transferencia', p_id);

        UPDATE public.info_products
           SET stock = COALESCE(stock, 0) - producto.pedido
         WHERE code = producto.code;
    END LOOP;

    -- ── l · Lo que la pantalla muestra ─────────────────────────────────────
    SELECT * INTO ya FROM public.ventas_voluntarios WHERE id = p_id;
    RETURN jsonb_build_object(
        'ok', true, 'repetido', false,
        'id', ya.id, 'codigo', ya.codigo, 'total', ya.total,
        'unidades', ya.unidades, 'created_at', ya.created_at
    );
END;
$$;

COMMENT ON FUNCTION public.registrar_venta_voluntario(UUID, JSONB, TEXT, NUMERIC, TEXT, BOOLEAN) IS
    'La compra de /voluntarios, entera: valida, reserva el stock con FOR UPDATE, fija el precio con el de la base y descuenta. Idempotente por p_id.';

REVOKE EXECUTE ON FUNCTION public.registrar_venta_voluntario(UUID, JSONB, TEXT, NUMERIC, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.registrar_venta_voluntario(UUID, JSONB, TEXT, NUMERIC, TEXT, BOOLEAN) FROM anon;
GRANT  EXECUTE ON FUNCTION public.registrar_venta_voluntario(UUID, JSONB, TEXT, NUMERIC, TEXT, BOOLEAN) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- PASO 5 — Quién ve las ventas
-- ════════════════════════════════════════════════════════════════════════════
--
-- Leer: el Punto, los que miran reportes, y cada uno lo suyo. Escribir: nadie
-- directamente — la única puerta es la RPC, que es SECURITY DEFINER y por eso
-- no la frena esta RLS.
ALTER TABLE public.ventas_voluntarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas_voluntarios_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ventas_voluntarios       FROM anon;
REVOKE ALL ON public.ventas_voluntarios_items FROM anon;
GRANT  SELECT ON public.ventas_voluntarios       TO authenticated;
GRANT  SELECT ON public.ventas_voluntarios_items TO authenticated;

DROP POLICY IF EXISTS ventas_voluntarios_lectura ON public.ventas_voluntarios;
CREATE POLICY ventas_voluntarios_lectura ON public.ventas_voluntarios
    FOR SELECT TO authenticated
    USING (
        public.atiende_el_punto()
        OR public.tiene_rol(ARRAY['PASTOR', 'REPORTES'])
        OR user_id = auth.uid()
    );

-- Los renglones se miran a través de su venta: el que puede ver la compra
-- puede ver qué tenía adentro, y nadie más.
DROP POLICY IF EXISTS ventas_voluntarios_items_lectura ON public.ventas_voluntarios_items;
CREATE POLICY ventas_voluntarios_items_lectura ON public.ventas_voluntarios_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.ventas_voluntarios v
         WHERE v.id = venta_id
           AND (
                public.atiende_el_punto()
                OR public.tiene_rol(ARRAY['PASTOR', 'REPORTES'])
                OR v.user_id = auth.uid()
           )
    ));

-- ════════════════════════════════════════════════════════════════════════════
-- PASO 6 — El bucket de los comprobantes
-- ════════════════════════════════════════════════════════════════════════════
--
-- PRIVADO. Un comprobante de transferencia lleva nombre, CBU y monto: no
-- puede quedar en una URL que adivine cualquiera. El panel lo mira con URL
-- firmada de 5 minutos.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'voluntarios-comprobantes',
    'voluntarios-comprobantes',
    false,
    10485760,                                    -- 10 MB
    ARRAY['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO UPDATE
    SET public = false,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Subir: con sesión y SÓLO a la carpeta propia. Sin esto, cualquiera podría
-- dejar un archivo en la carpeta de otro y después comprar con él.
DROP POLICY IF EXISTS voluntarios_comprobantes_insert ON storage.objects;
CREATE POLICY voluntarios_comprobantes_insert ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'voluntarios-comprobantes'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Leer: el Punto, los que miran reportes, y cada uno el suyo.
DROP POLICY IF EXISTS voluntarios_comprobantes_select ON storage.objects;
CREATE POLICY voluntarios_comprobantes_select ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'voluntarios-comprobantes'
        AND (
            public.atiende_el_punto()
            OR public.tiene_rol(ARRAY['PASTOR', 'REPORTES'])
            OR (storage.foldername(name))[1] = auth.uid()::text
        )
    );

-- Sin UPDATE ni DELETE: un comprobante es la constancia de un pago. Si se
-- pudiera reemplazar, la constancia no serviría de nada.

COMMIT;

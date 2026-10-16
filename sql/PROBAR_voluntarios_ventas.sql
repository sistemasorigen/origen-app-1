-- ════════════════════════════════════════════════════════════════════════════
-- PRUEBAS de sql/voluntarios_ventas.sql
-- ════════════════════════════════════════════════════════════════════════════
--
-- Todo adentro de BEGIN … ROLLBACK: no deja nada. Los datos llevan PRUEBA.
--
-- Las sesiones se simulan con request.jwt.claims + SET LOCAL ROLE, que es lo
-- que hace PostgREST: así auth.uid() devuelve a quien corresponde y las
-- policies se evalúan de verdad, no en teoría.
--
-- Cada caso imprime una fila con lo que se esperaba al lado. Se lee de arriba
-- abajo: todas las columnas "ok_*" tienen que dar true.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- El escenario
-- ════════════════════════════════════════════════════════════════════════════
CREATE TEMP TABLE ids (que TEXT PRIMARY KEY, val UUID) ON COMMIT DROP;
INSERT INTO ids VALUES
    ('compra',   '11111111-aaaa-4aaa-8aaa-000000000001'),  -- usuario común
    ('otro',     '11111111-aaaa-4aaa-8aaa-000000000002'),  -- otro común
    ('punto',    '11111111-aaaa-4aaa-8aaa-000000000003'),  -- ENCARGADO_PUNTO
    ('pastor',   '11111111-aaaa-4aaa-8aaa-000000000004'),  -- PASTOR
    ('sintel',   '11111111-aaaa-4aaa-8aaa-000000000005'),  -- sin teléfono
    ('venta1',   '22222222-bbbb-4bbb-8bbb-000000000001'),
    ('venta2',   '22222222-bbbb-4bbb-8bbb-000000000002'),
    ('venta3',   '22222222-bbbb-4bbb-8bbb-000000000003');

-- Los casos 9 y 10 cambian de rol para que la RLS se evalue de verdad, y con
-- otro rol la tabla temporal deja de verse. El GRANT es de la prueba, no del
-- esquema: muere con la transaccion.
GRANT SELECT ON ids TO authenticated;

-- Cuatro personas. El disparador de auth.users ya crea la fila en
-- public.users, así que acá sólo se le pone el nombre y el teléfono.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
SELECT val, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       que || '-prueba@prueba.local', 'x', now(), now(), now()
  FROM ids WHERE que IN ('compra','otro','punto','pastor','sintel');

INSERT INTO public.users (id, name, email, phone, is_active)
SELECT val,
       CASE que WHEN 'compra' THEN 'Carolina PRUEBA Méndez'
                WHEN 'otro'   THEN 'Gustavo PRUEBA Vera'
                WHEN 'punto'  THEN 'Pilar PRUEBA Ruiz'
                WHEN 'pastor' THEN 'Esteban PRUEBA Paz'
                ELSE 'Sintel PRUEBA Díaz' END,
       que || '-prueba@prueba.local',
       CASE WHEN que = 'sintel' THEN NULL ELSE '11 4000 0000' END,
       true
  FROM ids WHERE que IN ('compra','otro','punto','pastor','sintel')
ON CONFLICT (id) DO UPDATE
    SET name = EXCLUDED.name, phone = EXCLUDED.phone;

UPDATE public.users SET roles = ARRAY['ENCARGADO_PUNTO']
 WHERE id = (SELECT val FROM ids WHERE que = 'punto');
UPDATE public.users SET roles = ARRAY['PASTOR']
 WHERE id = (SELECT val FROM ids WHERE que = 'pastor');

-- Tres productos PRUEBA. El buzo talle 6 tiene UNA sola unidad: es el que se
-- usa para probar el "sin stock".
INSERT INTO public.info_products (code, name, type, size, price, stock, "minStock")
VALUES ('REMERAS-97', 'Remeras Talle 97 PRUEBA', 'Remeras', '97', 10000, 10, 1),
       ('BUZOS-97',   'Buzos Talle 97 PRUEBA',   'Buzos',   '97', 25000, 10, 1),
       ('BUZOS-96',   'Buzos Talle 96 PRUEBA',   'Buzos',   '96', 25000,  1, 1);

-- Los comprobantes, como si ya estuvieran subidos.
INSERT INTO storage.buckets (id, name, public) VALUES
    ('voluntarios-comprobantes', 'voluntarios-comprobantes', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.objects (bucket_id, name, owner)
SELECT 'voluntarios-comprobantes',
       (SELECT val FROM ids WHERE que = 'compra')::text || '/comp-prueba.jpg',
       (SELECT val FROM ids WHERE que = 'compra');
INSERT INTO storage.objects (bucket_id, name, owner)
SELECT 'voluntarios-comprobantes',
       (SELECT val FROM ids WHERE que = 'otro')::text || '/comp-ajeno-prueba.jpg',
       (SELECT val FROM ids WHERE que = 'otro');
INSERT INTO storage.objects (bucket_id, name, owner)
SELECT 'voluntarios-comprobantes',
       (SELECT val FROM ids WHERE que = 'sintel')::text || '/comp-sintel-prueba.jpg',
       (SELECT val FROM ids WHERE que = 'sintel');

-- Entrar como alguien.
CREATE OR REPLACE FUNCTION pg_temp.entrar(p UUID) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
    PERFORM set_config('request.jwt.claims',
        json_build_object('sub', p::text, 'role', 'authenticated')::text, true);
END $$;

CREATE TEMP TABLE resultados (n INT, caso TEXT, ok BOOLEAN, detalle TEXT) ON COMMIT DROP;

-- ════════════════════════════════════════════════════════════════════════════
-- 1 · La compra que funciona: 2 remeras t97 + 1 buzo t97
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    r JSONB;
    v_compra UUID := (SELECT val FROM ids WHERE que = 'compra');
    v_venta  UUID := (SELECT val FROM ids WHERE que = 'venta1');
    n_items INT; n_movs INT; stock_r INT; stock_b INT; v_prev INT;
BEGIN
    PERFORM pg_temp.entrar(v_compra);
    r := public.registrar_venta_voluntario(
        v_venta,
        jsonb_build_array(jsonb_build_object('code','REMERAS-97','cantidad',2),
                          jsonb_build_object('code','BUZOS-97','cantidad',1)),
        v_compra::text || '/comp-prueba.jpg',
        45000                                    -- 2×10000 + 1×25000
    );

    SELECT count(*) INTO n_items FROM public.ventas_voluntarios_items WHERE venta_id = v_venta;
    SELECT count(*) INTO n_movs  FROM public.movements WHERE "ventaId" = v_venta;
    SELECT stock INTO stock_r FROM public.info_products WHERE code = 'REMERAS-97';
    SELECT stock INTO stock_b FROM public.info_products WHERE code = 'BUZOS-97';
    SELECT "previousStock" INTO v_prev
      FROM public.movements WHERE "ventaId" = v_venta AND "productCode" = 'REMERAS-97';

    INSERT INTO resultados VALUES (1, 'compra: ok, código, total, ítems, movimientos y stock',
        (r->>'ok')::boolean
        AND (r->>'repetido')::boolean IS FALSE
        AND (r->>'codigo') ~ '^VOL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$'
        AND (r->>'total')::numeric = 45000
        AND (r->>'unidades')::int = 3
        AND n_items = 2
        AND n_movs = 2
        AND stock_r = 8 AND stock_b = 9
        AND v_prev = 10                          -- el "antes", no el "después"
        AND (SELECT count(*) FROM public.movements
              WHERE "ventaId" = v_venta AND type = 'Salida'
                AND "paymentMethod" = 'Transferencia') = 2
        AND (SELECT nombre || '|' || apellido FROM public.ventas_voluntarios WHERE id = v_venta)
            = 'Carolina|PRUEBA Méndez',
        format('total=%s items=%s movs=%s stock=%s/%s prev=%s',
               r->>'total', n_items, n_movs, stock_r, stock_b, v_prev));
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2 · El mismo id otra vez: devuelve lo que había y no cobra de nuevo
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    r JSONB; antes_stock INT; despues_stock INT; antes_movs INT; despues_movs INT;
    v_compra UUID := (SELECT val FROM ids WHERE que = 'compra');
    v_venta  UUID := (SELECT val FROM ids WHERE que = 'venta1');
BEGIN
    SELECT stock INTO antes_stock FROM public.info_products WHERE code = 'REMERAS-97';
    SELECT count(*) INTO antes_movs FROM public.movements WHERE "ventaId" = v_venta;

    PERFORM pg_temp.entrar(v_compra);
    r := public.registrar_venta_voluntario(
        v_venta,
        jsonb_build_array(jsonb_build_object('code','REMERAS-97','cantidad',2),
                          jsonb_build_object('code','BUZOS-97','cantidad',1)),
        v_compra::text || '/comp-prueba.jpg', 45000);

    SELECT stock INTO despues_stock FROM public.info_products WHERE code = 'REMERAS-97';
    SELECT count(*) INTO despues_movs FROM public.movements WHERE "ventaId" = v_venta;

    INSERT INTO resultados VALUES (2, 'reintento: repetido y nada cambia',
        (r->>'ok')::boolean AND (r->>'repetido')::boolean
        AND antes_stock = despues_stock AND antes_movs = despues_movs
        AND (r->>'codigo') = (SELECT codigo FROM public.ventas_voluntarios WHERE id = v_venta),
        format('stock %s→%s movs %s→%s', antes_stock, despues_stock, antes_movs, despues_movs));
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3 · Sin stock: lo dice con el detalle y no escribe nada
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    r JSONB; n_ventas INT; stock_antes INT; stock_despues INT;
    v_compra UUID := (SELECT val FROM ids WHERE que = 'compra');
BEGIN
    SELECT stock INTO stock_antes FROM public.info_products WHERE code = 'BUZOS-96';
    PERFORM pg_temp.entrar(v_compra);
    -- Hay 1 y se piden 3.
    r := public.registrar_venta_voluntario(
        (SELECT val FROM ids WHERE que = 'venta2'),
        jsonb_build_array(jsonb_build_object('code','BUZOS-96','cantidad',3)),
        v_compra::text || '/comp-prueba.jpg', 75000);

    SELECT count(*) INTO n_ventas FROM public.ventas_voluntarios
     WHERE id = (SELECT val FROM ids WHERE que = 'venta2');
    SELECT stock INTO stock_despues FROM public.info_products WHERE code = 'BUZOS-96';

    INSERT INTO resultados VALUES (3, 'sin stock: motivo, detalle y nada escrito',
        (r->>'ok')::boolean IS FALSE
        AND r->>'motivo' = 'sin_stock'
        AND jsonb_array_length(r->'items') = 1
        AND r->'items'->0->>'code' = 'BUZOS-96'
        AND (r->'items'->0->>'disponible')::int = 1
        AND r->'items'->0->>'size' = '96'
        AND n_ventas = 0 AND stock_antes = stock_despues,
        format('motivo=%s items=%s stock %s→%s', r->>'motivo', r->'items', stock_antes, stock_despues));
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 4 · El total no coincide: precio_cambio con el total de la base
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    r JSONB; n_ventas INT;
    v_compra UUID := (SELECT val FROM ids WHERE que = 'compra');
BEGIN
    PERFORM pg_temp.entrar(v_compra);
    -- Se pretende pagar 1 peso por una remera de 10000.
    r := public.registrar_venta_voluntario(
        (SELECT val FROM ids WHERE que = 'venta2'),
        jsonb_build_array(jsonb_build_object('code','REMERAS-97','cantidad',1)),
        v_compra::text || '/comp-prueba.jpg', 1);

    SELECT count(*) INTO n_ventas FROM public.ventas_voluntarios
     WHERE id = (SELECT val FROM ids WHERE que = 'venta2');

    INSERT INTO resultados VALUES (4, 'precio: manda el de la base, no el del cliente',
        (r->>'ok')::boolean IS FALSE
        AND r->>'motivo' = 'precio_cambio'
        AND (r->>'total')::numeric = 10000
        AND n_ventas = 0,
        format('motivo=%s total=%s', r->>'motivo', r->>'total'));
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 5 · El comprobante tiene que ser propio y tiene que existir
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    ajeno BOOLEAN := false; inexistente BOOLEAN := false;
    v_compra UUID := (SELECT val FROM ids WHERE que = 'compra');
    v_otro   UUID := (SELECT val FROM ids WHERE que = 'otro');
BEGIN
    PERFORM pg_temp.entrar(v_compra);

    BEGIN
        PERFORM public.registrar_venta_voluntario(
            (SELECT val FROM ids WHERE que = 'venta2'),
            jsonb_build_array(jsonb_build_object('code','REMERAS-97','cantidad',1)),
            v_otro::text || '/comp-ajeno-prueba.jpg', 10000);
    EXCEPTION WHEN OTHERS THEN
        ajeno := SQLERRM LIKE '%comprobante_invalido%';
    END;

    BEGIN
        PERFORM public.registrar_venta_voluntario(
            (SELECT val FROM ids WHERE que = 'venta2'),
            jsonb_build_array(jsonb_build_object('code','REMERAS-97','cantidad',1)),
            v_compra::text || '/no-existe-prueba.jpg', 10000);
    EXCEPTION WHEN OTHERS THEN
        inexistente := SQLERRM LIKE '%comprobante_invalido%';
    END;

    INSERT INTO resultados VALUES (5, 'comprobante: ni el de otro ni uno que no existe',
        ajeno AND inexistente, format('ajeno=%s inexistente=%s', ajeno, inexistente));
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6 · Pedidos que no son pedidos
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    v_compra UUID := (SELECT val FROM ids WHERE que = 'compra');
    v_comp TEXT := (SELECT val FROM ids WHERE que = 'compra')::text || '/comp-prueba.jpg';
    seis BOOLEAN := false; cero BOOLEAN := false; dec BOOLEAN := false;
    repe BOOLEAN := false; vacia BOOLEAN := false; fantasma BOOLEAN := false;
BEGIN
    PERFORM pg_temp.entrar(v_compra);

    BEGIN PERFORM public.registrar_venta_voluntario((SELECT val FROM ids WHERE que='venta2'),
        jsonb_build_array(jsonb_build_object('code','REMERAS-97','cantidad',6)), v_comp, 60000);
    EXCEPTION WHEN OTHERS THEN seis := SQLERRM LIKE '%pedido_invalido%'; END;

    BEGIN PERFORM public.registrar_venta_voluntario((SELECT val FROM ids WHERE que='venta2'),
        jsonb_build_array(jsonb_build_object('code','REMERAS-97','cantidad',0)), v_comp, 0);
    EXCEPTION WHEN OTHERS THEN cero := SQLERRM LIKE '%pedido_invalido%'; END;

    BEGIN PERFORM public.registrar_venta_voluntario((SELECT val FROM ids WHERE que='venta2'),
        jsonb_build_array(jsonb_build_object('code','REMERAS-97','cantidad',2.5)), v_comp, 25000);
    EXCEPTION WHEN OTHERS THEN dec := SQLERRM LIKE '%pedido_invalido%'; END;

    BEGIN PERFORM public.registrar_venta_voluntario((SELECT val FROM ids WHERE que='venta2'),
        jsonb_build_array(jsonb_build_object('code','REMERAS-97','cantidad',1),
                          jsonb_build_object('code','REMERAS-97','cantidad',2)), v_comp, 30000);
    EXCEPTION WHEN OTHERS THEN repe := SQLERRM LIKE '%pedido_invalido%'; END;

    BEGIN PERFORM public.registrar_venta_voluntario((SELECT val FROM ids WHERE que='venta2'),
        '[]'::jsonb, v_comp, 0);
    EXCEPTION WHEN OTHERS THEN vacia := SQLERRM LIKE '%pedido_invalido%'; END;

    BEGIN PERFORM public.registrar_venta_voluntario((SELECT val FROM ids WHERE que='venta2'),
        jsonb_build_array(jsonb_build_object('code','NO-EXISTE-99','cantidad',1)), v_comp, 1);
    EXCEPTION WHEN OTHERS THEN fantasma := SQLERRM LIKE '%pedido_invalido%'; END;

    INSERT INTO resultados VALUES (6, 'pedido inválido: 6, 0, decimal, repetido, vacío, inexistente',
        seis AND cero AND dec AND repe AND vacia AND fantasma,
        format('6=%s 0=%s dec=%s repe=%s vacia=%s fantasma=%s', seis, cero, dec, repe, vacia, fantasma));
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 7 · Sin sesión no se puede; un usuario común sin rol SÍ compra
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    sin_sesion BOOLEAN := false;
    r JSONB;
    v_otro UUID := (SELECT val FROM ids WHERE que = 'otro');
BEGIN
    -- Sin claims: auth.uid() es NULL.
    PERFORM set_config('request.jwt.claims', '', true);
    BEGIN
        PERFORM public.registrar_venta_voluntario(
            (SELECT val FROM ids WHERE que='venta2'), '[]'::jsonb, 'x', 0);
    EXCEPTION WHEN OTHERS THEN sin_sesion := SQLERRM LIKE '%sin_sesion%'; END;

    -- "otro" no tiene ningún rol: igual puede comprar.
    PERFORM pg_temp.entrar(v_otro);
    r := public.registrar_venta_voluntario(
        (SELECT val FROM ids WHERE que = 'venta3'),
        jsonb_build_array(jsonb_build_object('code','REMERAS-97','cantidad',1)),
        v_otro::text || '/comp-ajeno-prueba.jpg', 10000);

    INSERT INTO resultados VALUES (7, 'sin sesión no; usuario común sin rol sí compra',
        sin_sesion AND (r->>'ok')::boolean,
        format('sin_sesion=%s comun_ok=%s', sin_sesion, r->>'ok'));
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 8 · El teléfono
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    falta BOOLEAN := false;
    r JSONB; phone_despues TEXT;
    v_sintel UUID := (SELECT val FROM ids WHERE que = 'sintel');
    v_comp TEXT := (SELECT val FROM ids WHERE que = 'sintel')::text || '/comp-sintel-prueba.jpg';
BEGIN
    PERFORM pg_temp.entrar(v_sintel);

    -- users.phone vacío y sin p_telefono.
    BEGIN
        PERFORM public.registrar_venta_voluntario(
            '33333333-cccc-4ccc-8ccc-000000000001',
            jsonb_build_array(jsonb_build_object('code','REMERAS-97','cantidad',1)),
            v_comp, 10000);
    EXCEPTION WHEN OTHERS THEN falta := SQLERRM LIKE '%falta_telefono%'; END;

    -- Con teléfono y pidiendo guardarlo.
    r := public.registrar_venta_voluntario(
        '33333333-cccc-4ccc-8ccc-000000000002',
        jsonb_build_array(jsonb_build_object('code','REMERAS-97','cantidad',1)),
        v_comp, 10000, '11 4999 1234', true);

    SELECT phone INTO phone_despues FROM public.users WHERE id = v_sintel;

    INSERT INTO resultados VALUES (8, 'teléfono: falta, se usa el nuevo y se guarda en el perfil',
        falta AND (r->>'ok')::boolean
        AND phone_despues = '11 4999 1234'
        AND (SELECT telefono FROM public.ventas_voluntarios
              WHERE id = '33333333-cccc-4ccc-8ccc-000000000002') = '11 4999 1234',
        format('falta=%s ok=%s guardado=%s', falta, r->>'ok', phone_despues IS NOT NULL));
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 9 · Storage: quién sube dónde y quién lee qué
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    sube_ajeno BOOLEAN := false; sube_propio BOOLEAN := false; sube_anon BOOLEAN := false;
    lee_comun INT; lee_punto INT; lee_pastor INT; lee_propio INT;
    v_compra UUID := (SELECT val FROM ids WHERE que = 'compra');
    v_otro   UUID := (SELECT val FROM ids WHERE que = 'otro');
BEGIN
    -- ── Subir ──
    SET LOCAL ROLE authenticated;
    PERFORM pg_temp.entrar(v_otro);

    BEGIN
        INSERT INTO storage.objects (bucket_id, name)
        VALUES ('voluntarios-comprobantes', v_compra::text || '/invasion-prueba.jpg');
    EXCEPTION WHEN OTHERS THEN sube_ajeno := true; END;

    BEGIN
        INSERT INTO storage.objects (bucket_id, name)
        VALUES ('voluntarios-comprobantes', v_otro::text || '/propio-prueba.jpg');
        sube_propio := true;
    EXCEPTION WHEN OTHERS THEN sube_propio := false; END;

    RESET ROLE;
    SET LOCAL ROLE anon;
    PERFORM set_config('request.jwt.claims', '', true);
    BEGIN
        INSERT INTO storage.objects (bucket_id, name)
        VALUES ('voluntarios-comprobantes', 'anon-prueba.jpg');
    EXCEPTION WHEN OTHERS THEN sube_anon := true; END;
    RESET ROLE;

    -- ── Leer ──
    SET LOCAL ROLE authenticated;

    PERFORM pg_temp.entrar(v_otro);
    SELECT count(*) INTO lee_comun FROM storage.objects
     WHERE bucket_id = 'voluntarios-comprobantes' AND name LIKE v_compra::text || '/%';
    SELECT count(*) INTO lee_propio FROM storage.objects
     WHERE bucket_id = 'voluntarios-comprobantes' AND name LIKE v_otro::text || '/%';

    PERFORM pg_temp.entrar((SELECT val FROM ids WHERE que = 'punto'));
    SELECT count(*) INTO lee_punto FROM storage.objects
     WHERE bucket_id = 'voluntarios-comprobantes' AND name LIKE v_compra::text || '/%';

    PERFORM pg_temp.entrar((SELECT val FROM ids WHERE que = 'pastor'));
    SELECT count(*) INTO lee_pastor FROM storage.objects
     WHERE bucket_id = 'voluntarios-comprobantes' AND name LIKE v_compra::text || '/%';

    RESET ROLE;

    INSERT INTO resultados VALUES (9, 'storage: cada uno a su carpeta; el Punto y PASTOR leen',
        sube_ajeno AND sube_propio AND sube_anon
        AND lee_comun = 0 AND lee_propio > 0 AND lee_punto > 0 AND lee_pastor > 0,
        format('ajeno_frenado=%s propio=%s anon_frenado=%s | lee comun=%s propio=%s punto=%s pastor=%s',
               sube_ajeno, sube_propio, sube_anon, lee_comun, lee_propio, lee_punto, lee_pastor));
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 10 · RLS de las ventas
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
    ve_suya INT; ve_ajena INT; ve_punto INT; items_ajenos INT; escribe BOOLEAN := false;
    v_compra UUID := (SELECT val FROM ids WHERE que = 'compra');
    v_otro   UUID := (SELECT val FROM ids WHERE que = 'otro');
    v_venta  UUID := (SELECT val FROM ids WHERE que = 'venta1');
BEGIN
    SET LOCAL ROLE authenticated;

    PERFORM pg_temp.entrar(v_compra);
    SELECT count(*) INTO ve_suya FROM public.ventas_voluntarios WHERE id = v_venta;

    PERFORM pg_temp.entrar(v_otro);
    SELECT count(*) INTO ve_ajena FROM public.ventas_voluntarios WHERE id = v_venta;
    SELECT count(*) INTO items_ajenos FROM public.ventas_voluntarios_items WHERE venta_id = v_venta;

    -- Nadie escribe directo: la única puerta es la RPC.
    BEGIN
        INSERT INTO public.ventas_voluntarios
            (id, codigo, user_id, total, unidades, comprobante_path)
        VALUES ('44444444-dddd-4ddd-8ddd-000000000001', 'VOL-ZZZZ', v_otro, 0, 1, 'x');
    EXCEPTION WHEN OTHERS THEN escribe := true; END;

    PERFORM pg_temp.entrar((SELECT val FROM ids WHERE que = 'punto'));
    SELECT count(*) INTO ve_punto FROM public.ventas_voluntarios WHERE id = v_venta;

    RESET ROLE;

    INSERT INTO resultados VALUES (10, 'RLS: el comprador ve la suya, otro no, el Punto sí, nadie escribe',
        ve_suya = 1 AND ve_ajena = 0 AND items_ajenos = 0 AND ve_punto = 1 AND escribe,
        format('suya=%s ajena=%s items_ajenos=%s punto=%s escritura_frenada=%s',
               ve_suya, ve_ajena, items_ajenos, ve_punto, escribe));
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- El veredicto
-- ════════════════════════════════════════════════════════════════════════════
SELECT n, caso, ok, detalle FROM resultados ORDER BY n;
SELECT count(*) FILTER (WHERE ok) AS pasaron,
       count(*)                   AS total,
       count(*) FILTER (WHERE NOT ok) = 0 AS todo_bien
  FROM resultados;

ROLLBACK;

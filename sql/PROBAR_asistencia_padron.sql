-- ════════════════════════════════════════════════════════════════════════
-- PRUEBAS de sql/asistencia_padron.sql — 11 casos
-- ════════════════════════════════════════════════════════════════════════
--
-- No deja nada: todo pasa adentro de una transacción que termina en ROLLBACK.
-- El resumen sale como el mensaje de una excepción a propósito — es lo que
-- revierte la transacción y lo que devuelve el resultado en el mismo paso.
--
-- Los datos de prueba llevan apellido PRUEBA. Los ids son UUID aunque las dos
-- tablas los guarden como texto: el trigger de auditoría que ya existe castea
-- el id a uuid, y con "PRUEBA-1" se cae.
--
-- Las colas de pg_net son tablas comunes: al revertirse la transacción, los
-- pedidos encolados se van con ella y no sale ningún email, aunque los casos
-- 1 y 4 aprueben inscripciones (lo que normalmente dispara notify_gcx_welcome).
--
-- Dentro de la prueba se apaga por un momento trg_fijar_fecha_aprobacion para
-- plantar fechas de aprobación viejas. Es la única forma: el trigger existe
-- justamente para que nadie pueda escribir esa columna a mano. Se vuelve a
-- prender enseguida, y los casos que lo comprueban corren con él prendido.
--
-- Ojo con now(): adentro de una transacción no avanza —es la hora del BEGIN—
-- así que "quedó en now()" se comprueba con igualdad exacta.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DO $prueba$
DECLARE
    gA  text := 'aaaa0001-0000-4000-8000-000000000001';  -- casos 1 a 5
    gM  text := 'aaaa0002-0000-4000-8000-000000000002';  -- destino del caso 5
    gB  text := 'aaaa0003-0000-4000-8000-000000000003';  -- casos 6 a 11

    r1  text := 'bbbb0001-0000-4000-8000-000000000001';
    r2  text := 'bbbb0002-0000-4000-8000-000000000002';

    -- En el grupo del padrón los ids van en orden alfabético a propósito:
    -- el padrón sale ordenado, así que lo esperado se escribe de corrido.
    rA  text := 'cccc000a-0000-4000-8000-00000000000a';  -- entra
    rB  text := 'cccc000b-0000-4000-8000-00000000000b';  -- aprobada al día siguiente
    rC  text := 'cccc000c-0000-4000-8000-00000000000c';  -- con pareja
    rD  text := 'cccc000d-0000-4000-8000-00000000000d';  -- sin fecha: desde siempre
    rE  text := 'cccc000e-0000-4000-8000-00000000000e';  -- aprobada 23:30 de ese día

    D   date := '2026-06-10';                            -- la reunión de referencia

    out text := E'\n';
    ok  int  := 0;
    mal int  := 0;

    v_ts       timestamptz;
    v_ts2      timestamptz;
    v_jsonb    jsonb;
    v_esperado jsonb;
BEGIN
    -- ── Escenario ───────────────────────────────────────────────────────
    INSERT INTO public.groups (id, name, leader_name) VALUES
        (gA, 'PRUEBA Aprobacion', 'PRUEBA'),
        (gM, 'PRUEBA Mudanza',    'PRUEBA'),
        (gB, 'PRUEBA Padron',     'PRUEBA');

    -- ── 1 · PENDING no tiene fecha; al aprobar, la tiene ────────────────
    INSERT INTO public.group_registrations (id, first_name, last_name, group_id, status)
         VALUES (r1, 'Uno', 'PRUEBA', gA, 'PENDING');
    SELECT approved_at INTO v_ts FROM public.group_registrations WHERE id = r1;

    UPDATE public.group_registrations SET status = 'APPROVED' WHERE id = r1;
    SELECT approved_at INTO v_ts2 FROM public.group_registrations WHERE id = r1;

    IF v_ts IS NULL AND v_ts2 = now() THEN
        ok := ok + 1;  out := out || E'OK     1 · PENDING sin fecha; al aprobar queda en now()\n';
    ELSE
        mal := mal + 1; out := out || 'FALLA  1 · esperado (NULL, now()); obtenido ('
            || coalesce(v_ts::text, 'NULL') || ', ' || coalesce(v_ts2::text, 'NULL') || E')\n';
    END IF;

    -- ── 2 · Un APPROVED insertado con fecha propia: manda la base ───────
    INSERT INTO public.group_registrations (id, first_name, last_name, group_id, status, approved_at)
         VALUES (r2, 'Dos', 'PRUEBA', gA, 'APPROVED', '2020-01-01 00:00:00-03');
    SELECT approved_at INTO v_ts FROM public.group_registrations WHERE id = r2;

    IF v_ts = now() THEN
        ok := ok + 1;  out := out || E'OK     2 · el approved_at que manda el cliente se ignora\n';
    ELSE
        mal := mal + 1; out := out || 'FALLA  2 · esperado ' || now()::text
            || '; obtenido ' || coalesce(v_ts::text, 'NULL') || E'\n';
    END IF;

    -- ── 3 · Editar otra cosa no mueve la fecha ──────────────────────────
    -- Se planta una fecha vieja con el trigger apagado: si quedara en now()
    -- este caso no probaría nada, porque now() no avanza en la transacción.
    ALTER TABLE public.group_registrations DISABLE TRIGGER trg_fijar_fecha_aprobacion;
    UPDATE public.group_registrations SET approved_at = '2026-01-15 10:00:00-03' WHERE id = r2;
    ALTER TABLE public.group_registrations ENABLE TRIGGER trg_fijar_fecha_aprobacion;

    UPDATE public.group_registrations SET phone = '1122334455' WHERE id = r2;
    SELECT approved_at INTO v_ts FROM public.group_registrations WHERE id = r2;

    UPDATE public.group_registrations SET approved_at = '2019-01-01 00:00:00-03' WHERE id = r2;
    SELECT approved_at INTO v_ts2 FROM public.group_registrations WHERE id = r2;

    IF v_ts = '2026-01-15 10:00:00-03'::timestamptz
       AND v_ts2 = '2026-01-15 10:00:00-03'::timestamptz THEN
        ok := ok + 1;  out := out || E'OK     3 · editar otra columna, o la fecha a mano, no la mueve\n';
    ELSE
        mal := mal + 1; out := out || 'FALLA  3 · esperado (2026-01-15, 2026-01-15); obtenido ('
            || coalesce(v_ts::text, 'NULL') || ', ' || coalesce(v_ts2::text, 'NULL') || E')\n';
    END IF;

    -- ── 4 · Rechazar la borra; volver a aprobar la pone de nuevo ────────
    UPDATE public.group_registrations SET status = 'REJECTED' WHERE id = r2;
    SELECT approved_at INTO v_ts FROM public.group_registrations WHERE id = r2;

    UPDATE public.group_registrations SET status = 'APPROVED' WHERE id = r2;
    SELECT approved_at INTO v_ts2 FROM public.group_registrations WHERE id = r2;

    IF v_ts IS NULL AND v_ts2 = now() THEN
        ok := ok + 1;  out := out || E'OK     4 · REJECTED la borra; APPROVED otra vez la rehace\n';
    ELSE
        mal := mal + 1; out := out || 'FALLA  4 · esperado (NULL, now()); obtenido ('
            || coalesce(v_ts::text, 'NULL') || ', ' || coalesce(v_ts2::text, 'NULL') || E')\n';
    END IF;

    -- ── 5 · Mudarse de grupo: entra hoy al grupo nuevo ──────────────────
    ALTER TABLE public.group_registrations DISABLE TRIGGER trg_fijar_fecha_aprobacion;
    UPDATE public.group_registrations SET approved_at = '2026-02-20 10:00:00-03' WHERE id = r1;
    ALTER TABLE public.group_registrations ENABLE TRIGGER trg_fijar_fecha_aprobacion;

    UPDATE public.group_registrations SET group_id = gM WHERE id = r1;
    SELECT approved_at INTO v_ts FROM public.group_registrations WHERE id = r1;

    IF v_ts = now() THEN
        ok := ok + 1;  out := out || E'OK     5 · cambiar de grupo siendo APPROVED la pone en now()\n';
    ELSE
        mal := mal + 1; out := out || 'FALLA  5 · esperado ' || now()::text
            || '; obtenido ' || coalesce(v_ts::text, 'NULL') || E'\n';
    END IF;

    -- ── Escenario del padrón ────────────────────────────────────────────
    --   A  aprobada antes de la reunión            → entra
    --   B  aprobada el día siguiente               → no entra
    --   C  aprobada antes, con pareja              → entra, con su "-partner"
    --   D  sin fecha (desde siempre)               → entra
    --   E  aprobada 23:30 de ese día, hora argentina (02:30 UTC del siguiente)
    --                                              → entra: manda la hora de acá
    INSERT INTO public.group_registrations (id, first_name, last_name, group_id, status, partner_data)
         VALUES (rA, 'Ana',  'PRUEBA', gB, 'APPROVED', NULL),
                (rB, 'Beto', 'PRUEBA', gB, 'APPROVED', NULL),
                (rC, 'Caro', 'PRUEBA', gB, 'APPROVED', '{"first_name":"Pareja"}'::jsonb),
                (rD, 'Dani', 'PRUEBA', gB, 'APPROVED', NULL),
                (rE, 'Eli',  'PRUEBA', gB, 'APPROVED', NULL);

    ALTER TABLE public.group_registrations DISABLE TRIGGER trg_fijar_fecha_aprobacion;
    UPDATE public.group_registrations SET approved_at = '2026-06-01 10:00:00-03' WHERE id = rA;
    UPDATE public.group_registrations SET approved_at = '2026-06-11 10:00:00-03' WHERE id = rB;
    UPDATE public.group_registrations SET approved_at = '2026-06-05 10:00:00-03' WHERE id = rC;
    UPDATE public.group_registrations SET approved_at = NULL                     WHERE id = rD;
    UPDATE public.group_registrations SET approved_at = '2026-06-10 23:30:00-03' WHERE id = rE;
    ALTER TABLE public.group_registrations ENABLE TRIGGER trg_fijar_fecha_aprobacion;

    -- ── 6 · El padrón del día ───────────────────────────────────────────
    v_jsonb    := public.padron_de_reunion(gB, D);
    v_esperado := jsonb_build_array(rA, rC, rC || '-partner', rD, rE);

    IF v_jsonb = v_esperado THEN
        ok := ok + 1;  out := out || E'OK     6 · el padrón trae a los aprobados hasta ese día, con la pareja\n';
    ELSE
        mal := mal + 1; out := out || 'FALLA  6 · esperado ' || v_esperado::text
            || '; obtenido ' || v_jsonb::text || E'\n';
    END IF;

    -- ── 7 · Las 23:30 de acá siguen siendo el mismo día ─────────────────
    IF (v_jsonb ? rE) AND NOT (public.padron_de_reunion(gB, D - 1) ? rE) THEN
        ok := ok + 1;  out := out || E'OK     7 · 23:30 hora argentina entra en la reunión de ese día, no del siguiente\n';
    ELSE
        mal := mal + 1; out := out || 'FALLA  7 · E en el padrón de D: ' || (v_jsonb ? rE)::text
            || '; en el de D-1: ' || (public.padron_de_reunion(gB, D - 1) ? rE)::text || E'\n';
    END IF;

    -- ── 8 · Un presente que no estaba en el padrón se agrega ────────────
    INSERT INTO public.group_attendance (group_id, date, present_members)
         VALUES (gB, D, jsonb_build_array(rA, rB));
    SELECT expected_members INTO v_jsonb FROM public.group_attendance WHERE group_id = gB AND date = D;
    v_esperado := jsonb_build_array(rA, rB, rC, rC || '-partner', rD, rE);

    IF v_jsonb = v_esperado THEN
        ok := ok + 1;  out := out || E'OK     8 · quien estuvo presente queda en el padrón aunque no le tocara\n';
    ELSE
        mal := mal + 1; out := out || 'FALLA  8 · esperado ' || v_esperado::text
            || '; obtenido ' || coalesce(v_jsonb::text, 'NULL') || E'\n';
    END IF;

    -- ── 9 · Una baja posterior no cambia la foto ────────────────────────
    -- Se da de baja a Ana —la fila se BORRA, que es lo que hace el sistema— y
    -- se vuelve a guardar la misma reunión con otros presentes, como hace el
    -- upsert del cliente.
    DELETE FROM public.group_registrations WHERE id = rA;
    UPDATE public.group_attendance SET present_members = jsonb_build_array(rD)
     WHERE group_id = gB AND date = D;
    SELECT expected_members INTO v_jsonb FROM public.group_attendance WHERE group_id = gB AND date = D;

    IF v_jsonb = v_esperado THEN
        ok := ok + 1;  out := out || E'OK     9 · tras una baja, la reunión guardada conserva su padrón\n';
    ELSE
        mal := mal + 1; out := out || 'FALLA  9 · esperado ' || v_esperado::text
            || '; obtenido ' || coalesce(v_jsonb::text, 'NULL') || E'\n';
    END IF;

    -- ── 10 · Cambiar la fecha sí recalcula: es otra reunión ─────────────
    UPDATE public.group_attendance SET date = D + 1 WHERE group_id = gB AND date = D;
    SELECT expected_members INTO v_jsonb FROM public.group_attendance WHERE group_id = gB AND date = D + 1;
    -- Al día siguiente ya entra Beto, y Ana no está más en ningún lado.
    v_esperado := jsonb_build_array(rB, rC, rC || '-partner', rD, rE);

    IF v_jsonb = v_esperado THEN
        ok := ok + 1;  out := out || E'OK    10 · mover la reunión de fecha recalcula su padrón\n';
    ELSE
        mal := mal + 1; out := out || 'FALLA 10 · esperado ' || v_esperado::text
            || '; obtenido ' || coalesce(v_jsonb::text, 'NULL') || E'\n';
    END IF;

    -- ── 11 · El padrón que manda el cliente se ignora ───────────────────
    INSERT INTO public.group_attendance (group_id, date, present_members, expected_members)
         VALUES (gB, D + 2, '[]'::jsonb, '["inventado"]'::jsonb);
    SELECT expected_members INTO v_jsonb FROM public.group_attendance WHERE group_id = gB AND date = D + 2;

    IF v_jsonb = v_esperado AND NOT (v_jsonb ? 'inventado') THEN
        ok := ok + 1;  out := out || E'OK    11 · el expected_members que manda el cliente se ignora\n';
    ELSE
        mal := mal + 1; out := out || 'FALLA 11 · esperado ' || v_esperado::text
            || '; obtenido ' || coalesce(v_jsonb::text, 'NULL') || E'\n';
    END IF;

    -- ── Resumen ─────────────────────────────────────────────────────────
    RAISE EXCEPTION E'%\n   %/11 en verde, % en rojo  (todo revertido)\n',
        out, ok, mal;
END;
$prueba$;

ROLLBACK;

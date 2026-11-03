-- Prueba del arreglo de sql/agenda_repeticiones_posibles_permiso.sql.
-- Todo dentro de BEGIN … ROLLBACK: no queda nada.
BEGIN;

ALTER FUNCTION public.agenda_repeticiones_posibles(date, date) SECURITY DEFINER;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
    '{"sub":"09c95afa-1456-4a7c-a347-c2ebc0cb3859","role":"authenticated"}', true);

SELECT jsonb_build_object(
    -- 1. Las opciones, como las pide el formulario.
    'opciones', public.agenda_repeticiones_posibles('2026-11-03', '2026-12-14'),
    -- 2. Un plazo inválido sigue contestando plazo_invalido.
    'invalido', public.agenda_repeticiones_posibles('2026-11-03', '2026-11-01'),
    -- 3. Una serie de punta a punta (sin sub-departamento: no avisa a nadie).
    'serie', (SELECT public.agenda_crear_tarea(
        gen_random_uuid(), '29b73f68-5300-4b4f-94ef-17df5715e7b3'::uuid, NULL, NULL, NULL,
        'PRUEBA serie', NULL, '2026-11-03'::date, true, NULL, NULL, NULL,
        '2026-12-14'::date, 'cada_semana') - 'tareas' - 'serie'),
    -- 4. Las auxiliares siguen cerradas para los usuarios.
    'serie_fechas_abierta', has_function_privilege('authenticated',
        'public.agenda_serie_fechas(text, date, date)', 'execute')
) AS resultado;

ROLLBACK;

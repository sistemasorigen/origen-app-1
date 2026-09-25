-- ════════════════════════════════════════════════════════════════════════════
-- Co-anfitriones: rellenar el nombre perdido y dar el rol
--
-- Auditado el 2026-09-25 sobre la base de producción (117 grupos, 435
-- usuarios). Estado encontrado:
--
--   con co_host_id .................... 21 grupos
--     de esos, co_host_id == host_id ...  3   (dato malo, ver paso 3)
--     co-anfitrión real ................ 18
--       sin el nombre guardado ......... 14   (elegidos desde el buscador)
--   con nombre a mano y sin vínculo ....  0
--
-- Los siete formularios de grupo guardaban `co_host_id` al elegir del
-- buscador pero dejaban `co_host_first_name` y `co_host_last_name` en ''.
-- Las tarjetas, la hoja de inscripción y el chip del formulario leen esas dos
-- columnas y no el usuario vinculado, así que esos 14 grupos muestran el
-- co-anfitrión en blanco. El código ya no los deja vacíos; esto arregla las
-- filas que quedaron.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1 · El nombre de los 14 ────────────────────────────────────────────────
-- Primero mirar qué se va a tocar.
SELECT g.id, g.name AS grupo, u.name AS nombre_a_completar
FROM public.groups g
JOIN public.users u ON u.id = g.co_host_id
WHERE g.co_host_id IS NOT NULL
  AND g.co_host_id <> g.host_id
  AND COALESCE(btrim(g.co_host_first_name), '') = ''
  AND COALESCE(btrim(g.co_host_last_name), '')  = ''
ORDER BY g.name;

-- Completar. Primera palabra al nombre y el resto al apellido, que es el
-- mismo corte que hace el formulario al elegir del buscador.
UPDATE public.groups g
SET co_host_first_name = split_part(btrim(u.name), ' ', 1),
    co_host_last_name  = btrim(substr(btrim(u.name), length(split_part(btrim(u.name), ' ', 1)) + 1))
FROM public.users u
WHERE u.id = g.co_host_id
  AND g.co_host_id IS NOT NULL
  AND g.co_host_id <> g.host_id
  AND COALESCE(btrim(g.co_host_first_name), '') = ''
  AND COALESCE(btrim(g.co_host_last_name), '')  = ''
  AND COALESCE(btrim(u.name), '') <> '';

-- ── 2 · El rol de los dos que no lo tienen ─────────────────────────────────
-- De los 18 co-anfitriones reales, 16 ya tienen CO_ANFITRION. Los dos que no
-- están nombrados por id acá abajo porque Ignacio confirmó, uno por uno, que
-- son co-anfitriones de esos grupos:
--
--   Anarozeidy Moreno  <morenoanarozeidy@gmail.com>   "La creatividad de los salmos"
--     a9e88150-cc60-4363-bcda-7a39905c638d   roles ["VIEWER","ANFITRION"]
--   Georgina Cordero   <corderogeorgina11@gmail.com>  "Café con historias de mamás"
--     9478e958-2f90-4cdf-bc58-7f65131f07ae   roles ["VIEWER"]
--
-- Se agrega a `roles[]` y NO se toca `role` (singular): pisarlo degradaría a
-- Anarozeidy, que hoy es ANFITRION. Es el mismo criterio que ya tienen los
-- otros co-anfitriones de la base, varios con role=VIEWER y CO_ANFITRION sólo
-- en el arreglo. tiene_rol() mira las dos columnas.
--
-- El array_append no se repite si se corre dos veces: el NOT ... = ANY lo
-- frena.
UPDATE public.users u
SET roles = array_append(COALESCE(u.roles, ARRAY[]::text[]), 'CO_ANFITRION')
WHERE u.id IN (
        'a9e88150-cc60-4363-bcda-7a39905c638d',  -- Anarozeidy Moreno
        '9478e958-2f90-4cdf-bc58-7f65131f07ae'   -- Georgina Cordero
      )
  AND NOT ('CO_ANFITRION' = ANY (COALESCE(u.roles, ARRAY[]::text[])));

-- Verificar: las dos filas tienen que volver con CO_ANFITRION en roles.
SELECT u.id, u.name, u.email, u.role, u.roles
FROM public.users u
WHERE u.id IN (
    'a9e88150-cc60-4363-bcda-7a39905c638d',
    '9478e958-2f90-4cdf-bc58-7f65131f07ae'
  );

-- Y que no quede ningún co-anfitrión sin el rol: tiene que dar 0 filas.
SELECT DISTINCT u.id, u.name, u.role, u.roles
FROM public.groups g
JOIN public.users u ON u.id = g.co_host_id
WHERE g.co_host_id IS NOT NULL
  AND g.co_host_id <> g.host_id
  AND u.role::text <> 'CO_ANFITRION'
  AND NOT ('CO_ANFITRION' = ANY (COALESCE(u.roles, ARRAY[]::text[])));

-- ── 3 · Los tres que se anotaron a sí mismos ───────────────────────────────
-- co_host_id == host_id. El buscador ya no deja elegir al anfitrión, pero el
-- dato viejo quedó. Esto SÓLO los lista: decidir a mano si va un co-anfitrión
-- real o si hay que dejarlo en null.
--   Hombría - El potencial          Moises Rivero
--   HOMBRÍA - Mujer Única           Kevo Garcia
--   HOMBRÍA - Hombría al Máximo     Sebastian Saavedra
SELECT g.id, g.name AS grupo, u.name AS anfitrion_y_co
FROM public.groups g
JOIN public.users u ON u.id = g.host_id
WHERE g.co_host_id IS NOT NULL
  AND g.co_host_id = g.host_id
ORDER BY g.name;

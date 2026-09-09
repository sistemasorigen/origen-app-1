-- ════════════════════════════════════════════════════════════════════════
-- groups.is_online — soporte para grupos online
-- 2026-09-07
--
-- ✅ APLICADO Y VERIFICADO en producción (Origen Iglesia, oqtumgalnozppqnnjjdb).
--    La columna ya existía al momento de correr esto, con el mismo tipo, el
--    mismo default y este mismo COMMENT — o sea que la migración ya se había
--    aplicado antes. El bloque se volvió a correr igual porque es idempotente
--    (ADD COLUMN IF NOT EXISTS), para dejar archivo y base en sinc.
--
--    Estado verificado: 81 grupos, los 81 en is_online = false, 0 online.
--    Ninguna policy de `groups` enumera columnas, así que no hubo que tocar RLS.
--
-- Hasta hoy todo grupo se asume presencial y `location` (texto libre) es
-- obligatorio. Esta columna habilita el switch presencial/online en el
-- formulario de crear/editar grupo.
-- ════════════════════════════════════════════════════════════════════════


-- 1. Columna nueva
-- El DEFAULT false hace el backfill solo: los grupos que ya existen quedan
-- marcados como presenciales sin necesidad de un UPDATE aparte.
ALTER TABLE public.groups
ADD COLUMN IF NOT EXISTS is_online BOOLEAN
NOT NULL DEFAULT false;

COMMENT ON COLUMN public.groups.is_online IS
'true = grupo online (location queda vacío). false = presencial (location tiene la dirección). Default false: todos los grupos históricos son presenciales.';


-- 2. Refrescar el cache de esquema de PostgREST
-- Sin esto la columna existe en Postgres pero la API no la expone, y el
-- frontend no puede leerla ni escribirla hasta que el cache se renueve solo.
-- Mismo paso que en sql/add_group_is_hidden.sql.
NOTIFY pgrst, 'reload schema';


-- 3. RLS — no se toca ninguna policy
-- `is_online` es una columna más de `groups` y queda cubierta por las
-- policies que ya existen sobre la tabla. Esta consulta es para CONFIRMAR
-- que ninguna policy enumera columnas explícitamente (si alguna lo hiciera,
-- habría que actualizarla antes de seguir).
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'groups';


-- ════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN — correr después de lo de arriba
-- ════════════════════════════════════════════════════════════════════════

-- A) La columna existe con el default correcto
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'groups'
  AND column_name = 'is_online';
-- Esperado: is_online | boolean | NO | false

-- B) Todos los grupos existentes quedaron presenciales
SELECT is_online, count(*)
FROM public.groups
GROUP BY is_online;
-- Esperado: una sola fila, is_online = false, con el total de grupos.

-- C) Cuántos presenciales no tienen ubicación
-- Esto NO es un error introducido por esta migración: es dato preexistente.
-- Conviene saber el número antes de hacer `location` obligatorio en el
-- formulario, porque esos grupos no van a poder guardarse sin tocarlos.
SELECT count(*) AS presenciales_sin_ubicacion
FROM public.groups
WHERE is_online = false
  AND (location IS NULL OR trim(location) = '');

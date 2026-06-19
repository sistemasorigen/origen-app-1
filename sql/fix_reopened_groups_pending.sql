-- ═══════════════════════════════════════════════
-- DIAGNÓSTICO: Ver grupos pendientes con participantes
-- (estos son los que tienen el bug)
-- ═══════════════════════════════════════════════
SELECT
    g.id,
    g.name,
    g.status,
    g.start_date,
    g.end_date,
    g.members_count,
    COUNT(gr.id) AS registrations_count,
    COUNT(ga.id) AS attendance_count
FROM public.groups g
LEFT JOIN public.group_registrations gr
    ON gr.group_id = g.id
LEFT JOIN public.group_attendance ga
    ON ga.group_id = g.id
WHERE g.status = 'pending'
GROUP BY g.id, g.name, g.status,
         g.start_date, g.end_date, g.members_count
HAVING COUNT(gr.id) > 0
   OR COUNT(ga.id) > 0
ORDER BY g.name;

-- ═══════════════════════════════════════════════
-- FIX: Limpiar participantes de grupos pendientes
-- que tienen registraciones del período anterior.
-- NOTA: Esto conserva el start_date y end_date
-- que el anfitrión seleccionó al reabrir —
-- solo limpia los participantes que quedaron.
-- ═══════════════════════════════════════════════

-- Paso 1: Guardar IDs de grupos afectados
CREATE TEMP TABLE IF NOT EXISTS affected_reopen_groups AS
SELECT DISTINCT g.id
FROM public.groups g
INNER JOIN public.group_registrations gr
    ON gr.group_id = g.id
WHERE g.status = 'pending';

-- Paso 2: Borrar registrations de grupos afectados
DELETE FROM public.group_registrations
WHERE group_id IN (SELECT id FROM affected_reopen_groups);

-- Paso 3: Borrar attendance de grupos afectados
DELETE FROM public.group_attendance
WHERE group_id IN (SELECT id FROM affected_reopen_groups);

-- Paso 4: Resetear members_count a 0
UPDATE public.groups
SET members_count = 0
WHERE id IN (SELECT id FROM affected_reopen_groups);

-- Paso 5: Reporte del fix aplicado
SELECT
    COUNT(*) AS grupos_corregidos,
    ARRAY_AGG(g.name ORDER BY g.name) AS nombres
FROM public.groups g
WHERE g.id IN (SELECT id FROM affected_reopen_groups);

DROP TABLE IF EXISTS affected_reopen_groups;

-- ═══════════════════════════════════════════════
-- VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════
SELECT
    g.id,
    g.name,
    g.status,
    g.start_date,
    g.end_date,
    g.members_count,
    COUNT(gr.id) AS registrations_restantes
FROM public.groups g
LEFT JOIN public.group_registrations gr
    ON gr.group_id = g.id
WHERE g.status = 'pending'
GROUP BY g.id, g.name, g.status,
         g.start_date, g.end_date, g.members_count
ORDER BY g.name;
-- Todos los grupos pending deben mostrar registrations_restantes = 0

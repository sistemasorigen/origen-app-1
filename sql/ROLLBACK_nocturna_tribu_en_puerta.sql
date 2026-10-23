-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK de sql/nocturna_tribu_en_puerta.sql
-- 2026-10-22
--
-- Saca la RPC y deja get_nocturna_para_acreditar como estaba (la de
-- sql/nocturna_completar_staff.sql, sin `tribu_en_puerta`). Correr esa
-- sección de aquel archivo después de este.
--
-- Las tribus que el staff ya eligió en la puerta QUEDAN: son datos reales de
-- la noche. Las columnas de la marca se borran sólo si se descomenta abajo, y
-- con eso se pierde cuáles se eligieron en la puerta y quién.
-- ════════════════════════════════════════════════════════════════════════════

drop function if exists public.nocturna_asignar_tribu(uuid, text, text);

-- alter table public.nocturna_jovenes
--     drop column if exists tribu_asignada_at,
--     drop column if exists tribu_asignada_por;

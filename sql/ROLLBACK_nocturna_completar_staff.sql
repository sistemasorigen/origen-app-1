-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK de sql/nocturna_completar_staff.sql
-- 2026-10-21
--
-- OJO CON LAS COLUMNAS: borrarlas borra qué adolescentes ya se preguntaron en
-- la puerta. Al volver a aplicar, esos vuelven a figurar como faltantes y el
-- escáner les va a pedir el teléfono otra vez, a familias a las que ya se les
-- preguntó. Antes de correr esto, guardarse los ids que tengan sin_celular_at.
--
-- Las tres funciones que se habían modificado vuelven a su versión anterior
-- corriendo de nuevo sql/nocturna_chequear_entrada.sql (que trae
-- nocturna_ver_entrada y nocturna_completar_datos) y la definición de
-- get_nocturna_para_acreditar de sql/create_nocturna.sql. Este archivo sólo
-- deshace lo que agregó el otro.
-- ════════════════════════════════════════════════════════════════════════════

drop function if exists public.nocturna_completar_datos_staff(uuid, text, jsonb);

-- Descomentar SÓLO si además hay que borrar lo que ya se preguntó en la puerta.
-- alter table public.nocturna_jovenes
--     drop column if exists sin_celular_por,
--     drop column if exists sin_celular_at;

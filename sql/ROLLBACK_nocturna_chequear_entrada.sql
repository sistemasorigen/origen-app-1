-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK de sql/nocturna_chequear_entrada.sql
-- 2026-10-20
--
-- Deja la base como estaba antes de /nocturna-entrada.
--
-- OJO CON LA TABLA: nocturna_chequeo_intentos guarda códigos e IP de quienes
-- probaron. No la borra este archivo. Si se vuelve atrás por un problema de la
-- pantalla, los intentos siguen siendo la única forma de ver qué pasó; y si lo
-- que se quiere es justamente borrarlos, está el DROP comentado al final, que
-- hay que descomentar a mano.
--
-- Lo que SÍ se deshace no toca ningún dato de las familias: los teléfonos que
-- se hayan completado con estas funciones son datos reales de la inscripción y
-- se quedan donde están.
-- ════════════════════════════════════════════════════════════════════════════

drop function if exists public.nocturna_completar_datos(text, text, text, jsonb);
drop function if exists public.nocturna_ver_entrada(text, text);
drop function if exists public.nocturna_chequear_codigo(text);

drop function if exists public.nocturna_registrar_intento(text, text, boolean);
drop function if exists public.nocturna_bloqueo_segundos(text, text);
drop function if exists public.nocturna_normalizar_telefono(text);
drop function if exists public.nocturna_normalizar_codigo(text);
drop function if exists public.nocturna_ip_actual();

-- Los índices se van con la tabla; sueltos, sólo si la tabla se conserva.
drop index if exists public.nocturna_chequeo_codigo_idx;
drop index if exists public.nocturna_chequeo_ip_idx;

-- Descomentar SÓLO si además hay que borrar el registro de intentos.
-- drop table if exists public.nocturna_chequeo_intentos;

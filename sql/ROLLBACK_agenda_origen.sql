-- ════════════════════════════════════════════════════════════════════════════
-- Deshacer sql/agenda_origen.sql
--
-- Deja la base como antes: sin funciones agenda_* y sin tablas agenda_*.
-- OJO: borra TODOS los datos de la Agenda (departamentos, equipos, tareas y
-- solicitudes). No hay vuelta atrás.
--
-- Orden: primero las funciones (algunas reciben una fila de agenda_tareas como
-- parámetro y no dejarían borrar la tabla), después las tablas de las hojas
-- hacia la raíz. Las referencias cruzadas tareas ↔ solicitudes se cortan con
-- CASCADE en el DROP de agenda_solicitudes.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── RPC ─────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.agenda_mi_acceso();
DROP FUNCTION IF EXISTS public.agenda_buscar_usuarios(text);
DROP FUNCTION IF EXISTS public.agenda_departamentos_admin();
DROP FUNCTION IF EXISTS public.agenda_guardar_departamento(uuid, text, text, text, uuid[]);
DROP FUNCTION IF EXISTS public.agenda_eliminar_departamento(uuid);
DROP FUNCTION IF EXISTS public.agenda_departamento(uuid);
DROP FUNCTION IF EXISTS public.agenda_tareas_departamento(uuid, date, date);
DROP FUNCTION IF EXISTS public.agenda_crear_tarea(uuid, uuid, uuid, uuid, uuid, text, text, date, boolean, time, time, uuid);
DROP FUNCTION IF EXISTS public.agenda_editar_tarea(uuid, uuid, uuid, uuid, text, text, date, boolean, time, time);
DROP FUNCTION IF EXISTS public.agenda_reasignar_tarea(uuid, uuid);
DROP FUNCTION IF EXISTS public.agenda_eliminar_tarea(uuid);
DROP FUNCTION IF EXISTS public.agenda_guardar_carpeta(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.agenda_eliminar_carpeta(uuid);
DROP FUNCTION IF EXISTS public.agenda_guardar_prioridad(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.agenda_ordenar_prioridades(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.agenda_eliminar_prioridad(uuid, uuid);
DROP FUNCTION IF EXISTS public.agenda_prioridades_sugeridas(uuid);
DROP FUNCTION IF EXISTS public.agenda_guardar_subdepartamento(uuid, uuid, text, text, uuid, uuid[]);
DROP FUNCTION IF EXISTS public.agenda_eliminar_subdepartamento(uuid);
DROP FUNCTION IF EXISTS public.agenda_agregar_miembros(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.agenda_quitar_miembro(uuid, uuid);
DROP FUNCTION IF EXISTS public.agenda_mover_miembro(uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.agenda_cambiar_lider(uuid, uuid);
DROP FUNCTION IF EXISTS public.agenda_cambiar_encargados(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.agenda_solicitudes_departamento(uuid);
DROP FUNCTION IF EXISTS public.agenda_revisar_solicitud(uuid, text);
DROP FUNCTION IF EXISTS public.agenda_subdepartamento(uuid);
DROP FUNCTION IF EXISTS public.agenda_tareas_subdepartamento(uuid, date, date);
DROP FUNCTION IF EXISTS public.agenda_mis_tareas(date, date, boolean);
DROP FUNCTION IF EXISTS public.agenda_tarea(uuid);
DROP FUNCTION IF EXISTS public.agenda_cambiar_estado_tarea(uuid, text);
DROP FUNCTION IF EXISTS public.agenda_departamentos_para_solicitar();
DROP FUNCTION IF EXISTS public.agenda_crear_solicitud(uuid, uuid, uuid, text);

-- ── Helpers ─────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.agenda_tarea_json(public.agenda_tareas);
DROP FUNCTION IF EXISTS public.agenda_es_super_admin();
DROP FUNCTION IF EXISTS public.agenda_es_encargado(uuid);
DROP FUNCTION IF EXISTS public.agenda_dirige(uuid);
DROP FUNCTION IF EXISTS public.agenda_es_miembro(uuid);
DROP FUNCTION IF EXISTS public.agenda_puede_ver_tarea(uuid);
DROP FUNCTION IF EXISTS public.agenda_valida_del_departamento(uuid, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.agenda_valida_campos_tarea(text, text, date, boolean, time, time);
DROP FUNCTION IF EXISTS public.agenda_valida_nombre_color(text, text);
DROP FUNCTION IF EXISTS public.agenda_persona(uuid);
DROP FUNCTION IF EXISTS public.agenda_sin_acentos(text);
DROP FUNCTION IF EXISTS public.agenda_email_enmascarado(text);
DROP FUNCTION IF EXISTS public.agenda_faltan_usuarios(uuid[]);
DROP FUNCTION IF EXISTS public.agenda_hoy();

-- ── Tablas (las policies se van con ellas) ─────────────────────────────────
DROP TABLE IF EXISTS public.agenda_solicitudes CASCADE;
DROP TABLE IF EXISTS public.agenda_tareas;
DROP TABLE IF EXISTS public.agenda_prioridades;
DROP TABLE IF EXISTS public.agenda_carpetas;
DROP TABLE IF EXISTS public.agenda_subdepartamento_miembros;
DROP TABLE IF EXISTS public.agenda_subdepartamentos;
DROP TABLE IF EXISTS public.agenda_departamento_encargados;
DROP TABLE IF EXISTS public.agenda_departamentos;

COMMIT;

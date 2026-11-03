-- Arreglo (aplicado en producción el 2026-11-03).
--
-- agenda_repeticiones_posibles estaba abierta a `authenticated` pero corría
-- con los permisos de quien la llama (SECURITY INVOKER), y por dentro usa
-- agenda_serie_fechas y agenda_frecuencia_texto, que están cerradas a los
-- usuarios. Resultado: "permission denied for function agenda_serie_fechas"
-- en cada llamada, y el "¿Se repite?" del formulario quedaba sin opciones.
-- Crear y editar no tenían el problema porque ya son SECURITY DEFINER.
--
-- Pasa a SECURITY DEFINER como las demás RPC de la Agenda: no lee ninguna
-- tabla, sólo calcula fechas, y ya tiene search_path fijo. Las auxiliares
-- siguen cerradas.
-- Prueba: sql/PROBAR_agenda_repeticiones_posibles_permiso.sql.

ALTER FUNCTION public.agenda_repeticiones_posibles(date, date) SECURITY DEFINER;

-- Rollback: ALTER FUNCTION public.agenda_repeticiones_posibles(date, date) SECURITY INVOKER;

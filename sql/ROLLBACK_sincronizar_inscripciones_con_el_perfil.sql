-- Deshace sql/sincronizar_inscripciones_con_el_perfil.sql.
-- No toca partir_nombre: la usa también sincronizar_nombre_anfitriones.sql.
-- Los datos que el trigger ya copió a las inscripciones quedan como están.
DROP TRIGGER IF EXISTS llevar_perfil_a_las_inscripciones ON public.users;
DROP FUNCTION IF EXISTS public.llevar_perfil_a_las_inscripciones();

-- ════════════════════════════════════════════════════════════════════════════
-- GCX — el nombre del anfitrión sigue al perfil
-- 2026-10-05
--
-- EL PROBLEMA
--
-- `groups` guarda el nombre del anfitrión copiado al lado del id
-- (leader_name / leader_surname, y co_host_first_name / co_host_last_name
-- para el co-anfitrión), y las tarjetas leen la copia, no el perfil. La copia
-- se escribe una sola vez, al asignarlo, y nunca más: si la persona cambia su
-- nombre, el GCX sigue mostrando el viejo. "Amando a nuestros hijos a
-- propósito" decía "ESTE Dam" con el perfil ya en "Esteban DAmico".
--
-- La copia no se puede sacar: el catálogo lo ve gente sin sesión, y `users`
-- está cerrada para ellos (auditoría de permisos de septiembre 2026). Lo que
-- se hace es que la copia no pueda quedar vieja:
--
--   1 · Cuando cambia el nombre de un usuario, se reescribe en todos los
--       grupos donde es anfitrión o co-anfitrión. Cubre todos los caminos —su
--       /perfil, el panel de admin, una RPC— porque vive en la tabla.
--   2 · Cuando a un grupo se le asigna un anfitrión o co-anfitrión por id y el
--       nombre queda vacío, o cambia el id, se completa desde el perfil. Había
--       tres co-anfitriones vinculados y sin nombre: no se veían en ningún lado.
--   3 · Se emparejan una vez los grupos que hoy están desfasados.
--
-- Un nombre escrito a mano con el anfitrión ya vinculado se respeta hasta que
-- esa persona cambie su nombre: ahí manda el perfil.
--
-- Qué NO dispara: notify-host sólo manda email cuando un grupo pasa a
-- "approved", y los otros triggers de groups miran `status`. Cambiar el nombre
-- deja una fila en audit_logs y nada más.
--
-- Relación con sql/sincronizar_datos_del_perfil.sql (todavía sin aplicar): su
-- RPC hacía lo mismo para los grupos (pasos 3 y 4) sólo cuando la persona
-- guardaba su perfil. Esto lo reemplaza para los grupos; las inscripciones
-- siguen siendo cosa de ese archivo. partir_nombre es idéntica en los dos.
-- ════════════════════════════════════════════════════════════════════════════


-- ── Cortar "Nombre Apellido" igual que los formularios ──────────────────────
-- Primera palabra = nombre, el resto = apellido, como hacen
-- EditarGrupoAdmin, CrearGrupoAdmin y PanelGestionAnfitriones. Las tarjetas
-- muestran "nombre apellido" juntos, así que el corte no se ve; lo que importa
-- es cortar igual que ellos para no mover datos de un lado al otro.
CREATE OR REPLACE FUNCTION public.partir_nombre(p_completo TEXT)
RETURNS TABLE (nombre TEXT, apellido TEXT)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v TEXT := btrim(COALESCE(p_completo, ''));
    v_corte INTEGER;
BEGIN
    v_corte := position(' ' IN v);
    IF v_corte = 0 THEN
        RETURN QUERY SELECT v, ''::TEXT;
    ELSE
        RETURN QUERY SELECT substr(v, 1, v_corte - 1), btrim(substr(v, v_corte + 1));
    END IF;
END;
$$;


-- ── 1 · Cambia el nombre de un usuario → cambia en sus grupos ───────────────
-- SECURITY DEFINER porque quien cambia su propio nombre no tiene permiso de
-- escribir en `groups`, y el cambio tiene que llegar igual.
CREATE OR REPLACE FUNCTION public.llevar_nombre_a_los_grupos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_nombre   TEXT;
    v_apellido TEXT;
BEGIN
    -- Los espacios de más ("Moises  Rivero") se aplanan: en la tarjeta se
    -- verían como un hueco.
    SELECT p.nombre, p.apellido INTO v_nombre, v_apellido
      FROM public.partir_nombre(regexp_replace(NEW.name, '\s+', ' ', 'g')) p;

    -- Un perfil que queda sin nombre no borra el que muestra el grupo: el
    -- nombre viejo es mejor que ninguno.
    IF COALESCE(v_nombre, '') = '' THEN
        RETURN NULL;
    END IF;

    UPDATE public.groups g
       SET leader_name = v_nombre, leader_surname = v_apellido
     WHERE g.host_id = NEW.id
       AND (g.leader_name IS DISTINCT FROM v_nombre OR g.leader_surname IS DISTINCT FROM v_apellido);

    UPDATE public.groups g
       SET co_host_first_name = v_nombre, co_host_last_name = v_apellido
     WHERE g.co_host_id = NEW.id
       AND (g.co_host_first_name IS DISTINCT FROM v_nombre OR g.co_host_last_name IS DISTINCT FROM v_apellido);

    RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.llevar_nombre_a_los_grupos() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS llevar_nombre_a_los_grupos ON public.users;
CREATE TRIGGER llevar_nombre_a_los_grupos
    AFTER UPDATE OF name ON public.users
    FOR EACH ROW
    WHEN (OLD.name IS DISTINCT FROM NEW.name)
    EXECUTE FUNCTION public.llevar_nombre_a_los_grupos();


-- ── 2 · Se asigna un anfitrión por id → el nombre sale del perfil ───────────
-- Sólo cuando el nombre está vacío o cuando cambia el id: un nombre que alguien
-- escribió a mano para el mismo anfitrión no se pisa acá.
CREATE OR REPLACE FUNCTION public.completar_nombre_de_anfitriones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_nombre   TEXT;
    v_apellido TEXT;
BEGIN
    IF NEW.host_id IS NOT NULL AND (
           btrim(COALESCE(NEW.leader_name, '')) = ''
        OR (TG_OP = 'UPDATE' AND NEW.host_id IS DISTINCT FROM OLD.host_id)
    ) THEN
        SELECT p.nombre, p.apellido INTO v_nombre, v_apellido
          FROM public.users u,
               LATERAL public.partir_nombre(regexp_replace(u.name, '\s+', ' ', 'g')) p
         WHERE u.id = NEW.host_id;
        IF COALESCE(v_nombre, '') <> '' THEN
            NEW.leader_name    := v_nombre;
            NEW.leader_surname := v_apellido;
        END IF;
    END IF;

    IF NEW.co_host_id IS NOT NULL AND (
           btrim(COALESCE(NEW.co_host_first_name, '')) = ''
        OR (TG_OP = 'UPDATE' AND NEW.co_host_id IS DISTINCT FROM OLD.co_host_id)
    ) THEN
        v_nombre := NULL;
        SELECT p.nombre, p.apellido INTO v_nombre, v_apellido
          FROM public.users u,
               LATERAL public.partir_nombre(regexp_replace(u.name, '\s+', ' ', 'g')) p
         WHERE u.id = NEW.co_host_id;
        IF COALESCE(v_nombre, '') <> '' THEN
            NEW.co_host_first_name := v_nombre;
            NEW.co_host_last_name  := v_apellido;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.completar_nombre_de_anfitriones() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS completar_nombre_de_anfitriones ON public.groups;
CREATE TRIGGER completar_nombre_de_anfitriones
    BEFORE INSERT OR UPDATE ON public.groups
    FOR EACH ROW
    EXECUTE FUNCTION public.completar_nombre_de_anfitriones();


-- ── 3 · Emparejar lo que hoy está desfasado ─────────────────────────────────
-- Al 2026-10-05 eran cinco grupos: dos anfitriones con el nombre viejo y tres
-- co-anfitriones vinculados sin nombre.
UPDATE public.groups g
   SET leader_name = p.nombre, leader_surname = p.apellido
  FROM public.users u,
       LATERAL public.partir_nombre(regexp_replace(u.name, '\s+', ' ', 'g')) p
 WHERE u.id = g.host_id
   AND p.nombre <> ''
   AND (g.leader_name IS DISTINCT FROM p.nombre OR g.leader_surname IS DISTINCT FROM p.apellido);

UPDATE public.groups g
   SET co_host_first_name = p.nombre, co_host_last_name = p.apellido
  FROM public.users u,
       LATERAL public.partir_nombre(regexp_replace(u.name, '\s+', ' ', 'g')) p
 WHERE u.id = g.co_host_id
   AND p.nombre <> ''
   AND (g.co_host_first_name IS DISTINCT FROM p.nombre OR g.co_host_last_name IS DISTINCT FROM p.apellido);

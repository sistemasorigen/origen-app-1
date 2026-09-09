-- ════════════════════════════════════════════════════════════════════════
-- group_registrations: cerrar la lectura pública de datos personales
-- 2026-09-08 · URGENTE
--
-- La policy `group_registrations_public_select` tenía qual: true para
-- {anon, authenticated}. Como la anon key viaja en el bundle del navegador,
-- cualquiera sin cuenta leía las 572 inscripciones completas: nombre,
-- apellido, email, teléfono, 58 DNIs y partner_data con los datos del
-- cónyuge. Medido con SET LOCAL role='anon': 572 filas, 572 emails,
-- 572 teléfonos.
--
--
-- DESCUBRIMIENTO PREVIO (por qué se puede cerrar sin romper nada):
--
--   · La tarjeta pública usa group.membersCount (tabla groups, mantenida por
--     el trigger trg_update_members_count), NO cuenta inscripciones.
--     TarjetaGrupo.tsx:79 → `group.membersCount >= group.maxCapacity`.
--   · getGroups() embebe registrations, pero NADA del camino público las
--     consume. El userStatus de la tarjeta sale de fetchUserRegistrations(),
--     una consulta aparte que solo corre `if (currentUser)`.
--   · El botón UNIRME redirige a /auth si no hay sesión
--     (Grupos.tsx:988), así que todo el flujo de inscripción
--     — registerMemberToGroup, checkPartnerEmailExists,
--     getCoupleRegistrationStatus — es autenticado.
--   · Home y el formulario público /form no tocan esta tabla.
--
--
-- ROLES: la lista salió de los guards reales de App.tsx, no de una
-- suposición. /reportes admite SUPER_ADMIN, PASTOR, ENCARGADO_PUNTO,
-- ADMIN_PUNTO, ENCARGADO_GRUPOS, REPORTES y ADMIN_GROUPS, y su panel
-- (Pastores.tsx) llama a las funciones de analytics que leen esta tabla:
-- sin esos roles los reportes quedarían vacíos en silencio.
-- /coordinators admite COORDINATOR, y GruposCoordinador.tsx lee
-- g.registrations en 6 lugares.
-- ANFITRION y CO_ANFITRION NO van en la lista de roles: van por el EXISTS
-- contra groups, que es por grupo y no global — mucho más acotado.
-- VOLUNTARIO_GRUPOS no aparece como guard de ninguna ruta, se omite.
--
-- Resultado: 17 de 396 usuarios con lectura amplia, 53 anfitriones con
-- acceso solo a su grupo, el resto solo a lo propio, y anon a nada.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. Fuera las tres policies de SELECT ────────────────────────────────
-- Las permisivas se combinan con OR: dejar cualquiera de las otras dos
-- haría que la nueva no sirviera de nada.
DROP POLICY IF EXISTS "group_registrations_public_select" ON public.group_registrations;
DROP POLICY IF EXISTS "Read registrations" ON public.group_registrations;
DROP POLICY IF EXISTS "Allow authenticated to view own registrations" ON public.group_registrations;

-- Sin policy para `anon`: sin sesión no se lee nada de esta tabla.
CREATE POLICY "group_registrations_select_authorized" ON public.group_registrations
FOR SELECT TO authenticated
USING (
    -- Su propia inscripción, o aquella en la que figura como pareja
    user_id = auth.uid()
    OR partner_user_id = auth.uid()
    OR
    -- Anfitrión o co-anfitrión del grupo (por grupo, no global)
    EXISTS (
        SELECT 1 FROM public.groups g
        WHERE g.id = group_registrations.group_id
          AND (g.host_id = auth.uid() OR g.co_host_id = auth.uid())
    )
    OR
    -- Staff cuyos paneles leen esta tabla (ver nota de ROLES arriba)
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND (
            u.role::text = ANY (ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS','COORDINATOR','ENCARGADO_PUNTO','ADMIN_PUNTO','REPORTES'])
            -- users.roles es text[] (udt_name = _text). Castear a
            -- user_role[] hace abortar el CREATE POLICY entero.
            OR u.roles && ARRAY['SUPER_ADMIN','PASTOR','ADMIN_GROUPS','ENCARGADO_GRUPOS','COORDINATOR','ENCARGADO_PUNTO','ADMIN_PUNTO','REPORTES']::text[]
          )
    )
);


-- ── 2. Limpieza pendiente: policy de UPDATE redundante ──────────────────
-- `Hosts and Admins can update registrations` cubría host + los 4 roles
-- staff. La policy nueva `group_registrations_update_authorized` cubre eso
-- mismo MÁS co-anfitrión y la columna roles[], o sea que es un superconjunto
-- estricto. Dejarla es el patrón que en `groups` anuló un fix en silencio
-- (sección 24 de instrucciones_ia.md).
DROP POLICY IF EXISTS "Hosts and Admins can update registrations" ON public.group_registrations;


-- ════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ════════════════════════════════════════════════════════════════════════

-- Estado final de las policies de la tabla
SELECT cmd, policyname, roles::text,
       CASE WHEN qual = 'true' THEN 'ABIERTA' ELSE 'acotada' END AS estado
FROM pg_policies WHERE tablename = 'group_registrations'
ORDER BY cmd, policyname;
-- Esperado: ninguna fila con estado ABIERTA salvo el INSERT de authenticated.

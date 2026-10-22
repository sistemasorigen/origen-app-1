-- Deshace sql/reportes_sistemas.sql.
-- La notificación vuelve a la versión de sql/mi_cuenta.sql (que llevaba a
-- /panel-admin/reportes sin id). Las columnas se borran con lo que tengan.
DROP TRIGGER IF EXISTS trg_reportes_problemas_email ON public.reportes_problemas;
DROP FUNCTION IF EXISTS public.reportes_problemas_email();
DROP FUNCTION IF EXISTS public.gestionar_reporte(uuid, text, text);
DROP FUNCTION IF EXISTS public.reportes_admin();

CREATE OR REPLACE FUNCTION public.reportes_problemas_avisar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin record;
BEGIN
    FOR v_admin IN
        SELECT id FROM public.users
         WHERE (role)::text = 'SUPER_ADMIN'
            OR COALESCE(roles, '{}') && ARRAY['SUPER_ADMIN']
    LOOP
        INSERT INTO public.app_notifications (user_id, title, message, type, action_url)
        VALUES (
            v_admin.id,
            'Problema reportado N.º ' || lpad(NEW.numero::text, 4, '0'),
            COALESCE(NULLIF(btrim(NEW.pantalla), ''), 'Sin pantalla')
                || ' · ' || left(btrim(NEW.descripcion), 90),
            'REPORTE_PROBLEMA',
            '/panel-admin/reportes'
        );
    END LOOP;
    RETURN NULL;
END;
$$;

DROP FUNCTION IF EXISTS public.codigo_reporte(integer);

ALTER TABLE public.reportes_problemas
    DROP COLUMN IF EXISTS visto_at,
    DROP COLUMN IF EXISTS visto_por,
    DROP COLUMN IF EXISTS resuelto_at,
    DROP COLUMN IF EXISTS resuelto_por,
    DROP COLUMN IF EXISTS reabierto_at,
    DROP COLUMN IF EXISTS reabierto_por,
    DROP COLUMN IF EXISTS nota_editada_at,
    DROP COLUMN IF EXISTS email_enviado_at,
    DROP COLUMN IF EXISTS email_error;

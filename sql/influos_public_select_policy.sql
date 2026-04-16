-- Lectura anónima solo para verificación pública
CREATE POLICY "influos_public_read"
    ON public.influos_attendees
    FOR SELECT TO anon
    USING (true);

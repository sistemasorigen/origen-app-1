-- Fix: DetalleDiaNino.tsx se suscribe a postgres_changes sobre
-- dianino_tickets (UPDATE) para reflejar acreditar/desacreditar
-- en tiempo real, pero la tabla nunca había sido agregada a la
-- publicación de Realtime — la suscripción nunca disparaba, y
-- el cambio solo se veía al refrescar la página.

ALTER PUBLICATION supabase_realtime ADD TABLE public.dianino_tickets;

-- ── Verificación (YA EJECUTADA contra oqtumgalnozppqnnjjdb) ──
-- SELECT schemaname, tablename FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime' ORDER BY tablename;
-- → dianino_tickets aparece en la lista.
--
-- RLS ya estaba habilitada (relrowsecurity = true) y
-- REPLICA IDENTITY DEFAULT es suficiente acá: el filtro de la
-- suscripción es sobre session_id en la fila NUEVA de un UPDATE,
-- que siempre viaja completa en el WAL sin importar la replica
-- identity — no hace falta REPLICA IDENTITY FULL.

INSERT INTO service_statistics (
  name, service_date, service_time, vol_conecta, vol_store, vol_host_prevencion, 
  vol_info_point, vol_produccion, vol_ministracion, vol_atmosfera, vol_visuales, 
  vol_redes, vol_bienvenida, vol_sonido, vol_ea, vol_streaming, vol_camaras, 
  vol_fotos, vol_profes_ninez, auditorio, kids_3_6, kids_7_10, kids_hd, 
  kids_borders, other_online, other_repeated_vol, other_accepted, 
  other_first_time, other_reconciled, other_podcast, other_prayer, conference_sessions
) VALUES 
-- 26/10/2025
('Servicio de domingo', '2025-10-26', 'AM', 3, 2, 13, 2, 3, 8, 1, 2, 2, 3, 5, 9, 2, 6, 2, 12, 116, 14, 14, 3, 12, 23, 0, 4, 4, 0, 13, 11, '[]'::jsonb),
-- 17/10/2025 (VIERNES)
('Servicio de viernes', '2025-10-17', 'PM', 2, 2, 15, 1, 3, 8, 1, 2, 2, 3, 4, 9, 2, 5, 1, 7, 127, 11, 17, 1, 11, 26, 0, 5, 8, 9, 10, 8, '[]'::jsonb),
-- 12/10/2025
('Servicio de domingo', '2025-10-12', 'AM', 2, 2, 15, 2, 3, 5, 1, 2, 2, 3, 4, 9, 2, 4, 1, 8, 135, 15, 11, 3, 13, 28, 0, 3, 8, 0, 0, 0, '[]'::jsonb),
-- 05/10/2025
('Servicio de domingo', '2025-10-05', 'AM', 3, 2, 16, 2, 3, 7, 1, 2, 1, 3, 4, 8, 2, 5, 1, 10, 145, 11, 15, 2, 13, 41, 0, 3, 12, 0, 16, 12, '[]'::jsonb);

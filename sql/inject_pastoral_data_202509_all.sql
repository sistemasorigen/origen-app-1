INSERT INTO service_statistics (
  name, service_date, service_time, vol_conecta, vol_store, vol_host_prevencion, 
  vol_info_point, vol_produccion, vol_ministracion, vol_atmosfera, vol_visuales, 
  vol_redes, vol_bienvenida, vol_sonido, vol_ea, vol_streaming, vol_camaras, 
  vol_fotos, vol_profes_ninez, auditorio, kids_3_6, kids_7_10, kids_hd, 
  kids_borders, other_online, other_repeated_vol, other_accepted, 
  other_first_time, other_reconciled, other_podcast, other_prayer, conference_sessions
) VALUES 
-- 28/09/2025
('Servicio de domingo', '2025-09-28', 'AM', 3, 2, 15, 2, 3, 10, 1, 2, 1, 3, 4, 9, 2, 5, 2, 9, 134, 9, 12, 3, 12, 29, 0, 0, 5, 0, 0, 12, '[]'::jsonb),
-- 27/09/2025 (CONFERENCIA FAMILIA)
('CONFERENCIA FAMILIA', '2025-09-27', 'AM', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, '[{"name": "Leo", "attendees": 157}, {"name": "Flor", "attendees": 160}, {"name": "Manu", "attendees": 160}, {"name": "Gaby", "attendees": 160}, {"name": "Yoyi y Ani", "attendees": 148}, {"name": "Chris y Li", "attendees": 125}]'::jsonb),
-- 21/09/2025
('Servicio de domingo', '2025-09-21', 'AM', 3, 2, 17, 2, 4, 7, 1, 2, 1, 3, 4, 9, 2, 4, 1, 7, 117, 8, 11, 2, 13, 30, 0, 2, 5, 0, 17, 16, '[]'::jsonb),
-- 14/09/2025
('Servicio de domingo', '2025-09-14', 'AM', 3, 2, 18, 2, 3, 7, 1, 2, 1, 3, 3, 9, 2, 5, 1, 6, 125, 13, 15, 2, 9, 28, 0, 2, 3, 0, 7, 8, '[]'::jsonb),
-- 07/09/2025
('Servicio de domingo', '2025-09-07', 'AM', 3, 1, 13, 2, 3, 6, 1, 2, 1, 3, 3, 9, 2, 4, 1, 11, 126, 11, 10, 3, 9, 30, 0, 1, 3, 0, 14, 14, '[]'::jsonb);

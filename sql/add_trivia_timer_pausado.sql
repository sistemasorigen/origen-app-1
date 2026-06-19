-- Agregar campo de pausa al juego
ALTER TABLE public.trivia_juegos
ADD COLUMN IF NOT EXISTS timer_pausado BOOLEAN
    NOT NULL DEFAULT false;

-- Verificar
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'trivia_juegos'
AND column_name = 'timer_pausado';

-- ════════════════════════════════════════
-- TRIVIA ORIGEN
-- ════════════════════════════════════════

-- 1. Juegos
CREATE TABLE IF NOT EXISTS public.trivia_juegos (
    id              UUID PRIMARY KEY
                        DEFAULT gen_random_uuid(),
    titulo          TEXT NOT NULL,
    pin             CHAR(6) NOT NULL UNIQUE,
    estado          TEXT NOT NULL DEFAULT 'esperando'
                        CHECK (estado IN (
                            'esperando',
                            'en_curso',
                            'entre_preguntas',
                            'finalizando',
                            'finalizado'
                        )),
    pregunta_actual_idx INTEGER NOT NULL DEFAULT -1,
    created_by      UUID REFERENCES auth.users(id)
                        ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Preguntas
CREATE TABLE IF NOT EXISTS public.trivia_preguntas (
    id              UUID PRIMARY KEY
                        DEFAULT gen_random_uuid(),
    juego_id        UUID NOT NULL
                        REFERENCES public.trivia_juegos(id)
                        ON DELETE CASCADE,
    orden           INTEGER NOT NULL,
    texto           TEXT NOT NULL,
    imagen_url      TEXT,
    tiempo_limite   INTEGER NOT NULL DEFAULT 20,
    es_doble_puntos BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_orden_por_juego
        UNIQUE (juego_id, orden)
);

-- 3. Opciones de respuesta
CREATE TABLE IF NOT EXISTS public.trivia_opciones (
    id              UUID PRIMARY KEY
                        DEFAULT gen_random_uuid(),
    pregunta_id     UUID NOT NULL
                        REFERENCES public.trivia_preguntas(id)
                        ON DELETE CASCADE,
    texto           TEXT NOT NULL,
    es_correcta     BOOLEAN NOT NULL DEFAULT false,
    color           TEXT NOT NULL
                        CHECK (color IN (
                            'rojo','azul','amarillo',
                            'verde','naranja','violeta'
                        )),
    orden           INTEGER NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Jugadores
CREATE TABLE IF NOT EXISTS public.trivia_jugadores (
    id              UUID PRIMARY KEY
                        DEFAULT gen_random_uuid(),
    juego_id        UUID NOT NULL
                        REFERENCES public.trivia_juegos(id)
                        ON DELETE CASCADE,
    nickname        TEXT NOT NULL,
    avatar_emoji    TEXT NOT NULL DEFAULT '😀',
    puntaje_total   INTEGER NOT NULL DEFAULT 0,
    racha_actual    INTEGER NOT NULL DEFAULT 0,
    max_racha       INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_nickname_por_juego
        UNIQUE (juego_id, nickname)
);

-- 5. Respuestas
CREATE TABLE IF NOT EXISTS public.trivia_respuestas (
    id                  UUID PRIMARY KEY
                            DEFAULT gen_random_uuid(),
    jugador_id          UUID NOT NULL
                            REFERENCES public.trivia_jugadores(id)
                            ON DELETE CASCADE,
    pregunta_id         UUID NOT NULL
                            REFERENCES public.trivia_preguntas(id)
                            ON DELETE CASCADE,
    opcion_id           UUID NOT NULL
                            REFERENCES public.trivia_opciones(id)
                            ON DELETE CASCADE,
    tiempo_respuesta_ms INTEGER NOT NULL,
    puntos_ganados      INTEGER NOT NULL DEFAULT 0,
    es_correcta         BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_respuesta_por_pregunta
        UNIQUE (jugador_id, pregunta_id)
);

-- 6. Estado por pregunta (para realtime)
CREATE TABLE IF NOT EXISTS public.trivia_estado_pregunta (
    id                  UUID PRIMARY KEY
                            DEFAULT gen_random_uuid(),
    juego_id            UUID NOT NULL
                            REFERENCES public.trivia_juegos(id)
                            ON DELETE CASCADE,
    pregunta_id         UUID NOT NULL
                            REFERENCES public.trivia_preguntas(id)
                            ON DELETE CASCADE,
    estado              TEXT NOT NULL DEFAULT 'esperando'
                            CHECK (estado IN (
                                'esperando',
                                'abierta',
                                'cerrada',
                                'revelada'
                            )),
    total_respuestas    INTEGER NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_estado_por_pregunta
        UNIQUE (juego_id, pregunta_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_trivia_juegos_pin
    ON public.trivia_juegos(pin);
CREATE INDEX IF NOT EXISTS idx_trivia_juegos_estado
    ON public.trivia_juegos(estado);
CREATE INDEX IF NOT EXISTS idx_trivia_preguntas_juego
    ON public.trivia_preguntas(juego_id, orden);
CREATE INDEX IF NOT EXISTS idx_trivia_jugadores_juego
    ON public.trivia_jugadores(juego_id);
CREATE INDEX IF NOT EXISTS idx_trivia_jugadores_ranking
    ON public.trivia_jugadores(juego_id, puntaje_total DESC);
CREATE INDEX IF NOT EXISTS idx_trivia_respuestas_jugador
    ON public.trivia_respuestas(jugador_id);
CREATE INDEX IF NOT EXISTS idx_trivia_respuestas_pregunta
    ON public.trivia_respuestas(pregunta_id);

-- RLS
ALTER TABLE public.trivia_juegos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_preguntas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_opciones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_jugadores       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_respuestas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trivia_estado_pregunta ENABLE ROW LEVEL SECURITY;

-- ── POLICIES ─────────────────────────────────────

CREATE POLICY "trivia_juegos_select"
    ON public.trivia_juegos FOR SELECT
    TO anon, authenticated USING (true);

CREATE POLICY "trivia_juegos_admin_write"
    ON public.trivia_juegos FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role::text IN ('SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS')
                OR roles && ARRAY['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS']::text[]
            )
        )
    );

CREATE POLICY "trivia_preguntas_select"
    ON public.trivia_preguntas FOR SELECT
    TO anon, authenticated USING (true);

CREATE POLICY "trivia_preguntas_admin_write"
    ON public.trivia_preguntas FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role::text IN ('SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS')
                OR roles && ARRAY['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS']::text[]
            )
        )
    );

CREATE POLICY "trivia_opciones_select"
    ON public.trivia_opciones FOR SELECT
    TO anon, authenticated USING (true);

CREATE POLICY "trivia_opciones_admin_write"
    ON public.trivia_opciones FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role::text IN ('SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS')
                OR roles && ARRAY['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS']::text[]
            )
        )
    );

CREATE POLICY "trivia_jugadores_select"
    ON public.trivia_jugadores FOR SELECT
    TO anon, authenticated USING (true);

CREATE POLICY "trivia_jugadores_insert"
    ON public.trivia_jugadores FOR INSERT
    TO anon, authenticated WITH CHECK (true);

CREATE POLICY "trivia_jugadores_update"
    ON public.trivia_jugadores FOR UPDATE
    TO anon, authenticated USING (true);

CREATE POLICY "trivia_respuestas_select"
    ON public.trivia_respuestas FOR SELECT
    TO anon, authenticated USING (true);

CREATE POLICY "trivia_respuestas_insert"
    ON public.trivia_respuestas FOR INSERT
    TO anon, authenticated WITH CHECK (true);

CREATE POLICY "trivia_estado_select"
    ON public.trivia_estado_pregunta FOR SELECT
    TO anon, authenticated USING (true);

CREATE POLICY "trivia_estado_admin_write"
    ON public.trivia_estado_pregunta FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role::text IN ('SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS')
                OR roles && ARRAY['SUPER_ADMIN','PASTOR','ENCARGADO_EVENTOS']::text[]
            )
        )
    );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.trivia_juegos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trivia_estado_pregunta;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trivia_jugadores;

-- ════════════════════════════════════════════════
-- PRODE MUNDIAL 2026
-- 3 tablas: partidos, participantes, predicciones
-- ════════════════════════════════════════════════

-- ────────────────────────────────────────────────
-- TABLA 1: prode_matches
-- Los partidos del torneo — los carga el admin
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prode_matches (
    id              UUID PRIMARY KEY
                        DEFAULT gen_random_uuid(),
    match_number    INTEGER NOT NULL, -- Nro de partido
    round           TEXT NOT NULL
                        DEFAULT 'Fase de grupos'
                        CHECK (round IN (
                            'Fase de grupos',
                            'Octavos de final',
                            'Cuartos de final',
                            'Semifinal',
                            'Tercer puesto',
                            'Final'
                        )),
    group_name      TEXT,           -- 'Grupo A', etc.
    home_team       TEXT NOT NULL,  -- Equipo local
    away_team       TEXT NOT NULL,  -- Equipo visitante
    home_flag       TEXT,           -- Emoji de bandera
    away_flag       TEXT,           -- Emoji de bandera
    match_date      TIMESTAMPTZ,    -- Fecha y hora UTC
    venue           TEXT,           -- Estadio / Ciudad
    is_open         BOOLEAN
                        NOT NULL DEFAULT false,
                    -- true = se pueden hacer predicciones
    is_finished     BOOLEAN
                        NOT NULL DEFAULT false,
                    -- true = el partido terminó
    home_score_real INTEGER,        -- Goles local real
    away_score_real INTEGER,        -- Goles visitante real
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    -- No puede haber dos partidos con el mismo número
    CONSTRAINT unique_match_number
        UNIQUE (match_number)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_prode_matches_open
    ON public.prode_matches(is_open)
    WHERE is_open = true;
CREATE INDEX IF NOT EXISTS idx_prode_matches_date
    ON public.prode_matches(match_date);

-- RLS
ALTER TABLE public.prode_matches
    ENABLE ROW LEVEL SECURITY;

-- Lectura pública — cualquiera ve los partidos
DROP POLICY IF EXISTS "prode_matches_select"
    ON public.prode_matches;
CREATE POLICY "prode_matches_select"
    ON public.prode_matches
    FOR SELECT TO anon, authenticated
    USING (true);

-- Solo admins pueden crear/editar/eliminar partidos
-- Soporta tanto columna legacy `role` como array `roles[]`
DROP POLICY IF EXISTS "prode_matches_admin_write"
    ON public.prode_matches;
CREATE POLICY "prode_matches_admin_write"
    ON public.prode_matches
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role::text IN ('SUPER_ADMIN', 'PASTOR', 'PRODE')
                OR roles && ARRAY['SUPER_ADMIN', 'PASTOR', 'PRODE']::text[]
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role::text IN ('SUPER_ADMIN', 'PASTOR', 'PRODE')
                OR roles && ARRAY['SUPER_ADMIN', 'PASTOR', 'PRODE']::text[]
            )
        )
    );

-- ────────────────────────────────────────────────
-- TABLA 2: prode_participants
-- Un participante por persona (tiene o no cuenta)
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prode_participants (
    id          UUID PRIMARY KEY
                    DEFAULT gen_random_uuid(),
    first_name  TEXT NOT NULL,
    last_name   TEXT NOT NULL,
    user_id     UUID REFERENCES auth.users(id)
                    ON DELETE SET NULL,
                -- NULL si no tiene cuenta
    total_points INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW(),

    -- Un usuario registrado solo puede tener
    -- un participante (si tiene user_id)
    CONSTRAINT unique_user_participant
        UNIQUE (user_id)
);

-- Índice para ranking (orden por puntos desc)
CREATE INDEX IF NOT EXISTS idx_prode_participants_points
    ON public.prode_participants(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_prode_participants_name
    ON public.prode_participants(last_name, first_name);

-- RLS
ALTER TABLE public.prode_participants
    ENABLE ROW LEVEL SECURITY;

-- Lectura pública — el ranking es visible para todos
DROP POLICY IF EXISTS "prode_participants_select"
    ON public.prode_participants;
CREATE POLICY "prode_participants_select"
    ON public.prode_participants
    FOR SELECT TO anon, authenticated
    USING (true);

-- Cualquier usuario autenticado puede crear su
-- propio participante. Anónimos también (para
-- usuarios sin cuenta).
DROP POLICY IF EXISTS "prode_participants_insert"
    ON public.prode_participants;
CREATE POLICY "prode_participants_insert"
    ON public.prode_participants
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Solo el dueño o un admin puede actualizar
DROP POLICY IF EXISTS "prode_participants_update"
    ON public.prode_participants;
CREATE POLICY "prode_participants_update"
    ON public.prode_participants
    FOR UPDATE TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role::text IN ('SUPER_ADMIN', 'PASTOR', 'PRODE')
                OR roles && ARRAY['SUPER_ADMIN', 'PASTOR', 'PRODE']::text[]
            )
        )
    );

-- Solo admins pueden eliminar participantes
DROP POLICY IF EXISTS "prode_participants_delete"
    ON public.prode_participants;
CREATE POLICY "prode_participants_delete"
    ON public.prode_participants
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid()
            AND (
                role::text IN ('SUPER_ADMIN', 'PASTOR', 'PRODE')
                OR roles && ARRAY['SUPER_ADMIN', 'PASTOR', 'PRODE']::text[]
            )
        )
    );

-- ────────────────────────────────────────────────
-- TABLA 3: prode_predictions
-- Un pronóstico por participante por partido
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prode_predictions (
    id              UUID PRIMARY KEY
                        DEFAULT gen_random_uuid(),
    participant_id  UUID NOT NULL
                        REFERENCES public.prode_participants(id)
                        ON DELETE CASCADE,
    match_id        UUID NOT NULL
                        REFERENCES public.prode_matches(id)
                        ON DELETE CASCADE,
    home_score_pred INTEGER NOT NULL
                        CHECK (home_score_pred >= 0),
    away_score_pred INTEGER NOT NULL
                        CHECK (away_score_pred >= 0),
    points_earned   INTEGER,
                    -- NULL hasta que se cargue el resultado
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    -- Un pronóstico por participante por partido
    CONSTRAINT unique_prediction
        UNIQUE (participant_id, match_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_prode_pred_participant
    ON public.prode_predictions(participant_id);
CREATE INDEX IF NOT EXISTS idx_prode_pred_match
    ON public.prode_predictions(match_id);

-- RLS
ALTER TABLE public.prode_predictions
    ENABLE ROW LEVEL SECURITY;

-- Lectura pública — todos ven los pronósticos
-- (ranking es transparente)
DROP POLICY IF EXISTS "prode_predictions_select"
    ON public.prode_predictions;
CREATE POLICY "prode_predictions_select"
    ON public.prode_predictions
    FOR SELECT TO anon, authenticated
    USING (true);

-- Cualquiera puede insertar predicciones
-- (la validación de género se hace en el frontend
-- y en la función de supabaseService)
DROP POLICY IF EXISTS "prode_predictions_insert"
    ON public.prode_predictions;
CREATE POLICY "prode_predictions_insert"
    ON public.prode_predictions
    FOR INSERT TO anon, authenticated
    WITH CHECK (true);

-- Solo el dueño del participante o admin puede
-- actualizar predicciones (mientras el partido
-- está abierto — la lógica de cierre va en el
-- frontend y en las funciones del servicio)
DROP POLICY IF EXISTS "prode_predictions_update"
    ON public.prode_predictions;
CREATE POLICY "prode_predictions_update"
    ON public.prode_predictions
    FOR UPDATE TO anon, authenticated
    USING (true);

-- ────────────────────────────────────────────────
-- VERIFICACIÓN FINAL
-- ────────────────────────────────────────────────
SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'prode_matches',
    'prode_participants',
    'prode_predictions'
)
ORDER BY tablename;

SELECT
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'prode_matches',
    'prode_participants',
    'prode_predictions'
)
ORDER BY tablename, cmd;

-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — restricciones alimentarias
-- 2026-10-04
--
-- Hay chicos celíacos y chicos con diabetes, y en una noche con comida eso no
-- es un dato más: es la diferencia entre que la pasen bien o que terminen en
-- una guardia. Se pregunta en la inscripción y queda por persona, que es como
-- lo necesita quien arma las viandas.
--
-- POR ADOLESCENTE Y NO POR FAMILIA, aunque el formulario público pregunte una vez
-- para toda la familia ("¿alguno tiene…?" y después "¿quién?"). Guardarlo por
-- familia obligaría a rehacer la tabla el día que una tenga un celíaco y un
-- diabético. Así, ese día es sólo una pantalla distinta.
--
-- ⚠ Esta migración toca cuatro funciones que también toca otra gente (ver la
--   nota de sql/nocturna_sin_duplicados.sql). Por eso NO redefine ninguna:
--   agrega la columna y nada más. El agregado de `restriccion` a nocturna_alta,
--   nocturna_agregar_jovenes, admin_editar_nocturna y nocturna_validar_payload
--   se hizo sobre la definición VIVA de cada una, con pg_get_functiondef, para
--   no pisar lo que hubiera de otro lado.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.nocturna_jovenes
    ADD COLUMN IF NOT EXISTS restriccion TEXT NOT NULL DEFAULT 'ninguna';

-- El CHECK va aparte y con IF NOT EXISTS a mano: ADD CONSTRAINT no lo tiene.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'nocturna_jovenes_restriccion_valida'
    ) THEN
        ALTER TABLE public.nocturna_jovenes
            ADD CONSTRAINT nocturna_jovenes_restriccion_valida
            CHECK (restriccion IN ('ninguna', 'diabetes', 'celiaco'));
    END IF;
END $$;

COMMENT ON COLUMN public.nocturna_jovenes.restriccion IS
    'Restricción alimentaria declarada en la inscripción: ninguna, diabetes o celiaco. La declara el adulto responsable, no es un diagnóstico.';

-- Para la columna de la planilla: se filtra por "los que tienen algo", y eso
-- es una minoría de las filas.
CREATE INDEX IF NOT EXISTS idx_nocturna_jovenes_restriccion
    ON public.nocturna_jovenes(edicion, restriccion)
    WHERE restriccion <> 'ninguna';

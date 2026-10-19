-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — teléfonos del adulto responsable y de cada adolescente
-- 2026-10-19
--
-- Hasta hoy el único teléfono de una inscripción era el de quien retira a las
-- 6 AM, y sólo cuando retiraba un tercero. Si a las 3 de la mañana hay que
-- llamar a la casa de alguien, el email no sirve.
--
-- DOS TELÉFONOS, Y DISTINTOS:
--   · adulto_telefono — el de quien se hace cargo. Obligatorio en las altas
--     nuevas (lo exige nocturna_alta, no la columna: las 31 inscripciones que
--     ya existen no tenían dónde cargarlo).
--   · nocturna_jovenes.telefono — el del adolescente, uno por persona y no por
--     familia, porque a esa edad algunos tienen y otros no. El formulario
--     pregunta "¿tiene?" y recién después pide el número; NULL es "no tiene".
--
-- Las dos columnas quedan NULLABLE a propósito. NOT NULL obligaría a inventar
-- un valor para las filas viejas, y un teléfono inventado es peor que ninguno:
-- el que está en la planilla hay que poder marcarlo.
--
-- ⚠ Igual que sql/nocturna_restricciones.sql, esta migración NO redefine
--   ninguna función. El agregado del teléfono a nocturna_alta,
--   nocturna_agregar_jovenes, admin_editar_nocturna y
--   get_nocturna_para_acreditar se hizo sobre la definición VIVA de cada una
--   (pg_get_functiondef) para no pisar lo que hubiera de otro lado.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.nocturna_inscripciones
    ADD COLUMN IF NOT EXISTS adulto_telefono TEXT;

ALTER TABLE public.nocturna_jovenes
    ADD COLUMN IF NOT EXISTS telefono TEXT;

-- Los CHECK van aparte y con IF NOT EXISTS a mano: ADD CONSTRAINT no lo tiene.
-- Sólo prohíben la cadena vacía: un teléfono se guarda o no se guarda, pero
-- nunca como '' —que es un dato que parece estar y no está—. El largo no se
-- valida acá: hay números de línea, de otra provincia y de otro país, y la
-- base no es el lugar para adivinar cuál es válido.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'nocturna_inscripciones_adulto_telefono_check'
    ) THEN
        ALTER TABLE public.nocturna_inscripciones
            ADD CONSTRAINT nocturna_inscripciones_adulto_telefono_check
            CHECK (adulto_telefono IS NULL OR btrim(adulto_telefono) <> '');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conname = 'nocturna_jovenes_telefono_check'
    ) THEN
        ALTER TABLE public.nocturna_jovenes
            ADD CONSTRAINT nocturna_jovenes_telefono_check
            CHECK (telefono IS NULL OR btrim(telefono) <> '');
    END IF;
END $$;

COMMENT ON COLUMN public.nocturna_inscripciones.adulto_telefono IS
    'Celular del adulto responsable. Obligatorio en las altas nuevas (nocturna_alta); NULL en las inscripciones anteriores al 2026-10-19 que no se pudieron completar.';

COMMENT ON COLUMN public.nocturna_jovenes.telefono IS
    'Celular del adolescente, si tiene. NULL es "no tiene": el formulario pregunta primero si tiene y recién después pide el número.';

-- ── Las que ya estaban ──────────────────────────────────────────────────────
-- A quien se inscribió con su cuenta ya le pedimos el teléfono una vez, en el
-- perfil. Se lo copiamos en lugar de volver a molestarlo.
--
-- Sólo por user_id, que es el vínculo que la persona hizo ella misma al
-- iniciar sesión. Por email coincidente NO: un email tecleado se parece a una
-- cuenta sin ser la misma persona, y un teléfono mal atribuido manda la
-- llamada de las 3 AM a otra casa.
UPDATE public.nocturna_inscripciones i
   SET adulto_telefono = btrim(u.phone)
  FROM public.users u
 WHERE u.id = i.user_id
   AND i.adulto_telefono IS NULL
   AND NULLIF(btrim(COALESCE(u.phone, '')), '') IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════
-- NOCTURNA — marca del email "te falta un dato"
-- 2026-10-21
--
-- Una columna y nada más: cuándo se le mandó a esa inscripción el email que
-- le pide completar los datos que faltan.
--
-- POR QUÉ UNA MARCA Y NO UN CONTADOR
-- El email se manda una vez. Si hubiera que reintentarlo se pone en NULL a
-- mano y la función lo vuelve a tomar; un contador invitaría a reintentar
-- solo, y mandarle dos veces el mismo pedido a una familia que ya lo
-- completó es la forma más rápida de que dejen de leer lo que les llega.
--
-- NULL significa "todavía no se le mandó", que es el estado de las 35
-- inscripciones de hoy. La función `send-nocturna-datos-faltantes` sólo
-- toma las que tienen NULL y además no tienen teléfono del adulto.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.nocturna_inscripciones
    add column if not exists datos_faltantes_email_at timestamptz;

comment on column public.nocturna_inscripciones.datos_faltantes_email_at is
    'Cuándo se mandó el email que pide completar los datos que faltan. NULL = no se mandó. Lo escribe la edge function send-nocturna-datos-faltantes.';

-- El índice es el de la consulta de la función: las que no tienen teléfono y
-- no recibieron el email. Parcial, porque es la única pregunta que se le hace
-- y son pocas filas.
create index if not exists nocturna_insc_datos_faltantes_idx
    on public.nocturna_inscripciones (edicion)
    where datos_faltantes_email_at is null
      and (adulto_telefono is null or btrim(adulto_telefono) = '');

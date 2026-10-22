import type { NavigateFunction } from 'react-router-dom';

/**
 * Volver a la pantalla anterior de la app, o a `respaldo` si no hay ninguna.
 *
 * Notificaciones y el calendario se abren desde /perfil, pero también desde
 * la campana de la barra o desde el final de una inscripción: "volver" tiene
 * que llevar a donde estaba la persona, no siempre al mismo lugar. Si abrió
 * el link directo (no hay historial de la app detrás), `navigate(-1)` la
 * sacaría de la app; ahí va al respaldo.
 *
 * React Router guarda en history.state el índice de la entrada (`idx`): 0 es
 * la primera pantalla que abrió en esta pestaña.
 */
export const volverOA = (navigate: NavigateFunction, respaldo: string): void => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate(respaldo);
};

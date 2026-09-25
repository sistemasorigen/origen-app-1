import React, { useEffect } from 'react';
import { useBarraDeProgreso } from '../../hooks/useBarraDeProgreso';

const LOGO_URL = '/origen-logo.png';

/**
 * Pantalla de entrada a la app.
 *
 * Después de iniciar sesión la app no está lista de golpe: primero se sabe
 * que hay sesión, después llega el perfil —y con él los roles— y recién ahí
 * el menú deslizable y las rutas saben qué mostrarle a esa persona. Sin
 * este velo la pantalla se iba armando a la vista: el menú aparecía corto y
 * después crecía, y las tarjetas entraban de a una.
 *
 * Acá se espera con una barra que dice en qué anda, y el árbol de la app se
 * monta DETRÁS mientras la barra termina de llenarse. Cuando el velo se va,
 * lo que queda abajo ya está dibujado entero.
 *
 * La mecánica de la barra es la misma del tablero de reportes
 * (useBarraDeProgreso); lo que cambia es la piel: acá manda el lenguaje del
 * Home —slate sobre gris claro, negro sólido, píldoras—.
 */
const PantallaCargaApp: React.FC<{
    /** Techo de la etapa que corre (0-100). */
    objetivo: number;
    /** Qué se está haciendo, debajo de la barra. */
    etapa: string;
    /** Con `true` se desvanece. */
    saliendo: boolean;
    /** Se llama cuando terminó de irse. */
    onSalida: () => void;
}> = ({ objetivo, etapa, saliendo, onSalida }) => {
    const { barra, pct, escala } = useBarraDeProgreso(objetivo);

    // Respaldo de la transición: en una pestaña de fondo el navegador no
    // dispara transitionend y el velo se quedaría puesto para siempre.
    useEffect(() => {
        if (!saliendo) return;
        const id = window.setTimeout(onSalida, 440);
        return () => window.clearTimeout(id);
    }, [saliendo, onSalida]);

    const completo = objetivo >= 100;

    return (
        <div
            className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-slate-50 px-6 dark:bg-zinc-950"
            style={{
                opacity: saliendo ? 0 : 1,
                transform: saliendo ? 'scale(1.015)' : 'none',
                transition: 'opacity .4s ease, transform .4s cubic-bezier(.4,0,.2,1)',
            }}
        >
            <img
                src={LOGO_URL}
                alt="Origen"
                className="mb-9 h-9 w-auto object-contain dark:invert"
            />

            <div className="w-full max-w-[300px]">
                <div className="mb-2.5 flex items-baseline justify-between gap-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                        Entrando
                    </span>
                    <span className="text-[15px] font-semibold tabular-nums text-slate-900 dark:text-white">
                        {pct}%
                    </span>
                </div>

                <div
                    className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Carga de la aplicación"
                >
                    <div
                        ref={barra}
                        className="h-full w-full rounded-full bg-slate-900 dark:bg-white"
                        style={{
                            transformOrigin: 'left center',
                            transform: `scaleX(${escala})`,
                            // Cada etapa se desliza hacia su techo y frena ahí;
                            // el cierre, con todo listo, es de golpe.
                            transition: `transform ${completo ? '.3s' : '2.2s'} cubic-bezier(.22,.85,.32,1)`,
                        }}
                    />
                </div>

                {/* La `key` reinicia el fundido en cada frase nueva. */}
                <p
                    key={etapa}
                    className="animate-fadeIn mt-3 text-center text-[13px] font-medium text-slate-500 dark:text-zinc-400"
                    aria-live="polite"
                >
                    {etapa}
                </p>
            </div>
        </div>
    );
};

export default PantallaCargaApp;

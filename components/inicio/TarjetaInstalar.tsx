import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { posponerTarjeta, tarjetaPospuesta, useInstalacion } from '../../src/utils/instalacion';

/**
 * La invitación a instalar Origen, en el inicio.
 *
 * Un cartel corto que cuenta qué se gana y lleva a Mi cuenta → Instalar la
 * app, donde están los pasos de cada teléfono. Los pasos ya no van acá: en el
 * inicio ocupaban media pantalla.
 *
 * Va primera en la grilla, justo abajo del hero: es el primer lugar de
 * contenido que se ve y está en el flujo de la página, así que no tapa nada —
 * empuja. Vive sólo acá, así que nunca aparece en una inscripción, en
 * Nocturna, en una compra ni en un formulario.
 *
 * Cuándo se muestra:
 *   · con sesión: /perfil/instalar es de Mi cuenta, y sin sesión el toque
 *     terminaba en el login. Las notificaciones, además, son de la cuenta.
 *   · en un teléfono (iPhone, iPad o Android) que la está usando desde el
 *     navegador. Instalada, nunca. En la compu, tampoco.
 *   · "Ahora no" la oculta 30 días.
 */
const TarjetaInstalar: React.FC<{ conSesion: boolean }> = ({ conSesion }) => {
    const navigate = useNavigate();
    const { plataforma, instalada } = useInstalacion();
    const [oculta, setOculta] = useState(tarjetaPospuesta);

    if (!conSesion || instalada || oculta || plataforma === 'compu') return null;

    const ahoraNo = () => {
        posponerTarjeta();
        setOculta(true);
    };

    return (
        <section
            aria-labelledby="instalar-titulo"
            className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 sm:p-6 text-slate-900 dark:text-white"
        >
            <div className="flex items-start gap-4">
                {/* El mismo ícono que va a quedar en el teléfono: dice qué se
                    gana sin explicarlo. */}
                <img
                    src="/iconos/apple-touch-icon.png"
                    alt=""
                    width={52}
                    height={52}
                    className="flex-none w-[52px] h-[52px] rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,.18)]"
                />
                <div className="min-w-0">
                    <h2 id="instalar-titulo" className="m-0 text-[17px] sm:text-lg font-bold leading-tight">
                        Tené Origen como app en tu celular
                    </h2>
                    <p className="mt-1.5 mb-0 text-[14px] font-medium text-slate-500 dark:text-zinc-400 leading-snug">
                        Recibí las notificaciones en el celular y entrá de un toque desde tu pantalla de inicio, a pantalla completa.
                    </p>
                </div>
            </div>

            <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                    type="button"
                    onClick={ahoraNo}
                    className="min-h-[44px] px-5 rounded-full bg-slate-100 dark:bg-zinc-800 text-[14px] font-semibold text-slate-900 dark:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20"
                >
                    Ahora no
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/perfil/instalar')}
                    className="min-h-[44px] px-6 rounded-full bg-black dark:bg-white text-white dark:text-black text-[14px] font-semibold active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20"
                >
                    Instalar la app
                </button>
            </div>
        </section>
    );
};

export default TarjetaInstalar;

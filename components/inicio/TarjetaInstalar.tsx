import React, { useState } from 'react';
import { NOTA_REINSTALAR, PasosDeInstalacion } from '../instalacion/PasosDeInstalacion';
import {
    pedirInstalacion, posponerTarjeta, tarjetaPospuesta, useInstalacion,
} from '../../src/utils/instalacion';

/**
 * La invitación a instalar Origen, en el inicio.
 *
 * Va en el inicio, primera de la grilla, justo abajo del hero: es el primer
 * lugar de contenido que se ve y está en el flujo de la página, así que no
 * tapa nada — empuja. Vive sólo acá, así que nunca aparece en una inscripción,
 * en Nocturna, en una compra ni en un formulario.
 *
 * Cuándo se muestra:
 *   · iPhone o iPad en el navegador: los tres pasos (Safari no tiene botón de
 *     instalar; hay que hacerlo a mano).
 *   · Android, sólo si Chrome ofrece instalarla: un botón que la instala.
 *   · Instalada, nunca. Con "Ahora no", no vuelve por 30 días.
 *
 * Lo único que se permite llamar la atención es el ícono de la app, el mismo
 * que va a quedar en el teléfono: dice qué se gana sin explicarlo.
 */
const TarjetaInstalar: React.FC = () => {
    const { plataforma, instalada, puedeInstalar } = useInstalacion();
    const [oculta, setOculta] = useState(tarjetaPospuesta);
    const [instalando, setInstalando] = useState(false);

    const esIOS = plataforma === 'iphone' || plataforma === 'ipad';
    const esAndroid = plataforma === 'android' && puedeInstalar;
    if (instalada || oculta || (!esIOS && !esAndroid)) return null;

    const ahoraNo = () => {
        posponerTarjeta();
        setOculta(true);
    };

    const instalar = async () => {
        setInstalando(true);
        const acepto = await pedirInstalacion();
        setInstalando(false);
        // Si aceptó, Chrome la instala y la tarjeta se va sola (ya no hay
        // aviso guardado). Si dijo que no, Chrome no vuelve a ofrecerla en
        // esta visita: se trata como un "ahora no".
        if (!acepto) ahoraNo();
    };

    const dispositivo = plataforma === 'ipad' ? 'iPad' : plataforma === 'iphone' ? 'iPhone' : 'teléfono';

    return (
        <section
            aria-labelledby="instalar-titulo"
            className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 sm:p-6 text-slate-900 dark:text-white"
        >
            <div className="flex items-center gap-4">
                <img
                    src="/iconos/apple-touch-icon.png"
                    alt=""
                    width={52}
                    height={52}
                    className="flex-none w-[52px] h-[52px] rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,.18)]"
                />
                <div className="min-w-0">
                    <h2 id="instalar-titulo" className="m-0 text-[17px] sm:text-lg font-bold leading-tight">
                        Instalá Origen en tu {dispositivo}
                    </h2>
                    <p className="mt-1 mb-0 text-[14px] font-medium text-slate-500 dark:text-zinc-400 leading-snug">
                        Queda en tu pantalla de inicio y se abre a pantalla completa, como cualquier app.
                    </p>
                </div>
            </div>

            {esIOS && (
                <>
                    <PasosDeInstalacion sistema="iphone" className="mt-5" />
                    <p className="mt-4 mb-0 text-[13px] leading-relaxed font-medium text-slate-500 dark:text-zinc-400">
                        {NOTA_REINSTALAR}
                    </p>
                </>
            )}

            <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                    type="button"
                    onClick={ahoraNo}
                    className="min-h-[44px] px-5 rounded-full bg-slate-100 dark:bg-zinc-800 text-[14px] font-semibold text-slate-900 dark:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20"
                >
                    Ahora no
                </button>
                {esAndroid && (
                    <button
                        type="button"
                        onClick={instalar}
                        disabled={instalando}
                        className="min-h-[44px] px-6 rounded-full bg-black dark:bg-white text-white dark:text-black text-[14px] font-semibold active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20"
                    >
                        Instalar app
                    </button>
                )}
            </div>
        </section>
    );
};

export default TarjetaInstalar;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EllipsisVertical, Share } from 'lucide-react';
import { navegadorInterno, posponerTarjeta, tarjetaPospuesta, useInstalacion } from '../../src/utils/instalacion';

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
 *
 * Adentro de WhatsApp, Instagram, Facebook o TikTok no se puede instalar:
 * el cartel no ofrece instalar, explica cómo abrir el link afuera y deja
 * copiarlo.
 */

const ICONO_APP = (
    <img
        src="/iconos/apple-touch-icon.png"
        alt=""
        width={52}
        height={52}
        className="flex-none w-[52px] h-[52px] rounded-[12px] shadow-[0_2px_8px_rgba(0,0,0,.18)]"
    />
);

const BOTON_SECUNDARIO = 'min-h-[44px] px-5 rounded-full bg-slate-100 dark:bg-zinc-800 text-[14px] font-semibold text-slate-900 dark:text-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20';
const BOTON_PRIMARIO = 'min-h-[44px] px-6 rounded-full bg-black dark:bg-white text-white dark:text-black text-[14px] font-semibold active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20';

/** Copia al portapapeles; si la API no está, por el camino largo. */
const copiar = async (texto: string): Promise<boolean> => {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(texto);
            return true;
        }
    } catch { /* se prueba el otro camino */ }
    try {
        const area = document.createElement('textarea');
        area.value = texto;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        area.setSelectionRange(0, texto.length);
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok;
    } catch {
        return false;
    }
};

const TarjetaInstalar: React.FC<{ conSesion: boolean }> = ({ conSesion }) => {
    const navigate = useNavigate();
    const { plataforma, instalada } = useInstalacion();
    const [oculta, setOculta] = useState(tarjetaPospuesta);
    const [copiado, setCopiado] = useState<'' | 'si' | 'no'>('');

    if (!conSesion || instalada || oculta || plataforma === 'compu') return null;

    const interno = navegadorInterno();

    const ahoraNo = () => {
        posponerTarjeta();
        setOculta(true);
    };

    if (interno) {
        const link = `${window.location.origin}/#/perfil/instalar`;
        const esIPhone = plataforma === 'iphone' || plataforma === 'ipad';
        return (
            <section
                aria-labelledby="instalar-titulo"
                className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 sm:p-6 text-slate-900 dark:text-white"
            >
                <div className="flex items-start gap-4">
                    {ICONO_APP}
                    <div className="min-w-0">
                        <h2 id="instalar-titulo" className="m-0 text-[17px] sm:text-lg font-bold leading-tight">
                            Para instalar Origen, abrí este link en {esIPhone ? 'Safari' : 'Chrome'}
                        </h2>
                        <p className="mt-1.5 mb-0 text-[14px] font-medium text-slate-500 dark:text-zinc-400 leading-snug">
                            Desde {interno} no se puede instalar. En {esIPhone ? 'Safari (iPhone)' : 'Chrome (Android)'} sí, y ahí te llegan las notificaciones.
                        </p>
                    </div>
                </div>

                <ol className="mt-4 mb-0 p-0 list-none flex flex-col gap-2.5">
                    <li className="flex items-center gap-3 text-[14.5px] font-medium">
                        <span aria-hidden="true" className="flex-none w-9 h-9 rounded-[10px] bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                            {esIPhone ? <Share className="w-[17px] h-[17px]" strokeWidth={1.9} /> : <EllipsisVertical className="w-[17px] h-[17px]" strokeWidth={2} />}
                        </span>
                        <span>Tocá {esIPhone ? <><strong className="font-semibold">Compartir</strong> o los <strong className="font-semibold">tres puntos</strong></> : <>los <strong className="font-semibold">tres puntos</strong></>} de arriba o de abajo.</span>
                    </li>
                    <li className="flex items-center gap-3 text-[14.5px] font-medium">
                        <span aria-hidden="true" className="flex-none w-9 h-9 rounded-[10px] bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[13px] font-bold">↗</span>
                        <span>Elegí <strong className="font-semibold">Abrir en el navegador</strong> (o «Abrir en {esIPhone ? 'Safari' : 'Chrome'}»).</span>
                    </li>
                </ol>
                <p className="mt-3 mb-0 text-[13px] leading-relaxed font-medium text-slate-500 dark:text-zinc-400">
                    Si no aparece, copiá el link y pegalo en {esIPhone ? 'Safari' : 'Chrome'}.
                </p>

                <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button type="button" onClick={ahoraNo} className={BOTON_SECUNDARIO}>Ahora no</button>
                    <button
                        type="button"
                        onClick={async () => setCopiado((await copiar(link)) ? 'si' : 'no')}
                        className={BOTON_PRIMARIO}
                    >
                        {copiado === 'si' ? 'Link copiado' : 'Copiar link'}
                    </button>
                </div>
                {copiado === 'no' && (
                    <p role="alert" className="mt-2 mb-0 text-[13px] font-semibold break-all">
                        No se pudo copiar. El link es: {link}
                    </p>
                )}
            </section>
        );
    }

    return (
        <section
            aria-labelledby="instalar-titulo"
            className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 sm:p-6 text-slate-900 dark:text-white"
        >
            <div className="flex items-start gap-4">
                {/* El mismo ícono que va a quedar en el teléfono: dice qué se
                    gana sin explicarlo. */}
                {ICONO_APP}
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
                <button type="button" onClick={ahoraNo} className={BOTON_SECUNDARIO}>Ahora no</button>
                <button type="button" onClick={() => navigate('/perfil/instalar')} className={BOTON_PRIMARIO}>
                    Instalar la app
                </button>
            </div>
        </section>
    );
};

export default TarjetaInstalar;

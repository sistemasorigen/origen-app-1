// ════════════════════════════════════════════════════════════════════════
// /eventos — Preguntas frecuentes de Nocturna 2026.
//
// El texto sale de src/contenido/faqNocturna.ts y va tal cual. Esto es sólo
// cómo se ve: un acordeón dentro de una tarjeta, con los tokens de
// ./general/piezas.tsx para que sea la misma pantalla en claro y en oscuro.
//
// Se pueden abrir varias a la vez: quien llega acá suele leer dos o tres
// seguidas (horario, qué llevar, cómo retirarlo) y que una cierre la otra
// lo obliga a volver a buscarla.
//
// La animación de abrir es de alto (0fr → 1fr). Para quien pidió menos
// movimiento la apaga el <style> de Eventos.tsx, que corta transiciones y
// animaciones de todo lo que está dentro de #eventos.
// ════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { FAQ_NOCTURNA, PreguntaFaq, TramoFaq } from '../../src/contenido/faqNocturna';
import { T, rotulo } from './general/piezas';

export const ID_FAQ_NOCTURNA = 'faq-nocturna';

/** Baja hasta el FAQ y le pasa el foco al título, para teclado y lector. */
export const irAlFaqNocturna = () => {
    const destino = document.getElementById(ID_FAQ_NOCTURNA);
    if (!destino) return;
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    destino.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' });
    document.getElementById(`${ID_FAQ_NOCTURNA}-titulo`)?.focus({ preventScroll: true });
};

const IconoTelefono: React.FC = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 4h3.5l1.8 4.6-2.3 1.4a11 11 0 005.9 5.9l1.4-2.3L20 15.4V19a1.5 1.5 0 01-1.6 1.5C10.6 20 4 13.4 3.5 5.6A1.5 1.5 0 015 4z" />
    </svg>
);

const Tramo: React.FC<{ t: TramoFaq }> = ({ t }) =>
    typeof t === 'string' ? <>{t}</> : (
        // Píldora y no un link subrayado: es lo único de todo el FAQ que se
        // toca, y en el teléfono tiene que medir lo que mide un dedo.
        <a
            href={t.href}
            className={`inline-flex items-center gap-2 h-11 px-4 align-middle rounded-full ${T.chip} ${T.chipHover} ${T.tinta} text-[15px] font-bold no-underline whitespace-nowrap ${T.foco}`}
        >
            <IconoTelefono />
            {t.telefono}
        </a>
    );

const Respuesta: React.FC<{ r: PreguntaFaq['respuesta'] }> = ({ r }) =>
    'vinetas' in r ? (
        <ul className="m-0 p-0 list-none flex flex-col gap-2">
            {r.vinetas.map((v, i) => (
                <li key={i} className="flex gap-3">
                    <span aria-hidden="true" className="mt-[9px] w-[6px] h-[6px] rounded-full shrink-0 bg-black/30 dark:bg-white/30" />
                    <span>{v}</span>
                </li>
            ))}
        </ul>
    ) : (
        <p className="m-0">
            {r.parrafo.map((t, i) => <Tramo key={i} t={t} />)}
        </p>
    );

const FaqNocturna: React.FC = () => {
    const [abiertas, setAbiertas] = useState<Record<number, boolean>>({});
    const alternar = (i: number) => setAbiertas(a => ({ ...a, [i]: !a[i] }));

    return (
        <section
            id={ID_FAQ_NOCTURNA}
            aria-labelledby={`${ID_FAQ_NOCTURNA}-titulo`}
            className="mt-14 lg:mt-[72px] grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 lg:gap-10 items-start scroll-mt-20"
        >
            {/* El título se queda a la vista en la compu mientras se baja por
                las preguntas; en el teléfono va arriba, como en el resto. */}
            <div className="lg:sticky lg:top-24">
                <p className={`${rotulo} m-0`}>NOCTURNA 2026</p>
                <h2
                    id={`${ID_FAQ_NOCTURNA}-titulo`}
                    tabIndex={-1}
                    className="mt-2 m-0 text-[28px] lg:text-[34px] leading-[1.1] font-semibold tracking-[-.03em] outline-none"
                >
                    Preguntas frecuentes
                </h2>
            </div>

            <div className={`rounded-[28px] px-2 lg:px-3 py-1.5 ${T.tarjeta}`}>
                {FAQ_NOCTURNA.map((f, i) => {
                    const abierta = !!abiertas[i];
                    const idBoton = `${ID_FAQ_NOCTURNA}-p${i + 1}`;
                    const idPanel = `${ID_FAQ_NOCTURNA}-r${i + 1}`;
                    return (
                        <div key={i} className={i ? `border-t ${T.linea}` : ''}>
                            <h3 className="m-0">
                                <button
                                    type="button"
                                    id={idBoton}
                                    aria-expanded={abierta}
                                    aria-controls={idPanel}
                                    onClick={() => alternar(i)}
                                    className={`w-full min-h-[64px] flex items-center gap-3 px-3 lg:px-4 py-3 border-0 bg-transparent text-left rounded-[20px] cursor-pointer ${T.tinta} ${T.foco}`}
                                >
                                    <span className="flex-1 min-w-0 text-[16px] lg:text-[17px] leading-[1.35] font-semibold tracking-[-.01em] [overflow-wrap:anywhere]">
                                        {f.pregunta}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-colors duration-200 ${abierta ? T.primario : `${T.chip} ${T.tinta}`}`}
                                    >
                                        <svg
                                            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
                                            className="transition-transform duration-300"
                                            style={{ transform: abierta ? 'rotate(180deg)' : 'none' }}
                                        >
                                            <path d="M6 9l6 6 6-6" />
                                        </svg>
                                    </span>
                                </button>
                            </h3>
                            <div
                                id={idPanel}
                                role="region"
                                aria-labelledby={idBoton}
                                // Cerrada queda `inert`: el tab no entra al teléfono
                                // escondido y el lector no lee lo que no se ve.
                                inert={!abierta}
                                className="grid transition-[grid-template-rows] duration-300 ease-out"
                                style={{ gridTemplateRows: abierta ? '1fr' : '0fr' }}
                            >
                                <div className="min-h-0 overflow-hidden">
                                    <div className="px-3 lg:px-4 pb-5 lg:pr-14 text-[15px] lg:text-[15.5px] leading-[1.6] text-black/[.66] dark:text-white/[.66]">
                                        <Respuesta r={f.respuesta} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};

export default FaqNocturna;

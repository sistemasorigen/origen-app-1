import React, { useEffect, useState } from 'react';
import { BotonFantasma, BotonSecundario, ESTILO_TARJETA, Icono, ICONOS, TARJETA } from '../../../components/miCuenta/piezas';
import {
    alCambiarDiagnostico, borrarDiagnostico, fechaYHora, leerEventos, leerUltimaRevision, modo,
    momentoDelBuild, NOMBRE_DEL_TIPO, sistema, textoDiagnostico, versionCorta,
} from '../../../src/utils/diagnostico';
import { NOMBRE_PLATAFORMA, plataforma } from '../../../src/utils/instalacion';

/**
 * "Diagnóstico de la app", al pie de Sobre la app.
 *
 * Plegado y discreto: no es para el uso de todos los días, es para cuando
 * algo falla y hay que mandárselo a sistemas. Se copia como texto y se pega
 * en WhatsApp. Qué guarda y qué no: src/utils/diagnostico.ts.
 */

/** Copia al portapapeles; si la API no está (http, iOS viejo), por el camino largo. */
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

const Dato: React.FC<{ nombre: string; children: React.ReactNode; primera?: boolean }> = ({ nombre, children, primera }) => (
    <div className="flex justify-between gap-4 py-2.5" style={primera ? undefined : { borderTop: '1px solid var(--mc-line)' }}>
        <span className="text-[14px] font-medium" style={{ color: 'var(--mc-m50)' }}>{nombre}</span>
        <span className="text-[14px] font-semibold text-right tabular-nums min-w-0 break-words">{children}</span>
    </div>
);

export const DiagnosticoDeLaApp: React.FC = () => {
    const [abierto, setAbierto] = useState(false);
    const [, refrescar] = useState(0);
    const [aviso, setAviso] = useState<'' | 'copiado' | 'no-copio' | 'borrado'>('');

    // Si algo se anota con la pantalla abierta (una revisión, un error), se ve.
    useEffect(() => alCambiarDiagnostico(() => refrescar(n => n + 1)), []);
    useEffect(() => {
        if (!aviso) return;
        const t = window.setTimeout(() => setAviso(''), 2500);
        return () => window.clearTimeout(t);
    }, [aviso]);

    const eventos = abierto ? leerEventos().slice().reverse() : [];
    const ultima = abierto ? leerUltimaRevision() : null;

    return (
        <div className="mt-8 mb-2">
            <button
                type="button"
                onClick={() => setAbierto(v => !v)}
                aria-expanded={abierto}
                aria-controls="mc-diagnostico"
                className="mx-auto flex items-center gap-1.5 min-h-[44px] px-3 border-0 bg-transparent font-[inherit] text-[13.5px] font-semibold cursor-pointer"
                style={{ color: 'var(--mc-m50)' }}
            >
                Diagnóstico de la app
                <span className="inline-flex transition-transform duration-200" style={{ transform: abierto ? 'rotate(90deg)' : 'none' }}>
                    <Icono d={ICONOS.flecha} tam={15} grosor={2} />
                </span>
            </button>

            {abierto && (
                <div id="mc-diagnostico" className="mt-2" style={{ animation: 'mcAparece .2s ease' }}>
                    <p className="mt-0 mb-3 mx-1.5 text-[13.5px] leading-[1.5] font-medium text-pretty" style={{ color: 'var(--mc-m66)' }}>
                        Si la app falla, copiá esto y mandáselo a sistemas por WhatsApp. No incluye tu nombre, tu email ni ningún dato tuyo.
                    </p>

                    <div className={`${TARJETA} px-[18px] py-1`} style={ESTILO_TARJETA}>
                        <Dato nombre="Versión" primera>{versionCorta()}</Dato>
                        <Dato nombre="Compilada">{momentoDelBuild()}</Dato>
                        <Dato nombre="Modo">{modo() === 'instalada' ? 'Instalada' : 'Navegador'}</Dato>
                        <Dato nombre="Aparato">{NOMBRE_PLATAFORMA[plataforma()]} · {sistema()}</Dato>
                        <Dato nombre="Última revisión">
                            {ultima ? <>{fechaYHora(ultima.t)}<br /><span className="font-medium" style={{ color: 'var(--mc-m66)' }}>{ultima.resultado}</span></> : 'Ninguna todavía'}
                        </Dato>
                    </div>

                    <div className={`${TARJETA} mt-3 px-[18px] py-1`} style={ESTILO_TARJETA}>
                        {eventos.length === 0 ? (
                            <p className="my-3 text-[14px] font-medium" style={{ color: 'var(--mc-m50)' }}>No hay eventos anotados.</p>
                        ) : (
                            <ol className="m-0 p-0 list-none" aria-label="Eventos, del más nuevo al más viejo">
                                {eventos.map((e, i) => (
                                    <li key={`${e.t}-${i}`} className="py-2.5" style={i === 0 ? undefined : { borderTop: '1px solid var(--mc-line)' }}>
                                        <div className="flex items-baseline justify-between gap-3">
                                            <span className="text-[13.5px] font-semibold">
                                                {NOMBRE_DEL_TIPO[e.tipo] ?? e.tipo}
                                                {e.n && e.n > 1 ? <span className="font-medium" style={{ color: 'var(--mc-m50)' }}> ×{e.n}</span> : null}
                                            </span>
                                            <span className="flex-none text-[12.5px] font-medium tabular-nums" style={{ color: 'var(--mc-m50)' }}>{fechaYHora(e.t)}</span>
                                        </div>
                                        {e.detalle && (
                                            <p className="mt-0.5 mb-0 text-[13px] leading-[1.45] font-medium break-words" style={{ color: 'var(--mc-m66)' }}>{e.detalle}</p>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                        <BotonSecundario
                            ancho
                            className="min-h-[48px] text-[14.5px]"
                            onClick={async () => setAviso((await copiar(textoDiagnostico())) ? 'copiado' : 'no-copio')}
                        >
                            Copiar diagnóstico
                        </BotonSecundario>
                        <BotonFantasma
                            ancho
                            className="min-h-[48px] text-[14.5px]"
                            onClick={() => { borrarDiagnostico(); setAviso('borrado'); }}
                        >
                            Borrar
                        </BotonFantasma>
                    </div>
                    <p aria-live="polite" className="mt-2 mb-0 min-h-[20px] text-center text-[13px] font-semibold">
                        {aviso === 'copiado' && 'Copiado. Ya lo podés pegar en WhatsApp.'}
                        {aviso === 'no-copio' && 'No se pudo copiar. Mantené apretado el texto de arriba para copiarlo.'}
                        {aviso === 'borrado' && 'Diagnóstico borrado.'}
                    </p>
                </div>
            )}
        </div>
    );
};

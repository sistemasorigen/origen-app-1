import React from 'react';
import { EnlaceNoc } from './Botones';
import { anillo, arch, NEGRO } from './tokens';

/**
 * La barra de pasos: [ VOLVER ] y tres tramos —datos, información, pago—,
 * cada uno con un segmento por pantalla. Los segmentos hechos se rellenan.
 *
 * El diseño apaga al 60% el nombre de los tramos que no son el actual. Sobre
 * el rosa eso no llega al contraste mínimo, así que la diferencia la hace el
 * peso de la letra y no el color.
 */
export interface Tramo {
    nombre: string;
    pasos: number[];
}

/**
 * Sin `onVolver` no hay botón, y sin tramos queda sólo el botón (la salida
 * sin autorización). `volverApagado`: está, pero no responde (el pago,
 * mientras sube el comprobante o se guarda la inscripción).
 */
const Progreso: React.FC<{ tramos: Tramo[]; actual: number; onVolver?: () => void; volverApagado?: boolean }> = ({
    tramos, actual, onVolver, volverApagado,
}) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
        {onVolver && (
            <EnlaceNoc onClick={onVolver} disabled={volverApagado} aria-label="Volver al paso anterior" style={{ flex: 'none', padding: '0 4px' }}>
                Volver
            </EnlaceNoc>
        )}
        {tramos.length > 0 && <ol style={{ flex: 1, display: 'flex', gap: 8, minWidth: 0, margin: 0, padding: 0, listStyle: 'none' }}>
            {tramos.map(t => {
                const esActual = t.pasos.includes(actual);
                const hechos = t.pasos.filter(p => p <= actual).length;
                return (
                    <li
                        key={t.nombre}
                        style={{ flex: t.pasos.length, minWidth: 0 }}
                        aria-current={esActual ? 'step' : undefined}
                        aria-label={`${t.nombre}: ${hechos} de ${t.pasos.length}`}
                    >
                        <p
                            aria-hidden="true"
                            style={{
                                margin: '0 0 5px',
                                ...arch(esActual ? 900 : 600, '10.5px'),
                                letterSpacing: '.02em',
                                textTransform: 'uppercase',
                                color: NEGRO,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                            }}
                        >
                            {t.nombre}
                        </p>
                        <div aria-hidden="true" style={{ display: 'flex', gap: 3 }}>
                            {t.pasos.map(p => (
                                <span
                                    key={p}
                                    style={{
                                        flex: 1,
                                        height: 6,
                                        borderRadius: 999,
                                        background: p <= actual ? NEGRO : 'transparent',
                                        boxShadow: anillo(1.5),
                                        transition: 'background .3s ease',
                                    }}
                                />
                            ))}
                        </div>
                    </li>
                );
            })}
        </ol>}
    </div>
);

export default Progreso;

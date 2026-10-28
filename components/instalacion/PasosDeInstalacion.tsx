import React from 'react';
import { EllipsisVertical, Share, SquarePlus } from 'lucide-react';

/**
 * Los pasos para agregar Origen a la pantalla de inicio.
 *
 * Los usan la tarjeta del inicio y Mi cuenta → Instalar la app, que viven en
 * estéticas distintas (los tokens de Home y los --mc-* de Mi cuenta). Por eso
 * no fijan colores: todo sale de `currentColor` del contenedor, con opacidad
 * para lo secundario, y así quedan bien en los dos lados y en modo oscuro.
 *
 * Los números van porque es una secuencia de verdad: si se hace en otro
 * orden no funciona.
 */

/** Un poco del color del texto, para bordes y fondos suaves. */
const SUAVE = 'color-mix(in srgb, currentColor 9%, transparent)';
const BORDE = 'color-mix(in srgb, currentColor 14%, transparent)';

interface Paso {
    /** Lo que se ve en el teléfono: el ícono o el botón a tocar. */
    muestra: React.ReactNode;
    texto: React.ReactNode;
    detalle?: string;
}

/** La palabra "Agregar" como se ve en el iPhone: azul, arriba a la derecha. */
const BotonDeIOS: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className="text-[12.5px] font-semibold" style={{ color: '#0a84ff' }}>{children}</span>
);

const PASOS_IPHONE: Paso[] = [
    {
        muestra: <Share className="w-[19px] h-[19px]" strokeWidth={1.9} style={{ color: '#0a84ff' }} />,
        texto: <>Tocá <strong className="font-semibold">Compartir</strong></>,
        detalle: 'En Safari está abajo, o dentro del botón ···. En Chrome, arriba a la derecha.',
    },
    {
        muestra: <SquarePlus className="w-[19px] h-[19px]" strokeWidth={1.9} />,
        texto: <>Elegí <strong className="font-semibold">Agregar a inicio</strong></>,
        detalle: 'Si no la ves, bajá en la lista.',
    },
    {
        muestra: <BotonDeIOS>Agregar</BotonDeIOS>,
        texto: <>Tocá <strong className="font-semibold">Agregar</strong></>,
        detalle: 'Origen aparece en tu pantalla de inicio.',
    },
];

const PASOS_ANDROID: Paso[] = [
    {
        muestra: <EllipsisVertical className="w-[19px] h-[19px]" strokeWidth={2} />,
        texto: <>Abrí el menú de <strong className="font-semibold">Chrome</strong></>,
        detalle: 'Los tres puntitos, arriba a la derecha.',
    },
    {
        muestra: <SquarePlus className="w-[19px] h-[19px]" strokeWidth={1.9} />,
        texto: <>Tocá <strong className="font-semibold">Instalar app</strong></>,
        detalle: 'En algunos teléfonos dice "Agregar a la pantalla principal".',
    },
    {
        muestra: <span className="text-[12.5px] font-semibold" style={{ color: '#1a73e8' }}>Instalar</span>,
        texto: <>Confirmá con <strong className="font-semibold">Instalar</strong></>,
        detalle: 'Origen aparece con las demás apps.',
    },
];

export const PasosDeInstalacion: React.FC<{ sistema: 'iphone' | 'android'; className?: string }> = ({ sistema, className = '' }) => {
    const pasos = sistema === 'iphone' ? PASOS_IPHONE : PASOS_ANDROID;
    return (
        <ol className={`m-0 p-0 list-none grid gap-3 sm:grid-cols-3 sm:gap-4 ${className}`}>
            {pasos.map((p, i) => (
                <li key={i} className="flex items-start gap-3 sm:flex-col sm:gap-2.5">
                    <span
                        className="relative flex-none w-[64px] h-[44px] rounded-[12px] flex items-center justify-center"
                        style={{ background: SUAVE, border: `1px solid ${BORDE}` }}
                        aria-hidden="true"
                    >
                        {p.muestra}
                        <span
                            className="absolute -top-[7px] -left-[7px] w-[20px] h-[20px] rounded-full flex items-center justify-center text-[11px] font-bold"
                            style={{ background: 'currentColor' }}
                        >
                            {/* El círculo es del color del texto y el número, su
                                inverso: negro con blanco en claro, blanco con
                                negro en oscuro, sin tener que preguntar cuál. */}
                            <span style={{ color: 'currentColor', filter: 'invert(1)' }}>{i + 1}</span>
                        </span>
                    </span>
                    <span className="min-w-0 flex flex-col gap-0.5 pt-0.5 sm:pt-0">
                        <span className="text-[15px] leading-snug font-medium">{p.texto}</span>
                        {p.detalle && (
                            <span className="text-[13px] leading-snug font-medium" style={{ opacity: .62 }}>{p.detalle}</span>
                        )}
                    </span>
                </li>
            ))}
        </ol>
    );
};

/** La aclaración para quien ya la tenía: el ícono viejo no se actualiza solo. */
export const NOTA_REINSTALAR = 'Si ya la tenías en el inicio, borrala y volvé a agregarla para tener la versión nueva. Vas a tener que iniciar sesión una vez.';

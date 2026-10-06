import React from 'react';
import { anillo, arch, LIMA, NEGRO } from './tokens';

/**
 * Las respuestas a un toque: Sí / No, Autorizo, las fotos, quién retira y
 * la comida.
 *
 * Todas son botones con aria-pressed, como antes del rediseño: lo que cambió
 * es cómo se ven, no qué son. La elegida se pinta de negro con letra lima;
 * las grandes, además, quedan un poco torcidas, como un sello recién puesto.
 * Las de la comida no se tuercen: es información de salud y el paso va en
 * voz baja.
 */

const CHASQUIDO = 'nocChasquido .45s cubic-bezier(.2,.8,.2,1)';

const ELEGIDA: React.CSSProperties = { background: NEGRO, color: LIMA };
const SIN_ELEGIR: React.CSSProperties = { background: 'transparent', color: NEGRO, boxShadow: anillo() };

interface Base {
    elegida: boolean;
    onClick: () => void;
}

/** Sí / No: dos botones enormes, lado a lado. */
export const OpcionGrande: React.FC<Base & { children: React.ReactNode }> = ({ elegida, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={elegida}
        className={`noc-boton${elegida ? ' noc-sobre-negro' : ''}`}
        style={{
            minHeight: 66,
            border: 0,
            borderRadius: 999,
            ...arch(900, '24px'),
            letterSpacing: '-.045em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            ...(elegida
                ? { ...ELEGIDA, transform: 'rotate(-2deg)', animation: CHASQUIDO }
                : { background: LIMA, color: NEGRO, boxShadow: anillo() }),
        }}
    >
        {children}
    </button>
);

/**
 * Una respuesta con su consecuencia abajo: "AUTORIZO / Pueden asistir".
 * `principal` la pinta de negro aunque no esté elegida: es la respuesta que
 * se espera, y la otra queda de contorno.
 */
export const OpcionDoble: React.FC<Base & { titulo: string; bajada: string; principal?: boolean }> = ({
    elegida, onClick, titulo, bajada, principal,
}) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={elegida}
        className={`noc-boton${elegida || principal ? ' noc-sobre-negro' : ''}`}
        style={{
            minHeight: 72,
            padding: '10px 18px',
            border: 0,
            borderRadius: 999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            cursor: 'pointer',
            ...(elegida
                ? { ...ELEGIDA, transform: 'rotate(-1.5deg)', animation: CHASQUIDO }
                : principal ? ELEGIDA : SIN_ELEGIR),
        }}
    >
        <span style={{ ...arch(900, '19px'), letterSpacing: '-.04em', textTransform: 'uppercase' }}>{titulo}</span>
        <span style={{ ...arch(700, '12.5px', '1.3'), overflowWrap: 'anywhere' }}>{bajada}</span>
    </button>
);

/** Una de una lista corta, con el punto a la izquierda: "LO RETIRO YO". */
export const OpcionRadio: React.FC<Base & { children: React.ReactNode }> = ({ elegida, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={elegida}
        className={`noc-boton${elegida ? ' noc-sobre-negro' : ''}`}
        style={{
            width: '100%',
            minHeight: 64,
            padding: '10px 18px',
            border: 0,
            borderRadius: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            cursor: 'pointer',
            textAlign: 'left',
            ...arch(900, '16px', '1.2'),
            letterSpacing: '-.03em',
            textTransform: 'uppercase',
            ...(elegida ? ELEGIDA : { background: LIMA, color: NEGRO, boxShadow: anillo() }),
        }}
    >
        <span
            aria-hidden="true"
            style={{
                width: 24, height: 24, borderRadius: 999, flex: 'none',
                ...(elegida ? { background: NEGRO, boxShadow: anillo(6, LIMA) } : { boxShadow: anillo() }),
            }}
        />
        <span>{children}</span>
    </button>
);

/** Las tres de la comida, en fila. Sin sello ni chasquido. */
export const OpcionPastilla: React.FC<Base & { children: React.ReactNode }> = ({ elegida, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={elegida}
        className={`noc-boton${elegida ? ' noc-sobre-negro' : ''}`}
        style={{
            minHeight: 52,
            padding: '0 6px',
            border: 0,
            borderRadius: 999,
            ...arch(800, '13.5px'),
            letterSpacing: '-.02em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            ...(elegida ? ELEGIDA : { ...SIN_ELEGIR, boxShadow: anillo(2) }),
        }}
    >
        {children}
    </button>
);

/** La etiqueta chica de un campo o de una fila: "DE TU CUENTA". */
export const Etiqueta: React.FC<{ llena?: boolean; id?: string; children: React.ReactNode }> = ({ llena, id, children }) => (
    <span
        id={id}
        style={{
            flex: 'none',
            minHeight: 24,
            padding: '3px 9px',
            borderRadius: 999,
            display: 'inline-flex',
            alignItems: 'center',
            whiteSpace: 'nowrap',
            ...arch(900, '10.5px'),
            textTransform: 'uppercase',
            ...(llena ? { background: NEGRO, color: LIMA } : { color: NEGRO, boxShadow: anillo(2) }),
        }}
    >
        {children}
    </span>
);

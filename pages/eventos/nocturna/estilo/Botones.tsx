import React from 'react';
import { anillo, arch, LIMA, NEGRO, ROSA } from './tokens';

/**
 * Los botones del lenguaje de Nocturna: píldoras con borde negro, el texto en
 * mayúsculas y, en las acciones secundarias, entre corchetes.
 *
 * Los textos se escriben normales ("Entrar sin sesión") y las mayúsculas las
 * pone el CSS: un lector de pantalla lee "ENTRAR" letra por letra si lo
 * encuentra escrito así. Los corchetes son decorado y van ocultos para el
 * lector, así el nombre del botón es la acción y nada más.
 */

export const Corchetes: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <>
        <span aria-hidden="true">[&nbsp;</span>
        {children}
        <span aria-hidden="true">&nbsp;]</span>
    </>
);

type Variante = 'negro' | 'contorno' | 'lima' | 'contornoLima';

const COLORES: Record<Variante, React.CSSProperties> = {
    // Lima sobre negro: la acción principal.
    negro: { background: NEGRO, color: LIMA },
    // Sólo el borde: la alternativa, sobre rosa o sobre lima.
    contorno: { background: 'transparent', color: NEGRO, boxShadow: anillo() },
    // Sobre un fondo negro (el pie, el diálogo de "ese DNI ya se usó").
    lima: { background: LIMA, color: NEGRO },
    contornoLima: { background: 'transparent', color: LIMA, boxShadow: anillo(2.5, LIMA) },
};

interface BotonProps {
    variante?: Variante;
    corchetes?: boolean;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    'aria-label'?: string;
    'aria-pressed'?: boolean;
    'aria-describedby'?: string;
    children: React.ReactNode;
}

export const BotonNoc: React.FC<BotonProps> = ({
    variante = 'negro', corchetes, onClick, disabled, className = '', style, children, ...aria
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`noc-boton ${variante === 'negro' || variante === 'contornoLima' ? 'noc-sobre-negro ' : ''}${className}`}
        style={{
            width: '100%',
            minHeight: 62,
            padding: '0 22px',
            border: 0,
            borderRadius: 999,
            ...arch(800, '16px'),
            letterSpacing: '-.02em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            ...COLORES[variante],
            ...style,
        }}
        {...aria}
    >
        {corchetes ? <Corchetes>{children}</Corchetes> : children}
    </button>
);

/** El link entre corchetes: "[ VOLVER AL INICIO ]". Con 44 px de alto, para el dedo. */
export const EnlaceNoc: React.FC<{
    onClick: () => void;
    children: React.ReactNode;
    tam?: string;
    style?: React.CSSProperties;
    'aria-label'?: string;
}> = ({ onClick, children, tam = '14px', style, ...aria }) => (
    <button
        type="button"
        onClick={onClick}
        className="noc-enlace"
        style={{
            minHeight: 44,
            padding: '8px 4px',
            border: 0,
            background: 'transparent',
            color: NEGRO,
            ...arch(800, tam),
            letterSpacing: '-.02em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            ...style,
        }}
        {...aria}
    >
        <Corchetes>{children}</Corchetes>
    </button>
);

/**
 * La tribu se elige como una pulsera: un broche a la izquierda, el nombre y
 * tres agujeros. La elegida se pinta de negro y queda un poco torcida, como
 * recién puesta.
 */
export const BotonPulsera: React.FC<{ elegida: boolean; onClick: () => void; children: string }> = ({
    elegida, onClick, children,
}) => {
    const color = elegida ? LIMA : NEGRO;
    const punto = (tam: number): React.CSSProperties => ({ width: tam, height: tam, borderRadius: 999, flex: 'none', background: color });
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={elegida}
            className={`noc-boton${elegida ? ' noc-sobre-negro' : ''}`}
            style={{
                height: 60,
                padding: '0 18px 0 12px',
                border: 0,
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
                color: elegida ? LIMA : NEGRO,
                background: elegida ? NEGRO : ROSA,
                boxShadow: anillo(),
                transform: elegida ? 'rotate(-2deg)' : 'none',
                transition: 'background .15s, color .15s',
                animation: elegida ? 'nocChasquido .45s cubic-bezier(.2,.8,.2,1)' : undefined,
            }}
        >
            <span aria-hidden="true" style={punto(36)} />
            <span style={{ flex: 1, textAlign: 'left', ...arch(900, '19px'), letterSpacing: '-.05em', textTransform: 'uppercase' }}>
                {children}
            </span>
            <span aria-hidden="true" style={{ display: 'flex', gap: 5, flex: 'none' }}>
                <span style={punto(9)} />
                <span style={punto(9)} />
                <span style={punto(9)} />
            </span>
        </button>
    );
};

import React from 'react';

/**
 * El título de cada paso: las letras entran de a una.
 *
 * El lector de pantalla lee el título entero, de una vez (aria-label); las
 * letras sueltas quedan ocultas para él, porque si no deletrearía.
 *
 * Las mayúsculas las pone el CSS (.noc-titulo). Con "reducir movimiento" las
 * letras aparecen todas juntas (ver animaciones.ts).
 */
const TituloLetras: React.FC<{
    texto: string;
    /** Desde cuándo arrancan las letras, en ms. */
    demora?: number;
    centrado?: boolean;
    portada?: boolean;
    style?: React.CSSProperties;
}> = ({ texto, demora = 80, centrado, portada, style }) => {
    let i = 0;
    return (
        <h1
            aria-label={texto}
            className={`noc-titulo${portada ? ' portada' : ''}`}
            style={{ textAlign: centrado ? 'center' : 'left', ...style }}
        >
            {texto.split(' ').map((palabra, p) => (
                <span
                    key={p}
                    aria-hidden="true"
                    className="palabra"
                    style={{ margin: centrado ? '0 .12em' : '0 .22em 0 0' }}
                >
                    {palabra.split('').map((letra, l) => {
                        const ms = demora + i++ * 28;
                        return (
                            <span
                                key={l}
                                className="letra"
                                style={{ opacity: 0, animation: `nocLetra .5s cubic-bezier(.2,.8,.2,1.2) ${ms}ms forwards` }}
                            >
                                {letra}
                            </span>
                        );
                    })}
                </span>
            ))}
        </h1>
    );
};

export default TituloLetras;

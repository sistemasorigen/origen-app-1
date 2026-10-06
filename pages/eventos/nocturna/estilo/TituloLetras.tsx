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
    /** Más chico: las preguntas largas (`chico`) y las salidas (`serio`). */
    tam?: 'chico' | 'serio';
    /** h2 cuando va dentro de una pantalla que ya tiene su h1. */
    nivel?: 'h1' | 'h2';
    style?: React.CSSProperties;
}> = ({ texto, demora = 80, centrado, portada, tam, nivel = 'h1', style }) => {
    let i = 0;
    const Etiqueta = nivel;
    return (
        <Etiqueta
            aria-label={texto}
            className={`noc-titulo${portada ? ' portada' : ''}${tam ? ` ${tam}` : ''}`}
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
        </Etiqueta>
    );
};

export default TituloLetras;

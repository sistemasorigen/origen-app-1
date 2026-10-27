import React from 'react';
import { Icono, ICONOS } from './piezas';

/**
 * La tarjeta destacada de "Mi cuenta".
 *
 * Es lo ÚNICO fuerte de la pantalla: todo lo demás —la tarjeta de la persona,
 * las filas— es blanco y callado. Si hubiera dos cosas gritando no habría
 * ninguna.
 *
 * El color no decora, dice de qué se trata:
 *   lavanda = tu entrada · verde = tu pedido está listo · ámbar = te falta un
 *   dato · azul = todavía no tenés grupo.
 *
 * Se elige sola: la PRIMERA que aplique, en el orden de CASOS. Si no aplica
 * ninguna no hay tarjeta: el índice arranca directo con las filas.
 */

export type CasoDestacado = 'entrada' | 'pedido' | 'perfil' | 'grupo';

export interface Destacado {
    caso: CasoDestacado;
    /** Admite nodos: un codigo como VOL-4F7K no se puede partir al medio. */
    titulo: React.ReactNode;
    sub: string;
    boton?: string;
    onIr?: () => void;
}

/** Los fondos y trazos del .dc, uno por caso, en claro y en oscuro. */
export const ESTILOS_DESTACADA = `
#mi-cuenta [data-caso="entrada"] { --f-bg: #ece8fb; --f-st: #5b4cc4; }
#mi-cuenta [data-caso="pedido"]  { --f-bg: #e2f2e6; --f-st: #2f7d4a; }
#mi-cuenta [data-caso="perfil"]  { --f-bg: #fbf0d4; --f-st: #a06a00; }
#mi-cuenta [data-caso="grupo"]   { --f-bg: #e2ecf8; --f-st: #2d62a8; }

.dark #mi-cuenta [data-caso="entrada"] { --f-bg: #25223a; --f-st: #b4a9f6; }
.dark #mi-cuenta [data-caso="pedido"]  { --f-bg: #1b2b21; --f-st: #8fd6a5; }
.dark #mi-cuenta [data-caso="perfil"]  { --f-bg: #2e2714; --f-st: #f0c060; }
.dark #mi-cuenta [data-caso="grupo"]   { --f-bg: #1a2433; --f-st: #8fb8ee; }

#mi-cuenta .mc-destacada {
    animation: mcAparece .45s ease both;
}
`;

/** Las ilustraciones del .dc, de 96×96. */
const DIBUJO: Record<CasoDestacado, string> = {
    entrada: 'M10 34h76v10a6 6 0 000 12v10H10V56a6 6 0 000-12zM62 34v32M40 41a10 10 0 106 16 8 8 0 11-6-16zM76 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z',
    pedido: 'M22 36h52l-5 44H27zM36 36v-6a12 12 0 0124 0v6M37 57l8 8 14-15',
    perfil: 'M12 22h58v44H12zM32 44a7 7 0 100-14 7 7 0 000 14zM20 58a12 12 0 0124 0M51 34h10M51 44h10M58 80l22-22 7 7-22 22h-7z',
    grupo: 'M48 46a9 9 0 100-18 9 9 0 000 18zM30 76a18 18 0 0136 0M24 52a7 7 0 100-14 7 7 0 000 14zM10 74a14 14 0 0119-13M72 52a7 7 0 100-14 7 7 0 000 14zM86 74a14 14 0 00-19-13',
};

export const Destacada: React.FC<{ destacado: Destacado; onCerrar?: () => void }> = ({ destacado, onCerrar }) => (
    <div
        data-caso={destacado.caso}
        className="mc-destacada relative grid grid-cols-[minmax(0,1fr)_auto] gap-2.5 mt-3.5 pt-5 pr-4 pb-[18px] pl-5 min-h-[150px] rounded-[26px]"
        style={{ background: 'var(--f-bg)', color: 'var(--mc-ink)', transition: 'background-color .4s ease' }}
    >
        <div className="min-w-0 flex flex-col items-start">
            <p className="m-0 pr-[34px] text-[17px] leading-[1.3] font-semibold tracking-[-.015em] text-balance">
                {destacado.titulo}
            </p>
            {destacado.sub && (
                <p className="mt-1.5 mb-0 text-[14px] leading-[1.4] font-medium text-pretty" style={{ color: 'var(--mc-m66)' }}>
                    {destacado.sub}
                </p>
            )}
            {destacado.boton && (
                <button
                    type="button"
                    onClick={destacado.onIr}
                    className="mt-3.5 h-11 px-5 rounded-full border-0 font-[inherit] text-[14.5px] font-semibold cursor-pointer active:scale-[.97]"
                    style={{ background: 'var(--mc-prim)', color: 'var(--mc-prim-ink)', transition: 'transform .12s ease' }}
                >
                    {destacado.boton}
                </button>
            )}
        </div>

        <svg
            width="88" height="88" viewBox="0 0 96 96" fill="none"
            stroke="var(--f-st)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true" className="self-end flex-none"
        >
            <path d={DIBUJO[destacado.caso]} />
        </svg>

        {onCerrar && (
            <button
                type="button"
                onClick={onCerrar}
                aria-label="Ocultar esta tarjeta"
                className="absolute top-1.5 right-1.5 w-11 h-11 border-0 bg-transparent flex items-center justify-center cursor-pointer"
                style={{ color: 'var(--mc-ink)' }}
            >
                <span
                    className="w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: 'var(--mc-chip)' }}
                >
                    <Icono d={ICONOS.equis} tam={13} grosor={2.6} />
                </span>
            </button>
        )}
    </div>
);

export default Destacada;

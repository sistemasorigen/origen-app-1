import React, { useEffect, useRef } from 'react';
import { Corchetes } from './Botones';
import { anillo, arch, LIMA, NEGRO } from './tokens';

/**
 * El pie: a la izquierda lo que dice este paso (el total, o qué se respondió)
 * y a la derecha el botón para seguir.
 *
 * El botón no se deshabilita cuando falta algo: se ve apagado —sólo el
 * borde— pero responde, y al tocarlo aparece arriba qué falta. Por eso no
 * lleva aria-disabled: anunciarlo deshabilitado sería mentirle a quien usa
 * lector de pantalla. Sí se deshabilita mientras guarda o revisa, que es
 * cuando un segundo toque no tiene que hacer nada.
 */
interface Props {
    titulo: string;
    nota: string;
    /** Qué falta, si la persona ya intentó seguir. */
    falta?: string;
    etiqueta: string;
    /** Con corchetes ("[ SIGUIENTE ]") o sin ("GUARDANDO…"). */
    corchetes: boolean;
    listo: boolean;
    ocupado: boolean;
    onSeguir: () => void;
}

/**
 * El pie se va mientras el teclado está abierto.
 *
 * Fijo abajo, con el teclado abierto queda flotando encima de él (iPhone) o
 * tapando el campo que se escribe. Lo que se mira es el teclado de verdad
 * —cuánto se achica el área visible— y no el foco: en Android el teclado se
 * cierra con el botón de atrás sin sacarle el foco al campo, y con una regla
 * por foco el pie no volvía y la persona quedaba sin botón para seguir.
 */
const useSinTeclado = () => {
    const pie = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const vv = window.visualViewport;
        if (!vv) return;
        const medir = () => {
            // Con zoom de dos dedos también se achica el área: por eso se
            // compensa con la escala. Sólo el teclado la achica a escala 1.
            const abierto = vv.height * vv.scale < window.innerHeight * 0.78;
            pie.current?.classList.toggle('con-teclado', abierto);
        };
        vv.addEventListener('resize', medir);
        medir();
        return () => vv.removeEventListener('resize', medir);
    }, []);
    return pie;
};

const Pie: React.FC<Props> = ({ titulo, nota, falta, etiqueta, corchetes, listo, ocupado, onSeguir }) => {
    const pie = useSinTeclado();
    return (
    <div ref={pie} className="noc-pie">
        <div className="noc-columna">
            {falta && (
                <p id="noc-pendiente" role="status" style={{ margin: '0 0 10px', ...arch(700, '13.5px', '1.4'), color: LIMA }}>
                    {falta}
                </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, ...arch(900, '22px', '1.1'), letterSpacing: '-.04em', color: LIMA, overflowWrap: 'anywhere', textTransform: 'uppercase' }}>
                        {titulo}
                    </p>
                    <p style={{ margin: '2px 0 0', ...arch(700, '12.5px', '1.3'), color: LIMA, textTransform: 'uppercase' }}>
                        {nota}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onSeguir}
                    disabled={ocupado}
                    aria-describedby={falta ? 'noc-pendiente' : undefined}
                    className="noc-boton"
                    style={{
                        height: 60,
                        padding: '0 24px',
                        border: 0,
                        borderRadius: 999,
                        flex: 'none',
                        ...arch(900, '16px'),
                        letterSpacing: '-.03em',
                        textTransform: 'uppercase',
                        cursor: ocupado ? 'progress' : 'pointer',
                        ...(ocupado
                            ? { background: LIMA, color: NEGRO, opacity: 0.6 }
                            : listo
                                ? { background: LIMA, color: NEGRO }
                                : { background: 'transparent', color: LIMA, boxShadow: anillo(2.5, LIMA) }),
                    }}
                >
                    {corchetes ? <Corchetes>{etiqueta}</Corchetes> : etiqueta}
                </button>
            </div>
        </div>
    </div>
    );
};

export default Pie;

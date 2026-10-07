import React from 'react';
import { anillo, LIMA, NEGRO } from './tokens';

/**
 * El cajón de los diálogos: sube desde abajo en el teléfono y se centra en
 * escritorio, como el resto de las hojas de la app.
 *
 * El tono no es decorativo: dice de qué tipo de noticia se trata.
 *  · `lima` — algo bueno o algo que se puede resolver acá mismo ("ya tenés
 *    una inscripción", "si volvés se cierra tu sesión").
 *  · `negro` — un tope: no se puede seguir por este camino ("ya hay una
 *    inscripción con ese DNI"). Invertir el fondo es lo que hace que las dos
 *    caras no se confundan de un vistazo.
 *
 * El corte entre teléfono y escritorio lo hace el CSS (.noc-hoja en
 * estilo/estilos.ts) y no JavaScript: una media query no necesita estado ni
 * escuchar el redimensionado.
 */
const Hoja: React.FC<{
    tono?: 'lima' | 'negro';
    /** El id del título de adentro, para que el lector lo anuncie al abrir. */
    tituloId: string;
    children: React.ReactNode;
}> = ({ tono = 'lima', tituloId, children }) => (
    <div className="noc-hoja-fondo">
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={tituloId}
            className={`noc-hoja${tono === 'negro' ? ' noc-sobre-negro' : ''}`}
            style={{
                background: tono === 'negro' ? NEGRO : LIMA,
                color: tono === 'negro' ? LIMA : NEGRO,
                boxShadow: anillo(2.5),
            }}
        >
            {children}
        </div>
    </div>
);

export default Hoja;

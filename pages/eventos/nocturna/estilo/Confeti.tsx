import React from 'react';
import { LIMA, NEGRO } from './tokens';

/**
 * Confeti al llegar a la entrada.
 *
 * Tres condiciones, y las tres están resueltas acá y no en la buena voluntad
 * de quien lo use:
 *
 *  · Liviano: 26 piezas, sólo `transform` y `opacity`, una sola pasada de
 *    menos de 4 segundos. Al terminar quedan invisibles.
 *  · Con "reducir movimiento" no existe (`.noc-confeti`, ver animaciones.ts).
 *  · NUNCA tapa el QR. Cae DETRÁS de la entrada: la capa va por debajo
 *    (z-index 0) y la entrada es opaca. El QR se puede escanear y capturar
 *    limpio desde el primer cuadro, y no hay que esperar a que termine.
 *
 * Va adentro del contenido de la pantalla 8 y recorta a ese alto.
 */
const PIEZAS = Array.from({ length: 26 }, (_, i) => ({
    x: (i * 37) % 100,
    ancho: 8 + (i % 4) * 4,
    alto: 14 + (i % 3) * 8,
    redonda: i % 3 === 0,
    color: i % 2 ? NEGRO : LIMA,
    dx: ((i % 5) - 2) * 40,
    dura: 1.8 + (i % 5) * 0.35,
    demora: (i % 7) * 90,
}));

const Confeti: React.FC = () => (
    <div className="noc-confeti" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        {PIEZAS.map((p, i) => (
            <span
                key={i}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: `${p.x}%`,
                    width: p.ancho,
                    height: p.alto,
                    borderRadius: p.redonda ? 999 : 3,
                    background: p.color,
                    transform: 'translate3d(0,-60px,0)',
                    animation: `nocConfeti ${p.dura}s cubic-bezier(.3,.6,.4,1) ${p.demora}ms 1 forwards`,
                    ['--dx' as string]: `${p.dx}px`,
                    ['--caida' as string]: '720px',
                } as React.CSSProperties}
            />
        ))}
    </div>
);

export default Confeti;

import React, { useEffect, useState } from 'react';
import { NocturnaConfig } from '../../../types';
import { plata } from './compartido/formulario';
import { Corchetes, LIMA, NEGRO, arch } from './estilo';

/**
 * El cartel de la promo, arriba de todo en el inicio de la inscripción.
 *
 * Es un talón negro, como "Total a transferir": la misma pieza que en la app
 * dice plata. Lo que se destaca es el sticker lima torcido con la edad
 * —la condición es lo primero que hay que leer— y el precio grande. La línea
 * punteada es el troquel de la entrada; abajo, hasta cuándo, con la cuenta
 * regresiva, y lo que pasa después.
 *
 * Se va solo cuando termina la promo (también si la página quedó abierta).
 */

/** "Quedan 1 día y 13 h" · "Quedan 5 h y 20 min" · "Quedan 42 min". */
const queda = (ms: number): string => {
    const min = Math.max(0, Math.floor(ms / 60000));
    const dias = Math.floor(min / 1440);
    const horas = Math.floor((min % 1440) / 60);
    const minutos = min % 60;
    if (dias > 0) return `Quedan ${dias} ${dias === 1 ? 'día' : 'días'}${horas ? ` y ${horas} h` : ''}`;
    if (horas > 0) return `Quedan ${horas} h${minutos ? ` y ${minutos} min` : ''}`;
    return minutos > 0 ? `Quedan ${minutos} min` : 'Termina ya';
};

/** "lunes 26" a partir del instante en que termina (se muestra el día anterior a las 00:00). */
const ultimoDia = (hasta: string): string => {
    const fin = new Date(Date.parse(hasta) - 60000);
    return fin.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
};

const CartelPromo: React.FC<{ config: NocturnaConfig | null }> = ({ config }) => {
    const [ahora, setAhora] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setAhora(Date.now()), 30000);
        return () => window.clearInterval(id);
    }, []);
    const [quieto] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

    const promo = config?.promo;
    if (!promo || ahora >= Date.parse(promo.hasta)) return null;

    const general = config?.precioEntrada ?? 0;
    const proximo = config?.proximo;
    const dia = ultimoDia(promo.hasta);

    return (
        <section
            aria-label={`Promoción: ${plata(promo.precio)} para quienes tengan ${promo.edad} años, hasta el ${dia} a las 23:59`}
            style={{ marginTop: 22, background: NEGRO, color: LIMA, borderRadius: 30, padding: '22px 20px 18px', position: 'relative' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span
                    style={{
                        display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 14px', borderRadius: 999,
                        background: LIMA, color: NEGRO, ...arch(900, '13px'), letterSpacing: '-.01em', textTransform: 'uppercase',
                        transform: 'rotate(-4deg)',
                        animation: quieto ? 'none' : 'nocChasquido .6s cubic-bezier(.2,.8,.2,1) .2s both',
                    }}
                >
                    <Corchetes>Solo {promo.edad} años</Corchetes>
                </span>
                <span style={{ ...arch(800, '12px', '1.2'), letterSpacing: '.03em', textTransform: 'uppercase' }}>
                    Promo especial
                </span>
            </div>

            <p style={{ margin: '14px 0 0', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ ...arch(900, '46px', '1'), letterSpacing: '-.05em' }}>{plata(promo.precio)}</span>
                {general > promo.precio && (
                    <span style={{ ...arch(800, '17px'), letterSpacing: '-.02em', textDecoration: 'line-through', textDecorationThickness: 2 }}>
                        <span className="sr-only">en vez de </span>{plata(general)}
                    </span>
                )}
            </p>
            <p style={{ margin: '8px 0 0', ...arch(700, '15px', '1.4'), letterSpacing: '-.01em' }}>
                La entrada de quien tenga {promo.edad} años el viernes 30.
            </p>

            {/* El troquel de la entrada. */}
            <div aria-hidden="true" style={{ margin: '16px 0 14px', borderTop: `2px dashed ${LIMA}` }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ ...arch(900, '13px', '1.25'), letterSpacing: '-.01em', textTransform: 'uppercase' }}>
                    Hasta el {dia} // 23:59
                </span>
                <span
                    style={{
                        display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px', borderRadius: 999,
                        boxShadow: `inset 0 0 0 2px ${LIMA}`, ...arch(800, '12.5px'), whiteSpace: 'nowrap',
                    }}
                >
                    {queda(Date.parse(promo.hasta) - ahora)}
                </span>
            </div>

            {proximo && proximo.precio > general && (
                <p style={{ margin: '12px 0 0', ...arch(600, '13.5px', '1.45') }}>
                    Desde el {new Date(proximo.desde).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })}, la entrada pasa a {plata(proximo.precio)} para todos.
                </p>
            )}
        </section>
    );
};

export default CartelPromo;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BellOff } from 'lucide-react';
import { getMisPreferencias, mensajeDeMotivo, silenciar, type MotivoNotif, type Preferencia } from '../../services/notificaciones';
import TarjetaActivarPush from './TarjetaActivarPush';

/**
 * Lo que va adentro de la hoja "Preferencias" de /notificaciones: qué avisos
 * le suenan a la persona (sql/notif_preferencias.sql).
 *
 * Arriba, el estado de ESTE dispositivo (la misma TarjetaActivarPush de la
 * página). Abajo, una fila por alerta, agrupada por área, con un interruptor:
 * prendido = te suena; apagado = no te suena, pero el aviso sigue en la lista.
 * Vale para todos los dispositivos de la persona.
 *
 * El interruptor guarda solo y, si la base dice que no, vuelve a como estaba.
 * La lista la arma la base (notif_mis_preferencias): las que le llegaron, las
 * programadas que la incluyen y las que ya apagó; las no apagables no vienen.
 */

// Los tokens de la pantalla de Notificaciones (modo oscuro por la clase `dark`).
const TINTA = 'text-[#0a0a0a] dark:text-[#f4f4f2]';
const M66 = 'text-black/[0.68] dark:text-white/[0.68]';
const M50 = 'text-black/55 dark:text-white/55';
const SUPERFICIE = 'bg-[#f7f7f5] dark:bg-[#232321]';
const LINEA = 'border-black/[0.06] dark:border-white/[0.07]';
const FOCO = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-black/25 dark:focus-visible:ring-white/25';

type Carga =
    | { estado: 'cargando' }
    | { estado: 'error'; motivo: MotivoNotif }
    | { estado: 'listo'; alertas: Preferencia[] };

const Interruptor: React.FC<{ on: boolean }> = ({ on }) => (
    <span
        aria-hidden="true"
        className={`relative inline-flex h-[28px] w-[46px] flex-none items-center rounded-full transition-colors ${on ? 'bg-[#0a0a0a] dark:bg-white' : 'bg-black/[.18] dark:bg-white/[.22]'}`}
    >
        <span
            className={`absolute left-[3px] h-[22px] w-[22px] rounded-full shadow-[0_1px_2px_rgba(0,0,0,.25)] transition-transform motion-reduce:transition-none ${on ? 'bg-white dark:bg-[#0a0a0a]' : 'bg-white'}`}
            style={{ transform: on ? 'translateX(18px)' : 'none' }}
        />
    </span>
);

const PreferenciasDeAvisos: React.FC<{
    /** El aviso corto de la página (la píldora de abajo). */
    avisar: (texto: string) => void;
}> = ({ avisar }) => {
    const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
    const [guardando, setGuardando] = useState<Record<string, true>>({});
    // Si la hoja se cerró, la respuesta que llega tarde no toca nada. Se pone
    // en true adentro del efecto: StrictMode desmonta y vuelve a montar.
    const viva = useRef(true);
    useEffect(() => {
        viva.current = true;
        return () => { viva.current = false; };
    }, []);

    const cargar = useCallback(async () => {
        setCarga({ estado: 'cargando' });
        const r = await getMisPreferencias();
        if (!viva.current) return;
        setCarga(r.ok ? { estado: 'listo', alertas: r.alertas } : { estado: 'error', motivo: r.motivo ?? 'red' });
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const poner = (id: string, apagada: boolean) => setCarga(c => (c.estado === 'listo'
        ? { estado: 'listo', alertas: c.alertas.map(a => (a.id === id ? { ...a, apagada } : a)) }
        : c));

    const alternar = async (a: Preferencia) => {
        if (guardando[a.id]) return;
        const apagada = !a.apagada;
        poner(a.id, apagada);
        setGuardando(g => ({ ...g, [a.id]: true }));
        const r = await silenciar(a.id, apagada);
        if (!viva.current) return;
        setGuardando(g => { const c = { ...g }; delete c[a.id]; return c; });
        if (r.ok) {
            avisar(apagada ? `Listo: «${a.nombre}» ya no te suena` : `Listo: «${a.nombre}» te vuelve a sonar`);
        } else {
            poner(a.id, a.apagada);
            avisar(r.motivo === 'red' ? 'No se pudo guardar. Revisá la conexión.' : mensajeDeMotivo(r));
        }
    };

    // Agrupadas por área, en el orden en que las manda la base.
    const grupos = carga.estado === 'listo'
        ? carga.alertas.reduce<{ area: string; alertas: Preferencia[] }[]>((acc, a) => {
            const g = acc.find(x => x.area === a.area);
            if (g) g.alertas.push(a); else acc.push({ area: a.area, alertas: [a] });
            return acc;
        }, [])
        : [];

    return (
        <div className={`px-1 pb-1 ${TINTA}`}>
            <h2 className="m-0 px-1 text-[21px] font-semibold tracking-[-.02em]">Preferencias</h2>
            <p className={`m-0 mt-1 px-1 text-[13.5px] font-medium leading-[1.5] ${M66}`}>
                Qué avisos te suenan en el teléfono. Vale para todos tus dispositivos.
            </p>

            <div className="mt-4">
                <TarjetaActivarPush enPreferencias />
            </div>

            <p className={`m-0 mt-5 px-1 text-[14px] font-semibold leading-[1.5]`}>
                Si apagás un aviso, no te suena el teléfono, pero lo seguís viendo acá.
            </p>

            {carga.estado === 'cargando' && (
                <div aria-busy="true" aria-label="Cargando tus preferencias" className="mt-3 flex flex-col gap-2">
                    {[0, 1, 2].map(i => <div key={i} className={`h-[62px] rounded-[18px] ${SUPERFICIE} motion-safe:animate-pulse`} />)}
                </div>
            )}

            {carga.estado === 'error' && (
                <div role="alert" className={`mt-3 rounded-[18px] px-4 py-4 ${SUPERFICIE}`}>
                    <p className="m-0 text-[14.5px] font-semibold">
                        {carga.motivo === 'no_disponible'
                            ? 'Las preferencias todavía no están disponibles.'
                            : 'No pudimos traer tus preferencias.'}
                    </p>
                    <p className={`m-0 mt-1 text-[13px] font-medium leading-[1.5] ${M66}`}>
                        {carga.motivo === 'no_disponible'
                            ? 'Mientras tanto te llegan todos los avisos. Probá de nuevo más tarde.'
                            : mensajeDeMotivo({ motivo: carga.motivo })}
                    </p>
                    {carga.motivo !== 'no_disponible' && (
                        <button
                            type="button"
                            onClick={cargar}
                            className={`mt-3 h-11 rounded-full bg-[#0a0a0a] px-5 text-[14px] font-semibold text-white dark:bg-white dark:text-[#0a0a0a] ${FOCO}`}
                        >
                            Reintentar
                        </button>
                    )}
                </div>
            )}

            {carga.estado === 'listo' && grupos.length === 0 && (
                <div className={`mt-3 flex flex-col items-center rounded-[18px] px-5 py-7 text-center ${SUPERFICIE}`}>
                    <BellOff className={`h-6 w-6 ${M50}`} strokeWidth={1.8} aria-hidden="true" />
                    <p className="m-0 mt-2.5 text-[14.5px] font-semibold">Todavía no te llegó ningún aviso que puedas apagar.</p>
                </div>
            )}

            {grupos.map(g => (
                <section key={g.area} aria-label={g.area} className="mt-5">
                    <h3 className={`m-0 mb-1.5 px-1 text-[12px] font-semibold uppercase tracking-[0.07em] ${M50}`}>{g.area}</h3>
                    <div className={`overflow-hidden rounded-[20px] ${SUPERFICIE}`}>
                        {g.alertas.map((a, i) => (
                            <button
                                key={a.id}
                                type="button"
                                role="switch"
                                aria-checked={!a.apagada}
                                aria-busy={!!guardando[a.id]}
                                onClick={() => alternar(a)}
                                className={`flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left ${i ? `border-t ${LINEA}` : ''} ${FOCO}`}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className={`block text-[14.5px] font-semibold leading-[1.35] ${a.apagada ? M66 : ''}`}>{a.nombre}</span>
                                    <span className={`mt-0.5 block text-[12.5px] font-medium leading-[1.45] ${M50}`}>{a.descripcion}</span>
                                </span>
                                <Interruptor on={!a.apagada} />
                            </button>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
};

export default PreferenciasDeAvisos;

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { AppEvent } from '../../types';
import ModalCompartirQR from '../../components/modals/ModalCompartirQR';
import { QrCode, Trash2, Pencil, Plus, CalendarDays, Link2 } from 'lucide-react';
import {
    TarjetaDelPunto, CabeceraGrupo, ListaDeFilas, Fila,
    BotonCircular, BotonPrincipal, EstadoVacio,
} from '../../components/info-point/ListaDelPunto';

/**
 * La agenda de eventos.
 *
 * Lo que se pregunta acá es qué viene, así que lo próximo va arriba y en
 * orden de cercanía; lo que ya pasó queda abajo, del más reciente al más
 * viejo. Antes estaba todo junto y ordenado al revés, con el evento más
 * nuevo primero aunque hubiera sido el mes pasado.
 *
 * Cada fila abre con la fecha en bloque, como la hoja de un almanaque: es el
 * dato por el que se busca y el que ordena la lista.
 */

const ZONA_ARG = 'America/Argentina/Buenos_Aires';

/** El día de hoy en hora de acá, como 'YYYY-MM-DD'. */
const hoyArgentino = () => new Date().toLocaleDateString('en-CA', { timeZone: ZONA_ARG });

const diaYMes = (fecha: string) => {
    const d = new Date(`${fecha}T12:00:00`);
    if (Number.isNaN(d.getTime())) return { dia: '--', mes: '' };
    return {
        dia: d.toLocaleDateString('es-AR', { day: 'numeric' }),
        mes: d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', ''),
    };
};

const Events: React.FC = () => {
    const navigate = useNavigate();
    const { events, deleteEvent, showNotification } = useStore();
    const [qrModal, setQrModal] = useState<{ open: boolean; title: string; url: string; link: string }>({ open: false, title: '', url: '', link: '' });

    const { proximos, pasados } = useMemo(() => {
        const hoy = hoyArgentino();
        return {
            proximos: events.filter(e => e.date >= hoy).sort((a, b) => a.date.localeCompare(b.date)),
            pasados: events.filter(e => e.date < hoy).sort((a, b) => b.date.localeCompare(a.date)),
        };
    }, [events]);

    const borrar = async (ev: AppEvent, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm(`¿Eliminar el evento "${ev.name}"? No se puede deshacer.`)) return;
        await deleteEvent(ev.id);
        showNotification('Evento eliminado.');
    };

    // El QR viejo lo generaba otro servicio que ya no responde: se reconstruye
    // con el texto que tenía adentro.
    const urlDelQr = (url: string | undefined, nombre: string, link: string | undefined) => {
        const texto = link || nombre || 'https://origen.church';
        const porDefecto = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(texto)}`;
        if (!url) return porDefecto;
        if (url.includes('quickchart.io')) {
            const m = url.match(/[?&]text=([^&]+)/);
            return m && m[1] ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${m[1]}` : porDefecto;
        }
        return url;
    };

    const filaDeEvento = (ev: AppEvent, pasado: boolean) => {
        const { dia, mes } = diaYMes(ev.date);
        return (
            <Fila key={ev.id}>
                <span className={`shrink-0 w-11 h-11 rounded-xl flex flex-col items-center justify-center leading-none ${pasado ? 'bg-slate-50 text-slate-400' : 'bg-slate-100 text-black'}`}>
                    <span className="text-base font-bold tabular-nums">{dia}</span>
                    <span className="text-[10px] font-medium text-slate-400 mt-0.5">{mes}</span>
                </span>

                <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-[15px] text-black leading-tight line-clamp-2">{ev.name}</h4>
                    <p className="flex items-center gap-1.5 text-[13px] text-slate-400 truncate mt-0.5">
                        {(ev.startTime || ev.endTime) && (
                            <span className="tabular-nums">{ev.startTime || '--:--'}{ev.endTime ? ` a ${ev.endTime}` : ''}</span>
                        )}
                        {ev.link && <Link2 className="w-3.5 h-3.5 shrink-0" aria-label="Tiene link" />}
                        {!ev.startTime && !ev.endTime && !ev.link && ev.location && <span className="truncate">{ev.location}</span>}
                    </p>
                </div>

                <BotonCircular
                    icono={QrCode}
                    etiqueta={`Ver el código QR de ${ev.name}`}
                    onClick={() => setQrModal({ open: true, title: ev.name, url: urlDelQr(ev.qrCodeUrl, ev.name, ev.link), link: ev.link || window.location.href })}
                />
                <BotonCircular
                    icono={Pencil}
                    etiqueta={`Editar ${ev.name}`}
                    onClick={() => navigate(`/punto-de-informacion/eventos/nuevo?id=${ev.id}`)}
                />
                <BotonCircular
                    icono={Trash2}
                    tono="peligro"
                    etiqueta={`Eliminar ${ev.name}`}
                    onClick={e => borrar(ev, e)}
                />
            </Fila>
        );
    };

    return (
        <>
            <ModalCompartirQR
                isOpen={qrModal.open}
                onClose={() => setQrModal({ ...qrModal, open: false })}
                title={qrModal.title}
                qrUrl={qrModal.url}
                link={qrModal.link}
            />

            <TarjetaDelPunto
                titulo="Eventos"
                bajada="Lo que viene, y lo que ya pasó."
                acciones={
                    <BotonPrincipal icono={Plus} onClick={() => navigate('/punto-de-informacion/eventos/nuevo')}>
                        Crear evento
                    </BotonPrincipal>
                }
            >
                {proximos.length > 0 && (
                    <section>
                        <CabeceraGrupo cuenta={`${proximos.length} en agenda`}>Próximos</CabeceraGrupo>
                        <ListaDeFilas>{proximos.map(ev => filaDeEvento(ev, false))}</ListaDeFilas>
                    </section>
                )}

                {pasados.length > 0 && (
                    <section>
                        <CabeceraGrupo cuenta={`${pasados.length} en total`}>Ya pasaron</CabeceraGrupo>
                        <ListaDeFilas>{pasados.map(ev => filaDeEvento(ev, true))}</ListaDeFilas>
                    </section>
                )}

                {events.length === 0 && (
                    <EstadoVacio
                        icono={CalendarDays}
                        titulo="No hay eventos cargados"
                        texto="Creá el primero y la gente va a poder verlo desde la app y desde su QR."
                        accion={{ texto: 'Crear el primero', icono: Plus, onClick: () => navigate('/punto-de-informacion/eventos/nuevo') }}
                    />
                )}
            </TarjetaDelPunto>
        </>
    );
};

export default Events;

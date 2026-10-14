import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { Announcement } from '../../types';
import { Megaphone, Plus, Pencil, Trash2, QrCode } from 'lucide-react';
import ModalCompartirQR from '../../components/modals/ModalCompartirQR';
import {
    TarjetaDelPunto, CabeceraGrupo, ListaDeFilas, Fila,
    BotonCircular, BotonPrincipal, Pastilla, EstadoVacio, fechaCorta,
} from '../../components/info-point/ListaDelPunto';

/**
 * Los anuncios.
 *
 * La pregunta es qué se está mostrando ahora, así que la lista se parte en
 * dos: publicados y pausados. La cápsula de estado es también el interruptor
 * —se toca y el anuncio cambia de grupo—, que es la forma más corta de ver
 * qué pasó.
 *
 * Antes eran dos pantallas: una tabla de cinco columnas en la compu y, en el
 * teléfono, tarjetas con tres botones de texto cada una.
 */
const Announcements: React.FC = () => {
    const navigate = useNavigate();
    const { announcements, updateAnnouncement, deleteAnnouncement } = useStore();
    const [qrModal, setQrModal] = useState<{ open: boolean; title: string; url: string; link: string }>({ open: false, title: '', url: '', link: '' });
    const [aBorrar, setABorrar] = useState<Announcement | null>(null);

    const estaPublicado = (a: Announcement) => a.isActive !== false;

    const { publicados, pausados } = useMemo(() => ({
        publicados: announcements.filter(estaPublicado),
        pausados: announcements.filter(a => !estaPublicado(a)),
    }), [announcements]);

    // El QR viejo lo generaba otro servicio que ya no responde: se reconstruye
    // con el texto que tenía adentro.
    const urlDelQr = (url: string | undefined, titulo: string, link: string | undefined) => {
        const texto = link || titulo || 'https://origen.church';
        const porDefecto = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(texto)}`;
        if (!url) return porDefecto;
        if (url.includes('quickchart.io')) {
            const m = url.match(/[?&]text=([^&]+)/);
            return m && m[1] ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${m[1]}` : porDefecto;
        }
        return url;
    };

    const cuandoSeMuestra = (a: Announcement) => {
        if (a.isPermanent) return 'Siempre visible';
        const desde = fechaCorta(a.startDate);
        const hasta = fechaCorta(a.endDate);
        if (desde && hasta) return `Del ${desde} al ${hasta}`;
        if (desde) return `Desde el ${desde}`;
        if (hasta) return `Hasta el ${hasta}`;
        return 'Sin fechas';
    };

    const fila = (a: Announcement) => (
        <Fila key={a.id}>
            <div className="min-w-0 flex-1">
                <h4 className="font-semibold text-[15px] text-black leading-tight line-clamp-2">{a.title}</h4>
                <div className="flex items-center gap-2 mt-1">
                    {/* La cápsula dice el estado y además lo cambia. */}
                    <Pastilla
                        tono={estaPublicado(a) ? 'buena' : 'neutra'}
                        etiqueta={estaPublicado(a) ? `Pausar ${a.title}` : `Publicar ${a.title}`}
                        onClick={() => updateAnnouncement({ ...a, isActive: !estaPublicado(a) })}
                    >
                        {estaPublicado(a) ? 'Publicado' : 'Pausado'}
                    </Pastilla>
                    <span className="text-[13px] text-slate-400 truncate">{cuandoSeMuestra(a)}</span>
                </div>
            </div>

            {a.qrCodeUrl && (
                <BotonCircular
                    icono={QrCode}
                    etiqueta={`Ver el código QR de ${a.title}`}
                    onClick={() => setQrModal({ open: true, title: a.title, url: urlDelQr(a.qrCodeUrl, a.title, a.link), link: a.link || window.location.href })}
                />
            )}
            <BotonCircular
                icono={Pencil}
                etiqueta={`Editar ${a.title}`}
                onClick={() => navigate(`/punto-de-informacion/anuncios/nuevo?id=${a.id}`)}
            />
            <BotonCircular
                icono={Trash2}
                tono="peligro"
                etiqueta={`Eliminar ${a.title}`}
                onClick={() => setABorrar(a)}
            />
        </Fila>
    );

    return (
        <>
            <ModalCompartirQR
                isOpen={qrModal.open}
                onClose={() => setQrModal({ ...qrModal, open: false })}
                title={qrModal.title}
                qrUrl={qrModal.url}
                link={qrModal.link}
            />

            {aBorrar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
                        <h2 className="text-lg font-bold tracking-tight text-black">Eliminar el anuncio</h2>
                        <p className="text-sm text-slate-500 leading-relaxed mt-1.5 mb-6">
                            «{aBorrar.title}» se va a borrar para siempre. Si sólo querés dejar de mostrarlo, pausalo.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setABorrar(null)}
                                className="flex-1 py-3.5 bg-slate-100 text-black rounded-full font-semibold text-sm hover:bg-slate-200 active:scale-[0.99] transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => { deleteAnnouncement(aBorrar.id); setABorrar(null); }}
                                className="flex-1 py-3.5 bg-red-600 text-white rounded-full font-semibold text-sm hover:bg-red-700 active:scale-[0.99] transition-all"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <TarjetaDelPunto
                titulo="Anuncios"
                bajada="Lo que se está mostrando en la app, y lo que quedó guardado."
                acciones={
                    <BotonPrincipal icono={Plus} onClick={() => navigate('/punto-de-informacion/anuncios/nuevo')}>
                        Nuevo anuncio
                    </BotonPrincipal>
                }
            >
                {publicados.length > 0 && (
                    <section>
                        <CabeceraGrupo cuenta={`${publicados.length} a la vista`}>Publicados</CabeceraGrupo>
                        <ListaDeFilas>{publicados.map(fila)}</ListaDeFilas>
                    </section>
                )}

                {pausados.length > 0 && (
                    <section>
                        <CabeceraGrupo cuenta={`${pausados.length} en total`}>Pausados</CabeceraGrupo>
                        <ListaDeFilas>{pausados.map(fila)}</ListaDeFilas>
                    </section>
                )}

                {announcements.length === 0 && (
                    <EstadoVacio
                        icono={Megaphone}
                        titulo="Todavía no hay anuncios"
                        texto="Creá el primero y va a aparecer en la app de todos, con su QR para compartir."
                        accion={{ texto: 'Crear el primero', icono: Plus, onClick: () => navigate('/punto-de-informacion/anuncios/nuevo') }}
                    />
                )}
            </TarjetaDelPunto>
        </>
    );
};

export default Announcements;

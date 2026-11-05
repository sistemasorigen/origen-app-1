import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';
import HojaGrupos from '../GCX/HojaGrupos';
import { useAudio } from '../../contexts/AudioContext';
import {
    EncabezadoDeRiel, EsqueletoDeRiel, ICONO_ABRE_AFUERA, ICONO_SIGUE_ACA, RielDeTarjetas, TarjetaDeOrigen,
} from './SeccionDeEnlaces';
import {
    abrirLinkOArchivo, esLinkExterno, etiquetaDeRecurso, getRecursosPublicos, idDeEpisodio, idDeVideo,
    linkParaCompartir, urlEmbebidaDeEpisodio, urlEmbebidaDeVideo,
    type Recurso,
} from '../../services/recursos';

/**
 * "Recursos Origen": el material de Origen y los podcasts de los pastores, en
 * el lugar donde estaba "Origen en Youvers".
 *
 * Se ve igual que Enlaces Origen porque ES lo mismo: la tarjeta y el riel son
 * los de SeccionDeEnlaces.tsx. Lo único distinto es que acá la tarjeta no abre
 * nada: abre "Ir al enlace".
 *
 * Qué hace ese botón:
 *
 *   · link: como en Enlaces, afuera o dentro de la app;
 *   · archivo: lo abre en otra pestaña (en el teléfono, el visor del sistema);
 *   · video y podcast: la hoja del sistema, con el reproductor adentro.
 *
 * Va todo junto, material y podcasts, en un solo riel y en el orden que eligió
 * Sistemas. Si no hay recursos, o no se pudieron traer, el bloque no aparece.
 */

const ICONO_PLAY = <Play className="w-[15px] h-[15px]" strokeWidth={2.2} />;

const iconoDe = (r: Recurso): React.ReactNode => {
    if (r.tipo === 'video' || r.tipo === 'podcast') return ICONO_PLAY;
    if (r.tipo === 'archivo' || esLinkExterno(r)) return ICONO_ABRE_AFUERA;
    return ICONO_SIGUE_ACA;
};

/** Un recurso en la tarjeta de Enlaces. También la usa el panel como vista previa. */
export const TarjetaDeRecurso: React.FC<{
    recurso: Recurso;
    onAbrir: () => void;
    vistaPrevia?: boolean;
}> = ({ recurso, onAbrir, vistaPrevia = false }) => (
    <TarjetaDeOrigen
        contenido={recurso}
        etiqueta={etiquetaDeRecurso(recurso)}
        iconoIr={iconoDe(recurso)}
        linkParaCompartir={linkParaCompartir(recurso)}
        rotuloCompartir="COMPARTIR RECURSO"
        queAbreCompartir="el recurso"
        onAbrir={onAbrir}
        soloElBotonAbre
        vistaPrevia={vistaPrevia}
    />
);

// ── La hoja del reproductor ─────────────────────────────────────────────

/**
 * Corta Origen Música al abrir un reproductor, para que no suenen dos cosas a
 * la vez. Es un componente aparte y sin nada que mostrar porque el contexto de
 * audio cambia varias veces por segundo mientras suena: leerlo desde la sección
 * redibujaría el riel entero todo ese tiempo.
 */
const PausaLaMusica: React.FC = () => {
    const { isPlaying, togglePlay } = useAudio();
    const hecho = useRef(false);
    useEffect(() => {
        if (hecho.current) return;
        hecho.current = true;
        if (isPlaying) togglePlay();
        // Sólo al abrir: si después alguien la vuelve a prender, es decisión suya.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return null;
};

const ID_TITULO = 'recurso-reproductor-titulo';

/**
 * La hoja de compartir, con un reproductor adentro. Al cerrarse, el iframe se
 * desmonta y con eso se corta lo que estuviera sonando.
 *
 * El título va arriba y el reproductor debajo: la cruz de cerrar flota en la
 * esquina de la hoja y encima del reproductor taparía sus controles.
 */
const HojaDelReproductor: React.FC<{ recurso: Recurso | null; onCerrar: () => void }> = ({ recurso, onCerrar }) => {
    const idVideo = recurso?.tipo === 'video' ? idDeVideo(recurso.destino) : '';
    const idEpisodio = recurso?.tipo === 'podcast' ? idDeEpisodio(recurso.destino) : '';
    const datos = recurso?.tipo === 'podcast'
        ? [recurso.pastor, recurso.duracion].filter(Boolean).join(' · ')
        : '';

    return (
        <HojaGrupos abierta={!!recurso} onCerrar={onCerrar} etiquetadaPor={ID_TITULO} ancha={recurso?.tipo === 'video'}>
            {recurso && (
                <div className="flex flex-col">
                    <PausaLaMusica />
                    <h2 id={ID_TITULO} className="mt-0 mr-14 mb-0 text-[22px] leading-[1.2] font-semibold tracking-[-.02em] [overflow-wrap:anywhere]">
                        {recurso.titulo}
                    </h2>
                    {datos && (
                        <p className="mt-1.5 mb-0 text-[14.5px]" style={{ color: 'var(--g-m50)' }}>{datos}</p>
                    )}

                    {idVideo && (
                        <div className="mt-[18px] overflow-hidden rounded-[18px] bg-black" style={{ aspectRatio: '16 / 9' }}>
                            <iframe
                                data-reproductor="video"
                                src={urlEmbebidaDeVideo(idVideo)}
                                title={`Video: ${recurso.titulo}`}
                                className="block h-full w-full border-0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allowFullScreen
                            />
                        </div>
                    )}
                    {idEpisodio && (
                        <iframe
                            data-reproductor="podcast"
                            src={urlEmbebidaDeEpisodio(idEpisodio)}
                            title={`Podcast: ${recurso.titulo}`}
                            className="mt-[18px] block w-full rounded-[14px] border-0"
                            style={{ height: 232 }}
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        />
                    )}

                    <a
                        href={recurso.destino}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="gcx-hover-tinta mt-[18px] h-[54px] rounded-full text-[15.5px] font-semibold flex items-center justify-center gap-2.5 no-underline"
                        style={{ background: 'var(--g-ink)', color: 'var(--g-inv)' }}
                    >
                        {recurso.tipo === 'video' ? 'Ver en YouTube' : 'Abrir en Spotify'}
                        {ICONO_ABRE_AFUERA}
                    </a>
                </div>
            )}
        </HojaGrupos>
    );
};

// ── La sección ──────────────────────────────────────────────────────────

const SeccionDeRecursos: React.FC = () => {
    const navigate = useNavigate();
    const [recursos, setRecursos] = useState<Recurso[] | null>(null);
    const [cargando, setCargando] = useState(true);
    const [reproduciendo, setReproduciendo] = useState<Recurso | null>(null);

    useEffect(() => {
        getRecursosPublicos()
            .then(setRecursos)
            .catch(() => setRecursos(null))
            .finally(() => setCargando(false));
    }, []);

    if (cargando) return <EsqueletoDeRiel />;

    const lista = recursos || [];
    if (lista.length === 0) return null;

    const abrir = (r: Recurso) => {
        if (r.tipo === 'video' || r.tipo === 'podcast') setReproduciendo(r);
        else abrirLinkOArchivo(r, navigate);
    };

    return (
        <div className="lg:col-span-3">
            <EncabezadoDeRiel titulo="Recursos Origen" bajada="Material de Origen y los podcasts de nuestros pastores." />

            <RielDeTarjetas
                lista={lista}
                dibujar={r => <TarjetaDeRecurso recurso={r} onAbrir={() => abrir(r)} />}
                flechaAnterior="Recursos anteriores"
                flechaSiguiente="Más recursos"
            />

            <HojaDelReproductor recurso={reproduciendo} onCerrar={() => setReproduciendo(null)} />
        </div>
    );
};

export default SeccionDeRecursos;

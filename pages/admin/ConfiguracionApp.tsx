import React, { useEffect, useMemo, useState } from 'react';
import { AppConfig, BannerSlide, FooterLinks, MusicaBannerSlide, YouversBannerSlide } from '../../types';
import { MusicaBannerSlideInput } from '../../services/supabaseService';
import ImageUpload from '../../components/media/SubidaImagen';
import VideoUpload from '../../components/media/SubidaVideo';
import EncuadreMedia from '../../components/media/EncuadreMedia';
import { getMediaFrameStyle } from '../../components/ui/CarruselHero';
import { PedidoConfirmacion, Rotulo } from './piezasAdmin';

/**
 * Configuración de la app (design-claude/Admin General).
 *
 * Cuatro secciones: identidad, banners, música y pies. El editor de un slide
 * dejó de ser un modal y pasó a vivir al lado de la lista, como en el
 * diseño: se elige uno a la izquierda y se lo encuadra a la derecha, viendo
 * al mismo tiempo el recorte real y cómo va a quedar en la app.
 *
 * El carrusel del Punto de Información vuelve a estar accesible. La lógica
 * de guardado siempre lo contempló (config.infoPointConfig.banners), pero
 * hacía meses que no había ninguna pestaña que lo eligiera.
 */

export type SubSeccion = 'identidad' | 'banners' | 'musica' | 'pies';

const SUB_SECCIONES: { id: SubSeccion; label: string }[] = [
    { id: 'identidad', label: 'Identidad' },
    { id: 'banners', label: 'Banners' },
    { id: 'musica', label: 'Música' },
    { id: 'pies', label: 'Pies' },
];

const COLORES_RAPIDOS = ['#0a0a0a', '#1d4ed8', '#0b7a53', '#7a3ba8', '#b0431f'];

const safeUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try { return crypto.randomUUID(); } catch { /* contexto no seguro */ }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
};

interface Props {
    sub: SubSeccion;
    onSub: (s: SubSeccion) => void;
    config: AppConfig;
    onConfig: (c: AppConfig) => void;
    onGuardarConfig: (c: AppConfig) => Promise<void>;
    onGuardarPies: () => Promise<void>;
    pies: FooterLinks;
    onPies: (p: FooterLinks) => void;
    musicaSlides: MusicaBannerSlide[];
    onGuardarMusica: (input: MusicaBannerSlideInput, id?: string) => Promise<boolean>;
    onBorrarMusica: (id: string) => Promise<void>;
    guardandoMusica: boolean;
    pedirConfirmacion: (p: PedidoConfirmacion) => void;
}

const ConfiguracionApp: React.FC<Props> = ({
    sub, onSub, config, onConfig, onGuardarConfig, onGuardarPies, pies, onPies,
    musicaSlides, onGuardarMusica, onBorrarMusica, guardandoMusica, pedirConfirmacion,
}) => (
    <>
        <div className="-mx-3.5 flex gap-[7px] overflow-x-auto px-3.5 pb-0.5 md:mx-0 md:px-0">
            {SUB_SECCIONES.map(s => (
                <button
                    key={s.id}
                    onClick={() => onSub(s.id)}
                    aria-current={sub === s.id ? 'page' : undefined}
                    className={`h-[38px] flex-none whitespace-nowrap rounded-full px-4 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${sub === s.id ? 'bg-[#0a0a0a] text-white' : 'bg-[#eceae6] text-black/[.62] hover:text-[#0a0a0a]'}`}
                >
                    {s.label}
                </button>
            ))}
        </div>

        {sub === 'identidad' && (
            <Identidad config={config} onConfig={onConfig} onGuardar={onGuardarConfig} />
        )}
        {sub === 'banners' && (
            <Banners config={config} onConfig={onConfig} onGuardar={onGuardarConfig} pedirConfirmacion={pedirConfirmacion} />
        )}
        {sub === 'musica' && (
            <Musica
                slides={musicaSlides}
                onGuardar={onGuardarMusica}
                onBorrar={onBorrarMusica}
                guardando={guardandoMusica}
                pedirConfirmacion={pedirConfirmacion}
            />
        )}
        {sub === 'pies' && (
            <Pies pies={pies} onPies={onPies} onGuardar={onGuardarPies} />
        )}
    </>
);

// ── Identidad ─────────────────────────

const Identidad: React.FC<{
    config: AppConfig;
    onConfig: (c: AppConfig) => void;
    onGuardar: (c: AppConfig) => Promise<void>;
}> = ({ config, onConfig, onGuardar }) => {
    const [guardando, setGuardando] = useState(false);

    const guardar = async () => {
        setGuardando(true);
        await onGuardar(config);
        setGuardando(false);
    };

    return (
        <div className="mt-3.5 grid gap-3.5 [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="min-w-0 rounded-[20px] bg-white px-[22px] py-5">
                <p className="text-[15px] font-semibold text-[#0a0a0a]">Identidad de la app</p>
                <p className="mt-1.5 text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                    Se ve en todas las pantallas, para todos los que usan la app.
                </p>

                <div className="mt-[18px]">
                    <Rotulo className="mb-1.5 text-black/[.55]">Nombre de la app</Rotulo>
                    <input
                        type="text"
                        value={config.appName || ''}
                        onChange={e => onConfig({ ...config, appName: e.target.value })}
                        className="h-12 w-full rounded-[16px] px-4 text-[14px] font-semibold text-[#0a0a0a]"
                    />
                </div>

                <div className="mt-3.5">
                    <Rotulo className="mb-1.5 text-black/[.55]">Slogan</Rotulo>
                    <input
                        type="text"
                        value={config.appSlogan || ''}
                        onChange={e => onConfig({ ...config, appSlogan: e.target.value })}
                        className="h-12 w-full rounded-[16px] px-4 text-[14px] font-medium text-[#0a0a0a]"
                    />
                </div>

                <div className="mt-3.5">
                    <Rotulo className="mb-1.5 text-black/[.55]">Color de marca</Rotulo>
                    <div className="flex flex-wrap items-center gap-2">
                        {COLORES_RAPIDOS.map(c => (
                            <button
                                key={c}
                                onClick={() => onConfig({ ...config, brandColor: c })}
                                aria-label={`Usar el color ${c}`}
                                aria-pressed={config.brandColor?.toLowerCase() === c}
                                className="h-[42px] w-[42px] rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                style={{
                                    background: c,
                                    boxShadow: config.brandColor?.toLowerCase() === c
                                        ? 'inset 0 0 0 2.5px #fff, 0 0 0 2px #0a0a0a'
                                        : 'none',
                                }}
                            />
                        ))}
                        {/* El selector nativo queda: la marca no siempre es uno de
                            los cinco de arriba y antes se podía elegir cualquiera. */}
                        <label className="flex h-[42px] items-center gap-2.5 rounded-[14px] bg-[#f7f7f5] px-3">
                            <input
                                type="color"
                                value={config.brandColor || '#0a0a0a'}
                                onChange={e => onConfig({ ...config, brandColor: e.target.value })}
                                aria-label="Elegir otro color de marca"
                                className="h-[26px] w-[26px] cursor-pointer"
                            />
                            <span className="text-[12px] font-semibold uppercase text-black/[.6]">
                                {config.brandColor || '#0a0a0a'}
                            </span>
                        </label>
                    </div>
                </div>

                <div className="mt-4">
                    <Rotulo className="mb-1.5 text-black/[.55]">Logo</Rotulo>
                    <ImageUpload
                        currentImage={config.logoUrl || ''}
                        folder="branding"
                        onImageUpload={url => onConfig({ ...config, logoUrl: url })}
                        aspectRatio="square"
                        className="caja-portada"
                    />
                </div>

                <button
                    onClick={guardar}
                    disabled={guardando}
                    className="mt-5 h-12 rounded-full bg-[#0a0a0a] px-5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    {guardando ? 'Guardando…' : 'Guardar la identidad'}
                </button>
            </div>

            <div className="min-w-0 rounded-[20px] bg-white px-[22px] py-5">
                <p className="text-[15px] font-semibold text-[#0a0a0a]">Cómo se ve</p>
                <p className="mt-1.5 text-[12.5px] font-medium text-black/[.62]">
                    Vista previa del encabezado en un celular.
                </p>
                <div className="mt-[18px] rounded-[22px] bg-[#f7f7f5] px-4 pb-[26px] pt-[18px]">
                    <div className="flex items-center gap-[11px]">
                        <div
                            className="h-[38px] w-[38px] flex-none overflow-hidden rounded-xl"
                            style={{ background: config.brandColor || '#0a0a0a' }}
                        >
                            {config.logoUrl && (
                                <img src={config.logoUrl} alt="" className="h-full w-full object-cover" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold text-[#0a0a0a]">
                                {config.appName || 'Sin nombre'}
                            </p>
                            <p className="mt-[2px] truncate text-[11.5px] font-medium text-black/[.6]">
                                {config.appSlogan || 'Sin slogan'}
                            </p>
                        </div>
                    </div>
                    <div
                        className="mt-5 flex h-12 w-full items-center justify-center rounded-full text-[14px] font-semibold text-white"
                        style={{ background: config.brandColor || '#0a0a0a' }}
                    >
                        Unirme a un grupo
                    </div>
                    <div className="mt-2.5 flex h-12 w-full items-center justify-center rounded-full bg-[#eceae6] text-[14px] font-semibold text-[#0a0a0a]">
                        Ver el calendario
                    </div>
                </div>
                <p className="mt-4 text-[12px] font-medium leading-[1.55] text-black/[.6]">
                    El color de marca se aplica al botón principal de cada pantalla. El negro del sistema no cambia.
                </p>
            </div>
        </div>
    );
};

// ── Banners ───────────────────────────

type Carrusel = 'home' | 'punto' | 'youvers';

const OPCIONES_CARRUSEL: [Carrusel, string][] = [
    ['home', 'Home'],
    ['punto', 'Punto de Información'],
    ['youvers', 'Youvers'],
];

/**
 * Elige qué carrusel se está editando.
 *
 * Vive aparte porque los tres destinos ya no comparten editor: Youvers es de
 * una sola pieza (imagen + link) y no entra en el de slides completos, así
 * que el selector lo dibujan dos ramas distintas.
 *
 * La fila desborda en horizontal en vez de envolver: con tres píldoras —una
 * de ellas "Punto de Información"— en un teléfono angosto no entran, y
 * envolver deja la etiqueta "Carrusel" sola en su propio renglón. Es el mismo
 * recurso que usa la fila de subsecciones de arriba.
 */
const SelectorCarrusel: React.FC<{
    valor: Carrusel;
    onValor: (c: Carrusel) => void;
}> = ({ valor, onValor }) => (
    <div className="-mx-3.5 mt-3.5 flex items-center gap-2.5 overflow-x-auto px-3.5 pb-0.5 md:mx-0 md:px-0">
        <Rotulo className="flex-none text-black/[.55]">Carrusel</Rotulo>
        <div className="flex flex-none gap-[3px] rounded-full bg-[#eceae6] p-[3px]">
            {OPCIONES_CARRUSEL.map(([opcion, label]) => (
                <button
                    key={opcion}
                    onClick={() => onValor(opcion)}
                    aria-pressed={valor === opcion}
                    className={`h-8 whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] ${valor === opcion ? 'bg-[#0a0a0a] text-white' : 'text-black/[.62] hover:text-[#0a0a0a]'}`}
                >
                    {label}
                </button>
            ))}
        </div>
    </div>
);

const Banners: React.FC<{
    config: AppConfig;
    onConfig: (c: AppConfig) => void;
    onGuardar: (c: AppConfig) => Promise<void>;
    pedirConfirmacion: (p: PedidoConfirmacion) => void;
}> = ({ config, onConfig, onGuardar, pedirConfirmacion }) => {
    const [carrusel, setCarrusel] = useState<Carrusel>('home');
    const [editando, setEditando] = useState<Partial<BannerSlide> | null>(null);
    const [guardando, setGuardando] = useState(false);

    const slides = useMemo(
        () => (carrusel === 'home' ? (config.banner?.slides || []) : (config.infoPointConfig?.banners || [])),
        [carrusel, config]
    );

    useEffect(() => { setEditando(null); }, [carrusel]);

    const escribirSlides = async (lista: BannerSlide[]) => {
        const nuevo: AppConfig = carrusel === 'home'
            ? { ...config, banner: { ...config.banner, slides: lista } }
            : { ...config, infoPointConfig: { ...config.infoPointConfig, banners: lista } };
        onConfig(nuevo);
        await onGuardar(nuevo);
    };

    const publicar = async () => {
        if (!editando) return;
        setGuardando(true);

        // Si eligió video pero no cargó ninguno, el slide vuelve a imagen: un
        // slide marcado como video sin videoUrl se vería en negro.
        const mediaType: 'image' | 'video' =
            editando.mediaType === 'video' && editando.videoUrl ? 'video' : 'image';

        const slide: BannerSlide = {
            id: editando.id || safeUUID(),
            imageUrl: editando.imageUrl || '',
            mediaType,
            videoUrl: mediaType === 'video' ? editando.videoUrl : undefined,
            focalX: editando.focalX ?? 50,
            focalY: editando.focalY ?? 50,
            zoom: editando.zoom ?? 1,
            eyebrow: editando.eyebrow,
            titlePrefix: editando.titlePrefix,
            titleHighlight: editando.titleHighlight,
            description: editando.description,
            buttonText: editando.buttonText,
            buttonLink: editando.buttonLink,
            // Se preservan aunque el editor no los toque: son campos nuevos
            // del tipo y otros temas del carrusel ya los leen.
            title: editando.title,
            subtitle: editando.subtitle,
            overlayColor: editando.overlayColor || (carrusel === 'punto' ? 'bg-white/30 mix-blend-overlay' : undefined),
        };

        const lista = editando.id
            ? slides.map(s => (s.id === editando.id ? slide : s))
            : [...slides, slide];

        await escribirSlides(lista);
        setGuardando(false);
        setEditando(slide);
    };

    const borrar = (slide: BannerSlide) => {
        pedirConfirmacion({
            tipo: 'destructivo',
            titulo: '¿Borrar este slide?',
            texto: 'Desaparece del carrusel en cuanto confirmes. No se puede deshacer desde acá.',
            detalleTitulo: 'Qué se borra',
            detalle: `${slide.title || slide.titlePrefix || 'Slide sin título'} — ${carrusel === 'home' ? 'carrusel de la home' : 'carrusel del Punto de Información'}.`,
            etiquetaBoton: 'Sí, borrar el slide',
            onConfirmar: async () => {
                await escribirSlides(slides.filter(s => s.id !== slide.id));
                setEditando(null);
            },
        });
    };

    const anchoMarco = config.banner?.frameWidth || 1920;
    const altoMarco = config.banner?.frameHeight || 720;

    if (carrusel === 'youvers') {
        return (
            <>
                <SelectorCarrusel valor={carrusel} onValor={setCarrusel} />
                <Youvers
                    config={config}
                    onConfig={onConfig}
                    onGuardar={onGuardar}
                    pedirConfirmacion={pedirConfirmacion}
                />
            </>
        );
    }

    return (
        <>
            <SelectorCarrusel valor={carrusel} onValor={setCarrusel} />

            <div className="mt-3 grid gap-3.5 [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1fr)_minmax(0,1.3fr)]">

                {/* Lista + medidas del marco */}
                <div className="flex min-w-0 flex-col gap-3.5">
                    <div className="rounded-[20px] bg-white px-5 py-[18px]">
                        <div className="flex items-center gap-3">
                            <p className="min-w-0 flex-1 text-[15px] font-semibold text-[#0a0a0a]">
                                {carrusel === 'home' ? 'Slides de la home' : 'Slides del Punto'} · {slides.length}
                            </p>
                            <button
                                onClick={() => setEditando({ mediaType: 'image', imageUrl: '', titlePrefix: '', titleHighlight: '', description: '' })}
                                className="h-[38px] flex-none rounded-full bg-[#0a0a0a] px-[15px] text-[12.5px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                Nuevo slide
                            </button>
                        </div>

                        <div className="mt-4 flex flex-col gap-2">
                            {slides.length === 0 ? (
                                <p className="py-8 text-center text-[13px] font-medium text-black/[.6]">
                                    Este carrusel todavía no tiene slides.
                                </p>
                            ) : slides.map((s, i) => {
                                const elegido = editando?.id === s.id;
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => setEditando(s)}
                                        className={`flex w-full items-center gap-[11px] rounded-[16px] px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${elegido ? 'bg-[#0a0a0a]/10' : 'bg-[#f7f7f5]'}`}
                                    >
                                        <span className="h-9 w-[52px] flex-none overflow-hidden rounded-[9px] bg-[#e6e4e0]">
                                            {s.imageUrl && <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[13.5px] font-semibold text-[#0a0a0a]">
                                                {s.title || s.titlePrefix || s.eyebrow || 'Slide sin título'}
                                            </span>
                                            <span className="mt-[3px] block truncate text-[11.5px] font-medium text-black/[.6]">
                                                {s.mediaType === 'video' ? 'Video' : 'Imagen'}
                                                {s.titleHighlight ? ` · ${s.titleHighlight}` : ''}
                                            </span>
                                        </span>
                                        <span className="flex h-[22px] min-w-[22px] flex-none items-center justify-center rounded-full bg-white text-[11px] font-semibold text-black/[.6]">
                                            {i + 1}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Medidas del marco — globales, no por slide: todos los slides
                        comparten el mismo carrusel, y alturas distintas harían
                        saltar la página en cada transición. */}
                    <div className="rounded-[20px] bg-white px-5 py-[18px]">
                        <p className="text-[15px] font-semibold text-[#0a0a0a]">Proporción del banner</p>
                        <p className="mt-1.5 text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                            El banner se adapta al ancho de la pantalla; estas medidas fijan la forma, no el tamaño.
                        </p>
                        <div className="mt-4 flex flex-wrap items-end gap-2.5">
                            <label className="block">
                                <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-black/[.55]">Ancho</span>
                                <input
                                    type="number" min={320}
                                    value={anchoMarco}
                                    onChange={e => onConfig({ ...config, banner: { ...config.banner, frameWidth: Number(e.target.value) } })}
                                    className="h-11 w-24 rounded-[14px] px-3 text-[13.5px] font-semibold tabular-nums text-[#0a0a0a]"
                                />
                            </label>
                            <span className="pb-3.5 text-[13px] font-semibold text-black/[.4]">×</span>
                            <label className="block">
                                <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.07em] text-black/[.55]">Alto</span>
                                <input
                                    type="number" min={120}
                                    value={altoMarco}
                                    onChange={e => onConfig({ ...config, banner: { ...config.banner, frameHeight: Number(e.target.value) } })}
                                    className="h-11 w-24 rounded-[14px] px-3 text-[13.5px] font-semibold tabular-nums text-[#0a0a0a]"
                                />
                            </label>
                            <div className="flex flex-wrap gap-1.5 pb-0.5">
                                {([[1920, 1080, '16:9'], [1920, 720, '8:3'], [1920, 640, '3:1']] as const).map(([w, h, label]) => (
                                    <button
                                        key={label}
                                        onClick={() => onConfig({ ...config, banner: { ...config.banner, frameWidth: w, frameHeight: h } })}
                                        className={`h-11 rounded-full px-3.5 text-[12.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${anchoMarco === w && altoMarco === h ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.62]'}`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => onGuardar(config)}
                                className="h-11 rounded-full bg-[#0a0a0a] px-4 text-[12.5px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                Guardar la proporción
                            </button>
                        </div>
                        <p className="mt-3 rounded-[14px] bg-[#fdf6ea] px-3.5 py-2.5 text-[12px] font-medium leading-[1.5] text-[#7a4f10]">
                            Cuanto más panorámico, más se recorta en el teléfono. Revisá el encuadre de cada slide
                            después de cambiarlo.
                        </p>
                    </div>
                </div>

                {/* Editor */}
                <div className="min-w-0 rounded-[20px] bg-white px-5 py-[18px]">
                    {!editando ? (
                        <div className="flex flex-col items-center py-14 text-center">
                            <p className="text-[15px] font-semibold text-[#0a0a0a]">Elegí un slide para editarlo</p>
                            <p className="mt-2 max-w-[320px] text-[13px] font-medium leading-[1.6] text-black/[.62]">
                                O creá uno nuevo. Vas a poder mover el punto focal y el zoom, y ver el recorte real
                                antes de publicarlo.
                            </p>
                        </div>
                    ) : (
                        <>
                            <p className="text-[15px] font-semibold text-[#0a0a0a]">
                                {editando.id ? 'Editar el slide' : 'Nuevo slide'}
                            </p>
                            <p className="mt-1.5 text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                                Movés el punto focal y el zoom sobre la imagen; la vista previa muestra el recorte real.
                            </p>

                            <div className="mt-4">
                                <Rotulo className="mb-2 text-black/[.55]">Tipo de medio</Rotulo>
                                <div className="flex gap-2">
                                    {([['image', 'Imagen'], ['video', 'Video']] as const).map(([valor, label]) => {
                                        const on = (editando.mediaType || 'image') === valor;
                                        return (
                                            <button
                                                key={valor}
                                                onClick={() => setEditando({ ...editando, mediaType: valor })}
                                                aria-pressed={on}
                                                className={`h-10 rounded-full px-4 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${on ? 'bg-[#0a0a0a] text-white' : 'bg-[#f7f7f5] text-black/[.66]'}`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="mt-4">
                                <Rotulo className="mb-2 text-black/[.55]">
                                    {editando.mediaType === 'video' ? 'Portada del video (opcional)' : 'Imagen del slide'}
                                </Rotulo>
                                {editando.mediaType === 'video' && (
                                    <p className="mb-2 text-[11.5px] font-medium leading-[1.5] text-black/[.6]">
                                        Se ve mientras carga el video y en los dispositivos que no lo reproducen. Sin
                                        portada, el respaldo es pantalla negra.
                                    </p>
                                )}
                                <ImageUpload
                                    currentImage={editando.imageUrl || ''}
                                    folder="banners"
                                    onImageUpload={url => setEditando({ ...editando, imageUrl: url })}
                                    aspectRatio="wide"
                                    className="caja-portada"
                                />
                            </div>

                            {editando.mediaType === 'video' && (
                                <div className="mt-4">
                                    <Rotulo className="mb-2 text-black/[.55]">Video del slide</Rotulo>
                                    <VideoUpload
                                        currentVideo={editando.videoUrl || ''}
                                        folder="banners"
                                        onVideoUpload={url => setEditando({ ...editando, videoUrl: url })}
                                        className="caja-portada"
                                    />
                                    <p className="mt-2 text-[11.5px] font-medium leading-[1.5] text-black/[.6]">
                                        Se reproduce solo, sin sonido y en bucle. El visitante no puede pausarlo.
                                    </p>
                                </div>
                            )}

                            <div className="mt-4">
                                <Rotulo className="mb-2 text-black/[.55]">Encuadre</Rotulo>
                                <EncuadreMedia
                                    mediaType={editando.mediaType}
                                    imageUrl={editando.imageUrl}
                                    videoUrl={editando.videoUrl}
                                    frameWidth={anchoMarco}
                                    frameHeight={altoMarco}
                                    value={{
                                        focalX: editando.focalX ?? 50,
                                        focalY: editando.focalY ?? 50,
                                        zoom: editando.zoom ?? 1,
                                    }}
                                    onChange={frame => setEditando({ ...editando, ...frame })}
                                />
                            </div>

                            <div className="mt-4">
                                <Rotulo className="mb-1.5 text-black/[.55]">Etiqueta superior</Rotulo>
                                <input
                                    type="text" value={editando.eyebrow || ''}
                                    onChange={e => setEditando({ ...editando, eyebrow: e.target.value })}
                                    placeholder="¡Qué bueno que estés en casa!"
                                    className="h-[46px] w-full rounded-[16px] px-4 text-[13.5px] font-medium text-[#0a0a0a]"
                                />
                            </div>

                            <div className="mt-3 grid gap-2.5 [grid-template-columns:minmax(0,1fr)] sm:[grid-template-columns:repeat(2,minmax(0,1fr))]">
                                <div>
                                    <Rotulo className="mb-1.5 text-black/[.55]">Texto principal</Rotulo>
                                    <input
                                        type="text" value={editando.titlePrefix || ''}
                                        onChange={e => setEditando({ ...editando, titlePrefix: e.target.value })}
                                        placeholder="PLATAFORMA"
                                        className="h-[46px] w-full rounded-[16px] px-4 text-[13.5px] font-semibold text-[#0a0a0a]"
                                    />
                                </div>
                                <div>
                                    <Rotulo className="mb-1.5 text-black/[.55]">Texto destacado</Rotulo>
                                    <input
                                        type="text" value={editando.titleHighlight || ''}
                                        onChange={e => setEditando({ ...editando, titleHighlight: e.target.value })}
                                        placeholder="ORIGEN"
                                        className="h-[46px] w-full rounded-[16px] px-4 text-[13.5px] font-semibold text-[#0a0a0a]"
                                    />
                                </div>
                            </div>

                            <div className="mt-3">
                                <Rotulo className="mb-1.5 text-black/[.55]">Descripción</Rotulo>
                                <textarea
                                    value={editando.description || ''}
                                    onChange={e => setEditando({ ...editando, description: e.target.value })}
                                    placeholder="Una línea que explique de qué se trata."
                                    className="h-24 w-full resize-none rounded-[16px] px-4 py-3 text-[13.5px] font-medium text-[#0a0a0a]"
                                />
                            </div>

                            <div className="mt-3 grid gap-2.5 [grid-template-columns:minmax(0,1fr)] sm:[grid-template-columns:repeat(2,minmax(0,1fr))]">
                                <div>
                                    <Rotulo className="mb-1.5 text-black/[.55]">Texto del botón</Rotulo>
                                    <input
                                        type="text" value={editando.buttonText || ''}
                                        onChange={e => setEditando({ ...editando, buttonText: e.target.value })}
                                        placeholder="Ver los módulos"
                                        className="h-[46px] w-full rounded-[16px] px-4 text-[13.5px] font-semibold text-[#0a0a0a]"
                                    />
                                </div>
                                <div>
                                    <Rotulo className="mb-1.5 text-black/[.55]">Destino del botón</Rotulo>
                                    <input
                                        type="text" value={editando.buttonLink || ''}
                                        onChange={e => setEditando({ ...editando, buttonLink: e.target.value })}
                                        placeholder="/eventos o https://…"
                                        className="h-[46px] w-full rounded-[16px] px-4 text-[13.5px] font-medium text-[#0a0a0a]"
                                    />
                                    {editando.buttonText && !editando.buttonLink && (
                                        <p className="mt-1.5 text-[11.5px] font-semibold text-[#7a4f10]">
                                            Sin destino, el botón no se muestra.
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Cómo va a quedar */}
                            <Rotulo className="mb-2 mt-5 text-black/[.55]">Así se va a ver en la app</Rotulo>
                            <div className="rounded-[20px] bg-[#f7f7f5] p-3">
                                <div
                                    className="relative overflow-hidden rounded-[16px] bg-[#e6e4e0]"
                                    style={{ aspectRatio: `${anchoMarco} / ${altoMarco}` }}
                                >
                                    {editando.imageUrl && (
                                        <img
                                            src={editando.imageUrl}
                                            alt=""
                                            className="absolute inset-0 h-full w-full object-cover"
                                            style={{
                                                objectPosition: `${editando.focalX ?? 50}% ${editando.focalY ?? 50}%`,
                                                transform: `scale(${editando.zoom ?? 1})`,
                                            }}
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[rgba(10,10,10,.72)] via-transparent to-transparent" />
                                    <div className="absolute inset-x-4 bottom-3.5">
                                        {editando.eyebrow && (
                                            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-white/75">
                                                {editando.eyebrow}
                                            </p>
                                        )}
                                        <p className="mt-1 text-[17px] font-semibold leading-[1.3] tracking-[-0.015em] text-white">
                                            {editando.titlePrefix || 'Título del slide'}{' '}
                                            {editando.titleHighlight && (
                                                <span className="text-white/70">{editando.titleHighlight}</span>
                                            )}
                                        </p>
                                        {editando.description && (
                                            <p className="mt-1.5 line-clamp-2 text-[12.5px] font-medium text-white/[.82]">
                                                {editando.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    onClick={publicar}
                                    disabled={guardando}
                                    className="h-12 rounded-full bg-[#0a0a0a] px-5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                >
                                    {guardando ? 'Publicando…' : 'Publicar el slide'}
                                </button>
                                <button
                                    onClick={() => setEditando(null)}
                                    className="h-12 rounded-full bg-[#f2f2f0] px-5 text-[14px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                >
                                    Cerrar el editor
                                </button>
                                {editando.id && (
                                    <button
                                        onClick={() => borrar(editando as BannerSlide)}
                                        className="h-12 rounded-full bg-[#fdecea] px-5 text-[14px] font-semibold text-[#a32218] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a32218] focus-visible:ring-offset-2"
                                    >
                                        Borrar slide
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
};

// ── Youvers ───────────────────────────

/**
 * Editor del banner "Origen en Youvers" de la home.
 *
 * Es el editor de música sin la mitad de video: acá un slide es una imagen y
 * un link, nada más. Comparte el marco 1920×600 y el encuadre, así que se ve
 * y se edita igual; lo que cambia es dónde se guarda. Estos slides viven en
 * la config (mismo guardado que los banners de arriba, sin tabla propia ni
 * migración), y por eso este bloque recibe config/onGuardar en vez de las
 * cuatro funciones de servicio que usa Música.
 */
const Youvers: React.FC<{
    config: AppConfig;
    onConfig: (c: AppConfig) => void;
    onGuardar: (c: AppConfig) => Promise<void>;
    pedirConfirmacion: (p: PedidoConfirmacion) => void;
}> = ({ config, onConfig, onGuardar, pedirConfirmacion }) => {
    const [editando, setEditando] = useState<Partial<YouversBannerSlide> | null>(null);
    const [guardando, setGuardando] = useState(false);

    const slides = config.youversBanner?.slides || [];
    const listo = !!editando?.imageUrl && !!editando?.targetUrl;

    const escribirSlides = async (lista: YouversBannerSlide[]) => {
        const nuevo: AppConfig = { ...config, youversBanner: { ...config.youversBanner, slides: lista } };
        onConfig(nuevo);
        await onGuardar(nuevo);
    };

    const publicar = async () => {
        if (!editando || !listo) return;
        setGuardando(true);

        const slide: YouversBannerSlide = {
            id: editando.id || safeUUID(),
            imageUrl: editando.imageUrl as string,
            focalX: editando.focalX ?? 50,
            focalY: editando.focalY ?? 50,
            zoom: editando.zoom ?? 1,
            title: editando.title,
            targetUrl: editando.targetUrl as string,
        };

        await escribirSlides(
            editando.id ? slides.map(s => (s.id === editando.id ? slide : s)) : [...slides, slide]
        );
        setGuardando(false);
        setEditando(slide);
    };

    const borrar = (slide: YouversBannerSlide) => {
        pedirConfirmacion({
            tipo: 'destructivo',
            titulo: '¿Borrar este slide de Youvers?',
            texto: 'Desaparece del banner de la home en cuanto confirmes. No se puede deshacer desde acá.',
            detalleTitulo: 'Qué se borra',
            detalle: slide.title || 'Slide sin título',
            etiquetaBoton: 'Sí, borrar el slide',
            onConfirmar: async () => {
                await escribirSlides(slides.filter(s => s.id !== slide.id));
                setEditando(null);
            },
        });
    };

    return (
        <div className="mt-3 grid gap-3.5 [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="min-w-0 rounded-[20px] bg-white px-5 py-[18px]">
                <div className="flex items-center gap-3">
                    <p className="min-w-0 flex-1 text-[15px] font-semibold text-[#0a0a0a]">
                        Origen en Youvers · {slides.length}
                    </p>
                    <button
                        onClick={() => setEditando({ imageUrl: '', targetUrl: '' })}
                        className="h-[38px] flex-none rounded-full bg-[#0a0a0a] px-[15px] text-[12.5px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        Nuevo slide
                    </button>
                </div>
                <p className="mt-2 text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                    El banner que va debajo del de música en la home. Mide 1920×600, es solo de imágenes y el link
                    nunca se muestra: se abre al tocarlo.
                </p>

                <div className="mt-4 flex flex-col gap-2">
                    {slides.length === 0 ? (
                        <p className="py-8 text-center text-[13px] font-medium text-black/[.6]">
                            Todavía no hay slides de Youvers.
                        </p>
                    ) : slides.map((s, i) => {
                        const elegido = editando?.id === s.id;
                        return (
                            <button
                                key={s.id}
                                onClick={() => setEditando(s)}
                                className={`flex w-full items-center gap-[11px] rounded-[16px] px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${elegido ? 'bg-[#0a0a0a]/10' : 'bg-[#f7f7f5]'}`}
                            >
                                <span className="h-9 w-[52px] flex-none overflow-hidden rounded-[9px] bg-[#e6e4e0]">
                                    {s.imageUrl && <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13.5px] font-semibold text-[#0a0a0a]">
                                        {s.title || 'Slide sin título'}
                                    </span>
                                    <span className="mt-[3px] block truncate text-[11.5px] font-medium text-black/[.6]">
                                        {s.targetUrl}
                                    </span>
                                </span>
                                <span className="flex h-[22px] min-w-[22px] flex-none items-center justify-center rounded-full bg-white text-[11px] font-semibold text-black/[.6]">
                                    {i + 1}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="min-w-0 rounded-[20px] bg-white px-5 py-[18px]">
                {!editando ? (
                    <div className="flex flex-col items-center py-14 text-center">
                        <p className="text-[15px] font-semibold text-[#0a0a0a]">Elegí un slide para editarlo</p>
                        <p className="mt-2 max-w-[320px] text-[13px] font-medium leading-[1.6] text-black/[.62]">
                            O creá uno nuevo. Vas a poder mover el punto focal y el zoom, y ver el recorte real antes
                            de publicarlo.
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="text-[15px] font-semibold text-[#0a0a0a]">
                            {editando.id ? 'Editar el slide' : 'Nuevo slide de Youvers'}
                        </p>
                        <p className="mt-1.5 text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                            Movés el punto focal y el zoom sobre la imagen; la vista previa muestra el recorte real.
                        </p>

                        <div className="mt-4">
                            <Rotulo className="mb-2 text-black/[.55]">Imagen</Rotulo>
                            <ImageUpload
                                currentImage={editando.imageUrl || ''}
                                folder="youvers-banner"
                                onImageUpload={url => setEditando({ ...editando, imageUrl: url })}
                                aspectRatio="wide"
                                className="caja-portada"
                            />
                        </div>

                        {/* 1920×600 fijo, igual que el de música: los dos banners
                            se apilan en la home y con proporciones distintas la
                            página saltaría entre uno y otro. */}
                        <div className="mt-4">
                            <Rotulo className="mb-2 text-black/[.55]">Encuadre</Rotulo>
                            <EncuadreMedia
                                mediaType="image"
                                imageUrl={editando.imageUrl}
                                frameWidth={1920}
                                frameHeight={600}
                                value={{
                                    focalX: editando.focalX ?? 50,
                                    focalY: editando.focalY ?? 50,
                                    zoom: editando.zoom ?? 1,
                                }}
                                onChange={frame => setEditando({ ...editando, ...frame })}
                            />
                        </div>

                        <div className="mt-4">
                            <Rotulo className="mb-1.5 text-black/[.55]">Título (opcional)</Rotulo>
                            <input
                                type="text" value={editando.title || ''}
                                onChange={e => setEditando({ ...editando, title: e.target.value })}
                                placeholder="Devocional — Título"
                                className="h-[46px] w-full rounded-[16px] px-4 text-[13.5px] font-semibold text-[#0a0a0a]"
                            />
                            <p className="mt-1.5 text-[11.5px] font-medium leading-[1.5] text-black/[.6]">
                                Se dibuja sobre la imagen, abajo. Sin título, se ve la imagen sola.
                            </p>
                        </div>

                        <div className="mt-3">
                            <Rotulo className="mb-1.5 text-black/[.55]">Link de destino</Rotulo>
                            <input
                                type="text" value={editando.targetUrl || ''}
                                onChange={e => setEditando({ ...editando, targetUrl: e.target.value })}
                                placeholder="https://bible.com/…"
                                className="h-[46px] w-full rounded-[16px] px-4 text-[13.5px] font-medium text-[#0a0a0a]"
                            />
                            <p className="mt-1.5 text-[11.5px] font-medium leading-[1.5] text-black/[.6]">
                                Nunca se muestra: se abre en una pestaña nueva al tocar el slide.
                            </p>
                        </div>

                        {/* Cómo va a quedar — mismo recorte, mismo degradado y mismo
                            título que dibuja la home, con getMediaFrameStyle de por
                            medio para que las dos cuentas den igual. */}
                        <Rotulo className="mb-2 mt-5 text-black/[.55]">Así se va a ver en la app</Rotulo>
                        <div className="rounded-[20px] bg-[#f7f7f5] p-3">
                            <div
                                className="relative overflow-hidden rounded-[16px] bg-black"
                                style={{ aspectRatio: '1920 / 600' }}
                            >
                                {editando.imageUrl && (
                                    <img
                                        src={editando.imageUrl}
                                        alt=""
                                        className="absolute inset-0 h-full w-full object-cover"
                                        style={getMediaFrameStyle(editando)}
                                    />
                                )}
                                {editando.title && (
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-3.5 pt-10">
                                        <p className="text-[17px] font-bold leading-snug tracking-tight text-white">
                                            {editando.title}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                onClick={publicar}
                                disabled={!listo || guardando}
                                className={`h-12 rounded-full px-5 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${listo ? 'bg-[#0a0a0a] text-white' : 'cursor-default bg-[#f2f2f0] text-black/[.45]'}`}
                            >
                                {guardando ? 'Publicando…' : 'Publicar el slide'}
                            </button>
                            <button
                                onClick={() => setEditando(null)}
                                className="h-12 rounded-full bg-[#f2f2f0] px-5 text-[14px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                Cerrar el editor
                            </button>
                            {editando.id && (
                                <button
                                    onClick={() => borrar(editando as YouversBannerSlide)}
                                    className="h-12 rounded-full bg-[#fdecea] px-5 text-[14px] font-semibold text-[#a32218] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a32218] focus-visible:ring-offset-2"
                                >
                                    Borrar slide
                                </button>
                            )}
                        </div>
                        {!listo && (
                            <p className="mt-2.5 text-[11.5px] font-medium text-black/[.6]">
                                Falta {!editando.imageUrl && !editando.targetUrl ? 'la imagen y el link de destino' : !editando.imageUrl ? 'la imagen' : 'el link de destino'}.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ── Música ────────────────────────────

const Musica: React.FC<{
    slides: MusicaBannerSlide[];
    onGuardar: (input: MusicaBannerSlideInput, id?: string) => Promise<boolean>;
    onBorrar: (id: string) => Promise<void>;
    guardando: boolean;
    pedirConfirmacion: (p: PedidoConfirmacion) => void;
}> = ({ slides, onGuardar, onBorrar, guardando, pedirConfirmacion }) => {
    const [editando, setEditando] = useState<(Partial<MusicaBannerSlideInput> & { id?: string }) | null>(null);

    const listo = !!editando?.targetUrl
        && ((editando.mediaType || 'image') === 'video' || !!editando.mediaUrl);

    const publicar = async () => {
        if (!editando || !listo) return;
        const ok = await onGuardar({
            mediaUrl: editando.mediaUrl,
            mediaType: editando.mediaType || 'image',
            videoUrl: editando.videoUrl,
            focalX: editando.focalX,
            focalY: editando.focalY,
            zoom: editando.zoom,
            title: editando.title,
            targetUrl: editando.targetUrl!,
            displayOrder: editando.displayOrder ?? slides.length,
        }, editando.id);
        if (ok) setEditando(null);
    };

    const borrar = (slide: MusicaBannerSlide) => {
        pedirConfirmacion({
            tipo: 'destructivo',
            titulo: '¿Borrar este slide de música?',
            texto: 'Desaparece del banner de la home en cuanto confirmes. No se puede deshacer desde acá.',
            detalleTitulo: 'Qué se borra',
            detalle: slide.title || 'Slide sin título',
            etiquetaBoton: 'Sí, borrar el slide',
            onConfirmar: async () => { await onBorrar(slide.id); setEditando(null); },
        });
    };

    return (
        <div className="mt-3.5 grid gap-3.5 [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="min-w-0 rounded-[20px] bg-white px-5 py-[18px]">
                <div className="flex items-center gap-3">
                    <p className="min-w-0 flex-1 text-[15px] font-semibold text-[#0a0a0a]">
                        Origen Música · {slides.length}
                    </p>
                    <button
                        onClick={() => setEditando({ mediaType: 'image', mediaUrl: '', targetUrl: '' })}
                        className="h-[38px] flex-none rounded-full bg-[#0a0a0a] px-[15px] text-[12.5px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        Nuevo slide
                    </button>
                </div>
                <p className="mt-2 text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                    El mini-banner que va debajo de “Próximos eventos” en la home. Mide 1920×600 y el link nunca se
                    muestra: solo se abre al tocarlo.
                </p>

                <div className="mt-4 flex flex-col gap-2">
                    {slides.length === 0 ? (
                        <p className="py-8 text-center text-[13px] font-medium text-black/[.6]">
                            Todavía no hay slides de música.
                        </p>
                    ) : slides.map((s, i) => {
                        const elegido = editando?.id === s.id;
                        return (
                            <button
                                key={s.id}
                                onClick={() => setEditando(s)}
                                className={`flex w-full items-center gap-[11px] rounded-[16px] px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${elegido ? 'bg-[#0a0a0a]/10' : 'bg-[#f7f7f5]'}`}
                            >
                                <span className="h-9 w-[52px] flex-none overflow-hidden rounded-[9px] bg-[#e6e4e0]">
                                    {s.mediaUrl && <img src={s.mediaUrl} alt="" className="h-full w-full object-cover" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13.5px] font-semibold text-[#0a0a0a]">
                                        {s.title || 'Slide sin título'}
                                    </span>
                                    <span className="mt-[3px] block truncate text-[11.5px] font-medium text-black/[.6]">
                                        {s.mediaType === 'video' ? 'Video' : 'Imagen'} · {s.targetUrl}
                                    </span>
                                </span>
                                <span className="flex h-[22px] min-w-[22px] flex-none items-center justify-center rounded-full bg-white text-[11px] font-semibold text-black/[.6]">
                                    {i + 1}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="min-w-0 rounded-[20px] bg-white px-5 py-[18px]">
                {!editando ? (
                    <div className="flex flex-col items-center py-14 text-center">
                        <p className="text-[15px] font-semibold text-[#0a0a0a]">Elegí un slide para editarlo</p>
                        <p className="mt-2 max-w-[320px] text-[13px] font-medium leading-[1.6] text-black/[.62]">
                            Usa el mismo editor de encuadre que los banners, con la portada del video como imagen.
                        </p>
                    </div>
                ) : (
                    <>
                        <p className="text-[15px] font-semibold text-[#0a0a0a]">
                            {editando.id ? 'Editar el slide' : 'Nuevo slide de música'}
                        </p>

                        <div className="mt-4">
                            <Rotulo className="mb-2 text-black/[.55]">Tipo de medio</Rotulo>
                            <div className="flex gap-2">
                                {([['image', 'Imagen'], ['video', 'Video']] as const).map(([valor, label]) => {
                                    const on = (editando.mediaType || 'image') === valor;
                                    return (
                                        <button
                                            key={valor}
                                            onClick={() => setEditando({ ...editando, mediaType: valor })}
                                            aria-pressed={on}
                                            className={`h-10 rounded-full px-4 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${on ? 'bg-[#0a0a0a] text-white' : 'bg-[#f7f7f5] text-black/[.66]'}`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="mt-4">
                            <Rotulo className="mb-2 text-black/[.55]">
                                {editando.mediaType === 'video' ? 'Portada (opcional)' : 'Imagen'}
                            </Rotulo>
                            <ImageUpload
                                currentImage={editando.mediaUrl || ''}
                                folder="musica-banner"
                                onImageUpload={url => setEditando({ ...editando, mediaUrl: url })}
                                aspectRatio="wide"
                                className="caja-portada"
                            />
                        </div>

                        {editando.mediaType === 'video' && (
                            <div className="mt-4">
                                <Rotulo className="mb-2 text-black/[.55]">Video</Rotulo>
                                <VideoUpload
                                    currentVideo={editando.videoUrl || ''}
                                    folder="musica-banner"
                                    onVideoUpload={url => setEditando({ ...editando, videoUrl: url })}
                                    className="caja-portada"
                                />
                            </div>
                        )}

                        {/* 1920×600 fijo — medida de este banner puntual, a
                            diferencia del principal, que es configurable. */}
                        <div className="mt-4">
                            <Rotulo className="mb-2 text-black/[.55]">Encuadre</Rotulo>
                            <EncuadreMedia
                                mediaType={editando.mediaType || 'image'}
                                imageUrl={editando.mediaUrl}
                                videoUrl={editando.videoUrl}
                                frameWidth={1920}
                                frameHeight={600}
                                value={{
                                    focalX: editando.focalX ?? 50,
                                    focalY: editando.focalY ?? 50,
                                    zoom: editando.zoom ?? 1,
                                }}
                                onChange={frame => setEditando({ ...editando, ...frame })}
                            />
                        </div>

                        <div className="mt-4">
                            <Rotulo className="mb-1.5 text-black/[.55]">Título</Rotulo>
                            <input
                                type="text" value={editando.title || ''}
                                onChange={e => setEditando({ ...editando, title: e.target.value })}
                                placeholder="Nueva canción — Título"
                                className="h-[46px] w-full rounded-[16px] px-4 text-[13.5px] font-semibold text-[#0a0a0a]"
                            />
                        </div>

                        <div className="mt-3">
                            <Rotulo className="mb-1.5 text-black/[.55]">Link de destino</Rotulo>
                            <input
                                type="text" value={editando.targetUrl || ''}
                                onChange={e => setEditando({ ...editando, targetUrl: e.target.value })}
                                placeholder="https://youtube.com/… o https://open.spotify.com/…"
                                className="h-[46px] w-full rounded-[16px] px-4 text-[13.5px] font-medium text-[#0a0a0a]"
                            />
                            <p className="mt-1.5 text-[11.5px] font-medium leading-[1.5] text-black/[.6]">
                                Nunca se muestra: se abre en una pestaña nueva al tocar el slide.
                            </p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                onClick={publicar}
                                disabled={!listo || guardando}
                                className={`h-12 rounded-full px-5 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${listo ? 'bg-[#0a0a0a] text-white' : 'cursor-default bg-[#f2f2f0] text-black/[.45]'}`}
                            >
                                {guardando ? 'Publicando…' : 'Publicar el slide'}
                            </button>
                            <button
                                onClick={() => setEditando(null)}
                                className="h-12 rounded-full bg-[#f2f2f0] px-5 text-[14px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                Cerrar el editor
                            </button>
                            {editando.id && (
                                <button
                                    onClick={() => borrar(editando as MusicaBannerSlide)}
                                    className="h-12 rounded-full bg-[#fdecea] px-5 text-[14px] font-semibold text-[#a32218] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a32218] focus-visible:ring-offset-2"
                                >
                                    Borrar slide
                                </button>
                            )}
                        </div>
                        {!listo && (
                            <p className="mt-2.5 text-[11.5px] font-medium text-black/[.6]">
                                Falta el link de destino{(editando.mediaType || 'image') !== 'video' && !editando.mediaUrl ? ' y la imagen' : ''}.
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ── Pies ──────────────────────────────

const REDES: { clave: keyof FooterLinks; nombre: string; placeholder: string }[] = [
    { clave: 'instagram', nombre: 'Instagram', placeholder: 'https://instagram.com/…' },
    { clave: 'facebook', nombre: 'Facebook', placeholder: 'https://facebook.com/…' },
    { clave: 'youtube', nombre: 'YouTube', placeholder: 'https://youtube.com/…' },
    { clave: 'spotify', nombre: 'Spotify', placeholder: 'https://open.spotify.com/…' },
];

const Pies: React.FC<{
    pies: FooterLinks;
    onPies: (p: FooterLinks) => void;
    onGuardar: () => Promise<void>;
}> = ({ pies, onPies, onGuardar }) => {
    const [guardando, setGuardando] = useState(false);

    const guardar = async () => {
        setGuardando(true);
        await onGuardar();
        setGuardando(false);
    };

    return (
        <div className="mt-3.5 max-w-[620px] rounded-[20px] bg-white px-[22px] py-5">
            <p className="text-[15px] font-semibold text-[#0a0a0a]">Redes sociales del pie</p>
            <p className="mt-1.5 text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                Los enlaces del pie de todas las pantallas públicas. Las que se dejan vacías no se muestran.
            </p>

            <div className="mt-[18px] flex flex-col gap-3">
                {REDES.map(r => (
                    <label key={r.clave} className="block">
                        <Rotulo className="mb-1.5 text-black/[.55]">{r.nombre}</Rotulo>
                        <input
                            type="url"
                            value={pies[r.clave] || ''}
                            onChange={e => onPies({ ...pies, [r.clave]: e.target.value })}
                            placeholder={r.placeholder}
                            className="h-[46px] w-full rounded-[16px] px-4 text-[13.5px] font-medium text-[#0a0a0a]"
                        />
                    </label>
                ))}
            </div>

            <button
                onClick={guardar}
                disabled={guardando}
                className="mt-[18px] h-12 rounded-full bg-[#0a0a0a] px-5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
            >
                {guardando ? 'Guardando…' : 'Guardar los enlaces'}
            </button>
        </div>
    );
};

export default ConfiguracionApp;

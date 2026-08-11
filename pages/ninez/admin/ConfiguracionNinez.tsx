import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getNinezBannerSlides,
    createNinezBannerSlide,
    updateNinezBannerSlide,
    deleteNinezBannerSlide,
    NinezBannerSlideInput
} from '../../../services/supabaseService';
import { ChevronLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import ImageUpload from '../../../components/media/SubidaImagen';
import VideoUpload from '../../../components/media/SubidaVideo';
import EncuadreMedia from '../../../components/media/EncuadreMedia';

// Mismo encuadre de referencia que usa el banner del Dashboard por default
// (config.banner.frameWidth/frameHeight). Acá no hay un tamaño configurable
// por evento — el hero de /ninez siempre usa el mismo heightClass — así que
// el marco del editor de encuadre queda fijo a esta proporción.
const NINEZ_BANNER_FRAME_WIDTH = 1920;
const NINEZ_BANNER_FRAME_HEIGHT = 720;

interface SlideForm {
    id: string | null; // null = todavía no existe en la base
    localId: string;
    imageUrl: string;
    mediaType: 'image' | 'video';
    videoUrl: string;
    focalX: number;
    focalY: number;
    zoom: number;
    title: string;
    subtitle: string;
}

const emptySlide = (localId: string): SlideForm => ({
    id: null,
    localId,
    imageUrl: '',
    mediaType: 'image',
    videoUrl: '',
    focalX: 50,
    focalY: 50,
    zoom: 1,
    title: '',
    subtitle: ''
});

const ConfiguracionNinez: React.FC = () => {
    const navigate = useNavigate();
    const [slides, setSlides] = useState<SlideForm[]>([]);
    const [deletedIds, setDeletedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        getNinezBannerSlides().then(data => {
            setSlides(data.map(s => ({
                id: s.id,
                localId: s.id,
                imageUrl: s.imageUrl,
                mediaType: s.mediaType || 'image',
                videoUrl: s.videoUrl || '',
                focalX: s.focalX ?? 50,
                focalY: s.focalY ?? 50,
                zoom: s.zoom ?? 1,
                title: s.title || '',
                subtitle: s.subtitle || ''
            })));
            setLoading(false);
        });
    }, []);

    const addSlide = () => {
        setSlides(prev => [...prev, emptySlide(`new-${Date.now()}`)]);
    };

    const removeSlide = (localId: string) => {
        const slide = slides.find(s => s.localId === localId);
        if (slide?.id) {
            setDeletedIds(prev => [...prev, slide.id!]);
        }
        setSlides(prev => prev.filter(s => s.localId !== localId));
    };

    const updateSlide = (localId: string, patch: Partial<SlideForm>) => {
        setSlides(prev => prev.map(s => s.localId === localId ? { ...s, ...patch } : s));
    };

    const handleSave = async () => {
        setSaveError(null);
        setSaveSuccess(false);

        const missingImage = slides.some(s => !s.imageUrl.trim());
        if (missingImage) {
            setSaveError('Todos los slides necesitan una imagen antes de guardar.');
            return;
        }
        const missingVideo = slides.some(s => s.mediaType === 'video' && !s.videoUrl.trim());
        if (missingVideo) {
            setSaveError('Los slides de video necesitan un video antes de guardar.');
            return;
        }

        setSaving(true);
        try {
            // Borrar los que se sacaron de la lista
            await Promise.all(deletedIds.map(id => deleteNinezBannerSlide(id)));

            // Crear/actualizar el resto, respetando el orden visual
            await Promise.all(slides.map((s, index) => {
                const input: NinezBannerSlideInput = {
                    imageUrl: s.imageUrl,
                    mediaType: s.mediaType,
                    videoUrl: s.mediaType === 'video' ? s.videoUrl : undefined,
                    focalX: s.focalX,
                    focalY: s.focalY,
                    zoom: s.zoom,
                    title: s.title.trim() || undefined,
                    subtitle: s.subtitle.trim() || undefined,
                    displayOrder: index
                };
                return s.id
                    ? updateNinezBannerSlide(s.id, input)
                    : createNinezBannerSlide(input);
            }));

            setDeletedIds([]);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);

            // Refrescar con los ids reales de los recién creados
            const fresh = await getNinezBannerSlides();
            setSlides(fresh.map(s => ({
                id: s.id,
                localId: s.id,
                imageUrl: s.imageUrl,
                mediaType: s.mediaType || 'image',
                videoUrl: s.videoUrl || '',
                focalX: s.focalX ?? 50,
                focalY: s.focalY ?? 50,
                zoom: s.zoom ?? 1,
                title: s.title || '',
                subtitle: s.subtitle || ''
            })));
        } catch (err) {
            console.error('[ConfiguracionNinez] Error al guardar:', err);
            setSaveError('Hubo un error al guardar. Probá de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto">
                <button
                    type="button"
                    onClick={() => navigate('/ninez')}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-4"
                >
                    <ChevronLeft className="w-4 h-4" /> Niñez
                </button>

                <h1 className="text-2xl font-black uppercase tracking-tight text-black mb-1">
                    Configuración
                </h1>
                <p className="text-sm text-slate-500 mb-6">
                    Editar Banner — las imágenes o videos que rotan en el inicio de /ninez.
                </p>

                <div className="space-y-4">
                    {slides.map((slide, index) => (
                        <div key={slide.localId} className="bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase text-slate-400">Slide {index + 1}</span>
                                <button
                                    type="button"
                                    onClick={() => removeSlide(slide.localId)}
                                    className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                    title="Borrar slide"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Selector de medio. El video no reemplaza a la imagen: la
                                imagen sigue haciendo de poster mientras el video carga, si
                                el navegador bloquea el autoplay o si el usuario tiene
                                activado "reducir movimiento" — mismo criterio que el
                                banner del Dashboard en Administrador.tsx. */}
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Tipo de medio</label>
                                <div className="flex gap-2">
                                    {([['image', 'Imagen'], ['video', 'Video']] as const).map(([value, label]) => {
                                        const isSelected = slide.mediaType === value;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => updateSlide(slide.localId, { mediaType: value })}
                                                className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg border transition-colors ${isSelected
                                                    ? 'bg-black text-white border-black'
                                                    : 'bg-white text-slate-500 border-slate-300 hover:border-black hover:text-black'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">
                                    {slide.mediaType === 'video' ? 'Imagen de respaldo (poster)' : 'Imagen del slide'}
                                </label>
                                {slide.mediaType === 'video' && (
                                    <p className="text-[11px] text-slate-500 mb-2">
                                        Se ve mientras carga el video y en dispositivos que no lo reproducen. Cargala siempre.
                                    </p>
                                )}
                                <ImageUpload
                                    currentImage={slide.imageUrl}
                                    onImageUpload={(url) => updateSlide(slide.localId, { imageUrl: url })}
                                    folder="ninez-banner"
                                    aspectRatio="wide"
                                    placeholder="Subir imagen del slide"
                                    variant="minimal"
                                />
                            </div>

                            {slide.mediaType === 'video' && (
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Video del slide</label>
                                    <VideoUpload
                                        currentVideo={slide.videoUrl}
                                        folder="ninez-banner"
                                        onVideoUpload={(url) => updateSlide(slide.localId, { videoUrl: url })}
                                    />
                                    <p className="text-[11px] text-slate-500 mt-2">
                                        Se reproduce solo, sin sonido y en bucle. El visitante no puede pausarlo ni controlarlo.
                                    </p>
                                </div>
                            )}

                            {/* ENCUADRE — el archivo casi nunca tiene la proporción del
                                banner, así que sobra imagen y el navegador recortaría por
                                el centro. Acá se elige qué parte sobrevive. Mismo
                                componente y misma fórmula (getMediaFrameStyle) que usa el
                                banner real, así que lo que se ve acá es lo que se publica. */}
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Encuadre</label>
                                <EncuadreMedia
                                    mediaType={slide.mediaType}
                                    imageUrl={slide.imageUrl}
                                    videoUrl={slide.videoUrl}
                                    frameWidth={NINEZ_BANNER_FRAME_WIDTH}
                                    frameHeight={NINEZ_BANNER_FRAME_HEIGHT}
                                    value={{ focalX: slide.focalX, focalY: slide.focalY, zoom: slide.zoom }}
                                    onChange={(frame) => updateSlide(slide.localId, frame)}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Título</label>
                                <input
                                    type="text"
                                    value={slide.title}
                                    onChange={e => updateSlide(slide.localId, { title: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Subtítulo</label>
                                <input
                                    type="text"
                                    value={slide.subtitle}
                                    onChange={e => updateSlide(slide.localId, { subtitle: e.target.value })}
                                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm"
                                />
                            </div>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={addSlide}
                        className="w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold text-slate-600 border-2 border-dashed border-slate-300 rounded-lg hover:bg-white transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Agregar otro slide
                    </button>
                </div>

                {saveError && <p className="text-sm text-red-600 font-medium mt-4">{saveError}</p>}
                {saveSuccess && <p className="text-sm text-emerald-600 font-medium mt-4">Guardado correctamente.</p>}

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full mt-6 flex items-center justify-center gap-2 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar
                </button>
            </div>
        </div>
    );
};

export default ConfiguracionNinez;

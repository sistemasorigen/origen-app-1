import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getNinezBannerSlides,
    createNinezBannerSlide,
    updateNinezBannerSlide,
    deleteNinezBannerSlide
} from '../../../services/supabaseService';
import { ChevronLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react';
import ImageUpload from '../../../components/media/SubidaImagen';

interface SlideForm {
    id: string | null; // null = todavía no existe en la base
    localId: string;
    imageUrl: string;
    title: string;
    subtitle: string;
}

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
                title: s.title || '',
                subtitle: s.subtitle || ''
            })));
            setLoading(false);
        });
    }, []);

    const addSlide = () => {
        setSlides(prev => [...prev, {
            id: null,
            localId: `new-${Date.now()}`,
            imageUrl: '',
            title: '',
            subtitle: ''
        }]);
    };

    const removeSlide = (localId: string) => {
        const slide = slides.find(s => s.localId === localId);
        if (slide?.id) {
            setDeletedIds(prev => [...prev, slide.id!]);
        }
        setSlides(prev => prev.filter(s => s.localId !== localId));
    };

    const updateSlide = (localId: string, field: 'imageUrl' | 'title' | 'subtitle', value: string) => {
        setSlides(prev => prev.map(s => s.localId === localId ? { ...s, [field]: value } : s));
    };

    const handleSave = async () => {
        setSaveError(null);
        setSaveSuccess(false);

        const missingImage = slides.some(s => !s.imageUrl.trim());
        if (missingImage) {
            setSaveError('Todos los slides necesitan una imagen antes de guardar.');
            return;
        }

        setSaving(true);
        try {
            // Borrar los que se sacaron de la lista
            await Promise.all(deletedIds.map(id => deleteNinezBannerSlide(id)));

            // Crear/actualizar el resto, respetando el orden visual
            await Promise.all(slides.map((s, index) => {
                const input = {
                    imageUrl: s.imageUrl,
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
                    Editar Banner — las imágenes que rotan en el inicio de /ninez.
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

                            <ImageUpload
                                currentImage={slide.imageUrl}
                                onImageUpload={(url) => updateSlide(slide.localId, 'imageUrl', url)}
                                folder="ninez-banner"
                                aspectRatio="wide"
                                placeholder="Subir imagen del slide"
                                variant="minimal"
                            />

                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Título</label>
                                <input
                                    type="text"
                                    value={slide.title}
                                    onChange={e => updateSlide(slide.localId, 'title', e.target.value)}
                                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg outline-none focus:border-black text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400 mb-1.5 block">Subtítulo</label>
                                <input
                                    type="text"
                                    value={slide.subtitle}
                                    onChange={e => updateSlide(slide.localId, 'subtitle', e.target.value)}
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
                        <Plus className="w-4 h-4" /> Agregar otra imagen
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

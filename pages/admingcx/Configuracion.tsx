import React, { useState, useEffect } from 'react';
import { AppConfig, BannerSlide } from '../../types';
import { db } from '../../services/dbService';
import { supabaseService } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast, usePanelGCXConteos } from '../../components/layout/AdminGCXLayout';
import ImageUpload from '../../components/media/SubidaImagen';
import ModalPanelGCX, { BotonPrincipal, BotonSecundario } from '../../components/GCX/ModalPanelGCX';
import { Loader2, Plus } from 'lucide-react';

/**
 * Sección Página pública del panel (design-claude/Admin GCX - Panel).
 *
 * El carrusel que ve cualquiera arriba del catálogo de grupos: las imágenes
 * en el orden en que se muestran, y una baldosa punteada para sumar otra.
 */

const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const ConfiguracionContent: React.FC = () => {
    const { showToast } = useAdminGCXToast();
    const { registrarConteo } = usePanelGCXConteos();
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [loading, setLoading] = useState(true);

    const [editingSlide, setEditingSlide] = useState<Partial<BannerSlide> | null>(null);

    useEffect(() => {
        setLoading(true);
        supabaseService.getAppConfig().then(remoteConfig => {
            if (remoteConfig) {
                db.saveAppConfig(remoteConfig);
                setConfig(remoteConfig);
            } else {
                setConfig(db.getAppConfig());
            }
            setLoading(false);
        });
    }, []);

    const slides = config?.groupsConfig?.banners || [];

    useEffect(() => {
        if (config) registrarConteo('publica', slides.length);
    }, [config, slides.length, registrarConteo]);

    const handleSaveSlide = () => {
        if (!editingSlide) return;
        const currentConfig = db.getAppConfig();
        const currentSlides = currentConfig.groupsConfig?.banners || [];
        let updatedSlides;

        if (editingSlide.id) {
            updatedSlides = currentSlides.map(s => s.id === editingSlide.id ? editingSlide as BannerSlide : s);
        } else {
            updatedSlides = [...currentSlides, { ...editingSlide, id: generateUUID() } as BannerSlide];
        }

        const newConfig: AppConfig = {
            ...currentConfig,
            groupsConfig: {
                ...currentConfig.groupsConfig,
                banners: updatedSlides,
                activeBlurLevel: currentConfig.groupsConfig?.activeBlurLevel || 'md'
            }
        };

        db.saveAppConfig(newConfig);
        supabaseService.saveAppConfig(newConfig);

        setConfig(newConfig);
        setEditingSlide(null);
        showToast('Imagen guardada');
    };

    const handleDeleteSlide = (id: string) => {
        if (!window.confirm('¿Sacar esta imagen del carrusel?')) return;
        const currentConfig = db.getAppConfig();
        const updatedSlides = (currentConfig.groupsConfig?.banners || []).filter(s => s.id !== id);
        const newConfig = {
            ...currentConfig,
            groupsConfig: {
                ...currentConfig.groupsConfig,
                banners: updatedSlides,
                activeBlurLevel: currentConfig.groupsConfig?.activeBlurLevel || 'md'
            }
        };
        db.saveAppConfig(newConfig);
        supabaseService.saveAppConfig(newConfig);
        setConfig(newConfig);
        setEditingSlide(null);
        showToast('Imagen eliminada');
    };

    if (loading || !config) {
        return (
            <div className="flex justify-center rounded-[20px] bg-white py-20">
                <Loader2 className="h-7 w-7 animate-spin text-black/20" />
            </div>
        );
    }

    const esNueva = !editingSlide?.id;

    return (
        <>
            <div className="rounded-[20px] bg-white p-5">
                <p className="text-[15px] font-semibold text-[#0a0a0a]">Carrusel del catálogo público</p>
                <p className="mb-[18px] mt-1.5 text-[12.5px] font-medium text-black/[.62]">
                    {slides.length === 0
                        ? 'Sin imágenes propias se muestran las que trae la app por defecto.'
                        : 'Se muestran en este orden arriba de la lista de grupos.'}
                </p>

                <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
                    {slides.map((slide, i) => (
                        <button
                            key={slide.id}
                            onClick={() => setEditingSlide(slide)}
                            className="group relative flex h-[120px] items-end overflow-hidden rounded-[16px] bg-[#eceae6] p-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            {slide.imageUrl && (
                                <img src={slide.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                            )}
                            <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" />
                            <span className="relative flex h-[26px] items-center rounded-full bg-white/95 px-[11px] text-[11.5px] font-semibold text-[#0a0a0a]">
                                {i + 1}
                            </span>
                            {slide.title && (
                                <span className="relative ml-2 truncate text-[12px] font-semibold text-white">
                                    {slide.title}
                                </span>
                            )}
                        </button>
                    ))}

                    <button
                        onClick={() => setEditingSlide({ id: '', imageUrl: '', title: '', subtitle: '' })}
                        className="flex h-[120px] flex-col items-center justify-center gap-2 rounded-[16px] border-[1.5px] border-dashed border-[#d8d6d1] text-black/[.6] transition-colors hover:border-[#0a0a0a] hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        <Plus className="h-5 w-5" />
                        <span className="text-[12.5px] font-semibold">Subir imagen</span>
                    </button>
                </div>
            </div>

            <ModalPanelGCX
                isOpen={!!editingSlide}
                onClose={() => setEditingSlide(null)}
                titulo={esNueva ? 'Nueva imagen del carrusel' : 'Editar la imagen'}
                subtitulo="El título y el texto se ven encima de la imagen."
                pie={
                    <>
                        {!esNueva && editingSlide?.id && (
                            <BotonSecundario
                                onClick={() => handleDeleteSlide(editingSlide.id as string)}
                                className="bg-[#fdecea] text-[#a32218]"
                            >
                                Sacar del carrusel
                            </BotonSecundario>
                        )}
                        <BotonPrincipal onClick={handleSaveSlide} disabled={!editingSlide?.imageUrl}>
                            {esNueva ? 'Sumar al carrusel' : 'Guardar'}
                        </BotonPrincipal>
                    </>
                }
            >
                {editingSlide && (
                    <div className="flex flex-col gap-2.5 pb-1">
                        <div className="caja-portada">
                            <ImageUpload
                                currentImage={editingSlide.imageUrl || ''}
                                folder="groups-banners"
                                onImageUpload={(url) => setEditingSlide({ ...editingSlide, imageUrl: url })}
                                aspectRatio="wide"
                            />
                        </div>

                        <div className="flex h-[58px] flex-col justify-center rounded-[18px] bg-[#f7f7f5] px-[17px]">
                            <label htmlFor="banner-titulo" className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-black/[.58]">
                                Título
                            </label>
                            <input
                                id="banner-titulo"
                                type="text"
                                value={editingSlide.title || ''}
                                onChange={e => setEditingSlide({ ...editingSlide, title: e.target.value })}
                                placeholder="Grupos de conexión"
                                className="campo-desnudo w-full bg-transparent text-[14.5px] font-medium text-[#0a0a0a]"
                            />
                        </div>

                        <div className="flex h-[58px] flex-col justify-center rounded-[18px] bg-[#f7f7f5] px-[17px]">
                            <label htmlFor="banner-sub" className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-black/[.58]">
                                Texto
                            </label>
                            <input
                                id="banner-sub"
                                type="text"
                                value={editingSlide.subtitle || ''}
                                onChange={e => setEditingSlide({ ...editingSlide, subtitle: e.target.value })}
                                placeholder="Un lugar para conocer a otros"
                                className="campo-desnudo w-full bg-transparent text-[14.5px] font-medium text-[#0a0a0a]"
                            />
                        </div>

                        {!editingSlide.imageUrl && (
                            <p className="mt-1 text-[12.5px] font-medium text-black/[.62]">
                                Subí una imagen para poder guardar.
                            </p>
                        )}
                    </div>
                )}
            </ModalPanelGCX>
        </>
    );
};

const Configuracion: React.FC = () => (
    <AdminGCXLayout title="Página pública">
        <ConfiguracionContent />
    </AdminGCXLayout>
);

export default Configuracion;

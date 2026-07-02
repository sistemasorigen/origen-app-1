import React, { useState, useEffect } from 'react';
import { AppConfig, BannerSlide } from '../../types';
import { db } from '../../services/dbService';
import { supabaseService } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import ImageUpload from '../../components/media/SubidaImagen';
import NeoModal from '../../components/ui/NeoModal';
import { Edit2, Trash2, Loader2 } from 'lucide-react';

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
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [loading, setLoading] = useState(true);

    const [isSlideModalOpen, setIsSlideModalOpen] = useState(false);
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
        setIsSlideModalOpen(false);
        setEditingSlide(null);
        showToast('Slide guardado');
    };

    const handleDeleteSlide = (id: string) => {
        const currentConfig = db.getAppConfig();
        const updatedSlides = (currentConfig.groupsConfig?.banners || []).filter(s => s.id !== id);
        const newConfig = { ...currentConfig, groupsConfig: { ...currentConfig.groupsConfig, banners: updatedSlides, activeBlurLevel: currentConfig.groupsConfig?.activeBlurLevel || 'md' } };
        db.saveAppConfig(newConfig);
        supabaseService.saveAppConfig(newConfig);
        setConfig(newConfig);
        showToast('Slide eliminado');
    };

    if (loading || !config) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
        );
    }

    return (
        <>
            <div className="max-w-6xl">
                <div className="bg-white p-8 border border-slate-200 shadow-lg mb-8 rounded-lg">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                        <h4 className="font-bold text-lg uppercase">Hero Banner (Carrusel)</h4>
                        <button
                            onClick={() => { setEditingSlide({ id: '', imageUrl: '', title: '', subtitle: '' }); setIsSlideModalOpen(true); }}
                            className="px-4 py-2 bg-black text-white text-xs font-bold uppercase hover:bg-slate-800 rounded-lg"
                        >
                            + Agregar Banner
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {(config.groupsConfig?.banners || []).map(slide => (
                            <div key={slide.id} className="border-2 border-slate-200 rounded-lg group relative overflow-hidden">
                                <div className="aspect-video bg-slate-100 relative overflow-hidden">
                                    <img src={slide.imageUrl} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button onClick={() => { setEditingSlide(slide); setIsSlideModalOpen(true); }} className="p-2 bg-white text-black hover:bg-slate-200 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeleteSlide(slide.id)} className="p-2 bg-red-600 text-white hover:bg-red-700 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h5 className="font-bold text-sm uppercase text-black">{slide.title || 'Sin título'}</h5>
                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{slide.subtitle || 'Sin subtítulo'}</p>
                                </div>
                            </div>
                        ))}
                        {(config.groupsConfig?.banners || []).length === 0 && (
                            <div className="p-8 text-center text-slate-400 text-sm border-2 border-dashed border-slate-200 col-span-full rounded-lg">
                                No hay banners configurados. Se mostrarán los predeterminados.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isSlideModalOpen && editingSlide && (
                <NeoModal
                    isOpen={isSlideModalOpen}
                    onClose={() => { setIsSlideModalOpen(false); setEditingSlide(null); }}
                    title="Editor de Banner"
                >
                    <div className="space-y-5">
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Imagen</label>
                            <ImageUpload
                                currentImage={editingSlide.imageUrl || ''}
                                folder="groups-banners"
                                onImageUpload={(url) => setEditingSlide({ ...editingSlide, imageUrl: url })}
                                aspectRatio="wide"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Título</label>
                            <input
                                type="text"
                                placeholder="GRUPOS DE CONEXIÓN"
                                value={editingSlide.title || ''}
                                onChange={e => setEditingSlide({ ...editingSlide, title: e.target.value })}
                                className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-black font-bold uppercase"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Sub-título</label>
                            <input
                                type="text"
                                placeholder="Un lugar para conocer a otros..."
                                value={editingSlide.subtitle || ''}
                                onChange={e => setEditingSlide({ ...editingSlide, subtitle: e.target.value })}
                                className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-black"
                            />
                        </div>
                    </div>
                    <div className="pt-6 border-t border-slate-100 flex justify-end gap-3 mt-6">
                        <button onClick={() => { setIsSlideModalOpen(false); setEditingSlide(null); }} className="px-6 py-3 text-xs font-bold uppercase text-slate-500 hover:text-black">Cancelar</button>
                        <button onClick={handleSaveSlide} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase rounded-lg shadow-lg hover:bg-slate-800">Guardar</button>
                    </div>
                </NeoModal>
            )}
        </>
    );
};

const Configuracion: React.FC = () => (
    <AdminGCXLayout title="Configuración Global">
        <ConfiguracionContent />
    </AdminGCXLayout>
);

export default Configuracion;

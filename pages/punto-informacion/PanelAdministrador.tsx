import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { ProductType, PuntoInfoBannerSlide } from '../../types';
import { useToast } from './context/ContextoToast';
import {
    RefreshCw, Download, AlertTriangle,
    Image as ImageIcon, Plus, Edit2, Trash2, X, Save, Loader2
} from 'lucide-react';
import ImageUpload from '../../components/media/SubidaImagen';
import VideoUpload from '../../components/media/SubidaVideo';
import EncuadreMedia from '../../components/media/EncuadreMedia';
import {
    getPuntoInfoBannerSlides,
    createPuntoInfoBannerSlide,
    updatePuntoInfoBannerSlide,
    deletePuntoInfoBannerSlide,
    type PuntoInfoBannerSlideInput
} from '../../services/supabaseService';

const AdminPanel: React.FC = () => {
    const { products, refreshData } = useStore();
    const toast = useToast();
    const [priceUpdate, setPriceUpdate] = useState({ type: ProductType.REMERA, price: 0 });
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [bannerSlides, setBannerSlides] = useState<PuntoInfoBannerSlide[]>([]);
    const [editingBannerSlide, setEditingBannerSlide] = useState<Partial<PuntoInfoBannerSlideInput> & { id?: string } | null>(null);
    const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
    const [savingBanner, setSavingBanner] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getPuntoInfoBannerSlides().then(slides => {
            if (!cancelled) setBannerSlides(slides);
        });
        return () => { cancelled = true; };
    }, []);

    const executeUpdate = async () => {
        setConfirmOpen(false);
        try {
            const { dbAPI } = await import('../../services/db');
            await dbAPI.updateProductPricesByType(priceUpdate.type, priceUpdate.price);
            await refreshData();
            toast.success('Precios actualizados masivamente.');
        } catch {
            toast.error('Error al actualizar precios.');
        }
    };

    const handleSaveBannerSlide = async () => {
        if (!editingBannerSlide?.mediaUrl) return;
        setSavingBanner(true);

        const input: PuntoInfoBannerSlideInput = {
            mediaUrl: editingBannerSlide.mediaUrl,
            mediaType: editingBannerSlide.mediaType || 'image',
            videoUrl: editingBannerSlide.videoUrl,
            focalX: editingBannerSlide.focalX,
            focalY: editingBannerSlide.focalY,
            zoom: editingBannerSlide.zoom,
            title: editingBannerSlide.title,
            subtitle: editingBannerSlide.subtitle,
            displayOrder: editingBannerSlide.displayOrder ?? bannerSlides.length
        };

        if (editingBannerSlide.id) {
            await updatePuntoInfoBannerSlide(editingBannerSlide.id, input);
        } else {
            await createPuntoInfoBannerSlide(input);
        }

        const fresh = await getPuntoInfoBannerSlides();
        setBannerSlides(fresh);
        setSavingBanner(false);
        setIsBannerModalOpen(false);
        setEditingBannerSlide(null);
    };

    const handleDeleteBannerSlide = async (id: string) => {
        const success = await deletePuntoInfoBannerSlide(id);
        if (success) {
            setBannerSlides(prev => prev.filter(s => s.id !== id));
        } else {
            toast.error('No se pudo eliminar el slide.');
        }
    };

    const downloadCSV = () => {
        const headers = ["Codigo", "Nombre", "Tipo", "Talle", "Stock", "Precio"];
        const rows = products.map(p => [p.code, p.name, p.type, p.size, p.stock, p.price]);
        const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "inventario_origen.csv");
        document.body.appendChild(link);
        link.click();
        toast.success('Archivo CSV descargado.');
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6 animate-fadeIn pb-10">

            {/* CONFIRM MODAL */}
            {confirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white border border-slate-200 rounded-lg shadow-xl p-6 w-full max-w-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><AlertTriangle className="w-5 h-5" /></div>
                            <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">Confirmar actualización</h2>
                        </div>
                        <p className="text-sm font-medium text-slate-500 mb-2">
                            Se actualizarán <span className="text-slate-900 font-bold">todos</span> los productos de tipo:
                        </p>
                        <div className="flex items-center gap-3 mb-6 p-3 rounded-lg border border-slate-200 bg-slate-50">
                            <span className="text-base font-black uppercase text-slate-900">{priceUpdate.type}</span>
                            <span className="text-slate-400 font-bold">→</span>
                            <span className="text-base font-black text-slate-900">${priceUpdate.price.toLocaleString('es-AR')}</span>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmOpen(false)}
                                className="flex-1 py-2.5 border border-slate-200 rounded-lg font-bold uppercase text-xs tracking-widest text-slate-700 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={executeUpdate}
                                className="flex-1 py-2.5 bg-black text-white rounded-lg font-bold uppercase text-xs tracking-widest hover:bg-slate-800 transition-colors"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* BANNER SLIDE MODAL */}
            {isBannerModalOpen && editingBannerSlide && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">{editingBannerSlide.id ? 'Editar Slide' : 'Nuevo Slide'}</h3>
                            <button onClick={() => { setIsBannerModalOpen(false); setEditingBannerSlide(null); }} className="text-slate-400 hover:text-black">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                            <button type="button" onClick={() => setEditingBannerSlide({ ...editingBannerSlide, mediaType: 'image' })} className={`flex-1 py-2 rounded-md text-xs font-bold uppercase ${editingBannerSlide.mediaType === 'image' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Imagen</button>
                            <button type="button" onClick={() => setEditingBannerSlide({ ...editingBannerSlide, mediaType: 'video' })} className={`flex-1 py-2 rounded-md text-xs font-bold uppercase ${editingBannerSlide.mediaType === 'video' ? 'bg-white shadow-sm' : 'text-slate-500'}`}>Video</button>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">
                                {editingBannerSlide.mediaType === 'video' ? 'Portada (mientras carga el video)' : 'Imagen'}
                            </label>
                            <ImageUpload
                                currentImage={editingBannerSlide.mediaUrl || ''}
                                folder="punto-info-banner"
                                onImageUpload={(url) => setEditingBannerSlide({ ...editingBannerSlide, mediaUrl: url })}
                                aspectRatio="wide"
                            />
                        </div>

                        {editingBannerSlide.mediaType === 'video' && (
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Video</label>
                                <VideoUpload
                                    currentVideo={editingBannerSlide.videoUrl || ''}
                                    folder="punto-info-banner"
                                    onVideoUpload={(url) => setEditingBannerSlide({ ...editingBannerSlide, videoUrl: url })}
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Encuadre</label>
                            <EncuadreMedia
                                mediaType={editingBannerSlide.mediaType || 'image'}
                                imageUrl={editingBannerSlide.mediaUrl}
                                videoUrl={editingBannerSlide.videoUrl}
                                frameWidth={1920}
                                frameHeight={720}
                                value={{
                                    focalX: editingBannerSlide.focalX ?? 50,
                                    focalY: editingBannerSlide.focalY ?? 50,
                                    zoom: editingBannerSlide.zoom ?? 1
                                }}
                                onChange={(frame) => setEditingBannerSlide({ ...editingBannerSlide, ...frame })}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Título</label>
                            <input type="text" value={editingBannerSlide.title || ''} onChange={e => setEditingBannerSlide({ ...editingBannerSlide, title: e.target.value })} className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm font-bold outline-none focus:border-black" />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Subtítulo</label>
                            <input type="text" value={editingBannerSlide.subtitle || ''} onChange={e => setEditingBannerSlide({ ...editingBannerSlide, subtitle: e.target.value })} className="w-full h-11 px-3 border border-slate-300 rounded-lg text-sm font-medium outline-none focus:border-black" />
                        </div>

                        <button
                            onClick={handleSaveBannerSlide}
                            disabled={savingBanner || !editingBannerSlide.mediaUrl}
                            className="w-full h-11 bg-black text-white rounded-lg font-bold uppercase text-xs tracking-widest hover:bg-slate-800 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                            {savingBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Guardar</>}
                        </button>
                    </div>
                </div>
            )}

            {/* MASS PRICE UPDATE */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-base font-black mb-4 text-slate-900 uppercase tracking-tight border-b border-slate-200 pb-3 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-slate-400" />
                    Actualización masiva
                </h3>
                <div className="space-y-4">
                    <p className="text-xs font-medium uppercase text-slate-500">Selecciona el tipo y el nuevo precio:</p>
                    <div className="flex flex-col gap-3">
                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Tipo</label>
                            <select
                                value={priceUpdate.type}
                                onChange={e => setPriceUpdate({ ...priceUpdate, type: e.target.value as ProductType })}
                                className="w-full h-11 px-3 border border-slate-300 rounded-lg bg-white text-sm text-slate-900 font-bold outline-none focus:border-black transition-colors cursor-pointer"
                            >
                                {Object.values(ProductType).map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1.5 block">Precio ($)</label>
                            <input
                                type="number"
                                value={priceUpdate.price}
                                onChange={e => setPriceUpdate({ ...priceUpdate, price: parseInt(e.target.value) })}
                                className="w-full h-11 px-3 border border-slate-300 rounded-lg bg-white text-sm text-slate-900 font-bold outline-none focus:border-black transition-colors"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => setConfirmOpen(true)}
                        className="w-full h-11 bg-black text-white rounded-lg font-bold uppercase text-xs tracking-widest hover:bg-slate-800 transition-colors"
                    >
                        Ejecutar actualización
                    </button>
                </div>
            </div>

            {/* EXPORT DATA */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-base font-black mb-4 text-slate-900 uppercase tracking-tight border-b border-slate-200 pb-3 flex items-center gap-2">
                    <Download className="w-5 h-5 text-slate-400" />
                    Exportar datos
                </h3>
                <p className="text-xs font-medium uppercase text-slate-500 mb-4">Descarga el inventario completo en formato CSV compatible con Excel.</p>
                <button
                    onClick={downloadCSV}
                    className="w-full h-11 bg-[#118f46] text-white rounded-lg font-bold uppercase text-xs tracking-widest hover:bg-[#0f7a3c] transition-colors flex items-center justify-center gap-2"
                >
                    <Download className="w-4 h-4" />
                    Descargar inventario CSV
                </button>
            </div>

            {/* BANNER PRINCIPAL */}
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
                    <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-slate-400" />
                        Banner Principal
                    </h3>
                    <button
                        onClick={() => { setEditingBannerSlide({ mediaType: 'image', mediaUrl: '' }); setIsBannerModalOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-black text-white text-xs font-bold uppercase rounded-lg hover:bg-slate-800 transition-colors"
                    >
                        <Plus className="w-4 h-4" /> Agregar
                    </button>
                </div>

                <div className="space-y-3">
                    {bannerSlides.map(slide => (
                        <div key={slide.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
                            <div className="w-16 h-10 rounded bg-slate-100 overflow-hidden shrink-0">
                                {slide.mediaType === 'video' && slide.videoUrl ? (
                                    <video src={slide.videoUrl} poster={slide.mediaUrl} className="w-full h-full object-cover" muted />
                                ) : (
                                    <img src={slide.mediaUrl} className="w-full h-full object-cover" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 truncate">{slide.title || '(Sin título)'}</p>
                            </div>
                            <button onClick={() => { setEditingBannerSlide(slide); setIsBannerModalOpen(true); }} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                                <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteBannerSlide(slide.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {bannerSlides.length === 0 && (
                        <p className="text-xs font-medium uppercase text-slate-400 text-center py-6">Sin slides configurados.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;

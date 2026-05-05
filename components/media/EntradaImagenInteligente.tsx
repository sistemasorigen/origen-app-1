/**
 * @deprecated Use ImageUpload component instead for simple file uploads.
 * This component is kept for backward compatibility and includes AI generation feature.
 * For new implementations, prefer: import ImageUpload from '../media/SubidaImagen';
 */

import React, { useState } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { ImageAspectRatio } from '../../types';
import {
    Link,
    UploadCloud,
    Image as ImageIcon,
    Loader2,
    CheckCircle,
    XCircle
} from 'lucide-react';

interface SmartImageInputProps {
    value: string;
    onChange: (url: string) => void;
    aspectRatio?: ImageAspectRatio; // For AI generation context
    label?: string;
    placeholder?: string;
}

type InputMode = 'URL' | 'UPLOAD';

const SmartImageInput: React.FC<SmartImageInputProps> = ({
    value,
    onChange,
    aspectRatio = ImageAspectRatio.LANDSCAPE_16_9,
    label = "Imagen",
    placeholder = "https://..."
}) => {
    const [mode, setMode] = useState<InputMode>('URL');
    const [loading, setLoading] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const [imgError, setImgError] = useState(false);

    // --- HANDLERS ---

    // 1. Upload Handler
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const url = await supabaseService.uploadImage(file);
        if (url) {
            onChange(url);
            setImgError(false);
        } else {
            alert('Error al subir imagen. Verifique configuración.');
        }
        setLoading(false);
    };

    // Drag & Drop Visuals
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            setLoading(true);
            const url = await supabaseService.uploadImage(file);
            if (url) onChange(url);
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header / Tabs */}
            <div className="flex justify-between items-end">
                <label className="text-xs font-bold uppercase text-neutral-500">{label}</label>
                <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg">
                    <button
                        onClick={() => setMode('URL')}
                        className={`p-2 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${mode === 'URL' ? 'bg-white shadow text-black' : 'text-neutral-400 hover:text-neutral-600'}`}
                        title="Enlace Directo"
                    >
                        <Link className="w-3 h-3" /> Link
                    </button>
                    <button
                        onClick={() => setMode('UPLOAD')}
                        className={`p-2 rounded flex items-center gap-2 text-[10px] font-bold uppercase transition-all ${mode === 'UPLOAD' ? 'bg-white shadow text-black' : 'text-neutral-400 hover:text-neutral-600'}`}
                        title="Subir Archivo"
                    >
                        <UploadCloud className="w-3 h-3" /> Subir
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4">

                {/* Input Section */}
                <div className="space-y-2">
                    {mode === 'URL' && (
                        <div className="relative animate-fadeIn">
                            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="text"
                                value={value}
                                onChange={(e) => { onChange(e.target.value); setImgError(false); }}
                                className="w-full pl-10 p-3 bg-white border border-neutral-200 rounded-xl outline-none text-sm font-medium focus:border-black transition-colors placeholder-neutral-300"
                                placeholder={placeholder}
                            />
                        </div>
                    )}

                    {mode === 'UPLOAD' && (
                        <div
                            className={`relative border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors animate-fadeIn ${dragActive ? 'border-black bg-neutral-50' : 'border-neutral-200 hover:border-neutral-400'}`}
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                        >
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-2 text-neutral-400">
                                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                                    <span className="text-xs font-bold uppercase">Subiendo...</span>
                                </div>
                            ) : (
                                <>
                                    <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    <div className="flex flex-col items-center justify-center py-2 text-neutral-400">
                                        <UploadCloud className="w-6 h-6 mb-2" />
                                        <span className="text-xs font-bold uppercase">Click o Arrastra Aquí</span>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                </div>

                {/* Preview Thumbnail */}
                <div className="relative w-full aspect-square bg-neutral-100 border border-neutral-200 rounded-xl overflow-hidden flex items-center justify-center">
                    {value && !imgError ? (
                        <img
                            src={value}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="text-center text-neutral-300">
                            <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                            <span className="text-[9px] font-bold uppercase">Preview</span>
                        </div>
                    )}

                    {/* Status Badge */}
                    {value && (
                        <div className={`absolute bottom-1 right-1 p-1 rounded-full ${imgError ? 'bg-red-100 text-red-500' : 'bg-emerald-100 text-emerald-500'}`}>
                            {imgError ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SmartImageInput;

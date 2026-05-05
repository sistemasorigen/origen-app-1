import React, { useState, useRef, useCallback } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { Upload, Loader2, Trash2, ImageIcon, AlertCircle } from 'lucide-react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../src/utils/cropImage';
import { createPortal } from 'react-dom';

interface ImageUploadProps {
    /** Callback when image is successfully uploaded */
    onImageUpload: (url: string) => void;
    /** Current image URL (for preview) */
    currentImage?: string;
    /** Folder in storage bucket (e.g., 'groups', 'products', 'banners') */
    folder?: string;
    /** Optional className for container */
    className?: string;
    /** Placeholder text */
    placeholder?: string;
    /** Aspect ratio hint */
    aspectRatio?: 'square' | 'wide' | 'auto';
    /** Visual style variant */
    variant?: 'brutal' | 'minimal';
}

type UploadState = 'idle' | 'loading' | 'success' | 'error';

const ImageUpload: React.FC<ImageUploadProps & { customUploadFn?: (file: File) => Promise<string | null> }> = ({
    onImageUpload,
    currentImage,
    folder = '',
    className = '',
    placeholder = 'Click o arrastrá tu imagen',
    aspectRatio = 'auto',
    variant = 'brutal',
    customUploadFn
}) => {
    const [state, setState] = useState<UploadState>(currentImage ? 'success' : 'idle');
    const [preview, setPreview] = useState<string | null>(currentImage || null);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Crop state
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const [isCropModalOpen, setIsCropModalOpen] = useState(false);
    const [imageToCropUrl, setImageToCropUrl] = useState<string | null>(null);

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const processFileForCrop = (file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('Solo se permiten archivos de imagen');
            setState('error');
            return;
        }
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setError('La imagen no puede superar los 5MB');
            setState('error');
            return;
        }

        const url = URL.createObjectURL(file);
        setImageToCropUrl(url);
        setIsCropModalOpen(true);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
    };

    const handleConfirmCrop = async () => {
        if (!imageToCropUrl || !croppedAreaPixels) return;
        try {
            const croppedImageFile = await getCroppedImg(imageToCropUrl, croppedAreaPixels, 0);
            if (croppedImageFile) {
                handleUpload(croppedImageFile as File);
            }
        } catch (e) {
            console.error(e);
            setError('Error al recortar la imagen');
            setState('error');
        } finally {
            setIsCropModalOpen(false);
            setImageToCropUrl(null);
        }
    };

    const handleCancelCrop = () => {
        setIsCropModalOpen(false);
        setImageToCropUrl(null);
    };

    const getCropAspect = () => {
        if (aspectRatio === 'square') return 1;
        if (aspectRatio === 'wide') return 16 / 9;
        return 4 / 3;
    };

    const aspectClasses = {
        square: 'aspect-square',
        wide: 'aspect-video',
        auto: 'min-h-[200px]'
    };

    const containerStyles = {
        brutal: {
            idle: 'border-black border-dashed bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-neutral-50 hover:translate-y-px hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
            active: 'border-black bg-neutral-100 scale-[1.02]',
            error: 'border-red-500 border-dashed bg-red-50',
            success: 'border-black bg-black'
        },
        minimal: {
            idle: 'border-gray-300 border-dashed bg-white hover:bg-gray-50',
            active: 'border-blue-500 bg-blue-50 ring-2 ring-blue-200',
            error: 'border-red-300 bg-red-50',
            success: 'border-gray-300 bg-gray-50'
        }
    };

    // ... handleUpload callbacks ...
    const handleUpload = useCallback(async (file: File) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Solo se permiten archivos de imagen');
            setState('error');
            return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setError('La imagen no puede superar los 5MB');
            setState('error');
            return;
        }

        setState('loading');
        setError(null);

        try {
            let url: string | null = null;
            if (customUploadFn) {
                url = await customUploadFn(file);
            } else {
                // @ts-ignore - Fallback to legacy validation if needed, or error
                url = await supabaseService.uploadImage(file, folder);
            }

            if (!url) throw new Error('Error al obtener URL de imagen');

            setPreview(url);
            setState('success');
            onImageUpload(url);
        } catch (err) {
            console.error('[ImageUpload] Error:', err);
            setError(err instanceof Error ? err.message : 'Error al subir imagen');
            setState('error');
        }
    }, [folder, onImageUpload]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processFileForCrop(file);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) {
            processFileForCrop(file);
        }
    };

    const handleRemove = () => {
        setPreview(null);
        setState('idle');
        setError(null);
        onImageUpload('');
        if (inputRef.current) {
            inputRef.current.value = '';
        }
    };

    const handleClick = () => {
        if (state !== 'loading') {
            inputRef.current?.click();
        }
    };

    return (
        <div className={`relative ${className}`}>
            {/* input... */}
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            {/* Main Container */}
            <div
                onClick={handleClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                    relative overflow-hidden cursor-pointer transition-all duration-200
                    border-2 rounded-xl flex flex-col items-center justify-center
                    ${aspectClasses[aspectRatio]}
                    ${isDragging
                        ? containerStyles[variant].active
                        : state === 'error'
                            ? containerStyles[variant].error
                            : state === 'success' && preview
                                ? containerStyles[variant].success
                                : containerStyles[variant].idle
                    }
                `}
            >
                {/* State: Loading */}
                {state === 'loading' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10">
                        <Loader2 className="w-10 h-10 text-black animate-spin mb-3" />
                        <span className="text-sm font-black uppercase tracking-widest text-black">Subiendo...</span>
                    </div>
                )}

                {/* State: Preview/Success */}
                {state === 'success' && preview && (
                    <div className="relative w-full h-full min-h-[200px]">
                        <img
                            src={preview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                        />
                        {/* Remove Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemove();
                            }}
                            className="absolute z-20 top-3 right-3 p-2 bg-white border-2 border-red-600 text-red-600 shadow-[2px_2px_0px_0px_rgba(220,38,38,1)] hover:bg-red-600 hover:text-white hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(220,38,38,1)] active:translate-y-0 active:shadow-none transition-all"
                            title="Eliminar imagen"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        {/* Change overlay on hover */}
                        <div className="absolute inset-0 bg-black/0 hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                            <span className="px-4 py-2 bg-white border-2 border-black text-black font-black text-xs uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                Cambiar Imagen
                            </span>
                        </div>
                    </div>
                )}

                {/* State: Idle or Error */}
                {(state === 'idle' || state === 'error') && !preview && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                        {state === 'error' ? (
                            <>
                                <div className="w-16 h-16 border-2 border-red-500 flex items-center justify-center mb-4">
                                    <AlertCircle className="w-8 h-8 text-red-500" />
                                </div>
                                <p className="text-sm font-black uppercase text-red-600 mb-2">{error}</p>
                                <p className="text-xs text-neutral-500">Click para reintentar</p>
                            </>
                        ) : (
                            <>
                                {variant === 'brutal' ? (
                                    <div className="w-16 h-16 border-2 border-black flex items-center justify-center mb-4 group-hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-shadow">
                                        {isDragging ? (
                                            <ImageIcon className="w-8 h-8 text-black" />
                                        ) : (
                                            <Upload className="w-8 h-8 text-black" />
                                        )}
                                    </div>
                                ) : (
                                    <div className="mb-4">
                                        <Upload className="w-8 h-8 text-gray-400" />
                                    </div>
                                )}

                                <p className={`text-sm font-black uppercase tracking-wide ${variant === 'minimal' ? 'text-gray-500 font-normal normal-case' : 'text-black'}`}>
                                    {placeholder}
                                </p>
                                <p className="text-xs text-neutral-500 mt-2">PNG, JPG, WEBP • Máx 5MB</p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {isCropModalOpen && imageToCropUrl && createPortal(
                <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ maxHeight: '90vh' }}>

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 flex-shrink-0">
                            <div>
                                <h2 className="text-base font-black uppercase tracking-widest text-black">Ajustar Imagen</h2>
                                <p className="text-xs text-neutral-500 mt-0.5">Mueve y reencuadra para obtener la portada perfecta</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCancelCrop}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors text-neutral-600 hover:text-black"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Crop Area */}
                        <div className="relative bg-neutral-900 flex-1" style={{ minHeight: '320px' }}>
                            <Cropper
                                image={imageToCropUrl}
                                crop={crop}
                                zoom={zoom}
                                aspect={getCropAspect()}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                                style={{
                                    containerStyle: { borderRadius: 0 },
                                    cropAreaStyle: { border: '2px solid white', boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }
                                }}
                            />
                            {/* Aspect ratio badge */}
                            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full pointer-events-none">
                                16 : 9
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="px-6 py-5 flex-shrink-0 space-y-5 bg-white">
                            {/* Zoom slider */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-neutral-500">Zoom</span>
                                    <span className="text-[11px] font-bold text-neutral-400 tabular-nums">{zoom.toFixed(1)}×</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-neutral-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                    <input
                                        type="range"
                                        value={zoom}
                                        min={1}
                                        max={3}
                                        step={0.05}
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="flex-1 h-1.5 accent-black cursor-pointer"
                                        style={{ accentColor: '#000' }}
                                    />
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-neutral-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M11 8v6M8 11h6" /></svg>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={handleCancelCrop}
                                    className="flex-1 py-3 text-sm font-black uppercase tracking-wider text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmCrop}
                                    className="flex-[2] py-3 text-sm font-black uppercase tracking-wider text-white bg-black rounded-xl hover:bg-neutral-800 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                    Confirmar y Subir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ImageUpload;

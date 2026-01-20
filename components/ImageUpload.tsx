import React, { useState, useRef, useCallback } from 'react';
import { supabaseService } from '../services/supabaseService';
import { Upload, Loader2, Trash2, ImageIcon, AlertCircle } from 'lucide-react';

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
            handleUpload(file);
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
            handleUpload(file);
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
                            className="absolute top-3 right-3 p-2 bg-white border-2 border-red-600 text-red-600 shadow-[2px_2px_0px_0px_rgba(220,38,38,1)] hover:bg-red-600 hover:text-white hover:-translate-y-1 hover:shadow-[4px_4px_0px_0px_rgba(220,38,38,1)] active:translate-y-0 active:shadow-none transition-all"
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
        </div>
    );
};

export default ImageUpload;

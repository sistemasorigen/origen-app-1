import React, { useState, useRef, useCallback, useEffect } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { Upload, Loader2, Trash2, ImageIcon, AlertCircle } from 'lucide-react';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';
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
    placeholder = 'Subí una imagen',
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
    useBloqueoDeFondo(isCropModalOpen);
    const [imageToCropUrl, setImageToCropUrl] = useState<string | null>(null);

    // Escape cierra el recorte, igual que las confirmaciones del panel.
    useEffect(() => {
        if (!isCropModalOpen) return;
        const alSalir = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsCropModalOpen(false);
                setImageToCropUrl(null);
            }
        };
        window.addEventListener('keydown', alSalir);
        return () => window.removeEventListener('keydown', alSalir);
    }, [isCropModalOpen]);

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

    /**
     * La caja, en los cuatro estados. Es el mismo lenguaje del panel de
     * administración: relleno gris claro, esquinas de 20, tipografía sobria.
     * Antes tenía borde negro punteado, sombra dura y versalitas, un estilo
     * que la app ya no usa en ninguna otra pantalla.
     *
     * `variant` quedó sin efecto a propósito: las dos variantes de antes
     * (brutal y minimal) se ven igual ahora, y sacar la prop obligaría a
     * tocar las pantallas que todavía la pasan.
     */
    const cajaSegunEstado = {
        idle: 'bg-[#f7f7f5] hover:bg-[#f2f2f0] dark:bg-[#232322] dark:hover:bg-[#2b2b2a]',
        active: 'bg-[#eceae6] ring-2 ring-[#0a0a0a] dark:bg-[#2b2b2a] dark:ring-white',
        error: 'bg-[#fdecea] dark:bg-[#3a201e]',
        success: 'bg-[#eceae6] dark:bg-[#232322]'
    };

    const proporcionDelRecorte = aspectRatio === 'square'
        ? '1 : 1'
        : aspectRatio === 'wide' ? '16 : 9' : '4 : 3';

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

            {/* La caja */}
            <div
                role="button"
                tabIndex={state === 'loading' ? -1 : 0}
                aria-label={preview ? 'Cambiar la imagen' : placeholder}
                onClick={handleClick}
                onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick();
                    }
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                    relative flex cursor-pointer flex-col items-center justify-center overflow-hidden
                    rounded-[20px] transition-colors
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2
                    ${aspectClasses[aspectRatio]}
                    ${isDragging
                        ? cajaSegunEstado.active
                        : state === 'error'
                            ? cajaSegunEstado.error
                            : state === 'success' && preview
                                ? cajaSegunEstado.success
                                : cajaSegunEstado.idle
                    }
                `}
            >
                {/* Subiendo */}
                {state === 'loading' && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/85 dark:bg-[#1b1b1a]/85">
                        <Loader2 className="mb-2.5 h-7 w-7 animate-spin text-black/25" />
                        <span className="text-[12.5px] font-semibold text-[#0a0a0a] dark:text-white">Subiendo…</span>
                    </div>
                )}

                {/* Con imagen */}
                {state === 'success' && preview && (
                    <div className="relative h-full min-h-[200px] w-full">
                        <img
                            src={preview}
                            alt=""
                            className="h-full w-full object-cover"
                        />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemove();
                            }}
                            aria-label="Quitar la imagen"
                            title="Quitar la imagen"
                            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#a32218] shadow-[0_1px_6px_rgba(10,10,10,.18)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a32218] focus-visible:ring-offset-2"
                        >
                            <Trash2 className="h-[15px] w-[15px]" />
                        </button>
                        {/* Al pasar el mouse se ofrece el cambio; en el teléfono
                            alcanza con tocar la imagen. */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity hover:bg-[rgba(10,10,10,.42)] hover:opacity-100">
                            <span className="flex h-9 items-center rounded-full bg-white px-4 text-[12.5px] font-semibold text-[#0a0a0a]">
                                Cambiar la imagen
                            </span>
                        </div>
                    </div>
                )}

                {/* Vacía o con error */}
                {(state === 'idle' || state === 'error') && !preview && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                        {state === 'error' ? (
                            <>
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-white text-[#a32218] dark:bg-white/10 dark:text-[#f0a49c]">
                                    <AlertCircle className="h-[19px] w-[19px]" />
                                </div>
                                <p className="text-[13px] font-semibold text-[#a32218] dark:text-[#f0a49c]">{error}</p>
                                <p className="mt-1.5 text-[11.5px] font-medium text-black/[.55] dark:text-white/[.55]">Tocá para probar de nuevo</p>
                            </>
                        ) : (
                            <>
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[14px] bg-white text-black/[.6] dark:bg-white/10 dark:text-white/70">
                                    {isDragging
                                        ? <ImageIcon className="h-[19px] w-[19px]" />
                                        : <Upload className="h-[19px] w-[19px]" />}
                                </div>
                                <p className="text-[13.5px] font-semibold text-[#0a0a0a] dark:text-white">{placeholder}</p>
                                <p className="mt-1.5 text-[11.5px] font-medium leading-[1.5] text-black/[.55] dark:text-white/[.55]">
                                    Tocá acá o arrastrá el archivo · PNG, JPG o WEBP, hasta 5 MB
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Recorte. Misma hoja que las confirmaciones del panel: sube
                desde abajo en el teléfono y se centra en escritorio. */}
            {isCropModalOpen && imageToCropUrl && createPortal(
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Ajustar la imagen"
                    onClick={handleCancelCrop}
                    className="fixed inset-0 z-[99999] flex items-end justify-center bg-[rgba(10,10,10,.42)] p-0 md:items-center md:p-10"
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[24px] bg-white md:max-w-[560px] md:rounded-[24px]"
                    >
                        <div className="flex flex-none items-start gap-3 px-6 pb-4 pt-6">
                            <div className="min-w-0 flex-1">
                                <h2 className="text-[20px] font-semibold leading-[1.35] tracking-[-0.018em] text-[#0a0a0a]">
                                    Ajustar la imagen
                                </h2>
                                <p className="mt-1.5 text-[13px] font-medium leading-[1.55] text-black/[.62]">
                                    Arrastrá para elegir qué parte se ve y usá el zoom para acercarla.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCancelCrop}
                                aria-label="Cerrar sin recortar"
                                className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-black/[.6] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                <svg className="h-[15px] w-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="relative min-h-[280px] flex-1 bg-[#0a0a0a]">
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
                                    cropAreaStyle: { border: '1.5px solid rgba(255,255,255,.92)', boxShadow: '0 0 0 9999px rgba(10,10,10,.55)' }
                                }}
                            />
                            <span className="pointer-events-none absolute left-3 top-3 flex h-[22px] items-center rounded-full bg-[rgba(10,10,10,.55)] px-2.5 text-[11px] font-semibold tabular-nums text-white">
                                {proporcionDelRecorte}
                            </span>
                        </div>

                        <div className="flex-none px-6 pb-[22px] pt-4">
                            <div className="flex items-center gap-2.5">
                                <span className="flex-none text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.55]">
                                    Zoom
                                </span>
                                <input
                                    type="range"
                                    value={zoom}
                                    min={1}
                                    max={3}
                                    step={0.05}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    aria-label="Zoom del recorte"
                                    className="h-1.5 min-w-0 flex-1 cursor-pointer"
                                    style={{ accentColor: '#0a0a0a' }}
                                />
                                <span className="w-[42px] flex-none text-right text-[12px] font-semibold tabular-nums text-black/[.55]">
                                    {zoom.toFixed(1)}×
                                </span>
                            </div>

                            <div className="mt-5 flex flex-col gap-2.5">
                                <button
                                    type="button"
                                    onClick={handleConfirmCrop}
                                    className="h-[52px] w-full rounded-full bg-[#0a0a0a] text-[14.5px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                >
                                    Confirmar y subir
                                </button>
                                <button
                                    type="button"
                                    onClick={handleCancelCrop}
                                    className="h-[52px] w-full rounded-full bg-[#f2f2f0] text-[14.5px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                >
                                    Cancelar
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

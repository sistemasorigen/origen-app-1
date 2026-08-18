import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { createPortal } from 'react-dom';
import getCroppedImg from '../../src/utils/cropImage';
import { supabaseService } from '../../services/supabaseService';
import { Camera, Loader2, X } from 'lucide-react';

interface AvatarUploadProps {
    currentAvatarUrl?: string;
    userName: string;
    userId: string;
    onUploadComplete: (url: string) => void;
    size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 80, md: 120, lg: 160 };

const AvatarUpload: React.FC<AvatarUploadProps> = ({
    currentAvatarUrl,
    userName,
    userId,
    onUploadComplete,
    size = 'lg',
}) => {
    const px = SIZES[size];
    const inputRef = useRef<HTMLInputElement>(null);

    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedPixels, setCroppedPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);

    const onCropComplete = useCallback((_: unknown, pixels: { x: number; y: number; width: number; height: number }) => {
        setCroppedPixels(pixels);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setUploadError('Solo se permiten imágenes.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setUploadError('La imagen no puede superar 5MB.');
            return;
        }

        setUploadError(null);
        const url = URL.createObjectURL(file);
        setImageToCrop(url);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setIsModalOpen(true);

        if (inputRef.current) inputRef.current.value = '';
    };

    const handleConfirmCrop = async () => {
        if (!imageToCrop || !croppedPixels) return;

        setIsUploading(true);
        setUploadError(null);

        try {
            const croppedFile = await getCroppedImg(imageToCrop, croppedPixels, 0);
            if (!croppedFile) throw new Error('Error al recortar.');

            const url = await supabaseService.uploadImage(croppedFile, `avatars/${userId}`);
            if (!url) throw new Error('No se obtuvo URL.');

            onUploadComplete(url);
            setIsModalOpen(false);
            setImageToCrop(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al subir foto.';
            setUploadError(message);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCancelCrop = () => {
        setIsModalOpen(false);
        setImageToCrop(null);
        setUploadError(null);
    };

    const initials = userName
        .split(' ')
        .map(w => w[0])
        .join('')
        .substring(0, 2)
        .toUpperCase() || 'US';

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
            />

            <div className="flex flex-col items-center gap-3">
                <div
                    className="relative cursor-pointer group"
                    style={{ width: px, height: px }}
                    onClick={() => inputRef.current?.click()}
                    title="Cambiar foto de perfil"
                >
                    <div
                        className="w-full h-full rounded-full overflow-hidden ring-1 ring-slate-200 dark:ring-zinc-700 shadow-sm group-hover:ring-slate-300 dark:group-hover:ring-zinc-600 transition-all"
                        style={{ width: px, height: px }}
                    >
                        {currentAvatarUrl ? (
                            <img
                                src={currentAvatarUrl}
                                alt={userName}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                                <span
                                    className="text-slate-400 dark:text-zinc-500 font-light tracking-[-0.02em]"
                                    style={{ fontSize: px * 0.28 }}
                                >
                                    {initials}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <Camera
                            className="text-white drop-shadow-md"
                            style={{ width: px * 0.3, height: px * 0.3 }}
                        />
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="px-3.5 py-2 rounded-full border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10 dark:focus-visible:ring-white/10"
                >
                    {currentAvatarUrl ? 'Cambiar foto' : 'Subir foto'}
                </button>

                {/* Los requisitos del archivo sólo hacen falta antes de la
                    primera foto: ahí explican qué se puede subir. Con una foto
                    ya puesta pasan a ser letra chica permanente en el panel de
                    identidad, y los casos borde ya los cubren los mensajes de
                    error de handleFileChange. */}
                {!currentAvatarUrl && (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-normal text-center leading-relaxed">
                        JPG, PNG o WEBP · Máx 5MB
                    </p>
                )}

                {uploadError && (
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 text-center max-w-[200px]">
                        {uploadError}
                    </p>
                )}
            </div>

            {isModalOpen && imageToCrop && createPortal(
                <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div
                        className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-zinc-800"
                        style={{ maxHeight: '90vh' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-zinc-800 shrink-0">
                            <div>
                                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                                    Ajustar foto
                                </h2>
                                <p className="text-sm font-normal text-slate-600 dark:text-zinc-300 mt-1">
                                    Mové y hacé zoom para centrar tu cara.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCancelCrop}
                                aria-label="Cerrar"
                                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Crop area */}
                        <div className="relative bg-neutral-950 flex-1" style={{ minHeight: 320 }}>
                            <Cropper
                                image={imageToCrop}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                cropShape="round"
                                showGrid={false}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                                style={{
                                    containerStyle: { borderRadius: 0 },
                                    cropAreaStyle: {
                                        border: '3px solid white',
                                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
                                    },
                                }}
                            />
                            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full pointer-events-none">
                                Circular · 1:1
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="px-5 py-4 shrink-0 space-y-4 bg-white dark:bg-zinc-900">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                                        Zoom
                                    </span>
                                    <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 tabular-nums">
                                        {zoom.toFixed(1)}×
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.05}
                                    value={zoom}
                                    aria-label="Zoom de la foto"
                                    onChange={e => setZoom(Number(e.target.value))}
                                    className="w-full h-1.5 cursor-pointer accent-emerald-600"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCancelCrop}
                                    disabled={isUploading}
                                    className="flex-1 py-3 rounded-xl text-sm font-semibold text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 active:scale-[0.98] transition-all disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmCrop}
                                    disabled={isUploading}
                                    className="flex-[2] py-3 rounded-xl text-sm font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-black dark:hover:bg-slate-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20"
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Subiendo...
                                        </>
                                    ) : (
                                        'Guardar foto'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default AvatarUpload;

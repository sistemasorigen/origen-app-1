import React, { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { createPortal } from 'react-dom';
import getCroppedImg from '../src/utils/cropImage';
import { supabaseService } from '../services/supabaseService';
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
                        className="w-full h-full rounded-full overflow-hidden border-4 border-black dark:border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)] transition-shadow"
                        style={{ width: px, height: px }}
                    >
                        {currentAvatarUrl ? (
                            <img
                                src={currentAvatarUrl}
                                alt={userName}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-black dark:bg-white flex items-center justify-center">
                                <span
                                    className="text-white dark:text-black font-black"
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
                    className="text-xs font-bold text-black dark:text-white underline underline-offset-2 hover:opacity-60 transition-opacity uppercase tracking-wide"
                >
                    {currentAvatarUrl ? 'Cambiar foto' : 'Subir foto'}
                </button>

                <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-medium text-center leading-relaxed">
                    JPG, PNG o WEBP · Máx 5MB<br />
                    Se recortará en formato circular
                </p>

                {uploadError && (
                    <p className="text-xs font-bold text-red-600 dark:text-red-400 text-center max-w-[200px]">
                        {uploadError}
                    </p>
                )}
            </div>

            {isModalOpen && imageToCrop && createPortal(
                <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div
                        className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col border-2 border-black dark:border-zinc-700"
                        style={{ maxHeight: '90vh' }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black dark:border-zinc-700 shrink-0">
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-widest text-black dark:text-white">
                                    Ajustar Foto
                                </h2>
                                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                                    Mové y hacé zoom para centrar tu cara
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCancelCrop}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-neutral-100 dark:bg-zinc-800 hover:bg-neutral-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                                <X className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
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
                            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full pointer-events-none">
                                Circular · 1:1
                            </div>
                        </div>

                        {/* Controls */}
                        <div className="px-5 py-4 shrink-0 space-y-4 bg-white dark:bg-zinc-900">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                                        Zoom
                                    </span>
                                    <span className="text-[10px] font-bold text-neutral-400 tabular-nums">
                                        {zoom.toFixed(1)}×
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.05}
                                    value={zoom}
                                    onChange={e => setZoom(Number(e.target.value))}
                                    className="w-full h-1.5 cursor-pointer accent-black dark:accent-white"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleCancelCrop}
                                    disabled={isUploading}
                                    className="flex-1 py-3 text-sm font-black uppercase tracking-wide text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-zinc-800 hover:bg-neutral-200 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmCrop}
                                    disabled={isUploading}
                                    className="flex-[2] py-3 text-sm font-black uppercase tracking-wide text-white bg-black dark:bg-white dark:text-black rounded-xl hover:opacity-80 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

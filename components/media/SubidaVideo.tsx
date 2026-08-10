import React, { useState, useRef, useCallback } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { Upload, Loader2, Trash2, AlertCircle, Film } from 'lucide-react';

interface VideoUploadProps {
    /** Se dispara con la URL pública al subir, y con '' al quitar el video */
    onVideoUpload: (url: string) => void;
    /** URL actual (para previsualizar) */
    currentVideo?: string;
    /** Carpeta dentro del bucket (ej: 'banners') */
    folder?: string;
    className?: string;
}

type UploadState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Subida de video para los slides del hero.
 *
 * Hermano de SubidaImagen, pero deliberadamente sin recorte: un video no se
 * puede reencuadrar en el navegador sin recodificarlo, así que el encuadre
 * es responsabilidad de quien lo exporta. El preview va muteado y en loop,
 * igual que se va a ver en el banner, para que el admin vea el resultado
 * real antes de guardar.
 */
const VideoUpload: React.FC<VideoUploadProps> = ({
    onVideoUpload,
    currentVideo,
    folder = '',
    className = ''
}) => {
    const [state, setState] = useState<UploadState>(currentVideo ? 'success' : 'idle');
    const [preview, setPreview] = useState<string | null>(currentVideo || null);
    const [error, setError] = useState<string | null>(null);
    const [formatWarning, setFormatWarning] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleUpload = useCallback(async (file: File) => {
        setState('loading');
        setError(null);
        // El .mov es el formato que sale del iPhone. Safari y Chrome suelen
        // reproducirlo, Firefox no. No se rechaza —obligaría a convertir a
        // mano antes de poder probar— pero se avisa: sin aviso el banner
        // simplemente se quedaría en el poster para una parte de la gente,
        // sin ningún error visible.
        setFormatWarning(
            file.type === 'video/quicktime'
                ? 'Este es un .mov y Firefox no lo reproduce: ahí se va a ver la imagen de respaldo. Convertilo a MP4 (H.264) para que ande en todos los navegadores.'
                : null
        );
        try {
            // La validación de tipo y tamaño vive en el servicio, así que es
            // la misma se suba desde acá o desde cualquier otra pantalla.
            const url = await supabaseService.uploadVideo(file, folder);
            setPreview(url);
            setState('success');
            onVideoUpload(url);
        } catch (err) {
            console.error('[VideoUpload] Error:', err);
            setError(err instanceof Error ? err.message : 'Error al subir el video');
            setState('error');
        }
    }, [folder, onVideoUpload]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleUpload(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleUpload(file);
    };

    const handleRemove = () => {
        setPreview(null);
        setState('idle');
        setError(null);
        setFormatWarning(null);
        onVideoUpload('');
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <div className={`relative ${className}`}>
            <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleFileSelect}
                className="hidden"
            />

            <div
                onClick={() => { if (state !== 'loading' && !preview) inputRef.current?.click(); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                onDrop={handleDrop}
                className={`relative overflow-hidden transition-all duration-200 border-2 rounded-xl flex flex-col items-center justify-center aspect-video
                    ${isDragging
                        ? 'border-black bg-neutral-100 scale-[1.02]'
                        : state === 'error'
                            ? 'border-red-500 border-dashed bg-red-50'
                            : state === 'success' && preview
                                ? 'border-black bg-black'
                                : 'border-black border-dashed bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-neutral-50'
                    }`}
            >
                {state === 'loading' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10">
                        <Loader2 className="w-10 h-10 text-black animate-spin mb-3" />
                        <span className="text-sm font-black uppercase tracking-widest text-black">Subiendo video...</span>
                    </div>
                )}

                {state === 'success' && preview && (
                    <div className="relative w-full h-full">
                        <video
                            src={preview}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            playsInline
                            autoPlay
                        />
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleRemove(); }}
                            className="absolute z-20 top-3 right-3 p-2 bg-white border-2 border-red-600 text-red-600 shadow-[2px_2px_0px_0px_rgba(220,38,38,1)] hover:bg-red-600 hover:text-white transition-all"
                            title="Quitar video"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                            className="absolute z-20 bottom-3 left-3 px-3 py-1.5 bg-white border-2 border-black text-black font-black text-[10px] uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-neutral-100 transition-all"
                        >
                            Cambiar video
                        </button>
                    </div>
                )}

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
                                <div className="w-16 h-16 border-2 border-black flex items-center justify-center mb-4">
                                    {isDragging ? <Film className="w-8 h-8 text-black" /> : <Upload className="w-8 h-8 text-black" />}
                                </div>
                                <p className="text-sm font-black uppercase tracking-wide text-black">
                                    Click o arrastrá tu video
                                </p>
                                <p className="text-xs text-neutral-500 mt-2">MP4 (recomendado), WEBM, MOV • Máx 25MB</p>
                            </>
                        )}
                    </div>
                )}
            </div>

            {formatWarning && state === 'success' && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-amber-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    {formatWarning}
                </p>
            )}
        </div>
    );
};

export default VideoUpload;

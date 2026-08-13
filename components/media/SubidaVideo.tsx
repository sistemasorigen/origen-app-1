import React, { useState, useRef, useCallback, useEffect } from 'react';
import { supabaseService } from '../../services/supabaseService';
import { Upload, Loader2, Trash2, AlertCircle, Film, Play, Pause, Check, X } from 'lucide-react';

interface VideoUploadProps {
    /** Se dispara con la URL pública al subir, y con '' al quitar el video */
    onVideoUpload: (url: string) => void;
    /** URL actual (para previsualizar) */
    currentVideo?: string;
    /** Carpeta dentro del bucket (ej: 'banners') */
    folder?: string;
    className?: string;
}

type Stage = 'idle' | 'reading' | 'trimming' | 'extracting' | 'uploading' | 'success' | 'error';

// El archivo que el usuario elige puede pesar hasta esto — nunca se sube
// entero, solo se lee localmente en el navegador para recortar 5s de él.
// El tope real de subida (supabaseService.uploadVideo) aplica al clip ya
// recortado, que siempre pesa unos pocos MB.
const MAX_SOURCE_SIZE = 500 * 1024 * 1024;
const CLIP_DURATION = 5; // segundos, fijo — el usuario elige DÓNDE, no cuánto
const CLIP_MAX_WIDTH = 1280; // el banner nunca se ve a más resolución que esto

const formatTime = (s: number) => {
    const safe = Math.max(0, s);
    const m = Math.floor(safe / 60);
    const sec = Math.floor(safe % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
};

/**
 * Recorta `durationSec` segundos de `video` arrancando en `start`, dibujando
 * cada frame a un canvas y grabándolo con MediaRecorder. No hay forma de
 * cortar un archivo de video en el navegador sin decodificarlo y volver a
 * codificarlo, así que el resultado siempre es webm/vp9 sin importar el
 * formato de origen — lo que de paso elimina el problema de ".mov no anda
 * en Firefox" para cualquier clip que pasó por acá. Mudo a propósito: todo
 * video de banner en la app se reproduce muted/loop, no hay audio que capturar.
 */
async function extractClip(
    video: HTMLVideoElement,
    start: number,
    durationSec: number,
    maxWidth: number
): Promise<Blob> {
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
        .find(t => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
    if (!mimeType) {
        throw new Error('Este navegador no puede generar el clip. Probá con Chrome, Edge o Firefox actualizados.');
    }

    const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale) || maxWidth;
    canvas.height = Math.round(video.videoHeight * scale) || Math.round(maxWidth * 9 / 16);
    const ctx = canvas.getContext('2d');
    if (!ctx || typeof canvas.captureStream !== 'function') {
        throw new Error('Este navegador no puede generar el clip. Probá con Chrome, Edge o Firefox actualizados.');
    }

    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const finished = new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder.onerror = () => reject(new Error('Error grabando el clip.'));
    });

    video.muted = true;
    video.currentTime = start;
    await new Promise<void>(resolve => {
        const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve(); };
        video.addEventListener('seeked', onSeeked);
    });
    // Primer frame dibujado antes de arrancar a grabar — sin esto el
    // arranque de la grabación podía capturar un instante de canvas vacío.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    recorder.start();
    await video.play();

    await new Promise<void>(resolve => {
        const step = () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            if (video.currentTime < start + durationSec && !video.paused && !video.ended) {
                requestAnimationFrame(step);
            } else {
                resolve();
            }
        };
        step();
    });

    video.pause();
    recorder.stop();

    return finished;
}

/**
 * Subida de video para los slides del hero (y de cualquier banner que
 * reuse este componente: Niñez, Origen Música).
 *
 * Hermano de SubidaImagen, pero deliberadamente sin recorte de encuadre: un
 * video no se puede reencuadrar en el navegador sin recodificarlo, así que
 * el framing (EncuadreMedia) es un paso aparte, después de subir. Lo que sí
 * hace este componente es un recorte TEMPORAL: el archivo elegido puede
 * pesar hasta 500MB, pero nunca se sube entero — el usuario elige 5
 * segundos de cualquier parte con una vista previa en vivo, y solo esos 5s
 * (recodificados a un clip liviano) terminan en Supabase Storage.
 */
const VideoUpload: React.FC<VideoUploadProps> = ({
    onVideoUpload,
    currentVideo,
    folder = '',
    className = ''
}) => {
    const [stage, setStage] = useState<Stage>(currentVideo ? 'success' : 'idle');
    const [preview, setPreview] = useState<string | null>(currentVideo || null);
    const [error, setError] = useState<string | null>(null);
    const [formatWarning, setFormatWarning] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // --- Paso de recorte: del archivo elegido al clip de 5s ---
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [sourceUrl, setSourceUrl] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const [trimStart, setTrimStart] = useState(0);
    const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
    const trimVideoRef = useRef<HTMLVideoElement>(null);
    const scrubBarRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);

    const cleanupSource = useCallback(() => {
        setSourceUrl(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
        setSourceFile(null);
    }, []);

    // Libera el object URL del archivo fuente si el componente se desmonta
    // a mitad de un recorte (ej: se cierra el modal del editor).
    useEffect(() => () => cleanupSource(), [cleanupSource]);

    const uploadFile = useCallback(async (fileToUpload: File, wasTrimmed: boolean) => {
        setStage('uploading');
        setError(null);
        // El aviso de .mov solo aplica si el archivo original se sube tal
        // cual (duraba ≤5s). Un clip recortado siempre sale en webm, así
        // que el problema de compatibilidad ya no existe para esos casos.
        setFormatWarning(
            !wasTrimmed && fileToUpload.type === 'video/quicktime'
                ? 'Este es un .mov y Firefox no lo reproduce: ahí se va a ver la imagen de respaldo. Convertilo a MP4 (H.264) para que ande en todos los navegadores.'
                : null
        );
        try {
            const url = await supabaseService.uploadVideo(fileToUpload, folder);
            setPreview(url);
            setStage('success');
            onVideoUpload(url);
            cleanupSource();
        } catch (err) {
            console.error('[VideoUpload] Error:', err);
            setError(err instanceof Error ? err.message : 'Error al subir el video');
            setStage('error');
        }
    }, [folder, onVideoUpload, cleanupSource]);

    const startFile = (file: File) => {
        // Elegir un archivo nuevo invalida cualquier intento anterior —
        // limpiar el preview acá evita que un error posterior se quede sin
        // mensaje visible por quedar tapado por un preview viejo.
        setPreview(null);
        setError(null);
        setFormatWarning(null);
        if (file.size > MAX_SOURCE_SIZE) {
            setError(`El video no puede superar los 500MB (este pesa ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
            setStage('error');
            return;
        }
        setSourceFile(file);
        setSourceUrl(URL.createObjectURL(file));
        setDuration(0);
        setTrimStart(0);
        setStage('reading');
    };

    const handleLoadedMetadata = () => {
        const video = trimVideoRef.current;
        if (!video || !sourceFile) return;
        const dur = video.duration;
        if (!isFinite(dur) || dur <= 0) {
            setError('No se pudo leer la duración del video.');
            setStage('error');
            return;
        }
        if (dur <= CLIP_DURATION) {
            // Ya dura 5s o menos: no hay nada que recortar.
            uploadFile(sourceFile, false);
            return;
        }
        setDuration(dur);
        setTrimStart(0);
        video.currentTime = 0;
        setStage('trimming');
    };

    // El navegador no siempre puede decodificar el archivo elegido (códec
    // no soportado, archivo corrupto): sin esto, un video que nunca dispara
    // loadedmetadata dejaría el componente colgado en 'reading' igual que
    // el bug original, pero por otra causa.
    const handleSourceError = () => {
        setError('No se pudo leer este archivo de video. Probá con otro formato (MP4 recomendado).');
        setStage('error');
        cleanupSource();
    };

    const clampStart = (t: number) => Math.min(Math.max(0, t), Math.max(0, duration - CLIP_DURATION));

    const seekTo = (t: number) => {
        const clamped = clampStart(t);
        setTrimStart(clamped);
        const video = trimVideoRef.current;
        if (video) video.currentTime = clamped;
    };

    const posToTime = (clientX: number) => {
        const bar = scrubBarRef.current;
        if (!bar || duration === 0) return 0;
        const rect = bar.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        return ratio * duration;
    };

    const stopPreview = () => {
        trimVideoRef.current?.pause();
        setIsPreviewPlaying(false);
    };

    const handleScrubPointerDown = (e: React.PointerEvent) => {
        if (isPreviewPlaying) stopPreview();
        draggingRef.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        seekTo(posToTime(e.clientX));
    };
    const handleScrubPointerMove = (e: React.PointerEvent) => {
        if (!draggingRef.current) return;
        seekTo(posToTime(e.clientX));
    };
    const handleScrubPointerUp = () => { draggingRef.current = false; };

    const togglePreview = async () => {
        const video = trimVideoRef.current;
        if (!video) return;
        if (isPreviewPlaying) {
            stopPreview();
            return;
        }
        video.currentTime = trimStart;
        try {
            await video.play();
            setIsPreviewPlaying(true);
        } catch {
            // Autoplay bloqueado — no debería pasar tras un click directo del usuario.
        }
    };

    // Mientras se reproduce la vista previa, hace loop dentro de la ventana de 5s.
    useEffect(() => {
        const video = trimVideoRef.current;
        if (!video || !isPreviewPlaying) return;
        const onTimeUpdate = () => {
            if (video.currentTime >= trimStart + CLIP_DURATION) {
                video.currentTime = trimStart;
            }
        };
        const onEnded = () => setIsPreviewPlaying(false);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('ended', onEnded);
        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('ended', onEnded);
        };
    }, [isPreviewPlaying, trimStart]);

    const handleCancelTrim = () => {
        stopPreview();
        cleanupSource();
        setStage('idle');
        setDuration(0);
        setTrimStart(0);
    };

    const handleConfirmTrim = async () => {
        const video = trimVideoRef.current;
        const file = sourceFile;
        if (!video || !file) return;
        stopPreview();
        setStage('extracting');
        try {
            const blob = await extractClip(video, trimStart, CLIP_DURATION, CLIP_MAX_WIDTH);
            const clipFile = new File([blob], `clip_${Date.now()}.webm`, { type: blob.type });
            await uploadFile(clipFile, true);
        } catch (err) {
            console.error('[VideoUpload] Trim error:', err);
            setError(err instanceof Error ? err.message : 'No se pudo generar el clip.');
            setStage('error');
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) startFile(file);
        e.target.value = ''; // permite re-elegir el mismo archivo más adelante
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) startFile(file);
    };

    const handleRemove = () => {
        setPreview(null);
        setStage('idle');
        setError(null);
        setFormatWarning(null);
        onVideoUpload('');
        if (inputRef.current) inputRef.current.value = '';
    };

    // El <video> de recorte tiene que estar montado desde 'reading': es el
    // propio elemento el que dispara onLoadedMetadata (o onError) y hace
    // avanzar el estado. Si solo se monta en 'trimming'/'extracting', nunca
    // llega a existir nada que dispare ese evento — el componente se queda
    // en "Leyendo video..." para siempre, sin importar cuánto se espere.
    const showTrimVideo = stage === 'reading' || stage === 'trimming' || stage === 'extracting';

    return (
        <div className={`relative ${className}`}>
            <input
                ref={inputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={handleFileSelect}
                className="hidden"
            />

            {showTrimVideo && (
                <div className="space-y-3">
                    <div className="relative overflow-hidden rounded-xl border-2 border-black bg-black aspect-video">
                        <video
                            ref={trimVideoRef}
                            src={sourceUrl || undefined}
                            onLoadedMetadata={handleLoadedMetadata}
                            onError={handleSourceError}
                            muted
                            playsInline
                            className="w-full h-full object-contain"
                        />
                        {stage === 'reading' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
                                <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                                <span className="text-xs font-black uppercase tracking-widest text-white">Leyendo video...</span>
                            </div>
                        )}
                        {stage === 'extracting' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
                                <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                                <span className="text-xs font-black uppercase tracking-widest text-white">Generando clip...</span>
                            </div>
                        )}
                    </div>

                    {stage === 'trimming' && duration > 0 && (
                        <>
                            <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500">
                                <span>Elegí desde dónde empiezan los 5s</span>
                                <span className="tabular-nums">{formatTime(trimStart)}–{formatTime(trimStart + CLIP_DURATION)} / {formatTime(duration)}</span>
                            </div>
                            <div
                                ref={scrubBarRef}
                                onPointerDown={handleScrubPointerDown}
                                onPointerMove={handleScrubPointerMove}
                                onPointerUp={handleScrubPointerUp}
                                onPointerCancel={handleScrubPointerUp}
                                className="relative h-10 bg-neutral-200 rounded-lg cursor-pointer touch-none select-none"
                            >
                                <div
                                    className="absolute top-0 bottom-0 bg-black rounded-md pointer-events-none ring-2 ring-white"
                                    style={{
                                        left: `${(trimStart / duration) * 100}%`,
                                        width: `${Math.min(100, (CLIP_DURATION / duration) * 100)}%`
                                    }}
                                />
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <button
                                    type="button"
                                    onClick={togglePreview}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 border-2 border-black text-xs font-black uppercase hover:bg-neutral-100 transition-all"
                                >
                                    {isPreviewPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                    {isPreviewPlaying ? 'Pausar' : 'Probar'}
                                </button>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCancelTrim}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 border-2 border-slate-200 text-xs font-black uppercase text-neutral-500 hover:border-black hover:text-black transition-all"
                                    >
                                        <X className="w-3.5 h-3.5" /> Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmTrim}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-black text-white text-xs font-black uppercase hover:bg-neutral-800 transition-all"
                                    >
                                        <Check className="w-3.5 h-3.5" /> Usar este clip
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {!showTrimVideo && (
                <div
                    onClick={() => { if (stage !== 'uploading' && !preview) inputRef.current?.click(); }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                    onDrop={handleDrop}
                    className={`relative overflow-hidden transition-all duration-200 border-2 rounded-xl flex flex-col items-center justify-center aspect-video
                        ${isDragging
                            ? 'border-black bg-neutral-100 scale-[1.02]'
                            : stage === 'error'
                                ? 'border-red-500 border-dashed bg-red-50'
                                : stage === 'success' && preview
                                    ? 'border-black bg-black'
                                    : 'border-black border-dashed bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:bg-neutral-50'
                        }`}
                >
                    {stage === 'uploading' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10">
                            <Loader2 className="w-10 h-10 text-black animate-spin mb-3" />
                            <span className="text-sm font-black uppercase tracking-widest text-black">Subiendo video...</span>
                        </div>
                    )}

                    {stage === 'success' && preview && (
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

                    {(stage === 'idle' || stage === 'error') && !preview && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                            {stage === 'error' ? (
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
                                    <p className="text-xs text-neutral-500 mt-2">MP4 (recomendado), WEBM, MOV • Máx 500MB — se recorta a 5s antes de subir</p>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {formatWarning && stage === 'success' && (
                <p className="mt-2 flex items-start gap-1.5 text-[11px] font-semibold text-amber-700">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    {formatWarning}
                </p>
            )}
        </div>
    );
};

export default VideoUpload;

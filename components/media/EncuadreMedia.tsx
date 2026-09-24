import React, { useRef, useState } from 'react';
import { Crosshair, ZoomIn } from 'lucide-react';
import { getMediaFrameStyle } from '../ui/CarruselHero';

export interface MediaFrame {
    focalX: number;  // 0-100
    focalY: number;  // 0-100
    zoom: number;    // 1-3
}

interface EncuadreMediaProps {
    mediaType?: 'image' | 'video';
    imageUrl?: string;
    videoUrl?: string;
    /** Proporción del marco. Sin esto no hay nada que encuadrar. */
    frameWidth: number;
    frameHeight: number;
    value: MediaFrame;
    onChange: (next: MediaFrame) => void;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/**
 * Editor de encuadre para los slides del banner.
 *
 * El problema que resuelve: el archivo casi nunca tiene la proporción del
 * banner, así que sobra imagen y el navegador recorta por el centro — que
 * rara vez es donde está lo importante. Acá se elige qué parte sobrevive.
 *
 * Funciona igual para imagen y para video. Un video no se puede recortar de
 * verdad en el navegador (habría que recodificarlo), pero sí decidir qué
 * porción se ve, que es lo mismo desde el lado del que mira.
 *
 * El preview usa `getMediaFrameStyle`, la misma función que el banner real,
 * así que lo que se ve acá es exactamente lo que se va a publicar.
 */
const EncuadreMedia: React.FC<EncuadreMediaProps> = ({
    mediaType,
    imageUrl,
    videoUrl,
    frameWidth,
    frameHeight,
    value,
    onChange
}) => {
    const boxRef = useRef<HTMLDivElement>(null);
    const lastPointer = useRef<{ x: number; y: number } | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const isVideo = mediaType === 'video' && !!videoUrl;
    const hasMedia = isVideo || !!imageUrl;

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!hasMedia) return;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        lastPointer.current = { x: e.clientX, y: e.clientY };
        setIsDragging(true);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging || !lastPointer.current || !boxRef.current) return;
        const rect = boxRef.current.getBoundingClientRect();
        const dx = ((e.clientX - lastPointer.current.x) / rect.width) * 100;
        const dy = ((e.clientY - lastPointer.current.y) / rect.height) * 100;
        lastPointer.current = { x: e.clientX, y: e.clientY };
        // Invertido a propósito: se arrastra el medio, no el recuadro. Llevar
        // el puntero a la derecha corre la imagen a la derecha, o sea que se
        // destapa lo que estaba a la izquierda — el punto focal baja.
        onChange({
            ...value,
            focalX: clamp(value.focalX - dx),
            focalY: clamp(value.focalY - dy)
        });
    };

    const handlePointerUp = () => {
        setIsDragging(false);
        lastPointer.current = null;
    };

    const reset = () => onChange({ focalX: 50, focalY: 50, zoom: 1 });

    const frameStyle = getMediaFrameStyle(value);

    return (
        <div>
            <div
                ref={boxRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                style={{ aspectRatio: `${frameWidth} / ${frameHeight}` }}
                className={`relative w-full select-none touch-none overflow-hidden rounded-[16px] bg-[#eceae6] dark:bg-[#232322] ${hasMedia ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
                    }`}
            >
                {isVideo ? (
                    <video
                        src={videoUrl}
                        poster={imageUrl || undefined}
                        muted
                        loop
                        autoPlay
                        playsInline
                        style={frameStyle}
                        className="w-full h-full object-cover pointer-events-none"
                    />
                ) : imageUrl ? (
                    <img
                        src={imageUrl}
                        alt=""
                        style={frameStyle}
                        className="w-full h-full object-cover pointer-events-none"
                        draggable={false}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[12.5px] font-medium text-black/[.5] dark:text-white/[.5]">
                        Cargá una imagen o un video para encuadrarlo
                    </div>
                )}

                {/* Guías de tercios: aparecen sólo mientras se arrastra, para
                    ayudar a componer sin ensuciar el preview el resto del tiempo. */}
                {isDragging && (
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/40" />
                        <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/40" />
                        <div className="absolute top-1/3 left-0 right-0 h-px bg-white/40" />
                        <div className="absolute top-2/3 left-0 right-0 h-px bg-white/40" />
                    </div>
                )}

                {hasMedia && (
                    <span className="pointer-events-none absolute bottom-2.5 right-2.5 flex h-[22px] items-center rounded-full bg-[rgba(10,10,10,.55)] px-2.5 text-[11px] font-semibold tabular-nums text-white">
                        {frameWidth} × {frameHeight}
                    </span>
                )}
            </div>

            {hasMedia && (
                <>
                    <p className="mt-2 text-[12px] font-medium leading-[1.5] text-black/[.6] dark:text-white/[.6]">
                        Arrastrá sobre la vista previa para elegir qué parte se ve.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2.5">
                        <div className="flex min-w-[180px] flex-1 items-center gap-2.5">
                            <ZoomIn className="h-4 w-4 flex-none text-black/[.45] dark:text-white/[.45]" />
                            <input
                                type="range"
                                min={1}
                                max={3}
                                step={0.05}
                                value={value.zoom}
                                onChange={e => onChange({ ...value, zoom: Number(e.target.value) })}
                                className="h-1.5 min-w-0 flex-1 cursor-pointer"
                                style={{ accentColor: '#0a0a0a' }}
                                aria-label="Zoom del encuadre"
                            />
                            <span className="w-[42px] flex-none text-right text-[12px] font-semibold tabular-nums text-black/[.55] dark:text-white/[.55]">
                                {value.zoom.toFixed(2)}×
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={reset}
                            title="Centrar y quitar el zoom"
                            className="flex h-9 flex-none items-center gap-1.5 rounded-full bg-[#f2f2f0] px-3.5 text-[12px] font-semibold text-black/[.66] transition-colors hover:text-[#0a0a0a] dark:bg-white/10 dark:text-white/[.75] dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            <Crosshair className="h-[13px] w-[13px]" /> Centrar
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default EncuadreMedia;

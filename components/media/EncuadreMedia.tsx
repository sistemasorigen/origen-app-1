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
                className={`relative w-full overflow-hidden border-2 border-black bg-neutral-900 select-none touch-none ${hasMedia ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
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
                    <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-xs font-bold uppercase tracking-widest">
                        Cargá un medio para encuadrarlo
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
                    <span className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-[10px] font-bold uppercase tracking-wider rounded pointer-events-none">
                        {frameWidth} × {frameHeight}
                    </span>
                )}
            </div>

            {hasMedia && (
                <>
                    <p className="text-[11px] text-neutral-500 mt-2">
                        Arrastrá sobre el preview para elegir qué parte se ve.
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                        <ZoomIn className="w-4 h-4 text-neutral-500 shrink-0" />
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.05}
                            value={value.zoom}
                            onChange={e => onChange({ ...value, zoom: Number(e.target.value) })}
                            className="flex-1 h-1.5 cursor-pointer"
                            style={{ accentColor: '#000' }}
                            aria-label="Zoom del encuadre"
                        />
                        <span className="text-[11px] font-bold text-neutral-500 tabular-nums w-10 text-right">
                            {value.zoom.toFixed(2)}×
                        </span>
                        <button
                            type="button"
                            onClick={reset}
                            title="Centrar y quitar zoom"
                            className="flex items-center gap-1 px-2.5 py-1.5 border-2 border-slate-200 text-[10px] font-bold uppercase text-neutral-600 hover:border-black hover:text-black transition-colors"
                        >
                            <Crosshair className="w-3 h-3" /> Centrar
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default EncuadreMedia;

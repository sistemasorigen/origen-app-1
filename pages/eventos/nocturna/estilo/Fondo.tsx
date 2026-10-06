import React, { useEffect, useRef } from 'react';

/**
 * El fondo: la palabra NOCTURNA, enorme y desenfocada, que se va enfocando a
 * medida que la familia avanza y queda nítida recién en la entrada.
 *
 * El desenfoque NO se anima. Son tres capas de la misma palabra —muy
 * desenfocada, poco desenfocada y nítida— que se cruzan por opacidad: animar
 * el `blur` obliga a redibujar cada cuadro y un Android de gama media se
 * traba; cruzar opacidades lo resuelve la placa de video.
 *
 * En escritorio, y sólo con mouse, la palabra se corre un poco al revés del
 * cursor. Con el dedo no hay cursor que seguir, y con "reducir movimiento"
 * no se mueve.
 */

/** Calma: en los pasos donde hay que leer o decidir algo serio, la fiesta baja el volumen. */
export type Calma = 'no' | 'baja' | 'muy';

const OPACIDAD_CALMA: Record<Calma, number> = { no: 1, baja: 0.22, muy: 0.12 };

interface Props {
    /** De 0 (la portada) a 8 (la entrada): cuánto se enfoca la palabra. */
    etapa: number;
    /** La entrada (y el cartel de cerrado): la palabra nítida, sin escala. */
    nitida: boolean;
    calma: Calma;
    /** La portada baja un poco la palabra, para que no pise el árbol. */
    portada: boolean;
    /**
     * Recién respondida la autorización o lo de las fotos: la palabra, que
     * había bajado el volumen mientras se leía, vuelve con un golpe.
     */
    encendida?: boolean;
}

const Fondo: React.FC<Props> = ({ etapa, nitida, calma, portada, encendida }) => {
    const cursor = useRef<HTMLDivElement>(null);
    const calmaRef = useRef(calma);
    calmaRef.current = calma;

    useEffect(() => {
        const conMouse = window.matchMedia('(pointer: fine) and (min-width: 1024px)');
        const reducido = window.matchMedia('(prefers-reduced-motion: reduce)');
        let cuadro = 0;
        const mover = (e: MouseEvent) => {
            const el = cursor.current;
            if (!el || !conMouse.matches || reducido.matches) return;
            if (calmaRef.current !== 'no') { el.style.transform = 'none'; return; }
            cancelAnimationFrame(cuadro);
            cuadro = requestAnimationFrame(() => {
                const dx = e.clientX / window.innerWidth - 0.5;
                const dy = e.clientY / window.innerHeight - 0.5;
                el.style.transform = `translate3d(${-dx * 60}px, ${-dy * 36}px, 0)`;
            });
        };
        window.addEventListener('mousemove', mover, { passive: true });
        return () => {
            cancelAnimationFrame(cuadro);
            window.removeEventListener('mousemove', mover);
        };
    }, []);

    const opB = nitida ? 1 : Math.min(1, etapa / 7);
    const escala = nitida ? 1 : 1.18 - etapa * 0.02;

    return (
        <div className="noc-fondo" aria-hidden="true">
            <div className={`noc-palabra${portada ? ' portada' : ''}`}>
                <div className={`noc-palabra-fundido${encendida ? ' encendida' : ''}`} style={{ opacity: OPACIDAD_CALMA[calma] }}>
                    <div ref={cursor} className="noc-palabra-cursor">
                        <div className="noc-palabra-escala" style={{ position: 'relative', transform: `scale(${escala})` }}>
                            <span className="noc-palabra-texto" style={{ filter: 'blur(var(--blur-a))' }}>NOCTURNA</span>
                            <span
                                className="noc-palabra-texto noc-palabra-capa noc-palabra-fundido"
                                style={{ filter: 'blur(var(--blur-b))', opacity: opB }}
                            >
                                NOCTURNA
                            </span>
                            <span className="noc-palabra-texto noc-palabra-capa noc-palabra-fundido" style={{ opacity: nitida ? 1 : 0 }}>
                                NOCTURNA
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Fondo;

/**
 * Las cuatro esquinas del escritorio. Por debajo de 1200 px no se ven: ahí
 * la marca y a quién está dirigida van en la fila de arriba (ver
 * InscripcionNocturna), y la fecha, en la portada.
 */
export const Esquinas: React.FC<{ aQuien: string; fecha: string; lugar: string; calma: Calma }> = ({
    aQuien, fecha, lugar, calma,
}) => {
    // Sólo la marca baja el volumen en los pasos serios. El resto es texto que
    // se lee: al 45% sobre el rosa no llega al contraste mínimo.
    const opacity = calma === 'no' ? 1 : 0.45;
    return (
        <>
            <p className="noc-esquina marca" style={{ opacity }} aria-hidden="true">Nocturna</p>
            <p className="noc-esquina a-quien">{aQuien}</p>
            <p className="noc-esquina fecha">
                {fecha}
                <br />
                <span aria-hidden="true">[ </span>{lugar}<span aria-hidden="true"> ]</span>
            </p>
            <p className="noc-esquina redes">
                @influos.ogn
                <br />
                @origeniglesia
            </p>
        </>
    );
};

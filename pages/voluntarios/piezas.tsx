// ════════════════════════════════════════════════════════════════════════
// Piezas de /voluntarios.
//
// Salen de design-claude/Voluntarios - Compra.dc.html. Los tokens van como
// objeto y en estilos en línea, igual que el .dc, y no como clases de
// Tailwind: el fondo de la pantalla CAMBIA DE COLOR en cada paso con una
// transición, y eso pide un valor calculado, no una clase fija.
//
// El modo oscuro de la app es por clase en <html> (darkMode:'class'), así
// que acá se lo mira y se lo escucha, en vez de duplicar cada color en un
// `dark:` que estos estilos en línea no entenderían.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';

// ── Los datos de la iglesia, textuales ──────────────────────────────────
export const ALIAS = 'origen.iglesia';
export const TITULAR = 'Asociación Civil Fuente de Vida';
export const CUIT = '30-70705090-6';

// ── Tokens ──────────────────────────────────────────────────────────────

export interface Tokens {
    ink: string; card: string; surf: string; chip: string; line: string;
    prim: string; primInk: string; shadow: string; red: string; warn: string;
    flash: string; track: string; dash: string; thumb: string; skel: string;
    m52: string; m38: string; m22: string;
}

export const tokens = (dk: boolean): Tokens => {
    const a = (o: number) => (dk ? `rgba(255,255,255,${o})` : `rgba(0,0,0,${o})`);
    const base = dk
        ? {
            ink: '#f4f4f2', card: '#1b1b1a', surf: '#232321', chip: '#2a2a28',
            line: 'rgba(255,255,255,.08)', prim: '#ffffff', primInk: '#0a0a0a',
            shadow: 'none', red: '#ff8a7a', warn: '#d9a54a', flash: '#2d2818',
            track: 'rgba(255,255,255,.12)', dash: 'rgba(255,255,255,.2)',
            thumb: 'repeating-linear-gradient(135deg,#2a2a28 0 6px,#323230 6px 12px)',
            skel: '#262624',
        }
        : {
            ink: '#0a0a0a', card: '#ffffff', surf: '#f7f7f5', chip: '#f2f2f0',
            line: 'rgba(0,0,0,.07)', prim: '#0a0a0a', primInk: '#ffffff',
            shadow: '0 1px 3px rgba(0,0,0,.04)', red: '#b42318', warn: '#c08a2e',
            flash: '#f4ecd6', track: 'rgba(0,0,0,.08)', dash: 'rgba(0,0,0,.18)',
            thumb: 'repeating-linear-gradient(135deg,#ecebe7 0 6px,#e4e2dd 6px 12px)',
            skel: '#ebeae6',
        };
    return { ...base, m52: a(0.52), m38: a(0.38), m22: a(0.22) };
};

/** El fondo de cada paso. Es lo que hace que avanzar se sienta. */
export const fondoDelPaso = (paso: number, dk: boolean): string => {
    const BG = dk
        ? { base: '#111110', crema: '#17140f', verde: '#111611', final: '#0f1a10' }
        : { base: '#f6f6f4', crema: '#f6f1e6', verde: '#edf1ea', final: '#e2ecdf' };
    if (paso <= 1) return BG.base;
    if (paso === 2) return BG.crema;
    if (paso === 3) return BG.verde;
    return BG.final;
};

/** El modo oscuro de la app, mirando la clase de <html>. */
export const useOscuro = (): boolean => {
    const leer = () => typeof document !== 'undefined'
        && document.documentElement.classList.contains('dark');
    const [oscuro, setOscuro] = useState(leer);
    useEffect(() => {
        const observador = new MutationObserver(() => setOscuro(leer()));
        observador.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observador.disconnect();
    }, []);
    return oscuro;
};

/** La pantalla ancha. La grilla de dos columnas sólo entra acá. */
export const useEsPc = (): boolean => {
    const consulta = '(min-width: 1024px)';
    const [es, setEs] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(consulta).matches,
    );
    useEffect(() => {
        const mq = window.matchMedia(consulta);
        const cambiar = () => setEs(mq.matches);
        mq.addEventListener('change', cambiar);
        return () => mq.removeEventListener('change', cambiar);
    }, []);
    return es;
};

// ── Las animaciones ─────────────────────────────────────────────────────
//
// Van en un <style> de la pantalla y no en index.html: son de acá y de
// ningún otro lado. El prefijo `vc` evita chocar con las de la app.
//
// La última regla apaga TODO para quien pidió menos movimiento. No es un
// detalle de accesibilidad al margen: a alguien que se marea, una pantalla
// que se desliza en cada paso le arruina la compra.
export const ANIMACIONES = `
@keyframes vcIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes vcLine{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@keyframes vcRoll{from{opacity:0;transform:translateY(70%)}to{opacity:1;transform:none}}
@keyframes vcFade{from{opacity:0}to{opacity:1}}
@keyframes vcUp{from{transform:translateY(100%)}to{transform:none}}
@keyframes vcSpin{to{transform:rotate(360deg)}}
@keyframes vcPulse{0%,100%{opacity:1}50%{opacity:.55}}
@keyframes vcCircle{from{stroke-dashoffset:151}to{stroke-dashoffset:0}}
@keyframes vcCheck{from{stroke-dashoffset:36}to{stroke-dashoffset:0}}
@media (prefers-reduced-motion:reduce){
  .vc *,.vc *::before,.vc *::after{animation:none!important;transition:none!important}
}
`;

// ── Plata ───────────────────────────────────────────────────────────────

const PESOS = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

/** "$ 18.000", como se escribe acá. */
export const fmt = (n: number): string => `$ ${PESOS.format(Math.round(n || 0))}`;

/**
 * El total, con cada cifra entrando desde abajo.
 *
 * La `key` lleva la posición DESDE LA DERECHA y el carácter: así, al pasar
 * de 18.000 a 50.000, React reemplaza sólo los dígitos que cambiaron y
 * ésos son los únicos que se animan. Con la posición desde la izquierda,
 * agregar un dígito haría saltar al número entero.
 */
export const Roll: React.FC<{ valor: number; tam: number; color: string }> = ({ valor, tam, color }) => {
    const texto = fmt(valor);
    const chars = texto.split('');
    return (
        <span
            aria-label={texto}
            style={{
                display: 'inline-flex', overflow: 'hidden', fontSize: tam, fontWeight: 600,
                letterSpacing: '-.025em', lineHeight: 1.15, fontVariantNumeric: 'tabular-nums',
                color,
            }}
        >
            {chars.map((c, i) => (
                <span
                    key={`${chars.length - i}:${c}`}
                    aria-hidden="true"
                    style={{
                        display: 'inline-block', whiteSpace: 'pre',
                        animation: 'vcRoll .34s cubic-bezier(.2,.8,.2,1) both',
                    }}
                >
                    {c}
                </span>
            ))}
        </span>
    );
};

// ── Copiar ──────────────────────────────────────────────────────────────

/**
 * Copia al portapapeles con la alternativa vieja.
 *
 * navigator.clipboard no existe fuera de contexto seguro ni en algunos
 * navegadores embebidos —el de Instagram, por ejemplo, por donde llega
 * mucha gente—. Ahí el alias habría que copiarlo a mano, que con un CBU es
 * justo donde se equivoca cualquiera.
 */
export const copiarTexto = async (texto: string): Promise<boolean> => {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(texto);
            return true;
        }
    } catch { /* sigue por abajo */ }

    try {
        const area = document.createElement('textarea');
        area.value = texto;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return ok;
    } catch {
        return false;
    }
};

// ── Dibujos ─────────────────────────────────────────────────────────────

export const IconoRemera: React.FC<{ tam: number; grosor?: number }> = ({ tam, grosor = 1.3 }) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={grosor} strokeLinejoin="round" aria-hidden="true">
        <path d="M8.5 3.5L4 5.5 2.5 10l3 1 1-2V20.5h11V9l1 2 3-1L20 5.5l-4.5-2c-.6 1.6-2 2.5-3.5 2.5S9.1 5.1 8.5 3.5z" />
    </svg>
);

export const IconoBuzo: React.FC<{ tam: number; grosor?: number }> = ({ tam, grosor = 1.3 }) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={grosor} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
        <path d="M8.5 4L4.5 6 2.5 15l3 .8 1-4.3V21h11v-9.5l1 4.3 3-.8-2-9-4-2" />
        <path d="M8.5 4c.6-1.6 1.9-2.5 3.5-2.5S14.9 2.4 15.5 4c-.4 2.2-1.8 3.5-3.5 3.5S8.9 6.2 8.5 4z" />
        <path d="M9 16.5h6" />
    </svg>
);

export const Tilde: React.FC<{ tam: number; grosor?: number }> = ({ tam, grosor = 3 }) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
);

/** El rótulo chico de sección: PRODUCTO, TALLE, TU PEDIDO… */
export const rot = (t: Tokens): React.CSSProperties => ({
    margin: 0, fontSize: 12, fontWeight: 600, letterSpacing: '.07em', color: t.m38,
});

import React from 'react';
import {
    Baby, Book, Calendar, Camera, Car, Coffee, Gift, Globe, HandHeart, Heart, House,
    Megaphone, MessageCircle, Mic, Monitor, Music, Palette, Pencil, Shield, Sparkles,
    Star, Users, Video, Wrench, type LucideIcon,
} from 'lucide-react';
import type { Persona } from '../../../services/agenda';

/**
 * Piezas de la sección Departamentos (design-claude/Sistemas -
 * Departamentos.dc.html). Las usan la tarjeta, el formulario y el selector
 * de encargados.
 */

/**
 * La clave que guarda la base (nombre lucide en kebab-case, ver
 * src/contenido/agendaPaleta.ts) → el componente. Se importan sólo estos 24:
 * el objeto `icons` de lucide trae los mil y pico al bundle.
 */
const ICONO_POR_CLAVE: Record<string, LucideIcon> = {
    palette: Palette, camera: Camera, video: Video, mic: Mic, music: Music, megaphone: Megaphone,
    heart: Heart, 'hand-heart': HandHeart, users: Users, book: Book, calendar: Calendar, coffee: Coffee,
    star: Star, shield: Shield, monitor: Monitor, pencil: Pencil, wrench: Wrench, baby: Baby,
    globe: Globe, 'message-circle': MessageCircle, car: Car, house: House, gift: Gift, sparkles: Sparkles,
};

/** Si la base trae una clave que no está en la lista (no debería), se ve la paleta. */
export const IconoDeDepartamento: React.FC<{ clave: string; tam?: number; grosor?: number }> = ({ clave, tam = 24, grosor = 1.75 }) => {
    const Icono = ICONO_POR_CLAVE[clave] ?? Palette;
    return <Icono size={tam} strokeWidth={grosor} aria-hidden="true" />;
};

/** "Lucía" y "lucia" son lo mismo para buscar. */
export const sinAcentos = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export const iniciales = (nombre: string | null) =>
    (nombre || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

export const nombreDePila = (nombre: string | null) => (nombre || '').trim().split(/\s+/)[0] || 'Sin nombre';

/** El color con transparencia: '#7c3aed' → '#7c3aed1f' (12%). */
export const tinte = (hex: string, alfa = '1f') => (/^#[0-9a-f]{6}$/i.test(hex) ? hex + alfa : 'rgba(0,0,0,.06)');

/**
 * La cara de una persona: su foto, o sus iniciales sobre el color del
 * departamento al 12%. `anillo` es el borde blanco que separa los avatares
 * apilados.
 */
export const Avatar: React.FC<{ persona: Pick<Persona, 'nombre' | 'avatarUrl'>; color: string; tam?: number; anillo?: boolean; className?: string }> = ({
    persona, color, tam = 32, anillo = false, className = '',
}) => (
    <span
        className={`flex flex-none items-center justify-center overflow-hidden rounded-full font-bold text-black/70 ${className}`}
        style={{
            width: tam, height: tam, fontSize: Math.round(tam * 0.36),
            background: persona.avatarUrl ? '#f2f2f0' : tinte(color),
            boxShadow: anillo ? '0 0 0 2px #fff' : undefined,
        }}
        aria-hidden="true"
    >
        {persona.avatarUrl
            ? <img src={persona.avatarUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            : iniciales(persona.nombre)}
    </span>
);

/** Rótulo de cada paso del formulario, como el diseño ("1 · NOMBRE…"). */
export const RotuloPaso: React.FC<{ children: React.ReactNode; id?: string }> = ({ children, id }) => (
    // .58 y no el .38 del diseño: a 11 px, .38 no llega al contraste AA.
    <span id={id} className="text-[11px] font-bold uppercase tracking-[0.08em] text-black/[.58]">{children}</span>
);

/** Mensaje de error debajo de un campo. */
export const ErrorDeCampo: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => (
    <span id={id} role="alert" className="text-[12.5px] font-bold text-[#b42318]">{children}</span>
);

export const Cargando: React.FC<{ tam?: number }> = ({ tam = 16 }) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="animate-spin motion-reduce:animate-none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
        <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
);

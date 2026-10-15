import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Group, GroupCategory, GroupTag, User } from '../../types';
import GroupCard from '../GCX/TarjetaGrupo';

// Carrusel "Grupos para vos" — scroll horizontal nativo con snap
// (mismo criterio que HeroCarousel: scroll-snap-type + botones de flecha
// que desplazan una tarjeta por click).
//
// Las tarjetas son las MISMAS que las de /gcx: el componente compartido
// components/GCX/TarjetaGrupo. Antes acá vivía una tarjeta propia, más
// chica y con otra información —sin descripción, sin etiquetas, sin modalidad,
// sin compartir—, así que el mismo grupo se veía de dos maneras distintas
// según por dónde se llegara. Con una sola tarjeta eso no puede volver a
// pasar: lo que se arregla o se agrega en /gcx aparece acá solo.
//
// Lo único que sigue siendo de acá es el ancho del slide, porque un carrusel
// necesita un ancho fijo y la grilla de /gcx no: ahí la tarjeta se estira con
// la columna.
const GruposCarousel: React.FC<{
    groups: Group[];
    categories: GroupCategory[];
    tags: GroupTag[];
    currentUser: User | null;
    onJoin: (g: Group) => void;
    estadoEnGrupo: (groupId: string) => 'PENDING' | 'APPROVED' | 'REJECTED' | null;
}> = ({ groups, categories, tags, currentUser, onJoin, estadoEnGrupo }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const scrollByCard = (dir: 1 | -1) => {
        const el = scrollRef.current;
        if (!el) return;
        const card = el.querySelector<HTMLElement>('[data-group-card]');
        const amount = card ? card.offsetWidth + 24 : el.clientWidth * 0.8;
        el.scrollBy({ left: amount * dir, behavior: 'smooth' });
    };

    if (groups.length === 0) return null;

    return (
        <div className="relative group/carousel">
            {/* gap-6 y no gap-4: es el mismo espacio entre tarjetas que usa la
                grilla de /gcx. */}
            <div
                ref={scrollRef}
                className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide pb-1 items-stretch"
            >
                {groups.map(g => (
                    /* [&>*]:h-full es lo que iguala las alturas. El riel estira
                       cada slide hasta el más alto (items-stretch), pero la
                       tarjeta de adentro seguía midiendo lo que mide su
                       contenido: un grupo con descripción corta quedaba más
                       bajo que uno largo. Con la altura completa, el cuerpo de
                       la tarjeta —que ya es flex-1— se estira y el pie con el
                       anfitrión y el botón queda abajo de todo.

                       En /gcx esto no hace falta porque lo resuelve la grilla:
                       todas las tarjetas de una fila comparten alto. Acá la
                       fila es un riel horizontal y hay que pedirlo. */
                    <div
                        key={g.id}
                        data-group-card
                        className="snap-start shrink-0 w-[300px] sm:w-[320px] lg:w-[290px] [&>*]:h-full"
                    >
                        <GroupCard
                            group={g}
                            tags={tags}
                            categories={categories}
                            onJoin={onJoin}
                            onInquiry={onJoin}
                            userStatus={estadoEnGrupo(g.id)}
                            currentUser={currentUser}
                        />
                    </div>
                ))}
            </div>

            {groups.length > 1 && (
                <>
                    <button
                        onClick={() => scrollByCard(-1)}
                        aria-label="Grupos anteriores"
                        className="hidden sm:flex absolute -left-3 top-[112px] -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-md items-center justify-center text-slate-600 dark:text-zinc-300 opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-slate-50 dark:hover:bg-zinc-700 z-10"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => scrollByCard(1)}
                        aria-label="Más grupos"
                        className="hidden sm:flex absolute -right-3 top-[112px] -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-md items-center justify-center text-slate-600 dark:text-zinc-300 opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-slate-50 dark:hover:bg-zinc-700 z-10"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </>
            )}
        </div>
    );
};

export default GruposCarousel;

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, AppConfig, FooterLinks, EventoGeneral, Group, GroupCategory, MusicaBannerSlide } from '../../types';
import { db } from '../../services/dbService';
import { supabaseService, getEventosGeneralPublic, getMusicaBannerSlides } from '../../services/supabaseService';
import {
    Instagram,
    Facebook,
    Youtube,
    Music as MusicIcon,
    ChevronRight,
    ChevronLeft,
    Calendar,
    Clock,
    MapPin,
    ExternalLink,
    Quote
} from 'lucide-react';
import HeroCarousel from '../../components/ui/CarruselHero';

// --- TUTORIAL INTEGRATION ---
import { useTutorial } from '../../src/hooks/useTutorial';
import TutorialController from '../../components/onboarding/ControladorTutorial';
import TutorialInvitation from '../../components/onboarding/InvitacionTutorial';
import { tours } from '../../src/config/tours';

interface DashboardProps {
    currentUser: User | null;
    onLoginRequest: (email: string, pass: string) => Promise<boolean>;
}

// Animation Keyframes
const animationStyles = `
    @keyframes slideUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
    }
    .animate-slideUp { animation: slideUp 0.5s ease-out forwards; }
    .animate-scaleIn { animation: scaleIn 0.4s ease-out forwards; }
    .stagger-1 { animation-delay: 0.05s; opacity: 0; }
    .stagger-2 { animation-delay: 0.1s; opacity: 0; }
    .stagger-3 { animation-delay: 0.15s; opacity: 0; }
    .stagger-4 { animation-delay: 0.2s; opacity: 0; }
    .stagger-5 { animation-delay: 0.25s; opacity: 0; }
    .stagger-6 { animation-delay: 0.3s; opacity: 0; }
`;

const pad = (n: number) => String(n).padStart(2, '0');

// ── Cuenta regresiva ────────────────────────────────────────────────────
// El contador cambia de resolución según cuánto falta, en vez de mostrar
// siempre cuatro unidades. Los segundos de un evento que es dentro de cinco
// días son precisión falsa: nadie los lee y le roban lugar a lo que sí
// importa. Aparecen recién abajo de la hora, que es cuando empiezan a
// significar algo. Las unidades en cero a la izquierda directamente no se
// muestran — "00 días" es ruido.
type CountdownPart = { value: number; short: string; long: string };

const buildCountdown = (diffMs: number): CountdownPart[] => {
    const total = Math.max(0, Math.floor(diffMs / 1000));
    const d = Math.floor(total / 86400);
    const h = Math.floor(total / 3600) % 24;
    const m = Math.floor(total / 60) % 60;
    const s = total % 60;

    const dias: CountdownPart = { value: d, short: d === 1 ? 'día' : 'días', long: d === 1 ? 'día' : 'días' };
    const horas: CountdownPart = { value: h, short: 'hs', long: h === 1 ? 'hora' : 'horas' };
    const minutos: CountdownPart = { value: m, short: 'min', long: m === 1 ? 'minuto' : 'minutos' };
    const segundos: CountdownPart = { value: s, short: 'seg', long: s === 1 ? 'segundo' : 'segundos' };

    if (d > 0) return [dias, horas, minutos];
    if (h > 0) return [horas, minutos, segundos];
    if (m > 0) return [minutos, segundos];
    return [segundos];
};

// Las abreviaturas ("h", "min") se leen mal en voz alta, así que la versión
// para lectores de pantalla se arma aparte, como frase.
const countdownPhrase = (parts: CountdownPart[]): string => {
    const words = parts.map(p => `${p.value} ${p.long}`);
    const last = words.pop() as string;
    const verb = parts.length === 1 && parts[0].value === 1 ? 'Falta' : 'Faltan';
    return words.length > 0 ? `${verb} ${words.join(', ')} y ${last}` : `${verb} ${last}`;
};

// Espejo del formateo de fecha de pages/eventos/Eventos.tsx — la card es
// la misma, la fecha tiene que leerse igual. Se duplica a propósito en vez
// de importar entre páginas: es un formateador puro de display.
const formatEventDate = (dateStr: string): string =>
    new Date(dateStr + 'T12:00:00')
        .toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });

// Postgres devuelve las columnas `time` como "HH:MM:SS". Los segundos de
// un horario de evento son ruido: nadie programa una actividad a las
// 16:00:07. Se recortan para mostrar "16:00".
const formatEventTime = (time?: string): string => (time || '').slice(0, 5);

// Descripción de un evento, recortada por defecto con "Ver más".
//
// El botón sólo aparece si el texto realmente no entra: se mide el recorte
// (scrollHeight > clientHeight) en vez de contar caracteres, porque cuántas
// líneas ocupa depende del ancho de la columna — al lado de la miniatura en
// mobile son ~185px, en desktop el doble. Un "Ver más" debajo de una
// descripción de seis palabras es ruido.
const EventoDescripcion: React.FC<{
    text: string;
    expanded: boolean;
    onToggle: () => void;
}> = ({ text, expanded, onToggle }) => {
    const ref = useRef<HTMLParagraphElement>(null);
    const [isClamped, setIsClamped] = useState(false);

    useEffect(() => {
        // Sólo se mide recortado: expandido, scrollHeight y clientHeight
        // coinciden y "Ver menos" desaparecería justo cuando hace falta.
        if (expanded) return;
        const el = ref.current;
        if (!el) return;
        const measure = () => setIsClamped(el.scrollHeight > el.clientHeight + 1);
        measure();
        // El recorte depende del ancho: rotar el teléfono o cruzar un
        // breakpoint cambia la cantidad de líneas.
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        return () => observer.disconnect();
    }, [text, expanded]);

    return (
        <div className="flex flex-col items-start gap-1">
            <p
                ref={ref}
                className={`text-sm sm:text-base font-normal text-slate-500 dark:text-zinc-400 leading-relaxed ${expanded ? '' : 'line-clamp-2 sm:line-clamp-3'}`}
            >
                {text}
            </p>
            {(isClamped || expanded) && (
                <button
                    onClick={onToggle}
                    aria-expanded={expanded}
                    className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 transition-colors"
                >
                    {expanded ? 'Ver menos' : 'Ver más'}
                </button>
            )}
        </div>
    );
};

// Carrusel "Próximos eventos" — estructura lateral: portada a la izquierda,
// texto + contador + CTA a la derecha. El marco (borde + sombra + radio) vive
// en el viewport del carrusel, no en cada slide, para que la sombra no la
// recorte el overflow.
const EventosCarousel: React.FC<{ eventos: EventoGeneral[]; now: number }> = ({ eventos, now }) => {
    const navigate = useNavigate();
    const [index, setIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    // Una sola descripción expandida a la vez: sólo hay un evento visible.
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        setIndex(0);
    }, [eventos.length]);

    // Al cambiar de evento la descripción vuelve a recortarse. Todos los
    // slides comparten altura (son items de un mismo flex), así que un
    // texto expandido que ya no se ve dejaría la card alta y vacía.
    useEffect(() => {
        setExpandedId(null);
    }, [index]);

    // Pausa el auto-avance mientras el puntero o el foco están dentro:
    // la card tiene un CTA, y que se deslice sola mientras alguien va a
    // hacer click es hostil. Mismo criterio que HeroCarousel. Expandir una
    // descripción también congela el carrusel: deslizarse mientras alguien
    // recién empieza a leer es peor todavía.
    useEffect(() => {
        if (eventos.length <= 1 || isPaused || expandedId) return;
        const id = setInterval(() => setIndex(i => (i + 1) % eventos.length), 5000);
        return () => clearInterval(id);
    }, [eventos.length, isPaused, expandedId]);

    if (eventos.length === 0) return null;

    const safeIndex = Math.min(index, eventos.length - 1);

    // CTA al ancho de la columna de acción, igual que el contador: los dos
    // son bloques de la misma familia (uno mide la urgencia, el otro la
    // resuelve), así que comparten ancho y quedan alineados.
    const ctaClass = 'w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-semibold hover:bg-black dark:hover:bg-slate-200 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20';

    return (
        <div>
            <div
                className="rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden bg-white dark:bg-zinc-900"
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                onFocusCapture={() => setIsPaused(true)}
                onBlurCapture={() => setIsPaused(false)}
            >
                <div
                    className="flex"
                    style={{
                        transform: `translateX(-${safeIndex * 100}%)`,
                        // Misma curva que el fadeInUp global (index.html): el
                        // desplazamiento arranca rápido y frena suave.
                        // No usa clases Tailwind de transición porque
                        // motion-reduce:transition-none la anula y con
                        // prefers-reduced-motion el slide saltaba sin animar.
                        // Un inline style de transform no se ve afectado.
                        transition: 'transform 700ms cubic-bezier(0.16, 1, 0.3, 1)',
                        willChange: 'transform'
                    }}
                >
                    {eventos.map(ev => {
                        const target = new Date(`${ev.startDate}T${ev.startTime || '00:00'}`).getTime();
                        const diff = Math.max(0, target - now);
                        const cd = buildCountdown(diff);
                        return (
                            <div key={ev.id} className="w-full shrink-0">
                                <div className="flex flex-col sm:flex-row">
                                    {/* PORTADA (desktop) — el flyer es arte que trae su propio
                                        texto (dirección, precios, edades), así que se muestra
                                        entero: ocupa el ancho de la columna y su alto sale de
                                        su propia proporción (w-full h-auto), nunca se recorta.
                                        Sin fondo desenfocado. El max-h es sólo una red para
                                        formatos extremos (tipo story 9:16). */}
                                    {ev.imageUrl && (
                                        <div className="hidden sm:flex shrink-0 w-52 md:w-56 lg:w-64 items-center justify-center bg-slate-100 dark:bg-zinc-800 border-r border-slate-200 dark:border-zinc-800">
                                            <img
                                                src={ev.imageUrl}
                                                alt={ev.name}
                                                className="block w-full h-auto max-h-[380px] object-contain"
                                            />
                                        </div>
                                    )}

                                    {/* PANEL — se parte en dos: información a la izquierda,
                                        acción a la derecha. Separa lo que se lee de lo que se
                                        toca, y evita que en desktop el CTA quede estirado a
                                        900px por un texto de dos palabras. */}
                                    <div className="flex-1 min-w-0 p-4 sm:p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">

                                        {/* INFORMACIÓN — en mobile arranca con una miniatura
                                            del flyer al costado. A 170px el flyer no se leía:
                                            su texto (precio, dirección, edad) quedaba hecho
                                            puré y los bordes contra el fondo gris parecían
                                            difuminados. Reducida a 96px la caja abraza la
                                            imagen exacta (w-full + h-auto), sin fondo visible
                                            ni recorte, y el resto de la card queda libre para
                                            los datos que sí se leen. */}
                                        <div className="flex-1 min-w-0 flex flex-row gap-3 sm:gap-0">
                                            {ev.imageUrl && (
                                                <div className="sm:hidden shrink-0 w-24 self-start rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800">
                                                    <img src={ev.imageUrl} alt={ev.name} className="block w-full h-auto" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1 flex flex-col gap-1.5 sm:gap-2">
                                                {/* TÍTULO — Bold (700). Es el único 700 de la
                                                    card: antes compartía Semibold con la
                                                    etiqueta, el enlace, las unidades y el
                                                    botón, y el nombre del evento terminaba
                                                    pesando lo mismo que un "Ver más". */}
                                                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                                                    {ev.name}
                                                </h3>
                                                {/* FECHA Y HORA — Semibold y más oscuras que la
                                                    descripción. En una card de evento el "cuándo"
                                                    es el segundo dato en importancia después del
                                                    nombre; venía en gris claro y regular, o sea
                                                    por debajo de un párrafo secundario.

                                                    En mobile van una debajo de la otra: al lado
                                                    de la miniatura la columna es angosta y en
                                                    fila se cortaban igual, pero sin alineación. */}
                                                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-x-4 gap-y-1 text-sm sm:text-base font-semibold text-slate-600 dark:text-zinc-300">
                                                    <span className="flex items-center gap-1.5">
                                                        <Calendar className="w-4 h-4 shrink-0" />
                                                        {formatEventDate(ev.startDate)}
                                                    </span>
                                                    {ev.startTime && (
                                                        <span className="flex items-center gap-1.5">
                                                            <Clock className="w-4 h-4 shrink-0" />
                                                            {formatEventTime(ev.startTime)}{ev.endTime && ` – ${formatEventTime(ev.endTime)}`}
                                                        </span>
                                                    )}
                                                </div>
                                                {ev.description && (
                                                    <EventoDescripcion
                                                        text={ev.description}
                                                        expanded={expandedId === ev.id}
                                                        onToggle={() => setExpandedId(cur => (cur === ev.id ? null : ev.id))}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {/* ACCIÓN — contador y CTA comparten ancho y se leen
                                            como un bloque: uno mide la urgencia, el otro la
                                            resuelve. */}
                                        {/* La línea reemplaza a la placa: en mobile y tablet el
                                            bloque de acción va apilado bajo la descripción y
                                            necesita su propio piso. Un filete de 1px separa
                                            igual de bien que una caja, sin agregar un segundo
                                            objeto negro. En desktop es una columna aparte, así
                                            que la separación ya la da el espacio. */}
                                        <div className="shrink-0 w-full md:w-52 lg:w-60 flex flex-col gap-4 border-t border-slate-100 dark:border-zinc-800 pt-4 md:border-t-0 md:pt-0">

                                            {/* CONTADOR — el mismo reloj, sobre el papel.
                                                Contador y CTA no son la misma clase de cosa:
                                                uno se lee, el otro se toca. Con los dos en negro
                                                el pie de la card eran dos bloques macizos y el
                                                botón perdía su condición de único objeto que
                                                responde. Ahora la tinta queda reservada para
                                                lo que se toca.

                                                Los dos puntos son lo que hace que se lea como
                                                UN reloj y no como tres estadísticas sueltas: es
                                                una sola magnitud partida en unidades. Van en
                                                Regular y gris claro: son separadores, no datos.

                                                Black (900) se usa acá y en ningún otro lugar de
                                                la card. El tamaño se mide contra el título, no
                                                solo: a 1.5× el contador se comía la card. Queda
                                                apenas un escalón arriba (1.2×) — el nombre del
                                                evento es lo primero que hay que leer, no cuánto
                                                falta. */}
                                            <div>
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400 text-center">
                                                    Empieza en
                                                </div>

                                                {/* items-baseline alinea el número de cada unidad
                                                    con los dos puntos: la baseline de una columna
                                                    flex es la de su primer hijo, o sea el número. */}
                                                <div className="mt-2 flex items-baseline justify-center gap-2" aria-hidden="true">
                                                    {cd.map((p, i) => (
                                                        <React.Fragment key={p.short}>
                                                            {i > 0 && (
                                                                <span className="text-lg sm:text-xl font-normal leading-none text-slate-300 dark:text-zinc-600">:</span>
                                                            )}
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-2xl sm:text-3xl font-black tabular-nums tracking-[-0.03em] leading-none text-slate-900 dark:text-white">
                                                                    {i === 0 ? p.value : pad(p.value)}
                                                                </span>
                                                                <span className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400">
                                                                    {p.short}
                                                                </span>
                                                            </div>
                                                        </React.Fragment>
                                                    ))}
                                                </div>
                                                <span className="sr-only">{countdownPhrase(cd)}</span>
                                            </div>

                                            {ev.registrationLink ? (
                                                <a
                                                    href={ev.registrationLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={ctaClass}
                                                >
                                                    Inscribite ahora <ExternalLink className="w-4 h-4" />
                                                </a>
                                            ) : (
                                                <button onClick={() => navigate('/eventos')} className={ctaClass}>
                                                    Ver el evento <ChevronRight className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {eventos.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-4">
                    {eventos.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setIndex(i)}
                            aria-label={`Evento ${i + 1}`}
                            aria-current={i === safeIndex}
                            className={`h-1.5 rounded-full transition-all ${i === safeIndex ? 'w-6 bg-slate-900 dark:bg-white' : 'w-1.5 bg-slate-300 dark:bg-zinc-600 hover:bg-slate-400'}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

// Carrusel "Grupos para vos" — scroll horizontal nativo con snap
// (mismo criterio que HeroCarousel: scroll-snap-type + botones de flecha
// que desplazan una tarjeta por click) sobre grupos reales con lugar
// disponible (supabaseService.getGroups() + getGroupCategories()).
// `categoryWeights` viene del algoritmo de recomendación en Dashboard:
// cuenta cuántos grupos APPROVED tiene el usuario por categoría, y acá
// solo se usa para decidir si una tarjeta se gana el badge "Para vos".
const GruposCarousel: React.FC<{ groups: Group[]; categories: GroupCategory[]; categoryWeights: Map<string, number> }> = ({ groups, categories, categoryWeights }) => {
    const navigate = useNavigate();
    const scrollRef = useRef<HTMLDivElement>(null);

    const getCategoryName = (categoryId?: string) => categories.find(c => c.id === categoryId)?.name || 'Grupo';

    const getCupoLabel = (g: Group) => {
        const left = g.maxCapacity - g.membersCount;
        if (g.capacityLocked || left <= 0) return { label: 'Lleno', bg: '#fef2f2', color: '#b91c1c' };
        if (left <= 3) return { label: `${left} lugar${left === 1 ? '' : 'es'}`, bg: '#fffbeb', color: '#b45309' };
        return { label: 'Abierto', bg: '#ecfdf5', color: '#047857' };
    };

    const scrollByCard = (dir: 1 | -1) => {
        const el = scrollRef.current;
        if (!el) return;
        const card = el.querySelector<HTMLElement>('[data-group-card]');
        const amount = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
        el.scrollBy({ left: amount * dir, behavior: 'smooth' });
    };

    // /gcx ya sabe abrir un grupo puntual por query param (ver
    // `redirectToLoginForGroup` y el deep-link `?groupId=` en Grupos.tsx):
    // si hay sesión abre directo el modal de inscripción real (con
    // validación de edad y cupo incluida); si no, manda a /auth y vuelve
    // acá solo después de loguearse. Es el mismo flujo de "Unirme" que ya
    // usa toda la app — no uno nuevo.
    const goToJoin = (groupId: string) => navigate(`/gcx?groupId=${groupId}`);

    if (groups.length === 0) return null;

    return (
        <div className="relative group/carousel">
            <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory scrollbar-hide pb-1"
            >
                {groups.map(g => {
                    const cupo = getCupoLabel(g);
                    const isMatch = !!g.categoryId && (categoryWeights.get(g.categoryId) || 0) > 0;
                    const isFull = cupo.label === 'Lleno';
                    return (
                        <div
                            key={g.id}
                            data-group-card
                            className="snap-start shrink-0 w-[280px] sm:w-[320px] flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm hover:shadow-lg hover:border-slate-300 dark:hover:border-zinc-700 transition-all overflow-hidden"
                        >
                            <div className="relative h-44 sm:h-52 shrink-0 bg-slate-100 dark:bg-zinc-800">
                                {g.imageUrl && <img src={g.imageUrl} alt="" className="w-full h-full object-cover" />}
                                <span className="absolute top-3 left-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm text-slate-700 dark:text-zinc-200 text-xs font-semibold tracking-[0.02em] px-3 py-1.5 rounded-full">
                                    {getCategoryName(g.categoryId)}
                                </span>
                                {isMatch && (
                                    <span className="absolute top-3 right-3 bg-emerald-600 text-white text-[11px] font-semibold tracking-[0.04em] px-3 py-1.5 rounded-full">
                                        Para vos
                                    </span>
                                )}
                            </div>
                            <div className="p-4 sm:p-5 flex flex-col flex-1">
                                <div className="font-bold tracking-[-0.01em] text-slate-900 dark:text-white text-base sm:text-lg leading-tight">{g.name}</div>
                                <div className="flex flex-col gap-1 mt-2.5">
                                    <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 font-normal">
                                        <Clock className="w-4 h-4 text-emerald-600 shrink-0" /> {g.meetingDay} {g.meetingTime}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-zinc-400 font-normal">
                                        <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span className="truncate">{g.location}</span>
                                    </div>
                                </div>
                                <span
                                    className="self-start text-[11px] font-semibold px-2.5 py-1 rounded-full mt-3"
                                    style={{ backgroundColor: cupo.bg, color: cupo.color }}
                                >
                                    {cupo.label}
                                </span>

                                <button
                                    onClick={() => goToJoin(g.id)}
                                    disabled={isFull}
                                    className="mt-4 w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:bg-black dark:hover:bg-slate-200 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20"
                                >
                                    {isFull ? 'Sin lugar' : 'Unirme'}
                                    {!isFull && <ChevronRight className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {groups.length > 1 && (
                <>
                    <button
                        onClick={() => scrollByCard(-1)}
                        aria-label="Grupos anteriores"
                        className="hidden sm:flex absolute -left-3 top-[96px] -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-md items-center justify-center text-slate-600 dark:text-zinc-300 opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-slate-50 dark:hover:bg-zinc-700"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => scrollByCard(1)}
                        aria-label="Más grupos"
                        className="hidden sm:flex absolute -right-3 top-[96px] -translate-y-1/2 w-9 h-9 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-md items-center justify-center text-slate-600 dark:text-zinc-300 opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-slate-50 dark:hover:bg-zinc-700"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </>
            )}
        </div>
    );
};

// Carrusel "Origen Música" — misma técnica de transición que
// CarruselHero.tsx (translateX + transition cubic-bezier), pero
// simplificado: acá no hay overlay de texto de CTA, cada slide entero ES
// el link (se abre en pestaña nueva al clickear). Se arrastra con el dedo
// o el mouse vía Pointer Events —mismo enfoque que EncuadreMedia.tsx—: la
// pista sigue al puntero en vivo y al soltar decide si cambia de slide o
// vuelve a su lugar.
const MusicaCarousel: React.FC<{ slides: MusicaBannerSlide[] }> = ({ slides }) => {
    const [index, setIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffsetPx, setDragOffsetPx] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const dragStartXRef = useRef<number | null>(null);
    // Distingue un drag de un click: si el puntero se movió más que el
    // umbral, el click que el navegador dispara al soltar no debe abrir
    // el link del slide.
    const draggedRef = useRef(false);

    useEffect(() => {
        setIndex(0);
    }, [slides.length]);

    // El interval es único y persistente — no se destruye ni se recrea en
    // cada toggle de isPaused (hover, click, drag), a diferencia de la
    // versión anterior. isPausedRef se sincroniza en cada render y el
    // propio interval lo lee en cada tick, así que pausar/reanudar nunca
    // reinicia la cuenta de 5s.
    //
    // Esto además importa por un problema real: cada slide es un link con
    // target="_blank" — al clickear se abre una pestaña nueva y ÉSTA
    // pestaña (la del Home) pasa a segundo plano. Los navegadores frenan
    // agresivamente los timers de las pestañas ocultas, así que aunque el
    // estado esté bien, el reloj real puede quedar en pausa mientras no se
    // la mira. Por eso, al volver a estar visible, si ya pasó de sobra un
    // ciclo completo, se avanza una vez de una en vez de esperar a que el
    // browser decida retomar el interval por su cuenta.
    const isPausedRef = useRef(isPaused);
    isPausedRef.current = isPaused;
    const lastTickRef = useRef(Date.now());

    useEffect(() => {
        if (slides.length <= 1) return;
        const AUTOPLAY_MS = 5000;
        const id = setInterval(() => {
            if (isPausedRef.current) return;
            lastTickRef.current = Date.now();
            setIndex(i => (i + 1) % slides.length);
        }, AUTOPLAY_MS);

        const handleVisibility = () => {
            if (document.visibilityState !== 'visible' || isPausedRef.current) return;
            if (Date.now() - lastTickRef.current >= AUTOPLAY_MS) {
                lastTickRef.current = Date.now();
                setIndex(i => (i + 1) % slides.length);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [slides.length]);

    if (slides.length === 0) return null;

    const safeIndex = Math.min(index, slides.length - 1);

    // Cualquier cambio manual de slide (drag o dots) cuenta como "tick"
    // para el reloj de arriba — si no, la reanudación al volver de una
    // pestaña oculta podría dispararse enseguida después de un cambio
    // manual reciente.
    const goToIndex = (target: number) => {
        lastTickRef.current = Date.now();
        setIndex(target);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (slides.length <= 1) return;
        dragStartXRef.current = e.clientX;
        draggedRef.current = false;
        setIsDragging(true);
        setIsPaused(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (dragStartXRef.current === null) return;
        let delta = e.clientX - dragStartXRef.current;
        // Resistencia en los bordes: no hay nada detrás del primer o
        // último slide, así que arrastrar "hacia afuera" frena en vez de
        // cortar en seco.
        const atStart = safeIndex === 0 && delta > 0;
        const atEnd = safeIndex === slides.length - 1 && delta < 0;
        if (atStart || atEnd) delta = delta / 3;
        if (Math.abs(delta) > 8) draggedRef.current = true;
        setDragOffsetPx(delta);
    };

    const endDrag = () => {
        if (dragStartXRef.current === null) return;
        const width = containerRef.current?.clientWidth || 1;
        const threshold = Math.max(40, width * 0.18);
        const delta = dragOffsetPx;
        dragStartXRef.current = null;
        setIsDragging(false);
        setIsPaused(false);
        setDragOffsetPx(0);

        if (Math.abs(delta) > threshold) {
            if (delta < 0) goToIndex(Math.min(slides.length - 1, safeIndex + 1));
            else goToIndex(Math.max(0, safeIndex - 1));
        }
    };

    const handleSlideClick = (e: React.MouseEvent) => {
        if (draggedRef.current) e.preventDefault();
    };

    return (
        <div
            ref={containerRef}
            className={`relative w-full overflow-hidden rounded-2xl h-[200px] sm:h-[260px] md:h-[320px] lg:h-[380px] bg-black ${slides.length > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
            style={{ touchAction: 'pan-y' }}
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
        >
            <div
                className="flex w-full h-full select-none"
                style={{
                    transform: `translateX(calc(-${safeIndex * 100}% + ${dragOffsetPx}px))`,
                    transition: isDragging ? 'none' : 'transform 600ms cubic-bezier(0.25, 0.1, 0.25, 1)',
                    willChange: 'transform'
                }}
            >
                {slides.map(slide => (
                    <a
                        key={slide.id}
                        href={slide.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleSlideClick}
                        onDragStart={(e) => e.preventDefault()}
                        className="relative w-full h-full shrink-0 block group"
                        style={{ minWidth: '100%' }}
                        aria-label={slide.title || 'Ver más'}
                    >
                        {slide.mediaType === 'video' && slide.videoUrl ? (
                            <video
                                src={slide.videoUrl}
                                poster={slide.mediaUrl}
                                className="w-full h-full object-cover pointer-events-none transition-transform duration-300 group-hover:scale-[1.02]"
                                style={{ objectPosition: `${slide.focalX ?? 50}% ${slide.focalY ?? 50}%` }}
                                autoPlay muted loop playsInline
                            />
                        ) : slide.mediaUrl ? (
                            <img
                                src={slide.mediaUrl}
                                alt={slide.title || ''}
                                draggable={false}
                                className="w-full h-full object-cover pointer-events-none transition-transform duration-300 group-hover:scale-[1.02]"
                                style={{ objectPosition: `${slide.focalX ?? 50}% ${slide.focalY ?? 50}%` }}
                            />
                        ) : null /* sin imagen ni video: queda el fondo negro del contenedor */}
                        {slide.title && (
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 sm:p-5 pt-10 sm:pt-14">
                                <p className="text-white font-bold text-lg sm:text-xl md:text-2xl leading-snug tracking-tight drop-shadow-md">{slide.title}</p>
                            </div>
                        )}
                    </a>
                ))}
            </div>

            {slides.length > 1 && (
                <div className="absolute bottom-3 right-3 flex gap-1.5 z-10">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            onClick={(e) => { e.preventDefault(); goToIndex(i); }}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${i === safeIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                            aria-label={`Ir al slide ${i + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ currentUser, onLoginRequest }) => {
    const navigate = useNavigate();

    // El CTA del banner lo carga un admin y puede apuntar adentro o afuera
    // de la app. Un link externo pasado a navigate() rompe (React Router lo
    // trataría como ruta interna y caería en 404), así que se separan.
    const openBannerLink = (link: string) => {
        if (/^(https?:)?\/\//i.test(link) || link.startsWith('mailto:') || link.startsWith('tel:')) {
            window.open(link, '_blank', 'noopener,noreferrer');
        } else {
            navigate(link.startsWith('/') ? link : `/${link}`);
        }
    };
    const [config, setConfig] = useState<AppConfig>(db.getAppConfig());
    const [footerLinks, setFooterLinks] = useState<FooterLinks>({ instagram: '', facebook: '', youtube: '', spotify: '' });
    const [isLoaded, setIsLoaded] = useState(false);

    // --- Datos reales para "Próximos eventos" y "Grupos para vos" ---
    const [eventos, setEventos] = useState<EventoGeneral[]>([]);
    const [musicaSlides, setMusicaSlides] = useState<MusicaBannerSlide[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        getEventosGeneralPublic().then(setEventos);
        getMusicaBannerSlides().then(setMusicaSlides);
        supabaseService.getGroups().then(setGroups);
        supabaseService.getGroupCategories().then(setCategories);
    }, []);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    // --- TUTORIAL INTEGRATION ---
    const {
        isActive,
        showInvitation,
        startTutorial,
        completeTutorial,
        declineTemporary,
        dismissTutorial
    } = useTutorial('dashboard');

    useEffect(() => {
        const init = async () => {
            const remoteConfig = await supabaseService.getAppConfig();
            const activeConfig = remoteConfig || db.getAppConfig();
            setConfig(activeConfig);
            setFooterLinks(activeConfig.footerLinks || { instagram: '', facebook: '', youtube: '', spotify: '' });
            // Cachea la config real en localStorage. useAutoRefresh recarga la
            // página entera tras 5min de inactividad (hooks/useAutoRefresh.ts):
            // sin este cache, el primer render post-reload arranca de
            // DEFAULT_CONFIG (banner.slides: [] a propósito) mientras esta
            // misma consulta vuelve a resolver, y ahí es donde aparece el
            // slide de respaldo sin video. Sólo se cachea si la consulta a
            // Supabase realmente respondió — no queremos pisar un cache bueno
            // con el fallback local ante una falla de red transitoria.
            if (remoteConfig) db.saveAppConfig(remoteConfig);
        };

        init();
        if (!isLoaded) {
            setTimeout(() => setIsLoaded(true), 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // --- Derivados de datos reales para las secciones nuevas ---

    const upcomingEventos = eventos
        .filter(e => new Date(`${e.startDate}T${e.startTime || '00:00'}`).getTime() > now)
        .slice(0, 3);

    // --- Algoritmo de recomendación de "Grupos para vos" ---
    // Señal: a qué categorías pertenecen los grupos donde el usuario tiene
    // una inscripción APPROVED (participante real, no solicitud pendiente
    // ni rechazada). Cuantos más grupos aprobados tenga en una categoría
    // (ej. "La FEMME", "Currícula", "Finanzas"), más peso tiene esa
    // categoría a la hora de ordenar las recomendaciones.
    const isUserRegistration = (r: { userId?: string; email: string }) =>
        !!currentUser && (r.userId === currentUser.id || r.email === currentUser.email);

    // Mismo criterio de "Activo" que usa el resto de la app (ver
    // supabaseService.getGroupRegistrationAnalytics): aprobado y sin
    // haber pasado su fecha de fin — un grupo puede seguir con
    // status 'approved' en la base aunque su temporada ya terminó.
    const isGroupActive = (g: Group) =>
        g.status === 'approved' && (!g.endDate || new Date(g.endDate) >= new Date());

    const userCategoryWeights = (() => {
        const weights = new Map<string, number>();
        if (!currentUser) return weights;
        groups.forEach(g => {
            if (!g.categoryId) return;
            const isApprovedMember = g.registrations?.some(r => r.status === 'APPROVED' && isUserRegistration(r));
            if (isApprovedMember) {
                weights.set(g.categoryId, (weights.get(g.categoryId) || 0) + 1);
            }
        });
        return weights;
    })();

    const topCategoryName = (() => {
        const top = [...userCategoryWeights.entries()].sort((a, b) => b[1] - a[1])[0];
        return top ? categories.find(c => c.id === top[0])?.name : undefined;
    })();

    const recommendedGroups = (() => {
        // Solo grupos Activos; y no recomendar a los que ya pertenece o ya aplicó.
        const notJoined = groups.filter(g => !g.isHidden && isGroupActive(g) && !g.registrations?.some(isUserRegistration));
        const withOpenSpots = notJoined.filter(g => !g.capacityLocked && (g.maxCapacity - g.membersCount) > 0);
        const pool = withOpenSpots.length > 0 ? withOpenSpots : notJoined;

        if (userCategoryWeights.size === 0) return pool.slice(0, 8);

        // Orden estable: primero las categorías donde el usuario más
        // participa; dentro de un mismo peso, se preserva el orden original.
        const ranked = [...pool].sort((a, b) => {
            const weightA = (a.categoryId && userCategoryWeights.get(a.categoryId)) || 0;
            const weightB = (b.categoryId && userCategoryWeights.get(b.categoryId)) || 0;
            return weightB - weightA;
        });
        return ranked.slice(0, 8);
    })();

    const todaysVerse = (() => {
        if (!config.verses || config.verses.length === 0) return null;
        const startOfYear = new Date(new Date().getFullYear(), 0, 0).getTime();
        const dayOfYear = Math.floor((Date.now() - startOfYear) / 86400000);
        return config.verses[dayOfYear % config.verses.length];
    })();

    return (
        <>
            <style>{animationStyles}</style>

            <div className="w-full min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white font-sans flex flex-col relative">

                {/* Tutorial Components */}
                <TutorialInvitation
                    isOpen={showInvitation}
                    onStart={startTutorial}
                    onClose={declineTemporary}
                    onDismiss={dismissTutorial}
                    title="Explora tu Panel Principal"
                />
                <TutorialController
                    steps={tours.dashboard}
                    run={isActive}
                    onComplete={completeTutorial}
                    onSkip={dismissTutorial}
                />

                {/* === HERO — a sangre y al ras del tope de la página ===
                    Vive fuera del contenedor con padding: la navbar es
                    transparente y se monta encima (Estructura.tsx sube el
                    contenido 64px en el dashboard), así que el hero llega
                    hasta el borde superior. Sólo se redondea abajo — arriba
                    va al ras, y a los costados también, porque un borde
                    superior recto contra un margen lateral se vería roto.
                    El alto compensa los 64px que tapa la navbar. */}
                <div
                    id="dashboard-hero"
                    className={`rounded-b-3xl overflow-hidden ${isLoaded ? 'animate-fadeIn' : 'opacity-0'}`}
                >
                    <HeroCarousel
                        slides={(config.banner?.slides && config.banner.slides.length > 0)
                            ? config.banner.slides.map(s => ({
                                id: s.id,
                                imageUrl: s.imageUrl,
                                mediaType: s.mediaType,
                                videoUrl: s.videoUrl,
                                focalX: s.focalX,
                                focalY: s.focalY,
                                zoom: s.zoom,
                                eyebrow: s.eyebrow,
                                title: s.title,
                                titlePrefix: s.titlePrefix,
                                titleHighlight: s.titleHighlight,
                                subtitle: s.subtitle,
                                description: s.description,
                                // El CTA sólo se dibuja si tiene a dónde ir: un
                                // botón sin destino se ve igual que uno roto.
                                buttonText: s.buttonLink ? s.buttonText : undefined,
                                onButtonClick: s.buttonLink ? () => openBannerLink(s.buttonLink as string) : undefined
                            }))
                            : [
                                // Slide de respaldo: sólo se usa cuando el admin
                                // todavía no cargó ninguno.
                                {
                                    id: 'default-hero',
                                    imageUrl: 'https://images.unsplash.com/photo-1438232992991-995b7058bbb3?q=80&w=2073&auto=format&fit=crop',
                                    titlePrefix: 'Origen',
                                    titleHighlight: 'App',
                                    description: 'Áreas de Servicio'
                                }
                            ]
                        }
                        theme="soft"
                        // Con medidas cargadas desde el admin manda esa proporción;
                        // sin ellas se conserva el alto por viewport de siempre.
                        aspectRatio={
                            config.banner?.frameWidth && config.banner?.frameHeight
                                ? `${config.banner.frameWidth} / ${config.banner.frameHeight}`
                                : undefined
                        }
                        heightClass="h-[46vh] sm:h-[50vh] md:h-[54vh] lg:h-[480px]"
                        autoPlayInterval={5000}
                    />
                </div>

                <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16 flex-1">

                    {/* === GRID PRINCIPAL: eventos + versículo, grupos ===
                        Un solo árbol responsive, sin detección de dispositivo por JS.
                        Fila 1: eventos (2/3) + versículo (1/3) — la card de eventos
                        es lateral (portada + panel), y a 2/3 el contador y el CTA a
                        ancho completo quedan proporcionados; a 1400px se verían
                        estirados. Fila 2: grupos. Mobile apila en el orden del DOM. */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">

                        {/* === PRÓXIMOS EVENTOS — portada + contador + CTA, en carrusel === */}
                        {upcomingEventos.length > 0 && (
                            <div className={todaysVerse ? 'lg:col-span-2' : 'lg:col-span-3'}>
                                <div className="flex items-baseline justify-between gap-3 mb-4">
                                    <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white">Próximos eventos</h2>
                                    <button
                                        onClick={() => navigate('/eventos')}
                                        className="shrink-0 inline-flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                    >
                                        Ver todos <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <EventosCarousel eventos={upcomingEventos} now={now} />
                            </div>
                        )}

                        {/* === VERSÍCULO DEL DÍA — config.verses real, rotación por día ===
                            Va al lado de eventos y estira a su altura: un versículo con
                            aire alrededor se lee mejor que uno apretado, así que el
                            texto se centra vertical en vez de quedar arriba. */}
                        {todaysVerse && (
                            <div className="lg:col-span-1 flex flex-col">
                                {/* Espaciador invisible que iguala la altura del header
                                    de "Próximos eventos", para que las dos cards de la
                                    fila arranquen a la misma altura. */}
                                <div className="hidden lg:block h-7 mb-4" aria-hidden="true" />
                                <div className="relative flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-5 sm:p-6 overflow-hidden flex flex-col justify-center">
                                    <Quote className="absolute top-3 right-3 w-10 h-10 text-emerald-50 dark:text-emerald-950" />
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">Versículo del día</div>
                                    {/* Un versículo es una cita, no un titular: LightItalic (300) a
                                        tamaño generoso y leading suelto le da el registro correcto.
                                        Es el único italic de la página, por eso se nota. */}
                                    <p className="mt-2.5 text-lg sm:text-xl font-light italic text-slate-900 dark:text-white leading-relaxed max-w-[90%]">«{todaysVerse.text}»</p>
                                    <div className="mt-3 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-600">{todaysVerse.ref}</div>
                                </div>
                            </div>
                        )}

                        {/* === ORIGEN MÚSICA — mini-banner de canciones/videos, tabla dedicada === */}
                        {musicaSlides.length > 0 && (
                            <div className="lg:col-span-3">
                                <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white">Origen Música</h2>
                                <p className="text-sm font-normal text-slate-500 dark:text-zinc-400 mb-4">
                                    ¡Acá encontrarás nuestras canciones más recientes de Origen! Clickeá la canción para conocer más.
                                </p>
                                <MusicaCarousel slides={musicaSlides} />
                            </div>
                        )}

                        {/* === GRUPOS PARA VOS — carrusel de grupos reales con lugar disponible === */}
                        {recommendedGroups.length > 0 && (
                            <div className="lg:col-span-3">
                                <div className="flex items-baseline justify-between gap-3 mb-1">
                                    <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white">Grupos para vos</h2>
                                    <button
                                        onClick={() => navigate('/gcx')}
                                        className="shrink-0 inline-flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                                    >
                                        Ver todos <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <p className="text-sm font-normal text-slate-500 dark:text-zinc-400 mb-4">
                                    {topCategoryName
                                        ? <>Como participás de grupos de <span className="font-semibold text-slate-700 dark:text-zinc-200">{topCategoryName}</span>, esto te puede interesar.</>
                                        : 'Grupos con lugar disponible esta semana.'}
                                </p>
                                <GruposCarousel groups={recommendedGroups} categories={categories} categoryWeights={userCategoryWeights} />
                            </div>
                        )}
                    </div>
                </div>

                {/* === FOOTER === */}
                <footer className={`relative z-10 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 py-8 sm:py-12 md:py-16 px-4 md:px-6 mt-auto ${isLoaded ? 'animate-slideUp stagger-4' : 'opacity-0'}`}>
                    <div className="max-w-7xl mx-auto flex flex-col items-center text-center md:text-left md:flex-row md:items-center md:justify-between gap-8 md:gap-12">

                        {/* Left - Text */}
                        <div>
                            {/* Cierra en el mismo registro con el que abre el saludo
                                (Light 300): la página empieza y termina hablando. */}
                            <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[-0.02em] mb-2 md:mb-3 text-slate-900 dark:text-white">
                                ¿Querés conocernos?
                            </h2>
                            <p className="text-slate-500 dark:text-zinc-400 text-sm md:text-base font-normal">
                                Seguinos en nuestras redes y sé parte de la comunidad.
                            </p>
                        </div>

                        {/* Right - Social Icons */}
                        <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                            {footerLinks.instagram && (
                                <button
                                    onClick={() => window.open(footerLinks.instagram, '_blank')}
                                    className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200"
                                    title="Instagram"
                                >
                                    <Instagram className="w-5 h-5" />
                                </button>
                            )}
                            {footerLinks.facebook && (
                                <button
                                    onClick={() => window.open(footerLinks.facebook, '_blank')}
                                    className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200"
                                    title="Facebook"
                                >
                                    <Facebook className="w-5 h-5" />
                                </button>
                            )}
                            {footerLinks.youtube && (
                                <button
                                    onClick={() => window.open(footerLinks.youtube, '_blank')}
                                    className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200"
                                    title="YouTube"
                                >
                                    <Youtube className="w-5 h-5" />
                                </button>
                            )}
                            {footerLinks.spotify && (
                                <button
                                    onClick={() => window.open(footerLinks.spotify, '_blank')}
                                    className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200"
                                    title="Spotify"
                                >
                                    <MusicIcon className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Copyright */}
                    <div className="max-w-7xl mx-auto mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-slate-200 dark:border-zinc-800 text-center">
                        <p className="text-sm font-semibold text-slate-400 dark:text-zinc-500">
                            © {new Date().getFullYear()} Sistema Origen — Todos los derechos reservados
                        </p>
                        <p className="text-xs font-normal tracking-[0.06em] text-slate-300 dark:text-zinc-600 mt-2">
                            Powered by IQstudios
                        </p>
                    </div>
                </footer>
            </div>
        </>
    );
};

export default Dashboard;

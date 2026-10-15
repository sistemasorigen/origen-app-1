import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, EventoGeneral } from '../../types';
import { getEventosGeneralPublic } from '../../services/supabaseService';
import {
    ChevronRight,
    Calendar,
    Clock,
    ExternalLink,
    Quote
} from 'lucide-react';
import HeroDeInicio from '../../components/inicio/HeroDeInicio';
import SeccionDeBanner, { MUSICA, YOUVERS } from '../../components/inicio/SeccionDeBanner';
import SeccionGruposParaVos from '../../components/inicio/SeccionGruposParaVos';
import PieDeInicio from '../../components/inicio/PieDeInicio';
import { useBannersDeInicio } from '../../src/hooks/useBannersDeInicio';

// --- TUTORIAL INTEGRATION ---
import { useTutorial } from '../../src/hooks/useTutorial';
import TutorialController from '../../components/onboarding/ControladorTutorial';
import TutorialInvitation from '../../components/onboarding/InvitacionTutorial';
import { tours } from '../../src/config/tours';

interface DashboardProps {
    currentUser: User | null;
    onLoginRequest: (email: string, pass: string) => Promise<boolean>;
}

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

const Dashboard: React.FC<DashboardProps> = ({ currentUser, onLoginRequest }) => {
    const navigate = useNavigate();

    // Los banners, los links del pie y la espera de la pantalla de
    // entrada. Es lo mismo que mostrará /novedades, así que vive aparte.
    const { config, footerLinks, isLoaded, musicaSlides, youversSlides } = useBannersDeInicio();

    // --- Datos reales para "Próximos eventos" ---
    const [eventos, setEventos] = useState<EventoGeneral[]>([]);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        // Es una sección de la portada: si no llegan, la portada sigue en pie
        // sin ellos. Lo que no puede quedar es el error suelto, ahora que los
        // servicios lo levantan en vez de devolver una lista vacía inventada.
        getEventosGeneralPublic()
            .then(setEventos)
            .catch(e => console.error('[Inicio] No se pudieron cargar los eventos:', e));
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

    const upcomingEventos = eventos
        .filter(e => new Date(`${e.startDate}T${e.startTime || '00:00'}`).getTime() > now)
        .slice(0, 3);

    const todaysVerse = (() => {
        if (!config.verses || config.verses.length === 0) return null;
        const startOfYear = new Date(new Date().getFullYear(), 0, 0).getTime();
        const dayOfYear = Math.floor((Date.now() - startOfYear) / 86400000);
        return config.verses[dayOfYear % config.verses.length];
    })();

    return (
        <>
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

                <HeroDeInicio config={config} isLoaded={isLoaded} />

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

                        <SeccionDeBanner {...MUSICA} slides={musicaSlides} />
                        <SeccionDeBanner {...YOUVERS} slides={youversSlides} />

                        <SeccionGruposParaVos currentUser={currentUser} />
                    </div>
                </div>

                <PieDeInicio footerLinks={footerLinks} isLoaded={isLoaded} />
            </div>
        </>
    );
};

export default Dashboard;

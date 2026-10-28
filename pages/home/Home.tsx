import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, EventoGeneral } from '../../types';
import { getEventosGeneralPublic } from '../../services/supabaseService';
import {
    ChevronRight,
    ChevronDown,
    Calendar,
    Clock,
    ExternalLink,
    Quote
} from 'lucide-react';
import HeroDeInicio from '../../components/inicio/HeroDeInicio';
import SeccionDeBanner, { MUSICA, YOUVERS } from '../../components/inicio/SeccionDeBanner';
import SeccionDeEnlaces from '../../components/inicio/SeccionDeEnlaces';
import SeccionGruposParaVos from '../../components/inicio/SeccionGruposParaVos';
import PieDeInicio from '../../components/inicio/PieDeInicio';
import TarjetaInstalar from '../../components/inicio/TarjetaInstalar';
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

/**
 * El nombre y la fecha. Los mismos datos se dibujan encima de la portada
 * (en el teléfono, cerrada) y en el panel blanco (en la compu, o al
 * desplegar), así que viven acá: dos copias se desincronizan solas.
 */
const NombreYFecha: React.FC<{ nombre: string; fecha: string; sobreLaFoto: boolean }> = ({ nombre, fecha, sobreLaFoto }) => (
    <>
        <h3 className={`text-[17.5px] leading-[1.3] tracking-[-0.01em] sm:text-2xl sm:leading-tight sm:tracking-tight font-bold ${sobreLaFoto
            ? 'text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.5)]'
            : 'text-slate-900 dark:text-white'}`}>
            {nombre}
        </h3>
        <div className={`flex items-center gap-1.5 text-sm sm:text-base font-semibold ${sobreLaFoto
            ? 'mt-1 text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,.5)]'
            : 'text-slate-600 dark:text-zinc-300'}`}>
            <Calendar className="w-4 h-4 shrink-0" />
            {fecha}
        </div>
    </>
);

// Carrusel "Próximos eventos" — estructura lateral: portada a la izquierda,
// texto + contador + CTA a la derecha. El marco (borde + sombra + radio) vive
// en el viewport del carrusel, no en cada slide, para que la sombra no la
// recorte el overflow.
const EventosCarousel: React.FC<{ eventos: EventoGeneral[]; now: number }> = ({ eventos, now }) => {
    const navigate = useNavigate();
    const [index, setIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    // Un solo evento desplegado a la vez: sólo hay uno visible.
    const [abiertoId, setAbiertoId] = useState<string | null>(null);

    useEffect(() => {
        setIndex(0);
    }, [eventos.length]);

    // Al cambiar de evento se vuelve a cerrar. Todos los slides comparten
    // altura (son items de un mismo flex), así que uno desplegado que ya no
    // se ve dejaría la card alta y vacía.
    useEffect(() => {
        setAbiertoId(null);
    }, [index]);

    // Pausa el auto-avance mientras el puntero o el foco están dentro:
    // la card tiene un CTA, y que se deslice sola mientras alguien va a
    // hacer click es hostil. Mismo criterio que HeroCarousel. Desplegar los
    // detalles también congela el carrusel: deslizarse mientras alguien
    // recién empieza a leer es peor todavía.
    useEffect(() => {
        if (eventos.length <= 1 || isPaused || abiertoId) return;
        const id = setInterval(() => setIndex(i => (i + 1) % eventos.length), 5000);
        return () => clearInterval(id);
    }, [eventos.length, isPaused, abiertoId]);

    if (eventos.length === 0) return null;

    const safeIndex = Math.min(index, eventos.length - 1);

    // El botón, al ancho de la columna de acción igual que el contador: los
    // dos son bloques de la misma familia (uno mide la urgencia, el otro la
    // resuelve), así que comparten ancho y quedan alineados.
    //
    // Las medidas son las de las tarjetas de Enlaces Origen —46px de alto,
    // radio 12, 14.5px de texto—: en el teléfono las dos secciones se ven
    // una abajo de la otra y un botón más grande acá se leía como si fuera
    // otra cosa.
    const ctaClass = 'w-full h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[14.5px] font-semibold hover:bg-black dark:hover:bg-slate-200 active:scale-[0.98] transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20';

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
                        const abierto = abiertoId === ev.id;
                        const alternar = () => setAbiertoId(abierto ? null : ev.id);
                        const hayPortada = !!ev.imageUrl;
                        // En el teléfono, sin portada no hay nada que desplegar: el
                        // panel está siempre a la vista.
                        const desplegado = abierto || !hayPortada;
                        return (
                            <div
                                key={ev.id}
                                data-evento={ev.id}
                                role="button"
                                aria-expanded={abierto}
                                aria-label={`${ev.name}, ${abierto ? 'ocultar' : 'ver'} los detalles`}
                                tabIndex={0}
                                onClick={alternar}
                                onKeyDown={e => {
                                    // Sólo cuando el foco está en la tarjeta: si está en
                                    // el enlace de adentro, el Enter es de él.
                                    if (e.target !== e.currentTarget) return;
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        alternar();
                                    }
                                }}
                                className="w-full shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 dark:focus-visible:ring-white"
                            >
                                <div className="flex flex-col sm:flex-row">
                                    {/* PORTADA — el flyer es arte que trae su propio
                                        texto (dirección, precios, edades), así que se
                                        muestra ENTERO: el alto sale de su propia
                                        proporción (w-full h-auto) y nunca se recorta.
                                        Eso vale para los dos estados: la caja de la
                                        imagen es la misma abierta y cerrada. */}
                                    {ev.imageUrl && (
                                        <div className="relative aspect-square overflow-hidden bg-slate-900 sm:aspect-auto sm:flex sm:shrink-0 sm:w-52 sm:items-center sm:justify-center sm:overflow-visible sm:border-r sm:border-slate-200 sm:bg-slate-100 sm:dark:border-zinc-800 sm:dark:bg-zinc-800 md:w-56 lg:w-64">
                                            {/* La caja es cuadrada en el teléfono y la imagen
                                                entra entera adentro (object-contain): un flyer
                                                cuadrado —el formato de la casa— la llena justo,
                                                y uno de otra proporción deja banda en vez de
                                                recortarse. Además, con todas las portadas del
                                                mismo alto, el carrusel deja de estirar la
                                                tarjeta más corta hasta la más larga. */}
                                            <img
                                                src={ev.imageUrl}
                                                alt={ev.name}
                                                className="block w-full h-full object-contain sm:h-auto sm:max-h-[380px]"
                                            />

                                            {/* TODO ENCIMA — sólo en el teléfono. Al abrir no
                                                desaparece de golpe: se desvanece y cae unos
                                                píxeles, como si se hundiera en la hoja que
                                                sale abajo. Al cerrar vuelve recién cuando el
                                                panel ya se fue (delay), así no se ven dos
                                                capas encimadas. */}
                                            {hayPortada && (
                                                <div
                                                    data-afiche
                                                    aria-hidden={abierto}
                                                    className={`sm:hidden transition-opacity duration-200 ease-out motion-reduce:transition-none ${abierto ? 'opacity-0 pointer-events-none' : 'opacity-100 delay-150'}`}
                                                >
                                                    {/* Sin este velo, un título blanco sobre
                                                        un flyer claro desaparece. Carga abajo,
                                                        que es donde va el texto, y se va a
                                                        transparente arriba para no ensuciar
                                                        el arte. */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                                                    {/* El nombre y la fecha, abajo a la
                                                        izquierda; el botón abajo, al ancho de
                                                        la portada. */}
                                                    <div className={`absolute inset-x-0 bottom-0 p-4 transition-transform duration-200 ease-out motion-reduce:transition-none ${abierto ? 'translate-y-2' : 'translate-y-0'}`}>
                                                        <NombreYFecha nombre={ev.name} fecha={formatEventDate(ev.startDate)} sobreLaFoto />
                                                        {/* El botón es la invitación; el que
                                                            abre y cierra es el cartel entero. */}
                                                        <span className="mt-3 w-full h-[46px] flex items-center justify-center gap-2 rounded-xl bg-white text-slate-900 text-[14.5px] font-semibold">
                                                            Ver detalles <ChevronDown className="w-4 h-4" strokeWidth={2.4} />
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* PANEL — en la compu está siempre al lado de la
                                        portada. En el teléfono sale de abajo del afiche: la
                                        fila crece de 0fr a 1fr, que es la forma de animar un
                                        alto que no se sabe de antemano sin medirlo con JS
                                        —y, a diferencia de framer-motion, no se pelea con el
                                        translateX del carrusel que envuelve a todo esto—.
                                        Abrir es una invitación y dura un poco más; cerrar es
                                        una decisión y va más rápido. */}
                                    <div
                                        data-panel
                                        className={`grid sm:flex-1 sm:min-w-0 sm:grid-rows-[1fr] motion-reduce:transition-none transition-[grid-template-rows] ease-[cubic-bezier(0.16,1,0.3,1)] ${desplegado ? 'grid-rows-[1fr] duration-[380ms]' : 'grid-rows-[0fr] duration-300'}`}
                                    >
                                    <div className="overflow-hidden sm:overflow-visible">
                                    <div className={`flex-1 min-w-0 p-[18px] sm:p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-0 md:gap-6 transition-opacity duration-200 motion-reduce:transition-none sm:opacity-100 sm:delay-0 ${desplegado ? 'opacity-100 delay-100' : 'opacity-0'}`}>

                                        <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2">
                                            <NombreYFecha nombre={ev.name} fecha={formatEventDate(ev.startDate)} sobreLaFoto={false} />

                                            {/* EL RESTO — la hora y la descripción entera,
                                                detrás de "Ver detalles".

                                                La apertura se anima con una grilla de 0fr a
                                                1fr, que es la forma de animar un alto que no
                                                se sabe de antemano sin medirlo con JS. El
                                                overflow-hidden del hijo es lo que hace que el
                                                contenido se recorte mientras crece. */}
                                            <div
                                                id={`evento-detalles-${ev.id}`}
                                                // Cerrado el texto sigue en el documento —es lo
                                                // que permite animar el alto— pero no tiene que
                                                // existir para un lector de pantalla.
                                                aria-hidden={!abierto}
                                                // En el teléfono el que se mueve es el panel
                                                // entero, así que esto cambia de golpe adentro
                                                // de algo que todavía está plegado. En la compu
                                                // el panel está siempre abierto y éste es el
                                                // único que anima.
                                                className={`grid transition-[grid-template-rows] duration-0 sm:duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                                            >
                                                <div className="overflow-hidden">
                                                    {ev.startTime && (
                                                        <div className="flex items-center gap-1.5 pt-1.5 text-sm sm:text-base font-semibold text-slate-600 dark:text-zinc-300">
                                                            <Clock className="w-4 h-4 shrink-0" />
                                                            {formatEventTime(ev.startTime)}{ev.endTime && ` – ${formatEventTime(ev.endTime)}`}
                                                        </div>
                                                    )}
                                                    {ev.description && (
                                                        <p className="pt-2 text-sm sm:text-base font-normal text-slate-500 dark:text-zinc-400 leading-relaxed">
                                                            {ev.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* ACCIÓN — contador y botón comparten ancho y se leen
                                            como un bloque: uno mide la urgencia, el otro la
                                            resuelve. En el teléfono va apilado bajo el texto,
                                            separado por los mismos 18px que usan las tarjetas
                                            de Enlaces Origen entre la bajada y su botón. */}
                                        <div className="shrink-0 w-full md:w-52 lg:w-60 flex flex-col gap-4 pt-[18px] md:pt-0">

                                            {/* CONTADOR — el mismo reloj, sobre el papel.
                                                Contador y botón no son la misma clase de cosa:
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

                                            {/* Cerrado se ofrece leer; recién desplegado
                                                aparece a dónde ir. Mismo trato que las
                                                tarjetas de Enlaces Origen: nadie se va de la
                                                página sin haber podido leer de qué se trata. */}
                                            {!abierto ? (
                                                <span className={`${ctaClass} cursor-pointer`}>
                                                    Ver detalles <ChevronDown className="w-4 h-4" />
                                                </span>
                                            ) : ev.registrationLink ? (
                                                <a
                                                    href={ev.registrationLink}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    // Si el click subiera, la tarjeta se
                                                    // cerraría en el mismo toque que abre
                                                    // la pestaña.
                                                    onClick={e => e.stopPropagation()}
                                                    className={ctaClass}
                                                >
                                                    Ir al enlace <ExternalLink className="w-4 h-4" />
                                                </a>
                                            ) : (
                                                <button
                                                    onClick={e => { e.stopPropagation(); navigate('/eventos'); }}
                                                    className={ctaClass}
                                                >
                                                    Ir al enlace <ChevronRight className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
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

                        {/* === INSTALAR LA APP — sólo en iPhone/iPad sin instalar,
                            o en Android si Chrome ofrece instalarla === */}
                        <TarjetaInstalar />

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

                        <SeccionDeEnlaces />

                        <SeccionGruposParaVos currentUser={currentUser} />
                    </div>
                </div>

                <PieDeInicio footerLinks={footerLinks} isLoaded={isLoaded} />
            </div>
        </>
    );
};

export default Dashboard;

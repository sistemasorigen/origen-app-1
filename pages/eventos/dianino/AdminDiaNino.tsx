import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDianinoSessions, deleteDianinoSession } from '../../../services/supabaseService';
import { DiaNinoSessionRow, User } from '../../../types';
import { ChevronLeft, Search, Plus, Eye, Trash2, Loader2, PartyPopper, CheckCircle2, Circle, QrCode, ShieldCheck, UserPlus, User as UserIcon, Baby, RefreshCw, X } from 'lucide-react';
import NeoModal from '../../../components/ui/NeoModal';
import WizardAgregarPersona from './WizardAgregarPersona';

interface AdminDiaNinoProps {
    currentUser: User;
}

// Qué le falta escanear a una sesión, en personas. "Pendiente" solo dice
// que algo falta; el staff que va a buscar a esa familia necesita saber
// si le falta el adulto, un niño, o los dos.
//
// Devuelve null cuando no falta nadie, así quien lo llama no tiene que
// repetir la condición de `allCheckedIn`.
const detallePendiente = (s: DiaNinoSessionRow): string | null => {
    const ninosPendientes = s.childrenCount - s.childrenCheckedInCount;
    const partes: string[] = [];
    // El adulto responsable es uno por sesión, así que va sin número.
    if (!s.adultCheckedIn) partes.push('adulto');
    if (ninosPendientes > 0) {
        partes.push(`${ninosPendientes} ${ninosPendientes === 1 ? 'niño' : 'niños'}`);
    }
    return partes.length > 0 ? partes.join(' · ') : null;
};

// Tarjeta de progreso de acreditación — un mismo layout para
// "Adultos" y "Niños", cada uno con su propio total y color de
// ícono, así el staff ve de un vistazo cuánta gente falta
// escanear sin tener que sumarlo a mano fila por fila.
const AccreditationCard: React.FC<{
    icon: React.ElementType;
    iconColorClass: string;
    label: string;
    checkedIn: number;
    total: number;
}> = ({ icon: Icon, iconColorClass, label, checkedIn, total }) => {
    const pending = total - checkedIn;
    const pct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            {/* Envuelve en vez de desbordar: en mobile las dos tarjetas van
                a ~160px y "Adultos" + "39 pendientes" no entran en una línea.
                El badge se salía de la tarjeta y empujaba el ancho de toda la
                página, que terminaba con scroll horizontal. */}
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColorClass}`}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 truncate">{label}</span>
                </div>
                {total > 0 && (
                    pending === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Completo
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                            <Circle className="w-3 h-3" /> {pending} pendiente{pending !== 1 ? 's' : ''}
                        </span>
                    )
                )}
            </div>

            <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-3xl font-black text-slate-900">{checkedIn}</span>
                <span className="text-sm font-semibold text-slate-400">/ {total} acreditados</span>
            </div>

            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
};

// ── Filtros que sobreviven a "Ver detalle" ──────────────────────────────
//
// El botón de volver de DetalleDiaNino navega a una ruta fija
// (`navigate('/eventos/admin/diadelnino')`), no `navigate(-1)`, así que el
// historial del navegador no alcanza: al volver, esta página se monta de
// cero y cada useState arranca en su valor inicial. Con la planilla
// filtrada en "Pendiente", abrir una familia y volver obligaba a rearmar
// el filtro cada vez.
//
// sessionStorage sobrevive al remount venga por donde venga (botón de la
// página, back del navegador, o entrando de nuevo desde el panel) y se
// borra sola al cerrar la pestaña.
const CLAVE_FILTROS = 'dianino_admin_filtros';

// Misma idea para la posición de la planilla. App.tsx hace
// `window.scrollTo(0, 0)` en cada cambio de ruta (ver el efecto sobre
// location.pathname), así que al volver del detalle la planilla siempre
// reaparecía arriba de todo: si estabas mirando una familia del medio o
// del final, tenías que ir a buscarla de nuevo.
const CLAVE_SCROLL = 'dianino_admin_scroll';

type FiltrosGuardados = {
    searchTerm: string;
    declaracion: 'all' | 'accepted' | 'rejected';
    escaneo: 'all' | 'complete' | 'pending';
};

const FILTROS_VACIOS: FiltrosGuardados = { searchTerm: '', declaracion: 'all', escaneo: 'all' };

// Cada campo se valida contra sus valores posibles: un sessionStorage
// viejo, de otra versión o editado a mano dejaría la planilla filtrando
// por algo inexistente — cero filas y ningún pill marcado, sin forma de
// entender por qué. Ante cualquier duda se vuelve a "sin filtros".
const leerFiltrosGuardados = (): FiltrosGuardados => {
    try {
        const crudo = sessionStorage.getItem(CLAVE_FILTROS);
        if (!crudo) return FILTROS_VACIOS;
        const p = JSON.parse(crudo);
        return {
            searchTerm: typeof p?.searchTerm === 'string' ? p.searchTerm : '',
            declaracion: ['all', 'accepted', 'rejected'].includes(p?.declaracion) ? p.declaracion : 'all',
            escaneo: ['all', 'complete', 'pending'].includes(p?.escaneo) ? p.escaneo : 'all'
        };
    } catch {
        // sessionStorage puede tirar en modo privado estricto. No poder
        // recordar los filtros no es motivo para romper la planilla.
        return FILTROS_VACIOS;
    }
};

const AdminDiaNino: React.FC<AdminDiaNinoProps> = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<DiaNinoSessionRow[]>([]);
    const [loading, setLoading] = useState(true);
    // Inicializadores lazy: sólo corren en el primer render, no en cada uno.
    const [searchTerm, setSearchTerm] = useState(() => leerFiltrosGuardados().searchTerm);
    const [declaracionFilter, setDeclaracionFilter] = useState(() => leerFiltrosGuardados().declaracion);
    const [escaneoFilter, setEscaneoFilter] = useState(() => leerFiltrosGuardados().escaneo);
    const [refreshing, setRefreshing] = useState(false);
    const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [showDeclaracionModal, setShowDeclaracionModal] = useState(false);
    const [showWizard, setShowWizard] = useState(false);

    // En segundo plano no se prende el spinner: la planilla ya tiene datos
    // en pantalla y hacerla parpadear cada 20s mientras el staff lee sería
    // peor que no refrescar.
    const fetchSessions = async (opciones?: { enSegundoPlano?: boolean }) => {
        if (opciones?.enSegundoPlano) setRefreshing(true);
        else setLoading(true);

        const data = await getDianinoSessions();
        setSessions(data);
        setUltimaActualizacion(new Date());
        setLoading(false);
        setRefreshing(false);
    };

    useEffect(() => { fetchSessions(); }, []);

    // Durante el evento el escaneo ocurre en OTRO dispositivo (la ruta
    // /escaner), así que esta pantalla no se entera de nada por su cuenta.
    // Antes consultaba una sola vez al montar y quedaba clavada en ese
    // número hasta que alguien apretaba F5 — y navegar de nuevo al mismo
    // link no alcanza, porque es navegación same-document y no remonta el
    // componente. En una prueba en vivo la planilla se atrasó 6 niños en
    // 10 minutos mientras el staff la miraba.
    //
    // Sólo se consulta con la pestaña visible: los navegadores frenan los
    // timers en segundo plano, y además no tiene sentido pedir datos que
    // nadie está mirando. Al volver a la pestaña se refresca en el acto,
    // que es justo cuando alguien va a leer los números.
    useEffect(() => {
        const INTERVALO_MS = 20000;

        const refrescarSiVisible = () => {
            if (document.visibilityState === 'visible') {
                fetchSessions({ enSegundoPlano: true });
            }
        };

        const id = setInterval(refrescarSiVisible, INTERVALO_MS);
        document.addEventListener('visibilitychange', refrescarSiVisible);

        return () => {
            clearInterval(id);
            document.removeEventListener('visibilitychange', refrescarSiVisible);
        };
    }, []);

    // Se guarda en cada cambio, no al salir: no hay un evento confiable de
    // "me estoy yendo" para una navegación de React Router.
    useEffect(() => {
        try {
            sessionStorage.setItem(CLAVE_FILTROS, JSON.stringify({
                searchTerm,
                declaracion: declaracionFilter,
                escaneo: escaneoFilter
            }));
        } catch {
            // Ver leerFiltrosGuardados: no poder persistir no rompe nada.
        }
    }, [searchTerm, declaracionFilter, escaneoFilter]);

    // Con los filtros persistiendo hace falta una salida de un solo click:
    // desactivarlos a mano son tres controles distintos (buscador + dos
    // segmentados). El efecto de arriba se encarga de vaciar lo guardado.
    const limpiarFiltros = () => {
        setSearchTerm('');
        setDeclaracionFilter('all');
        setEscaneoFilter('all');
    };

    // Se anota dónde estaba la planilla justo antes de irse al detalle.
    // Guardarlo acá y no en un listener de scroll evita escribir en
    // sessionStorage en cada rueda del mouse.
    const verDetalle = (sessionId: string) => {
        try {
            sessionStorage.setItem(CLAVE_SCROLL, String(window.scrollY));
        } catch {
            // Ver leerFiltrosGuardados: sin persistencia se pierde la
            // posición, pero la navegación tiene que funcionar igual.
        }
        navigate(`/eventos/admin/diadelnino/${sessionId}`);
    };

    // La posición se repone recién con las filas ya en el DOM: mientras
    // `loading` es true la página mide apenas unos cientos de píxeles y
    // cualquier scrollTo se recorta contra ese alto.
    useEffect(() => {
        if (loading) return;

        let guardado: string | null = null;
        try {
            guardado = sessionStorage.getItem(CLAVE_SCROLL);
            // Se consume una sola vez. Si quedara guardado, entrar a la
            // planilla más tarde desde el panel saltaría sin motivo a una
            // posición de hace media hora.
            if (guardado !== null) sessionStorage.removeItem(CLAVE_SCROLL);
        } catch {
            return;
        }

        const y = Number(guardado);
        if (!Number.isFinite(y) || y <= 0) return;

        // Un solo scrollTo no alcanza y está medido: la posición se reponía
        // y algo la volvía a 0 inmediatamente después. Hay al menos dos
        // candidatos, los dos fuera de este componente y los dos posteriores
        // a este efecto — el `window.scrollTo(0, 0)` que App.tsx dispara en
        // cada cambio de ruta, y la restauración de scroll que el navegador
        // hace por su cuenta para la entrada del historial.
        //
        // En vez de adivinar cuál gana, se sostiene la posición unos frames
        // hasta que nadie más la toca. Se corta apenas el usuario scrollea:
        // pelearle la rueda del mouse sería peor que no restaurar nada.
        let cancelado = false;
        const limite = performance.now() + 600;

        const soltar = () => { cancelado = true; };
        window.addEventListener('wheel', soltar, { passive: true, once: true });
        window.addEventListener('touchstart', soltar, { passive: true, once: true });
        window.addEventListener('keydown', soltar, { once: true });

        let raf = requestAnimationFrame(function sostener() {
            if (cancelado) return;
            if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
            if (performance.now() < limite) raf = requestAnimationFrame(sostener);
        });

        return () => {
            cancelado = true;
            cancelAnimationFrame(raf);
            window.removeEventListener('wheel', soltar);
            window.removeEventListener('touchstart', soltar);
            window.removeEventListener('keydown', soltar);
        };
    }, [loading]);

    const handleDelete = async (sessionId: string) => {
        setDeletingId(sessionId);
        const success = await deleteDianinoSession(sessionId);
        setDeletingId(null);
        setConfirmDeleteId(null);
        if (success) {
            setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
        }
    };

    const filtered = sessions.filter(s => {
        if (declaracionFilter === 'accepted' && !s.declaracionJuradaAceptada) return false;
        if (declaracionFilter === 'rejected' && s.declaracionJuradaAceptada) return false;

        // Misma fuente que el badge "Escaneo" de la fila (`allCheckedIn`),
        // así el filtro no puede desincronizarse de lo que muestra la
        // planilla: exige adulto responsable + todos sus niños.
        if (escaneoFilter === 'complete' && !s.allCheckedIn) return false;
        if (escaneoFilter === 'pending' && s.allCheckedIn) return false;

        const term = searchTerm.toLowerCase().trim();
        if (!term) return true;
        return (
            s.adultFirstName.toLowerCase().includes(term) ||
            s.adultLastName.toLowerCase().includes(term) ||
            s.adultDni.includes(term)
        );
    });

    const hayFiltrosActivos =
        !!searchTerm.trim() || declaracionFilter !== 'all' || escaneoFilter !== 'all';

    // El vacío tiene dos causas distintas y hasta ahora decía siempre lo
    // mismo: "todavía no hay inscripciones" aparecía incluso con 219
    // cargadas, cuando lo único que pasaba era que el filtro no daba
    // resultados.
    const mensajeVacio = sessions.length === 0
        ? 'Todavía no hay inscripciones'
        : 'Ninguna inscripción coincide con los filtros';

    const totalChildren = sessions.reduce((sum, s) => sum + s.childrenCount, 0);
    // Contadores globales de acreditación — siempre sobre `sessions`
    // (no `filtered`), para que reflejen el evento completo aunque
    // el staff esté buscando o filtrando la planilla en ese momento.
    const adultsCheckedIn = sessions.filter(s => s.adultCheckedIn).length;
    const childrenCheckedIn = sessions.reduce((sum, s) => sum + s.childrenCheckedInCount, 0);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <button
                    onClick={() => navigate('/panel-eventos')}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-4"
                >
                    <ChevronLeft className="w-4 h-4" /> Panel de Eventos
                </button>

                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tight text-black flex items-center gap-2">
                            <PartyPopper className="w-7 h-7 text-orange-500" />
                            Día del Niño
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {sessions.length} inscripción{sessions.length !== 1 ? 'es' : ''} · {totalChildren} niño{totalChildren !== 1 ? 's' : ''} en total
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setShowDeclaracionModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 bg-white text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <ShieldCheck className="w-4 h-4" /> Declaración
                        </button>
                        <button
                            onClick={() => navigate('/eventos/admin/diadelnino/escaner')}
                            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 bg-white text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <QrCode className="w-4 h-4" /> Escanear
                        </button>
                        <button
                            onClick={() => setShowWizard(true)}
                            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 bg-white text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <UserPlus className="w-4 h-4" /> Agregar adulto/niño
                        </button>
                        <button
                            onClick={() => navigate('/eventos/admin/diadelnino/nueva')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-black text-white font-semibold text-sm rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <Plus className="w-4 h-4" /> Inscripción manual
                        </button>
                    </div>
                </div>

                {/* La hora del último dato va a la vista: sin ella no hay
                    forma de saber si lo que se está mirando es de ahora o de
                    hace veinte minutos, que es exactamente el problema que
                    tenía esta pantalla. */}
                <div className="flex items-center justify-end gap-2 mb-2">
                    {ultimaActualizacion && (
                        <span className="text-xs text-slate-400">
                            Actualizado {ultimaActualizacion.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                        </span>
                    )}
                    <button
                        onClick={() => fetchSessions({ enSegundoPlano: true })}
                        disabled={refreshing || loading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 transition-colors"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        Actualizar
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <AccreditationCard
                        icon={UserIcon}
                        iconColorClass="bg-blue-50 text-blue-600"
                        label="Adultos"
                        checkedIn={adultsCheckedIn}
                        total={sessions.length}
                    />
                    <AccreditationCard
                        icon={Baby}
                        iconColorClass="bg-orange-50 text-orange-600"
                        label="Niños"
                        checkedIn={childrenCheckedIn}
                        total={totalChildren}
                    />
                </div>

                {/* Buscador y filtros en filas separadas: con dos
                    segmentados en la misma línea el buscador se comprimía a
                    225px de los 384 que tiene asignados, y el placeholder
                    quedaba cortado a la mitad. */}
                <div className="flex flex-col gap-3 mb-2">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, apellido o DNI..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-full outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 text-sm bg-white transition-all"
                        />
                    </div>

                    {/* Dos segmentados iguales uno al lado del otro no se
                        distinguen solos, así que cada uno lleva el nombre de
                        su columna en la planilla. Los colores activos calcan
                        los badges de esa columna —verde/rojo en Declaración,
                        verde/ámbar en Escaneo— para que el filtro anticipe
                        visualmente lo que va a mostrar. */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        {/* En mobile el rótulo va arriba: en línea, sus tres
                            pills más la palabra "Declaración" no entran en
                            375px y "No aceptaron" quedaba cortado contra el
                            borde. */}
                        <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">Declaración</span>
                            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-full w-fit">
                                <button
                                    type="button"
                                    onClick={() => setDeclaracionFilter('all')}
                                    aria-pressed={declaracionFilter === 'all'}
                                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${declaracionFilter === 'all'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Todos
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDeclaracionFilter('accepted')}
                                    aria-pressed={declaracionFilter === 'accepted'}
                                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${declaracionFilter === 'accepted'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Aceptaron
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDeclaracionFilter('rejected')}
                                    aria-pressed={declaracionFilter === 'rejected'}
                                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${declaracionFilter === 'rejected'
                                        ? 'bg-red-600 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <Circle className="w-3.5 h-3.5" /> No aceptaron
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">Escaneo</span>
                            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-full w-fit">
                                <button
                                    type="button"
                                    onClick={() => setEscaneoFilter('all')}
                                    aria-pressed={escaneoFilter === 'all'}
                                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${escaneoFilter === 'all'
                                        ? 'bg-white text-slate-900 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    Todos
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEscaneoFilter('complete')}
                                    aria-pressed={escaneoFilter === 'complete'}
                                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${escaneoFilter === 'complete'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Completo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEscaneoFilter('pending')}
                                    aria-pressed={escaneoFilter === 'pending'}
                                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${escaneoFilter === 'pending'
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <Circle className="w-3.5 h-3.5" /> Pendiente
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Con filtros puestos, la cuenta del encabezado deja de
                    describir lo que se está viendo. */}
                <div className="h-6 mb-2">
                    {hayFiltrosActivos && !loading && (
                        <div className="flex items-center gap-3">
                            <p className="text-xs text-slate-500">
                                Mostrando <span className="font-bold text-slate-700">{filtered.length}</span> de {sessions.length} inscripciones
                            </p>
                            <button
                                type="button"
                                onClick={limpiarFiltros}
                                className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" /> Limpiar filtros
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Mobile: tarjetas ── */}
                <div className="md:hidden space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 text-sm">
                            {mensajeVacio}
                        </div>
                    ) : filtered.map(s => (
                        <div key={s.sessionId} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            {/* Nombre + email */}
                            {/* min-w-0 + truncate: un ítem flex no baja de su
                                ancho de contenido, así que un email largo
                                estiraba esta columna y empujaba el badge de
                                niños fuera de la pantalla — con eso toda la
                                página quedaba con scroll horizontal. */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <div className="min-w-0">
                                    <p className="font-bold text-sm text-slate-900 truncate">{s.adultFirstName} {s.adultLastName}</p>
                                    <p className="text-xs text-slate-400 truncate">{s.email}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">DNI {s.adultDni}</p>
                                </div>
                                <span className="inline-flex items-center justify-center px-2.5 py-1 bg-slate-100 rounded-full text-xs font-black text-slate-700 shrink-0">
                                    {s.childrenCount} {s.childrenCount === 1 ? 'niño' : 'niños'}
                                </span>
                            </div>

                            {/* Badges */}
                            <div className="mb-4">
                                <div className="flex flex-wrap gap-2">
                                    {s.declaracionJuradaAceptada ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                                            <CheckCircle2 className="w-3 h-3" /> Declaración aceptada
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                            <Circle className="w-3 h-3" /> No aceptó
                                        </span>
                                    )}
                                    {s.allCheckedIn ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                                            <CheckCircle2 className="w-3 h-3" /> Escaneo completo
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                                            <Circle className="w-3 h-3" /> Pendiente escaneo
                                        </span>
                                    )}
                                </div>
                                {/* Línea aparte y no dentro del badge: sumado al
                                    uppercase del badge, el desglose quedaba en un
                                    renglón gritado y largo. */}
                                {!s.allCheckedIn && detallePendiente(s) && (
                                    <p className="mt-2 text-xs font-semibold text-slate-500">
                                        Falta escanear: {detallePendiente(s)}
                                    </p>
                                )}
                            </div>

                            {/* Acciones */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => verDetalle(s.sessionId)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    <Eye className="w-3.5 h-3.5" /> Ver detalle
                                </button>
                                {confirmDeleteId === s.sessionId ? (
                                    <button
                                        onClick={() => handleDelete(s.sessionId)}
                                        disabled={deletingId === s.sessionId}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black uppercase text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                    >
                                        {deletingId === s.sessionId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '¿Confirmar borrado?'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setConfirmDeleteId(s.sessionId)}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Desktop: tabla ── */}
                <div className="hidden md:block bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 text-sm">
                            {mensajeVacio}
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Responsable adulto</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">DNI</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Niños</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Declaración</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Escaneo</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(s => (
                                    <tr key={s.sessionId} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-sm text-slate-900">{s.adultFirstName} {s.adultLastName}</p>
                                            <p className="text-xs text-slate-400">{s.email}</p>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{s.adultDni}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-700">
                                                {s.childrenCount}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {s.declaracionJuradaAceptada ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                                                    <CheckCircle2 className="w-3 h-3" /> Aceptó
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                                    <Circle className="w-3 h-3" /> No aceptó
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {s.allCheckedIn ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                                                    <CheckCircle2 className="w-3 h-3" /> Completo
                                                </span>
                                            ) : (
                                                // El desglose va debajo y en gris: el badge es el
                                                // estado, esto es el detalle. Metido dentro del
                                                // badge ensancharía la columna y competiría con
                                                // el ámbar que marca la fila.
                                                <div className="inline-flex flex-col items-center gap-1">
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                                                        <Circle className="w-3 h-3" /> Pendiente
                                                    </span>
                                                    {detallePendiente(s) && (
                                                        <span className="text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                                                            Falta {detallePendiente(s)}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end items-center gap-1">
                                                <button
                                                    onClick={() => verDetalle(s.sessionId)}
                                                    className="p-1.5 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                                                    title="Ver"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                {confirmDeleteId === s.sessionId ? (
                                                    <button
                                                        onClick={() => handleDelete(s.sessionId)}
                                                        disabled={deletingId === s.sessionId}
                                                        className="px-2 py-1.5 text-[10px] font-black uppercase text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                                    >
                                                        {deletingId === s.sessionId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setConfirmDeleteId(s.sessionId)}
                                                        className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                                                        title="Borrar"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Texto estático — es el mismo aviso que se le muestra a
                cada familia en el paso 3 del formulario público
                (InscripcionDiaNino.tsx), no algo que varíe por sesión.
                El botón es sólo de referencia rápida para el staff: la
                planilla ya muestra por fila si cada familia aceptó o no. */}
            <NeoModal
                isOpen={showDeclaracionModal}
                onClose={() => setShowDeclaracionModal(false)}
                title="Declaración de Conformidad"
                maxWidth="max-w-lg"
            >
                <div className="p-5 rounded-2xl space-y-3 bg-amber-50 border-2 border-amber-300/60">
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="w-5 h-5 shrink-0 text-amber-900" aria-hidden="true" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-amber-900">
                            Aviso sobre registro fotográfico y audiovisual
                        </span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-amber-950">
                        Te informamos que durante el evento se tomarán fotografías y grabaciones de video de las
                        distintas actividades. Este material será utilizado exclusivamente por{' '}
                        <span className="font-black">Origen Iglesia</span> con fines de difusión, comunicación y
                        registro informativo en nuestros canales oficiales (redes sociales, sitio web y material
                        impreso de la iglesia).
                    </p>
                </div>
                <p className="text-xs text-slate-400 mt-4">
                    Este es el mismo texto que cada familia ve y acepta o rechaza al inscribirse. Cada fila de la
                    planilla muestra si esa familia en particular lo aceptó.
                </p>
            </NeoModal>

            <WizardAgregarPersona
                isOpen={showWizard}
                sessions={sessions}
                onClose={(didChange) => {
                    setShowWizard(false);
                    if (didChange) fetchSessions();
                }}
            />
        </div>
    );
};

export default AdminDiaNino;

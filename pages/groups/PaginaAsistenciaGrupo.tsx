import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { User, ModoReunion } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, History, Save, Check, Loader2 } from 'lucide-react';
import { T, btnPrimario, btnSecundario, rotulo, Encabezado, Vacio } from '../../components/GCX/patron';
import PanelGuardado, { EstadoGuardado } from '../../components/GCX/PanelGuardado';
import { NOMBRE_MODO_REUNION } from '../../src/utils/modalidad';
import { estabaEnLaFecha, fechaDeIngreso, idsDeInscripcion, padronDeReunion } from '../../src/utils/asistencia';

interface Member {
    id: string;
    name: string;
    email: string;
}

interface AttendanceRecord {
    id: string;
    date: string;
    count: number;
    presentMembers: string[];
    // La foto del padrón de ese día. null en las reuniones anteriores a que
    // existiera la columna: ahí manda la regla de la fecha de ingreso.
    expectedMembers: string[] | null;
    modoReunion: ModoReunion | null;
}

const MODOS_REUNION: ModoReunion[] = ['presencial', 'online'];

// Fecha de HOY en hora local, no en UTC.
//
// Antes esto era `new Date().toISOString().split('T')[0]`. toISOString()
// convierte a UTC, así que en Argentina (UTC-3) a partir de las 21:00 devolvía
// el día siguiente y la asistencia se guardaba con fecha de mañana. Se
// encontraron 27 registros en producción con ese corrimiento, todos creados
// entre las 21:00 y las 23:59. 'en-CA' da YYYY-MM-DD, que es el formato que
// espera <input type="date">.
const hoyLocal = (): string => new Date().toLocaleDateString('en-CA');

const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

// Se parsea a mano en vez de new Date(dateStr): ese constructor interpreta
// YYYY-MM-DD como UTC y en Argentina (UTC-3) muestra el día anterior. Mismo
// problema que arregla hoyLocal().
const aFechaLocal = (dateStr: string): Date | null => {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
};

// "miércoles, 9 de septiembre". Para el historial, que tiene ancho de sobra.
const fechaLarga = (dateStr: string): string => {
    const f = aFechaLocal(dateStr);
    if (!f) return dateStr;
    return f.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
};

// Versión corta para la píldora, que en 375px comparte fila con el botón de
// historial y sólo dispone de ~160px de texto: el día de la semana se abrevia
// ("mié") y hoy se nombra por su nombre, que es el caso normal. Se agrega el
// año sólo si no es el actual, para no confundir una reunión vieja con una
// reciente al editarla.
const fechaPildora = (dateStr: string): string => {
    const f = aFechaLocal(dateStr);
    if (!f) return dateStr;
    const anioAparte = f.getFullYear() !== new Date().getFullYear();
    const resto = f.toLocaleDateString('es-AR', {
        day: 'numeric', month: anioAparte ? 'short' : 'long', ...(anioAparte ? { year: 'numeric' } : {}),
    });
    if (dateStr === hoyLocal()) return `Hoy, ${resto}`;
    return `${f.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}, ${resto}`;
};

// El toggle de presente/ausente. 44px de lado para que se pueda tildar
// con el pulgar, de pie, sin apuntar.
const Tilde: React.FC<{ presente: boolean; chico?: boolean }> = ({ presente, chico }) => (
    <span
        aria-hidden="true"
        className={`shrink-0 rounded-full flex items-center justify-center transition-all duration-200 ${chico ? 'w-[34px] h-[34px]' : 'w-[44px] h-[44px]'
            } ${presente
                ? 'bg-[#0a0a0a] dark:bg-white text-white dark:text-black'
                : 'bg-transparent border-2 border-black/[.13] dark:border-white/[.18] text-transparent'}`}
    >
        <Check className={chico ? 'w-[15px] h-[15px]' : 'w-[19px] h-[19px]'} strokeWidth={3} />
    </span>
);

const PaginaAsistenciaGrupo: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const sinMovimiento = useReducedMotion();

    const [group, setGroup] = useState<{ id: string; name: string; isHybrid?: boolean; registrations?: any[] } | null>(null);
    const [loadingGroup, setLoadingGroup] = useState(true);

    // `?vista=historial` la abre en lo que ya pasó. Lo usa el detalle de un
    // grupo terminado, donde la asistencia se consulta y no se carga.
    //
    // Se lee del router y NO de window.location.search. La app monta sobre
    // HashRouter, así que la URL real es ".../#/mis-grupos/x/asistencia?vista=
    // historial": el query vive DENTRO del hash y window.location.search viene
    // vacío. Por eso el botón del grupo terminado abría en "Tomar asistencia".
    const [activeTab, setActiveTab] = useState<'new' | 'history'>(
        () => new URLSearchParams(location.search).get('vista') === 'historial' ? 'history' : 'new'
    );
    const [selectedDate, setSelectedDate] = useState(hoyLocal);

    // Fecha del registro que se abrió con "Editar". Si al guardar la fecha
    // cambió, el registro se mueve en vez de duplicarse. null = alta nueva.
    const [editingDate, setEditingDate] = useState<string | null>(null);

    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    // Sólo en los grupos híbridos: cómo fue ESTA reunión. Arranca sin elegir
    // en cada fecha nueva, a propósito: un valor por defecto se guardaría sin
    // que nadie lo mire y el reporte de presencial/online mentiría.
    const [modoReunion, setModoReunion] = useState<ModoReunion | null>(null);
    const esHibrido = !!group?.isHybrid;
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    // Lo que pasa después de tocar Guardar: la espera, el tilde verde o el
    // error. Mientras no está en 'cerrado', el botón no responde.
    const [estadoGuardado, setEstadoGuardado] = useState<EstadoGuardado>('cerrado');
    const [tituloGuardado, setTituloGuardado] = useState('Asistencia guardada');
    const [detalleGuardado, setDetalleGuardado] = useState('');
    // La reunión recién guardada, para encontrarla de un vistazo en el
    // historial. Se apaga sola.
    const [fechaResaltada, setFechaResaltada] = useState<string | null>(null);
    // Inscripciones de pareja abiertas para tildar por separado. Cerradas,
    // la fila se lee como una sola unidad con su contador "2 de 2".
    const [expandidas, setExpandidas] = useState<Set<string>>(new Set());

    const fetchGroup = useCallback(async () => {
        if (!currentUser || !groupId) return;
        setLoadingGroup(true);
        try {
            const owned = await supabaseService.getGroupsByHost(currentUser.id);
            const found = owned.find(g => g.id === groupId);
            if (!found) {
                navigate('/mis-grupos', { replace: true });
                return;
            }
            setGroup(found);
        } finally {
            setLoadingGroup(false);
        }
    }, [currentUser, groupId, navigate]);

    useEffect(() => { fetchGroup(); }, [fetchGroup]);

    const inscripciones: any[] = group?.registrations || [];

    // La reunión guardada de la fecha que se está mirando, si ya existe.
    const registroDeLaFecha = history.find(r => r.date === selectedDate) || null;

    // Mover una reunión de fecha es el único caso en que la planilla no la
    // manda la fecha elegida: lo que viaja es la lista que el anfitrión tiene
    // tildada, y nadie tildado puede desaparecer de la vista.
    const moviendoFecha = !!editingDate && editingDate !== selectedDate;

    // Quiénes aparecen en la planilla de ESTA fecha.
    //
    //   · Reunión ya guardada → manda su foto. Se muestran también las
    //     inscripciones que después cambiaron de estado: lo que pasó esa noche
    //     no se reescribe.
    //   · Fecha nueva → quienes ya estaban en el grupo esa fecha.
    //
    // Quien figura en la foto pero ya no tiene inscripción —una baja, que
    // BORRA la fila— no se puede mostrar: no hay de dónde sacar su nombre. Su
    // id igual se conserva al guardar, más abajo.
    const visibles: any[] = inscripciones.filter((r: any) => {
        if (moviendoFecha) {
            return estabaEnLaFecha(r, selectedDate)
                || idsDeInscripcion(r).some(id => selectedMembers.has(id));
        }
        if (registroDeLaFecha?.expectedMembers) {
            const foto = new Set([
                ...registroDeLaFecha.expectedMembers,
                ...registroDeLaFecha.presentMembers,
            ]);
            return idsDeInscripcion(r).some(id => foto.has(id));
        }
        return estabaEnLaFecha(r, selectedDate);
    });

    // Una fila de registro puede representar 2 personas (pareja): se expande
    // a 1 o 2 entradas de Member.
    const personasDe = (r: any): Member[] => {
        const titular: Member = {
            id: r.id,
            name: `${r.first_name || r.firstName || ''} ${r.last_name || r.lastName || ''}`.trim() || 'Sin nombre',
            email: r.email || ''
        };
        const partner = r.partnerData || r.partner_data;
        if (!partner) return [titular];
        const parejaMember: Member = {
            id: `${r.id}-partner`,
            name: `${partner.firstName || partner.first_name || ''} ${partner.lastName || partner.last_name || ''}`.trim() || 'Sin nombre',
            email: partner.email || ''
        };
        return [titular, parejaMember];
    };

    const members: Member[] = visibles.flatMap(personasDe);

    /**
     * Quienes entraron al grupo DESPUÉS de esta fecha.
     *
     * Antes eran una línea de texto que explicaba por qué no estaban, y ahí
     * terminaba: el anfitrión que cargaba hoy a alguien que vino el miércoles
     * pasado no tenía cómo marcarlo. Ahora son filas de verdad, en su propio
     * bloque y desmarcadas.
     *
     * No se mezclan con el padrón de la fecha a propósito: mezclados se leen
     * como ausentes, que es justo lo que la regla del padrón vino a arreglar
     * —quien entró en la semana 6 figuraba ausente en las cinco anteriores—.
     *
     * Marcarlos no rompe ninguna cuenta: el trigger de la base arma
     * `expected_members` como el padrón de la fecha MÁS los presentes, así
     * que quien se marca entra también al denominador, y quien queda sin
     * marcar no entra a ningún lado.
     */
    const sumados: any[] = moviendoFecha ? [] : inscripciones.filter((r: any) => {
        if (String(r.status ?? '').toUpperCase() !== 'APPROVED') return false;
        if (visibles.some((v: any) => v.id === r.id)) return false;
        const ingreso = fechaDeIngreso(r);
        return ingreso !== null && ingreso > selectedDate;
    });

    const personasSumadas: Member[] = sumados.flatMap(personasDe);

    // Las mismas personas, pero agrupadas por inscripción: el diseño muestra
    // la pareja como UNA fila. Los ids no cambian, así que selectedMembers y
    // saveAttendance siguen viendo exactamente lo de antes.
    const aFilas = (lista: any[], sumado: boolean) => lista
        .map((r: any) => ({ regId: r.id, personas: personasDe(r), sumado }))
        .filter(f => f.personas.length > 0);

    const filas: { regId: string; personas: Member[]; sumado: boolean }[] = [
        ...aFilas(visibles, false),
        ...aFilas(sumados, true),
    ];

    // Los contadores miran sólo lo que se ve. selectedMembers puede tener de
    // más —presentes de gente que después se dio de baja— y contarlos daría
    // más presentes que miembros, o un 120%.
    //
    // De los sumados después sólo pesa el que esté marcado, igual que en la
    // base: sin marcar no son de esta reunión, así que no son ausentes ni
    // agrandan el padrón.
    const presentesDeLaFecha = members.filter(m => selectedMembers.has(m.id)).length;
    const presentesSumados = personasSumadas.filter(m => selectedMembers.has(m.id)).length;
    const presentCount = presentesDeLaFecha + presentesSumados;
    const absentCount = members.length - presentesDeLaFecha;
    const padronVisible = members.length + presentesSumados;
    const presentPct = padronVisible > 0 ? Math.round((presentCount / padronVisible) * 100) : 0;

    /** ¿Hay algo que marcar en esta fecha, del padrón o de los sumados? */
    const hayFilas = filas.length > 0;

    // ¿El grupo tiene miembros, aunque ninguno corresponda a esta fecha? Para
    // distinguir "todavía no hay nadie" de "nadie había entrado todavía".
    const hayAprobados = inscripciones.some((r: any) => String(r.status ?? '').toUpperCase() === 'APPROVED');

    // Esta fecha ya tiene su reunión guardada y no se está editando: no se
    // vuelve a tomar, se ofrece editarla.
    //
    // Mientras el panel de guardado está arriba, no: el historial se recarga
    // con el tilde verde todavía en pantalla, y sin esto la lista de atrás se
    // convertía en la tarjeta a la vista —el velo es traslúcido— justo antes
    // de que la pantalla pase al historial.
    const yaTomada = !editingDate && !!registroDeLaFecha && estadoGuardado === 'cerrado';

    // Se está moviendo una reunión a una fecha que ya tiene la suya. Mover ahí
    // la pisaría: antes el upsert lo hacía en silencio.
    const destinoOcupado = moviendoFecha && !!registroDeLaFecha;

    const loadHistory = useCallback(async () => {
        if (!groupId) return [];
        setLoadingHistory(true);
        const data = await supabaseService.getAttendanceHistory(groupId);
        setHistory(data);
        setLoadingHistory(false);
        return data;
    }, [groupId]);

    useEffect(() => {
        if (activeTab === 'history') {
            loadHistory();
        }
    }, [activeTab, loadHistory]);

    // La pestaña queda en la URL, así recargar no devuelve a "Tomar
    // asistencia" a quien estaba mirando el historial.
    useEffect(() => {
        const deseado = activeTab === 'history' ? '?vista=historial' : '';
        if ((location.search || '') === deseado) return;
        navigate({ search: deseado }, { replace: true });
    }, [activeTab, location.search, navigate]);

    // La reunión recién guardada: se la lleva a la vista y el verde se apaga
    // solo. Es una señal de "es ésta", no un estado que haya que sacarse de
    // encima.
    const filaResaltadaRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!fechaResaltada) return;
        const alLugar = window.setTimeout(() => {
            filaResaltadaRef.current?.scrollIntoView({
                block: 'center',
                behavior: sinMovimiento ? 'auto' : 'smooth',
            });
        }, 80);
        const apagar = window.setTimeout(() => setFechaResaltada(null), 1400);
        return () => { window.clearTimeout(alLugar); window.clearTimeout(apagar); };
    }, [fechaResaltada, sinMovimiento]);

    // Qué (grupo + fecha) ya se cargó en la lista de tildes.
    //
    // Sin esto la asistencia se perdía mientras se tomaba: `group` cambia de
    // identidad cada vez que se re-consulta al grupo, el efecto de abajo
    // volvía a correr y pisaba lo que el anfitrión venía tildando con lo que
    // hay guardado (normalmente vacío). Medido: al tildar a alguien, la
    // selección se borraba sola ~1,5s después y el guardado escribía [].
    const hydratedKeyRef = useRef<string | null>(null);

    useEffect(() => {
        const fetchDateAttendance = async () => {
            let record = history.find(r => r.date === selectedDate);
            if (!record && activeTab === 'new') {
                if (history.length === 0) {
                    const latestHistory = await loadHistory();
                    record = latestHistory.find(r => r.date === selectedDate);
                }
            }
            if (record) {
                // Sólo se hidrata la reunión que se está editando.
                //
                // En un alta nueva no: esa fecha ya tiene su reunión, y lo que
                // se ofrece es editarla, no volver a tomarla. Cargar los
                // tildes acá era lo que hacía que "Guardar asistencia" pisara
                // lo guardado creyendo que era una carga nueva.
                //
                // Mientras se mueve una reunión a otra fecha tampoco: la lista
                // que viaja es la que el anfitrión tiene tildada, no la del
                // destino.
                if (editingDate === selectedDate) {
                    setSelectedMembers(new Set(record.presentMembers));
                    setModoReunion(record.modoReunion);
                }
            } else if (!editingDate) {
                // En modo edición la lista viaja con el registro que se está
                // moviendo: limpiarla acá haría que mover la asistencia del 19
                // al 18 guarde 0 presentes y borre los que tenía el 19.
                setSelectedMembers(new Set());
                setModoReunion(null);
            }
        };
        if (group && activeTab === 'new') {
            // Se hidrata una sola vez por (grupo, fecha). Si ya se cargó, lo
            // que hay en pantalla es la edición en curso del anfitrión y no se
            // toca.
            const key = `${group.id}|${selectedDate}`;
            if (hydratedKeyRef.current === key) return;
            hydratedKeyRef.current = key;
            fetchDateAttendance();
        }
    }, [selectedDate, group, activeTab, loadHistory, editingDate]);

    const toggleMember = (memberId: string) => {
        const newSet = new Set(selectedMembers);
        if (newSet.has(memberId)) newSet.delete(memberId);
        else newSet.add(memberId);
        setSelectedMembers(newSet);
    };

    // Los dos tocan sólo lo visible: los ids que no están en la planilla
    // —presentes de alguien que después se dio de baja— se guardaron una vez y
    // se siguen guardando. Un "marcar todos" de hoy no puede borrar a quien
    // estuvo en esa reunión.
    //
    // "Marcar todos" marca el padrón de la fecha y NO a los sumados después:
    // darle presente a alguien que capaz no estuvo es peor que un tilde que
    // falta. "Desmarcar todos" sí los limpia, o quedaría uno marcado sin que
    // se vea de dónde salió.
    const selectAll = () => setSelectedMembers(prev => {
        const s = new Set(prev);
        members.forEach(m => s.add(m.id));
        return s;
    });
    const deselectAll = () => setSelectedMembers(prev => {
        const s = new Set(prev);
        [...members, ...personasSumadas].forEach(m => s.delete(m.id));
        return s;
    });

    // Un híbrido no guarda sin saber cómo fue la reunión: el botón lo dice.
    const faltaModo = esHibrido && !modoReunion;

    // Abre el calendario nativo. Lo usan la píldora de la fecha y el botón
    // "Elegir otra fecha" de la tarjeta.
    const abrirSelectorDeFecha = () => {
        const input = document.getElementById(`attendance-date-${group?.id}`) as HTMLInputElement | null;
        if (!input) return;
        if ('showPicker' in HTMLInputElement.prototype) {
            try { input.showPicker(); } catch (e) { input.click(); }
        } else {
            input.focus();
            input.click();
        }
    };

    const handleSave = async () => {
        if (!group || faltaModo || destinoOcupado) return;
        // Un segundo toque mientras se está guardando mandaría la reunión dos
        // veces. Desde 'error' sí se puede volver a entrar: es el reintento.
        if (estadoGuardado === 'guardando') return;

        // Alta o edición se deciden ACÁ, antes de que el guardado limpie
        // editingDate: de eso dependen el título del panel y la notificación.
        const esAlta = !editingDate;
        const fechaGuardada = selectedDate;
        const presentes = presentCount;
        const padron = padronVisible;

        setTituloGuardado(esAlta ? 'Asistencia guardada' : 'Cambios guardados');
        setEstadoGuardado('guardando');

        // La carga dura 600 ms como mínimo aunque la base conteste antes: un
        // parpadeo no se lee como "se guardó", se lee como que no pasó nada.
        const [resultado] = await Promise.all([
            supabaseService.guardarAsistencia({
                groupId: group.id,
                fecha: fechaGuardada,
                presentes: Array.from(selectedMembers),
                fechaOriginal: editingDate ?? undefined,
                modoReunion: esHibrido ? modoReunion ?? undefined : undefined,
            }),
            new Promise(resolver => setTimeout(resolver, 600)),
        ]);

        if (!resultado.ok) {
            // Se pregunta con `in` y no por `resultado.ok`: este proyecto
            // compila sin strictNullChecks y ahí el booleano no alcanza para
            // que TypeScript sepa cuál de las dos formas tiene en la mano.
            const duplicado = 'motivo' in resultado && resultado.motivo === 'duplicado';
            if (duplicado) {
                // Alguien la guardó desde otro teléfono mientras tanto. Se
                // cierra sin festejo y la pantalla sola pasa a ofrecer editar
                // la que ganó: no hace falta avisar nada que no se vea.
                setEstadoGuardado('cerrado');
                await loadHistory();
                return;
            }
            // El error se queda en el panel: no se navega y lo marcado sigue
            // donde estaba, listo para reintentar.
            setEstadoGuardado('error');
            return;
        }

        setDetalleGuardado(`${presentes} de ${padron} presentes · ${fechaLarga(fechaGuardada)}`);
        setEstadoGuardado('listo');
        // El registro ya vive en selectedDate: si se vuelve a guardar sin
        // salir de la pantalla, no hay nada más que mover.
        setEditingDate(null);
        // Se trae el historial mientras el tilde está en pantalla, así la lista
        // ya está armada cuando aparece.
        loadHistory();

        // Sólo al tomarla por primera vez. Corregir una reunión no es una
        // novedad que merezca su propia notificación.
        if (esAlta && user?.id) {
            const formattedDate = new Date(fechaGuardada + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long' });
            await supabaseService.createAppNotification(
                user.id,
                '✅ Asistencia registrada',
                `Registraste ${presentes} presente(s) en ${group.name} el ${formattedDate}. ¡Seguí así!`,
                'ATTENDANCE',
                // Al historial de ESTE grupo, no a la lista de grupos: desde la
                // notificación se quiere ver la reunión, no buscarla.
                `/mis-grupos/${group.id}/asistencia?vista=historial`
            );
        }

        // El tilde se queda 900 ms —lo suficiente para verlo— y recién después
        // la pantalla pasa al historial con la reunión resaltada.
        await new Promise(resolver => setTimeout(resolver, 900));
        setEstadoGuardado('cerrado');
        setActiveTab('history');
        setFechaResaltada(fechaGuardada);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    if (loadingGroup) return (
        <div className={`min-h-screen flex items-center justify-center ${T.fondo}`}>
            <Loader2 className="w-8 h-8 animate-spin text-black/20 dark:text-white/20" />
        </div>
    );

    if (!group) return null;

    return (
        <div id="gcx-accion" className={`min-h-screen ${T.fondo} ${T.fuente} ${T.tinta}`}>

            <div className="bg-white dark:bg-[#1b1b1a] rounded-b-[28px] px-5 pt-4 pb-[18px] lg:px-8">
                <div className="max-w-[430px] lg:max-w-[900px] mx-auto">
                    <Encabezado
                        accion="Tomar asistencia"
                        grupo={group.name}
                        onVolver={() => navigate(`/mis-grupos/${groupId}`)}
                    />

                    <div className="flex items-center gap-2.5 mt-[18px]">
                        {/* Selector de fecha: una píldora, no un campo de formulario.
                            Editar una fecha anterior no es otra pantalla — cambia el
                            rótulo y el botón pasa a "Guardar cambios". */}
                        <div
                            className={`relative flex-1 min-w-0 h-[52px] rounded-full ${T.interna} flex items-center gap-2 px-[15px] cursor-pointer`}
                            onClick={abrirSelectorDeFecha}
                        >
                            <Calendar className="w-[17px] h-[17px] shrink-0" strokeWidth={2} />
                            <span className="flex-1 min-w-0 text-[14.5px] font-semibold truncate first-letter:uppercase">{fechaPildora(selectedDate)}</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                                strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-black/40 dark:text-white/40" aria-hidden="true">
                                <path d="M6 9l6 6 6-6" />
                            </svg>
                            {/* max = hoy: se puede registrar una reunión que ya pasó,
                                nunca una que todavía no ocurrió. */}
                            <input
                                id={`attendance-date-${group.id}`}
                                type="date"
                                value={selectedDate}
                                max={hoyLocal()}
                                onChange={(e) => {
                                    if (e.target.value && e.target.value > hoyLocal()) return;
                                    setSelectedDate(e.target.value);
                                }}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                style={{ background: 'transparent', border: 0 }}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() => { setEditingDate(null); setActiveTab(activeTab === 'new' ? 'history' : 'new'); }}
                            aria-label={activeTab === 'new' ? 'Ver reuniones anteriores' : 'Volver a tomar asistencia'}
                            className={`w-[52px] h-[52px] shrink-0 rounded-full flex items-center justify-center transition-colors ${activeTab === 'history'
                                ? 'bg-[#0a0a0a] dark:bg-white text-white dark:text-black'
                                : `${T.interna} hover:opacity-80`}`}
                        >
                            <History className="w-[18px] h-[18px]" strokeWidth={2} />
                        </button>
                    </div>

                    {moviendoFecha && (
                        destinoOcupado ? (
                            // Mover acá pisaría la reunión que esa fecha ya tiene.
                            // Antes el upsert lo hacía sin decir nada.
                            <p className="mt-2.5 px-1 text-[12.5px] font-medium text-black/55 dark:text-white/55">
                                El {formatDate(selectedDate)} ya tiene su propia asistencia. Elegí otra fecha o editá esa.{' '}
                                <button
                                    type="button"
                                    onClick={() => {
                                        hydratedKeyRef.current = null;
                                        setEditingDate(selectedDate);
                                    }}
                                    className="font-semibold underline underline-offset-2 hover:opacity-70 transition-opacity"
                                >
                                    Editar la del {formatDate(selectedDate)}
                                </button>
                            </p>
                        ) : (
                            <p className="mt-2.5 px-1 text-[12.5px] font-medium text-black/55 dark:text-white/55">
                                Al guardar, la asistencia del {formatDate(editingDate!)} se mueve al {formatDate(selectedDate)}.
                            </p>
                        )
                    )}

                    {/* Híbrido: antes de tildar, cómo fue esta reunión. Va en
                        el encabezado, junto a la fecha, porque las dos cosas
                        describen la reunión y no a las personas. */}
                    {esHibrido && activeTab === 'new' && (
                        <div className="mt-4">
                            <p className="px-1 mb-2 text-[13px] font-semibold">¿Cómo fue esta reunión?</p>
                            <div className="flex gap-2" role="radiogroup" aria-label="Cómo fue esta reunión">
                                {MODOS_REUNION.map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        role="radio"
                                        aria-checked={modoReunion === m}
                                        onClick={() => setModoReunion(m)}
                                        className={`flex-1 h-[48px] rounded-full font-semibold text-[15px] transition-colors ${modoReunion === m
                                            ? 'bg-[#0a0a0a] dark:bg-white text-white dark:text-black'
                                            : `${T.interna} text-black/55 dark:text-white/55`}`}
                                    >
                                        {NOMBRE_MODO_REUNION[m]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'new' ? (
                <>
                    {/* Resumen en vivo, pegado bajo el encabezado: se actualiza
                        mientras se tilda, sin bajar a buscarlo. */}
                    {hayFilas && !yaTomada && (
                        <div className="sticky top-0 z-20 px-4 pt-3 pb-1 bg-gradient-to-b from-[#f6f6f4] from-[78%] to-transparent dark:from-[#111110]">
                            <div className="max-w-[430px] lg:max-w-[900px] mx-auto bg-[#0a0a0a] dark:bg-white rounded-[24px] px-[18px] py-4">
                                <div className="flex items-end justify-between">
                                    <div className="flex items-baseline gap-[18px]">
                                        <div>
                                            <p className="text-[26px] font-semibold tracking-[-.02em] text-white dark:text-black tabular-nums">{presentCount}</p>
                                            <p className="mt-0.5 text-[11.5px] font-semibold uppercase tracking-[.06em] text-white/50 dark:text-black/50">Presentes</p>
                                        </div>
                                        <div>
                                            <p className="text-[26px] font-semibold tracking-[-.02em] text-white/45 dark:text-black/45 tabular-nums">{absentCount}</p>
                                            <p className="mt-0.5 text-[11.5px] font-semibold uppercase tracking-[.06em] text-white/35 dark:text-black/35">Ausentes</p>
                                        </div>
                                    </div>
                                    <p className="text-[22px] font-semibold tracking-[-.02em] text-white dark:text-black tabular-nums">{presentPct}%</p>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/[.16] dark:bg-black/[.16] mt-3.5 overflow-hidden">
                                    <div className="h-full rounded-full bg-white dark:bg-black transition-all duration-500" style={{ width: `${presentPct}%` }} />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="max-w-[430px] lg:max-w-[900px] mx-auto px-4 pt-2 pb-[132px]">
                        {yaTomada ? (
                            /* Esta fecha ya tiene su reunión. No se vuelve a tomar
                               —eso la pisaba— y se ofrece editarla. Como la fecha
                               por defecto es hoy, quien ya cargó hoy aterriza acá. */
                            <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px] px-6 pt-[46px] pb-10 flex flex-col items-center text-center">
                                <div className="w-[64px] h-[64px] rounded-full bg-[#f2f2f0] dark:bg-[#2a2a28] flex items-center justify-center">
                                    <Check className="w-[29px] h-[29px]" strokeWidth={2.6} />
                                </div>
                                <p className="mt-[22px] text-[19px] font-semibold tracking-[-.01em] first-letter:uppercase">
                                    Ya tomaste asistencia el {fechaLarga(selectedDate)}
                                </p>
                                <p className="mt-2 text-[14.5px] font-medium text-black/50 dark:text-white/50">
                                    {registroDeLaFecha!.count} de {registroDeLaFecha!.expectedMembers?.length ?? members.length} presentes
                                </p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        hydratedKeyRef.current = null;
                                        setEditingDate(selectedDate);
                                    }}
                                    className={`${btnPrimario} mt-[26px] h-[54px] text-[16px]`}
                                >
                                    Editar esa asistencia
                                </button>
                                <button
                                    type="button"
                                    onClick={abrirSelectorDeFecha}
                                    className={`${btnSecundario} mt-2.5 w-full h-[54px] text-[16px]`}
                                >
                                    Elegir otra fecha
                                </button>
                            </div>
                        ) : !hayFilas ? (
                            <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px]">
                                {hayAprobados ? (
                                    // El grupo tiene gente, pero toda entró después de esta
                                    // fecha. No es una pantalla vacía: es una reunión a la
                                    // que todavía no iba nadie.
                                    <Vacio
                                        titulo="Todavía no había nadie"
                                        detalle={`Nadie del grupo había ingresado todavía el ${formatDate(selectedDate)}.`}
                                        accion={{ texto: 'Volver al grupo', onClick: () => navigate(`/mis-grupos/${groupId}`) }}
                                    />
                                ) : (
                                    <Vacio
                                        titulo="Todavía no hay miembros"
                                        detalle="Cuando alguien se sume al grupo vas a poder tomarle asistencia."
                                        accion={{ texto: 'Volver al grupo', onClick: () => navigate(`/mis-grupos/${groupId}`) }}
                                    />
                                )}
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between px-1.5 pt-1.5 pb-2.5">
                                    <p className={rotulo}>Miembros · {members.length}</p>
                                    <button
                                        type="button"
                                        onClick={presentesDeLaFecha === members.length ? deselectAll : selectAll}
                                        className="text-[13px] font-semibold hover:opacity-70 transition-opacity"
                                    >
                                        {presentesDeLaFecha === members.length ? 'Desmarcar todos' : 'Marcar todos presentes'}
                                    </button>
                                </div>


                                <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px] overflow-hidden">
                                    {filas.map((fila, i) => {
                                        const esPareja = fila.personas.length > 1;
                                        const presentes = fila.personas.filter(p => selectedMembers.has(p.id)).length;
                                        const abierta = expandidas.has(fila.regId);
                                        const todosPresentes = presentes === fila.personas.length;

                                        return (
                                            <React.Fragment key={fila.regId}>
                                                {i > 0 && <div className="h-px bg-black/[.06] dark:bg-white/[.08] mx-4" />}

                                                {/* El corte entre el padrón de la fecha y los que
                                                    entraron después. Sin esto se leerían como
                                                    ausentes de una reunión a la que no iban. */}
                                                {fila.sumado && (i === 0 || !filas[i - 1].sumado) && (
                                                    <div className="px-4 pt-4 pb-2">
                                                        <p className={rotulo}>Se sumaron después</p>
                                                        <p className="mt-1.5 text-[12.5px] font-medium leading-[1.45] text-black/45 dark:text-white/45">
                                                            Entraron al grupo después del {fechaLarga(selectedDate)}. Marcá sólo a quien haya estado.
                                                        </p>
                                                    </div>
                                                )}

                                                {esPareja ? (
                                                    <>
                                                        <div className="flex items-center h-[68px] pr-4 select-none transition-colors hover:bg-black/[.02] dark:hover:bg-white/[.03]">
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandidas(prev => {
                                                                const s = new Set(prev);
                                                                if (s.has(fila.regId)) s.delete(fila.regId); else s.add(fila.regId);
                                                                return s;
                                                            })}
                                                            aria-expanded={abierta}
                                                            aria-label={`${abierta ? 'Contraer' : 'Desplegar'} la inscripción de ${fila.personas.map(p => p.name).join(' y ')}`}
                                                            className="flex-1 min-w-0 flex items-center gap-3 h-full pl-4 pr-0"
                                                        >
                                                            <div className="flex shrink-0 w-[58px]">
                                                                {fila.personas.slice(0, 2).map((p, k) => (
                                                                    <div
                                                                        key={p.id}
                                                                        className={`w-[36px] h-[36px] rounded-full flex items-center justify-center text-[12.5px] font-semibold text-black/60 dark:text-white/60 ${k === 0
                                                                            ? T.chip
                                                                            : 'bg-[#e8e8e5] dark:bg-[#333331] -ml-[13px] ring-[3px] ring-white dark:ring-[#1b1b1a]'}`}
                                                                    >
                                                                        {/* Una sola inicial: en pareja los avatares se
                                                                            superponen y la segunda letra queda tapada. */}
                                                                        {(p.name.trim()[0] || '?').toUpperCase()}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="flex-1 min-w-0 text-left">
                                                                <p className="text-[15.5px] font-semibold truncate">
                                                                    {fila.personas[0].name.split(' ')[0]} y {fila.personas[1].name.split(' ')[0]}
                                                                </p>
                                                                <p className="mt-0.5 text-[12.5px] font-medium text-black/45 dark:text-white/45 truncate">
                                                                    Pareja · {presentes} de {fila.personas.length}
                                                                </p>
                                                            </div>
                                                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                                                                strokeLinecap="round" strokeLinejoin="round"
                                                                className={`shrink-0 text-black/35 dark:text-white/35 transition-transform ${abierta ? 'rotate-180' : ''}`} aria-hidden="true">
                                                                <path d="M6 9l6 6 6-6" />
                                                            </svg>
                                                        </button>

                                                        {/* Marca o desmarca a los dos de una: si falta alguno,
                                                            el toggle completa la pareja. */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedMembers(prev => {
                                                                const s = new Set(prev);
                                                                fila.personas.forEach(p => todosPresentes ? s.delete(p.id) : s.add(p.id));
                                                                return s;
                                                            })}
                                                            role="checkbox"
                                                            aria-checked={todosPresentes}
                                                            aria-label={`Marcar presentes a ${fila.personas.map(p => p.name).join(' y ')}`}
                                                            className="shrink-0 flex items-center"
                                                        >
                                                            <Tilde presente={todosPresentes} />
                                                        </button>
                                                        </div>

                                                        {abierta && fila.personas.map(p => {
                                                            const presente = selectedMembers.has(p.id);
                                                            return (
                                                                <button
                                                                    key={p.id}
                                                                    type="button"
                                                                    onClick={() => toggleMember(p.id)}
                                                                    role="checkbox"
                                                                    aria-checked={presente}
                                                                    className="w-full flex items-center gap-3.5 h-[60px] pl-[58px] pr-4 select-none transition-colors hover:bg-black/[.02] dark:hover:bg-white/[.03]"
                                                                >
                                                                    <span className="flex-1 text-left text-[14.5px] font-medium truncate">{p.name}</span>
                                                                    <Tilde presente={presente} chico />
                                                                </button>
                                                            );
                                                        })}
                                                    </>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleMember(fila.personas[0].id)}
                                                        role="checkbox"
                                                        aria-checked={todosPresentes}
                                                        className="w-full flex items-center gap-3.5 h-[68px] px-4 select-none transition-colors hover:bg-black/[.02] dark:hover:bg-white/[.03]"
                                                    >
                                                        <div className={`w-[42px] h-[42px] shrink-0 rounded-full ${T.chip} flex items-center justify-center text-[14px] font-semibold text-black/60 dark:text-white/60`}>
                                                            {getInitials(fila.personas[0].name)}
                                                        </div>
                                                        <span className="flex-1 text-left text-[15.5px] font-semibold truncate">{fila.personas[0].name}</span>
                                                        <Tilde presente={todosPresentes} />
                                                    </button>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Guardar anclado abajo: se toma asistencia parado, con la
                        lista scrolleada. */}
                    {hayFilas && !yaTomada && (
                        <div className="fixed left-0 right-0 bottom-0 px-4 pt-3.5 pb-5 bg-gradient-to-t from-[#f6f6f4] from-[62%] to-transparent dark:from-[#111110]">
                            <div className="max-w-[430px] lg:max-w-[900px] mx-auto">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={estadoGuardado !== 'cerrado' || faltaModo || destinoOcupado}
                                    className={`${btnPrimario} h-[60px] text-[17px] shadow-[0_6px_22px_rgba(0,0,0,.18)]`}
                                >
                                    {/* El resultado ya no vive acá: lo cuenta el panel
                                        que sube al guardar. */}
                                    {destinoOcupado ? (
                                        'Esa fecha ya está tomada'
                                    ) : faltaModo ? (
                                        'Elegí cómo fue la reunión'
                                    ) : (
                                        <><Save className="w-5 h-5" /> {editingDate ? 'Guardar cambios' : 'Guardar asistencia'}</>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="max-w-[430px] lg:max-w-[900px] mx-auto px-4 pt-4 pb-8">
                    {loadingHistory ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-black/20 dark:text-white/20" /></div>
                    ) : history.length === 0 ? (
                        <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px]">
                            <Vacio
                                titulo="Todavía no registraste ninguna reunión"
                                detalle="Cuando guardes una asistencia va a quedar acá, para consultarla o corregirla."
                                accion={{ texto: 'Tomar asistencia', onClick: () => setActiveTab('new') }}
                            />
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px] overflow-hidden">
                            {history.map((record, i) => (
                                <React.Fragment key={record.id}>
                                    {i > 0 && <div className="h-px bg-black/[.06] dark:bg-white/[.08] mx-4" />}
                                    <div
                                        ref={record.date === fechaResaltada ? filaResaltadaRef : undefined}
                                        className={`flex items-center gap-3.5 h-[70px] px-4 transition-colors duration-[600ms] ${record.date === fechaResaltada ? 'bg-[#16a34a]/[.14]' : 'bg-transparent'}`}
                                    >
                                        <div className={`w-[42px] h-[42px] shrink-0 rounded-full ${T.chip} flex items-center justify-center`}>
                                            <Calendar className="w-[18px] h-[18px] text-black/50 dark:text-white/50" strokeWidth={2} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[15.5px] font-semibold truncate first-letter:uppercase">{fechaLarga(record.date)}</p>
                                            {/* Contra el padrón de ESA fecha: "8 presentes" no dice
                                                nada sin saber de cuántos. */}
                                            <p className="mt-0.5 text-[12.5px] font-medium text-black/45 dark:text-white/45">
                                                {(() => {
                                                    const padron = record.expectedMembers?.length
                                                        ?? padronDeReunion({ ...record, date: record.date }, inscripciones).size;
                                                    const pct = padron > 0 ? Math.round((record.count / padron) * 100) : 0;
                                                    return `${record.count} de ${padron} presentes · ${pct}%`;
                                                })()}
                                                {record.modoReunion && ` · ${NOMBRE_MODO_REUNION[record.modoReunion]}`}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                // Fuerza recargar los tildes de ese día aunque
                                                // ya se estuviera parado en esa misma fecha.
                                                hydratedKeyRef.current = null;
                                                setEditingDate(record.date);
                                                setSelectedDate(record.date);
                                                setActiveTab('new');
                                            }}
                                            className={`${btnSecundario} h-[42px] px-[18px] text-[14px] shrink-0`}
                                        >
                                            Editar
                                        </button>
                                    </div>
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Lo que pasa después de tocar Guardar. Va fuera de las dos
                pestañas: la secuencia termina cambiando de pestaña. */}
            <PanelGuardado
                estado={estadoGuardado}
                titulo={tituloGuardado}
                detalle={detalleGuardado}
                onReintentar={handleSave}
                onCerrar={() => setEstadoGuardado('cerrado')}
            />
        </div>
    );
};

export default PaginaAsistenciaGrupo;
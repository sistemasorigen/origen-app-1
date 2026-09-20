import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { useAuth } from '../../contexts/AuthContext';
import { Calendar, History, Save, Check, Loader2 } from 'lucide-react';
import { T, btnPrimario, btnSecundario, rotulo, Encabezado, Vacio } from '../../components/GCX/patron';

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
}

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
    const { user } = useAuth();

    const [group, setGroup] = useState<{ id: string; name: string; registrations?: any[] } | null>(null);
    const [loadingGroup, setLoadingGroup] = useState(true);

    // `?vista=historial` la abre en lo que ya pasó. Lo usa el detalle de un
    // grupo terminado, donde la asistencia se consulta y no se carga.
    const [activeTab, setActiveTab] = useState<'new' | 'history'>(
        () => new URLSearchParams(window.location.search).get('vista') === 'historial' ? 'history' : 'new'
    );
    const [selectedDate, setSelectedDate] = useState(hoyLocal);

    // Fecha del registro que se abrió con "Editar". Si al guardar la fecha
    // cambió, el registro se mueve en vez de duplicarse. null = alta nueva.
    const [editingDate, setEditingDate] = useState<string | null>(null);

    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [saving, setSaving] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
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

    // Extract members — una fila de registro puede
    // representar 2 personas (pareja). Se expande
    // cada fila a 1 o 2 entradas de Member.
    const members: Member[] = (group?.registrations || [])
        .filter((r: any) => r.status === 'APPROVED')
        .flatMap((r: any) => {
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
        });

    // Las mismas personas, pero agrupadas por inscripción: el diseño muestra
    // la pareja como UNA fila. Los ids no cambian, así que selectedMembers y
    // saveAttendance siguen viendo exactamente lo de antes.
    const filas: { regId: string; personas: Member[] }[] = (group?.registrations || [])
        .filter((r: any) => r.status === 'APPROVED')
        .map((r: any) => {
            const propias = members.filter(m => m.id === r.id || m.id === `${r.id}-partner`);
            return { regId: r.id, personas: propias };
        })
        .filter(f => f.personas.length > 0);

    const presentCount = selectedMembers.size;
    const absentCount = members.length - presentCount;
    const presentPct = members.length > 0 ? Math.round((presentCount / members.length) * 100) : 0;

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
                setSelectedMembers(new Set(record.presentMembers));
            } else if (!editingDate) {
                // En modo edición la lista viaja con el registro que se está
                // moviendo: limpiarla acá haría que mover la asistencia del 19
                // al 18 guarde 0 presentes y borre los que tenía el 19.
                setSelectedMembers(new Set());
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

    const selectAll = () => setSelectedMembers(new Set(members.map(m => m.id)));
    const deselectAll = () => setSelectedMembers(new Set());

    const handleSave = async () => {
        if (!group) return;
        setSaving(true);
        setSaveSuccess(false);
        const success = await supabaseService.saveAttendance(
            group.id,
            selectedDate,
            Array.from(selectedMembers),
            editingDate ?? undefined
        );
        setSaving(false);
        if (success) {
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3000);
            // El registro ya vive en selectedDate: si se vuelve a guardar sin
            // salir de la pantalla, no hay nada más que mover.
            setEditingDate(null);
            loadHistory();
            if (user?.id) {
                const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long' });
                await supabaseService.createAppNotification(
                    user.id,
                    '✅ Asistencia registrada',
                    `Registraste ${selectedMembers.size} presente(s) en ${group.name} el ${formattedDate}. ¡Seguí así!`,
                    'ATTENDANCE',
                    '/mis-grupos'
                );
            }
        }
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
                            onClick={() => {
                                const input = document.getElementById(`attendance-date-${group.id}`) as HTMLInputElement;
                                if (input) {
                                    if ('showPicker' in HTMLInputElement.prototype) {
                                        try { input.showPicker(); } catch (e) { input.click(); }
                                    } else {
                                        input.focus();
                                        input.click();
                                    }
                                }
                            }}
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

                    {editingDate && editingDate !== selectedDate && (
                        <p className="mt-2.5 px-1 text-[12.5px] font-medium text-black/55 dark:text-white/55">
                            Al guardar, la asistencia del {formatDate(editingDate)} se mueve al {formatDate(selectedDate)}.
                        </p>
                    )}
                </div>
            </div>

            {activeTab === 'new' ? (
                <>
                    {/* Resumen en vivo, pegado bajo el encabezado: se actualiza
                        mientras se tilda, sin bajar a buscarlo. */}
                    {members.length > 0 && (
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
                        {members.length === 0 ? (
                            <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px]">
                                <Vacio
                                    titulo="Todavía no hay miembros"
                                    detalle="Cuando alguien se sume al grupo vas a poder tomarle asistencia."
                                    accion={{ texto: 'Volver al grupo', onClick: () => navigate(`/mis-grupos/${groupId}`) }}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between px-1.5 pt-1.5 pb-2.5">
                                    <p className={rotulo}>Miembros · {members.length}</p>
                                    <button
                                        type="button"
                                        onClick={presentCount === members.length ? deselectAll : selectAll}
                                        className="text-[13px] font-semibold hover:opacity-70 transition-opacity"
                                    >
                                        {presentCount === members.length ? 'Desmarcar todos' : 'Marcar todos presentes'}
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
                    {members.length > 0 && (
                        <div className="fixed left-0 right-0 bottom-0 px-4 pt-3.5 pb-5 bg-gradient-to-t from-[#f6f6f4] from-[62%] to-transparent dark:from-[#111110]">
                            <div className="max-w-[430px] lg:max-w-[900px] mx-auto">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving}
                                    className={`${btnPrimario} h-[60px] text-[17px] shadow-[0_6px_22px_rgba(0,0,0,.18)]`}
                                >
                                    {saving ? (
                                        <><Loader2 className="w-5 h-5 animate-spin" /> Guardando…</>
                                    ) : saveSuccess ? (
                                        <><Check className="w-5 h-5" /> Guardado</>
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
                                    <div className="flex items-center gap-3.5 h-[70px] px-4">
                                        <div className={`w-[42px] h-[42px] shrink-0 rounded-full ${T.chip} flex items-center justify-center`}>
                                            <Calendar className="w-[18px] h-[18px] text-black/50 dark:text-white/50" strokeWidth={2} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[15.5px] font-semibold truncate first-letter:uppercase">{fechaLarga(record.date)}</p>
                                            <p className="mt-0.5 text-[12.5px] font-medium text-black/45 dark:text-white/45">
                                                {record.count} {record.count === 1 ? 'presente' : 'presentes'}
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
        </div>
    );
};

export default PaginaAsistenciaGrupo;
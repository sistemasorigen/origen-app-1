import React, { useState, useEffect, useCallback } from 'react';
import { NOMBRE_MODALIDAD, modalidadDe, llevaDireccion } from '../../src/utils/modalidad';
import { useParams, useNavigate } from 'react-router-dom';
import { Group, GroupTag, GroupCategory, esGrupoPendiente } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import PestanasGrupoAdmin from '../../components/GCX/PestanasGrupoAdmin';
import { supabase } from '../../services/supabaseClient';
import { Check, Loader2 } from 'lucide-react';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';

/**
 * Ficha de un grupo (design-claude/Admin GCX - Detalle e Inscriptos).
 *
 * Arriba, lo que hay que decidir: si el grupo está pendiente, la tarjeta de
 * revisión con las cuatro cosas que conviene mirar antes de aprobar; si ya
 * está resuelto, el estado y las acciones que quedan. Abajo, la ficha
 * completa y, a un costado, quién lo lidera y cómo va el cupo.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-09-16" → "16 sep 2026" */
const fechaLarga = (iso?: string) => {
    if (!iso) return '';
    const [a, m, d] = iso.split('T')[0].split('-').map(Number);
    if (!a || !m || !d) return '';
    return `${d} ${MESES[m - 1]} ${a}`;
};

/** "2026-09-16" → "16 sep" */
const fechaCorta = (iso?: string) => {
    const larga = fechaLarga(iso);
    return larga ? larga.split(' ').slice(0, 2).join(' ') : '';
};

const haceCuanto = (iso?: string) => {
    if (!iso) return '';
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (isNaN(dias) || dias < 0) return '';
    if (dias === 0) return 'hoy';
    if (dias === 1) return 'ayer';
    if (dias < 31) return `hace ${dias} días`;
    const meses = Math.round(dias / 30);
    return meses <= 1 ? 'hace un mes' : `hace ${meses} meses`;
};

const iniciales = (nombre: string) =>
    (nombre || '').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';

interface ContenidoProps {
    /** La cabecera necesita el nombre y el número de inscriptos. */
    onGrupo: (grupo: Group) => void;
}

const DetalleGrupoAdminContent: React.FC<ContenidoProps> = ({ onGrupo }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const { showToast } = useAdminGCXToast();

    const [group, setGroup] = useState<Group | null>(null);
    const [todos, setTodos] = useState<Group[]>([]);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [adminNote, setAdminNote] = useState('');
    const [coHostDetails, setCoHostDetails] = useState<{ name: string; email: string } | null>(null);
    const [descripcionExpandida, setDescripcionExpandida] = useState(false);
    const [modal, setModal] = useState<null | 'aprobar' | 'rechazar'>(null);
    useBloqueoDeFondo(modal !== null);

    const fetchGroup = useCallback(async () => {
        if (!groupId) return;
        setLoading(true);
        try {
            const [allGroups, cats, tgs] = await Promise.all([
                supabaseService.getGroupsForAdmin(),
                supabaseService.getGroupCategories(),
                supabaseService.getGroupTags(),
            ]);
            const found = allGroups.find(g => g.id === groupId);
            if (!found) {
                navigate('/admingcx/gestion-de-grupos', { replace: true });
                return;
            }
            setGroup(found);
            setTodos(allGroups);
            setCategories(cats);
            setTags(tgs);
            onGrupo(found);
        } finally {
            setLoading(false);
        }
    }, [groupId, navigate, onGrupo]);

    useEffect(() => { fetchGroup(); }, [fetchGroup]);

    useEffect(() => {
        if (group?.co_host_id && !group.coHostFirstName && !group.coHostLastName) {
            supabase
                .from('users')
                .select('name, email')
                .eq('id', group.co_host_id)
                .single()
                .then(({ data, error }) => {
                    if (!error && data) setCoHostDetails(data);
                });
        }
    }, [group?.co_host_id, group?.coHostFirstName, group?.coHostLastName]);

    const decidir = async (estado: 'approved' | 'rejected') => {
        if (!group) return;
        setIsActionLoading(true);
        try {
            const ok = await supabaseService.updateGroupStatus(group.id, estado, adminNote || undefined);
            if (ok) {
                setModal(null);
                showToast(estado === 'approved' ? 'Grupo aprobado' : 'Grupo rechazado. Se le avisó al anfitrión.');
                await fetchGroup();
            } else {
                showToast(estado === 'approved' ? 'Error al aprobar el grupo' : 'Error al rechazar el grupo', 'error');
            }
        } catch (error) {
            console.error('[Detalle] Error al decidir:', error);
            showToast('Error al guardar la decisión', 'error');
        } finally {
            setIsActionLoading(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center rounded-[20px] bg-white py-20">
            <Loader2 className="h-7 w-7 animate-spin text-black/20" />
        </div>
    );

    if (!group) return null;

    const finalizado = !!group.endDate && group.endDate < new Date().toISOString().split('T')[0];
    const esPendiente = group.status === 'pending' || !group.status;
    const esRechazado = group.status === 'rejected';
    const esAprobado = group.status === 'approved' || group.status === 'finished';

    const category = categories.find(c => c.id === group.categoryId);
    const groupTags = (group.tags || []).map(id => tags.find(t => t.id === id)).filter(Boolean) as GroupTag[];

    const anfitrion = `${group.leaderName || ''} ${group.leaderSurname || ''}`.trim() || 'Sin anfitrión';
    const primerNombre = anfitrion.split(' ')[0];
    const coAnfitrion = (group.coHostFirstName || group.coHostLastName)
        ? `${group.coHostFirstName || ''} ${group.coHostLastName || ''}`.trim()
        : coHostDetails?.name || '';

    // Cupo: una inscripción de parejas ocupa dos lugares.
    const esGrupoDeParejas = (category?.name?.toLowerCase() === 'parejas'
        || groupTags.some(t => t.name?.toLowerCase() === 'parejas'))
        && group.targetGender === 'Mixto';
    const inscripciones = group.registrations || [];
    const nParejas = inscripciones.filter(r => !!r.partnerData).length;
    const ocupados = esGrupoDeParejas ? inscripciones.length * 2 : inscripciones.length;
    const libres = Math.max(0, (group.maxCapacity || 0) - ocupados);
    const pct = Math.min(100, Math.round((ocupados / (group.maxCapacity || 1)) * 100));

    // Otros grupos del mismo anfitrión y de la misma categoría, que es lo que
    // se mira antes de aprobar uno nuevo.
    const otrosDelAnfitrion = todos.filter(g =>
        g.id !== group.id
        && g.status === 'approved'
        && (group.host_id ? g.host_id === group.host_id : `${g.leaderName} ${g.leaderSurname}`.trim() === anfitrion)
    );
    const mismaCategoria = todos.filter(g => g.id !== group.id && g.status === 'approved' && g.categoryId === group.categoryId);

    const fichaCompleta = !!group.description && !!group.categoryId && !!group.meetingDay && !!group.meetingTime
        && !!group.maxCapacity && (group.isOnline || !!group.location);

    const telefonoLimpio = (group.leaderPhone || '').replace(/\D/g, '');

    const pill = (bg: string, fg: string, dot: string, texto: string) => (
        <span
            className="flex h-[26px] w-fit items-center gap-1.5 rounded-full px-[11px] text-[11.5px] font-semibold"
            style={{ background: bg, color: fg }}
        >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
            {texto}
        </span>
    );

    const botonAccion = 'h-11 rounded-full px-[18px] text-[13.5px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 w-full md:w-auto';

    const tarjetaChequeo = (ok: boolean, titulo: string, texto: string) => (
        <div key={titulo} className="rounded-[16px] bg-[#f7f7f5] px-4 py-3.5">
            <div className="flex items-center gap-2">
                {ok
                    ? <Check className="h-[15px] w-[15px] flex-none text-[#15803d]" strokeWidth={2.6} />
                    : <span className="h-[15px] w-[15px] flex-none rounded-full bg-[#b45309]" />}
                <span className="text-[13px] font-semibold text-[#0a0a0a]">{titulo}</span>
            </div>
            <p className="mt-[7px] text-[12.5px] font-medium leading-[1.5] text-black/[.62]">{texto}</p>
        </div>
    );

    const filaDato = (rotulo: string, valor: string) => (
        <div key={rotulo} className="flex items-center justify-between gap-3.5 border-b border-[#f4f3f1] py-[11px] last:border-b-0">
            <span className="text-[12.5px] font-medium text-black/[.62]">{rotulo}</span>
            <span className="text-right text-[12.5px] font-semibold text-[#0a0a0a]">{valor}</span>
        </div>
    );

    const temporada = group.startDate
        ? `${fechaCorta(group.startDate)}${group.endDate ? ` a ${fechaCorta(group.endDate)}` : ''} · ${group.startDate.slice(0, 4)}`
        : 'Sin fechas cargadas';

    return (
        <>
            {/* ── Estado y decisión ───────────────────────────────── */}
            {esPendiente && (
                <div className="rounded-[20px] bg-white px-[22px] py-5 shadow-[inset_0_0_0_1.5px_#f0d9b4]">
                    <div className="flex flex-wrap items-start gap-3.5">
                        <div className="min-w-[220px] flex-1">
                            {pill('#fdf0dc', '#7a4f10', '#b45309', 'Pendiente de aprobación')}
                            <p className="mt-3 text-[20px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                                Este grupo espera tu revisión
                            </p>
                            <p className="mt-[7px] text-[13px] font-medium leading-[1.6] text-black/[.62]">
                                Lo creó {anfitrion}{haceCuanto(group.createdAt) ? ` ${haceCuanto(group.createdAt)}` : ''}. Mientras esté pendiente no aparece en el catálogo público y nadie puede anotarse.
                            </p>
                        </div>
                        <div className="flex w-full flex-wrap gap-2.5 md:min-w-0 md:flex-1">
                            <button onClick={() => setModal('rechazar')} className={`${botonAccion} !h-12 bg-[#fdecea] px-5 text-[14.5px] text-[#a32218]`}>
                                Rechazar
                            </button>
                            <button onClick={() => setModal('aprobar')} className={`${botonAccion} !h-12 bg-[#0a0a0a] px-[26px] text-[14.5px] text-white`}>
                                Aprobar el grupo
                            </button>
                        </div>
                    </div>

                    <p className="mb-2.5 mt-5 text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58]">
                        Antes de decidir
                    </p>
                    <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
                        {tarjetaChequeo(
                            fichaCompleta,
                            fichaCompleta ? 'Ficha completa' : 'Ficha incompleta',
                            fichaCompleta
                                ? 'Tiene descripción, categoría, horario y capacidad cargados.'
                                : 'Le falta descripción, categoría, horario, lugar o capacidad. Conviene pedirle que la complete.'
                        )}
                        {tarjetaChequeo(
                            !!coAnfitrion,
                            coAnfitrion ? 'Tiene co-anfitrión' : 'Sin co-anfitrión',
                            coAnfitrion
                                ? `${coAnfitrion} puede conducir y reportar si ${primerNombre} falta.`
                                : 'No reportó el grupo con co-anfitrión.'
                        )}
                        {tarjetaChequeo(
                            otrosDelAnfitrion.length === 0,
                            otrosDelAnfitrion.length === 0
                                ? 'Sería su primer grupo'
                                : `Ya lidera ${otrosDelAnfitrion.length} ${otrosDelAnfitrion.length === 1 ? 'grupo' : 'grupos'}`,
                            otrosDelAnfitrion.length === 0
                                ? `${primerNombre} no lidera ningún otro grupo activo.`
                                : otrosDelAnfitrion.slice(0, 2).map(g => `${g.name}, ${g.meetingDay?.toLowerCase()} ${g.meetingTime}`).join('. ') + '.'
                        )}
                        {tarjetaChequeo(
                            mismaCategoria.length === 0,
                            mismaCategoria.length === 0 ? 'Categoría sin cubrir' : `${mismaCategoria.length} ${mismaCategoria.length === 1 ? 'grupo' : 'grupos'} de lo mismo`,
                            mismaCategoria.length === 0
                                ? `No hay otro grupo activo de ${category?.name || 'esta categoría'}.`
                                : `Ya hay ${mismaCategoria.length} ${mismaCategoria.length === 1 ? 'grupo activo' : 'grupos activos'} de ${category?.name || 'esta categoría'}.`
                        )}
                    </div>
                </div>
            )}

            {esAprobado && (
                <div className="flex flex-wrap items-center gap-3.5 rounded-[20px] bg-white px-[22px] py-[18px]">
                    <div className="min-w-[200px] flex-1">
                        {finalizado
                            ? pill('#f0efec', 'rgba(0,0,0,.62)', '#8f8f8a', 'Temporada finalizada')
                            : pill('#e9f6ed', '#15803d', '#16a34a', 'Aprobado y activo')}
                        <p className="mt-2.5 text-[13px] font-medium text-black/[.62]">
                            {finalizado
                                ? `Terminó el ${fechaLarga(group.endDate)}. Ya no aparece en el catálogo público.`
                                : 'Visible en el catálogo público: cualquiera puede verlo y anotarse.'}
                        </p>
                    </div>
                    <div className="flex w-full flex-wrap gap-2.5 md:min-w-0 md:flex-1">
                        <button
                            onClick={() => navigate(`/admingcx/gestion-de-grupos/inscriptos/${group.id}`)}
                            className={`${botonAccion} bg-[#f2f2f0] text-[#0a0a0a]`}
                        >
                            Ver inscriptos
                        </button>
                        <button
                            onClick={() => navigate(`/admingcx/gestion-de-grupos/editar-grupo/${group.id}`)}
                            className={`${botonAccion} bg-[#f2f2f0] text-[#0a0a0a]`}
                        >
                            Editar ficha
                        </button>
                    </div>
                </div>
            )}

            {esRechazado && (
                <div className="rounded-[20px] bg-white px-[22px] py-5 shadow-[inset_0_0_0_1.5px_#f3cdc8]">
                    <div className="flex flex-wrap items-start gap-3.5">
                        <div className="min-w-[220px] flex-1">
                            {pill('#fdecea', '#a32218', '#c62a1d', 'Rechazado')}
                            <p className="mt-3 text-[19px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                                Este grupo fue rechazado
                            </p>
                            <p className="mt-[9px] text-[13px] font-medium leading-[1.6] text-black/[.62]">
                                {group.adminNote
                                    ? `Motivo que se le envió a ${primerNombre}: “${group.adminNote}”`
                                    : `No se dejó un motivo escrito, así que ${primerNombre} no sabe qué corregir.`}
                            </p>
                        </div>
                        <div className="flex w-full flex-wrap gap-2.5 md:min-w-0 md:flex-1">
                            {telefonoLimpio && (
                                <a
                                    href={`https://wa.me/${telefonoLimpio}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`${botonAccion} flex items-center justify-center bg-[#f2f2f0] text-[#0a0a0a]`}
                                >
                                    Escribirle a {primerNombre}
                                </a>
                            )}
                            <button onClick={() => setModal('aprobar')} className={`${botonAccion} bg-[#0a0a0a] text-white`}>
                                Reconsiderar y aprobar
                            </button>
                        </div>
                    </div>
                    <p className="mt-[18px] border-t border-[#f0efec] pt-4 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                        El anfitrión puede corregir la ficha y volver a enviarla. Si lo hace, el grupo vuelve a aparecer como pendiente.
                    </p>
                </div>
            )}

            {/* ── Ficha ───────────────────────────────────────────── */}
            <div className="mt-3.5 grid gap-3.5 [grid-template-columns:minmax(0,1fr)] md:[grid-template-columns:minmax(0,1.6fr)_minmax(0,1fr)]">
                <div className="min-w-0 overflow-hidden rounded-[20px] bg-white">
                    {group.imageUrl ? (
                        <img src={group.imageUrl} alt="" className="h-[150px] w-full object-cover md:h-[210px]" />
                    ) : (
                        <div
                            className="flex h-[150px] items-end justify-center pb-3 md:h-[210px]"
                            style={{ background: 'repeating-linear-gradient(135deg,#e6e4e0 0 10px,#dedbd6 10px 20px)' }}
                        >
                            <span className="text-[10.5px] font-medium tracking-[0.06em] text-black/50">sin foto de portada</span>
                        </div>
                    )}

                    <div className="px-[22px] py-5">
                        <h1 className="text-[22px] font-semibold tracking-[-0.018em] text-[#0a0a0a]">{group.name}</h1>

                        {group.description && (() => {
                            const largo = group.description!.length > 240;
                            return (
                                <div
                                    className={largo ? 'cursor-pointer select-none' : ''}
                                    onClick={largo ? () => setDescripcionExpandida(v => !v) : undefined}
                                    role={largo ? 'button' : undefined}
                                    tabIndex={largo ? 0 : undefined}
                                    aria-expanded={largo ? descripcionExpandida : undefined}
                                    onKeyDown={largo ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDescripcionExpandida(v => !v); } } : undefined}
                                >
                                    <p className={`mt-2 text-[13.5px] font-medium leading-[1.65] text-black/[.66] ${largo && !descripcionExpandida ? 'line-clamp-4' : ''}`}>
                                        “{group.description}”
                                    </p>
                                    {largo && (
                                        <span className="mt-1.5 inline-block text-[12.5px] font-semibold text-black/[.58]">
                                            {descripcionExpandida ? 'Ver menos' : 'Ver más'}
                                        </span>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="mt-3.5 flex flex-wrap gap-[7px]">
                            {category && (
                                <span className="flex h-[30px] items-center rounded-full bg-[#f2f2f0] px-[13px] text-[12.5px] font-semibold text-black/[.66]">
                                    {category.name}
                                </span>
                            )}
                            {groupTags.map(t => (
                                <span key={t.id} className="flex h-[30px] items-center rounded-full bg-[#f7f7f5] px-[13px] text-[12.5px] font-semibold text-black/[.62]">
                                    {t.name}
                                </span>
                            ))}
                            <span className="flex h-[30px] items-center rounded-full bg-[#f7f7f5] px-[13px] text-[12.5px] font-semibold text-black/[.62]">
                                {group.targetGender || 'Mixto'}
                            </span>
                        </div>

                        <div className="mt-5">
                            {filaDato('Día y horario', `${group.meetingDay || 'Sin día'} ${group.meetingTime || ''}`.trim())}
                            {filaDato('Modalidad', `${NOMBRE_MODALIDAD[modalidadDe(group)]}${llevaDireccion(modalidadDe(group)) && group.location ? ` · ${group.location}` : ''}`)}
                            {filaDato('Temporada', temporada)}
                            {filaDato('Apunta a', `${group.targetGender || 'Mixto'} · ${(group.minAge && group.minAge > 0) ? group.minAge : 0} a ${(group.maxAge && group.maxAge < 100) ? group.maxAge : 'sin límite de'} años`)}
                            {filaDato('Creado', fechaLarga(group.createdAt) || 'Sin fecha')}
                        </div>
                    </div>
                </div>

                <div className="flex min-w-0 flex-col gap-3.5">
                    {/* Liderazgo */}
                    <div className="rounded-[20px] bg-white px-[22px] py-5">
                        <p className="text-[15px] font-semibold text-[#0a0a0a]">Liderazgo</p>

                        <div className="mt-4 flex items-center gap-3">
                            <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[13px] font-semibold text-black/[.62]">
                                {iniciales(anfitrion)}
                            </div>
                            <div className="min-w-0">
                                <p className="truncate text-[14px] font-semibold text-[#0a0a0a]">{anfitrion}</p>
                                <p className="mt-[3px] truncate text-[12.5px] font-medium text-black/[.62]">
                                    Anfitrión{group.leaderPhone ? ` · ${group.leaderPhone}` : ''}
                                </p>
                            </div>
                        </div>

                        {coAnfitrion ? (
                            <div className="mt-3.5 flex items-center gap-3">
                                <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[13px] font-semibold text-black/[.62]">
                                    {iniciales(coAnfitrion)}
                                </div>
                                <div className="min-w-0">
                                    <p className="truncate text-[14px] font-semibold text-[#0a0a0a]">{coAnfitrion}</p>
                                    <p className="mt-[3px] truncate text-[12.5px] font-medium text-black/[.62]">Co-anfitrión</p>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-3.5 rounded-[16px] bg-[#fdf7ee] px-4 py-3.5">
                                <p className="text-[12.5px] font-semibold text-[#7a4f10]">No cargó co-anfitrión</p>
                                <p className="mt-[7px] text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                                    Para quien evalúa es un dato, no un campo vacío: el grupo queda sin respaldo si {primerNombre} falta.
                                </p>
                                <button
                                    onClick={() => navigate(`/admingcx/gestion-de-grupos/editar-grupo/${group.id}`)}
                                    className="mt-3 h-[38px] rounded-full bg-white px-4 text-[12.5px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                >
                                    Asignar co-anfitrión
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Ocupación */}
                    <div className="rounded-[20px] bg-white px-[22px] py-5">
                        <div className="flex items-center gap-3">
                            <p className="flex-1 text-[15px] font-semibold text-[#0a0a0a]">Ocupación</p>
                            <span className="text-[13px] font-semibold text-[#0a0a0a]">{ocupados} de {group.maxCapacity}</span>
                        </div>
                        <div className="mt-3.5 h-2 overflow-hidden rounded-full bg-[#f0efec]">
                            <div className="h-full bg-[#0a0a0a]" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-3 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                            {esPendiente
                                ? 'Nadie puede anotarse mientras el grupo esté pendiente.'
                                : `${libres === 0 ? 'Sin lugares libres' : `${libres} ${libres === 1 ? 'lugar libre' : 'lugares libres'}`}.${nParejas > 0 ? ` ${nParejas} ${nParejas === 1 ? 'inscripción es de pareja, así que cuenta' : 'inscripciones son de parejas, así que cuentan'} doble.` : ''}`}
                        </p>
                        <button
                            onClick={() => navigate(`/admingcx/gestion-de-grupos/inscriptos/${group.id}`)}
                            className="mt-4 h-[46px] w-full rounded-full bg-[#f2f2f0] text-[14px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            Ver los inscriptos
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Aprobar ─────────────────────────────────────────── */}
            {modal === 'aprobar' && (
                <div className="fixed inset-0 z-[80]">
                    <div className="absolute inset-0 bg-[rgba(10,10,10,.42)]" onClick={() => setModal(null)} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Aprobar el grupo"
                        className="absolute inset-x-3 top-10 max-h-[88vh] overflow-auto rounded-[26px] bg-white shadow-[0_20px_50px_rgba(0,0,0,.25)] md:inset-x-auto md:left-1/2 md:top-[70px] md:w-[560px] md:-translate-x-1/2"
                    >
                        <div className="px-6 py-[22px]">
                            <p className="text-[19px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">Aprobar {group.name}</p>
                            <p className="mt-2.5 text-[13.5px] font-medium leading-[1.65] text-black/[.66]">
                                El grupo pasa a estar activo, aparece en el catálogo público y {primerNombre} puede empezar a recibir solicitudes. Se le avisa por email.
                            </p>
                            {!coAnfitrion && (
                                <div className="mt-4 rounded-[16px] bg-[#f7f7f5] px-4 py-3.5">
                                    <p className="text-[12.5px] font-medium leading-[1.55] text-black/[.66]">
                                        Queda sin co-anfitrión. Podés aprobarlo igual y asignarle uno después desde la ficha.
                                    </p>
                                </div>
                            )}
                            <div className="mt-5 flex flex-wrap gap-2.5">
                                <button
                                    onClick={() => decidir('approved')}
                                    disabled={isActionLoading}
                                    className="h-[50px] min-w-[150px] flex-1 rounded-full bg-[#0a0a0a] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                                >
                                    {isActionLoading ? 'Aprobando…' : 'Aprobar'}
                                </button>
                                <button onClick={() => setModal(null)} className="h-[50px] rounded-full bg-[#f2f2f0] px-[22px] text-[15px] font-semibold text-[#0a0a0a]">
                                    Volver
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Rechazar ────────────────────────────────────────── */}
            {modal === 'rechazar' && (
                <div className="fixed inset-0 z-[80]">
                    <div className="absolute inset-0 bg-[rgba(10,10,10,.42)]" onClick={() => setModal(null)} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Rechazar el grupo"
                        className="absolute inset-x-3 top-10 max-h-[88vh] overflow-auto rounded-[26px] bg-white shadow-[0_20px_50px_rgba(0,0,0,.25)] md:inset-x-auto md:left-1/2 md:top-[70px] md:w-[560px] md:-translate-x-1/2"
                    >
                        <div className="px-6 py-[22px]">
                            <span className="flex h-[26px] w-fit items-center rounded-full bg-[#fdecea] px-[11px] text-[11.5px] font-semibold text-[#a32218]">
                                Se le envía al anfitrión
                            </span>
                            <p className="mt-3.5 text-[19px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">Rechazar {group.name}</p>
                            <p className="mt-2.5 text-[13.5px] font-medium leading-[1.65] text-black/[.66]">
                                {primerNombre} recibe el motivo que escribas y puede corregir la ficha y volver a enviarla. El grupo no se borra.
                            </p>
                            <div className="mt-4 rounded-[18px] bg-[#f7f7f5] px-4 py-3.5">
                                <label htmlFor="motivo" className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-black/[.58]">
                                    Motivo para el anfitrión
                                </label>
                                <textarea
                                    id="motivo"
                                    value={adminNote}
                                    onChange={e => setAdminNote(e.target.value)}
                                    rows={3}
                                    autoFocus
                                    placeholder="Ya tenés un grupo el mismo día y horario…"
                                    className="campo-desnudo mt-2 w-full resize-none bg-transparent text-[13.5px] font-medium leading-[1.6] text-[#0a0a0a]"
                                />
                            </div>
                            <div className="mt-5 flex flex-wrap gap-2.5">
                                <button
                                    onClick={() => decidir('rejected')}
                                    disabled={isActionLoading}
                                    className="h-[50px] min-w-[170px] flex-1 rounded-full bg-[#c62a1d] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                                >
                                    {isActionLoading ? 'Rechazando…' : 'Rechazar y avisarle'}
                                </button>
                                <button onClick={() => setModal(null)} className="h-[50px] rounded-full bg-[#f2f2f0] px-[22px] text-[15px] font-semibold text-[#0a0a0a]">
                                    Volver
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const DetalleGrupoAdmin: React.FC = () => {
    const { groupId } = useParams<{ groupId: string }>();
    const [nombre, setNombre] = useState('Ficha del grupo');
    const [nInscriptos, setNInscriptos] = useState<number | undefined>(undefined);
    const [pendiente, setPendiente] = useState(false);

    // El nombre y el número salen de la misma consulta que arma la ficha: la
    // cabecera vive afuera del proveedor del toast, así que se los pasa para
    // arriba en vez de volver a pedir los grupos.
    const recibirGrupo = useCallback((g: Group) => {
        setNombre(g.name);
        setNInscriptos(g.registrations?.length || 0);
        setPendiente(esGrupoPendiente(g));
    }, []);

    return (
        <AdminGCXLayout
            title={nombre}
            backTo="/admingcx/gestion-de-grupos"
            backLabel="Grupos"
            subtitle=""
            tabs={<PestanasGrupoAdmin activa="detalle" groupId={groupId} nInscriptos={nInscriptos} pendiente={pendiente} />}
        >
            <DetalleGrupoAdminContent onGrupo={recibirGrupo} />
        </AdminGCXLayout>
    );
};

export default DetalleGrupoAdmin;

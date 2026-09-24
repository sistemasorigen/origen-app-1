import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GroupRegistration, Group, GroupCategory, GroupTag, esGrupoPendiente } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import PestanasGrupoAdmin from '../../components/GCX/PestanasGrupoAdmin';
import ModalParejaInscripcion, { DatosPareja } from '../../components/GCX/ModalParejaInscripcion';
import { Search, Loader2, X, Plus, Mail } from 'lucide-react';

/**
 * Inscriptos de un grupo (design-claude/Admin GCX - Detalle e Inscriptos).
 *
 * Una lista sola, sin pestañas por estado: cada fila dice en qué estado
 * está, y las que esperan respuesta van primero. Las inscripciones de
 * parejas se reconocen de lejos por el filo rosa y el "Pareja ·" del
 * renglón chico, porque son las que ocupan dos lugares.
 */

const ROSA = '#9d1d5c';

const iniciales = (nombre: string) =>
    (nombre || '').split(' y ')[0].split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';

const estilosEstado = (estado: GroupRegistration['status']) => {
    if (estado === 'APPROVED') return { bg: '#e9f6ed', fg: '#15803d', dot: '#16a34a', label: 'Aprobada' };
    if (estado === 'PENDING') return { bg: '#fdf0dc', fg: '#7a4f10', dot: '#b45309', label: 'Pendiente' };
    return { bg: '#fdecea', fg: '#a32218', dot: '#c62a1d', label: 'Rechazada' };
};

const GRID = 'grid-cols-[minmax(0,2.1fr)_minmax(0,1.1fr)_minmax(0,1.6fr)_124px_200px]';

interface ContenidoProps {
    onGrupo: (grupo: Group, inscriptos: number) => void;
}

const InscriptosGrupoContent: React.FC<ContenidoProps> = ({ onGrupo }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const { showToast } = useAdminGCXToast();

    const [group, setGroup] = useState<Group | null>(null);
    const [loadingGroup, setLoadingGroup] = useState(true);
    const [applicants, setApplicants] = useState<GroupRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [enCurso, setEnCurso] = useState<string | null>(null);

    // Acompañante
    const [editandoPareja, setEditandoPareja] = useState<GroupRegistration | null>(null);
    const [guardandoPareja, setGuardandoPareja] = useState(false);

    // Categorías y etiquetas: hacen falta para saber si el grupo es de
    // parejas, que es lo único que habilita sumarle un acompañante a una
    // inscripción.
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);

    const fetchGroup = useCallback(async () => {
        if (!groupId) return;
        setLoadingGroup(true);
        try {
            const todos = await supabaseService.getGroupsForAdmin();
            const found = todos.find(g => g.id === groupId);
            if (!found) {
                navigate('/admingcx/gestion-de-grupos', { replace: true });
                return;
            }
            setGroup(found);
        } finally {
            setLoadingGroup(false);
        }
    }, [groupId, navigate]);

    useEffect(() => { fetchGroup(); }, [fetchGroup]);

    useEffect(() => {
        Promise.all([supabaseService.getGroupCategories(), supabaseService.getGroupTags()])
            .then(([cats, etiquetas]) => { setCategories(cats); setTags(etiquetas); })
            .catch(error => console.error('[Inscriptos] Error trayendo categorías y etiquetas:', error));
    }, []);

    const fetchApplicants = useCallback(async () => {
        if (!groupId) return;
        setLoading(true);
        const data = await supabaseService.getGroupRegistrations(groupId);
        setApplicants(data);
        setLoading(false);
    }, [groupId]);

    useEffect(() => { fetchApplicants(); }, [fetchApplicants]);

    useEffect(() => {
        if (group) onGrupo(group, applicants.length);
    }, [group, applicants.length, onGrupo]);

    // ── Acciones sobre una inscripción ───────────────────────────
    const cambiarEstado = async (r: GroupRegistration, status: 'APPROVED' | 'REJECTED') => {
        setEnCurso(r.id);
        const ok = await supabaseService.updateRegistrationStatus(r.id, status);
        setEnCurso(null);
        if (ok) {
            setApplicants(prev => prev.map(a => a.id === r.id ? { ...a, status } : a));
            showToast(status === 'APPROVED' ? 'Inscripción aprobada' : 'Inscripción rechazada');
        } else {
            showToast('No se pudo cambiar el estado de la inscripción', 'error');
        }
    };

    const sacar = async (r: GroupRegistration) => {
        const nombre = `${r.firstName} ${r.lastName}`.trim();
        if (!window.confirm(`¿Sacar a ${nombre} del grupo? La inscripción se borra y el lugar queda libre.`)) return;
        setEnCurso(r.id);
        const ok = await supabaseService.deleteGroupRegistration(r.id, groupId!);
        setEnCurso(null);
        if (ok) {
            setApplicants(prev => prev.filter(a => a.id !== r.id));
            showToast(`${nombre} salió del grupo`);
        } else {
            showToast('No se pudo sacar a esa persona', 'error');
        }
    };

    const reenviar = async (r: GroupRegistration) => {
        setEnCurso(r.id);
        try {
            const resultado = await supabaseService.resendGroupConfirmationEmails([r.id]);
            showToast(resultado.message, resultado.success ? 'success' : 'error');
        } catch {
            showToast('No se pudo reenviar el mail', 'error');
        } finally {
            setEnCurso(null);
        }
    };

    const guardarPareja = async (datos: DatosPareja, userId: string | null) => {
        if (!editandoPareja) return;
        setGuardandoPareja(true);
        const ok = await supabaseService.updateRegistrationPartnerData(editandoPareja.id, datos, userId);
        setGuardandoPareja(false);
        if (ok) {
            setApplicants(prev => prev.map(a => a.id === editandoPareja.id
                ? { ...a, partnerData: datos, partnerUserId: userId || undefined }
                : a));
            setEditandoPareja(null);
            showToast('Pareja guardada');
        } else {
            showToast('No se pudo guardar la pareja', 'error');
        }
    };

    // ── Datos de la lista ────────────────────────────────────────
    const q = query.trim().toLowerCase();
    const filtrados = applicants.filter(r => {
        if (!q) return true;
        const nombre = `${r.firstName} ${r.lastName}`.toLowerCase();
        const pareja = r.partnerData ? `${r.partnerData.firstName} ${r.partnerData.lastName}`.toLowerCase() : '';
        return nombre.includes(q) || pareja.includes(q)
            || (r.phone || '').includes(q) || (r.email || '').toLowerCase().includes(q);
    });

    // Las que esperan respuesta van primero: son las únicas que piden una
    // decisión, y sin pestañas de estado quedarían perdidas entre las demás.
    const orden = { PENDING: 0, APPROVED: 1, REJECTED: 2 } as const;
    const lista = [...filtrados].sort((a, b) => (orden[a.status] ?? 3) - (orden[b.status] ?? 3));

    const nParejas = applicants.filter(r => !!r.partnerData).length;
    const nPendientes = applicants.filter(r => r.status === 'PENDING').length;

    // Un grupo es de parejas por su categoría o por su etiqueta, y solo si es
    // mixto: la misma regla que usan el catálogo, la inscripción pública y
    // "Agregar a mano". Sin esto, cualquier inscripción aprobada ofrecía
    // "Sumar una pareja" aunque el grupo fuera, por ejemplo, de hombres.
    const nombreCategoria = (
        categories.find(c => c.id === group?.categoryId)?.name
        || group?.categoryName
        || group?.categoryId
        || ''
    ).toLowerCase();
    const tieneEtiquetaParejas = !!group?.tags?.some(
        id => tags.find(t => t.id === id)?.name?.toLowerCase() === 'parejas'
    );
    const esGrupoDeParejas = (nombreCategoria === 'parejas' || tieneEtiquetaParejas)
        && group?.targetGender === 'Mixto';

    const datosDe = (r: GroupRegistration) => {
        const esPareja = !!r.partnerData;
        const nombrePareja = esPareja ? `${r.partnerData!.firstName} ${r.partnerData!.lastName}`.trim() : '';
        return {
            esPareja,
            nombre: esPareja
                ? `${r.firstName} ${r.lastName} y ${nombrePareja}`.trim()
                : `${r.firstName} ${r.lastName}`.trim(),
            meta: esPareja
                ? `Pareja · ${r.partnerUserId
                    ? `${r.partnerData!.firstName} tiene cuenta vinculada`
                    : r.partnerData!.email
                        ? `${r.partnerData!.firstName} cargada a mano`
                        : `${r.partnerData!.firstName} cargada a mano, sin email`}`
                : 'Inscripción individual',
        };
    };

    const botonChico = 'h-8 rounded-full px-3 text-[12px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-1';
    const iconoChico = 'flex h-8 w-8 flex-none items-center justify-center rounded-full transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-1';

    const acciones = (r: GroupRegistration, movil: boolean) => {
        const { esPareja } = datosDe(r);
        const ocupado = enCurso === r.id;

        if (r.status === 'PENDING') {
            return (
                <>
                    <button onClick={() => cambiarEstado(r, 'APPROVED')} disabled={ocupado} className={`${botonChico} ${movil ? 'h-[42px] flex-1 text-[13.5px]' : ''} bg-[#0a0a0a] text-white`}>
                        Aprobar
                    </button>
                    <button onClick={() => cambiarEstado(r, 'REJECTED')} disabled={ocupado} className={`${botonChico} ${movil ? 'h-[42px] flex-1 text-[13.5px]' : ''} bg-[#fdecea] text-[#a32218]`}>
                        Rechazar
                    </button>
                </>
            );
        }

        if (r.status === 'REJECTED') {
            return (
                <>
                    <button onClick={() => cambiarEstado(r, 'APPROVED')} disabled={ocupado} className={`${botonChico} ${movil ? 'h-[42px] flex-1 text-[13.5px]' : ''} bg-[#f2f2f0] text-black/[.66]`}>
                        Volver a aprobar
                    </button>
                    <button
                        onClick={() => sacar(r)}
                        disabled={ocupado}
                        aria-label={`Sacar a ${r.firstName} del grupo`}
                        className={`${iconoChico} ${movil ? 'h-[42px] w-[46px]' : ''} bg-[#fdecea] text-[#a32218]`}
                    >
                        <X className="h-[14px] w-[14px]" strokeWidth={2.4} />
                    </button>
                </>
            );
        }

        // Sumar un acompañante solo tiene sentido en un grupo de parejas. Si
        // la inscripción ya tiene pareja cargada, el botón se muestra igual
        // aunque el grupo haya dejado de ser de parejas: esos datos existen y
        // hay que poder verlos y corregirlos.
        const mostrarPareja = esGrupoDeParejas || esPareja;

        return (
            <>
                {mostrarPareja && (
                    <button
                        onClick={() => setEditandoPareja(r)}
                        disabled={ocupado}
                        className={`${botonChico} ${movil ? 'h-[42px] flex-1 text-[13.5px]' : ''} whitespace-nowrap`}
                        style={esPareja
                            ? { background: '#fbeef4', color: ROSA }
                            : { background: '#f2f2f0', color: 'rgba(0,0,0,.66)' }}
                    >
                        {esPareja ? (movil ? 'Ver o editar la pareja' : 'Ver pareja') : (movil ? 'Sumar una pareja' : 'Sumar pareja')}
                    </button>
                )}
                {!!r.email && (
                    <button
                        onClick={() => reenviar(r)}
                        disabled={ocupado}
                        title="Reenviar el mail de confirmación"
                        aria-label={`Reenviar el mail de confirmación a ${r.firstName}`}
                        /* En el teléfono, sin el botón de pareja la fila quedaría
                           con dos íconos sueltos: el mail pasa a ser la acción
                           ancha y dice lo que hace. */
                        className={movil && !mostrarPareja
                            ? `${botonChico} flex h-[42px] flex-1 items-center justify-center gap-2 text-[13.5px] bg-[#f2f2f0] text-black/[.66]`
                            : `${iconoChico} ${movil ? 'h-[42px] w-[46px]' : ''} bg-[#f2f2f0] text-black/[.6]`}
                    >
                        {ocupado ? <Loader2 className="h-[14px] w-[14px] animate-spin" /> : <Mail className="h-[14px] w-[14px]" />}
                        {movil && !mostrarPareja && 'Reenviar el mail'}
                    </button>
                )}
                <button
                    onClick={() => sacar(r)}
                    disabled={ocupado}
                    aria-label={`Sacar a ${r.firstName} del grupo`}
                    className={`${iconoChico} ${movil ? 'h-[42px] w-[46px]' : ''} bg-[#fdecea] text-[#a32218]`}
                >
                    <X className="h-[14px] w-[14px]" strokeWidth={2.4} />
                </button>
            </>
        );
    };

    if (loadingGroup) return (
        <div className="flex justify-center rounded-[20px] bg-white py-20">
            <Loader2 className="h-7 w-7 animate-spin text-black/20" />
        </div>
    );

    const pill = (r: GroupRegistration) => {
        const c = estilosEstado(r.status);
        return (
            <span
                className="flex h-[26px] w-fit flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] text-[11.5px] font-semibold"
                style={{ background: c.bg, color: c.fg }}
            >
                <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: c.dot }} />
                {c.label}
            </span>
        );
    };

    return (
        <>
            {/* Buscador y alta */}
            <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex h-[42px] min-w-[180px] flex-1 items-center gap-2.5 rounded-full bg-white pl-[17px] pr-2">
                    <Search className="h-4 w-4 flex-none text-black/[.58]" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar por nombre, teléfono o email"
                        aria-label="Buscar inscriptos"
                        className="campo-desnudo min-w-0 flex-1 bg-transparent text-[13.5px] font-medium text-[#0a0a0a]"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery('')}
                            aria-label="Limpiar la búsqueda"
                            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[#0a0a0a]"
                        >
                            <X className="h-[13px] w-[13px]" />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => navigate(`/admingcx/gestion-de-grupos/agregar-grupo?grupo=${encodeURIComponent(groupId!)}`)}
                    className="flex h-[42px] flex-none items-center gap-2 rounded-full bg-[#0a0a0a] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    <Plus className="h-[15px] w-[15px]" />
                    Agregar a mano
                </button>
            </div>

            <p className="mx-0.5 mt-3.5 text-[12px] font-semibold text-black/[.62]">
                {loading
                    ? 'Cargando las inscripciones…'
                    : applicants.length === 0
                        ? 'Todavía sin inscriptos'
                        : `${lista.length} de ${applicants.length} inscripciones${nParejas > 0 ? ` · ${nParejas} ${nParejas === 1 ? 'es pareja' : 'son parejas'}` : ''}${nPendientes > 0 ? ` · ${nPendientes} ${nPendientes === 1 ? 'espera respuesta' : 'esperan respuesta'}` : ''}`}
            </p>

            {loading ? (
                <div className="mt-3 flex justify-center rounded-[20px] bg-white py-20">
                    <Loader2 className="h-7 w-7 animate-spin text-black/20" />
                </div>
            ) : lista.length === 0 ? (
                <div className="mt-3 flex flex-col items-center rounded-[20px] bg-white px-[30px] py-[52px] text-center">
                    <div className="h-[84px] w-[84px] rounded-full" style={{ background: 'repeating-linear-gradient(135deg,#eceae6 0 8px,#e3e1dc 8px 16px)' }} />
                    <p className="mt-5 text-[17px] font-semibold text-[#0a0a0a]">
                        {applicants.length === 0 ? 'El grupo todavía no tiene inscriptos' : 'Nadie coincide con la búsqueda'}
                    </p>
                    <p className="mt-[9px] max-w-[330px] text-[13.5px] font-medium leading-[1.6] text-black/[.62]">
                        {applicants.length === 0
                            ? group && (group.status === 'pending' || !group.status)
                                ? 'Mientras esté pendiente de aprobación no aparece en el catálogo y nadie puede anotarse. Podés agregar gente a mano igual.'
                                : 'Cuando alguien se anote desde el catálogo va a aparecer acá. También podés agregar gente a mano.'
                            : 'Probá con el apellido, con parte del teléfono, o agregá la persona a mano si todavía no está.'}
                    </p>
                    <button
                        onClick={() => applicants.length === 0
                            ? navigate(`/admingcx/gestion-de-grupos/agregar-grupo?grupo=${encodeURIComponent(groupId!)}`)
                            : setQuery('')}
                        className="mt-5 h-[46px] rounded-full bg-[#0a0a0a] px-[22px] text-[14px] font-semibold text-white"
                    >
                        {applicants.length === 0 ? 'Agregar a mano' : 'Limpiar la búsqueda'}
                    </button>
                </div>
            ) : (
                <>
                    {/* Escritorio */}
                    <div className="mt-3 hidden overflow-hidden rounded-[20px] bg-white lg:block">
                        <div className={`grid ${GRID} gap-3.5 border-b border-[#f0efec] bg-[#fafaf9] px-5 py-[11px]`}>
                            {['Persona', 'Teléfono', 'Email', 'Estado'].map(h => (
                                <span key={h} className="text-[11px] font-semibold uppercase tracking-[0.05em] text-black/[.6]">{h}</span>
                            ))}
                            <span />
                        </div>

                        {lista.map(r => {
                            const { esPareja, nombre, meta } = datosDe(r);
                            return (
                                <div
                                    key={r.id}
                                    className={`grid ${GRID} h-[60px] items-center gap-3.5 border-b border-[#f4f3f1] px-5`}
                                    style={esPareja ? { boxShadow: `inset 3px 0 0 ${ROSA}` } : undefined}
                                >
                                    <div className="flex min-w-0 items-center gap-[11px]">
                                        <div
                                            className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[11px] text-[11px] font-semibold"
                                            style={esPareja
                                                ? { background: '#fbeef4', color: ROSA }
                                                : { background: '#f2f2f0', color: 'rgba(0,0,0,.58)' }}
                                        >
                                            {iniciales(nombre)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-[13.5px] font-semibold text-[#0a0a0a]">{nombre}</p>
                                            <p className="mt-0.5 truncate text-[11.5px] font-medium" style={{ color: esPareja ? ROSA : 'rgba(0,0,0,.62)' }}>
                                                {meta}
                                            </p>
                                        </div>
                                    </div>

                                    <span className="truncate text-[13px] font-medium text-black/[.66]">{r.phone || 'sin teléfono'}</span>
                                    <span className="truncate text-[13px] font-medium text-black/[.66]">{r.email || 'sin email'}</span>
                                    {pill(r)}

                                    <div className="flex justify-end gap-1.5">{acciones(r, false)}</div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Mobile y tablet */}
                    <div className="mt-3 flex flex-col gap-2.5 lg:hidden">
                        {lista.map(r => {
                            const { esPareja, nombre, meta } = datosDe(r);
                            return (
                                <div
                                    key={r.id}
                                    className="rounded-[20px] bg-white px-4 py-3.5"
                                    style={esPareja ? { boxShadow: `inset 3px 0 0 ${ROSA}` } : undefined}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] text-[13px] font-semibold"
                                            style={esPareja
                                                ? { background: '#fbeef4', color: ROSA }
                                                : { background: '#f2f2f0', color: 'rgba(0,0,0,.58)' }}
                                        >
                                            {iniciales(nombre)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[15px] font-semibold text-[#0a0a0a]">{nombre}</p>
                                            <p className="mt-[3px] text-[12.5px] font-medium" style={{ color: esPareja ? ROSA : 'rgba(0,0,0,.62)' }}>
                                                {meta}
                                            </p>
                                        </div>
                                        {pill(r)}
                                    </div>

                                    <div className="mt-3 flex flex-col gap-1">
                                        <p className="text-[13px] font-medium text-black/[.66]">{r.phone || 'sin teléfono'}</p>
                                        <p className="truncate text-[13px] font-medium text-black/[.66]">{r.email || 'sin email'}</p>
                                    </div>

                                    <div className="mt-3.5 flex gap-2">{acciones(r, true)}</div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            <ModalParejaInscripcion
                isOpen={!!editandoPareja}
                onClose={() => setEditandoPareja(null)}
                titular={editandoPareja ? `${editandoPareja.firstName} ${editandoPareja.lastName}`.trim() : ''}
                inicial={editandoPareja
                    ? { datos: editandoPareja.partnerData, userId: editandoPareja.partnerUserId || null }
                    : undefined}
                onGuardar={guardarPareja}
                guardando={guardandoPareja}
            />
        </>
    );
};

const InscriptosGrupo: React.FC = () => {
    const { groupId } = useParams<{ groupId: string }>();
    const [nombre, setNombre] = useState('Inscriptos del grupo');
    const [nInscriptos, setNInscriptos] = useState<number | undefined>(undefined);
    const [pendiente, setPendiente] = useState(false);

    const recibirGrupo = useCallback((g: Group, inscriptos: number) => {
        setNombre(g.name);
        setNInscriptos(inscriptos);
        setPendiente(esGrupoPendiente(g));
    }, []);

    return (
        <AdminGCXLayout
            title={nombre}
            backTo="/admingcx/gestion-de-grupos"
            backLabel="Grupos"
            subtitle=""
            tabs={<PestanasGrupoAdmin activa="inscriptos" groupId={groupId} nInscriptos={nInscriptos} pendiente={pendiente} />}
        >
            <InscriptosGrupoContent onGrupo={recibirGrupo} />
        </AdminGCXLayout>
    );
};

export default InscriptosGrupo;

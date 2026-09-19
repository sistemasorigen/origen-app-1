import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Group, GroupCategory, GroupTag } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import PestanasGrupoAdmin from '../../components/GCX/PestanasGrupoAdmin';
import ModalParejaInscripcion, { DatosPareja } from '../../components/GCX/ModalParejaInscripcion';
import { Search, Loader2, Check } from 'lucide-react';

/**
 * Agregar a mano (design-claude/Admin GCX - Detalle e Inscriptos).
 *
 * Dos pasos a la vista: a qué grupo y quién. El bloque del acompañante está
 * siempre presente —se habilita solo si el grupo elegido es de parejas— para
 * que el formulario no cambie de forma según el grupo.
 */

const ROSA = '#9d1d5c';

const AgregarMiembroGrupoContent: React.FC<{ onGrupo: (g: Group | null) => void }> = ({ onGrupo }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useAdminGCXToast();

    const [groups, setGroups] = useState<Group[]>([]);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Si se entró desde un grupo, ese grupo ya viene elegido.
    const [selectedGroupId, setSelectedGroupId] = useState((location.state as { groupId?: string } | null)?.groupId || '');
    const [gQuery, setGQuery] = useState('');

    const [nombreCompleto, setNombreCompleto] = useState('');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');
    const [buscandoCuenta, setBuscandoCuenta] = useState(false);
    const [cuenta, setCuenta] = useState<'idle' | 'found' | 'not-found'>('idle');
    const [foundUserId, setFoundUserId] = useState<string | null>(null);

    const [pareja, setPareja] = useState<DatosPareja | null>(null);
    const [parejaUserId, setParejaUserId] = useState<string | null>(null);
    const [modalPareja, setModalPareja] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        Promise.all([
            supabaseService.getGroupsForAdmin(),
            supabaseService.getGroupCategories(),
            supabaseService.getGroupTags(),
        ]).then(([g, c, t]) => {
            setGroups(g);
            setCategories(c);
            setTags(t);
            setLoadingData(false);
        });
    }, []);

    const esGroupFinished = (group: Group) => {
        if (!group.endDate) return false;
        return group.endDate < new Date().toISOString().split('T')[0];
    };

    const esDeParejas = useCallback((group: Group) => {
        const cat = categories.find(c => c.id === group.categoryId);
        const porCategoria = cat?.name?.toLowerCase() === 'parejas';
        const porEtiqueta = group.tags?.some(id => tags.find(t => t.id === id)?.name?.toLowerCase() === 'parejas');
        return (porCategoria || !!porEtiqueta) && group.targetGender === 'Mixto';
    }, [categories, tags]);

    const activos = groups.filter(g => g.status === 'approved' && !esGroupFinished(g));
    const gq = gQuery.trim().toLowerCase();
    const listaGrupos = activos.filter(g => !gq
        || g.name.toLowerCase().includes(gq)
        || `${g.leaderName} ${g.leaderSurname}`.toLowerCase().includes(gq));

    const grupoElegido = groups.find(g => g.id === selectedGroupId) || null;
    const couplesMode = !!grupoElegido && esDeParejas(grupoElegido);

    useEffect(() => { onGrupo(grupoElegido); }, [grupoElegido, onGrupo]);

    // Si el grupo deja de ser de parejas, lo cargado del acompañante no
    // aplica: se suelta para no mandarlo sin querer.
    useEffect(() => {
        if (!couplesMode && pareja) {
            setPareja(null);
            setParejaUserId(null);
        }
    }, [couplesMode, pareja]);

    const buscarCuentaTitular = async () => {
        if (!email || !email.includes('@')) return;
        setBuscandoCuenta(true);
        setCuenta('idle');
        const user = await supabaseService.getUserByEmail(email.trim());
        setBuscandoCuenta(false);
        if (user) {
            setCuenta('found');
            setFoundUserId(user.id);
            if (!nombreCompleto.trim()) setNombreCompleto(user.name || '');
            if (!telefono.trim() && user.phone) setTelefono(user.phone);
        } else {
            setCuenta('not-found');
            setFoundUserId(null);
        }
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!selectedGroupId) { setError('Elegí primero a qué grupo lo anotás.'); return; }
        if (!nombreCompleto.trim()) { setError('Falta el nombre y apellido de la persona.'); return; }
        if (!telefono.trim()) { setError('Falta el teléfono de la persona.'); return; }
        if (couplesMode && !pareja) { setError('Este grupo es de parejas: cargá también al acompañante.'); return; }
        if (couplesMode && pareja?.email && email.trim()
            && pareja.email.toLowerCase().trim() === email.toLowerCase().trim()) {
            setError('El email del acompañante tiene que ser distinto al de la persona titular.');
            return;
        }

        // El apellido es todo lo que sigue al primer nombre, la misma regla
        // que usa la app cuando parte el nombre de una cuenta.
        const partes = nombreCompleto.trim().split(' ').filter(Boolean);
        const firstName = partes[0] || '';
        const lastName = partes.slice(1).join(' ');

        setIsSubmitting(true);
        const ok = await supabaseService.adminAddMemberToGroup({
            groupId: selectedGroupId,
            userId: foundUserId,
            firstName,
            lastName,
            email: email.trim(),
            phone: telefono.trim(),
            partnerData: couplesMode && pareja ? pareja : undefined,
            partnerUserId: couplesMode ? parejaUserId : undefined,
        });
        setIsSubmitting(false);

        if (ok) {
            showToast(couplesMode ? 'Pareja agregada al grupo' : 'Miembro agregado al grupo');
            navigate(`/admingcx/gestion-de-grupos/inscriptos/${selectedGroupId}`);
        } else {
            setError('Hubo un error al agregar. Intentá de nuevo.');
        }
    };

    if (loadingData) return (
        <div className="flex justify-center rounded-[20px] bg-white py-20">
            <Loader2 className="h-7 w-7 animate-spin text-black/20" />
        </div>
    );

    const rotulo = 'text-[10.5px] font-semibold uppercase tracking-[0.06em] text-black/[.58]';
    const campo = 'flex h-[58px] flex-col justify-center rounded-[18px] bg-[#f7f7f5] px-[17px]';
    const entrada = 'campo-desnudo w-full bg-transparent text-[14.5px] font-medium text-[#0a0a0a]';
    const numero = (activo: boolean) =>
        `flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[12.5px] font-semibold ${activo ? 'bg-[#0a0a0a] text-white' : 'bg-[#eceae6] text-black/[.6]'}`;

    return (
        <form onSubmit={guardar} className="grid gap-3.5 [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1fr)_minmax(0,1.3fr)]">

            {/* 1 — el grupo */}
            <div className="min-w-0 rounded-[20px] bg-white px-[22px] py-5">
                <div className="flex items-center gap-2.5">
                    <span className={numero(true)}>1</span>
                    <p className="text-[16px] font-semibold text-[#0a0a0a]">¿A qué grupo lo anotás?</p>
                </div>

                <div className="mt-3.5 flex h-[42px] items-center gap-2.5 rounded-full bg-[#f7f7f5] px-[17px]">
                    <Search className="h-4 w-4 flex-none text-black/[.58]" />
                    <input
                        type="text"
                        value={gQuery}
                        onChange={e => setGQuery(e.target.value)}
                        placeholder={`Buscar entre los ${activos.length} grupos`}
                        aria-label="Buscar el grupo"
                        className="campo-desnudo min-w-0 flex-1 bg-transparent text-[13.5px] font-medium text-[#0a0a0a]"
                    />
                </div>

                <div className="mt-3 flex max-h-[290px] flex-col gap-[7px] overflow-auto">
                    {listaGrupos.length === 0 && (
                        <p className="py-6 text-center text-[13px] font-medium text-black/[.55]">
                            {gq ? `Ningún grupo activo coincide con "${gQuery}"` : 'No hay grupos activos'}
                        </p>
                    )}
                    {listaGrupos.map(g => {
                        const elegido = g.id === selectedGroupId;
                        const cat = categories.find(c => c.id === g.categoryId);
                        const ocupados = esDeParejas(g) ? (g.registrations?.length || 0) * 2 : (g.registrations?.length || 0);
                        return (
                            <button
                                type="button"
                                key={g.id}
                                onClick={() => setSelectedGroupId(g.id)}
                                aria-pressed={elegido}
                                className={`flex min-h-[58px] w-full items-center gap-2.5 rounded-[18px] px-[15px] py-[11px] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${elegido ? 'bg-[#f0efec] shadow-[inset_0_0_0_1.5px_#0a0a0a]' : 'bg-[#fcfcfb] hover:bg-[#f7f7f5]'}`}
                            >
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13.5px] font-semibold text-[#0a0a0a]">{g.name}</span>
                                    <span className="mt-[3px] block truncate text-[11.5px] font-medium text-black/[.62]">
                                        {[cat?.name, `${g.meetingDay?.toLowerCase()} ${g.meetingTime}`, `${ocupados}/${g.maxCapacity}`].filter(Boolean).join(' · ')}
                                    </span>
                                </span>
                                {esDeParejas(g) && (
                                    <span
                                        className="flex h-6 flex-none items-center whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold"
                                        style={{ background: '#fbeef4', color: ROSA }}
                                    >
                                        De parejas
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2 — la persona */}
            <div className="min-w-0 rounded-[20px] bg-white px-[22px] py-5">
                <div className="flex flex-wrap items-center gap-2.5">
                    <span className={numero(!!grupoElegido)}>2</span>
                    <p
                        className="min-w-[140px] flex-1 text-[16px] font-semibold"
                        style={{ color: grupoElegido ? '#0a0a0a' : 'rgba(0,0,0,.6)' }}
                    >
                        Datos de la persona
                    </p>
                    {couplesMode && (
                        <span
                            className="flex h-[26px] flex-none items-center rounded-full px-[11px] text-[11.5px] font-semibold"
                            style={{ background: '#fbeef4', color: ROSA }}
                        >
                            Grupo de parejas
                        </span>
                    )}
                </div>

                {!grupoElegido && (
                    <p className="mt-3.5 text-[13px] font-medium leading-[1.6] text-black/[.62]">
                        Elegí primero el grupo. Los campos son los mismos siempre; si el grupo es de parejas se habilita
                        el segundo bloque que ya está acá abajo.
                    </p>
                )}

                <div className="mt-4">
                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58]">
                        Titular de la inscripción
                    </p>
                    <div className="grid gap-[9px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
                        <div className={campo}>
                            <label htmlFor="nombre" className={rotulo}>Nombre y apellido</label>
                            <input
                                id="nombre"
                                type="text"
                                value={nombreCompleto}
                                onChange={e => setNombreCompleto(e.target.value)}
                                placeholder="Ej. Marcela Godoy"
                                className={entrada}
                            />
                        </div>
                        <div className={campo}>
                            <label htmlFor="telefono" className={rotulo}>Teléfono</label>
                            <input
                                id="telefono"
                                type="tel"
                                value={telefono}
                                onChange={e => setTelefono(e.target.value)}
                                placeholder="11 5533 1200"
                                className={entrada}
                            />
                        </div>
                        <div className={campo}>
                            <label htmlFor="email" className={rotulo}>Email</label>
                            <div className="flex items-center gap-2">
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setCuenta('idle'); setFoundUserId(null); }}
                                    onBlur={buscarCuentaTitular}
                                    placeholder="Opcional"
                                    className={entrada}
                                />
                                {buscandoCuenta && <Loader2 className="h-4 w-4 flex-none animate-spin text-black/30" />}
                            </div>
                        </div>
                    </div>

                    {cuenta !== 'idle' && (
                        <p
                            className="mt-2.5 flex items-center gap-2 rounded-[14px] px-3 py-2 text-[12.5px] font-semibold"
                            style={cuenta === 'found'
                                ? { background: '#e9f6ed', color: '#15803d' }
                                : { background: '#fdf0dc', color: '#7a4f10' }}
                        >
                            {cuenta === 'found' && <Check className="h-3.5 w-3.5" strokeWidth={2.6} />}
                            {cuenta === 'found'
                                ? 'Ya tiene cuenta: la inscripción queda vinculada a ella.'
                                : 'No hay cuenta con ese email. Se carga a mano y se vincula sola cuando se registre.'}
                        </p>
                    )}
                </div>

                {/* Acompañante — siempre a la vista */}
                <div
                    className="mt-[18px] rounded-[20px] px-[18px] py-4"
                    style={couplesMode
                        ? { background: '#fdf4f8', boxShadow: 'inset 0 0 0 1.5px #f3d3e2' }
                        : { background: '#fbfbfa', boxShadow: 'inset 0 0 0 1.5px #f0efec' }}
                >
                    <div className="flex items-center gap-2.5">
                        <p
                            className="flex-1 text-[11px] font-semibold uppercase tracking-[0.07em]"
                            style={{ color: couplesMode ? ROSA : 'rgba(0,0,0,.58)' }}
                        >
                            Acompañante
                        </p>
                        <span
                            className="flex h-6 flex-none items-center rounded-full px-2.5 text-[11px] font-semibold"
                            style={couplesMode
                                ? { background: '#fff', color: ROSA }
                                : { background: '#f2f2f0', color: 'rgba(0,0,0,.6)' }}
                        >
                            {couplesMode ? 'Obligatorio' : 'No se pide'}
                        </span>
                    </div>

                    {couplesMode ? (
                        <>
                            <div className="mt-3 grid gap-[9px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
                                <div className="flex h-[58px] flex-col justify-center rounded-[18px] bg-white px-[17px]">
                                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: ROSA }}>
                                        Nombre del acompañante
                                    </span>
                                    <span className="truncate text-[14.5px] font-medium" style={{ color: pareja ? '#0a0a0a' : 'rgba(0,0,0,.45)' }}>
                                        {pareja ? `${pareja.firstName} ${pareja.lastName}`.trim() : 'Todavía sin cargar'}
                                    </span>
                                </div>
                                <div className="flex h-[58px] flex-col justify-center rounded-[18px] bg-white px-[17px]">
                                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: ROSA }}>
                                        Email y teléfono
                                    </span>
                                    <span className="truncate text-[14.5px] font-medium" style={{ color: pareja ? '#0a0a0a' : 'rgba(0,0,0,.45)' }}>
                                        {pareja
                                            ? [pareja.email || 'sin email', pareja.phone].filter(Boolean).join(' · ')
                                            : 'Se completan en el paso siguiente'}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-3 flex flex-wrap items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setModalPareja(true)}
                                    className="h-[42px] rounded-full px-[18px] text-[13.5px] font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                    style={{ background: '#fbeef4', color: ROSA }}
                                >
                                    {pareja ? 'Editar el acompañante' : 'Buscar si ya tiene cuenta'}
                                </button>
                                {pareja && parejaUserId && (
                                    <span className="flex h-6 items-center rounded-full bg-[#e9f6ed] px-2.5 text-[11px] font-semibold text-[#15803d]">
                                        Vinculada a su cuenta
                                    </span>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="mt-2.5 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                            {grupoElegido
                                ? 'Este grupo no es de parejas, así que el bloque queda inactivo. Si después cambia, se habilita acá mismo.'
                                : 'El bloque está siempre a la vista: se habilita si el grupo que elegís es de parejas, así el formulario no cambia de forma.'}
                        </p>
                    )}
                </div>

                {error && (
                    <div className="mt-3.5 rounded-[14px] bg-[#fdecea] px-3 py-2.5 text-[12.5px] font-semibold text-[#a32218]">
                        {error}
                    </div>
                )}

                <p className="mt-3.5 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                    {couplesMode
                        ? 'Los dos quedan como miembros aprobados y ocupan un lugar de pareja, que son dos personas.'
                        : 'La persona queda como miembro aprobado, sin pasar por la lista de solicitudes.'}
                </p>

                <div className="mt-[18px] flex flex-wrap gap-2.5">
                    <button
                        type="submit"
                        disabled={!selectedGroupId || isSubmitting}
                        className="h-12 min-w-[180px] flex-1 rounded-full text-[14.5px] font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        style={selectedGroupId
                            ? { background: '#0a0a0a', color: '#fff' }
                            : { background: '#eceae6', color: 'rgba(0,0,0,.5)' }}
                    >
                        {isSubmitting
                            ? 'Guardando…'
                            : !selectedGroupId
                                ? 'Elegí un grupo primero'
                                : couplesMode ? 'Agregar la pareja al grupo' : 'Agregar al grupo'}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(selectedGroupId
                            ? `/admingcx/gestion-de-grupos/inscriptos/${selectedGroupId}`
                            : '/admingcx/gestion-de-grupos')}
                        className="h-12 rounded-full bg-[#f2f2f0] px-5 text-[14.5px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        Cancelar
                    </button>
                </div>
            </div>

            <ModalParejaInscripcion
                isOpen={modalPareja}
                onClose={() => setModalPareja(false)}
                titular={nombreCompleto.trim() || 'la persona titular'}
                inicial={pareja ? { datos: pareja, userId: parejaUserId } : undefined}
                onGuardar={(datos, userId) => {
                    setPareja(datos);
                    setParejaUserId(userId);
                    setModalPareja(false);
                }}
            />
        </form>
    );
};

const AgregarMiembroGrupo: React.FC = () => {
    const [grupo, setGrupo] = useState<Group | null>(null);
    const recibirGrupo = useCallback((g: Group | null) => setGrupo(g), []);

    return (
        <AdminGCXLayout
            title={grupo ? grupo.name : 'Agregar a mano'}
            backTo="/admingcx/gestion-de-grupos"
            backLabel="Grupos"
            subtitle=""
            tabs={
                <PestanasGrupoAdmin
                    activa="agregar"
                    groupId={grupo?.id}
                    nInscriptos={grupo?.registrations?.length}
                />
            }
        >
            <AgregarMiembroGrupoContent onGrupo={recibirGrupo} />
        </AdminGCXLayout>
    );
};

export default AgregarMiembroGrupo;

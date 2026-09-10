import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, GroupRegistration } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { ArrowLeft, Check, Search, Clock, Mail, Phone, Loader2, Heart, X, UserPlus, Edit2, Shuffle } from 'lucide-react';
import { T, btnPrimario, btnSecundario, Encabezado, Vacio } from '../../components/GCX/patron';

// "hace 2 días", "hace 5 horas". Antigüedad relativa: para decidir una
// solicitud importa cuánto lleva esperando, no la fecha exacta.
const hace = (iso?: string): string => {
    if (!iso) return '';
    const ms = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms < 0) return '';
    const min = Math.floor(ms / 60000);
    if (min < 60) return min <= 1 ? 'recién' : `hace ${min} minutos`;
    const hs = Math.floor(min / 60);
    if (hs < 24) return `hace ${hs} ${hs === 1 ? 'hora' : 'horas'}`;
    const d = Math.floor(hs / 24);
    if (d < 30) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
    const m = Math.floor(d / 30);
    return `hace ${m} ${m === 1 ? 'mes' : 'meses'}`;
};

const getInitials = (firstName?: string, lastName?: string): string => {
    const a = (firstName || '').trim()[0] || '';
    const b = (lastName || '').trim()[0] || '';
    return (a + b).toUpperCase() || '?';
};

const PaginaSolicitudesGrupo: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [groupName, setGroupName] = useState('');
    const [loadingGroup, setLoadingGroup] = useState(true);

    const [applicants, setApplicants] = useState<GroupRegistration[]>([]);
    // id de grupo → nombre, para el cartel de derivación. Puede faltar alguno
    // si el RLS lo oculta; en ese caso el cartel usa el texto genérico.
    const [nombresOrigen, setNombresOrigen] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('PENDING');
    const [searchTerm, setSearchTerm] = useState('');

    // ── Modal de agregar/editar pareja ──
    const [editingPartnerFor, setEditingPartnerFor] = useState<GroupRegistration | null>(null);
    const [partnerModalHasEmail, setPartnerModalHasEmail] = useState<boolean | null>(null);
    const [partnerModalFirstName, setPartnerModalFirstName] = useState('');
    const [partnerModalLastName, setPartnerModalLastName] = useState('');
    const [partnerModalEmail, setPartnerModalEmail] = useState('');
    const [partnerModalPhone, setPartnerModalPhone] = useState('');
    const [partnerModalAccount, setPartnerModalAccount] = useState<{ id: string; name: string; phone?: string } | null>(null);
    const [partnerModalChecked, setPartnerModalChecked] = useState(false);
    const [partnerModalChecking, setPartnerModalChecking] = useState(false);
    const [partnerModalSaving, setPartnerModalSaving] = useState(false);
    const [partnerModalError, setPartnerModalError] = useState<string | null>(null);

    const openPartnerModal = (app: GroupRegistration) => {
        setEditingPartnerFor(app);
        setPartnerModalError(null);
        if (app.partnerData) {
            setPartnerModalHasEmail(!!app.partnerData.email);
            setPartnerModalFirstName(app.partnerData.firstName);
            setPartnerModalLastName(app.partnerData.lastName);
            setPartnerModalEmail(app.partnerData.email || '');
            setPartnerModalPhone(app.partnerData.phone);
            setPartnerModalChecked(true);
        } else {
            setPartnerModalHasEmail(null);
            setPartnerModalFirstName(''); setPartnerModalLastName('');
            setPartnerModalEmail(''); setPartnerModalPhone('');
            setPartnerModalChecked(false);
        }
        setPartnerModalAccount(null);
    };

    const closePartnerModal = () => setEditingPartnerFor(null);

    const handlePartnerModalEmailBlur = async () => {
        if (!partnerModalEmail) return;
        setPartnerModalChecking(true);
        try {
            const foundUser = await supabaseService.findUserByEmail(partnerModalEmail);
            setPartnerModalAccount(foundUser);
            if (foundUser) {
                const parts = foundUser.name ? foundUser.name.split(' ') : [];
                setPartnerModalFirstName(parts[0] || partnerModalFirstName);
                setPartnerModalLastName(parts.slice(1).join(' ') || partnerModalLastName);
                setPartnerModalPhone(foundUser.phone || partnerModalPhone);
            }
        } finally {
            setPartnerModalChecking(false);
            setPartnerModalChecked(true);
        }
    };

    const handleSavePartner = async () => {
        if (!editingPartnerFor) return;
        setPartnerModalError(null);
        if (!partnerModalFirstName.trim() || !partnerModalLastName.trim() || !partnerModalPhone.trim() || (partnerModalHasEmail && !partnerModalEmail.trim())) {
            setPartnerModalError('Completá todos los campos.');
            return;
        }
        setPartnerModalSaving(true);
        const partnerData = partnerModalHasEmail
            ? { firstName: partnerModalFirstName, lastName: partnerModalLastName, email: partnerModalEmail, phone: partnerModalPhone }
            : { firstName: partnerModalFirstName, lastName: partnerModalLastName, phone: partnerModalPhone };
        const success = await supabaseService.updateRegistrationPartnerData(
            editingPartnerFor.id,
            partnerData,
            partnerModalAccount?.id || null
        );
        setPartnerModalSaving(false);
        if (success) {
            setApplicants(prev => prev.map(a => a.id === editingPartnerFor.id
                ? { ...a, partnerData, partnerUserId: partnerModalAccount?.id }
                : a
            ));
            closePartnerModal();
        } else {
            setPartnerModalError('Error al guardar. Intentá de nuevo.');
        }
    };

    const fetchGroupName = useCallback(async () => {
        if (!currentUser || !groupId) return;
        setLoadingGroup(true);
        try {
            const owned = await supabaseService.getGroupsByHost(currentUser.id);
            const found = owned.find(g => g.id === groupId);
            if (!found) {
                navigate('/mis-grupos', { replace: true });
                return;
            }
            setGroupName(found.name);
        } finally {
            setLoadingGroup(false);
        }
    }, [currentUser, groupId, navigate]);

    useEffect(() => { fetchGroupName(); }, [fetchGroupName]);

    const fetchApplicants = useCallback(async () => {
        if (!groupId) return;
        setLoading(true);
        const data = await supabaseService.getGroupRegistrations(groupId);
        setApplicants(data);
        setLoading(false);

        // Nombres de los grupos de origen de las derivaciones, en UNA consulta
        // para toda la lista. No están en memoria: son de otros anfitriones.
        const origenes = data.map(a => a.transferFromGroupId).filter(Boolean) as string[];
        if (origenes.length > 0) {
            setNombresOrigen(await supabaseService.getGroupNamesByIds(origenes));
        }
    }, [groupId]);

    useEffect(() => { fetchApplicants(); }, [fetchApplicants]);

    const handleStatusUpdate = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        const success = await supabaseService.updateRegistrationStatus(id, status);
        if (success) {
            setApplicants(prev => prev.map(app =>
                app.id === id ? { ...app, status } : app
            ));
        }
    };

    const pendingCount = applicants.filter(a => a.status === 'PENDING').length;

    const filteredApplicants = applicants.filter(app => {
        if (filter !== 'ALL' && app.status !== filter) return false;
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            const fullName = `${app.firstName} ${app.lastName}`.toLowerCase();
            const email = (app.email || '').toLowerCase();
            return fullName.includes(term) || email.includes(term);
        }
        return true;
    });

    if (loadingGroup) return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
    );

    return (
        <div id="gcx-accion" className={`min-h-screen ${T.fondo} ${T.fuente} ${T.tinta}`}>

            <div className="bg-white dark:bg-[#1b1b1a] rounded-b-[28px] px-5 pt-4 pb-[18px] lg:px-8 lg:py-5">
                <div className="max-w-[760px] mx-auto flex items-center gap-3.5">
                    <div className="flex-1 min-w-0">
                        <Encabezado
                            accion="Solicitudes"
                            grupo={groupName}
                            onVolver={() => navigate(`/mis-grupos/${groupId}`)}
                        />
                    </div>
                    {pendingCount > 0 && (
                        <span
                            className="min-w-[28px] h-7 px-2.5 rounded-full text-white text-[14px] font-semibold flex items-center justify-center shrink-0"
                            style={{ background: 'oklch(0.58 0.2 25)' }}
                        >
                            {pendingCount}
                        </span>
                    )}
                </div>
            </div>

            <div className="max-w-[760px] mx-auto px-4 pt-4 pb-8">

                {/* Filtro y búsqueda — no están en los artboards, pero la
                    pantalla ya los tenía y sirven. Se traen al mismo idioma:
                    píldoras y buscador de 56px. */}
                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        {(['PENDING', 'APPROVED'] as const).map(f => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setFilter(f)}
                                aria-pressed={filter === f}
                                className={`h-[46px] px-[18px] rounded-full text-[14px] font-semibold transition-colors ${filter === f
                                    ? 'bg-[#0a0a0a] dark:bg-white text-white dark:text-black'
                                    : 'bg-white dark:bg-[#1b1b1a] text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'}`}
                            >
                                {f === 'PENDING' ? 'Pendientes' : 'Miembros'}
                            </button>
                        ))}
                    </div>

                    <div className="h-[56px] rounded-full bg-white dark:bg-[#1b1b1a] flex items-center gap-3 px-5">
                        <Search className="w-[18px] h-[18px] shrink-0 text-black/40 dark:text-white/40" strokeWidth={2.2} />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o email"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 min-w-0 outline-none text-[15.5px] font-medium placeholder:text-black/35 dark:placeholder:text-white/35"
                            style={{ background: 'transparent', border: 0, borderRadius: 0 }}
                        />
                    </div>
                </div>

                {/* LIST */}
                <div className="flex flex-col gap-3.5 mt-4">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin text-black/20 dark:text-white/20" /></div>
                    ) : filteredApplicants.length === 0 ? (
                        <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px]">
                            <Vacio
                                titulo={searchTerm
                                    ? 'Sin resultados'
                                    : filter === 'PENDING' ? 'No hay solicitudes pendientes' : 'Todavía no hay miembros'}
                                detalle={searchTerm
                                    ? `No encontramos a nadie con "${searchTerm}".`
                                    : filter === 'PENDING'
                                        ? 'Cuando alguien pida unirse al grupo te va a aparecer acá.'
                                        : 'Cuando apruebes una solicitud, la persona aparece en esta lista.'}
                                accion={searchTerm
                                    ? { texto: 'Limpiar búsqueda', onClick: () => setSearchTerm('') }
                                    : { texto: 'Volver al grupo', onClick: () => navigate(`/mis-grupos/${groupId}`) }}
                            />
                        </div>
                    ) : (
                        filteredApplicants.map((app) => {
                            const p = app.partnerData;
                            const derivada = !!app.transferFromGroupId;
                            const origen = derivada ? nombresOrigen[app.transferFromGroupId!] : null;
                            return (
                                <div key={app.id} className="bg-white dark:bg-[#1b1b1a] rounded-[26px] overflow-hidden">

                                    {/* Derivada: la advertencia va arriba de todo y en negro.
                                        Aprobar acá tiene un efecto en OTRO grupo — eso no
                                        puede quedar como una nota al pie. */}
                                    {derivada && (
                                        <div className="bg-[#0a0a0a] dark:bg-white px-[18px] py-[15px]">
                                            <p className="text-[11.5px] font-semibold uppercase tracking-[.07em] text-white/50 dark:text-black/50">
                                                Derivado desde otro grupo
                                            </p>
                                            <p className="mt-1.5 text-[13.5px] leading-[1.55] font-medium text-white dark:text-black">
                                                {origen ? <>Viene del <span className="font-semibold">{origen}</span>. </> : 'Viene de otro grupo. '}
                                                Si aceptás, sale de ese grupo automáticamente.
                                            </p>
                                        </div>
                                    )}

                                    <div className="p-[18px]">
                                        <div className="flex items-center gap-3.5">
                                            {p ? (
                                                <div className="flex shrink-0 w-[76px]">
                                                    <div className={`w-[46px] h-[46px] rounded-full ${T.chip} flex items-center justify-center text-[13.5px] font-semibold text-black/60 dark:text-white/60`}>
                                                        {getInitials(app.firstName, app.lastName)}
                                                    </div>
                                                    <div className="w-[46px] h-[46px] -ml-3.5 rounded-full bg-[#e8e8e5] dark:bg-[#333331] ring-[3px] ring-white dark:ring-[#1b1b1a] flex items-center justify-center text-[13.5px] font-semibold text-black/60 dark:text-white/60">
                                                        {getInitials(p.firstName, p.lastName)}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className={`w-[46px] h-[46px] shrink-0 rounded-full ${T.chip} flex items-center justify-center text-[14.5px] font-semibold text-black/60 dark:text-white/60`}>
                                                    {getInitials(app.firstName, app.lastName)}
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[16.5px] font-semibold truncate">{app.firstName} {app.lastName}</p>
                                                <p className="mt-0.5 text-[12.5px] font-medium text-black/45 dark:text-white/45 truncate">
                                                    {p
                                                        ? 'Se inscribe con su pareja · 2 lugares'
                                                        : `${derivada ? 'Derivado' : 'Pidió unirse'} ${hace(app.timestamp)}`}
                                                </p>
                                            </div>
                                            {app.status !== 'PENDING' && (
                                                <span className={`shrink-0 h-[26px] px-3 rounded-full text-[12px] font-semibold flex items-center ${app.status === 'APPROVED'
                                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                                                    : 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'}`}>
                                                    {app.status === 'APPROVED' ? 'Aprobado' : 'Rechazado'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Contacto en filas tocables: llamar o escribir sin
                                            salir de la pantalla. */}
                                        <div className={`${T.interna} rounded-[20px] mt-3.5 overflow-hidden`}>
                                            {app.phone && (
                                                <a
                                                    href={`https://wa.me/${app.phone.replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2.5 h-[52px] px-4 transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.04]"
                                                >
                                                    <span className="flex-1 text-[14.5px] font-medium text-black/70 dark:text-white/70 truncate">{app.phone}</span>
                                                    <span className="text-[13px] font-semibold shrink-0">Escribir</span>
                                                </a>
                                            )}
                                            {app.phone && app.email && <div className="h-px bg-black/[.06] dark:bg-white/[.08] mx-4" />}
                                            {app.email && (
                                                <div className="flex items-center h-[52px] px-4">
                                                    <span className="flex-1 text-[14.5px] font-medium text-black/70 dark:text-white/70 truncate">{app.email}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Acompañante: editable ANTES de aprobar. */}
                                        {p && (
                                            <div className={`${T.interna} rounded-[20px] mt-2.5 px-4 py-3.5`}>
                                                <div className="flex items-baseline justify-between gap-3">
                                                    <p className="text-[11.5px] font-semibold uppercase tracking-[.07em] text-black/40 dark:text-white/40">Acompañante</p>
                                                    {!app.partnerUserId && (
                                                        <button type="button" onClick={() => openPartnerModal(app)} className="text-[13px] font-semibold shrink-0 hover:opacity-70 transition-opacity">
                                                            Corregir datos
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="mt-2 text-[15px] font-semibold truncate">{p.firstName} {p.lastName}</p>
                                                <p className="mt-1 text-[13.5px] font-medium text-black/50 dark:text-white/50 truncate">
                                                    {p.phone || 'sin teléfono'} · {p.email || 'sin email'}
                                                </p>
                                            </div>
                                        )}

                                        {app.status === 'APPROVED' && !p && (
                                            <button
                                                type="button"
                                                onClick={() => openPartnerModal(app)}
                                                className={`w-full h-[52px] mt-2.5 rounded-[20px] ${T.interna} text-[14.5px] font-semibold text-black/60 dark:text-white/60 transition-colors hover:text-black dark:hover:text-white`}
                                            >
                                                Agregar pareja
                                            </button>
                                        )}

                                        {app.status === 'PENDING' && (
                                            <div className="flex gap-2.5 mt-4">
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusUpdate(app.id, 'REJECTED')}
                                                    className={`${btnSecundario} h-[54px] px-[22px] text-[15.5px]`}
                                                >
                                                    Rechazar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleStatusUpdate(app.id, 'APPROVED')}
                                                    className={`${btnPrimario} flex-1 h-[54px] text-[16px]`}
                                                >
                                                    {p ? 'Aprobar a los dos' : 'Aprobar'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Modal Agregar/Editar Pareja */}
            {editingPartnerFor && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
                    <div className="w-full sm:max-w-sm bg-white dark:bg-black rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Heart className="w-4 h-4 text-purple-500" />
                                <h3 className="font-black uppercase text-sm text-black dark:text-white">
                                    {editingPartnerFor.partnerData ? 'Editar pareja' : 'Agregar pareja'}
                                </h3>
                            </div>
                            <button onClick={closePartnerModal} className="text-slate-400 hover:text-black dark:hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1.5">¿Tiene email?</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => { setPartnerModalHasEmail(true); setPartnerModalChecked(false); setPartnerModalAccount(null); }} className={`py-2 rounded-lg text-xs font-black uppercase border ${partnerModalHasEmail === true ? 'bg-purple-600 text-white border-purple-600' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>Sí</button>
                                <button onClick={() => { setPartnerModalHasEmail(false); setPartnerModalChecked(true); setPartnerModalAccount(null); setPartnerModalEmail(''); }} className={`py-2 rounded-lg text-xs font-black uppercase border ${partnerModalHasEmail === false ? 'bg-black text-white border-black' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>No</button>
                            </div>
                        </div>

                        {partnerModalHasEmail !== null && (
                            <>
                                {partnerModalHasEmail && (
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Email</label>
                                        <input
                                            type="email" value={partnerModalEmail}
                                            onChange={e => { setPartnerModalEmail(e.target.value); setPartnerModalChecked(false); setPartnerModalAccount(null); }}
                                            onBlur={handlePartnerModalEmailBlur}
                                            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-black text-sm font-medium outline-none focus:border-black dark:focus:border-white"
                                        />
                                        {partnerModalAccount && <p className="text-[10px] font-bold text-green-600 mt-1">Cuenta encontrada: {partnerModalAccount.name}</p>}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Nombre</label>
                                        <input type="text" value={partnerModalFirstName} onChange={e => setPartnerModalFirstName(e.target.value)} disabled={partnerModalHasEmail === true && (!partnerModalChecked || partnerModalChecking)} className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-black text-sm font-medium outline-none focus:border-black dark:focus:border-white disabled:bg-slate-100 disabled:text-slate-400" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Apellido</label>
                                        <input type="text" value={partnerModalLastName} onChange={e => setPartnerModalLastName(e.target.value)} disabled={partnerModalHasEmail === true && (!partnerModalChecked || partnerModalChecking)} className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-black text-sm font-medium outline-none focus:border-black dark:focus:border-white disabled:bg-slate-100 disabled:text-slate-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Teléfono</label>
                                    <input type="tel" value={partnerModalPhone} onChange={e => setPartnerModalPhone(e.target.value)} disabled={partnerModalHasEmail === true && (!partnerModalChecked || partnerModalChecking)} className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-black text-sm font-medium outline-none focus:border-black dark:focus:border-white disabled:bg-slate-100 disabled:text-slate-400" />
                                </div>
                            </>
                        )}

                        {partnerModalError && <p className="text-xs text-red-600 font-semibold">{partnerModalError}</p>}

                        <button
                            onClick={handleSavePartner}
                            disabled={partnerModalSaving}
                            className="w-full h-11 rounded-lg bg-black dark:bg-white text-white dark:text-black text-xs font-black uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {partnerModalSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Guardar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaginaSolicitudesGrupo;

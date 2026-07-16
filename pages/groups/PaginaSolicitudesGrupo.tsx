import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, GroupRegistration } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { ArrowLeft, Check, Search, Clock, Mail, Phone, Loader2, Heart, X, UserPlus, Edit2 } from 'lucide-react';

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
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-2xl mx-auto px-4 md:px-8 py-8">

                <button
                    onClick={() => navigate(`/mis-grupos/${groupId}`)}
                    className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-black dark:hover:text-white transition-colors mb-6 font-black uppercase tracking-widest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 rounded"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {groupName}
                </button>

                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black dark:text-white mb-6">
                    Solicitudes
                </h1>

                {/* FILTERS & SEARCH */}
                <div className="flex flex-col gap-4 mb-6">
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                        <button
                            onClick={() => setFilter('PENDING')}
                            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${filter === 'PENDING' ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm' : 'text-slate-500 hover:text-black dark:hover:text-white'}`}
                        >
                            Solicitudes
                            {pendingCount > 0 && (
                                <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black tabular-nums ${filter === 'PENDING' ? 'bg-amber-400 text-black' : 'bg-amber-400 text-black'}`}>
                                    {pendingCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setFilter('APPROVED')}
                            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filter === 'APPROVED' ? 'bg-black dark:bg-white text-white dark:text-black shadow-sm' : 'text-slate-500 hover:text-black dark:hover:text-white'}`}
                        >
                            Miembros
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-black text-black dark:text-white border border-slate-200 dark:border-slate-700 font-medium text-sm focus:outline-none focus:border-slate-900 dark:focus:border-white transition-colors"
                        />
                    </div>
                </div>

                {/* LIST */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
                    ) : filteredApplicants.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                            <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                {searchTerm ? `Sin resultados para "${searchTerm}"` : filter === 'PENDING' ? 'No hay solicitudes pendientes.' : 'Todavía no hay miembros aprobados.'}
                            </p>
                        </div>
                    ) : (
                        filteredApplicants.map((app) => (
                            <div key={app.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 transition-colors">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black flex items-center justify-center shrink-0">
                                        {getInitials(app.firstName, app.lastName)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start gap-2">
                                            <h3 className="font-bold text-sm truncate text-black dark:text-white">{app.firstName} {app.lastName}</h3>
                                            {app.status !== 'PENDING' && (
                                                <span className={`shrink-0 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide rounded-full ${app.status === 'APPROVED' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                                                    {app.status === 'APPROVED' ? 'Aprobado' : 'Rechazado'}
                                                </span>
                                            )}
                                        </div>

                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 space-y-0.5">
                                            <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 shrink-0" /> {app.phone}</div>
                                            {app.email && <div className="flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{app.email}</span></div>}
                                            <div className="flex items-center gap-1.5 opacity-70"><Clock className="w-3 h-3 shrink-0" /> {new Date(app.timestamp).toLocaleDateString('es-AR')}</div>
                                        </div>

                                        {app.status === 'APPROVED' && app.partnerData && (
                                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-500 text-[10px] font-black flex items-center justify-center shrink-0">
                                                    {getInitials(app.partnerData.firstName, app.partnerData.lastName)}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-black uppercase tracking-wide text-purple-500">Pareja</span>
                                                        {app.partnerUserId && <span className="text-[9px] font-black uppercase tracking-wide bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">Vinculado</span>}
                                                    </div>
                                                    <p className="text-sm font-bold text-black dark:text-white truncate">{app.partnerData.firstName} {app.partnerData.lastName}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Phone className="w-3 h-3 shrink-0" /> {app.partnerData.phone}</p>
                                                </div>
                                                {!app.partnerUserId && (
                                                    <button onClick={() => openPartnerModal(app)} className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-black dark:hover:text-white transition-colors">
                                                        <Edit2 className="w-3 h-3" /> Editar
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        {app.status === 'APPROVED' && !app.partnerData && (
                                            <button onClick={() => openPartnerModal(app)} className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 w-full flex items-center gap-1.5 text-[10px] font-black uppercase text-purple-500 hover:text-purple-700 transition-colors">
                                                <UserPlus className="w-3.5 h-3.5" /> Agregar pareja
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {app.status === 'PENDING' && (
                                    <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                                        <button
                                            onClick={() => handleStatusUpdate(app.id, 'REJECTED')}
                                            className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-wide rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                                        >
                                            Rechazar
                                        </button>
                                        <button
                                            onClick={() => handleStatusUpdate(app.id, 'APPROVED')}
                                            className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-wide rounded-lg bg-black dark:bg-white text-white dark:text-black hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                        >
                                            <Check className="w-3.5 h-3.5" /> Aprobar
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
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

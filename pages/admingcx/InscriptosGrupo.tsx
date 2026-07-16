import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { GroupRegistration } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import AdminGCXLayout from '../../components/layout/AdminGCXLayout';
import { Check, Search, User, Clock, Mail, Loader2, Trash2, Heart, X, UserPlus, Edit2 } from 'lucide-react';

const InscriptosGrupoContent: React.FC = () => {
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

    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [isSending, setIsSending] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

    const fetchGroupName = useCallback(async () => {
        if (!groupId) return;
        setLoadingGroup(true);
        try {
            const allGroups = await supabaseService.getGroupsForAdmin();
            const found = allGroups.find(g => g.id === groupId);
            if (!found) {
                navigate('/admingcx/gestion-de-grupos', { replace: true });
                return;
            }
            setGroupName(found.name);
        } finally {
            setLoadingGroup(false);
        }
    }, [groupId, navigate]);

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
            setApplicants(prev => prev.map(app => app.id === id ? { ...app, status } : app));
        }
    };

    const approvedApplicants = applicants.filter(a => a.status === 'APPROVED');

    const toggleSelection = (id: string) => {
        const newSelection = new Set(selectedMembers);
        if (newSelection.has(id)) newSelection.delete(id);
        else newSelection.add(id);
        setSelectedMembers(newSelection);
    };

    const toggleSelectAll = () => {
        const approvedIds = approvedApplicants.map(a => a.id);
        const allSelected = approvedIds.every(id => selectedMembers.has(id));
        setSelectedMembers(allSelected ? new Set() : new Set(approvedIds));
    };

    const handleBulkResend = async () => {
        if (selectedMembers.size === 0) return;
        setIsSending(true);
        setSendResult(null);
        try {
            const result = await supabaseService.resendGroupConfirmationEmails(Array.from(selectedMembers));
            setSendResult(result);
            if (result.success) setSelectedMembers(new Set());
        } catch (error) {
            setSendResult({ success: false, message: 'Error inesperado al enviar correos' });
        } finally {
            setIsSending(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedMembers.size === 0) return;
        if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${selectedMembers.size} miembro(s)?`)) return;
        setIsDeleting(true);
        setSendResult(null);
        try {
            const result = await supabaseService.bulkRemoveGroupMembers(Array.from(selectedMembers));
            setSendResult(result);
            if (result.success) {
                setApplicants(prev => prev.filter(a => !selectedMembers.has(a.id)));
                setSelectedMembers(new Set());
            }
        } catch (error) {
            setSendResult({ success: false, message: 'Error inesperado al eliminar miembros' });
        } finally {
            setIsDeleting(false);
        }
    };

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

    const allApprovedSelected = approvedApplicants.length > 0 && approvedApplicants.every(a => selectedMembers.has(a.id));

    if (loadingGroup) return (
        <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
    );

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-6">
                Solicitudes: {groupName}
            </h1>

            <div className="flex flex-col gap-4 mb-4">
                <div className="flex bg-neutral-100 p-1 rounded-lg">
                    <button
                        onClick={() => setFilter('PENDING')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${filter === 'PENDING' ? 'bg-black text-white shadow-sm' : 'text-neutral-500 hover:text-black'}`}
                    >
                        Solicitudes
                    </button>
                    <button
                        onClick={() => setFilter('APPROVED')}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${filter === 'APPROVED' ? 'bg-black text-white shadow-sm' : 'text-neutral-500 hover:text-black'}`}
                    >
                        Miembros
                    </button>
                </div>

                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-white border-2 border-black font-bold text-sm focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] outline-none transition-all"
                        />
                    </div>
                    {filter === 'APPROVED' && approvedApplicants.length > 0 && (
                        <button
                            onClick={toggleSelectAll}
                            className={`px-3 border-2 border-black font-bold text-xs uppercase flex items-center gap-1 hover:bg-black hover:text-white transition-all ${allApprovedSelected ? 'bg-black text-white' : 'bg-white'}`}
                        >
                            <Check className={`w-3 h-3 ${allApprovedSelected ? 'opacity-100' : 'opacity-0'}`} />
                            Todos
                        </button>
                    )}
                </div>
            </div>

            {sendResult && (
                <div className={`mb-4 p-3 border-2 text-xs font-black uppercase ${sendResult.success ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'}`}>
                    {sendResult.message}
                </div>
            )}

            <div className="space-y-3 mb-6">
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin" /></div>
                ) : filteredApplicants.length === 0 ? (
                    <div className="text-center py-10 opacity-50">
                        <Search className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-xs font-bold uppercase">Sin resultados</p>
                    </div>
                ) : (
                    filteredApplicants.map((app) => (
                        <div key={app.id} className={`p-3 border-2 transition-all rounded-lg ${selectedMembers.has(app.id) ? 'border-black bg-blue-50' : 'border-neutral-200 hover:border-black'}`}>
                            <div className="flex justify-between items-start gap-3">
                                {app.status === 'APPROVED' && (
                                    <input
                                        type="checkbox"
                                        checked={selectedMembers.has(app.id)}
                                        onChange={() => toggleSelection(app.id)}
                                        className="mt-1 w-4 h-4 accent-black border-2 border-black cursor-pointer"
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold truncate">{app.firstName} {app.lastName}</h3>
                                        {app.status !== 'PENDING' && (
                                            <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 ${app.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {app.status === 'APPROVED' ? 'OK' : 'NO'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-neutral-500 mt-1 space-y-0.5">
                                        <div className="flex items-center gap-1"><User className="w-3 h-3" /> {app.phone}</div>
                                        {app.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {app.email}</div>}
                                        <div className="flex items-center gap-1 opacity-70"><Clock className="w-3 h-3" /> {new Date(app.timestamp).toLocaleDateString()}</div>
                                    </div>
                                    {app.status === 'APPROVED' && app.partnerData && (
                                        <div className="mt-2 pt-2 border-t border-neutral-200 flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1 mb-1">
                                                    <span className="text-[10px] font-black uppercase text-neutral-400">Pareja</span>
                                                    {app.partnerUserId && <span className="bg-green-100 text-green-700 text-[10px] px-1 font-bold">VINCULADO</span>}
                                                </div>
                                                <p className="text-sm font-bold">{app.partnerData.firstName} {app.partnerData.lastName}</p>
                                                <p className="text-xs text-neutral-500 flex items-center gap-1"><User className="w-3 h-3" /> {app.partnerData.phone}</p>
                                            </div>
                                            {!app.partnerUserId && (
                                                <button onClick={() => openPartnerModal(app)} className="shrink-0 flex items-center gap-1 text-[10px] font-black uppercase text-purple-600 hover:text-purple-800">
                                                    <Edit2 className="w-3 h-3" /> Editar
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {app.status === 'APPROVED' && !app.partnerData && (
                                        <button onClick={() => openPartnerModal(app)} className="mt-2 pt-2 border-t border-neutral-200 w-full flex items-center gap-1.5 text-[10px] font-black uppercase text-purple-600 hover:text-purple-800">
                                            <UserPlus className="w-3.5 h-3.5" /> Agregar pareja
                                        </button>
                                    )}
                                </div>
                            </div>

                            {app.status === 'PENDING' && (
                                <div className="flex gap-2 mt-3 pt-2 border-t-2 border-dotted border-neutral-200">
                                    <button onClick={() => handleStatusUpdate(app.id, 'REJECTED')} className="flex-1 py-2 text-[10px] font-black uppercase bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors rounded">Rechazar</button>
                                    <button onClick={() => handleStatusUpdate(app.id, 'APPROVED')} className="flex-1 py-2 text-[10px] font-black uppercase bg-black text-white hover:bg-neutral-800 transition-colors rounded">Aprobar</button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {selectedMembers.size > 0 && (
                <div className="sticky bottom-4 pt-4 border-t-4 border-black bg-white flex items-center justify-between gap-2 overflow-x-auto rounded-t-lg shadow-lg px-3 pb-3">
                    <span className="text-xs font-black uppercase whitespace-nowrap">{selectedMembers.size} Sel.</span>
                    <div className="flex gap-2">
                        <button
                            onClick={handleBulkResend}
                            disabled={isSending}
                            className="px-3 py-2 bg-neutral-100 border-2 border-black font-bold uppercase text-[10px] hover:bg-black hover:text-white transition-all flex items-center gap-1 whitespace-nowrap"
                        >
                            {isSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3" />}
                            Reenviar
                        </button>
                        <button
                            onClick={handleBulkDelete}
                            disabled={isSending || isDeleting}
                            className="px-3 py-2 bg-red-50 border-2 border-red-500 text-red-600 font-bold uppercase text-[10px] hover:bg-red-600 hover:text-white transition-all flex items-center gap-1 whitespace-nowrap"
                        >
                            {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Eliminar
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Agregar/Editar Pareja */}
            {editingPartnerFor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-sm bg-white border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-5 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b-2 border-black pb-2">
                            <div className="flex items-center gap-2">
                                <Heart className="w-4 h-4 text-purple-600" />
                                <h3 className="font-black uppercase text-sm">
                                    {editingPartnerFor.partnerData ? 'Editar pareja' : 'Agregar pareja'}
                                </h3>
                            </div>
                            <button onClick={closePartnerModal} className="text-neutral-400 hover:text-black">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div>
                            <p className="text-[10px] font-black uppercase text-neutral-400 mb-1.5">¿Tiene email?</p>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={() => { setPartnerModalHasEmail(true); setPartnerModalChecked(false); setPartnerModalAccount(null); }} className={`py-2 border-2 border-black text-xs font-black uppercase transition-all ${partnerModalHasEmail === true ? 'bg-purple-600 text-white' : 'bg-white text-black hover:bg-neutral-100'}`}>Sí</button>
                                <button onClick={() => { setPartnerModalHasEmail(false); setPartnerModalChecked(true); setPartnerModalAccount(null); setPartnerModalEmail(''); }} className={`py-2 border-2 border-black text-xs font-black uppercase transition-all ${partnerModalHasEmail === false ? 'bg-black text-white' : 'bg-white text-black hover:bg-neutral-100'}`}>No</button>
                            </div>
                        </div>

                        {partnerModalHasEmail !== null && (
                            <>
                                {partnerModalHasEmail && (
                                    <div>
                                        <label className="text-[10px] font-bold uppercase block mb-1">Email</label>
                                        <input
                                            type="email" value={partnerModalEmail}
                                            onChange={e => { setPartnerModalEmail(e.target.value); setPartnerModalChecked(false); setPartnerModalAccount(null); }}
                                            onBlur={handlePartnerModalEmailBlur}
                                            className="w-full h-10 px-3 border-2 border-black font-bold text-sm outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                                        />
                                        {partnerModalAccount && <p className="text-[10px] font-bold text-green-700 mt-1">Cuenta encontrada: {partnerModalAccount.name}</p>}
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase block mb-1">Nombre</label>
                                        <input type="text" value={partnerModalFirstName} onChange={e => setPartnerModalFirstName(e.target.value)} disabled={partnerModalHasEmail === true && (!partnerModalChecked || partnerModalChecking)} className="w-full h-10 px-3 border-2 border-black font-bold text-sm outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:bg-neutral-100 disabled:text-neutral-400" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase block mb-1">Apellido</label>
                                        <input type="text" value={partnerModalLastName} onChange={e => setPartnerModalLastName(e.target.value)} disabled={partnerModalHasEmail === true && (!partnerModalChecked || partnerModalChecking)} className="w-full h-10 px-3 border-2 border-black font-bold text-sm outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:bg-neutral-100 disabled:text-neutral-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase block mb-1">Teléfono</label>
                                    <input type="tel" value={partnerModalPhone} onChange={e => setPartnerModalPhone(e.target.value)} disabled={partnerModalHasEmail === true && (!partnerModalChecked || partnerModalChecking)} className="w-full h-10 px-3 border-2 border-black font-bold text-sm outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:bg-neutral-100 disabled:text-neutral-400" />
                                </div>
                            </>
                        )}

                        {partnerModalError && <p className="text-xs text-red-600 font-semibold">{partnerModalError}</p>}

                        <button
                            onClick={handleSavePartner}
                            disabled={partnerModalSaving}
                            className="w-full h-11 bg-black text-white text-xs font-black uppercase tracking-wide border-2 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

const InscriptosGrupo: React.FC = () => (
    <AdminGCXLayout
        title="Inscriptos del Grupo"
        backTo="/admingcx/gestion-de-grupos"
        backLabel="Volver a Gestión de Grupos"
    >
        <InscriptosGrupoContent />
    </AdminGCXLayout>
);

export default InscriptosGrupo;

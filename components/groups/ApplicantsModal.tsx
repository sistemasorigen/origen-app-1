import React, { useEffect, useState } from 'react';
import NeoModal from '../NeoModal';
import { Check, Search, User, Clock, Mail, Loader2, Trash2, X } from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';
import { GroupRegistration } from '../../types';

interface ApplicantsModalProps {
    isOpen: boolean;
    onClose: () => void;
    groupId: string;
    groupName: string;
    hideEmailSelection?: boolean;
}

const ApplicantsModal: React.FC<ApplicantsModalProps> = ({ isOpen, onClose, groupId, groupName, hideEmailSelection = false }) => {
    const [applicants, setApplicants] = useState<GroupRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED'>('PENDING');
    const [searchTerm, setSearchTerm] = useState('');

    // Bulk selection state
    const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
    const [isSending, setIsSending] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        if (isOpen && groupId) {
            fetchApplicants();
            setSelectedMembers(new Set());
            setSendResult(null);
        }
    }, [isOpen, groupId]);

    const fetchApplicants = async () => {
        setLoading(true);
        const data = await supabaseService.getGroupRegistrations(groupId);
        setApplicants(data);
        setLoading(false);
    };

    const handleStatusUpdate = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        const success = await supabaseService.updateRegistrationStatus(id, status);
        if (success) {
            setApplicants(prev => prev.map(app =>
                app.id === id ? { ...app, status } : app
            ));
        }
    };

    const approvedApplicants = applicants.filter(a => a.status === 'APPROVED');

    const toggleSelection = (id: string) => {
        const newSelection = new Set(selectedMembers);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedMembers(newSelection);
    };

    const toggleSelectAll = () => {
        const approvedIds = approvedApplicants.map(a => a.id);
        const allSelected = approvedIds.every(id => selectedMembers.has(id));

        if (allSelected) {
            setSelectedMembers(new Set());
        } else {
            setSelectedMembers(new Set(approvedIds));
        }
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

    const allApprovedSelected = approvedApplicants.length > 0 &&
        approvedApplicants.every(a => selectedMembers.has(a.id));

    return (
        <NeoModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Solicitudes: ${groupName}`}
        >
            <div className="flex flex-col h-full max-h-[80vh]">

                {/* FILTERS & SEARCH */}
                <div className="flex flex-col gap-4 mb-4">
                    <div className="flex bg-neutral-100 p-1 rounded-lg">
                        <button
                            onClick={() => setFilter('PENDING')}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${filter === 'PENDING' ? 'bg-black text-white shadow-sm' : 'text-neutral-500 hover:text-black'
                                }`}
                        >
                            Solicitudes
                        </button>
                        <button
                            onClick={() => setFilter('APPROVED')}
                            className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${filter === 'APPROVED' ? 'bg-black text-white shadow-sm' : 'text-neutral-500 hover:text-black'
                                }`}
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
                        {!hideEmailSelection && filter === 'APPROVED' && approvedApplicants.length > 0 && (
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

                {/* STATUS MESSAGE */}
                {sendResult && (
                    <div className={`mb-4 p-3 border-2 text-xs font-black uppercase ${sendResult.success ? 'bg-green-50 border-green-500 text-green-700' : 'bg-red-50 border-red-500 text-red-700'}`}>
                        {sendResult.message}
                    </div>
                )}

                {/* LIST */}
                <div className="flex-1 overflow-y-auto min-h-[200px] space-y-3 pr-1">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin" /></div>
                    ) : filteredApplicants.length === 0 ? (
                        <div className="text-center py-10 opacity-50">
                            <Search className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-xs font-bold uppercase">Sin resultados</p>
                        </div>
                    ) : (
                        filteredApplicants.map((app) => (
                            <div key={app.id} className={`p-3 border-2 transition-all ${selectedMembers.has(app.id) ? 'border-black bg-blue-50' : 'border-neutral-200 hover:border-black'}`}>
                                <div className="flex justify-between items-start gap-3">
                                    {!hideEmailSelection && app.status === 'APPROVED' && (
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

                                        {app.partnerData && (
                                            <div className="mt-2 pt-2 border-t border-neutral-200">
                                                <div className="flex items-center gap-1 mb-1">
                                                    <span className="text-[10px] font-black uppercase text-neutral-400">Pareja</span>
                                                    {app.partnerUserId && <span className="bg-green-100 text-green-700 text-[10px] px-1 font-bold">VINCULADO</span>}
                                                </div>
                                                <p className="text-sm font-bold">{app.partnerData.firstName} {app.partnerData.lastName}</p>
                                                <p className="text-xs text-neutral-500 flex items-center gap-1"><User className="w-3 h-3" /> {app.partnerData.phone}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {app.status === 'PENDING' && (
                                    <div className="flex gap-2 mt-3 pt-2 border-t-2 border-dotted border-neutral-200">
                                        <button onClick={() => handleStatusUpdate(app.id, 'REJECTED')} className="flex-1 py-2 text-[10px] font-black uppercase bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors">Rechazar</button>
                                        <button onClick={() => handleStatusUpdate(app.id, 'APPROVED')} className="flex-1 py-2 text-[10px] font-black uppercase bg-black text-white hover:bg-neutral-800 transition-colors">Aprobar</button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* BULK ACTIONS */}
                {!hideEmailSelection && selectedMembers.size > 0 && (
                    <div className="mt-4 pt-4 border-t-4 border-black bg-white flex items-center justify-between gap-2 overflow-x-auto">
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
            </div>
        </NeoModal>
    );
};

export default ApplicantsModal;

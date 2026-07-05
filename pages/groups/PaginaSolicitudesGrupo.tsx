import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, GroupRegistration } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { ArrowLeft, Check, Search, Clock, Mail, Phone, Loader2 } from 'lucide-react';

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

                                        {app.partnerData && (
                                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-500 text-[10px] font-black flex items-center justify-center shrink-0">
                                                    {getInitials(app.partnerData.firstName, app.partnerData.lastName)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] font-black uppercase tracking-wide text-purple-500">Pareja</span>
                                                        {app.partnerUserId && <span className="text-[9px] font-black uppercase tracking-wide bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">Vinculado</span>}
                                                    </div>
                                                    <p className="text-sm font-bold text-black dark:text-white truncate">{app.partnerData.firstName} {app.partnerData.lastName}</p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><Phone className="w-3 h-3 shrink-0" /> {app.partnerData.phone}</p>
                                                </div>
                                            </div>
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
        </div>
    );
};

export default PaginaSolicitudesGrupo;

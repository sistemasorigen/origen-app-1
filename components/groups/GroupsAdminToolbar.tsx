import React from 'react';
import { Search, X, Plus, UserPlus, MailMinus, MoreVertical, CheckCircle, Loader2, Calendar } from 'lucide-react';
import { Group } from '../../types';

interface GroupsAdminToolbarProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    filterMode: 'MANUAL' | 'SEASONS';
    setFilterMode: (mode: 'MANUAL' | 'SEASONS') => void;
    statusFilter: 'ALL' | 'APPROVED' | 'PENDING' | 'FINALIZED';
    setStatusFilter: (status: 'ALL' | 'APPROVED' | 'PENDING' | 'FINALIZED') => void;
    seasonFilter: 'S1' | 'S2' | 'S3';
    setSeasonFilter: (season: 'S1' | 'S2' | 'S3') => void;
    pendingDropoutCount: number;
    adminGroups: Group[];
    onCreateGroup: () => void;
    onAddMember: () => void;
    onDropoutInbox: () => void;
    isMobileMenuOpen: boolean;
    setIsMobileMenuOpen: (open: boolean) => void;
}

const GroupsAdminToolbar: React.FC<GroupsAdminToolbarProps> = ({
    searchTerm, setSearchTerm,
    filterMode, setFilterMode,
    statusFilter, setStatusFilter,
    seasonFilter, setSeasonFilter,
    pendingDropoutCount,
    adminGroups,
    onCreateGroup,
    onAddMember,
    onDropoutInbox,
    isMobileMenuOpen, setIsMobileMenuOpen
}) => {

    const isGroupFinished = (g: Group) => g.endDate && g.endDate < new Date().toISOString().split('T')[0];

    const approvedCount = adminGroups.filter(g => g.status === 'approved' && !isGroupFinished(g)).length;
    const finalizedCount = adminGroups.filter(g => g.status === 'approved' && isGroupFinished(g)).length;
    const pendingCount = adminGroups.filter(g => g.status === 'pending' || !g.status).length;

    return (
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6 relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 w-full xl:w-auto relative">
                <div className="shrink-0 flex justify-between w-full sm:w-auto items-center gap-3">
                    <div>
                        <h3 className="text-base sm:text-lg font-black uppercase tracking-tight text-slate-900 leading-none">Moderación</h3>
                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Gestión de Grupos</p>
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar grupo, líder..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-black transition-all placeholder:font-medium placeholder:text-slate-400"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <X className="w-3 h-3 text-slate-400" />
                            </button>
                        )}
                    </div>

                    {/* Mobile Actions Menu (3 dots) */}
                    <div className="relative sm:hidden z-20">
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className={`p-2 rounded-lg transition-colors border ${isMobileMenuOpen ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-200'}`}
                        >
                            <MoreVertical className="w-5 h-5" />
                        </button>

                        {isMobileMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]" onClick={() => setIsMobileMenuOpen(false)} />
                                <div className="absolute top-full right-0 mt-2 z-50 w-64 bg-white border-2 border-slate-900 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-2 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                    <button
                                        onClick={() => { onCreateGroup(); setIsMobileMenuOpen(false); }}
                                        className="flex items-center gap-3 px-4 py-3 bg-black text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-zinc-800 transition-all"
                                    >
                                        <Plus className="w-4 h-4 shrink-0" />
                                        CREAR GRUPO
                                    </button>
                                    <button
                                        onClick={() => { onAddMember(); setIsMobileMenuOpen(false); }}
                                        className="flex items-center gap-3 px-4 py-3 bg-slate-50 text-slate-900 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-100 transition-all border border-slate-200"
                                    >
                                        <UserPlus className="w-4 h-4 shrink-0" />
                                        AGREGAR PARTICIPANTE
                                    </button>

                                    <button
                                        onClick={() => { onDropoutInbox(); setIsMobileMenuOpen(false); }}
                                        className="flex items-center gap-3 px-4 py-3 bg-white text-slate-900 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-50 transition-all justify-between border-2 border-slate-100"
                                    >
                                        <div className="flex items-center gap-3">
                                            <MailMinus className="w-4 h-4 shrink-0" />
                                            SOLICITUDES DE BAJA
                                        </div>
                                        {pendingDropoutCount > 0 && (
                                            <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                {pendingDropoutCount}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Admin Toolbar - Action Buttons (Desktop Only) */}
                <div className="hidden sm:flex gap-2.5 w-full sm:w-auto px-1">
                    {/* CTA Principal: NUEVO */}
                    <button
                        onClick={onCreateGroup}
                        className="flex items-center gap-2 px-5 py-2.5 bg-black text-white border-2 border-black rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider hover:bg-zinc-800 active:scale-95 transition-all whitespace-nowrap min-h-[40px] shadow-sm hover:shadow-md"
                    >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span className="hidden lg:inline">CREAR GRUPO</span>
                        <span className="inline lg:hidden">NUEVO</span>
                    </button>

                    {/* Agregar Participante */}
                    <button
                        onClick={onAddMember}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-black border-2 border-slate-200 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider hover:border-black active:scale-95 transition-all whitespace-nowrap min-h-[40px]"
                    >
                        <UserPlus className="w-4 h-4 shrink-0" />
                        <span className="hidden lg:inline">AGREGAR MIEMBRO</span>
                        <span className="inline lg:hidden">AGREGAR</span>
                    </button>

                    {/* Bajas con Badge */}
                    <button
                        onClick={onDropoutInbox}
                        className={`relative flex items-center gap-2 px-5 py-2.5 border-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider active:scale-95 transition-all whitespace-nowrap min-h-[40px] ${pendingDropoutCount > 0
                            ? 'bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-400 hover:bg-orange-100'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-800'
                            }`}
                    >
                        <MailMinus className="w-4 h-4 shrink-0" />
                        <span className="hidden lg:inline">SOLICITUDES DE BAJA</span>
                        <span className="inline lg:hidden">BAJAS</span>
                        {pendingDropoutCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
                                {pendingDropoutCount > 9 ? '9+' : pendingDropoutCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Status Pills (Right side) - Always Visible */}
            <div
                className="flex items-center gap-1.5 sm:gap-2 w-full xl:w-auto overflow-x-auto xl:overflow-visible pb-2 xl:pb-0 justify-start xl:justify-end no-scrollbar"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {/* Filter Mode Toggle */}
                <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2 border border-slate-200 shrink-0">
                    <button
                        onClick={() => setFilterMode('MANUAL')}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${filterMode === 'MANUAL'
                            ? 'bg-white text-black shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                            }`}
                    >
                        Manual
                    </button>
                    <button
                        onClick={() => setFilterMode('SEASONS')}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${filterMode === 'SEASONS'
                            ? 'bg-white text-black shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                            }`}
                    >
                        Temporadas
                    </button>
                </div>

                {filterMode === 'MANUAL' ? (
                    <>
                        <button
                            onClick={() => setStatusFilter(statusFilter === 'APPROVED' ? 'ALL' : 'APPROVED')}
                            className={`px-3 py-2 text-[10px] sm:text-xs font-black uppercase rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${statusFilter === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-500'
                                : 'bg-white text-emerald-700 border-2 border-emerald-100 hover:border-emerald-300'
                                } ${statusFilter !== 'ALL' && statusFilter !== 'APPROVED' ? 'opacity-40 grayscale' : ''}`}
                        >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {approvedCount}
                            <span className="hidden sm:inline">Aprobados</span>
                        </button>

                        <button
                            onClick={() => setStatusFilter(statusFilter === 'FINALIZED' ? 'ALL' : 'FINALIZED')}
                            className={`px-3 py-2 text-[10px] sm:text-xs font-black uppercase rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${statusFilter === 'FINALIZED'
                                ? 'bg-neutral-200 text-neutral-800 border-2 border-neutral-500'
                                : 'bg-white text-neutral-600 border-2 border-neutral-200 hover:border-neutral-400'
                                } ${statusFilter !== 'ALL' && statusFilter !== 'FINALIZED' ? 'opacity-40 grayscale' : ''}`}
                        >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {finalizedCount}
                            <span className="hidden sm:inline">Finalizados</span>
                        </button>

                        <button
                            onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
                            className={`px-3 py-2 text-[10px] sm:text-xs font-black uppercase rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${statusFilter === 'PENDING'
                                ? 'bg-amber-100 text-amber-800 border-2 border-amber-500'
                                : 'bg-white text-amber-700 border-2 border-amber-100 hover:border-amber-300'
                                } ${statusFilter !== 'ALL' && statusFilter !== 'PENDING' ? 'opacity-40 grayscale' : ''}`}
                        >
                            <Loader2 className="w-3.5 h-3.5" />
                            {pendingCount}
                            <span className="hidden sm:inline">Pendientes</span>
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => setSeasonFilter('S1')}
                            className={`px-3 py-2 text-[10px] sm:text-xs font-black uppercase rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${seasonFilter === 'S1'
                                ? 'bg-blue-100 text-blue-900 border-2 border-blue-500'
                                : 'bg-white text-blue-800 border-2 border-blue-100 hover:border-blue-300'
                                }`}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>1ª Temp</span>
                        </button>

                        <button
                            onClick={() => setSeasonFilter('S2')}
                            className={`px-3 py-2 text-[10px] sm:text-xs font-black uppercase rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${seasonFilter === 'S2'
                                ? 'bg-purple-100 text-purple-900 border-2 border-purple-500'
                                : 'bg-white text-purple-800 border-2 border-purple-100 hover:border-purple-300'
                                }`}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>2ª Temp</span>
                        </button>

                        <button
                            onClick={() => setSeasonFilter('S3')}
                            className={`px-3 py-2 text-[10px] sm:text-xs font-black uppercase rounded-full flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all ${seasonFilter === 'S3'
                                ? 'bg-pink-100 text-pink-900 border-2 border-pink-500'
                                : 'bg-white text-pink-800 border-2 border-pink-100 hover:border-pink-300'
                                }`}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>3ª Temp</span>
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default GroupsAdminToolbar;

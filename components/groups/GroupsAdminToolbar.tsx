import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Plus, UserPlus, MailMinus, MoreVertical, CheckCircle, AlertCircle, Clock, Calendar, SlidersHorizontal } from 'lucide-react';
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
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    const isGroupFinished = (g: Group) => g.endDate && g.endDate < new Date().toISOString().split('T')[0];

    const approvedCount = adminGroups.filter(g => g.status === 'approved' && !isGroupFinished(g)).length;
    const finalizedCount = adminGroups.filter(g => g.status === 'approved' && isGroupFinished(g)).length;
    const pendingCount = adminGroups.filter(g => g.status === 'pending' || !g.status).length;

    // Close filter dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Compute active filter badge
    const hasActiveFilter = filterMode === 'SEASONS' || statusFilter !== 'ALL';
    const activeFilterLabel = filterMode === 'SEASONS'
        ? { S1: '1ª Temp', S2: '2ª Temp', S3: '3ª Temp' }[seasonFilter]
        : statusFilter !== 'ALL'
            ? { APPROVED: 'Aprobados', FINALIZED: 'Finalizados', PENDING: 'Pendientes' }[statusFilter]
            : null;

    return (
        <div className="flex flex-col gap-2 sm:gap-4 mb-4 sm:mb-6 relative ml-4">

            {/* Top Row: Title & Mobile Actions */}
            <div className="flex justify-between items-start">
                {/* Title */}
                <div>
                    <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-900 leading-none">Moderación</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Gestión de Grupos</p>
                </div>

                {/* Mobile 3-dots action menu */}
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

            {/* Bottom Row: Search, Filter, and Desktop Actions */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">

                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
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

                {/* Filter Button */}
                <div className="relative shrink-0" ref={filterRef}>
                    <button
                        onClick={() => setIsFilterOpen(v => !v)}
                        className={`flex justify-center items-center gap-1.5 px-4 py-2.5 rounded-lg border text-xs font-black uppercase tracking-wide transition-all ${isFilterOpen || hasActiveFilter
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-black'
                            }`}
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                        <span>
                            {activeFilterLabel ?? 'Filtros'}
                        </span>
                        {hasActiveFilter && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 sm:hidden" />
                        )}
                    </button>

                    {/* Filter Dropdown Panel */}
                    {isFilterOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)} />
                            <div className="absolute top-full right-0 sm:left-auto sm:right-0 mt-2 z-50 w-72 max-w-[calc(100vw-2rem)] bg-white border-2 border-slate-900 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-4 space-y-4 animate-in fade-in zoom-in-95 duration-150 origin-top-right">

                                {/* Mode Toggle: Manual / Temporadas */}
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Modo de Filtro</p>
                                    <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
                                        <button
                                            onClick={() => { setFilterMode('MANUAL'); setStatusFilter('ALL'); }}
                                            className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${filterMode === 'MANUAL' ? 'bg-white text-black shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                        >
                                            Manual
                                        </button>
                                        <button
                                            onClick={() => { setFilterMode('SEASONS'); setStatusFilter('ALL'); }}
                                            className={`flex-1 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${filterMode === 'SEASONS' ? 'bg-white text-black shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                        >
                                            Temporadas
                                        </button>
                                    </div>
                                </div>

                                {/* Conditional filters */}
                                {filterMode === 'MANUAL' ? (
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Estado</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => { setStatusFilter('ALL'); setIsFilterOpen(false); }}
                                                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase border-2 transition-all text-left ${statusFilter === 'ALL' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                                            >
                                                Todos
                                            </button>
                                            <button
                                                onClick={() => { setStatusFilter(statusFilter === 'APPROVED' ? 'ALL' : 'APPROVED'); setIsFilterOpen(false); }}
                                                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase border-2 transition-all flex items-center gap-1.5 ${statusFilter === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border-emerald-500' : 'bg-white text-emerald-700 border-emerald-100 hover:border-emerald-300'}`}
                                            >
                                                <CheckCircle className="w-3 h-3 shrink-0" />
                                                Aprob <span className="font-black">({approvedCount})</span>
                                            </button>
                                            <button
                                                onClick={() => { setStatusFilter(statusFilter === 'FINALIZED' ? 'ALL' : 'FINALIZED'); setIsFilterOpen(false); }}
                                                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase border-2 transition-all flex items-center gap-1.5 ${statusFilter === 'FINALIZED' ? 'bg-neutral-200 text-neutral-800 border-neutral-500' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'}`}
                                            >
                                                <Clock className="w-3 h-3 shrink-0" />
                                                Finz <span className="font-black">({finalizedCount})</span>
                                            </button>
                                            <button
                                                onClick={() => { setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING'); setIsFilterOpen(false); }}
                                                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase border-2 transition-all flex items-center gap-1.5 ${statusFilter === 'PENDING' ? 'bg-amber-100 text-amber-800 border-amber-500' : 'bg-white text-amber-700 border-amber-100 hover:border-amber-300'}`}
                                            >
                                                <AlertCircle className="w-3 h-3 shrink-0" />
                                                Pend <span className="font-black">({pendingCount})</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Temporada</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(['S1', 'S2', 'S3'] as const).map((s, i) => {
                                                const colors = [
                                                    { active: 'bg-blue-100 text-blue-900 border-blue-500', inactive: 'bg-white text-blue-800 border-blue-100 hover:border-blue-300' },
                                                    { active: 'bg-purple-100 text-purple-900 border-purple-500', inactive: 'bg-white text-purple-800 border-purple-100 hover:border-purple-300' },
                                                    { active: 'bg-pink-100 text-pink-900 border-pink-500', inactive: 'bg-white text-pink-800 border-pink-100 hover:border-pink-300' },
                                                ];
                                                return (
                                                    <button
                                                        key={s}
                                                        onClick={() => { setSeasonFilter(s); setIsFilterOpen(false); }}
                                                        className={`px-2 py-2 rounded-lg text-[10px] font-black uppercase border-2 transition-all flex items-center justify-center gap-1 ${seasonFilter === s ? colors[i].active : colors[i].inactive}`}
                                                    >
                                                        <Calendar className="w-3 h-3 shrink-0" />
                                                        {i + 1}ª T.
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Clear button */}
                                {hasActiveFilter && (
                                    <button
                                        onClick={() => { setFilterMode('MANUAL'); setStatusFilter('ALL'); setIsFilterOpen(false); }}
                                        className="w-full py-2 text-[10px] font-black uppercase text-slate-500 hover:text-red-600 border border-dashed border-slate-200 hover:border-red-200 rounded-lg transition-all"
                                    >
                                        Limpiar filtros
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Desktop Action Buttons */}
                <div className="hidden sm:flex items-center gap-2.5 shrink-0">
                    <button
                        onClick={onCreateGroup}
                        className="flex items-center gap-2 px-5 py-2.5 bg-black text-white border-2 border-black rounded-full text-xs font-black uppercase tracking-wider hover:bg-zinc-800 active:scale-95 transition-all whitespace-nowrap min-h-[40px] shadow-sm hover:shadow-md"
                    >
                        <Plus className="w-4 h-4 shrink-0" />
                        <span>CREAR GRUPO</span>
                    </button>

                    <button
                        onClick={onAddMember}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-black border-2 border-slate-200 rounded-full text-xs font-black uppercase tracking-wider hover:border-black active:scale-95 transition-all whitespace-nowrap min-h-[40px]"
                    >
                        <UserPlus className="w-4 h-4 shrink-0" />
                        <span>AGREGAR MIEMBRO</span>
                    </button>

                    <button
                        onClick={onDropoutInbox}
                        className={`relative flex items-center gap-2 px-5 py-2.5 border-2 rounded-full text-xs font-black uppercase tracking-wider active:scale-95 transition-all whitespace-nowrap min-h-[40px] ${pendingDropoutCount > 0
                            ? 'bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-400 hover:bg-orange-100'
                            : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-800'
                            }`}
                    >
                        <MailMinus className="w-4 h-4 shrink-0" />
                        <span>SOLICITUDES DE BAJA</span>
                        {pendingDropoutCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-600 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
                                {pendingDropoutCount > 9 ? '9+' : pendingDropoutCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GroupsAdminToolbar;

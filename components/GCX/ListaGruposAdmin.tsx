import React, { useState } from 'react';
import { MoreVertical, ClipboardCheck, RotateCcw, Inbox, Eye, Edit2, Trash2, Users, Calendar, CheckCircle, XCircle, AlertCircle, Clock, X, MapPin, Phone, Tag, Info, User, Shield, Lock, Unlock } from 'lucide-react';
import { Group, GroupCategory, GroupTag } from '../../types';
import NeoModal from '../ui/NeoModal';

interface GroupsAdminListProps {
    groups: Group[];
    categories: GroupCategory[];
    tags: GroupTag[];
    onReview: (group: Group) => void;
    onReopen: (groupId: string) => void;
    onViewRegistrations: (group: Group) => void;
    onEdit: (group: Group) => void;
    onDelete: (groupId: string) => void;
    onToggleCapacityLock: (group: Group) => void;
    openMenuGroupId: string | null;
    setOpenMenuGroupId: (id: string | null) => void;
    isLoading: boolean;
}

const GroupsAdminList: React.FC<GroupsAdminListProps> = ({
    groups,
    categories,
    tags,
    onReview,
    onReopen,
    onViewRegistrations,
    onEdit,
    onDelete,
    onToggleCapacityLock,
    openMenuGroupId,
    setOpenMenuGroupId,
    isLoading
}) => {
    const [detailGroup, setDetailGroup] = useState<Group | null>(null);

    const isGroupFinished = (group: Group) => {
        if (!group.endDate) return false;
        const today = new Date().toISOString().split('T')[0];
        return group.endDate < today;
    };

    const getCapacityCount = (group: Group) => {
        const cat = categories.find(c => c.id === group.categoryId);
        const isCouples = (cat?.name?.toLowerCase() === 'parejas' || group.tags?.some(tId => tags.find(t => t.id === tId)?.name?.toLowerCase() === 'parejas')) && group.targetGender === 'Mixto';
        const regCount = group.registrations?.length || 0;
        return isCouples ? regCount * 2 : regCount;
    };

    const getCapacityPercent = (group: Group) => {
        const count = getCapacityCount(group);
        return Math.min(100, Math.round((count / group.maxCapacity) * 100));
    };

    const getCapacityColor = (pct: number) => {
        if (pct >= 90) return 'bg-red-500';
        if (pct >= 65) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    const getStatusBadge = (status: string | undefined, group: Group) => {
        if (isGroupFinished(group)) {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-neutral-100 text-neutral-500 border border-neutral-200 tracking-wide">
                    <Clock className="w-2.5 h-2.5" /> Finalizado
                </span>
            );
        }
        switch (status) {
            case 'approved':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 tracking-wide">
                        <CheckCircle className="w-2.5 h-2.5" /> Activo
                    </span>
                );
            case 'pending':
            case undefined:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 tracking-wide">
                        <AlertCircle className="w-2.5 h-2.5" /> Pendiente
                    </span>
                );
            case 'rejected':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-red-50 text-red-600 border border-red-200 tracking-wide">
                        <XCircle className="w-2.5 h-2.5" /> Rechazado
                    </span>
                );
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
        );
    }

    if (groups.length === 0) {
        return (
            <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Users className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-bold text-sm uppercase tracking-wide">No hay grupos para mostrar con los filtros actuales</p>
            </div>
        );
    }

    const getStatusPriority = (group: Group): number => {
        if (isGroupFinished(group) || group.status === 'finished') return 3;
        if (group.status === 'rejected') return 2;
        if (group.status === 'approved') return 1;
        return 0; // pending o sin estado
    };

    const sortedGroups = [...groups].sort((a, b) => getStatusPriority(a) - getStatusPriority(b));

    return (
        <>
            {/* ───── GROUP DETAIL MODAL ───── */}
            <NeoModal
                isOpen={!!detailGroup}
                onClose={() => setDetailGroup(null)}
                title={detailGroup?.name || 'Detalles del grupo'}
                maxWidth="max-w-2xl"
            >
                {detailGroup && (
                    <div className="space-y-6">
                        {/* Badges Sub-header */}
                        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
                            {getStatusBadge(detailGroup.status, detailGroup)}
                            {detailGroup.categoryId && (
                                <span className="inline-block text-[10px] bg-slate-100 px-2 py-0.5 rounded font-bold uppercase tracking-wide text-slate-500 border border-slate-200">
                                    {categories.find(c => c.id === detailGroup.categoryId)?.name || 'General'}
                                </span>
                            )}
                        </div>

                        {/* Image */}
                        {detailGroup.imageUrl && (
                            <div className="rounded-xl overflow-hidden h-48 bg-slate-100">
                                <img src={detailGroup.imageUrl} alt={detailGroup.name} className="w-full h-full object-cover" />
                            </div>
                        )}

                        {/* Grid info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                            {/* Anfitrión */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><User className="w-3 h-3" /> Anfitrión</p>
                                <p className="text-sm font-black text-slate-800">{detailGroup.leaderName} {detailGroup.leaderSurname}</p>
                                {detailGroup.leaderPhone && (
                                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> {detailGroup.leaderPhone}</p>
                                )}
                            </div>

                            {/* Co-Anfitrión */}
                            {detailGroup.coHostFirstName && (
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><User className="w-3 h-3" /> Co-Anfitrión</p>
                                    <p className="text-sm font-black text-slate-800">{detailGroup.coHostFirstName} {detailGroup.coHostLastName}</p>
                                </div>
                            )}

                            {/* Horario */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Horario</p>
                                <p className="text-sm font-black text-slate-800">{detailGroup.meetingDay} · {detailGroup.meetingTime}</p>
                                {detailGroup.meetingType && <p className="text-xs text-slate-500 mt-0.5">{detailGroup.meetingType}</p>}
                            </div>

                            {/* Ubicación */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Ubicación</p>
                                <p className="text-sm font-black text-slate-800">{detailGroup.location || '—'}</p>
                            </div>

                            {/* Capacidad */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Users className="w-3 h-3" /> Capacidad</p>
                                <p className="text-sm font-black text-slate-800">{getCapacityCount(detailGroup)} / {detailGroup.maxCapacity} inscriptos</p>
                                <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${getCapacityColor(getCapacityPercent(detailGroup))}`}
                                        style={{ width: `${getCapacityPercent(detailGroup)}%` }}
                                    />
                                </div>
                            </div>

                            {/* Rango de edad / Género */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Shield className="w-3 h-3" /> Perfil</p>
                                {detailGroup.targetGender && <p className="text-sm font-black text-slate-800">{detailGroup.targetGender}</p>}
                                {(detailGroup.minAge || detailGroup.maxAge) && (
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Edad: {detailGroup.minAge ?? '—'} – {detailGroup.maxAge ?? '—'} años
                                    </p>
                                )}
                                {!detailGroup.targetGender && !detailGroup.minAge && !detailGroup.maxAge && <p className="text-sm text-slate-400">Sin restricciones</p>}
                            </div>

                            {/* Fechas */}
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Fechas</p>
                                <p className="text-xs text-slate-600"><span className="font-bold">Inicio:</span> {detailGroup.startDate || '—'}</p>
                                {detailGroup.endDate && <p className="text-xs text-slate-600 mt-0.5"><span className="font-bold">Fin:</span> {detailGroup.endDate}</p>}
                            </div>

                            {/* Tags */}
                            {detailGroup.tags && detailGroup.tags.length > 0 && (
                                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Tag className="w-3 h-3" /> Etiquetas</p>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                        {detailGroup.tags.map(tId => {
                                            const tag = tags.find(t => t.id === tId);
                                            return tag ? (
                                                <span key={tId} className="text-[10px] font-bold uppercase bg-black text-white px-2 py-0.5 rounded-full">{tag.name}</span>
                                            ) : null;
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Descripción */}
                        {detailGroup.description && (
                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5"><Info className="w-3 h-3" /> Descripción</p>
                                <p className="text-sm text-slate-700 leading-relaxed">{detailGroup.description}</p>
                            </div>
                        )}

                        {/* Nota admin */}
                        {detailGroup.adminNote && (
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-1.5"><AlertCircle className="w-3 h-3" /> Nota del administrador</p>
                                <p className="text-sm text-amber-800 leading-relaxed">{detailGroup.adminNote}</p>
                            </div>
                        )}
                        {/* Footer actions */}
                        <div className="pt-4 mt-2 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                onClick={() => { onViewRegistrations(detailGroup); setDetailGroup(null); }}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                            >
                                <Inbox className="w-3.5 h-3.5" /> Ver inscriptos
                            </button>
                            <button
                                onClick={() => { onEdit(detailGroup); setDetailGroup(null); }}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase text-white bg-black hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <Edit2 className="w-3.5 h-3.5" /> Editar grupo
                            </button>
                        </div>
                    </div>
                )}
            </NeoModal>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
                {sortedGroups.map(group => {
                    const pct = getCapacityPercent(group);
                    return (
                        <div key={group.id} className={`bg-white border rounded-xl p-4 shadow-sm relative transition-all ${group.status === 'pending' || !group.status ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'}`}>
                            <div className="flex items-start justify-between mb-3">
                                {getStatusBadge(group.status, group)}
                                <div className="relative flex items-center gap-1">
                                    <button
                                        onClick={() => setDetailGroup(group)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 transition-colors"
                                        title="Ver detalles"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setOpenMenuGroupId(openMenuGroupId === group.id ? null : group.id)}
                                        className={`p-1.5 rounded-lg transition-colors ${openMenuGroupId === group.id ? 'bg-black text-white' : 'text-slate-400 hover:text-black hover:bg-slate-100'}`}
                                        aria-label="Acciones"
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                    {openMenuGroupId === group.id && (
                                        <>
                                            <div className="fixed inset-0 z-40 bg-black/5" onClick={() => setOpenMenuGroupId(null)} />
                                            <div className="absolute top-full right-0 mt-2 z-50 w-52 bg-white border-2 border-slate-900 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] py-1 animate-in fade-in zoom-in-95 duration-150">
                                                {(group.status === 'pending' || !group.status) && (
                                                    <button onClick={() => { onReview(group); setOpenMenuGroupId(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold uppercase text-amber-700 hover:bg-amber-50 transition-colors text-left border-b border-slate-100">
                                                        <ClipboardCheck className="w-4 h-4 shrink-0" /> REVISAR
                                                    </button>
                                                )}
                                                {(group.status === 'rejected' || isGroupFinished(group)) && (
                                                    <button onClick={() => { onReopen(group.id); setOpenMenuGroupId(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 transition-colors text-left border-b border-slate-100">
                                                        <RotateCcw className="w-4 h-4 shrink-0" /> RE-ABRIR
                                                    </button>
                                                )}
                                                <button onClick={() => { onViewRegistrations(group); setOpenMenuGroupId(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold uppercase text-indigo-700 hover:bg-indigo-50 transition-colors text-left border-b border-slate-100">
                                                    <Inbox className="w-4 h-4 shrink-0" /> VER INSCRIPTOS
                                                </button>
                                                <button onClick={() => { onToggleCapacityLock(group); setOpenMenuGroupId(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold uppercase text-slate-700 hover:bg-slate-50 transition-colors text-left border-b border-slate-100">
                                                    {group.capacityLocked ? <Lock className="w-4 h-4 shrink-0" /> : <Unlock className="w-4 h-4 shrink-0" />}
                                                    {group.capacityLocked ? 'DESBLOQUEAR CUPOS' : 'BLOQUEAR CUPOS'}
                                                </button>
                                                <button onClick={() => { onEdit(group); setOpenMenuGroupId(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold uppercase text-slate-700 hover:bg-slate-50 transition-colors text-left border-b border-slate-100">
                                                    <Edit2 className="w-4 h-4 shrink-0" /> EDITAR
                                                </button>
                                                <button onClick={() => { onDelete(group.id); setOpenMenuGroupId(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold uppercase text-red-700 hover:bg-red-50 transition-colors text-left">
                                                    <Trash2 className="w-4 h-4 shrink-0" /> BORRAR
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <h4 className="font-black text-slate-900 text-base uppercase leading-tight">{group.name}</h4>
                            <span className="inline-block mt-1 text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase font-bold tracking-wide border border-slate-200">
                                {categories.find(c => c.id === group.categoryId)?.name || 'General'}
                            </span>

                            <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[9px] uppercase font-black text-slate-400 tracking-wider mb-0.5">Anfitrión</p>
                                    <p className="text-xs font-bold text-slate-700 truncate">{group.leaderName} {group.leaderSurname}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] uppercase font-black text-slate-400 tracking-wider mb-0.5">Horario</p>
                                    <div className="flex items-center gap-1 text-xs font-bold text-slate-700">
                                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                        <span>{group.meetingDay} {group.meetingTime}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-3">
                                <div className="flex justify-between text-[9px] uppercase font-black mb-1">
                                    <span className="text-slate-400">Capacidad</span>
                                    <span className="text-slate-600">{getCapacityCount(group)}/{group.maxCapacity} · {pct}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-500 ${getCapacityColor(pct)}`} style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        </div>
                    );
                })
                }
            </div >

            {/* Desktop Table View */}
            < div className="hidden md:block" >
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-36">Estado</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-72">Grupo</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap w-44">Anfitrión</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap w-40">Horario</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 w-48 text-center">Capacidad</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right w-44">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedGroups.map((group) => {
                                const pct = getCapacityPercent(group);
                                const isPending = group.status === 'pending' || !group.status;
                                return (
                                    <tr
                                        key={group.id}
                                        className={`transition-colors hover:bg-slate-50/80 ${isPending ? 'bg-amber-50/30' : 'bg-white'}`}
                                    >
                                        {/* Estado */}
                                        <td className="px-4 py-3 align-middle">
                                            {getStatusBadge(group.status, group)}
                                        </td>

                                        {/* Grupo */}
                                        <td className="px-4 py-3 align-middle">
                                            <p className="font-black text-sm text-slate-900 uppercase leading-tight">{group.name}</p>
                                            <span className="inline-block mt-0.5 text-[10px] text-slate-400 font-bold uppercase tracking-wide bg-slate-100 px-1.5 py-px rounded border border-slate-200">
                                                {categories.find(c => c.id === group.categoryId)?.name || 'General'}
                                            </span>
                                        </td>

                                        {/* Anfitrión */}
                                        <td className="px-4 py-3 align-middle">
                                            <p className="text-sm font-bold text-slate-700 whitespace-nowrap">{group.leaderName} {group.leaderSurname}</p>
                                            {group.coHostFirstName && (
                                                <p className="text-[11px] text-slate-400 font-medium mt-0.5 whitespace-nowrap">
                                                    Co: {group.coHostFirstName} {group.coHostLastName}
                                                </p>
                                            )}
                                        </td>

                                        {/* Horario */}
                                        <td className="px-4 py-3 align-middle">
                                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600 whitespace-nowrap">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                {group.meetingDay} {group.meetingTime}
                                            </div>
                                        </td>

                                        {/* Capacidad */}
                                        <td className="px-4 py-3 align-middle">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[100px]">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${getCapacityColor(pct)}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-black text-slate-600 whitespace-nowrap tabular-nums">
                                                    {getCapacityCount(group)}/{group.maxCapacity}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Acciones */}
                                        <td className="px-4 py-3 align-middle text-right">
                                            <div className="flex justify-end items-center gap-1">
                                                {isPending && (
                                                    <button
                                                        onClick={() => onReview(group)}
                                                        className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200"
                                                        title="Revisar"
                                                    >
                                                        <ClipboardCheck className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                {(group.status === 'rejected' || isGroupFinished(group)) && (
                                                    <button
                                                        onClick={() => onReopen(group.id)}
                                                        className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                                                        title="Re-abrir"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setDetailGroup(group)}
                                                    className="p-1.5 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                                                    title="Ver detalles"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => onViewRegistrations(group)}
                                                    className="p-1.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                                                    title="Ver inscriptos"
                                                >
                                                    <Inbox className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => onToggleCapacityLock(group)}
                                                    className={`p-1.5 rounded-lg transition-colors border ${group.capacityLocked ? 'text-white bg-neutral-800 border-neutral-800 hover:bg-neutral-700' : 'text-slate-600 bg-slate-50 hover:bg-slate-100 border-slate-200'}`}
                                                    title={group.capacityLocked ? 'Desbloquear cupos' : 'Bloquear cupos (mostrar como LLENO)'}
                                                >
                                                    {group.capacityLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                                </button>
                                                <button
                                                    onClick={() => onEdit(group)}
                                                    className="p-1.5 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => onDelete(group.id)}
                                                    className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                                                    title="Eliminar"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div >
        </>
    );
};

export default GroupsAdminList;

import React from 'react';
import { MoreVertical, ClipboardCheck, RotateCcw, Eye, Edit2, Trash2, Users, Calendar, CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';
import { Group, GroupCategory, GroupTag } from '../../types';

interface GroupsAdminListProps {
    groups: Group[];
    categories: GroupCategory[];
    tags: GroupTag[];
    onReview: (group: Group) => void;
    onReopen: (groupId: string) => void;
    onViewRegistrations: (group: Group) => void;
    onEdit: (group: Group) => void;
    onDelete: (groupId: string) => void;
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
    openMenuGroupId,
    setOpenMenuGroupId,
    isLoading
}) => {

    const isGroupFinished = (group: Group) => {
        if (!group.endDate) return false;
        const today = new Date().toISOString().split('T')[0];
        return group.endDate < today;
    };

    const getStatusBadge = (status: string | undefined, group: Group) => {
        if (isGroupFinished(group)) {
            return (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-neutral-100 text-neutral-600 border border-neutral-200">
                    <Clock className="w-3 h-3" /> Finalizado
                </span>
            );
        }

        switch (status) {
            case 'approved':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <CheckCircle className="w-3 h-3" /> Activo
                    </span>
                );
            case 'pending':
            case undefined:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-700 border border-amber-200">
                        <AlertCircle className="w-3 h-3" /> Pendiente
                    </span>
                );
            case 'rejected':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-red-100 text-red-700 border border-red-200">
                        <XCircle className="w-3 h-3" /> Rechazado
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

    return (
        <div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {groups.map(group => (
                    <div key={group.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative group-card-hover transition-all">
                        {/* Status Badge - Top Left */}
                        <div className="mb-3">
                            {getStatusBadge(group.status, group)}
                        </div>

                        {/* Kebab Menu Button - Top Right */}
                        <div className="absolute top-4 right-4">
                            <button
                                onClick={() => setOpenMenuGroupId(openMenuGroupId === group.id ? null : group.id)}
                                className={`p-2 rounded-lg transition-colors ${openMenuGroupId === group.id ? 'bg-black text-white' : 'text-slate-400 hover:text-black hover:bg-slate-100'}`}
                                aria-label="Acciones"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>

                            {/* Dropdown Menu */}
                            {openMenuGroupId === group.id && (
                                <>
                                    <div className="fixed inset-0 z-40 bg-black/5" onClick={() => setOpenMenuGroupId(null)} />
                                    <div className="absolute top-full right-0 mt-2 z-50 w-56 bg-white border-2 border-slate-900 rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] py-1 animate-in fade-in zoom-in-95 duration-150">
                                        {(group.status === 'pending' || !group.status) && (
                                            <button
                                                onClick={() => { onReview(group); setOpenMenuGroupId(null); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase text-amber-700 hover:bg-amber-50 transition-colors text-left border-b border-slate-100"
                                            >
                                                <ClipboardCheck className="w-4 h-4 shrink-0" />
                                                REVISAR
                                            </button>
                                        )}
                                        {(group.status === 'rejected' || isGroupFinished(group)) && (
                                            <button
                                                onClick={() => { onReopen(group.id); setOpenMenuGroupId(null); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase text-blue-700 hover:bg-blue-50 transition-colors text-left border-b border-slate-100"
                                            >
                                                <RotateCcw className="w-4 h-4 shrink-0" />
                                                RE-ABRIR
                                            </button>
                                        )}
                                        <button
                                            onClick={() => { onViewRegistrations(group); setOpenMenuGroupId(null); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase text-indigo-700 hover:bg-indigo-50 transition-colors text-left border-b border-slate-100"
                                        >
                                            <Eye className="w-4 h-4 shrink-0" />
                                            VER INSCRIPTOS
                                        </button>
                                        <button
                                            onClick={() => { onEdit(group); setOpenMenuGroupId(null); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase text-slate-700 hover:bg-slate-50 transition-colors text-left border-b border-slate-100"
                                        >
                                            <Edit2 className="w-4 h-4 shrink-0" />
                                            EDITAR
                                        </button>
                                        <button
                                            onClick={() => { onDelete(group.id); setOpenMenuGroupId(null); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase text-red-700 hover:bg-red-50 transition-colors text-left"
                                        >
                                            <Trash2 className="w-4 h-4 shrink-0" />
                                            BORRAR
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Content */}
                        <div className="pr-10">
                            <h4 className="font-bold text-slate-900 text-lg leading-tight mb-1">{group.name}</h4>
                            <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase font-bold tracking-wide">
                                {categories.find(c => c.id === group.categoryId)?.name || 'General'}
                            </span>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Anfitrión</span>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="truncate">{group.leaderName} {group.leaderSurname}</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400">Horario</span>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{group.meetingDay} {group.meetingTime}</span>
                                </div>
                            </div>
                        </div>

                        {/* Capacity Bar */}
                        <div className="mt-4">
                            <div className="flex justify-between text-[10px] uppercase font-bold mb-1.5">
                                <span className="text-slate-400">Capacidad</span>
                                <span className="text-slate-700">
                                    {(() => {
                                        const cat = categories.find(c => c.id === group.categoryId);
                                        const isCouples = (cat?.name?.toLowerCase() === 'parejas' || group.tags?.some(tId => tags.find(t => t.id === tId)?.name?.toLowerCase() === 'parejas')) && group.targetGender === 'Mixto';
                                        const regCount = group.registrations?.length || 0;
                                        return isCouples ? regCount * 2 : regCount;
                                    })()}/{group.maxCapacity}
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-black rounded-full transition-all duration-500"
                                    style={{
                                        width: `${Math.min(100, (((group.registrations?.length || 0) * (
                                            (categories.find(c => c.id === group.categoryId)?.name?.toLowerCase() === 'parejas' && group.targetGender === 'Mixto') ? 2 : 1
                                        )) / group.maxCapacity) * 100)}%`
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block border border-slate-200 overflow-hidden bg-white shadow-sm rounded-xl">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                        <tr>
                            <th className="p-4 pl-6 w-32">Estado</th>
                            <th className="p-4 w-1/4">Grupo</th>
                            <th className="p-4">Anfitrión</th>
                            <th className="p-4">Horario</th>
                            <th className="p-4">Fechas</th>
                            <th className="p-4">Capacidad</th>
                            <th className="p-4 w-1/4">Descripción</th>
                            <th className="p-4 pr-6 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {groups.map((group) => (
                            <tr key={group.id} className={`hover:bg-slate-50 transition-colors group ${group.status === 'pending' || !group.status ? 'bg-yellow-50/30' : ''}`}>
                                <td className="p-4 pl-6 align-top pt-5">
                                    {getStatusBadge(group.status, group)}
                                </td>
                                <td className="p-4 align-top pt-5">
                                    <p className="font-bold text-sm text-slate-900 uppercase leading-snug">{group.name}</p>
                                    <span className="inline-block mt-1 text-[10px] text-slate-500 font-bold uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                        {categories.find(c => c.id === group.categoryId)?.name || 'General'}
                                    </span>
                                </td>
                                <td className="p-4 align-top pt-5">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-700">{group.leaderName} {group.leaderSurname}</span>
                                        {group.coHostFirstName && (
                                            <span className="text-[11px] text-slate-400 mt-0.5 font-medium">
                                                Co: {group.coHostFirstName} {group.coHostLastName}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 align-top pt-5">
                                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                        {group.meetingDay} {group.meetingTime}
                                    </div>
                                </td>
                                <td className="p-4 align-top pt-5">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[10px] uppercase font-bold text-slate-400">Inicio</span>
                                        <span className="text-xs font-medium text-slate-700">
                                            {group.startDate ? new Date(group.startDate + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '-'}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4 align-top pt-5">
                                    <div className="flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-sm font-bold text-slate-700">
                                            {(() => {
                                                const cat = categories.find(c => c.id === group.categoryId);
                                                const isCouples = (cat?.name?.toLowerCase() === 'parejas' || group.tags?.some(tId => tags.find(t => t.id === tId)?.name?.toLowerCase() === 'parejas')) && group.targetGender === 'Mixto';
                                                const regCount = group.registrations?.length || 0;
                                                return isCouples ? regCount * 2 : regCount;
                                            })()}/{group.maxCapacity}
                                        </span>
                                    </div>
                                </td>
                                <td className="p-4 align-top pt-5">
                                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                        {group.description || '-'}
                                    </p>
                                </td>
                                <td className="p-4 pr-6 align-top pt-5 text-right">
                                    <div className="flex justify-end gap-1">
                                        {(group.status === 'pending' || !group.status) && (
                                            <button onClick={() => onReview(group)} className="p-2 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200" title="Revisar">
                                                <ClipboardCheck className="w-4 h-4" />
                                            </button>
                                        )}
                                        {(group.status === 'rejected' || isGroupFinished(group)) && (
                                            <button onClick={() => onReopen(group.id)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200" title="Re-abrir">
                                                <RotateCcw className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button onClick={() => onViewRegistrations(group)} className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200" title="Ver inscriptos">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => onEdit(group)} className="p-2 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200" title="Editar">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => onDelete(group.id)} className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200" title="Eliminar">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default GroupsAdminList;

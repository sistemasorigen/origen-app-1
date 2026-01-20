import React, { useState } from 'react';
import { Group, GroupTag, GroupCategory } from '../../types';
import {
    X,
    MapPin,
    Calendar,
    Clock,
    Users,
    Phone,
    User,
    Tag,
    CheckCircle,
    XCircle,
    Image as ImageIcon,
    UserCheck,
    Target,
    MessageSquare
} from 'lucide-react';
import NeoModal from '../NeoModal';

interface AdminGroupReviewModalProps {
    group: Group;
    categories: GroupCategory[];
    tags: GroupTag[];
    onClose: () => void;
    onApprove: (groupId: string, note?: string) => void;
    onReject: (groupId: string, note?: string) => void;
    isLoading?: boolean;
}

const AdminGroupReviewModal: React.FC<AdminGroupReviewModalProps> = ({
    group,
    categories,
    tags,
    onClose,
    onApprove,
    onReject,
    isLoading = false
}) => {
    const [adminNote, setAdminNote] = useState('');

    const category = categories.find(c => c.id === group.categoryId);
    const groupTags = (group.tags || []).map(tagId => tags.find(t => t.id === tagId)).filter(Boolean);

    const getStatusBadge = () => {
        switch (group.status) {
            case 'approved':
                return <span className="px-3 py-1 text-xs font-bold uppercase bg-green-100 text-green-700 rounded-full">Aprobado</span>;
            case 'rejected':
                return <span className="px-3 py-1 text-xs font-bold uppercase bg-red-100 text-red-700 rounded-full">Rechazado</span>;
            default:
                return <span className="px-3 py-1 text-xs font-bold uppercase bg-yellow-100 text-yellow-700 rounded-full">Pendiente</span>;
        }
    };

    return (
        <NeoModal
            isOpen={true}
            onClose={onClose}
            title="Revisar Grupo"
        >
            <div className="flex flex-col h-full">
                {/* Status Badge moved to top of content */}
                <div className="mb-4 flex items-center justify-between">
                    <p className="text-xs md:text-sm text-slate-500 truncate font-medium">{group.name}</p>
                    {getStatusBadge()}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto -mx-1 px-1">

                    {/* Cover Image */}
                    {group.imageUrl && (
                        <div className="mb-6 rounded-xl overflow-hidden aspect-video relative">
                            <img src={group.imageUrl} alt="Portada del grupo" className="w-full h-full object-cover" />
                            <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg flex items-center gap-1">
                                <ImageIcon className="w-3 h-3 text-white" />
                                <span className="text-[10px] font-bold uppercase text-white">Portada</span>
                            </div>
                        </div>
                    )}

                    {/* Group Name & Category */}
                    <div className="mb-6">
                        <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">
                            {group.name}
                        </h4>
                        {category && (
                            <span
                                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold uppercase rounded-full"
                                style={{ backgroundColor: category.color + '20', color: category.color }}
                            >
                                {category.name}
                            </span>
                        )}
                    </div>

                    {/* Description */}
                    {group.description && (
                        <div className="mb-6">
                            <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 italic">
                                "{group.description}"
                            </p>
                        </div>
                    )}

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        {/* Leader */}
                        <div className="p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <User className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-bold uppercase text-slate-400">Anfitrión</span>
                            </div>
                            <p className="font-bold text-slate-900">{group.leaderName} {group.leaderSurname}</p>
                            {group.leaderPhone && (
                                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                    <Phone className="w-3 h-3" /> {group.leaderPhone}
                                </p>
                            )}
                        </div>

                        {/* Co-Host */}
                        {(group.coHostFirstName || group.coHostLastName) && (
                            <div className="p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-2 mb-1">
                                    <UserCheck className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs font-bold uppercase text-slate-400">Co-Anfitrión</span>
                                </div>
                                <p className="font-bold text-slate-900">{group.coHostFirstName} {group.coHostLastName}</p>
                            </div>
                        )}

                        {/* Schedule */}
                        <div className="p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <Clock className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-bold uppercase text-slate-400">Horario</span>
                            </div>
                            <p className="font-bold text-slate-900">{group.meetingDay}</p>
                            <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">
                                {group.meetingTime} hs
                            </p>
                        </div>

                        {/* Dates */}
                        {(group.startDate || group.endDate) && (
                            <div className="p-4 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-2 mb-1">
                                    <Calendar className="w-4 h-4 text-slate-400" />
                                    <span className="text-xs font-bold uppercase text-slate-400">Fechas</span>
                                </div>
                                {group.startDate && (
                                    <div className="flex flex-col">
                                        <span className="text-[10px] uppercase text-slate-400 font-bold">Inicia:</span>
                                        <span className="font-bold text-slate-900 text-sm">{new Date(group.startDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}</span>
                                    </div>
                                )}
                                {group.endDate && (
                                    <div className="flex flex-col mt-1">
                                        <span className="text-[10px] uppercase text-slate-400 font-bold">Finaliza:</span>
                                        <span className="font-bold text-slate-900 text-sm">{new Date(group.endDate).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Location */}
                        <div className="p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <MapPin className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-bold uppercase text-slate-400">Ubicación</span>
                            </div>
                            <p className="font-bold text-slate-900 text-sm line-clamp-2">{group.location || 'No especificada'}</p>
                        </div>

                        {/* Capacity */}
                        <div className="p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <Users className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-bold uppercase text-slate-400">Capacidad</span>
                            </div>
                            <p className="font-bold text-slate-900">{(group.registrations?.filter((r: any) => r.status === 'approved' || r.status === 'APPROVED').length) || 0} / {group.maxCapacity}</p>
                        </div>

                        {/* Target Demographics */}
                        <div className="p-4 bg-slate-50 rounded-xl">
                            <div className="flex items-center gap-2 mb-1">
                                <Target className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-bold uppercase text-slate-400">Público</span>
                            </div>
                            <p className="font-bold text-slate-900">{group.targetGender || 'Mixto'}</p>

                            <div className="mt-1 pt-1 border-t border-slate-200">
                                <span className="text-[10px] uppercase text-slate-400 font-bold block">Edad:</span>
                                <span className="text-sm font-bold text-slate-700">
                                    {(group.minAge && group.minAge > 0) ? `${group.minAge}` : '0'}
                                    {' - '}
                                    {(group.maxAge && group.maxAge < 100) ? `${group.maxAge}` : 'Sin límite'} años
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Tags */}
                    {groupTags.length > 0 && (
                        <div className="mb-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Tag className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-bold uppercase text-slate-400">Etiquetas</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {groupTags.map(tag => tag && (
                                    <span
                                        key={tag.id}
                                        className="px-3 py-1 text-xs font-bold uppercase bg-slate-100 text-slate-600 rounded-full"
                                    >
                                        #{tag.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Admin Note Input */}
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-bold uppercase text-slate-400">Nota para el Anfitrión (Opcional)</span>
                        </div>
                        <textarea
                            value={adminNote}
                            onChange={(e) => setAdminNote(e.target.value)}
                            placeholder="Escribe una nota que verá el anfitrión al revisar el estado de su grupo..."
                            className="w-full p-4 border-2 border-slate-200 rounded-xl text-sm focus:border-black outline-none transition-colors resize-none h-24"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 mt-2 shrink-0">
                    <div className="flex gap-4">
                        <button
                            onClick={() => onReject(group.id, adminNote || undefined)}
                            disabled={isLoading}
                            className="flex-1 py-4 px-6 bg-red-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <XCircle className="w-5 h-5" />
                            Rechazar
                        </button>
                        <button
                            onClick={() => onApprove(group.id, adminNote || undefined)}
                            disabled={isLoading}
                            className="flex-1 py-4 px-6 bg-green-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Aprobar
                        </button>
                    </div>
                </div>
            </div>
        </NeoModal>
    );
};

export default AdminGroupReviewModal;

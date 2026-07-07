import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Group, GroupTag, GroupCategory } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import { supabase } from '../../services/supabaseClient';
import {
    MapPin, Calendar, Clock, Users, Phone, User, Tag,
    CheckCircle, XCircle, Image as ImageIcon, UserCheck, Target,
    MessageSquare, Loader2, AlertCircle
} from 'lucide-react';

const DetalleGrupoAdminContent: React.FC = () => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const { showToast } = useAdminGCXToast();

    const [group, setGroup] = useState<Group | null>(null);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [loading, setLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [adminNote, setAdminNote] = useState('');
    const [coHostDetails, setCoHostDetails] = useState<{ name: string; email: string } | null>(null);
    const [descripcionExpandida, setDescripcionExpandida] = useState(false);

    const fetchGroup = useCallback(async () => {
        if (!groupId) return;
        setLoading(true);
        try {
            const [allGroups, cats, tgs] = await Promise.all([
                supabaseService.getGroupsForAdmin(),
                supabaseService.getGroupCategories(),
                supabaseService.getGroupTags(),
            ]);
            const found = allGroups.find(g => g.id === groupId);
            if (!found) {
                navigate('/admingcx/gestion-de-grupos', { replace: true });
                return;
            }
            setGroup(found);
            setCategories(cats);
            setTags(tgs);
        } finally {
            setLoading(false);
        }
    }, [groupId, navigate]);

    useEffect(() => { fetchGroup(); }, [fetchGroup]);

    useEffect(() => {
        if (group?.co_host_id && !group.coHostFirstName && !group.coHostLastName) {
            supabase
                .from('users')
                .select('name, email')
                .eq('id', group.co_host_id)
                .single()
                .then(({ data, error }) => {
                    if (!error && data) setCoHostDetails(data);
                });
        }
    }, [group?.co_host_id, group?.coHostFirstName, group?.coHostLastName]);

    const handleApprove = async () => {
        if (!group) return;
        setIsActionLoading(true);
        try {
            const success = await supabaseService.updateGroupStatus(group.id, 'approved', adminNote || undefined);
            if (success) {
                showToast('Grupo aprobado exitosamente', 'success');
                navigate('/admingcx/gestion-de-grupos');
            } else {
                showToast('Error al aprobar el grupo', 'error');
            }
        } catch (error) {
            console.error('Error approving group:', error);
            showToast('Error al aprobar el grupo', 'error');
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!group) return;
        setIsActionLoading(true);
        try {
            const success = await supabaseService.updateGroupStatus(group.id, 'rejected', adminNote || undefined);
            if (success) {
                showToast('Grupo rechazado', 'success');
                navigate('/admingcx/gestion-de-grupos');
            } else {
                showToast('Error al rechazar el grupo', 'error');
            }
        } catch (error) {
            console.error('Error rejecting group:', error);
            showToast('Error al rechazar el grupo', 'error');
        } finally {
            setIsActionLoading(false);
        }
    };

    const isPending = !!group && (group.status === 'pending' || !group.status);

    if (loading) return (
        <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
    );

    if (!group) return null;

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

    const getCapacityCount = (g: Group) => {
        const cat = categories.find(c => c.id === g.categoryId);
        const isCouples = (cat?.name?.toLowerCase() === 'parejas' || g.tags?.some(tId => tags.find(t => t.id === tId)?.name?.toLowerCase() === 'parejas')) && g.targetGender === 'Mixto';
        const regCount = g.registrations?.length || 0;
        return isCouples ? regCount * 2 : regCount;
    };

    const getCapacityPercent = (g: Group) => {
        const count = getCapacityCount(g);
        return Math.min(100, Math.round((count / g.maxCapacity) * 100));
    };

    const getCapacityColor = (pct: number) => {
        if (pct >= 90) return 'bg-red-500';
        if (pct >= 65) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    return (
        <div className="max-w-3xl">
            <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-slate-500 truncate font-medium">{group.name}</p>
                {getStatusBadge()}
            </div>

            {group.imageUrl && (
                <div className="mb-6 rounded-xl overflow-hidden aspect-video relative">
                    <img src={group.imageUrl} alt="Portada del grupo" className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-lg flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-white" />
                        <span className="text-[10px] font-bold uppercase text-white">Portada</span>
                    </div>
                </div>
            )}

            <div className="mb-6">
                <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">
                    {group.name}
                </h1>
                {category && (
                    <span
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold uppercase rounded-full"
                        style={{ backgroundColor: category.color + '20', color: category.color }}
                    >
                        {category.name}
                    </span>
                )}
            </div>

            {group.description && (() => {
                const canToggle = group.description.length > 140;
                return (
                    <div
                        className={`mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 ${canToggle ? 'cursor-pointer select-none touch-manipulation' : ''}`}
                        onClick={canToggle ? () => setDescripcionExpandida(prev => !prev) : undefined}
                        role={canToggle ? 'button' : undefined}
                        tabIndex={canToggle ? 0 : undefined}
                        aria-expanded={canToggle ? descripcionExpandida : undefined}
                        onKeyDown={canToggle ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDescripcionExpandida(prev => !prev); } } : undefined}
                    >
                        <p
                            className={`text-sm text-slate-600 leading-relaxed italic break-words ${
                                descripcionExpandida ? '' : 'line-clamp-3'
                            }`}
                        >
                            "{group.description}"
                        </p>
                        {canToggle && (
                            <span className="mt-1.5 inline-block text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">
                                {descripcionExpandida ? 'Ver menos' : 'Ver más'}
                            </span>
                        )}
                    </div>
                );
            })()}

            <div className="grid grid-cols-2 gap-4 mb-6">
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

                {(group.coHostFirstName || group.coHostLastName || group.co_host_id) && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-1">
                            <UserCheck className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-bold uppercase text-slate-400">Co-Anfitrión</span>
                        </div>
                        <p className="font-bold text-slate-900">
                            {group.coHostFirstName || group.coHostLastName
                                ? `${group.coHostFirstName} ${group.coHostLastName}`
                                : coHostDetails ? coHostDetails.name : 'Cargando...'}
                        </p>
                    </div>
                )}

                <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold uppercase text-slate-400">Horario</span>
                    </div>
                    <p className="font-bold text-slate-900">{group.meetingDay}</p>
                    <p className="text-sm text-slate-600 flex items-center gap-1 mt-1">{group.meetingTime} hs</p>
                </div>

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

                <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold uppercase text-slate-400">Ubicación</span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm line-clamp-2">{group.location || 'No especificada'}</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl">
                    <div className="flex items-center gap-2 mb-1">
                        <Users className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold uppercase text-slate-400">Capacidad</span>
                    </div>
                    <p className="font-bold text-slate-900">{(group.registrations?.filter((r: any) => r.status === 'approved' || r.status === 'APPROVED').length) || 0} / {group.maxCapacity}</p>
                </div>

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

            {groupTags.length > 0 && (
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        <Tag className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold uppercase text-slate-400">Etiquetas</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {groupTags.map(tag => tag && (
                            <span key={tag.id} className="px-3 py-1 text-xs font-bold uppercase bg-slate-100 text-slate-600 rounded-full">
                                #{tag.name}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {isPending ? (
                <>
                    <div className="mb-8">
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

                    <div className="pt-4 border-t border-slate-100 flex gap-4">
                        <button
                            onClick={handleReject}
                            disabled={isActionLoading}
                            className="flex-1 py-4 px-6 bg-red-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <XCircle className="w-5 h-5" />
                            Rechazar
                        </button>
                        <button
                            onClick={handleApprove}
                            disabled={isActionLoading}
                            className="flex-1 py-4 px-6 bg-green-600 text-white font-black uppercase tracking-widest rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <CheckCircle className="w-5 h-5" />
                            Aprobar
                        </button>
                    </div>
                </>
            ) : (
                <>
                    {/* Capacidad con barra visual — solo tiene sentido
                        para grupos ya procesados */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                            <Users className="w-3 h-3" /> Capacidad
                        </p>
                        <p className="text-sm font-black text-slate-800">
                            {getCapacityCount(group)} / {group.maxCapacity} inscriptos
                        </p>
                        <div className="mt-2 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${getCapacityColor(getCapacityPercent(group))}`}
                                style={{ width: `${getCapacityPercent(group)}%` }}
                            />
                        </div>
                    </div>

                    {group.adminNote && (
                        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 mb-6">
                            <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2 flex items-center gap-1.5">
                                <AlertCircle className="w-3 h-3" /> Nota del administrador
                            </p>
                            <p className="text-sm text-amber-800 leading-relaxed">{group.adminNote}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const DetalleGrupoAdmin: React.FC = () => (
    <AdminGCXLayout
        title="Detalle de Grupo"
        backTo="/admingcx/gestion-de-grupos"
        backLabel="Volver a Gestión de Grupos"
    >
        <DetalleGrupoAdminContent />
    </AdminGCXLayout>
);

export default DetalleGrupoAdmin;

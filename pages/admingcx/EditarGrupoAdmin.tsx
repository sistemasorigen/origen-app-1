import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Group, User, GroupTag } from '../../types';
import { supabaseService, updateGroupDirect } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import { Search, Calendar, Users, Loader2, X } from 'lucide-react';
import ImageUpload from '../../components/media/SubidaImagen';

const formatDateForInput = (isoDateString?: string) => {
    if (!isoDateString) return '';
    if (isoDateString.includes('T')) return isoDateString.split('T')[0];
    return isoDateString;
};

const formatDateForDisplay = (isoDateString?: string) => {
    if (!isoDateString) return '';
    const dateStr = isoDateString.includes('T') ? isoDateString.split('T')[0] : isoDateString;
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
};

const EditarGrupoAdminContent: React.FC = () => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const { showToast } = useAdminGCXToast();

    const [editingGroup, setEditingGroup] = useState<Partial<Group>>({});
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [editPotentialHosts, setEditPotentialHosts] = useState<User[]>([]);
    const [editHostSearchTerm, setEditHostSearchTerm] = useState('');
    const [isEditHostSelectOpen, setIsEditHostSelectOpen] = useState(false);

    const [editPotentialCoHosts, setEditPotentialCoHosts] = useState<User[]>([]);
    const [editCoHostSearchTerm, setEditCoHostSearchTerm] = useState('');
    const [isEditCoHostSelectOpen, setIsEditCoHostSelectOpen] = useState(false);

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
            setEditingGroup({ ...found });
            setCategories(cats);
            setTags(tgs);
        } finally {
            setLoading(false);
        }
    }, [groupId, navigate]);

    useEffect(() => { fetchGroup(); }, [fetchGroup]);

    // Búsqueda de anfitrión
    useEffect(() => {
        if (!editHostSearchTerm) { setEditPotentialHosts([]); return; }
        const timer = setTimeout(async () => {
            const results = await supabaseService.searchPotentialHosts(editHostSearchTerm);
            setEditPotentialHosts(results);
        }, 300);
        return () => clearTimeout(timer);
    }, [editHostSearchTerm]);

    // Búsqueda de co-anfitrión
    useEffect(() => {
        if (!editCoHostSearchTerm) { setEditPotentialCoHosts([]); return; }
        const timer = setTimeout(async () => {
            const results = await supabaseService.searchPotentialHosts(editCoHostSearchTerm);
            setEditPotentialCoHosts(results.filter(u => u.id !== (editingGroup as any).host_id));
        }, 300);
        return () => clearTimeout(timer);
    }, [editCoHostSearchTerm, editingGroup]);

    // Precarga de términos de búsqueda al cargar el grupo
    useEffect(() => {
        if (editingGroup.leaderName && !editHostSearchTerm) {
            setEditHostSearchTerm(`${editingGroup.leaderName} ${editingGroup.leaderSurname || ''}`.trim());
        }
        if (editingGroup.coHostFirstName && !editCoHostSearchTerm) {
            setEditCoHostSearchTerm(`${editingGroup.coHostFirstName} ${editingGroup.coHostLastName || ''}`.trim());
        }
    }, [editingGroup.id]);

    const handleSaveGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingGroup.name || !editingGroup.leaderName) {
            showToast('Nombre del grupo y anfitrión son obligatorios', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const saved = await updateGroupDirect(editingGroup as Group);

            if (saved && (editingGroup as any).host_id) {
                await supabaseService.linkUserToGroup((editingGroup as any).host_id, saved.id);
            }

            if (saved) {
                showToast('Grupo actualizado exitosamente');
                navigate(`/admingcx/gestion-de-grupos/detalles/${groupId}`);
            } else {
                showToast('Error al guardar en Supabase', 'error');
            }
        } catch (error: any) {
            console.error('[handleSaveGroup] Unexpected error:', error);
            showToast('Error inesperado: ' + (error.message || error), 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return (
        <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
    );

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-6">
                Editar Grupo
            </h1>

            <form onSubmit={handleSaveGroup} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                    <div><label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Nombre del Grupo</label><input type="text" value={editingGroup.name || ''} onChange={e => setEditingGroup({ ...editingGroup, name: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm font-bold" /></div>
                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Categoría</label>
                        <select value={editingGroup.categoryId || ''} onChange={e => setEditingGroup({ ...editingGroup, categoryId: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm bg-white">
                            <option value="">Seleccionar...</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
                    <label className="text-xs font-bold uppercase text-slate-500 mb-2 block flex items-center gap-2">
                        <Users className="w-3 h-3" /> Asignar Anfitrión
                    </label>
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Search className="w-4 h-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar anfitrión..."
                            value={editHostSearchTerm}
                            onFocus={() => setIsEditHostSelectOpen(true)}
                            onChange={e => { setEditHostSearchTerm(e.target.value); setIsEditHostSelectOpen(true); }}
                            className="w-full pl-10 pr-10 p-3 border border-slate-300 rounded-lg outline-none focus:border-black text-sm bg-white"
                        />
                        {isEditHostSelectOpen && (
                            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                                {editPotentialHosts.length > 0 ? (
                                    editPotentialHosts.map(u => (
                                        <div
                                            key={u.id}
                                            onClick={() => {
                                                const parts = u.name.trim().split(/\s+/);
                                                const fName = parts.length > 0 ? parts[0] : '';
                                                const lName = parts.length > 1 ? parts.slice(1).join(' ') : '';
                                                setEditingGroup({
                                                    ...editingGroup,
                                                    host_id: u.id,
                                                    leaderName: fName,
                                                    leaderSurname: lName,
                                                    leaderPhone: u.phone || editingGroup.leaderPhone
                                                } as any);
                                                setEditHostSearchTerm(u.name);
                                                setIsEditHostSelectOpen(false);
                                            }}
                                            className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                        >
                                            <p className="font-bold text-sm text-slate-900">{u.name}</p>
                                            <p className="text-xs text-slate-500">{u.email}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 text-center text-xs text-slate-400">No se encontraron usuarios.</div>
                                )}
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2 mb-2">O ingresá los datos del anfitrión manualmente:</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Nombre *</label>
                            <input type="text" value={editingGroup.leaderName || ''} onChange={e => setEditingGroup({ ...editingGroup, leaderName: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-black" placeholder="Ej. Juan" />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Apellido *</label>
                            <input type="text" value={editingGroup.leaderSurname || ''} onChange={e => setEditingGroup({ ...editingGroup, leaderSurname: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg text-sm outline-none focus:border-black" placeholder="Ej. Pérez" />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div><label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Día</label><select value={editingGroup.meetingDay || 'Lunes'} onChange={e => setEditingGroup({ ...editingGroup, meetingDay: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm bg-white"><option>Lunes</option><option>Martes</option><option>Miércoles</option><option>Jueves</option><option>Viernes</option><option>Sábado</option><option>Domingo</option></select></div>
                    <div><label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Hora</label><input type="time" value={editingGroup.meetingTime || ''} onChange={e => setEditingGroup({ ...editingGroup, meetingTime: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm" /></div>
                    <div><label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Capacidad Max</label><input type="number" value={editingGroup.maxCapacity || 12} onChange={e => setEditingGroup({ ...editingGroup, maxCapacity: parseInt(e.target.value) })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm" /></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 mb-1 h-8 flex items-end">Fecha de Arranque</label>
                        <div className="relative">
                            <input type="text" readOnly value={formatDateForDisplay(editingGroup.startDate)} placeholder="DD/MM/AAAA" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm pointer-events-none bg-white text-black" />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><Calendar className="w-5 h-5" /></div>
                            <input
                                type="date" value={formatDateForInput(editingGroup.startDate)} onChange={e => setEditingGroup({ ...editingGroup, startDate: e.target.value })}
                                onClick={(e) => { try { if (typeof (e.currentTarget as any).showPicker === 'function') (e.currentTarget as any).showPicker(); } catch (error) { } }}
                                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Inicio oficial del grupo.</p>
                    </div>

                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 mb-1 h-8 flex items-end">Fin del Grupo</label>
                        <div className="relative">
                            <input type="text" readOnly value={formatDateForDisplay(editingGroup.endDate)} placeholder="Indefinido" className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm bg-white text-black font-bold pointer-events-none" />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Calendar className="w-5 h-5" /></div>
                            <input
                                type="date" value={formatDateForInput(editingGroup.endDate)} onChange={e => setEditingGroup({ ...editingGroup, endDate: e.target.value })}
                                onClick={(e) => { try { if (typeof (e.currentTarget as any).showPicker === 'function') (e.currentTarget as any).showPicker(); } catch (error) { } }}
                                className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Fecha de cierre administrativo del grupo.</p>
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Ubicación / Dirección</label>
                    <input type="text" value={editingGroup.location || ''} onChange={e => setEditingGroup({ ...editingGroup, location: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm" placeholder="Ej. Calle Falsa 123" />
                </div>

                <div>
                    <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Género Objetivo</label>
                    <select value={editingGroup.targetGender || 'Mixto'} onChange={e => setEditingGroup({ ...editingGroup, targetGender: e.target.value as 'Hombre' | 'Mujer' | 'Mixto' })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm bg-white">
                        <option value="Mixto">Mixto (Todos)</option>
                        <option value="Hombre">Solo Hombres</option>
                        <option value="Mujer">Solo Mujeres</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">Define quién puede inscribirse a este grupo.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Edad Mínima</label>
                        <input type="number" min="0" max="100" value={editingGroup.minAge || 0} onChange={e => setEditingGroup({ ...editingGroup, minAge: parseInt(e.target.value) || 0 })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm" placeholder="Ej. 18" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Edad Máxima</label>
                        <input type="number" min="0" max="100" value={editingGroup.maxAge || 99} onChange={e => setEditingGroup({ ...editingGroup, maxAge: parseInt(e.target.value) || 99 })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm" placeholder="Ej. 35" />
                    </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <label className="text-xs font-bold uppercase text-purple-600 mb-2 block flex items-center gap-2">
                        <Users className="w-3 h-3" /> Co-Anfitrión (Opcional)
                    </label>
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Search className="w-4 h-4 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar co-anfitrión..."
                            value={editCoHostSearchTerm}
                            onFocus={() => setIsEditCoHostSelectOpen(true)}
                            onChange={e => { setEditCoHostSearchTerm(e.target.value); setIsEditCoHostSelectOpen(true); }}
                            className="w-full pl-10 pr-10 p-3 border border-slate-300 rounded-lg outline-none focus:border-purple-500 text-sm bg-white"
                        />
                        {(editingGroup as any).co_host_id && (
                            <button
                                type="button"
                                onClick={() => { setEditingGroup({ ...editingGroup, co_host_id: undefined, coHostFirstName: '', coHostLastName: '' } as any); setEditCoHostSearchTerm(''); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-red-100 text-red-500 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                        {isEditCoHostSelectOpen && (
                            <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-48 overflow-y-auto z-50">
                                {editPotentialCoHosts.length > 0 ? (
                                    editPotentialCoHosts.map(u => (
                                        <div
                                            key={u.id}
                                            onClick={() => {
                                                const parts = u.name.trim().split(/\s+/);
                                                setEditingGroup({
                                                    ...editingGroup,
                                                    co_host_id: u.id,
                                                    coHostFirstName: parts[0] || u.name,
                                                    coHostLastName: parts.slice(1).join(' ') || ''
                                                } as any);
                                                setEditCoHostSearchTerm(u.name);
                                                setIsEditCoHostSelectOpen(false);
                                            }}
                                            className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                                        >
                                            <p className="font-bold text-sm text-slate-900">{u.name}</p>
                                            <p className="text-xs text-slate-500">{u.email}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-3 text-center text-xs text-slate-400">No se encontraron usuarios.</div>
                                )}
                            </div>
                        )}
                    </div>
                    <p className="text-[10px] text-purple-500 mt-2">El co-anfitrión también verá este grupo en su panel.</p>
                </div>

                <div>
                    <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Imagen Portada</label>
                    <ImageUpload
                        currentImage={editingGroup.imageUrl || ''}
                        folder="groups"
                        onImageUpload={(url) => setEditingGroup({ ...editingGroup, imageUrl: url })}
                        aspectRatio="wide"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Descripción</label>
                    <textarea value={editingGroup.description || ''} onChange={e => setEditingGroup({ ...editingGroup, description: e.target.value })} className="w-full p-3 border border-slate-200 rounded-lg outline-none focus:border-black text-sm h-24 resize-none" placeholder="Breve descripción del grupo..."></textarea>
                </div>

                <div>
                    <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Etiquetas</label>
                    <div className="flex flex-wrap gap-2">
                        {tags.map(tag => {
                            const isSelected = (editingGroup.tags || []).includes(tag.id);
                            return (
                                <button
                                    type="button"
                                    key={tag.id}
                                    onClick={() => {
                                        const current = editingGroup.tags || [];
                                        const next = isSelected ? current.filter(t => t !== tag.id) : [...current, tag.id];
                                        setEditingGroup({ ...editingGroup, tags: next });
                                    }}
                                    className={`px-3 py-1 text-xs border rounded-full font-bold uppercase transition-colors ${isSelected ? 'bg-black text-white border-black' : 'bg-white text-slate-500 border-slate-200'}`}
                                >
                                    {tag.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(`/admingcx/gestion-de-grupos/detalles/${groupId}`)}
                        className="px-6 py-3 text-xs font-bold uppercase text-slate-500 hover:text-black"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="px-8 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 rounded-lg shadow-lg flex items-center gap-2 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Guardar Grupo
                    </button>
                </div>
            </form>
        </div>
    );
};

const EditarGrupoAdmin: React.FC = () => (
    <AdminGCXLayout
        title="Editar Grupo"
        backTo="/admingcx/gestion-de-grupos"
        backLabel="Volver a Gestión de Grupos"
    >
        <EditarGrupoAdminContent />
    </AdminGCXLayout>
);

export default EditarGrupoAdmin;

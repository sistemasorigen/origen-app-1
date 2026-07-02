import React, { useState, useEffect, useCallback } from 'react';
import { GroupTag } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import { Check, Edit2, Trash2, Loader2 } from 'lucide-react';

const EtiquetasContent: React.FC = () => {
    const { showToast } = useAdminGCXToast();
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [loading, setLoading] = useState(true);

    const [newTagName, setNewTagName] = useState('');
    const [editingTagId, setEditingTagId] = useState<string | null>(null);
    const [editingTagName, setEditingTagName] = useState('');

    const fetchTags = useCallback(async () => {
        const tgs = await supabaseService.getGroupTags();
        setTags(tgs);
    }, []);

    useEffect(() => {
        setLoading(true);
        fetchTags().finally(() => setLoading(false));
    }, [fetchTags]);

    const handleAddTag = async () => {
        if (!newTagName.trim()) return showToast('El nombre de la etiqueta es obligatorio', 'error');
        const newTag: GroupTag = {
            id: newTagName.toLowerCase().replace(/\s+/g, '-'),
            name: newTagName.trim()
        };
        const success = await supabaseService.saveGroupTag(newTag);
        if (success) {
            await fetchTags();
            setNewTagName('');
            showToast('Etiqueta creada');
        } else {
            showToast('Error al crear etiqueta', 'error');
        }
    };

    const startEditTag = (tag: GroupTag) => {
        setEditingTagId(tag.id);
        setEditingTagName(tag.name);
    };

    const handleUpdateTag = async (id: string) => {
        if (!editingTagName.trim()) return showToast('Nombre inválido', 'error');
        const tag: GroupTag = { id, name: editingTagName };
        const success = await supabaseService.saveGroupTag(tag);
        if (success) {
            await fetchTags();
            setEditingTagId(null);
            showToast('Etiqueta actualizada');
        } else {
            showToast('Error al actualizar etiqueta', 'error');
        }
    };

    const handleDeleteTag = async (id: string) => {
        const success = await supabaseService.deleteGroupTag(id);
        if (success) {
            await fetchTags();
            showToast('Etiqueta eliminada');
        } else {
            showToast('Error al eliminar etiqueta', 'error');
        }
    };

    return (
        loading ? (
            <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
        ) : (
                <div className="max-w-5xl">
                    {/* Create Form */}
                    <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-8 flex flex-col md:flex-row gap-4 md:items-end">
                        <div className="flex-1">
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Nombre Etiqueta</label>
                            <input type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)} className="w-full p-3 border border-slate-300 rounded text-sm focus:border-black outline-none bg-white" placeholder="Ej. Presencial" />
                        </div>
                        <button onClick={handleAddTag} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 rounded">
                            Crear
                        </button>
                    </div>

                    {/* Mobile List View */}
                    <div className="md:hidden space-y-3">
                        {tags.map(tag => (
                            <div key={tag.id} className="bg-white p-4 border border-slate-200 rounded-lg shadow-sm flex items-center justify-between">
                                <div>
                                    {editingTagId === tag.id ? (
                                        <input type="text" value={editingTagName} onChange={e => setEditingTagName(e.target.value)} className="border p-1 rounded text-sm w-32" />
                                    ) : (
                                        <span className="font-bold text-sm bg-slate-100 px-3 py-1 rounded-full">{tag.name}</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    {editingTagId === tag.id ? (
                                        <button onClick={() => handleUpdateTag(tag.id)} className="p-2 bg-green-50 text-green-600 rounded"><Check className="w-4 h-4" /></button>
                                    ) : (
                                        <button onClick={() => startEditTag(tag)} className="p-2 bg-slate-50 text-slate-600 rounded"><Edit2 className="w-4 h-4" /></button>
                                    )}
                                    <button onClick={() => handleDeleteTag(tag.id)} className="p-2 bg-red-50 text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table List */}
                    <div className="hidden md:block bg-off-white border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                                <tr>
                                    <th className="p-4">Nombre</th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {tags.map(tag => (
                                    <tr key={tag.id} className="hover:bg-slate-50">
                                        <td className="p-4">
                                            {editingTagId === tag.id ? (
                                                <input type="text" value={editingTagName} onChange={e => setEditingTagName(e.target.value)} className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-black" />
                                            ) : (
                                                <span className="font-bold text-sm text-slate-900 bg-slate-100 px-3 py-1 rounded-full">{tag.name}</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {editingTagId === tag.id ? (
                                                    <button onClick={() => handleUpdateTag(tag.id)} className="p-2 bg-green-50 text-green-600 rounded hover:bg-green-100"><Check className="w-4 h-4" /></button>
                                                ) : (
                                                    <button onClick={() => startEditTag(tag)} className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded"><Edit2 className="w-4 h-4" /></button>
                                                )}
                                                <button onClick={() => handleDeleteTag(tag.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
        )
    );
};

const Etiquetas: React.FC = () => (
    <AdminGCXLayout title="Etiquetas (Tags)">
        <EtiquetasContent />
    </AdminGCXLayout>
);

export default Etiquetas;

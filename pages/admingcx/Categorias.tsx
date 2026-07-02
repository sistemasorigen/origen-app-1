import React, { useState, useEffect, useCallback } from 'react';
import { GroupCategory } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import { Check, Edit2, Trash2, Loader2 } from 'lucide-react';

const CategoriasContent: React.FC = () => {
    const { showToast } = useAdminGCXToast();
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [loading, setLoading] = useState(true);

    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState('#000000');
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const [editingCategoryColor, setEditingCategoryColor] = useState('');

    const fetchCategories = useCallback(async () => {
        const cats = await supabaseService.getGroupCategories();
        setCategories(cats);
    }, []);

    useEffect(() => {
        setLoading(true);
        fetchCategories().finally(() => setLoading(false));
    }, [fetchCategories]);

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return showToast('El nombre de la categoría es obligatorio', 'error');
        const newCat: GroupCategory = {
            id: newCategoryName.trim(),
            name: newCategoryName.trim(),
            color: newCategoryColor
        };
        const success = await supabaseService.saveGroupCategory(newCat);
        if (success) {
            await fetchCategories();
            setNewCategoryName('');
            setNewCategoryColor('#000000');
            showToast('Categoría creada');
        } else {
            showToast('Error al crear categoría', 'error');
        }
    };

    const startEditCategory = (cat: GroupCategory) => {
        setEditingCategoryId(cat.id);
        setEditingCategoryName(cat.name);
        setEditingCategoryColor(cat.color);
    };

    const handleUpdateCategory = async (id: string) => {
        if (!editingCategoryName.trim()) return showToast('Nombre inválido', 'error');
        const cat: GroupCategory = { id, name: editingCategoryName, color: editingCategoryColor };
        const success = await supabaseService.saveGroupCategory(cat);
        if (success) {
            await fetchCategories();
            setEditingCategoryId(null);
            showToast('Categoría actualizada');
        } else {
            showToast('Error al actualizar categoría', 'error');
        }
    };

    const handleDeleteCategory = async (id: string) => {
        const success = await supabaseService.deleteGroupCategory(id);
        if (success) {
            await fetchCategories();
            showToast('Categoría eliminada');
        } else {
            showToast('Error al eliminar categoría', 'error');
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
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Nombre Categoría</label>
                            <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-full p-3 border border-slate-300 rounded text-sm focus:border-black outline-none bg-white" placeholder="Ej. Jóvenes" />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 mb-1 block">Color</label>
                            <input type="color" value={newCategoryColor} onChange={e => setNewCategoryColor(e.target.value)} className="w-full md:w-16 h-11 border border-slate-300 rounded cursor-pointer bg-white p-1" />
                        </div>
                        <button onClick={handleAddCategory} className="px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 rounded">
                            Crear
                        </button>
                    </div>

                    {/* Mobile List View */}
                    <div className="md:hidden space-y-3">
                        {categories.map(cat => (
                            <div key={cat.id} className="bg-white p-4 border border-slate-200 rounded-lg shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                    {editingCategoryId === cat.id ? (
                                        <input type="text" value={editingCategoryName} onChange={e => setEditingCategoryName(e.target.value)} className="border p-1 rounded text-sm w-32" />
                                    ) : (
                                        <span className="font-bold text-sm">{cat.name}</span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    {editingCategoryId === cat.id ? (
                                        <button onClick={() => handleUpdateCategory(cat.id)} className="p-2 bg-green-50 text-green-600 rounded"><Check className="w-4 h-4" /></button>
                                    ) : (
                                        <button onClick={() => startEditCategory(cat)} className="p-2 bg-slate-50 text-slate-600 rounded"><Edit2 className="w-4 h-4" /></button>
                                    )}
                                    <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 bg-red-50 text-red-600 rounded"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-off-white border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase font-bold text-slate-500">
                                <tr>
                                    <th className="p-4">Nombre</th>
                                    <th className="p-4">Color</th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {categories.map(cat => (
                                    <tr key={cat.id} className="hover:bg-slate-50">
                                        <td className="p-4">
                                            {editingCategoryId === cat.id ? (
                                                <input type="text" value={editingCategoryName} onChange={e => setEditingCategoryName(e.target.value)} className="w-full p-2 border border-slate-300 rounded text-sm outline-none focus:border-black" />
                                            ) : (
                                                <span className="font-bold text-sm text-slate-900">{cat.name}</span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {editingCategoryId === cat.id ? (
                                                <input type="color" value={editingCategoryColor} onChange={e => setEditingCategoryColor(e.target.value)} className="w-10 h-8 border border-slate-300 rounded cursor-pointer" />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full border border-slate-200" style={{ backgroundColor: cat.color }}></div>
                                                    <span className="text-xs text-slate-400 font-mono">{cat.color}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                {editingCategoryId === cat.id ? (
                                                    <button onClick={() => handleUpdateCategory(cat.id)} className="p-2 bg-green-50 text-green-600 rounded hover:bg-green-100"><Check className="w-4 h-4" /></button>
                                                ) : (
                                                    <button onClick={() => startEditCategory(cat)} className="p-2 text-slate-400 hover:text-black hover:bg-slate-100 rounded"><Edit2 className="w-4 h-4" /></button>
                                                )}
                                                <button onClick={() => handleDeleteCategory(cat.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
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

const Categorias: React.FC = () => (
    <AdminGCXLayout title="Categorías de Grupo">
        <CategoriasContent />
    </AdminGCXLayout>
);

export default Categorias;

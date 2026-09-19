import React, { useState, useEffect, useCallback } from 'react';
import { GroupCategory, Group } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast, usePanelGCXConteos } from '../../components/layout/AdminGCXLayout';
import ModalPanelGCX, { BotonPrincipal, BotonSecundario } from '../../components/GCX/ModalPanelGCX';
import { Loader2, Plus } from 'lucide-react';

/**
 * Sección Categorías del panel (design-claude/Admin GCX - Panel).
 *
 * Una fila por categoría con cuántos grupos la usan, que es el dato que
 * dice si conviene tocarla o no. El color se edita en el mismo modal que
 * el nombre.
 */

const CategoriasContent: React.FC = () => {
    const { showToast } = useAdminGCXToast();
    const { registrarConteo } = usePanelGCXConteos();
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    const [editando, setEditando] = useState<GroupCategory | null>(null);
    const [esNueva, setEsNueva] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const fetchCategories = useCallback(async () => {
        const cats = await supabaseService.getGroupCategories();
        setCategories(cats);
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetchCategories(),
            supabaseService.getGroupsForAdmin().then(setGroups).catch(() => setGroups([])),
        ]).finally(() => setLoading(false));
    }, [fetchCategories]);

    useEffect(() => {
        if (categories.length > 0) registrarConteo('categorias', categories.length);
    }, [categories.length, registrarConteo]);

    const usoDe = (id: string) => groups.filter(g => g.categoryId === id).length;

    const abrirNueva = () => {
        setEsNueva(true);
        setEditando({ id: '', name: '', color: '#0a0a0a' });
    };

    const abrirEdicion = (cat: GroupCategory) => {
        setEsNueva(false);
        setEditando({ ...cat });
    };

    const guardar = async () => {
        if (!editando) return;
        const nombre = editando.name.trim();
        if (!nombre) {
            showToast('La categoría necesita un nombre', 'error');
            return;
        }
        setGuardando(true);
        // El id de una categoría nueva es su nombre: así lo venía guardando
        // el panel y así lo referencian los grupos ya creados.
        const cat: GroupCategory = {
            id: esNueva ? nombre : editando.id,
            name: nombre,
            color: editando.color,
        };
        const ok = await supabaseService.saveGroupCategory(cat);
        setGuardando(false);
        if (ok) {
            await fetchCategories();
            setEditando(null);
            showToast(esNueva ? 'Categoría creada' : 'Categoría actualizada');
        } else {
            showToast(esNueva ? 'Error al crear la categoría' : 'Error al actualizar la categoría', 'error');
        }
    };

    const borrar = async (cat: GroupCategory) => {
        const enUso = usoDe(cat.id);
        const aviso = enUso > 0
            ? `"${cat.name}" la usan ${enUso} ${enUso === 1 ? 'grupo' : 'grupos'}. Si la borrás, esos grupos quedan sin categoría. ¿Seguimos?`
            : `¿Borrar la categoría "${cat.name}"?`;
        if (!window.confirm(aviso)) return;

        const ok = await supabaseService.deleteGroupCategory(cat.id);
        if (ok) {
            await fetchCategories();
            setEditando(null);
            showToast('Categoría eliminada');
        } else {
            showToast('Error al eliminar la categoría', 'error');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center rounded-[20px] bg-white py-20">
                <Loader2 className="h-7 w-7 animate-spin text-black/20" />
            </div>
        );
    }

    return (
        <>
            <div className="overflow-hidden rounded-[18px] bg-white">
                {categories.length === 0 && (
                    <p className="px-[18px] py-10 text-center text-[13.5px] font-medium text-black/[.55]">
                        Todavía no hay categorías. Creá la primera para poder clasificar los grupos.
                    </p>
                )}

                {categories.map(cat => {
                    const uso = usoDe(cat.id);
                    return (
                        <div key={cat.id} className="flex h-14 items-center gap-3.5 border-b border-[#f4f3f1] px-[18px] last:border-b-0">
                            <span className="h-[18px] w-[18px] flex-none rounded-full" style={{ background: cat.color || '#0a0a0a' }} />
                            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#0a0a0a]">{cat.name}</span>
                            <span className="whitespace-nowrap text-[12.5px] font-medium text-black/[.62]">
                                {uso === 0 ? 'Sin grupos' : `${uso} ${uso === 1 ? 'grupo' : 'grupos'}`}
                            </span>
                            <button
                                onClick={() => abrirEdicion(cat)}
                                className="h-8 flex-none rounded-full bg-[#f2f2f0] px-[13px] text-[12px] font-semibold text-black/[.66] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                            >
                                Editar
                            </button>
                        </div>
                    );
                })}

                <div className="px-[18px] py-3.5">
                    <button
                        onClick={abrirNueva}
                        className="flex h-[42px] items-center gap-2 rounded-full bg-[#0a0a0a] px-[18px] text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        <Plus className="h-[15px] w-[15px]" />
                        Nueva categoría
                    </button>
                </div>
            </div>

            <ModalPanelGCX
                isOpen={!!editando}
                onClose={() => setEditando(null)}
                titulo={esNueva ? 'Nueva categoría' : 'Editar la categoría'}
                subtitulo={esNueva
                    ? 'Aparece en el selector al crear un grupo.'
                    : `La usan ${editando ? usoDe(editando.id) : 0} grupos.`}
                pie={
                    <>
                        {!esNueva && editando && (
                            <BotonSecundario onClick={() => borrar(editando)} className="bg-[#fdecea] text-[#a32218]">
                                Borrar
                            </BotonSecundario>
                        )}
                        <BotonPrincipal onClick={guardar} disabled={guardando}>
                            {guardando ? 'Guardando…' : esNueva ? 'Crear la categoría' : 'Guardar'}
                        </BotonPrincipal>
                    </>
                }
            >
                {editando && (
                    <div className="flex flex-col gap-2.5 pb-1">
                        <div className="flex h-[58px] flex-col justify-center rounded-[18px] bg-[#f7f7f5] px-[17px]">
                            <label htmlFor="cat-nombre" className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-black/[.58]">
                                Nombre
                            </label>
                            <input
                                id="cat-nombre"
                                type="text"
                                value={editando.name}
                                onChange={e => setEditando({ ...editando, name: e.target.value })}
                                placeholder="Ej. Matrimonios jóvenes"
                                autoFocus
                                className="campo-desnudo w-full bg-transparent text-[14.5px] font-medium text-[#0a0a0a]"
                            />
                        </div>

                        <div className="flex h-[58px] items-center gap-3 rounded-[18px] bg-[#f7f7f5] px-[17px]">
                            <div className="flex-1">
                                <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-black/[.58]">Color</p>
                                <p className="text-[14.5px] font-medium text-black/[.6]">Se ve en el catálogo público</p>
                            </div>
                            <input
                                type="color"
                                value={editando.color || '#0a0a0a'}
                                onChange={e => setEditando({ ...editando, color: e.target.value })}
                                aria-label="Color de la categoría"
                                className="h-10 w-14 flex-none"
                            />
                        </div>

                        {!esNueva && (
                            <p className="mt-1 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                                Cambiar el nombre no despega a los grupos que ya la tienen.
                            </p>
                        )}
                    </div>
                )}
            </ModalPanelGCX>
        </>
    );
};

const Categorias: React.FC = () => (
    <AdminGCXLayout title="Categorías">
        <CategoriasContent />
    </AdminGCXLayout>
);

export default Categorias;

import React, { useState, useEffect, useCallback } from 'react';
import { GroupTag, Group } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast, usePanelGCXConteos } from '../../components/layout/AdminGCXLayout';
import ModalPanelGCX, { BotonPrincipal, BotonSecundario } from '../../components/GCX/ModalPanelGCX';
import { Loader2, Plus } from 'lucide-react';

/**
 * Sección Etiquetas del panel (design-claude/Admin GCX - Panel).
 *
 * Las etiquetas se ven como se usan: en uso arriba con su número, y abajo
 * las que no está usando ningún grupo, que son las que conviene limpiar.
 * Tocar una etiqueta la abre para renombrarla o borrarla.
 */

const EtiquetasContent: React.FC = () => {
    const { showToast } = useAdminGCXToast();
    const { registrarConteo } = usePanelGCXConteos();
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    const [editando, setEditando] = useState<GroupTag | null>(null);
    const [esNueva, setEsNueva] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const fetchTags = useCallback(async () => {
        const tgs = await supabaseService.getGroupTags();
        setTags(tgs);
    }, []);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            fetchTags(),
            supabaseService.getGroupsForAdmin().then(setGroups).catch(() => setGroups([])),
        ]).finally(() => setLoading(false));
    }, [fetchTags]);

    useEffect(() => {
        if (tags.length > 0) registrarConteo('etiquetas', tags.length);
    }, [tags.length, registrarConteo]);

    // Un grupo puede tener guardado el id de la etiqueta o su nombre, según
    // desde dónde se haya creado; se cuentan las dos formas.
    const usoDe = (tag: GroupTag) =>
        groups.filter(g => g.tags?.some(t => t === tag.id || t === tag.name)).length;

    const enUso = tags.filter(t => usoDe(t) > 0);
    const sinUsar = tags.filter(t => usoDe(t) === 0);

    const abrirNueva = () => {
        setEsNueva(true);
        setEditando({ id: '', name: '' });
    };

    const guardar = async () => {
        if (!editando) return;
        const nombre = editando.name.trim();
        if (!nombre) {
            showToast('La etiqueta necesita un nombre', 'error');
            return;
        }
        setGuardando(true);
        // Al crear, el id sale del nombre; al editar se conserva para no
        // despegar a los grupos que ya la tienen puesta.
        const tag: GroupTag = {
            id: esNueva ? nombre.toLowerCase().replace(/\s+/g, '-') : editando.id,
            name: nombre,
        };
        const ok = await supabaseService.saveGroupTag(tag);
        setGuardando(false);
        if (ok) {
            await fetchTags();
            setEditando(null);
            showToast(esNueva ? 'Etiqueta creada' : 'Etiqueta actualizada');
        } else {
            showToast(esNueva ? 'Error al crear la etiqueta' : 'Error al actualizar la etiqueta', 'error');
        }
    };

    const borrar = async (tag: GroupTag) => {
        const uso = usoDe(tag);
        const aviso = uso > 0
            ? `"${tag.name}" está en ${uso} ${uso === 1 ? 'grupo' : 'grupos'}. Si la borrás, la pierden. ¿Seguimos?`
            : `¿Borrar la etiqueta "${tag.name}"?`;
        if (!window.confirm(aviso)) return;

        const ok = await supabaseService.deleteGroupTag(tag.id);
        if (ok) {
            await fetchTags();
            setEditando(null);
            showToast('Etiqueta eliminada');
        } else {
            showToast('Error al eliminar la etiqueta', 'error');
        }
    };

    const borrarSinUsar = async () => {
        if (sinUsar.length === 0) return;
        if (!window.confirm(`¿Borrar las ${sinUsar.length} etiquetas que no usa ningún grupo? No se puede deshacer.`)) return;

        const resultados = await Promise.all(sinUsar.map(t => supabaseService.deleteGroupTag(t.id)));
        const ok = resultados.filter(Boolean).length;
        await fetchTags();
        showToast(ok === sinUsar.length
            ? `${ok} ${ok === 1 ? 'etiqueta eliminada' : 'etiquetas eliminadas'}`
            : `Se borraron ${ok} de ${sinUsar.length}.`, ok === sinUsar.length ? 'success' : 'error');
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
            <div className="rounded-[20px] bg-white p-5">
                <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58]">En uso</p>
                {enUso.length === 0 ? (
                    <p className="text-[13.5px] font-medium text-black/[.55]">Ningún grupo tiene etiquetas puestas todavía.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {enUso.map(tag => (
                            <button
                                key={tag.id}
                                onClick={() => { setEsNueva(false); setEditando({ ...tag }); }}
                                className="flex h-[38px] items-center gap-[9px] rounded-full bg-[#f2f2f0] px-[15px] text-[13px] font-semibold text-[#0a0a0a] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                {tag.name}
                                <span className="text-[11.5px] font-semibold text-black/[.6]">{usoDe(tag)}</span>
                            </button>
                        ))}
                    </div>
                )}

                <p className="mb-3.5 mt-6 text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58]">
                    Sin usar en ningún grupo
                </p>
                {sinUsar.length === 0 ? (
                    <p className="text-[13.5px] font-medium text-black/[.55]">Todas las etiquetas están en uso.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {sinUsar.map(tag => (
                            <button
                                key={tag.id}
                                onClick={() => { setEsNueva(false); setEditando({ ...tag }); }}
                                className="flex h-[38px] items-center rounded-full bg-[#faf9f7] px-[15px] text-[13px] font-semibold text-black/[.62] transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                {tag.name}
                            </button>
                        ))}
                    </div>
                )}

                <div className="mt-6 flex flex-wrap gap-2">
                    <button
                        onClick={abrirNueva}
                        className="flex h-11 items-center gap-2 rounded-full bg-[#0a0a0a] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        <Plus className="h-[15px] w-[15px]" />
                        Nueva etiqueta
                    </button>
                    {sinUsar.length > 0 && (
                        <button
                            onClick={borrarSinUsar}
                            className="h-11 rounded-full bg-[#fdecea] px-5 text-[14px] font-semibold text-[#a32218] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            Borrar las {sinUsar.length} sin usar
                        </button>
                    )}
                </div>
            </div>

            <ModalPanelGCX
                isOpen={!!editando}
                onClose={() => setEditando(null)}
                titulo={esNueva ? 'Nueva etiqueta' : 'Editar la etiqueta'}
                subtitulo={esNueva
                    ? 'Se elige al crear o editar un grupo.'
                    : editando ? `La usan ${usoDe(editando)} grupos.` : undefined}
                pie={
                    <>
                        {!esNueva && editando && (
                            <BotonSecundario onClick={() => borrar(editando)} className="bg-[#fdecea] text-[#a32218]">
                                Borrar
                            </BotonSecundario>
                        )}
                        <BotonPrincipal onClick={guardar} disabled={guardando}>
                            {guardando ? 'Guardando…' : esNueva ? 'Crear la etiqueta' : 'Guardar'}
                        </BotonPrincipal>
                    </>
                }
            >
                {editando && (
                    <div className="flex h-[58px] flex-col justify-center rounded-[18px] bg-[#f7f7f5] px-[17px]">
                        <label htmlFor="tag-nombre" className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-black/[.58]">
                            Nombre
                        </label>
                        <input
                            id="tag-nombre"
                            type="text"
                            value={editando.name}
                            onChange={e => setEditando({ ...editando, name: e.target.value })}
                            placeholder="Ej. Con cena"
                            autoFocus
                            className="campo-desnudo w-full bg-transparent text-[14.5px] font-medium text-[#0a0a0a]"
                        />
                    </div>
                )}
            </ModalPanelGCX>
        </>
    );
};

const Etiquetas: React.FC = () => (
    <AdminGCXLayout title="Etiquetas">
        <EtiquetasContent />
    </AdminGCXLayout>
);

export default Etiquetas;

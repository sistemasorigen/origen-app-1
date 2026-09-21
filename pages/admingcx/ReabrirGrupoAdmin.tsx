import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Group, GroupTag, SeasonSettings, DEFAULT_SEASON_SETTINGS, CamposReapertura } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import FormularioGrupo, { DatosGrupo } from '../../components/GCX/formulario-grupo';
import { modalidadDe, banderasDe, llevaDireccion } from '../../src/utils/modalidad';

interface GroupCategory {
    id: string;
    name: string;
    color?: string;
}

const VACIO: DatosGrupo = {
    name: '', categoryId: '', meetingDay: 'Lunes', meetingTime: '20:00',
    location: '', modalidad: 'presencial', description: '', maxCapacity: 12,
    imageUrl: '', coHostFirstName: '', coHostLastName: '',
    minAge: 0, maxAge: 100, targetGender: 'Mixto', tags: [],
    startDate: '', endDate: '',
};

/**
 * Re-abrir un grupo en otra temporada, desde el panel GCX.
 *
 * Clona el grupo que terminó y arranca uno nuevo con las fechas que se
 * elijan. Todo lo demás viene cargado y es editable: lo que quede en el
 * formulario es lo que se guarda en el grupo nuevo.
 *
 * No se cambia el anfitrión acá: el clon se queda con el del grupo original.
 * Reasignarlo es otra decisión y vive en "Editar".
 *
 * Diferencia con el mismo flujo del anfitrión: re-abierto desde el panel, el
 * grupo nuevo ya queda activo, sin pasar por revisión.
 */
const ReabrirGrupoAdminContent: React.FC = () => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const { showToast } = useAdminGCXToast();

    const [group, setGroup] = useState<Group | null>(null);
    const [loadingGroup, setLoadingGroup] = useState(true);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [availableTags, setAvailableTags] = useState<GroupTag[]>([]);
    const [loading, setLoading] = useState(false);
    const [seasonSettings, setSeasonSettings] = useState<SeasonSettings>(DEFAULT_SEASON_SETTINGS);

    const [coHostMode, setCoHostMode] = useState<'manual' | 'search'>('search');
    const [coHostSearchTerm, setCoHostSearchTerm] = useState('');
    const [coHostId, setCoHostId] = useState<string | null>(null);
    const [coHostResults, setCoHostResults] = useState<any[]>([]);
    const [isSearchingCoHost, setIsSearchingCoHost] = useState(false);
    const [isCoHostDropdownOpen, setIsCoHostDropdownOpen] = useState(false);
    const coHostDropdownRef = useRef<HTMLDivElement>(null);

    const [form, setForm] = useState<DatosGrupo>(VACIO);
    const [fechasOriginales, setFechasOriginales] = useState<{ startDate: string; endDate: string } | null>(null);

    // Abierta cuando el formulario pasó las validaciones: pregunta si
    // cargar el grupo o volver a revisar los datos.
    const [confirmando, setConfirmando] = useState(false);

    const fetchGroup = useCallback(async () => {
        if (!groupId) return;
        setLoadingGroup(true);
        try {
            // Desde el panel se puede reabrir cualquier grupo, no sólo los propios.
            const todos = await supabaseService.getGroupsForAdmin();
            const found = todos.find(g => g.id === groupId);
            if (!found) {
                navigate('/admingcx/gestion-de-grupos', { replace: true });
                return;
            }
            setGroup(found);
            const desde = found.startDate ? found.startDate.split('T')[0] : '';
            const hasta = found.endDate ? found.endDate.split('T')[0] : '';
            setForm({
                name: found.name || '',
                categoryId: found.categoryId || '',
                meetingDay: found.meetingDay || 'Lunes',
                meetingTime: found.meetingTime || '20:00',
                location: found.location || '',
                modalidad: modalidadDe(found),
                description: found.description || '',
                maxCapacity: found.maxCapacity || 12,
                imageUrl: found.imageUrl || '',
                coHostFirstName: found.coHostFirstName || '',
                coHostLastName: found.coHostLastName || '',
                minAge: found.minAge ?? 0,
                maxAge: found.maxAge ?? 100,
                targetGender: found.targetGender || 'Mixto',
                tags: found.tags || [],
                startDate: desde,
                endDate: hasta,
            });
            setFechasOriginales({ startDate: desde, endDate: hasta });
            if ((found as any).co_host_id) {
                setCoHostMode('search');
                setCoHostId((found as any).co_host_id);
                setCoHostSearchTerm(`${found.coHostFirstName || ''} ${found.coHostLastName || ''}`.trim());
            } else if (found.coHostFirstName) {
                setCoHostMode('manual');
            }
        } finally {
            setLoadingGroup(false);
        }
    }, [groupId, navigate]);

    useEffect(() => { fetchGroup(); }, [fetchGroup]);

    useEffect(() => {
        const loadData = async () => {
            const [cats, tags] = await Promise.all([
                supabaseService.getGroupCategories(),
                supabaseService.getGroupTags(),
            ]);
            setCategories(cats);
            setAvailableTags(tags);
        };
        loadData();
        supabaseService.getAppConfig().then(cfg => {
            if (cfg?.groupsConfig?.seasonSettings) setSeasonSettings(cfg.groupsConfig.seasonSettings);
        });
    }, []);



    useEffect(() => {
        if (coHostMode !== 'search' || !coHostSearchTerm.trim()) {
            setCoHostResults([]);
            setIsCoHostDropdownOpen(false);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingCoHost(true);
            try {
                const { data } = await supabase.rpc('buscar_personas', {
                    p_termino: coHostSearchTerm,
                    p_por_email: true,
                    p_solo_activos: true,
                    p_limite: 8,
                });
                setCoHostResults((data as any[]) || []);
                setIsCoHostDropdownOpen(true);
            } catch { setCoHostResults([]); }
            finally { setIsSearchingCoHost(false); }
        }, 350);
        return () => clearTimeout(timer);
    }, [coHostSearchTerm, coHostMode]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (coHostDropdownRef.current && !coHostDropdownRef.current.contains(e.target as Node)) {
                setIsCoHostDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'maxCapacity' || name === 'maxAge' || name === 'minAge') {
            setForm(prev => ({ ...prev, [name]: value === '' ? '' : parseInt(value) }));
            return;
        }
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const toggleTag = (tagId: string) => {
        setForm(prev => {
            const currentTags = prev.tags || [];
            return currentTags.includes(tagId)
                ? { ...prev, tags: currentTags.filter(t => t !== tagId) }
                : { ...prev, tags: [...currentTags, tagId] };
        });
    };

    // Sin temporada nueva no hay nada que reabrir: es la única decisión
    // obligatoria de esta pantalla.
    const temporadaElegida = useMemo(() => {
        if (!fechasOriginales) return false;
        return form.startDate !== fechasOriginales.startDate || form.endDate !== fechasOriginales.endDate;
    }, [form.startDate, form.endDate, fechasOriginales]);

    const currentYear = seasonSettings?.activeYear ?? new Date().getFullYear();
    const resolvedSeasons = seasonSettings?.seasons ?? DEFAULT_SEASON_SETTINGS.seasons;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!temporadaElegida) return showToast('Elegí la temporada en la que se reabre.', 'error');
        if (!form.name.trim()) return showToast('El nombre del grupo es obligatorio.', 'error');
        if (!form.categoryId) return showToast('Elegí una categoría.', 'error');
        if (llevaDireccion(form.modalidad) && !form.location.trim()) return showToast('Falta el barrio o la dirección.', 'error');
        if (!form.description.trim()) return showToast('Falta la descripción.', 'error');

        const maxCapacityFn = Number(form.maxCapacity);
        const minAgeFn = Number(form.minAge);
        const maxAgeFn = Number(form.maxAge);
        if (maxCapacityFn <= 0) return showToast('La capacidad tiene que ser mayor a 0.', 'error');
        if (minAgeFn > maxAgeFn) return showToast('La edad mínima no puede ser mayor a la máxima.', 'error');
        if (form.startDate && form.endDate && form.startDate > form.endDate) {
            return showToast('La fecha de fin tiene que ser posterior a la de arranque.', 'error');
        }

        setConfirmando(true);
    };

    const confirmSubmit = async () => {
        if (!group) return;
        setLoading(true);
        setConfirmando(false);
        try {
            let finalImageUrl = form.imageUrl;
            if (finalImageUrl && finalImageUrl.startsWith('data:image')) {
                try {
                    finalImageUrl = await supabaseService.uploadBase64Image(finalImageUrl, 'groups-covers');
                } catch (uploadError: any) {
                    showToast(`No se pudo guardar la portada: ${uploadError.message}`, 'error');
                    setLoading(false);
                    return;
                }
            }

            const cambiosDelFormulario: CamposReapertura = {
                name: form.name,
                meetingDay: form.meetingDay,
                meetingTime: form.meetingTime,
                location: llevaDireccion(form.modalidad) ? form.location : '',
                ...banderasDe(form.modalidad),
                description: form.description,
                maxCapacity: Number(form.maxCapacity),
                imageUrl: finalImageUrl,
                categoryId: form.categoryId,
                tags: form.tags,
                coHostId: coHostMode === 'search' ? coHostId : null,
                coHostFirstName: coHostMode === 'manual' ? form.coHostFirstName : '',
                coHostLastName: coHostMode === 'manual' ? form.coHostLastName : '',
                minAge: Number(form.minAge),
                maxAge: Number(form.maxAge),
                targetGender: form.targetGender as CamposReapertura['targetGender'],
            };

            // El cuarto argumento es "viene del panel": el grupo nuevo nace
            // aprobado en vez de quedar esperando revisión.
            const result = await supabaseService.cloneGroupForNewSeason(
                group.id,
                form.startDate,
                form.endDate,
                true,
                cambiosDelFormulario
            );

            if (result) {
                showToast('Grupo re-abierto y activo para esta temporada.');
                navigate('/admingcx/gestion-de-grupos');
            } else {
                showToast('No se pudo re-abrir el grupo.', 'error');
            }
        } catch (error: any) {
            console.error('[Panel GCX] Error re-abriendo el grupo:', error);
            showToast(`No se pudo re-abrir el grupo: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loadingGroup) {
        return (
            <div className="flex justify-center py-24">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#eceae6] border-t-[#0a0a0a]" />
            </div>
        );
    }

    if (!group) return null;

    return (
        <FormularioGrupo
            modo="reabrir"
            subtitulo={group.name}
            onVolver={() => navigate('/admingcx/gestion-de-grupos')}
            volverTexto="Grupos"
            form={form}
            setForm={setForm}
            onChange={handleChange}
            categorias={categories}
            etiquetas={availableTags}
            onToggleEtiqueta={toggleTag}
            aviso={<>Se crea un grupo nuevo con estos datos. El que terminó queda como está, con sus inscriptos.</>}
            textoGuardar="Re-abrir el grupo"
            coAnfitrion={{
                modo: coHostMode,
                setModo: setCoHostMode,
                termino: coHostSearchTerm,
                setTermino: setCoHostSearchTerm,
                id: coHostId,
                setId: setCoHostId,
                resultados: coHostResults,
                buscando: isSearchingCoHost,
                desplegado: isCoHostDropdownOpen,
                setDesplegado: setIsCoHostDropdownOpen,
                contenedor: coHostDropdownRef,
            }}
            confirmacion={{
                abierta: confirmando,
                onConfirmar: () => confirmSubmit(),
                onRevisar: () => setConfirmando(false),
            }}
            anio={currentYear}
            temporadas={resolvedSeasons}
            onGuardar={handleSubmit}
            guardando={loading}
        />
    );
};

const ReabrirGrupoAdmin: React.FC = () => (
    <AdminGCXLayout
        title="Re-abrir el grupo"
        backTo="/admingcx/gestion-de-grupos"
        backLabel="Grupos"
        soloContenido
    >
        <ReabrirGrupoAdminContent />
    </AdminGCXLayout>
);

export default ReabrirGrupoAdmin;

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Group, User, GroupTag, SeasonSettings, DEFAULT_SEASON_SETTINGS } from '../../types';
import { supabaseService, updateGroupDirect } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import FormularioGrupo, { DatosGrupo } from '../../components/GCX/formulario-grupo';
import { modalidadDe, banderasDe, llevaDireccion } from '../../src/utils/modalidad';
import { camposDelCoAnfitrion } from '../../components/GCX/coAnfitrionElegido';
import { useVinculoManual } from '../../components/GCX/useVinculoManual';

interface GroupCategory {
    id: string;
    name: string;
    color?: string;
}

/** El formulario del panel guarda además a quién se le asigna el grupo. */
type DatosGrupoAdmin = DatosGrupo & { leaderName: string; leaderSurname: string };

const VACIO: DatosGrupoAdmin = {
    name: '', categoryId: '', meetingDay: 'Lunes', meetingTime: '20:00',
    location: '', modalidad: 'presencial', description: '', maxCapacity: 12,
    imageUrl: '', coHostFirstName: '', coHostLastName: '',
    minAge: 0, maxAge: 100, targetGender: 'Mixto', tags: [],
    startDate: '', endDate: '', leaderName: '', leaderSurname: '',
};

/**
 * Editar un grupo desde el panel GCX.
 *
 * Mismo formulario que usa el anfitrión para editar el suyo, con el campo de
 * anfitrión agregado: desde acá se puede reasignar el grupo a otra persona.
 *
 * Un grupo que estaba rechazado vuelve a quedar pendiente al guardarse — se
 * avisa arriba, porque es una consecuencia que no se deduce de ningún campo.
 */
const EditarGrupoAdminContent: React.FC = () => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const { showToast } = useAdminGCXToast();

    const [group, setGroup] = useState<Group | null>(null);
    const [loadingGroup, setLoadingGroup] = useState(true);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [availableTags, setAvailableTags] = useState<GroupTag[]>([]);
    const [loading, setLoading] = useState(false);
    const [seasonSettings, setSeasonSettings] = useState<SeasonSettings>(DEFAULT_SEASON_SETTINGS);

    // Anfitrión — se puede reasignar.
    const [hostMode, setHostMode] = useState<'manual' | 'search'>('search');
    const [hostSearchTerm, setHostSearchTerm] = useState('');
    const [hostId, setHostId] = useState<string | null>(null);
    const [hostIdInicial, setHostIdInicial] = useState<string | null>(null);
    const [hostResults, setHostResults] = useState<User[]>([]);
    const [isSearchingHost, setIsSearchingHost] = useState(false);
    const [isHostDropdownOpen, setIsHostDropdownOpen] = useState(false);
    const hostDropdownRef = useRef<HTMLDivElement>(null);

    // Co-anfitrión — opcional.
    const [coHostMode, setCoHostMode] = useState<'manual' | 'search'>('search');
    const [coHostSearchTerm, setCoHostSearchTerm] = useState('');
    const [coHostSearchError, setCoHostSearchError] = useState<string | null>(null);
    // Cuál cuenta descartó quien carga, no un sí/no: si después
    // escribe otro nombre, esa otra cuenta sí se vincula.
    const [coCuentaDescartada, setCoCuentaDescartada] = useState<string | null>(null);
    const [coHostId, setCoHostId] = useState<string | null>(null);
    const [coHostIdInicial, setCoHostIdInicial] = useState<string | null>(null);
    const [coHostResults, setCoHostResults] = useState<User[]>([]);
    const [isSearchingCoHost, setIsSearchingCoHost] = useState(false);
    const [isCoHostDropdownOpen, setIsCoHostDropdownOpen] = useState(false);
    const coHostDropdownRef = useRef<HTMLDivElement>(null);

    const [form, setForm] = useState<DatosGrupoAdmin>(VACIO);

    // El modo a mano también busca la cuenta: escribir el nombre y que
    // la persona quede sin vincular la dejaba fuera del grupo.
    const { cuenta: cuentaCoManual } = useVinculoManual(
        form.coHostFirstName, form.coHostLastName, coHostMode === 'manual');
    const coManualVinculado = cuentaCoManual && cuentaCoManual.id !== coCuentaDescartada ? cuentaCoManual : null;
    const [formInicial, setFormInicial] = useState<DatosGrupoAdmin | null>(null);

    // Abierta cuando el formulario pasó las validaciones: pregunta si
    // cargar el grupo o volver a revisar los datos.
    const [confirmando, setConfirmando] = useState(false);

    // ── Traer el grupo (cualquiera, no sólo los propios) ──
    const fetchGroup = useCallback(async () => {
        if (!groupId) return;
        setLoadingGroup(true);
        try {
            const allGroups = await supabaseService.getGroupsForAdmin();
            const found = allGroups.find(g => g.id === groupId);
            if (!found) {
                navigate('/admingcx/gestion-de-grupos', { replace: true });
                return;
            }
            setGroup(found);

            const inicial: DatosGrupoAdmin = {
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
                startDate: found.startDate ? found.startDate.split('T')[0] : '',
                endDate: found.endDate ? found.endDate.split('T')[0] : '',
                leaderName: found.leaderName || '',
                leaderSurname: found.leaderSurname || '',
            };
            setForm(inicial);
            setFormInicial(inicial);

            const idAnfitrion = (found as any).host_id || null;
            setHostId(idAnfitrion);
            setHostIdInicial(idAnfitrion);
            setHostSearchTerm(`${found.leaderName || ''} ${found.leaderSurname || ''}`.trim());
            // Sin cuenta vinculada, el nombre está escrito a mano.
            setHostMode(idAnfitrion ? 'search' : 'manual');

            const idCo = (found as any).co_host_id || null;
            setCoHostIdInicial(idCo);
            if (idCo) {
                setCoHostMode('search');
                setCoHostId(idCo);
                // Los grupos anotados desde el buscador quedaron con el
                // co_host_id puesto y estas dos columnas vacías, y el chip se
                // arma con ellas: sin esto vuelve en blanco. Se resuelve por
                // id, que es el dato que sí está.
                const nombreCo = `${found.coHostFirstName || ''} ${found.coHostLastName || ''}`.trim();
                setCoHostSearchTerm(nombreCo || await supabaseService.nombreDeUsuario((found as any).co_host_id));
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
        if (hostMode !== 'search' || !hostSearchTerm.trim()) {
            setHostResults([]);
            setIsHostDropdownOpen(false);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingHost(true);
            try {
                const results = await supabaseService.searchPotentialHosts(hostSearchTerm);
                setHostResults(results || []);
                setIsHostDropdownOpen(true);
            } catch { setHostResults([]); }
            finally { setIsSearchingHost(false); }
        }, 350);
        return () => clearTimeout(timer);
    }, [hostSearchTerm, hostMode]);

    useEffect(() => {
        if (coHostMode !== 'search' || !coHostSearchTerm.trim()) {
            setCoHostResults([]);
            setIsCoHostDropdownOpen(false);
            setCoHostSearchError(null);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingCoHost(true);
            try {
                const { data, error } = await supabase.rpc('buscar_personas', {
                    p_termino: coHostSearchTerm,
                    p_por_email: true,
                    p_solo_activos: true,
                    p_limite: 8,
                });
                // La RPC no tira: cuando rebota —sin permiso, o menos de dos
                // letras— vuelve con error y data en null. Tragarlo mostraba
                // "sin resultados", que manda a buscar a la persona por otro
                // lado en vez de avisar que la búsqueda es la que falló.
                if (error) throw error;
                // Nadie es su propio co-anfitrión.
                setCoHostResults(((data as any[]) || []).filter(u => u.id !== hostId));
                setIsCoHostDropdownOpen(true);
                setCoHostSearchError(null);
            } catch (e: any) {
                console.error('[Co-anfitrión] la búsqueda falló:', e);
                setCoHostResults([]);
                setCoHostSearchError('No pudimos buscar. Probá de nuevo.');
                setIsCoHostDropdownOpen(true);
            }
            finally { setIsSearchingCoHost(false); }
        }, 350);
        return () => clearTimeout(timer);
    }, [coHostSearchTerm, coHostMode, hostId]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (hostDropdownRef.current && !hostDropdownRef.current.contains(e.target as Node)) {
                setIsHostDropdownOpen(false);
            }
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

    // "Guardar 2 cambios" en vez de un "Guardar" que no dice nada.
    const cambios = useMemo(() => {
        if (!formInicial) return 0;
        const claves = Object.keys(formInicial) as (keyof DatosGrupoAdmin)[];
        let n = claves.reduce((total, k) => {
            if (k === 'tags') {
                const a = [...(formInicial.tags || [])].sort().join('|');
                const b = [...(form.tags || [])].sort().join('|');
                return total + (a === b ? 0 : 1);
            }
            return total + (String(formInicial[k] ?? '') === String(form[k] ?? '') ? 0 : 1);
        }, 0);
        const coAhora = coHostMode === 'search' ? coHostId : null;
        if (coAhora !== coHostIdInicial) n += 1;
        const anfitrionAhora = hostMode === 'search' ? hostId : null;
        if (anfitrionAhora !== hostIdInicial) n += 1;
        return n;
    }, [form, formInicial, coHostMode, coHostId, coHostIdInicial, hostMode, hostId, hostIdInicial]);

    const currentYear = seasonSettings?.activeYear ?? new Date().getFullYear();
    const resolvedSeasons = seasonSettings?.seasons ?? DEFAULT_SEASON_SETTINGS.seasons;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return showToast('El nombre del grupo es obligatorio.', 'error');
        if (!form.categoryId) return showToast('Elegí una categoría.', 'error');
        if (llevaDireccion(form.modalidad) && !form.location.trim()) return showToast('Falta el barrio o la dirección.', 'error');
        if (!form.description.trim()) return showToast('Falta la descripción.', 'error');
        if (!form.startDate) return showToast('Falta la fecha de arranque.', 'error');
        if (!form.endDate) return showToast('Falta la fecha de fin.', 'error');

        const hayAnfitrion = hostMode === 'search' ? !!hostId : form.leaderName.trim().length > 0;
        if (!hayAnfitrion) {
            return showToast('El grupo necesita un anfitrión: buscalo o escribí su nombre.', 'error');
        }

        const maxCapacityFn = Number(form.maxCapacity);
        const minAgeFn = Number(form.minAge);
        const maxAgeFn = Number(form.maxAge);
        if (maxCapacityFn <= 0) return showToast('La capacidad tiene que ser mayor a 0.', 'error');
        if (minAgeFn < 0) return showToast('La edad mínima no puede ser negativa.', 'error');
        if (maxAgeFn <= 0) return showToast('La edad máxima tiene que ser mayor a 0.', 'error');
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

            const anfitrionElegido = hostResults.find(u => u.id === hostId);

            let finalLeaderName = form.leaderName.trim() || 'Anfitrión';
            let finalLeaderSurname = form.leaderSurname.trim();
            let finalLeaderPhone = group.leaderPhone || '';
            if (hostMode === 'search' && anfitrionElegido) {
                const partes = anfitrionElegido.name.trim().split(/\s+/);
                finalLeaderName = partes[0] || anfitrionElegido.name;
                finalLeaderSurname = partes.slice(1).join(' ') || '';
                finalLeaderPhone = anfitrionElegido.phone || finalLeaderPhone;
            }

            // Editar un grupo rechazado lo devuelve a la cola de revisión, y
            // se limpia el motivo del rechazo: ya no describe lo que hay.
            const estabaRechazado = group.status === 'rejected';
            const finalStatus: Group['status'] = estabaRechazado ? 'pending' : group.status;
            const finalAdminNote = estabaRechazado ? '' : group.adminNote;

            const groupData: any = {
                ...group,
                name: form.name,
                leaderName: finalLeaderName,
                leaderSurname: finalLeaderSurname,
                leaderPhone: finalLeaderPhone,
                meetingDay: form.meetingDay,
                meetingTime: form.meetingTime,
                location: llevaDireccion(form.modalidad) ? form.location : '',
                ...banderasDe(form.modalidad),
                description: form.description,
                maxCapacity: Number(form.maxCapacity),
                imageUrl: finalImageUrl,
                categoryId: form.categoryId,
                tags: form.tags,
                host_id: hostMode === 'search' ? (hostId || undefined) : undefined,
                ...camposDelCoAnfitrion(coHostMode, coHostId, coHostSearchTerm, form, coManualVinculado?.id),
                minAge: Number(form.minAge),
                maxAge: Number(form.maxAge),
                targetGender: form.targetGender,
                startDate: form.startDate,
                endDate: form.endDate,
                status: finalStatus,
                adminNote: finalAdminNote,
            };

            if (
                hostMode === 'search' && hostId && anfitrionElegido
                && anfitrionElegido.role !== 'ANFITRION'
                && !String(anfitrionElegido.role || '').includes('ADMIN')
            ) {
                await supabaseService.promoteUserToHost(hostId);
            }

            const result = await updateGroupDirect(groupData as Group);

            if (result) {
                showToast(estabaRechazado ? 'Cambios guardados. El grupo volvió a quedar pendiente.' : 'Cambios guardados.');
                navigate('/admingcx/gestion-de-grupos');
            } else {
                showToast('No se pudieron guardar los cambios.', 'error');
            }
        } catch (error: any) {
            console.error('[Panel GCX] Error editando el grupo:', error);
            showToast(`No se pudieron guardar los cambios: ${error.message}`, 'error');
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
            modo="editar"
            subtitulo={group.name}
            onVolver={() => navigate('/admingcx/gestion-de-grupos')}
            volverTexto="Grupos"
            form={form}
            setForm={setForm}
            onChange={handleChange}
            categorias={categories}
            etiquetas={availableTags}
            onToggleEtiqueta={toggleTag}
            cambios={cambios}
            aviso={group.status === 'rejected' ? (
                <>Este grupo está rechazado. Al guardar vuelve a la cola de revisión y se borra el motivo del rechazo.</>
            ) : undefined}
            anfitrion={{
                modo: hostMode,
                setModo: setHostMode,
                termino: hostSearchTerm,
                setTermino: setHostSearchTerm,
                id: hostId,
                setId: setHostId,
                resultados: hostResults,
                buscando: isSearchingHost,
                desplegado: isHostDropdownOpen,
                setDesplegado: setIsHostDropdownOpen,
                contenedor: hostDropdownRef,
            }}
            coAnfitrion={{
                modo: coHostMode,
                setModo: setCoHostMode,
                termino: coHostSearchTerm,
                setTermino: setCoHostSearchTerm,
                id: coHostId,
                setId: setCoHostId,
                resultados: coHostResults,
                buscando: isSearchingCoHost,
                errorBusqueda: coHostSearchError,
                cuentaManual: coManualVinculado,
                onDesvincularManual: () => setCoCuentaDescartada(cuentaCoManual?.id ?? null),
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

const EditarGrupoAdmin: React.FC = () => (
    <AdminGCXLayout
        title="Editar el grupo"
        backTo="/admingcx/gestion-de-grupos"
        backLabel="Grupos"
        soloContenido
    >
        <EditarGrupoAdminContent />
    </AdminGCXLayout>
);

export default EditarGrupoAdmin;

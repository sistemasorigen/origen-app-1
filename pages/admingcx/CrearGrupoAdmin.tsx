import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, GroupTag, SeasonSettings, DEFAULT_SEASON_SETTINGS } from '../../types';
import { supabaseService, insertGroupDirect } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import FormularioGrupo, { DatosGrupo } from '../../components/GCX/formulario-grupo';
import { useSpellingAI } from '../../hooks/useSpellingAI';

interface GroupCategory {
    id: string;
    name: string;
    color?: string;
}

const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

/** El formulario del panel guarda además a quién se le asigna el grupo. */
type DatosGrupoAdmin = DatosGrupo & { leaderName: string; leaderSurname: string };

/**
 * Crear un grupo desde el panel GCX.
 *
 * Usa el mismo formulario que el anfitrión — mismas secciones, mismos
 * controles, mismo corrector — con una sola diferencia propia: acá hay que
 * decir de quién es el grupo, porque quien lo está creando no es su
 * anfitrión. Ese campo vive adentro de "Quiénes", que es donde ya estaba el
 * co-anfitrión; no es una caja aparte pegada arriba.
 *
 * La otra diferencia no se ve: un grupo creado desde el panel nace aprobado,
 * mientras que el que crea un anfitrión queda pendiente de revisión.
 */
const CrearGrupoAdminContent: React.FC = () => {
    const navigate = useNavigate();
    const { showToast } = useAdminGCXToast();

    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [availableTags, setAvailableTags] = useState<GroupTag[]>([]);
    const [loading, setLoading] = useState(false);
    const [seasonSettings, setSeasonSettings] = useState<SeasonSettings>(DEFAULT_SEASON_SETTINGS);

    // Anfitrión — obligatorio y exclusivo del panel.
    const [hostMode, setHostMode] = useState<'manual' | 'search'>('search');
    const [hostSearchTerm, setHostSearchTerm] = useState('');
    const [hostId, setHostId] = useState<string | null>(null);
    const [hostResults, setHostResults] = useState<User[]>([]);
    const [isSearchingHost, setIsSearchingHost] = useState(false);
    const [isHostDropdownOpen, setIsHostDropdownOpen] = useState(false);
    const hostDropdownRef = useRef<HTMLDivElement>(null);

    // Co-anfitrión — opcional.
    const [coHostMode, setCoHostMode] = useState<'manual' | 'search'>('search');
    const [coHostSearchTerm, setCoHostSearchTerm] = useState('');
    const [coHostId, setCoHostId] = useState<string | null>(null);
    const [coHostResults, setCoHostResults] = useState<User[]>([]);
    const [isSearchingCoHost, setIsSearchingCoHost] = useState(false);
    const [isCoHostDropdownOpen, setIsCoHostDropdownOpen] = useState(false);
    const coHostDropdownRef = useRef<HTMLDivElement>(null);

    const [form, setForm] = useState<DatosGrupoAdmin>({
        name: '', categoryId: '', meetingDay: 'Lunes', meetingTime: '20:00',
        location: '', isOnline: false, description: '', maxCapacity: 12 as number | string,
        imageUrl: '', coHostFirstName: '', coHostLastName: '',
        minAge: 0 as number | string, maxAge: 100 as number | string,
        targetGender: 'Mixto', tags: [] as string[], startDate: '', endDate: '',
        leaderName: '', leaderSurname: '',
    });

    const [showSpellingWarning, setShowSpellingWarning] = useState(false);
    const {
        isChecking: isCheckingSpelling, isCorrecting, hasErrors: spellingErrors,
        suggestedCorrection, correctionStatus, checkSpelling, fixText, resetState: resetSpelling,
    } = useSpellingAI();

    useEffect(() => {
        const timer = setTimeout(() => {
            if (form.description && form.description.length > 0) checkSpelling(form.description);
            else resetSpelling();
        }, 800);
        return () => clearTimeout(timer);
    }, [form.description, checkSpelling, resetSpelling]);

    const handleFixSpelling = async () => {
        const corrected = await fixText(form.description);
        setForm(prev => ({ ...prev, description: corrected }));
        setShowSpellingWarning(false);
    };

    // "Corregir y guardar" de la hoja: una sola acción. El texto corregido se
    // le pasa a confirmSubmit a mano porque setForm no es sincrónico y el
    // guardado leería la descripción vieja.
    const handleFixAndSave = async () => {
        const corrected = await fixText(form.description);
        setForm(prev => ({ ...prev, description: corrected }));
        setShowSpellingWarning(false);
        await confirmSubmit(corrected);
    };

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
            if (cfg?.groupsConfig?.seasonSettings) {
                const settings = cfg.groupsConfig.seasonSettings;
                setSeasonSettings(settings);

                const year = settings.activeYear ?? new Date().getFullYear();
                const seasons = settings.seasons ?? DEFAULT_SEASON_SETTINGS.seasons;
                const firstOpen = (['S1', 'S2', 'S3'] as const).find(k => seasons[k].isOpen);
                if (firstOpen) {
                    setForm(prev => ({
                        ...prev,
                        startDate: `${year}-${seasons[firstOpen].startDate}`,
                        endDate: `${year}-${seasons[firstOpen].endDate}`,
                    }));
                }
            }
        });
    }, []);

    // Anfitriones: la búsqueda del panel trae también a quien todavía no lo
    // es, para poder promoverlo al guardar.
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
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingCoHost(true);
            try {
                // users dejó de ser legible por cualquiera: la búsqueda pasa
                // por el servidor, igual que en el panel de anfitrión.
                const { data } = await supabase.rpc('buscar_personas', {
                    p_termino: coHostSearchTerm,
                    p_por_email: true,
                    p_solo_activos: true,
                    p_limite: 8,
                });
                // Nadie es su propio co-anfitrión.
                setCoHostResults(((data as any[]) || []).filter(u => u.id !== hostId));
                setIsCoHostDropdownOpen(true);
            } catch { setCoHostResults([]); }
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

    const currentYear = seasonSettings?.activeYear ?? new Date().getFullYear();
    const resolvedSeasons = seasonSettings?.seasons ?? DEFAULT_SEASON_SETTINGS.seasons;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return showToast('El nombre del grupo es obligatorio.', 'error');
        if (!form.categoryId) return showToast('Elegí una categoría.', 'error');
        if (!form.isOnline && !form.location.trim()) return showToast('Falta el barrio o la dirección.', 'error');
        if (!form.description.trim()) return showToast('Falta la descripción.', 'error');
        if (!form.startDate) return showToast('Falta la fecha de arranque.', 'error');
        if (!form.endDate) return showToast('Falta la fecha de fin.', 'error');

        const hayAnfitrion = hostMode === 'search' ? !!hostId : form.leaderName.trim().length > 0;
        if (!hayAnfitrion) {
            return showToast('Asignale un anfitrión: buscalo o escribí su nombre.', 'error');
        }

        const maxCapacityFn = Number(form.maxCapacity);
        const minAgeFn = Number(form.minAge);
        const maxAgeFn = Number(form.maxAge);
        if (maxCapacityFn <= 0) return showToast('La capacidad tiene que ser mayor a 0.', 'error');
        if (minAgeFn < 0) return showToast('La edad mínima no puede ser negativa.', 'error');
        if (maxAgeFn <= 0) return showToast('La edad máxima tiene que ser mayor a 0.', 'error');
        if (minAgeFn > maxAgeFn) return showToast('La edad mínima no puede ser mayor a la máxima.', 'error');
        if (!form.meetingDay) return showToast('Falta el día de encuentro.', 'error');
        if (!form.meetingTime) return showToast('Falta el horario de encuentro.', 'error');

        const today = new Date().toISOString().split('T')[0];
        const isOfficialSeason = (['S1', 'S2', 'S3'] as const).some(key =>
            form.startDate === `${currentYear}-${resolvedSeasons[key].startDate}`
        );
        if (!isOfficialSeason && form.startDate && form.startDate < today) {
            return showToast('La fecha de arranque no puede ser anterior a hoy.', 'error');
        }
        if (form.endDate && form.endDate < today) return showToast('La fecha de fin no puede ser anterior a hoy.', 'error');
        if (form.startDate && form.endDate && form.startDate > form.endDate) {
            return showToast('La fecha de fin tiene que ser posterior a la de arranque.', 'error');
        }

        if (spellingErrors && !showSpellingWarning) {
            setShowSpellingWarning(true);
            return;
        }
        await confirmSubmit();
    };

    const confirmSubmit = async (descripcionCorregida?: string) => {
        setLoading(true);
        setShowSpellingWarning(false);
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
            } else if (finalImageUrl && finalImageUrl.startsWith('http') && !finalImageUrl.includes('supabase.co')) {
                try {
                    const response = await fetch(finalImageUrl);
                    if (!response.ok) throw new Error('No se pudo traer la imagen');
                    const blob = await response.blob();
                    const reader = new FileReader();
                    const base64Promise = new Promise<string>((resolve, reject) => {
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                    });
                    reader.readAsDataURL(blob);
                    const base64Data = await base64Promise;
                    finalImageUrl = await supabaseService.uploadBase64Image(base64Data, 'groups-covers');
                } catch (uploadError: any) {
                    showToast(`No se pudo guardar la portada: ${uploadError.message}`, 'error');
                    setLoading(false);
                    return;
                }
            }

            const anfitrionElegido = hostResults.find(u => u.id === hostId);

            // Buscado: el nombre sale de la cuenta. A mano: sale de lo escrito.
            let finalLeaderName = form.leaderName.trim() || 'Anfitrión';
            let finalLeaderSurname = form.leaderSurname.trim();
            if (hostMode === 'search' && anfitrionElegido) {
                const partes = anfitrionElegido.name.trim().split(/\s+/);
                finalLeaderName = partes[0] || anfitrionElegido.name;
                finalLeaderSurname = partes.slice(1).join(' ') || '';
            }

            const groupData: any = {
                id: generateUUID(),
                name: form.name,
                leaderName: finalLeaderName,
                leaderSurname: finalLeaderSurname,
                leaderPhone: anfitrionElegido?.phone || '',
                meetingDay: form.meetingDay,
                meetingTime: form.meetingTime,
                location: form.isOnline ? '' : form.location,
                isOnline: form.isOnline,
                description: descripcionCorregida ?? form.description,
                maxCapacity: Number(form.maxCapacity),
                imageUrl: finalImageUrl,
                categoryId: form.categoryId,
                membersCount: 0,
                tags: form.tags,
                host_id: hostMode === 'search' ? (hostId || undefined) : undefined,
                co_host_id: coHostMode === 'search' ? coHostId : null,
                coHostFirstName: coHostMode === 'manual' ? form.coHostFirstName : '',
                coHostLastName: coHostMode === 'manual' ? form.coHostLastName : '',
                minAge: Number(form.minAge),
                maxAge: Number(form.maxAge),
                targetGender: form.targetGender,
                startDate: form.startDate,
                endDate: form.endDate,
                // Creado desde el panel: ya viene aprobado. El que crea un
                // anfitrión queda pendiente hasta que alguien lo revise.
                status: 'approved',
            };

            // Si la persona elegida todavía no es anfitrión, se la promueve:
            // sin el rol no puede entrar a administrar el grupo que se le
            // acaba de asignar.
            if (
                hostMode === 'search' && hostId && anfitrionElegido
                && anfitrionElegido.role !== 'ANFITRION'
                && !String(anfitrionElegido.role || '').includes('ADMIN')
            ) {
                await supabaseService.promoteUserToHost(hostId);
            }

            const result = await insertGroupDirect(groupData);

            if (result) {
                showToast('Grupo creado y activo en el catálogo.');
                navigate('/admingcx/gestion-de-grupos');
            } else {
                showToast('No se pudo crear el grupo.', 'error');
            }
        } catch (error: any) {
            console.error('[Panel GCX] Error creando el grupo:', error);
            showToast(`No se pudo crear el grupo: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <FormularioGrupo
            modo="crear"
            subtitulo="Queda activo apenas lo guardes"
            onVolver={() => navigate('/admingcx/gestion-de-grupos')}
            volverTexto="Grupos"
            form={form}
            setForm={setForm}
            onChange={handleChange}
            categorias={categories}
            etiquetas={availableTags}
            onToggleEtiqueta={toggleTag}
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
                desplegado: isCoHostDropdownOpen,
                setDesplegado: setIsCoHostDropdownOpen,
                contenedor: coHostDropdownRef,
            }}
            ortografia={{
                revisando: isCheckingSpelling,
                corrigiendo: isCorrecting,
                hayErrores: spellingErrors,
                estado: correctionStatus,
                sugerencia: suggestedCorrection,
                onCorregir: handleFixSpelling,
                hojaAbierta: showSpellingWarning,
                onCorregirYGuardar: handleFixAndSave,
                onGuardarIgual: () => confirmSubmit(),
                onCerrarHoja: () => setShowSpellingWarning(false),
            }}
            anio={currentYear}
            temporadas={resolvedSeasons}
            onGuardar={handleSubmit}
            guardando={loading}
        />
    );
};

/**
 * El formulario se queda con la pantalla entera, igual que en el panel de
 * anfitrion. El armazon del panel se sigue montando porque trae el toast,
 * pero sin su cabecera: el formulario ya tiene la suya, con la vuelta atras
 * y el boton de guardar, y apilar las dos dejaba dos encabezados.
 */
const CrearGrupoAdmin: React.FC = () => (
    <AdminGCXLayout
        title="Crear un grupo"
        backTo="/admingcx/gestion-de-grupos"
        backLabel="Grupos"
        soloContenido
    >
        <CrearGrupoAdminContent />
    </AdminGCXLayout>
);

export default CrearGrupoAdmin;

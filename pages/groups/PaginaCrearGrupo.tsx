import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { User, GroupTag, SeasonSettings, DEFAULT_SEASON_SETTINGS } from '../../types';
import { supabaseService, insertGroupDirect } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import FormularioGrupo, { DatosGrupo } from '../../components/GCX/formulario-grupo';
import { useSpellingAI } from '../../hooks/useSpellingAI';
import { useTutorial } from '../../src/hooks/useTutorial';
import TutorialInvitation from '../../components/onboarding/InvitacionTutorial';

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

const PaginaCrearGrupo: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const navigate = useNavigate();

    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [availableTags, setAvailableTags] = useState<GroupTag[]>([]);
    const [loading, setLoading] = useState(false);
    const [seasonSettings, setSeasonSettings] = useState<SeasonSettings>(DEFAULT_SEASON_SETTINGS);

    const [localTourStep, setLocalTourStep] = useState(0);

    const [coHostMode, setCoHostMode] = useState<'manual' | 'search'>('search');
    const [coHostSearchTerm, setCoHostSearchTerm] = useState('');
    const [coHostId, setCoHostId] = useState<string | null>(null);
    const [coHostResults, setCoHostResults] = useState<User[]>([]);
    const [isSearchingCoHost, setIsSearchingCoHost] = useState(false);
    const [isCoHostDropdownOpen, setIsCoHostDropdownOpen] = useState(false);
    const coHostDropdownRef = useRef<HTMLDivElement>(null);

    const [form, setForm] = useState<DatosGrupo>({
        name: '', categoryId: '', meetingDay: 'Lunes', meetingTime: '20:00',
        location: '', isOnline: false, description: '', maxCapacity: 12 as number | string,
        imageUrl: '', coHostFirstName: '', coHostLastName: '',
        minAge: 0 as number | string, maxAge: 100 as number | string,
        targetGender: 'Mixto', tags: [] as string[], startDate: '', endDate: ''
    });

    const [showSpellingWarning, setShowSpellingWarning] = useState(false);
    const { isChecking: isCheckingSpelling, isCorrecting, hasErrors: spellingErrors, suggestedCorrection, correctionStatus, checkSpelling, fixText, resetState: resetSpelling } = useSpellingAI();

    const { isActive, showInvitation, startTutorial, completeTutorial, dismissTutorial, declineTemporary, tourSessionId } = useTutorial('createGroup');

    useEffect(() => {
        if (isActive) setLocalTourStep(1);
    }, [isActive, tourSessionId]);

    useEffect(() => {
        if (localTourStep > 0) {
            const element = document.getElementById(`tour-wrap-${localTourStep}`);
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [localTourStep]);

    const handleTourNext = (step: number) => setLocalTourStep(step);
    const handleTourFinish = () => { setLocalTourStep(0); completeTutorial(); };
    const handleTourSkip = () => { setLocalTourStep(0); dismissTutorial(); };

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
                supabaseService.getGroupTags()
            ]);
            setCategories(cats);
            setAvailableTags(tags);
        };
        loadData();

        supabaseService.getAppConfig().then(cfg => {
            if (cfg?.groupsConfig?.seasonSettings) {
                const settings = cfg.groupsConfig.seasonSettings;
                setSeasonSettings(settings);

                // Auto-seleccionar la primera temporada habilitada
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

    useEffect(() => {
        if (coHostMode !== 'search' || !coHostSearchTerm.trim()) {
            setCoHostResults([]);
            setIsCoHostDropdownOpen(false);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingCoHost(true);
            try {
                // users ya no es legible por cualquier usuario: la búsqueda
                // pasa por el servidor, que solo la permite a anfitriones y
                // staff. Además tolera comas y comodines en lo tipeado, que
                // rompían el filtro .or() armado a mano.
                const { data } = await supabase.rpc('buscar_personas', {
                    p_termino: coHostSearchTerm,
                    p_por_email: true,
                    p_solo_activos: true,
                    p_limite: 8
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

    const currentYear = seasonSettings?.activeYear ?? new Date().getFullYear();
    const resolvedSeasons = seasonSettings?.seasons ?? DEFAULT_SEASON_SETTINGS.seasons;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return alert('El nombre del grupo es obligatorio');
        if (!form.categoryId) return alert('Debes seleccionar una categoría.');
        if (!form.isOnline && !form.location.trim()) return alert('El barrio/ubicación es obligatorio.');
        if (!form.description.trim()) return alert('La descripción es obligatoria.');
        if (!form.startDate) return alert('La fecha de arranque es obligatoria.');
        if (!form.endDate) return alert('La fecha de fin es obligatoria.');

        const maxCapacityFn = Number(form.maxCapacity);
        const minAgeFn = Number(form.minAge);
        const maxAgeFn = Number(form.maxAge);
        if (maxCapacityFn <= 0) return alert('La capacidad debe ser mayor a 0.');
        if (minAgeFn < 0) return alert('La edad mínima no puede ser negativa.');
        if (maxAgeFn <= 0) return alert('La edad máxima debe ser mayor a 0.');
        if (minAgeFn > maxAgeFn) return alert('La edad mínima no puede ser mayor a la edad máxima.');
        if (!form.meetingDay) return alert('El día de encuentro es obligatorio.');
        if (!form.meetingTime) return alert('El horario de encuentro es obligatorio.');

        const today = new Date().toISOString().split('T')[0];
        const isOfficialSeason = (['S1', 'S2', 'S3'] as const).some(key =>
            form.startDate === `${currentYear}-${resolvedSeasons[key].startDate}`
        );
        if (!isOfficialSeason && form.startDate && form.startDate < today) {
            return alert('La fecha de arranque no puede ser anterior a hoy.');
        }
        if (form.endDate && form.endDate < today) return alert('La fecha de fin no puede ser anterior a hoy.');
        if (form.startDate && form.endDate && form.startDate > form.endDate) {
            return alert('La fecha de fin debe ser posterior a la fecha de arranque.');
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
                    alert(`Error al guardar la imagen generada: ${uploadError.message}`);
                    setLoading(false);
                    return;
                }
            } else if (finalImageUrl && finalImageUrl.startsWith('http') && !finalImageUrl.includes('supabase.co')) {
                try {
                    const response = await fetch(finalImageUrl);
                    if (!response.ok) throw new Error('Failed to fetch remote image');
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
                    alert(`Error al guardar la imagen generada: ${uploadError.message}`);
                    setLoading(false);
                    return;
                }
            }

            const fullName = currentUser?.name || 'Anfitrión';
            const nameParts = fullName.trim().split(/\s+/);
            const finalLeaderName = nameParts[0] || 'Anfitrión';
            const finalLeaderSurname = nameParts.slice(1).join(' ') || '';

            const groupData: any = {
                id: generateUUID(),
                name: form.name,
                leaderName: finalLeaderName,
                leaderSurname: finalLeaderSurname,
                leaderPhone: '',
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
                host_id: currentUser?.id,
                co_host_id: coHostMode === 'search' ? coHostId : null,
                coHostFirstName: coHostMode === 'manual' ? form.coHostFirstName : '',
                coHostLastName: coHostMode === 'manual' ? form.coHostLastName : '',
                minAge: Number(form.minAge),
                maxAge: Number(form.maxAge),
                targetGender: form.targetGender,
                startDate: form.startDate,
                endDate: form.endDate,
                status: 'pending',
            };

            const result = await insertGroupDirect(groupData);

            if (result) {
                navigate('/mis-grupos');
            } else {
                alert('Error al guardar. Verifica consola.');
            }
        } catch (error: any) {
            console.error('Error saving group:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {showInvitation && typeof document !== 'undefined' && createPortal(
                <TutorialInvitation
                    isOpen={showInvitation}
                    onStart={startTutorial}
                    onClose={declineTemporary}
                    onDismiss={dismissTutorial}
                    title="Configura tu Nuevo Grupo"
                    disableScrollLock={true}
                />,
                document.body
            )}

            <FormularioGrupo
                modo="crear"
                subtitulo="Un administrador lo revisa antes de activarlo"
                onVolver={() => navigate('/mis-grupos')}
                form={form}
                setForm={setForm}
                onChange={handleChange}
                categorias={categories}
                etiquetas={availableTags}
                onToggleEtiqueta={toggleTag}
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
                tour={{
                    paso: localTourStep,
                    onSiguiente: handleTourNext,
                    onSaltar: handleTourSkip,
                    onTerminar: handleTourFinish,
                }}
            />
        </>
    );
};

export default PaginaCrearGrupo;

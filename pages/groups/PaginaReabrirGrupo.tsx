import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Group, User, GroupTag, SeasonSettings, DEFAULT_SEASON_SETTINGS, CamposReapertura } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import { Check, Loader2 } from 'lucide-react';
import FormularioGrupo, { DatosGrupo } from '../../components/GCX/formulario-grupo';
import { T, btnPrimarioBase, rotulo } from '../../components/GCX/patron';
import { useSpellingAI } from '../../hooks/useSpellingAI';

interface GroupCategory {
    id: string;
    name: string;
    color?: string;
}

const PaginaReabrirGrupo: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [loadingGroup, setLoadingGroup] = useState(true);

    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [availableTags, setAvailableTags] = useState<GroupTag[]>([]);
    const [loading, setLoading] = useState(false);
    const [seasonSettings, setSeasonSettings] = useState<SeasonSettings>(DEFAULT_SEASON_SETTINGS);

    const [showSuccessScreen, setShowSuccessScreen] = useState(false);

    const [coHostMode, setCoHostMode] = useState<'manual' | 'search'>('manual');
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

    // Temporada con la que terminó el grupo. Sirve para no dejar mandar la
    // solicitud sin haber elegido una distinta.
    const [fechasOriginales, setFechasOriginales] = useState<{ startDate: string; endDate: string } | null>(null);

    const [showSpellingWarning, setShowSpellingWarning] = useState(false);
    const { isChecking: isCheckingSpelling, isCorrecting, hasErrors: spellingErrors, suggestedCorrection, correctionStatus, checkSpelling, fixText, resetState: resetSpelling } = useSpellingAI();

    // ── Fetch del grupo ──────────────────────────
    const fetchGroup = useCallback(async () => {
        if (!currentUser || !groupId) return;
        setLoadingGroup(true);
        try {
            const owned = await supabaseService.getGroupsByHost(currentUser.id);
            const found = owned.find(g => g.id === groupId);
            if (!found) {
                navigate('/mis-grupos', { replace: true });
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
                // isOnline no existía en esta pantalla, y por eso la validación
                // de abajo exigía dirección hasta para un grupo online, que no
                // la tiene: reabrir un grupo online era imposible.
                isOnline: found.isOnline || false,
                description: found.description || '',
                maxCapacity: found.maxCapacity || 12,
                imageUrl: found.imageUrl || '',
                coHostFirstName: found.coHostFirstName || '',
                coHostLastName: found.coHostLastName || '',
                minAge: found.minAge || 0,
                maxAge: found.maxAge || 100,
                targetGender: found.targetGender || 'Mixto',
                tags: found.tags || [],
                startDate: desde,
                endDate: hasta
            });
            setFechasOriginales({ startDate: desde, endDate: hasta });
            if ((found as any).co_host_id) {
                setCoHostMode('search');
                setCoHostId((found as any).co_host_id);
                setCoHostSearchTerm(`${found.coHostFirstName || ''} ${found.coHostLastName || ''}`.trim());
            }
        } finally {
            setLoadingGroup(false);
        }
    }, [currentUser, groupId, navigate]);

    useEffect(() => { fetchGroup(); }, [fetchGroup]);

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
                setSeasonSettings(cfg.groupsConfig.seasonSettings);
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
                const { data } = await supabase
                    .from('users')
                    .select('id, name, email, role')
                    .or(`name.ilike.%${coHostSearchTerm}%,email.ilike.%${coHostSearchTerm}%`)
                    .eq('is_active', true)
                    .limit(8);
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

    // La temporada nueva sigue siendo la decisión obligatoria: el resto del
    // formulario se puede ajustar, pero reabrir para la misma temporada que
    // ya terminó crearía un duplicado. Mientras no cambie, no hay nada que
    // enviar y el botón queda apagado.
    const temporadaElegida = useMemo(() => {
        if (!fechasOriginales) return 0;
        const igual = form.startDate === fechasOriginales.startDate && form.endDate === fechasOriginales.endDate;
        return igual ? 0 : 1;
    }, [form.startDate, form.endDate, fechasOriginales]);

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
        if (!group) return;
        setLoading(true);
        setShowSpellingWarning(false);
        try {
            // Una portada nueva llega como data: URL (o como URL remota si la
            // generó la IA). Guardarla así metería el base64 entero en la fila
            // del grupo: hay que subirla al bucket y quedarse con la URL.
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

            // Re-abrir clona el grupo original con las fechas nuevas. Lo que
            // el anfitrión haya tocado en el formulario viaja como `cambios`
            // y pisa lo copiado; lo que no está acá (anfitrión, estado,
            // linaje) lo resuelve el servicio.
            const cambiosDelFormulario: CamposReapertura = {
                name: form.name.trim(),
                meetingDay: form.meetingDay,
                meetingTime: form.meetingTime,
                location: form.isOnline ? '' : form.location,
                isOnline: form.isOnline,
                description: descripcionCorregida ?? form.description,
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

            const result = await supabaseService.cloneGroupForNewSeason(
                group.id,
                form.startDate,
                form.endDate,
                false,
                cambiosDelFormulario
            );

            if (result) {
                setShowSuccessScreen(true);
            } else {
                alert('Error al enviar la solicitud. Verifica consola.');
            }
        } catch (error: any) {
            console.error('Error saving group:', error);
            alert(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (loadingGroup) return (
        <div className={`min-h-screen flex items-center justify-center ${T.fondo}`}>
            <Loader2 className="w-8 h-8 animate-spin text-black/20 dark:text-white/20" />
        </div>
    );

    if (!group) return null;

    if (showSuccessScreen) {
        return (
            <div className={`min-h-screen ${T.fondo} ${T.fuente} ${T.tinta} flex items-center justify-center px-4`}>
                <div className="w-full max-w-[430px] bg-white dark:bg-[#1b1b1a] rounded-[28px] px-6 py-11 flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-[#0a0a0a] dark:bg-white flex items-center justify-center">
                        <Check className="w-8 h-8 text-white dark:text-black" strokeWidth={2.6} />
                    </div>
                    <p className="mt-6 text-[21px] font-semibold tracking-[-.01em]">Solicitud enviada</p>
                    <p className="mt-2.5 max-w-[300px] text-[14.5px] leading-[1.6] font-medium text-black/50 dark:text-white/50">
                        Se creó un grupo nuevo para la temporada que elegiste. Un administrador lo
                        revisa antes de que quede activo.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/mis-grupos')}
                        className={`${btnPrimarioBase} w-full h-[58px] text-[16.5px] mt-7`}
                    >
                        Volver a mis grupos
                    </button>
                </div>
            </div>
        );
    }

    return (
        <FormularioGrupo
            modo="reabrir"
            subtitulo={group.name}
            onVolver={() => navigate(`/mis-grupos/${groupId}`)}
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
            cambios={temporadaElegida}
            textoGuardar="Enviar la solicitud"
            aviso={(
                <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px] px-[18px] py-4 lg:rounded-[28px] lg:px-7 lg:py-5">
                    <p className={rotulo}>Grupo finalizado</p>
                    <p className="mt-2 text-[14px] leading-[1.6] font-medium text-black/60 dark:text-white/60">
                        {group.name} terminó su temporada. Reabrirlo no lo revive: crea un grupo
                        nuevo y vacío, con los datos que dejes abajo, que un administrador tiene
                        que aprobar.
                    </p>
                </div>
            )}
        />
    );
};

export default PaginaReabrirGrupo;

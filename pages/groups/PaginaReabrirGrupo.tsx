import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { Group, User, GroupTag, SeasonSettings, DEFAULT_SEASON_SETTINGS } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import { ArrowLeft, Save, Search, Check, ChevronDown, Wand2, X, Loader2 } from 'lucide-react';
import ImageUpload from '../../components/media/SubidaImagen';
import { useSpellingAI } from '../../hooks/useSpellingAI';
import { useTutorial } from '../../src/hooks/useTutorial';
import TutorialInvitation from '../../components/onboarding/InvitacionTutorial';

interface GroupCategory {
    id: string;
    name: string;
    color?: string;
}

interface NativeTooltipProps {
    title: string;
    description: string;
    step: number;
    totalSteps: number;
    onNext: () => void;
    onSkip: () => void;
    isLast?: boolean;
    placement?: 'bottom' | 'top';
    align?: 'left' | 'right' | 'center';
}

const NativeTooltip: React.FC<NativeTooltipProps> = ({ title, description, step, totalSteps, onNext, onSkip, isLast = false, placement = 'bottom', align = 'left' }) => {
    const isTop = placement === 'top';
    let alignClass = 'left-0';
    if (align === 'right') alignClass = 'right-0';
    else if (align === 'center') alignClass = 'left-1/2 -translate-x-1/2';

    return (
        <div className={`absolute w-72 z-[9999] bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 shadow-lg animate-fadeIn text-left ${isTop ? 'bottom-full mb-3' : 'top-full mt-3'} ${alignClass}`}>
            <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-black uppercase leading-tight">{title}</h3>
                <span className="text-xs font-bold bg-neutral-100 px-2 py-1 rounded border border-neutral-200">{step} / {totalSteps}</span>
            </div>
            <p className="text-sm font-medium text-neutral-600 mb-6 leading-relaxed">{description}</p>
            <div className="flex items-center justify-between">
                <button onClick={onSkip} type="button" className="text-xs font-bold uppercase text-neutral-400 hover:text-black transition-colors">Saltar</button>
                <button onClick={onNext} type="button" className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold uppercase px-6 py-2 rounded-lg hover:opacity-90 transition-all">
                    {isLast ? 'Finalizar' : 'Siguiente'}
                </button>
            </div>
            <div className={`absolute w-4 h-4 bg-white border-l-[3px] border-t-[3px] border-black transform rotate-45 ${isTop ? '-bottom-2.5 rotate-[225deg]' : '-top-2.5'} ${align === 'right' ? 'right-8' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-8'}`}></div>
        </div>
    );
};

const MEETING_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TARGET_GENDERS = ['Mixto', 'Hombre', 'Mujer'];

const PaginaReabrirGrupo: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [loadingGroup, setLoadingGroup] = useState(true);

    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [availableTags, setAvailableTags] = useState<GroupTag[]>([]);
    const [loading, setLoading] = useState(false);
    const [seasonSettings, setSeasonSettings] = useState<SeasonSettings>(DEFAULT_SEASON_SETTINGS);

    const [localTourStep, setLocalTourStep] = useState(0);
    const [showSuccessScreen, setShowSuccessScreen] = useState(false);

    const [coHostMode, setCoHostMode] = useState<'manual' | 'search'>('manual');
    const [coHostSearchTerm, setCoHostSearchTerm] = useState('');
    const [coHostId, setCoHostId] = useState<string | null>(null);
    const [coHostResults, setCoHostResults] = useState<User[]>([]);
    const [isSearchingCoHost, setIsSearchingCoHost] = useState(false);
    const [isCoHostDropdownOpen, setIsCoHostDropdownOpen] = useState(false);
    const coHostDropdownRef = useRef<HTMLDivElement>(null);

    const [form, setForm] = useState({
        name: '', categoryId: '', meetingDay: 'Lunes', meetingTime: '20:00',
        location: '', description: '', maxCapacity: 12 as number | string,
        imageUrl: '', coHostFirstName: '', coHostLastName: '',
        minAge: 0 as number | string, maxAge: 100 as number | string,
        targetGender: 'Mixto', tags: [] as string[], startDate: '', endDate: ''
    });

    const [showSpellingWarning, setShowSpellingWarning] = useState(false);
    const { isChecking: isCheckingSpelling, isCorrecting, hasErrors: spellingErrors, correctionStatus, checkSpelling, fixText, resetState: resetSpelling } = useSpellingAI();

    const { isActive, showInvitation, startTutorial, completeTutorial, dismissTutorial, declineTemporary, tourSessionId } = useTutorial('createGroup');

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
            setForm({
                name: found.name || '',
                categoryId: found.categoryId || '',
                meetingDay: found.meetingDay || 'Lunes',
                meetingTime: found.meetingTime || '20:00',
                location: found.location || '',
                description: found.description || '',
                maxCapacity: found.maxCapacity || 12,
                imageUrl: found.imageUrl || '',
                coHostFirstName: found.coHostFirstName || '',
                coHostLastName: found.coHostLastName || '',
                minAge: found.minAge || 0,
                maxAge: found.maxAge || 100,
                targetGender: found.targetGender || 'Mixto',
                tags: found.tags || [],
                startDate: found.startDate ? found.startDate.split('T')[0] : '',
                endDate: found.endDate ? found.endDate.split('T')[0] : ''
            });
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return alert('El nombre del grupo es obligatorio');
        if (!form.categoryId) return alert('Debes seleccionar una categoría.');
        if (!form.location.trim()) return alert('El barrio/ubicación es obligatorio.');
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

    const confirmSubmit = async () => {
        if (!group) return;
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

            // Re-abrir: clona el grupo original con las
            // fechas nuevas. cloneGroupForNewSeason ignora
            // el resto del formulario y relee todo lo demás
            // fresco desde la fila actual del grupo en la DB
            // (comportamiento idéntico al modal original).
            const result = await supabaseService.cloneGroupForNewSeason(
                group.id,
                form.startDate,
                form.endDate,
                false
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
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
    );

    if (!group) return null;

    if (showSuccessScreen) {
        return (
            <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4">
                <div className="max-w-sm w-full flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center shadow-inner">
                        <Check className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-black uppercase tracking-tight text-black dark:text-white">
                        ¡Solicitud Enviada!
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                        Se creó un nuevo grupo para la temporada seleccionada. El administrador lo revisará antes de que quede activo.
                    </p>
                    <button
                        onClick={() => navigate('/mis-grupos')}
                        className="w-full py-4 bg-[#118f46] text-white font-semibold uppercase tracking-wide rounded-xl hover:bg-[#0d7036] transition-all shadow-sm active:scale-[0.98]"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-2xl mx-auto px-4 md:px-8 py-8">

                <button
                    onClick={() => navigate(`/mis-grupos/${groupId}`)}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-black dark:hover:text-white transition-colors mb-6 font-bold uppercase tracking-wide"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {group.name}
                </button>

                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black dark:text-white mb-6">
                    Solicitud de Re-Apertura
                </h1>

                {group.status === 'rejected' && (
                    <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-xs font-bold text-red-600 uppercase">
                            Al guardar, se enviará a revisión nuevamente
                        </p>
                    </div>
                )}

                {showInvitation && typeof document !== 'undefined' && createPortal(
                    <TutorialInvitation
                        isOpen={showInvitation}
                        onStart={startTutorial}
                        onClose={declineTemporary}
                        onDismiss={dismissTutorial}
                        title="Configura tu Grupo"
                        disableScrollLock={true}
                    />,
                    document.body
                )}

                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* IMAGEN — TOUR 1 */}
                    <div id="tour-wrap-1" className={`space-y-4 relative transition-all duration-300 rounded-xl ${localTourStep === 1 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}>
                        {localTourStep === 1 && (
                            <NativeTooltip title="La Portada de tu Grupo" description="Sube una foto atractiva de tu galería para usar como portada." step={1} totalSteps={9} onNext={() => handleTourNext(2)} onSkip={handleTourSkip} />
                        )}
                        <label className="text-xs font-black uppercase tracking-widest block flex items-center gap-2">
                            Imagen de Portada
                            <span className="bg-neutral-200 text-neutral-600 px-2 py-0.5 font-bold uppercase text-[10px]">Recomendado: 1280x720 (16:9)</span>
                        </label>
                        <ImageUpload currentImage={form.imageUrl} folder="groups" onImageUpload={(url) => setForm(prev => ({ ...prev, imageUrl: url }))} aspectRatio="wide" placeholder="Subir portada del grupo" />
                    </div>

                    {/* NOMBRE — TOUR 2 */}
                    <div id="tour-wrap-2" className={`space-y-1 relative transition-all duration-300 rounded-xl ${localTourStep === 2 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}>
                        {localTourStep === 2 && (
                            <NativeTooltip title="Nombra tu Grupo" description="Elige un nombre claro y llamativo. Ej: 'Jóvenes Emprendedores' o 'Estudio de Juan'." step={2} totalSteps={9} onNext={() => handleTourNext(3)} onSkip={handleTourSkip} />
                        )}
                        <label className="text-xs font-black uppercase tracking-widest block">Nombre del Grupo</label>
                        <input type="text" name="name" value={form.name} onChange={handleChange} className="w-full h-12 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg outline-none font-medium text-lg bg-white dark:bg-zinc-900 text-black dark:text-white focus:ring-4 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-all" required placeholder="Ej: Jóvenes Profesionales" />
                    </div>

                    {/* DESCRIPCIÓN — TOUR 3 */}
                    <div id="tour-wrap-3" className={`space-y-1 relative transition-all duration-300 rounded-xl ${localTourStep === 3 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}>
                        {localTourStep === 3 && (
                            <NativeTooltip title="Detalles y Propósito" description="Explica de qué trata el grupo, qué harán y a quién va dirigido. No te preocupes por la ortografía, nuestra IA la corregirá automáticamente." step={3} totalSteps={9} onNext={() => handleTourNext(4)} onSkip={handleTourSkip} />
                        )}
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-black uppercase tracking-widest block">Descripción</label>
                            {(spellingErrors || correctionStatus === 'correcting' || correctionStatus === 'success') && (
                                <button type="button" onClick={handleFixSpelling} disabled={isCorrecting} className={`rounded-lg font-semibold uppercase text-xs px-3 py-1.5 flex items-center gap-1 transition-all ${correctionStatus === 'correcting' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 animate-pulse cursor-wait' : correctionStatus === 'success' ? 'bg-[#118f46] text-white shadow-sm' : 'bg-yellow-400 text-black shadow-sm hover:opacity-90 animate-scaleIn'}`}>
                                    <Wand2 className="w-3 h-3" />
                                    {correctionStatus === 'correcting' ? 'Corrigiendo...' : correctionStatus === 'success' ? 'Corregido ✓' : 'Corregir'}
                                </button>
                            )}
                        </div>
                        <textarea name="description" value={form.description} onChange={handleChange} rows={3} className={`w-full p-3 border-2 rounded-none outline-none font-medium resize-none transition-colors ${spellingErrors && correctionStatus !== 'success' ? 'border-red-500 bg-red-50' : 'border-black'}`} />
                        {isCheckingSpelling && <p className="text-[10px] text-neutral-400 font-bold uppercase animate-pulse">Analizando con IA...</p>}
                    </div>

                    {/* CATEGORÍA Y UBICACIÓN — TOUR 4 y 5 */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest block">Categoría y Ubicación</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div id="tour-wrap-4" className={`relative transition-all duration-300 rounded-xl ${localTourStep === 4 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}>
                                {localTourStep === 4 && (
                                    <NativeTooltip title="Categoría Principal" description="Clasifica tu grupo para que las personas puedan encontrarlo fácilmente en el buscador." step={4} totalSteps={9} onNext={() => handleTourNext(5)} onSkip={handleTourSkip} />
                                )}
                                <div className="relative">
                                    <select name="categoryId" value={form.categoryId} onChange={handleChange} className="w-full h-12 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg outline-none font-medium bg-white dark:bg-zinc-900 text-black dark:text-white appearance-none relative z-10">
                                        <option value="">-- Seleccionar --</option>
                                        {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10" />
                                </div>
                            </div>
                            <div id="tour-wrap-5" className={`relative transition-all duration-300 rounded-xl ${localTourStep === 5 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}>
                                {localTourStep === 5 && (
                                    <NativeTooltip title="Punto de Encuentro" description="Escribe la dirección exacta, el barrio o el nombre del local donde se reunirán." step={5} totalSteps={9} onNext={() => handleTourNext(6)} onSkip={handleTourSkip} />
                                )}
                                <input type="text" name="location" value={form.location} onChange={handleChange} className="w-full h-12 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg outline-none font-medium bg-white dark:bg-zinc-900 text-black dark:text-white" placeholder="Dirección o punto de encuentro" />
                            </div>
                        </div>
                    </div>

                    {/* DÍA Y HORA — TOUR 6 */}
                    <div id="tour-wrap-6" className={`space-y-2 relative transition-all duration-300 rounded-xl ${localTourStep === 6 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}>
                        {localTourStep === 6 && (
                            <NativeTooltip title="Agenda tu Reunión" description="Selecciona el día de la semana y la hora en la que se juntarán. La constancia es clave." step={6} totalSteps={9} onNext={() => handleTourNext(7)} onSkip={handleTourSkip} />
                        )}
                        <label className="text-xs font-black uppercase tracking-widest block">Horario de Reunión</label>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="relative">
                                <select name="meetingDay" value={form.meetingDay} onChange={handleChange} className="w-full h-12 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg outline-none font-medium bg-white dark:bg-zinc-900 text-black dark:text-white appearance-none">
                                    {MEETING_DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                            </div>
                            <input type="time" name="meetingTime" value={form.meetingTime} onChange={handleChange} className="w-full h-12 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg outline-none font-medium bg-white dark:bg-zinc-900 text-black dark:text-white" />
                        </div>
                    </div>

                    {/* TEMPORADAS — TOUR 7 */}
                    <div id="tour-wrap-7" className={`space-y-4 relative transition-all duration-300 rounded-xl ${localTourStep === 7 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}>
                        {localTourStep === 7 && (
                            <NativeTooltip title="Duración del Grupo" description="Elije una temporada predefinida para sumarte al ritmo de toda la comunidad." step={7} totalSteps={9} onNext={() => handleTourNext(8)} onSkip={handleTourSkip} />
                        )}
                        <label className="text-xs font-black uppercase tracking-widest block">Duración del Grupo</label>
                        <div className="grid grid-cols-1 gap-3">
                            {(['S1', 'S2', 'S3'] as const).map(key => {
                                const season = resolvedSeasons[key];
                                const isLocked = !season.isOpen;
                                const fullStart = `${currentYear}-${season.startDate}`;
                                const fullEnd = `${currentYear}-${season.endDate}`;
                                const isSelected = form.startDate === fullStart && form.endDate === fullEnd;
                                return (
                                    <button key={key} type="button" disabled={isLocked} onClick={() => { if (!isLocked) setForm(prev => ({ ...prev, startDate: fullStart, endDate: fullEnd })); }}
                                        className={`p-4 border-2 text-left transition-all ${isLocked ? 'border-neutral-100 bg-neutral-50 opacity-50 cursor-not-allowed' : isSelected ? 'border-[#118f46] bg-[#118f46]/5 relative' : 'border-neutral-200 hover:border-black'}`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black uppercase text-sm">{season.label}</span>
                                                {isLocked && <span className="text-[10px] bg-neutral-200 text-neutral-500 px-2 py-0.5 rounded-full">No disponible</span>}
                                            </div>
                                            {!isLocked && isSelected && <div className="bg-[#118f46] text-white p-1 rounded-full"><Check className="w-3 h-3" /></div>}
                                        </div>
                                        <span className="text-xs text-neutral-500 font-medium block mt-1">
                                            {new Date(fullStart + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                                            {' — '}
                                            {new Date(fullEnd + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                                            {' '}{currentYear}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        {/* Fecha manual — solo si el grupo ya tenía
                            fechas fuera de las temporadas oficiales */}
                        {!(['S1', 'S2', 'S3'] as const).some(key =>
                            form.startDate === `${currentYear}-${resolvedSeasons[key].startDate}` &&
                            form.endDate === `${currentYear}-${resolvedSeasons[key].endDate}`
                        ) && form.startDate && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn pt-2 border-t border-neutral-100">
                                <div className="space-y-1">
                                    <label className="text-xs font-black uppercase tracking-widest h-8 flex items-end">Fecha de Arranque (actual)</label>
                                    <div className="relative">
                                        <input type="date" name="startDate" value={form.startDate} onChange={handleChange} className="w-full h-12 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg outline-none font-medium bg-white dark:bg-zinc-900 text-black dark:text-white" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-black uppercase tracking-widest h-8 flex items-end">Fin del Grupo (actual)</label>
                                    <div className="relative">
                                        <input type="date" name="endDate" value={form.endDate} onChange={handleChange} className="w-full h-12 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg outline-none font-medium bg-white dark:bg-zinc-900 text-black dark:text-white" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ETIQUETAS */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest block">Etiquetas del Grupo</label>
                        <div className="flex flex-wrap gap-2">
                            {availableTags.map(tag => (
                                <button type="button" key={tag.id} onClick={() => toggleTag(tag.id)} className={`px-3 py-1 text-[10px] font-semibold uppercase rounded-full border transition-all ${form.tags.includes(tag.id) ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white' : 'bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}>
                                    {tag.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* CO-ANFITRIÓN */}
                    <div className="space-y-3 border-t border-slate-200 dark:border-zinc-800 pt-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Co-Anfitrión <span className="font-medium normal-case text-neutral-300">(Opcional)</span></p>
                            <div className="flex bg-neutral-100 p-1 rounded-full border border-neutral-200">
                                <button type="button" onClick={() => { setCoHostMode('manual'); setCoHostId(null); setCoHostSearchTerm(''); }} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${coHostMode === 'manual' ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:text-black'}`}>Manual</button>
                                <button type="button" onClick={() => { setCoHostMode('search'); setForm(prev => ({ ...prev, coHostFirstName: '', coHostLastName: '' })); }} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${coHostMode === 'search' ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:text-black'}`}>Buscar Usuario</button>
                            </div>
                        </div>

                        {coHostMode === 'manual' ? (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase block">Nombre</label>
                                    <input type="text" name="coHostFirstName" value={form.coHostFirstName} onChange={handleChange} className="w-full h-10 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg outline-none font-medium bg-white dark:bg-zinc-900 text-black dark:text-white" placeholder="Nombre" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold uppercase block">Apellido</label>
                                    <input type="text" name="coHostLastName" value={form.coHostLastName} onChange={handleChange} className="w-full h-10 px-3 border border-slate-300 dark:border-zinc-700 rounded-lg outline-none font-medium bg-white dark:bg-zinc-900 text-black dark:text-white" placeholder="Apellido" />
                                </div>
                            </div>
                        ) : (
                            <div ref={coHostDropdownRef} className="relative">
                                {coHostId ? (
                                    <div className="flex items-center justify-between h-10 px-3 border-2 border-[#118f46] bg-[#118f46]/5 font-bold">
                                        <span className="text-sm font-black text-[#118f46] flex items-center gap-2"><Check className="w-4 h-4" />{coHostSearchTerm}</span>
                                        <button type="button" onClick={() => { setCoHostId(null); setCoHostSearchTerm(''); }} className="text-neutral-400 hover:text-black transition-colors"><X className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                        <input type="text" value={coHostSearchTerm} onChange={e => { setCoHostSearchTerm(e.target.value); setCoHostId(null); }} onFocus={() => coHostResults.length > 0 && setIsCoHostDropdownOpen(true)} placeholder="Buscar por nombre o email..." className="w-full h-10 pl-10 pr-3 border border-slate-300 dark:border-zinc-700 rounded-lg outline-none font-medium bg-white dark:bg-zinc-900 text-black dark:text-white placeholder:font-normal" />
                                        {isSearchingCoHost && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-neutral-400 animate-pulse">Buscando...</span>}
                                    </div>
                                )}
                                {isCoHostDropdownOpen && !coHostId && coHostResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg mt-1 max-h-48 overflow-y-auto z-[99999] shadow-lg">
                                        {coHostResults.map(u => (
                                            <button key={u.id} type="button" onMouseDown={(e) => { e.preventDefault(); setCoHostId(u.id); setCoHostSearchTerm(u.name); setIsCoHostDropdownOpen(false); }} className="w-full flex items-center gap-3 p-3 text-left border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
                                                <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-black text-xs shrink-0">{u.name.substring(0, 2).toUpperCase()}</div>
                                                <div className="min-w-0"><p className="font-black text-sm truncate">{u.name}</p><p className="text-[10px] text-neutral-400 truncate">{u.email}</p></div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {isCoHostDropdownOpen && !coHostId && coHostResults.length === 0 && !isSearchingCoHost && coHostSearchTerm.trim() && (
                                    <div className="absolute top-full left-0 right-0 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg mt-1 p-4 text-center z-[99999] shadow-lg">
                                        <p className="text-sm font-bold text-neutral-400">Sin resultados para "{coHostSearchTerm}"</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* AVANZADO — género es TOUR 8 */}
                    <div className="border-t border-slate-200 dark:border-zinc-800 pt-4 space-y-4">
                        <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Detalles Avanzados</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div><label className="text-[10px] font-bold uppercase block">Capacidad</label><input type="number" name="maxCapacity" value={form.maxCapacity} onChange={handleChange} className="w-full p-2 border border-slate-300 dark:border-zinc-700 rounded-lg font-medium bg-white dark:bg-zinc-900 text-black dark:text-white" /></div>
                            <div><label className="text-[10px] font-bold uppercase block">Edad Mín</label><input type="number" name="minAge" value={form.minAge} onChange={handleChange} className="w-full p-2 border border-slate-300 dark:border-zinc-700 rounded-lg font-medium bg-white dark:bg-zinc-900 text-black dark:text-white" /></div>
                            <div><label className="text-[10px] font-bold uppercase block">Edad Máx</label><input type="number" name="maxAge" value={form.maxAge} onChange={handleChange} className="w-full p-2 border border-slate-300 dark:border-zinc-700 rounded-lg font-medium bg-white dark:bg-zinc-900 text-black dark:text-white" /></div>
                            <div>
                                <label className="text-[10px] font-bold uppercase block">Género</label>
                                <div id="tour-wrap-8" className={`relative transition-all duration-300 rounded-xl ${localTourStep === 8 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-1 -m-1 z-[50]' : ''}`}>
                                    {localTourStep === 8 && (
                                        <NativeTooltip title="Filtros de Exclusividad" description="Define si es para hombres, mujeres o mixto." step={8} totalSteps={9} onNext={() => handleTourNext(9)} onSkip={handleTourSkip} placement="top" align="right" />
                                    )}
                                    <select name="targetGender" value={form.targetGender} onChange={handleChange} className="w-full p-2 border border-slate-300 dark:border-zinc-700 rounded-lg font-medium bg-white dark:bg-zinc-900 text-black dark:text-white appearance-none relative z-10">
                                        {TARGET_GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none z-10" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* GUARDAR — TOUR 9 */}
                    <div id="tour-wrap-9" className={`relative transition-all duration-300 rounded-xl ${localTourStep === 9 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}>
                        {localTourStep === 9 && (
                            <NativeTooltip title="¡Todo Listo!" description="Revisa que todo esté correcto y guardá los cambios." step={9} totalSteps={9} onNext={handleTourFinish} onSkip={handleTourSkip} isLast={true} placement="top" align="center" />
                        )}
                        <button type="submit" disabled={loading || isCheckingSpelling} className={`w-full py-4 text-white font-semibold uppercase tracking-wide rounded-lg transition-all flex items-center justify-center gap-2 ${isCheckingSpelling ? 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 cursor-not-allowed' : 'bg-slate-900 dark:bg-white dark:text-slate-900 hover:opacity-90'}`}>
                            {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</> : isCheckingSpelling ? 'Analizando texto...' : <><Save className="w-5 h-5" /> Enviar Solicitud</>}
                        </button>
                    </div>
                </form>

                {showSpellingWarning && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-xl animate-scaleIn">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-12 h-12 bg-yellow-400 rounded-xl flex items-center justify-center shadow-sm"><span className="text-2xl">⚠️</span></div>
                                <div>
                                    <h3 className="text-lg font-black uppercase">¡Atención!</h3>
                                    <p className="text-sm font-medium text-neutral-600 mt-2">La descripción de tu grupo contiene posibles errores de ortografía.</p>
                                    <p className="text-sm font-medium text-neutral-600">¿Deseas corregirlos antes de continuar?</p>
                                </div>
                                <div className="flex flex-col gap-2 w-full pt-2">
                                    <button onClick={() => { setShowSpellingWarning(false); handleFixSpelling(); }} className="w-full py-3 bg-yellow-400 text-black font-semibold uppercase rounded-lg shadow-sm hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                                        <Wand2 className="w-4 h-4" /> Corregir Errores
                                    </button>
                                    <button onClick={() => confirmSubmit()} className="w-full py-3 bg-white text-neutral-500 font-bold uppercase border-2 border-transparent hover:text-black hover:underline transition-all">
                                        Guardar de todas formas
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        </div>
    );
};

export default PaginaReabrirGrupo;

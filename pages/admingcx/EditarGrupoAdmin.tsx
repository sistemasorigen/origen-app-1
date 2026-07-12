import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { Group, User, GroupTag, SeasonSettings, DEFAULT_SEASON_SETTINGS } from '../../types';
import { supabaseService, updateGroupDirect } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import { Crown, Save, Search, Check, ChevronDown, Calendar, Wand2, X, Loader2 } from 'lucide-react';
import ImageUpload from '../../components/media/SubidaImagen';
import { useSpellingAI } from '../../hooks/useSpellingAI';

interface GroupCategory {
    id: string;
    name: string;
    color?: string;
}

const MEETING_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TARGET_GENDERS = ['Mixto', 'Hombre', 'Mujer'];

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
    const [isSeasonMode, setIsSeasonMode] = useState(true);
    const seasonModeInitialized = useRef(false);

    // Anfitrión (reasignable, exclusivo de la vista admin)
    const [potentialHosts, setPotentialHosts] = useState<User[]>([]);
    const [selectedHostId, setSelectedHostId] = useState<string>('');
    const [hostSearchTerm, setHostSearchTerm] = useState('');
    const [isHostSelectOpen, setIsHostSelectOpen] = useState(false);

    // Co-Anfitrión (opcional)
    const [coHostMode, setCoHostMode] = useState<'manual' | 'search'>('search');
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
        targetGender: 'Mixto', tags: [] as string[], startDate: '', endDate: '',
        leaderName: '', leaderSurname: ''
    });

    const [showSpellingWarning, setShowSpellingWarning] = useState(false);
    const { isChecking: isCheckingSpelling, isCorrecting, hasErrors: spellingErrors, correctionStatus, checkSpelling, fixText, resetState: resetSpelling } = useSpellingAI();

    // ── Fetch del grupo (cualquier grupo, no solo los propios) ──
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
                endDate: found.endDate ? found.endDate.split('T')[0] : '',
                leaderName: found.leaderName || '',
                leaderSurname: found.leaderSurname || ''
            });
            if ((found as any).host_id) {
                setSelectedHostId((found as any).host_id);
            }
            setHostSearchTerm(`${found.leaderName || ''} ${found.leaderSurname || ''}`.trim());
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

    // Detecta una única vez si las fechas actuales del grupo
    // corresponden a una temporada oficial o son manuales.
    useEffect(() => {
        if (seasonModeInitialized.current || !group || !form.startDate) return;
        const year = seasonSettings?.activeYear ?? new Date().getFullYear();
        const seasons = seasonSettings?.seasons ?? DEFAULT_SEASON_SETTINGS.seasons;
        const matchesOfficialSeason = (['S1', 'S2', 'S3'] as const).some(key =>
            form.startDate === `${year}-${seasons[key].startDate}` && form.endDate === `${year}-${seasons[key].endDate}`
        );
        setIsSeasonMode(matchesOfficialSeason);
        seasonModeInitialized.current = true;
    }, [group, form.startDate, form.endDate, seasonSettings]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            const results = await supabaseService.searchPotentialHosts(hostSearchTerm);
            setPotentialHosts(results);
        }, 300);
        return () => clearTimeout(timer);
    }, [hostSearchTerm]);

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
                setCoHostResults(((data as any[]) || []).filter(u => u.id !== selectedHostId));
                setIsCoHostDropdownOpen(true);
            } catch { setCoHostResults([]); }
            finally { setIsSearchingCoHost(false); }
        }, 350);
        return () => clearTimeout(timer);
    }, [coHostSearchTerm, coHostMode, selectedHostId]);

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

        const hasSelectedHost = !!selectedHostId;
        const hasManualHost = form.leaderName.trim().length > 0;
        if (!hasSelectedHost && !hasManualHost) {
            return alert('Debes asignar un Anfitrión (buscando o ingresando manualmente).');
        }

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

            const selectedHostUser = potentialHosts.find(u => u.id === selectedHostId);

            let finalLeaderName = form.leaderName.trim() || 'Anfitrión';
            let finalLeaderSurname = form.leaderSurname.trim();
            let finalLeaderPhone = group.leaderPhone || '';
            if (!form.leaderName.trim() && selectedHostUser) {
                const hostNameParts = selectedHostUser.name.trim().split(/\s+/);
                finalLeaderName = hostNameParts[0] || selectedHostUser.name;
                finalLeaderSurname = hostNameParts.slice(1).join(' ') || '';
            }
            if (selectedHostUser?.phone) finalLeaderPhone = selectedHostUser.phone;

            const wasRejected = group.status === 'rejected';
            const finalStatus: Group['status'] = wasRejected ? 'pending' : group.status;
            const finalAdminNote = wasRejected ? '' : group.adminNote;

            const groupData: any = {
                ...group,
                name: form.name,
                leaderName: finalLeaderName,
                leaderSurname: finalLeaderSurname,
                leaderPhone: finalLeaderPhone,
                meetingDay: form.meetingDay,
                meetingTime: form.meetingTime,
                location: form.location,
                description: form.description,
                maxCapacity: Number(form.maxCapacity),
                imageUrl: finalImageUrl,
                categoryId: form.categoryId,
                tags: form.tags,
                host_id: selectedHostId || undefined,
                co_host_id: coHostMode === 'search' ? coHostId : null,
                coHostFirstName: coHostMode === 'manual' ? form.coHostFirstName : '',
                coHostLastName: coHostMode === 'manual' ? form.coHostLastName : '',
                minAge: Number(form.minAge),
                maxAge: Number(form.maxAge),
                targetGender: form.targetGender,
                startDate: form.startDate,
                endDate: form.endDate,
                status: finalStatus,
                adminNote: finalAdminNote,
            };

            if (selectedHostUser && selectedHostUser.role !== 'ANFITRION' && !selectedHostUser.role.includes('ADMIN')) {
                await supabaseService.promoteUserToHost(selectedHostId);
            }

            const result = await updateGroupDirect(groupData as Group);

            if (result && selectedHostId) {
                await supabaseService.linkUserToGroup(selectedHostId, result.id);
            }

            if (result) {
                showToast('Grupo actualizado exitosamente');
                navigate(`/admingcx/gestion-de-grupos/detalles/${groupId}`);
            } else {
                showToast('Error al guardar. Verifica consola.', 'error');
            }
        } catch (error: any) {
            console.error('Error saving group:', error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loadingGroup) return (
        <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
    );

    if (!group) return null;

    return (
        <div className="max-w-2xl">
            {group.status === 'rejected' && (
                <div className="mb-6 p-3 bg-red-50 border-2 border-red-200 rounded-lg">
                    <p className="text-xs font-bold text-red-600 uppercase">
                        Al guardar, se enviará a revisión nuevamente
                    </p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* ASIGNAR ANFITRIÓN — exclusivo de la vista admin */}
                <div className="bg-yellow-50 p-4 border-l-4 border-yellow-400">
                    <p className="text-xs font-black uppercase tracking-widest text-yellow-800 mb-2 flex items-center gap-1">
                        <Crown className="w-4 h-4" /> Anfitrión (Obligatorio)
                    </p>
                    <div className="space-y-4">
                        <div className="relative">
                            <label className="text-[10px] font-bold uppercase text-yellow-700 block mb-1">Buscar Usuario</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <input
                                    type="text"
                                    placeholder="Escribe nombre del anfitrión..."
                                    value={hostSearchTerm}
                                    onFocus={() => setIsHostSelectOpen(true)}
                                    onChange={e => {
                                        setHostSearchTerm(e.target.value);
                                        setIsHostSelectOpen(true);
                                        setSelectedHostId('');
                                    }}
                                    className="w-full pl-10 h-10 border-2 border-yellow-700/20 bg-white outline-none font-bold"
                                />
                                {isHostSelectOpen && potentialHosts.length > 0 && (
                                    <div className="absolute top-full left-0 w-full bg-white border-2 border-black mt-1 max-h-48 overflow-y-auto z-50">
                                        {potentialHosts.map(u => (
                                            <div
                                                key={u.id}
                                                onClick={() => {
                                                    setSelectedHostId(u.id);
                                                    setHostSearchTerm(u.name);
                                                    setIsHostSelectOpen(false);
                                                    const parts = u.name.trim().split(/\s+/);
                                                    setForm(prev => ({
                                                        ...prev,
                                                        leaderName: parts[0] || u.name,
                                                        leaderSurname: parts.slice(1).join(' ') || ''
                                                    }));
                                                }}
                                                className="p-3 hover:bg-neutral-100 cursor-pointer border-b border-neutral-100 last:border-0 flex justify-between items-center"
                                            >
                                                <p className="font-bold text-sm">{u.name}</p>
                                                {u.role === 'ANFITRION' && <span className="text-[10px] bg-black text-white px-1">ANFITRION</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-yellow-700 block mb-1">Nombre (Manual)</label>
                                <input type="text" name="leaderName" value={form.leaderName} onChange={handleChange} placeholder="Ej: Juan" className="w-full p-2 border-2 border-yellow-700/20 bg-white font-bold" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-yellow-700 block mb-1">Apellido (Manual)</label>
                                <input type="text" name="leaderSurname" value={form.leaderSurname} onChange={handleChange} placeholder="Ej: Pérez" className="w-full p-2 border-2 border-yellow-700/20 bg-white font-bold" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* IMAGEN */}
                <div className="space-y-4">
                    <label className="text-xs font-black uppercase tracking-widest block flex items-center gap-2">
                        Imagen de Portada
                        <span className="bg-neutral-200 text-neutral-600 px-2 py-0.5 font-bold uppercase text-[10px]">Recomendado: 1280x720 (16:9)</span>
                    </label>
                    <ImageUpload currentImage={form.imageUrl} folder="groups" onImageUpload={(url) => setForm(prev => ({ ...prev, imageUrl: url }))} aspectRatio="wide" placeholder="Subir portada del grupo" />
                </div>

                {/* NOMBRE */}
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest block">Nombre del Grupo</label>
                    <input type="text" name="name" value={form.name} onChange={handleChange} className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold text-lg focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all" required placeholder="Ej: Jóvenes Profesionales" />
                </div>

                {/* DESCRIPCIÓN */}
                <div className="space-y-1">
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black uppercase tracking-widest block">Descripción</label>
                        {(spellingErrors || correctionStatus === 'correcting' || correctionStatus === 'success') && (
                            <button type="button" onClick={handleFixSpelling} disabled={isCorrecting} className={`border-2 border-black font-black uppercase text-xs px-3 py-1 flex items-center gap-1 transition-all ${correctionStatus === 'correcting' ? 'bg-black text-white animate-pulse cursor-wait' : correctionStatus === 'success' ? 'bg-[#118f46] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none animate-scaleIn'}`}>
                                <Wand2 className="w-3 h-3" />
                                {correctionStatus === 'correcting' ? 'Corrigiendo...' : correctionStatus === 'success' ? 'Corregido ✓' : 'Corregir'}
                            </button>
                        )}
                    </div>
                    <textarea name="description" value={form.description} onChange={handleChange} rows={3} className={`w-full p-3 border-2 rounded-none outline-none font-medium resize-none transition-colors ${spellingErrors && correctionStatus !== 'success' ? 'border-red-500 bg-red-50' : 'border-black'}`} />
                    {isCheckingSpelling && <p className="text-[10px] text-neutral-400 font-bold uppercase animate-pulse">Analizando con IA...</p>}
                </div>

                {/* CATEGORÍA Y UBICACIÓN */}
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest block">Categoría y Ubicación</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                            <select name="categoryId" value={form.categoryId} onChange={handleChange} className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold bg-white appearance-none relative z-10">
                                <option value="">-- Seleccionar --</option>
                                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10" />
                        </div>
                        <input type="text" name="location" value={form.location} onChange={handleChange} className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold" placeholder="Dirección o punto de encuentro" />
                    </div>
                </div>

                {/* DÍA Y HORA */}
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest block">Horario de Reunión</label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                            <select name="meetingDay" value={form.meetingDay} onChange={handleChange} className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold bg-white appearance-none">
                                {MEETING_DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                        </div>
                        <input type="time" name="meetingTime" value={form.meetingTime} onChange={handleChange} className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold" />
                    </div>
                </div>

                {/* DURACIÓN — Temporadas / Manual (exclusivo de la vista admin) */}
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <label className="text-xs font-black uppercase tracking-widest block">Duración del Grupo</label>
                        <div className="flex bg-neutral-100 p-1 rounded-full border border-neutral-200">
                            <button type="button" onClick={() => setIsSeasonMode(true)} className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${isSeasonMode ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:text-black'}`}>
                                Temporadas
                            </button>
                            <button type="button" onClick={() => setIsSeasonMode(false)} className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${!isSeasonMode ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:text-black'}`}>
                                Manual
                            </button>
                        </div>
                    </div>

                    {isSeasonMode ? (
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
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                            <div className="space-y-1">
                                <label className="text-xs font-black uppercase tracking-widest h-8 flex items-end">Fecha de Arranque</label>
                                <div className="relative">
                                    <input
                                        type="text" readOnly
                                        value={((dateStr) => { if (!dateStr) return ''; const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}`; })(form.startDate)}
                                        placeholder="DD/MM/AAAA"
                                        className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold bg-white text-black pointer-events-none"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black"><Calendar className="w-5 h-5" /></div>
                                    <input
                                        type="date" name="startDate" value={form.startDate} onChange={handleChange}
                                        onClick={(e) => { try { if (typeof (e.currentTarget as any).showPicker === 'function') (e.currentTarget as any).showPicker(); } catch (error) { } }}
                                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-black uppercase tracking-widest h-8 flex items-end">Fin del Grupo</label>
                                <div className="relative">
                                    <input
                                        type="text" readOnly
                                        value={((dateStr) => { if (!dateStr) return ''; const [y, m, d] = dateStr.split('-'); return `${d}/${m}/${y}`; })(form.endDate)}
                                        placeholder="Indefinido"
                                        className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold bg-white text-black pointer-events-none"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black"><Calendar className="w-5 h-5" /></div>
                                    <input
                                        type="date" name="endDate" value={form.endDate} onChange={handleChange}
                                        onClick={(e) => { try { if (typeof (e.currentTarget as any).showPicker === 'function') (e.currentTarget as any).showPicker(); } catch (error) { } }}
                                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                    />
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
                            <button type="button" key={tag.id} onClick={() => toggleTag(tag.id)} className={`px-3 py-1 text-[10px] font-black uppercase border-2 border-black transition-all ${form.tags.includes(tag.id) ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]' : 'bg-white text-neutral-500 hover:bg-neutral-100'}`}>
                                {tag.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* CO-ANFITRIÓN */}
                <div className="space-y-3 border-t-2 border-black pt-4">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Co-Anfitrión <span className="font-medium normal-case text-neutral-300">(Opcional)</span></p>
                        <div className="flex bg-neutral-100 p-1 rounded-full border border-neutral-200">
                            <button type="button" onClick={() => { setCoHostMode('search'); setForm(prev => ({ ...prev, coHostFirstName: '', coHostLastName: '' })); }} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${coHostMode === 'search' ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:text-black'}`}>Buscar Usuario</button>
                            <button type="button" onClick={() => { setCoHostMode('manual'); setCoHostId(null); setCoHostSearchTerm(''); }} className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${coHostMode === 'manual' ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:text-black'}`}>Manual</button>
                        </div>
                    </div>

                    {coHostMode === 'manual' ? (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase block">Nombre</label>
                                <input type="text" name="coHostFirstName" value={form.coHostFirstName} onChange={handleChange} className="w-full h-10 px-3 border-2 border-black rounded-none outline-none font-bold" placeholder="Nombre" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold uppercase block">Apellido</label>
                                <input type="text" name="coHostLastName" value={form.coHostLastName} onChange={handleChange} className="w-full h-10 px-3 border-2 border-black rounded-none outline-none font-bold" placeholder="Apellido" />
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
                                    <input type="text" value={coHostSearchTerm} onChange={e => { setCoHostSearchTerm(e.target.value); setCoHostId(null); }} onFocus={() => coHostResults.length > 0 && setIsCoHostDropdownOpen(true)} placeholder="Buscar por nombre o email..." className="w-full h-10 pl-10 pr-3 border-2 border-black outline-none font-bold placeholder:font-normal" />
                                    {isSearchingCoHost && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-neutral-400 animate-pulse">Buscando...</span>}
                                </div>
                            )}
                            {isCoHostDropdownOpen && !coHostId && coHostResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 bg-white border-2 border-black mt-1 max-h-48 overflow-y-auto z-[99999] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    {coHostResults.map(u => (
                                        <button key={u.id} type="button" onMouseDown={(e) => { e.preventDefault(); setCoHostId(u.id); setCoHostSearchTerm(u.name); setIsCoHostDropdownOpen(false); }} className="w-full flex items-center gap-3 p-3 text-left border-b border-neutral-100 last:border-0 hover:bg-neutral-50 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-black text-xs shrink-0">{u.name.substring(0, 2).toUpperCase()}</div>
                                            <div className="min-w-0"><p className="font-black text-sm truncate">{u.name}</p><p className="text-[10px] text-neutral-400 truncate">{u.email}</p></div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {isCoHostDropdownOpen && !coHostId && coHostResults.length === 0 && !isSearchingCoHost && coHostSearchTerm.trim() && (
                                <div className="absolute top-full left-0 right-0 bg-white border-2 border-black mt-1 p-4 text-center z-[99999] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                    <p className="text-sm font-bold text-neutral-400">Sin resultados para "{coHostSearchTerm}"</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* AVANZADO */}
                <div className="border-t-2 border-black pt-4 space-y-4">
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Detalles Avanzados</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><label className="text-[10px] font-bold uppercase block">Capacidad</label><input type="number" name="maxCapacity" value={form.maxCapacity} onChange={handleChange} className="w-full p-2 border-2 border-black font-bold" /></div>
                        <div><label className="text-[10px] font-bold uppercase block">Edad Mín</label><input type="number" name="minAge" value={form.minAge} onChange={handleChange} className="w-full p-2 border-2 border-black font-bold" /></div>
                        <div><label className="text-[10px] font-bold uppercase block">Edad Máx</label><input type="number" name="maxAge" value={form.maxAge} onChange={handleChange} className="w-full p-2 border-2 border-black font-bold" /></div>
                        <div>
                            <label className="text-[10px] font-bold uppercase block">Género</label>
                            <div className="relative">
                                <select name="targetGender" value={form.targetGender} onChange={handleChange} className="w-full p-2 border-2 border-black font-bold bg-white appearance-none relative z-10">
                                    {TARGET_GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none z-10" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* GUARDAR */}
                <button type="submit" disabled={loading || isCheckingSpelling} className={`w-full py-4 text-white font-black uppercase tracking-widest border-2 border-black transition-all flex items-center justify-center gap-2 ${isCheckingSpelling ? 'bg-neutral-300 text-neutral-500 border-neutral-400 cursor-not-allowed' : 'bg-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}>
                    {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Guardando...</> : isCheckingSpelling ? 'Analizando texto...' : <><Save className="w-5 h-5" /> Guardar Cambios</>}
                </button>
            </form>

            {showSpellingWarning && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white border-2 border-black p-6 w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-scaleIn">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-12 h-12 bg-yellow-400 border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"><span className="text-2xl">⚠️</span></div>
                            <div>
                                <h3 className="text-lg font-black uppercase">¡Atención!</h3>
                                <p className="text-sm font-medium text-neutral-600 mt-2">La descripción de tu grupo contiene posibles errores de ortografía.</p>
                                <p className="text-sm font-medium text-neutral-600">¿Deseas corregirlos antes de continuar?</p>
                            </div>
                            <div className="flex flex-col gap-2 w-full pt-2">
                                <button onClick={() => { setShowSpellingWarning(false); handleFixSpelling(); }} className="w-full py-3 bg-yellow-400 text-black font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none transition-all flex items-center justify-center gap-2">
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
    );
};

const EditarGrupoAdmin: React.FC = () => (
    <AdminGCXLayout
        title="Editar Grupo"
        backTo="/admingcx/gestion-de-grupos"
        backLabel="Volver a Gestión de Grupos"
    >
        <EditarGrupoAdminContent />
    </AdminGCXLayout>
);

export default EditarGrupoAdmin;

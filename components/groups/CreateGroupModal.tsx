import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import NeoModal from '../NeoModal';
import { Group, User, GroupTag } from '../../types';
import { supabaseService, insertGroupDirect, updateGroupDirect } from '../../services/supabaseService';
import { Save, UserPlus, Users, Crown, Search, Check, ChevronDown, Calendar, ArrowRight, Wand2 } from 'lucide-react';
import ImageUpload from '../ImageUpload';
import { useSpellingAI } from '../../hooks/useSpellingAI';
import { useTutorial } from '../../src/hooks/useTutorial';
import TutorialController from '../TutorialController';
import TutorialInvitation from '../TutorialInvitation';
import { tours } from '../../src/config/tours';

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    editingGroup: Group | null;
    currentUser: User | null;
    isAdminView?: boolean;
    isReopenRequest?: boolean;
}

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
    align?: 'left' | 'right' | 'center'; // NEW: Alignment control
}

const NativeTooltip: React.FC<NativeTooltipProps> = ({ title, description, step, totalSteps, onNext, onSkip, isLast = false, placement = 'bottom', align = 'left' }) => {
    const isTop = placement === 'top';

    // Alignment classes
    let alignClass = 'left-0';
    let arrowClass = 'left-8';

    if (align === 'right') {
        alignClass = 'right-0';
        arrowClass = 'right-8'; // Arrow on right side
    } else if (align === 'center') {
        alignClass = 'left-1/2 -translate-x-1/2';
        arrowClass = 'left-1/2 -translate-x-1/2'; // Centered arrow
    }

    return (
        <div
            className={`absolute w-72 z-[9999] bg-white border-[3px] border-black rounded-xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] animate-fadeIn text-left
            ${isTop ? 'bottom-full mb-3' : 'top-full mt-3'}
            ${alignClass}
            `}
        >
            <div className="flex justify-between items-start mb-3">
                <h3 className="text-lg font-black uppercase leading-tight">{title}</h3>
                <span className="text-xs font-bold bg-neutral-100 px-2 py-1 rounded border border-neutral-200">
                    {step} / {totalSteps}
                </span>
            </div>

            <p className="text-sm font-medium text-neutral-600 mb-6 leading-relaxed">
                {description}
            </p>

            <div className="flex items-center justify-between">
                <button
                    onClick={onSkip}
                    type="button"
                    className="text-xs font-bold uppercase text-neutral-400 hover:text-black transition-colors"
                >
                    Saltar
                </button>
                <button
                    onClick={onNext}
                    type="button"
                    className="bg-black text-white text-xs font-black uppercase px-6 py-2 rounded-lg hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] transition-all"
                >
                    {isLast ? 'Finalizar' : 'Siguiente'}
                </button>
            </div>

            {/* UPWARD/DOWNWARD ARROW */}
            <div className={`absolute w-4 h-4 bg-white border-l-[3px] border-t-[3px] border-black transform rotate-45
                ${isTop ? '-bottom-2.5 rotate-[225deg]' : '-top-2.5'}
                ${arrowClass}
            `}></div>
        </div>
    );
};

const MEETING_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TARGET_GENDERS = ['Mixto', 'Hombre', 'Mujer'];

const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
    isOpen,
    onClose,
    onSave,
    editingGroup,
    currentUser,
    isAdminView = false,
    isReopenRequest = false
}) => {
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [availableTags, setAvailableTags] = useState<GroupTag[]>([]);
    const [loading, setLoading] = useState(false);

    // NATIVE TOUR STATE
    const [localTourStep, setLocalTourStep] = useState(0);

    // Admin View State
    const [potentialHosts, setPotentialHosts] = useState<User[]>([]);
    const [selectedHostId, setSelectedHostId] = useState<string>('');
    const [hostSearchTerm, setHostSearchTerm] = useState('');
    const [isHostSelectOpen, setIsHostSelectOpen] = useState(false);
    const [isSeasonMode, setIsSeasonMode] = useState(true);

    // Form State
    const [form, setForm] = useState({
        name: '',
        categoryId: '',
        meetingDay: 'Lunes',
        meetingTime: '20:00',
        location: '',
        description: '',
        maxCapacity: 12 as number | string,
        imageUrl: '',
        coHostFirstName: '',
        coHostLastName: '',
        minAge: 0 as number | string,
        maxAge: 100 as number | string,
        targetGender: 'Mixto',
        tags: [] as string[],
        startDate: '',
        endDate: ''
    });

    const [showSpellingWarning, setShowSpellingWarning] = useState(false);

    // AI Spelling Guard
    const { isChecking: isCheckingSpelling, isCorrecting, hasErrors: spellingErrors, correctionStatus, checkSpelling, fixText, resetState: resetSpelling } = useSpellingAI();

    // Tutorial Hook
    const {
        isActive,
        showInvitation,
        startTutorial,
        completeTutorial,
        dismissTutorial,
        declineTemporary,
        tourSessionId // Re-enabled for Native Tour sync
    } = useTutorial('createGroup');

    // SYNC NATIVE TOUR
    useEffect(() => {
        if (isOpen && isActive) {
            // Always start/restart the tour if active and modal is open
            // This handles initial load AND manual resets (tourSessionId changes)
            setLocalTourStep(1);
        }
    }, [isOpen, isActive, tourSessionId]);

    // AUTO-SCROLL LOGIC
    useEffect(() => {
        if (localTourStep > 0) {
            const element = document.getElementById(`tour-wrap-${localTourStep}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [localTourStep]);

    const handleTourNext = (step: number) => {
        setLocalTourStep(step);
    };

    const handleTourFinish = () => {
        setLocalTourStep(0);
        completeTutorial();
    };

    const handleTourSkip = () => {
        setLocalTourStep(0);
        dismissTutorial();
    };

    // Debounced Spelling Check
    useEffect(() => {
        const timer = setTimeout(() => {
            if (form.description && form.description.length > 0) {
                checkSpelling(form.description);
            } else {
                resetSpelling();
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [form.description, checkSpelling, resetSpelling]);

    const handleFixSpelling = async () => {
        const corrected = await fixText(form.description);
        setForm(prev => ({ ...prev, description: corrected }));
        setShowSpellingWarning(false); // Close warning if fixed
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
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    // SEARCH POTENTIAL HOSTS
    useEffect(() => {
        if (!isOpen || !isAdminView) return;

        const timer = setTimeout(async () => {
            const results = await supabaseService.searchPotentialHosts(hostSearchTerm);
            setPotentialHosts(results);
        }, 300);

        return () => clearTimeout(timer);
    }, [hostSearchTerm, isOpen, isAdminView]);

    // Populate form
    useEffect(() => {
        if (!isOpen) return;

        if (editingGroup) {
            setForm({
                name: editingGroup.name || '',
                categoryId: editingGroup.categoryId || '',
                meetingDay: editingGroup.meetingDay || 'Lunes',
                meetingTime: editingGroup.meetingTime || '20:00',
                location: editingGroup.location || '',
                description: editingGroup.description || '',
                maxCapacity: editingGroup.maxCapacity || 12,
                imageUrl: editingGroup.imageUrl || '',
                coHostFirstName: editingGroup.coHostFirstName || '',
                coHostLastName: editingGroup.coHostLastName || '',
                minAge: editingGroup.minAge || 0,
                maxAge: editingGroup.maxAge || 100,
                targetGender: editingGroup.targetGender || 'Mixto',
                tags: editingGroup.tags || [],
                startDate: editingGroup.startDate ? editingGroup.startDate.split('T')[0] : '',
                endDate: editingGroup.endDate ? editingGroup.endDate.split('T')[0] : ''
            });
            if (isAdminView && (editingGroup as any).host_id) {
                setSelectedHostId((editingGroup as any).host_id);
            }
        } else {
            setForm({
                name: '',
                categoryId: '',
                meetingDay: 'Lunes',
                meetingTime: '20:00',
                location: '',
                description: '',
                maxCapacity: 12,
                imageUrl: '',
                coHostFirstName: '',
                coHostLastName: '',
                minAge: 0,
                maxAge: 100,
                targetGender: 'Mixto',
                tags: [],
                startDate: '',
                endDate: ''
            });
            setSelectedHostId('');
            setHostSearchTerm('');
            setIsHostSelectOpen(false);
            setShowSpellingWarning(false);
        }
    }, [isOpen, editingGroup, isAdminView]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        if (name === 'maxCapacity' || name === 'maxAge' || name === 'minAge') {
            setForm(prev => ({
                ...prev,
                [name]: value === '' ? '' : parseInt(value)
            }));
            return;
        }

        setForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const toggleTag = (tagId: string) => {
        setForm(prev => {
            const currentTags = prev.tags || [];
            if (currentTags.includes(tagId)) {
                return { ...prev, tags: currentTags.filter(t => t !== tagId) };
            } else {
                return { ...prev, tags: [...currentTags, tagId] };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Mandatory Fields Validation
        if (!form.name.trim()) return alert('El nombre del grupo es obligatorio');
        if (!form.categoryId) return alert('Debes seleccionar una categoría.');
        if (!form.location.trim()) return alert('El barrio/ubicación es obligatorio.');
        if (!form.description.trim()) return alert('La descripción es obligatoria.');
        if (!form.startDate) return alert('La fecha de arranque es obligatoria.');
        if (!form.endDate) return alert('La fecha de fin es obligatoria.');

        // Numeric Validations
        const maxCapacityFn = Number(form.maxCapacity);
        const minAgeFn = Number(form.minAge);
        const maxAgeFn = Number(form.maxAge);

        if (maxCapacityFn <= 0) return alert('La capacidad debe ser mayor a 0.');
        if (minAgeFn < 0) return alert('La edad mínima no puede ser negativa.');
        if (maxAgeFn <= 0) return alert('La edad máxima debe ser mayor a 0.');
        if (minAgeFn > maxAgeFn) return alert('La edad mínima no puede ser mayor a la edad máxima.');

        if (!form.meetingDay) return alert('El día de encuentro es obligatorio.');
        if (!form.meetingTime) return alert('El horario de encuentro es obligatorio.');

        if (isAdminView && !editingGroup && !selectedHostId) {
            return alert('Debes asignar un Anfitrión para el grupo.');
        }

        // Validate dates are not in the past
        const today = new Date().toISOString().split('T')[0];
        if (form.startDate && form.startDate < today) {
            return alert('La fecha de arranque no puede ser anterior a hoy.');
        }
        if (form.endDate && form.endDate < today) {
            return alert('La fecha de fin no puede ser anterior a hoy.');
        }
        if (form.startDate && form.endDate && form.startDate > form.endDate) {
            return alert('La fecha de fin debe ser posterior a la fecha de arranque.');
        }

        // Check for spelling errors before submitting, unless user already confirmed (showSpellingWarning is true -> wait, this logic is tricky)
        // Correct logic: If spelling errors exist AND we haven't shown the warning yet (or user cancelled), show warning.
        // If user actively clicked "Crear de todas formas" in the modal, we bypass this check.
        // But this function is attached to the form onSubmit.
        // We will handle the "real" submit in a separate function call or use a flag.
        // Better: preventDefault here. If spellingErrors && !showSpellingWarning, show warning and return.

        if (spellingErrors && !showSpellingWarning) {
            setShowSpellingWarning(true);
            return;
        }

        // If we are here, either no errors OR user confirmed via "Crear de todas formas" (which will call this function again? No, we need a separate trigger or state).
        // Actually, let's keep it simple:
        // 1. Submit button calls handleSubmit.
        // 2. handleSubmit checks errors. If errors -> show warning. disable further execution.
        // 3. Warning modal has "Crear de todas formas" button which calls `confirmSubmit`.

        await confirmSubmit();
    };

    const confirmSubmit = async () => {
        setLoading(true);
        setShowSpellingWarning(false); // Close warning if open

        try {
            // Handle Base64 Image Upload
            let finalImageUrl = form.imageUrl;

            // CASE 1: Base64 String (Old method or if we revert)
            if (finalImageUrl && finalImageUrl.startsWith('data:image')) {
                try {
                    console.log('Detected base64 image, uploading to Storage...');
                    const uploadedUrl = await supabaseService.uploadBase64Image(finalImageUrl, 'groups-covers');
                    finalImageUrl = uploadedUrl;
                } catch (uploadError: any) {
                    console.error('Error uploading generated image (base64):', uploadError);
                    alert(`Error al guardar la imagen generada: ${uploadError.message}`);
                    setLoading(false);
                    return;
                }
            }
            // CASE 2: Remote URL (Pollinations/Unsplash) that needs persistence
            else if (finalImageUrl && finalImageUrl.startsWith('http') && !finalImageUrl.includes('supabase.co')) {
                try {
                    console.log('Detected remote URL, fetching and uploading to Storage...', finalImageUrl);

                    // Fetch the image
                    const response = await fetch(finalImageUrl);
                    if (!response.ok) throw new Error('Failed to fetch remote image');
                    const blob = await response.blob();

                    // Convert to Base64 for uploadBase64Image (or use uploadFile if exposed)
                    // Using uploadBase64Image as it is already set up for this flow
                    const reader = new FileReader();
                    const base64Promise = new Promise<string>((resolve, reject) => {
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                    });
                    reader.readAsDataURL(blob);
                    const base64Data = await base64Promise;

                    const uploadedUrl = await supabaseService.uploadBase64Image(base64Data, 'groups-covers');
                    finalImageUrl = uploadedUrl;

                } catch (uploadError: any) {
                    console.error('Error uploading generated image (url):', uploadError);
                    // Fallback: Use the original URL if upload fails?
                    // No, Pollinations URLs might expire or change. Better to alert.
                    alert(`Error al guardar la imagen generada: ${uploadError.message}`);
                    setLoading(false);
                    return;
                }
            }

            let finalHostId = currentUser?.id;
            const fullName = currentUser?.name || 'Administrador';
            const nameParts = fullName.trim().split(/\s+/);
            let finalLeaderName = nameParts[0] || 'Administrador';
            let finalLeaderSurname = nameParts.slice(1).join(' ') || '';
            let shouldPromote = false;

            if (isAdminView) {
                if (editingGroup) {
                    finalHostId = (editingGroup as any).host_id;
                } else {
                    finalHostId = selectedHostId;
                    const selectedHostUser = potentialHosts.find(u => u.id === selectedHostId);
                    if (selectedHostUser) {
                        const hostNameParts = selectedHostUser.name.trim().split(/\s+/);
                        finalLeaderName = hostNameParts[0] || selectedHostUser.name;
                        finalLeaderSurname = hostNameParts.slice(1).join(' ') || '';

                        if (selectedHostUser.role !== 'ANFITRION' &&
                            selectedHostUser.role !== 'SUPER_ADMIN' &&
                            !selectedHostUser.role.includes('ADMIN')) {
                            shouldPromote = true;
                        }
                    }
                }
            }

            const wasRejected = editingGroup?.status === 'rejected';
            const isFinished = editingGroup?.endDate && editingGroup.endDate < new Date().toISOString().split('T')[0];
            let finalStatus: Group['status'] = editingGroup?.status || 'pending';

            if (!editingGroup) {
                finalStatus = isAdminView ? 'approved' : 'pending';
            } else if (wasRejected || isReopenRequest) {
                // If rejected or re-opening a finished group, set to pending for admin review
                finalStatus = 'pending';
            }

            const groupData: Partial<Group> & { host_id?: string } = {
                id: editingGroup?.id || generateUUID(),
                name: form.name,
                leaderName: finalLeaderName,
                leaderSurname: finalLeaderSurname,
                leaderPhone: '',
                meetingDay: form.meetingDay,
                meetingTime: form.meetingTime,
                location: form.location,
                description: form.description,
                maxCapacity: Number(form.maxCapacity),
                imageUrl: finalImageUrl,
                categoryId: form.categoryId,
                membersCount: editingGroup?.membersCount || 0,
                tags: form.tags,
                host_id: finalHostId,
                coHostFirstName: form.coHostFirstName,
                coHostLastName: form.coHostLastName,
                minAge: Number(form.minAge),
                maxAge: Number(form.maxAge),
                targetGender: form.targetGender as any,
                startDate: form.startDate,
                endDate: form.endDate,
                status: finalStatus,
                adminNote: (wasRejected || isReopenRequest) ? '' : editingGroup?.adminNote
            };

            if (shouldPromote && finalHostId) {
                await supabaseService.promoteUserToHost(finalHostId);
            }

            let result;
            if (editingGroup) {
                result = await updateGroupDirect(groupData as Group);
            } else {
                result = await insertGroupDirect(groupData as Group);
            }

            if (result) {
                onSave();
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

    const [isModalReady, setIsModalReady] = useState(false); // Kept locally if needed, but not for tour anymore


    // Removed the isModalReady logic for tour check


    return (
        <NeoModal
            isOpen={isOpen}
            onClose={onClose}
            title={isReopenRequest ? 'Solicitud de Re-Apertura' : (editingGroup ? 'Editar Grupo' : 'Nuevo Grupo')}
        >
            {/* Portal the Invitation to body to ensure it sits on top of this modal */}
            {showInvitation && createPortal(
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

            {/* JOYRIDE CONTROLLER REMOVED - REPLACED BY NATIVE TOUR */}
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* ADMINHOST SELECTOR */}
                {isAdminView && !editingGroup && (
                    <div className="bg-neutral-100 p-4 border-l-4 border-black">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest block">Asignar Anfitrión</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar usuario..."
                                    value={hostSearchTerm}
                                    onFocus={() => setIsHostSelectOpen(true)}
                                    onChange={e => {
                                        setHostSearchTerm(e.target.value);
                                        setIsHostSelectOpen(true);
                                        setSelectedHostId('');
                                    }}
                                    className="w-full pl-10 h-10 border-2 border-black outline-none font-bold placeholder:font-normal"
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
                                                }}
                                                className="p-3 hover:bg-neutral-100 cursor-pointer border-b border-neutral-100 last:border-0"
                                            >
                                                <p className="font-bold text-sm">{u.name}</p>
                                                <p className="text-xs text-neutral-500">{u.email}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* IMAGE SELECTION - TOUR STEP 1 */}
                <div
                    id="tour-wrap-1"
                    className={`space-y-4 relative transition-all duration-300 rounded-xl ${localTourStep === 1 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}
                >
                    {localTourStep === 1 && (
                        <NativeTooltip
                            title="La Portada de tu Grupo"
                            description="Sube una foto atractiva de tu galería para usar como portada."
                            step={1}
                            totalSteps={9}
                            onNext={() => handleTourNext(2)}
                            onSkip={handleTourSkip}
                        />
                    )}

                    <label className="text-xs font-black uppercase tracking-widest block flex items-center gap-2">
                        Imagen de Portada
                        <span className="bg-neutral-200 text-neutral-600 px-2 py-0.5 font-bold uppercase text-[10px]">Recomendado: 1280x720 (16:9)</span>
                    </label>

                    <ImageUpload
                        currentImage={form.imageUrl}
                        folder="groups"
                        onImageUpload={(url) => setForm(prev => ({ ...prev, imageUrl: url }))}
                        aspectRatio="wide"
                        placeholder="Subir portada del grupo"
                    />
                </div>

                {/* TITLE - TOUR STEP 2 */}
                <div
                    id="tour-wrap-2"
                    className={`space-y-1 relative transition-all duration-300 rounded-xl ${localTourStep === 2 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}
                >
                    {localTourStep === 2 && (
                        <NativeTooltip
                            title="Nombra tu Grupo"
                            description="Elige un nombre claro y llamativo. Ej: 'Jóvenes Emprendedores' o 'Estudio de Juan'."
                            step={2}
                            totalSteps={9}
                            onNext={() => handleTourNext(3)}
                            onSkip={handleTourSkip}
                        />
                    )}
                    <label className="text-xs font-black uppercase tracking-widest block">Nombre del Grupo</label>
                    <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold text-lg focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                        required
                        placeholder="Ej: Jóvenes Profesionales"
                    />
                </div>

                {/* DESCRIPTION - TOUR STEP 3 */}
                <div
                    id="tour-wrap-3"
                    className={`space-y-1 relative transition-all duration-300 rounded-xl ${localTourStep === 3 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}
                >
                    {localTourStep === 3 && (
                        <NativeTooltip
                            title="Detalles y Propósito"
                            description="Explica de qué trata el grupo, qué harán y a quién va dirigido. No te preocupes por la ortografía, nuestra IA la corregirá automáticamente."
                            step={3}
                            totalSteps={9}
                            onNext={() => handleTourNext(4)}
                            onSkip={handleTourSkip}
                        />
                    )}
                    <div className="flex justify-between items-center">
                        <label className="text-xs font-black uppercase tracking-widest block">Descripción</label>
                        {(spellingErrors || correctionStatus === 'correcting' || correctionStatus === 'success') && (
                            <button
                                type="button"
                                onClick={handleFixSpelling}
                                disabled={isCorrecting}
                                className={`border-2 border-black font-black uppercase text-xs px-3 py-1 flex items-center gap-1 transition-all ${correctionStatus === 'correcting'
                                    ? 'bg-black text-white animate-pulse cursor-wait'
                                    : correctionStatus === 'success'
                                        ? 'bg-[#118f46] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                                        : 'bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none animate-scaleIn'
                                    }`}
                            >
                                <Wand2 className="w-3 h-3" />
                                {correctionStatus === 'correcting' ? 'Corrigiendo...' : correctionStatus === 'success' ? 'Corregido ✓' : 'Corregir'}
                            </button>
                        )}
                    </div>
                    <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        rows={3}
                        className={`w-full p-3 border-2 rounded-none outline-none font-medium resize-none transition-colors ${spellingErrors && correctionStatus !== 'success' ? 'border-red-500 bg-red-50' : 'border-black'
                            }`}
                    />
                    {isCheckingSpelling && <p className="text-[10px] text-neutral-400 font-bold uppercase animate-pulse">Analizando con IA...</p>}
                </div>

                {/* CATEGORY AND LOCATION - TOUR STEP 4 & 5 */}
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest block">Categoría y Ubicación</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div
                            id="tour-wrap-4"
                            className={`relative transition-all duration-300 rounded-xl ${localTourStep === 4 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}
                        >
                            {localTourStep === 4 && (
                                <NativeTooltip
                                    title="Categoría Principal"
                                    description="Clasifica tu grupo para que las personas puedan encontrarlo fácilmente en el buscador."
                                    step={4}
                                    totalSteps={9}
                                    onNext={() => handleTourNext(5)}
                                    onSkip={handleTourSkip}
                                />
                            )}
                            <div className="relative">
                                <select
                                    name="categoryId"
                                    value={form.categoryId}
                                    onChange={handleChange}
                                    className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold bg-white appearance-none relative z-10"
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none z-10" />
                            </div>
                        </div>

                        {/* LOCATION - TOUR STEP 5 */}
                        <div
                            id="tour-wrap-5"
                            className={`relative transition-all duration-300 rounded-xl ${localTourStep === 5 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}
                        >
                            {localTourStep === 5 && (
                                <NativeTooltip
                                    title="Punto de Encuentro"
                                    description="Escribe la dirección exacta, el barrio o el nombre del local donde se reunirán."
                                    step={5}
                                    totalSteps={9}
                                    onNext={() => handleTourNext(6)}
                                    onSkip={handleTourSkip}
                                />
                            )}
                            <input
                                type="text"
                                name="location"
                                value={form.location}
                                onChange={handleChange}
                                className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold"
                                placeholder="Dirección o punto de encuentro"
                            />
                        </div>
                    </div>
                </div>

                {/* DAY AND TIME - TOUR STEP 6 */}
                <div
                    id="tour-wrap-6"
                    className={`space-y-2 relative transition-all duration-300 rounded-xl ${localTourStep === 6 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}
                >
                    {localTourStep === 6 && (
                        <NativeTooltip
                            title="Agenda tu Reunión"
                            description="Selecciona el día de la semana y la hora en la que se juntarán. La constancia es clave."
                            step={6}
                            totalSteps={9}
                            onNext={() => handleTourNext(7)}
                            onSkip={handleTourSkip}
                        />
                    )}
                    <label className="text-xs font-black uppercase tracking-widest block">Horario de Reunión</label>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <div className="relative">
                                <select name="meetingDay" value={form.meetingDay} onChange={handleChange} className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold bg-white appearance-none">
                                    {MEETING_DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <input type="time" name="meetingTime" value={form.meetingTime} onChange={handleChange} className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold" />
                        </div>
                    </div>
                </div>

                {/* SEASON / DATES SECTION - TOUR STEP 7 */}
                <div
                    id="tour-wrap-7"
                    className={`space-y-4 relative transition-all duration-300 rounded-xl ${localTourStep === 7 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}
                >
                    {localTourStep === 7 && (
                        <NativeTooltip
                            title="Duración del Grupo"
                            description="Elije una temporada predefinida para sumarte al ritmo de toda la comunidad, o selecciona 'Manual' para fechas personalizadas."
                            step={7}
                            totalSteps={9}
                            onNext={() => handleTourNext(8)}
                            onSkip={handleTourSkip}
                        />
                    )}
                    <div className="flex justify-between items-end">
                        <label className="text-xs font-black uppercase tracking-widest block">Duración del Grupo</label>

                        {/* TOGGLE SWITCH: SEASON VS MANUAL */}
                        <div className="flex bg-neutral-100 p-1 rounded-full border border-neutral-200">
                            <button
                                type="button"
                                onClick={() => setIsSeasonMode(true)}
                                className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${isSeasonMode
                                    ? 'bg-black text-white shadow-md'
                                    : 'text-neutral-500 hover:text-black'}`}
                            >
                                Temporadas
                            </button>
                            <button
                                type="button"
                                disabled={true} // BLOCKED PER USER REQUEST
                                title="Modo manual deshabilitado temporalmente"
                                className="px-4 py-1 rounded-full text-[10px] font-bold uppercase transition-all text-neutral-300 cursor-not-allowed"
                            >
                                Manual
                            </button>
                        </div>
                    </div>

                    {isSeasonMode ? (
                        <div className="grid grid-cols-1 gap-3">
                            {/* SEASON 1 - ALWAYS OPEN (For now) */}
                            <button
                                type="button"
                                onClick={() => {
                                    const year = new Date().getFullYear();
                                    setForm(prev => ({
                                        ...prev,
                                        startDate: `${year}-03-23`,
                                        endDate: `${year}-05-17`
                                    }));
                                }}
                                className={`p-4 border-2 text-left transition-all ${form.startDate?.endsWith('-03-23') && form.endDate?.endsWith('-05-17')
                                    ? 'border-[#118f46] bg-[#118f46]/5 relative'
                                    : 'border-neutral-200 hover:border-black'
                                    }`}
                            >
                                <div className="flex justify-between items-center">
                                    <span className="font-black uppercase text-sm">Primer Temporada</span>
                                    {form.startDate?.endsWith('-03-23') && form.endDate?.endsWith('-05-17') && (
                                        <div className="bg-[#118f46] text-white p-1 rounded-full">
                                            <Check className="w-3 h-3" />
                                        </div>
                                    )}
                                </div>
                                <span className="text-xs text-neutral-500 font-medium block mt-1">23 de Marzo - 17 de Mayo</span>
                            </button>

                            {/* SEASON 2 - LOCKED UNTIL JUNE 29 */}
                            {(() => {
                                const year = new Date().getFullYear();
                                const seasonStart = new Date(`${year}-06-29`);
                                const today = new Date();
                                const isLocked = today < seasonStart;

                                return (
                                    <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                            if (isLocked) return;
                                            setForm(prev => ({
                                                ...prev,
                                                startDate: `${year}-06-29`,
                                                endDate: `${year}-08-23`
                                            }));
                                        }}
                                        className={`p-4 border-2 text-left transition-all ${isLocked
                                            ? 'border-neutral-100 bg-neutral-50 opacity-50 cursor-not-allowed'
                                            : (form.startDate?.endsWith('-06-29') && form.endDate?.endsWith('-08-23')
                                                ? 'border-[#118f46] bg-[#118f46]/5 relative'
                                                : 'border-neutral-200 hover:border-black')
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black uppercase text-sm">Segunda Temporada</span>
                                                {isLocked && <span className="text-[10px] bg-neutral-200 text-neutral-500 px-2 py-0.5 rounded-full">Próximamente</span>}
                                            </div>
                                            {!isLocked && form.startDate?.endsWith('-06-29') && form.endDate?.endsWith('-08-23') && (
                                                <div className="bg-[#118f46] text-white p-1 rounded-full">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs text-neutral-500 font-medium block mt-1">
                                            29 de Junio - 23 de Agosto
                                        </span>
                                    </button>
                                );
                            })()}

                            {/* SEASON 3 - LOCKED UNTIL OCT 5 */}
                            {(() => {
                                const year = new Date().getFullYear();
                                const seasonStart = new Date(`${year}-10-05`);
                                const today = new Date();
                                const isLocked = today < seasonStart;

                                return (
                                    <button
                                        type="button"
                                        disabled={isLocked}
                                        onClick={() => {
                                            if (isLocked) return;
                                            setForm(prev => ({
                                                ...prev,
                                                startDate: `${year}-10-05`,
                                                endDate: `${year}-11-29`
                                            }));
                                        }}
                                        className={`p-4 border-2 text-left transition-all ${isLocked
                                            ? 'border-neutral-100 bg-neutral-50 opacity-50 cursor-not-allowed'
                                            : (form.startDate?.endsWith('-10-05') && form.endDate?.endsWith('-11-29')
                                                ? 'border-[#118f46] bg-[#118f46]/5 relative'
                                                : 'border-neutral-200 hover:border-black')
                                            }`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black uppercase text-sm">Tercer Temporada</span>
                                                {isLocked && <span className="text-[10px] bg-neutral-200 text-neutral-500 px-2 py-0.5 rounded-full">Próximamente</span>}
                                            </div>
                                            {!isLocked && form.startDate?.endsWith('-10-05') && form.endDate?.endsWith('-11-29') && (
                                                <div className="bg-[#118f46] text-white p-1 rounded-full">
                                                    <Check className="w-3 h-3" />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs text-neutral-500 font-medium block mt-1">
                                            5 de Octubre - 29 de Noviembre
                                        </span>
                                    </button>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                            {/* Start Date */}
                            <div className="space-y-1">
                                <label className="text-xs font-black uppercase tracking-widest h-8 flex items-end">Fecha de Arranque</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        readOnly
                                        value={((dateStr) => {
                                            if (!dateStr) return '';
                                            const [y, m, d] = dateStr.split('-');
                                            return `${d}/${m}/${y}`;
                                        })(form.startDate)}
                                        placeholder="DD/MM/AAAA"
                                        className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold bg-white text-black pointer-events-none"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="date"
                                        name="startDate"
                                        value={form.startDate}
                                        onChange={handleChange}
                                        onClick={(e) => {
                                            try {
                                                if (typeof (e.currentTarget as any).showPicker === 'function') {
                                                    (e.currentTarget as any).showPicker();
                                                }
                                            } catch (error) { }
                                        }}
                                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* End Date */}
                            <div className="space-y-1">
                                <label className="text-xs font-black uppercase tracking-widest h-8 flex items-end">Fin del Grupo</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        readOnly
                                        value={((dateStr) => {
                                            if (!dateStr) return '';
                                            const [y, m, d] = dateStr.split('-');
                                            return `${d}/${m}/${y}`;
                                        })(form.endDate)}
                                        placeholder="Indefinido"
                                        className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold bg-white text-black pointer-events-none"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-black">
                                        <Calendar className="w-5 h-5" />
                                    </div>
                                    <input
                                        type="date"
                                        name="endDate"
                                        value={form.endDate || ''}
                                        onChange={handleChange}
                                        onClick={(e) => {
                                            try {
                                                if (typeof (e.currentTarget as any).showPicker === 'function') {
                                                    (e.currentTarget as any).showPicker();
                                                }
                                            } catch (error) { }
                                        }}
                                        className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* TAGS */}
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest block">Etiquetas del Grupo</label>
                    <div className="flex flex-wrap gap-2">
                        {availableTags.map(tag => (
                            <button
                                type="button"
                                key={tag.id}
                                onClick={() => toggleTag(tag.id)}
                                className={`px-3 py-1 text-[10px] font-black uppercase border-2 border-black transition-all ${form.tags.includes(tag.id)
                                    ? 'bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)]'
                                    : 'bg-white text-neutral-500 hover:bg-neutral-100'
                                    }`}
                            >
                                {tag.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* CO-HOST INFO */}
                <div className="space-y-4 border-t-2 border-black pt-4">
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Co-Anfitrión (Opcional)</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase block">Nombre</label>
                            <input
                                type="text"
                                name="coHostFirstName"
                                value={form.coHostFirstName}
                                onChange={handleChange}
                                className="w-full h-10 px-3 border-2 border-black rounded-none outline-none font-bold"
                                placeholder="Nombre"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase block">Apellido</label>
                            <input
                                type="text"
                                name="coHostLastName"
                                value={form.coHostLastName}
                                onChange={handleChange}
                                className="w-full h-10 px-3 border-2 border-black rounded-none outline-none font-bold"
                                placeholder="Apellido"
                            />
                        </div>
                    </div>
                </div>

                {/* ADVANCED */}
                <div className="border-t-2 border-black pt-4 space-y-4">
                    <p className="text-xs font-black uppercase tracking-widest text-neutral-400">Detalles Avanzados</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div><label className="text-[10px] font-bold uppercase block">Capacidad</label><input type="number" name="maxCapacity" value={form.maxCapacity} onChange={handleChange} className="w-full p-2 border-2 border-black font-bold" /></div>
                        <div><label className="text-[10px] font-bold uppercase block">Edad Mín</label><input type="number" name="minAge" value={form.minAge} onChange={handleChange} className="w-full p-2 border-2 border-black font-bold" /></div>
                        <div><label className="text-[10px] font-bold uppercase block">Edad Máx</label><input type="number" name="maxAge" value={form.maxAge} onChange={handleChange} className="w-full p-2 border-2 border-black font-bold" /></div>

                        <div>
                            <label className="text-[10px] font-bold uppercase block">Género</label>

                            {/* TARGET GENDER - TOUR STEP 8 (Filtros) */}
                            <div
                                id="tour-wrap-8"
                                className={`relative transition-all duration-300 rounded-xl ${localTourStep === 8 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-1 -m-1 z-[50]' : ''}`}
                            >
                                {localTourStep === 8 && (
                                    <NativeTooltip
                                        title="Filtros de Exclusividad"
                                        description="Define si es para hombres, mujeres o mixto. Si activas 'Exclusivo para Parejas' y género Mixto, el sistema pedirá automáticamente los datos del cónyuge al inscribirse."
                                        step={8}
                                        totalSteps={9}
                                        onNext={() => handleTourNext(9)}
                                        onSkip={handleTourSkip}
                                        placement="top" // FIX: Render above to avoid clipping
                                        align="right"   // FIX: Render right-aligned to avoid overflow
                                    />
                                )}
                                <select
                                    name="targetGender"
                                    value={form.targetGender}
                                    onChange={handleChange}
                                    className="w-full p-2 border-2 border-black font-bold bg-white appearance-none relative z-10"
                                >
                                    {TARGET_GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none z-10" />
                            </div>
                        </div>
                    </div>
                </div>


                {/* SAVE BUTTON - TOUR STEP 9 */}
                <div
                    id="tour-wrap-9"
                    className={`relative transition-all duration-300 rounded-xl ${localTourStep === 9 ? 'ring-4 ring-yellow-400 bg-yellow-400/10 p-2 -m-2 z-[50]' : ''}`}
                >
                    {localTourStep === 9 && (
                        <NativeTooltip
                            title="¡Todo Listo!"
                            description="Revisa que todo esté correcto y presiona crear. Tu grupo pasará a revisión o se publicará inmediatamente."
                            step={9}
                            totalSteps={9}
                            onNext={handleTourFinish}
                            onSkip={handleTourSkip}
                            isLast={true}
                            placement="top" // TO AVOID CLIPPING AT THE BOTTOM
                            align="center"  // Center for aesthetics
                        />
                    )}
                    <button
                        type="submit"
                        disabled={loading || isCheckingSpelling}
                        className={`w-full py-4 text-white font-black uppercase tracking-widest border-2 border-black transition-all flex items-center justify-center gap-2 ${isCheckingSpelling
                            ? 'bg-neutral-300 text-neutral-500 border-neutral-400 cursor-not-allowed'
                            : 'bg-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                            }`}
                    >
                        {loading ? 'Guardando...' : isCheckingSpelling ? 'Analizando texto...' : (
                            <>
                                <Save className="w-5 h-5" />
                                {isReopenRequest ? 'Enviar Solicitud' : (editingGroup ? 'Guardar Cambios' : 'Crear Grupo')}
                            </>
                        )}
                    </button>
                    {isAdminView ? (
                        <p className="text-center text-xs font-bold text-neutral-400 mt-2 uppercase">Modo Administrador Activo</p>
                    ) : (editingGroup?.status === 'rejected') && (
                        <p className="text-center text-xs font-bold text-red-500 mt-2 uppercase">Al guardar, se enviará a revisión nuevamente</p>
                    )}
                </div>
            </form>

            {/* SPELLING WARNING DIALOG - PORTALED TO BODY TO AVOID Z-INDEX/TRANSFORM ISSUES */}
            {showSpellingWarning && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white border-2 border-black p-6 w-full max-w-sm shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] animate-scaleIn">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-12 h-12 bg-yellow-400 border-2 border-black flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                <span className="text-2xl">⚠️</span>
                            </div>

                            <div>
                                <h3 className="text-lg font-black uppercase">¡Atención!</h3>
                                <p className="text-sm font-medium text-neutral-600 mt-2">
                                    La descripción de tu grupo contiene posibles errores de ortografía.
                                </p>
                                <p className="text-sm font-medium text-neutral-600">
                                    ¿Deseas corregirlos antes de continuar?
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 w-full pt-2">
                                <button
                                    onClick={() => {
                                        setShowSpellingWarning(false);
                                        handleFixSpelling();
                                    }}
                                    className="w-full py-3 bg-yellow-400 text-black font-black uppercase border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none transition-all flex items-center justify-center gap-2"
                                >
                                    <Wand2 className="w-4 h-4" />
                                    Corregir Errores
                                </button>

                                <button
                                    onClick={() => confirmSubmit()}
                                    className="w-full py-3 bg-white text-neutral-500 font-bold uppercase border-2 border-transparent hover:text-black hover:underline transition-all"
                                >
                                    Crear de todas formas
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </NeoModal>
    );
};

export default CreateGroupModal;

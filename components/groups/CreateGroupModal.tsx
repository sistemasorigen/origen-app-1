import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import NeoModal from '../NeoModal';
import { Group, User, GroupTag } from '../../types';
import { supabaseService, insertGroupDirect, updateGroupDirect } from '../../services/supabaseService';
import { Save, UserPlus, Users, Crown, Search, Check, ChevronDown, Calendar, ArrowRight, Wand2 } from 'lucide-react';
import ImageUpload from '../ImageUpload';
import { useSpellingAI } from '../../hooks/useSpellingAI';

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

    // Admin View State
    const [potentialHosts, setPotentialHosts] = useState<User[]>([]);
    const [selectedHostId, setSelectedHostId] = useState<string>('');
    const [hostSearchTerm, setHostSearchTerm] = useState('');
    const [isHostSelectOpen, setIsHostSelectOpen] = useState(false);

    // Form State
    const [form, setForm] = useState({
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
        tags: [] as string[],
        startDate: '',
        endDate: ''
    });

    const [showSpellingWarning, setShowSpellingWarning] = useState(false);

    // AI Spelling Guard
    const { isChecking: isCheckingSpelling, isCorrecting, hasErrors: spellingErrors, correctionStatus, checkSpelling, fixText, resetState: resetSpelling } = useSpellingAI();

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
        setForm(prev => ({
            ...prev,
            [name]: (name === 'maxCapacity' || name === 'maxAge' || name === 'minAge') ? (parseInt(value) || 0) : value
        }));
    };

    const toggleTag = (tagName: string) => {
        setForm(prev => {
            const currentTags = prev.tags || [];
            if (currentTags.includes(tagName)) {
                return { ...prev, tags: currentTags.filter(t => t !== tagName) };
            } else {
                return { ...prev, tags: [...currentTags, tagName] };
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
        if (form.maxCapacity <= 0) return alert('La capacidad debe ser mayor a 0.');
        if (form.minAge <= 0) return alert('La edad mínima debe ser mayor a 0.');
        if (form.maxAge <= 0) return alert('La edad máxima debe ser mayor a 0.');
        if (form.minAge > form.maxAge) return alert('La edad mínima no puede ser mayor a la edad máxima.');

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
            let finalStatus: 'approved' | 'pending' | 'rejected' = editingGroup?.status || 'pending';

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
                maxCapacity: form.maxCapacity,
                imageUrl: form.imageUrl,
                categoryId: form.categoryId,
                membersCount: editingGroup?.membersCount || 0,
                tags: form.tags,
                host_id: finalHostId,
                coHostFirstName: form.coHostFirstName,
                coHostLastName: form.coHostLastName,
                minAge: form.minAge,
                maxAge: form.maxAge,
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

    return (
        <NeoModal
            isOpen={isOpen}
            onClose={onClose}
            title={isReopenRequest ? 'Solicitud de Re-Apertura' : (editingGroup ? 'Editar Grupo' : 'Nuevo Grupo')}
        >
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

                {/* BASIC INFO */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-black uppercase tracking-widest block">Nombre del Grupo</label>
                        <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold text-lg focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-black uppercase tracking-widest block">Categoría</label>
                            <div className="relative">
                                <select
                                    name="categoryId"
                                    value={form.categoryId}
                                    onChange={handleChange}
                                    className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold bg-white appearance-none"
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-black uppercase tracking-widest block">Barrio</label>
                            <input type="text" name="location" value={form.location} onChange={handleChange} className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold" />
                        </div>
                    </div>
                </div>

                {/* SCHEDULE */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-black uppercase tracking-widest block">Día</label>
                        <div className="relative">
                            <select name="meetingDay" value={form.meetingDay} onChange={handleChange} className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold bg-white appearance-none">
                                {MEETING_DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-black uppercase tracking-widest block">Horario</label>
                        <input type="time" name="meetingTime" value={form.meetingTime} onChange={handleChange} className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold" />
                    </div>
                </div>

                {/* START AND END DATES */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                {/* IMAGE */}
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest block">Imagen</label>
                    <ImageUpload
                        currentImage={form.imageUrl}
                        folder="groups"
                        onImageUpload={(url) => setForm(prev => ({ ...prev, imageUrl: url }))}
                        aspectRatio="wide"
                    />
                </div>

                {/* DESCRIPTION */}
                <div className="space-y-1">
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

                {/* TAGS */}
                <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest block">Etiquetas del Grupo</label>
                    <div className="flex flex-wrap gap-2">
                        {availableTags.map(tag => (
                            <button
                                type="button"
                                key={tag.id}
                                onClick={() => toggleTag(tag.name)}
                                className={`px-3 py-1 text-[10px] font-black uppercase border-2 border-black transition-all ${form.tags.includes(tag.name)
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
                            <div className="relative">
                                <select
                                    name="targetGender"
                                    value={form.targetGender}
                                    onChange={handleChange}
                                    className="w-full p-2 border-2 border-black font-bold bg-white appearance-none"
                                >
                                    {TARGET_GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" />
                            </div>
                        </div>
                    </div>
                </div>


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

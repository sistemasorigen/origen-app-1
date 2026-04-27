import React, { useState, useEffect } from 'react';
import NeoModal from '../NeoModal';
import { Group, User, GroupTag } from '../../types';
import { supabaseService, insertGroupDirect } from '../../services/supabaseService';
import { Save, Crown, Search, Check, ChevronDown, Users, Calendar, Tag, X } from 'lucide-react';
import ImageUpload from '../ImageUpload';

interface AdminCreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    currentUser: User | null;
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

const AdminCreateGroupModal: React.FC<AdminCreateGroupModalProps> = ({
    isOpen,
    onClose,
    onSave,
    currentUser
}) => {
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [availableTags, setAvailableTags] = useState<GroupTag[]>([]);
    const [loading, setLoading] = useState(false);

    // Host Selection State
    const [potentialHosts, setPotentialHosts] = useState<User[]>([]);
    const [selectedHostId, setSelectedHostId] = useState<string>('');
    const [hostSearchTerm, setHostSearchTerm] = useState('');
    const [isHostSelectOpen, setIsHostSelectOpen] = useState(false);

    // Co-Host Selection State
    const [potentialCoHosts, setPotentialCoHosts] = useState<User[]>([]);
    const [selectedCoHostId, setSelectedCoHostId] = useState<string>('');
    const [coHostSearchTerm, setCoHostSearchTerm] = useState('');
    const [isCoHostSelectOpen, setIsCoHostSelectOpen] = useState(false);

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
        endDate: '',
        leaderName: '',
        leaderSurname: ''
    });

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

    // Search Hosts
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(async () => {
            const results = await supabaseService.searchPotentialHosts(hostSearchTerm);
            setPotentialHosts(results);
        }, 300);
        return () => clearTimeout(timer);
    }, [hostSearchTerm, isOpen]);

    // Search Co-Hosts
    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(async () => {
            const results = await supabaseService.searchPotentialHosts(coHostSearchTerm);
            setPotentialCoHosts(results.filter(u => u.id !== selectedHostId));
        }, 300);
        return () => clearTimeout(timer);
    }, [coHostSearchTerm, isOpen, selectedHostId]);

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

    const handleImageUpload = (url: string) => {
        setForm(prev => ({ ...prev, imageUrl: url }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return alert('El nombre del grupo es obligatorio');

        const hasSelectedHost = !!selectedHostId;
        const hasManualHost = form.leaderName.trim().length > 0;

        if (!hasSelectedHost && !hasManualHost) {
            return alert('Debes asignar un Anfitrión (buscando o ingresando manualmente).');
        }

        setLoading(true);

        try {
            const selectedHostUser = potentialHosts.find(u => u.id === selectedHostId);

            let finalLeaderName = form.leaderName.trim() || 'Anfitrión';
            let finalLeaderSurname = form.leaderSurname.trim();

            if (!form.leaderName.trim() && selectedHostUser) {
                const hostNameParts = selectedHostUser.name.trim().split(/\s+/);
                finalLeaderName = hostNameParts[0] || selectedHostUser.name;
                finalLeaderSurname = hostNameParts.slice(1).join(' ') || '';
            }

            const groupData: Partial<Group> & { host_id?: string; co_host_id?: string } = {
                id: generateUUID(),
                name: form.name,
                leaderName: finalLeaderName,
                leaderSurname: finalLeaderSurname,
                leaderPhone: selectedHostUser?.phone || '',
                meetingDay: form.meetingDay,
                meetingTime: form.meetingTime,
                location: form.location,
                description: form.description,
                maxCapacity: form.maxCapacity,
                imageUrl: form.imageUrl,
                categoryId: form.categoryId,
                membersCount: 0,
                tags: form.tags,
                host_id: selectedHostId,
                co_host_id: selectedCoHostId || undefined,
                coHostFirstName: form.coHostFirstName,
                coHostLastName: form.coHostLastName,
                minAge: form.minAge,
                maxAge: form.maxAge,
                targetGender: form.targetGender as any,
                startDate: form.startDate,
                endDate: form.endDate,
                status: 'approved',
            };

            if (selectedHostUser && selectedHostUser.role !== 'ANFITRION' && !selectedHostUser.role.includes('ADMIN')) {
                await supabaseService.promoteUserToHost(selectedHostId);
            }

            const result = await insertGroupDirect(groupData as Group);

            if (result) {
                onSave();
                onClose();
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
            title="Asignar Nuevo Grupo (Admin)"
            maxWidth="max-w-2xl md:max-w-3xl lg:max-w-4xl"
        >
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* ASSIGN HOST */}
                <div className="bg-yellow-50 p-4 border-l-4 border-yellow-400">
                    <p className="text-xs font-black uppercase tracking-widest text-yellow-800 mb-2 flex items-center gap-1">
                        <Crown className="w-4 h-4" /> 1. Asignar Anfitrión (Obligatorio)
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
                                <input
                                    type="text"
                                    name="leaderName"
                                    value={form.leaderName}
                                    onChange={handleChange}
                                    placeholder="Ej: Juan"
                                    className="w-full p-2 border-2 border-yellow-700/20 bg-white font-bold"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-yellow-700 block mb-1">Apellido (Manual)</label>
                                <input
                                    type="text"
                                    name="leaderSurname"
                                    value={form.leaderSurname}
                                    onChange={handleChange}
                                    placeholder="Ej: Pérez"
                                    className="w-full p-2 border-2 border-yellow-700/20 bg-white font-bold"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* BASIC INFO */}
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-black uppercase tracking-widest block">Nombre del Grupo</label>
                        <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            className="w-full h-12 px-3 border-2 border-black rounded-none outline-none font-bold text-lg md:text-xl focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

                {/* CO-HOST & SCHEDULE */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Co-Host Search */}
                    <div className="relative space-y-1">
                        <label className="text-xs font-black uppercase tracking-widest block text-purple-600">Co-Anfitrión (Opcional)</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                            <input
                                type="text"
                                placeholder="Buscar co-anfitrión..."
                                value={coHostSearchTerm}
                                onFocus={() => setIsCoHostSelectOpen(true)}
                                onChange={e => {
                                    setCoHostSearchTerm(e.target.value);
                                    setIsCoHostSelectOpen(true);
                                    setSelectedCoHostId('');
                                }}
                                className="w-full pl-10 h-12 border-2 border-purple-200 outline-none font-bold focus:border-purple-600 transition-colors"
                            />
                            {isCoHostSelectOpen && potentialCoHosts.length > 0 && (
                                <div className="absolute top-full left-0 w-full bg-white border-2 border-black mt-1 max-h-48 overflow-y-auto z-50">
                                    {potentialCoHosts.map(u => (
                                        <div
                                            key={u.id}
                                            onClick={() => {
                                                setSelectedCoHostId(u.id);
                                                setCoHostSearchTerm(u.name);
                                                setIsCoHostSelectOpen(false);
                                                const parts = u.name.trim().split(/\s+/);
                                                setForm(prev => ({
                                                    ...prev,
                                                    coHostFirstName: parts[0] || u.name,
                                                    coHostLastName: parts.slice(1).join(' ') || ''
                                                }));
                                            }}
                                            className="p-3 hover:bg-purple-50 cursor-pointer border-b border-neutral-100 last:border-0"
                                        >
                                            <p className="font-bold text-sm">{u.name}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

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
                                    value={form.endDate}
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
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-black uppercase tracking-widest block">Día</label>
                        <select name="meetingDay" value={form.meetingDay} onChange={handleChange} className="w-full h-12 px-3 border-2 border-black font-bold bg-white">
                            {MEETING_DAYS.map(day => <option key={day} value={day}>{day}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-black uppercase tracking-widest block">Hora</label>
                        <input type="time" name="meetingTime" value={form.meetingTime} onChange={handleChange} className="w-full h-12 px-3 border-2 border-black font-bold" />
                    </div>
                </div>

                {/* IMAGES & DESC */}
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest block">Imagen de Portada</label>
                    <ImageUpload
                        onImageUpload={handleImageUpload}
                        currentImage={form.imageUrl}
                        placeholder="IMAGEN DE PORTADA"
                        aspectRatio="wide"
                        customUploadFn={supabaseService.uploadGroupImage}
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest block">Descripción</label>
                    <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        rows={3}
                        className="w-full p-3 border-2 border-black rounded-none outline-none font-medium resize-none"
                    />
                </div>

                {/* ADVANCED */}
                <div className="border-t-2 border-black pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] font-bold uppercase block">Género</label>
                            <select name="targetGender" value={form.targetGender} onChange={handleChange} className="w-full p-2 border-2 border-black font-bold bg-white">
                                {TARGET_GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase block">Min Edad</label>
                            <input type="number" name="minAge" value={form.minAge} onChange={handleChange} className="w-full p-2 border-2 border-black font-bold" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold uppercase block">Max Edad</label>
                            <input type="number" name="maxAge" value={form.maxAge} onChange={handleChange} className="w-full p-2 border-2 border-black font-bold" />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-black uppercase tracking-widest block mb-2">Etiquetas</label>
                        <div className="flex flex-wrap gap-2">
                            {availableTags.map(tag => {
                                const isSelected = form.tags.includes(tag.id);
                                return (
                                    <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() => toggleTag(tag.id)}
                                        className={`px-3 py-1 text-[10px] font-black uppercase border-2 transition-all ${isSelected ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-300'}`}
                                    >
                                        {tag.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex md:justify-end">
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full md:w-auto md:px-10 py-4 bg-black text-white font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? 'Guardando...' : <><Save className="w-5 h-5" /> Crear Grupo</>}
                    </button>
                </div>

            </form>
        </NeoModal>
    );
};

export default AdminCreateGroupModal;

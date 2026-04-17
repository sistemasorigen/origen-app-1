import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { InfluosAttendee } from '../../types';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { useToast } from '../infopoint/context/ToastContext';
import NeoModal from '../../components/NeoModal';

interface InfluosEditModalProps {
    attendee: InfluosAttendee | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: () => void;
}

type Tribe = 'Trueno (celeste)' | 'Garra (naranja)';

const TRIBE_OPTIONS: { value: Tribe; label: string; sub: string; color: string; activeBg: string }[] = [
    {
        value: 'Trueno (celeste)',
        label: 'Trueno',
        sub: 'Celeste',
        color: 'bg-sky-400',
        activeBg: 'bg-sky-500 border-sky-500 text-white',
    },
    {
        value: 'Garra (naranja)',
        label: 'Garra',
        sub: 'Naranja',
        color: 'bg-orange-500',
        activeBg: 'bg-orange-500 border-orange-500 text-white',
    },
];

const normalizeTribe = (tribe?: string): Tribe =>
    (tribe === 'Garra (naranja)' || tribe?.toLowerCase() === 'naranja')
        ? 'Garra (naranja)'
        : 'Trueno (celeste)';

const InfluosEditModal: React.FC<InfluosEditModalProps> = ({ attendee, isOpen, onClose, onUpdate }) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<{
        first_name: string;
        last_name: string;
        age: number;
        phone: string;
        tribe: Tribe;
        is_first_time: boolean;
    }>({
        first_name: '',
        last_name: '',
        age: 0,
        phone: '',
        tribe: 'Trueno (celeste)',
        is_first_time: true,
    });

    useEffect(() => {
        if (attendee) {
            setFormData({
                first_name: attendee.first_name,
                last_name: attendee.last_name,
                age: attendee.age,
                phone: attendee.phone,
                tribe: normalizeTribe(attendee.tribe),
                is_first_time: attendee.is_first_time,
            });
        }
    }, [attendee]);

    if (!isOpen || !attendee) return null;

    const ageIsInvalid = formData.age >= 18;

    const handleSave = async () => {
        if (!attendee) return;
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('influos_attendees')
                .update({
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    age: formData.age,
                    phone: formData.phone,
                    tribe: formData.tribe,
                    is_first_time: formData.is_first_time,
                })
                .eq('id', attendee.id);
            if (error) throw error;
            toast.success('Datos actualizados correctamente.');
            onUpdate();
            onClose();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            toast.error('Error al actualizar: ' + msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!attendee) return;
        if (!confirm(`¿Eliminar a ${attendee.first_name} ${attendee.last_name}? Esta acción no se puede deshacer.`)) return;
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('influos_attendees')
                .delete()
                .eq('id', attendee.id);
            if (error) throw error;
            toast.success('Asistente eliminado.');
            onUpdate();
            onClose();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            toast.error('Error al eliminar: ' + msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <NeoModal isOpen={isOpen} onClose={onClose} title="Editar Asistente">
            <div className="space-y-5">

                {/* Nombre */}
                <div>
                    <label className="block text-xs font-black uppercase mb-1.5 text-black">Nombre</label>
                    <input
                        type="text"
                        required
                        value={formData.first_name}
                        onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                        className="w-full h-12 px-3 font-bold outline-none text-black bg-white"
                        style={{ borderRadius: 0 }}
                    />
                </div>

                {/* Apellido */}
                <div>
                    <label className="block text-xs font-black uppercase mb-1.5 text-black">Apellido</label>
                    <input
                        type="text"
                        required
                        value={formData.last_name}
                        onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                        className="w-full h-12 px-3 font-bold outline-none text-black bg-white"
                        style={{ borderRadius: 0 }}
                    />
                </div>

                {/* Edad y Celular en fila */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs font-black uppercase mb-1.5 text-black">Edad</label>
                        <input
                            type="number"
                            required
                            min={1}
                            value={formData.age}
                            onChange={e => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                            className="w-full h-12 px-3 font-bold outline-none text-black bg-white"
                            style={{ borderRadius: 0 }}
                        />
                        {ageIsInvalid && (
                            <p className="text-[11px] font-bold text-amber-600 mt-1">
                                Influos es para menores de 18
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase mb-1.5 text-black">Celular</label>
                        <input
                            type="tel"
                            required
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full h-12 px-3 font-bold outline-none text-black bg-white"
                            style={{ borderRadius: 0 }}
                        />
                    </div>
                </div>

                {/* Tribu */}
                <div>
                    <label className="block text-xs font-black uppercase mb-2 text-black">Tribu</label>
                    <div className="flex gap-3">
                        {TRIBE_OPTIONS.map(t => (
                            <button
                                key={t.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, tribe: t.value })}
                                className={`flex-1 h-14 flex items-center gap-3 px-4 border-2 font-black transition-all ${
                                    formData.tribe === t.value
                                        ? t.activeBg
                                        : 'bg-white border-black text-black hover:bg-gray-50'
                                }`}
                            >
                                <div className={`w-4 h-4 shrink-0 ${t.color} ${formData.tribe === t.value ? 'ring-2 ring-white/60' : ''}`} />
                                <div className="text-left">
                                    <p className="text-xs font-black uppercase leading-none">{t.label}</p>
                                    <p className={`text-[10px] font-bold uppercase mt-0.5 ${formData.tribe === t.value ? 'opacity-70' : 'text-gray-500'}`}>
                                        {t.sub}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ¿Primera vez? */}
                <div>
                    <label className="block text-xs font-black uppercase mb-2 text-black">
                        ¿Es la primera vez que venís a Influos?
                    </label>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, is_first_time: true })}
                            className={`flex-1 h-12 border-2 font-black text-xs uppercase transition-all ${
                                formData.is_first_time
                                    ? 'bg-black border-black text-white'
                                    : 'bg-white border-black text-black hover:bg-neutral-100'
                            }`}
                        >
                            Sí, primera vez
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, is_first_time: false })}
                            className={`flex-1 h-12 border-2 font-black text-xs uppercase transition-all ${
                                !formData.is_first_time
                                    ? 'bg-black border-black text-white'
                                    : 'bg-white border-black text-black hover:bg-neutral-100'
                            }`}
                        >
                            Ya vine antes
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 pt-4 border-t-2 border-black">
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isLoading}
                        className="h-10 px-4 flex items-center gap-1.5 text-xs font-black uppercase text-red-600 border-2 border-red-200 hover:bg-red-50 hover:border-red-400 transition-all disabled:opacity-40"
                    >
                        <Trash2 size={14} />
                        Eliminar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isLoading || ageIsInvalid}
                        className="h-12 px-6 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-violet-600 hover:border-violet-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        style={{ borderRadius: 0 }}
                    >
                        {isLoading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <><Save size={16} /> Guardar Cambios</>
                        }
                    </button>
                </div>
            </div>
        </NeoModal>
    );
};

export default InfluosEditModal;

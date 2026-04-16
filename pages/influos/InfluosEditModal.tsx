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

const InfluosEditModal: React.FC<InfluosEditModalProps> = ({ attendee, isOpen, onClose, onUpdate }) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState<Omit<InfluosAttendee, 'id' | 'created_at'> & { tribe: 'Celeste' | 'Naranja' }>({
        first_name: '',
        last_name: '',
        age: 0,
        phone: '',
        tribe: 'Celeste',
        is_first_time: true
    });

    useEffect(() => {
        if (attendee) {
            setFormData({
                first_name: attendee.first_name,
                last_name: attendee.last_name,
                age: attendee.age,
                phone: attendee.phone,
                tribe: (attendee.tribe === 'Naranja' ? 'Naranja' : 'Celeste') as 'Celeste' | 'Naranja',
                is_first_time: attendee.is_first_time
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
                    is_first_time: formData.is_first_time
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
            <div className="space-y-4">
                {/* Nombre y Apellido */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black uppercase mb-1 text-black">Nombre</label>
                        <input
                            type="text"
                            required
                            value={formData.first_name}
                            onChange={e => setFormData({ ...formData, first_name: e.target.value })}
                            className="w-full h-10 px-3 border-2 border-black font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all text-black bg-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase mb-1 text-black">Apellido</label>
                        <input
                            type="text"
                            required
                            value={formData.last_name}
                            onChange={e => setFormData({ ...formData, last_name: e.target.value })}
                            className="w-full h-10 px-3 border-2 border-black font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all text-black bg-white"
                        />
                    </div>
                </div>

                {/* Edad y Celular */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black uppercase mb-1 text-black">Edad</label>
                        <input
                            type="number"
                            required
                            min={1}
                            value={formData.age}
                            onChange={e => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                            className="w-full h-10 px-3 border-2 border-black font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all text-black bg-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase mb-1 text-black">Celular</label>
                        <input
                            type="tel"
                            required
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full h-10 px-3 border-2 border-black font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all text-black bg-white"
                        />
                    </div>
                </div>

                {/* Tribu */}
                <div>
                    <label className="block text-xs font-black uppercase mb-2 text-black">Tribu</label>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, tribe: 'Celeste' })}
                            className={`flex-1 py-3 border-2 font-black text-xs uppercase transition-all ${
                                formData.tribe === 'Celeste'
                                    ? 'bg-sky-500 border-sky-500 text-white shadow-[4px_4px_0px_0px_rgba(14,165,233,0.5)]'
                                    : 'bg-white border-black text-black hover:bg-sky-50'
                            }`}
                        >
                            🔵 Celeste
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, tribe: 'Naranja' })}
                            className={`flex-1 py-3 border-2 font-black text-xs uppercase transition-all ${
                                formData.tribe === 'Naranja'
                                    ? 'bg-orange-500 border-orange-500 text-white shadow-[4px_4px_0px_0px_rgba(249,115,22,0.5)]'
                                    : 'bg-white border-black text-black hover:bg-orange-50'
                            }`}
                        >
                            🟠 Naranja
                        </button>
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
                            className={`flex-1 py-3 border-2 font-black text-xs uppercase transition-all ${formData.is_first_time
                                ? 'bg-black border-black text-white'
                                : 'bg-white border-black text-black hover:bg-neutral-100'}`}
                        >
                            Sí, primera vez
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, is_first_time: false })}
                            className={`flex-1 py-3 border-2 font-black text-xs uppercase transition-all ${!formData.is_first_time
                                ? 'bg-black border-black text-white'
                                : 'bg-white border-black text-black hover:bg-neutral-100'}`}
                        >
                            Ya vine antes
                        </button>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-between items-center pt-4 border-t-4 border-black mt-4">
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isLoading}
                        className="flex items-center gap-1 text-red-500 font-bold uppercase text-xs hover:underline disabled:opacity-50"
                    >
                        <Trash2 size={14} /> Eliminar
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isLoading}
                        className="h-10 px-6 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Guardar Cambios</>}
                    </button>
                </div>
            </div>
        </NeoModal>
    );
};

export default InfluosEditModal;

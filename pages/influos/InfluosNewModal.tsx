import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '../infopoint/context/ToastContext';
import NeoModal from '../../components/NeoModal';

interface InfluosNewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const InfluosNewModal: React.FC<InfluosNewModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        age: '',
        phone: '',
        tribe: 'Celeste' as 'Celeste' | 'Naranja',
        isFirstTime: true
    });

    const ageNum = parseInt(form.age);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('influos_attendees')
                .insert({
                    first_name: form.firstName,
                    last_name: form.lastName,
                    age: parseInt(form.age),
                    phone: form.phone,
                    tribe: form.tribe,
                    is_first_time: form.isFirstTime
                });
            if (error) throw error;
            toast.success('Asistente registrado correctamente.');
            onSuccess();
            onClose();
            setForm({ firstName: '', lastName: '', age: '', phone: '', tribe: 'Celeste', isFirstTime: true });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            toast.error('Error al registrar: ' + msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <NeoModal isOpen={isOpen} onClose={onClose} title="Nuevo Asistente Influos">
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nombre y Apellido */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-black uppercase mb-1 text-black">Nombre</label>
                        <input
                            type="text"
                            required
                            value={form.firstName}
                            onChange={e => setForm({ ...form, firstName: e.target.value })}
                            className="w-full h-10 px-3 border-2 border-black font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all text-black bg-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase mb-1 text-black">Apellido</label>
                        <input
                            type="text"
                            required
                            value={form.lastName}
                            onChange={e => setForm({ ...form, lastName: e.target.value })}
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
                            value={form.age}
                            onChange={e => setForm({ ...form, age: e.target.value })}
                            className="w-full h-10 px-3 border-2 border-black font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all text-black bg-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase mb-1 text-black">Celular</label>
                        <input
                            type="tel"
                            required
                            value={form.phone}
                            onChange={e => setForm({ ...form, phone: e.target.value })}
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
                            onClick={() => setForm({ ...form, tribe: 'Celeste' })}
                            className={`flex-1 py-3 border-2 font-black text-xs uppercase transition-all ${
                                form.tribe === 'Celeste'
                                    ? 'bg-sky-500 border-sky-500 text-white shadow-[4px_4px_0px_0px_rgba(14,165,233,0.5)]'
                                    : 'bg-white border-black text-black hover:bg-sky-50'
                            }`}
                        >
                            🔵 Celeste
                        </button>
                        <button
                            type="button"
                            onClick={() => setForm({ ...form, tribe: 'Naranja' })}
                            className={`flex-1 py-3 border-2 font-black text-xs uppercase transition-all ${
                                form.tribe === 'Naranja'
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
                            onClick={() => setForm({ ...form, isFirstTime: true })}
                            className={`flex-1 py-3 border-2 font-black text-xs uppercase transition-all ${form.isFirstTime
                                ? 'bg-black border-black text-white'
                                : 'bg-white border-black text-black hover:bg-neutral-100'}`}
                        >
                            Sí, primera vez
                        </button>
                        <button
                            type="button"
                            onClick={() => setForm({ ...form, isFirstTime: false })}
                            className={`flex-1 py-3 border-2 font-black text-xs uppercase transition-all ${!form.isFirstTime
                                ? 'bg-black border-black text-white'
                                : 'bg-white border-black text-black hover:bg-neutral-100'}`}
                        >
                            Ya vine antes
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-10 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Registrar Asistente</>}
                </button>
            </form>
        </NeoModal>
    );
};

export default InfluosNewModal;

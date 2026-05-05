import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Loader2, Save } from 'lucide-react';
import { useToast } from '../punto-informacion/context/ContextoToast';
import NeoModal from '../../components/ui/NeoModal';

interface InfluosNewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

type Tribe = 'Trueno (celeste)' | 'Garra (naranja)';

const TRIBE_OPTIONS: { value: Tribe; label: string; sub: string; color: string; activeBg: string; activeText: string }[] = [
    {
        value: 'Trueno (celeste)',
        label: 'Trueno',
        sub: 'Celeste',
        color: 'bg-sky-400',
        activeBg: 'bg-sky-500 border-sky-500 text-white',
        activeText: 'text-white',
    },
    {
        value: 'Garra (naranja)',
        label: 'Garra',
        sub: 'Naranja',
        color: 'bg-orange-500',
        activeBg: 'bg-orange-500 border-orange-500 text-white',
        activeText: 'text-white',
    },
];

const InfluosNewModal: React.FC<InfluosNewModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        age: '',
        phone: '',
        tribe: 'Trueno (celeste)' as Tribe,
        isFirstTime: true,
    });

    const ageNum = parseInt(form.age);
    const ageIsInvalid = !isNaN(ageNum) && ageNum >= 18;

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
                    is_first_time: form.isFirstTime,
                });
            if (error) throw error;
            toast.success('Asistente registrado correctamente.');
            onSuccess();
            onClose();
            setForm({ firstName: '', lastName: '', age: '', phone: '', tribe: 'Trueno (celeste)', isFirstTime: true });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            toast.error('Error al registrar: ' + msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <NeoModal isOpen={isOpen} onClose={onClose} title="Nuevo Asistente Influos">
            <form onSubmit={handleSubmit} className="space-y-5">

                {/* Nombre */}
                <div>
                    <label className="block text-xs font-black uppercase mb-1.5 text-black">Nombre</label>
                    <input
                        type="text"
                        required
                        placeholder="Ej: Valentina"
                        value={form.firstName}
                        onChange={e => setForm({ ...form, firstName: e.target.value })}
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
                        placeholder="Ej: González"
                        value={form.lastName}
                        onChange={e => setForm({ ...form, lastName: e.target.value })}
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
                            placeholder="Ej: 15"
                            value={form.age}
                            onChange={e => setForm({ ...form, age: e.target.value })}
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
                            placeholder="Ej: 1134567890"
                            value={form.phone}
                            onChange={e => setForm({ ...form, phone: e.target.value })}
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
                                onClick={() => setForm({ ...form, tribe: t.value })}
                                className={`flex-1 h-14 flex items-center gap-3 px-4 border-2 font-black transition-all ${
                                    form.tribe === t.value
                                        ? t.activeBg
                                        : 'bg-white border-black text-black hover:bg-gray-50'
                                }`}
                            >
                                <div className={`w-4 h-4 shrink-0 ${t.color} ${form.tribe === t.value ? 'ring-2 ring-white/60' : ''}`} />
                                <div className="text-left">
                                    <p className="text-xs font-black uppercase leading-none">{t.label}</p>
                                    <p className={`text-[10px] font-bold uppercase mt-0.5 ${form.tribe === t.value ? 'opacity-70' : 'text-gray-500'}`}>
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
                            onClick={() => setForm({ ...form, isFirstTime: true })}
                            className={`flex-1 h-12 border-2 font-black text-xs uppercase transition-all ${
                                form.isFirstTime
                                    ? 'bg-black border-black text-white'
                                    : 'bg-white border-black text-black hover:bg-neutral-100'
                            }`}
                        >
                            Sí, primera vez
                        </button>
                        <button
                            type="button"
                            onClick={() => setForm({ ...form, isFirstTime: false })}
                            className={`flex-1 h-12 border-2 font-black text-xs uppercase transition-all ${
                                !form.isFirstTime
                                    ? 'bg-black border-black text-white'
                                    : 'bg-white border-black text-black hover:bg-neutral-100'
                            }`}
                        >
                            Ya vine antes
                        </button>
                    </div>
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={isLoading || ageIsInvalid}
                    className="w-full h-12 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-violet-600 hover:border-violet-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ borderRadius: 0 }}
                >
                    {isLoading
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Save size={16} /> Registrar Asistente</>
                    }
                </button>
            </form>
        </NeoModal>
    );
};

export default InfluosNewModal;

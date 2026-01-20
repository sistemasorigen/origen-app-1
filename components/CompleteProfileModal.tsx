import React, { useState } from 'react';
import NeoModal from './NeoModal';
import { User, Phone, Calendar, Users, Loader2 } from 'lucide-react';

interface CompleteProfileModalProps {
    userName: string;
    onComplete: (data: { phone: string; age: number; gender: string; birthDate: string }) => Promise<boolean>;
}

const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({ userName, onComplete }) => {
    const [phone, setPhone] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [gender, setGender] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Calculate age from birth date
    const calculateAge = (birthDateStr: string): number => {
        if (!birthDateStr) return 0;
        const today = new Date();
        const birth = new Date(birthDateStr);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validation
        if (!phone.trim()) {
            setError('Por favor ingresa tu número de teléfono');
            return;
        }
        if (!birthDate) {
            setError('Por favor selecciona tu fecha de nacimiento');
            return;
        }
        const calculatedAge = calculateAge(birthDate);
        if (calculatedAge < 1 || calculatedAge > 120) {
            setError('Por favor ingresa una fecha de nacimiento válida');
            return;
        }
        if (!gender) {
            setError('Por favor selecciona tu sexo');
            return;
        }

        setIsSubmitting(true);
        try {
            const success = await onComplete({
                phone: phone.trim(),
                age: calculatedAge,
                gender,
                birthDate
            });
            if (!success) {
                setError('Error al guardar. Por favor intenta de nuevo.');
            }
        } catch (err) {
            setError('Error al guardar. Por favor intenta de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <NeoModal
            isOpen={true}
            onClose={() => { }}
            persistent={true}
        >
            <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-black text-white flex items-center justify-center rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <User className="w-8 h-8" />
                </div>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-black">
                    ¡Completa tu Perfil!
                </h2>
                <p className="text-sm text-neutral-600 mt-2">
                    Hola <span className="font-bold">{userName}</span>, necesitamos algunos datos adicionales para continuar.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Phone */}
                <div>
                    <label className="flex items-center gap-2 text-xs font-black uppercase text-neutral-500 mb-2">
                        <Phone className="w-4 h-4" /> Teléfono
                    </label>
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+54 9 11 1234 5678"
                        className="w-full p-3 border-2 border-black text-sm font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:ring-0 outline-none"
                    />
                </div>

                {/* Birth Date */}
                <div>
                    <label className="flex items-center gap-2 text-xs font-black uppercase text-neutral-500 mb-2">
                        <Calendar className="w-4 h-4" /> Fecha de Nacimiento
                    </label>
                    <div className="relative">
                        <input
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className="w-full p-3 border-2 border-black text-sm font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:ring-0 outline-none"
                        />
                    </div>
                    {birthDate && (
                        <p className="text-xs text-neutral-500 mt-1 font-medium">
                            Edad: <span className="font-bold">{calculateAge(birthDate)} años</span>
                        </p>
                    )}
                </div>

                {/* Gender */}
                <div>
                    <label className="flex items-center gap-2 text-xs font-black uppercase text-neutral-500 mb-2">
                        <Users className="w-4 h-4" /> Sexo
                    </label>
                    <div className="relative">
                        <select
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                            className="w-full p-3 border-2 border-black text-sm font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] focus:ring-0 outline-none bg-white appearance-none"
                        >
                            <option value="">Seleccionar...</option>
                            <option value="Masculino">Masculino</option>
                            <option value="Femenino">Femenino</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <span className="text-xs">▼</span>
                        </div>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className="p-3 bg-red-50 border-2 border-red-500 text-red-700 text-sm font-black uppercase">
                        {error}
                    </div>
                )}

                {/* Submit */}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full px-6 py-4 bg-black text-white text-sm font-black uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(100,100,100,1)] hover:shadow-[6px_6px_0px_0px_rgba(100,100,100,1)] hover:-translate-y-1 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSubmitting ? 'Guardando...' : 'Continuar'}
                </button>
            </form>

            <p className="text-[10px] text-neutral-400 text-center mt-4 font-medium uppercase tracking-wider">
                Requerido para el acceso
            </p>
        </NeoModal>
    );
};

export default CompleteProfileModal;

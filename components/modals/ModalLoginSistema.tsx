import React, { useState } from 'react';
import NeoModal from '../ui/NeoModal';
import { Lock } from 'lucide-react';

interface SystemLoginModalProps {
    systemName: string;
    isOpen: boolean;
    onClose: () => void;
    onLogin: (email: string, pass: string) => Promise<boolean>;
}

const SystemLoginModal: React.FC<SystemLoginModalProps> = ({ systemName, isOpen, onClose, onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const success = await onLogin(email, password);

        setLoading(false);
        if (!success) {
            setError('Credenciales incorrectas para este sistema.');
        }
    };

    return (
        <NeoModal
            isOpen={isOpen}
            onClose={onClose}
            title="Acceso Restringido"
        >
            <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 bg-black flex items-center justify-center border-2 border-black mb-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                    <Lock className="w-8 h-8 text-white" />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest text-neutral-500">
                    {systemName}
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest block">Usuario / Email</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full h-12 px-3 border-2 border-black rounded-none bg-white text-black font-bold outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all placeholder:font-normal placeholder:text-neutral-400"
                        placeholder="usuario@origen.com"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-xs font-black uppercase tracking-widest block">Contraseña</label>
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full h-12 px-3 border-2 border-black rounded-none bg-white text-black font-bold outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all placeholder:font-normal placeholder:text-neutral-400"
                        placeholder="••••••••"
                    />
                </div>

                {error && (
                    <div className="p-3 bg-red-100 border-2 border-black text-red-600 font-bold text-xs uppercase text-center">
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-black hover:bg-white text-white hover:text-black border-2 border-black font-black uppercase tracking-widest transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? 'Verificando...' : 'Autorizar Acceso'}
                </button>
            </form>

            <div className="mt-6 pt-4 border-t-2 border-black border-dashed text-center">
                <p className="text-[10px] font-bold uppercase text-neutral-400">
                    Credenciales requeridas para este módulo.
                </p>
            </div>
        </NeoModal>
    );
};

export default SystemLoginModal;
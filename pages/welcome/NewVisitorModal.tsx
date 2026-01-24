import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { X, Loader2, Save } from 'lucide-react';
import { useToast } from '../infopoint/context/ToastContext';

interface NewVisitorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const NewVisitorModal: React.FC<NewVisitorModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const toast = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        age: '',
        phone: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // 1. Save to DB
            const { error } = await supabase
                .from('welcome_visitors')
                .insert({
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                    age: formData.age ? parseInt(formData.age) : null,
                    phone: formData.phone,
                    stage: 'NEW'
                });

            if (error) throw error;

            // 2. Trigger WhatsApp
            const message = "Bienvenido/a a Origen Iglesia. Gracias por estar hoy con nosotros. Creemos que cada persona tiene un propósito y que Dios sigue escribiendo historias nuevas. Este formulario es solo para conocerte un poco mejor y poder acompañarte. Tus respuestas son confidenciales y podés completar solo lo que quieras. Gracias por tomarte unos minutos. ¡Bienvenido/a a casa!";

            // Non-blocking call or awaited depending on preference. Using await for confirmation.
            // Note: This assumes the 'send-whatsapp' function is deployed and ready.
            await supabase.functions.invoke('send-whatsapp', {
                body: { phone: formData.phone, message }
            });

            toast.success('Visitante registrado y mensaje enviado.');
            onSuccess();
            onClose();
            setFormData({ firstName: '', lastName: '', age: '', phone: '' });
        } catch (err: any) {
            console.error('Error in NewVisitorModal:', err);
            toast.error('Error al registrar visitante: ' + (err.message || 'Error desconocido'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] w-full max-w-md p-6 relative animate-fadeIn">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-slate-100 border-2 border-transparent hover:border-black transition-all"
                >
                    <X size={24} className="text-black" />
                </button>

                <h2 className="text-2xl font-black uppercase tracking-tighter mb-6 text-black">Nuevo Ingresante</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase mb-1 text-black">Nombre</label>
                            <input
                                type="text"
                                required
                                value={formData.firstName}
                                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                className="w-full h-10 px-3 border-2 border-black font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all text-black bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase mb-1 text-black">Apellido</label>
                            <input
                                type="text"
                                required
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                className="w-full h-10 px-3 border-2 border-black font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all text-black bg-white"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-black uppercase mb-1 text-black">Edad</label>
                            <input
                                type="number"
                                value={formData.age}
                                onChange={e => setFormData({ ...formData, age: e.target.value })}
                                className="w-full h-10 px-3 border-2 border-black font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all text-black bg-white"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase mb-1 text-black">Teléfono</label>
                            <input
                                type="tel"
                                required
                                placeholder="+54 9..."
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full h-10 px-3 border-2 border-black font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all text-black bg-white"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-10 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Guardar Ingresante</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NewVisitorModal;

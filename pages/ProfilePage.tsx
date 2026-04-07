import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Save, Lock, Loader2,
    CheckCircle, AlertCircle, CalendarDays
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabaseService } from '../services/supabaseService';
import { getRoleDisplayNames } from '../services/authUtils';
import AvatarUpload from '../components/AvatarUpload';

const inputClass = "w-full p-4 bg-white border border-slate-300 rounded-lg outline-none text-black font-medium focus:border-black focus:ring-1 focus:ring-black transition-all placeholder-slate-400";
const labelClass = "block text-xs font-bold text-slate-500 uppercase mb-1 ml-1";
const buttonClass = "w-full py-3 bg-black text-white font-bold uppercase tracking-widest rounded-lg hover:bg-neutral-800 transition-all shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 transform active:scale-[0.98]";

const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
};

const formatDateForDisplay = (dateStr: string): string => {
    if (!dateStr) return 'DD/MM/AAAA';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
};

const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const { user, refreshSession, updateAvatar } = useAuth();

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        birthDate: '',
        gender: '',
    });

    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                phone: user.phone || '',
                birthDate: user.birthDate || '',
                gender: user.gender || '',
            });
        }
    }, [user]);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        setSaveStatus('idle');
        setErrorMessage('');

        try {
            const age = formData.birthDate
                ? calculateAge(formData.birthDate)
                : user.age || 0;

            const profileOk = await supabaseService.updateUserProfile(user.id, {
                phone: formData.phone,
                gender: formData.gender,
                birthDate: formData.birthDate,
                age,
            });

            const nameOk = await supabaseService.updateUser({
                ...user,
                name: formData.name,
            });

            if (profileOk && nameOk) {
                await refreshSession();
                setSaveStatus('success');
                setTimeout(() => setSaveStatus('idle'), 3000);
            } else {
                throw new Error('No se pudo guardar el perfil.');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al guardar.';
            setErrorMessage(message);
            setSaveStatus('error');
        } finally {
            setIsSaving(false);
        }
    };

    const initials = user?.name
        ? user.name.substring(0, 2).toUpperCase()
        : 'US';

    const roleLabel = user
        ? getRoleDisplayNames([user.role])[0] ?? user.role
        : '';

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-16">
            {/* Header */}
            <div className="bg-white dark:bg-black border-b-2 border-black dark:border-white">
                <div className="max-w-2xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 border-2 border-black dark:border-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black flex items-center justify-center transition-all"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black uppercase tracking-tighter text-black dark:text-white">
                                Mi Perfil
                            </h1>
                            <p className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono uppercase tracking-wider">
                                Datos personales
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-2xl mx-auto px-4 sm:px-8 pt-8 space-y-6">
                {/* Avatar + Display Name */}
                <div className="flex items-center gap-6 p-6 bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
                    <AvatarUpload
                        currentAvatarUrl={user?.avatarUrl}
                        userName={user?.name || 'Usuario'}
                        userId={user?.id || ''}
                        size="lg"
                        onUploadComplete={async (url) => {
                            await supabaseService.updateUserProfile(user!.id, { avatarUrl: url });
                            updateAvatar(url);
                            setSaveStatus('success');
                            setTimeout(() => setSaveStatus('idle'), 3000);
                        }}
                    />
                    <div className="flex-1">
                        <p className="text-xl font-black text-black dark:text-white">{user?.name}</p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">{user?.email}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded-full bg-black text-white dark:bg-white dark:text-black">
                                {roleLabel}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <div className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] p-6 space-y-5">
                    <h2 className="text-sm font-black uppercase tracking-wider text-black dark:text-white mb-4">
                        Información Personal
                    </h2>

                    {/* Name */}
                    <div>
                        <label className={labelClass}>Nombre completo</label>
                        <input
                            type="text"
                            className={inputClass}
                            value={formData.name}
                            placeholder="Tu nombre completo"
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className={labelClass}>Teléfono</label>
                        <input
                            type="tel"
                            className={inputClass}
                            value={formData.phone}
                            placeholder="+54 9 11..."
                            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        />
                    </div>

                    {/* BirthDate + Gender */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* BirthDate */}
                        <div>
                            <label className={labelClass}>Fecha de Nacimiento</label>
                            <div className="relative">
                                <div className={`${inputClass} flex items-center justify-between pointer-events-none bg-white dark:bg-zinc-800`}>
                                    <span className={!formData.birthDate ? 'text-neutral-400' : 'text-black dark:text-white'}>
                                        {formatDateForDisplay(formData.birthDate)}
                                    </span>
                                    <CalendarDays className="w-5 h-5 text-neutral-400" />
                                </div>
                                <input
                                    type="date"
                                    value={formData.birthDate}
                                    onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                                    onClick={(e) => {
                                        try {
                                            if ('showPicker' in e.currentTarget) {
                                                (e.currentTarget as HTMLInputElement & { showPicker: () => void }).showPicker();
                                            }
                                        } catch (error) {
                                            console.log('Error opening picker:', error);
                                        }
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 z-10 cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Gender */}
                        <div>
                            <label className={labelClass}>Sexo</label>
                            <select
                                className={inputClass}
                                value={formData.gender}
                                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                            >
                                <option value="">Seleccionar...</option>
                                <option value="Masculino">Masculino</option>
                                <option value="Femenino">Femenino</option>
                                <option value="No especificar">No especificar</option>
                            </select>
                        </div>
                    </div>

                    {/* Calculated age */}
                    {formData.birthDate && (
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium -mt-2">
                            Edad calculada: {calculateAge(formData.birthDate)} años
                        </p>
                    )}
                </div>

                {/* Account (read-only) */}
                <div className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-700 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] p-6">
                    <h2 className="text-sm font-black uppercase tracking-wider text-black dark:text-white mb-4">
                        Cuenta
                    </h2>
                    <div className="space-y-3">
                        <div>
                            <label className={labelClass}>Email</label>
                            <div className={`${inputClass} bg-neutral-50 dark:bg-zinc-800 cursor-not-allowed opacity-75 flex items-center gap-2`}>
                                <Lock className="w-4 h-4 text-neutral-400 shrink-0" />
                                <span className="text-neutral-500 dark:text-neutral-400">{user?.email}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate('/update-password')}
                            className="text-sm font-bold text-black dark:text-white underline underline-offset-2 hover:opacity-70 transition-opacity text-left mt-2"
                        >
                            Cambiar contraseña →
                        </button>
                    </div>
                </div>

                {/* Feedback */}
                {saveStatus === 'success' && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-emerald-500 rounded-r-lg flex items-center gap-3 animate-fadeIn">
                        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                            Perfil actualizado correctamente.
                        </span>
                    </div>
                )}
                {saveStatus === 'error' && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/30 border-l-4 border-red-500 rounded-r-lg flex items-center gap-3 animate-fadeIn">
                        <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                        <span className="text-sm font-bold text-red-700 dark:text-red-400">
                            {errorMessage}
                        </span>
                    </div>
                )}

                {/* Save button */}
                <button
                    className={buttonClass}
                    disabled={isSaving}
                    onClick={handleSave}
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Guardando...
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5" />
                            Guardar Cambios
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ProfilePage;

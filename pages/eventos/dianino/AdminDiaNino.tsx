import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDianinoSessions, deleteDianinoSession } from '../../../services/supabaseService';
import { DiaNinoSessionRow, User } from '../../../types';
import { ChevronLeft, Search, Plus, Eye, Trash2, Loader2, PartyPopper, CheckCircle2, Circle, QrCode, ShieldCheck, UserPlus } from 'lucide-react';
import NeoModal from '../../../components/ui/NeoModal';
import WizardAgregarPersona from './WizardAgregarPersona';

interface AdminDiaNinoProps {
    currentUser: User;
}

const AdminDiaNino: React.FC<AdminDiaNinoProps> = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<DiaNinoSessionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [declaracionFilter, setDeclaracionFilter] = useState<'all' | 'accepted' | 'rejected'>('all');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [showDeclaracionModal, setShowDeclaracionModal] = useState(false);
    const [showWizard, setShowWizard] = useState(false);

    const fetchSessions = async () => {
        setLoading(true);
        const data = await getDianinoSessions();
        setSessions(data);
        setLoading(false);
    };

    useEffect(() => { fetchSessions(); }, []);

    const handleDelete = async (sessionId: string) => {
        setDeletingId(sessionId);
        const success = await deleteDianinoSession(sessionId);
        setDeletingId(null);
        setConfirmDeleteId(null);
        if (success) {
            setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
        }
    };

    const filtered = sessions.filter(s => {
        if (declaracionFilter === 'accepted' && !s.declaracionJuradaAceptada) return false;
        if (declaracionFilter === 'rejected' && s.declaracionJuradaAceptada) return false;

        const term = searchTerm.toLowerCase().trim();
        if (!term) return true;
        return (
            s.adultFirstName.toLowerCase().includes(term) ||
            s.adultLastName.toLowerCase().includes(term) ||
            s.adultDni.includes(term)
        );
    });

    const totalChildren = sessions.reduce((sum, s) => sum + s.childrenCount, 0);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <button
                    onClick={() => navigate('/panel-eventos')}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400 hover:text-black transition-colors mb-4"
                >
                    <ChevronLeft className="w-4 h-4" /> Panel de Eventos
                </button>

                <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div>
                        <h1 className="text-3xl font-black uppercase tracking-tight text-black flex items-center gap-2">
                            <PartyPopper className="w-7 h-7 text-orange-500" />
                            Día del Niño
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            {sessions.length} inscripción{sessions.length !== 1 ? 'es' : ''} · {totalChildren} niño{totalChildren !== 1 ? 's' : ''} en total
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setShowDeclaracionModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 bg-white text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <ShieldCheck className="w-4 h-4" /> Declaración
                        </button>
                        <button
                            onClick={() => navigate('/eventos/admin/diadelnino/escaner')}
                            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 bg-white text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <QrCode className="w-4 h-4" /> Escanear
                        </button>
                        <button
                            onClick={() => setShowWizard(true)}
                            className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 bg-white text-slate-700 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
                        >
                            <UserPlus className="w-4 h-4" /> Agregar adulto/niño
                        </button>
                        <button
                            onClick={() => navigate('/eventos/admin/diadelnino/nueva')}
                            className="flex items-center gap-2 px-4 py-2.5 bg-black text-white font-semibold text-sm rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <Plus className="w-4 h-4" /> Inscripción manual
                        </button>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre, apellido o DNI..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-full outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 text-sm bg-white transition-all"
                        />
                    </div>

                    {/* Segmentado — los colores activos calcan los mismos
                        badges de "Declaración" que aparecen en cada fila,
                        así el filtro anticipa visualmente lo que va a mostrar. */}
                    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-full w-fit">
                        <button
                            type="button"
                            onClick={() => setDeclaracionFilter('all')}
                            aria-pressed={declaracionFilter === 'all'}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${declaracionFilter === 'all'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            onClick={() => setDeclaracionFilter('accepted')}
                            aria-pressed={declaracionFilter === 'accepted'}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${declaracionFilter === 'accepted'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Aceptaron
                        </button>
                        <button
                            type="button"
                            onClick={() => setDeclaracionFilter('rejected')}
                            aria-pressed={declaracionFilter === 'rejected'}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${declaracionFilter === 'rejected'
                                ? 'bg-red-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <Circle className="w-3.5 h-3.5" /> No aceptaron
                        </button>
                    </div>
                </div>

                {/* ── Mobile: tarjetas ── */}
                <div className="md:hidden space-y-3">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 text-sm">
                            {searchTerm ? 'Sin resultados para esa búsqueda' : 'Todavía no hay inscripciones'}
                        </div>
                    ) : filtered.map(s => (
                        <div key={s.sessionId} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                            {/* Nombre + email */}
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <div>
                                    <p className="font-bold text-sm text-slate-900">{s.adultFirstName} {s.adultLastName}</p>
                                    <p className="text-xs text-slate-400">{s.email}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">DNI {s.adultDni}</p>
                                </div>
                                <span className="inline-flex items-center justify-center px-2.5 py-1 bg-slate-100 rounded-full text-xs font-black text-slate-700 shrink-0">
                                    {s.childrenCount} {s.childrenCount === 1 ? 'niño' : 'niños'}
                                </span>
                            </div>

                            {/* Badges */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {s.declaracionJuradaAceptada ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                                        <CheckCircle2 className="w-3 h-3" /> Declaración aceptada
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                        <Circle className="w-3 h-3" /> No aceptó
                                    </span>
                                )}
                                {s.allCheckedIn ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                                        <CheckCircle2 className="w-3 h-3" /> Escaneo completo
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                                        <Circle className="w-3 h-3" /> Pendiente escaneo
                                    </span>
                                )}
                            </div>

                            {/* Acciones */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigate(`/eventos/admin/diadelnino/${s.sessionId}`)}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                                >
                                    <Eye className="w-3.5 h-3.5" /> Ver detalle
                                </button>
                                {confirmDeleteId === s.sessionId ? (
                                    <button
                                        onClick={() => handleDelete(s.sessionId)}
                                        disabled={deletingId === s.sessionId}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-black uppercase text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                    >
                                        {deletingId === s.sessionId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '¿Confirmar borrado?'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => setConfirmDeleteId(s.sessionId)}
                                        className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Desktop: tabla ── */}
                <div className="hidden md:block bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center py-16">
                            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-16 text-center text-slate-400 text-sm">
                            {searchTerm ? 'Sin resultados para esa búsqueda' : 'Todavía no hay inscripciones'}
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Responsable adulto</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">DNI</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Niños</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Declaración</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Escaneo</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(s => (
                                    <tr key={s.sessionId} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-sm text-slate-900">{s.adultFirstName} {s.adultLastName}</p>
                                            <p className="text-xs text-slate-400">{s.email}</p>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600">{s.adultDni}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center justify-center min-w-[24px] px-2 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-700">
                                                {s.childrenCount}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {s.declaracionJuradaAceptada ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                                                    <CheckCircle2 className="w-3 h-3" /> Aceptó
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-600 bg-red-50 px-2 py-1 rounded-full">
                                                    <Circle className="w-3 h-3" /> No aceptó
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {s.allCheckedIn ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                                                    <CheckCircle2 className="w-3 h-3" /> Completo
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                                                    <Circle className="w-3 h-3" /> Pendiente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end items-center gap-1">
                                                <button
                                                    onClick={() => navigate(`/eventos/admin/diadelnino/${s.sessionId}`)}
                                                    className="p-1.5 text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                                                    title="Ver"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                {confirmDeleteId === s.sessionId ? (
                                                    <button
                                                        onClick={() => handleDelete(s.sessionId)}
                                                        disabled={deletingId === s.sessionId}
                                                        className="px-2 py-1.5 text-[10px] font-black uppercase text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                                                    >
                                                        {deletingId === s.sessionId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => setConfirmDeleteId(s.sessionId)}
                                                        className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                                                        title="Borrar"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Texto estático — es el mismo aviso que se le muestra a
                cada familia en el paso 3 del formulario público
                (InscripcionDiaNino.tsx), no algo que varíe por sesión.
                El botón es sólo de referencia rápida para el staff: la
                planilla ya muestra por fila si cada familia aceptó o no. */}
            <NeoModal
                isOpen={showDeclaracionModal}
                onClose={() => setShowDeclaracionModal(false)}
                title="Declaración de Conformidad"
                maxWidth="max-w-lg"
            >
                <div className="p-5 rounded-2xl space-y-3 bg-amber-50 border-2 border-amber-300/60">
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="w-5 h-5 shrink-0 text-amber-900" aria-hidden="true" />
                        <span className="text-[11px] font-black uppercase tracking-widest text-amber-900">
                            Aviso sobre registro fotográfico y audiovisual
                        </span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-amber-950">
                        Te informamos que durante el evento se tomarán fotografías y grabaciones de video de las
                        distintas actividades. Este material será utilizado exclusivamente por{' '}
                        <span className="font-black">Origen Iglesia</span> con fines de difusión, comunicación y
                        registro informativo en nuestros canales oficiales (redes sociales, sitio web y material
                        impreso de la iglesia).
                    </p>
                </div>
                <p className="text-xs text-slate-400 mt-4">
                    Este es el mismo texto que cada familia ve y acepta o rechaza al inscribirse. Cada fila de la
                    planilla muestra si esa familia en particular lo aceptó.
                </p>
            </NeoModal>

            <WizardAgregarPersona
                isOpen={showWizard}
                sessions={sessions}
                onClose={(didChange) => {
                    setShowWizard(false);
                    if (didChange) fetchSessions();
                }}
            />
        </div>
    );
};

export default AdminDiaNino;

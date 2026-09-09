import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Group, GroupRegistration } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { ArrowLeft, Shuffle, Search, ChevronDown, Loader2, Users, Clock, Video, MapPin, Check } from 'lucide-react';

const PaginaDerivarMiembro: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [destinos, setDestinos] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    const [selectedRegistrationId, setSelectedRegistrationId] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [isSelectOpen, setIsSelectOpen] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    // Confirmación en 2 pasos, igual que en PaginaBajaGrupo.
    const [confirmando, setConfirmando] = useState(false);

    // getGroupsByHost trae los grupos donde el usuario es host O co-host.
    // Si el grupo de la URL no está en esa lista, no es suyo: se va.
    const fetchDatos = useCallback(async () => {
        if (!currentUser || !groupId) return;
        setLoading(true);
        try {
            const [propios, todos] = await Promise.all([
                supabaseService.getGroupsByHost(currentUser.id),
                supabaseService.getGroups()
            ]);
            const found = propios.find(g => g.id === groupId);
            if (!found) {
                navigate('/mis-grupos', { replace: true });
                return;
            }
            setGroup(found);
            setDestinos(todos.filter(g => g.id !== groupId));
        } finally {
            setLoading(false);
        }
    }, [currentUser, groupId, navigate]);

    useEffect(() => { fetchDatos(); }, [fetchDatos]);

    const hoy = new Date().toISOString().split('T')[0];
    const isFinished = !!group && (group.status === 'finished' || !!(group.endDate && group.endDate < hoy));

    const approvedMembers = (group?.registrations || []).filter(
        (r: GroupRegistration) => r.status === 'APPROVED'
    );
    const selectedMember = approvedMembers.find(m => m.id === selectedRegistrationId);
    const selectedGroup = destinos.find(g => g.id === selectedGroupId);

    // La RPC copia partner_data, así que la pareja se muda con la persona.
    const pareja = selectedMember?.partnerData;
    const nombrePareja = pareja ? `${pareja.firstName || ''} ${pareja.lastName || ''}`.trim() : '';

    const destinosFiltrados = destinos.filter(g => {
        if (!busqueda.trim()) return true;
        const t = busqueda.toLowerCase();
        return g.name.toLowerCase().includes(t)
            || `${g.leaderName || ''} ${g.leaderSurname || ''}`.toLowerCase().includes(t)
            || (g.location || '').toLowerCase().includes(t);
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);
        if (!group) return;

        if (!selectedRegistrationId) return setSubmitError('Elegí a quién querés derivar.');
        if (!selectedGroupId) return setSubmitError('Elegí el grupo destino.');

        if (!confirmando) {
            setConfirmando(true);
            return;
        }

        setIsSubmitting(true);
        // Toda la validación vive en la RPC. El error que devuelve ya está
        // redactado para el usuario, así que se muestra tal cual.
        const res = await supabaseService.derivarMiembro(selectedRegistrationId, selectedGroupId);
        setIsSubmitting(false);

        if (res.ok) {
            navigate(`/mis-grupos/${groupId}`);
            return;
        }
        setConfirmando(false);
        setSubmitError(res.error || 'No pudimos completar la derivación.');
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
    );

    if (!group) return null;

    const labelClass = "block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2";

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            <div className="max-w-2xl mx-auto px-4 md:px-8 py-8">

                <button
                    onClick={() => navigate(`/mis-grupos/${groupId}`)}
                    className="flex items-center gap-2 text-sm text-slate-400 hover:text-black dark:hover:text-white transition-colors mb-6 font-bold uppercase tracking-wide"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {group.name}
                </button>

                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black dark:text-white mb-2">
                    Derivar a otro grupo
                </h1>
                <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
                    Le mandás una solicitud al anfitrión del otro grupo. Hasta que la acepte, la persona sigue en el tuyo.
                </p>

                {isFinished ? (
                    <div className="p-4 bg-slate-100 dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-800 rounded-xl">
                        <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
                            Este grupo ya terminó su temporada, así que no se pueden derivar miembros.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* ── PASO 1: a quién ── */}
                        <div>
                            <label className={labelClass}>1 · A quién derivás</label>
                            {approvedMembers.length === 0 ? (
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl text-center">
                                    <p className="text-sm text-yellow-700 dark:text-yellow-400">Este grupo no tiene miembros aprobados.</p>
                                </div>
                            ) : (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsSelectOpen(!isSelectOpen)}
                                        className="w-full flex items-center justify-between px-4 py-3.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                                    >
                                        <span className={`font-bold uppercase ${selectedMember ? 'text-black dark:text-white' : 'text-slate-400'}`}>
                                            {selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'Elegir miembro...'}
                                        </span>
                                        <ChevronDown className={`w-5 h-5 transition-transform text-black dark:text-white ${isSelectOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isSelectOpen && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setIsSelectOpen(false)} />
                                            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                                                {approvedMembers.map((member) => (
                                                    <button
                                                        key={member.id}
                                                        type="button"
                                                        onClick={() => { setSelectedRegistrationId(member.id); setIsSelectOpen(false); setConfirmando(false); setSubmitError(null); }}
                                                        className={`w-full p-3 text-left hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0 ${selectedRegistrationId === member.id ? 'bg-slate-100 dark:bg-slate-900' : ''}`}
                                                    >
                                                        <p className="font-bold text-black dark:text-white uppercase text-sm">
                                                            {member.firstName} {member.lastName}
                                                        </p>
                                                        <p className="text-xs text-slate-500">{member.email}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {nombrePareja && (
                                <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900">
                                    <Users className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                                    <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">
                                        Esta inscripción incluye a {nombrePareja}. Los dos pasan al grupo nuevo.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* ── PASO 2: a qué grupo ── */}
                        <div>
                            <label className={labelClass}>2 · A qué grupo</label>

                            <div className="relative mb-3">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    placeholder="Buscar por nombre, anfitrión o zona..."
                                    className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-zinc-900 text-black dark:text-white border border-slate-300 dark:border-zinc-700 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-slate-900/10 dark:focus:ring-white/10"
                                />
                            </div>

                            <div className="space-y-2 max-h-80 overflow-y-auto">
                                {destinosFiltrados.length === 0 && (
                                    <p className="text-sm text-slate-400 text-center py-6">No encontramos grupos con esa búsqueda.</p>
                                )}
                                {destinosFiltrados.map(g => {
                                    const cupo = (g.maxCapacity || 0) - (g.membersCount || 0);
                                    const lleno = cupo <= 0;
                                    const elegido = selectedGroupId === g.id;
                                    return (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => { setSelectedGroupId(g.id); setConfirmando(false); setSubmitError(null); }}
                                            className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${elegido
                                                ? 'border-black dark:border-white bg-slate-50 dark:bg-zinc-900'
                                                : 'border-slate-200 dark:border-zinc-800 hover:border-slate-400 dark:hover:border-zinc-600'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-bold text-black dark:text-white text-sm truncate">{g.name}</p>
                                                    <p className="text-xs text-slate-500 truncate">
                                                        {g.leaderName} {g.leaderSurname}
                                                    </p>
                                                </div>
                                                {elegido && <Check className="w-5 h-5 text-black dark:text-white shrink-0" />}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5" /> {g.meetingDay} {g.meetingTime}
                                                </span>
                                                <span className="flex items-center gap-1 truncate">
                                                    {g.isOnline ? <Video className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
                                                    {g.isOnline ? 'Online' : (g.location || 'Sin ubicación')}
                                                </span>
                                                {/* Los llenos se marcan pero se pueden elegir igual:
                                                    la decisión final es del anfitrión destino. */}
                                                <span className={`font-semibold ${lleno ? 'text-amber-600' : 'text-[#28a946]'}`}>
                                                    {lleno ? 'Sin cupo' : `${cupo} ${cupo === 1 ? 'lugar' : 'lugares'}`}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {selectedGroup && selectedMember && (
                            <div className="p-4 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                                <p className="text-sm text-slate-600 dark:text-zinc-300">
                                    Se le va a enviar una solicitud al anfitrión de <strong className="text-black dark:text-white">{selectedGroup.name}</strong>.
                                    Hasta que la acepte, {selectedMember.firstName} sigue en tu grupo.
                                </p>
                            </div>
                        )}

                        {submitError && (
                            <p className="text-sm text-red-600 font-semibold text-center">{submitError}</p>
                        )}

                        {confirmando && selectedMember && selectedGroup && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-900 rounded-xl">
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                                    ¿Derivar a {selectedMember.firstName} {selectedMember.lastName} a {selectedGroup.name}?
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3">
                            {confirmando && (
                                <button
                                    type="button"
                                    onClick={() => setConfirmando(false)}
                                    disabled={isSubmitting}
                                    className="px-6 py-4 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold transition-colors hover:bg-slate-200 dark:hover:bg-zinc-700 disabled:opacity-50"
                                >
                                    Cancelar
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={isSubmitting || !selectedRegistrationId || !selectedGroupId}
                                className="flex-1 flex items-center justify-center gap-2 py-4 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-full hover:bg-neutral-800 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Derivando...</>
                                ) : (
                                    <><Shuffle className="w-5 h-5" /> {confirmando ? 'Sí, derivar' : 'Enviar derivación'}</>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default PaginaDerivarMiembro;

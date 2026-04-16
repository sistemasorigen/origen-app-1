import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { InfluosAttendee } from '../../types';
import { Plus, RefreshCw, Users, Star, Search, Edit2, Trash2 } from 'lucide-react';
import { ToastProvider, useToast } from '../infopoint/context/ToastContext';
import InfluosNewModal from './InfluosNewModal';
import InfluosEditModal from './InfluosEditModal';

const InfluosContent: React.FC = () => {
    const toast = useToast();
    const [attendees, setAttendees] = useState<InfluosAttendee[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isNewModalOpen, setIsNewModalOpen] = useState(false);
    const [editingAttendee, setEditingAttendee] = useState<InfluosAttendee | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<InfluosAttendee | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [filterType, setFilterType] = useState<'all' | 'first_time' | 'returning'>('all');

    const fetchAttendees = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('influos_attendees')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setAttendees(data as InfluosAttendee[]);
        if (error) console.error('[Influos] Error:', error);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchAttendees();
    }, []);

    const filtered = attendees.filter(a => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = (
            a.first_name.toLowerCase().includes(term) ||
            a.last_name.toLowerCase().includes(term) ||
            a.phone.includes(term)
        );

        if (!matchesSearch) return false;

        if (filterType === 'first_time') return a.is_first_time;
        if (filterType === 'returning') return !a.is_first_time;
        return true;
    });

    const firstTimersCount = attendees.filter(a => a.is_first_time).length;
    const returningCount = attendees.filter(a => !a.is_first_time).length;

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            const { error } = await supabase
                .from('influos_attendees')
                .delete()
                .eq('id', deleteTarget.id);
            if (error) throw error;
            toast.success('Asistente eliminado.');
            fetchAttendees();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            toast.error('Error al eliminar: ' + msg);
        } finally {
            setDeleteTarget(null);
            setIsDeleteConfirmOpen(false);
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black">
            {/* HEADER BRUTALIST */}
            <div className="bg-black text-white pt-6 pb-24 px-4 md:px-12 border-b-4 border-violet-500">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-violet-500 flex items-center justify-center border-2 border-white">
                                <Star className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight leading-none">
                                    Influos
                                </h1>
                                <p className="text-violet-400 font-bold text-xs uppercase tracking-widest mt-1">
                                    Gestión de Asistentes
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={fetchAttendees}
                                className="p-2 border-2 border-white/30 hover:border-white bg-transparent text-white transition-all"
                            >
                                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => setIsNewModalOpen(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-violet-500 text-white text-xs font-black uppercase tracking-widest border-2 border-violet-400 hover:bg-violet-400 transition-all shadow-[4px_4px_0px_0px_rgba(139,92,246,0.5)] hover:-translate-y-0.5"
                            >
                                <Plus className="w-4 h-4" />
                                Nuevo
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-12 -mt-12 pb-16">
                {/* STATS CARDS */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <button
                        onClick={() => setFilterType('all')}
                        className={`text-left p-4 border-2 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none ${filterType === 'all'
                                ? 'bg-violet-500 border-black text-white'
                                : 'bg-white dark:bg-zinc-900 border-black dark:border-zinc-700 text-black dark:text-white'
                            }`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Users size={16} className={filterType === 'all' ? 'text-white' : 'text-violet-600'} />
                            <span className={`text-[10px] font-black uppercase ${filterType === 'all' ? 'text-white/80' : 'text-gray-500'}`}>Total</span>
                        </div>
                        <p className="text-3xl font-black leading-tight">{attendees.length}</p>
                        <p className={`text-[10px] font-bold uppercase ${filterType === 'all' ? 'text-white/60' : 'text-gray-400'}`}>Asistentes</p>
                    </button>

                    <button
                        onClick={() => setFilterType('first_time')}
                        className={`text-left p-4 border-2 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none ${filterType === 'first_time'
                                ? 'bg-violet-500 border-black text-white'
                                : 'bg-white dark:bg-zinc-900 border-black dark:border-zinc-700 text-black dark:text-white'
                            }`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Star size={16} className={filterType === 'first_time' ? 'text-white' : 'text-violet-600'} />
                            <span className={`text-[10px] font-black uppercase ${filterType === 'first_time' ? 'text-white/80' : 'text-gray-500'}`}>Nuevos</span>
                        </div>
                        <p className="text-3xl font-black leading-tight">{firstTimersCount}</p>
                        <p className={`text-[10px] font-bold uppercase ${filterType === 'first_time' ? 'text-white/60' : 'text-gray-400'}`}>Primera vez</p>
                    </button>

                    <button
                        onClick={() => setFilterType('returning')}
                        className={`text-left p-4 border-2 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none ${filterType === 'returning'
                                ? 'bg-violet-500 border-black text-white'
                                : 'bg-white dark:bg-zinc-900 border-black dark:border-zinc-700 text-black dark:text-white'
                            }`}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <RefreshCw size={16} className={filterType === 'returning' ? 'text-white' : 'text-violet-600'} />
                            <span className={`text-[10px] font-black uppercase ${filterType === 'returning' ? 'text-white/80' : 'text-gray-500'}`}>Regulares</span>
                        </div>
                        <p className="text-3xl font-black leading-tight">{returningCount}</p>
                        <p className={`text-[10px] font-bold uppercase ${filterType === 'returning' ? 'text-white/60' : 'text-gray-400'}`}>Ya vinieron</p>
                    </button>
                </div>

                {/* BUSCADOR */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, apellido o teléfono..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-zinc-700 focus:border-black dark:focus:border-white outline-none text-sm font-bold bg-white dark:bg-zinc-900 text-black dark:text-white transition-all"
                    />
                </div>

                {/* LOADING */}
                {isLoading && (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-16 bg-gray-100 dark:bg-zinc-800 animate-pulse border-2 border-black/10" />
                        ))}
                    </div>
                )}

                {/* TABLA DESKTOP */}
                {!isLoading && (
                    <>
                        <div className="hidden md:block">
                            <table className="w-full border-2 border-black dark:border-white">
                                <thead>
                                    <tr className="bg-black text-white">
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Nombre</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Apellido</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Edad</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Celular</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Tribu</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">¿Asiste a Influos?</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-16 text-center">
                                                <div className="flex flex-col items-center gap-3 opacity-40">
                                                    <Star className="w-12 h-12" />
                                                    <span className="font-black uppercase text-lg">Sin asistentes registrados</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map(attendee => (
                                            <tr key={attendee.id} className="border-b border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800">
                                                <td className="px-4 py-3 font-bold text-sm text-black dark:text-white">{attendee.first_name}</td>
                                                <td className="px-4 py-3 font-bold text-sm text-black dark:text-white">{attendee.last_name}</td>
                                                <td className="px-4 py-3 font-bold text-sm text-black dark:text-white">{attendee.age}</td>
                                                <td className="px-4 py-3 font-bold text-sm text-black dark:text-white">{attendee.phone}</td>
                                                <td className="px-4 py-3">
                                                    {attendee.tribe === 'Celeste' && (
                                                        <span className="px-2 py-1 text-[10px] font-black uppercase rounded bg-sky-100 text-sky-700 border border-sky-300">🔵 Celeste</span>
                                                    )}
                                                    {attendee.tribe === 'Naranja' && (
                                                        <span className="px-2 py-1 text-[10px] font-black uppercase rounded bg-orange-100 text-orange-700 border border-orange-300">🟠 Naranja</span>
                                                    )}
                                                    {!attendee.tribe && (
                                                        <span className="text-gray-400 font-normal italic text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 text-[10px] font-black uppercase rounded ${attendee.is_first_time
                                                        ? 'bg-violet-100 text-violet-700'
                                                        : 'bg-neutral-100 text-neutral-500'}`}>
                                                        {attendee.is_first_time ? 'Sí' : 'No'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => setEditingAttendee(attendee)}
                                                            className="p-1.5 border-2 border-black dark:border-white hover:bg-amber-500 hover:border-amber-500 hover:text-white transition-all"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => { setDeleteTarget(attendee); setIsDeleteConfirmOpen(true); }}
                                                            className="p-1.5 border-2 border-black dark:border-white hover:bg-red-500 hover:border-red-500 hover:text-white transition-all"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* CARDS MOBILE */}
                        <div className="md:hidden space-y-3">
                            {filtered.length === 0 ? (
                                <div className="flex flex-col items-center gap-3 py-16 opacity-40">
                                    <Star className="w-12 h-12" />
                                    <span className="font-black uppercase text-lg">Sin asistentes registrados</span>
                                </div>
                            ) : (
                                filtered.map(attendee => (
                                    <div key={attendee.id} className="border-2 border-black dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="font-black text-base text-black dark:text-white">
                                                    {attendee.first_name} {attendee.last_name}
                                                </p>
                                                <p className="text-xs text-gray-500 font-bold">{attendee.phone}</p>
                                                {attendee.tribe === 'Celeste' && (
                                                    <p className="text-xs font-black uppercase text-sky-600 mt-0.5">🔵 Celeste</p>
                                                )}
                                                {attendee.tribe === 'Naranja' && (
                                                    <p className="text-xs font-black uppercase text-orange-600 mt-0.5">🟠 Naranja</p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1 leading-none">¿Asiste a Influos?</p>
                                                <span className={`px-2 py-1 text-[10px] font-black uppercase rounded inline-block ${attendee.is_first_time
                                                    ? 'bg-violet-100 text-violet-700'
                                                    : 'bg-neutral-100 text-neutral-500'}`}>
                                                    {attendee.is_first_time ? 'Sí' : 'No'}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs font-bold text-gray-600 dark:text-zinc-400 mb-3">Edad: {attendee.age} años</p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setEditingAttendee(attendee)}
                                                className="flex-1 py-1.5 text-xs font-black uppercase border-2 border-black dark:border-white hover:bg-amber-500 hover:border-amber-500 hover:text-white transition-all"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => { setDeleteTarget(attendee); setIsDeleteConfirmOpen(true); }}
                                                className="flex-1 py-1.5 text-xs font-black uppercase border-2 border-black dark:border-white hover:bg-red-500 hover:border-red-500 hover:text-white transition-all"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* CONFIRM DELETE */}
            {isDeleteConfirmOpen && deleteTarget && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 max-w-sm w-full">
                        <h3 className="font-black uppercase text-lg mb-2 text-black dark:text-white">¿Eliminar asistente?</h3>
                        <p className="text-sm text-gray-600 dark:text-zinc-400 mb-6 font-bold">
                            Se eliminará a <span className="text-black dark:text-white">{deleteTarget.first_name} {deleteTarget.last_name}</span> del sistema. Esta acción no se puede deshacer.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setIsDeleteConfirmOpen(false); setDeleteTarget(null); }}
                                className="flex-1 py-2.5 border-2 border-black dark:border-white text-xs font-black uppercase hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                className="flex-1 py-2.5 bg-red-600 text-white border-2 border-red-600 text-xs font-black uppercase hover:bg-red-700 transition-all"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALS */}
            <InfluosNewModal
                isOpen={isNewModalOpen}
                onClose={() => setIsNewModalOpen(false)}
                onSuccess={fetchAttendees}
            />
            <InfluosEditModal
                attendee={editingAttendee}
                isOpen={!!editingAttendee}
                onClose={() => setEditingAttendee(null)}
                onUpdate={fetchAttendees}
            />
        </div>
    );
};

const InfluosPage: React.FC = () => (
    <ToastProvider>
        <InfluosContent />
    </ToastProvider>
);

export default InfluosPage;

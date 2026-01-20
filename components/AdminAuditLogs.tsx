import React, { useState, useEffect } from 'react';
import { supabaseService } from '../services/supabaseService';
import { AuditLog } from '../types';
import { Clock, User, Activity, X, FileText, ArrowRight } from 'lucide-react';
import NeoModal from './NeoModal';

const AdminAuditLogs: React.FC = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    useEffect(() => {
        loadLogs();
        // Optional: Auto-refresh every 30s
        const interval = setInterval(loadLogs, 30000);
        return () => clearInterval(interval);
    }, []);

    const loadLogs = async () => {
        setIsLoading(true);
        const data = await supabaseService.getAuditLogs();
        setLogs(data);
        setIsLoading(false);
    };

    // Helper to format date
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('es-AR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    // Helper to format values
    const formatValue = (val: any) => {
        if (val === null || val === undefined) return <span className="text-neutral-400 italic">null</span>;
        if (typeof val === 'boolean') return val ? 'SÍ' : 'NO';
        if (Array.isArray(val)) return val.join(', ');
        if (typeof val === 'object') return JSON.stringify(val);
        // Dates
        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/)) {
            return new Date(val).toLocaleString();
        }
        return String(val);
    };

    // Helper to translate keys
    const translateKey = (key: string) => {
        const map: Record<string, string> = {
            id: 'ID',
            created_at: 'Creado',
            updated_at: 'Actualizado',
            name: 'Nombre',
            email: 'Email',
            first_name: 'Nombre',
            last_name: 'Apellido',
            phone: 'Teléfono',
            role: 'Rol (Legacy)',
            roles: 'Roles',
            is_active: 'Activo',
            leader_name: 'Líder Nombre',
            leader_surname: 'Líder Apellido',
            meeting_day: 'Día Reunión',
            meeting_time: 'Hora Reunión',
            location: 'Ubicación',
            status: 'Estado',
            group_id: 'Grupo ID',
            user_id: 'Usuario ID',
            linked_group_id: 'Grupo Vinculado',
            volunteer_roles: 'Roles Voluntario'
        };
        return map[key] || key;
    };

    // Helper to format JSON for display
    const formatDiff = (log: AuditLog) => {
        // --- INSERT VIEW ---
        if (log.action === 'INSERT') {
            return (
                <div className="border-2 border-emerald-200 bg-emerald-50 p-4">
                    <h4 className="font-black text-emerald-700 mb-4 uppercase text-sm border-b-2 border-emerald-200 pb-2">
                        Nuevo Registro Creado
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                        {Object.entries(log.new_data || {}).map(([key, value]) => (
                            <div key={key} className="flex flex-col border-b border-emerald-200/50 py-1">
                                <span className="text-[10px] font-bold uppercase text-emerald-600 opacity-70">
                                    {translateKey(key)}
                                </span>
                                <span className="font-mono text-sm font-medium text-emerald-900 break-words">
                                    {formatValue(value)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // --- DELETE VIEW ---
        if (log.action === 'DELETE') {
            return (
                <div className="border-2 border-red-200 bg-red-50 p-4">
                    <h4 className="font-black text-red-700 mb-4 uppercase text-sm border-b-2 border-red-200 pb-2">
                        Registro Eliminado
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                        {Object.entries(log.old_data || {}).map(([key, value]) => (
                            <div key={key} className="flex flex-col border-b border-red-200/50 py-1">
                                <span className="text-[10px] font-bold uppercase text-red-600 opacity-70">
                                    {translateKey(key)}
                                </span>
                                <span className="font-mono text-sm font-medium text-red-900 break-words">
                                    {formatValue(value)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }

        // --- UPDATE VIEW ---
        // Find changes
        const oldData = log.old_data || {};
        const newData = log.new_data || {};
        const allKeys = Array.from(new Set([...Object.keys(oldData), ...Object.keys(newData)]));

        const changes = allKeys.filter(key => {
            // Ignore internal fields usually not relevant if unchanged
            if (['updated_at', 'created_at'].includes(key)) return false;
            return JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]);
        });

        if (changes.length === 0) {
            return <div className="p-4 text-center text-neutral-500 font-bold italic">No se detectaron cambios visibles.</div>;
        }

        return (
            <div className="border-2 border-black bg-white">
                <table className="w-full text-left">
                    <thead className="bg-neutral-100 text-xs font-black uppercase tracking-wider border-b-2 border-black">
                        <tr>
                            <th className="p-3 w-1/4">Campo</th>
                            <th className="p-3 w-1/3 text-red-600 border-l-2 border-neutral-200">Valor Anterior</th>
                            <th className="p-3 w-1/3 text-emerald-600 border-l-2 border-neutral-200">Valor Nuevo</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200 text-sm">
                        {changes.map(key => (
                            <tr key={key} className="hover:bg-neutral-50 transition-colors">
                                <td className="p-3 font-bold uppercase text-xs text-neutral-600 bg-neutral-50">
                                    {translateKey(key)}
                                </td>
                                <td className="p-3 font-mono text-red-800 bg-red-50/30 border-l-2 border-neutral-200 break-words">
                                    {formatValue(oldData[key])}
                                </td>
                                <td className="p-3 font-mono text-emerald-800 bg-emerald-50/30 border-l-2 border-neutral-200 break-words">
                                    {formatValue(newData[key])}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Header */}
            <div className="flex justify-between items-center border-b-4 border-black pb-4">
                <div>
                    <h2 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                        <Activity className="w-8 h-8" />
                        Registro de Auditoría
                    </h2>
                    <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-1">
                        Historial de cambios en base de datos
                    </p>
                </div>
                <button
                    onClick={loadLogs}
                    className="px-4 py-2 bg-white border-2 border-black font-black uppercase text-xs hover:bg-black hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
                >
                    Refrescar
                </button>
            </div>

            {/* Table */}
            <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-black text-white text-xs font-black uppercase tracking-widest">
                            <tr>
                                <th className="p-4 border-r-2 border-white/20">Fecha</th>
                                <th className="p-4 border-r-2 border-white/20">Usuario</th>
                                <th className="p-4 border-r-2 border-white/20">Acción</th>
                                <th className="p-4 border-r-2 border-white/20">Tabla</th>
                                <th className="p-4 text-center">Detalles</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-black">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center font-bold uppercase animate-pulse">
                                        Cargando registros...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-neutral-400 font-bold uppercase">
                                        No hay registros disponibles.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-neutral-50 transition-colors group">
                                        <td className="p-4 font-mono text-xs border-r-2 border-black/10">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3 h-3 text-neutral-400" />
                                                {formatDate(log.created_at)}
                                            </div>
                                        </td>
                                        <td className="p-4 border-r-2 border-black/10">
                                            <div className="flex items-center gap-2 font-bold text-xs uppercase">
                                                <User className="w-3 h-3" />
                                                {log.actor_name}
                                            </div>
                                        </td>
                                        <td className="p-4 border-r-2 border-black/10">
                                            <span className={`inline-block px-2 py-0.5 border-2 text-[10px] font-black uppercase ${log.action === 'INSERT' ? 'bg-emerald-100 text-emerald-800 border-emerald-800' :
                                                log.action === 'DELETE' ? 'bg-red-100 text-red-800 border-red-800' :
                                                    'bg-blue-100 text-blue-800 border-blue-800'
                                                }`}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="p-4 border-r-2 border-black/10 font-mono text-xs font-bold uppercase">
                                            {log.table_name}
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="px-3 py-1 border-2 border-black text-[10px] font-black uppercase hover:bg-black hover:text-white transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[1px] active:shadow-none flex items-center gap-1 mx-auto"
                                            >
                                                <FileText className="w-3 h-3" /> Ver
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Diff Modal */}
            <NeoModal
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                title="Detalle de Cambio"
            >
                {selectedLog && (
                    <div className="flex flex-col h-full -mx-1 px-1">
                        {/* Header Info Badges (Moved to body) */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            <span className="bg-black text-white px-2 py-1 text-xs font-bold uppercase">
                                ID: {selectedLog.record_id}
                            </span>
                            <span className="bg-white border-2 border-black px-2 py-1 text-xs font-bold uppercase">
                                {selectedLog.table_name}
                            </span>
                            <span className="bg-white border-2 border-black px-2 py-1 text-xs font-bold uppercase">
                                {formatDate(selectedLog.created_at)}
                            </span>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto flex-1 mb-4">
                            {formatDiff(selectedLog)}
                        </div>

                        {/* Modal Footer */}
                        <div className="pt-4 border-t-4 border-black text-right shrink-0">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-6 py-3 bg-black text-white font-black uppercase text-sm border-2 border-black hover:bg-neutral-800 transition-all w-full md:w-auto"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                )}
            </NeoModal>
        </div>
    );
};

export default AdminAuditLogs;

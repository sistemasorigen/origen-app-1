import React, { useState, useEffect } from 'react';
import { DropoutRequest } from '../../types';
import { supabaseService, deleteGroupDirect } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import { Inbox, UserMinus, Users, CheckCircle, Archive, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

const BajasGruposContent: React.FC = () => {
    const { showToast } = useAdminGCXToast();

    const [requests, setRequests] = useState<DropoutRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);

    const fetchRequests = async () => {
        setLoading(true);
        const data = await supabaseService.getDropoutRequests('PENDING');
        setRequests(data);
        setLoading(false);
    };

    useEffect(() => { fetchRequests(); }, []);

    const handleExecuteDropout = async (request: DropoutRequest) => {
        if (confirmingId !== request.id) {
            setConfirmingId(request.id);
            setTimeout(() => setConfirmingId(prev => prev === request.id ? null : prev), 5000);
            return;
        }

        setConfirmingId(null);
        setProcessingId(request.id);

        try {
            let deleteSuccess = false;
            const isGroupDropout = request.requestType === 'GROUP';

            if (isGroupDropout) {
                deleteSuccess = await deleteGroupDirect(request.groupId);
            } else if (request.targetRegistrationId) {
                deleteSuccess = await supabaseService.deleteGroupRegistration(request.targetRegistrationId, request.groupId);
            } else {
                showToast('Esta solicitud no tiene un ID de registro válido.', 'error');
                setProcessingId(null);
                return;
            }

            if (deleteSuccess) {
                await supabaseService.updateDropoutRequestStatus(request.id, 'APPROVED');
                showToast('Baja ejecutada correctamente');
                fetchRequests();
            } else {
                showToast('Error al ejecutar la baja. Intenta nuevamente.', 'error');
            }
        } catch (error) {
            console.error('Error executing dropout:', error);
            showToast('Error al ejecutar la baja.', 'error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleArchive = async (request: DropoutRequest) => {
        setProcessingId(request.id);
        const success = await supabaseService.updateDropoutRequestStatus(request.id, 'REJECTED');
        if (success) {
            fetchRequests();
        } else {
            showToast('Error al archivar la solicitud.', 'error');
        }
        setProcessingId(null);
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('es-AR', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="max-w-3xl">
            <div className="mb-6 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                    {loading ? 'Cargando...' : `${requests.length} solicitud(es) pendiente(s)`}
                </p>
                <button
                    onClick={fetchRequests}
                    disabled={loading}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Actualizar"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {loading && (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                </div>
            )}

            {!loading && requests.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                    <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">No hay solicitudes pendientes</p>
                    <p className="text-sm text-slate-400 mt-1">Las nuevas solicitudes aparecerán aquí</p>
                </div>
            )}

            {!loading && requests.length > 0 && (
                <div className="space-y-3">
                    {requests.map((request) => (
                        <div
                            key={request.id}
                            className={`bg-white border-2 rounded-xl overflow-hidden transition-all ${request.requestType === 'GROUP' ? 'border-red-300' : 'border-slate-200'}`}
                        >
                            <div className={`px-4 py-3 flex items-start justify-between gap-3 ${request.requestType === 'GROUP' ? 'bg-red-50' : 'bg-slate-50'}`}>
                                <div className="flex items-center gap-3">
                                    {request.requestType === 'GROUP' ? (
                                        <Users className="w-5 h-5 text-red-600 shrink-0" />
                                    ) : (
                                        <UserMinus className="w-5 h-5 text-slate-600 shrink-0" />
                                    )}
                                    <div>
                                        <p className="font-bold text-black text-sm uppercase">
                                            Baja de {request.requestType === 'GROUP' ? 'Grupo' : 'Usuario'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            Por: {request.hostName} • {formatDate(request.createdAt)}
                                        </p>
                                    </div>
                                </div>
                                {request.requestType === 'GROUP' && (
                                    <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold uppercase rounded-full shrink-0">
                                        Crítico
                                    </span>
                                )}
                            </div>

                            <div className="px-4 py-3 space-y-3">
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">
                                        {request.requestType === 'GROUP' ? 'Grupo' : 'Usuario'}
                                    </p>
                                    <p className="font-bold text-black">
                                        {request.requestType === 'GROUP' ? request.groupName : request.targetUserName || 'Usuario desconocido'}
                                    </p>
                                    {request.requestType === 'USER' && (
                                        <p className="text-xs text-slate-500">Grupo: {request.groupName}</p>
                                    )}
                                </div>

                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Razón</p>
                                    <p className="text-sm text-black font-medium">{request.reason}</p>
                                </div>

                                {request.details && (
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Detalles</p>
                                        <p className="text-sm text-slate-600">{request.details}</p>
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={() => handleExecuteDropout(request)}
                                        disabled={processingId === request.id}
                                        className={`flex-1 flex items-center justify-center gap-2 p-3 font-bold uppercase text-xs rounded-lg transition-all disabled:opacity-50 ${confirmingId === request.id ? 'bg-orange-500 text-white hover:bg-orange-600 animate-pulse' : request.requestType === 'GROUP' ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-black text-white hover:bg-slate-800'}`}
                                    >
                                        {processingId === request.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : confirmingId === request.id ? (
                                            <><AlertTriangle className="w-4 h-4" /> ¡Click para Confirmar!</>
                                        ) : (
                                            <><CheckCircle className="w-4 h-4" /> Ejecutar Baja</>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleArchive(request)}
                                        disabled={processingId === request.id}
                                        className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-slate-300 text-slate-600 font-bold uppercase text-xs rounded-lg hover:bg-slate-100 transition-all disabled:opacity-50"
                                    >
                                        <Archive className="w-4 h-4" />
                                        Archivar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const BajasGrupos: React.FC = () => (
    <AdminGCXLayout
        title="Solicitudes de Baja"
        backTo="/admingcx/gestion-de-grupos"
        backLabel="Volver a Gestión de Grupos"
    >
        <BajasGruposContent />
    </AdminGCXLayout>
);

export default BajasGrupos;

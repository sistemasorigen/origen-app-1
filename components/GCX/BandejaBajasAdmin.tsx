import React, { useState, useEffect } from 'react';
import { DropoutRequest } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { deleteGroupDirect } from '../../services/supabaseService';
import NeoModal from '../ui/NeoModal';
import { Inbox, UserMinus, Users, CheckCircle, Archive, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface AdminDropoutInboxProps {
    isOpen: boolean;
    onClose: () => void;
    onActionComplete?: () => void;
}

const AdminDropoutInbox: React.FC<AdminDropoutInboxProps> = ({
    isOpen,
    onClose,
    onActionComplete
}) => {
    const [requests, setRequests] = useState<DropoutRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [confirmingId, setConfirmingId] = useState<string | null>(null); // For two-step confirmation

    const fetchRequests = async () => {
        setLoading(true);
        const data = await supabaseService.getDropoutRequests('PENDING');
        setRequests(data);
        setLoading(false);
    };

    useEffect(() => {
        if (isOpen) {
            fetchRequests();
        }
    }, [isOpen]);

    const handleExecuteDropout = async (request: DropoutRequest) => {
        console.log('[Dropout] handleExecuteDropout called with request:', request);
        console.log('[Dropout] targetRegistrationId value:', request.targetRegistrationId);

        // Two-step confirmation: first click sets confirmingId, second click executes
        if (confirmingId !== request.id) {
            console.log('[Dropout] First click - setting confirmation state');
            setConfirmingId(request.id);
            // Auto-reset after 5 seconds
            setTimeout(() => setConfirmingId(prev => prev === request.id ? null : prev), 5000);
            return;
        }

        // Second click - execute the dropout
        console.log('[Dropout] Second click - executing dropout');
        setConfirmingId(null);
        setProcessingId(request.id);

        try {
            let deleteSuccess = false;
            const isGroupDropout = request.requestType === 'GROUP';

            if (isGroupDropout) {
                // Delete entire group using RPC
                console.log('[Dropout] Deleting group:', request.groupId);
                deleteSuccess = await deleteGroupDirect(request.groupId);
            } else if (request.targetRegistrationId) {
                // Use the registration ID directly
                console.log('[Dropout] Deleting registration:', request.targetRegistrationId, 'from group:', request.groupId);
                deleteSuccess = await supabaseService.deleteGroupRegistration(request.targetRegistrationId, request.groupId);
            } else {
                console.error('[Dropout] No targetRegistrationId found in request:', request);
                alert('Error: Esta solicitud no tiene un ID de registro válido. Puede que haya sido creada antes de la actualización.');
                setProcessingId(null);
                return;
            }

            console.log('[Dropout] Delete result:', deleteSuccess);

            if (deleteSuccess) {
                // Mark request as approved
                await supabaseService.updateDropoutRequestStatus(request.id, 'APPROVED');
                alert('Baja ejecutada correctamente.');
                fetchRequests();
                onActionComplete?.();
            } else {
                alert('Error al ejecutar la baja. Intenta nuevamente.');
            }
        } catch (error) {
            console.error('Error executing dropout:', error);
            alert('Error al ejecutar la baja.');
        } finally {
            setProcessingId(null);
        }
    };

    const handleArchive = async (request: DropoutRequest) => {
        console.log('[Dropout] Archiving request:', request.id);
        setProcessingId(request.id);

        const success = await supabaseService.updateDropoutRequestStatus(request.id, 'REJECTED');

        if (success) {
            console.log('[Dropout] Archive successful');
            fetchRequests();
            onActionComplete?.();
        } else {
            console.error('[Dropout] Archive failed');
            alert('Error al archivar la solicitud.');
        }

        setProcessingId(null);
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <NeoModal isOpen={isOpen} onClose={onClose} title="Solicitudes de Baja">
            <div className="space-y-4">
                {/* Header with Refresh */}
                <div className="flex items-center justify-between">
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

                {/* Loading State */}
                {loading && (
                    <div className="flex justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                )}

                {/* Empty State */}
                {!loading && requests.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
                        <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-medium">No hay solicitudes pendientes</p>
                        <p className="text-sm text-slate-400 mt-1">Las nuevas solicitudes aparecerán aquí</p>
                    </div>
                )}

                {/* Request List */}
                {!loading && requests.length > 0 && (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {requests.map((request) => (
                            <div
                                key={request.id}
                                className={`bg-white border-2 rounded-xl overflow-hidden transition-all ${request.requestType === 'GROUP'
                                    ? 'border-red-300'
                                    : 'border-slate-200'
                                    }`}
                            >
                                {/* Card Header */}
                                <div className={`px-4 py-3 flex items-start justify-between gap-3 ${request.requestType === 'GROUP'
                                    ? 'bg-red-50'
                                    : 'bg-slate-50'
                                    }`}>
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

                                {/* Card Body */}
                                <div className="px-4 py-3 space-y-3">
                                    {/* Target Info */}
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">
                                            {request.requestType === 'GROUP' ? 'Grupo' : 'Usuario'}
                                        </p>
                                        <p className="font-bold text-black">
                                            {request.requestType === 'GROUP'
                                                ? request.groupName
                                                : request.targetUserName || 'Usuario desconocido'}
                                        </p>
                                        {request.requestType === 'USER' && (
                                            <p className="text-xs text-slate-500">Grupo: {request.groupName}</p>
                                        )}
                                    </div>

                                    {/* Reason */}
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Razón</p>
                                        <p className="text-sm text-black font-medium">{request.reason}</p>
                                    </div>

                                    {/* Details */}
                                    {request.details && (
                                        <div>
                                            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Detalles</p>
                                            <p className="text-sm text-slate-600">{request.details}</p>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => handleExecuteDropout(request)}
                                            disabled={processingId === request.id}
                                            className={`flex-1 flex items-center justify-center gap-2 p-3 font-bold uppercase text-xs rounded-lg transition-all disabled:opacity-50 ${confirmingId === request.id
                                                ? 'bg-orange-500 text-white hover:bg-orange-600 animate-pulse'
                                                : request.requestType === 'GROUP'
                                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                                    : 'bg-black text-white hover:bg-slate-800'
                                                }`}
                                        >
                                            {processingId === request.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : confirmingId === request.id ? (
                                                <>
                                                    <AlertTriangle className="w-4 h-4" />
                                                    ¡Click para Confirmar!
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle className="w-4 h-4" />
                                                    Ejecutar Baja
                                                </>
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
        </NeoModal>
    );
};

export default AdminDropoutInbox;

import React, { useState, useEffect } from 'react';
import { DropoutRequest } from '../../types';
import { supabaseService, deleteGroupDirect } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import { CheckCircle, Archive, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

/**
 * Solicitudes de baja (design-claude/Admin GCX - Panel).
 *
 * Cuelga de la sección Grupos y se abre desde Moderación. Cada solicitud
 * dice de entrada qué pasa si se ejecuta: se cierra un grupo entero o sale
 * una persona. La confirmación sigue siendo de dos toques.
 */

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

    const boton = 'h-10 rounded-full px-[17px] text-[13.5px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2';

    return (
        <div className="max-w-[760px]">
            <div className="mb-3.5 flex items-center justify-between gap-3">
                <p className="text-[12.5px] font-medium text-black/[.62]">
                    {loading
                        ? 'Cargando…'
                        : requests.length === 0
                            ? 'Sin solicitudes pendientes'
                            : `${requests.length} ${requests.length === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}`}
                </p>
                <button
                    onClick={fetchRequests}
                    disabled={loading}
                    className="flex h-9 items-center gap-2 rounded-full bg-white px-3.5 text-[12.5px] font-semibold text-black/[.64] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    <RefreshCw className={`h-[14px] w-[14px] ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                </button>
            </div>

            {loading && (
                <div className="flex justify-center rounded-[20px] bg-white py-20">
                    <Loader2 className="h-7 w-7 animate-spin text-black/20" />
                </div>
            )}

            {!loading && requests.length === 0 && (
                <div className="flex flex-col items-center rounded-[20px] bg-white px-8 py-14 text-center">
                    <div className="h-[88px] w-[88px] rounded-full" style={{ background: 'repeating-linear-gradient(135deg,#eceae6 0 8px,#e3e1dc 8px 16px)' }} />
                    <p className="mt-[22px] text-[17px] font-semibold text-[#0a0a0a]">No hay solicitudes de baja</p>
                    <p className="mt-[9px] max-w-[340px] text-[13.5px] font-medium leading-[1.6] text-black/[.62]">
                        Cuando un anfitrión pida cerrar su grupo, o sacar a alguien de él, la solicitud llega acá.
                    </p>
                </div>
            )}

            {!loading && requests.length > 0 && (
                <div className="flex flex-col gap-2.5">
                    {requests.map((request) => {
                        const esGrupo = request.requestType === 'GROUP';
                        const confirmando = confirmingId === request.id;
                        const procesando = processingId === request.id;
                        return (
                            <div key={request.id} className="rounded-[20px] bg-white p-5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-[15.5px] font-semibold text-[#0a0a0a]">
                                        {esGrupo ? request.groupName : (request.targetUserName || 'Usuario desconocido')}
                                    </p>
                                    <span
                                        className="flex h-[26px] items-center rounded-full px-[11px] text-[11.5px] font-semibold"
                                        style={esGrupo
                                            ? { background: '#fdecea', color: '#a32218' }
                                            : { background: '#f0efec', color: 'rgba(0,0,0,.62)' }}
                                    >
                                        {esGrupo ? 'Se cierra el grupo entero' : 'Sale una persona'}
                                    </span>
                                </div>
                                <p className="mt-1 text-[12.5px] font-medium text-black/[.62]">
                                    {esGrupo ? '' : `${request.groupName} · `}Lo pidió {request.hostName} · {formatDate(request.createdAt)}
                                </p>

                                <div className="mt-3.5 rounded-[16px] bg-[#f7f7f5] px-[15px] py-3">
                                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-black/[.58]">Razón</p>
                                    <p className="mt-0.5 text-[13.5px] font-medium text-[#0a0a0a]">{request.reason}</p>
                                    {request.details && (
                                        <p className="mt-2 text-[13px] font-medium leading-[1.55] text-black/[.62]">{request.details}</p>
                                    )}
                                </div>

                                <div className="mt-3.5 flex flex-wrap gap-2">
                                    <button
                                        onClick={() => handleExecuteDropout(request)}
                                        disabled={procesando}
                                        className={`${boton} flex items-center gap-2 ${confirmando
                                            ? 'bg-[#fdf0dc] text-[#7a4f10]'
                                            : esGrupo
                                                ? 'bg-[#fdecea] text-[#a32218]'
                                                : 'bg-[#0a0a0a] text-white'}`}
                                    >
                                        {procesando ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" /> Ejecutando…</>
                                        ) : confirmando ? (
                                            <><AlertTriangle className="h-4 w-4" /> Tocá de nuevo para confirmar</>
                                        ) : (
                                            <><CheckCircle className="h-4 w-4" /> {esGrupo ? 'Eliminar el grupo' : 'Sacar a la persona'}</>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleArchive(request)}
                                        disabled={procesando}
                                        className={`${boton} flex items-center gap-2 bg-[#f2f2f0] text-black/[.66]`}
                                    >
                                        <Archive className="h-4 w-4" />
                                        Archivar sin hacer nada
                                    </button>
                                </div>

                                {confirmando && (
                                    <p className="mt-2.5 text-[12.5px] font-medium text-[#7a4f10]">
                                        {esGrupo
                                            ? 'Se borra el grupo y sus inscripciones. No se puede deshacer.'
                                            : 'La persona pierde su lugar en el grupo. No se puede deshacer.'}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const BajasGrupos: React.FC = () => (
    <AdminGCXLayout
        title="Solicitudes de baja"
        backTo="/admingcx/gestion-de-grupos"
        backLabel="Volver a Grupos"
    >
        <BajasGruposContent />
    </AdminGCXLayout>
);

export default BajasGrupos;

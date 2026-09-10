import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Group, GroupRegistration } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { Loader2 } from 'lucide-react';
import { T, btnPrimario, rotulo, Encabezado, HojaConfirmacion, Vacio } from '../../components/GCX/patron';

// Motivos frecuentes como píldoras. "Otro" abre el campo libre — el resto
// también lo permite, pero sin obligar a escribir lo que ya está dicho.
const MOTIVOS = ['Se mudó', 'Dejó de asistir', 'Pasó a otro grupo', 'Otro'];

const iniciales = (n: string, a: string) =>
    ((n || '').trim()[0] || '' + (a || '').trim()[0] || '').toUpperCase() || '?';

const PaginaBajaGrupo: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [group, setGroup] = useState<Group | null>(null);
    const [loadingGroup, setLoadingGroup] = useState(true);

    // null = pantalla de bifurcación. El diseño la pone primero: la decisión
    // de qué se está por hacer es lo primero que hay que tomar.
    const [requestType, setRequestType] = useState<'USER' | 'GROUP' | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [motivo, setMotivo] = useState<string>('');
    const [details, setDetails] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [confirmando, setConfirmando] = useState(false);

    const fetchGroup = useCallback(async () => {
        if (!currentUser || !groupId) return;
        setLoadingGroup(true);
        try {
            const owned = await supabaseService.getGroupsByHost(currentUser.id);
            const found = owned.find(g => g.id === groupId);
            if (!found) {
                navigate('/mis-grupos', { replace: true });
                return;
            }
            setGroup(found);
        } finally {
            setLoadingGroup(false);
        }
    }, [currentUser, groupId, navigate]);

    useEffect(() => { fetchGroup(); }, [fetchGroup]);

    const approvedMembers = (group?.registrations || []).filter(
        (r: GroupRegistration) => r.status === 'APPROVED'
    );
    const selectedMember = approvedMembers.find(m => m.id === selectedUserId);
    const reason = motivo === 'Otro' ? details.trim() : motivo;

    const volver = () => {
        if (requestType) { setRequestType(null); setSubmitError(null); setConfirmando(false); return; }
        navigate(`/mis-grupos/${groupId}`);
    };

    const validar = (): string | null => {
        if (requestType === 'USER' && !selectedUserId) return 'Elegí a la persona que sale del grupo.';
        if (!motivo) return 'Elegí un motivo.';
        if (motivo === 'Otro' && !details.trim()) return 'Contanos el motivo.';
        return null;
    };

    const continuar = () => {
        const error = validar();
        if (error) { setSubmitError(error); return; }
        setSubmitError(null);
        setConfirmando(true);
    };

    const ejecutar = async () => {
        if (!group) return;
        setIsSubmitting(true);

        // ── Baja de UN MIEMBRO: directa, sin aprobación ──
        // Misma secuencia que usa BandejaBajasAdmin al aprobar: primero se
        // borra la inscripción, y solo si eso salió bien se deja el registro
        // histórico. Al revés quedaría un historial de una baja que nunca ocurrió.
        if (requestType === 'USER') {
            const deleted = await supabaseService.deleteGroupRegistration(selectedUserId, group.id);
            if (!deleted) {
                setIsSubmitting(false);
                setConfirmando(false);
                setSubmitError('No pudimos dar de baja al miembro. Intentá de nuevo.');
                return;
            }

            // Historial: queda el motivo y quién la hizo, ya resuelta. Si esto
            // falla no se revierte nada ni se muestra error — la baja, que es
            // lo que le importa al anfitrión, ya se ejecutó bien.
            await supabaseService.createDropoutRequest({
                groupId: group.id,
                hostId: currentUser.id,
                requestType: 'USER',
                targetRegistrationId: selectedUserId,
                targetUserName: selectedMember
                    ? `${selectedMember.firstName} ${selectedMember.lastName}`
                    : undefined,
                reason,
                details: details.trim() || undefined,
                status: 'APPROVED'
            });

            setIsSubmitting(false);
            navigate(`/mis-grupos/${groupId}`);
            return;
        }

        // ── Cierre del GRUPO ENTERO: sigue requiriendo aprobación ──
        const success = await supabaseService.createDropoutRequest({
            groupId: group.id,
            hostId: currentUser.id,
            requestType: 'GROUP',
            targetRegistrationId: undefined,
            targetUserName: undefined,
            reason,
            details: details.trim() || undefined,
            status: 'PENDING'
        });
        setIsSubmitting(false);
        setConfirmando(false);

        if (success) navigate(`/mis-grupos/${groupId}`);
        else setSubmitError('Error al enviar la solicitud. Intentá de nuevo.');
    };

    if (loadingGroup) return (
        <div className={`min-h-screen flex items-center justify-center ${T.fondo}`}>
            <Loader2 className="w-8 h-8 animate-spin text-black/20 dark:text-white/20" />
        </div>
    );
    if (!group) return null;

    const tituloAccion = requestType === 'USER' ? 'Dar de baja a un miembro'
        : requestType === 'GROUP' ? 'Cerrar el grupo'
            : 'Dar de baja';

    return (
        <div id="gcx-accion" className={`min-h-screen ${T.fondo} ${T.fuente} ${T.tinta}`}>
            {/* El encabezado va sobre blanco y se curva abajo: separa la
                identidad de la pantalla del contenido, que vive sobre el fondo. */}
            <div className="bg-white dark:bg-[#1b1b1a] rounded-b-[28px] px-5 pt-4 pb-[18px] lg:px-8 lg:py-5">
                <div className="max-w-[820px] mx-auto">
                    <Encabezado accion={tituloAccion} grupo={group.name} onVolver={volver} />
                </div>
            </div>

            <div className="max-w-[820px] mx-auto px-4 pt-[22px] pb-8">

                {/* ── Bifurcación: dos tarjetas de peso distinto ── */}
                {requestType === null && (
                    <div className="lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
                        <div>
                            <p className={`${rotulo} px-1.5 mb-2.5`}>Un miembro</p>
                            <button
                                type="button"
                                onClick={() => setRequestType('USER')}
                                className="w-full text-left bg-white dark:bg-[#1b1b1a] rounded-[26px] p-5 transition-transform hover:-translate-y-0.5"
                            >
                                <p className="text-[17px] font-semibold tracking-[-.01em]">Dar de baja a un miembro</p>
                                <p className="mt-2.5 text-[13.5px] leading-[1.6] font-medium text-black/55 dark:text-white/55">
                                    La persona sale del grupo <span className={`font-semibold ${T.riesgo}`}>en el momento</span>. No pasa por aprobación y no se puede deshacer.
                                </p>
                                <div className="flex items-center justify-between mt-[18px]">
                                    <span className="text-[14.5px] font-semibold">Elegir a la persona</span>
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                                </div>
                            </button>
                        </div>

                        <div className="mt-[26px] lg:mt-0">
                            <p className={`${rotulo} px-1.5 mb-2.5`}>Todo el grupo</p>
                            <button
                                type="button"
                                onClick={() => setRequestType('GROUP')}
                                className="w-full text-left bg-[#f0f0ed] dark:bg-[#232322] rounded-[26px] p-5 transition-transform hover:-translate-y-0.5"
                            >
                                <p className="text-[17px] font-semibold tracking-[-.01em]">Cerrar el grupo</p>
                                <p className="mt-2.5 text-[13.5px] leading-[1.6] font-medium text-black/55 dark:text-white/55">
                                    Se envía una <span className="font-semibold text-[#0a0a0a] dark:text-white">solicitud a un administrador</span>. El grupo sigue funcionando hasta que la aprueben.
                                </p>
                                <div className="flex items-center justify-between mt-[18px]">
                                    <span className="text-[14.5px] font-semibold text-black/60 dark:text-white/60">Pedir el cierre</span>
                                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-black/40 dark:text-white/40" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                                </div>
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Formulario ── */}
                {requestType !== null && (
                    <>
                        {requestType === 'USER' && (
                            <>
                                <p className={`${rotulo} px-1.5 mb-2.5`}>¿A quién?</p>
                                {approvedMembers.length === 0 ? (
                                    <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px]">
                                        <Vacio
                                            titulo="No hay miembros aprobados"
                                            detalle="Cuando alguien se sume al grupo vas a poder darlo de baja desde acá."
                                            accion={{ texto: 'Volver al grupo', onClick: () => navigate(`/mis-grupos/${groupId}`) }}
                                        />
                                    </div>
                                ) : (
                                    <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px] overflow-hidden">
                                        {approvedMembers.map((m, i) => {
                                            const elegido = selectedUserId === m.id;
                                            return (
                                                <React.Fragment key={m.id}>
                                                    {i > 0 && <div className="h-px bg-black/[.06] dark:bg-white/[.08] mx-4" />}
                                                    <button
                                                        type="button"
                                                        onClick={() => { setSelectedUserId(m.id); setSubmitError(null); setConfirmando(false); }}
                                                        aria-pressed={elegido}
                                                        className="w-full flex items-center gap-3.5 h-[70px] px-4 transition-colors hover:bg-black/[.02] dark:hover:bg-white/[.03]"
                                                    >
                                                        <div className={`w-11 h-11 shrink-0 rounded-full ${T.chip} flex items-center justify-center text-[14px] font-semibold text-black/60 dark:text-white/60`}>
                                                            {iniciales(m.firstName, m.lastName)}
                                                        </div>
                                                        <span className="flex-1 text-left text-[15.5px] font-semibold truncate">
                                                            {m.firstName} {m.lastName}
                                                        </span>
                                                        <span className={`w-[26px] h-[26px] shrink-0 rounded-full flex items-center justify-center transition-colors ${elegido ? 'bg-[#0a0a0a] dark:bg-white' : 'bg-[#eeeeeb] dark:bg-[#2a2a28]'}`}>
                                                            {elegido && (
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white dark:text-black" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>
                                                            )}
                                                        </span>
                                                    </button>
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}

                        {(requestType === 'GROUP' || approvedMembers.length > 0) && (
                            <>
                                <p className={`${rotulo} px-1.5 mt-6 mb-2.5`}>Motivo</p>
                                <div className="flex flex-wrap gap-2.5">
                                    {MOTIVOS.map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => { setMotivo(m); setSubmitError(null); setConfirmando(false); }}
                                            aria-pressed={motivo === m}
                                            className={`h-[46px] px-[18px] rounded-full text-[14px] font-semibold transition-colors ${motivo === m
                                                ? 'bg-[#0a0a0a] dark:bg-white text-white dark:text-black'
                                                : 'bg-white dark:bg-[#1b1b1a] text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>

                                <textarea
                                    id="baja-detalles"
                                    value={details}
                                    onChange={e => { setDetails(e.target.value); setSubmitError(null); }}
                                    rows={3}
                                    maxLength={500}
                                    placeholder={motivo === 'Otro' ? 'Contanos el motivo' : 'Detalles (opcional)'}
                                    className="w-full mt-3.5 px-[18px] py-4 rounded-[22px] resize-none text-[14.5px] font-medium outline-none min-h-[84px]"
                                />

                                {submitError && (
                                    <p className="mt-3.5 text-[14px] font-semibold text-center text-[oklch(0.52_0.19_25)]">{submitError}</p>
                                )}

                                <button type="button" onClick={continuar} className={`${btnPrimario} h-[60px] mt-5`}>
                                    Continuar
                                </button>
                                <p className="mt-3 mx-5 text-[12.5px] leading-[1.5] font-medium text-black/45 dark:text-white/45 text-center">
                                    Vas a ver una confirmación antes de que se ejecute.
                                </p>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* ── 1c · Confirmación. Dos temperaturas en la misma hoja ── */}
            <HojaConfirmacion
                abierta={confirmando}
                titulo={requestType === 'USER'
                    ? `¿Dar de baja a ${selectedMember ? `${selectedMember.firstName} ${selectedMember.lastName}` : 'este miembro'}?`
                    : `¿Pedir el cierre de ${group.name}?`}
                antes={requestType === 'USER' ? 'Sale del grupo ' : 'La solicitud '}
                consecuencia={requestType === 'USER' ? 'de inmediato y no se puede deshacer' : 'queda pendiente de aprobación'}
                despues={requestType === 'USER'
                    ? '. Si vuelve, hay que inscribirlo otra vez.'
                    : '. El grupo sigue funcionando hasta que un administrador la revise.'}
                textoConfirmar={requestType === 'USER' ? 'Sí, dar de baja' : 'Enviar solicitud'}
                onConfirmar={ejecutar}
                onCancelar={() => setConfirmando(false)}
                cargando={isSubmitting}
            >
                <div className={`${T.interna} rounded-[20px] px-4 py-3.5 flex items-center gap-3`}>
                    {requestType === 'USER' && selectedMember && (
                        <div className="w-10 h-10 shrink-0 rounded-full bg-[#e8e8e5] dark:bg-[#2a2a28] flex items-center justify-center text-[13.5px] font-semibold text-black/60 dark:text-white/60">
                            {iniciales(selectedMember.firstName, selectedMember.lastName)}
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="text-[14.5px] font-semibold truncate">
                            {requestType === 'USER' && selectedMember
                                ? `${selectedMember.firstName} ${selectedMember.lastName}`
                                : group.name}
                        </p>
                        <p className="mt-0.5 text-[12.5px] font-medium text-black/45 dark:text-white/45 truncate">
                            Motivo: {reason}
                        </p>
                    </div>
                </div>
            </HojaConfirmacion>
        </div>
    );
};

export default PaginaBajaGrupo;

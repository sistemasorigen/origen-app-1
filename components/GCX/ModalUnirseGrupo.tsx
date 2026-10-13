import React, { useState, useEffect, useRef } from 'react';
import HojaInscripcion from './HojaInscripcion';
import { X, Check, Clock, Users, CalendarClock, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Group, User, GroupRegistration, GroupCategory, GroupTag } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import {
    CompromisoGCX, diferenciaHoraria, gruposDelMismoDia, hoyArgentino, horaCorta,
} from '../../src/utils/gruposMismoDia';

/**
 * Inscripción a un grupo — design-claude/JoinFlow.
 *
 * Dos variantes sobre la misma hoja:
 *   A · común   — una sola pantalla con los cuatro datos de la persona.
 *   B · parejas — tres pasos (tus datos · tu pareja · confirmar), porque acá
 *                 sí hay una secuencia de decisiones: si suma a su pareja, si
 *                 tiene email, y recién después buscarla en la comunidad.
 * El rosa aparece únicamente en el recorrido de parejas: es lo que distingue
 * una variante de la otra de un vistazo.
 *
 * Los campos se ven grises y sin borde gracias a las reglas #gcx-inscripcion
 * de index.html; el override global de inputs les gana a las clases de
 * Tailwind, así que el aspecto del campo se define allá y no acá.
 */
interface JoinGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: Group;
    currentUser: User | null;
    userStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
    onSuccess?: () => void;
    categories?: GroupCategory[];
    tags?: GroupTag[];
}

const generateUUID = (): string => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const iniciales = (nombre: string, apellido: string) =>
    `${(nombre || '').trim().charAt(0)}${(apellido || '').trim().charAt(0)}`.toUpperCase() || '—';

const JoinGroupModal: React.FC<JoinGroupModalProps> = ({ isOpen, onClose, group, currentUser, userStatus, onSuccess, categories = [], tags = [] }) => {

    const getCategoryName = (): string => {
        if (!group.categoryId) return '';
        if (typeof group.categoryId === 'string' && group.categoryId.toLowerCase() === 'parejas') {
            return 'parejas';
        }
        if (categories.length) {
            const cat = categories.find(c => c.id === group.categoryId);
            if (cat?.name) return cat.name.toLowerCase();
        }
        return '';
    };

    const categoryName = getCategoryName();
    const hasParejasTag = group.tags?.some(tId => tags.find(t => t.id === tId)?.name?.toLowerCase() === 'parejas') || false;
    const isCouplesGroup = (categoryName === 'parejas' || hasParejasTag) && group.targetGender === 'Mixto';

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });

    const [partnerData, setPartnerData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });

    // Paso del recorrido de parejas. La variante común vive siempre en 1.
    const [paso, setPaso] = useState(1);
    const [datosPrecargados, setDatosPrecargados] = useState(false);

    const [wantsPartner, setWantsPartner] = useState<boolean | null>(null);
    // null = todavía no respondió la sub-pregunta.
    const [partnerHasEmail, setPartnerHasEmail] = useState<boolean | null>(null);
    const [partnerAccount, setPartnerAccount] = useState<{ id: string; name: string; phone?: string } | null>(null);
    // Se pone en true recién cuando terminó la búsqueda por
    // email (la haya encontrado o no) — hasta entonces el resto
    // de los campos de la pareja permanecen bloqueados.
    const [hasCheckedPartnerEmail, setHasCheckedPartnerEmail] = useState(false);
    // Error específico del campo de email de la pareja (ej. mismo
    // email que el titular) — se muestra antes de intentar
    // autocompletar nada.
    const [partnerEmailError, setPartnerEmailError] = useState<string | null>(null);
    const [checkingPartner, setCheckingPartner] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const [successView, setSuccessView] = useState(false);
    // Los otros grupos de la persona que caen el mismo día que este. Se piden
    // al abrir, en segundo plano, para que el botón final no espere a nadie.
    const compromisosRef = useRef<Promise<CompromisoGCX[]> | null>(null);
    const [choques, setChoques] = useState<CompromisoGCX[]>([]);
    // El aviso sale una sola vez por apertura: si después hay que reintentar
    // por un error de red, no se vuelve a interponer.
    const [avisoVisto, setAvisoVisto] = useState(false);
    const [enviadaA, setEnviadaA] = useState('');

    useEffect(() => {
        if (isOpen && currentUser) {
            const nameParts = currentUser.name ? currentUser.name.split(' ') : [''];
            const firstName = nameParts[0] || '';
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

            setFormData({
                firstName: firstName,
                lastName: lastName,
                email: currentUser.email || '',
                phone: currentUser.phone || ''
            });
            setDatosPrecargados(!!(firstName || currentUser.email || currentUser.phone));
        } else if (isOpen) {
            setFormData({ firstName: '', lastName: '', email: '', phone: '' });
            setDatosPrecargados(false);
        }
        setPartnerData({ firstName: '', lastName: '', email: '', phone: '' });
        setPartnerAccount(null);
        setHasCheckedPartnerEmail(false);
        setPartnerEmailError(null);
        setWantsPartner(null);
        setPartnerHasEmail(null);
        setError(null);
        setSuccessView(false);
        setPaso(1);
        setChoques([]);
        setAvisoVisto(false);

        // Se pide acá, al abrir, y no al tocar el botón: así para cuando la
        // persona terminó de completar los datos la respuesta ya está.
        compromisosRef.current = (isOpen && currentUser)
            ? supabaseService.getCompromisosGCX(currentUser)
            : null;
    }, [isOpen, currentUser]);

    // ── Datos del grupo para la cabecera y el cierre ────────────────────────
    const anfitriones = (() => {
        const titular = [group.leaderName, group.leaderSurname].filter(Boolean).join(' ').trim();
        const coAnfitrion = [group.coHostFirstName, group.coHostLastName].filter(Boolean).join(' ').trim();
        if (titular && coAnfitrion) return `${titular.split(' ')[0]} y ${coAnfitrion.split(' ')[0]}`;
        if (titular) return titular.split(' ')[0];
        return 'El anfitrión';
    })();

    // Nombres completos para la ficha de arriba: ahí hay lugar y es lo que
    // quien se inscribe quiere reconocer. El de arriba, con los nombres de
    // pila, se sigue usando en las frases del cuerpo ("Johanna aprueba la
    // solicitud"), donde el apellido sonaría a formulario.
    const anfitrionCompleto = [group.leaderName, group.leaderSurname].filter(Boolean).join(' ').trim();
    const coAnfitrionCompleto = [group.coHostFirstName, group.coHostLastName].filter(Boolean).join(' ').trim();

    // Cuando hay co-anfitrión, el sujeto de las frases del cuerpo es plural:
    // "Johanna y Lucía aprueban", no "aprueba".
    const dosAnfitriones = !!(anfitrionCompleto && coAnfitrionCompleto);
    const verbo = (singular: string, plural: string) => (dosAnfitriones ? plural : singular);

    // ── Estado del recorrido ────────────────────────────────────────────────
    // Estado de los campos de pareja: todos completos o no.
    // El email solo es obligatorio si la pareja tiene email.
    const partnerFieldsFilled = !!(
        partnerData.firstName.trim() &&
        partnerData.lastName.trim() &&
        partnerData.phone.trim() &&
        (partnerHasEmail === false || partnerData.email.trim())
    );
    // Se envían datos de pareja solo si el grupo es de
    // parejas Y la persona respondió "Sí" a inscribirla
    // Y respondió la sub-pregunta del email Y completó sus datos.
    const hasPartnerData = isCouplesGroup && wantsPartner === true && partnerHasEmail !== null && partnerFieldsFilled;
    // Bloquea el paso final mientras eligió inscribir pareja
    // pero todavía no respondió si tiene email o no completó sus datos.
    const partnerDataPending = isCouplesGroup && wantsPartner === true && (partnerHasEmail === null || !partnerFieldsFilled);

    const datosPropiosCompletos = !!(formData.firstName.trim() && formData.lastName.trim() && formData.email.trim() && formData.phone.trim());
    const esUltimoPaso = !isCouplesGroup || paso === 3;

    // Campos manuales de la pareja: sin email, o con email pero sin cuenta.
    const sinCuenta = hasCheckedPartnerEmail && !partnerAccount;
    const mostrarCamposManuales = wantsPartner === true && (partnerHasEmail === false || (partnerHasEmail === true && sinCuenta));
    const mostrarBuscador = wantsPartner === true && partnerHasEmail === true && !hasCheckedPartnerEmail && !checkingPartner;
    const parejaEncontrada = wantsPartner === true && partnerHasEmail === true && hasCheckedPartnerEmail && !!partnerAccount;

    // ── Búsqueda de la cuenta de la pareja ──────────────────────────────────
    const buscarPareja = async () => {
        if (!isCouplesGroup || !partnerData.email.trim()) return;
        if (checkingPartner) return;

        // Prioridad: si es el mismo email que el titular, avisar
        // y cortar ACÁ — no se intenta autocompletar nada con él.
        if (partnerData.email.toLowerCase().trim() === formData.email.toLowerCase().trim()) {
            setPartnerEmailError('No podés poner el mismo email dos veces. Corregilo para continuar.');
            setPartnerAccount(null);
            return;
        }
        setPartnerEmailError(null);

        setCheckingPartner(true);
        try {
            const foundUser = await supabaseService.findUserByEmail(partnerData.email);
            setPartnerAccount(foundUser);

            if (foundUser) {
                setPartnerData(prev => {
                    const nameParts = foundUser.name ? foundUser.name.split(' ') : [];
                    return {
                        ...prev,
                        firstName: nameParts[0] || prev.firstName,
                        lastName: nameParts.slice(1).join(' ') || prev.lastName,
                        // El teléfono solo vuelve si quien busca es anfitrión
                        // o staff; si no, se lo pedimos a la persona.
                        phone: foundUser.phone || prev.phone
                    };
                });
            }
        } catch (err) {
            console.error('Error checking partner email:', err);
        } finally {
            setCheckingPartner(false);
            setHasCheckedPartnerEmail(true);
        }
    };

    const limpiarPareja = () => {
        setPartnerData({ firstName: '', lastName: '', email: '', phone: '' });
        setPartnerAccount(null);
        setHasCheckedPartnerEmail(false);
        setPartnerEmailError(null);
    };

    // ── Avanzar / enviar ────────────────────────────────────────────────────
    const continuar = () => {
        setError(null);

        if (paso === 1) {
            if (!datosPropiosCompletos) {
                setError('Completá tus cuatro datos para continuar.');
                return;
            }
            setPaso(2);
            return;
        }

        if (paso === 2) {
            if (wantsPartner === null) {
                setError('Contanos si te inscribís con tu pareja o solo/a.');
                return;
            }
            if (partnerDataPending) {
                setError('Completá los datos de tu pareja, o elegí "Voy solo/a".');
                return;
            }
            setPaso(3);
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);

        if (!datosPropiosCompletos) {
            setError('Todos los campos son obligatorios.');
            setIsSubmitting(false);
            setPaso(1);
            return;
        }

        if (partnerDataPending) {
            setError('Completá los datos de tu pareja para inscribirla, o elegí "Voy solo/a".');
            setIsSubmitting(false);
            setPaso(2);
            return;
        }

        if (hasPartnerData && partnerHasEmail && partnerData.email) {
            if (partnerData.email.toLowerCase().trim() === formData.email.toLowerCase().trim()) {
                setError('El email de tu pareja debe ser diferente al tuyo.');
                setIsSubmitting(false);
                setPaso(2);
                return;
            }
        }

        if (userStatus === 'PENDING') {
            setError('Ya tenés una solicitud pendiente para este grupo.');
            setIsSubmitting(false);
            return;
        }
        if (userStatus === 'APPROVED') {
            setError('Ya sos miembro de este grupo.');
            setIsSubmitting(false);
            return;
        }

        if (hasPartnerData && partnerHasEmail && partnerData.email) {
            const partnerExists = await supabaseService.checkPartnerEmailExists(group.id, partnerData.email);
            if (partnerExists) {
                setError('El email de tu pareja ya está registrado en este grupo.');
                setIsSubmitting(false);
                setPaso(2);
                return;
            }
        }

        // Si la pareja no tiene email, se omite la clave por
        // completo (en vez de mandar '') para que nunca "matchee"
        // por accidente contra otra inscripción también sin email.
        const partnerDataToSend = hasPartnerData
            ? (partnerHasEmail
                ? partnerData
                : { firstName: partnerData.firstName, lastName: partnerData.lastName, phone: partnerData.phone })
            : undefined;

        const reg: GroupRegistration = {
            id: generateUUID(),
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            timestamp: new Date().toISOString(),
            groupId: group.id,
            status: 'PENDING',
            userId: currentUser?.id,
            partnerData: partnerDataToSend,
            partnerUserId: hasPartnerData && partnerAccount ? partnerAccount.id : undefined
        };

        try {
            const success = await supabaseService.registerMemberToGroup(reg);

            if (success) {
                const notifMessage = hasPartnerData
                    ? `${formData.firstName} ${formData.lastName} y ${partnerData.firstName} ${partnerData.lastName} se inscribieron como pareja en ${group.name}.`
                    : `${formData.firstName} ${formData.lastName} se unió a ${group.name}.`;

                const notifTitle = hasPartnerData ? `Nueva solicitud de pareja` : `Nueva solicitud de miembro`;
                const actionUrl = `/panel-admin/groups?groupId=${group.id}`;

                // Notify host
                if ((group as any).host_id) {
                    await supabaseService.createAppNotification(
                        (group as any).host_id,
                        notifTitle,
                        notifMessage,
                        'REGISTRATION',
                        actionUrl,
                        { groupId: group.id, ...formData }
                    );
                }

                // Notify co-host
                if ((group as any).co_host_id) {
                    await supabaseService.createAppNotification(
                        (group as any).co_host_id,
                        notifTitle,
                        notifMessage,
                        'REGISTRATION',
                        actionUrl,
                        { groupId: group.id, ...formData }
                    );
                }

                if (onSuccess) onSuccess();
                setEnviadaA(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
                setSuccessView(true);

            } else {
                setError('No pudimos enviar la solicitud. Probá de nuevo.');
            }
        } catch (err: any) {
            console.error('Join Error:', err);
            setError('Se cortó la conexión. Tus datos quedaron guardados acá: probá de nuevo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Cerrar primero y navegar después: la hoja fija el body mientras está
    // abierta (useBloqueoDeFondo), y cambiar de pantalla sin soltarlo deja el
    // calendario trabado.
    const verMiCalendario = () => {
        onClose();
        navigate('/gcx/calendario');
    };

    const onPrimario = async () => {
        if (isSubmitting) return;
        if (!esUltimoPaso) { continuar(); return; }
        // Ya lo vio y decidió seguir, o no hay a quién avisarle.
        if (avisoVisto || !currentUser || !compromisosRef.current) { handleSubmit(); return; }

        // El botón muestra su spinner mientras tanto. Si la consulta no llegó
        // en 2 segundos se sigue sin aviso: es una ayuda, no un requisito.
        setIsSubmitting(true);
        const compromisos = await Promise.race([
            compromisosRef.current,
            new Promise<CompromisoGCX[]>(resolver => setTimeout(() => resolver([]), 2000)),
        ]).catch(() => [] as CompromisoGCX[]);

        const mismoDia = gruposDelMismoDia(group, compromisos, hoyArgentino());
        if (mismoDia.length === 0) { handleSubmit(); return; }

        setIsSubmitting(false);
        setChoques(mismoDia);
        setAvisoVisto(true);
    };

    const etiquetaPrimario = isSubmitting
        ? 'Enviando…'
        : error && esUltimoPaso
            ? 'Reintentar'
            : esUltimoPaso
                ? (hasPartnerData ? 'Confirmar inscripción' : 'Enviar solicitud')
                : 'Continuar';

    const nombrePaso = paso === 1 ? 'Tus datos' : paso === 2 ? 'Tu pareja' : 'Confirmar';
    const nombrePilaPareja = (partnerData.firstName || partnerAccount?.name?.split(' ')[0] || 'tu pareja').trim();

    // ── Confirmación ────────────────────────────────────────────────────────
    if (successView) {
        return (
            <HojaInscripcion isOpen={isOpen} onClose={onClose} labelledBy="insc-titulo-exito">
                <div className="insc-sube flex min-h-0 flex-1 flex-col justify-center gap-6 overflow-auto px-[26px] pb-[26px] pt-[34px]">
                    <div className="flex flex-col gap-4">
                        <span className="insc-sello flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#0A0A0A] text-white dark:bg-[#F7F7F8] dark:text-[#0A0A0A]">
                            <Check className="h-6 w-6" strokeWidth={2.4} />
                        </span>
                        <div className="flex flex-col gap-2.5">
                            <h2 id="insc-titulo-exito" className="m-0 text-[27px] font-extrabold leading-[1.08] tracking-[-.035em] text-[#0A0A0A] text-balance dark:text-[#F7F7F8]">
                                ¡Listo! Te inscribiste en {group.name}
                            </h2>
                            <p className="m-0 text-[15px] font-semibold leading-[1.5] text-[#6F6F73] text-pretty dark:text-[#9C9CA1]">
                                {anfitriones} {verbo('confirma', 'confirman')} tu lugar. Te avisamos por email y en la app.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col rounded-[22px] bg-[#F7F7F8] px-5 py-[18px] dark:bg-[#212124]">
                        <div className="flex gap-3.5">
                            <div className="flex flex-none flex-col items-center pt-[3px]">
                                <span className="h-[11px] w-[11px] rounded-full bg-[#0A0A0A] dark:bg-[#F7F7F8]" />
                                <span className="min-h-[26px] w-0.5 flex-1 bg-[#DCDCDE] dark:bg-[#3A3A3E]" />
                            </div>
                            <div className="pb-[18px]">
                                <div className="text-[14.5px] font-bold text-[#0A0A0A] dark:text-[#F7F7F8]">Solicitud enviada</div>
                                <div className="text-[13px] font-semibold text-[#6F6F73] dark:text-[#9C9CA1]">Hoy, {enviadaA}</div>
                            </div>
                        </div>
                        <div className="flex gap-3.5">
                            <div className="flex flex-none flex-col items-center pt-[3px]">
                                <span className="insc-late h-[11px] w-[11px] rounded-full bg-[#0A0A0A] dark:bg-[#F7F7F8]" />
                                <span className="min-h-[26px] w-0.5 flex-1 bg-[#DCDCDE] dark:bg-[#3A3A3E]" />
                            </div>
                            <div className="pb-[18px]">
                                <div className="text-[14.5px] font-bold text-[#0A0A0A] dark:text-[#F7F7F8]">{anfitriones} {verbo('la revisa', 'la revisan')}</div>
                                <div className="text-[13px] font-semibold text-[#6F6F73] dark:text-[#9C9CA1]">En curso</div>
                            </div>
                        </div>
                        <div className="flex gap-3.5">
                            <div className="flex flex-none flex-col items-center pt-[3px]">
                                <span className="h-[11px] w-[11px] rounded-full border-2 border-[#C9C9CC] dark:border-[#4A4A50]" />
                            </div>
                            <div>
                                <div className="text-[14.5px] font-bold text-[#8A8A8F]">Te avisamos y entrás al grupo</div>
                                <div className="text-[13px] font-semibold text-[#8A8A8F]">Por email y por una notificación en la app</div>
                            </div>
                        </div>
                    </div>

                    {/* Dónde queda esto a partir de ahora. La inscripción deja
                        de ser un trámite que terminó y pasa a ser una reunión en
                        la semana de la persona. */}
                    <div className="flex items-start gap-3 rounded-[18px] bg-[#F7F7F8] px-[18px] py-4 dark:bg-[#212124]">
                        <CalendarDays className="mt-[2px] h-[18px] w-[18px] flex-none text-[#6F6F73] dark:text-[#9C9CA1]" strokeWidth={2.2} />
                        <p className="m-0 text-[13.5px] font-semibold leading-[1.45] text-[#6F6F73] dark:text-[#9C9CA1]">
                            Ya está en tu calendario: {(group.meetingDay || '').toLowerCase()}{group.meetingTime ? ` ${horaCorta(group.meetingTime)} hs` : ''}, como solicitud pendiente. Cuando te aprueben, queda confirmado.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <button
                            type="button"
                            onClick={verMiCalendario}
                            className="w-full rounded-full bg-[#0A0A0A] px-5 py-[17px] text-[16.5px] font-bold text-white transition-opacity hover:opacity-[.88] dark:bg-[#F7F7F8] dark:text-[#0A0A0A]"
                        >
                            Ver mi calendario
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full rounded-full bg-[#F4F4F5] px-5 py-[17px] text-[16.5px] font-bold text-[#0A0A0A] transition-colors hover:bg-[#EAEAEB] dark:bg-[#26262A] dark:text-[#F7F7F8] dark:hover:bg-[#303034]"
                        >
                            Seguir mirando grupos
                        </button>
                    </div>
                </div>
            </HojaInscripcion>
        );
    }

    // ── Aviso: ya tiene otro grupo ese día ──────────────────────────────────
    //
    // No bloquea nada. Llegar a los dos puede ser perfectamente posible, y
    // quien sabe eso es la persona. Lo único que faltaba era que se enterara
    // antes de mandar la solicitud, no después.
    if (choques.length > 0) {
        const diaDestino = (group.meetingDay || '').toLowerCase();
        const horaDestino = horaCorta(group.meetingTime);
        const varios = choques.length > 1;

        return (
            <HojaInscripcion isOpen={isOpen} onClose={onClose} labelledBy="insc-titulo-aviso">
                <div className="insc-sube flex min-h-0 flex-1 flex-col gap-6 overflow-auto px-[26px] pb-[26px] pt-[34px]">
                    <div className="flex flex-col gap-4">
                        <span className="insc-sello flex h-[58px] w-[58px] items-center justify-center rounded-full bg-[#FEF3C7] text-[#B45309] dark:bg-[#2A2110] dark:text-[#F5C46B]">
                            <CalendarClock className="h-6 w-6" strokeWidth={2.2} />
                        </span>
                        <div className="flex flex-col gap-2.5">
                            <h2 id="insc-titulo-aviso" className="m-0 text-[27px] font-extrabold leading-[1.08] tracking-[-.035em] text-[#0A0A0A] text-balance dark:text-[#F7F7F8]">
                                {varios ? `Ya tenés ${choques.length} grupos los ${diaDestino}` : `Ya tenés un grupo los ${diaDestino}`}
                            </h2>
                            <p className="m-0 text-[15px] font-semibold leading-[1.5] text-[#6F6F73] text-pretty dark:text-[#9C9CA1]">
                                {group.name} también es los {diaDestino}{horaDestino ? ` a las ${horaDestino} hs` : ''}. Revisá si llegás a los dos.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2.5">
                        {choques.map(c => {
                            const hora = horaCorta(c.hora);
                            const diferencia = diferenciaHoraria(c.hora, group.meetingTime);
                            const dia = (c.dia || '').toLowerCase();
                            const relacion = c.relacion === 'ANFITRION' ? 'Sos anfitrión'
                                : c.relacion === 'APPROVED' ? 'Sos miembro'
                                    : 'Solicitud pendiente';
                            return (
                                <div key={c.groupId} className="flex flex-col gap-2 rounded-[18px] bg-[#F7F7F8] px-[18px] py-4 dark:bg-[#212124]">
                                    <div className="text-[16px] font-extrabold leading-[1.2] tracking-[-.015em] text-[#0A0A0A] dark:text-[#F7F7F8]">
                                        {c.nombre}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[13.5px] font-semibold text-[#6F6F73] first-letter:uppercase dark:text-[#9C9CA1]">
                                            {dia}{hora ? ` · ${hora} hs` : ''}
                                        </span>
                                        {diferencia && (
                                            <span className="rounded-full bg-[#FEF3C7] px-2.5 py-[3px] text-[12px] font-bold text-[#B45309] dark:bg-[#2A2110] dark:text-[#F5C46B]">
                                                {diferencia}
                                            </span>
                                        )}
                                    </div>
                                    {c.anfitrion && (
                                        <div className="text-[13.5px] font-semibold text-[#6F6F73] dark:text-[#9C9CA1]">
                                            {c.dosAnfitriones ? 'Anfitriones' : 'Anfitrión'}: {c.anfitrion}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                                        <span className="rounded-full bg-white px-2.5 py-[3px] text-[12px] font-bold text-[#0A0A0A] dark:bg-[#2C2C30] dark:text-[#F7F7F8]">
                                            {relacion}
                                        </span>
                                        {c.online && (
                                            <span className="rounded-full bg-white px-2.5 py-[3px] text-[12px] font-bold text-[#6F6F73] dark:bg-[#2C2C30] dark:text-[#9C9CA1]">
                                                Online
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex flex-col gap-2.5">
                        <button
                            type="button"
                            onClick={() => { setChoques([]); handleSubmit(); }}
                            className="w-full rounded-full bg-[#0A0A0A] px-5 py-[17px] text-[16.5px] font-bold text-white transition-opacity hover:opacity-[.88] dark:bg-[#F7F7F8] dark:text-[#0A0A0A]"
                        >
                            Inscribirme igual
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full rounded-full bg-[#F4F4F5] px-5 py-[17px] text-[16.5px] font-bold text-[#0A0A0A] transition-colors hover:bg-[#EAEAEB] dark:bg-[#26262A] dark:text-[#F7F7F8] dark:hover:bg-[#303034]"
                        >
                            Volver a ver los GCX
                        </button>
                    </div>
                </div>
            </HojaInscripcion>
        );
    }

    return (
        <HojaInscripcion isOpen={isOpen} onClose={onClose} labelledBy="insc-titulo">
            {/* Cabecera */}
            <header className="flex flex-none flex-col gap-3.5 px-[22px] pb-4 pt-[18px]">
                <div className="flex items-start justify-between gap-3.5">
                    {/* Sin el renglón del grupo: abajo está su ficha, con
                        portada y anfitriones, que lo dice mucho mejor que una
                        línea recortada con puntos suspensivos. */}
                    <div className="flex min-w-0 flex-col gap-1">
                        <h2 id="insc-titulo" className="m-0 text-[24px] font-extrabold leading-[1.1] tracking-[-.03em] text-[#0A0A0A] dark:text-[#F7F7F8]">
                            Inscripción
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Cerrar"
                        className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-[#F4F4F5] text-[#0A0A0A] transition-colors hover:bg-[#EAEAEB] dark:bg-[#26262A] dark:text-[#F7F7F8] dark:hover:bg-[#303034]"
                    >
                        <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </button>
                </div>

                {isCouplesGroup && (
                    <div className="flex flex-col gap-2.5">
                        <div className="flex gap-1.5">
                            {[1, 2, 3].map(i => (
                                <span
                                    key={i}
                                    className={`h-1 flex-1 rounded-full ${paso > i
                                        ? 'bg-[#0A0A0A] dark:bg-[#F7F7F8]'
                                        : paso === i
                                            ? 'bg-[#EC4B7F]'
                                            : 'bg-[#E6E6E7] dark:bg-[#2C2C30]'}`}
                                />
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[12.5px] font-bold uppercase tracking-[.04em] text-[#C92F63]">Paso {paso} de 3</span>
                            <span className="text-[12.5px] font-semibold text-[#6F6F73] dark:text-[#9C9CA1]">{nombrePaso}</span>
                        </div>
                    </div>
                )}
            </header>

            {/* Cuerpo */}
            <div className="min-h-0 flex-1 overflow-auto border-t border-[#F0F0F1] px-[22px] pb-[22px] pt-1.5 dark:border-[#2C2C30]">

                {paso === 1 && (
                    <div className="flex flex-col gap-4 pt-4">
                        {/* A qué grupo se está anotando: portada, nombre y
                            quién lo anfitriona. Va antes que cualquier campo
                            porque es lo que confirma que este es el grupo. */}
                        <div className="overflow-hidden rounded-[16px] bg-[#F7F7F8] dark:bg-[#212124]">
                            {group.imageUrl ? (
                                <img
                                    src={group.imageUrl}
                                    alt=""
                                    className="h-[118px] w-full object-cover"
                                />
                            ) : (
                                <div className="flex h-[76px] w-full items-center justify-center bg-[#EFEFF0] dark:bg-[#26262A]">
                                    <Users className="h-6 w-6 text-[#9C9CA1]" />
                                </div>
                            )}
                            <div className="flex flex-col gap-2 px-4 py-3.5">
                                <p className="m-0 text-[15.5px] font-extrabold leading-[1.25] tracking-[-.01em] text-[#0A0A0A] dark:text-[#F7F7F8]">
                                    {group.name}
                                </p>
                                {(anfitrionCompleto || coAnfitrionCompleto) && (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[11px] font-bold uppercase tracking-[.07em] text-[#9C9CA1]">
                                            {dosAnfitriones ? 'Anfitriones' : 'Anfitrión'}
                                        </span>
                                        <span className="text-[13.5px] font-semibold text-[#0A0A0A] dark:text-[#F7F7F8]">
                                            {[anfitrionCompleto, coAnfitrionCompleto].filter(Boolean).join(' y ')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {datosPrecargados && (
                            <div className="flex items-center gap-2.5 rounded-[14px] bg-[#F7F7F8] px-3.5 py-3 dark:bg-[#212124]">
                                <span className="h-[7px] w-[7px] flex-none rounded-full bg-[#0A0A0A] dark:bg-[#F7F7F8]" />
                                <span className="text-[13.5px] font-semibold text-[#0A0A0A] dark:text-[#F7F7F8]">Traemos los datos de tu cuenta. Corregí lo que haga falta.</span>
                            </div>
                        )}

                        {isCouplesGroup && (
                            <h3 className="m-0 text-[15px] font-extrabold tracking-[-.01em] text-[#0A0A0A] dark:text-[#F7F7F8]">Tus datos</h3>
                        )}

                        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                            <Campo etiqueta="Nombre" valor={formData.firstName} onChange={(v) => setFormData({ ...formData, firstName: v })} placeholder="Tu nombre" />
                            <Campo etiqueta="Apellido" valor={formData.lastName} onChange={(v) => setFormData({ ...formData, lastName: v })} placeholder="Tu apellido" />
                        </div>
                        <Campo etiqueta="Email" tipo="email" valor={formData.email} onChange={(v) => setFormData({ ...formData, email: v })} placeholder="tu@email.com" />
                        <Campo etiqueta="Teléfono" tipo="tel" valor={formData.phone} onChange={(v) => setFormData({ ...formData, phone: v })} placeholder="+54 9 11 …" />
                    </div>
                )}

                {paso === 2 && isCouplesGroup && (
                    <div className="flex flex-col gap-[18px] pt-[18px]">
                        <div className="flex flex-col gap-3">
                            <h3 className="m-0 text-[19px] font-extrabold tracking-[-.02em] text-[#0A0A0A] dark:text-[#F7F7F8]">¿Querés inscribir a tu pareja?</h3>
                            <div className="grid grid-cols-2 gap-2.5">
                                <Opcion activo={wantsPartner === true} acento onClick={() => setWantsPartner(true)}>Sí, los dos</Opcion>
                                <Opcion
                                    activo={wantsPartner === false}
                                    onClick={() => {
                                        setWantsPartner(false);
                                        setPartnerHasEmail(null);
                                        limpiarPareja();
                                    }}
                                >
                                    Voy solo/a
                                </Opcion>
                            </div>
                        </div>

                        {wantsPartner === false && (
                            <div className="insc-sube rounded-[18px] bg-[#F7F7F8] p-4 text-sm font-semibold leading-[1.5] text-[#0A0A0A] dark:bg-[#212124] dark:text-[#F7F7F8]">
                                Perfecto. El grupo es de parejas, así que contale a {anfitriones.toLowerCase().startsWith('el ') ? 'quien lo recibe' : anfitriones} si tu pareja se suma más adelante.
                            </div>
                        )}

                        {wantsPartner === true && (
                            <div className="insc-sube flex flex-col gap-3 border-t border-[#F0F0F1] pt-[18px] dark:border-[#2C2C30]">
                                <h3 className="m-0 text-[19px] font-extrabold tracking-[-.02em] text-[#0A0A0A] dark:text-[#F7F7F8]">¿Tu pareja tiene email?</h3>
                                <div className="grid grid-cols-2 gap-2.5">
                                    <Opcion
                                        activo={partnerHasEmail === true}
                                        acento
                                        onClick={() => { setPartnerHasEmail(true); limpiarPareja(); }}
                                    >
                                        Sí, tiene
                                    </Opcion>
                                    <Opcion
                                        activo={partnerHasEmail === false}
                                        onClick={() => { setPartnerHasEmail(false); limpiarPareja(); }}
                                    >
                                        No tiene
                                    </Opcion>
                                </div>
                            </div>
                        )}

                        {mostrarBuscador && (
                            <div className="insc-sube flex flex-col gap-3">
                                <Campo
                                    etiqueta="Email de tu pareja"
                                    tipo="email"
                                    pareja
                                    valor={partnerData.email}
                                    error={!!partnerEmailError}
                                    ayuda={partnerEmailError || undefined}
                                    onChange={(v) => {
                                        setPartnerData({ ...partnerData, email: v });
                                        setPartnerAccount(null);
                                        setHasCheckedPartnerEmail(false);
                                        setPartnerEmailError(null);
                                    }}
                                    onBlur={buscarPareja}
                                    placeholder="pareja@email.com"
                                />
                                <button
                                    type="button"
                                    onClick={buscarPareja}
                                    disabled={!partnerData.email.trim()}
                                    className="self-start rounded-full border-[1.5px] border-[#0A0A0A] px-5 py-3 text-[14.5px] font-bold text-[#0A0A0A] transition-colors hover:bg-[#0A0A0A] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#0A0A0A] dark:border-[#F7F7F8] dark:text-[#F7F7F8] dark:hover:bg-[#F7F7F8] dark:hover:text-[#0A0A0A]"
                                >
                                    Buscar en la comunidad
                                </button>
                            </div>
                        )}

                        {checkingPartner && (
                            <div className="insc-sube flex items-center gap-3.5 rounded-[18px] bg-[#FDEFF4] px-[18px] py-[17px] dark:bg-[#2A1620]">
                                <span className="insc-gira h-5 w-5 flex-none rounded-full border-[2.5px] border-[#EC4B7F]/25 border-t-[#EC4B7F]" />
                                <div className="flex min-w-0 flex-col gap-0.5">
                                    <span className="truncate text-[14.5px] font-bold text-[#0A0A0A] dark:text-[#F7F7F8]">Buscando a {partnerData.email}</span>
                                    <span className="text-[13px] font-semibold text-[#A03260] dark:text-[#E98BAE]">Revisando cuentas de la comunidad…</span>
                                </div>
                            </div>
                        )}

                        {parejaEncontrada && (
                            <div className="insc-sube flex flex-col gap-3.5">
                                <div className="flex flex-col gap-3 rounded-[22px] border-[1.5px] border-[#EC4B7F]/20 bg-[#FDEFF4] p-5 dark:border-[#EC4B7F]/35 dark:bg-[#2A1620]">
                                    <div className="flex items-center gap-3">
                                        <span className="insc-sello flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#D0356B] text-white">
                                            <Check className="h-5 w-5" strokeWidth={2.6} />
                                        </span>
                                        <div className="flex min-w-0 flex-col gap-0.5">
                                            <span className="text-[17px] font-extrabold tracking-[-.02em] text-[#0A0A0A] dark:text-[#F7F7F8]">Encontramos a {nombrePilaPareja}</span>
                                            <span className="text-[13.5px] font-semibold text-[#A03260] dark:text-[#E98BAE]">Ya tiene cuenta. Quedaron vinculados.</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 rounded-[14px] bg-white/75 px-3 py-[11px] dark:bg-white/10">
                                        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#0A0A0A] text-[11.5px] font-bold text-white dark:bg-[#F7F7F8] dark:text-[#0A0A0A]">
                                            {iniciales(partnerData.firstName, partnerData.lastName)}
                                        </span>
                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate text-sm font-bold text-[#0A0A0A] dark:text-[#F7F7F8]">{[partnerData.firstName, partnerData.lastName].filter(Boolean).join(' ')}</span>
                                            <span className="truncate text-[12.5px] font-semibold text-[#6F6F73] dark:text-[#9C9CA1]">{partnerData.email}</span>
                                        </div>
                                    </div>
                                </div>
                                <Campo
                                    etiqueta={partnerData.phone ? 'Teléfono' : 'Solo falta su teléfono'}
                                    tipo="tel"
                                    pareja
                                    valor={partnerData.phone}
                                    onChange={(v) => setPartnerData({ ...partnerData, phone: v })}
                                    placeholder="+54 9 11 …"
                                />
                            </div>
                        )}

                        {mostrarCamposManuales && (
                            <div className="insc-sube flex flex-col gap-3.5">
                                {partnerHasEmail === true && sinCuenta && (
                                    <div className="flex items-start gap-3 rounded-[16px] bg-[#F7F7F8] px-[15px] py-3.5 dark:bg-[#212124]">
                                        <span className="mt-[5px] h-[7px] w-[7px] flex-none rounded-sm bg-[#EC4B7F]" />
                                        <span className="text-[13.5px] font-semibold leading-[1.45] text-[#0A0A0A] dark:text-[#F7F7F8]">
                                            No hay cuenta con ese email. Cargá sus datos y le creamos una cuando {anfitriones} {verbo('apruebe', 'aprueben')} la solicitud.
                                        </span>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                                    <Campo etiqueta="Nombre" pareja valor={partnerData.firstName} onChange={(v) => setPartnerData({ ...partnerData, firstName: v })} placeholder="Su nombre" />
                                    <Campo etiqueta="Apellido" pareja valor={partnerData.lastName} onChange={(v) => setPartnerData({ ...partnerData, lastName: v })} placeholder="Su apellido" />
                                </div>
                                <Campo etiqueta="Teléfono" tipo="tel" pareja valor={partnerData.phone} onChange={(v) => setPartnerData({ ...partnerData, phone: v })} placeholder="+54 9 11 …" />
                            </div>
                        )}

                        {/* Salida para el email mal tipeado: el buscador ya no
                            está en pantalla y sin esto la persona queda
                            atrapada con la cuenta equivocada, o sin ninguna. */}
                        {partnerHasEmail === true && hasCheckedPartnerEmail && (
                            <button
                                type="button"
                                onClick={() => { setPartnerAccount(null); setHasCheckedPartnerEmail(false); }}
                                className="self-start text-[13.5px] font-bold text-[#6F6F73] underline underline-offset-[3px] transition-opacity hover:opacity-60 dark:text-[#9C9CA1]"
                            >
                                Buscar con otro email
                            </button>
                        )}
                    </div>
                )}

                {paso === 3 && isCouplesGroup && (
                    <div className="flex flex-col gap-4 pt-[18px]">
                        <h3 className="m-0 text-[19px] font-extrabold tracking-[-.02em] text-[#0A0A0A] dark:text-[#F7F7F8]">Revisá antes de enviar</h3>
                        <div className="flex flex-col overflow-hidden rounded-[20px] bg-[#F7F7F8] dark:bg-[#212124]">
                            <div className="flex items-center gap-3 p-4">
                                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#0A0A0A] text-xs font-bold text-white dark:bg-[#F7F7F8] dark:text-[#0A0A0A]">
                                    {iniciales(formData.firstName, formData.lastName)}
                                </span>
                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate text-[15px] font-bold text-[#0A0A0A] dark:text-[#F7F7F8]">{formData.firstName} {formData.lastName}</span>
                                    <span className="truncate text-[13px] font-semibold text-[#6F6F73] dark:text-[#9C9CA1]">{formData.email}</span>
                                </div>
                            </div>
                            {hasPartnerData && (
                                <div className="flex items-center gap-3 border-t border-[#E6E6E7] p-4 dark:border-[#2C2C30]">
                                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#D0356B] text-xs font-bold text-white">
                                        {iniciales(partnerData.firstName, partnerData.lastName)}
                                    </span>
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate text-[15px] font-bold text-[#0A0A0A] dark:text-[#F7F7F8]">{partnerData.firstName} {partnerData.lastName}</span>
                                        <span className="truncate text-[13px] font-semibold text-[#A03260] dark:text-[#E98BAE]">Vinculada a tu inscripción</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        <p className="m-0 text-sm font-semibold leading-[1.5] text-[#6F6F73] text-pretty dark:text-[#9C9CA1]">
                            {anfitriones} {hasPartnerData
                                ? verbo('recibe la solicitud y confirma el lugar para los dos.', 'reciben la solicitud y confirman el lugar para los dos.')
                                : verbo('recibe la solicitud y confirma tu lugar.', 'reciben la solicitud y confirman tu lugar.')} Te avisamos por email y por una notificación en la app.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="insc-sube mt-4 flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-[#FBD5D1] bg-[#FEF3F2] p-4 dark:border-[#7A2A22] dark:bg-[#2A1614]">
                        <span className="text-[15px] font-extrabold text-[#B42318] dark:text-[#F79E96]">No pudimos enviar la solicitud</span>
                        <span className="text-[13.5px] font-semibold leading-[1.45] text-[#912018] dark:text-[#E8A9A3]">{error}</span>
                    </div>
                )}
            </div>

            {/* Pie */}
            <footer className="flex flex-none flex-col gap-3 border-t border-[#F0F0F1] bg-white px-[22px] pb-5 pt-4 dark:border-[#2C2C30] dark:bg-[#17171A]">
                {esUltimoPaso && !isSubmitting && (
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-[#6F6F73] dark:text-[#9C9CA1]">
                        <Clock className="h-3.5 w-3.5 flex-none" />
                        {anfitriones} {verbo('aprueba', 'aprueban')} la solicitud. No es automático.
                    </div>
                )}
                <div className="flex items-center gap-2.5">
                    {isCouplesGroup && paso > 1 && (
                        <button
                            type="button"
                            onClick={() => { setError(null); setPaso(paso - 1); }}
                            className="flex-none rounded-full bg-[#F4F4F5] px-[22px] py-4 text-[15.5px] font-bold text-[#0A0A0A] transition-colors hover:bg-[#EAEAEB] dark:bg-[#26262A] dark:text-[#F7F7F8] dark:hover:bg-[#303034]"
                        >
                            Atrás
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onPrimario}
                        disabled={isSubmitting}
                        className="flex flex-1 items-center justify-center gap-2.5 rounded-full bg-[#0A0A0A] px-5 py-[17px] text-[16.5px] font-bold tracking-[-.01em] text-white transition-opacity hover:opacity-[.88] disabled:opacity-[.55] dark:bg-[#F7F7F8] dark:text-[#0A0A0A]"
                    >
                        {isSubmitting && (
                            <span className="insc-gira h-4 w-4 flex-none rounded-full border-[2.2px] border-white/30 border-t-white dark:border-[#0A0A0A]/30 dark:border-t-[#0A0A0A]" />
                        )}
                        {etiquetaPrimario}
                    </button>
                </div>
            </footer>
        </HojaInscripcion>
    );
};

// ── Piezas ──────────────────────────────────────────────────────────────────

const Campo = ({ etiqueta, valor, onChange, tipo = 'text', placeholder, onBlur, deshabilitado, error, pareja, ayuda }: {
    etiqueta: string;
    valor: string;
    onChange: (v: string) => void;
    tipo?: string;
    placeholder?: string;
    onBlur?: () => void;
    deshabilitado?: boolean;
    error?: boolean;
    /** el foco va rosa: los campos del tramo de la pareja */
    pareja?: boolean;
    ayuda?: string;
}) => (
    <label className="flex flex-col gap-[7px]">
        <span className="text-[11.5px] font-bold uppercase tracking-[.08em] text-[#6F6F73] dark:text-[#9C9CA1]">{etiqueta}</span>
        <input
            type={tipo}
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            disabled={deshabilitado}
            placeholder={placeholder}
            className={`w-full box-border ${pareja ? 'campo-pareja' : ''} ${error ? 'campo-error' : ''}`}
        />
        {ayuda && (
            <span className={`text-[12.5px] font-semibold ${error ? 'text-[#B42318]' : 'text-[#6F6F73] dark:text-[#9C9CA1]'}`}>{ayuda}</span>
        )}
    </label>
);

const Opcion = ({ activo, acento, onClick, children }: {
    activo: boolean;
    acento?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={activo}
        className={`rounded-[18px] border-[1.5px] px-3 py-[15px] text-base font-bold transition-colors ${activo
            ? acento
                ? 'border-[#D0356B] bg-[#D0356B] text-white'
                : 'border-[#0A0A0A] bg-[#0A0A0A] text-white dark:border-[#F7F7F8] dark:bg-[#F7F7F8] dark:text-[#0A0A0A]'
            : 'border-[#E0E0E2] bg-transparent text-[#0A0A0A] hover:border-[#0A0A0A] dark:border-[#3A3A3E] dark:text-[#F7F7F8] dark:hover:border-[#F7F7F8]'
            }`}
    >
        {children}
    </button>
);

export default JoinGroupModal;

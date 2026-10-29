import React, { useState, useEffect, useRef } from 'react';
import HojaGrupos from './HojaGrupos';
import { Check, Clock, Users, CalendarClock, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Group, User, GroupRegistration, GroupCategory, GroupTag } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import {
    CompromisoGCX, diferenciaHoraria, gruposDelMismoDia, hoyArgentino, horaCorta,
} from '../../src/utils/gruposMismoDia';

/**
 * Inscripción a un grupo — design-claude/JoinFlow, con el lenguaje visual
 * de /gcx (design-claude/GCX - Tarjetas y pagina): el mismo panel que
 * compartir y la postulación (HojaGrupos), los tokens de .gcx-m y Manrope.
 *
 * Dos variantes sobre la misma hoja:
 *   A · común   — una sola pantalla con los cuatro datos de la persona.
 *   B · parejas — tres pasos (tus datos · tu pareja · confirmar), porque acá
 *                 sí hay una secuencia de decisiones: si suma a su pareja, si
 *                 tiene email, y recién después buscarla en la comunidad.
 * El rosa aparece únicamente en el recorrido de parejas: es lo que distingue
 * una variante de la otra de un vistazo.
 *
 * El aspecto de los campos se define en index.html (#gcx-inscripcion): el
 * override global de inputs les gana a las clases de Tailwind.
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
                setError('Te faltan datos en tu perfil. Completalos ahí para continuar.');
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
            setError('Te faltan datos en tu perfil. Completalos ahí para inscribirte.');
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
                // El texto vive en el catálogo de alertas; de acá sólo viajan
                // los nombres y el grupo (sql/notif_catalogo.sql).
                const clave = hasPartnerData ? 'gcx_solicitud_pareja_app' : 'gcx_solicitud_ingreso_app';
                const vars: Record<string, string> = {
                    nombre: `${formData.firstName} ${formData.lastName}`,
                    grupo: group.name,
                };
                if (hasPartnerData) {
                    vars.pareja = `${partnerData.firstName} ${partnerData.lastName}`;
                }
                const actionUrl = `/panel-admin/groups?groupId=${group.id}`;

                // Notify host
                if ((group as any).host_id) {
                    await supabaseService.crearAviso((group as any).host_id, clave, vars, actionUrl);
                }

                // Notify co-host
                if ((group as any).co_host_id) {
                    await supabaseService.crearAviso((group as any).co_host_id, clave, vars, actionUrl);
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

    // Los datos propios no se editan en la inscripción: son los de la
    // cuenta. Mismo orden que el calendario: cerrar y después navegar.
    const irAMiPerfil = () => {
        onClose();
        navigate('/perfil');
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

    // ── Piezas de la vista (design-claude/GCX - Tarjetas y pagina) ──────────
    const btnTinta = 'gcx-hover-tinta w-full h-14 rounded-full border-0 text-[16px] font-semibold flex items-center justify-center gap-2 cursor-pointer active:scale-[.98] disabled:cursor-default disabled:opacity-[.55]';
    const btnChip = 'gcx-hover-chip w-full h-14 rounded-full border-0 text-[16px] font-semibold flex items-center justify-center cursor-pointer';
    const TINTA: React.CSSProperties = { background: 'var(--g-ink)', color: 'var(--g-inv)' };
    const CHIP: React.CSSProperties = { background: 'var(--g-chip)', color: 'var(--g-ink)' };
    const rotulo = 'm-0 text-[12px] font-semibold tracking-[.07em]';
    const ROTULO: React.CSSProperties = { color: 'var(--g-m38)' };
    const SUAVE: React.CSSProperties = { color: 'var(--g-m50)' };

    // ── Confirmación ────────────────────────────────────────────────────────
    if (successView) {
        return (
            <HojaGrupos
                abierta={isOpen}
                onCerrar={onClose}
                etiquetadaPor="insc-titulo-exito"
                id="gcx-inscripcion"
                ancha
                pie={<>
                    <button type="button" onClick={verMiCalendario} className={btnTinta} style={TINTA}>Ver mi calendario</button>
                    <button type="button" onClick={onClose} className={btnChip} style={CHIP}>Seguir mirando grupos</button>
                </>}
            >
                <div className="flex flex-col pt-2">
                    <div className="w-[76px] h-[76px] rounded-full flex items-center justify-center" style={{ background: 'var(--g-grnBg)', color: 'var(--g-grn)', animation: 'gcxZoom .4s ease both' }}>
                        <Check className="h-[34px] w-[34px]" strokeWidth={2.4} />
                    </div>
                    <h2 id="insc-titulo-exito" className="mt-[22px] mr-14 mb-0 text-[28px] leading-[1.1] font-semibold tracking-[-.03em] [text-wrap:balance]">
                        ¡Listo! Te inscribiste en {group.name}
                    </h2>
                    <p className="mt-2.5 mb-0 text-[15.5px] leading-[1.5] [text-wrap:pretty]" style={SUAVE}>
                        {anfitriones} {verbo('confirma', 'confirman')} tu lugar. Te avisamos por email y en la app.
                    </p>

                    <p className={`${rotulo} mt-7`} style={ROTULO}>QUÉ SIGUE</p>
                    <ol className="mt-3 mb-0 p-0 list-none flex flex-col">
                        {[
                            { t: 'Solicitud enviada', s: `Hoy, ${enviadaA}`, estado: 'hecho' as const },
                            { t: `${anfitriones} ${verbo('la revisa', 'la revisan')}`, s: 'En curso', estado: 'ahora' as const },
                            { t: 'Te avisamos y entrás al grupo', s: 'Por email y por una notificación en la app', estado: 'despues' as const },
                        ].map((p, i, todos) => (
                            <li key={p.t} className="flex gap-3.5">
                                <div className="flex flex-none flex-col items-center pt-1">
                                    <span
                                        className={`h-3 w-3 rounded-full ${p.estado === 'ahora' ? 'insc-late' : ''}`}
                                        style={p.estado === 'despues'
                                            ? { boxShadow: 'inset 0 0 0 2px var(--g-line)' }
                                            : { background: p.estado === 'hecho' ? 'var(--g-grn)' : 'var(--g-ink)' }}
                                    />
                                    {i < todos.length - 1 && <span className="min-h-[26px] w-0.5 flex-1" style={{ background: 'var(--g-line2)' }} />}
                                </div>
                                <div className={i < todos.length - 1 ? 'pb-[18px]' : ''}>
                                    <div className="text-[15.5px] font-semibold" style={p.estado === 'despues' ? { color: 'var(--g-m50)' } : undefined}>{p.t}</div>
                                    <div className="text-[14px] leading-[1.45]" style={SUAVE}>{p.s}</div>
                                </div>
                            </li>
                        ))}
                    </ol>

                    {/* Dónde queda esto a partir de ahora. La inscripción deja
                        de ser un trámite que terminó y pasa a ser una reunión en
                        la semana de la persona. */}
                    <div className="mt-6 flex items-start gap-2.5 rounded-[18px] px-3.5 py-3" style={{ background: 'var(--g-chip)', color: 'var(--g-m62)' }}>
                        <CalendarDays className="mt-[2px] h-[17px] w-[17px] flex-none" strokeWidth={2} />
                        <p className="m-0 text-[14px] font-medium leading-[1.45]">
                            Ya está en tu calendario: {(group.meetingDay || '').toLowerCase()}{group.meetingTime ? ` ${horaCorta(group.meetingTime)} hs` : ''}, como solicitud pendiente. Cuando te aprueben, queda confirmado.
                        </p>
                    </div>
                </div>
            </HojaGrupos>
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
            <HojaGrupos
                abierta={isOpen}
                onCerrar={onClose}
                etiquetadaPor="insc-titulo-aviso"
                id="gcx-inscripcion"
                ancha
                pie={<>
                    <button type="button" onClick={() => { setChoques([]); handleSubmit(); }} className={btnTinta} style={TINTA}>Inscribirme igual</button>
                    <button type="button" onClick={onClose} className={btnChip} style={CHIP}>Volver a ver los GCX</button>
                </>}
            >
                <div className="flex flex-col pt-2">
                    <div className="w-[76px] h-[76px] rounded-full flex items-center justify-center" style={{ background: 'var(--g-ambBg)', color: 'var(--g-amb)', animation: 'gcxZoom .4s ease both' }}>
                        <CalendarClock className="h-8 w-8" strokeWidth={1.9} />
                    </div>
                    <h2 id="insc-titulo-aviso" className="mt-[22px] mr-14 mb-0 text-[28px] leading-[1.1] font-semibold tracking-[-.03em] [text-wrap:balance]">
                        {varios ? `Ya tenés ${choques.length} grupos los ${diaDestino}` : `Ya tenés un grupo los ${diaDestino}`}
                    </h2>
                    <p className="mt-2.5 mb-0 text-[15.5px] leading-[1.5] [text-wrap:pretty]" style={SUAVE}>
                        {group.name} también es los {diaDestino}{horaDestino ? ` a las ${horaDestino} hs` : ''}. Revisá si llegás a los dos.
                    </p>

                    <div className="mt-6 flex flex-col gap-2.5">
                        {choques.map(c => {
                            const hora = horaCorta(c.hora);
                            const diferencia = diferenciaHoraria(c.hora, group.meetingTime);
                            const dia = (c.dia || '').toLowerCase();
                            const relacion = c.relacion === 'ANFITRION' ? 'Sos anfitrión'
                                : c.relacion === 'APPROVED' ? 'Sos miembro'
                                    : 'Solicitud pendiente';
                            const pastilla = 'h-7 px-3 rounded-full inline-flex items-center text-[13px] font-semibold whitespace-nowrap';
                            return (
                                <div key={c.groupId} className="flex flex-col gap-2 rounded-[20px] px-4 py-4" style={{ background: 'var(--g-chip)' }}>
                                    <div className="text-[16px] font-semibold leading-[1.25] tracking-[-.01em]">{c.nombre}</div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-[14px] font-medium first-letter:uppercase" style={{ color: 'var(--g-m62)' }}>
                                            {dia}{hora ? ` · ${hora} hs` : ''}
                                        </span>
                                        {diferencia && (
                                            <span className={pastilla} style={{ background: 'var(--g-ambBg)', color: 'var(--g-amb)' }}>{diferencia}</span>
                                        )}
                                    </div>
                                    {c.anfitrion && (
                                        <div className="text-[14px] font-medium" style={{ color: 'var(--g-m62)' }}>
                                            {c.dosAnfitriones ? 'Anfitriones' : 'Anfitrión'}: {c.anfitrion}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        <span className={pastilla} style={{ background: 'var(--g-card)', color: 'var(--g-ink)' }}>{relacion}</span>
                                        {c.online && (
                                            <span className={pastilla} style={{ background: 'var(--g-card)', color: 'var(--g-m62)' }}>Online</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </HojaGrupos>
        );
    }

    const anfitrionesCompletos = [anfitrionCompleto, coAnfitrionCompleto].filter(Boolean);

    return (
        <HojaGrupos
            abierta={isOpen}
            onCerrar={onClose}
            etiquetadaPor="insc-titulo"
            id="gcx-inscripcion"
            ancha
            pieConLinea
            pie={<>
                {esUltimoPaso && !isSubmitting && (
                    <div className="flex items-center justify-center gap-2 text-[13px] font-medium" style={SUAVE}>
                        <Clock className="h-3.5 w-3.5 flex-none" />
                        {anfitriones} {verbo('aprueba', 'aprueban')} la solicitud. No es automático.
                    </div>
                )}
                <div className="flex items-center gap-2">
                    {isCouplesGroup && paso > 1 && (
                        <button
                            type="button"
                            onClick={() => { setError(null); setPaso(paso - 1); }}
                            className="gcx-hover-chip flex-none h-14 px-6 rounded-full border-0 text-[16px] font-semibold cursor-pointer"
                            style={CHIP}
                        >
                            Atrás
                        </button>
                    )}
                    <button type="button" onClick={onPrimario} disabled={isSubmitting} className={`${btnTinta} flex-1`} style={TINTA}>
                        {isSubmitting && (
                            <span className="insc-gira h-4 w-4 flex-none rounded-full border-[2.2px] border-white/30 border-t-white dark:border-black/30 dark:border-t-black" />
                        )}
                        <span>{etiquetaPrimario}</span>
                        {!isSubmitting && !esUltimoPaso && (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                        )}
                    </button>
                </div>
            </>}
        >
            {/* Encabezado: el rótulo y el grupo como título, igual que la
                postulación. Sin <header>: el "modo foco" de index.css esconde
                todos los header mientras hay un modal abierto. */}
            <div className="flex flex-col">
                <p className={rotulo} style={ROTULO}>INSCRIPCIÓN</p>
                <h2 id="insc-titulo" className="mt-2 mr-14 mb-0 text-[26px] leading-[1.15] font-semibold tracking-[-.03em] [text-wrap:balance]">
                    {group.name}
                </h2>

                {isCouplesGroup && (
                    <div className="mt-4 flex flex-col gap-2.5">
                        <div className="flex gap-1.5" aria-hidden="true">
                            {[1, 2, 3].map(i => (
                                <span
                                    key={i}
                                    className="h-[5px] flex-1 rounded-full"
                                    style={{ background: paso > i ? 'var(--g-ink)' : paso === i ? '#EC4B7F' : 'var(--g-chip)', transition: 'background .25s ease' }}
                                />
                            ))}
                        </div>
                        <p className="m-0 flex items-center gap-2">
                            <span className="text-[12px] font-semibold tracking-[.07em] text-[#C92F63] dark:text-[#F08AAE]">PASO {paso} DE 3</span>
                            <span className="text-[13.5px] font-medium" style={SUAVE}>{nombrePaso}</span>
                        </p>
                    </div>
                )}
            </div>

            {paso === 1 && (
                <div className="mt-5 flex flex-col gap-4">
                    {/* Tus datos: primero y a la vista, para que la persona
                        los revise antes de mandar nada. No se editan acá: son
                        los de su cuenta, y se cambian en /perfil, así no queda
                        una inscripción con un teléfono distinto del de su
                        cuenta. */}
                    <section aria-labelledby="insc-tus-datos" className="rounded-[20px] overflow-hidden" style={{ background: 'var(--g-chip)' }}>
                        <p id="insc-tus-datos" className={`${rotulo} px-4 pt-3.5`} style={ROTULO}>TUS DATOS</p>
                        <dl className="m-0 px-4 pb-1.5">
                            {[
                                { rotulo: 'Nombre', valor: [formData.firstName, formData.lastName].filter(s => s.trim()).join(' ') },
                                { rotulo: 'Email', valor: formData.email },
                                { rotulo: 'Teléfono', valor: formData.phone },
                            ].map((d, i) => (
                                <div key={d.rotulo} className="flex items-baseline justify-between gap-4 py-3" style={{ borderTop: i ? '1px solid var(--g-line2)' : 0 }}>
                                    <dt className="flex-none text-[14px] font-medium" style={SUAVE}>{d.rotulo}</dt>
                                    <dd className="m-0 min-w-0 text-right text-[15px] font-semibold [overflow-wrap:anywhere]" style={d.valor.trim() ? undefined : { color: 'var(--g-amb)' }}>
                                        {d.valor.trim() || 'Falta'}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </section>

                    {datosPropiosCompletos ? (
                        <div className="flex items-center gap-3 -mt-1">
                            <p className="m-0 flex-1 text-[14px] font-medium leading-[1.45]" style={SUAVE}>
                                ¿Algo no está bien? Se cambia desde tu perfil.
                            </p>
                            <button type="button" onClick={irAMiPerfil} className="gcx-hover-chip flex-none h-11 px-4 rounded-full border-0 text-[14px] font-semibold cursor-pointer" style={CHIP}>
                                Ir a mi perfil
                            </button>
                        </div>
                    ) : (
                        <div role="alert" className="flex flex-col gap-3 rounded-[18px] px-3.5 py-3" style={{ background: 'var(--g-ambBg)', color: 'var(--g-amb)' }}>
                            <p className="m-0 text-[14px] font-medium leading-[1.45]">
                                Para inscribirte te falta completar tu perfil. Cargá lo que dice "Falta" y volvé a este grupo.
                            </p>
                            <button type="button" onClick={irAMiPerfil} className="w-full h-12 rounded-full border-0 text-[15px] font-semibold cursor-pointer active:scale-[.98]" style={{ background: 'var(--g-card)', color: 'var(--g-ink)' }}>
                                Completar mi perfil
                            </button>
                        </div>
                    )}

                    {/* A qué grupo se está anotando: portada y quién lo
                        anfitriona, como en la tarjeta. */}
                    <div className="rounded-[20px] overflow-hidden" style={{ background: 'var(--g-chip)' }}>
                        {group.imageUrl ? (
                            <img src={group.imageUrl} alt="" className="block h-[112px] w-full object-cover" />
                        ) : (
                            <div className="flex h-[64px] w-full items-center justify-center" style={{ color: 'var(--g-m38)' }}>
                                <Users className="h-6 w-6" />
                            </div>
                        )}
                        {anfitrionesCompletos.length > 0 && (
                            <div className="flex items-center gap-2.5 px-3.5 py-3">
                                <div className="flex flex-none" aria-hidden="true">
                                    {anfitrionesCompletos.map((n, j) => {
                                        const [pila, ...resto] = n.split(/\s+/);
                                        return (
                                            <span
                                                key={j}
                                                className="w-9 h-9 rounded-full flex items-center justify-center text-[12.5px] font-bold"
                                                style={{ background: j ? 'var(--g-av2)' : 'var(--g-av1)', color: 'var(--g-ink)', border: '2px solid var(--g-chip)', marginLeft: j ? -10 : 0 }}
                                            >
                                                {iniciales(pila, resto.join(' '))}
                                            </span>
                                        );
                                    })}
                                </div>
                                <div className="min-w-0 flex flex-col">
                                    <span className="text-[12.5px] font-medium" style={SUAVE}>{dosAnfitriones ? 'Anfitriones' : 'Anfitrión'}</span>
                                    {anfitrionesCompletos.map(n => (
                                        <span key={n} className="text-[14.5px] leading-[1.35] font-semibold [overflow-wrap:anywhere]">{n}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {paso === 2 && isCouplesGroup && (
                <div className="mt-6 flex flex-col gap-5">
                    <fieldset className="m-0 p-0 border-0 flex flex-col">
                        <legend className="p-0 mb-2.5 text-[16px] leading-[1.35] font-semibold tracking-[-.01em]">¿Querés inscribir a tu pareja?</legend>
                        <div className="grid grid-cols-2 gap-2">
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
                    </fieldset>

                    {wantsPartner === false && (
                        <div className="insc-sube rounded-[18px] px-3.5 py-3 text-[14px] font-medium leading-[1.5]" style={{ background: 'var(--g-chip)', color: 'var(--g-m62)' }}>
                            Perfecto. El grupo es de parejas, así que contale a {anfitriones.toLowerCase().startsWith('el ') ? 'quien lo recibe' : anfitriones} si tu pareja se suma más adelante.
                        </div>
                    )}

                    {wantsPartner === true && (
                        <fieldset className="insc-sube m-0 p-0 border-0 flex flex-col">
                            <legend className="p-0 mb-2.5 text-[16px] leading-[1.35] font-semibold tracking-[-.01em]">¿Tu pareja tiene email?</legend>
                            <div className="grid grid-cols-2 gap-2">
                                <Opcion activo={partnerHasEmail === true} acento onClick={() => { setPartnerHasEmail(true); limpiarPareja(); }}>Sí, tiene</Opcion>
                                <Opcion activo={partnerHasEmail === false} onClick={() => { setPartnerHasEmail(false); limpiarPareja(); }}>No tiene</Opcion>
                            </div>
                        </fieldset>
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
                                className="gcx-hover-chip self-start h-12 px-5 rounded-full border-0 text-[15px] font-semibold cursor-pointer disabled:cursor-default disabled:opacity-40"
                                style={CHIP}
                            >
                                Buscar en la comunidad
                            </button>
                        </div>
                    )}

                    {checkingPartner && (
                        <div className="insc-sube flex items-center gap-3.5 rounded-[18px] px-4 py-4 bg-[#FDEFF4] dark:bg-[#2A1620]">
                            <span className="insc-gira h-5 w-5 flex-none rounded-full border-[2.5px] border-[#EC4B7F]/25 border-t-[#EC4B7F]" />
                            <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="truncate text-[15px] font-semibold">Buscando a {partnerData.email}</span>
                                <span className="text-[13.5px] font-medium text-[#A03260] dark:text-[#E98BAE]">Revisando cuentas de la comunidad…</span>
                            </div>
                        </div>
                    )}

                    {parejaEncontrada && (
                        <div className="insc-sube flex flex-col gap-3.5">
                            <div className="flex flex-col gap-3 rounded-[20px] p-4 bg-[#FDEFF4] dark:bg-[#2A1620]">
                                <div className="flex items-center gap-3">
                                    <span className="insc-sello flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[#D0356B] text-white">
                                        <Check className="h-5 w-5" strokeWidth={2.6} />
                                    </span>
                                    <div className="flex min-w-0 flex-col gap-0.5">
                                        <span className="text-[17px] font-semibold tracking-[-.02em]">Encontramos a {nombrePilaPareja}</span>
                                        <span className="text-[14px] font-medium text-[#A03260] dark:text-[#E98BAE]">Ya tiene cuenta. Quedaron vinculados.</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2.5 rounded-[16px] px-3 py-2.5" style={{ background: 'var(--g-card)' }}>
                                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12.5px] font-bold" style={TINTA}>
                                        {iniciales(partnerData.firstName, partnerData.lastName)}
                                    </span>
                                    <div className="flex min-w-0 flex-col">
                                        <span className="truncate text-[14.5px] font-semibold">{[partnerData.firstName, partnerData.lastName].filter(Boolean).join(' ')}</span>
                                        <span className="truncate text-[13px] font-medium" style={SUAVE}>{partnerData.email}</span>
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
                        <div className="insc-sube flex flex-col gap-3">
                            {partnerHasEmail === true && sinCuenta && (
                                <div className="flex items-start gap-2.5 rounded-[18px] px-3.5 py-3" style={{ background: 'var(--g-chip)', color: 'var(--g-m62)' }}>
                                    <span className="mt-[7px] h-[7px] w-[7px] flex-none rounded-full bg-[#EC4B7F]" />
                                    <span className="text-[14px] font-medium leading-[1.45]">
                                        No hay cuenta con ese email. Cargá sus datos y le creamos una cuando {anfitriones} {verbo('apruebe', 'aprueben')} la solicitud.
                                    </span>
                                </div>
                            )}
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <Campo etiqueta="Nombre" pareja valor={partnerData.firstName} onChange={(v) => setPartnerData({ ...partnerData, firstName: v })} placeholder="Su nombre" />
                                <Campo etiqueta="Apellido" pareja valor={partnerData.lastName} onChange={(v) => setPartnerData({ ...partnerData, lastName: v })} placeholder="Su apellido" />
                                <div className="md:col-span-2">
                                    <Campo etiqueta="Teléfono" tipo="tel" pareja valor={partnerData.phone} onChange={(v) => setPartnerData({ ...partnerData, phone: v })} placeholder="+54 9 11 …" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Salida para el email mal tipeado: el buscador ya no
                        está en pantalla y sin esto la persona queda
                        atrapada con la cuenta equivocada, o sin ninguna. */}
                    {partnerHasEmail === true && hasCheckedPartnerEmail && (
                        <button
                            type="button"
                            onClick={() => { setPartnerAccount(null); setHasCheckedPartnerEmail(false); }}
                            className="self-start -ml-2.5 -my-2 h-11 px-2.5 border-0 bg-transparent text-[14.5px] font-semibold cursor-pointer underline underline-offset-[3px] decoration-[var(--g-line)]"
                            style={{ color: 'var(--g-ink)' }}
                        >
                            Buscar con otro email
                        </button>
                    )}
                </div>
            )}

            {paso === 3 && isCouplesGroup && (
                <div className="mt-6 flex flex-col gap-4">
                    <h3 className="m-0 text-[16px] font-semibold tracking-[-.01em]">Revisá antes de enviar</h3>
                    <div className="flex flex-col rounded-[20px] overflow-hidden" style={{ background: 'var(--g-chip)' }}>
                        <div className="flex items-center gap-3 p-4">
                            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12.5px] font-bold" style={TINTA}>
                                {iniciales(formData.firstName, formData.lastName)}
                            </span>
                            <div className="flex min-w-0 flex-col">
                                <span className="truncate text-[15px] font-semibold">{formData.firstName} {formData.lastName}</span>
                                <span className="truncate text-[13.5px] font-medium" style={SUAVE}>{formData.email}</span>
                            </div>
                        </div>
                        {hasPartnerData && (
                            <div className="flex items-center gap-3 p-4" style={{ borderTop: '1px solid var(--g-line2)' }}>
                                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#D0356B] text-[12.5px] font-bold text-white">
                                    {iniciales(partnerData.firstName, partnerData.lastName)}
                                </span>
                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate text-[15px] font-semibold">{partnerData.firstName} {partnerData.lastName}</span>
                                    <span className="truncate text-[13.5px] font-medium text-[#A03260] dark:text-[#E98BAE]">Vinculada a tu inscripción</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <p className="m-0 text-[15px] leading-[1.5] [text-wrap:pretty]" style={SUAVE}>
                        {anfitriones} {hasPartnerData
                            ? verbo('recibe la solicitud y confirma el lugar para los dos.', 'reciben la solicitud y confirman el lugar para los dos.')
                            : verbo('recibe la solicitud y confirma tu lugar.', 'reciben la solicitud y confirman tu lugar.')} Te avisamos por email y por una notificación en la app.
                    </p>
                </div>
            )}

            {error && (
                <div role="alert" className="insc-sube mt-4 flex gap-2.5 rounded-[18px] px-3.5 py-3 bg-[#FEF3F2] text-[#B42318] dark:bg-[rgba(217,45,32,.14)] dark:text-[#F79E96]">
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', marginTop: 2 }}><circle cx="12" cy="12" r="8.5" /><path d="M12 8v4.5M12 16h.01" /></svg>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold">No pudimos enviar la solicitud</span>
                        <span className="text-[14px] font-medium leading-[1.45]">{error}</span>
                    </div>
                </div>
            )}
        </HojaGrupos>
    );
};

// ── Piezas ──────────────────────────────────────────────────────────────────

// El aspecto del campo (blanco, borde de 1.5, foco de tinta, rosa en el tramo
// de la pareja, rojo con error) vive en index.html, #gcx-inscripcion: el
// override global de inputs les gana a las clases de Tailwind.
const Campo = ({ etiqueta, valor, onChange, tipo = 'text', placeholder, onBlur, deshabilitado, error, pareja, ayuda, auto }: {
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
    auto?: string;
}) => (
    <label className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold uppercase tracking-[.07em]" style={{ color: 'var(--g-m38)' }}>{etiqueta}</span>
        <input
            type={tipo}
            value={valor}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            disabled={deshabilitado}
            placeholder={placeholder}
            autoComplete={auto}
            aria-invalid={error || undefined}
            className={`w-full min-w-0 box-border h-[52px] ${pareja ? 'campo-pareja' : ''} ${error ? 'campo-error' : ''}`}
        />
        {ayuda && (
            <span className={`text-[13px] font-medium ${error ? 'text-[#B42318] dark:text-[#F79E96]' : ''}`} style={error ? undefined : { color: 'var(--g-m50)' }}>{ayuda}</span>
        )}
    </label>
);

// Las opciones son las de la postulación: tilde y tinta al elegir. En el
// tramo de la pareja la elegida va en rosa, que es lo que distingue esa
// variante de un vistazo.
const Opcion = ({ activo, acento, onClick, children }: {
    activo: boolean;
    acento?: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) => {
    const fondo = activo ? (acento ? '#D0356B' : 'var(--g-ink)') : 'transparent';
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={activo}
            className={`h-14 rounded-[18px] text-[15.5px] font-semibold flex items-center justify-center gap-2 cursor-pointer ${activo ? '' : 'gcx-hover-chip'}`}
            style={{
                border: `1.5px solid ${activo ? fondo : 'var(--g-line)'}`,
                background: fondo,
                color: activo ? (acento ? '#ffffff' : 'var(--g-inv)') : 'var(--g-ink)',
                transition: 'background .15s, border-color .15s',
            }}
        >
            {activo && <Check className="h-4 w-4" strokeWidth={2.6} />}
            <span>{children}</span>
        </button>
    );
};

export default JoinGroupModal;

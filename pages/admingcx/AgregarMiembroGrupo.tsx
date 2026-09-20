import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Group, GroupCategory, GroupTag, esGrupoPendiente } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { supabase } from '../../services/supabaseClient';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import PestanasGrupoAdmin from '../../components/GCX/PestanasGrupoAdmin';
import ModalParejaInscripcion, { DatosPareja } from '../../components/GCX/ModalParejaInscripcion';
import { Search, Loader2, Check, UserPlus, X } from 'lucide-react';

/**
 * Agregar a mano (design-claude/Admin GCX - Detalle e Inscriptos).
 *
 * Tres pasos: a qué grupo, quién es, y sus datos. El bloque del acompañante
 * está siempre presente —se habilita solo si el grupo elegido es de parejas—
 * para que el formulario no cambie de forma según el grupo.
 *
 * El paso 2 se busca ANTES de escribir nada. La mayoría de la gente que se
 * anota a mano ya tiene cuenta, y cargarla de nuevo a mano crea una persona
 * duplicada que no ve sus grupos desde su sesión. Buscar primero y tipear
 * sólo si de verdad no está invierte ese default.
 *
 * La pantalla tiene DOS modos, según cómo se llegó:
 *
 * - Con `?grupo=<id>`, desde las pestañas de un grupo: el grupo viene FIJO.
 *   El paso 1 deja de ser un buscador y pasa a ser la tarjeta de ese grupo.
 *   Desplegar los cien y pico de grupos cuando ya se sabe a cuál se está
 *   anotando es ruido, y encima deja elegir otro sin querer. Las pestañas se
 *   conservan para volver a su ficha o a sus inscriptos.
 *
 * - Sin el parámetro, desde Moderación o el menú: el buscador completo, y SIN
 *   pestañas. No hay un grupo del que colgar una ficha, y ofrecer saltar a
 *   una sería ofrecer saltar a la de cualquiera.
 */

const ROSA = '#9d1d5c';

/** Lo que devuelve la RPC `buscar_personas`. */
interface PersonaEncontrada {
    id: string;
    name: string;
    email?: string;
    phone?: string;
}

/**
 * En qué punto del paso 2 está.
 *
 * `buscando` es el estado inicial y bloquea el paso 3: es lo que obliga a
 * mirar si la persona ya existe antes de poder tipear sus datos.
 */
type ModoPersona = 'buscando' | 'cuenta' | 'manual';

/**
 * El grupo fijado sale de la query. Se sigue aceptando `location.state` por si
 * quedó algún link viejo navegando así.
 */
const useGrupoFijado = (): string => {
    const location = useLocation();
    const porUrl = new URLSearchParams(location.search).get('grupo');
    return porUrl || (location.state as { groupId?: string } | null)?.groupId || '';
};

const AgregarMiembroGrupoContent: React.FC<{
    onGrupo: (g: Group | null) => void;
    grupoFijado: string;
}> = ({ onGrupo, grupoFijado }) => {
    const navigate = useNavigate();
    const { showToast } = useAdminGCXToast();

    const [groups, setGroups] = useState<Group[]>([]);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    // Si se entró desde un grupo, ese grupo ya viene elegido y no se cambia.
    const [selectedGroupId, setSelectedGroupId] = useState(grupoFijado);
    const [gQuery, setGQuery] = useState('');
    const modoFijado = !!grupoFijado;

    // Con el grupo fijado el paso 1 no tiene nada que decidir: se arranca en
    // el 2 y el riel lo muestra ya resuelto.
    const [paso, setPaso] = useState<1 | 2 | 3>(modoFijado ? 2 : 1);

    // ── Paso 2: ¿quién es? ──────────────────────────────────────────
    const [modoPersona, setModoPersona] = useState<ModoPersona>('buscando');
    const [pQuery, setPQuery] = useState('');
    const [pResultados, setPResultados] = useState<PersonaEncontrada[]>([]);
    const [buscandoPersona, setBuscandoPersona] = useState(false);
    const [personaElegida, setPersonaElegida] = useState<PersonaEncontrada | null>(null);

    const [nombreCompleto, setNombreCompleto] = useState('');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');
    const [buscandoCuenta, setBuscandoCuenta] = useState(false);
    const [cuenta, setCuenta] = useState<'idle' | 'found' | 'not-found'>('idle');
    const [foundUserId, setFoundUserId] = useState<string | null>(null);

    const [pareja, setPareja] = useState<DatosPareja | null>(null);
    const [parejaUserId, setParejaUserId] = useState<string | null>(null);
    const [modalPareja, setModalPareja] = useState(false);

    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        Promise.all([
            supabaseService.getGroupsForAdmin(),
            supabaseService.getGroupCategories(),
            supabaseService.getGroupTags(),
        ]).then(([g, c, t]) => {
            setGroups(g);
            setCategories(c);
            setTags(t);
            setLoadingData(false);
        });
    }, []);

    const esGroupFinished = (group: Group) => {
        if (!group.endDate) return false;
        return group.endDate < new Date().toISOString().split('T')[0];
    };

    const esDeParejas = useCallback((group: Group) => {
        const cat = categories.find(c => c.id === group.categoryId);
        const porCategoria = cat?.name?.toLowerCase() === 'parejas';
        const porEtiqueta = group.tags?.some(id => tags.find(t => t.id === id)?.name?.toLowerCase() === 'parejas');
        return (porCategoria || !!porEtiqueta) && group.targetGender === 'Mixto';
    }, [categories, tags]);

    const activos = groups.filter(g => g.status === 'approved' && !esGroupFinished(g));
    const gq = gQuery.trim().toLowerCase();
    const listaGrupos = activos.filter(g => !gq
        || g.name.toLowerCase().includes(gq)
        || `${g.leaderName} ${g.leaderSurname}`.toLowerCase().includes(gq));

    const grupoElegido = groups.find(g => g.id === selectedGroupId) || null;
    const couplesMode = !!grupoElegido && esDeParejas(grupoElegido);

    // El buscador ya filtra por activos, pero un grupo fijado entra por la URL
    // y se saltea ese filtro: puede ser uno finalizado o todavía pendiente. Se
    // avisa y se bloquea, en vez de dejar anotar gente en un grupo que no corre.
    const fijadoInactivo = modoFijado && !!grupoElegido
        && (grupoElegido.status !== 'approved' || esGroupFinished(grupoElegido));

    useEffect(() => { onGrupo(grupoElegido); }, [grupoElegido, onGrupo]);

    // Si el grupo deja de ser de parejas, lo cargado del acompañante no
    // aplica: se suelta para no mandarlo sin querer.
    useEffect(() => {
        if (!couplesMode && pareja) {
            setPareja(null);
            setParejaUserId(null);
        }
    }, [couplesMode, pareja]);

    /**
     * `users` dejó de ser legible por cualquiera: la búsqueda pasa por la RPC,
     * que sólo responde a anfitriones y staff y además escapa los comodines
     * que rompían el `.or()` armado a mano. Mismos parámetros que el buscador
     * de co-anfitrión, para que las dos busquen igual.
     */
    useEffect(() => {
        if (modoPersona !== 'buscando' || pQuery.trim().length < 2) {
            setPResultados([]);
            return;
        }
        const timer = setTimeout(async () => {
            setBuscandoPersona(true);
            try {
                const { data } = await supabase.rpc('buscar_personas', {
                    p_termino: pQuery,
                    p_por_email: true,
                    p_solo_activos: true,
                    p_limite: 8,
                });
                setPResultados((data as PersonaEncontrada[]) || []);
            } catch {
                setPResultados([]);
            } finally {
                setBuscandoPersona(false);
            }
        }, 350);
        return () => clearTimeout(timer);
    }, [pQuery, modoPersona]);

    const elegirPersona = (p: PersonaEncontrada) => {
        setPersonaElegida(p);
        setFoundUserId(p.id);
        setNombreCompleto(p.name || '');
        // El teléfono puede faltar en la cuenta: se precarga si está y si no
        // queda vacío para completarlo, que es un dato obligatorio.
        setTelefono(p.phone || '');
        setEmail(p.email || '');
        setCuenta('found');
        setModoPersona('cuenta');
        setPaso(3);
    };

    const volverABuscar = () => {
        setModoPersona('buscando');
        setPersonaElegida(null);
        setFoundUserId(null);
        setNombreCompleto('');
        setTelefono('');
        setEmail('');
        setCuenta('idle');
        setPaso(2);
    };

    const cargarAMano = () => {
        setModoPersona('manual');
        setPersonaElegida(null);
        setFoundUserId(null);
        setCuenta('idle');
        setPaso(3);
    };

    const buscarCuentaTitular = async () => {
        if (!email || !email.includes('@')) return;
        setBuscandoCuenta(true);
        setCuenta('idle');
        const user = await supabaseService.getUserByEmail(email.trim());
        setBuscandoCuenta(false);
        if (user) {
            setCuenta('found');
            setFoundUserId(user.id);
            if (!nombreCompleto.trim()) setNombreCompleto(user.name || '');
            if (!telefono.trim() && user.phone) setTelefono(user.phone);
        } else {
            setCuenta('not-found');
            setFoundUserId(null);
        }
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!selectedGroupId) { setError('Elegí primero a qué grupo lo anotás.'); return; }
        if (fijadoInactivo) { setError('Este grupo no está activo: no se le puede anotar gente.'); return; }
        if (modoPersona === 'buscando') { setError('Buscá primero a la persona, o elegí cargarla a mano.'); return; }
        if (!nombreCompleto.trim()) { setError('Falta el nombre y apellido de la persona.'); return; }
        if (!telefono.trim()) { setError('Falta el teléfono de la persona.'); return; }
        if (couplesMode && !pareja) { setError('Este grupo es de parejas: cargá también al acompañante.'); return; }
        if (couplesMode && pareja?.email && email.trim()
            && pareja.email.toLowerCase().trim() === email.toLowerCase().trim()) {
            setError('El email del acompañante tiene que ser distinto al de la persona titular.');
            return;
        }

        // El apellido es todo lo que sigue al primer nombre, la misma regla
        // que usa la app cuando parte el nombre de una cuenta.
        const partes = nombreCompleto.trim().split(' ').filter(Boolean);
        const firstName = partes[0] || '';
        const lastName = partes.slice(1).join(' ');

        setIsSubmitting(true);
        const ok = await supabaseService.adminAddMemberToGroup({
            groupId: selectedGroupId,
            userId: foundUserId,
            firstName,
            lastName,
            email: email.trim(),
            phone: telefono.trim(),
            partnerData: couplesMode && pareja ? pareja : undefined,
            partnerUserId: couplesMode ? parejaUserId : undefined,
        });
        setIsSubmitting(false);

        if (ok) {
            showToast(couplesMode ? 'Pareja agregada al grupo' : 'Miembro agregado al grupo');
            navigate(`/admingcx/gestion-de-grupos/inscriptos/${selectedGroupId}`);
        } else {
            setError('Hubo un error al agregar. Intentá de nuevo.');
        }
    };

    if (loadingData) return (
        <div className="flex justify-center rounded-[20px] bg-white py-20">
            <Loader2 className="h-7 w-7 animate-spin text-black/20" />
        </div>
    );

    const rotulo = 'text-[10.5px] font-semibold uppercase tracking-[0.06em] text-black/[.58]';
    const campo = 'flex h-[58px] flex-col justify-center rounded-[18px] bg-[#f7f7f5] px-[17px]';
    const entrada = 'campo-desnudo w-full bg-transparent text-[14.5px] font-medium text-[#0a0a0a]';
    const numeroRiel = (actual: boolean, hecho: boolean) =>
        `flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full text-[11.5px] font-semibold ${actual
            ? 'bg-white text-[#0a0a0a]'
            : hecho
                ? 'bg-[#0a0a0a] text-white'
                : 'bg-[#eceae6] text-black/[.5]'}`;

    const numero = (activo: boolean) =>
        `flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full text-[12.5px] font-semibold ${activo ? 'bg-[#0a0a0a] text-white' : 'bg-[#eceae6] text-black/[.6]'}`;

    // Paso 1 — a qué grupo lo anota.
    const tarjetaGrupo = (
        <div className="min-w-0 rounded-[20px] bg-white px-[22px] py-5">
            <div className="flex items-center gap-2.5">
                <span className={numero(true)}>1</span>
                <p className="text-[16px] font-semibold text-[#0a0a0a]">
                    {modoFijado ? 'Se anota en este grupo' : '¿A qué grupo lo anotás?'}
                </p>
            </div>

            {modoFijado ? (
                /* Fijo: la tarjeta del grupo, sin lista y sin forma de
                   cambiarlo. Para anotar en otro se entra por el buscador,
                   que es una pantalla aparte. */
                <div className="mt-3.5 rounded-[18px] bg-[#f7f7f5] px-[15px] py-3.5">
                    {grupoElegido ? (
                        <>
                            <p className="text-[14px] font-semibold text-[#0a0a0a]">{grupoElegido.name}</p>
                            <p className="mt-[3px] text-[12px] font-medium text-black/[.62]">
                                {[
                                    categories.find(c => c.id === grupoElegido.categoryId)?.name,
                                    `${grupoElegido.meetingDay?.toLowerCase()} ${grupoElegido.meetingTime}`,
                                    `${esDeParejas(grupoElegido) ? (grupoElegido.registrations?.length || 0) * 2 : (grupoElegido.registrations?.length || 0)}/${grupoElegido.maxCapacity}`,
                                ].filter(Boolean).join(' · ')}
                            </p>
                            {esDeParejas(grupoElegido) && (
                                <span
                                    className="mt-2.5 inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold"
                                    style={{ background: '#fbeef4', color: ROSA }}
                                >
                                    De parejas
                                </span>
                            )}
                            {fijadoInactivo && (
                                <p className="mt-2.5 rounded-[12px] bg-[#fdecea] px-3 py-2 text-[12px] font-semibold leading-[1.5] text-[#a32218]">
                                    Este grupo no está activo. Aprobalo o reabrilo antes de anotarle gente.
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-[13px] font-medium text-black/[.55]">
                            {loadingData ? 'Buscando el grupo…' : 'No se encontró el grupo de la dirección.'}
                        </p>
                    )}
                </div>
            ) : (
            <>
            <div className="mt-3.5 flex h-[42px] items-center gap-2.5 rounded-full bg-[#f7f7f5] px-[17px]">
                <Search className="h-4 w-4 flex-none text-black/[.58]" />
                <input
                    type="text"
                    value={gQuery}
                    onChange={e => setGQuery(e.target.value)}
                    placeholder={`Buscar entre los ${activos.length} grupos`}
                    aria-label="Buscar el grupo"
                    className="campo-desnudo min-w-0 flex-1 bg-transparent text-[13.5px] font-medium text-[#0a0a0a]"
                />
            </div>

            <div className="mt-3 flex max-h-[290px] flex-col gap-[7px] overflow-auto">
                {listaGrupos.length === 0 && (
                    <p className="py-6 text-center text-[13px] font-medium text-black/[.55]">
                        {gq ? `Ningún grupo activo coincide con "${gQuery}"` : 'No hay grupos activos'}
                    </p>
                )}
                {listaGrupos.map(g => {
                    const elegido = g.id === selectedGroupId;
                    const cat = categories.find(c => c.id === g.categoryId);
                    const ocupados = esDeParejas(g) ? (g.registrations?.length || 0) * 2 : (g.registrations?.length || 0);
                    return (
                        <button
                            type="button"
                            key={g.id}
                            onClick={() => { setSelectedGroupId(g.id); setPaso(2); }}
                            aria-pressed={elegido}
                            className={`flex min-h-[58px] w-full items-center gap-2.5 rounded-[18px] px-[15px] py-[11px] text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${elegido ? 'bg-[#f0efec] shadow-[inset_0_0_0_1.5px_#0a0a0a]' : 'bg-[#fcfcfb] hover:bg-[#f7f7f5]'}`}
                        >
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13.5px] font-semibold text-[#0a0a0a]">{g.name}</span>
                                <span className="mt-[3px] block truncate text-[11.5px] font-medium text-black/[.62]">
                                    {[cat?.name, `${g.meetingDay?.toLowerCase()} ${g.meetingTime}`, `${ocupados}/${g.maxCapacity}`].filter(Boolean).join(' · ')}
                                </span>
                            </span>
                            {esDeParejas(g) && (
                                <span
                                    className="flex h-6 flex-none items-center whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold"
                                    style={{ background: '#fbeef4', color: ROSA }}
                                >
                                    De parejas
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            </>
            )}
        </div>
    );

    // Paso 2 — quién es: se busca antes de tipear nada.
    const tarjetaQuien = (
        <div className="min-w-0 rounded-[20px] bg-white px-[22px] py-5">
            <div className="flex items-center gap-2.5">
                <span className={numero(!!grupoElegido)}>2</span>
                <p className="text-[16px] font-semibold text-[#0a0a0a]">¿Quién es?</p>
            </div>

            {modoPersona === 'cuenta' && personaElegida ? (
                <div className="mt-3.5 rounded-[18px] bg-[#e9f6ed] px-[15px] py-3.5">
                    <div className="flex items-start gap-2.5">
                        <Check className="mt-[3px] h-4 w-4 flex-none text-[#15803d]" strokeWidth={2.6} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-semibold text-[#0a0a0a]">{personaElegida.name}</p>
                            <p className="mt-[3px] truncate text-[12px] font-medium text-black/[.62]">
                                {personaElegida.email || 'Sin email en la cuenta'}
                            </p>
                            <p className="mt-2 text-[12px] font-semibold leading-[1.5] text-[#15803d]">
                                Tiene cuenta: la inscripción queda vinculada y la va a ver desde su sesión.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={volverABuscar}
                            aria-label="Elegir otra persona"
                            className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-white/70 text-black/[.55] hover:text-[#0a0a0a]"
                        >
                            <X className="h-[13px] w-[13px]" />
                        </button>
                    </div>
                </div>
            ) : modoPersona === 'manual' ? (
                <div className="mt-3.5 rounded-[18px] bg-[#fdf0dc] px-[15px] py-3.5">
                    <p className="text-[13px] font-semibold text-[#7a4f10]">Se carga a mano</p>
                    <p className="mt-1 text-[12px] font-medium leading-[1.55] text-[#7a4f10]">
                        No tiene cuenta todavía. Cuando se registre con el mismo email, la inscripción se
                        vincula sola.
                    </p>
                    <button
                        type="button"
                        onClick={volverABuscar}
                        className="mt-2.5 text-[12.5px] font-semibold text-[#7a4f10] underline"
                    >
                        Volver a buscarla
                    </button>
                </div>
            ) : (
                <>
                    <p className="mt-2 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                        Buscala por nombre o email antes de cargarla. Si ya tiene cuenta, la inscripción
                        queda vinculada.
                    </p>

                    <div className="mt-3 flex h-[42px] items-center gap-2.5 rounded-full bg-[#f7f7f5] px-[17px]">
                        <Search className="h-4 w-4 flex-none text-black/[.58]" />
                        <input
                            type="text"
                            value={pQuery}
                            onChange={e => setPQuery(e.target.value)}
                            placeholder="Nombre o email de la persona"
                            aria-label="Buscar a la persona en el sistema"
                            className="campo-desnudo min-w-0 flex-1 bg-transparent text-[13.5px] font-medium text-[#0a0a0a]"
                        />
                        {buscandoPersona && <Loader2 className="h-4 w-4 flex-none animate-spin text-black/30" />}
                    </div>

                    <div className="mt-3 flex max-h-[250px] flex-col gap-[7px] overflow-auto">
                        {pQuery.trim().length < 2 ? (
                            <p className="py-4 text-center text-[12.5px] font-medium text-black/[.5]">
                                Escribí al menos dos letras.
                            </p>
                        ) : buscandoPersona ? null : pResultados.length === 0 ? (
                            <p className="py-4 text-center text-[12.5px] font-medium text-black/[.55]">
                                Nadie coincide con &quot;{pQuery}&quot;.
                            </p>
                        ) : (
                            pResultados.map(p => (
                                <button
                                    type="button"
                                    key={p.id}
                                    onClick={() => elegirPersona(p)}
                                    className="flex min-h-[54px] w-full items-center gap-2.5 rounded-[18px] bg-[#fcfcfb] px-[15px] py-[10px] text-left transition-colors hover:bg-[#f7f7f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[13.5px] font-semibold text-[#0a0a0a]">{p.name}</span>
                                        <span className="mt-[3px] block truncate text-[11.5px] font-medium text-black/[.62]">
                                            {[p.email, p.phone].filter(Boolean).join(' · ') || 'Sin email ni teléfono'}
                                        </span>
                                    </span>
                                </button>
                            ))
                        )}
                    </div>

                    {/* La salida está siempre a la vista, no escondida detrás
                        de una búsqueda sin resultados: hay gente que el admin
                        ya sabe que no tiene cuenta. */}
                    <button
                        type="button"
                        onClick={cargarAMano}
                        className="mt-1 flex h-[42px] w-full items-center justify-center gap-2 rounded-full bg-[#f2f2f0] text-[13px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        <UserPlus className="h-4 w-4" strokeWidth={2.2} />
                        No está en el sistema — cargar a mano
                    </button>
                </>
            )}
        </div>
    );

    // Paso 3 — sus datos, y el acompañante si el grupo es de parejas.
    const tarjetaDatos = (
        <div className="min-w-0 rounded-[20px] bg-white px-[22px] py-5">
            <div className="flex flex-wrap items-center gap-2.5">
                <span className={numero(modoPersona !== 'buscando')}>3</span>
                <p
                    className="min-w-[140px] flex-1 text-[16px] font-semibold"
                    style={{ color: modoPersona !== 'buscando' ? '#0a0a0a' : 'rgba(0,0,0,.6)' }}
                >
                    Datos de la persona
                </p>
                {couplesMode && (
                    <span
                        className="flex h-[26px] flex-none items-center rounded-full px-[11px] text-[11.5px] font-semibold"
                        style={{ background: '#fbeef4', color: ROSA }}
                    >
                        Grupo de parejas
                    </span>
                )}
            </div>

            {modoPersona === 'buscando' && (
                <p className="mt-3.5 text-[13px] font-medium leading-[1.6] text-black/[.62]">
                    Primero buscá a la persona en el paso 2. Si ya tiene cuenta, estos campos se completan
                    solos con sus datos.
                </p>
            )}

            <div className="mt-4">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58]">
                    Titular de la inscripción
                </p>
                <div className="grid gap-[9px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
                    <div className={campo}>
                        <label htmlFor="nombre" className={rotulo}>Nombre y apellido</label>
                        <input
                            id="nombre"
                            type="text"
                            value={nombreCompleto}
                            onChange={e => setNombreCompleto(e.target.value)}
                            placeholder="Ej. Marcela Godoy"
                            className={entrada}
                        />
                    </div>
                    <div className={campo}>
                        <label htmlFor="telefono" className={rotulo}>Teléfono</label>
                        <input
                            id="telefono"
                            type="tel"
                            value={telefono}
                            onChange={e => setTelefono(e.target.value)}
                            placeholder="11 5533 1200"
                            className={entrada}
                        />
                    </div>
                    <div className={campo}>
                        <label htmlFor="email" className={rotulo}>Email</label>
                        <div className="flex items-center gap-2">
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={e => { setEmail(e.target.value); setCuenta('idle'); setFoundUserId(null); }}
                                /* Con una cuenta vinculada el email es lo que la
                                   identifica: editarlo dejaría la inscripción
                                   apuntando a un usuario con otro mail. Para
                                   cambiarlo se suelta la cuenta y se busca de nuevo. */
                                readOnly={modoPersona === 'cuenta'}
                                onBlur={modoPersona === 'cuenta' ? undefined : buscarCuentaTitular}
                                placeholder="Opcional"
                                className={entrada}
                            />
                            {buscandoCuenta && <Loader2 className="h-4 w-4 flex-none animate-spin text-black/30" />}
                        </div>
                    </div>
                </div>

                {cuenta !== 'idle' && (
                    <p
                        className="mt-2.5 flex items-center gap-2 rounded-[14px] px-3 py-2 text-[12.5px] font-semibold"
                        style={cuenta === 'found'
                            ? { background: '#e9f6ed', color: '#15803d' }
                            : { background: '#fdf0dc', color: '#7a4f10' }}
                    >
                        {cuenta === 'found' && <Check className="h-3.5 w-3.5" strokeWidth={2.6} />}
                        {cuenta === 'found'
                            ? 'Ya tiene cuenta: la inscripción queda vinculada a ella.'
                            : 'No hay cuenta con ese email. Se carga a mano y se vincula sola cuando se registre.'}
                    </p>
                )}
            </div>

            {/* Acompañante — siempre a la vista */}
            <div
                className="mt-[18px] rounded-[20px] px-[18px] py-4"
                style={couplesMode
                    ? { background: '#fdf4f8', boxShadow: 'inset 0 0 0 1.5px #f3d3e2' }
                    : { background: '#fbfbfa', boxShadow: 'inset 0 0 0 1.5px #f0efec' }}
            >
                <div className="flex items-center gap-2.5">
                    <p
                        className="flex-1 text-[11px] font-semibold uppercase tracking-[0.07em]"
                        style={{ color: couplesMode ? ROSA : 'rgba(0,0,0,.58)' }}
                    >
                        Acompañante
                    </p>
                    <span
                        className="flex h-6 flex-none items-center rounded-full px-2.5 text-[11px] font-semibold"
                        style={couplesMode
                            ? { background: '#fff', color: ROSA }
                            : { background: '#f2f2f0', color: 'rgba(0,0,0,.6)' }}
                    >
                        {couplesMode ? 'Obligatorio' : 'No se pide'}
                    </span>
                </div>

                {couplesMode ? (
                    <>
                        <div className="mt-3 grid gap-[9px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
                            <div className="flex h-[58px] flex-col justify-center rounded-[18px] bg-white px-[17px]">
                                <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: ROSA }}>
                                    Nombre del acompañante
                                </span>
                                <span className="truncate text-[14.5px] font-medium" style={{ color: pareja ? '#0a0a0a' : 'rgba(0,0,0,.45)' }}>
                                    {pareja ? `${pareja.firstName} ${pareja.lastName}`.trim() : 'Todavía sin cargar'}
                                </span>
                            </div>
                            <div className="flex h-[58px] flex-col justify-center rounded-[18px] bg-white px-[17px]">
                                <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em]" style={{ color: ROSA }}>
                                    Email y teléfono
                                </span>
                                <span className="truncate text-[14.5px] font-medium" style={{ color: pareja ? '#0a0a0a' : 'rgba(0,0,0,.45)' }}>
                                    {pareja
                                        ? [pareja.email || 'sin email', pareja.phone].filter(Boolean).join(' · ')
                                        : 'Se completan en el paso siguiente'}
                                </span>
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2.5">
                            <button
                                type="button"
                                onClick={() => setModalPareja(true)}
                                className="h-[42px] rounded-full px-[18px] text-[13.5px] font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                style={{ background: '#fbeef4', color: ROSA }}
                            >
                                {pareja ? 'Editar el acompañante' : 'Buscar si ya tiene cuenta'}
                            </button>
                            {pareja && parejaUserId && (
                                <span className="flex h-6 items-center rounded-full bg-[#e9f6ed] px-2.5 text-[11px] font-semibold text-[#15803d]">
                                    Vinculada a su cuenta
                                </span>
                            )}
                        </div>
                    </>
                ) : (
                    <p className="mt-2.5 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                        {grupoElegido
                            ? 'Este grupo no es de parejas, así que el bloque queda inactivo. Si después cambia, se habilita acá mismo.'
                            : 'El bloque está siempre a la vista: se habilita si el grupo que elegís es de parejas, así el formulario no cambia de forma.'}
                    </p>
                )}
            </div>

            {error && (
                <div className="mt-3.5 rounded-[14px] bg-[#fdecea] px-3 py-2.5 text-[12.5px] font-semibold text-[#a32218]">
                    {error}
                </div>
            )}

            <p className="mt-3.5 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                {couplesMode
                    ? 'Los dos quedan como miembros aprobados y ocupan un lugar de pareja, que son dos personas.'
                    : 'La persona queda como miembro aprobado, sin pasar por la lista de solicitudes.'}
            </p>

            <div className="mt-[18px] flex flex-wrap gap-2.5">
                <button
                    type="submit"
                    disabled={!selectedGroupId || isSubmitting}
                    className="h-12 min-w-[180px] flex-1 rounded-full text-[14.5px] font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    style={selectedGroupId
                        ? { background: '#0a0a0a', color: '#fff' }
                        : { background: '#eceae6', color: 'rgba(0,0,0,.5)' }}
                >
                    {isSubmitting
                        ? 'Guardando…'
                        : !selectedGroupId
                            ? 'Elegí un grupo primero'
                            : couplesMode ? 'Agregar la pareja al grupo' : 'Agregar al grupo'}
                </button>
                <button
                    type="button"
                    onClick={() => setPaso(2)}
                    className="h-12 rounded-full bg-[#f2f2f0] px-5 text-[14.5px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    Atrás
                </button>
            </div>
        </div>
    );

    // ── El riel de pasos ────────────────────────────────────────────────
    // Cada paso ya resuelto muestra LA DECISIÓN, no un número: "Grupo /
    // Buenas Bases". Así el indicador de progreso es también el resumen de lo
    // elegido y la forma de volver a cambiarlo, en vez de tres círculos que
    // sólo dicen cuántos faltan.
    const PASOS: Array<{ n: 1 | 2 | 3; titulo: string; valor: string | null }> = [
        { n: 1, titulo: 'Grupo', valor: grupoElegido ? grupoElegido.name : null },
        {
            n: 2,
            titulo: 'Quién es',
            valor: modoPersona === 'cuenta' && personaElegida
                ? personaElegida.name
                : modoPersona === 'manual' ? 'Se carga a mano' : null,
        },
        { n: 3, titulo: 'Datos', valor: null },
    ];

    // Al paso 1 no se vuelve si el grupo vino fijado por la URL: no hay nada
    // que elegir ahí.
    const puedeIr = (n: 1 | 2 | 3) => {
        if (n === 1) return !modoFijado;
        if (n === 2) return !!grupoElegido;
        return !!grupoElegido && modoPersona !== 'buscando';
    };

    const riel = (
        <div className="min-w-0 rounded-[20px] bg-white px-4 py-3">
            <div className="flex items-center gap-2.5">

                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    {PASOS.map(({ n, titulo, valor }, i) => {
                        const actual = paso === n;
                        const hecho = paso > n && !!valor;
                        const habilitado = puedeIr(n) && !actual;
                        return (
                            <React.Fragment key={n}>
                                {i > 0 && (
                                    /* El tramo se tiñe cuando el paso anterior
                                       quedó resuelto, así el avance se lee en el
                                       riel mismo y no sólo en qué píldora está
                                       encendida. Es flexible para que los tres
                                       pasos formen un recorrido y no tres islas. */
                                    <span
                                        aria-hidden="true"
                                        className="h-[2px] min-w-[8px] flex-1 rounded-full transition-colors"
                                        style={{ background: paso >= n ? '#0a0a0a' : '#eceae6' }}
                                    />
                                )}
                                <button
                                    type="button"
                                    onClick={() => habilitado && setPaso(n)}
                                    disabled={!habilitado}
                                    aria-current={actual ? 'step' : undefined}
                                    /* Los tres comparten forma y fondo: lo único
                                       que cambia es el relleno. Antes el activo era
                                       una píldora sólida y los otros dos flotaban
                                       sin contenedor, y se veían desprendidos. */
                                    className={`flex min-w-0 flex-none items-center gap-2 rounded-full py-1.5 pl-1.5 pr-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 sm:pr-3.5 ${actual
                                        ? 'bg-[#0a0a0a]'
                                        : habilitado
                                            ? 'bg-[#f7f7f5] hover:bg-[#f2f2f0]'
                                            : 'bg-[#f7f7f5]'}`}
                                >
                                    <span className={numeroRiel(actual, hecho)}>
                                        {hecho ? <Check className="h-3 w-3" strokeWidth={3} /> : n}
                                    </span>
                                    {/* En pantallas angostas los pasos que no son
                                        el actual quedan con el número solo: tres
                                        etiquetas más "Cancelar" no entran. */}
                                    <span className={`min-w-0 ${actual ? 'block' : 'hidden sm:block'}`}>
                                        <span
                                            className="block truncate text-[12px] font-semibold leading-tight"
                                            style={{ color: actual ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.5)' }}
                                        >
                                            {titulo}
                                        </span>
                                        {valor && (
                                            <span
                                                className="mt-[1px] block max-w-[150px] truncate text-[12.5px] font-semibold leading-tight"
                                                style={{ color: actual ? '#fff' : '#0a0a0a' }}
                                            >
                                                {valor}
                                            </span>
                                        )}
                                    </span>
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Cancelar no es un paso más: la línea lo saca de la secuencia,
                    y el cuerpo más chico y apagado lo baja de jerarquía. */}
                <span aria-hidden="true" className="h-5 w-px flex-none bg-[#eceae6]" />
                <button
                    type="button"
                    onClick={() => navigate(selectedGroupId
                        ? `/admingcx/gestion-de-grupos/inscriptos/${selectedGroupId}`
                        : '/admingcx/gestion-de-grupos')}
                    className="h-8 flex-none rounded-full px-3 text-[12.5px] font-semibold text-black/[.5] transition-colors hover:bg-[#f7f7f5] hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );

    return (
        <form onSubmit={guardar} className="mx-auto flex w-full max-w-[720px] flex-col gap-3.5">

            {riel}

            {/* Un paso por vez. La `key` remonta el bloque al cambiar de paso,
                que es lo que dispara la única animación de la pantalla: una
                entrada corta que muestra QUÉ cambió. Los campos son
                controlados, así que remontar no pierde nada de lo escrito. */}
            <div key={paso} className="animate-fadeIn motion-reduce:animate-none">
                {paso === 1 && tarjetaGrupo}
                {paso === 2 && tarjetaQuien}
                {paso === 3 && tarjetaDatos}
            </div>

            <ModalParejaInscripcion
                isOpen={modalPareja}
                onClose={() => setModalPareja(false)}
                titular={nombreCompleto.trim() || 'la persona titular'}
                inicial={pareja ? { datos: pareja, userId: parejaUserId } : undefined}
                onGuardar={(datos, userId) => {
                    setPareja(datos);
                    setParejaUserId(userId);
                    setModalPareja(false);
                }}
            />
        </form>
    );
};

const AgregarMiembroGrupo: React.FC = () => {
    const [grupo, setGrupo] = useState<Group | null>(null);
    const recibirGrupo = useCallback((g: Group | null) => setGrupo(g), []);
    const grupoFijado = useGrupoFijado();

    return (
        <AdminGCXLayout
            title={grupo ? grupo.name : 'Agregar a mano'}
            backTo="/admingcx/gestion-de-grupos"
            backLabel="Grupos"
            subtitle=""
            /* Sin grupo fijado no hay pestañas: esta es la pantalla suelta del
               buscador, y "Ficha" e "Inscriptos" no tendrían de qué colgar. */
            tabs={grupoFijado ? (
                <PestanasGrupoAdmin
                    activa="agregar"
                    groupId={grupoFijado}
                    nInscriptos={grupo?.registrations?.length}
                    pendiente={esGrupoPendiente(grupo)}
                />
            ) : undefined}
        >
            <AgregarMiembroGrupoContent onGrupo={recibirGrupo} grupoFijado={grupoFijado} />
        </AdminGCXLayout>
    );
};

export default AgregarMiembroGrupo;

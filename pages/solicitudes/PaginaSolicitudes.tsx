import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, ClipboardList, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { guardarDestino } from '../../components/auth/SinAcceso';
import {
    crearSolicitud, getDepartamentosParaSolicitar, mensajeDeMotivo, nuevoId,
    type DepartamentoParaSolicitar, type Falla, type MotivoAgenda,
} from '../../services/agenda';
import { Avatar, IconoDeDepartamento, Cargando, ErrorDeCampo, RotuloPaso, tinte } from '../admin/departamentos/piezas';
import {
    BOTON_GRIS, BOTON_NEGRO, ChipColor, ESTILOS, Hoja, ID_AGENDA, Mensaje, Punto, ROTULO,
} from '../departamentos/equipo/piezas';

/**
 * /solicitudes — pedirle una tarea a un departamento
 * (design-claude/Solicitudes.dc.html).
 *
 * Es PÚBLICA como /voluntarios: sin sesión no redirige, muestra la tarjeta
 * para entrar y después del login vuelve acá. Volver se hace por los dos
 * caminos que existen, porque cubren casos distintos: `guardarDestino` deja
 * el destino en sessionStorage, que es lo único que sobrevive al redirect
 * completo de Google; el `state.from` del navigate cubre email y contraseña,
 * donde no hay recarga.
 *
 * El id de la solicitud se genera UNA vez por formulario: un doble toque o un
 * reintento devuelven la misma solicitud, no dos (agenda_crear_solicitud es
 * idempotente por id). "Hacer otra solicitud" genera uno nuevo.
 *
 * La prioridad es del DEPARTAMENTO: aparece recién cuando hay uno elegido,
 * con las suyas, y se reinicia si se cambia de departamento. Un departamento
 * sin prioridades no la pide (la base acepta NULL sólo en ese caso).
 */

const RUTA = '/solicitudes';
const MINIMO = 10;
const MAXIMO = 2000;
/** Desde cuántas letras libres se avisa cuánto queda. */
const AVISO = 300;

type Carga =
    | { estado: 'cargando' }
    | { estado: 'error'; motivo: MotivoAgenda }
    | { estado: 'listo'; departamentos: DepartamentoParaSolicitar[] };

const TARJETA = 'rounded-[28px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)]';

const PaginaSolicitudes: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isLoadingSession, isLoadingProfile } = useAuth();

    const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
    const [id, setId] = useState(nuevoId);
    const [depId, setDepId] = useState<string | null>(null);
    const [prioridadId, setPrioridadId] = useState<string | null>(null);
    const [detalles, setDetalles] = useState('');
    const [tocado, setTocado] = useState(false);
    const [confirmando, setConfirmando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** Mandada: el nombre del departamento al que llegó. */
    const [enviadaA, setEnviadaA] = useState<string | null>(null);

    const enviandoRef = useRef(false);
    const campoDetalles = useRef<HTMLTextAreaElement>(null);
    const cargandoSesion = isLoadingSession || isLoadingProfile;

    // ── La vuelta del login ─────────────────────────────────────────────
    //
    // Si la marca quedó colgada —se entró directo con la sesión puesta, o el
    // destino ya se consumió— se limpia: dejarla haría que un login posterior
    // desde otra pantalla termine acá sin que nadie lo pidiera.
    useEffect(() => {
        if (!user) return;
        try {
            if (sessionStorage.getItem('post_login_redirect') === RUTA) {
                sessionStorage.removeItem('post_login_redirect');
            }
        } catch { /* sin storage */ }
    }, [user]);

    const irAEntrar = () => {
        guardarDestino({ pathname: RUTA, search: location.search });
        navigate('/auth', { state: { from: { pathname: RUTA, search: location.search } } });
    };

    const pedirDepartamentos = useCallback(async () => {
        setCarga({ estado: 'cargando' });
        const r = await getDepartamentosParaSolicitar();
        // Un fallo no es "no hay departamentos" (instrucciones 7.9).
        setCarga(r.ok ? { estado: 'listo', departamentos: r.departamentos } : { estado: 'error', motivo: r.motivo });
    }, []);

    useEffect(() => { if (user) pedirDepartamentos(); }, [user, pedirDepartamentos]);

    const departamentos = carga.estado === 'listo' ? carga.departamentos : [];
    const elegido = departamentos.find(d => d.id === depId) ?? null;
    const prioridades = elegido?.prioridades ?? [];
    const prioridad = prioridades.find(p => p.id === prioridadId) ?? null;

    const limpio = detalles.trim();
    const sinDepartamento = !elegido;
    const faltaPrioridad = prioridades.length > 0 && !prioridadId;
    const muyCorto = limpio.length < MINIMO;
    const invalido = sinDepartamento || faltaPrioridad || muyCorto;

    const queFalta = sinDepartamento ? 'Falta elegir a qué departamento va.'
        : faltaPrioridad ? 'Falta elegir la prioridad.'
            : muyCorto ? `Falta contar qué necesitás: al menos ${MINIMO} letras.` : null;

    const elegirDepartamento = (d: DepartamentoParaSolicitar) => {
        setDepId(d.id);
        // Las prioridades son de cada departamento: al cambiar, se reinicia.
        setPrioridadId(null);
        setError(null);
    };

    const volver = () => {
        // react-router deja su índice en el history: en 0 es la primera
        // pantalla de la pestaña y no hay a dónde volver.
        const indice = (window.history.state as { idx?: number } | null)?.idx;
        const hayDonde = typeof indice === 'number' ? indice > 0 : window.history.length > 1;
        if (hayDonde) navigate(-1); else navigate('/');
    };

    const confirmar = () => {
        if (invalido) {
            setTocado(true);
            if (!sinDepartamento && !faltaPrioridad && muyCorto) campoDetalles.current?.focus();
            return;
        }
        setConfirmando(true);
    };

    const enviar = async () => {
        if (enviandoRef.current || !elegido) return;
        enviandoRef.current = true;
        setEnviando(true);
        setError(null);
        const r = await crearSolicitud({
            id, departamentoId: elegido.id, prioridadId: prioridadId ?? null, detalles,
        });
        enviandoRef.current = false;
        setEnviando(false);
        if (!r.ok) {
            // El formulario queda como estaba: lo escrito no se pierde.
            // El cast es el de siempre en este proyecto: sin strictNullChecks,
            // `!r.ok` no angosta la union (ver services/agenda.ts).
            setError(mensajeDeMotivo(r.motivo, r as Falla));
            setConfirmando(false);
            return;
        }
        setConfirmando(false);
        setEnviadaA(elegido.nombre);
    };

    const otraSolicitud = () => {
        setEnviadaA(null);
        setId(nuevoId());
        setDepId(null);
        setPrioridadId(null);
        setDetalles('');
        setTocado(false);
        setError(null);
    };

    const nombre = (user?.name || '').trim();
    const persona = useMemo(() => ({ nombre: nombre || null, avatarUrl: user?.avatarUrl ?? null }), [nombre, user?.avatarUrl]);

    return (
        <div id={ID_AGENDA} className="min-h-screen bg-[#f6f6f4]">
            <style>{ESTILOS}</style>
            <div className="mx-auto max-w-[620px] px-4 pb-12 pt-6 md:pb-16 md:pt-9">

                {/* ── Sin sesión ─────────────────────────────────────── */}
                {!cargandoSesion && !user && (
                    <div className={`${TARJETA} mt-6 flex flex-col items-center px-6 py-8 text-center md:py-10`}>
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#f2f2f0] text-black/[.62]" aria-hidden="true">
                            <Lock size={28} strokeWidth={1.75} />
                        </span>
                        <h1 className="m-0 mt-[18px] max-w-[340px] text-[21px] font-bold leading-[1.3] tracking-[-0.01em]">
                            Para pedir una tarea tenés que iniciar sesión
                        </h1>
                        <p className="m-0 mt-2.5 max-w-[380px] text-[14.5px] font-medium leading-[1.6] text-black/[.62]">
                            Así el equipo sabe quién la pidió. Después de entrar volvés directo a este formulario.
                        </p>
                        <div className="mt-[22px] flex w-full max-w-[340px] flex-col gap-2">
                            <button type="button" onClick={irAEntrar} className={BOTON_NEGRO}>
                                Iniciar sesión
                            </button>
                            <button type="button" onClick={irAEntrar} className={BOTON_GRIS}>
                                Crear cuenta
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Volviendo del login ────────────────────────────── */}
                {cargandoSesion && (
                    <div aria-busy="true" aria-label="Volviendo a tu solicitud" className="mt-2">
                        <p className="m-0 mb-4 text-[13.5px] font-semibold text-black/[.55]">Volviendo a tu solicitud…</p>
                        <div className={`${TARJETA} flex flex-col gap-3.5 p-6`}>
                            <div className="h-11 w-11 rounded-full bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_infinite]" />
                            <div className="h-[84px] rounded-[20px] bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_.1s_infinite]" />
                            <div className="h-[120px] rounded-[20px] bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_.2s_infinite]" />
                        </div>
                    </div>
                )}

                {/* ── Enviada ────────────────────────────────────────── */}
                {!cargandoSesion && user && enviadaA && (
                    <div className={`${TARJETA} mt-6 flex flex-col items-center px-6 py-10 text-center`}>
                        <span
                            className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#16a34a] text-white motion-safe:animate-[depCheck_.5s_ease_both]"
                            aria-hidden="true"
                        >
                            <Check size={40} strokeWidth={2.6} />
                        </span>
                        <h1 className="m-0 mt-[22px] text-[23px] font-bold leading-[1.25] tracking-[-0.015em]">
                            ¡Listo! Tu solicitud llegó a {enviadaA}
                        </h1>
                        {/* Sin promesas de email: a quien pide le llega sólo la notificación en la app. */}
                        <p className="m-0 mt-2.5 max-w-[380px] text-[14.5px] font-medium leading-[1.6] text-black/[.62]">
                            Los encargados la van a revisar y te avisamos en tus notificaciones cuando lo hagan. Mientras tanto, podés pedir otra cosa.
                        </p>
                        <div className="mt-6 flex w-full max-w-[320px] flex-col gap-2">
                            <button type="button" onClick={otraSolicitud} className={BOTON_NEGRO}>Hacer otra solicitud</button>
                            <button type="button" onClick={() => navigate('/')} className={BOTON_GRIS}>Volver al inicio</button>
                        </div>
                    </div>
                )}

                {/* ── El formulario ──────────────────────────────────── */}
                {!cargandoSesion && user && !enviadaA && (
                    <>
                        <p className={ROTULO}>Solicitudes</p>
                        <h1 className="m-0 mt-1 text-[26px] font-bold tracking-[-0.025em] md:text-[32px]">Hacer una solicitud</h1>
                        <p className="m-0 mt-2 text-[14.5px] font-medium leading-[1.55] text-black/[.62]">
                            Contale a un departamento qué necesitás. Los encargados la revisan y la aceptan o la rechazan.
                        </p>

                        {carga.estado === 'cargando' && (
                            <div aria-busy="true" aria-label="Cargando los departamentos" className={`${TARJETA} mt-5 flex flex-col gap-3.5 p-6`}>
                                <div className="h-[72px] rounded-[20px] bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_infinite]" />
                                <div className="h-[72px] rounded-[20px] bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_.1s_infinite]" />
                                <div className="h-[120px] rounded-[20px] bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_.2s_infinite]" />
                            </div>
                        )}

                        {carga.estado === 'error' && (
                            <Mensaje titulo="No pudimos cargar los departamentos" texto="Puede ser la conexión. Probá de nuevo en un momento.">
                                <button type="button" onClick={pedirDepartamentos} className={`${BOTON_NEGRO} mt-5`}>Reintentar</button>
                            </Mensaje>
                        )}

                        {carga.estado === 'listo' && departamentos.length === 0 && (
                            <Mensaje
                                icono={<ClipboardList size={26} strokeWidth={1.75} />}
                                titulo="Todavía no hay áreas que reciban solicitudes"
                                texto="Cuando Sistemas cargue los departamentos de Agenda Origen, vas a poder pedirles una tarea desde acá."
                            >
                                <button type="button" onClick={() => navigate('/')} className={`${BOTON_NEGRO} mt-5`}>Ir al inicio</button>
                            </Mensaje>
                        )}

                        {carga.estado === 'listo' && departamentos.length > 0 && (
                            <div className={`${TARJETA} mt-5 flex flex-col gap-6 p-5 md:p-7`}>

                                {/* Solicitante */}
                                <div className="flex flex-col gap-2.5">
                                    <RotuloPaso>Solicitante</RotuloPaso>
                                    <div className="flex items-center gap-3 rounded-[18px] bg-[#f6f6f4] px-3.5 py-2.5">
                                        <Avatar persona={persona} color="#7c3aed" tam={42} />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-[15px] font-bold">{nombre || 'Tu cuenta'}</span>
                                            <span className="block truncate text-[12.5px] font-medium text-black/[.55]">
                                                Desde tu cuenta · {user.email}
                                            </span>
                                        </span>
                                        <Lock size={16} strokeWidth={2} aria-label="Sale de tu cuenta: no se edita acá" className="flex-none text-black/[.38]" />
                                    </div>
                                </div>

                                {/* Departamento */}
                                <div className="flex flex-col gap-2.5">
                                    <RotuloPaso id="sol-rotulo-dep">¿A qué departamento?</RotuloPaso>
                                    <div role="radiogroup" aria-labelledby="sol-rotulo-dep" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        {departamentos.map(d => {
                                            const on = depId === d.id;
                                            return (
                                                <button
                                                    key={d.id}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={on}
                                                    onClick={() => elegirDepartamento(d)}
                                                    className="flex min-h-[64px] items-center gap-3 rounded-[20px] bg-[#f6f6f4] px-3 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                                    style={{
                                                        boxShadow: on
                                                            ? `inset 0 0 0 2px ${d.color}`
                                                            : tocado && sinDepartamento
                                                                ? 'inset 0 0 0 2px #b42318'
                                                                : 'inset 0 0 0 1px rgba(0,0,0,.06)',
                                                    }}
                                                >
                                                    <span
                                                        className="flex h-10 w-10 flex-none items-center justify-center rounded-full"
                                                        style={{ background: tinte(d.color), color: d.color }}
                                                    >
                                                        <IconoDeDepartamento clave={d.icono} tam={20} />
                                                    </span>
                                                    <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{d.nombre}</span>
                                                    {on && <Check size={18} strokeWidth={2.6} aria-hidden="true" className="flex-none" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {tocado && sinDepartamento && (
                                        <ErrorDeCampo id="sol-error-dep">Elegí a qué departamento va la solicitud.</ErrorDeCampo>
                                    )}
                                </div>

                                {/* Prioridad: recién cuando hay departamento, y con las suyas */}
                                {elegido && (
                                    <div className="flex flex-col gap-2.5">
                                        <RotuloPaso id="sol-rotulo-prio">Prioridad</RotuloPaso>
                                        {prioridades.length === 0 ? (
                                            <p className="m-0 rounded-2xl bg-[#f6f6f4] px-3.5 py-3 text-[13.5px] font-semibold leading-[1.5] text-black/[.62]">
                                                {elegido.nombre} todavía no definió prioridades. Tu solicitud llega sin prioridad y la ordenan ellos.
                                            </p>
                                        ) : (
                                            <>
                                                <div
                                                    role="radiogroup"
                                                    aria-labelledby="sol-rotulo-prio"
                                                    className="flex flex-wrap gap-1.5 rounded-[20px]"
                                                    style={tocado && faltaPrioridad
                                                        ? { padding: 6, boxShadow: 'inset 0 0 0 2px #b42318' }
                                                        : undefined}
                                                >
                                                    {prioridades.map(p => {
                                                        const on = prioridadId === p.id;
                                                        return (
                                                            <button
                                                                key={p.id}
                                                                type="button"
                                                                role="radio"
                                                                aria-checked={on}
                                                                onClick={() => setPrioridadId(p.id)}
                                                                className={`flex min-h-[44px] items-center gap-2 rounded-full px-3.5 text-[13.5px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${on ? 'text-[#0a0a0a]' : 'bg-[#f2f2f0] text-black/[.62]'}`}
                                                                style={on ? { background: tinte(p.color, '24'), boxShadow: `inset 0 0 0 2px ${p.color}` } : undefined}
                                                            >
                                                                <Punto color={p.color} tam={9} />
                                                                {p.nombre}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <span className="text-[12.5px] font-semibold text-black/[.58]">
                                                    Son las prioridades que usa {elegido.nombre}.
                                                </span>
                                                {tocado && faltaPrioridad && (
                                                    <ErrorDeCampo id="sol-error-prio">Elegí una prioridad.</ErrorDeCampo>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Detalles */}
                                <label className="flex flex-col gap-2.5">
                                    <RotuloPaso>Detalles de la solicitud</RotuloPaso>
                                    <textarea
                                        ref={campoDetalles}
                                        value={detalles}
                                        onChange={e => { setDetalles(e.target.value); setError(null); }}
                                        maxLength={MAXIMO}
                                        rows={6}
                                        placeholder="Qué necesitás, para cuándo y cualquier dato útil"
                                        aria-invalid={tocado && muyCorto}
                                        aria-describedby={tocado && muyCorto ? 'sol-error-det' : undefined}
                                        className="min-h-[150px] w-full resize-y px-4 py-3.5 text-[15px] font-medium leading-[1.55]"
                                        style={tocado && muyCorto ? ({ '--ag-borde': '#b42318' } as React.CSSProperties) : undefined}
                                    />
                                    {tocado && muyCorto && (
                                        <ErrorDeCampo id="sol-error-det">Contanos un poco más: al menos {MINIMO} letras.</ErrorDeCampo>
                                    )}
                                    {MAXIMO - detalles.length <= AVISO && (
                                        <span className="text-[12px] font-semibold text-black/[.58]">
                                            Quedan {MAXIMO - detalles.length} letras
                                        </span>
                                    )}
                                </label>

                                {error && <p role="alert" className="m-0 text-[13px] font-bold text-[#b42318]">{error}</p>}

                                <div className="flex flex-col gap-2 pt-1">
                                    {/* El botón se ve apagado pero responde: al tocarlo marca
                                        lo que falta, y lo que falta se dice acá (7.15). */}
                                    <p id="sol-falta" role="status" className="m-0 text-[12.5px] font-semibold text-black/[.62] empty:hidden">
                                        {invalido ? queFalta : ''}
                                    </p>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={volver} className={`${BOTON_GRIS} flex-1`}>Volver</button>
                                        <button
                                            type="button"
                                            onClick={confirmar}
                                            aria-describedby={invalido ? 'sol-falta' : undefined}
                                            className={`${BOTON_NEGRO} flex-[1.4] ${invalido ? 'opacity-[.32]' : ''}`}
                                        >
                                            Confirmar solicitud
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ── Antes de enviar ────────────────────────────────────── */}
            {confirmando && elegido && (
                <Hoja
                    titulo="Antes de enviar"
                    subtitulo={`Tu solicitud va a llegar a los encargados de ${elegido.nombre}. Ellos la van a revisar y aceptarla o rechazarla.`}
                    onCerrar={() => { if (!enviando) setConfirmando(false); }}
                    ocupada={enviando}
                    ancho={520}
                    pie={(
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmando(false)}
                                disabled={enviando}
                                className={`${BOTON_GRIS} flex-1`}
                            >
                                Volver a editar
                            </button>
                            <button type="button" onClick={enviar} className={`${BOTON_NEGRO} flex-1`}>
                                {enviando && <Cargando />}
                                {enviando ? 'Enviando…' : 'Enviar solicitud'}
                            </button>
                        </div>
                    )}
                >
                    <div className="flex flex-col gap-3.5 rounded-[20px] bg-[#f6f6f4] p-4">
                        <div className="flex items-center gap-3">
                            <span
                                className="flex h-10 w-10 flex-none items-center justify-center rounded-full"
                                style={{ background: tinte(elegido.color), color: elegido.color }}
                            >
                                <IconoDeDepartamento clave={elegido.icono} tam={18} grosor={1.9} />
                            </span>
                            <span className="min-w-0 flex-1">
                                <RotuloPaso>Departamento</RotuloPaso>
                                <span className="mt-0.5 block truncate text-[15px] font-bold">{elegido.nombre}</span>
                            </span>
                        </div>
                        <div>
                            <RotuloPaso>Prioridad</RotuloPaso>
                            <span className="mt-1.5 block">
                                <ChipColor color={prioridad?.color ?? 'rgba(0,0,0,.4)'}>
                                    {prioridad?.nombre ?? 'Sin prioridad'}
                                </ChipColor>
                            </span>
                        </div>
                        <div>
                            <RotuloPaso>Detalles</RotuloPaso>
                            <p className="m-0 mt-1.5 whitespace-pre-line text-[14.5px] font-medium leading-[1.6] text-black/[.8]">
                                {limpio}
                            </p>
                        </div>
                    </div>
                </Hoja>
            )}
        </div>
    );
};

export default PaginaSolicitudes;

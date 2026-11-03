import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { guardarDestino } from '../../components/auth/SinAcceso';
import {
    diaYMes, diaYMesLargo, getMisGruposTestimonios, getTemporadaTestimonios, LIMITE_TEXTO, AVISO_TEXTO,
    mensajeDeMotivo, publicarTestimonio, type Falla, type MiGrupo, type Temporada,
} from '../../services/testimonios';
import {
    C, Cara, esqueleto, FilaAnfitrion, fondoDePortada, HojaModal, IconoCalendarioCerrado, IconoPersonas,
    IconoReloj, IconoSinConexion, IconoTilde, ESTILOS, ID_TESTIMONIOS, LogoGoogle, PantallaAviso, PASTELES,
    ROTULO, Ruedita, botonGris, botonNegro,
} from './piezas';

/**
 * /testimonios-gcx — dejar un testimonio de un GCX
 * (design-claude/GCX Testimonios - Dejar testimonio.dc.html; inventario en
 * design-claude/INVENTARIO-TESTIMONIOS-GCX.md, parte A).
 *
 * Es PÚBLICA en el router, como /solicitudes: sin sesión muestra el paso de
 * login del diseño y después vuelve sola. Volver se hace por los dos caminos
 * de siempre, que cubren casos distintos: `post_login_redirect` en
 * sessionStorage sobrevive el redirect completo de Google (que recarga la
 * página y se lleva el state de react-router), y `state.from` del navigate
 * cubre email y contraseña, donde no hay recarga.
 *
 * La base decide todo (sql/testimonios_gcx.sql): la temporada y el plazo, en
 * qué GCX puede escribir cada uno (inscripto, anfitrión o co-anfitrión), el
 * nombre con el que se publica (un menor sale "Nombre I.") y que no se
 * publique sin el "Confirmar" del modal. Acá no se arma nada de eso.
 *
 * El borrador (GCX elegido y texto) va a sessionStorage, por persona, para
 * que sobreviva a una recarga o a un error. Se borra al publicar.
 */

const RUTA = '/testimonios-gcx';
/** Marca que se pone antes de ir a entrar: al volver, "Volviendo de iniciar sesión…". */
const VOLVIENDO = 'testimonios-gcx.volviendo';
const claveBorrador = (uid: string) => `testimonios-gcx.borrador.${uid}`;

interface Borrador { grupo: string | null; texto: string }

const leerBorrador = (uid: string): Borrador | null => {
    try {
        const crudo = sessionStorage.getItem(claveBorrador(uid));
        if (!crudo) return null;
        const b = JSON.parse(crudo) as Partial<Borrador>;
        return { grupo: typeof b.grupo === 'string' ? b.grupo : null, texto: typeof b.texto === 'string' ? b.texto : '' };
    } catch { return null; }
};
const guardarBorrador = (uid: string, b: Borrador) => {
    try {
        if (!b.grupo && !b.texto) sessionStorage.removeItem(claveBorrador(uid));
        else sessionStorage.setItem(claveBorrador(uid), JSON.stringify(b));
    } catch { /* sin storage: queda mientras la pantalla esté abierta */ }
};
const borrarBorrador = (uid: string) => {
    try { sessionStorage.removeItem(claveBorrador(uid)); } catch { /* sin storage */ }
};

/**
 * Cuántos caracteres cuenta la base: después de sacar los espacios del
 * principio y del final, y por letra (un emoji es uno, no dos como en
 * `length`). Es el mismo límite que el CHECK de gcx_testimonios.
 */
const contar = (texto: string) => Array.from(texto.trim()).length;
/** Lo que se escribe más allá de las 1000 se corta, como el maxLength del diseño. */
const recortar = (texto: string): string => {
    const limpio = texto.trim();
    const letras = Array.from(limpio);
    if (letras.length <= LIMITE_TEXTO) return texto;
    const adelante = texto.match(/^\s*/)?.[0] ?? '';
    return adelante + letras.slice(0, LIMITE_TEXTO).join('');
};

const EJEMPLO = 'Por ejemplo: cómo llegaste al grupo, qué te llevaste de los encuentros, algo que cambió en vos o una frase que te quedó grabada.';

const DejarTestimonio: React.FC = () => {
    const navigate = useNavigate();
    const { user, isLoadingSession, isLoadingProfile, signInWithGoogle } = useAuth();
    const cargandoSesion = isLoadingSession || isLoadingProfile;

    // ── Lo que viene de la base ─────────────────────────────────────────
    const [temporada, setTemporada] = useState<Temporada | null>(null);
    const [errorTemporada, setErrorTemporada] = useState(false);
    const [grupos, setGrupos] = useState<MiGrupo[] | null>(null);
    const [miNombre, setMiNombre] = useState<string | null>(null);
    const [errorGrupos, setErrorGrupos] = useState(false);

    // ── Lo que hace la persona ──────────────────────────────────────────
    const [sel, setSel] = useState<string | null>(null);
    const [texto, setTexto] = useState('');
    const [tocado, setTocado] = useState(false);
    /** Cambia en cada intento fallido: vuelve a montar lo que se sacude. */
    const [sacudida, setSacudida] = useState(0);
    const [consintiendo, setConsintiendo] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
    /** Publicado: el nombre del GCX. */
    const [enviadoEn, setEnviadoEn] = useState<string | null>(null);
    const [errorGoogle, setErrorGoogle] = useState<string | null>(null);

    const enviandoRef = useRef(false);
    /** Hasta no leer el borrador, no se escribe (pisaría el guardado con vacío). */
    const borradorLeido = useRef(false);
    const [volviendo] = useState(() => {
        try { return sessionStorage.getItem(VOLVIENDO) === '1'; } catch { return false; }
    });

    // ── La vuelta del login ─────────────────────────────────────────────
    // Si la marca quedó colgada (se entró con la sesión puesta, o el destino
    // ya se consumió) se limpia: si no, un login posterior desde otra
    // pantalla terminaría acá sin que nadie lo pidiera.
    useEffect(() => {
        if (!user) return;
        try {
            if (sessionStorage.getItem('post_login_redirect') === RUTA) sessionStorage.removeItem('post_login_redirect');
        } catch { /* sin storage */ }
    }, [user]);

    const marcarSalida = () => {
        try { sessionStorage.setItem(VOLVIENDO, '1'); } catch { /* sin storage */ }
        guardarDestino({ pathname: RUTA });
    };
    const entrarConEmail = (registro: boolean) => {
        marcarSalida();
        navigate(registro ? '/auth?registro=1' : '/auth', { state: { from: { pathname: RUTA } } });
    };
    const entrarConGoogle = async () => {
        setErrorGoogle(null);
        marcarSalida();
        // El login real de la app: vuelve a post_login_redirect (este RUTA).
        const r = await signInWithGoogle();
        if (!r.success) setErrorGoogle('No pudimos abrir Google. Probá de nuevo o entrá con tu email.');
    };

    // ── Cargar ──────────────────────────────────────────────────────────
    const cargarTemporada = useCallback(async () => {
        setErrorTemporada(false);
        const r = await getTemporadaTestimonios();
        if (r.ok) setTemporada(r.temporada); else setErrorTemporada(true);
    }, []);

    const cargarGrupos = useCallback(async () => {
        if (!user) return;
        setErrorGrupos(false);
        const r = await getMisGruposTestimonios();
        if (!r.ok) {
            // Un fallo no es "no tenés GCX" (instrucciones 7.9).
            if (r.motivo !== 'sin_sesion') setErrorGrupos(true);
            return;
        }
        setTemporada(r.temporada);
        setMiNombre(r.miNombre);
        setGrupos(r.grupos);
        try { sessionStorage.removeItem(VOLVIENDO); } catch { /* sin storage */ }
        const libres = r.grupos.filter(g => !g.yaPublicado);

        if (!borradorLeido.current) {
            borradorLeido.current = true;
            const b = leerBorrador(user.id);
            if (b) {
                setTexto(recortar(b.texto));
                if (b.grupo && libres.some(g => g.id === b.grupo)) { setSel(b.grupo); return; }
            }
        }
        // Con un solo GCX por elegir, ya viene elegido.
        setSel(actual => (actual && libres.some(g => g.id === actual)) ? actual : (libres.length === 1 ? libres[0].id : null));
    }, [user]);

    useEffect(() => { cargarTemporada(); }, [cargarTemporada]);
    useEffect(() => { if (user) cargarGrupos(); }, [user, cargarGrupos]);

    // El borrador se guarda en cada cambio.
    useEffect(() => {
        if (!user || !borradorLeido.current || enviadoEn) return;
        guardarBorrador(user.id, { grupo: sel, texto });
    }, [user, sel, texto, enviadoEn]);

    const reintentarCarga = () => {
        cargarTemporada();
        if (user) cargarGrupos();
    };

    // ── El formulario ───────────────────────────────────────────────────
    const lista = grupos ?? [];
    const elegido = lista.find(g => g.id === sel && !g.yaPublicado) ?? null;
    const n = contar(texto);
    const cerca = n >= AVISO_TEXTO;
    const lleno = n >= LIMITE_TEXTO;
    const faltaGrupo = tocado && !elegido;
    const faltaTexto = tocado && n === 0;
    const apagado = !elegido || n === 0;
    const unSolo = lista.length === 1;
    const razon = apagado
        ? (!elegido && n === 0 ? 'Elegí tu GCX y escribí tu testimonio para enviarlo.'
            : !elegido ? 'Elegí tu GCX para enviarlo.' : 'Escribí tu testimonio para enviarlo.')
        : '';

    const volver = () => {
        // react-router deja su índice en el history: en 0 no hay a dónde volver.
        const indice = (window.history.state as { idx?: number } | null)?.idx;
        const hayDonde = typeof indice === 'number' ? indice > 0 : window.history.length > 1;
        if (hayDonde) navigate(-1); else navigate('/');
    };

    const enviar = () => {
        if (apagado) {
            setTocado(true);
            setSacudida(s => s + 1);
            return;
        }
        setErrorEnvio(null);
        setConsintiendo(true);
    };

    const confirmar = async () => {
        if (enviandoRef.current || !elegido || !user) return;
        enviandoRef.current = true;
        setEnviando(true);
        setErrorEnvio(null);
        const r = await publicarTestimonio(elegido.id, texto, true);
        enviandoRef.current = false;
        setEnviando(false);

        if (r.ok) {
            borrarBorrador(user.id);
            setGrupos(gs => (gs ?? []).map(g => g.id === elegido.id ? { ...g, yaPublicado: true, testimonioId: r.id, estado: 'publicado' } : g));
            setEnviadoEn(r.grupo || elegido.nombre);
            setConsintiendo(false);
            window.scrollTo(0, 0);
            return;
        }
        // Los que tienen pantalla propia en el diseño, van a ella.
        if (r.motivo === 'fuera_de_plazo') {
            setConsintiendo(false);
            // Sin strictNullChecks la unión no se angosta: se lee como Falla.
            const t = (r as Falla).temporada;
            if (t) setTemporada(t); else cargarTemporada();
            return;
        }
        if (r.motivo === 'ya_publicado' || r.motivo === 'no_inscripto') {
            setConsintiendo(false);
            setSel(null);
            cargarGrupos();
            return;
        }
        setErrorEnvio(r.motivo === 'red' ? 'No pudimos enviarlo' : mensajeDeMotivo(r));
    };

    const dejarOtro = () => {
        setEnviadoEn(null);
        setSel(null);
        setTexto('');
        setTocado(false);
        setErrorEnvio(null);
        window.scrollTo(0, 0);
        cargarGrupos();
    };

    // ── Qué pantalla ────────────────────────────────────────────────────
    type Pantalla = 'cargando' | 'login' | 'error' | 'cerrado' | 'sinGcx' | 'form' | 'enviado';
    const pantalla: Pantalla =
        !temporada && errorTemporada ? 'error'
            : !temporada ? 'cargando'
                : !temporada.cargaAbierta ? 'cerrado'
                    : cargandoSesion ? 'cargando'
                        : !user ? 'login'
                            : enviadoEn ? 'enviado'
                                : errorGrupos ? 'error'
                                    : !grupos ? 'cargando'
                                        : grupos.length === 0 ? 'sinGcx'
                                            : 'form';

    const etiqueta = temporada?.etiqueta ?? '';
    const quedan = lista.filter(g => !g.yaPublicado);
    const nombreVisible = miNombre || 'Tu nombre';

    return (
        <div id={ID_TESTIMONIOS} className="min-h-screen" style={{ background: C.fondo }}>
            <style>{ESTILOS}</style>

            {/* ── Sin sesión ─────────────────────────────────────────── */}
            {pantalla === 'login' && (
                <div className="flex min-h-[calc(100vh-80px)] flex-col justify-center px-5 pb-[60px] pt-6 min-[600px]:p-10" style={{ animation: 'tstIn .35s ease both' }}>
                    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto' }}>
                        <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, fontWeight: 700, letterSpacing: '-.03em', textWrap: 'balance' } as React.CSSProperties}>
                            Iniciá sesión para dejar tu testimonio
                        </h1>
                        <p style={{ margin: '12px 0 0', fontSize: 16, lineHeight: 1.55, fontWeight: 500, color: C.m62, textWrap: 'pretty' } as React.CSSProperties}>
                            Así sabemos de qué GCX fuiste parte en la {etiqueta}.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 32 }}>
                            <button type="button" onClick={entrarConGoogle} style={{ height: 58, border: '1px solid rgba(0,0,0,.1)', borderRadius: 999, background: '#fff', color: C.tinta, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer' }} className="active:scale-[.98]">
                                <LogoGoogle />Continuar con Google
                            </button>
                            <button type="button" onClick={() => entrarConEmail(false)} style={{ height: 58, border: 0, borderRadius: 999, background: C.tinta, color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer' }} className="active:scale-[.98]">
                                Entrar con email
                            </button>
                        </div>
                        {errorGoogle && (
                            <p role="alert" style={{ margin: '12px 0 0', textAlign: 'center', fontSize: 13.5, fontWeight: 700, color: C.rojo }}>{errorGoogle}</p>
                        )}
                        <p style={{ margin: '18px 0 0', textAlign: 'center', fontSize: 14, fontWeight: 500, color: C.m62 }}>
                            ¿No tenés cuenta?{' '}
                            <button type="button" onClick={() => entrarConEmail(true)} style={{ minHeight: 44, padding: '0 4px', border: 0, background: 'transparent', fontSize: 14, fontWeight: 800, color: C.tinta, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                                Crear cuenta
                            </button>
                        </p>
                        <p style={{ margin: '6px 0 0', textAlign: 'center', fontSize: 13.5, fontWeight: 500, color: C.m52 }}>
                            Después de entrar, seguís acá para escribir tu testimonio.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Cargando ───────────────────────────────────────────── */}
            {pantalla === 'cargando' && (
                <div aria-busy="true" className="mx-auto max-w-[640px] px-4 pb-14 pt-6 min-[600px]:px-10">
                    <p style={{ margin: '0 0 18px', fontSize: 13.5, fontWeight: 600, color: C.m52 }}>
                        {volviendo ? 'Volviendo de iniciar sesión…' : 'Buscando tus GCX de esta temporada…'}
                    </p>
                    <div style={esqueleto({ width: '62%', height: 32 })} />
                    <div style={esqueleto({ width: '80%', height: 16, marginTop: 12 })} />
                    <div style={esqueleto({ width: 120, height: 12, marginTop: 34 })} />
                    {[1, 2, 3].map(k => (
                        <div key={k} style={{ background: '#fff', borderRadius: 22, padding: 14, marginTop: 10, display: 'flex', gap: 14, alignItems: 'center' }}>
                            <div style={esqueleto({ width: 56, height: 56, borderRadius: 16, flex: 'none' })} />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={esqueleto({ width: '60%', height: 16 })} />
                                <div style={esqueleto({ width: '42%', height: 12 })} />
                            </div>
                        </div>
                    ))}
                    <div style={esqueleto({ height: 200, marginTop: 30, borderRadius: 26 })} />
                </div>
            )}

            {/* ── Sin GCX, plazo cerrado y error ─────────────────────── */}
            {(pantalla === 'sinGcx' || pantalla === 'cerrado' || pantalla === 'error') && (
                <div className="px-5 pb-[60px] pt-6 min-[600px]:p-10">
                    {pantalla === 'sinGcx' && (
                        <PantallaAviso
                            icono={<IconoPersonas />}
                            titulo="No encontramos un GCX tuyo en esta temporada"
                            texto={`Para dejar un testimonio tenés que haber sido parte de un GCX de la ${etiqueta}. Mientras tanto, podés leer lo que vivieron otros.`}
                            boton="Ver los testimonios"
                            onBoton={() => navigate('/testimonios')}
                        />
                    )}
                    {pantalla === 'cerrado' && temporada && (
                        <PantallaAviso
                            icono={<IconoCalendarioCerrado />}
                            titulo={`Los testimonios de la ${etiqueta} cerraron el ${diaYMes(temporada.cargaHasta)}`}
                            texto="Los que se publicaron se siguen viendo. Cuando termine la próxima temporada vas a poder contar lo que viviste."
                            boton="Ver los testimonios"
                            onBoton={() => navigate('/testimonios')}
                        />
                    )}
                    {pantalla === 'error' && (
                        <PantallaAviso
                            alerta
                            icono={<IconoSinConexion />}
                            titulo="No pudimos cargar los testimonios"
                            texto="Revisá tu conexión y probá de nuevo."
                            boton="Reintentar"
                            onBoton={reintentarCarga}
                        />
                    )}
                </div>
            )}

            {/* ── El formulario ──────────────────────────────────────── */}
            {pantalla === 'form' && temporada && (
                <div
                    className="mx-auto grid max-w-[1080px] grid-cols-[minmax(0,620px)] items-start justify-center gap-12 px-4 pb-14 pt-6 min-[600px]:px-10 min-[600px]:pb-16 lg:grid-cols-[minmax(0,620px)_minmax(0,320px)] lg:pb-[72px]"
                    style={{ animation: 'tstIn .35s ease both' }}
                >
                    <div style={{ minWidth: 0 }}>
                        <p style={ROTULO}>TU TESTIMONIO</p>
                        <h1 className="text-[30px] min-[600px]:text-[40px]" style={{ margin: '10px 0 0', lineHeight: 1.08, fontWeight: 700, letterSpacing: '-.03em' }}>
                            {etiqueta}
                        </h1>
                        <p style={{ margin: '10px 0 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 15.5, lineHeight: 1.5, fontWeight: 600, color: C.m62 }}>
                            <IconoReloj />Podés dejar tu testimonio hasta el {diaYMesLargo(temporada.cargaHasta)}
                        </p>

                        {/* El GCX */}
                        <div style={{ marginTop: 32, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                            <p id="lblGcx" style={ROTULO}>{unSolo ? 'TU GCX' : '¿EN QUÉ GCX?'}</p>
                            {faltaGrupo && <p role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.rojo }}>Elegí un GCX</p>}
                        </div>
                        <div
                            key={faltaGrupo ? `g${sacudida}` : 'g'}
                            role="radiogroup"
                            aria-labelledby="lblGcx"
                            style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10, animation: faltaGrupo ? 'tstShake .35s ease' : 'none' }}
                        >
                            {lista.map((g, i) => {
                                const hecho = g.yaPublicado;
                                const on = sel === g.id && !hecho;
                                return (
                                    <div
                                        key={g.id}
                                        style={{
                                            background: hecho ? '#fbfbfa' : '#fff', borderRadius: 22, transition: 'box-shadow .15s',
                                            boxShadow: on ? 'inset 0 0 0 2px #0a0a0a' : '0 1px 2px rgba(0,0,0,.04), inset 0 0 0 1px rgba(0,0,0,.06)',
                                        }}
                                    >
                                        <button
                                            type="button"
                                            role="radio"
                                            aria-checked={on}
                                            aria-disabled={hecho}
                                            onClick={() => { if (!hecho) setSel(g.id); }}
                                            style={{ width: '100%', minHeight: 88, padding: 14, border: 0, borderRadius: 22, background: 'transparent', color: C.tinta, display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: hecho ? 'default' : 'pointer' }}
                                        >
                                            <span aria-hidden="true" style={{ width: 56, height: 56, flex: 'none', borderRadius: 16, ...fondoDePortada(g.portada, i) }} />
                                            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <span style={{ fontSize: 16.5, lineHeight: 1.25, fontWeight: 700, letterSpacing: '-.01em' }}>{g.nombre}</span>
                                                <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    {g.anfitriones.map((a, j) => (
                                                        <FilaAnfitrion key={`${a.nombre}-${j}`} a={a} fondo={PASTELES[(i + j) % 4]} />
                                                    ))}
                                                </span>
                                            </span>
                                            {hecho ? (
                                                <span style={{ flex: 'none', height: 30, padding: '0 12px', borderRadius: 999, background: C.gris, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: C.m62 }}>
                                                    <IconoTilde tam={13} ancho={2.6} />Ya enviado
                                                </span>
                                            ) : (
                                                <span style={{ width: 26, height: 26, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: on ? C.tinta : 'transparent', boxShadow: on ? 'none' : 'inset 0 0 0 2px rgba(0,0,0,.2)' }}>
                                                    {on && <IconoTilde />}
                                                </span>
                                            )}
                                        </button>
                                        {hecho && (
                                            <div style={{ padding: '0 14px 12px 84px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px' }}>
                                                <span style={{ fontSize: 13, fontWeight: 500, color: C.m52 }}>Ya dejaste tu testimonio en este GCX.</span>
                                                {g.testimonioId && (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/testimonios/${g.id}?testimonio=${g.testimonioId}`)}
                                                        style={{ minHeight: 44, margin: '-8px 0', padding: '0 2px', border: 0, background: 'transparent', fontSize: 13.5, fontWeight: 800, color: C.tinta, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                                                    >
                                                        Ver mi testimonio
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {unSolo && (
                            <p style={{ margin: '10px 4px 0', fontSize: 13.5, fontWeight: 500, color: C.m52 }}>
                                Es el único GCX en el que estuviste esta temporada, así que ya viene elegido.
                            </p>
                        )}

                        {/* El texto */}
                        <div style={{ marginTop: 32, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                            <label htmlFor="tTxt" style={ROTULO}>¿QUÉ VIVISTE EN TU GCX?</label>
                            {faltaTexto && <p role="alert" style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.rojo }}>Escribí tu testimonio</p>}
                        </div>
                        <div
                            key={faltaTexto ? `t${sacudida}` : 't'}
                            style={{
                                marginTop: 10, background: '#fff', borderRadius: 26, padding: '6px 6px 12px', transition: 'box-shadow .2s',
                                animation: faltaTexto ? 'tstShake .35s ease' : 'none',
                                boxShadow: faltaTexto || lleno ? 'inset 0 0 0 2px #b42318'
                                    : cerca ? 'inset 0 0 0 2px #c08a2e'
                                        : '0 1px 2px rgba(0,0,0,.04), inset 0 0 0 1px rgba(0,0,0,.06)',
                            }}
                        >
                            <textarea
                                id="tTxt"
                                value={texto}
                                onChange={e => setTexto(recortar(e.target.value))}
                                aria-describedby="tCnt"
                                aria-invalid={faltaTexto || undefined}
                                placeholder={EJEMPLO}
                                className="min-h-[220px] min-[600px]:min-h-[240px]"
                                style={{ display: 'block', width: '100%', padding: '14px 14px 8px', resize: 'vertical', fontSize: 16, lineHeight: 1.6, fontWeight: 500 }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 8px', padding: '10px 14px 0', borderTop: '1px solid rgba(0,0,0,.06)' }}>
                                <span id="tCnt" aria-live="polite" style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: lleno ? C.rojo : cerca ? C.ambar : C.m52 }}>
                                    {lleno ? `Llegaste al límite de ${LIMITE_TEXTO} caracteres` : cerca ? `Te quedan ${LIMITE_TEXTO - n} caracteres` : ''}
                                </span>
                                <span style={{ flex: 'none', fontSize: 13.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: lleno ? C.rojo : cerca ? C.ambar : C.m52 }}>
                                    {n} / {LIMITE_TEXTO}
                                </span>
                            </div>
                        </div>

                        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column-reverse', gap: 12 }}>
                            <button type="button" onClick={volver} style={botonGris(64)} className="active:scale-[.98]">Volver atrás</button>
                            <button type="button" onClick={enviar} aria-disabled={apagado} aria-describedby="tRazon" style={botonNegro(64, apagado)} className="active:scale-[.98]">
                                Enviar testimonio
                            </button>
                        </div>
                        <p id="tRazon" style={{ margin: '12px 0 0', minHeight: 20, textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: C.m52 }}>{razon}</p>
                    </div>

                    {/* Sólo compu: qué se publica (la "Propuesta" del diseño). */}
                    <aside className="hidden lg:block" style={{ position: 'sticky', top: 24, marginTop: 118, background: '#fff', borderRadius: 26, padding: 22, boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
                        <p style={ROTULO}>QUÉ SE PUBLICA</p>
                        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[
                                { t: 'Tu nombre', s: nombreVisible },
                                { t: 'El GCX', s: elegido ? elegido.nombre : 'El que elijas' },
                                { t: 'La temporada', s: etiqueta },
                                { t: 'El texto', s: 'Tal cual lo escribiste' },
                            ].map(p => (
                                <div key={p.t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                                    <span style={{ width: 22, height: 22, flex: 'none', borderRadius: 999, background: C.gris, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <IconoTilde tam={12} />
                                    </span>
                                    <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700 }}>{p.t}</span>
                                        <span style={{ fontSize: 13, fontWeight: 500, color: C.m52 }}>{p.s}</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                        <p style={{ margin: '16px 0 0', paddingTop: 14, borderTop: '1px solid rgba(0,0,0,.06)', fontSize: 13, lineHeight: 1.5, fontWeight: 500, color: C.m52 }}>
                            Antes de publicarlo te pedimos que lo confirmes.
                        </p>
                    </aside>
                </div>
            )}

            {/* ── Enviado ────────────────────────────────────────────── */}
            {pantalla === 'enviado' && (
                <div className="px-5 pb-[60px] pt-6 min-[600px]:p-10" style={{ animation: 'tstIn .4s ease both' }}>
                    <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <svg width="96" height="96" viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <circle cx="26" cy="26" r="24" strokeDasharray="151" style={{ strokeDashoffset: 0, animation: 'tstCircle .6s ease-out both' }} />
                            <path d="M15 27l7 7 15-16" strokeDasharray="36" style={{ strokeDashoffset: 0, animation: 'tstCheck .4s .45s ease-out both' }} />
                        </svg>
                        <h1 style={{ margin: '22px 0 0', fontSize: 30, lineHeight: 1.12, fontWeight: 700, letterSpacing: '-.03em', textWrap: 'balance' } as React.CSSProperties}>
                            ¡Gracias por compartir lo que viviste!
                        </h1>
                        <p style={{ margin: '12px 0 0', fontSize: 16, lineHeight: 1.55, fontWeight: 500, color: C.m62, textWrap: 'pretty' } as React.CSSProperties}>
                            Tu testimonio ya está publicado en {enviadoEn}. Puede animar a alguien a sumarse a un grupo.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 30 }}>
                            {quedan.length > 0 ? (
                                <div style={{ background: '#fff', borderRadius: 24, padding: 18, textAlign: 'left', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
                                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                                        {quedan.length === 1 ? 'Te queda 1 GCX por contar' : `Te quedan ${quedan.length} GCX por contar`}
                                    </p>
                                    <p style={{ margin: '4px 0 0', fontSize: 14, lineHeight: 1.5, fontWeight: 500, color: C.m62 }}>
                                        {quedan.map(g => g.nombre).join(' · ')}
                                    </p>
                                    <button type="button" onClick={dejarOtro} style={{ ...botonNegro(58), marginTop: 14 }} className="active:scale-[.98]">
                                        Dejar otro testimonio
                                    </button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => navigate('/perfil/testimonios')} style={botonNegro(58)} className="active:scale-[.98]">
                                    Ver mis testimonios
                                </button>
                            )}
                            <button type="button" onClick={() => navigate('/')} style={botonGris(58)} className="active:scale-[.98]">
                                Volver al inicio
                            </button>
                        </div>

                        {/* Cómo sacarlo después. Lo pidió Ignacio (no está en el
                            diseño): no se edita ni se borra desde acá; se pide
                            en Mis testimonios, Sistemas lo revisa y, mientras
                            tanto, deja de verse (testimonios_solicitar_eliminacion). */}
                        <div style={{ marginTop: 22, width: '100%', background: '#fff', borderRadius: 20, padding: 16, textAlign: 'left', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, fontWeight: 500, color: C.m62, textWrap: 'pretty' } as React.CSSProperties}>
                                Si más adelante querés sacar tu testimonio, podés pedirlo desde Mis testimonios con "Solicitar eliminación". Un administrador revisa el pedido y lo elimina; mientras tanto, deja de verse para el público.
                            </p>
                            <button
                                type="button"
                                onClick={() => navigate('/perfil/testimonios')}
                                style={{ marginTop: 12, height: 44, padding: '0 18px', border: 0, borderRadius: 999, background: C.gris, color: C.tinta, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                                className="active:scale-[.98]"
                            >
                                Ir a Mis testimonios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── El consentimiento ──────────────────────────────────── */}
            {consintiendo && elegido && (
                <HojaModal idTitulo="cTitle" ancho={520} ocupada={enviando} onCerrar={() => setConsintiendo(false)}>
                    <div className="px-5 pb-[30px] pt-2 min-[600px]:px-[30px] min-[600px]:pb-7 min-[600px]:pt-[30px]">
                        <p style={ROTULO}>ANTES DE PUBLICAR</p>
                        <h2 id="cTitle" style={{ margin: '8px 0 0', fontSize: 24, lineHeight: 1.2, fontWeight: 700, letterSpacing: '-.025em' }}>¿Publicamos tu testimonio?</h2>
                        <p style={{ margin: '10px 0 0', fontSize: 15, lineHeight: 1.55, fontWeight: 500, color: C.m62, textWrap: 'pretty' } as React.CSSProperties}>
                            Al confirmar, tu testimonio sale publicado en Testimonios de los Grupos de Conexión para que otras personas lo puedan leer. Se publica:
                        </p>
                        <ul style={{ margin: '14px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[
                                ['Tu nombre', nombreVisible],
                                ['El GCX', elegido.nombre],
                                ['La temporada', etiqueta],
                                ['El texto', 'Tu testimonio completo'],
                            ].map(([k, v]) => (
                                <li key={k} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 15, fontWeight: 600 }}>
                                    <span style={{ flex: 'none', width: 96, fontSize: 13, fontWeight: 700, color: C.m52 }}>{k}</span>
                                    <span>{v}</span>
                                </li>
                            ))}
                        </ul>
                        <p style={{ ...ROTULO, marginTop: 20 }}>ASÍ SE VA A VER</p>
                        <div style={{ marginTop: 8, background: C.fondo, borderRadius: 20, padding: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Cara nombre={nombreVisible} tam={36} fondo="#efe6dc" letra={12.5} />
                                <span style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 15, fontWeight: 700 }}>{nombreVisible}</span>
                                    <span style={{ fontSize: 12.5, fontWeight: 600, color: C.m52 }}>{etiqueta}</span>
                                </span>
                            </div>
                            <p style={{ margin: '12px 0 0', fontSize: 14.5, lineHeight: 1.55, fontWeight: 500, color: 'rgba(0,0,0,.72)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-line' }}>
                                {texto.trim()}
                            </p>
                        </div>
                        <p style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 600, color: C.m52 }}>Una vez publicado no se puede editar.</p>
                        {errorEnvio && (
                            <div role="alert" style={{ marginTop: 16, padding: '12px 12px 12px 16px', borderRadius: 18, background: C.rojoFondo, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ flex: '1 1 180px', fontSize: 14, fontWeight: 700, color: C.rojo }}>{errorEnvio} · Tu texto sigue guardado.</span>
                                <button type="button" onClick={confirmar} style={{ height: 44, padding: '0 16px', border: 0, borderRadius: 999, background: '#fff', color: C.tinta, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                                    Reintentar
                                </button>
                            </div>
                        )}
                        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column-reverse', gap: 12 }}>
                            <button type="button" onClick={() => { if (!enviando) setConsintiendo(false); }} style={botonGris(64)} className="active:scale-[.98]">
                                Volver atrás
                            </button>
                            <button type="button" onClick={confirmar} disabled={enviando} aria-busy={enviando} style={{ ...botonNegro(64), opacity: enviando ? 0.7 : 1, cursor: enviando ? 'default' : 'pointer' }} className="active:scale-[.98]">
                                {enviando ? <><Ruedita /><span>Enviando…</span></> : <span>Confirmar</span>}
                            </button>
                        </div>
                    </div>
                </HojaModal>
            )}
        </div>
    );
};

export default DejarTestimonio;

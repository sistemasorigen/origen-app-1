import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { guardarDestino } from '../../components/auth/SinAcceso';
import ModalCompartirQR from '../../components/modals/ModalCompartirQR';
import {
    darCorazon, diaYMes, getGrupoTestimonios, mensajeDeMotivo,
    type GrupoDetalle, type TestimonioPublico, type Temporada,
} from '../../services/testimonios';
import {
    botonGris, botonNegro, C, Cara, CartelNoHabilitado, cortar, ESTILOS, esqueleto, fondoDePortada, hayQueCortar, HojaModal,
    ID_TESTIMONIOS, IconoCandado, IconoChat, IconoCompartir, IconoCorazon, IconoSinConexion, IconoVolver,
    linkDeGrupo, linkDeTestimonio, PantallaAviso, PASTELES, TarjetaEstado, useCargaHabilitada, useVista,
} from './piezas';

/**
 * /testimonios/:groupId — los testimonios de un GCX
 * (design-claude/GCX Testimonios - Testimonios.dc.html, parte C del
 * inventario).
 *
 * Pública: se lee sin sesión. El corazón necesita sesión, y ahí aparece el
 * aviso del diseño; al volver de entrar, ese corazón queda dado solo. Lo
 * pendiente se guarda en sessionStorage porque el login con Google recarga la
 * página entera y se lleva todo lo que esté en memoria.
 *
 * El texto de los testimonios y la descripción del GCX se cortan a 100
 * caracteres con "ver más", como el diseño. La base los manda completos.
 */

const VOLVIENDO = 'testimonios.volviendo';
const PENDIENTE = 'testimonios.corazon-pendiente';

/** Lo que se quería hacer antes de ir a iniciar sesión. */
interface Pendiente { grupo: string; testimonio: string }

const leerPendiente = (): Pendiente | null => {
    try {
        const crudo = sessionStorage.getItem(PENDIENTE);
        if (!crudo) return null;
        const p = JSON.parse(crudo) as Partial<Pendiente>;
        return p && typeof p.grupo === 'string' && typeof p.testimonio === 'string'
            ? { grupo: p.grupo, testimonio: p.testimonio } : null;
    } catch { return null; }
};
const olvidarPendiente = () => { try { sessionStorage.removeItem(PENDIENTE); } catch { /* sin storage */ } };

/** Cuánto dura el resaltado del testimonio al que se entró por un link (tHl). */
const RESALTADO = 3200;

const TestimoniosDelGrupo: React.FC = () => {
    const { groupId = '' } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const vista = useVista();
    const { user, isLoadingSession } = useAuth();
    const [params] = useSearchParams();
    const destacado = params.get('testimonio') || '';

    /** La búsqueda con la que se llegó, para volver a la galería como estaba. */
    const q = (location.state as { q?: string } | null)?.q || '';

    const [grupo, setGrupo] = useState<GrupoDetalle | null>(null);
    const [temporada, setTemporada] = useState<Temporada | null>(null);
    const [testimonios, setTestimonios] = useState<TestimonioPublico[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(false);
    const [sinGrupo, setSinGrupo] = useState(false);
    /** Sistemas tiene apagada la galería: el cartel y nada más. */
    const [apagada, setApagada] = useState(false);
    const cargaHabilitada = useCargaHabilitada();

    const [descAbierta, setDescAbierta] = useState(false);
    const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
    const [saltos, setSaltos] = useState<Record<string, number>>({});
    const [resaltado, setResaltado] = useState('');
    const [avisoLink, setAvisoLink] = useState(false);
    const [toast, setToast] = useState('');
    const [compartir, setCompartir] = useState<null | { testimonio?: TestimonioPublico }>(null);
    const [pidiendoSesion, setPidiendoSesion] = useState<TestimonioPublico | null>(null);

    const [volviendo] = useState(() => {
        try { return sessionStorage.getItem(VOLVIENDO) === '1'; } catch { return false; }
    });

    /** Lo último que confirmó la base de cada corazón: a esto se vuelve si algo falla. */
    const servidor = useRef<Record<string, { di: boolean; corazones: number }>>({});
    /** El estado al que la persona quiere llegar (el último toque). */
    const deseado = useRef<Record<string, boolean>>({});
    /** Ids con un pedido viajando. */
    const enVuelo = useRef<Record<string, boolean>>({});
    /** El último link de testimonio que ya se atendió (por id, no un sí/no:
     *  si se abre otro link sin recargar, hay que volver a hacerlo). */
    const yaDestacado = useRef('');
    const tarjetas = useRef<Record<string, HTMLElement | null>>({});

    // ── Cargar ──────────────────────────────────────────────────────────
    const cargar = useCallback(async () => {
        setCargando(true);
        setError(false);
        setSinGrupo(false);
        const r = await getGrupoTestimonios(groupId);
        setCargando(false);
        if (!r.ok) {
            if (r.motivo === 'no_habilitado') { setApagada(true); return; }
            // Un GCX que no existe o que es de otra temporada tiene su propia
            // pantalla; cualquier otra cosa es un error que se reintenta.
            if (r.motivo === 'no_existe' || r.motivo === 'fuera_de_temporada') setSinGrupo(true);
            else setError(true);
            return;
        }
        setApagada(false);
        setGrupo(r.grupo);
        setTemporada(r.temporada);
        setTestimonios(r.testimonios);
        servidor.current = {};
        for (const t of r.testimonios) servidor.current[t.id] = { di: t.yoDi, corazones: t.corazones };
    }, [groupId]);

    useEffect(() => { cargar(); }, [cargar]);

    // ── La vuelta del login ─────────────────────────────────────────────
    useEffect(() => {
        if (!user) return;
        try {
            sessionStorage.removeItem(VOLVIENDO);
            if ((sessionStorage.getItem('post_login_redirect') || '').startsWith('/testimonios/')) {
                sessionStorage.removeItem('post_login_redirect');
            }
        } catch { /* sin storage */ }
    }, [user]);

    /**
     * El corazón que quedó pendiente: al volver con la sesión puesta se da
     * solo. Siempre `true`: si ya estaba dado, la base no lo quita.
     */
    useEffect(() => {
        if (!user || cargando || !testimonios.length) return;
        const p = leerPendiente();
        if (!p || p.grupo !== groupId) return;
        if (!testimonios.some(t => t.id === p.testimonio)) { olvidarPendiente(); return; }
        olvidarPendiente();
        (async () => {
            const r = await darCorazon(p.testimonio, true);
            if (!r.ok) {
                setToast(mensajeDeMotivo(r));
                if (r.motivo === 'no_habilitado') setApagada(true);
                return;
            }
            servidor.current[p.testimonio] = { di: r.di, corazones: r.corazones };
            deseado.current[p.testimonio] = r.di;
            setTestimonios(ts => ts.map(t => (t.id === p.testimonio ? { ...t, yoDi: r.di, corazones: r.corazones } : t)));
            setSaltos(s => ({ ...s, [p.testimonio]: (s[p.testimonio] || 0) + 1 }));
            setToast('Listo, tu corazón quedó dado');
        })();
    }, [user, cargando, testimonios, groupId]);

    // ── Entrar por el link de un testimonio ─────────────────────────────
    useEffect(() => {
        if (cargando || !destacado || yaDestacado.current === destacado) return;
        yaDestacado.current = destacado;
        setAvisoLink(false);
        if (!testimonios.some(t => t.id === destacado)) {
            // Lo borraron, lo ocultaron o pidieron eliminarlo: la página se ve
            // normal y se avisa en corto.
            setAvisoLink(true);
            return;
        }
        setAbiertos(a => ({ ...a, [destacado]: true }));
        setResaltado(destacado);
        const t = setTimeout(() => {
            tarjetas.current[destacado]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 60);
        const t2 = setTimeout(() => setResaltado(''), RESALTADO);
        return () => { clearTimeout(t); clearTimeout(t2); };
    }, [cargando, destacado, testimonios]);

    // Los avisos de abajo se van solos.
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(''), 2600);
        return () => clearTimeout(t);
    }, [toast]);

    // ── El corazón ──────────────────────────────────────────────────────
    /**
     * Manda el último estado que quedó pedido. Si mientras viaja la persona
     * vuelve a tocar, al volver se manda de nuevo: nunca hay dos pedidos del
     * mismo testimonio a la vez, y el último toque es el que vale.
     */
    const mandarCorazon = useCallback(async (id: string) => {
        if (enVuelo.current[id]) return;
        enVuelo.current[id] = true;
        const quiero = deseado.current[id];
        const r = await darCorazon(id, quiero);
        enVuelo.current[id] = false;

        if (!r.ok) {
            // No se guardó: se vuelve a lo último que dijo la base.
            const v = servidor.current[id];
            deseado.current[id] = v ? v.di : false;
            if (v) setTestimonios(ts => ts.map(t => (t.id === id ? { ...t, yoDi: v.di, corazones: v.corazones } : t)));
            setToast(r.motivo === 'sin_sesion' ? 'Tu sesión se cerró. Volvé a entrar.' : mensajeDeMotivo(r));
            // La apagaron con la página abierta: el cartel.
            if (r.motivo === 'no_habilitado') setApagada(true);
            return;
        }

        servidor.current[id] = { di: r.di, corazones: r.corazones };
        setTestimonios(ts => ts.map(t => (t.id === id ? { ...t, yoDi: r.di, corazones: r.corazones } : t)));
        // Se siguió tocando mientras viajaba: va otra vez con lo último.
        if (deseado.current[id] !== r.di) mandarCorazon(id);
    }, []);

    const tocarCorazon = (t: TestimonioPublico) => {
        if (!user) {
            setPidiendoSesion(t);
            return;
        }
        const nuevo = !t.yoDi;
        deseado.current[t.id] = nuevo;
        // Se ve al instante; si la base dice otra cosa, manda la base.
        setTestimonios(ts => ts.map(x => (x.id === t.id ? { ...x, yoDi: nuevo, corazones: Math.max(0, x.corazones + (nuevo ? 1 : -1)) } : x)));
        setSaltos(s => ({ ...s, [t.id]: (s[t.id] || 0) + 1 }));
        mandarCorazon(t.id);
    };

    // ── Ir a iniciar sesión desde el aviso ──────────────────────────────
    const irAEntrar = () => {
        const t = pidiendoSesion;
        if (!t) return;
        const destino = { pathname: `/testimonios/${groupId}`, search: `?testimonio=${encodeURIComponent(t.id)}` };
        try {
            sessionStorage.setItem(PENDIENTE, JSON.stringify({ grupo: groupId, testimonio: t.id }));
            sessionStorage.setItem(VOLVIENDO, '1');
        } catch { /* sin storage: el corazón habrá que darlo a mano */ }
        guardarDestino(destino);
        setPidiendoSesion(null);
        navigate('/auth', { state: { from: destino } });
    };

    const volver = () => navigate(q ? `/testimonios?q=${encodeURIComponent(q)}` : '/testimonios');

    const esCompu = vista === 'compu';
    const columnas: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: esCompu ? 'minmax(0,420px) minmax(0,1fr)' : 'minmax(0,1fr)',
        gap: esCompu ? 48 : 28,
        alignItems: 'start',
    };

    if (apagada) {
        return (
            <div id={ID_TESTIMONIOS} className="min-h-screen" style={{ background: C.fondo }}>
                <style>{ESTILOS}</style>
                <CartelNoHabilitado pagina="galeria" onInicio={() => navigate('/')} />
            </div>
        );
    }

    return (
        <div id={ID_TESTIMONIOS} className="min-h-screen" style={{ background: C.fondo }}>
            <style>{ESTILOS}</style>

            <div className="mx-auto px-4 pb-14 pt-6 min-[600px]:px-10 min-[600px]:pb-[72px] min-[600px]:pt-5" style={{ maxWidth: esCompu ? 1180 : 720 }}>
                <button
                    type="button"
                    onClick={volver}
                    className="active:scale-[.98]"
                    style={{ height: 44, maxWidth: '100%', padding: '0 16px 0 10px', border: 0, borderRadius: 999, background: '#fff', color: C.tinta, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}
                >
                    <IconoVolver />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {q ? `Testimonios · “${q}”` : 'Testimonios'}
                    </span>
                </button>

                {/* Cargando */}
                {cargando && (
                    <div aria-busy="true" style={{ ...columnas, marginTop: 18 }}>
                        <div>
                            <div style={esqueleto({ aspectRatio: '4 / 3', borderRadius: 28 })} />
                            <div style={esqueleto({ width: '70%', height: 28, marginTop: 20 })} />
                            <div style={esqueleto({ width: '50%', height: 16, marginTop: 16 })} />
                            <div style={esqueleto({ width: '90%', height: 14, marginTop: 20 })} />
                            <div style={esqueleto({ width: '80%', height: 14, marginTop: 8 })} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div style={esqueleto({ width: 140, height: 12 })} />
                            <div style={esqueleto({ height: 180, borderRadius: 26 })} />
                            <div style={esqueleto({ height: 180, borderRadius: 26 })} />
                        </div>
                    </div>
                )}

                {/* El GCX no existe o es de otra temporada */}
                {!cargando && sinGrupo && (
                    <div style={{ marginTop: 18 }}>
                        <PantallaAviso
                            icono={<IconoChat />}
                            titulo="Este GCX no tiene testimonios para mostrar"
                            texto="Puede que ya no exista o que sea de otra temporada. Mientras tanto, podés leer los de esta."
                            boton="Ver todos los testimonios"
                            onBoton={() => navigate('/testimonios')}
                        />
                    </div>
                )}

                {/* Error */}
                {!cargando && error && (
                    <TarjetaEstado
                        alerta
                        icono={<IconoSinConexion />}
                        titulo="No pudimos cargar los testimonios"
                        texto="Revisá tu conexión y probá de nuevo."
                        boton="Reintentar"
                        onBoton={cargar}
                    />
                )}

                {/* El GCX y sus testimonios */}
                {!cargando && !error && !sinGrupo && grupo && (
                    <div style={{ ...columnas, marginTop: 18, animation: 'tstIn .35s ease both' }}>
                        <section aria-label="El grupo" style={{ position: esCompu ? 'sticky' : 'static', top: 24, minWidth: 0 }}>
                            <div role="img" aria-label={`Portada del GCX ${grupo.nombre}`} style={{ aspectRatio: '4 / 3', borderRadius: 28, overflow: 'hidden', position: 'relative', ...fondoDePortada(null, 0) }}>
                                {grupo.portada && (
                                    <img src={grupo.portada} alt="" aria-hidden="true" decoding="async"
                                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                )}
                            </div>
                            <h1 style={{ margin: '20px 0 0', fontSize: 30, lineHeight: 1.1, fontWeight: 700, letterSpacing: '-.03em', textWrap: 'balance' } as React.CSSProperties}>
                                {grupo.nombre}
                            </h1>
                            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: '10px 20px' }}>
                                {grupo.anfitriones.map((a, j) => (
                                    <div key={`${a.nombre}-${j}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                        <Cara nombre={a.nombre} foto={a.foto} tam={40} fondo={PASTELES[j % PASTELES.length]} letra={13} />
                                        <span style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: 15, fontWeight: 700 }}>{a.nombre}</span>
                                            <span style={{ fontSize: 12.5, fontWeight: 600, color: C.m52 }}>{a.rol}</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                            {!!grupo.descripcion && (
                                <p id="tst-desc" style={{ margin: '18px 0 0', fontSize: 15.5, lineHeight: 1.6, fontWeight: 500, color: 'rgba(0,0,0,.72)', textWrap: 'pretty', whiteSpace: 'pre-line' } as React.CSSProperties}>
                                    {descAbierta || !hayQueCortar(grupo.descripcion) ? grupo.descripcion : cortar(grupo.descripcion)}
                                    {hayQueCortar(grupo.descripcion) && (
                                        <>{' '}
                                            <button
                                                type="button"
                                                onClick={() => setDescAbierta(v => !v)}
                                                aria-expanded={descAbierta}
                                                aria-controls="tst-desc"
                                                style={{ display: 'inline-block', height: 44, margin: '-12px 0', padding: '0 4px', border: 0, background: 'transparent', fontSize: 15.5, fontWeight: 800, color: C.tinta, cursor: 'pointer', verticalAlign: 'baseline' }}
                                            >
                                                {descAbierta ? 'ver menos' : 'ver más'}
                                            </button>
                                        </>
                                    )}
                                </p>
                            )}
                        </section>

                        <section aria-labelledby="tst-rotulo" style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: esCompu ? 0 : 24, borderTop: esCompu ? 0 : '1.5px solid rgba(0,0,0,.08)' }}>
                                <h2 id="tst-rotulo" style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: C.m38 }}>
                                    TESTIMONIOS · {testimonios.length}
                                </h2>
                                <span style={{ flex: 1, height: 1, background: 'rgba(0,0,0,.06)' }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.m52 }}>Más nuevos primero</span>
                            </div>

                            {avisoLink && (
                                <p role="status" style={{ margin: '12px 0 0', padding: '12px 14px', borderRadius: 16, background: '#fff', fontSize: 13.5, fontWeight: 600, color: C.m62, boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
                                    Ese testimonio ya no está disponible.
                                </p>
                            )}

                            {testimonios.length > 0 && (
                                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {testimonios.map((t, i) => {
                                        const abierto = !!abiertos[t.id];
                                        const hayMas = hayQueCortar(t.texto);
                                        const salto = saltos[t.id] || 0;
                                        return (
                                            <article
                                                key={t.id}
                                                ref={el => { tarjetas.current[t.id] = el; }}
                                                style={{ position: 'relative', background: '#fff', borderRadius: 26, padding: 18, boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 2px 10px rgba(0,0,0,.03)' }}
                                            >
                                                {resaltado === t.id && (
                                                    <div aria-hidden="true" style={{ position: 'absolute', inset: -4, borderRadius: 30, boxShadow: '0 0 0 3px #0a0a0a', background: 'rgba(246,210,122,.16)', pointerEvents: 'none', animation: `tstHl ${RESALTADO}ms ease both` }} />
                                                )}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <Cara nombre={t.autor} tam={40} fondo={PASTELES[(i + 2) % PASTELES.length]} letra={13} />
                                                    <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontSize: 16, fontWeight: 700 }}>{t.autor}</span>
                                                        <span style={{ fontSize: 13, fontWeight: 600, color: C.m52 }}>{t.temporada} · {t.anio}</span>
                                                    </span>
                                                </div>

                                                <div style={{ marginTop: 14, background: C.fondo, borderRadius: 18, padding: '14px 16px' }}>
                                                    <p id={`tst-${t.id}`} style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, fontWeight: 500, color: 'rgba(0,0,0,.78)', textWrap: 'pretty', whiteSpace: 'pre-line' } as React.CSSProperties}>
                                                        {abierto || !hayMas ? t.texto : cortar(t.texto)}
                                                        {hayMas && (
                                                            <>{' '}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setAbiertos(a => ({ ...a, [t.id]: !a[t.id] }))}
                                                                    aria-expanded={abierto}
                                                                    aria-controls={`tst-${t.id}`}
                                                                    style={{ display: 'inline-block', height: 44, margin: '-12px 0', padding: '0 4px', border: 0, background: 'transparent', fontSize: 15.5, fontWeight: 800, color: C.tinta, cursor: 'pointer', verticalAlign: 'baseline' }}
                                                                >
                                                                    {abierto ? 'ver menos' : 'ver más'}
                                                                </button>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>

                                                <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => tocarCorazon(t)}
                                                        aria-pressed={t.yoDi}
                                                        aria-label={`${t.yoDi ? 'Quitar corazón' : 'Dar corazón'} al testimonio de ${t.autor} · ${t.corazones}`}
                                                        className="active:scale-[.96]"
                                                        style={{ height: 44, padding: '0 14px', border: 0, borderRadius: 999, display: 'flex', alignItems: 'center', gap: 7, fontSize: 14.5, fontWeight: 700, cursor: 'pointer', transition: 'background .2s, color .2s', background: t.yoDi ? '#fdebe7' : C.gris, color: t.yoDi ? '#d9402f' : C.tinta }}
                                                    >
                                                        <span key={`h${salto}`} style={{ display: 'inline-flex', animation: salto ? 'tstPop .4s cubic-bezier(.3,.7,.3,1)' : 'none' }}>
                                                            <IconoCorazon dado={t.yoDi} />
                                                        </span>
                                                        <span key={`c${t.corazones}`} style={{ display: 'inline-block', minWidth: 14, fontVariantNumeric: 'tabular-nums', animation: salto ? 'tstRoll .25s ease both' : 'none' }}>
                                                            {t.corazones}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setCompartir({ testimonio: t })}
                                                        aria-label={`Compartir el testimonio de ${t.autor}`}
                                                        className="active:scale-[.96]"
                                                        style={{ marginLeft: 'auto', width: 44, height: 44, border: 0, borderRadius: 999, background: C.gris, color: C.tinta, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                    >
                                                        <IconoCompartir />
                                                    </button>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}

                            {testimonios.length === 0 && (
                                <TarjetaEstado
                                    icono={<IconoChat />}
                                    titulo="Todavía nadie contó su experiencia en este grupo"
                                    texto={!temporada?.cargaAbierta
                                        ? 'La carga de testimonios de esta temporada ya cerró.'
                                        : cargaHabilitada === false
                                            ? 'Si fuiste parte, vas a poder contarlo cuando se habiliten los testimonios, al terminar la temporada.'
                                            : `Si fuiste parte, podés ser la primera persona en contarlo. Tenés hasta el ${diaYMes(temporada.cargaHasta)}.`}
                                    boton={temporada?.cargaAbierta && cargaHabilitada ? 'Dejar mi testimonio' : undefined}
                                    onBoton={temporada?.cargaAbierta && cargaHabilitada ? () => navigate('/testimonios-gcx') : undefined}
                                    botonAncho
                                />
                            )}
                        </section>
                    </div>
                )}
            </div>

            {/* Volviendo de iniciar sesión */}
            {volviendo && (isLoadingSession || cargando) && (
                <div role="status" style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'rgba(246,246,244,.86)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, animation: 'tstFade .2s ease both' }}>
                    <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 999, border: '3px solid #0a0a0a', borderRightColor: 'transparent', animation: 'tstSpin .7s linear infinite' }} />
                    <span style={{ fontSize: 15, fontWeight: 700 }}>Volviendo de iniciar sesión…</span>
                </div>
            )}

            {/* Compartir: el mismo panel de Enlaces Origen */}
            {compartir && grupo && temporada && (
                <ModalCompartirQR
                    isOpen
                    onClose={() => setCompartir(null)}
                    rotulo={compartir.testimonio ? 'COMPARTIR TESTIMONIO' : 'COMPARTIR TESTIMONIOS'}
                    title={compartir.testimonio ? `Testimonio de ${compartir.testimonio.autor}` : grupo.nombre}
                    subtitle={compartir.testimonio
                        ? `${grupo.nombre} · ${temporada.etiqueta}`
                        : `Testimonios · ${temporada.etiqueta}`}
                    link={compartir.testimonio ? linkDeTestimonio(grupo.id, compartir.testimonio.id) : linkDeGrupo(grupo.id)}
                    leyendaQR={compartir.testimonio ? 'Escaneá para leer este testimonio' : 'Escaneá para leer los testimonios'}
                />
            )}

            {/* Aviso de sesión al dar corazón. Con la hoja compartida: la
                misma que el modal de /testimonios-gcx, con su manija, el
                arrastre para cerrar y el Escape. */}
            {pidiendoSesion && (
                <HojaModal idTitulo="tst-gate" ancho={440} onCerrar={() => setPidiendoSesion(null)}>
                    <div style={{ padding: vista === 'movil' ? '6px 20px 30px' : '30px 30px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <span style={{ marginTop: 6, width: 72, height: 72, borderRadius: 999, background: C.gris, color: C.m62, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconoCandado />
                        </span>
                        <h2 id="tst-gate" style={{ margin: '18px 0 0', maxWidth: 340, fontSize: 22, lineHeight: 1.25, fontWeight: 700, letterSpacing: '-.02em', textWrap: 'balance' } as React.CSSProperties}>
                            Iniciá sesión para dar corazón
                        </h2>
                        <p style={{ margin: '10px 0 0', maxWidth: 360, fontSize: 15, lineHeight: 1.55, fontWeight: 500, color: C.m62, textWrap: 'pretty' } as React.CSSProperties}>
                            Dar corazón solo está disponible para personas con la sesión iniciada. Al entrar volvés a este mismo testimonio y el corazón queda dado.
                        </p>
                        <div style={{ marginTop: 24, width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <button type="button" onClick={irAEntrar} className="active:scale-[.98]" style={{ ...botonNegro(56) }}>
                                Iniciar sesión
                            </button>
                            <button type="button" onClick={() => setPidiendoSesion(null)} className="active:scale-[.98]" style={{ ...botonGris(56) }}>
                                Volver atrás
                            </button>
                        </div>
                    </div>
                </HojaModal>
            )}

            {/* El aviso de abajo (corazón dado, o lo que contestó la base) */}
            {toast && (
                <div role="status" style={{ position: 'fixed', zIndex: 130, left: '50%', transform: 'translateX(-50%)', bottom: 'calc(28px + env(safe-area-inset-bottom))', width: 'max-content', maxWidth: 'calc(100% - 32px)', padding: '14px 20px', borderRadius: 999, background: C.tinta, color: '#fff', fontSize: 14.5, fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,.2)', animation: 'tstFade .2s ease both', textAlign: 'center' }}>
                    {toast}
                </div>
            )}
        </div>
    );
};

export default TestimoniosDelGrupo;

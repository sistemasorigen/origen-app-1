import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ModalCompartirQR from '../../components/modals/ModalCompartirQR';
import {
    diaYMes, getGruposTestimonios, type GrupoGaleria, type Temporada,
} from '../../services/testimonios';
import {
    C, Cara, CartelNoHabilitado, ESTILOS, esqueleto, fondoDePortada, ID_TESTIMONIOS, IconoChatChico, IconoCompartir,
    IconoEquis, IconoFlecha, IconoLapiz, IconoLupa, IconoLupaSin, IconoReloj, IconoSinConexion,
    linkDeGrupo, PASTELES, TarjetaEstado, useCargaHabilitada, useVista,
} from './piezas';

/**
 * /testimonios — la galería de los GCX de la temporada
 * (design-claude/GCX Testimonios - Testimonios.dc.html, parte B del
 * inventario).
 *
 * Es PÚBLICA: se ve igual con y sin sesión. Todo lo decide la base
 * (`testimonios_grupos`): cuál es la temporada vigente, qué GCX entran y la
 * búsqueda, que va por el nombre del GCX, del anfitrión o de quien dejó un
 * testimonio, sin mayúsculas ni acentos. Acá no se filtra nada: lo que se
 * escribe viaja a la base.
 *
 * Lo que se buscó queda en la URL (`?q=`), así volver desde el detalle
 * conserva la búsqueda y la lista se puede compartir tal como se está viendo.
 */

/** Lo que se espera entre teclas antes de ir a la base. */
const ESPERA = 320;

const GaleriaTestimonios: React.FC = () => {
    const navigate = useNavigate();
    const vista = useVista();
    const [params, setParams] = useSearchParams();
    const qUrl = params.get('q') || '';

    /** Lo que se está escribiendo: cambia en cada tecla, sin esperar a la base. */
    const [texto, setTexto] = useState(qUrl);
    /** Lo último que se le pidió a la base. */
    const [buscado, setBuscado] = useState(qUrl);
    const [grupos, setGrupos] = useState<GrupoGaleria[] | null>(null);
    const [temporada, setTemporada] = useState<Temporada | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(false);
    /** Sistemas tiene apagada la galería: se muestra el cartel y nada más. */
    const [apagada, setApagada] = useState(false);
    const cargaHabilitada = useCargaHabilitada();
    const [foco, setFoco] = useState(false);
    const [compartiendo, setCompartiendo] = useState<GrupoGaleria | null>(null);

    /** Cada búsqueda lleva su número: una vieja que llega tarde no pisa a la nueva. */
    const pedido = useRef(0);

    const cargar = useCallback(async (q: string) => {
        const mio = ++pedido.current;
        setCargando(true);
        setError(false);
        const r = await getGruposTestimonios(q);
        if (mio !== pedido.current) return;
        setCargando(false);
        if (!r.ok) {
            if (r.motivo === 'no_habilitado') { setApagada(true); return; }
            // Un fallo no es "no hay GCX" (instrucciones, 7.9).
            setError(true);
            return;
        }
        setApagada(false);
        setTemporada(r.temporada);
        setGrupos(r.grupos);
    }, []);

    // La primera carga, con lo que venga en la URL.
    useEffect(() => { cargar(qUrl); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    // Mientras se escribe: se espera un momento, se busca y recién ahí se
    // guarda en la URL (con replace, para no llenar el historial de teclas).
    useEffect(() => {
        const limpio = texto.trim();
        if (limpio === buscado) return;
        const t = setTimeout(() => {
            setBuscado(limpio);
            cargar(limpio);
            setParams(limpio ? { q: limpio } : {}, { replace: true });
        }, ESPERA);
        return () => clearTimeout(t);
    }, [texto, buscado, cargar, setParams]);

    // El botón de atrás del navegador cambia la URL: la pantalla lo sigue.
    useEffect(() => {
        if (qUrl === buscado) return;
        setTexto(qUrl);
        setBuscado(qUrl);
        cargar(qUrl);
        /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [qUrl]);

    const limpiar = () => {
        setTexto('');
        setBuscado('');
        cargar('');
        setParams({}, { replace: true });
    };

    const lista = grupos ?? [];
    const hayBusqueda = !!buscado;
    const conteo = cargando
        ? 'Cargando testimonios…'
        : error ? ''
            : hayBusqueda
                ? `${lista.length} ${lista.length === 1 ? 'GCX coincide' : 'GCX coinciden'}`
                : temporada ? `${lista.length} GCX de la ${temporada.etiqueta}` : '';

    const grilla: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: vista === 'movil' ? 'minmax(0,1fr)' : vista === 'compu' ? 'repeat(3, minmax(0,1fr))' : 'repeat(2, minmax(0,1fr))',
        gap: vista === 'movil' ? 14 : 20,
    };
    /** Tantas tarjetas de esqueleto como entran en una pantalla. */
    const esqueletos = vista === 'movil' ? [1, 2] : vista === 'compu' ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4];

    const abrir = (g: GrupoGaleria) => {
        // La búsqueda viaja en el state: el detalle la usa para el botón de
        // volver, y el link que se comparte queda limpio.
        navigate(`/testimonios/${g.id}`, { state: { q: buscado } });
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

            <div className="mx-auto max-w-[1280px] px-4 pb-14 pt-6 min-[600px]:px-10 min-[600px]:pb-[72px] min-[600px]:pt-5">
                <h1 style={{ margin: 0, maxWidth: 760, fontSize: 'clamp(32px, 4.6vw, 52px)', lineHeight: 1.05, fontWeight: 700, letterSpacing: '-.035em', textWrap: 'balance' } as React.CSSProperties}>
                    Testimonios de los Grupos de Conexión
                </h1>
                <p style={{ margin: '10px 0 0', fontSize: 16, fontWeight: 600, color: C.m62, minHeight: 22 }}>
                    {temporada?.etiqueta ?? ''}
                </p>

                {/* Dejar el propio, mientras el plazo esté abierto y Sistemas
                    tenga prendida la carga. */}
                {temporada?.cargaAbierta && cargaHabilitada && (
                    <div style={{ marginTop: 22, background: '#fff', borderRadius: 26, padding: vista === 'movil' ? 18 : '18px 18px 18px 24px', boxShadow: '0 1px 2px rgba(0,0,0,.04)', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 16 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-.01em' }}>¿Fuiste parte de un GCX esta temporada?</p>
                            <p style={{ margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: C.m52 }}>
                                <IconoReloj tam={15} />Hasta el {diaYMes(temporada.cargaHasta)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/testimonios-gcx')}
                            className="active:scale-[.98]"
                            style={{ width: '100%', height: 60, padding: '0 24px', border: 0, borderRadius: 999, background: C.tinta, color: '#fff', fontSize: 17, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                        >
                            <IconoLapiz />Dejar mi testimonio
                        </button>
                    </div>
                )}

                {/* El buscador */}
                <div
                    style={{
                        marginTop: 18, height: 56, borderRadius: 999, background: '#fff',
                        boxShadow: foco ? 'inset 0 0 0 2px #0a0a0a' : '0 1px 2px rgba(0,0,0,.04), inset 0 0 0 1px rgba(0,0,0,.06)',
                        display: 'flex', alignItems: 'center', gap: 4, padding: '0 6px 0 18px', maxWidth: 560,
                    }}
                >
                    <span style={{ flex: 'none', color: C.m52, display: 'flex' }}><IconoLupa /></span>
                    <input
                        type="search"
                        value={texto}
                        onChange={e => setTexto(e.target.value)}
                        onFocus={() => setFoco(true)}
                        onBlur={() => setFoco(false)}
                        aria-label="Buscar por GCX, anfitrión o persona"
                        placeholder="Buscá por GCX, anfitrión o persona"
                        style={{ flex: 1, minWidth: 0, height: 52, padding: '0 8px', fontSize: 16, fontWeight: 600 }}
                    />
                    {!!texto && (
                        <button
                            type="button"
                            onClick={limpiar}
                            aria-label="Limpiar búsqueda"
                            style={{ width: 44, height: 44, flex: 'none', border: 0, borderRadius: 999, background: C.gris, color: C.tinta, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                            <IconoEquis />
                        </button>
                    )}
                </div>
                <p aria-live="polite" style={{ margin: '12px 4px 0', fontSize: 13.5, fontWeight: 600, color: C.m52, minHeight: 19 }}>{conteo}</p>

                {/* Cargando */}
                {cargando && (
                    <div aria-busy="true" aria-label="Cargando testimonios" style={{ ...grilla, marginTop: 14 }}>
                        {esqueletos.map(k => (
                            <div key={k} style={{ background: '#fff', borderRadius: 28, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
                                <div style={esqueleto({ aspectRatio: '4 / 3', borderRadius: 0 })} />
                                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={esqueleto({ width: '70%', height: 20 })} />
                                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                        <div style={esqueleto({ width: 32, height: 32, borderRadius: 999 })} />
                                        <div style={esqueleto({ width: '46%', height: 14 })} />
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                        <div style={esqueleto({ width: 46, height: 46, borderRadius: 12 })} />
                                        <div style={esqueleto({ flex: 1, height: 46, borderRadius: 12 })} />
                                    </div>
                                </div>
                            </div>
                        ))}
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
                        onBoton={() => cargar(buscado)}
                    />
                )}

                {/* Sin resultados */}
                {!cargando && !error && lista.length === 0 && hayBusqueda && (
                    <TarjetaEstado
                        icono={<IconoLupaSin />}
                        titulo={<>Sin resultados para “{buscado}”</>}
                        texto="Probá con el nombre del GCX, de quien lo coordina o de quien dejó el testimonio."
                        boton="Limpiar búsqueda"
                        onBoton={limpiar}
                    />
                )}

                {/* Sin GCX en la temporada (sin búsqueda) */}
                {!cargando && !error && lista.length === 0 && !hayBusqueda && (
                    <TarjetaEstado
                        icono={<IconoChatChico />}
                        titulo="Todavía no hay GCX en esta temporada"
                        texto="Cuando empiecen los grupos vas a poder leer lo que vivió cada uno."
                    />
                )}

                {/* La grilla */}
                {!cargando && !error && lista.length > 0 && (
                    <div style={{ ...grilla, marginTop: 14, alignItems: 'stretch' }}>
                        {lista.map((g, i) => (
                            <article
                                key={g.id}
                                style={{
                                    background: '#fff', borderRadius: 28, overflow: 'hidden',
                                    boxShadow: '0 1px 2px rgba(0,0,0,.04), 0 2px 10px rgba(0,0,0,.03)',
                                    display: 'flex', flexDirection: 'column',
                                    animation: 'tstIn .4s cubic-bezier(.2,.7,.3,1) both',
                                    animationDelay: `${Math.min(i, 8) * 50}ms`,
                                }}
                            >
                                {/* La portada, con el encuadre de siempre (centrada y
                                    recortada). Las de más abajo se bajan recién
                                    cuando se llega a ellas. */}
                                <div role="img" aria-label={`Portada del GCX ${g.nombre}`} style={{ aspectRatio: '4 / 3', ...fondoDePortada(null, i), position: 'relative', overflow: 'hidden' }}>
                                    {g.portada && (
                                        <img
                                            src={g.portada}
                                            alt=""
                                            aria-hidden="true"
                                            loading="lazy"
                                            decoding="async"
                                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    )}
                                </div>

                                <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column' }}>
                                    {g.coincide === 'testimonio' && g.autores.length > 0 && (
                                        <span style={{ alignSelf: 'flex-start', marginBottom: 10, height: 28, padding: '0 11px', borderRadius: 999, background: C.gris, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: 'rgba(0,0,0,.72)' }}>
                                            <IconoChatChico />
                                            {g.autores.length > 1 ? 'Testimonios de ' : 'Testimonio de '}
                                            {g.autores.slice(0, 2).join(' y ')}
                                        </span>
                                    )}

                                    <h3 style={{ margin: 0, fontSize: 17.5, lineHeight: 1.3, fontWeight: 700, letterSpacing: '-.01em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textWrap: 'pretty' } as React.CSSProperties}>
                                        {g.nombre}
                                    </h3>

                                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {g.anfitriones.map((a, j) => (
                                            <div key={`${a.nombre}-${j}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                                <Cara nombre={a.nombre} foto={a.foto} tam={32} fondo={PASTELES[(i + j) % PASTELES.length]} letra={11.5} />
                                                <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nombre}</span>
                                                    <span style={{ fontSize: 12, fontWeight: 600, color: C.m52 }}>{a.rol}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {g.testimonios === 0 && (
                                        <p style={{ margin: '14px 0 0', fontSize: 13.5, fontWeight: 600, color: C.m52 }}>Todavía sin testimonios</p>
                                    )}

                                    <div style={{ marginTop: 'auto', paddingTop: 18, display: 'flex', gap: 8 }}>
                                        <button
                                            type="button"
                                            onClick={() => setCompartiendo(g)}
                                            aria-label={`Compartir los testimonios de ${g.nombre}`}
                                            className="active:scale-[.96]"
                                            style={{ width: 46, height: 46, flex: 'none', border: 0, borderRadius: 12, background: C.gris, color: C.tinta, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                        >
                                            <IconoCompartir />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => abrir(g)}
                                            className="active:scale-[.98]"
                                            style={{ flex: 1, minWidth: 0, height: 46, padding: '0 14px', border: 0, borderRadius: 12, background: C.tinta, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        >
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>Ver testimonios</span>
                                            <IconoFlecha />
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </div>

            {compartiendo && temporada && (
                <ModalCompartirQR
                    isOpen
                    onClose={() => setCompartiendo(null)}
                    rotulo="COMPARTIR TESTIMONIOS"
                    title={compartiendo.nombre}
                    subtitle={`Testimonios · ${temporada.etiqueta}`}
                    link={linkDeGrupo(compartiendo.id)}
                    leyendaQR="Escaneá para leer los testimonios"
                />
            )}
        </div>
    );
};

export default GaleriaTestimonios;

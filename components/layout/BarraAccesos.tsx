import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import type { User } from '../../types';
import { useAudio } from '../../contexts/AudioContext';
import { useNotificationContext, useSinLeer } from '../../contexts/NotificationContext';
import { useAccesoAgenda } from '../../hooks/useAccesoAgenda';
import { supabaseService } from '../../services/supabaseService';
import { plataforma } from '../../src/utils/instalacion';
import {
    ACHIQUE_DE_TECLADO, ANCHO_SIN_TECLADO, BOTONES_FIJOS, ICONO_CAMPANA, LUGAR_PERSONALIZADO, SELECTOR_TAPA,
    abreTeclado, botonActivo, compactaAlMover, distanciaAbajo, etiquetaDeNotificaciones, guardarElegido, leerElegido,
    medidasDeBarra, resolverElegido, textoDelContador, yaEstaEn,
} from './barraAccesosLogica';
import { gruposParaElegir, type ContextoDeMenu, type MenuItem } from './menuFunciones';
import HojaAccesoRapido from './HojaAccesoRapido';

/**
 * La barra flotante de accesos rápidos (design-claude/Barra de accesos rapidos.dc.html).
 *
 * Sólo existe en la app instalada, con sesión y en pantallas con navegación:
 * lo decide Estructura.tsx, que directamente no la monta en otro caso. Por eso
 * en el navegador no hay ni una consulta de más.
 */

/** Lo que Mi cuenta necesita de la barra. Null: la barra no está montada. */
export interface ApiDeBarra {
    elegido: MenuItem | null;
    abrirHoja: () => void;
}
export const BarraAccesosContext = createContext<ApiDeBarra | null>(null);
export const useBarraAccesos = () => useContext(BarraAccesosContext);

const ESTILOS = `
#barra-accesos, #hoja-acceso, #aviso-barra {
  --qb-panel:#f6f6f4; --qb-tarjeta:#fff; --qb-ink:#0a0a0a; --qb-m62:rgba(0,0,0,.62); --qb-m55:rgba(0,0,0,.55); --qb-m38:rgba(0,0,0,.38);
  --qb-linea:rgba(0,0,0,.06); --qb-borde:rgba(0,0,0,.08); --qb-chip:#f2f2f0; --qb-prim:#0a0a0a; --qb-prim-tinta:#fff; --qb-rojo:#d1343a;
  --qb-encima:#fbfbfa; --qb-manija:rgba(0,0,0,.18); --qb-sombra:0 8px 28px rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.06);
}
.dark #barra-accesos, .dark #hoja-acceso, .dark #aviso-barra {
  --qb-panel:#111110; --qb-tarjeta:#1b1b1a; --qb-ink:#f4f4f2; --qb-m62:rgba(255,255,255,.66); --qb-m55:rgba(255,255,255,.55); --qb-m38:rgba(255,255,255,.42);
  --qb-linea:rgba(255,255,255,.07); --qb-borde:rgba(255,255,255,.12); --qb-chip:#2a2a28; --qb-prim:#f4f4f2; --qb-prim-tinta:#0a0a0a; --qb-rojo:#ff8a7a;
  --qb-encima:#222220; --qb-manija:rgba(255,255,255,.22); --qb-sombra:0 8px 28px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06);
}
#barra-accesos button, #hoja-acceso button { font-family:inherit; -webkit-tap-highlight-color:transparent }
#barra-accesos button:focus-visible, #hoja-acceso button:focus-visible { outline:2.5px solid var(--qb-ink); outline-offset:2px }
/* Le gana por especificidad al !important global de los campos (index.html). */
#hoja-acceso input[type="search"] {
  background-color:transparent !important; color:var(--qb-ink) !important; border:0 !important; border-radius:0;
  outline:none !important; box-shadow:none !important; font-family:inherit;
}
#hoja-acceso input[type="search"]::-webkit-search-cancel-button { display:none }
#hoja-acceso input[type="search"]::placeholder { color:var(--qb-m55) !important }
#hoja-acceso .qb-fila:hover { background:var(--qb-encima) !important }
#hoja-acceso .qb-quitar:active { transform:scale(.98) }
@keyframes qbRing { 0%{transform:rotate(0)} 12%{transform:rotate(18deg)} 26%{transform:rotate(-15deg)} 40%{transform:rotate(11deg)} 54%{transform:rotate(-7deg)} 68%{transform:rotate(4deg)} 82%{transform:rotate(-2deg)} 100%{transform:rotate(0)} }
@keyframes qbPop { 0%{transform:scale(.3)} 55%{transform:scale(1.3)} 100%{transform:scale(1)} }
@keyframes qbIn { 0%{opacity:0;transform:scale(.4) rotate(-30deg)} 60%{opacity:1;transform:scale(1.15)} 100%{transform:none} }
@keyframes qbFade { from{opacity:0} to{opacity:1} }
@keyframes qbUp { from{transform:translateY(100%)} to{transform:none} }
@keyframes qbZoom { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:none} }
@media (prefers-reduced-motion: reduce) {
  #barra-accesos, #barra-accesos *, #hoja-acceso, #hoja-acceso *, #aviso-barra { animation:none !important; transition:none !important }
}
`;

/** Cuánto tiene que pasar después de cargar para que un aumento sea "llegó una". */
const CALMA_AL_ABRIR = 1500;

/**
 * Sube cada vez que llega una notificación con la app abierta.
 *
 * Abrir la app no cuenta: el contador pasa de 0 a lo que ya había, y eso no es
 * algo que acaba de llegar. Por eso se espera a que termine la primera carga.
 */
const useLlegoUnaNueva = (sinLeer: number, cargando: boolean): number => {
    const [veces, setVeces] = useState(0);
    const anterior = useRef(sinLeer);
    const enCalma = useRef(false);

    useEffect(() => {
        if (enCalma.current || cargando) return;
        const reloj = window.setTimeout(() => { enCalma.current = true; }, CALMA_AL_ABRIR);
        return () => window.clearTimeout(reloj);
    }, [cargando]);

    useEffect(() => {
        if (enCalma.current && sinLeer > anterior.current) setVeces(v => v + 1);
        anterior.current = sinLeer;
    }, [sinLeer]);

    return veces;
};

/** Si hay una hoja, un modal o una botonera fija encima. */
const useHayAlgoEncima = (): boolean => {
    const [hay, setHay] = useState(false);
    useEffect(() => {
        let cuadro = 0;
        const mirar = () => {
            cuadro = 0;
            const bloqueado = document.body.hasAttribute('data-modal-active');
            // getClientRects: los que tienen `md:hidden` están en la página pero no se ven.
            setHay(bloqueado || [...document.querySelectorAll(SELECTOR_TAPA)].some(el => el.getClientRects().length > 0));
        };
        const pedir = () => { if (!cuadro) cuadro = window.requestAnimationFrame(mirar); };
        const observador = new MutationObserver(pedir);
        observador.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-modal-active', 'aria-modal', 'data-fijo-abajo'] });
        mirar();
        return () => {
            observador.disconnect();
            if (cuadro) window.cancelAnimationFrame(cuadro);
        };
    }, []);
    return hay;
};

/** Si el teclado del teléfono está abierto: un campo con foco o la pantalla achicada. */
const useTecladoAbierto = (): boolean => {
    const [abierto, setAbierto] = useState(false);
    useEffect(() => {
        const vista = window.visualViewport;
        const mirar = () => {
            if (window.innerWidth >= ANCHO_SIN_TECLADO) { setAbierto(false); return; }
            const achicada = !!vista && vista.scale === 1 && window.innerHeight - vista.height > ACHIQUE_DE_TECLADO;
            setAbierto(abreTeclado(document.activeElement as HTMLInputElement | null) || achicada);
        };
        // focusout antes de que el foco llegue al próximo campo: se mira después.
        const alSalir = () => window.setTimeout(mirar, 0);
        document.addEventListener('focusin', mirar);
        document.addEventListener('focusout', alSalir);
        vista?.addEventListener('resize', mirar);
        window.addEventListener('resize', mirar);
        return () => {
            document.removeEventListener('focusin', mirar);
            document.removeEventListener('focusout', alSalir);
            vista?.removeEventListener('resize', mirar);
            window.removeEventListener('resize', mirar);
        };
    }, []);
    return abierto;
};

const TIEMPO_LARGO = 520;
const TIEMPO_DOBLE = 320;
const CURVA = '220ms cubic-bezier(.2,.8,.2,1)';

const BarraAccesos: React.FC<{ currentUser: User; alPublicar: (api: ApiDeBarra | null) => void }> = ({ currentUser, alPublicar }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const sinMovimiento = !!useReducedMotion();
    const sinLeer = useSinLeer();
    const { isLoading: cargandoAvisos } = useNotificationContext();
    const llegadas = useLlegoUnaNueva(sinLeer, cargandoAvisos);
    const { currentSong } = useAudio();

    // ── Qué puede ver esta persona: lo mismo que decide el menú ──
    const agenda = useAccesoAgenda();
    const [prodeActivo, setProdeActivo] = useState(true);
    useEffect(() => {
        supabaseService.getAppConfig()
            .then(cfg => { if (cfg?.prodeConfig) setProdeActivo(cfg.prodeConfig.isActive); })
            .catch(() => { /* queda activo, igual que en el menú */ });
    }, []);
    const contexto = useMemo<ContextoDeMenu>(
        () => ({ currentUser, agenda, prodeActivo }),
        [currentUser, agenda, prodeActivo],
    );

    // ── El botón personalizado ──
    const [elegidoId, setElegidoId] = useState(() => leerElegido(currentUser.id));
    const [animarElegido, setAnimarElegido] = useState(0);
    useEffect(() => { setElegidoId(leerElegido(currentUser.id)); }, [currentUser.id]);
    const elegido = resolverElegido(elegidoId, contexto);

    const [hoja, setHoja] = useState<{ editar: boolean } | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const relojAviso = useRef(0);
    const avisar = (texto: string) => {
        window.clearTimeout(relojAviso.current);
        setAviso(texto);
        relojAviso.current = window.setTimeout(() => setAviso(null), 2600);
    };
    useEffect(() => () => window.clearTimeout(relojAviso.current), []);

    const elegir = (funcion: MenuItem) => {
        const yaEstaba = elegido?.id === funcion.id;
        guardarElegido(currentUser.id, funcion.id!);
        setElegidoId(funcion.id!);
        setAnimarElegido(n => n + 1);
        setHoja(null);
        avisar(yaEstaba ? `${funcion.label} sigue en tu barra` : `Listo, ${funcion.label} está en tu barra`);
    };

    // ── Tamaño y visibilidad ──
    const [compacta, setCompacta] = useState(false);
    const hayAlgoEncima = useHayAlgoEncima();
    const teclado = useTecladoAbierto();
    const escondida = !!hoja || hayAlgoEncima || teclado;
    const ahora = useRef({ escondida, ignorarHasta: 0, ultimoY: 0 });
    ahora.current.escondida = escondida;

    const ignorarScroll = useCallback((ms: number) => {
        ahora.current.ignorarHasta = Date.now() + ms;
        ahora.current.ultimoY = window.scrollY;
    }, []);

    /**
     * Sin un render por evento: se lee en un cuadro de animación y el estado
     * sólo cambia cuando cambia el tamaño.
     */
    useEffect(() => {
        let cuadro = 0;
        let quieto = 0;
        const mirar = () => {
            cuadro = 0;
            const estado = ahora.current;
            const tope = document.documentElement.scrollHeight - window.innerHeight;
            // El rebote elástico de iOS: más allá de los bordes no es scroll.
            const y = Math.min(Math.max(window.scrollY, 0), Math.max(tope, 0));
            const delta = y - estado.ultimoY;
            estado.ultimoY = y;
            if (estado.escondida || Date.now() < estado.ignorarHasta) return;
            setCompacta(actual => compactaAlMover(actual, y, delta));
            window.clearTimeout(quieto);
            quieto = window.setTimeout(() => setCompacta(false), 500);
        };
        const alMover = () => { if (!cuadro) cuadro = window.requestAnimationFrame(mirar); };
        window.addEventListener('scroll', alMover, { passive: true });
        return () => {
            window.removeEventListener('scroll', alMover);
            if (cuadro) window.cancelAnimationFrame(cuadro);
            window.clearTimeout(quieto);
        };
    }, []);

    // Al cambiar de pantalla, y al destaparse: el salto del scroll no lo hizo el dedo.
    useEffect(() => { setCompacta(false); ignorarScroll(300); }, [location.pathname, ignorarScroll]);
    useEffect(() => { setCompacta(false); ignorarScroll(300); }, [escondida, ignorarScroll]);

    const irA = (ruta: string) => {
        if (yaEstaEn(location.pathname, ruta)) {
            ignorarScroll(900);
            setCompacta(false);
            window.scrollTo({ top: 0, behavior: sinMovimiento ? 'auto' : 'smooth' });
            return;
        }
        navigate(ruta);
    };

    const quitar = () => {
        const funcion = elegido;
        guardarElegido(currentUser.id, null);
        setElegidoId(null);
        setHoja(null);
        if (funcion) {
            avisar(`Sacamos ${funcion.label} de tu barra`);
            if (botonActivo(location.pathname, funcion) === LUGAR_PERSONALIZADO) navigate('/');
        }
    };

    // ── Mi cuenta abre la misma hoja ──
    const hayElegido = !!elegido;
    const abrirHoja = useCallback(() => setHoja({ editar: hayElegido }), [hayElegido]);
    useEffect(() => { alPublicar({ elegido, abrirHoja }); }, [elegido, abrirHoja, alPublicar]);
    useEffect(() => () => alPublicar(null), [alPublicar]);

    // ── Mantener apretado o tocar dos veces ──
    const relojLargo = useRef(0);
    const fueLargo = useRef(false);
    const ultimoToque = useRef(0);
    useEffect(() => () => window.clearTimeout(relojLargo.current), []);

    const apretar = () => {
        fueLargo.current = false;
        window.clearTimeout(relojLargo.current);
        relojLargo.current = window.setTimeout(() => { fueLargo.current = true; setHoja({ editar: true }); }, TIEMPO_LARGO);
    };
    const soltar = () => window.clearTimeout(relojLargo.current);
    const tocarElegido = (funcion: MenuItem) => {
        if (fueLargo.current) { fueLargo.current = false; return; }
        const ya = Date.now();
        if (ya - ultimoToque.current < TIEMPO_DOBLE) {
            ultimoToque.current = 0;
            setHoja({ editar: true });
            return;
        }
        ultimoToque.current = ya;
        irA(funcion.path!);
    };

    // ── Lo que se dibuja ──
    const achicada = compacta && !escondida;
    const m = medidasDeBarra(achicada);
    const activo = botonActivo(location.pathname, elegido);
    const pl = plataforma();
    const abajo = distanciaAbajo(pl, !!currentSong);
    const sinTrans = sinMovimiento;
    const transicionBarra = sinTrans ? 'none' : `width ${CURVA}, height ${CURVA}, padding ${CURVA}, bottom ${CURVA}, transform ${CURVA}, opacity 200ms ease`;
    const transformada = escondida ? 'translate(-50%, 160%)' : 'translate(-50%, 0)';
    const opacidad = escondida ? 0 : 1;
    const avisoAbajo = escondida ? abajo + 12 : abajo + m.alto + 14;
    const colorDe = (i: number) => (activo === i ? 'var(--qb-prim-tinta)' : 'var(--qb-m62)');
    const estiloBoton = (i: number): React.CSSProperties => ({
        position: 'relative', zIndex: 1, width: m.anchoBoton, height: m.altoBoton, padding: 0, border: 0, borderRadius: 999,
        background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', touchAction: 'manipulation',
        color: colorDe(i), transition: sinTrans ? 'none' : `width ${CURVA}, height ${CURVA}, color .2s`,
    });
    const estiloIcono: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center' };
    const trazo = (i: number) => (activo === i ? 2.25 : 1.75);
    const izquierdaPastilla = m.anchoBoton * (activo ?? 0);
    // En tamaño real y no con scale: un scale encogería también al contador.
    const crece = sinTrans ? 'none' : `width ${CURVA}, height ${CURVA}`;
    const tamIcono: React.CSSProperties = { width: m.icono, height: m.icono, transition: crece };
    /** Sólo en la compu: en un teléfono, mantener apretado es para cambiar el botón. */
    const tooltip = (nombre: string) => (pl === 'compu' ? nombre : undefined);
    const animar = !sinMovimiento;
    const Elegido = elegido?.icon;

    // Por un portal: la app entra con una animación que le pone un transform a su
    // contenedor (.app-entrando), y adentro de un transform un position:fixed se
    // mide contra él y no contra la pantalla. La barra saltaba a su lugar al final.
    return createPortal(
        <>
            <style>{ESTILOS}</style>
            <div id="barra-accesos" className="print:hidden" style={{ fontFamily: 'Manrope, system-ui, sans-serif' }}>
                {/* contenido-del-overlay: index.css le pondría display:none a todo
                    <nav> con un modal abierto, y la barra no alcanzaría a bajar. */}
                <nav
                    aria-label="Accesos rápidos"
                    aria-hidden={escondida || undefined}
                    inert={escondida || undefined}
                    className="contenido-del-overlay"
                    data-compacta={achicada ? 'true' : 'false'}
                    style={{
                        position: 'fixed', zIndex: 45, left: '50%', bottom: abajo, transform: transformada, opacity: opacidad,
                        transition: transicionBarra, padding: m.relleno, borderRadius: 999,
                        background: 'var(--qb-tarjeta)', boxShadow: 'var(--qb-sombra)',
                    }}
                >
                    <div style={{ position: 'relative', display: 'flex' }}>
                        <span
                            aria-hidden="true"
                            style={{
                                position: 'absolute', zIndex: 0, top: 0, left: izquierdaPastilla, width: m.anchoBoton, height: m.altoBoton,
                                borderRadius: 999, background: 'var(--qb-prim)', pointerEvents: 'none', opacity: activo === null ? 0 : 1,
                                transition: sinTrans ? 'none' : `left 260ms cubic-bezier(.3,.8,.2,1), width ${CURVA}, height ${CURVA}, opacity .2s`,
                            }}
                        />
                        {BOTONES_FIJOS.map((boton, i) => {
                            const esCampana = boton.id === 'notificaciones';
                            return (
                                <button
                                    key={boton.id}
                                    type="button"
                                    onClick={() => irA(boton.ruta)}
                                    aria-label={esCampana ? etiquetaDeNotificaciones(sinLeer) : boton.nombre}
                                    title={tooltip(boton.nombre)}
                                    aria-current={activo === i ? 'page' : undefined}
                                    style={estiloBoton(i)}
                                >
                                    <span style={estiloIcono}>
                                        {esCampana ? (
                                            <span style={{ position: 'relative', display: 'inline-flex' }}>
                                                <svg
                                                    key={`campana-${llegadas}`}
                                                    data-campana=""
                                                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={trazo(i)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                                                    style={{ ...tamIcono, transformOrigin: '50% 8%', animation: llegadas && animar ? 'qbRing .75s ease-out' : 'none' }}
                                                >
                                                    <path d={ICONO_CAMPANA} />
                                                </svg>
                                                {sinLeer > 0 && (
                                                    <span
                                                        key={`contador-${llegadas}`}
                                                        data-contador=""
                                                        aria-hidden="true"
                                                        style={{
                                                            // Arriba a la derecha de la campana, con su propio
                                                            // tamaño: achicada tiene que seguir leyéndose.
                                                            position: 'absolute', top: -7, left: achicada ? 14 : 17,
                                                            minWidth: achicada ? 16 : 18, height: achicada ? 16 : 18, padding: achicada ? '0 4px' : '0 5px', borderRadius: 999,
                                                            transition: sinTrans ? 'none' : `top ${CURVA}, left ${CURVA}`,
                                                            background: '#e5484d', color: '#fff', boxShadow: `0 0 0 2px var(${activo === i ? '--qb-prim' : '--qb-tarjeta'})`,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: achicada ? 10 : 11, fontWeight: 800, lineHeight: 1, whiteSpace: 'nowrap',
                                                            animation: llegadas && animar ? 'qbPop .35s cubic-bezier(.3,.7,.3,1.4)' : 'none',
                                                        }}
                                                    >
                                                        {textoDelContador(sinLeer)}
                                                    </span>
                                                )}
                                            </span>
                                        ) : (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={trazo(i)} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={tamIcono}>
                                                <path d={boton.icono} />
                                            </svg>
                                        )}
                                    </span>
                                </button>
                            );
                        })}

                        {elegido && Elegido ? (
                            <button
                                type="button"
                                onClick={() => tocarElegido(elegido)}
                                onPointerDown={apretar}
                                onPointerUp={soltar}
                                onPointerLeave={soltar}
                                onPointerCancel={soltar}
                                onContextMenu={e => e.preventDefault()}
                                aria-label={`${elegido.label}. Mantené apretado para cambiarlo`}
                                title={tooltip(elegido.label)}
                                aria-current={activo === LUGAR_PERSONALIZADO ? 'page' : undefined}
                                style={estiloBoton(LUGAR_PERSONALIZADO)}
                            >
                                <span style={estiloIcono}>
                                    <Elegido
                                        key={animarElegido}
                                        strokeWidth={trazo(LUGAR_PERSONALIZADO)}
                                        aria-hidden="true"
                                        style={{ ...tamIcono, animation: animarElegido && animar ? 'qbIn .35s ease both' : 'none' }}
                                    />
                                </span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setHoja({ editar: false })}
                                aria-label="Agregar un acceso rápido"
                                title={tooltip('Agregar')}
                                style={estiloBoton(LUGAR_PERSONALIZADO)}
                            >
                                <span style={estiloIcono}>
                                    <span style={{ width: m.circuloMas, height: m.circuloMas, transition: crece, borderRadius: 999, boxShadow: 'inset 0 0 0 1.75px currentColor', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: animar ? 'qbIn .3s ease both' : 'none' }}>
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" aria-hidden="true" style={{ width: m.mas, height: m.mas, transition: crece }}><path d="M12 5v14M5 12h14" /></svg>
                                    </span>
                                </span>
                            </button>
                        )}
                    </div>
                </nav>
            </div>

            {hoja && (
                <HojaAccesoRapido
                    grupos={gruposParaElegir(contexto)}
                    elegido={elegido}
                    editar={hoja.editar}
                    sinMovimiento={sinMovimiento}
                    onElegir={elegir}
                    onQuitar={quitar}
                    onCerrar={() => setHoja(null)}
                />
            )}

            {aviso && (
                <div
                    id="aviso-barra"
                    role="status"
                    style={{
                        position: 'fixed', zIndex: 125, width: 'max-content', maxWidth: 'calc(100% - 32px)', padding: '13px 18px', borderRadius: 999,
                        background: 'var(--qb-prim)', color: 'var(--qb-prim-tinta)', fontFamily: 'Manrope, system-ui, sans-serif', fontSize: 14.5, fontWeight: 700,
                        boxShadow: '0 10px 30px rgba(0,0,0,.2)', animation: sinMovimiento ? 'none' : 'qbFade .2s ease both',
                        ...(pl === 'compu'
                            ? { top: 16, right: 20 }
                            : { left: '50%', bottom: avisoAbajo, transform: 'translateX(-50%)' }),
                    }}
                >
                    {aviso}
                </div>
            )}
        </>,
        document.body,
    );
};

export default BarraAccesos;

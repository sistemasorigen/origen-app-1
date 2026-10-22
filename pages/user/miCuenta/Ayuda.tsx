import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/supabaseClient';
import { codigoReporte, crearReporte, describirDispositivo } from '../../../services/miCuenta';
import {
    BotonPrimario, BotonSecundario, EncabezadoSubpagina, ESTILO_TARJETA,
    Girito, Icono, ICONOS, Panel, Rotulo, TARJETA,
} from '../../../components/miCuenta/piezas';
import {
    COMO_LLEGAR, RESPONSABLE, TERMINOS, ULTIMA_ACTUALIZACION, WHATSAPP,
} from '../../../src/legal/terminosYPrivacidad';

declare const __BUILD_VERSION__: string;

/**
 * Las cuatro pantallas de "Ayuda y otros", más Términos.
 *
 * Van juntas porque comparten la misma estructura —un encabezado y una lista—
 * y porque separadas serían cinco archivos de treinta líneas cada uno.
 *
 * SIN EMAIL, EN NINGUNA. La iglesia no tiene casilla de contacto: el diseño
 * mostraba una tarjeta de email y un `mailto:` y los dos se sacaron. El canal
 * es WhatsApp, la solicitud desde la app, o acercarse. Dejar un email que
 * nadie lee es peor que no tener ninguno.
 */

// ── Términos y privacidad ───────────────────────────────────────────────

export const Terminos: React.FC<{ onVolver?: () => void }> = ({ onVolver }) => {
    const contenedor = useRef<HTMLDivElement>(null);

    const irA = (i: number) => {
        const el = document.getElementById(`mc-termino-${i}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div ref={contenedor}>
            <EncabezadoSubpagina titulo="Términos y privacidad" onVolver={onVolver} />

            <p className="mt-2.5 mb-0 text-[14px] font-semibold" style={{ color: 'var(--mc-m50)' }}>
                Última actualización: {ULTIMA_ACTUALIZACION}
            </p>

            {/* El índice: siete secciones no entran de un vistazo, y quien
                viene por una sola —sus derechos— no tiene que barrer todo. */}
            <nav aria-label="Índice" className={`${TARJETA} mt-[18px] p-2`} style={ESTILO_TARJETA}>
                {TERMINOS.map((s, i) => (
                    <button
                        key={s.titulo}
                        type="button"
                        onClick={() => irA(i)}
                        className="w-full min-h-[44px] flex items-center gap-3 px-3 border-0 bg-transparent rounded-2xl font-[inherit] text-[15px] font-semibold text-left cursor-pointer"
                        style={{ color: 'var(--mc-ink)' }}
                    >
                        <span className="w-5 flex-none text-[13px]" style={{ color: 'var(--mc-m50)' }}>{i + 1}</span>
                        {s.titulo}
                    </button>
                ))}
            </nav>

            {TERMINOS.map((s, i) => (
                <section key={s.titulo} id={`mc-termino-${i}`} className="pt-8">
                    <h3 className="m-0 text-[20px] leading-[1.3] font-semibold tracking-[-.015em]">
                        {i + 1}. {s.titulo}
                    </h3>
                    {s.parrafos.map(p => (
                        <p key={p.slice(0, 40)} className="mt-3 mb-0 text-[16px] leading-[1.65] font-medium text-pretty"
                            style={{ color: 'var(--mc-m66)' }}>
                            {p}
                        </p>
                    ))}
                </section>
            ))}

            <BotonSecundario
                className="mt-8 min-h-[48px]"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
                Volver arriba
            </BotonSecundario>
        </div>
    );
};

// ── Tutoriales ──────────────────────────────────────────────────────────

/**
 * Los recorridos guiados que ya existen en la app.
 *
 * El .dc dibuja videos con su duración; en la app los tutoriales no son
 * videos sino tours que se abren adentro de cada pantalla. Se muestra lo que
 * de verdad hay: el nombre, de qué se trata y si ya se hizo.
 */
const TUTORIALES = [
    { id: 'dashboard', titulo: 'Moverte por la app', detalle: 'Lo básico: el menú, los avisos y cómo llegar a cada cosa.', ruta: '/dashboard?restartTutorial=true', icono: ICONOS.info },
    { id: 'groups', titulo: 'Encontrar tu GCX', detalle: 'Cómo buscar, filtrar y sumarte a un grupo de conexión.', ruta: '/gcx?restartTutorial=true', icono: ICONOS.grupos },
    { id: 'host', titulo: 'Si sos anfitrión: tu panel', detalle: 'Tu grupo, tus miembros y cómo tomar asistencia.', ruta: '/mis-grupos?restartTutorial=true', icono: ICONOS.grupos, soloAnfitrion: true },
    { id: 'createGroup', titulo: 'Crear un grupo', detalle: 'Paso a paso para abrir un GCX nuevo.', ruta: '/mis-grupos?restartTutorial=true&modal=createGroup', icono: ICONOS.grupos, soloAnfitrion: true },
    { id: 'welcome', titulo: 'Bienvenida', detalle: 'Cómo se registra y se acompaña a quien viene por primera vez.', ruta: '/bienvenida?restartTutorial=true', icono: ICONOS.servir, soloAnfitrion: true },
];

export const Tutoriales: React.FC<{ onVolver?: () => void }> = ({ onVolver }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const hechos = ((user as any)?.tutorial_progress || {}) as Record<string, unknown>;

    const esAnfitrion = (() => {
        const codigos = [String((user as any)?.role ?? ''), ...(((user as any)?.roles as unknown[]) || []).map(String)];
        return codigos.some(c => ['ANFITRION', 'CO_ANFITRION', 'ADMIN_GROUPS', 'SUPER_ADMIN'].includes(c));
    })();

    const visibles = TUTORIALES.filter(t => !t.soloAnfitrion || esAnfitrion);

    return (
        <>
            <EncabezadoSubpagina titulo="Tutoriales" onVolver={onVolver} />
            <div className={`${TARJETA} mt-[22px]`} style={ESTILO_TARJETA}>
                {visibles.map((t, i) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => navigate(t.ruta)}
                        className="w-full min-h-[60px] flex items-center gap-3.5 px-4 py-2.5 border-0 bg-transparent font-[inherit] cursor-pointer text-left"
                        style={{ color: 'var(--mc-ink)', borderTop: i ? '1px solid var(--mc-line)' : '0' }}
                    >
                        <span className="w-9 h-9 flex-none rounded-full flex items-center justify-center"
                            style={{ background: 'var(--mc-chip)' }}>
                            <Icono d={t.icono} />
                        </span>
                        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <span className="text-[15px] leading-[1.3] font-semibold">{t.titulo}</span>
                            <span className="text-[13px] leading-[1.4] font-medium" style={{ color: 'var(--mc-m50)' }}>{t.detalle}</span>
                        </span>
                        {hechos[t.id] ? (
                            <span className="flex-none inline-flex items-center gap-1 h-[26px] px-2.5 rounded-full text-[12.5px] font-bold"
                                style={{ background: 'var(--mc-green-bg)', color: 'var(--mc-green-ink)' }}>
                                <Icono d={ICONOS.tilde} tam={12} grosor={3} />
                                Hecho
                            </span>
                        ) : null}
                        <Icono d={ICONOS.flecha} tam={17} grosor={2} />
                    </button>
                ))}
            </div>
        </>
    );
};

// ── Escribile a la iglesia ──────────────────────────────────────────────

export const Contacto: React.FC<{ onVolver?: () => void }> = ({ onVolver }) => (
    <>
        <EncabezadoSubpagina titulo="Escribile a la iglesia" onVolver={onVolver} />

        <a
            href={WHATSAPP.link}
            target="_blank"
            rel="noopener noreferrer"
            className={`${TARJETA} flex flex-col items-start mt-[22px] p-[18px] no-underline`}
            style={{ ...ESTILO_TARJETA, color: 'var(--mc-ink)' }}
        >
            <span className="w-11 h-11 rounded-full flex items-center justify-center text-white" style={{ background: '#25d366' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-3.9-1z" />
                    <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-.8.8a3.5 3.5 0 01-2-2l.8-.8-1-2z" />
                </svg>
            </span>
            <span className="mt-3.5 text-[16px] font-semibold">WhatsApp</span>
            <span className="mt-1 text-[14px] font-medium" style={{ color: 'var(--mc-m66)' }}>{WHATSAPP.visible}</span>
            <span className="mt-3 text-[14px] font-bold underline underline-offset-[3px]">Abrir el chat</span>
        </a>

        <Rotulo className="mt-7 mb-2.5 ml-1.5">HORARIO DE ATENCIÓN</Rotulo>
        <div className={`${TARJETA} px-[18px] py-1.5`} style={ESTILO_TARJETA}>
            <div className="flex justify-between gap-3 py-3">
                <span className="text-[15px] font-semibold">Lunes a viernes</span>
                <span className="text-[15px] font-medium" style={{ color: 'var(--mc-m66)' }}>9 a 19 h</span>
            </div>
            <div className="flex justify-between gap-3 py-3" style={{ borderTop: '1px solid var(--mc-line)' }}>
                <span className="text-[15px] font-semibold">Domingos</span>
                <span className="text-[15px] font-medium text-right" style={{ color: 'var(--mc-m66)' }}>En el Punto de Información</span>
            </div>
        </div>

        <Rotulo className="mt-7 mb-2.5 ml-1.5">DÓNDE ESTAMOS</Rotulo>
        <div className={`${TARJETA} flex items-center gap-3.5 p-[18px]`} style={ESTILO_TARJETA}>
            <span className="w-9 h-9 flex-none rounded-full flex items-center justify-center" style={{ background: 'var(--mc-chip)' }}>
                <Icono d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{RESPONSABLE.direccion}</span>
                <span className="text-[13.5px] font-medium" style={{ color: 'var(--mc-m50)' }}>{RESPONSABLE.ciudad}</span>
            </span>
            <a
                href={COMO_LLEGAR}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-none min-h-[44px] px-4 rounded-full flex items-center text-[14px] font-semibold no-underline"
                style={{ background: 'var(--mc-chip)', color: 'var(--mc-ink)' }}
            >
                Cómo llegar
            </a>
        </div>
    </>
);

// ── Reportar un problema ────────────────────────────────────────────────

const PANTALLAS = ['Inicio', 'Grupos', 'Eventos', 'Compras', 'Mi cuenta', 'Otra'];

export const Reportar: React.FC<{ onVolver?: () => void; avisar: (t: string) => void }> = ({ onVolver, avisar }) => {
    const { user } = useAuth();
    const [texto, setTexto] = useState('');
    const [pantalla, setPantalla] = useState<string | null>(null);
    const [captura, setCaptura] = useState<File | null>(null);
    const [nombreCaptura, setNombreCaptura] = useState('');
    const [vistaCaptura, setVistaCaptura] = useState<string | null>(null);
    const [estado, setEstado] = useState<'quieto' | 'intentado' | 'enviando' | 'error'>('quieto');
    // La confirmación con el código (design-claude/Panel Admin - Reportes,
    // "Confirmación al usuario"). Con el código la persona puede referirse a
    // su reporte si después escribe por WhatsApp.
    const [confirmado, setConfirmado] = useState<{ codigo: string; sinCaptura: boolean } | null>(null);
    const [codigoCopiado, setCodigoCopiado] = useState(false);
    const campoTexto = useRef<HTMLTextAreaElement>(null);

    const version = typeof __BUILD_VERSION__ === 'string' ? __BUILD_VERSION__.slice(0, 7) : 'dev';
    const dispositivo = describirDispositivo();
    const corto = (() => {
        // Lo que se le muestra a la persona: el user agent entero no le dice
        // nada a nadie y ocupa cuatro renglones.
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
        const so = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'tu dispositivo';
        const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'tu navegador';
        return `${so} · ${nav}`;
    })();

    const corta = estado === 'intentado' && texto.trim().length < 10;

    const enviar = async () => {
        if (texto.trim().length < 10) { setEstado('intentado'); return; }
        setEstado('enviando');
        const r = await crearReporte({
            descripcion: texto,
            pantalla,
            captura,
            userId: user?.id || '',
            versionApp: version,
            dispositivo,
        });
        // Con error no hay panel: el texto queda donde estaba.
        if (!r.ok) { setEstado('error'); return; }
        setEstado('quieto');
        // El formulario se vacía ya: cerrar el panel de cualquier forma no
        // puede dejar el mismo reporte listo para mandarse otra vez.
        setTexto(''); setPantalla(null); setCaptura(null); setNombreCaptura(''); setVistaCaptura(null);
        setCodigoCopiado(false);
        setConfirmado({ codigo: codigoReporte(r.datos!.numero), sinCaptura: !!r.datos?.sinCaptura });
    };

    const copiarCodigo = async () => {
        if (!confirmado) return;
        let ok = false;
        try {
            if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(confirmado.codigo); ok = true; }
        } catch { /* cae al respaldo */ }
        if (!ok) {
            try {
                const ta = document.createElement('textarea');
                ta.value = confirmado.codigo; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.focus(); ta.select();
                ok = document.execCommand('copy');
                document.body.removeChild(ta);
            } catch { ok = false; }
        }
        if (ok) { setCodigoCopiado(true); window.setTimeout(() => setCodigoCopiado(false), 2000); }
        else avisar('No se pudo copiar el código');
    };

    // "Listo" vuelve a Mi cuenta; "Enviar otro" deja el formulario a mano.
    const listo = () => { setConfirmado(null); onVolver?.(); };
    const enviarOtro = () => { setConfirmado(null); window.setTimeout(() => campoTexto.current?.focus(), 250); };

    return (
        <>
            <EncabezadoSubpagina titulo="Reportar un problema" onVolver={onVolver} />

            <div className={`${TARJETA} mt-[22px] px-4 pt-1.5 pb-[18px]`} style={ESTILO_TARJETA}>
                <div className="pt-3.5">
                    <label htmlFor="mc-que-paso" className="block pl-1 text-[13.5px] font-semibold" style={{ color: 'var(--mc-m66)' }}>
                        ¿Qué pasó?
                    </label>
                    <textarea
                        id="mc-que-paso"
                        ref={campoTexto}
                        className={`mc-campo mt-2 ${corta ? 'mc-campo--mal' : ''}`}
                        rows={4}
                        placeholder="Contanos qué estabas haciendo y qué viste"
                        value={texto}
                        onChange={e => { setTexto(e.target.value); if (estado === 'error') setEstado('quieto'); }}
                    />
                    {corta && (
                        <p role="alert" className="flex items-start gap-2 mt-2.5 mb-0 ml-1 text-[13.5px] leading-[1.45] font-semibold">
                            <span className="w-5 h-5 flex-none rounded-full inline-flex items-center justify-center text-[12px] font-bold"
                                style={{ background: 'var(--mc-ink)', color: 'var(--mc-bg)' }}>!</span>
                            Contanos un poco más, así lo podemos encontrar.
                        </p>
                    )}
                </div>

                <div className="pt-[18px]">
                    <p className="m-0 pl-1 text-[13.5px] font-semibold" style={{ color: 'var(--mc-m66)' }}>¿En qué pantalla?</p>
                    <div role="radiogroup" className="flex flex-wrap gap-2 mt-2.5">
                        {PANTALLAS.map(p => (
                            <button
                                key={p}
                                type="button"
                                role="radio"
                                aria-checked={pantalla === p}
                                onClick={() => setPantalla(p)}
                                className="min-h-[44px] px-4 rounded-full border-0 font-[inherit] text-[14.5px] font-semibold cursor-pointer"
                                style={{
                                    background: pantalla === p ? 'var(--mc-prim)' : 'var(--mc-chip)',
                                    color: pantalla === p ? 'var(--mc-prim-ink)' : 'var(--mc-ink)',
                                    transition: 'background-color .15s ease',
                                }}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="pt-[18px]">
                    <p className="m-0 pl-1 text-[13.5px] font-semibold" style={{ color: 'var(--mc-m66)' }}>
                        Captura de pantalla (opcional)
                    </p>
                    {!captura ? (
                        <label className="relative flex items-center justify-center gap-2 min-h-[56px] mt-2.5 rounded-2xl text-[14.5px] font-semibold cursor-pointer"
                            style={{ boxShadow: 'inset 0 0 0 1.5px var(--mc-dash)', color: 'var(--mc-ink)' }}>
                            <Icono d="M12 16V5M7.5 9.5L12 5l4.5 4.5M5 19h14" tam={20} grosor={1.8} />
                            Adjuntar una captura
                            <input
                                type="file"
                                accept="image/*"
                                className="absolute w-px h-px opacity-0 pointer-events-none"
                                onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (!f) return;
                                    setCaptura(f);
                                    setNombreCaptura(f.name);
                                    setVistaCaptura(URL.createObjectURL(f));
                                    e.target.value = '';
                                }}
                            />
                        </label>
                    ) : (
                        <div className="flex items-center gap-3 mt-2.5 p-2.5 rounded-2xl" style={{ background: 'var(--mc-surf)' }}>
                            <div role="img" aria-label="Captura adjunta" className="w-12 h-16 flex-none rounded-lg bg-center bg-cover"
                                style={{ backgroundImage: vistaCaptura ? `url("${vistaCaptura}")` : undefined, background: vistaCaptura ? undefined : 'var(--mc-chip)' }} />
                            <span className="flex-1 min-w-0 text-[14px] font-semibold truncate">{nombreCaptura}</span>
                            <button
                                type="button"
                                onClick={() => { setCaptura(null); setNombreCaptura(''); setVistaCaptura(null); }}
                                className="min-h-[44px] px-3 border-0 bg-transparent rounded-full font-[inherit] text-[14px] font-bold underline underline-offset-[3px] cursor-pointer"
                                style={{ color: 'var(--mc-ink)' }}
                            >
                                Quitar
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-3.5 p-[18px] rounded-[22px]" style={{ background: 'var(--mc-chip)' }}>
                <p className="m-0 text-[14px] font-bold">Esto se envía automáticamente</p>
                <p className="mt-1.5 mb-0 text-[14px] leading-[1.5] font-medium" style={{ color: 'var(--mc-m66)' }}>
                    La versión de la app ({version}) y qué dispositivo y navegador usás ({corto}). Nos ayuda a
                    encontrar el problema. No mandamos nada más.
                </p>
            </div>

            {estado === 'error' && (
                <div role="alert" className="flex gap-2.5 items-start mt-3.5 px-4 py-3.5 rounded-[18px]"
                    style={{ boxShadow: 'inset 0 0 0 2px var(--mc-ink)' }}>
                    <span className="w-5 h-5 flex-none rounded-full inline-flex items-center justify-center text-[12px] font-bold"
                        style={{ background: 'var(--mc-ink)', color: 'var(--mc-bg)' }}>!</span>
                    <p className="m-0 text-[14.5px] leading-[1.45] font-semibold">
                        No se pudo enviar. Tu texto sigue acá: probá de nuevo.
                    </p>
                </div>
            )}

            <BotonPrimario ancho onClick={enviar} disabled={estado === 'enviando'} className="mt-4">
                {estado === 'enviando' && <Girito sobreOscuro />}
                {estado === 'enviando' ? 'Enviando…' : estado === 'error' ? 'Probar de nuevo' : 'Enviar'}
            </BotonPrimario>

            <Panel abierto={!!confirmado} onCerrar={listo} etiqueta="¡Gracias por avisarnos!">
                {confirmado && (
                    <div className="flex flex-col items-center text-center">
                        <span className="w-[76px] h-[76px] rounded-full flex items-center justify-center"
                            style={{ background: 'var(--mc-green-bg)', color: 'var(--mc-green-ink)', animation: 'mcTilde .45s ease both' }}>
                            <Icono d={ICONOS.tilde} tam={34} grosor={2.4} />
                        </span>
                        <h2 className="mt-5 mb-0 text-[25px] leading-[1.15] font-semibold tracking-[-.03em]">¡Gracias por avisarnos!</h2>
                        <p className="mt-4 mb-0 text-[15px] font-medium" style={{ color: 'var(--mc-m50)' }}>Tu reporte es el</p>
                        <div className="mt-2 w-full h-16 pl-5 pr-2 rounded-[20px] flex items-center gap-2.5" style={{ background: 'var(--mc-chip)' }}>
                            <span className="flex-1 text-left text-[24px] font-semibold tracking-[.01em]"
                                style={{ fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                                {confirmado.codigo}
                            </span>
                            <button type="button" onClick={copiarCodigo}
                                className="h-12 px-4 border-0 rounded-full flex items-center gap-1.5 text-[14px] font-semibold cursor-pointer font-[inherit]"
                                style={{
                                    background: codigoCopiado ? 'var(--mc-green-bg)' : 'var(--mc-card)',
                                    color: codigoCopiado ? 'var(--mc-green-ink)' : 'var(--mc-ink)',
                                    transition: 'background .2s',
                                }}>
                                {codigoCopiado && <Icono d={ICONOS.tilde} tam={14} grosor={2.6} />}
                                <span aria-live="polite">{codigoCopiado ? '¡Copiado!' : 'Copiar'}</span>
                            </button>
                        </div>
                        {confirmado.sinCaptura && (
                            <p className="mt-3 mb-0 w-full px-3.5 py-[11px] rounded-2xl text-[14px] font-semibold text-left"
                                style={{ background: 'var(--mc-amber-bg)', color: 'var(--mc-amber-ink)' }}>
                                Lo enviamos, pero la captura no se pudo subir.
                            </p>
                        )}
                        <p className="mt-4 mb-0 max-w-[340px] text-[15px] leading-[1.5] [text-wrap:pretty]" style={{ color: 'var(--mc-m66)' }}>
                            Lo vamos a revisar. Si necesitamos más datos, te escribimos.
                        </p>
                        <div className="mt-6 w-full flex flex-col gap-2">
                            <BotonPrimario ancho onClick={listo}>Listo</BotonPrimario>
                            <BotonSecundario ancho onClick={enviarOtro}>Enviar otro</BotonSecundario>
                        </div>
                    </div>
                )}
            </Panel>
        </>
    );
};

// ── Sobre la app ────────────────────────────────────────────────────────

export const SobreLaApp: React.FC<{ onVolver?: () => void }> = ({ onVolver }) => {
    const version = typeof __BUILD_VERSION__ === 'string' ? __BUILD_VERSION__ : 'dev';
    const [estado, setEstado] = useState<'quieto' | 'buscando' | 'ultima' | 'nueva' | 'error'>('quieto');
    const vivo = useRef(true);
    useEffect(() => () => { vivo.current = false; }, []);

    const buscar = async () => {
        setEstado('buscando');
        try {
            const { data, error } = await supabase
                .from('app_version')
                .select('version')
                .eq('id', 1)
                .single();
            if (!vivo.current) return;
            if (error || !data) { setEstado('error'); return; }
            // Misma regla que useVersionCheck: en desarrollo no hay versión
            // contra la cual comparar, así que nunca hay una "más nueva".
            const hayOtra = version !== 'dev' && !!data.version && data.version !== version;
            setEstado(hayOtra ? 'nueva' : 'ultima');
        } catch {
            if (vivo.current) setEstado('error');
        }
    };

    return (
        <>
            <EncabezadoSubpagina titulo="Sobre la app" onVolver={onVolver} />

            <div className="flex flex-col items-center text-center pt-7">
                <span className={`${TARJETA} w-24 h-24 flex items-center justify-center`} style={ESTILO_TARJETA}>
                    <img src="/nocturna/origen-arbol.png" alt="" className="w-[62px] h-auto" />
                </span>
                <p className="mt-[18px] mb-0 text-[22px] font-semibold tracking-[-.02em]">Origen App</p>
                <p className="mt-1 mb-0 text-[14.5px] font-medium" style={{ color: 'var(--mc-m50)' }}>
                    Versión {version.slice(0, 7)}
                </p>
            </div>

            <div className={`${TARJETA} mt-6 p-[18px] flex flex-col items-center text-center`} style={ESTILO_TARJETA}>
                {estado === 'quieto' && (
                    <p className="m-0 text-[14.5px] font-medium" style={{ color: 'var(--mc-m66)' }}>
                        Buscamos si hay una versión más nueva.
                    </p>
                )}
                {estado === 'buscando' && (
                    <p aria-live="polite" className="m-0 flex items-center gap-2.5 text-[15px] font-semibold">
                        <Girito />Buscando…
                    </p>
                )}
                {estado === 'ultima' && (
                    <p aria-live="polite" className="m-0 flex items-center gap-2 text-[15px] font-semibold" style={{ animation: 'mcAparece .2s ease' }}>
                        <span style={{ color: '#34c759' }}><Icono d={ICONOS.tilde} tam={18} grosor={3} /></span>
                        Estás en la última versión
                    </p>
                )}
                {estado === 'nueva' && (
                    <div style={{ animation: 'mcAparece .2s ease' }}>
                        <p className="m-0 text-[15.5px] font-semibold">Hay una versión nueva</p>
                        <p className="mt-1 mb-0 text-[14px] font-medium" style={{ color: 'var(--mc-m66)' }}>
                            Recargá para tenerla.
                        </p>
                    </div>
                )}
                {estado === 'error' && (
                    <p role="alert" className="m-0 flex items-center gap-2 text-[15px] font-semibold" style={{ animation: 'mcAparece .2s ease' }}>
                        <span className="w-5 h-5 flex-none rounded-full inline-flex items-center justify-center text-[12px] font-bold"
                            style={{ background: 'var(--mc-ink)', color: 'var(--mc-bg)' }}>!</span>
                        No pudimos buscar. Revisá tu conexión.
                    </p>
                )}

                {estado !== 'buscando' && estado !== 'nueva' && (
                    <BotonSecundario onClick={buscar} className="mt-3.5 min-h-[48px]">
                        {estado === 'error' ? 'Probar de nuevo' : 'Buscar actualización'}
                    </BotonSecundario>
                )}
                {estado === 'nueva' && (
                    <BotonPrimario onClick={() => window.location.reload()} className="mt-3.5 min-h-[48px]">
                        Actualizar
                    </BotonPrimario>
                )}
            </div>

            <p className="mt-6 mb-0 text-center text-[14px] leading-[1.6] font-medium text-pretty" style={{ color: 'var(--mc-m66)' }}>
                Hecha por el equipo de tecnología de {RESPONSABLE.nombre}, con la ayuda de voluntarios.
                <br />© 2026 {RESPONSABLE.razonSocial}
            </p>
        </>
    );
};

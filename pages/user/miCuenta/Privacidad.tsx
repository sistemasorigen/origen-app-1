import React, { useEffect, useState } from 'react';
import {
    BotonFantasma, BotonPrimario, BotonSecundario, EncabezadoSubpagina, ESTILO_TARJETA,
    Girito, Icono, ICONOS, Panel, Rotulo, TARJETA, TituloDePanel,
} from '../../../components/miCuenta/piezas';
import {
    CATEGORIAS_DE_DATOS, LEYENDA_AAIP, RESPONSABLE, WHATSAPP,
} from '../../../src/legal/terminosYPrivacidad';
import {
    crearSolicitudDatos, misSolicitudes,
    type SolicitudPropia, type TipoDeSolicitud,
} from '../../../services/miCuenta';

/**
 * Privacidad y mis datos — design-claude/Mi Cuenta - Privacidad y ayuda.dc.
 *
 * Es la pantalla de la Ley 25.326: qué tenemos de vos, para qué, quién lo ve
 * y cómo pedir una copia, una corrección o que lo borremos.
 *
 * ELIMINAR LA CUENTA NO BORRA NADA EN EL MOMENTO. Es una solicitud de tipo
 * 'supresion' que alguien resuelve a mano, y la pantalla lo dice con todas
 * las letras: "tu cuenta sigue activa". Un botón que borrara de verdad al
 * tercer toque sería un botón que no se puede deshacer.
 */

const TIPO_LEGIBLE: Record<TipoDeSolicitud, string> = {
    acceso: 'Acceso a mis datos',
    rectificacion: 'Corrección de datos',
    supresion: 'Eliminar mi cuenta',
};

const ESTADO_LEGIBLE: Record<string, string> = {
    recibida: 'Recibida',
    en_curso: 'En curso',
    resuelta: 'Resuelta',
};

const MOTIVOS = [
    'Ya no voy a Origen',
    'Me cambié de iglesia',
    'No uso la app',
    'Me preocupa mi privacidad',
    'Otro',
];

const fechaCorta = (iso: string): string => {
    try {
        return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return '';
    }
};

const pastilla = (estado: string): React.CSSProperties => {
    const [fondo, tinta] = estado === 'resuelta'
        ? ['var(--mc-green-bg)', 'var(--mc-green-ink)']
        : estado === 'en_curso'
            ? ['var(--mc-amber-bg)', 'var(--mc-amber-ink)']
            : ['var(--mc-chip)', 'var(--mc-ink)'];
    return {
        flex: 'none', display: 'inline-flex', alignItems: 'center', height: 26,
        padding: '0 10px', borderRadius: 999, background: fondo, color: tinta,
        fontSize: 12.5, fontWeight: 700,
    };
};

export interface PrivacidadProps {
    onVolver?: () => void;
    avisar: (texto: string) => void;
    /** 'eliminar' entra directo al flujo de baja. */
    modo?: 'privacidad' | 'eliminar';
    onIrAEliminar: () => void;
    onVolverAPrivacidad: () => void;
}

export const Privacidad: React.FC<PrivacidadProps> = ({
    onVolver, avisar, modo = 'privacidad', onIrAEliminar, onVolverAPrivacidad,
}) => {
    const [solicitudes, setSolicitudes] = useState<SolicitudPropia[] | null>(null);
    const [abiertas, setAbiertas] = useState<Record<number, boolean>>({});

    const [panel, setPanel] = useState<null | TipoDeSolicitud>(null);
    const [mensaje, setMensaje] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [numeroNuevo, setNumeroNuevo] = useState<string | null>(null);
    const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null);

    // El flujo de baja: 1 qué pasa · 2 motivo · 3 confirmar · 4 listo.
    const [paso, setPaso] = useState(1);
    const [motivo, setMotivo] = useState<number | null>(null);
    const [otroMotivo, setOtroMotivo] = useState('');
    const [confirmacion, setConfirmacion] = useState('');
    const [numeroBaja, setNumeroBaja] = useState<string | null>(null);

    const recargar = () => { misSolicitudes().then(setSolicitudes); };
    useEffect(() => { recargar(); }, []);
    useEffect(() => { if (modo === 'eliminar') setPaso(p => (p === 4 ? 4 : p)); }, [modo]);

    const enviarSolicitud = async () => {
        if (!panel || enviando) return;
        setEnviando(true);
        setErrorSolicitud(null);
        const r = await crearSolicitudDatos(panel, mensaje);
        setEnviando(false);

        if (!r.ok) {
            setErrorSolicitud(r.motivo === 'limite_6_meses'
                // El texto de la base ya está escrito para mostrarse: dice
                // desde cuándo se puede volver a pedir.
                ? (r.detalle || 'Ya pediste una copia de tus datos hace menos de 6 meses.')
                : 'No pudimos enviar tu solicitud. Revisá tu conexión y probá de nuevo.');
            return;
        }

        setNumeroNuevo(r.datos!.numero);
        setMensaje('');
        recargar();
    };

    const cerrarPanel = () => {
        setPanel(null);
        setNumeroNuevo(null);
        setErrorSolicitud(null);
        setMensaje('');
    };

    const confirmarBaja = async () => {
        if (confirmacion.trim().toUpperCase() !== 'ELIMINAR' || enviando) return;
        setEnviando(true);
        const texto = motivo === 4 ? otroMotivo.trim() : (motivo !== null ? MOTIVOS[motivo] : '');
        const r = await crearSolicitudDatos('supresion', null, texto || null);
        setEnviando(false);

        if (!r.ok) {
            avisar('No pudimos enviar tu pedido. Probá de nuevo.');
            return;
        }
        setNumeroBaja(r.datos!.numero);
        setPaso(4);
        recargar();
    };

    // ── Eliminar mi cuenta ──────────────────────────────────────────────
    if (modo === 'eliminar') {
        const puedeConfirmar = confirmacion.trim().toUpperCase() === 'ELIMINAR';

        return (
            <>
                <EncabezadoSubpagina
                    titulo="Eliminar mi cuenta"
                    onVolver={paso > 1 && paso < 4 ? () => setPaso(p => p - 1) : (onVolver || onVolverAPrivacidad)}
                />

                {paso < 4 && (
                    <div className="flex items-center gap-2.5 mt-4">
                        <div className="flex-1 grid grid-cols-3 gap-1.5">
                            {[1, 2, 3].map(i => (
                                <span key={i} className="h-[5px] rounded-full"
                                    style={{
                                        background: i <= paso ? 'var(--mc-ink)' : 'var(--mc-chip)',
                                        transition: 'background-color .3s ease',
                                    }} />
                            ))}
                        </div>
                        <span className="flex-none text-[13px] font-semibold" style={{ color: 'var(--mc-m50)' }}>
                            Paso {paso} de 3
                        </span>
                    </div>
                )}

                {paso === 1 && (
                    <>
                        <p className="mt-[22px] mb-0 text-[20px] leading-[1.3] font-semibold tracking-[-.02em]">
                            Qué pasa si eliminás tu cuenta
                        </p>
                        <div className={`${TARJETA} mt-4 px-4 py-1.5`} style={ESTILO_TARJETA}>
                            {[
                                [ICONOS.grupos, 'Salís de tus grupos', 'Tus anfitriones dejan de verte en la lista.'],
                                [ICONOS.entrada, 'Se cancelan tus inscripciones a eventos que no pasaron', 'Las entradas que ya tenías dejan de valer.'],
                                [ICONOS.afuera, 'Perdés el acceso a la app', 'No vas a poder entrar con esta cuenta ni ver tu historial.'],
                            ].map(([icono, titulo, detalle], i) => (
                                <div key={titulo} className="flex gap-3 items-start py-3.5"
                                    style={{ borderTop: i ? '1px solid var(--mc-line)' : '0' }}>
                                    <span className="w-9 h-9 flex-none rounded-full flex items-center justify-center"
                                        style={{ background: 'var(--mc-chip)' }}>
                                        <Icono d={icono} tam={18} />
                                    </span>
                                    <div className="min-w-0 pt-0.5">
                                        <p className="m-0 text-[15px] leading-[1.35] font-semibold">{titulo}</p>
                                        <p className="mt-1 mb-0 text-[13.5px] leading-[1.45] font-medium" style={{ color: 'var(--mc-m66)' }}>{detalle}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-3.5 p-[18px] rounded-[22px]"
                            style={{ background: 'var(--mc-surf)', boxShadow: 'inset 0 0 0 1px var(--mc-line)' }}>
                            <Rotulo className="!text-[11.5px]" >LO QUE GUARDAMOS IGUAL, Y POR QUÉ</Rotulo>
                            {[
                                ['Registros de compras y comprobantes', 'La ley contable y fiscal nos obliga a guardarlos hasta 10 años. Quedan separados de tu cuenta y sólo los ve administración.'],
                                ['El número de esta solicitud', 'Como constancia de que pediste la eliminación y de cuándo la resolvimos.'],
                            ].map(([t, d]) => (
                                <div key={t} className="mt-3">
                                    <p className="m-0 text-[15px] leading-[1.35] font-semibold">{t}</p>
                                    <p className="mt-1 mb-0 text-[13.5px] leading-[1.45] font-medium" style={{ color: 'var(--mc-m66)' }}>{d}</p>
                                </div>
                            ))}
                        </div>

                        <BotonPrimario ancho onClick={() => setPaso(2)} className="mt-5">Continuar</BotonPrimario>
                    </>
                )}

                {paso === 2 && (
                    <>
                        <p className="mt-[22px] mb-0 text-[20px] leading-[1.3] font-semibold tracking-[-.02em]">
                            ¿Nos contás por qué?
                        </p>
                        <p className="mt-1.5 mb-0 text-[15px] leading-[1.45] font-medium" style={{ color: 'var(--mc-m50)' }}>
                            Es opcional. Nos ayuda a mejorar.
                        </p>
                        <div role="radiogroup" className={`${TARJETA} mt-4`} style={ESTILO_TARJETA}>
                            {MOTIVOS.map((m, i) => (
                                <button
                                    key={m}
                                    type="button"
                                    role="radio"
                                    aria-checked={motivo === i}
                                    onClick={() => setMotivo(i)}
                                    className="w-full min-h-[60px] flex items-center gap-3.5 px-4 py-2.5 border-0 bg-transparent font-[inherit] cursor-pointer text-left"
                                    style={{ color: 'var(--mc-ink)', borderTop: i ? '1px solid var(--mc-line)' : '0' }}
                                >
                                    <span className="w-[22px] h-[22px] flex-none rounded-full flex items-center justify-center"
                                        style={{ boxShadow: `inset 0 0 0 2px ${motivo === i ? 'var(--mc-ink)' : 'var(--mc-m38)'}` }}>
                                        <span className="w-2.5 h-2.5 rounded-full"
                                            style={{ background: 'var(--mc-ink)', transform: `scale(${motivo === i ? 1 : 0})`, transition: 'transform .18s ease' }} />
                                    </span>
                                    <span className="flex-1 text-[15px] font-semibold">{m}</span>
                                </button>
                            ))}
                        </div>
                        {motivo === 4 && (
                            <textarea
                                className="mc-campo mt-3"
                                rows={3}
                                aria-label="Otro motivo"
                                placeholder="Contanos con tus palabras"
                                value={otroMotivo}
                                onChange={e => setOtroMotivo(e.target.value)}
                            />
                        )}
                        <div className="flex gap-2.5 mt-5">
                            <BotonFantasma onClick={() => setPaso(3)} className="flex-1">Saltar</BotonFantasma>
                            <BotonPrimario onClick={() => setPaso(3)} className="flex-[2]">Continuar</BotonPrimario>
                        </div>
                    </>
                )}

                {paso === 3 && (
                    <>
                        <p className="mt-[22px] mb-0 text-[20px] leading-[1.3] font-semibold tracking-[-.02em]">
                            Confirmá que querés eliminarla
                        </p>
                        <p className="mt-1.5 mb-0 text-[15px] leading-[1.5] font-medium text-pretty" style={{ color: 'var(--mc-m66)' }}>
                            Vamos a revisar tu pedido y te escribimos al email de tu cuenta para confirmarlo.
                        </p>
                        <label htmlFor="mc-eliminar" className="block mt-5 pl-1 text-[13.5px] font-semibold" style={{ color: 'var(--mc-m66)' }}>
                            Escribí ELIMINAR para confirmar
                        </label>
                        <input
                            id="mc-eliminar"
                            className="mc-campo mt-2"
                            style={{
                                height: 56, letterSpacing: '.12em', textTransform: 'uppercase',
                                fontWeight: 600,
                                borderColor: puedeConfirmar ? 'var(--mc-red)' : 'transparent',
                            }}
                            autoComplete="off"
                            autoCapitalize="characters"
                            spellCheck={false}
                            value={confirmacion}
                            onChange={e => setConfirmacion(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={confirmarBaja}
                            disabled={!puedeConfirmar || enviando}
                            className="w-full min-h-[52px] mt-4 rounded-full border-0 font-[inherit] text-[15.5px] font-semibold flex items-center justify-center gap-2"
                            style={{
                                background: '#d1343a', color: '#fff',
                                opacity: puedeConfirmar ? 1 : .35,
                                cursor: puedeConfirmar ? 'pointer' : 'default',
                            }}
                        >
                            {enviando && <Girito sobreOscuro />}
                            {enviando ? 'Enviando…' : 'Solicitar eliminación'}
                        </button>
                        <BotonFantasma ancho onClick={onVolverAPrivacidad} className="mt-2">Cancelar</BotonFantasma>
                    </>
                )}

                {paso === 4 && (
                    <div className="flex flex-col items-center text-center pt-12 px-2">
                        <span className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
                            style={{ background: 'var(--mc-chip)', animation: 'mcTilde .45s ease both' }}>
                            <Icono d={ICONOS.tilde} tam={32} grosor={2.4} />
                        </span>
                        <p className="mt-[22px] mb-0 text-[22px] leading-[1.25] font-semibold tracking-[-.02em]">
                            Recibimos tu pedido
                        </p>
                        <p className="mt-2 mb-0 text-[15px] font-semibold" style={{ color: 'var(--mc-m66)' }}>
                            N.º {numeroBaja}
                        </p>
                        <p className="mt-3.5 mb-0 max-w-[360px] text-[15.5px] leading-[1.5] font-medium text-pretty" style={{ color: 'var(--mc-m66)' }}>
                            Te escribimos en hasta 5 días hábiles para confirmarlo. Hasta entonces, tu cuenta sigue activa.
                        </p>
                        <BotonSecundario onClick={onVolverAPrivacidad} className="mt-6">Volver a Privacidad</BotonSecundario>
                    </div>
                )}
            </>
        );
    }

    // ── Privacidad y mis datos ──────────────────────────────────────────
    return (
        <>
            <EncabezadoSubpagina titulo="Privacidad y mis datos" onVolver={onVolver} />

            <p className="mt-3 mb-0 text-[15.5px] leading-[1.55] font-medium text-pretty" style={{ color: 'var(--mc-m66)' }}>
                Qué datos tenemos de vos, para qué los usamos y cómo pedirnos una copia, una corrección o que los
                borremos. Así lo pide la Ley 25.326 de Protección de Datos Personales.
            </p>

            <Rotulo className="mt-7 mb-2.5 ml-1.5">RESPONSABLE DE TUS DATOS</Rotulo>
            <div className={`${TARJETA} p-[18px]`} style={ESTILO_TARJETA}>
                <p className="m-0 text-[16px] leading-[1.4] font-semibold">
                    {RESPONSABLE.razonSocial} ({RESPONSABLE.nombre})
                </p>
                <p className="mt-1 mb-0 text-[14.5px] font-medium" style={{ color: 'var(--mc-m66)' }}>
                    CUIT {RESPONSABLE.cuit}
                </p>
                <p className="mt-1 mb-0 text-[14.5px] font-medium" style={{ color: 'var(--mc-m66)' }}>
                    {RESPONSABLE.direccion}, {RESPONSABLE.ciudad}
                </p>
                <a
                    href={WHATSAPP.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 min-h-[44px] mt-1.5 text-[15px] font-semibold underline underline-offset-[3px]"
                    style={{ color: 'var(--mc-ink)' }}
                >
                    <Icono d="M4 20l1.3-4A8 8 0 1112 20a8 8 0 01-3.9-1z" tam={18} grosor={1.8} />
                    {WHATSAPP.visible}
                </a>
            </div>

            <Rotulo className="mt-7 mb-2.5 ml-1.5">QUÉ DATOS TENEMOS DE VOS</Rotulo>
            <div className={TARJETA} style={ESTILO_TARJETA}>
                {CATEGORIAS_DE_DATOS.map((c, i) => (
                    <div key={c.nombre} style={{ borderTop: i ? '1px solid var(--mc-line)' : '0' }}>
                        <button
                            type="button"
                            aria-expanded={!!abiertas[i]}
                            onClick={() => setAbiertas(a => ({ ...a, [i]: !a[i] }))}
                            className="w-full min-h-[60px] flex items-center gap-3.5 px-4 py-2.5 border-0 bg-transparent font-[inherit] cursor-pointer text-left"
                            style={{ color: 'var(--mc-ink)' }}
                        >
                            <span className="w-9 h-9 flex-none rounded-full flex items-center justify-center"
                                style={{ background: 'var(--mc-chip)' }}>
                                <Icono d={c.icono} />
                            </span>
                            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                                <span className="text-[15px] font-semibold">{c.nombre}</span>
                                <span className="text-[13px] leading-[1.4] font-medium" style={{ color: 'var(--mc-m50)' }}>{c.resumen}</span>
                            </span>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                                className="flex-none"
                                style={{ color: 'var(--mc-m50)', transition: 'transform .25s ease', transform: `rotate(${abiertas[i] ? 180 : 0}deg)` }}>
                                <path d="M6 9.5l6 6 6-6" />
                            </svg>
                        </button>
                        {abiertas[i] && (
                            <div className="flex flex-col gap-3 px-[18px] pb-[18px] pl-[66px] pt-0.5" style={{ animation: 'mcAparece .2s ease' }}>
                                {[['QUÉ GUARDAMOS', c.que], ['PARA QUÉ', c.para], ['QUIÉN LO VE', c.quien]].map(([r, texto]) => (
                                    <div key={r}>
                                        <p className="m-0 text-[11.5px] font-bold tracking-[.07em]" style={{ color: 'var(--mc-m50)' }}>{r}</p>
                                        <p className="mt-1 mb-0 text-[14.5px] leading-[1.5] font-medium text-pretty">{texto}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <Rotulo className="mt-7 mb-2.5 ml-1.5">TUS DERECHOS</Rotulo>
            <div className="flex flex-col gap-3">
                {[
                    {
                        rotulo: 'ACCESO', titulo: 'Pedí una copia de todos tus datos',
                        detalle: 'Es gratis, una vez cada 6 meses. Te respondemos en hasta 10 días corridos, al email de tu cuenta.',
                        acciones: [{ texto: 'Pedir mis datos', onClick: () => setPanel('acceso') }],
                    },
                    {
                        rotulo: 'RECTIFICACIÓN', titulo: 'Corregí lo que esté mal',
                        detalle: 'Casi todo lo podés cambiar vos desde tu perfil. Para lo demás, te respondemos en hasta 5 días hábiles.',
                        acciones: [{ texto: 'Pedir una corrección', onClick: () => setPanel('rectificacion') }],
                    },
                ].map(d => (
                    <div key={d.rotulo} className={`${TARJETA} p-[18px]`} style={ESTILO_TARJETA}>
                        <p className="m-0 text-[11.5px] font-bold tracking-[.07em]" style={{ color: 'var(--mc-m50)' }}>{d.rotulo}</p>
                        <p className="mt-1.5 mb-0 text-[16.5px] leading-[1.35] font-semibold">{d.titulo}</p>
                        <p className="mt-1.5 mb-0 text-[14px] leading-[1.5] font-medium" style={{ color: 'var(--mc-m66)' }}>{d.detalle}</p>
                        <div className="flex flex-wrap gap-2 mt-3.5">
                            {d.acciones.map(a => (
                                <BotonSecundario key={a.texto} onClick={a.onClick} className="min-h-[48px]">{a.texto}</BotonSecundario>
                            ))}
                        </div>
                    </div>
                ))}

                <div className={`${TARJETA} p-[18px]`} style={ESTILO_TARJETA}>
                    <p className="m-0 text-[11.5px] font-bold tracking-[.07em]" style={{ color: 'var(--mc-m50)' }}>SUPRESIÓN</p>
                    <p className="mt-1.5 mb-0 text-[16.5px] leading-[1.35] font-semibold">Pedí que borremos tus datos</p>
                    <p className="mt-1.5 mb-0 text-[14px] leading-[1.5] font-medium" style={{ color: 'var(--mc-m66)' }}>
                        Te respondemos en hasta 5 días hábiles.
                    </p>
                    <BotonSecundario onClick={onIrAEliminar} className="mt-3.5 min-h-[48px]" style={{ color: 'var(--mc-red)' }}>
                        Eliminar mi cuenta
                    </BotonSecundario>
                </div>
            </div>

            <Rotulo className="mt-7 mb-2.5 ml-1.5">MIS SOLICITUDES</Rotulo>
            {solicitudes === null ? (
                <div className={`${TARJETA} p-[18px]`} style={ESTILO_TARJETA}>
                    <p className="m-0 text-[14.5px] font-medium" style={{ color: 'var(--mc-m66)' }}>Buscando…</p>
                </div>
            ) : solicitudes.length === 0 ? (
                <div className={`${TARJETA} p-[18px]`} style={ESTILO_TARJETA}>
                    <p className="m-0 text-[14.5px] leading-[1.5] font-medium" style={{ color: 'var(--mc-m66)' }}>
                        Todavía no hiciste ninguna solicitud. Cuando hagas una, vas a ver acá en qué estado está.
                    </p>
                </div>
            ) : (
                <div className={TARJETA} style={ESTILO_TARJETA}>
                    {solicitudes.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-3.5 min-h-[64px] px-4 py-3"
                            style={{ borderTop: i ? '1px solid var(--mc-line)' : '0' }}>
                            <span className="flex-none text-[13.5px] font-semibold" style={{ color: 'var(--mc-m66)' }}>
                                N.º {s.numero}
                            </span>
                            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                                <span className="text-[15px] font-semibold">{TIPO_LEGIBLE[s.tipo]}</span>
                                <span className="text-[13px] font-medium" style={{ color: 'var(--mc-m50)' }}>{fechaCorta(s.createdAt)}</span>
                            </span>
                            <span style={pastilla(s.estado)}>{ESTADO_LEGIBLE[s.estado] || s.estado}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* La leyenda que exige la ley. TEXTUAL: no se acorta ni se reescribe. */}
            <div className="mt-7 p-[18px] rounded-[22px]" style={{ boxShadow: 'inset 0 0 0 1px var(--mc-dash)' }}>
                <p className="m-0 text-[14px] leading-[1.6] font-medium text-pretty" style={{ color: 'var(--mc-m66)' }}>
                    {LEYENDA_AAIP}
                </p>
            </div>

            <Panel abierto={!!panel} onCerrar={cerrarPanel} etiqueta="Nueva solicitud">
                {numeroNuevo ? (
                    <div className="flex flex-col items-center text-center pt-3 pb-1">
                        <span className="w-16 h-16 rounded-full flex items-center justify-center"
                            style={{ background: 'var(--mc-chip)', animation: 'mcTilde .45s ease both' }}>
                            <Icono d={ICONOS.tilde} tam={28} grosor={2.4} />
                        </span>
                        <p className="mt-[18px] mb-0 text-[20px] leading-[1.3] font-semibold tracking-[-.02em]">
                            Solicitud N.º {numeroNuevo} recibida
                        </p>
                        <p className="mt-2 mb-0 text-[15px] leading-[1.5] font-medium" style={{ color: 'var(--mc-m66)' }}>
                            Te respondemos al email de tu cuenta.
                        </p>
                        <BotonPrimario ancho onClick={cerrarPanel} className="mt-[22px]">Listo</BotonPrimario>
                    </div>
                ) : (
                    <>
                        <TituloDePanel titulo="Nueva solicitud" />
                        <span className="inline-flex items-center h-8 mt-3 px-3.5 rounded-full text-[14px] font-semibold"
                            style={{ background: 'var(--mc-chip)' }}>
                            {panel ? TIPO_LEGIBLE[panel] : ''}
                        </span>
                        <p className="mt-3 mb-0 text-[14.5px] leading-[1.5] font-medium" style={{ color: 'var(--mc-m66)' }}>
                            {panel === 'acceso'
                                ? 'Te mandamos una copia de todos tus datos. Te respondemos en hasta 10 días corridos.'
                                : 'Contanos qué dato está mal y cuál es el correcto. Te respondemos en hasta 5 días hábiles.'}
                        </p>
                        <label htmlFor="mc-solicitud" className="block mt-4 pl-1 text-[13.5px] font-semibold" style={{ color: 'var(--mc-m66)' }}>
                            Contanos qué necesitás (opcional)
                        </label>
                        <textarea
                            id="mc-solicitud"
                            className="mc-campo mt-2"
                            rows={3}
                            value={mensaje}
                            onChange={e => { setMensaje(e.target.value); setErrorSolicitud(null); }}
                        />
                        {errorSolicitud && (
                            <p role="alert" className="flex items-start gap-2 mt-3 mb-0 text-[13.5px] leading-[1.45] font-semibold">
                                <span className="w-5 h-5 flex-none rounded-full inline-flex items-center justify-center text-[12px] font-bold"
                                    style={{ background: 'var(--mc-ink)', color: 'var(--mc-bg)' }}>!</span>
                                {errorSolicitud}
                            </p>
                        )}
                        <BotonPrimario ancho onClick={enviarSolicitud} disabled={enviando} className="mt-4">
                            {enviando && <Girito sobreOscuro />}
                            {enviando ? 'Enviando…' : 'Enviar solicitud'}
                        </BotonPrimario>
                        <BotonFantasma ancho onClick={cerrarPanel} className="mt-2">Cancelar</BotonFantasma>
                    </>
                )}
            </Panel>
        </>
    );
};

export default Privacidad;

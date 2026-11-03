import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getMisTestimonios, LIMITE_MOTIVO, mensajeDeMotivo, solicitarEliminacion,
    type MiTestimonio, type Temporada,
} from '../../../services/testimonios';
import { cortar, hayQueCortar, useCargaHabilitada } from '../../testimonios/piezas';
import {
    BotonFantasma, BotonPrimario, EncabezadoSubpagina, ESTILO_TARJETA, EsqueletoDeSeccion,
    Girito, Icono, ICONOS, Panel, TARJETA, TituloDePanel, Vacio,
} from '../../../components/miCuenta/piezas';

/**
 * "Mis testimonios" — lo que cada uno contó de sus GCX.
 *
 * El mismo molde que "Solicitudes": la pastilla de estado arriba a la
 * derecha, el texto cortado abajo y las acciones al pie. Y la misma idea
 * detrás: lo que la persona viene a ver es EN QUÉ QUEDÓ, no el texto —el
 * texto ya lo escribió ella—, así que el estado va escrito desde su lado
 * ("Pediste eliminarlo", "No visible") y no con la palabra de la base
 * ('eliminacion_solicitada', 'oculto').
 *
 * NO HAY "EDITAR", y no es un olvido: un testimonio publicado no se edita
 * nunca (la base tampoco lo deja). Lo que hay es pedir que lo eliminen.
 *
 * Datos: services/testimonios.ts → testimonios_mios(), que filtra por
 * auth.uid() en la base. Acá no se pide por persona ni se podría.
 */

const MESES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** '2026-10-23T…' → '23 de octubre', con el año sólo si no es éste. */
const fechaDe = (ts: string | null): string => {
    if (!ts) return '';
    const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '';
    const anio = d.getFullYear() === new Date().getFullYear() ? '' : ` de ${d.getFullYear()}`;
    return `${d.getDate()} de ${MESES[d.getMonth()]}${anio}`;
};

type Tono = 'bien' | 'espera' | 'no';

const TONO: Record<Tono, React.CSSProperties> = {
    bien: { background: 'var(--mc-green-bg)', color: 'var(--mc-green-ink)' },
    espera: { background: 'var(--mc-amber-bg)', color: 'var(--mc-amber-ink)' },
    no: { background: 'var(--mc-chip)', color: 'var(--mc-m50)' },
};

/**
 * Qué decir de un testimonio, en dos palabras y una línea de explicación.
 *
 * 'publicado' con una decisión de 'pedido_rechazado' sigue siendo "Publicado"
 * —es lo que la persona ve en la página—, pero se le cuenta que su pedido se
 * revisó: pidió que lo saquen, y lo que pasó fue que se quedó.
 */
const comoEsta = (t: MiTestimonio): { texto: string; tono: Tono; nota?: string } => {
    if (t.estado === 'eliminacion_solicitada') {
        return {
            texto: 'Pediste eliminarlo', tono: 'espera',
            nota: 'Está oculto mientras Sistemas revisa tu pedido.',
        };
    }
    if (t.estado === 'oculto') {
        return {
            texto: 'No visible', tono: 'no',
            nota: 'Sistemas lo ocultó de la página de testimonios.',
        };
    }
    return {
        texto: 'Publicado', tono: 'bien',
        nota: t.decision === 'pedido_rechazado'
            ? 'Revisamos tu pedido y lo mantuvimos publicado.'
            : undefined,
    };
};

const corazonesDe = (n: number): string =>
    n === 0 ? 'Todavía sin corazones' : n === 1 ? '1 corazón' : `${n} corazones`;

const Pastilla: React.FC<{ texto: string; tono: Tono }> = ({ texto, tono }) => (
    <span
        className="inline-flex flex-none items-center h-[26px] px-2.5 rounded-full text-[12.5px] font-bold"
        style={TONO[tono]}
    >
        {texto}
    </span>
);

/** Las acciones del pie: pastillas de 46px, que entran dos por fila en 390px. */
const Accion: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { rojo?: boolean }> = ({
    rojo, className = '', style, ...resto
}) => (
    <button
        type="button"
        className={`flex-1 min-w-[132px] min-h-[46px] px-4 rounded-full border-0 font-[inherit] text-[14.5px] font-semibold cursor-pointer flex items-center justify-center gap-2 ${className}`}
        style={{ background: 'var(--mc-chip)', color: rojo ? 'var(--mc-red)' : 'var(--mc-ink)', ...style }}
        {...resto}
    />
);

const Corazon: React.FC = () => (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="flex-none">
        <path d="M12 20s-7.2-4.3-7.2-9.2A4.3 4.3 0 0112 8.4a4.3 4.3 0 017.2 2.4C19.2 15.7 12 20 12 20z" />
    </svg>
);

const Tarjeta: React.FC<{
    t: MiTestimonio;
    onVer: () => void;
    onPedir: () => void;
}> = ({ t, onVer, onPedir }) => {
    const [abierto, setAbierto] = useState(false);
    const estado = comoEsta(t);
    const largo = hayQueCortar(t.texto);
    // Pedir eliminar uno que ya está pedido no existe: la base contesta que
    // ya estaba y no vuelve a avisarle a Sistemas.
    const sePuedePedir = t.estado === 'publicado' || t.estado === 'oculto';

    return (
        <div className={`${TARJETA} p-4`} style={ESTILO_TARJETA}>
            <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex items-center gap-3">
                    {/* La portada del GCX; sin foto, el ícono de la sección,
                        que se lee como una miniatura a propósito y no como una
                        imagen que no cargó. */}
                    <span
                        aria-hidden="true"
                        className="w-11 h-11 flex-none rounded-[14px] overflow-hidden flex items-center justify-center"
                        style={{
                            background: 'var(--mc-chip)',
                            color: 'var(--mc-m38)',
                            ...(t.grupo.portada
                                ? {
                                    backgroundImage: `url("${t.grupo.portada.replace(/"/g, '%22')}")`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }
                                : {}),
                        }}
                    >
                        {!t.grupo.portada && <Icono d={ICONOS.testimonio} tam={20} grosor={1.8} />}
                    </span>
                    <span className="min-w-0 flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold leading-[1.3] line-clamp-2">
                            {t.grupo.nombre}
                        </span>
                        <span className="text-[13px] font-medium leading-[1.35]" style={{ color: 'var(--mc-m50)' }}>
                            {t.temporada} · {t.anio}
                        </span>
                    </span>
                </span>
                <Pastilla texto={estado.texto} tono={estado.tono} />
            </div>

            <p
                className="mb-0 mt-3 text-[14px] font-medium leading-[1.5] whitespace-pre-line"
                style={{ color: 'var(--mc-m66)' }}
            >
                {largo && !abierto ? cortar(t.texto) : t.texto}
            </p>
            {largo && (
                <button
                    type="button"
                    onClick={() => setAbierto(v => !v)}
                    aria-expanded={abierto}
                    className="mt-1.5 border-0 bg-transparent p-0 font-[inherit] text-[13.5px] font-semibold cursor-pointer"
                    style={{ color: 'var(--mc-ink)' }}
                >
                    {abierto ? 'Ver menos' : 'Ver más'}
                </button>
            )}

            <p className="mb-0 mt-2.5 flex items-center gap-1.5 text-[13px] font-medium leading-[1.45]" style={{ color: 'var(--mc-m50)' }}>
                <Corazon />
                {corazonesDe(t.corazones)}
                <span aria-hidden="true">·</span>
                Publicado el {fechaDe(t.creado)}
            </p>

            {estado.nota && (
                <p className="mb-0 mt-2.5 text-[13.5px] font-semibold leading-[1.45]" style={{ color: 'var(--mc-m66)' }}>
                    {estado.nota}
                </p>
            )}

            {(t.visible || sePuedePedir) && (
                <div className="mt-3.5 flex flex-wrap gap-2">
                    {/* Sólo si hoy se ve de verdad: el de una temporada vieja
                        sigue "publicado", pero la página de testimonios es la
                        de la temporada vigente y el link no llevaría a nada. */}
                    {t.visible && (
                        <Accion onClick={onVer}>
                            Ver publicado
                            <Icono d={ICONOS.afuera} tam={15} grosor={2.2} />
                        </Accion>
                    )}
                    {sePuedePedir && (
                        <Accion rojo onClick={onPedir}>Solicitar eliminación</Accion>
                    )}
                </div>
            )}
        </div>
    );
};

export const MisTestimonios: React.FC<{
    onVolver?: () => void;
    avisar: (texto: string) => void;
}> = ({ onVolver, avisar }) => {
    const navigate = useNavigate();
    const [lista, setLista] = useState<MiTestimonio[] | null>(null);
    const [temporada, setTemporada] = useState<Temporada | null>(null);
    /** Sistemas puede tener apagada /testimonios-gcx: entonces no se ofrece. */
    const cargaHabilitada = useCargaHabilitada();
    const [falló, setFalló] = useState(false);
    const [intento, setIntento] = useState(0);

    // El pedido de eliminación: cuál, el motivo (opcional) y en qué anda.
    const [pedido, setPedido] = useState<MiTestimonio | null>(null);
    const [motivo, setMotivo] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let vigente = true;
        setLista(null);
        setFalló(false);
        getMisTestimonios().then(r => {
            if (!vigente) return;
            // Una consulta que falla NO es "no dejaste testimonios": decirlo
            // sería mentirle a alguien que sí escribió y viene a verlo.
            if (r.ok) { setLista(r.testimonios); setTemporada(r.temporada); }
            else setFalló(true);
        });
        return () => { vigente = false; };
    }, [intento]);

    const abrirPedido = (t: MiTestimonio) => {
        setPedido(t);
        setMotivo('');
        setError(null);
    };

    const confirmarPedido = async () => {
        if (!pedido || enviando) return;
        setEnviando(true);
        setError(null);
        const r = await solicitarEliminacion(pedido.id, motivo);
        setEnviando(false);
        if (!r.ok) { setError(mensajeDeMotivo(r)); return; }

        // La tarjeta cambia de estado acá mismo: la base ya lo ocultó, y
        // volver a pedir la lista entera para mover una pastilla sería dejar
        // la pantalla en blanco por nada.
        const ahora = new Date().toISOString();
        setLista(prev => (prev || []).map(x => (x.id === pedido.id
            ? {
                ...x,
                estado: 'eliminacion_solicitada' as const,
                eliminacionPedida: ahora,
                eliminacionMotivo: motivo.trim() || null,
                decision: null,
                decidido: null,
                visible: false,
            }
            : x)));
        setPedido(null);
        avisar('Pedido enviado');
    };

    const quedan = LIMITE_MOTIVO - motivo.length;

    return (
        <>
            <EncabezadoSubpagina titulo="Mis testimonios" onVolver={onVolver} />

            {falló ? (
                <Vacio
                    icono={ICONOS.testimonio}
                    titulo="No pudimos traer tus testimonios"
                    detalle="Puede ser la conexión. Probá de nuevo en un momento; lo que escribiste no se perdió."
                    accion={{ texto: 'Reintentar', onClick: () => setIntento(n => n + 1) }}
                />
            ) : lista === null ? <EsqueletoDeSeccion filas={2} />
                : lista.length === 0 ? (
                    <Vacio
                        icono={ICONOS.testimonio}
                        titulo="Todavía no dejaste testimonios"
                        detalle="Si fuiste parte de un GCX, podés contar lo que viviste para que otras personas lo lean."
                        accion={temporada?.cargaAbierta && cargaHabilitada
                            ? { texto: 'Dejar mi testimonio', onClick: () => navigate('/testimonios-gcx') }
                            : undefined}
                    />
                ) : (
                    <div className="mt-6 flex flex-col gap-3">
                        {lista.map(t => (
                            <Tarjeta
                                key={t.id}
                                t={t}
                                onVer={() => navigate(`/testimonios/${t.grupo.id}?testimonio=${t.id}`)}
                                onPedir={() => abrirPedido(t)}
                            />
                        ))}
                    </div>
                )}

            <Panel
                abierto={!!pedido}
                onCerrar={() => { if (!enviando) setPedido(null); }}
                etiqueta="¿Pedimos que lo eliminen?"
            >
                <TituloDePanel
                    titulo="¿Pedimos que lo eliminen?"
                    detalle="Tu testimonio se oculta de la página de testimonios desde ahora. Sistemas revisa el pedido y te avisa qué decidió. Si se elimina, no se puede recuperar."
                />

                <label htmlFor="mc-motivo-testimonio" className="block mt-4 pl-1 text-[13.5px] font-semibold" style={{ color: 'var(--mc-m66)' }}>
                    Motivo (opcional)
                </label>
                <textarea
                    id="mc-motivo-testimonio"
                    className="mc-campo mt-2"
                    rows={3}
                    maxLength={LIMITE_MOTIVO}
                    value={motivo}
                    onChange={e => { setMotivo(e.target.value.slice(0, LIMITE_MOTIVO)); setError(null); }}
                />
                <p className="mt-1.5 mb-0 text-right text-[12.5px] font-semibold" aria-live="polite" style={{ color: 'var(--mc-m50)' }}>
                    {motivo.length} / {LIMITE_MOTIVO}
                    {quedan <= 50 && <span className="ml-1.5" style={{ color: 'var(--mc-amber-ink)' }}>Te quedan {quedan}</span>}
                </p>

                {error && (
                    <p role="alert" className="flex items-start gap-2 mt-3 mb-0 text-[13.5px] leading-[1.45] font-semibold">
                        <span className="w-5 h-5 flex-none rounded-full inline-flex items-center justify-center text-[12px] font-bold"
                            style={{ background: 'var(--mc-ink)', color: 'var(--mc-bg)' }}>!</span>
                        {error}
                    </p>
                )}

                <BotonPrimario
                    ancho
                    onClick={confirmarPedido}
                    disabled={enviando}
                    className="mt-4"
                    style={{ background: 'var(--mc-red)' }}
                >
                    {enviando && <Girito sobreOscuro />}
                    {enviando ? 'Enviando…' : 'Solicitar eliminación'}
                </BotonPrimario>
                <BotonFantasma ancho onClick={() => { if (!enviando) setPedido(null); }} className="mt-2">
                    Volver atrás
                </BotonFantasma>
            </Panel>
        </>
    );
};

export default MisTestimonios;

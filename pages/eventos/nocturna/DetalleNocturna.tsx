import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, Loader2, Pencil } from 'lucide-react';
import { useBloqueoDeFondo } from '../../../hooks/useBloqueoDeFondo';
import { probarConexionBase, supabaseService } from '../../../services/supabaseService';
import { calcularEdad, contarAcreditados, estadoInscripcion } from '../../../src/utils/nocturna';
import { NocturnaInscripcion, NocturnaJoven, User } from '../../../types';
import { COLOR_TRIBU, enLista, etiquetaRestriccion, plata } from './compartido/formulario';
import {
    AMBAR,
    AMBAR_INK,
    BORDE,
    CAMPO,
    CAMPO_HONDO,
    CARTA,
    ESTILOS_PANEL,
    estiloEstado,
    estiloPunto,
    FONDO,
    fuente,
    INK,
    ROJO,
    ROSA,
    VERDE,
    VERDE_FONDO,
} from './compartido/estilos';

/**
 * La ficha completa de una inscripción.
 *
 * El dato que manda acá es el retiro: a las 6 de la mañana alguien va a
 * buscar quién se lleva a cada chico, con sueño y apurado. Por eso va primero
 * y en grande, antes que los datos de contacto o el pago.
 *
 * Los tildes de ingreso cambian en pantalla y recién se escriben al tocar
 * "Guardar cambios": así se puede corregir un error de dedo sin que quede
 * registrado, y nada se da por guardado si la base no lo confirmó.
 */

interface Props {
    currentUser: User;
}

const fechaLarga = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
};

const hora = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    // 24 horas: el evento va de las 23 a las 6 y hay que compararlo con un reloj.
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
};

/**
 * Los chicos agrupados por cómo se retiran.
 *
 * Casi siempre la familia entera sale igual, y repetir tres veces el mismo
 * nombre con el mismo DNI es ruido justo cuando hay que leerlo rápido. Se
 * agrupan por retiro y, si alguno sale distinto, queda en su propio bloque.
 */
const agruparPorRetiro = (jovenes: NocturnaJoven[]): { clave: string; chicos: NocturnaJoven[] }[] => {
    const grupos: { clave: string; chicos: NocturnaJoven[] }[] = [];
    for (const j of jovenes) {
        const r = j.retiro || { tipo: 'adulto' };
        const clave = [r.tipo, r.nombre || '', r.apellido || '', r.dni || '', r.telefono || ''].join('|');
        const existente = grupos.find(g => g.clave === clave);
        if (existente) existente.chicos.push(j);
        else grupos.push({ clave, chicos: [j] });
    }
    return grupos;
};

/** Quién retira a este chico, en una frase. */
const quienRetira = (j: NocturnaJoven, adulto: string): string => {
    if (j.retiro?.tipo === 'solo') return 'Se retira solo';
    if (j.retiro?.tipo === 'adulto') return `Lo retira ${adulto}`;
    const n = `${j.retiro?.nombre || ''} ${j.retiro?.apellido || ''}`.trim();
    return n ? `Lo retira ${n}` : 'Lo retira otra persona';
};

const DetalleNocturna: React.FC<Props> = ({ currentUser }) => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();

    const [insc, setInsc] = useState<NocturnaInscripcion | null>(null);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);
    const [nombreAdmin, setNombreAdmin] = useState<string | null>(null);

    // Los tildes, en pantalla. Se escriben al guardar.
    const [chicosMarcados, setChicosMarcados] = useState<Record<string, boolean>>({});

    const [confirmando, setConfirmando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [errorGuardar, setErrorGuardar] = useState<{ conexion: boolean; texto: string } | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const [ocupado, setOcupado] = useState<string | null>(null);
    const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null);

    const [salidaPendiente, setSalidaPendiente] = useState<null | (() => void)>(null);

    useBloqueoDeFondo(confirmando || !!comprobanteUrl || !!salidaPendiente);

    // ── Carga ─────────────────────────────────────────────────────────────
    const cargar = useCallback(async () => {
        if (!id) return;
        setErrorCarga(null);
        const res = await supabaseService.getNocturnaInscripcion(id);
        if (!res.ok || !res.inscripcion) {
            setErrorCarga(res.error || 'No pudimos leer la inscripción.');
            setCargando(false);
            return;
        }
        const i = res.inscripcion;
        setInsc(i);
        setChicosMarcados(Object.fromEntries((i.jovenes || []).map(j => [j.id, !!j.acreditadoAt])));
        if (i.cargadoPorAdmin) {
            const nombres = await supabaseService.nombresDeUsuarios([i.cargadoPorAdmin]);
            setNombreAdmin(nombres[i.cargadoPorAdmin] || null);
        }
        setCargando(false);
    }, [id]);

    useEffect(() => { cargar(); }, [cargar]);

    useEffect(() => {
        if (!aviso) return;
        const t = setTimeout(() => setAviso(null), 4500);
        return () => clearTimeout(t);
    }, [aviso]);

    // ── Derivados ─────────────────────────────────────────────────────────
    const jovenes = insc?.jovenes || [];
    const nombreAdulto = insc ? `${insc.adultoNombre} ${insc.adultoApellido}`.trim() : '';

    const hayCambios = useMemo(() => {
        if (!insc) return false;
        return jovenes.some(j => !!chicosMarcados[j.id] !== !!j.acreditadoAt);
    }, [insc, jovenes, chicosMarcados]);

    const marcados = jovenes.filter(j => chicosMarcados[j.id]).length;
    const totalPersonas = jovenes.length;

    // Un `beforeunload` para cerrar la pestaña, y un aviso propio para
    // navegar dentro de la app: el navegador no avisa de lo segundo.
    const hayCambiosRef = useRef(false);
    useEffect(() => { hayCambiosRef.current = hayCambios; }, [hayCambios]);
    useEffect(() => {
        const avisar = (e: BeforeUnloadEvent) => {
            if (!hayCambiosRef.current) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', avisar);
        return () => window.removeEventListener('beforeunload', avisar);
    }, []);

    /**
     * Salir avisando.
     *
     * Sin esto, alguien desmarca a un chico, vuelve a la planilla y se queda
     * creyendo que lo registró: los tildes todavía estaban sólo en pantalla.
     */
    const salir = (a: () => void) => {
        if (hayCambios) { setSalidaPendiente(() => a); return; }
        a();
    };

    // ── Acciones ──────────────────────────────────────────────────────────
    const alternar = (clave: string) => {
        setErrorGuardar(null);
        setChicosMarcados(m => ({ ...m, [clave]: !m[clave] }));
    };

    const guardarIngreso = async () => {
        if (!insc || guardando) return;
        setGuardando(true);
        setErrorGuardar(null);

        const ids = jovenes.filter(j => chicosMarcados[j.id]).map(j => j.id);
        // La foto del estado que esta pantalla tenía cuando cargó —`insc` sólo
        // cambia al recargar—. Si en la base ya no es ese, alguien acreditó
        // mientras tanto y guardar borraría su trabajo: la base rechaza y
        // devuelve lo que hay de verdad.
        const res = await supabaseService.setNocturnaAcreditacion(insc.id, false, ids, {
            modo: 'exacto',
            visto: {
                // Lo que la pantalla vio del adulto se sigue mandando tal cual:
                // es parte de la foto con la que la base detecta el choque con
                // otra pantalla, no algo que esta ficha quiera cambiar.
                adulto: !!insc.adultoAcreditadoAt,
                jovenes: jovenes.filter(j => j.acreditadoAt).map(j => j.id),
            },
        });

        if (!res.ok) {
            // Choque con otra pantalla: no es un error de conexión ni algo que
            // convenga reintentar a ciegas. Se recarga la ficha para que se vea
            // cómo quedó y se decida sobre lo que hay.
            if (res.motivo === 'cambio') {
                await cargar();
                setGuardando(false);
                setConfirmando(false);
                setErrorGuardar({ conexion: false, texto: res.error || 'La familia cambió mientras tenías la ficha abierta.' });
                return;
            }

            // Nada se da por guardado sin que la base lo confirme: un tilde
            // verde que no se escribió deja a alguien contado de más.
            const hayBase = await probarConexionBase();
            setErrorGuardar(hayBase
                ? { conexion: false, texto: res.error || 'No pudimos guardar el ingreso.' }
                : { conexion: true, texto: 'Se cortó la conexión y no se guardó nada. Lo que marcaste sigue acá: probá de nuevo.' });
            setGuardando(false);
            return;
        }

        setGuardando(false);
        setConfirmando(false);
        setAviso(marcados === 0 ? 'Se borró el ingreso de la familia.' : `Ingreso guardado · ${marcados}/${totalPersonas} adentro`);
        await cargar();
    };

    const verComprobanteDe = async (path: string) => {
        setOcupado('comprobante');
        // La URL se pide al tocar: vence a los 5 minutos.
        const url = await supabaseService.getNocturnaComprobanteUrl(path);
        setOcupado(null);
        if (!url) { setAviso('No pudimos abrir el comprobante. Probá de nuevo.'); return; }
        setComprobanteUrl(url);
    };

    const verComprobante = () => {
        if (!insc?.comprobantePath) return;
        void verComprobanteDe(insc.comprobantePath);
    };

    const reenviar = async () => {
        if (!insc) return;
        setOcupado('email');
        const res = await supabaseService.reenviarNocturnaEmail(insc.id);
        setOcupado(null);
        if (!res.ok) { setAviso(res.error || 'No pudimos pedir el reenvío.'); return; }
        setAviso('Se pidió el reenvío. En unos segundos se actualiza el estado.');
        setTimeout(() => { cargar(); }, 8000);
    };

    // ── Piezas ────────────────────────────────────────────────────────────
    const Carta: React.FC<{ titulo?: string; extra?: React.ReactNode; destacada?: boolean; children: React.ReactNode }> =
        ({ titulo, extra, destacada, children }) => (
            <div
                className="rounded-[22px]"
                style={{ background: CARTA, padding: 20, boxShadow: destacada ? `0 0 0 2px ${ROSA} inset` : 'none' }}
            >
                {(titulo || extra) && (
                    <div className="flex items-baseline justify-between gap-2.5">
                        {titulo && <p style={{ ...fuente(600, '16px'), color: INK, margin: 0 }}>{titulo}</p>}
                        {extra}
                    </div>
                )}
                {children}
            </div>
        );

    const Fila: React.FC<{ k: string; v: React.ReactNode; ultima?: boolean }> = ({ k, v, ultima }) => (
        <div className="flex justify-between gap-3" style={{ padding: '10px 0', borderBottom: ultima ? 'none' : `1px solid ${CAMPO}` }}>
            <span style={{ ...fuente(500, '13px'), color: 'rgba(0,0,0,.6)' }}>{k}</span>
            <span className="text-right" style={{ ...fuente(600, '13px'), color: INK, overflowWrap: 'anywhere' }}>{v}</span>
        </div>
    );

    // ── Pantallas completas ───────────────────────────────────────────────
    if (cargando) {
        return (
            <div id="nocturna-panel" className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: FONDO }}>
                <style>{ESTILOS_PANEL}</style>
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: INK }} />
            </div>
        );
    }

    if (errorCarga || !insc) {
        return (
            <div id="nocturna-panel" className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: FONDO }}>
                <style>{ESTILOS_PANEL}</style>
                <p style={{ ...fuente(600, '19px'), color: INK, margin: 0 }}>No pudimos abrir la ficha</p>
                <p style={{ ...fuente(500, '14px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '10px 0 0', maxWidth: 380 }}>
                    {errorCarga} No quiere decir que la inscripción no exista: puede ser la conexión.
                </p>
                <div className="flex flex-col gap-2 mt-6 w-full" style={{ maxWidth: 320 }}>
                    <button
                        type="button"
                        onClick={() => { setCargando(true); cargar(); }}
                        className="border-0 rounded-full cursor-pointer"
                        style={{ height: 48, background: INK, color: '#fff', ...fuente(600, '14px') }}
                    >
                        Probar de nuevo
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/panel-eventos/nocturna')}
                        className="border-0 rounded-full cursor-pointer"
                        style={{ height: 48, background: CAMPO, color: INK, ...fuente(600, '14px') }}
                    >
                        Volver a la planilla
                    </button>
                </div>
            </div>
        );
    }

    const aprobado = estadoInscripcion(insc) === 'Aprobado';
    const { acreditados } = contarAcreditados(insc);

    return (
        <div id="nocturna-panel" className="min-h-screen flex flex-col" style={{ background: FONDO }}>
            <style>{ESTILOS_PANEL}</style>

            {/* Cabecera */}
            <header className="flex-none" style={{ background: CARTA, borderBottom: `1px solid ${BORDE}` }}>
                <div className="mx-auto px-4 lg:px-8 pt-5 pb-4" style={{ maxWidth: 1120 }}>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <button
                            type="button"
                            onClick={() => salir(() => navigate('/panel-eventos/nocturna'))}
                            className="border-0 rounded-full flex items-center gap-1.5 cursor-pointer"
                            style={{ height: 40, padding: '0 14px 0 10px', background: CAMPO, color: INK, ...fuente(600, '12.5px') }}
                        >
                            <ChevronLeft className="w-4 h-4" strokeWidth={2.3} />
                            Planilla
                        </button>
                        <div className="ml-auto flex gap-1.5">
                            {!!insc.comprobantePath && (
                                <button
                                    type="button"
                                    onClick={verComprobante}
                                    disabled={ocupado === 'comprobante'}
                                    className="border-0 rounded-full cursor-pointer"
                                    style={{ height: 40, padding: '0 14px', background: CAMPO, color: INK, ...fuente(600, '12.5px') }}
                                >
                                    {ocupado === 'comprobante' ? 'Abriendo…' : 'Ver comprobante'}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => salir(() => navigate(`/panel-eventos/nocturna/${insc.id}/editar`))}
                                className="border-0 rounded-full flex items-center gap-1.5 cursor-pointer"
                                style={{ height: 40, padding: '0 14px', background: CAMPO, color: INK, ...fuente(600, '12.5px') }}
                            >
                                <Pencil className="w-3.5 h-3.5" />
                                Editar
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 mt-3.5 flex-wrap">
                        <h1 className="text-[22px] lg:text-[26px]" style={{ ...fuente(600, 'inherit'), color: INK, letterSpacing: '-.02em', margin: 0 }}>
                            {nombreAdulto}
                        </h1>
                        <span style={estiloEstado(aprobado)}>
                            <span style={estiloPunto(aprobado)} />
                            {aprobado ? `Aprobado ${acreditados}/${totalPersonas}` : 'Inscripto'}
                        </span>
                    </div>
                    <p style={{ ...fuente(500, '13px'), color: 'rgba(0,0,0,.6)', margin: '5px 0 0' }}>
                        Entrada {insc.codigoEntrada} · {jovenes.length} {jovenes.length === 1 ? 'adolescente' : 'adolescentes'}
                        {insc.aprobadoAt ? ` · ingresó ${hora(insc.aprobadoAt)}` : ''}
                    </p>
                </div>
            </header>

            {/* Cuerpo */}
            <main className="flex-1">
                <div
                    className="mx-auto px-4 lg:px-8 py-4 lg:py-5 grid gap-3.5 items-start"
                    style={{ maxWidth: 1120, gridTemplateColumns: 'minmax(0,1fr)' }}
                >
                    <div className="lg:grid lg:gap-3.5 items-start" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
                        <div className="flex flex-col gap-3.5 min-w-0">

                            {/* ── El retiro va primero ───────────────────── */}
                            {/* A las 6 de la mañana esto es lo único que importa
                                de la ficha. Enterrado abajo con los datos de
                                contacto, habría que buscarlo con una fila
                                esperando. */}
                            <Carta destacada>
                                <div className="flex items-center gap-2">
                                    <span
                                        className="flex items-center flex-none"
                                        style={{ height: 26, padding: '0 11px', borderRadius: 999, background: INK, color: '#fff', ...fuente(600, '11.5px') }}
                                    >
                                        Salida 6 AM
                                    </span>
                                    <span style={{ ...fuente(500, '12.5px'), color: 'rgba(0,0,0,.6)' }}>Sábado 31 de octubre</span>
                                </div>
                                <div className="flex flex-col mt-1.5">
                                    {agruparPorRetiro(jovenes).map((g, i, todos) => {
                                        const j = g.chicos[0];
                                        const datos = j.retiro?.tipo === 'otra_persona'
                                            ? [['DNI', j.retiro?.dni], ['Tel', j.retiro?.telefono]]
                                            : j.retiro?.tipo === 'adulto'
                                                ? [['DNI', insc.adultoDni]]
                                                : [];
                                        return (
                                            <div key={g.clave} style={{ padding: '14px 0', borderBottom: i === todos.length - 1 ? 'none' : `1px solid ${CAMPO}` }}>
                                                <p style={{ ...fuente(600, '13px'), color: 'rgba(0,0,0,.62)', margin: 0 }}>
                                                    {enLista(g.chicos.map(c => `${c.nombre} ${c.apellido}`))}
                                                    {g.chicos.length > 1 && ' · salen juntos'}
                                                </p>
                                                <p style={{ ...fuente(600, '20px', '1.3'), color: INK, letterSpacing: '-.015em', margin: '6px 0 0' }}>
                                                    {g.chicos.length > 1 && j.retiro?.tipo === 'solo'
                                                        ? 'Se retiran solos'
                                                        : quienRetira(j, nombreAdulto)}
                                                </p>
                                                {!!datos.length && (
                                                    <div className="flex gap-1.5 mt-2.5 flex-wrap">
                                                        {datos.filter(([, v]) => !!v).map(([k, v]) => (
                                                            <span
                                                                key={k}
                                                                className="flex items-center gap-1.5"
                                                                style={{ height: 30, padding: '0 12px', borderRadius: 999, background: CAMPO, ...fuente(600, '13px'), color: INK }}
                                                            >
                                                                <span style={{ fontWeight: 500, color: 'rgba(0,0,0,.58)' }}>{k}</span>
                                                                {v}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </Carta>

                            {/* ── Ingreso ────────────────────────────────── */}
                            <Carta
                                titulo="Ingreso"
                                extra={
                                    <span style={{ ...fuente(600, '13px'), color: marcados === totalPersonas ? VERDE : 'rgba(0,0,0,.6)' }}>
                                        {marcados}/{totalPersonas}
                                    </span>
                                }
                            >
                                <p style={{ ...fuente(500, '13px'), color: 'rgba(0,0,0,.6)', margin: '5px 0 0' }}>
                                    Tocá a cada adolescente que entró. El adulto responsable no se acredita.
                                </p>
                                <div className="flex flex-col gap-2 mt-3.5">
                                    {[...jovenes.map(j => ({
                                          id: j.id,
                                          nombre: `${j.nombre} ${j.apellido}`,
                                          rol: `${calcularEdad(j.fechaNacimiento) ?? '—'} años · ${j.tribu}`,
                                          marcado: !!chicosMarcados[j.id],
                                          desde: j.acreditadoAt,
                                      }))].map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => alternar(p.id)}
                                            aria-pressed={p.marcado}
                                            className="w-full border-0 flex items-center gap-3 cursor-pointer"
                                            style={{
                                                minHeight: 62,
                                                padding: '10px 14px',
                                                borderRadius: 16,
                                                background: p.marcado ? '#f0f9f3' : '#f7f7f5',
                                                boxShadow: p.marcado ? '0 0 0 1.5px #bfe3cc inset' : 'none',
                                            }}
                                        >
                                            <span
                                                className="flex items-center justify-center flex-none"
                                                style={{
                                                    width: 30, height: 30, borderRadius: 999,
                                                    background: p.marcado ? '#16a34a' : CARTA,
                                                    boxShadow: p.marcado ? 'none' : '0 0 0 1.5px #d6d5d1 inset',
                                                }}
                                            >
                                                {p.marcado && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                                            </span>
                                            <span className="flex-1 min-w-0 text-left">
                                                <span className="block truncate" style={{ ...fuente(600, '15px'), color: INK }}>{p.nombre}</span>
                                                <span className="block" style={{ ...fuente(500, '12.5px'), color: 'rgba(0,0,0,.58)', marginTop: 2 }}>{p.rol}</span>
                                            </span>
                                            <span className="flex-none" style={{ ...fuente(600, '12.5px'), color: p.desde ? VERDE : 'rgba(0,0,0,.45)' }}>
                                                {p.desde ? `Entró ${hora(p.desde)}` : 'No ingresó'}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                <p style={{ ...fuente(500, '12.5px'), color: 'rgba(0,0,0,.58)', margin: '14px 2px 0' }}>
                                    {hayCambios ? 'Los cambios todavía no se guardaron.' : 'Sin cambios para guardar.'}
                                </p>

                                {errorGuardar && (
                                    <div className="rounded-[14px] mt-3" style={{ background: errorGuardar.conexion ? AMBAR : '#fdecea', padding: '12px 14px' }}>
                                        <p style={{ ...fuente(600, '13.5px'), color: errorGuardar.conexion ? INK : ROJO, margin: 0 }}>
                                            {errorGuardar.conexion ? 'No se guardó' : 'No se pudo guardar'}
                                        </p>
                                        <p style={{ ...fuente(500, '13px', '1.5'), color: errorGuardar.conexion ? '#5c3b0b' : 'rgba(0,0,0,.66)', margin: '4px 0 0' }}>
                                            {errorGuardar.texto}
                                        </p>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setConfirmando(true)}
                                    disabled={!hayCambios}
                                    className="w-full border-0 rounded-full mt-3"
                                    style={{
                                        height: 54,
                                        background: hayCambios ? INK : '#e6e5e1',
                                        color: hayCambios ? '#fff' : 'rgba(0,0,0,.4)',
                                        ...fuente(600, '15px'),
                                        cursor: hayCambios ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    Guardar cambios
                                </button>
                            </Carta>
                        </div>

                        {/* ── Columna de datos ───────────────────────────── */}
                        <div className="flex flex-col gap-3.5 min-w-0 mt-3.5 lg:mt-0">
                            <Carta titulo="Adolescentes">
                                <div className="flex flex-col mt-2.5">
                                    {jovenes.map((j, i) => (
                                        <div
                                            key={j.id}
                                            className="flex items-center gap-2.5 flex-wrap"
                                            style={{ padding: '11px 0', borderBottom: i === jovenes.length - 1 ? 'none' : `1px solid ${CAMPO}` }}
                                        >
                                            <div className="flex-1" style={{ minWidth: 140 }}>
                                                <p style={{ ...fuente(600, '14.5px'), color: INK, margin: 0 }}>{j.nombre} {j.apellido}</p>
                                                <p style={{ ...fuente(500, '12.5px'), color: 'rgba(0,0,0,.58)', margin: '2px 0 0' }}>
                                                    {calcularEdad(j.fechaNacimiento) ?? '—'} años · DNI {j.dni}
                                                </p>
                                            </div>
                                            <span
                                                className="flex items-center gap-1.5 flex-none"
                                                style={{ height: 24, padding: '0 9px', borderRadius: 999, background: CAMPO_HONDO, color: 'rgba(0,0,0,.7)', ...fuente(600, '11px') }}
                                            >
                                                <span style={{ width: 6, height: 6, borderRadius: 999, background: COLOR_TRIBU[j.tribu] || '#9a9a95' }} />
                                                {j.tribu}
                                            </span>
                                            {/* Sólo si tiene algo: una ficha que dice
                                                "ninguna" en cada adolescente hace que la que
                                                importa deje de verse. */}
                                            {(j.restriccion || 'ninguna') !== 'ninguna' && (
                                                <span
                                                    className="flex items-center flex-none"
                                                    style={{ height: 24, padding: '0 10px', borderRadius: 999, background: AMBAR, color: AMBAR_INK, ...fuente(600, '11px') }}
                                                >
                                                    {etiquetaRestriccion(j.restriccion)}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {!insc.aceptaFotos && (
                                    <div className="flex items-center gap-2.5 mt-3" style={{ background: AMBAR, borderRadius: 14, padding: '10px 14px' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={AMBAR_INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-none" aria-hidden="true">
                                            <rect x="3" y="7" width="18" height="13" rx="3" /><path d="M3 3l18 18" />
                                        </svg>
                                        <span style={{ ...fuente(600, '13px', '1.4'), color: '#5c3b0b' }}>
                                            {enLista(jovenes.map(j => j.nombre))} {jovenes.length > 1 ? 'no tienen' : 'no tiene'} permiso de fotos.
                                        </span>
                                    </div>
                                )}
                            </Carta>

                            <Carta titulo="Adulto responsable">
                                <div className="mt-2">
                                    <Fila k="DNI" v={insc.adultoDni} />
                                    <Fila k="Email" v={insc.adultoEmail} />
                                    <Fila k="Nacimiento" v={`${insc.adultoFechaNacimiento} · ${calcularEdad(insc.adultoFechaNacimiento) ?? '—'} años`} ultima />
                                </div>
                            </Carta>

                            <Carta titulo="Pago">
                                <div className="mt-2">
                                    <Fila k="Se inscribió" v={fechaLarga(insc.createdAt)} />
                                    <Fila k="Entrada" v={plata(insc.precioUnitario)} />
                                    <Fila k="Total" v={plata(insc.total)} />
                                    <Fila
                                        k="Comprobante"
                                        ultima={(insc.comprobantes || []).length === 0}
                                        v={insc.cargadoPorAdmin
                                            ? `Cargada por ${nombreAdmin || 'un administrador'}`
                                            : insc.comprobantePath ? 'Subido por la familia' : 'Sin comprobante'}
                                    />
                                    {/* Los pagos de los chicos que la familia sumó
                                        después. Van acá y no en otra tarjeta: lo que
                                        se está mirando es si esta inscripción está
                                        paga, y la respuesta es la suma de todos. */}
                                    {(insc.comprobantes || []).map((c, i) => (
                                        <Fila
                                            key={c.id}
                                            k={c.chicos === 1 ? 'Sumó un adolescente' : `Sumó ${c.chicos} adolescentes`}
                                            ultima={i === (insc.comprobantes || []).length - 1}
                                            v={
                                                <button
                                                    type="button"
                                                    onClick={() => verComprobanteDe(c.path)}
                                                    disabled={ocupado === 'comprobante'}
                                                    className="border-0 bg-transparent cursor-pointer underline p-0"
                                                    style={{ ...fuente(600, '13px'), color: INK }}
                                                >
                                                    {plata(c.monto)} · ver comprobante
                                                </button>
                                            }
                                        />
                                    ))}
                                </div>
                            </Carta>

                            <Carta titulo="Entrada por email">
                                <div className="mt-2">
                                    <Fila
                                        k="Estado"
                                        ultima
                                        v={insc.emailEnviadoAt
                                            ? <span style={{ color: VERDE }}>Enviada {hora(insc.emailEnviadoAt)}</span>
                                            : <span style={{ color: AMBAR_INK }}>No salió</span>}
                                    />
                                </div>
                                {!insc.emailEnviadoAt && (
                                    <p style={{ ...fuente(500, '12.5px', '1.5'), color: AMBAR_INK, margin: '8px 2px 0' }}>
                                        {insc.emailError || (insc.emailIntentos === 0 ? 'Todavía no se intentó mandar.' : 'No sabemos por qué falló.')}
                                    </p>
                                )}
                                <button
                                    type="button"
                                    onClick={reenviar}
                                    disabled={ocupado === 'email'}
                                    className="w-full border-0 rounded-full cursor-pointer mt-3"
                                    style={{ height: 46, background: CAMPO, color: INK, ...fuente(600, '13.5px') }}
                                >
                                    {ocupado === 'email' ? 'Pidiendo…' : 'Reenviar entrada'}
                                </button>
                            </Carta>

                            <Carta titulo="Declaraciones">
                                <div className="mt-2">
                                    <Fila k="Autorización de asistencia" v={<span style={{ color: VERDE }}>Autorizó</span>} />
                                    <Fila
                                        k="Fotos y video"
                                        v={insc.aceptaFotos
                                            ? <span style={{ color: VERDE }}>Acepta</span>
                                            : <span style={{ color: AMBAR_INK }}>No acepta</span>}
                                    />
                                    <Fila k="Versión del texto" v={insc.declaracionesVersion} ultima />
                                </div>
                            </Carta>
                        </div>
                    </div>
                </div>
            </main>

            {/* Aviso */}
            {aviso && (
                <div className="fixed left-4 right-4 z-40 flex justify-center pointer-events-none" style={{ bottom: 20 }}>
                    <div
                        className="pointer-events-auto w-full flex items-center gap-3 rounded-[18px]"
                        style={{ maxWidth: 460, background: INK, padding: '14px 18px' }}
                        role="status"
                    >
                        <span className="flex-1" style={{ ...fuente(600, '13.5px'), color: '#fff' }}>{aviso}</span>
                        <button
                            type="button"
                            onClick={() => setAviso(null)}
                            className="border-0 bg-transparent cursor-pointer"
                            style={{ ...fuente(600, '13px'), color: 'rgba(255,255,255,.7)' }}
                        >
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* Confirmación del ingreso: hoja desde abajo en mobile, modal en desktop */}
            {confirmando && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center lg:items-center"
                    style={{ background: 'rgba(10,10,10,.42)', padding: 0 }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="w-full lg:max-w-[440px] lg:m-4"
                        style={{
                            background: CARTA,
                            borderRadius: '28px 28px 0 0',
                            padding: '14px 18px 22px',
                            maxHeight: '90%',
                            overflow: 'auto',
                        }}
                    >
                        <div className="lg:hidden mx-auto mb-3.5" style={{ width: 44, height: 5, borderRadius: 999, background: '#dddcd8' }} />
                        <p style={{ ...fuente(600, '19px', '1.3'), color: INK, margin: 0 }}>
                            {marcados === 0 ? '¿Borrar el ingreso de la familia?' : `¿Guardar ${marcados} de ${totalPersonas} adentro?`}
                        </p>
                        <p style={{ ...fuente(500, '14px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '10px 0 0' }}>
                            {marcados === 0
                                ? 'La familia vuelve a figurar como inscripta, sin ingreso registrado.'
                                : 'La hora de quienes ya habían entrado no cambia. Los que destildaste dejan de contar como presentes.'}
                        </p>

                        <div className="rounded-[16px] mt-4" style={{ background: '#f7f7f5', padding: '4px 14px' }}>
                            {[...jovenes.map(j => ({ nombre: `${j.nombre} ${j.apellido}`, marcado: !!chicosMarcados[j.id], antes: !!j.acreditadoAt }))]
                                .filter(p => p.marcado !== p.antes)
                                .map(p => (
                                    <div key={p.nombre} className="flex justify-between gap-3" style={{ padding: '10px 0' }}>
                                        <span style={{ ...fuente(600, '13.5px'), color: INK }}>{p.nombre}</span>
                                        <span style={{ ...fuente(600, '13px'), color: p.marcado ? VERDE : ROJO }}>
                                            {p.marcado ? 'Entra' : 'Se destilda'}
                                        </span>
                                    </div>
                                ))}
                        </div>

                        {errorGuardar && (
                            <div className="rounded-[14px] mt-3" style={{ background: errorGuardar.conexion ? AMBAR : '#fdecea', padding: '12px 14px' }}>
                                <p style={{ ...fuente(500, '13px', '1.5'), color: errorGuardar.conexion ? '#5c3b0b' : ROJO, margin: 0 }}>
                                    {errorGuardar.texto}
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col gap-2 mt-5">
                            <button
                                type="button"
                                onClick={guardarIngreso}
                                disabled={guardando}
                                className="border-0 rounded-full flex items-center justify-center gap-2 cursor-pointer"
                                style={{ height: 52, background: INK, color: '#fff', ...fuente(600, '15px') }}
                            >
                                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                {guardando ? 'Guardando…' : errorGuardar ? 'Reintentar' : 'Guardar el ingreso'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setConfirmando(false); setErrorGuardar(null); }}
                                className="border-0 rounded-full cursor-pointer"
                                style={{ height: 52, background: CAMPO, color: INK, ...fuente(600, '15px') }}
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cambios sin guardar */}
            {salidaPendiente && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,10,10,.42)' }} role="dialog" aria-modal="true">
                    <div className="w-full rounded-[26px]" style={{ maxWidth: 420, background: CARTA, padding: '24px 22px 20px' }}>
                        <p style={{ ...fuente(600, '19px', '1.3'), color: INK, margin: 0 }}>Hay cambios sin guardar</p>
                        <p style={{ ...fuente(500, '14px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '10px 0 0' }}>
                            Marcaste o desmarcaste a alguien y todavía no lo guardaste. Si salís ahora, el ingreso queda como estaba.
                        </p>
                        <div className="flex flex-col gap-2 mt-5">
                            <button
                                type="button"
                                onClick={() => setSalidaPendiente(null)}
                                className="border-0 rounded-full cursor-pointer"
                                style={{ height: 52, background: INK, color: '#fff', ...fuente(600, '15px') }}
                            >
                                Seguir acá y guardar
                            </button>
                            <button
                                type="button"
                                onClick={() => { const a = salidaPendiente; setSalidaPendiente(null); a?.(); }}
                                className="border-0 rounded-full cursor-pointer"
                                style={{ height: 52, background: CAMPO, color: INK, ...fuente(600, '15px') }}
                            >
                                Salir sin guardar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Comprobante */}
            {comprobanteUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,10,10,.45)' }} role="dialog" aria-modal="true">
                    <div className="w-full rounded-[26px]" style={{ maxWidth: 620, background: CARTA, padding: '24px 22px 20px' }}>
                        <div className="flex items-center gap-2.5">
                            <p className="flex-1" style={{ ...fuente(600, '16px'), color: INK, margin: 0 }}>Comprobante · {nombreAdulto}</p>
                            <button
                                type="button"
                                onClick={() => setComprobanteUrl(null)}
                                className="border-0 rounded-full cursor-pointer flex-none"
                                style={{ height: 36, padding: '0 14px', background: CAMPO, ...fuente(600, '12.5px'), color: INK }}
                            >
                                Cerrar
                            </button>
                        </div>
                        <img
                            src={comprobanteUrl}
                            alt={`Comprobante de ${nombreAdulto}`}
                            className="w-full rounded-[16px] mt-3.5"
                            style={{ maxHeight: '70vh', objectFit: 'contain', background: CAMPO }}
                        />
                        <p style={{ ...fuente(500, '12px', '1.5'), color: 'rgba(0,0,0,.55)', margin: '10px 2px 0' }}>
                            El link vence en 5 minutos. Si se cierra, volvé a abrirlo desde acá.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DetalleNocturna;

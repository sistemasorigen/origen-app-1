import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ChevronDown, ChevronLeft, Loader2, Pencil, Plus, QrCode, Search, Trash2, X } from 'lucide-react';
import { useBloqueoDeFondo } from '../../../hooks/useBloqueoDeFondo';
import { hasRole } from '../../../services/authUtils';
import { supabaseService } from '../../../services/supabaseService';
import { contarEstados, estadoInscripcion } from '../../../src/utils/nocturna';
import { useScrollRecordado } from '../../../src/utils/scrollRecordado';
import { NocturnaConfig, NocturnaInscripcion, NocturnaTribu, User, UserRole } from '../../../types';
import { COLOR_TRIBU, etiquetaRestriccion, plata, sinTildes } from './compartido/formulario';
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
    ROJO_FONDO,
    VERDE,
    VERDE_FONDO,
} from './compartido/estilos';

/**
 * Planilla de Nocturna para el staff.
 *
 * Lo que este panel NO hace todavía: acreditar (el escáner es otro paso) y
 * abrir la ficha de una inscripción. Los dos botones están a la vista pero
 * apagados, con el motivo en el `title`: un botón que no reacciona parece
 * roto y manda a alguien a reportar un error que no existe.
 */

interface Props {
    currentUser: User;
}

const fechaCorta = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
};

const fechaYHora = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const dia = d.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' });
    const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${dia} · ${hora}`;
};

type Overlay =
    | { tipo: 'eliminar'; insc: NocturnaInscripcion }
    | { tipo: 'comprobante'; insc: NocturnaInscripcion; vistas: VistaComprobante[] }
    | null;

/**
 * Las columnas de la planilla. En una constante porque la cabecera y las filas
 * tienen que usar exactamente la misma grilla: si se separan, los títulos
 * dejan de caer sobre su columna.
 */
// La de COMIDA es angosta a propósito: casi siempre está vacía, y lo que
// tiene que saltar a la vista es la fila que NO lo está.
const COLUMNAS = '130px minmax(0,1fr) minmax(0,1.4fr) 128px 170px 120px 150px';

/**
 * Lo que no puede comer cada adolescente de una inscripción.
 *
 * Sólo los que tienen algo: una columna llena de "ninguna" hace que la única
 * fila que importa se pierda entre las demás. En ámbar, el mismo color con el
 * que la planilla ya marca lo que pide atención.
 */
const Restricciones: React.FC<{ insc: NocturnaInscripcion; compacto?: boolean }> = ({ insc, compacto }) => {
    const con = (insc.jovenes || []).filter(j => (j.restriccion || 'ninguna') !== 'ninguna');
    if (!con.length) {
        return compacto ? null : <span style={{ ...fuente(500, '12.5px'), color: 'rgba(0,0,0,.32)' }}>—</span>;
    }
    return (
        <>
            {con.map(j => (
                <span
                    key={j.id}
                    className="flex items-center w-fit"
                    style={{ height: 24, padding: '0 10px', borderRadius: 999, background: AMBAR, color: AMBAR_INK, ...fuente(600, '11.5px') }}
                >
                    {etiquetaRestriccion(j.restriccion)} · {j.nombre}
                </span>
            ))}
        </>
    );
};

/** Un comprobante listo para mirar: de dónde sale y qué cubrió. */
interface VistaComprobante {
    titulo: string;
    detalle: string;
    url: string;
}

/** Dónde estaba el scroll de la planilla, mientras dura la sesión. */
/**
 * Cuántos adolescentes hay en un puñado de filas.
 *
 * La planilla muestra una fila por familia, pero lo que se cuenta arriba de
 * cada bloque son los adolescentes: son los que entran, los que comen y los
 * que se reparten en las tribus.
 */
const chicosDe = (filas: { insc: NocturnaInscripcion }[]): number =>
    filas.reduce((a, f) => a + (f.insc.jovenes?.length || 0), 0);

const CLAVE_SCROLL = 'nocturna.planilla';

const AdminNocturna: React.FC<Props> = ({ currentUser }) => {
    const navigate = useNavigate();
    // Borrar es de coordinación. La gente de la puerta (ACREDITACION) ve y
    // carga, pero no borra: la base tampoco se lo deja
    // (sql/nocturna_puerta_y_celular.sql).
    const puedeEliminar = hasRole(currentUser, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ENCARGADO_EVENTOS]);

    const [inscripciones, setInscripciones] = useState<NocturnaInscripcion[]>([]);
    const [config, setConfig] = useState<NocturnaConfig | null>(null);
    const [nombresAdmin, setNombresAdmin] = useState<Record<string, string>>({});
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);

    const [busqueda, setBusqueda] = useState('');
    const [cambiandoEstado, setCambiandoEstado] = useState(false);
    const [editandoPrecio, setEditandoPrecio] = useState(false);
    const [precioBorrador, setPrecioBorrador] = useState('');
    const [guardandoPrecio, setGuardandoPrecio] = useState(false);
    // La pestaña de la inscripción pública arranca cerrada: se mira seguido,
    // se toca poco. Cerrada ya muestra el estado y el precio.
    const [ajustesAbiertos, setAjustesAbiertos] = useState(false);

    const [overlay, setOverlay] = useState<Overlay>(null);
    const [ocupado, setOcupado] = useState<string | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);

    useBloqueoDeFondo(!!overlay);

    // ── Carga ─────────────────────────────────────────────────────────────
    const cargar = useCallback(async () => {
        setErrorCarga(null);
        const [res, cfg] = await Promise.all([
            supabaseService.getNocturnaInscripciones(),
            supabaseService.getNocturnaConfig(),
        ]);

        if (!res.ok) {
            // Una caída de conexión dibujada como "todavía no hay nadie" es una
            // pantalla que miente con cara de certeza.
            setErrorCarga(res.error || 'No pudimos leer las inscripciones.');
            setCargando(false);
            return;
        }

        setInscripciones(res.inscripciones);
        if (cfg) {
            setConfig(cfg);
            setPrecioBorrador(String(cfg.precioEntrada));
        }

        // Los nombres de quienes cargaron inscripciones, todos de una.
        const ids = res.inscripciones.map(i => i.cargadoPorAdmin).filter(Boolean) as string[];
        if (ids.length) setNombresAdmin(await supabaseService.nombresDeUsuarios(ids));

        setCargando(false);
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    // Entrar a una ficha y volver desmonta la planilla, y App.tsx manda la
    // pantalla nueva arriba de todo en cada cambio de ruta. Sin esto, quien
    // venía revisando la familia número treinta tiene que bajar de nuevo
    // hasta ahí. Se restaura recién con las inscripciones cargadas: antes la
    // página no tiene alto y no habría a dónde bajar.
    useScrollRecordado(CLAVE_SCROLL, !cargando);

    useEffect(() => {
        if (!aviso) return;
        const t = setTimeout(() => setAviso(null), 4000);
        return () => clearTimeout(t);
    }, [aviso]);

    // ── Búsqueda ──────────────────────────────────────────────────────────
    // Se filtra en el cliente: son decenas de filas, no miles, y así la
    // búsqueda responde a cada tecla sin ir y volver a la base.
    const filtradas = useMemo(() => {
        const q = sinTildes(busqueda);
        if (!q) return inscripciones.map(i => ({ insc: i, coincideChico: [] as string[] }));

        return inscripciones
            .map(i => {
                const adulto = sinTildes(`${i.adultoNombre} ${i.adultoApellido}`);
                const chicos = (i.jovenes || []).filter(j =>
                    sinTildes(`${j.nombre} ${j.apellido}`).includes(q));
                const porAdulto = adulto.includes(q);
                if (!porAdulto && !chicos.length) return null;
                // Si la coincidencia fue por un chico, se dice cuál: si no, el
                // staff ve una familia en la lista sin saber por qué está.
                return { insc: i, coincideChico: porAdulto ? [] : chicos.map(c => c.nombre) };
            })
            .filter(Boolean) as { insc: NocturnaInscripcion; coincideChico: string[] }[];
    }, [inscripciones, busqueda]);

    const grupos = useMemo(() => {
        const aprobadas = filtradas.filter(f => estadoInscripcion(f.insc) === 'Aprobado');
        const inscriptas = filtradas.filter(f => estadoInscripcion(f.insc) !== 'Aprobado');
        // Los títulos cuentan ADOLESCENTES, no familias: son los que entran
        // esa noche, los que comen y los que se reparten en las tribus. Una
        // familia puede traer tres. Las filas siguen siendo una por familia.
        const salida: { titulo: string; filas: typeof filtradas }[] = [];
        if (aprobadas.length) salida.push({ titulo: `APROBADOS · ${chicosDe(aprobadas)}`, filas: aprobadas });
        if (inscriptas.length) salida.push({ titulo: `INSCRIPTOS · ${chicosDe(inscriptas)}`, filas: inscriptas });
        return salida;
    }, [filtradas]);

    const resumen = useMemo(() => {
        const chicos = inscripciones.reduce((a, i) => a + (i.jovenes?.length || 0), 0);
        // Aprobados, también en adolescentes: es el número que se usa para
        // saber cuántos entran.
        const aprobados = inscripciones
            .filter(i => estadoInscripcion(i) === 'Aprobado')
            .reduce((a, i) => a + (i.jovenes?.length || 0), 0);
        const sinFotos = inscripciones.filter(i => !i.aceptaFotos)
            .reduce((a, i) => a + (i.jovenes?.length || 0), 0);
        const sinEmail = inscripciones.filter(i => !i.emailEnviadoAt).length;
        // Retirados: adolescentes con la salida registrada (en la puerta o a
        // mano desde la ficha). La misma marca que cuenta Reportes.
        const retirados = inscripciones
            .reduce((a, i) => a + (i.jovenes || []).filter(j => j.retiradoAt).length, 0);
        // Adolescentes por tribu, de todas las inscripciones. Una tribu que no
        // sea ninguna de las dos cuenta como "Sin tribu": así las tres suman
        // siempre lo mismo que `chicos`.
        const tribus: Record<NocturnaTribu, number> = { Garra: 0, Trueno: 0, 'Sin tribu': 0 };
        for (const i of inscripciones) {
            for (const j of i.jovenes || []) {
                tribus[j.tribu === 'Garra' || j.tribu === 'Trueno' ? j.tribu : 'Sin tribu'] += 1;
            }
        }
        return { chicos, aprobados, retirados, sinFotos, sinEmail, tribus, familias: inscripciones.length };
    }, [inscripciones]);

    // ── Acciones ──────────────────────────────────────────────────────────
    /**
     * Todos los pagos de una inscripción, en orden: primero el del alta y
     * después los que llegaron cuando la familia sumó chicos.
     *
     * El del alta no tiene fila propia en la base —vive en la inscripción—,
     * así que su monto se deduce: el total de hoy menos lo que cubrieron los
     * agregados. Mostrarle el total a secas sería decir que ese comprobante
     * pagó algo que todavía no existía.
     */
    const pagosDe = (insc: NocturnaInscripcion) => {
        const extras = insc.comprobantes || [];
        const sumado = extras.reduce((a, c) => a + c.monto, 0);
        const chicosSumados = extras.reduce((a, c) => a + c.chicos, 0);
        const chicosDelAlta = Math.max(0, (insc.jovenes || []).length - chicosSumados);

        return [
            ...(insc.comprobantePath ? [{
                path: insc.comprobantePath,
                titulo: extras.length ? 'Pago de la inscripción' : 'Comprobante',
                detalle: `${plata(Math.max(0, insc.total - sumado))} · ${chicosDelAlta} ${chicosDelAlta === 1 ? 'adolescente' : 'adolescentes'}`,
            }] : []),
            ...extras.map(c => ({
                path: c.path,
                titulo: c.chicos === 1 ? 'Sumó un adolescente' : `Sumó ${c.chicos} adolescentes`,
                detalle: plata(c.monto),
            })),
        ];
    };

    const verComprobante = async (insc: NocturnaInscripcion) => {
        const pagos = pagosDe(insc);
        if (pagos.length === 0) return;
        setOcupado(`comp-${insc.id}`);
        // La URL se pide recién acá: vence a los 5 minutos, así que generarla
        // al cargar la planilla serviría para nada.
        // Un link firmado por cada uno. Se piden al tocar porque vencen a los
        // 5 minutos, y en paralelo para no encadenar esperas.
        const urls = await Promise.all(pagos.map(x => supabaseService.getNocturnaComprobanteUrl(x.path)));
        setOcupado(null);
        const vistas: VistaComprobante[] = pagos
            .map((x, i) => ({ titulo: x.titulo, detalle: x.detalle, url: urls[i] || '' }))
            .filter(v => !!v.url);
        if (vistas.length === 0) { setAviso('No pudimos abrir el comprobante. Probá de nuevo.'); return; }
        setOverlay({ tipo: 'comprobante', insc, vistas });
    };

    const eliminar = async (insc: NocturnaInscripcion) => {
        setOcupado(`del-${insc.id}`);
        const res = await supabaseService.deleteNocturnaInscripcion(insc.id);
        setOcupado(null);
        setOverlay(null);
        if (!res.ok) { setAviso(res.error || 'No pudimos eliminar la inscripción.'); return; }
        setInscripciones(xs => xs.filter(x => x.id !== insc.id));
        setAviso(`Se eliminó la inscripción de ${insc.adultoNombre} ${insc.adultoApellido}.`);
    };

    const reenviar = async (insc: NocturnaInscripcion) => {
        setOcupado(`mail-${insc.id}`);
        const res = await supabaseService.reenviarNocturnaEmail(insc.id);
        setOcupado(null);
        if (!res.ok) { setAviso(res.error || 'No pudimos pedir el reenvío.'); return; }
        setAviso('Se pidió el reenvío. En unos segundos se actualiza el estado.');
        // El envío es asincrónico: se vuelve a leer para ver si salió.
        setTimeout(() => { cargar(); }, 8000);
    };

    const alternarInscripciones = async () => {
        if (!config || cambiandoEstado) return;
        const proxima = !config.inscripcionesAbiertas;
        setCambiandoEstado(true);
        const res = await supabaseService.setNocturnaInscripcionesAbiertas(proxima);
        setCambiandoEstado(false);
        if (!res.ok) { setAviso(res.error || 'No pudimos cambiar el estado.'); return; }
        setConfig(c => (c ? { ...c, inscripcionesAbiertas: proxima } : c));
        setAviso(proxima
            ? 'Las inscripciones quedaron abiertas. Cualquiera con el link puede anotarse.'
            : 'Las inscripciones quedaron cerradas. El link muestra que no se toman más.');
    };

    const guardarPrecio = async () => {
        const valor = Number(precioBorrador.replace(/\D/g, ''));
        if (!Number.isFinite(valor) || valor <= 0) { setAviso('Poné un precio mayor a cero.'); return; }
        setGuardandoPrecio(true);
        const res = await supabaseService.updateNocturnaPrecio(valor);
        setGuardandoPrecio(false);
        if (!res.ok) { setAviso(res.error || 'No pudimos cambiar el precio.'); return; }
        setConfig(c => (c ? { ...c, precioEntrada: valor } : c));
        setEditandoPrecio(false);
        setAviso(`La entrada pasa a ${plata(valor)}. Las inscripciones ya hechas no cambian.`);
    };

    // ── Piezas ────────────────────────────────────────────────────────────
    const ChipTribu: React.FC<{ tribu: string }> = ({ tribu }) => (
        <span
            className="flex items-center gap-1.5 flex-none"
            style={{ height: 24, padding: '0 9px', borderRadius: 999, background: CAMPO_HONDO, color: 'rgba(0,0,0,.7)', ...fuente(600, '11px') }}
        >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: COLOR_TRIBU[tribu] || '#9a9a95' }} />
            {tribu}
        </span>
    );

    const ChipSinFotos = () => (
        <span
            className="flex items-center gap-1.5 flex-none"
            style={{ height: 24, padding: '0 8px', borderRadius: 999, background: AMBAR, color: AMBAR_INK, ...fuente(600, '11px') }}
            title="La familia no autorizó el uso de imágenes de sus adolescentes."
        >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="7" width="18" height="13" rx="3" /><path d="M3 3l18 18" />
            </svg>
            Sin fotos
        </span>
    );

    const Estado: React.FC<{ insc: NocturnaInscripcion }> = ({ insc }) => {
        const aprobado = estadoInscripcion(insc) === 'Aprobado';
        const { acreditados, total, retirados } = contarEstados(insc);
        return (
            /* El retiro va DEBAJO del estado y no al lado: es lo que pasó
               después, y leerlo en ese orden es leer la noche en orden. */
            <span className="inline-flex flex-col items-start gap-1">
                <span style={estiloEstado(aprobado)}>
                    <span style={estiloPunto(aprobado)} />
                    {aprobado ? `Aprobado ${acreditados}/${total}` : 'Inscripto'}
                </span>
                {retirados > 0 && (
                    <span style={{ ...estiloEstado(false), background: '#eef2ff', color: '#3730a3' }}>
                        <span style={{ ...estiloPunto(false), background: '#6366f1' }} />
                        Retirado {retirados}/{acreditados}
                    </span>
                )}
            </span>
        );
    };

    /** La marca de que el email no salió, con el motivo y el reenvío. */
    const AvisoEmail: React.FC<{ insc: NocturnaInscripcion; ancho?: boolean }> = ({ insc, ancho }) => {
        if (insc.emailEnviadoAt) return null;
        const motivo = insc.emailError
            || (insc.emailIntentos === 0 ? 'Todavía no se intentó mandar.' : 'No sabemos por qué falló.');
        return (
            <div className={`flex items-center gap-2 flex-wrap ${ancho ? 'w-full' : ''}`} style={{ marginTop: 6, minWidth: 0 }}>
                <span
                    className="flex items-center gap-1.5 flex-none"
                    style={{ height: 26, padding: '0 9px', borderRadius: 999, background: AMBAR, color: AMBAR_INK, ...fuente(600, '11.5px') }}
                    title={motivo}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3.5 7l8.5 6 8.5-6" />
                    </svg>
                    Sin entrada
                </span>
                <button
                    type="button"
                    onClick={() => reenviar(insc)}
                    disabled={ocupado === `mail-${insc.id}`}
                    className="border-0 bg-transparent cursor-pointer p-0 underline flex-none"
                    style={{ ...fuente(600, '11.5px'), color: AMBAR_INK, textUnderlineOffset: 3 }}
                >
                    {ocupado === `mail-${insc.id}` ? 'Pidiendo…' : 'Reenviar entrada'}
                </button>
            </div>
        );
    };

    const botonVerDetalles = (id: string, alto = 34) => (
        <button
            type="button"
            onClick={() => navigate(`/panel-eventos/nocturna/${id}`)}
            className="border-0 rounded-full flex-none cursor-pointer"
            style={{ height: alto, padding: '0 14px', background: INK, color: '#fff', ...fuente(600, '12px'), whiteSpace: 'nowrap' }}
        >
            Ver detalles
        </button>
    );

    const Comprobante: React.FC<{ insc: NocturnaInscripcion; bloque?: boolean }> = ({ insc, bloque }) => {
        const cuantos = pagosDe(insc).length;

        const boton = cuantos > 0 && (
            <button
                type="button"
                onClick={() => verComprobante(insc)}
                disabled={ocupado === `comp-${insc.id}`}
                className={`border-0 rounded-full cursor-pointer ${bloque ? 'flex-1' : ''}`}
                style={{ height: bloque ? 38 : 32, padding: '0 13px', background: bloque ? CAMPO_HONDO : CAMPO, color: INK, ...fuente(600, bloque ? '12.5px' : '12px') }}
            >
                {ocupado === `comp-${insc.id}`
                    ? 'Abriendo…'
                    : cuantos === 1 ? 'Ver comprobante' : `Ver ${cuantos} comprobantes`}
            </button>
        );

        if (insc.cargadoPorAdmin) {
            const nombre = nombresAdmin[insc.cargadoPorAdmin] || 'un administrador';
            return (
                <div className="flex flex-col gap-2 min-w-0">
                    <div className="flex items-start gap-2">
                        <Pencil className="w-3.5 h-3.5 flex-none mt-0.5" style={{ color: 'rgba(0,0,0,.55)' }} />
                        <span style={{ ...fuente(500, '12px', '1.45'), color: 'rgba(0,0,0,.66)' }}>
                            Acreditado por un administrador
                            <br />
                            <strong style={{ fontWeight: 600, color: INK }}>{nombre}</strong>
                        </span>
                    </div>
                    {/* Cargada a mano pero con pagos después: la familia sumó un
                        hermano desde el formulario y ese comprobante sí existe. */}
                    {boton}
                </div>
            );
        }

        if (cuantos === 0) {
            return <span style={{ ...fuente(500, '12px'), color: 'rgba(0,0,0,.45)' }}>Sin comprobante</span>;
        }

        return boton;
    };

    // ── Pantallas completas ───────────────────────────────────────────────
    if (cargando) {
        return (
            <div id="nocturna-panel" className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: FONDO }}>
                <style>{ESTILOS_PANEL}</style>
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: INK }} />
                <p style={{ ...fuente(500, '14px'), color: 'rgba(0,0,0,.6)', margin: 0 }}>Abriendo la planilla…</p>
            </div>
        );
    }

    if (errorCarga) {
        return (
            <div id="nocturna-panel" className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: FONDO }}>
                <style>{ESTILOS_PANEL}</style>
                <p style={{ ...fuente(600, '19px'), color: INK, margin: 0 }}>No pudimos leer las inscripciones</p>
                <p style={{ ...fuente(500, '14px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '10px 0 0', maxWidth: 380 }}>
                    {errorCarga} No es que no haya nadie anotado: es que no pudimos consultarlo.
                </p>
                <button
                    type="button"
                    onClick={() => { setCargando(true); cargar(); }}
                    className="border-0 rounded-full cursor-pointer mt-6"
                    style={{ height: 46, padding: '0 22px', background: INK, color: '#fff', ...fuente(600, '14px') }}
                >
                    Probar de nuevo
                </button>
            </div>
        );
    }

    const precio = config?.precioEntrada ?? 0;

    return (
        <div id="nocturna-panel" className="min-h-screen flex flex-col" style={{ background: FONDO }}>
            <style>{ESTILOS_PANEL}</style>

            {/* Cabecera */}
            <header className="flex-none" style={{ background: CARTA, borderBottom: `1px solid ${BORDE}` }}>
                <div className="mx-auto px-4 lg:px-8 pt-5 pb-4" style={{ maxWidth: 1280 }}>
                    <button
                        type="button"
                        onClick={() => navigate('/panel-eventos')}
                        className="border-0 rounded-full flex items-center gap-1.5 cursor-pointer mb-3"
                        style={{ height: 36, padding: '0 14px 0 10px', background: CAMPO, color: INK, ...fuente(600, '12.5px') }}
                    >
                        <ChevronLeft className="w-4 h-4" strokeWidth={2.3} />
                        Panel de eventos
                    </button>

                    {/* Título y acciones. En el teléfono: Reportes y Crear en dos
                        columnas iguales y Acreditar abajo, con el ancho de los
                        dos juntos — es el que se usa la noche del evento. En la
                        compu, todo en una línea: Acreditar, Reportes, Crear. */}
                    <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">
                        <div className="col-span-2 min-w-0 mb-1.5 lg:mb-0 lg:flex-none">
                            <h1 className="text-[22px] lg:text-[26px]" style={{ ...fuente(600, 'inherit'), color: INK, letterSpacing: '-.02em', margin: 0 }}>
                                Nocturna
                            </h1>
                            <p style={{ ...fuente(500, '13.5px'), color: 'rgba(0,0,0,.58)', margin: '3px 0 0' }}>
                                Nocturna {config?.edicion ?? ''}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate('/panel-eventos/nocturna/reportes')}
                            className="border-0 rounded-full flex items-center justify-center gap-2 cursor-pointer lg:order-3 lg:flex-none"
                            style={{ height: 46, padding: '0 18px', background: CAMPO, color: INK, ...fuente(600, '14px'), whiteSpace: 'nowrap' }}
                        >
                            <BarChart3 className="w-4 h-4 flex-none" />
                            Reportes
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/panel-eventos/nocturna/nueva')}
                            className="border-0 rounded-full flex items-center justify-center gap-1.5 cursor-pointer lg:order-4 lg:flex-none"
                            style={{ height: 46, padding: '0 18px 0 16px', background: INK, color: '#fff', ...fuente(600, '14px'), whiteSpace: 'nowrap' }}
                        >
                            <Plus className="w-4 h-4 flex-none" strokeWidth={2.4} />
                            <span className="lg:hidden">Crear</span>
                            <span className="hidden lg:inline">Crear una inscripción</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/panel-eventos/nocturna/acreditar')}
                            className="col-span-2 border-0 rounded-full flex items-center justify-center gap-2 cursor-pointer lg:order-2 lg:flex-none"
                            style={{ height: 46, padding: '0 18px', background: CAMPO, color: INK, ...fuente(600, '14px'), whiteSpace: 'nowrap' }}
                        >
                            <QrCode className="w-4 h-4 flex-none" />
                            Acreditar
                        </button>

                        {/* Adolescentes por tribu. Los tres números y, abajo, una
                            sola barra partida en los colores de cada tribu: de un
                            vistazo se ve si están parejas. Teléfono: debajo de
                            Acreditar, a todo el ancho. Compu: en el hueco entre
                            el título y los botones. */}
                        <div
                            role="group"
                            aria-label="Adolescentes por tribu"
                            className="col-span-2 mt-1.5 lg:mt-0 lg:order-1 lg:ml-6 lg:mr-auto lg:w-[360px]"
                            style={{ borderRadius: 22, background: CAMPO, padding: '12px 16px 14px' }}
                        >
                            <div className="grid grid-cols-3">
                                {(['Garra', 'Trueno', 'Sin tribu'] as NocturnaTribu[]).map((t, n) => (
                                    <div
                                        key={t}
                                        className="min-w-0"
                                        style={{
                                            paddingLeft: n === 0 ? 0 : 14,
                                            borderLeft: n === 0 ? 'none' : '1px solid rgba(0,0,0,.08)',
                                        }}
                                    >
                                        <span className="flex items-center gap-1.5" style={{ ...fuente(600, '12.5px'), color: 'rgba(0,0,0,.62)' }}>
                                            <span aria-hidden="true" className="flex-none" style={{ width: 7, height: 7, borderRadius: 999, background: COLOR_TRIBU[t] }} />
                                            <span className="truncate">{t}</span>
                                        </span>
                                        <span
                                            className="block"
                                            style={{ ...fuente(600, '24px', '1.15'), color: INK, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', marginTop: 3 }}
                                        >
                                            {resumen.tribus[t]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div aria-hidden="true" className="flex overflow-hidden" style={{ height: 6, borderRadius: 999, marginTop: 11, gap: resumen.chicos ? 2 : 0, background: resumen.chicos ? 'transparent' : 'rgba(0,0,0,.08)' }}>
                                {resumen.chicos > 0 && (['Garra', 'Trueno', 'Sin tribu'] as NocturnaTribu[])
                                    .filter(t => resumen.tribus[t] > 0)
                                    .map(t => (
                                        <span key={t} style={{ flexGrow: resumen.tribus[t], flexBasis: 0, background: COLOR_TRIBU[t] }} />
                                    ))}
                            </div>
                        </div>
                    </div>

                    {/* La inscripción pública y el buscador. Teléfono: primero la
                        pestaña de ajustes y el buscador abajo, pegado a la lista
                        que filtra. Compu: el buscador a la izquierda y la
                        pestaña a la derecha; al abrirse crece hacia abajo. */}
                    <div className="flex flex-col gap-2.5 mt-3.5 lg:flex-row lg:items-start">
                        {/* Los dos ajustes de /nocturna-inscripcion juntos —si
                            toma gente y a qué precio— en una pestaña que arranca
                            cerrada. Cerrada ya dice el estado y el precio, que es
                            lo que se mira; abierta deja cambiarlos. */}
                        <div className="lg:order-last lg:flex-none lg:w-[400px]" style={{ borderRadius: 22, background: CAMPO }}>
                            <button
                                type="button"
                                onClick={() => {
                                    if (ajustesAbiertos) setEditandoPrecio(false);
                                    setAjustesAbiertos(a => !a);
                                }}
                                aria-expanded={ajustesAbiertos}
                                aria-controls="nocturna-ajustes"
                                className="border-0 bg-transparent flex items-center gap-2.5 cursor-pointer text-left w-full"
                                style={{ minHeight: 56, padding: '0 10px 0 16px', borderRadius: 22 }}
                            >
                                <span
                                    aria-hidden="true"
                                    className="flex-none"
                                    style={{ width: 8, height: 8, borderRadius: 999, background: config?.inscripcionesAbiertas ? '#16a34a' : '#a8a7a2' }}
                                />
                                <span className="flex-1 min-w-0 truncate" style={{ ...fuente(600, '14px'), color: config?.inscripcionesAbiertas ? VERDE : INK }}>
                                    {cambiandoEstado
                                        ? 'Cambiando…'
                                        : config?.inscripcionesAbiertas ? 'Inscripciones abiertas' : 'Inscripciones cerradas'}
                                </span>
                                <span className="flex-none" style={{ ...fuente(600, '13.5px'), color: 'rgba(0,0,0,.6)' }}>
                                    {plata(precio)}
                                </span>
                                <span className="flex items-center justify-center flex-none" style={{ width: 34, height: 34, borderRadius: 999, background: CARTA }}>
                                    <ChevronDown
                                        className="w-4 h-4 transition-transform duration-200 motion-reduce:transition-none"
                                        style={{ color: INK, transform: ajustesAbiertos ? 'rotate(180deg)' : 'none' }}
                                        strokeWidth={2.4}
                                    />
                                </span>
                            </button>

                            {/* 0fr → 1fr: la pestaña se despliega con su alto
                                real. Cerrada queda `inert` para que el tab no
                                entre a los botones escondidos. */}
                            <div
                                id="nocturna-ajustes"
                                className="grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none"
                                style={{ gridTemplateRows: ajustesAbiertos ? '1fr' : '0fr' }}
                                inert={!ajustesAbiertos}
                            >
                                <div className="min-h-0 overflow-hidden">
                                    <span aria-hidden="true" className="block h-px mx-4" style={{ background: 'rgba(0,0,0,.08)' }} />

                                    {/* El interruptor que decide si /nocturna-inscripcion
                                        toma gente o avisa que no. */}
                                    <button
                                        type="button"
                                        onClick={alternarInscripciones}
                                        disabled={cambiandoEstado}
                                        role="switch"
                                        aria-checked={!!config?.inscripcionesAbiertas}
                                        className="border-0 bg-transparent flex items-center gap-3 cursor-pointer text-left w-full"
                                        style={{ minHeight: 60, padding: '10px 12px 10px 16px', borderRadius: 22 }}
                                    >
                                        <span className="flex-1 min-w-0">
                                            <span className="block" style={{ ...fuente(600, '14px'), color: INK }}>
                                                Tomar inscripciones
                                            </span>
                                            <span className="block" style={{ ...fuente(500, '12.5px', '1.45'), color: 'rgba(0,0,0,.58)', marginTop: 2 }}>
                                                {config?.inscripcionesAbiertas
                                                    ? 'El link público toma inscripciones.'
                                                    : 'El link público avisa que no se toman más. Las entradas ya emitidas siguen valiendo.'}
                                            </span>
                                        </span>
                                        <span
                                            className="flex items-center flex-none"
                                            style={{
                                                width: 48, height: 30, borderRadius: 999,
                                                background: config?.inscripcionesAbiertas ? '#16a34a' : '#c9c8c4',
                                                padding: 3,
                                                justifyContent: config?.inscripcionesAbiertas ? 'flex-end' : 'flex-start',
                                            }}
                                        >
                                            <span style={{ width: 24, height: 24, borderRadius: 999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.18)' }} />
                                        </span>
                                    </button>

                                    <span aria-hidden="true" className="block h-px mx-4" style={{ background: 'rgba(0,0,0,.08)' }} />

                                    {!editandoPrecio ? (
                                        <button
                                            type="button"
                                            onClick={() => { setPrecioBorrador(String(precio)); setEditandoPrecio(true); }}
                                            // Sin esto el nombre accesible queda "Entrada $40.000
                                            // Editar": las tres partes del botón leídas de corrido.
                                            aria-label="Editar el precio de la entrada"
                                            className="border-0 bg-transparent flex items-center gap-2.5 cursor-pointer w-full"
                                            style={{ minHeight: 60, padding: '0 12px 0 16px', borderRadius: 22 }}
                                        >
                                            <span className="flex-1 text-left" style={{ ...fuente(500, '13.5px'), color: 'rgba(0,0,0,.6)' }}>Entrada</span>
                                            <span style={{ ...fuente(600, '15px'), color: INK }}>{plata(precio)}</span>
                                            <span className="flex items-center" style={{ height: 32, padding: '0 14px', borderRadius: 999, background: CARTA, ...fuente(600, '12.5px'), color: INK }}>
                                                Editar
                                            </span>
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-1.5 w-full" style={{ minHeight: 60, padding: '0 10px' }}>
                                            <div
                                                className="flex items-center gap-1 flex-1 min-w-0"
                                                style={{ height: 40, padding: '0 12px', borderRadius: 999, background: CARTA, boxShadow: `0 0 0 1.5px ${INK} inset` }}
                                            >
                                                <span style={{ ...fuente(600, '14px'), color: INK }}>$</span>
                                                <input
                                                    className="campo campo--desnudo"
                                                    style={{ width: 84, minWidth: 0, flex: 1 }}
                                                    value={precioBorrador}
                                                    inputMode="numeric"
                                                    aria-label="Precio de la entrada"
                                                    onChange={e => setPrecioBorrador(e.target.value.replace(/\D/g, '').slice(0, 9))}
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setEditandoPrecio(false)}
                                                className="border-0 rounded-full cursor-pointer flex-none"
                                                style={{ height: 40, padding: '0 14px', background: CARTA, ...fuente(600, '12.5px'), color: INK }}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                onClick={guardarPrecio}
                                                disabled={guardandoPrecio}
                                                className="border-0 rounded-full cursor-pointer flex-none"
                                                style={{ height: 40, padding: '0 14px', background: INK, ...fuente(600, '12.5px'), color: '#fff' }}
                                            >
                                                {guardandoPrecio ? 'Guardando…' : 'Guardar'}
                                            </button>
                                        </div>
                                    )}
                                    {editandoPrecio && (
                                        <p style={{ ...fuente(500, '12.5px', '1.5'), color: 'rgba(0,0,0,.58)', margin: 0, padding: '0 16px 14px' }}>
                                            Cambia lo que va a pagar quien se inscriba de ahora en más. Cada familia ya anotada conserva el precio que pagó.
                                            {config?.proximo && ` El aumento a ${plata(config.proximo.precio)} sigue programado.`}
                                        </p>
                                    )}
                                    {/* Lo programado: la promo por edad y el próximo precio.
                                        Lo calcula la base (sql/nocturna_promo_12.sql); acá se
                                        dice, para que nadie se sorprenda el martes. */}
                                    {!editandoPrecio && (config?.promo || config?.proximo) && (
                                        <div style={{ padding: '0 16px 14px' }}>
                                            {config?.promo && (
                                                <p style={{ ...fuente(500, '12.5px', '1.5'), color: 'rgba(0,0,0,.62)', margin: 0 }}>
                                                    <span style={{ ...fuente(600, '12.5px'), color: INK }}>Promo {config.promo.edad} años: {plata(config.promo.precio)}</span>
                                                    {' '}hasta el {new Date(Date.parse(config.promo.hasta) - 60000).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })} a las {new Date(Date.parse(config.promo.hasta) - 60000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' })}.
                                                </p>
                                            )}
                                            {config?.proximo && (
                                                <p style={{ ...fuente(500, '12.5px', '1.5'), color: 'rgba(0,0,0,.62)', margin: config?.promo ? '2px 0 0' : 0 }}>
                                                    <span style={{ ...fuente(600, '12.5px'), color: INK }}>Pasa a {plata(config.proximo.precio)}</span>
                                                    {' '}el {new Date(config.proximo.desde).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' })} a las {new Date(config.proximo.desde).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'America/Argentina/Buenos_Aires' })}, automáticamente.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div
                            className="flex items-center gap-2.5 h-12 lg:h-14 lg:flex-1"
                            style={{ minWidth: 0, minHeight: 48, borderRadius: 999, background: CAMPO, padding: '0 8px 0 16px' }}
                        >
                            <Search className="w-4 h-4 flex-none" style={{ color: 'rgba(0,0,0,.55)' }} strokeWidth={2.2} />
                            <input
                                className="campo campo--desnudo"
                                value={busqueda}
                                onChange={e => setBusqueda(e.target.value)}
                                placeholder="Buscar adulto o adolescente"
                                aria-label="Buscar por nombre de adulto o de adolescente"
                            />
                            {!!busqueda && (
                                <button
                                    type="button"
                                    onClick={() => setBusqueda('')}
                                    aria-label="Limpiar la búsqueda"
                                    className="border-0 rounded-full flex items-center justify-center cursor-pointer flex-none"
                                    style={{ width: 30, height: 30, background: CARTA }}
                                >
                                    <X className="w-3 h-3" style={{ color: INK }} strokeWidth={2.6} />
                                </button>
                            )}
                        </div>
                    </div>


                    {/* Resumen */}
                    <div className="flex gap-4 mt-3 flex-wrap">
                        <span style={{ ...fuente(600, '12.5px'), color: INK }}>
                            {resumen.familias} {resumen.familias === 1 ? 'familia' : 'familias'} · {resumen.chicos} {resumen.chicos === 1 ? 'adolescente' : 'adolescentes'}
                        </span>
                        <span className="flex items-center gap-1.5" style={{ ...fuente(600, '12.5px'), color: VERDE }}>
                            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#16a34a' }} />
                            {resumen.aprobados} {resumen.aprobados === 1 ? 'aprobado' : 'aprobados'}
                        </span>
                        <span className="flex items-center gap-1.5" style={{ ...fuente(600, '12.5px'), color: INK }}>
                            <span style={{ width: 7, height: 7, borderRadius: 999, background: INK }} />
                            {resumen.retirados} {resumen.retirados === 1 ? 'retirado' : 'retirados'}
                        </span>
                        {resumen.sinFotos > 0 && (
                            <span className="flex items-center gap-1.5" style={{ ...fuente(600, '12.5px'), color: AMBAR_INK }}>
                                <span style={{ width: 7, height: 7, borderRadius: 999, background: '#e8b96a' }} />
                                {resumen.sinFotos} sin fotos
                            </span>
                        )}
                        {resumen.sinEmail > 0 && (
                            <span className="flex items-center gap-1.5" style={{ ...fuente(600, '12.5px'), color: AMBAR_INK }}>
                                <span style={{ width: 7, height: 7, borderRadius: 999, background: '#e8b96a' }} />
                                {resumen.sinEmail} sin entrada enviada
                            </span>
                        )}
                    </div>
                </div>
            </header>

            {/* Cuerpo */}
            <main className="flex-1 min-h-0">
                <div className="mx-auto px-4 lg:px-8 py-4 lg:py-5" style={{ maxWidth: 1280 }}>
                    {!filtradas.length ? (
                        <div className="rounded-[22px] text-center" style={{ background: CARTA, padding: '44px 24px' }}>
                            <p style={{ ...fuente(600, '17px'), color: INK, margin: 0 }}>
                                {busqueda ? 'Nadie se llama así' : 'Todavía no hay nadie anotado'}
                            </p>
                            <p style={{ ...fuente(500, '13.5px'), color: 'rgba(0,0,0,.6)', margin: '8px 0 0' }}>
                                {busqueda
                                    ? 'Buscamos entre adultos y adolescentes. Probá solo con el apellido.'
                                    : 'Cuando alguien se inscriba, su familia aparece acá.'}
                            </p>
                            {busqueda && (
                                <button
                                    type="button"
                                    onClick={() => setBusqueda('')}
                                    className="border-0 rounded-full cursor-pointer mt-4"
                                    style={{ height: 46, padding: '0 22px', background: CAMPO, color: INK, ...fuente(600, '14px') }}
                                >
                                    Limpiar la búsqueda
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* ── Mobile: una carta por familia ───────────── */}
                            <div className="lg:hidden">
                                {grupos.map(g => (
                                    <div key={g.titulo}>
                                        <p style={{ ...fuente(600, '11px'), letterSpacing: '.07em', color: 'rgba(0,0,0,.55)', margin: '6px 4px 10px' }}>
                                            {g.titulo}
                                        </p>
                                        <div className="flex flex-col gap-2.5 mb-5">
                                            {g.filas.map(({ insc, coincideChico }) => (
                                                <div key={insc.id} className="rounded-[20px]" style={{ background: CARTA, padding: 16 }}>
                                                    <div className="flex items-start gap-2.5">
                                                        <div className="flex-1 min-w-0">
                                                            <p style={{ ...fuente(600, '11px'), letterSpacing: '.05em', color: 'rgba(0,0,0,.5)', margin: 0 }}>
                                                                ADULTO RESPONSABLE
                                                            </p>
                                                            <p style={{ ...fuente(600, '16px'), color: INK, margin: '3px 0 0' }}>
                                                                {insc.adultoNombre} {insc.adultoApellido}
                                                            </p>
                                                            {!!coincideChico.length && (
                                                                <p style={{ ...fuente(500, '11.5px'), color: 'rgba(0,0,0,.55)', margin: '3px 0 0' }}>
                                                                    Coincide: {coincideChico.join(', ')}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <Estado insc={insc} />
                                                    </div>

                                                    <div className="flex flex-col gap-1.5 mt-3">
                                                        {(insc.jovenes || []).map(j => (
                                                            <div key={j.id} className="flex items-center gap-2" style={{ minHeight: 26 }}>
                                                                <span className="flex-1 min-w-0 truncate" style={{ ...fuente(500, '14px'), color: INK }}>
                                                                    {j.nombre} {j.apellido}
                                                                </span>
                                                                <ChipTribu tribu={j.tribu} />
                                                            </div>
                                                        ))}
                                                        {!insc.aceptaFotos && <div className="mt-0.5 flex"><ChipSinFotos /></div>}
                                                        {/* En el teléfono no hay columna donde ponerlo:
                                                            va con los adolescentes, y sólo si hay algo. */}
                                                        <div className="flex flex-col gap-1.5 mt-0.5">
                                                            <Restricciones insc={insc} compacto />
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col gap-1 mt-3 pt-3" style={{ borderTop: `1px solid ${CAMPO}` }}>
                                                        <span style={{ ...fuente(500, '12.5px'), color: 'rgba(0,0,0,.6)' }}>
                                                            Inscripción {fechaCorta(insc.createdAt)}
                                                        </span>
                                                        {!!insc.aprobadoAt && (
                                                            <span className="flex items-center gap-1.5" style={{ ...fuente(600, '12.5px'), color: VERDE }}>
                                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>
                                                                Ingresó {fechaYHora(insc.aprobadoAt)}
                                                            </span>
                                                        )}
                                                        <AvisoEmail insc={insc} ancho />
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                        <Comprobante insc={insc} bloque />
                                                        {botonVerDetalles(insc.id, 38)}
                                                        {puedeEliminar && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setOverlay({ tipo: 'eliminar', insc })}
                                                            title="Eliminar inscripción"
                                                            aria-label={`Eliminar la inscripción de ${insc.adultoNombre} ${insc.adultoApellido}`}
                                                            className="border-0 rounded-full flex items-center justify-center cursor-pointer flex-none"
                                                            style={{ width: 38, height: 38, background: ROJO_FONDO }}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" style={{ color: ROJO }} />
                                                        </button>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* ── Desktop: la planilla ────────────────────── */}
                            <div className="hidden lg:block rounded-[18px] overflow-hidden" style={{ background: CARTA }}>
                                <div
                                    className="grid"
                                    style={{ gridTemplateColumns: COLUMNAS, borderBottom: '1px solid #eeeeec' }}
                                >
                                    {['FECHA', 'ADULTO RESPONSABLE', 'ADOLESCENTES INSCRIPTOS', 'COMIDA', 'PAGO', 'ESTADO', ''].map((t, i) => (
                                        <span key={i} style={{ padding: '12px 14px', ...fuente(600, '11px'), letterSpacing: '.07em', color: 'rgba(0,0,0,.55)' }}>{t}</span>
                                    ))}
                                </div>
                                {grupos.map(g => (
                                    <div key={g.titulo}>
                                        <div style={{ padding: '10px 20px', background: '#fafaf9', borderBottom: `1px solid ${CAMPO}`, ...fuente(600, '11px'), letterSpacing: '.07em', color: 'rgba(0,0,0,.55)' }}>
                                            {g.titulo}
                                        </div>
                                        {g.filas.map(({ insc, coincideChico }) => (
                                            <div
                                                key={insc.id}
                                                className="grid items-start"
                                                style={{ gridTemplateColumns: COLUMNAS, borderBottom: `1px solid ${CAMPO_HONDO}` }}
                                            >
                                                <div style={{ padding: '16px 14px 16px 20px', minWidth: 0 }}>
                                                    <p style={{ ...fuente(600, '13px'), color: INK, margin: 0 }}>{fechaCorta(insc.createdAt)}</p>
                                                    {!!insc.aprobadoAt && (
                                                        <p className="flex items-center gap-1.5" style={{ ...fuente(600, '12px'), color: VERDE, margin: '4px 0 0' }}>
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>
                                                            {fechaYHora(insc.aprobadoAt)}
                                                        </p>
                                                    )}
                                                </div>

                                                <div style={{ padding: '16px 14px', minWidth: 0 }}>
                                                    <p style={{ ...fuente(600, '14px'), color: INK, margin: 0, overflowWrap: 'anywhere' }}>
                                                        {insc.adultoNombre} {insc.adultoApellido}
                                                    </p>
                                                    {!!coincideChico.length && (
                                                        <p style={{ ...fuente(500, '11.5px'), color: 'rgba(0,0,0,.55)', margin: '3px 0 0' }}>
                                                            Coincide: {coincideChico.join(', ')}
                                                        </p>
                                                    )}
                                                    <AvisoEmail insc={insc} />
                                                </div>

                                                <div className="flex flex-col gap-1.5" style={{ padding: '13px 14px', minWidth: 0 }}>
                                                    {(insc.jovenes || []).map(j => (
                                                        <div key={j.id} className="flex items-center gap-2 flex-wrap">
                                                            <span style={{ ...fuente(500, '13.5px'), color: INK }}>{j.nombre} {j.apellido}</span>
                                                            <ChipTribu tribu={j.tribu} />
                                                        </div>
                                                    ))}
                                                    {!insc.aceptaFotos && <div className="flex"><ChipSinFotos /></div>}
                                                </div>

                                                <div className="flex flex-col gap-1.5" style={{ padding: '15px 14px', minWidth: 0 }}>
                                                    <Restricciones insc={insc} />
                                                </div>

                                                <div style={{ padding: 14, minWidth: 0 }}><Comprobante insc={insc} /></div>
                                                <div style={{ padding: 14, minWidth: 0 }}><Estado insc={insc} /></div>

                                                <div className="flex justify-end gap-1.5" style={{ padding: '13px 20px 13px 6px' }}>
                                                    {botonVerDetalles(insc.id)}
                                                    {puedeEliminar && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setOverlay({ tipo: 'eliminar', insc })}
                                                        title="Eliminar inscripción"
                                                        aria-label={`Eliminar la inscripción de ${insc.adultoNombre} ${insc.adultoApellido}`}
                                                        className="border-0 rounded-full flex items-center justify-center cursor-pointer flex-none"
                                                        style={{ width: 34, height: 34, background: ROJO_FONDO }}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" style={{ color: ROJO }} />
                                                    </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
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

            {/* Overlays */}
            {overlay && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: 'rgba(10,10,10,.45)' }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="w-full rounded-[26px]" style={{ maxWidth: overlay.tipo === 'comprobante' ? 620 : 440, background: CARTA, padding: '24px 22px 20px' }}>
                        {overlay.tipo === 'eliminar' && (
                            <>
                                <p style={{ ...fuente(600, '19px', '1.3'), color: INK, margin: 0 }}>
                                    ¿Eliminar la inscripción de {overlay.insc.adultoNombre} {overlay.insc.adultoApellido}?
                                </p>
                                <p style={{ ...fuente(500, '14px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '10px 0 0' }}>
                                    Se borran también {(overlay.insc.jovenes || []).length === 1 ? 'su adolescente' : `sus ${(overlay.insc.jovenes || []).length} adolescentes`} y el comprobante. Su QR deja de funcionar en la puerta. No se puede deshacer.
                                </p>
                                <div className="flex flex-col gap-2 mt-5">
                                    <button
                                        type="button"
                                        onClick={() => eliminar(overlay.insc)}
                                        disabled={ocupado === `del-${overlay.insc.id}`}
                                        className="border-0 rounded-full cursor-pointer"
                                        style={{ height: 52, background: ROJO, color: '#fff', ...fuente(600, '15px') }}
                                    >
                                        {ocupado === `del-${overlay.insc.id}` ? 'Eliminando…' : 'Eliminar inscripción'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOverlay(null)}
                                        className="border-0 rounded-full cursor-pointer"
                                        style={{ height: 52, background: CAMPO, color: INK, ...fuente(600, '15px') }}
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </>
                        )}

                        {overlay.tipo === 'comprobante' && (
                            <>
                                <div className="flex items-center gap-2.5">
                                    <p className="flex-1" style={{ ...fuente(600, '16px'), color: INK, margin: 0 }}>
                                        {overlay.vistas.length === 1 ? 'Comprobante' : `${overlay.vistas.length} comprobantes`}
                                        {' · '}{overlay.insc.adultoNombre} {overlay.insc.adultoApellido}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setOverlay(null)}
                                        className="border-0 rounded-full cursor-pointer flex-none"
                                        style={{ height: 36, padding: '0 14px', background: CAMPO, ...fuente(600, '12.5px'), color: INK }}
                                    >
                                        Cerrar
                                    </button>
                                </div>
                                {/* Uno abajo del otro y no un carrusel: lo que se
                                    hace acá es sumar montos y ver si cierran con el
                                    total, y para eso hay que poder volver atrás con
                                    el dedo. Con uno solo se ve igual que antes. */}
                                <div
                                    className="flex flex-col gap-4 mt-3.5"
                                    style={{ maxHeight: '70vh', overflowY: 'auto' }}
                                >
                                    {overlay.vistas.map((v, i) => (
                                        <div key={`${v.url}-${i}`}>
                                            {overlay.vistas.length > 1 && (
                                                <div className="flex items-baseline gap-2" style={{ margin: '0 2px 7px' }}>
                                                    <span style={{ ...fuente(600, '13px'), color: INK }}>{v.titulo}</span>
                                                    <span style={{ ...fuente(500, '12.5px'), color: 'rgba(0,0,0,.55)' }}>{v.detalle}</span>
                                                </div>
                                            )}
                                            <img
                                                src={v.url}
                                                alt={`${v.titulo} de ${overlay.insc.adultoNombre} ${overlay.insc.adultoApellido}`}
                                                className="w-full rounded-[16px]"
                                                style={{ objectFit: 'contain', background: CAMPO }}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <p style={{ ...fuente(500, '12px', '1.5'), color: 'rgba(0,0,0,.55)', margin: '10px 2px 0' }}>
                                    {overlay.vistas.length === 1
                                        ? 'El link vence en 5 minutos. Si se cierra, volvé a abrirlo desde la planilla.'
                                        : `Los ${overlay.vistas.length} suman ${plata(overlay.insc.total)}, que es el total de la inscripción. Los links vencen en 5 minutos.`}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminNocturna;

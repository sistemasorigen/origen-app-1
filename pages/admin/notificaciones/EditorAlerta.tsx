import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Send, X } from 'lucide-react';
import { motion, useDragControls, useReducedMotion } from 'framer-motion';
import { useBloqueoDeFondo } from '../../../hooks/useBloqueoDeFondo';
import {
    guardarAutomatica, guardarProgramada, mensajeDeMotivo, nuevoIdAlerta, probarTexto,
    type Alerta, type Falla,
} from '../../../services/notificaciones';
import SelectorDeAudiencia, { type Elegida, type Estimacion } from './SelectorDeAudiencia';
import {
    Cargando, ErrorDeCampo, EJEMPLOS, PANTALLAS, Perilla, RotuloPaso, VistaPrevia, destinoValido, esUrlExterna, hoyAr,
} from './piezas';

/**
 * Crear o editar una alerta (design-claude/Sistemas - Gestion de
 * notificaciones). En el teléfono sube como hoja desde abajo; desde 768 px es
 * un modal centrado. Mismo patrón que FormularioDepartamento.
 *
 * · Programada (crear y editar) → notif_guardar_programada. El id de una nueva
 *   se genera UNA vez al abrir: un doble toque o un reintento mandan el mismo
 *   y la base no duplica.
 * · Automática (sólo editar) → notif_guardar_automatica: texto, no molestar,
 *   tope y activa. Cuándo sale y a quién le llega lo decide la app y se
 *   muestra como texto fijo.
 *
 * Los errores de la base van debajo del campo que corresponde (texto_invalido
 * trae `campo`); lo que no es de ningún campo, arriba de los botones.
 */

export type ModoEditor = { tipo: 'crear' } | { tipo: 'editar'; alerta: Alerta };

type Campo = 'nombre' | 'titulo' | 'mensaje' | 'destino' | 'vigencia' | 'frecuencia' | 'horas'
    | 'audiencia' | 'nm' | 'max' | 'general';

const CAMPO_DEL_MOTIVO: Partial<Record<Falla['motivo'], Campo>> = {
    url_invalida: 'destino', fechas_invalidas: 'vigencia', frecuencia_invalida: 'frecuencia',
    horas_invalidas: 'horas', horas_repetidas: 'horas',
    audiencia_vacia: 'audiencia', rol_invalido: 'audiencia', usuario_invalido: 'audiencia',
    horario_invalido: 'nm', tope_invalido: 'max', variable_invalida: 'mensaje',
};

/** Los límites de largo del SQL: programadas 60/160 (su CHECK), automáticas 120/500. */
const LARGO = {
    programada: { titulo: 60, mensaje: 160 },
    automatica: { titulo: 120, mensaje: 500 },
};

const ATAJOS: [number, string][] = [[1, 'Todos los días'], [7, 'Cada 7 días'], [15, 'Cada 15 días'], [30, 'Cada 30 días']];
const SUGERIDAS = ['10:00', '13:00', '16:00', '19:00', '21:00'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

interface Valores {
    nombre: string; titulo: string; mensaje: string; url: string;
    siempre: boolean; desde: string; hasta: string; cada: number; horas: string[];
    todos: boolean; roles: string[]; personas: Elegida[];
    nm: boolean; nmDesde: string; nmHasta: string; max: number | null; activa: boolean;
    permiteApagar: boolean;
}

const iniciales = (modo: ModoEditor): Valores => {
    if (modo.tipo === 'crear') {
        return {
            nombre: '', titulo: '', mensaje: '', url: '/notificaciones',
            siempre: true, desde: hoyAr(), hasta: '', cada: 7, horas: ['10:00'],
            todos: false, roles: [], personas: [],
            nm: true, nmDesde: '23:00', nmHasta: '08:00', max: null, activa: true,
            permiteApagar: true,
        };
    }
    const a = modo.alerta;
    return {
        nombre: a.nombre, titulo: a.titulo, mensaje: a.mensaje, url: a.url || '/notificaciones',
        siempre: a.siempreActiva ?? true, desde: a.desde || hoyAr(), hasta: a.hasta || '',
        cada: a.cadaNDias ?? 7, horas: a.horas.length ? a.horas : ['10:00'],
        todos: a.audienciaTodos, roles: a.audienciaRoles,
        personas: a.audienciaDetalle.map(p => ({ id: p.id, nombre: p.nombre })),
        nm: a.noMolestar, nmDesde: a.nmDesde || '23:00', nmHasta: a.nmHasta || '08:00',
        max: a.maxPorDia, activa: a.activa,
        permiteApagar: a.permiteApagar,
    };
};

const dm = (iso: string) => { const [, m, d] = iso.split('-'); return `${+d}/${+m}`; };
const horasTxt = (h: string[]) => (h.length === 1 ? `a las ${h[0]}` : `a las ${h.slice(0, -1).join(', ')} y ${h[h.length - 1]}`);

/** El resumen de la programación mientras se edita ("Sale todos los domingos a las 10:00…"). */
const resumen = (v: Valores): string => {
    let base: string;
    if (v.cada === 1) base = 'Sale todos los días';
    else if (v.cada === 7 && /^\d{4}-\d{2}-\d{2}$/.test(v.desde)) {
        const [y, m, d] = v.desde.split('-').map(Number);
        const dia = DIAS[new Date(y, m - 1, d).getDay()];
        base = `Sale todos los ${dia.endsWith('s') ? dia : `${dia}s`}`;
    } else base = `Sale cada ${v.cada} días`;
    return `${base} ${horasTxt(v.horas)}${v.desde ? `, desde el ${dm(v.desde)}` : ''}${!v.siempre && v.hasta ? ` hasta el ${dm(v.hasta)}` : ''}.`;
};

const EditorAlerta: React.FC<{
    modo: ModoEditor;
    onCerrar: () => void;
    onGuardado: (creada: boolean) => void;
    onDescartar: () => void;
    confirmacionAbierta: boolean;
}> = ({ modo, onCerrar, onGuardado, onDescartar, confirmacionAbierta }) => {
    useBloqueoDeFondo(true);
    const alerta = modo.tipo === 'editar' ? modo.alerta : null;
    const prog = !alerta || alerta.tipo === 'programada';
    const largo = prog ? LARGO.programada : LARGO.automatica;
    const [id] = useState(() => alerta?.id ?? nuevoIdAlerta());
    const [inicial] = useState(() => iniciales(modo));
    const [v, setV] = useState<Valores>(inicial);
    const [tocado, setTocado] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [errorBase, setErrorBase] = useState<{ campo: Campo; texto: string } | null>(null);
    const [estimacion, setEstimacion] = useState<Estimacion | null>(null);
    const [horaNueva, setHoraNueva] = useState('');
    // Una pantalla de la lista, o una dirección escrita a mano ("/gcx" o
    // "https://…"). Una que no está en la lista abre directo en "dirección".
    const [modoDestino, setModoDestino] = useState<'pantalla' | 'direccion'>(
        () => (PANTALLAS.some(p => p.ruta === inicial.url) ? 'pantalla' : 'direccion'));
    const [prueba, setPrueba] = useState<{ estado: 'mandando' } | { estado: 'listo'; ok: boolean; texto: string } | null>(null);
    const enviando = useRef(false);
    const panel = useRef<HTMLDivElement>(null);
    const refTitulo = useRef<HTMLInputElement>(null);
    const refMensaje = useRef<HTMLTextAreaElement>(null);
    const ultimoCampo = useRef<'titulo' | 'mensaje'>('mensaje');

    const [esMovil, setEsMovil] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
    const sinMovimiento = useReducedMotion();
    const arrastre = useDragControls();
    useEffect(() => {
        const medir = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    const cambiar = (p: Partial<Valores>) => {
        setV(prev => ({ ...prev, ...p }));
        if (errorBase) setErrorBase(null);
    };

    // ── Lo que falta (las mismas reglas que la base) ──────────────────────
    const llaves = /\{[^{}]*\}/;
    const eNombre = prog && !v.nombre.trim() ? 'Ponele un nombre a la alerta.' : null;
    const eTitulo = !v.titulo.trim() ? 'Escribí un título.'
        : v.titulo.trim().length > largo.titulo ? `El título tiene más de ${largo.titulo} letras.`
            : prog && llaves.test(v.titulo) ? 'Las programadas llevan texto fijo: sacá lo que está entre llaves.' : null;
    const eMensaje = !v.mensaje.trim() ? 'Escribí el mensaje.'
        : v.mensaje.trim().length > largo.mensaje ? `El mensaje tiene más de ${largo.mensaje} letras.`
            : prog && llaves.test(v.mensaje) ? 'Las programadas llevan texto fijo: sacá lo que está entre llaves.' : null;
    const eVigencia = prog && !v.siempre && (!v.hasta || v.hasta < v.desde) ? 'La fecha de fin tiene que ser igual o posterior al inicio.' : null;
    const eFrecuencia = prog && (!Number.isInteger(v.cada) || v.cada < 1 || v.cada > 365) ? 'Elegí cada cuántos días se repite: entre 1 y 365.' : null;
    const eHoras = prog && (v.horas.length < 1 || v.horas.length > 5) ? 'Elegí entre 1 y 5 horarios.' : null;
    const eAudiencia = prog && !v.todos && v.roles.length === 0 && v.personas.length === 0 ? 'Elegí a quién le llega: toda la iglesia, un rol o una persona.' : null;
    const eDestino = prog && !destinoValido(v.url)
        ? (v.url.trim() ? 'Escribí una sección que empiece con / (por ejemplo, /gcx) o una dirección que empiece con https://.' : 'Escribí a dónde lleva al tocarla.')
        : null;
    const eNm = v.nm &&(!v.nmDesde || !v.nmHasta || v.nmDesde === v.nmHasta) ? 'El horario de no molestar necesita un inicio y un fin distintos.' : null;
    const pasaTope = prog && !!estimacion && estimacion.personas > estimacion.tope;
    const invalido = !!(eNombre || eTitulo || eMensaje || eDestino || eVigencia || eFrecuencia || eHoras || eAudiencia || eNm || pasaTope);
    const hayCambios = JSON.stringify(v) !== JSON.stringify(inicial);

    const errorDe = (c: Campo, local: string | null) =>
        errorBase?.campo === c ? errorBase.texto : (tocado ? local : null);

    /** Pasar a "pantalla" con una dirección que no está en la lista vuelve a Notificaciones. */
    const elegirModoDestino = (m: 'pantalla' | 'direccion') => {
        setModoDestino(m);
        if (m === 'pantalla' && !PANTALLAS.some(p => p.ruta === v.url.trim())) cambiar({ url: '/notificaciones' });
    };

    const intentarCerrar = () => {
        if (guardando) return;
        if (hayCambios) onDescartar(); else onCerrar();
    };

    useEffect(() => { panel.current?.focus(); }, []);
    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape' && !confirmacionAbierta) intentarCerrar(); };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    });

    // ── Horarios: de 1 a 5, sin repetir, ordenados solos ─────────────────
    const [errorHora, setErrorHora] = useState<string | null>(null);
    const sumarHora = () => {
        const h = horaNueva || SUGERIDAS.find(s => !v.horas.includes(s)) || '';
        if (!h) return;
        if (v.horas.includes(h)) { setErrorHora(`Ya está el horario de las ${h}.`); return; }
        if (v.horas.length >= 5) { setErrorHora('Ya hay 5 horarios: es el máximo.'); return; }
        setErrorHora(null);
        setHoraNueva('');
        cambiar({ horas: [...v.horas, h].sort() });
    };

    // ── Variables (automáticas): se insertan donde está el cursor ────────
    const insertar = (variable: string) => {
        const campo = ultimoCampo.current;
        const el = campo === 'titulo' ? refTitulo.current : refMensaje.current;
        const actual = v[campo];
        const token = `{${variable}}`;
        if (actual.length + token.length > largo[campo]) { setErrorBase({ campo, texto: 'No entra: te pasás del máximo de letras.' }); return; }
        const desde = el?.selectionStart ?? actual.length;
        const hasta = el?.selectionEnd ?? actual.length;
        cambiar({ [campo]: actual.slice(0, desde) + token + actual.slice(hasta) } as Partial<Valores>);
        window.requestAnimationFrame(() => {
            el?.focus();
            const pos = desde + token.length;
            el?.setSelectionRange(pos, pos);
        });
    };

    // ── Guardar ──────────────────────────────────────────────────────────
    const guardar = async () => {
        if (enviando.current) return;
        if (invalido) {
            setTocado(true);
            panel.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
            return;
        }
        enviando.current = true;
        setGuardando(true);
        setErrorBase(null);
        const r = prog
            ? await guardarProgramada({
                id, nombre: v.nombre.trim(), titulo: v.titulo.trim(), mensaje: v.mensaje.trim(), url: v.url.trim(),
                siempreActiva: v.siempre, desde: v.desde, hasta: v.siempre ? null : v.hasta, cadaNDias: v.cada,
                horas: v.horas, todos: v.todos, roles: v.roles, usuarios: v.personas.map(p => p.id),
                noMolestar: v.nm, nmDesde: v.nmDesde, nmHasta: v.nmHasta, maxPorDia: v.max, activa: v.activa,
                permiteApagar: v.permiteApagar,
            })
            : await guardarAutomatica({
                id, titulo: v.titulo.trim(), mensaje: v.mensaje.trim(), activa: v.activa,
                noMolestar: v.nm, nmDesde: v.nmDesde, nmHasta: v.nmHasta, maxPorDia: v.max,
                // Un repetido sigue a su principal: no se manda lo que no se puede tocar.
                permiteApagar: alerta?.principalId ? (alerta.permiteApagar) : v.permiteApagar,
            });
        enviando.current = false;
        setGuardando(false);
        if (!r.ok) {
            const campo: Campo = r.motivo === 'texto_invalido'
                ? (r.campo === 'nombre' || r.campo === 'titulo' || r.campo === 'mensaje' ? r.campo : 'general')
                : CAMPO_DEL_MOTIVO[r.motivo] ?? 'general';
            setErrorBase({ campo, texto: mensajeDeMotivo(r) });
            return;
        }
        onGuardado(prog ? (r as { creada?: boolean }).creada === true : false);
    };

    // ── Enviarme una prueba ──────────────────────────────────────────────
    const mandarPrueba = async () => {
        if (prueba?.estado === 'mandando') return;
        if (!v.titulo.trim() || !v.mensaje.trim()) {
            setPrueba({ estado: 'listo', ok: false, texto: 'Escribí el título y el mensaje para poder probarla.' });
            return;
        }
        setPrueba({ estado: 'mandando' });
        const r = await probarTexto(v.titulo.trim(), v.mensaje.trim(), prog ? v.url.trim() : (alerta?.url ?? null), alerta?.id ?? null);
        setPrueba(r.ok
            ? { estado: 'listo', ok: true, texto: `Te la mandamos a tus dispositivos. ${r.quedan === 1 ? 'Te queda 1 prueba' : `Te quedan ${r.quedan} pruebas`} hoy.` }
            : { estado: 'listo', ok: false, texto: mensajeDeMotivo(r) });
    };

    // ── Pantalla ─────────────────────────────────────────────────────────
    const titulo = !alerta ? 'Nueva notificación' : prog ? 'Editar notificación programada' : 'Editar alerta de la app';
    const errNombre = errorDe('nombre', eNombre);
    const errTitulo = errorDe('titulo', eTitulo);
    const errMensaje = errorDe('mensaje', eMensaje);
    const errVigencia = errorDe('vigencia', eVigencia);
    const errFrecuencia = errorDe('frecuencia', eFrecuencia);
    const errHoras = errorDe('horas', eHoras) ?? errorHora;
    const errAudiencia = errorDe('audiencia', eAudiencia);
    const errNm = errorDe('nm', eNm);
    const errMax = errorDe('max', null);
    const errDestino = errorDe('destino', eDestino);
    const rojo = (e: string | null) => (e ? ({ '--panel-campo-borde': '#b42318' } as React.CSSProperties) : undefined);
    const pasoTexto = prog ? 3 : 2;

    const contador = (n: number, max: number) => (
        <span className={`text-[12px] font-semibold ${n > max ? 'text-[#b42318]' : 'text-black/[.5]'}`}>{n}/{max}</span>
    );

    const interruptorEstado = (
        <div className="flex flex-col gap-2.5">
            <RotuloPaso>{prog ? '8' : '5'} · Estado</RotuloPaso>
            <button
                type="button"
                role="switch"
                aria-checked={v.activa}
                onClick={() => cambiar({ activa: !v.activa })}
                className="flex min-h-[60px] w-full items-center gap-3 rounded-[18px] bg-[#f6f6f4] px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
            >
                <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-bold text-[#0a0a0a]">{v.activa ? 'Activa' : 'Pausada'}</span>
                    <span className="mt-0.5 block text-[12.5px] font-medium leading-[1.45] text-black/[.6]">
                        {v.activa
                            ? (prog ? 'Sale en los horarios elegidos.' : 'Manda el push cada vez que pasa.')
                            : (prog ? 'No sale nada hasta que la actives.' : 'No manda push; el aviso igual aparece en la app.')}
                    </span>
                </span>
                <Perilla on={v.activa} />
            </button>
            {alerta?.principalId ? (
                <p className="m-0 rounded-[16px] bg-[#f6f6f4] px-4 py-3 text-[12.5px] font-semibold leading-[1.5] text-black/[.66]">
                    Es un aviso repetido de «{alerta.principalNombre}»: cada persona lo apaga junto con ése, desde sus preferencias.
                </p>
            ) : (
                <button
                    type="button"
                    role="switch"
                    aria-checked={v.permiteApagar}
                    onClick={() => cambiar({ permiteApagar: !v.permiteApagar })}
                    className="flex min-h-[60px] w-full items-center gap-3 rounded-[18px] bg-[#f6f6f4] px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-bold text-[#0a0a0a]">Cada persona la puede apagar</span>
                        <span className="mt-0.5 block text-[12.5px] font-medium leading-[1.45] text-black/[.6]">
                            {v.permiteApagar
                                ? 'Aparece en sus preferencias de Notificaciones. Si la apaga, no le suena; el aviso queda en la app.'
                                : 'No aparece en sus preferencias: le suena a todos los que la reciben.'}
                        </span>
                    </span>
                    <Perilla on={v.permiteApagar} />
                </button>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[110] flex items-end justify-center md:items-center md:p-10">
            <div className="absolute inset-0 bg-[rgba(10,10,10,.36)] motion-safe:animate-[notifFade_.18s_ease_both]" onClick={intentarCerrar} />
            <motion.div
                id="notif-editor"
                ref={panel}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="notif-editor-titulo"
                className="relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,.18)] outline-none md:max-h-[calc(100dvh-64px)] md:max-w-[680px] md:rounded-[28px] md:shadow-[0_24px_60px_rgba(0,0,0,.22)]"
                initial={esMovil ? { y: '100%' } : { opacity: 0, y: 10, scale: 0.98 }}
                animate={esMovil ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                transition={sinMovimiento ? { duration: 0 } : { type: 'spring', damping: 34, stiffness: 340 }}
                drag={esMovil ? 'y' : false}
                dragListener={false}
                dragControls={arrastre}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, info) => { if (info.offset.y > 90) intentarCerrar(); }}
            >
                <div
                    onPointerDown={esMovil ? e => arrastre.start(e) : undefined}
                    className="flex-none pb-1 pt-2.5 md:hidden"
                    style={esMovil ? { touchAction: 'none', cursor: 'grab' } : undefined}
                >
                    <span aria-hidden="true" className="mx-auto block h-[5px] w-11 rounded-full bg-black/[.16]" />
                </div>

                <div
                    onPointerDown={esMovil ? e => arrastre.start(e) : undefined}
                    style={esMovil ? { touchAction: 'none' } : undefined}
                    className="flex flex-none items-start gap-3 px-[22px] pb-2 pt-[14px] md:pt-[22px]"
                >
                    <div className="min-w-0 flex-1">
                        <h2 id="notif-editor-titulo" className="m-0 text-[19px] font-bold text-[#0a0a0a]">{titulo}</h2>
                        <p className="m-0 mt-0.5 truncate text-[13px] font-semibold text-black/[.58]">
                            {prog ? (v.nombre.trim() || 'Programada') : alerta?.nombre}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={intentarCerrar}
                        aria-label="Cerrar"
                        className="hidden h-10 w-10 flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] md:flex"
                    >
                        <X size={18} strokeWidth={2.2} aria-hidden="true" />
                    </button>
                </div>

                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[26px] overflow-y-auto overflow-x-hidden overscroll-contain px-[22px] pb-5 pt-3">
                    {/* 1 · Nombre (programada) o el evento fijo (automática) */}
                    {prog ? (
                        <label className="flex flex-col gap-2">
                            <RotuloPaso>1 · Nombre de la alerta</RotuloPaso>
                            <input
                                value={v.nombre}
                                onChange={e => cambiar({ nombre: e.target.value })}
                                maxLength={120}
                                placeholder="Por ejemplo, Recordatorio del domingo"
                                aria-invalid={!!errNombre}
                                autoComplete="off"
                                className="h-[50px] w-full px-4 text-[15px] font-semibold"
                                style={rojo(errNombre)}
                            />
                            <span className="text-[12.5px] font-medium text-black/[.58]">Lo ve Sistemas y, en sus preferencias, la gente que la recibe.</span>
                            {errNombre && <ErrorDeCampo>{errNombre}</ErrorDeCampo>}
                        </label>
                    ) : (
                        <div className="flex flex-col gap-2.5">
                            <RotuloPaso>1 · Cuándo sale y a quién le llega</RotuloPaso>
                            <div className="rounded-[18px] bg-[#f6f6f4] px-4 py-3.5">
                                <p className="m-0 text-[14.5px] font-bold text-[#0a0a0a]">Sale cuando {alerta?.descripcionEvento || 'pasa el evento'}.</p>
                                <p className="m-0 mt-1 text-[13.5px] font-semibold text-black/[.66]">Le llega a: {alerta?.destinatarioTexto || 'quien corresponde'}.</p>
                            </div>
                            <span className="text-[12.5px] font-medium text-black/[.58]">El evento y quién la recibe los define la app.</span>
                        </div>
                    )}

                    {/* 2 · Cuándo se repite (programada) */}
                    {prog && (
                        <div className="flex flex-col gap-3">
                            <RotuloPaso>2 · Cuándo se repite</RotuloPaso>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={v.siempre}
                                onClick={() => cambiar({ siempre: !v.siempre })}
                                className="flex min-h-[52px] w-full items-center gap-3 rounded-[18px] bg-[#f6f6f4] px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                <span className="flex-1 text-[14.5px] font-bold">Siempre activa (sin fecha de fin)</span>
                                <Perilla on={v.siempre} />
                            </button>
                            <div className="flex flex-wrap gap-2.5">
                                <label className="flex min-w-0 basis-[150px] flex-1 flex-col gap-1.5">
                                    <span className="text-[13px] font-bold text-black/[.62]">{v.siempre ? 'Desde' : 'Del'}</span>
                                    <input type="date" value={v.desde} onChange={e => cambiar({ desde: e.target.value })} className="h-[48px] w-full px-3.5 text-[15px] font-semibold" aria-invalid={!!errVigencia} style={rojo(errVigencia)} />
                                </label>
                                {!v.siempre && (
                                    <label className="flex min-w-0 basis-[150px] flex-1 flex-col gap-1.5">
                                        <span className="text-[13px] font-bold text-black/[.62]">Al</span>
                                        <input type="date" value={v.hasta} min={v.desde} onChange={e => cambiar({ hasta: e.target.value })} className="h-[48px] w-full px-3.5 text-[15px] font-semibold" aria-invalid={!!errVigencia} style={rojo(errVigencia)} />
                                    </label>
                                )}
                            </div>
                            {errVigencia && <ErrorDeCampo>{errVigencia}</ErrorDeCampo>}

                            <div className="flex flex-wrap items-center gap-2.5">
                                <span className="text-[14px] font-bold">Repetir cada</span>
                                <input
                                    type="number"
                                    min={1}
                                    max={365}
                                    inputMode="numeric"
                                    value={Number.isFinite(v.cada) ? String(v.cada) : ''}
                                    onChange={e => cambiar({ cada: parseInt(e.target.value, 10) })}
                                    aria-label="Cada cuántos días"
                                    aria-invalid={!!errFrecuencia}
                                    className="h-[46px] w-[84px] px-3 text-center text-[15px] font-bold"
                                    style={rojo(errFrecuencia)}
                                />
                                <span className="text-[14px] font-bold">{v.cada === 1 ? 'día' : 'días'}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {ATAJOS.map(([n, t]) => (
                                    <button
                                        key={n}
                                        type="button"
                                        aria-pressed={v.cada === n}
                                        onClick={() => cambiar({ cada: n })}
                                        className={`min-h-[40px] rounded-full px-3.5 text-[13px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${v.cada === n ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-[#0a0a0a]'}`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                            {errFrecuencia && <ErrorDeCampo>{errFrecuencia}</ErrorDeCampo>}
                        </div>
                    )}

                    {/* Qué dice */}
                    <div className="flex flex-col gap-3">
                        <RotuloPaso>{pasoTexto} · Qué dice la notificación</RotuloPaso>
                        <label className="flex flex-col gap-1.5">
                            <span className="flex items-baseline justify-between text-[13px] font-bold text-black/[.62]">
                                <span>Título</span>{contador(v.titulo.trim().length, largo.titulo)}
                            </span>
                            <input
                                ref={refTitulo}
                                value={v.titulo}
                                onChange={e => cambiar({ titulo: e.target.value })}
                                onFocus={() => { ultimoCampo.current = 'titulo'; }}
                                maxLength={largo.titulo}
                                placeholder="Por ejemplo, Nos vemos hoy"
                                aria-invalid={!!errTitulo}
                                autoComplete="off"
                                className="h-[50px] w-full px-4 text-[15px] font-semibold"
                                style={rojo(errTitulo)}
                            />
                            {errTitulo && <ErrorDeCampo>{errTitulo}</ErrorDeCampo>}
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="flex items-baseline justify-between text-[13px] font-bold text-black/[.62]">
                                <span>Mensaje</span>{contador(v.mensaje.trim().length, largo.mensaje)}
                            </span>
                            <textarea
                                ref={refMensaje}
                                value={v.mensaje}
                                onChange={e => cambiar({ mensaje: e.target.value })}
                                onFocus={() => { ultimoCampo.current = 'mensaje'; }}
                                maxLength={largo.mensaje}
                                rows={3}
                                placeholder="Lo que la persona lee en la pantalla bloqueada"
                                aria-invalid={!!errMensaje}
                                className="w-full resize-none px-4 py-3 text-[15px] font-medium leading-[1.5]"
                                style={rojo(errMensaje)}
                            />
                            {errMensaje && <ErrorDeCampo>{errMensaje}</ErrorDeCampo>}
                        </label>

                        {!prog && alerta && alerta.variables.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <span className="text-[13px] font-bold text-black/[.62]">
                                    Variables <span className="font-semibold text-black/45">· se suman donde está el cursor</span>
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {alerta.variables.map(x => (
                                        <button
                                            key={x}
                                            type="button"
                                            // Que el cursor no se vaya del campo al tocarla.
                                            onMouseDown={e => e.preventDefault()}
                                            onClick={() => insertar(x)}
                                            title={`Ejemplo: ${EJEMPLOS[x] ?? ''}`}
                                            className="min-h-[36px] rounded-full bg-[#f2f2f0] px-3 font-mono text-[12.5px] font-semibold text-[#0a0a0a] hover:bg-[#eaeae7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                        >
                                            {`{${x}}`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {prog && (
                            <div className="flex flex-col gap-2">
                                <span id="notif-destino" className="text-[13px] font-bold text-black/[.62]">Al tocarla, abre…</span>
                                <div role="radiogroup" aria-labelledby="notif-destino" className="flex w-full gap-0.5 rounded-full bg-black/[.06] p-1 md:w-auto md:self-start">
                                    {([['pantalla', 'Una pantalla de la app'], ['direccion', 'Una dirección']] as const).map(([k, t]) => (
                                        <button
                                            key={k}
                                            type="button"
                                            role="radio"
                                            aria-checked={modoDestino === k}
                                            onClick={() => elegirModoDestino(k)}
                                            className={`h-10 flex-1 rounded-full px-3.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] md:flex-none ${modoDestino === k ? 'bg-white text-[#0a0a0a] shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-black/[.6] hover:text-[#0a0a0a]'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                                {modoDestino === 'pantalla' ? (
                                    <select
                                        value={v.url}
                                        onChange={e => cambiar({ url: e.target.value })}
                                        aria-label="Pantalla de la app"
                                        aria-invalid={!!errDestino}
                                        className="h-[50px] w-full px-3.5 text-[15px] font-semibold"
                                        style={rojo(errDestino)}
                                    >
                                        {PANTALLAS.map(p => <option key={p.ruta} value={p.ruta}>{p.nombre}</option>)}
                                    </select>
                                ) : (
                                    <>
                                        <input
                                            value={v.url}
                                            onChange={e => cambiar({ url: e.target.value })}
                                            placeholder="/gcx o https://…"
                                            aria-label="Dirección que abre"
                                            aria-invalid={!!errDestino}
                                            autoCapitalize="off"
                                            autoComplete="off"
                                            spellCheck={false}
                                            inputMode="url"
                                            className="h-[50px] w-full px-4 text-[15px] font-semibold"
                                            style={rojo(errDestino)}
                                        />
                                        <span className="text-[12.5px] font-medium leading-[1.5] text-black/[.58]">
                                            {esUrlExterna(v.url)
                                                ? 'Es una página de afuera: se abre en el navegador, fuera de la app.'
                                                : 'Una sección de la app empieza con / (por ejemplo, /gcx o /eventos). Una página de afuera, con https://.'}
                                        </span>
                                    </>
                                )}
                                {errDestino && <ErrorDeCampo>{errDestino}</ErrorDeCampo>}
                            </div>
                        )}

                        <VistaPrevia titulo={v.titulo} mensaje={v.mensaje} />
                    </div>

                    {/* 4 · A quién le llega (programada) */}
                    {prog && (
                        <SelectorDeAudiencia
                            todos={v.todos}
                            roles={v.roles}
                            personas={v.personas}
                            onCambiar={p => cambiar(p)}
                            onEstimacion={setEstimacion}
                            error={errAudiencia}
                        />
                    )}

                    {/* Horarios (programada) */}
                    {prog && (
                        <div className="flex flex-col gap-3">
                            <RotuloPaso id="notif-paso-horas">5 · A qué hora sale</RotuloPaso>
                            <ul aria-labelledby="notif-paso-horas" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                                {v.horas.map(h => (
                                    <li key={h} className="flex h-10 items-center gap-1 rounded-full bg-[#0a0a0a] pl-3.5 pr-1 text-[14px] font-bold text-white">
                                        {h}
                                        <button
                                            type="button"
                                            onClick={() => { setErrorHora(null); cambiar({ horas: v.horas.filter(x => x !== h) }); }}
                                            aria-label={`Sacar el horario de las ${h}`}
                                            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                        >
                                            <X size={14} strokeWidth={2.4} aria-hidden="true" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {v.horas.length < 5 && (
                                <div className="flex flex-wrap items-center gap-2">
                                    <input
                                        type="time"
                                        value={horaNueva}
                                        onChange={e => { setHoraNueva(e.target.value); setErrorHora(null); }}
                                        aria-label="Hora para sumar"
                                        className="h-[46px] w-[130px] px-3 text-[15px] font-semibold"
                                    />
                                    <button
                                        type="button"
                                        onClick={sumarHora}
                                        className="flex h-[46px] items-center gap-1.5 rounded-full bg-[#f2f2f0] px-4 text-[14px] font-bold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                    >
                                        <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
                                        {horaNueva ? `Sumar las ${horaNueva}` : 'Sumar un horario'}
                                    </button>
                                </div>
                            )}
                            <span className="text-[12.5px] font-medium text-black/[.58]">De 1 a 5 por día, en hora argentina. Se ordenan solos.</span>
                            {errHoras && <ErrorDeCampo>{errHoras}</ErrorDeCampo>}
                            {v.horas.length >= 3 && v.todos && (
                                <span className="rounded-[14px] bg-[#fff6e5] px-3.5 py-2.5 text-[12.5px] font-semibold leading-[1.5] text-[#7a4b00]">
                                    Muchas notificaciones hacen que la gente las desactive. Para toda la iglesia, con 1 o 2 por día alcanza.
                                </span>
                            )}
                            {!eVigencia && !eFrecuencia && v.horas.length > 0 && (
                                <p className="m-0 rounded-[14px] bg-[#f6f6f4] px-3.5 py-2.5 text-[13px] font-semibold text-black/[.7]">{resumen(v)}</p>
                            )}
                        </div>
                    )}

                    {/* No molestar */}
                    <div className="flex flex-col gap-3">
                        <RotuloPaso>{prog ? '6' : '3'} · No molestar</RotuloPaso>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={v.nm}
                            onClick={() => cambiar({ nm: !v.nm })}
                            className="flex min-h-[52px] w-full items-center gap-3 rounded-[18px] bg-[#f6f6f4] px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            <span className="flex-1 text-[14.5px] font-bold">Horario de no molestar</span>
                            <Perilla on={v.nm} />
                        </button>
                        {v.nm && (
                            <>
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <span className="text-[14px] font-bold">Desde</span>
                                    <input type="time" value={v.nmDesde} onChange={e => cambiar({ nmDesde: e.target.value })} aria-label="No molestar desde" aria-invalid={!!errNm} className="h-[46px] w-[120px] px-3 text-[15px] font-semibold" style={rojo(errNm)} />
                                    <span className="text-[14px] font-bold">hasta</span>
                                    <input type="time" value={v.nmHasta} onChange={e => cambiar({ nmHasta: e.target.value })} aria-label="No molestar hasta" aria-invalid={!!errNm} className="h-[46px] w-[120px] px-3 text-[15px] font-semibold" style={rojo(errNm)} />
                                </div>
                                <span className="text-[12.5px] font-medium text-black/[.58]">Lo que caiga en ese horario no se pierde: se manda apenas termina.</span>
                            </>
                        )}
                        {errNm && <ErrorDeCampo>{errNm}</ErrorDeCampo>}
                    </div>

                    {/* Máximo por día */}
                    <div className="flex flex-col gap-2.5">
                        <RotuloPaso>{prog ? '7' : '4'} · Máximo por día</RotuloPaso>
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 items-center rounded-full bg-[#f6f6f4] p-1">
                                <button
                                    type="button"
                                    onClick={() => cambiar({ max: v.max === null ? null : v.max <= 1 ? null : v.max - 1 })}
                                    disabled={v.max === null}
                                    aria-label="Menos"
                                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0a0a0a] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                >
                                    <Minus size={16} strokeWidth={2.4} aria-hidden="true" />
                                </button>
                                <span aria-live="polite" className="min-w-[88px] text-center text-[14.5px] font-bold">{v.max === null ? 'Sin tope' : v.max}</span>
                                <button
                                    type="button"
                                    onClick={() => cambiar({ max: v.max === null ? 1 : Math.min(20, v.max + 1) })}
                                    disabled={v.max === 20}
                                    aria-label="Más"
                                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0a0a0a] disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                >
                                    <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                                </button>
                            </div>
                            <span className="text-[13px] font-semibold text-black/[.62]">{v.max === null ? 'sin límite por persona' : 'por persona, por día'}</span>
                        </div>
                        <span className="text-[12.5px] font-medium text-black/[.58]">
                            {prog ? 'Si en un mismo día le tocan más, las demás quedan en la app sin sonar.' : 'Si el evento pasa más veces, las demás no suenan ese día (el aviso queda en la app).'}
                        </span>
                        {errMax && <ErrorDeCampo>{errMax}</ErrorDeCampo>}
                    </div>

                    {interruptorEstado}
                </div>

                <div className="flex-none border-t border-black/[.06] px-[22px] pb-[calc(18px+env(safe-area-inset-bottom))] pt-3 md:pb-5">
                    {errorBase?.campo === 'general' && (
                        <p role="alert" className="m-0 mb-2.5 text-[13px] font-bold text-[#b42318]">{errorBase.texto}</p>
                    )}
                    {tocado && invalido && !errorBase && (
                        <p role="alert" className="m-0 mb-2.5 text-[13px] font-bold text-[#b42318]">
                            {pasaTope ? 'La audiencia pasa del máximo por envío.' : 'Revisá los campos marcados en rojo.'}
                        </p>
                    )}
                    <p role="status" className={`m-0 mb-2.5 text-[12.5px] font-semibold leading-[1.45] empty:hidden ${prueba?.estado === 'listo' && !prueba.ok ? 'text-[#b42318]' : 'text-black/[.62]'}`}>
                        {prueba?.estado === 'listo' ? prueba.texto : ''}
                    </p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={mandarPrueba}
                            disabled={guardando || prueba?.estado === 'mandando'}
                            className="flex h-[50px] flex-[1_1_100%] items-center justify-center gap-2 rounded-full border-[1.5px] border-[#0a0a0a] bg-white px-4 text-[14.5px] font-bold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 disabled:opacity-40 md:flex-[0_0_auto]"
                        >
                            {prueba?.estado === 'mandando' ? <Cargando /> : <Send size={16} strokeWidth={2.1} aria-hidden="true" />}
                            Enviarme una prueba
                        </button>
                        <span className="hidden flex-1 md:block" />
                        <button
                            type="button"
                            onClick={intentarCerrar}
                            disabled={guardando}
                            className="h-[50px] flex-1 rounded-full bg-[#f2f2f0] px-5 text-[14.5px] font-bold text-black/[.66] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 disabled:opacity-40 md:flex-none"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={guardar}
                            className={`flex h-[50px] flex-[1.4] items-center justify-center gap-2 rounded-full bg-[#0a0a0a] px-6 text-[14.5px] font-bold text-white transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 md:flex-none ${invalido ? 'opacity-[.32]' : ''}`}
                        >
                            {guardando && <Cargando />}
                            {guardando ? 'Guardando…' : !alerta ? 'Crear notificación' : 'Guardar cambios'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default EditorAlerta;

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { motion, useDragControls, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import type { EstadoTarea, PanelDepartamento } from '../../../services/agenda';
import { ESTADOS } from '../../../src/contenido/agendaPaleta';
import { useBloqueoDeFondo } from '../../../hooks/useBloqueoDeFondo';
import type { PedidoConfirmacion } from '../../admin/piezasAdmin';
import { Cargando, tinte } from '../../admin/departamentos/piezas';

/**
 * Piezas del panel de un departamento (/departamentos/:id) y de su inicio
 * (design-claude/Departamento - Equipo.dc.html y Departamentos - Inicio).
 *
 * Lo visual de las hojas (sube desde abajo en el teléfono, modal centrado
 * desde 768 px) es el mismo que FormularioDepartamento del panel de Sistemas.
 */

// ── Estilos ──────────────────────────────────────────────────────────────

/** El contenedor de todo: los estilos de abajo se cuelgan de este id. */
export const ID_AGENDA = 'agenda-depto';

/*
 * index.html les pone a TODOS los campos fondo blanco, borde gris y foco azul
 * con !important —(0,8,1) por la cadena de :not()—. Con un id adelante estas
 * reglas quedan en (1,0,1) y ganan. El borde sale de una variable, para que
 * un campo con error la pueda redefinir inline y le gane también al foco.
 * Los buscadores van adentro de una pastilla (.dep-pastilla, la misma clase
 * que usa el selector de personas de Sistemas): ahí el campo es transparente
 * y el foco se ve en la pastilla entera.
 */
export const ESTILOS = `
#${ID_AGENDA} { font-family: Manrope, system-ui, sans-serif; color: #0a0a0a; }
#${ID_AGENDA} input, #${ID_AGENDA} textarea, #${ID_AGENDA} select {
  background: var(--ag-fondo, #f6f6f4) !important; color: #0a0a0a !important;
  border: 1.5px solid var(--ag-borde, transparent) !important; border-radius: 16px !important;
  box-shadow: none !important; outline: none !important;
}
#${ID_AGENDA} input:focus, #${ID_AGENDA} textarea:focus, #${ID_AGENDA} select:focus { --ag-fondo: #fff; --ag-borde: #0a0a0a; }
/* El día y la hora en el iPhone: Safari les da un ancho mínimo propio y
   centra el texto, así que se salían de la hoja. Sin apariencia nativa
   respetan el ancho y se alinean a la izquierda; tocarlos sigue abriendo el
   selector del sistema. */
#${ID_AGENDA} input[type="date"], #${ID_AGENDA} input[type="time"] {
  -webkit-appearance: none; appearance: none; display: block; min-width: 0; max-width: 100%; text-align: left;
}
/* Y el valor, al MEDIO. En el Safari del iPhone ::-webkit-date-and-time-value
   es un bloque que se apoya arriba del área de contenido, así que en un campo
   de 50px con una línea de 15px el día y las horas quedan una decena de
   píxeles altos —el resto de los campos, no—. Chrome y el WebKit de
   Playwright lo centran solos, o sea que esto no se ve en ninguna prueba: se
   ve en el teléfono.
   Van las dos formas porque no son excluyentes y no sé cuál respeta cada
   versión de iOS: si el flex aplica, centra sin importar el alto; si no, la
   altura de línea deja la única línea que hay en el medio. Los 47px son los
   50 del campo (CAMPO_CLASE, en components/agenda/FormularioTarea.tsx) menos
   1,5 de borde arriba y abajo: si cambia esa altura, cambia este número. */
#${ID_AGENDA} input[type="date"]::-webkit-date-and-time-value,
#${ID_AGENDA} input[type="time"]::-webkit-date-and-time-value {
  text-align: left; margin: 0;
  display: flex; align-items: center; height: 100%; line-height: 47px;
}
#${ID_AGENDA} select { appearance: none; -webkit-appearance: none; }
#${ID_AGENDA} ::placeholder { color: rgba(0,0,0,.45) !important; }
#${ID_AGENDA} .dep-pastilla input {
  background: transparent !important; border: 0 !important; border-radius: 0 !important; padding: 0 !important;
}
#${ID_AGENDA} .dep-pastilla:focus-within { outline: 2px solid #0a0a0a; outline-offset: 2px; }
#${ID_AGENDA} .ag-fila-pestanas { scrollbar-width: none; }
#${ID_AGENDA} .ag-fila-pestanas::-webkit-scrollbar { display: none; }
@keyframes depFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes depSube { from { transform: translateY(100%) } to { transform: none } }
@keyframes depAparece { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes depBrillo { 0% { opacity: .55 } 50% { opacity: 1 } 100% { opacity: .55 } }
@keyframes depCheck { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.15); opacity: 1 } 100% { transform: scale(1) } }
@keyframes depSale { to { opacity: 0; transform: translateY(14px) scale(.97) } }
@keyframes depLlega { 0% { opacity: 0; transform: translateY(-8px); box-shadow: 0 0 0 3px rgba(21,128,61,.5) } 100% { opacity: 1; transform: none; box-shadow: 0 0 0 0 rgba(21,128,61,0) } }
`;

// ── Clases de botones (las del diseño) ───────────────────────────────────

const foco = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2';
export const BOTON_NEGRO = `flex h-12 items-center justify-center gap-2 rounded-full bg-[#0a0a0a] px-5 text-[14.5px] font-bold text-white transition-opacity disabled:opacity-40 ${foco}`;
export const BOTON_GRIS = `flex h-12 items-center justify-center gap-2 rounded-full bg-[#f2f2f0] px-5 text-[14.5px] font-bold text-black/[.66] transition-colors hover:text-[#0a0a0a] disabled:opacity-40 ${foco}`;
export const BOTON_CHICO = `flex h-11 flex-none items-center justify-center gap-1.5 rounded-full bg-[#f2f2f0] px-4 text-[13px] font-bold text-black/[.66] transition-colors hover:text-[#0a0a0a] disabled:opacity-40 ${foco}`;
export const BOTON_ICONO = `flex h-11 w-11 flex-none items-center justify-center rounded-full text-black/[.62] transition-colors hover:bg-[#f2f2f0] hover:text-[#0a0a0a] disabled:opacity-40 ${foco}`;
export const ROTULO = 'm-0 text-[11px] font-bold uppercase tracking-[0.08em] text-black/[.58]';
export const TARJETA = 'rounded-[26px] bg-white shadow-[0_1px_2px_rgba(0,0,0,.04)]';

// ── Contexto del panel ───────────────────────────────────────────────────

export type Pestana = 'tareas' | 'solicitudes' | 'subdepartamentos' | 'personal' | 'config';

export interface ContextoDelPanel {
    depId: string;
    datos: PanelDepartamento;
    /** Vuelve a pedir agenda_departamento (sin volver al esqueleto). */
    recargar: () => Promise<void>;
    avisar: (texto: string, tipo?: 'ok' | 'error') => void;
    confirmar: (pedido: PedidoConfirmacion) => void;
    /** Hay una confirmación encima: Escape es de ella, no de las hojas. */
    confirmacionAbierta: boolean;
    /** Cambia de pestaña (y de detalle) dejando una entrada en el historial. */
    ir: (pestana: Pestana, sub?: string | null) => void;
    miId: string | null;
    soySuperAdmin: boolean;
    /**
     * Cuántas solicitudes nuevas hay de verdad. Lo dice la pestaña de
     * Solicitudes en cuanto las trae, para que la pastilla roja deje de
     * mostrar lo que recordaba agenda_mi_acceso.
     */
    avisarSolicitudesNuevas: (cuantas: number) => void;
}

const Contexto = createContext<ContextoDelPanel | null>(null);
export const ProveedorDelPanel = Contexto.Provider;
export const usePanel = (): ContextoDelPanel => {
    const c = useContext(Contexto);
    if (!c) throw new Error('usePanel fuera del panel de un departamento');
    return c;
};

// ── La hoja ──────────────────────────────────────────────────────────────

/** Arrastrar la hoja más que esto la cierra. */
const CIERRA_EN = 90;

/**
 * Sube desde abajo en el teléfono; desde 768 px es un modal centrado.
 * Escape y el velo cierran, salvo que esté guardando o que haya una
 * confirmación encima.
 *
 * En el teléfono también se cierra DESLIZÁNDOLA hacia abajo, que es como se
 * cierra todo lo que sube desde abajo en un teléfono. El arrastre arranca
 * sólo desde la manija y el encabezado: desde el cuerpo competiría con el
 * scroll interno y con los campos. Al soltar sin pasar el umbral, la hoja
 * vuelve a su lugar.
 *
 * Deslizar es el MISMO camino que la X y que Escape: llama a `onCerrar`. Si
 * el formulario tiene cambios sin guardar, eso abre "¿Descartar los
 * cambios?" y la hoja queda donde estaba, porque las restricciones la
 * devuelven a cero.
 *
 * Con dos hojas apiladas se arrastra sólo la de arriba: cada una tiene sus
 * propios controles y el velo de la de arriba tapa a la de abajo.
 *
 * Desde 768 px no hay arrastre: es un modal, y los modales no se deslizan.
 */
export const Hoja: React.FC<{
    titulo: string;
    subtitulo?: string;
    /** Lo que va a la izquierda del título (un punto de color, una cara). */
    adelante?: React.ReactNode;
    onCerrar: () => void;
    /** Mientras guarda no se cierra. */
    ocupada?: boolean;
    pie?: React.ReactNode;
    ancho?: number;
    /**
     * Encima de otra hoja (la carpeta nueva sobre el formulario de la tarea).
     * Queda abajo de la confirmación, que siempre es la última palabra.
     */
    encima?: boolean;
    children: React.ReactNode;
}> = ({ titulo, subtitulo, adelante, onCerrar, ocupada = false, pie, ancho = 560, encima = false, children }) => {
    useBloqueoDeFondo(true);
    const panel = useRef<HTMLDivElement>(null);
    const { confirmacionAbierta } = usePanelOpcional() ?? { confirmacionAbierta: false };
    const cerrar = () => { if (!ocupada) onCerrar(); };

    // Se mide en el PRIMER render y no en un efecto: arrancando en false, en
    // un teléfono la hoja montaría con la entrada de escritorio y la
    // animación quedaría varada a mitad de camino.
    const [esMovil, setEsMovil] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 768,
    );
    const sinMovimiento = useReducedMotion();
    const arrastre = useDragControls();

    useEffect(() => {
        const medir = () => setEsMovil(window.innerWidth < 768);
        medir();
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    useEffect(() => { panel.current?.focus(); }, []);
    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape' && !confirmacionAbierta) cerrar(); };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    });

    const idTitulo = useRef(`hoja-${Math.random().toString(36).slice(2, 8)}`).current;
    const transicion = sinMovimiento
        ? { duration: 0 }
        : { type: 'spring' as const, damping: 34, stiffness: 340 };
    /** La manija y el encabezado arrancan el arrastre; el cuerpo, no. */
    const agarrar = esMovil ? (e: React.PointerEvent) => arrastre.start(e) : undefined;

    return (
        <div className={`fixed inset-0 flex items-end justify-center md:items-center md:p-10 ${encima ? 'z-[115]' : 'z-[110]'}`}>
            <div className="absolute inset-0 bg-[rgba(10,10,10,.36)] motion-safe:animate-[depFade_.18s_ease_both]" onClick={cerrar} />
            <motion.div
                ref={panel}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby={idTitulo}
                className="relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,.18)] outline-none md:max-h-[calc(100dvh-64px)] md:max-w-[var(--ancho)] md:rounded-[28px] md:shadow-[0_24px_60px_rgba(0,0,0,.22)]"
                style={{ '--ancho': `${ancho}px` } as React.CSSProperties}
                initial={esMovil ? { y: '100%' } : { opacity: 0, y: 10, scale: 0.98 }}
                animate={esMovil ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
                transition={transicion}
                drag={esMovil ? 'y' : false}
                dragListener={false}
                dragControls={arrastre}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, info) => { if (info.offset.y > CIERRA_EN) cerrar(); }}
                data-hoja="true"
            >
                <div
                    onPointerDown={agarrar}
                    className="flex-none pb-1 pt-2.5 md:hidden"
                    style={esMovil ? { touchAction: 'none', cursor: 'grab' } : undefined}
                    data-manija="true"
                >
                    <span aria-hidden="true" className="mx-auto block h-[5px] w-11 rounded-full bg-black/[.16]" />
                </div>
                <div
                    onPointerDown={agarrar}
                    className="flex flex-none items-center gap-3 px-[22px] pb-2 pt-[18px]"
                    style={esMovil ? { touchAction: 'none' } : undefined}
                >
                    {adelante}
                    <div className="min-w-0 flex-1">
                        <h2 id={idTitulo} className="m-0 text-[19px] font-bold leading-tight text-[#0a0a0a]">{titulo}</h2>
                        {subtitulo && <p className="m-0 mt-1 text-[13.5px] font-medium leading-[1.45] text-black/[.62]">{subtitulo}</p>}
                    </div>
                </div>
                <div
                    className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-[22px] pb-4 pt-2.5"
                    data-cuerpo="true"
                >
                    {children}
                </div>
                {pie && (
                    <div className="flex flex-none flex-col gap-2 border-t border-black/[.06] px-[22px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-3.5 md:pb-6">
                        {pie}
                    </div>
                )}
            </motion.div>
        </div>
    );
};

/** El contexto, si está: la hoja también se usa fuera del panel (el inicio no la usa, pero no rompe). */
const usePanelOpcional = () => useContext(Contexto);

/**
 * Los dos botones del pie de una hoja: Cancelar y la acción.
 *
 * El botón de la acción se ve apagado cuando falta algo, pero RESPONDE: al
 * tocarlo marca los campos que faltan. Por eso NO lleva `aria-disabled`
 * (instrucciones 7.15): un botón que responde no se anuncia deshabilitado,
 * porque quien lo escucha dejaría de intentarlo y nunca sabría qué falta.
 * Lo que falta se dice en palabras, en una región viva que el botón
 * referencia con aria-describedby.
 */
export const PieDeHoja: React.FC<{
    onCancelar: () => void;
    onAceptar: () => void;
    etiqueta: string;
    guardando?: boolean;
    /** Se ve apagado pero responde (marca lo que falta): instrucciones 7.15. */
    apagado?: boolean;
    /** Qué falta, en palabras. Se anuncia y se lee arriba de los botones. */
    falta?: string | null;
    peligro?: boolean;
}> = ({ onCancelar, onAceptar, etiqueta, guardando = false, apagado = false, falta, peligro = false }) => {
    const idFalta = useRef(`pie-${Math.random().toString(36).slice(2, 8)}`).current;
    const aviso = apagado && !guardando ? (falta || '') : '';
    return (
        <>
            {/* Siempre montada, aunque esté vacía: una región viva que nace
                junto con su texto no siempre se anuncia. Vacía no ocupa. */}
            <p id={idFalta} role="status" className="m-0 text-[12.5px] font-semibold leading-[1.45] text-black/[.62] empty:hidden">
                {aviso}
            </p>
            <div className="flex gap-2">
                <button type="button" onClick={onCancelar} disabled={guardando} className={`${BOTON_GRIS} flex-1`}>Cancelar</button>
                <button
                    type="button"
                    onClick={onAceptar}
                    aria-describedby={aviso ? idFalta : undefined}
                    className={`${BOTON_NEGRO} flex-[1.4] ${apagado ? 'opacity-[.32]' : ''} ${peligro ? 'bg-[#b42318]' : ''}`}
                >
                    {guardando && <Cargando />}
                    {guardando ? 'Guardando…' : etiqueta}
                </button>
            </div>
        </>
    );
};

// ── Elegir uno de una lista (sub-departamentos, prioridades) ─────────────

export interface Opcion { id: string; nombre: string; color: string; meta?: string }

export const HojaElegir: React.FC<{
    titulo: string;
    subtitulo?: string;
    opciones: Opcion[];
    etiqueta: string;
    /** Devuelve true si salió bien (cierra) o false (queda abierta para reintentar). */
    onElegir: (id: string) => Promise<boolean> | boolean;
    onCerrar: () => void;
    vacio?: string;
}> = ({ titulo, subtitulo, opciones, etiqueta, onElegir, onCerrar, vacio }) => {
    const [elegida, setElegida] = useState<string | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [falta, setFalta] = useState(false);
    const aceptar = async () => {
        if (guardando) return;
        if (!elegida) { setFalta(true); return; }
        setGuardando(true);
        const ok = await onElegir(elegida);
        setGuardando(false);
        if (ok) onCerrar();
    };
    return (
        <Hoja
            titulo={titulo}
            subtitulo={subtitulo}
            onCerrar={onCerrar}
            ocupada={guardando}
            ancho={480}
            pie={(
                <PieDeHoja
                    onCancelar={onCerrar} onAceptar={aceptar} etiqueta={etiqueta}
                    guardando={guardando} apagado={!elegida} falta="Elegí una opción de la lista."
                />
            )}
        >
            {opciones.length === 0 ? (
                <p className="m-0 text-[14px] font-semibold text-black/[.62]">{vacio || 'No hay opciones.'}</p>
            ) : (
                <div role="radiogroup" aria-label={titulo} className="flex flex-col gap-1.5">
                    {opciones.map(o => {
                        const on = elegida === o.id;
                        return (
                            <button
                                key={o.id}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                onClick={() => { setElegida(o.id); setFalta(false); }}
                                className={`flex min-h-[52px] items-center gap-3 rounded-2xl px-4 text-left text-[14.5px] font-bold transition-colors ${on ? 'bg-[#0a0a0a] text-white' : 'bg-[#f6f6f4] text-[#0a0a0a] hover:bg-[#efefec]'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2`}
                            >
                                <span className="h-3 w-3 flex-none rounded-full" style={{ background: o.color, boxShadow: on ? '0 0 0 2px #fff' : undefined }} aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate">{o.nombre}</span>
                                {o.meta && <span className={`flex-none text-[12.5px] font-semibold ${on ? 'text-white/70' : 'text-black/[.55]'}`}>{o.meta}</span>}
                                {on && <Check size={17} strokeWidth={2.6} className="flex-none" aria-hidden="true" />}
                            </button>
                        );
                    })}
                </div>
            )}
            {falta && <p role="alert" className="m-0 text-[12.5px] font-bold text-[#b42318]">Elegí una opción.</p>}
        </Hoja>
    );
};

// ── Estados y fechas ─────────────────────────────────────────────────────

/**
 * La pastilla del estado de una tarea, con los colores de agendaPaleta.
 *
 * `grande` es la del detalle; `conCheck` cambia el punto por un tilde que
 * entra con una animación corta, para marcar lo que se acaba de completar
 * (con "reducir movimiento" aparece sin animarse).
 */
export const ChipEstado: React.FC<{ estado: EstadoTarea; grande?: boolean; conCheck?: boolean }> = ({
    estado, grande = false, conCheck = false,
}) => {
    const e = ESTADOS[estado];
    return (
        <span
            className={`inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full font-bold ${grande ? 'h-[30px] pl-2.5 pr-3 text-[12.5px]' : 'h-6 pl-2 pr-2.5 text-[11.5px]'}`}
            style={{ background: e.fondo, color: e.tinta }}
        >
            {conCheck
                ? <Check size={13} strokeWidth={3} aria-hidden="true" className="motion-safe:animate-[depCheck_.45s_ease_both]" />
                : <span className="h-[7px] w-[7px] rounded-full" style={{ background: e.punto }} aria-hidden="true" />}
            {e.etiqueta}
        </span>
    );
};

/** Un punto de color (sub-departamento, carpeta, prioridad). */
export const Punto: React.FC<{ color: string; tam?: number }> = ({ color, tam = 10 }) => (
    <span className="flex-none rounded-full" style={{ width: tam, height: tam, background: color }} aria-hidden="true" />
);

/** La pastilla de una prioridad: su color al 14% con un punto. */
export const ChipColor: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
    <span className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold text-black/[.8]" style={{ background: tinte(color, '24') }}>
        <Punto color={color} tam={8} />
        <span className="truncate">{children}</span>
    </span>
);

/**
 * '2026-10-26' → 'Lun 26 oct'. Vive en services/agenda.ts con el resto de
 * los formatos de fecha del módulo; se re-exporta para no cambiar los
 * imports de las pantallas que ya lo usaban.
 */
export { fechaCorta } from '../../../services/agenda';

// ── Los divisores plegables y lo que se recuerda de ellos ───────────────

/**
 * Las claves de los divisores de un departamento: los tres estados de una
 * tarea y los dos grupos de solicitudes. Van todas en el MISMO recuerdo, uno
 * por departamento, porque son la misma decisión de la misma persona sobre
 * la misma pantalla.
 */
export type ClaveDeDivisor = EstadoTarea | 'nuevas' | 'aceptadas';
export type Plegadas = Partial<Record<ClaveDeDivisor, boolean>>;

/** Lo que arranca plegado si nunca se tocó nada: el historial. */
const PLEGADAS_POR_DEFECTO: Plegadas = { completada: true };

const claveDePlegadas = (depId: string) => `origen_agenda_plegadas_${depId}`;

export const leerPlegadas = (depId: string): Plegadas => {
    try {
        const guardado = window.localStorage.getItem(claveDePlegadas(depId));
        if (!guardado) return PLEGADAS_POR_DEFECTO;
        const leido = JSON.parse(guardado) as Plegadas;
        return leido && typeof leido === 'object' ? leido : PLEGADAS_POR_DEFECTO;
    } catch {
        // Modo privado, almacenamiento bloqueado: se abre todo y funciona igual.
        return PLEGADAS_POR_DEFECTO;
    }
};

export const guardarPlegadas = (depId: string, valor: Plegadas) => {
    try { window.localStorage.setItem(claveDePlegadas(depId), JSON.stringify(valor)); } catch { /* da igual */ }
};

/**
 * Un divisor que se abre y se cierra con un toque, con su contador.
 *
 * Siempre está, aunque no tenga nada adentro: un divisor que desaparece hace
 * pensar que se perdió algo, y mueve de lugar todo lo de abajo cada vez que
 * cambia el filtro. Un cero con una línea de texto dice lo mismo y no se
 * mueve.
 *
 * `insignia` dibuja el número en una pastilla (las solicitudes, donde lo
 * importante es cuántas hay esperando); sin ella es el número suelto de la
 * lista de tareas. `urgente` la pinta de rojo cuando hay algo para revisar.
 */
export const DivisorPlegable: React.FC<{
    /** Lo que va a la izquierda: una pastilla de estado o un texto. */
    rotulo: React.ReactNode;
    cuantas: number;
    abierto: boolean;
    onAlternar: () => void;
    /** El id del panel que abre y cierra, para aria-controls. */
    id: string;
    insignia?: boolean;
    urgente?: boolean;
    /** Queda en data-estado, para encontrarlo desde las pruebas. */
    marca?: string;
    children: React.ReactNode;
}> = ({ rotulo, cuantas, abierto, onAlternar, id, insignia = false, urgente = false, marca, children }) => (
    <section className="flex flex-col" data-estado={marca}>
        <button
            type="button"
            onClick={onAlternar}
            aria-expanded={abierto}
            aria-controls={id}
            className="flex min-h-[56px] items-center gap-3 rounded-[20px] bg-white pl-3.5 pr-4 text-left shadow-[0_1px_2px_rgba(0,0,0,.04)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
        >
            <ChevronDown
                size={18}
                strokeWidth={2.4}
                aria-hidden="true"
                className="flex-none text-black/[.55] transition-transform"
                style={{ transform: abierto ? undefined : 'rotate(-90deg)' }}
            />
            <span className="flex min-w-0 flex-1 items-center">{rotulo}</span>
            {insignia ? (
                <span
                    className={`flex h-[26px] min-w-[26px] flex-none items-center justify-center rounded-full px-2 text-[12.5px] font-extrabold ${urgente && cuantas > 0 ? 'bg-[#dc2626] text-white' : 'bg-[#f2f2f0] text-black/[.62]'}`}
                >
                    {cuantas}
                </span>
            ) : (
                <span className="flex-none text-[13.5px] font-bold text-black/[.62]">{cuantas}</span>
            )}
        </button>
        {abierto && <div id={id}>{children}</div>}
    </section>
);

/** Un bloque blanco con un mensaje (vacío, error, no existe). */
export const Mensaje: React.FC<{ titulo: string; texto?: string; children?: React.ReactNode; icono?: React.ReactNode }> = ({ titulo, texto, children, icono }) => (
    <div className={`${TARJETA} mt-4 flex flex-col items-center px-6 py-11 text-center`}>
        {icono && <span className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#f2f2f0] text-black/[.62]" aria-hidden="true">{icono}</span>}
        <p className="m-0 text-[18px] font-bold">{titulo}</p>
        {texto && <p className="m-0 mt-2 max-w-[400px] text-[14px] font-medium leading-[1.6] text-black/[.62]">{texto}</p>}
        {children}
    </div>
);

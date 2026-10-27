import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
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
#${ID_AGENDA} input[type="date"]::-webkit-date-and-time-value,
#${ID_AGENDA} input[type="time"]::-webkit-date-and-time-value { text-align: left; margin: 0; }
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
@keyframes depCostado { from { opacity: 0; transform: translateX(24px) } to { opacity: 1; transform: none } }
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

export type Pestana = 'tareas' | 'subdepartamentos' | 'personal' | 'config';

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
}

const Contexto = createContext<ContextoDelPanel | null>(null);
export const ProveedorDelPanel = Contexto.Provider;
export const usePanel = (): ContextoDelPanel => {
    const c = useContext(Contexto);
    if (!c) throw new Error('usePanel fuera del panel de un departamento');
    return c;
};

// ── La hoja ──────────────────────────────────────────────────────────────

/**
 * Sube desde abajo en el teléfono; desde 768 px es un modal centrado.
 * Escape y el velo cierran, salvo que esté guardando o que haya una
 * confirmación encima.
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

    useEffect(() => { panel.current?.focus(); }, []);
    useEffect(() => {
        const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape' && !confirmacionAbierta) cerrar(); };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    });

    const idTitulo = useRef(`hoja-${Math.random().toString(36).slice(2, 8)}`).current;
    return (
        <div className={`fixed inset-0 flex items-end justify-center md:items-center md:p-10 ${encima ? 'z-[115]' : 'z-[110]'}`}>
            <div className="absolute inset-0 bg-[rgba(10,10,10,.36)] motion-safe:animate-[depFade_.18s_ease_both]" onClick={cerrar} />
            <div
                ref={panel}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby={idTitulo}
                className="relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-white shadow-[0_-10px_40px_rgba(0,0,0,.18)] outline-none motion-safe:animate-[depSube_.26s_cubic-bezier(.2,.8,.2,1)_both] md:max-h-[calc(100dvh-64px)] md:max-w-[var(--ancho)] md:rounded-[28px] md:shadow-[0_24px_60px_rgba(0,0,0,.22)] md:motion-safe:animate-[depAparece_.2s_ease_both]"
                style={{ '--ancho': `${ancho}px` } as React.CSSProperties}
            >
                <span aria-hidden="true" className="mx-auto mt-2.5 block h-[5px] w-11 flex-none rounded-full bg-black/[.16] md:hidden" />
                <div className="flex flex-none items-center gap-3 px-[22px] pb-2 pt-[18px]">
                    {adelante}
                    <div className="min-w-0 flex-1">
                        <h2 id={idTitulo} className="m-0 text-[19px] font-bold leading-tight text-[#0a0a0a]">{titulo}</h2>
                        {subtitulo && <p className="m-0 mt-1 text-[13.5px] font-medium leading-[1.45] text-black/[.62]">{subtitulo}</p>}
                    </div>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-[22px] pb-4 pt-2.5">
                    {children}
                </div>
                {pie && (
                    <div className="flex flex-none gap-2 border-t border-black/[.06] px-[22px] pb-[calc(20px+env(safe-area-inset-bottom))] pt-3.5 md:pb-6">
                        {pie}
                    </div>
                )}
            </div>
        </div>
    );
};

/** El contexto, si está: la hoja también se usa fuera del panel (el inicio no la usa, pero no rompe). */
const usePanelOpcional = () => useContext(Contexto);

/** Los dos botones del pie de una hoja: Cancelar y la acción. */
export const PieDeHoja: React.FC<{
    onCancelar: () => void;
    onAceptar: () => void;
    etiqueta: string;
    guardando?: boolean;
    /** Se ve apagado pero responde (marca lo que falta): instrucciones 7.15. */
    apagado?: boolean;
    peligro?: boolean;
}> = ({ onCancelar, onAceptar, etiqueta, guardando = false, apagado = false, peligro = false }) => (
    <>
        <button type="button" onClick={onCancelar} disabled={guardando} className={`${BOTON_GRIS} flex-1`}>Cancelar</button>
        <button
            type="button"
            onClick={onAceptar}
            aria-disabled={apagado || guardando}
            className={`${BOTON_NEGRO} flex-[1.4] ${apagado ? 'opacity-[.32]' : ''} ${peligro ? 'bg-[#b42318]' : ''}`}
        >
            {guardando && <Cargando />}
            {guardando ? 'Guardando…' : etiqueta}
        </button>
    </>
);

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
            pie={<PieDeHoja onCancelar={onCerrar} onAceptar={aceptar} etiqueta={etiqueta} guardando={guardando} apagado={!elegida} />}
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

/** Un bloque blanco con un mensaje (vacío, error, no existe). */
export const Mensaje: React.FC<{ titulo: string; texto?: string; children?: React.ReactNode; icono?: React.ReactNode }> = ({ titulo, texto, children, icono }) => (
    <div className={`${TARJETA} mt-4 flex flex-col items-center px-6 py-11 text-center`}>
        {icono && <span className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#f2f2f0] text-black/[.62]" aria-hidden="true">{icono}</span>}
        <p className="m-0 text-[18px] font-bold">{titulo}</p>
        {texto && <p className="m-0 mt-2 max-w-[400px] text-[14px] font-medium leading-[1.6] text-black/[.62]">{texto}</p>}
        {children}
    </div>
);

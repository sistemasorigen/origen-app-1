import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';
import { filtrarGrupos } from './barraAccesosLogica';
import type { GrupoDeFunciones, MenuItem } from './menuFunciones';

/**
 * "Elegí tu acceso rápido": la hoja del botón personalizado. Hoja desde abajo
 * en el teléfono y modal desde 768 px (design-claude/Barra de accesos rapidos.dc.html).
 *
 * Va por un portal porque también la abre Mi cuenta, y adentro de <main> un
 * z-index no le gana a nada de afuera.
 */

const MEDIDA_MODAL = '(min-width: 768px)';

const X: React.FC<{ tam: number }> = ({ tam }) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
    </svg>
);

const Lupa: React.FC<{ tam: number; d: string }> = ({ tam, d }) => (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none', color: 'var(--qb-m55)' }}>
        <circle cx="11" cy="11" r="7" />
        <path d={d} />
    </svg>
);

export const HojaAccesoRapido: React.FC<{
    grupos: GrupoDeFunciones[];
    elegido: MenuItem | null;
    /** Con algo elegido, abierta para cambiarlo: ofrece quitarlo. */
    editar: boolean;
    sinMovimiento: boolean;
    onElegir: (funcion: MenuItem) => void;
    onQuitar: () => void;
    onCerrar: () => void;
}> = ({ grupos, elegido, editar, sinMovimiento, onElegir, onQuitar, onCerrar }) => {
    useBloqueoDeFondo(true);

    const [busqueda, setBusqueda] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [modal, setModal] = useState(() => window.matchMedia(MEDIDA_MODAL).matches);
    const hoja = useRef<HTMLDivElement>(null);
    const arrastre = useRef<{ desde: number; delta: number } | null>(null);

    useEffect(() => {
        const medida = window.matchMedia(MEDIDA_MODAL);
        const alCambiar = () => setModal(medida.matches);
        medida.addEventListener('change', alCambiar);
        return () => medida.removeEventListener('change', alCambiar);
    }, []);

    // El foco entra a la hoja, no al buscador: eso abriría el teclado encima
    // de la lista. Y vuelve de donde vino al cerrar.
    useEffect(() => {
        const antes = document.activeElement as HTMLElement | null;
        hoja.current?.focus({ preventScroll: true });
        return () => antes?.focus?.({ preventScroll: true });
    }, []);

    const alTeclear = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); return; }
        if (e.key !== 'Tab' || !hoja.current) return;
        const enfocables = hoja.current.querySelectorAll<HTMLElement>('button, input');
        if (!enfocables.length) return;
        const primero = enfocables[0];
        const ultimo = enfocables[enfocables.length - 1];
        if (e.shiftKey && (document.activeElement === primero || document.activeElement === hoja.current)) {
            e.preventDefault();
            ultimo.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
            e.preventDefault();
            primero.focus();
        }
    };

    const empezarArrastre = (e: React.PointerEvent<HTMLDivElement>) => {
        if (modal || (e.target as HTMLElement).closest('input,button')) return;
        arrastre.current = { desde: e.clientY, delta: 0 };
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ya no está ese dedo */ }
        if (hoja.current) hoja.current.style.transition = 'none';
    };
    const moverArrastre = (e: React.PointerEvent) => {
        if (!arrastre.current) return;
        const delta = Math.max(0, e.clientY - arrastre.current.desde);
        arrastre.current.delta = delta;
        if (hoja.current) hoja.current.style.transform = `translateY(${delta}px)`;
    };
    const soltarArrastre = () => {
        if (!arrastre.current) return;
        const { delta } = arrastre.current;
        arrastre.current = null;
        if (hoja.current) {
            hoja.current.style.transition = 'transform .2s ease';
            hoja.current.style.transform = '';
        }
        if (delta > 90) onCerrar();
    };

    const visibles = filtrarGrupos(grupos, busqueda);
    const relleno = 16;

    return createPortal(
        <div
            id="hoja-acceso"
            onClick={onCerrar}
            style={{
                position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.42)',
                display: 'flex', justifyContent: 'center',
                alignItems: modal ? 'center' : 'flex-end', padding: modal ? 32 : 0,
                animation: sinMovimiento ? 'none' : 'qbFade .2s ease both',
                fontFamily: 'Manrope, system-ui, sans-serif',
            }}
        >
            <div
                ref={hoja}
                role="dialog"
                aria-modal="true"
                aria-labelledby="qbTitulo"
                tabIndex={-1}
                onClick={e => e.stopPropagation()}
                onKeyDown={alTeclear}
                style={{
                    width: '100%', maxWidth: modal ? 520 : '100%',
                    height: modal ? 'auto' : '86%', maxHeight: modal ? '82%' : '86%',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden', outline: 'none',
                    background: 'var(--qb-panel)', color: 'var(--qb-ink)',
                    borderRadius: modal ? 28 : '28px 28px 0 0',
                    boxShadow: '0 20px 60px rgba(0,0,0,.25)',
                    animation: sinMovimiento ? 'none' : (modal ? 'qbZoom .24s ease both' : 'qbUp .32s cubic-bezier(.2,.8,.2,1) both'),
                }}
            >
                <div
                    onPointerDown={empezarArrastre}
                    onPointerMove={moverArrastre}
                    onPointerUp={soltarArrastre}
                    onPointerCancel={soltarArrastre}
                    style={{ flex: 'none', padding: modal ? '24px 24px 6px' : '10px 20px 6px', touchAction: 'none' }}
                >
                    {!modal && <div aria-hidden="true" style={{ width: 44, height: 5, borderRadius: 999, background: 'var(--qb-manija)', margin: '0 auto 14px', cursor: 'grab' }} />}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h2 id="qbTitulo" style={{ margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 700, letterSpacing: '-.02em' }}>Elegí tu acceso rápido</h2>
                            <p style={{ margin: '6px 0 0', fontSize: 14.5, lineHeight: 1.45, fontWeight: 500, color: 'var(--qb-m62)' }}>Va a aparecer en tu barra, al lado de Perfil.</p>
                        </div>
                        <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ width: 44, height: 44, flex: 'none', border: 0, borderRadius: 999, background: 'var(--qb-tarjeta)', color: 'var(--qb-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <X tam={15} />
                        </button>
                    </div>
                    <div style={{ marginTop: 16, height: 52, borderRadius: 999, background: 'var(--qb-tarjeta)', boxShadow: buscando ? 'inset 0 0 0 2px var(--qb-ink)' : 'inset 0 0 0 1px var(--qb-borde)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px 0 16px' }}>
                        <Lupa tam={18} d="M20 20l-3.5-3.5" />
                        <input
                            type="search"
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            onFocus={() => setBuscando(true)}
                            onBlur={() => setBuscando(false)}
                            aria-label="Buscar una función"
                            placeholder="Buscá una función"
                            autoComplete="off"
                            style={{ flex: 1, minWidth: 0, height: 48, fontSize: 16, fontWeight: 600 }}
                        />
                        {busqueda && (
                            <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda" style={{ width: 40, height: 40, flex: 'none', border: 0, borderRadius: 999, background: 'var(--qb-chip)', color: 'var(--qb-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <X tam={14} />
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: modal ? '0 24px 24px' : `0 20px ${relleno + 8}px` }}>
                    {visibles.map(grupo => (
                        <div key={grupo.titulo}>
                            <p style={{ margin: '14px 0 8px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: 'var(--qb-m38)' }}>{grupo.titulo}</p>
                            <div style={{ background: 'var(--qb-tarjeta)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.04)' }}>
                                {grupo.items.map((funcion, i) => {
                                    const enTuBarra = elegido?.id === funcion.id;
                                    const Icono = funcion.icon;
                                    return (
                                        <button
                                            key={funcion.id}
                                            type="button"
                                            className="qb-fila"
                                            onClick={() => onElegir(funcion)}
                                            aria-pressed={enTuBarra}
                                            style={{ width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 14, padding: '10px 14px', border: 0, borderTop: i ? '1px solid var(--qb-linea)' : 0, background: 'transparent', color: 'var(--qb-ink)', textAlign: 'left', cursor: 'pointer' }}
                                        >
                                            <span style={{ width: 40, height: 40, flex: 'none', borderRadius: 999, background: enTuBarra ? 'var(--qb-prim)' : 'var(--qb-chip)', color: enTuBarra ? 'var(--qb-prim-tinta)' : 'var(--qb-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icono size={19} strokeWidth={1.75} aria-hidden="true" />
                                            </span>
                                            <span style={{ flex: 1, minWidth: 0, fontSize: 15.5, fontWeight: 600 }}>{funcion.label}</span>
                                            {enTuBarra && (
                                                <span style={{ flex: 'none', height: 28, padding: '0 10px 0 8px', borderRadius: 999, background: 'var(--qb-prim)', color: 'var(--qb-prim-tinta)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 700 }}>
                                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                                                    En tu barra
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                    {visibles.length === 0 && (
                        <div style={{ padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <span style={{ width: 64, height: 64, borderRadius: 999, background: 'var(--qb-tarjeta)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Lupa tam={26} d="M20 20l-3.5-3.5M8 11h6" />
                            </span>
                            <p style={{ margin: '16px 0 0', fontSize: 17, fontWeight: 700 }}>No encontramos “{busqueda}”</p>
                            <p style={{ margin: '6px 0 0', maxWidth: 280, fontSize: 14.5, lineHeight: 1.5, fontWeight: 500, color: 'var(--qb-m62)' }}>Probá con otra palabra. Acá están solo las funciones que podés abrir.</p>
                            <button type="button" onClick={() => setBusqueda('')} style={{ marginTop: 18, height: 48, padding: '0 22px', border: 0, borderRadius: 999, background: 'var(--qb-prim)', color: 'var(--qb-prim-tinta)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Limpiar búsqueda</button>
                        </div>
                    )}
                </div>

                {editar && elegido && (
                    <div style={{ flex: 'none', padding: `12px 20px ${relleno}px`, borderTop: '1px solid var(--qb-linea)', background: 'var(--qb-panel)' }}>
                        <button type="button" onClick={onQuitar} className="qb-quitar" style={{ width: '100%', height: 56, border: 0, borderRadius: 999, background: 'var(--qb-tarjeta)', color: 'var(--qb-rojo)', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 0 0 1px var(--qb-borde)' }}>Quitar de la barra</button>
                    </div>
                )}
            </div>
        </div>,
        document.body,
    );
};

export default HojaAccesoRapido;

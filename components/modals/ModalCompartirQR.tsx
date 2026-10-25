import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import HojaGrupos from '../GCX/HojaGrupos';

interface ModalCompartirQRProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    /** URL que se copia, se comparte y va dentro del QR. */
    link: string;
    /** "Jueves · 20:00 hs · Palermo" */
    subtitle?: string;
    /** El rótulo de arriba del título. */
    rotulo?: string;
    /** Qué abre el QR, para la leyenda: "el grupo", "el enlace". */
    queAbre?: string;
}

/**
 * Compartir un grupo — design-claude/GCX - Tarjetas y pagina (panel "Compartir").
 *
 * El QR se dibuja acá con qrcode.react y no con api.qrserver.com: el link del
 * grupo ya no viaja a un servicio de afuera para que le devuelvan la imagen.
 * Es el MISMO link que se copia y se manda por WhatsApp.
 *
 * Panel desde abajo en el teléfono y modal en la compu (HojaGrupos). "Más
 * opciones" es el compartir del sistema: sólo aparece si el navegador lo
 * tiene, y como en el diseño, sólo en el teléfono.
 */
const ModalCompartirQR: React.FC<ModalCompartirQRProps> = ({ isOpen, onClose, title, link, subtitle, rotulo = 'COMPARTIR GRUPO', queAbre = 'el grupo' }) => {
    const [isCopied, setIsCopied] = useState(false);
    const [esMovil, setEsMovil] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
    const hayCompartirDelSistema = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    useEffect(() => {
        const medir = () => setEsMovil(window.innerWidth < 768);
        window.addEventListener('resize', medir);
        return () => window.removeEventListener('resize', medir);
    }, []);

    useEffect(() => { if (!isOpen) setIsCopied(false); }, [isOpen]);

    const markCopied = () => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    const copyLink = () => {
        // Fallback para contextos sin clipboard API (ej. kiosco sobre HTTP).
        const fallback = () => {
            const ta = document.createElement('textarea');
            ta.value = link;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.focus();
            ta.select();
            try { document.execCommand('copy'); markCopied(); } catch { /* noop */ }
            document.body.removeChild(ta);
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(link).then(markCopied).catch(fallback);
        } else {
            fallback();
        }
    };

    const shareWhatsApp = () => {
        const text = `${title}: ${link}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
    };

    const compartirDelSistema = () => {
        navigator.share({ title, url: link }).catch(() => { /* la persona lo cerró */ });
    };

    // A la vista va sin el https://, como en el diseño; se copia entero.
    const linkVisible = link.replace(/^https?:\/\//, '');

    return (
        <HojaGrupos abierta={isOpen} onCerrar={onClose} etiquetadaPor="gcx-compartir-titulo">
            <div className="flex flex-col">
                <p className="m-0 text-[12px] font-semibold tracking-[.07em]" style={{ color: 'var(--g-m38)' }}>{rotulo}</p>
                <h2 id="gcx-compartir-titulo" className="mt-2 mr-14 mb-0 text-[24px] leading-[1.2] font-semibold tracking-[-.025em] [overflow-wrap:anywhere]">
                    {title}
                </h2>
                {subtitle && (
                    <p className="mt-1.5 mb-0 text-[14.5px]" style={{ color: 'var(--g-m50)' }}>{subtitle}</p>
                )}

                {/* El fondo del QR es blanco también en oscuro: un QR
                    invertido no lo lee cualquier cámara. */}
                <div className="mx-auto mt-[22px] p-[18px] rounded-[24px] bg-white" style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)' }}>
                    <QRCodeSVG
                        value={link}
                        size={esMovil ? 200 : 220}
                        level="M"
                        fgColor="#0a0a0a"
                        bgColor="#ffffff"
                        role="img"
                        aria-label={`Código QR del link de ${queAbre.replace(/^el /, '')}`}
                        style={{ display: 'block' }}
                    />
                </div>
                <p className="mt-3 mb-0 text-center text-[13.5px] font-medium" style={{ color: 'var(--g-m50)' }}>
                    Escaneá para abrir {queAbre}
                </p>

                <div className="mt-5 h-[52px] rounded-[18px] flex items-center gap-2.5 pl-4 pr-1.5" style={{ background: 'var(--g-chip)' }}>
                    <span className="flex-1 min-w-0 text-[14px] font-medium whitespace-nowrap overflow-hidden text-ellipsis select-all" style={{ color: 'var(--g-m62)' }}>
                        {linkVisible}
                    </span>
                    <button
                        type="button"
                        onClick={copyLink}
                        className="h-11 px-4 rounded-full border-0 text-[14px] font-semibold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        style={{
                            background: isCopied ? 'var(--g-grnBg)' : 'var(--g-card)',
                            color: isCopied ? 'var(--g-grn)' : 'var(--g-ink)',
                            transition: 'background .2s',
                        }}
                    >
                        {isCopied && (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                        )}
                        <span aria-live="polite">{isCopied ? '¡Copiado!' : 'Copiar link'}</span>
                    </button>
                </div>

                <div className="mt-2.5 flex flex-col gap-2">
                    <button
                        type="button"
                        onClick={shareWhatsApp}
                        className="gcx-hover-tinta h-[54px] rounded-full border-0 text-[15.5px] font-semibold flex items-center justify-center gap-2.5 cursor-pointer active:scale-[.98]"
                        style={{ background: 'var(--g-ink)', color: 'var(--g-inv)' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-3.9-1z" /><path d="M9 9.5c.3 2 1.8 3.8 4 4.6l1.2-1.2 2 1-.4 1.4c-3.6.2-7.4-3.3-7.5-7l1.4-.5 1 2z" /></svg>
                        Compartir por WhatsApp
                    </button>
                    {esMovil && hayCompartirDelSistema && (
                        <button
                            type="button"
                            onClick={compartirDelSistema}
                            className="gcx-hover-chip h-[54px] rounded-full border-0 text-[15.5px] font-semibold flex items-center justify-center gap-2.5 cursor-pointer"
                            style={{ background: 'var(--g-chip)', color: 'var(--g-ink)' }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="18" cy="12" r="1.8" /></svg>
                            Más opciones
                        </button>
                    )}
                </div>
            </div>
        </HojaGrupos>
    );
};

export default ModalCompartirQR;

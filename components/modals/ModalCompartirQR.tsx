import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check } from 'lucide-react';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';

const LOGO_URL = '/origen-logo.png';

// lucide-react no trae el logo de marca de WhatsApp, así que lo definimos inline.
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.892c0 2.096.546 4.142 1.588 5.945L0 24l6.335-1.652a11.96 11.96 0 005.71 1.454h.006c6.585 0 11.946-5.36 11.949-11.945a11.87 11.87 0 00-3.495-8.408" />
    </svg>
);

interface ModalCompartirQRProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    /** URL que se copia y se comparte por WhatsApp. */
    link: string;
    /** Imagen del QR ya resuelta (src del <img>). */
    qrUrl: string;
    subtitle?: string;
}

// Modal de compartir: muestra el QR + copiar link + WhatsApp.
// Reutilizable — se usa en la cartelera pública y en el panel de anuncios.
const ModalCompartirQR: React.FC<ModalCompartirQRProps> = ({ isOpen, onClose, title, link, qrUrl, subtitle }) => {
    useBloqueoDeFondo(isOpen);
    const [isCopied, setIsCopied] = useState(false);

    // Bloquea el scroll de fondo mientras el modal está abierto — sin esto,
    // en InicioPublico.tsx (página larga, con scroll) el usuario podía seguir
    // scrolleando el fondo detrás del modal.
    useEffect(() => {
        if (!isOpen) return;
        const original = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = original;
        };
    }, [isOpen]);

    // Escape cierra, como en el resto de las hojas.
    useEffect(() => {
        if (!isOpen) return;
        const alSalir = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', alSalir);
        return () => window.removeEventListener('keydown', alSalir);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

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

    /**
     * Va por un portal al <body>, y no donde se lo invoque.
     *
     * Una hoja `position: fixed` deja de estar anclada a la pantalla si
     * algún ancestro tiene transform, filter o —en iOS Safari— overflow
     * oculto con esquinas redondeadas: pasa a medirse contra esa caja. Eso
     * es exactamente la tarjeta de un grupo, así que la hoja aparecía
     * encajada adentro de la tarjeta, cortada y sin el velo de fondo. Desde
     * el body no hay ancestro que la recorte, la invoque quien la invoque.
     */
    return createPortal(
        /* Hoja que sube desde abajo en el teléfono y se centra en escritorio,
           igual que el recorte de imagen y las confirmaciones del panel. */
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-0 z-[100] flex items-end justify-center bg-[rgba(10,10,10,.42)] p-0 md:items-center md:p-10"
            onClick={onClose}
        >
            <div
                /* El pie lleva aire de más y suma el resguardo del sistema: en
                   el teléfono la barra del navegador y la franja del gesto se
                   comen los últimos píxeles, y ahí abajo están los botones. */
                className="relative flex max-h-[92vh] w-full flex-col overflow-y-auto rounded-t-[24px] bg-white supports-[height:100dvh]:max-h-[92dvh] pb-[calc(28px+env(safe-area-inset-bottom))] md:max-w-[420px] md:rounded-[24px] md:pb-7"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#f2f2f0] text-black/[.6] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    aria-label="Cerrar"
                >
                    <X className="h-[15px] w-[15px]" />
                </button>
                <div className="flex flex-col items-center px-6 pt-7 text-center">
                    <img src={LOGO_URL} alt="" className="mb-4 h-12 w-auto object-contain" />
                    <h3 className="max-w-full break-words text-[20px] font-semibold leading-[1.35] tracking-[-0.018em] text-[#0a0a0a]">
                        {title}
                    </h3>
                    <p className="mt-1.5 text-[13px] font-medium leading-[1.55] text-black/[.62]">
                        {subtitle || 'Escaneá el código o compartí el link'}
                    </p>
                    <div className="mt-5 rounded-[16px] bg-[#f7f7f5] p-4">
                        <img src={qrUrl} alt={`Código QR de ${title}`} className="h-44 w-44 object-contain" />
                    </div>

                    {/* El link a la vista, antes de los botones: es lo que se
                        va a compartir, y verlo evita tener que copiarlo para
                        saber a dónde lleva. Con `select-all`, un toque largo
                        lo selecciona entero. */}
                    {link && (
                        <p className="mt-4 w-full select-all break-all rounded-[14px] bg-[#f7f7f5] px-4 py-3 text-left text-[12.5px] font-medium leading-[1.5] text-black/[.66]">
                            {link}
                        </p>
                    )}

                    <div className="mt-4 flex w-full flex-col gap-2.5">
                        <button
                            onClick={copyLink}
                            className="inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full bg-[#f2f2f0] text-[14.5px] font-semibold text-[#0a0a0a] transition-colors hover:bg-[#eceae6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            {isCopied
                                ? <Check className="h-[17px] w-[17px] text-emerald-600" />
                                : <Copy className="h-[17px] w-[17px] text-black/[.55]" />}
                            {isCopied ? 'Link copiado' : 'Copiar el link'}
                        </button>
                        <button
                            onClick={shareWhatsApp}
                            className="inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full bg-[#25D366] text-[14.5px] font-semibold text-white transition-colors hover:bg-[#1eb958] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            <WhatsAppIcon className="h-[17px] w-[17px]" />
                            Compartir por WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ModalCompartirQR;

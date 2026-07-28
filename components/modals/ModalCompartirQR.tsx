import React, { useState, useEffect } from 'react';
import { X, Copy, Check } from 'lucide-react';

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

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
        >
            <div
                className="relative bg-white border border-slate-200 rounded-lg w-full max-w-sm overflow-hidden shadow-xl"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-black hover:bg-slate-100 transition-colors z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                    aria-label="Cerrar"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="px-8 pb-8 pt-6 flex flex-col items-center text-center">
                    <img src={LOGO_URL} alt="Logo" className="h-14 w-auto object-contain mb-4" />
                    <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 mb-1 break-words max-w-full">{title}</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">
                        {subtitle || 'Escaneá o compartí'}
                    </p>
                    <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 shadow-sm">
                        <img src={qrUrl} alt={`QR ${title}`} className="w-44 h-44 object-contain" />
                    </div>
                    <div className="w-full space-y-3">
                        <button
                            onClick={copyLink}
                            className="w-full py-3 px-6 border border-slate-200 rounded-lg font-bold uppercase text-xs tracking-widest text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center gap-3"
                        >
                            {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                            {isCopied ? '¡Copiado!' : 'Copiar link'}
                        </button>
                        <button
                            onClick={shareWhatsApp}
                            className="w-full py-3 px-6 bg-[#25D366] text-white rounded-lg font-bold uppercase text-xs tracking-widest hover:bg-[#1eb958] transition-colors flex items-center justify-center gap-3"
                        >
                            <WhatsAppIcon className="w-4 h-4" />
                            Compartir vía WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModalCompartirQR;

import React, { useState } from 'react';
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/95 backdrop-blur-xl"
            onClick={onClose}
        >
            <div
                className="relative bg-white border-4 border-black w-full max-w-sm overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 border-2 border-black hover:bg-black hover:text-white transition-all z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    aria-label="Cerrar"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="p-8 flex flex-col items-center text-center">
                    <img src={LOGO_URL} alt="Logo" className="h-16 w-auto object-contain mb-4" />
                    <h3 className="text-2xl font-black uppercase tracking-tight mb-1 break-words max-w-full">{title}</h3>
                    <p className="text-sm font-bold text-neutral-500 uppercase tracking-widest mb-6">
                        {subtitle || 'Escaneá o compartí'}
                    </p>
                    <div className="bg-white border-4 border-black p-4 mb-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <img src={qrUrl} alt={`QR ${title}`} className="w-44 h-44 object-contain" />
                    </div>
                    <div className="w-full space-y-3">
                        <button
                            onClick={copyLink}
                            className="w-full py-4 px-6 border-4 border-black font-black uppercase text-sm tracking-widest hover:bg-neutral-100 transition-all flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                        >
                            {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                            {isCopied ? '¡Copiado!' : 'Copiar link'}
                        </button>
                        <button
                            onClick={shareWhatsApp}
                            className="w-full py-4 px-6 bg-[#25D366] text-white border-4 border-black font-black uppercase text-sm tracking-widest hover:bg-[#1eb958] transition-all flex items-center justify-center gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                        >
                            <WhatsAppIcon className="w-5 h-5" />
                            Compartir vía WhatsApp
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ModalCompartirQR;

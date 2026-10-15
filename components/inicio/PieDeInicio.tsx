import React from 'react';
import { Instagram, Facebook, Youtube, Music as MusicIcon } from 'lucide-react';
import { FooterLinks } from '../../types';

/**
 * El pie de la portada: las redes y el copyright.
 *
 * Se lleva las animaciones de entrada porque es el único que las usa
 * (`animate-slideUp stagger-4`). El `animate-fadeIn` del hero no está acá:
 * ese es global, vive en index.html.
 */
const animationStyles = `
    @keyframes slideUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
    }
    .animate-slideUp { animation: slideUp 0.5s ease-out forwards; }
    .animate-scaleIn { animation: scaleIn 0.4s ease-out forwards; }
    .stagger-1 { animation-delay: 0.05s; opacity: 0; }
    .stagger-2 { animation-delay: 0.1s; opacity: 0; }
    .stagger-3 { animation-delay: 0.15s; opacity: 0; }
    .stagger-4 { animation-delay: 0.2s; opacity: 0; }
    .stagger-5 { animation-delay: 0.25s; opacity: 0; }
    .stagger-6 { animation-delay: 0.3s; opacity: 0; }
`;

const PieDeInicio: React.FC<{ footerLinks: FooterLinks; isLoaded: boolean }> = ({ footerLinks, isLoaded }) => (
    <>
        <style>{animationStyles}</style>

        {/* === FOOTER === */}
        <footer className={`relative z-10 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 py-8 sm:py-12 md:py-16 px-4 md:px-6 mt-auto ${isLoaded ? 'animate-slideUp stagger-4' : 'opacity-0'}`}>
            <div className="max-w-7xl mx-auto flex flex-col items-center text-center md:text-left md:flex-row md:items-center md:justify-between gap-8 md:gap-12">

                {/* Left - Text */}
                <div>
                    {/* Cierra en el mismo registro con el que abre el saludo
                        (Light 300): la página empieza y termina hablando. */}
                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-light tracking-[-0.02em] mb-2 md:mb-3 text-slate-900 dark:text-white">
                        ¿Querés conocernos?
                    </h2>
                    <p className="text-slate-500 dark:text-zinc-400 text-sm md:text-base font-normal">
                        Seguinos en nuestras redes y sé parte de la comunidad.
                    </p>
                </div>

                {/* Right - Social Icons */}
                <div className="flex flex-wrap justify-center gap-3 md:gap-4">
                    {footerLinks.instagram && (
                        <button
                            onClick={() => window.open(footerLinks.instagram, '_blank')}
                            className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200"
                            title="Instagram"
                        >
                            <Instagram className="w-5 h-5" />
                        </button>
                    )}
                    {footerLinks.facebook && (
                        <button
                            onClick={() => window.open(footerLinks.facebook, '_blank')}
                            className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200"
                            title="Facebook"
                        >
                            <Facebook className="w-5 h-5" />
                        </button>
                    )}
                    {footerLinks.youtube && (
                        <button
                            onClick={() => window.open(footerLinks.youtube, '_blank')}
                            className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200"
                            title="YouTube"
                        >
                            <Youtube className="w-5 h-5" />
                        </button>
                    )}
                    {footerLinks.spotify && (
                        <button
                            onClick={() => window.open(footerLinks.spotify, '_blank')}
                            className="w-12 h-12 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-2xl flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all duration-200"
                            title="Spotify"
                        >
                            <MusicIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Copyright */}
            <div className="max-w-7xl mx-auto mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-slate-200 dark:border-zinc-800 text-center">
                <p className="text-sm font-semibold text-slate-400 dark:text-zinc-500">
                    © {new Date().getFullYear()} Sistema Origen — Todos los derechos reservados
                </p>
                <p className="text-xs font-normal tracking-[0.06em] text-slate-300 dark:text-zinc-600 mt-2">
                    Powered by IQstudios
                </p>
            </div>
        </footer>
    </>
);

export default PieDeInicio;

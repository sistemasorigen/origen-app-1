import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Aviso de que no se pudo hablar con la base.
 *
 * Aparece cuando el perfil quedó en `error-db`: sabemos que algo falló, pero
 * no qué tiene o deja de tener esta persona. Es una banda, no un modal —
 * nadie queda encerrado por un problema que no causó y que se va solo.
 *
 * Ámbar y no rojo a propósito: esto es temporal y del sistema, no algo que
 * el usuario rompió. Se saca sola cuando el reintento de AuthContext logra
 * traer el perfil.
 */
const AvisoConexion: React.FC = () => {
    const { user, estadoPerfil } = useAuth();

    if (!user || estadoPerfil !== 'error-db') return null;

    return (
        // El contenedor no intercepta clics; solo el aviso los recibe, y
        // tampoco los necesita. Así nunca tapa algo que se quiera tocar.
        <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 top-20 z-[95] flex justify-center px-4"
        >
            <div className="flex max-w-[520px] items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg">
                <svg
                    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
                    className="mt-[1px] flex-none text-amber-600"
                    aria-hidden="true"
                >
                    <path d="M12 9v4M12 17h.01" />
                    <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
                </svg>
                <p className="text-sm font-semibold leading-snug text-amber-800">
                    Estamos teniendo problemas de conexión. Algunas funciones pueden no estar disponibles por unos
                    minutos.
                </p>
            </div>
        </div>
    );
};

export default AvisoConexion;

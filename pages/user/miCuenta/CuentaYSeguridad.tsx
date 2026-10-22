import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../services/supabaseClient';
import { useAuth } from '../../../contexts/AuthContext';
import {
    BotonPrimario, BotonRojo, BotonSecundario, EncabezadoSubpagina, ESTILO_TARJETA,
    Girito, GrupoDeFilas, Fila, Icono, ICONOS, Panel, Rotulo, TARJETA, TituloDePanel,
} from '../../../components/miCuenta/piezas';

/**
 * Cuenta y seguridad — design-claude/Mi Cuenta - Preferencias y seguridad.dc.
 *
 * Tres cosas, y ninguna inventa nada del lado de la sesión:
 *   · el email, bloqueado, y CÓMO entrás (Google, Cuenta Origen o las dos),
 *   · cambiar la contraseña, sólo si entrás con contraseña,
 *   · cerrar la sesión en todos los dispositivos.
 *
 * CÓMO SE SABE CON QUÉ ENTRÁS. Por `identities` de la sesión, no por si hay
 * contraseña: una cuenta puede tener las dos cosas. Si entre las identidades
 * hay una de Google, se muestra Google; si hay una `email` (la de "Crear
 * cuenta"), se muestra Cuenta Origen. El formulario de contraseña aparece
 * sólo cuando hay una identidad de tipo `email`.
 */

const REQUISITOS = [
    { texto: 'Al menos 8 caracteres', cumple: (p: string) => p.length >= 8 },
    { texto: 'Una mayúscula', cumple: (p: string) => /[A-ZÁÉÍÓÚÑ]/.test(p) },
    { texto: 'Un número', cumple: (p: string) => /\d/.test(p) },
];

const FUERZA = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte'];
const COLOR_FUERZA = ['#e5484d', '#e8a23a', '#c9b63a', '#34c759'];

/**
 * Supabase pide volver a entrar cuando la sesión es vieja. El mensaje que
 * manda es técnico y en inglés; acá se traduce a lo que hay que hacer.
 */
const pideVolverAEntrar = (mensaje: string): boolean =>
    /reauthenticat|security purposes|session.*expired|refresh.*token/i.test(mensaje || '');

const Ojo: React.FC<{ abierto: boolean }> = ({ abierto }) => (
    <Icono
        tam={20}
        grosor={1.8}
        d={abierto
            ? 'M3 3l18 18M10.6 6a9.7 9.7 0 011.4-.1c6 0 9.5 6.1 9.5 6.1a17 17 0 01-2.7 3.4M6.4 6.9C3.9 8.6 2.5 12 2.5 12s3.5 6.5 9.5 6.5a9 9 0 004.3-1.1M9.9 9.9a3 3 0 004.2 4.2'
            : 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 15a3 3 0 100-6 3 3 0 000 6z'}
    />
);

export interface CuentaYSeguridadProps {
    onVolver?: () => void;
    avisar: (texto: string) => void;
}

export const CuentaYSeguridad: React.FC<CuentaYSeguridadProps> = ({ onVolver, avisar }) => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();

    const [proveedores, setProveedores] = useState<string[] | null>(null);

    const [p1, setP1] = useState('');
    const [p2, setP2] = useState('');
    const [verClave, setVerClave] = useState(false);
    const [estadoClave, setEstadoClave] = useState<'quieto' | 'intentado' | 'guardando'>('quieto');
    const [errorClave, setErrorClave] = useState<string | null>(null);

    const [panel, setPanel] = useState<null | 'todo'>(null);
    const [cerrandoTodo, setCerrandoTodo] = useState(false);

    useEffect(() => {
        let vigente = true;
        supabase.auth.getUser()
            .then(({ data }) => {
                if (!vigente) return;
                const ids = (data?.user?.identities || []).map(i => String(i.provider));
                // Si no vinieron identidades, el proveedor del token alcanza.
                const deMetadata = String((data?.user?.app_metadata as any)?.provider || '');
                setProveedores(ids.length ? ids : (deMetadata ? [deMetadata] : []));
            })
            .catch(() => { if (vigente) setProveedores([]); });
        return () => { vigente = false; };
    }, [user?.id]);

    const conGoogle = !!proveedores?.includes('google');
    const conClave = !!proveedores?.includes('email');

    const cumplidos = REQUISITOS.map(r => r.cumple(p1));
    const cuantos = cumplidos.filter(Boolean).length;
    const puntaje = !p1 ? 0 : Math.min(4, cuantos + (p1.length >= 12 && cuantos === 3 ? 1 : 0));
    const intentado = estadoClave === 'intentado';
    const faltanRequisitos = intentado && cuantos < 3;
    const noCoinciden = intentado && cuantos === 3 && p1 !== p2;

    const guardarClave = async () => {
        if (estadoClave === 'guardando') return;
        setErrorClave(null);
        if (cuantos < 3 || p1 !== p2) { setEstadoClave('intentado'); return; }

        setEstadoClave('guardando');
        const { error } = await supabase.auth.updateUser({ password: p1 });
        setEstadoClave('quieto');

        if (error) {
            setErrorClave(pideVolverAEntrar(error.message)
                ? 'Por seguridad, para cambiar la contraseña tenés que haber entrado hace poco. Cerrá sesión, volvé a entrar y probá de nuevo.'
                : 'No pudimos cambiar la contraseña. Revisá tu conexión y probá de nuevo.');
            return;
        }

        setP1(''); setP2(''); setVerClave(false);
        avisar('Contraseña actualizada');
    };

    const cerrarTodo = async () => {
        if (cerrandoTodo) return;
        setCerrandoTodo(true);
        try {
            // scope global: se cae la sesión de todos los dispositivos,
            // incluido este. Después, el signOut de la app limpia lo local
            // y deja a la persona en el login.
            await supabase.auth.signOut({ scope: 'global' });
        } catch {
            // Si el pedido no llegó, el signOut de abajo igual cierra acá.
        }
        setPanel(null);
        await signOut();
    };

    const campo = (malo: boolean) => `mc-campo ${malo ? 'mc-campo--mal' : ''}`;

    return (
        <>
            <EncabezadoSubpagina titulo="Cuenta y seguridad" onVolver={onVolver} />

            <Rotulo className="mt-7 mb-2.5 ml-1.5">EMAIL</Rotulo>
            <div className={TARJETA} style={ESTILO_TARJETA}>
                <div className="flex items-center gap-3.5 min-h-[60px] px-4 py-2.5">
                    <span className="w-9 h-9 flex-none rounded-full flex items-center justify-center"
                        style={{ background: 'var(--mc-chip)' }}>
                        <Icono d="M3.5 6h17v12h-17zM3.5 7l8.5 6.5L20.5 7" />
                    </span>
                    <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <span className="text-[15px] font-semibold [overflow-wrap:anywhere]">{user?.email}</span>
                        <span className="text-[13px] font-medium" style={{ color: 'var(--mc-m50)' }}>
                            Es el email de tu cuenta y no se puede cambiar
                        </span>
                    </span>
                    <Icono d={ICONOS.candado} tam={17} grosor={1.8} />
                </div>
            </div>

            <Rotulo className="mt-7 mb-2.5 ml-1.5">CÓMO ENTRÁS</Rotulo>
            <div className={TARJETA} style={ESTILO_TARJETA}>
                {proveedores === null ? (
                    <div className="flex items-center gap-3.5 min-h-[60px] px-4 py-2.5">
                        <span className="text-[15px] font-medium" style={{ color: 'var(--mc-m50)' }}>Buscando…</span>
                    </div>
                ) : (
                    <>
                        {conGoogle && (
                            <div className="flex items-center gap-3.5 min-h-[60px] px-4 py-2.5">
                                <span className="w-9 h-9 flex-none rounded-full bg-white flex items-center justify-center"
                                    style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)' }}>
                                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                                        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                                        <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.4 5.7c4.3-4 6.9-9.9 6.9-17.2z" />
                                        <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.9-6.1z" />
                                        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
                                    </svg>
                                </span>
                                <span className="flex-1 text-[15px] font-semibold">Con Google</span>
                            </div>
                        )}
                        {/* Cuenta Origen = la que se creó con "Crear cuenta",
                            email y contraseña. Una cuenta puede tener las dos
                            filas. Sin Google ni email (no debería pasar) se
                            muestra ésta, como antes. */}
                        {(conClave || !conGoogle) && (
                            <div className="flex items-center gap-3.5 min-h-[60px] px-4 py-2.5"
                                style={{ borderTop: conGoogle ? '1px solid var(--mc-line)' : '0' }}>
                                {/* favicon.png es el isotipo negro sobre
                                    transparente: en oscuro se invierte. */}
                                <span className="w-9 h-9 flex-none rounded-full flex items-center justify-center"
                                    style={{ background: 'var(--mc-chip)' }}>
                                    <img src="/favicon.png" alt="" aria-hidden="true"
                                        className="w-5 h-5 object-contain dark:invert" />
                                </span>
                                <span className="flex-1 text-[15px] font-semibold">Cuenta Origen</span>
                            </div>
                        )}
                    </>
                )}
            </div>

            <Rotulo className="mt-7 mb-2.5 ml-1.5">CONTRASEÑA</Rotulo>
            {proveedores !== null && !conClave ? (
                <div className={`${TARJETA} px-4 py-4`} style={ESTILO_TARJETA}>
                    <p className="m-0 text-[15px] leading-[1.5] font-medium text-pretty" style={{ color: 'var(--mc-m66)' }}>
                        {conGoogle
                            ? 'Entrás con Google: tu contraseña la maneja Google.'
                            : 'Tu cuenta no usa contraseña.'}
                    </p>
                </div>
            ) : (
                <div className={`${TARJETA} px-4 pt-1.5 pb-[18px]`} style={ESTILO_TARJETA}>
                    <div className="pt-3.5">
                        <label htmlFor="mc-p1" className="block pl-1 text-[13.5px] font-semibold" style={{ color: 'var(--mc-m66)' }}>
                            Contraseña nueva
                        </label>
                        <div className="relative mt-2">
                            <input
                                id="mc-p1"
                                type={verClave ? 'text' : 'password'}
                                className={campo(faltanRequisitos)}
                                style={{ paddingRight: 52 }}
                                value={p1}
                                autoComplete="new-password"
                                onChange={e => { setP1(e.target.value); setErrorClave(null); }}
                            />
                            <button
                                type="button"
                                onClick={() => setVerClave(v => !v)}
                                aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                className="absolute right-1 top-1 w-11 h-11 border-0 bg-transparent rounded-full flex items-center justify-center cursor-pointer"
                                style={{ color: 'var(--mc-m66)' }}
                            >
                                <Ojo abierto={verClave} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 mt-3" aria-hidden="true">
                        {[0, 1, 2, 3].map(i => (
                            <span key={i} className="h-[5px] rounded-full"
                                style={{
                                    background: i < puntaje ? COLOR_FUERZA[Math.max(0, puntaje - 1)] : 'var(--mc-chip)',
                                    transition: 'background-color .25s ease',
                                }} />
                        ))}
                    </div>
                    <p aria-live="polite" className="mt-2 mb-0 ml-0.5 text-[13px] font-semibold" style={{ color: 'var(--mc-m66)' }}>
                        {p1 ? FUERZA[puntaje] : 'Seguridad de la contraseña'}
                    </p>

                    <div className="flex flex-col gap-1.5 mt-3">
                        {REQUISITOS.map((r, i) => (
                            <div key={r.texto} className="flex items-center gap-2.5 text-[14px] font-medium"
                                style={{ color: cumplidos[i] ? 'var(--mc-ink)' : 'var(--mc-m66)' }}>
                                <span className="w-5 h-5 flex-none rounded-full flex items-center justify-center text-white"
                                    style={{
                                        background: cumplidos[i] ? '#34c759' : 'transparent',
                                        boxShadow: cumplidos[i] ? 'none' : 'inset 0 0 0 1.5px var(--mc-m38)',
                                        transition: 'background-color .2s ease',
                                    }}>
                                    {cumplidos[i] && <Icono d={ICONOS.tilde} tam={11} grosor={3.4} />}
                                </span>
                                {r.texto}
                            </div>
                        ))}
                    </div>

                    <div className="pt-[18px]">
                        <label htmlFor="mc-p2" className="block pl-1 text-[13.5px] font-semibold" style={{ color: 'var(--mc-m66)' }}>
                            Repetila
                        </label>
                        <input
                            id="mc-p2"
                            type={verClave ? 'text' : 'password'}
                            className={`${campo(noCoinciden)} mt-2`}
                            value={p2}
                            autoComplete="new-password"
                            onChange={e => { setP2(e.target.value); setErrorClave(null); }}
                        />
                        {(noCoinciden || faltanRequisitos || errorClave) && (
                            <p role="alert" className="flex items-start gap-2 mt-2.5 mb-0 ml-1 text-[13.5px] leading-[1.45] font-semibold">
                                <span className="w-5 h-5 flex-none rounded-full inline-flex items-center justify-center text-[12px] font-bold"
                                    style={{ background: 'var(--mc-ink)', color: 'var(--mc-bg)' }}>!</span>
                                {errorClave
                                    || (noCoinciden ? 'Las dos contraseñas no coinciden.' : 'Te falta cumplir algún requisito de arriba.')}
                            </p>
                        )}
                    </div>

                    <BotonPrimario
                        ancho
                        onClick={guardarClave}
                        disabled={!p1 || !p2 || estadoClave === 'guardando'}
                        className="mt-[18px]"
                    >
                        {estadoClave === 'guardando' && <Girito sobreOscuro />}
                        <span>{estadoClave === 'guardando' ? 'Guardando…' : 'Guardar contraseña'}</span>
                    </BotonPrimario>
                </div>
            )}

            <GrupoDeFilas titulo="SESIONES">
                <Fila
                    primera
                    icono="M3.5 5h13v9h-13zM7 18h6M10 14v4M15.5 10h5v10h-5z"
                    nombre="Cerrar sesión en todos mis dispositivos"
                    detalle="También en este. Vas a tener que volver a entrar."
                    onClick={() => setPanel('todo')}
                />
            </GrupoDeFilas>

            <div className={`${TARJETA} mt-7`} style={ESTILO_TARJETA}>
                <button
                    type="button"
                    onClick={() => navigate('/perfil/privacidad')}
                    className="w-full min-h-[60px] flex items-center gap-3.5 px-4 py-2.5 border-0 bg-transparent font-[inherit] cursor-pointer text-left"
                    style={{ color: 'var(--mc-red)' }}
                >
                    <span className="w-9 h-9 flex-none rounded-full flex items-center justify-center"
                        style={{ background: 'var(--mc-chip)', color: 'var(--mc-red)' }}>
                        <Icono d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />
                    </span>
                    <span className="flex-1 text-[15px] font-semibold">Eliminar mi cuenta</span>
                    <Icono d={ICONOS.flecha} tam={17} grosor={2} />
                </button>
            </div>

            <Panel abierto={panel === 'todo'} onCerrar={() => setPanel(null)} etiqueta="¿Cerrar sesión en todos lados?">
                <TituloDePanel
                    titulo="¿Cerrar sesión en todos lados?"
                    detalle="Se va a cerrar tu sesión en todos los celulares y computadoras, incluido este."
                />
                <div className="flex flex-col gap-2.5 mt-[22px]">
                    <BotonRojo onClick={cerrarTodo} disabled={cerrandoTodo}>
                        {cerrandoTodo && <Girito />}
                        {cerrandoTodo ? 'Cerrando…' : 'Cerrar en todos'}
                    </BotonRojo>
                    <BotonSecundario ancho onClick={() => setPanel(null)} style={{ background: 'transparent' }}>
                        Cancelar
                    </BotonSecundario>
                </div>
            </Panel>
        </>
    );
};

export default CuentaYSeguridad;

import React from 'react';
import {
    ESTILO_TARJETA, Fila, GrupoDeFilas, Hueso, Icono, ICONOS, Rotulo, TARJETA,
} from './piezas';
import { Destacada, type Destacado } from './Destacada';

/**
 * El índice de "Mi cuenta" — design-claude/MiCuentaLista.dc.html.
 *
 * Sirve para dos cosas a la vez, y por eso vive aparte:
 *   · en el teléfono es la PRIMERA pantalla,
 *   · en la compu es el riel izquierdo fijo, con la fila activa marcada.
 */

export type SeccionDeMiCuenta =
    | 'editar' | 'grupos' | 'historial' | 'compras' | 'inscripciones' | 'servicio'
    | 'seguridad' | 'privacidad' | 'terminos' | 'tutoriales' | 'contacto'
    | 'reportar' | 'app';

export interface ConteosDeMiCuenta {
    grupos: number;
    compras: number;
    inscripciones: number;
    servicio: number;
}

export interface ListaMiCuentaProps {
    nombre: string;
    email: string;
    avatarUrl?: string | null;
    /** Cuántos datos del perfil faltan. 0 = está completo. */
    faltan: number;
    /** El nombre del dato que falta, cuando es uno solo. */
    faltaTexto?: string;
    conteos: ConteosDeMiCuenta;
    sinLeer: number;
    /** Los avisos de este celular: su estado, su detalle y su ayuda. */
    avisos: {
        prendido: boolean;
        sePuedePrender: boolean;
        detalle: string;
        ayuda: string;
        onPrender: () => void;
        onAyuda: () => void;
    };
    temaOscuro: boolean;
    onAlternarTema: () => void;
    version: string;
    cargando?: boolean;
    destacado: Destacado | null;
    onCerrarDestacado: () => void;
    /** En escritorio, la fila que corresponde a lo que se ve a la derecha. */
    activa?: SeccionDeMiCuenta | null;
    onIr: (seccion: SeccionDeMiCuenta) => void;
    onIrAfuera: (ruta: string) => void;
    onCerrarSesion: () => void;
    /** Sólo en el teléfono: la sección reemplazó al índice. */
    onVolver?: () => void;
}

const iniciales = (nombre: string) =>
    (nombre || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(p => p[0].toUpperCase())
        .join('') || '·';

/** El esqueleto del .dc: la tarjeta de la persona, la destacada y dos grupos. */
const Esqueleto: React.FC = () => (
    <div aria-busy="true" aria-label="Cargando">
        <div className={`${TARJETA} flex items-center gap-3.5 p-4 mt-[22px]`} style={ESTILO_TARJETA}>
            <Hueso ancho="56px" alto={56} redondo />
            <div className="flex-1">
                <Hueso ancho="55%" alto={15} />
                <div className="h-2.5" />
                <Hueso ancho="75%" alto={12} />
            </div>
        </div>
        <div className="mt-3.5"><Hueso alto={148} /></div>
        {[3, 4].map((cuantas, g) => (
            <div key={g}>
                <div className="mt-7 mb-2.5 ml-1.5"><Hueso ancho="120px" alto={11} /></div>
                <div className={TARJETA} style={ESTILO_TARJETA}>
                    {Array.from({ length: cuantas }).map((_, i) => (
                        <div
                            key={i}
                            className="flex items-center gap-3.5 min-h-[56px] px-4 py-2.5"
                            style={{ borderTop: i ? '1px solid var(--mc-line)' : '0' }}
                        >
                            <Hueso ancho="36px" alto={36} redondo />
                            <Hueso ancho={['48%', '62%', '40%', '55%'][i]} alto={13} />
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);

export const ListaMiCuenta: React.FC<ListaMiCuentaProps> = ({
    nombre, email, avatarUrl, faltan, faltaTexto, conteos, sinLeer, version,
    avisos, temaOscuro, onAlternarTema,
    cargando, destacado, onCerrarDestacado, activa, onIr, onIrAfuera,
    onCerrarSesion, onVolver,
}) => {
    const cuenta = (n: number) => (n > 0 ? String(n) : '');

    return (
        <div className="flex flex-col" style={{ color: 'var(--mc-ink)' }}>
            <div className="flex items-center gap-3 min-h-[44px]">
                {onVolver && (
                    <button
                        type="button"
                        onClick={onVolver}
                        aria-label="Volver"
                        className="w-11 h-11 flex-none border-0 rounded-full flex items-center justify-center cursor-pointer"
                        style={{ background: 'var(--mc-chip)', color: 'var(--mc-ink)' }}
                    >
                        <Icono d={ICONOS.atras} tam={20} grosor={2} />
                    </button>
                )}
                <h1 className="m-0 text-[28px] lg:text-[30px] leading-[1.1] font-semibold tracking-[-.025em]">
                    Mi cuenta
                </h1>
            </div>

            {cargando ? <Esqueleto /> : (
                <>
                    {/* La persona. Es un botón entero: tocar cualquier parte
                        lleva a editar, que es lo único que se hace con ella. */}
                    <button
                        type="button"
                        onClick={() => onIr('editar')}
                        aria-label={`${nombre}, editar perfil`}
                        className={`${TARJETA} w-full flex items-center gap-3.5 p-4 mt-[22px] border-0 font-[inherit] text-left cursor-pointer`}
                        style={{
                            ...ESTILO_TARJETA,
                            color: 'var(--mc-ink)',
                            boxShadow: activa === 'editar'
                                ? 'inset 0 0 0 2px var(--mc-ink)'
                                : 'var(--mc-shadow)',
                        }}
                    >
                        <span
                            className="w-14 h-14 flex-none rounded-full overflow-hidden flex items-center justify-center text-[19px] font-semibold tracking-[.02em]"
                            style={{ background: 'var(--mc-chip)', color: 'var(--mc-ink)' }}
                        >
                            {avatarUrl
                                ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                                : iniciales(nombre)}
                        </span>

                        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <span className="text-[17px] leading-[1.3] font-semibold tracking-[-.015em] truncate">
                                {nombre || 'Sin nombre'}
                            </span>
                            <span className="text-[14px] leading-[1.35] font-medium [overflow-wrap:anywhere]" style={{ color: 'var(--mc-m50)' }}>
                                {email}
                            </span>
                            {faltan > 0 && (
                                <span
                                    className="flex items-center gap-1.5 mt-1 text-[13.5px] font-semibold"
                                    style={{ color: 'var(--mc-amber-ink)' }}
                                >
                                    <span className="w-[7px] h-[7px] rounded-full flex-none" style={{ background: 'var(--mc-amber-ink)' }} />
                                    {faltan > 1 ? `Faltan ${faltan} datos` : (faltaTexto || 'Falta un dato')}
                                </span>
                            )}
                        </span>

                        <Icono d={ICONOS.flecha} tam={18} grosor={2} />
                    </button>

                    {destacado && <Destacada destacado={destacado} onCerrar={onCerrarDestacado} />}

                    <GrupoDeFilas titulo="MI VIDA EN ORIGEN">
                        <Fila primera icono={ICONOS.grupos} nombre="Mis grupos" valor={cuenta(conteos.grupos)}
                            activa={activa === 'grupos'} onClick={() => onIr('grupos')} />
                        <Fila icono={ICONOS.calendario} nombre="Mi calendario" externa
                            onClick={() => onIrAfuera('/gcx/calendario')} />
                        <Fila icono={ICONOS.historial} nombre="Historial de grupos"
                            activa={activa === 'historial'} onClick={() => onIr('historial')} />
                        <Fila icono={ICONOS.bolsa} nombre="Mis compras" valor={cuenta(conteos.compras)}
                            activa={activa === 'compras'} onClick={() => onIr('compras')} />
                        <Fila icono={ICONOS.entrada} nombre="Mis inscripciones" valor={cuenta(conteos.inscripciones)}
                            activa={activa === 'inscripciones'} onClick={() => onIr('inscripciones')} />
                        <Fila icono={ICONOS.servir} nombre="Dónde sirvo" valor={cuenta(conteos.servicio)}
                            activa={activa === 'servicio'} onClick={() => onIr('servicio')} />
                    </GrupoDeFilas>

                    <GrupoDeFilas titulo="PREFERENCIAS">
                        <Fila primera icono={ICONOS.campana} nombre="Notificaciones" marca={sinLeer}
                            onClick={() => onIrAfuera('/notificaciones')} />
                        {/* El interruptor se deja tocar SÓLO cuando prenderlo
                            es posible. Una vez dado el permiso, la página no
                            puede quitárselo —sólo el navegador—, así que queda
                            prendido y con su línea de ayuda en vez de fingir
                            que se apaga. */}
                        <Fila icono={ICONOS.celular} nombre="Avisos en este celular"
                            detalle={avisos.detalle}
                            interruptor={{
                                prendido: avisos.prendido,
                                apagado: !avisos.sePuedePrender,
                                onChange: avisos.onPrender,
                            }}
                            ayuda={avisos.ayuda ? { texto: avisos.ayuda, onClick: avisos.onAyuda } : undefined} />
                        <Fila icono={ICONOS.luna} nombre="Modo oscuro"
                            interruptor={{ prendido: temaOscuro, onChange: onAlternarTema }} />
                    </GrupoDeFilas>

                    <GrupoDeFilas titulo="CUENTA Y SEGURIDAD">
                        <Fila primera icono={ICONOS.escudo} nombre="Cuenta y seguridad"
                            detalle="Email, cómo entrás, contraseña y sesiones"
                            activa={activa === 'seguridad'} onClick={() => onIr('seguridad')} />
                    </GrupoDeFilas>

                    <GrupoDeFilas titulo="PRIVACIDAD">
                        <Fila primera icono={ICONOS.candado} nombre="Privacidad y mis datos"
                            activa={activa === 'privacidad'} onClick={() => onIr('privacidad')} />
                    </GrupoDeFilas>

                    <GrupoDeFilas titulo="AYUDA Y OTROS">
                        <Fila primera icono={ICONOS.play} nombre="Tutoriales"
                            activa={activa === 'tutoriales'} onClick={() => onIr('tutoriales')} />
                        <Fila icono={ICONOS.chat} nombre="Escribile a la iglesia"
                            activa={activa === 'contacto'} onClick={() => onIr('contacto')} />
                        <Fila icono={ICONOS.bicho} nombre="Reportar un problema"
                            activa={activa === 'reportar'} onClick={() => onIr('reportar')} />
                        <Fila icono={ICONOS.documento} nombre="Términos y privacidad"
                            activa={activa === 'terminos'} onClick={() => onIr('terminos')} />
                        <Fila icono={ICONOS.info} nombre="Sobre la app" valor={version}
                            activa={activa === 'app'} onClick={() => onIr('app')} />
                    </GrupoDeFilas>

                    <button
                        type="button"
                        onClick={onCerrarSesion}
                        className={`${TARJETA} w-full min-h-[56px] mt-7 border-0 font-[inherit] text-[15px] font-semibold cursor-pointer`}
                        style={{ ...ESTILO_TARJETA, color: 'var(--mc-red)' }}
                    >
                        Cerrar sesión
                    </button>

                    <p className="mt-3.5 mb-0 text-center text-[12.5px] font-medium" style={{ color: 'var(--mc-m50)' }}>
                        Origen App · versión {version}
                    </p>
                </>
            )}
        </div>
    );
};

export default ListaMiCuenta;

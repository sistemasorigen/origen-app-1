import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { supabaseService } from '../../../services/supabaseService';
import AvatarUpload from '../../../components/media/SubidaAvatar';
import {
    BotonPrimario, BotonRojo, BotonSecundario, EncabezadoSubpagina, ESTILO_TARJETA,
    Girito, Icono, ICONOS, Panel, TARJETA, TituloDePanel,
} from '../../../components/miCuenta/piezas';

/**
 * Editar perfil — design-claude/Mi Cuenta - Inicio.dc.html.
 *
 * LA LÓGICA DE GUARDADO ES LA DE SIEMPRE, letra por letra: updateUserProfile
 * con el teléfono, la fecha y la edad; updateUser con el nombre y SIN el sexo
 * (que se saca del objeto a propósito, o `...user` lo arrastraría);
 * sincronizarMisDatos para que lo nuevo baje a las copias; y refreshSession,
 * que es lo que hace que el formulario vuelva a "sin cambios" solo.
 *
 * Lo que cambia es la cara. Y una cosa que NO se copió del .dc: la validación
 * de que el teléfono tenga 10 dígitos. Hoy no existe, y agregarla acá dejaría
 * sin poder guardar a quien tiene el número cargado en otro formato —que son
 * varios— por tocar un campo que ni siquiera es ese.
 */

type CampoNombre = 'name' | 'phone' | 'birthDate' | 'gender';
type CampoEditable = Exclude<CampoNombre, 'gender'>;

/** Los mismos cuatro que exige ModalCompletarPerfil antes de dejar entrar. */
export const CAMPOS_REQUERIDOS: { key: CampoNombre; label: string }[] = [
    { key: 'name', label: 'Nombre y apellido' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'birthDate', label: 'Fecha de nacimiento' },
    { key: 'gender', label: 'Sexo' },
];

export const calcularEdad = (fecha: string): number => {
    if (!fecha) return 0;
    const hoy = new Date();
    const nac = new Date(fecha);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
};

const Etiqueta: React.FC<{ htmlFor?: string; children: React.ReactNode }> = ({ htmlFor, children }) => (
    <label htmlFor={htmlFor} className="text-[13.5px] font-semibold" style={{ color: 'var(--mc-m66)' }}>
        {children}
    </label>
);

/** La fila de arriba de un campo: nombre, "Falta" y el punto de sin guardar. */
const CabezaDeCampo: React.FC<{
    htmlFor?: string; texto: string; falta?: boolean; editado?: boolean;
}> = ({ htmlFor, texto, falta, editado }) => (
    <div className="flex items-center gap-2 pl-1 min-h-[22px]">
        <Etiqueta htmlFor={htmlFor}>{texto}</Etiqueta>
        {falta && (
            <span
                className="h-[22px] px-2 rounded-full text-[11.5px] font-bold inline-flex items-center"
                style={{ background: 'var(--mc-amber-bg)', color: 'var(--mc-amber-ink)' }}
            >
                Falta
            </span>
        )}
        {editado && (
            <span aria-label="Sin guardar" className="w-[7px] h-[7px] rounded-full" style={{ background: 'var(--mc-ink)' }} />
        )}
    </div>
);

/** Un dato que no se edita desde acá. */
const Bloqueado: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div
        className="flex items-center justify-between gap-2.5 min-h-[52px] mt-2 px-4 py-3 rounded-2xl text-[16px] font-medium"
        style={{ background: 'var(--mc-surf)', color: 'var(--mc-m50)' }}
    >
        <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
        <Icono d={ICONOS.candado} tam={17} grosor={1.8} />
    </div>
);

export interface EditarPerfilProps {
    /** En el teléfono siempre; en la compu nunca (el índice ya está al lado). */
    onVolver?: () => void;
    /** Para que el shell sepa si hay cambios sin guardar antes de navegar. */
    onCambios?: (hay: boolean) => void;
    avisar: (texto: string) => void;
}

export const EditarPerfil: React.FC<EditarPerfilProps> = ({ onVolver, onCambios, avisar }) => {
    const { user, refreshSession, updateAvatar } = useAuth();

    const [datos, setDatos] = useState({ name: '', phone: '', birthDate: '', gender: '' });
    const [tocados, setTocados] = useState<Record<string, boolean>>({});
    const [estado, setEstado] = useState<'quieto' | 'guardando' | 'guardado'>('quieto');
    const [panel, setPanel] = useState<null | 'salir'>(null);

    useEffect(() => {
        if (!user) return;
        setDatos({
            name: user.name || '',
            phone: user.phone || '',
            birthDate: user.birthDate || '',
            gender: user.gender || '',
        });
    }, [user]);

    // La referencia de "sin cambios" sale de `user`: al guardar,
    // refreshSession() lo actualiza, el efecto de arriba recarga y el diff
    // vuelve a cero solo. El sexo no entra: no se edita desde acá.
    const guardado = {
        name: user?.name || '',
        phone: user?.phone || '',
        birthDate: user?.birthDate || '',
    };
    const editados = (Object.keys(guardado) as CampoEditable[]).filter(k => datos[k] !== guardado[k]);
    const hayCambios = editados.length > 0;

    useEffect(() => { onCambios?.(hayCambios); }, [hayCambios, onCambios]);

    const hoyISO = new Date().toISOString().split('T')[0];

    // El mismo rango que valida ModalCompletarPerfil.
    const errorFecha = (() => {
        if (!datos.birthDate) return null;
        const f = new Date(datos.birthDate + 'T00:00:00');
        if (Number.isNaN(f.getTime())) return 'Revisá la fecha.';
        if (datos.birthDate > hoyISO) return 'La fecha no puede ser posterior a hoy.';
        if (calcularEdad(datos.birthDate) > 120) return 'Revisá el año de nacimiento.';
        return null;
    })();

    const errorNombre = tocados.name && !datos.name.trim() ? 'Escribí tu nombre y apellido.' : null;
    const edad = datos.birthDate && !errorFecha ? calcularEdad(datos.birthDate) : null;

    const escribir = (k: CampoEditable, v: string) => setDatos(prev => ({ ...prev, [k]: v }));
    const salirDelCampo = (k: string) => setTocados(prev => ({ ...prev, [k]: true }));

    const descartar = () => {
        setDatos({
            name: user?.name || '',
            phone: user?.phone || '',
            birthDate: user?.birthDate || '',
            gender: user?.gender || '',
        });
        setTocados({});
        setEstado('quieto');
    };

    const guardar = async () => {
        if (!user || !hayCambios || errorFecha || estado === 'guardando') return;
        setEstado('guardando');

        try {
            const age = datos.birthDate ? calcularEdad(datos.birthDate) : user.age || 0;

            const perfilOk = await supabaseService.updateUserProfile(user.id, {
                phone: datos.phone,
                birthDate: datos.birthDate,
                age,
            });

            // El sexo se saca del objeto: updateUser escribe esa columna
            // cuando viene, y `...user` la arrastraba sin querer.
            const { gender: _elSexoNoSeTocaDesdeAca, ...sinSexo } = user;
            const nombreOk = await supabaseService.updateUser({ ...sinSexo, name: datos.name });

            if (!perfilOk || !nombreOk) throw new Error('No se pudieron guardar los cambios.');

            // Lo recién guardado baja a las copias: la lista del anfitrión, la
            // ficha de la inscripción, el nombre de la tarjeta del grupo. No se
            // mira el resultado a propósito: si esto falla, el perfil se guardó
            // igual y decir que algo salió mal sería mentir.
            await supabaseService.sincronizarMisDatos();
            await refreshSession();

            setEstado('guardado');
            setTocados({});
            avisar('Perfil actualizado');
            setTimeout(() => setEstado(e => (e === 'guardado' ? 'quieto' : e)), 2200);
        } catch (err: unknown) {
            setEstado('quieto');
            avisar(err instanceof Error && err.message
                ? err.message
                : 'No se pudieron guardar los cambios. Revisá tu conexión.');
        }
    };

    const intentarVolver = () => {
        if (hayCambios) { setPanel('salir'); return; }
        onVolver?.();
    };

    const faltaTel = !user?.phone && !datos.phone;
    const faltaNac = !user?.birthDate && !datos.birthDate;

    return (
        <>
            <EncabezadoSubpagina titulo="Editar perfil" onVolver={onVolver ? intentarVolver : undefined} />

            {/* La foto, sola y centrada: es lo único de la pantalla que no es
                un campo, así que no comparte fila con ninguno. */}
            <div className="flex flex-col items-center mt-[26px]">
                <AvatarUpload
                    currentAvatarUrl={user?.avatarUrl}
                    userName={user?.name || 'Usuario'}
                    userId={user?.id || ''}
                    size="lg"
                    onUploadComplete={async (url) => {
                        await supabaseService.updateUserProfile(user!.id, { avatarUrl: url });
                        updateAvatar(url);
                        avisar('Foto actualizada');
                    }}
                />
            </div>

            <div className={`${TARJETA} mt-6 px-4 pt-1.5 pb-[18px]`} style={ESTILO_TARJETA}>
                <div className="pt-3.5">
                    <CabezaDeCampo htmlFor="mc-nombre" texto="Nombre y apellido"
                        falta={!datos.name.trim()} editado={editados.includes('name')} />
                    <input
                        id="mc-nombre"
                        type="text"
                        className={`mc-campo mt-2 ${errorNombre ? 'mc-campo--mal' : ''}`}
                        value={datos.name}
                        autoComplete="name"
                        placeholder="Tu nombre y apellido"
                        onChange={e => escribir('name', e.target.value)}
                        onBlur={() => salirDelCampo('name')}
                    />
                    {errorNombre && (
                        <p role="alert" className="flex items-start gap-2 mt-2.5 mb-0 ml-1 text-[13.5px] leading-[1.45] font-semibold">
                            <span className="w-5 h-5 flex-none rounded-full inline-flex items-center justify-center text-[12px] font-bold"
                                style={{ background: 'var(--mc-ink)', color: 'var(--mc-bg)' }}>!</span>
                            {errorNombre}
                        </p>
                    )}
                </div>

                <div className="pt-[18px]">
                    <CabezaDeCampo htmlFor="mc-tel" texto="Teléfono"
                        falta={faltaTel} editado={editados.includes('phone')} />
                    <input
                        id="mc-tel"
                        type="tel"
                        inputMode="tel"
                        className="mc-campo mt-2"
                        value={datos.phone}
                        autoComplete="tel"
                        placeholder="11 4567 8901"
                        onChange={e => escribir('phone', e.target.value)}
                        onBlur={() => salirDelCampo('phone')}
                    />
                </div>

                <div className="pt-[18px]">
                    <CabezaDeCampo htmlFor="mc-nac" texto="Fecha de nacimiento"
                        falta={faltaNac} editado={editados.includes('birthDate')} />
                    <input
                        id="mc-nac"
                        type="date"
                        max={hoyISO}
                        className={`mc-campo mt-2 ${errorFecha ? 'mc-campo--mal' : ''}`}
                        value={datos.birthDate}
                        autoComplete="bday"
                        aria-invalid={!!errorFecha}
                        onChange={e => escribir('birthDate', e.target.value)}
                        onBlur={() => salirDelCampo('birthDate')}
                    />
                    {edad !== null && (
                        <p className="mt-2 mb-0 ml-1 text-[13.5px] font-semibold" style={{ color: 'var(--mc-m50)' }}>
                            {edad} {edad === 1 ? 'año' : 'años'}
                        </p>
                    )}
                    {errorFecha && (
                        <p role="alert" className="flex items-start gap-2 mt-2.5 mb-0 ml-1 text-[13.5px] leading-[1.45] font-semibold">
                            <span className="w-5 h-5 flex-none rounded-full inline-flex items-center justify-center text-[12px] font-bold"
                                style={{ background: 'var(--mc-ink)', color: 'var(--mc-bg)' }}>!</span>
                            {errorFecha}
                        </p>
                    )}
                </div>

                <div className="pt-[18px]">
                    <div className="flex items-center gap-2 pl-1 min-h-[22px]">
                        <Etiqueta>Sexo</Etiqueta>
                        {!user?.gender && (
                            <span className="h-[22px] px-2 rounded-full text-[11.5px] font-bold inline-flex items-center"
                                style={{ background: 'var(--mc-amber-bg)', color: 'var(--mc-amber-ink)' }}>Falta</span>
                        )}
                    </div>
                    <Bloqueado>{user?.gender || 'Sin cargar'}</Bloqueado>
                    <p className="mt-0.5 mb-0 ml-1 text-[13.5px] font-medium" style={{ color: 'var(--mc-m50)' }}>
                        Define a qué grupos podés entrar, así que lo corrige el equipo. Escribinos si hay que cambiarlo.
                    </p>
                </div>

                <div className="pt-2">
                    <div className="flex items-center gap-2 pl-1 min-h-[22px]"><Etiqueta>Email</Etiqueta></div>
                    <Bloqueado>{user?.email}</Bloqueado>
                    <p className="mt-2 mb-0 ml-1 text-[13.5px] font-medium" style={{ color: 'var(--mc-m50)' }}>
                        Es el de tu cuenta.
                    </p>
                </div>
            </div>

            {/* El pie, pegado abajo: se edita el perfil con una mano y el
                teclado ocupa media pantalla. */}
            <div
                className="sticky bottom-0 -mx-4 lg:mx-0 mt-5 px-4 lg:px-0 pt-3 pb-7 lg:pb-4"
                style={{
                    background: 'var(--mc-bg)',
                    borderTop: '1px solid var(--mc-line)',
                    transition: 'background-color .4s ease',
                }}
            >
                <div className="flex flex-row-reverse gap-2.5">
                    <BotonPrimario
                        onClick={guardar}
                        disabled={(!hayCambios && estado !== 'guardado') || estado === 'guardando' || !!errorFecha}
                        className="flex-[2] lg:flex-none lg:min-w-[200px]"
                    >
                        {estado === 'guardando' && <Girito sobreOscuro />}
                        {estado === 'guardado' && (
                            <span style={{ animation: 'mcTilde .35s ease both' }}>
                                <Icono d={ICONOS.tilde} tam={18} grosor={3} />
                            </span>
                        )}
                        <span>
                            {estado === 'guardando' ? 'Guardando…'
                                : estado === 'guardado' ? 'Guardado' : 'Guardar cambios'}
                        </span>
                    </BotonPrimario>

                    <BotonSecundario
                        onClick={() => { if (hayCambios) { descartar(); avisar('Descartaste los cambios'); } else onVolver?.(); }}
                        className="flex-1 lg:flex-none lg:min-w-[140px]"
                    >
                        Cancelar
                    </BotonSecundario>
                </div>
            </div>

            <Panel abierto={panel === 'salir'} onCerrar={() => setPanel(null)} etiqueta="¿Salir sin guardar?">
                <TituloDePanel
                    titulo="¿Salir sin guardar?"
                    detalle="Los cambios que hiciste en tu perfil se van a perder."
                />
                <div className="flex flex-col gap-2.5 mt-[22px]">
                    <BotonRojo onClick={() => { descartar(); setPanel(null); onVolver?.(); }}>
                        Salir sin guardar
                    </BotonRojo>
                    <BotonSecundario ancho onClick={() => setPanel(null)} style={{ background: 'transparent' }}>
                        Seguir editando
                    </BotonSecundario>
                </div>
            </Panel>
        </>
    );
};

export default EditarPerfil;

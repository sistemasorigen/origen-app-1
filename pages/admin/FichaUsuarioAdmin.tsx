import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CoordinatorVariant, Group, User, UserRole } from '../../types';
import {
    CATALOGO_ROLES,
    DefinicionRol,
    NIVELES,
    NivelAcceso,
    definicionDe,
    iniciales,
    nivelDe,
    nombreDeRol,
    rolesConAcceso,
    rolesDe,
} from './catalogoRoles';
import { Campo, PedidoConfirmacion, Rotulo, useMenosMovimiento } from './piezasAdmin';

/**
 * Ficha de un usuario (design-claude/Admin General).
 *
 * Dos paneles, no dos pantallas: a la izquierda quién es, a la derecha qué
 * puede hacer. En escritorio el de roles se despliega al costado y el de
 * datos se queda a la vista; en el teléfono los dos viajan sobre un riel que
 * se corre a la mitad. Es la animación del diseño y es lo que hace que
 * cambiar un permiso no se sienta como irse a otro lado.
 *
 * Los datos y los roles se guardan por separado, con su propio botón: tocar
 * el apellido de alguien no debería arrastrar un cambio de permisos a medio
 * hacer, ni al revés. Las dos escrituras usan el mismo updateUser de
 * siempre, con la misma lógica de rol legacy.
 */

export type AreaVoluntario = 'GROUPS' | 'GROUPS_VOL' | 'PUNTO' | 'STORE' | 'ALABANZA' | 'WELCOME';

const AREAS_VOLUNTARIO: { valor: AreaVoluntario; label: string }[] = [
    { valor: 'GROUPS', label: 'Ninguna (anfitrión de grupo)' },
    { valor: 'GROUPS_VOL', label: 'Grupos de Conexión' },
    { valor: 'PUNTO', label: 'Punto de Información' },
    { valor: 'STORE', label: 'Tienda' },
    { valor: 'ALABANZA', label: 'Alabanza' },
    { valor: 'WELCOME', label: 'Bienvenida' },
];

export interface DatosCuenta {
    nombre: string;
    apellido: string;
    email: string;
    activo: boolean;
}

interface Props {
    /** null cuando se está creando una cuenta nueva. */
    usuario: User | null;
    grupos: Group[];
    onVolver: () => void;
    onGuardarDatos: (datos: DatosCuenta, password: string) => Promise<boolean>;
    onGuardarRoles: (roles: UserRole[], variantes: CoordinatorVariant[], area: AreaVoluntario) => Promise<boolean>;
    onCrear: (datos: DatosCuenta, password: string, roles: UserRole[], variantes: CoordinatorVariant[], area: AreaVoluntario) => Promise<boolean>;
    onEliminar: () => void;
    pedirConfirmacion: (p: PedidoConfirmacion) => void;
}

const ANCHO_DATOS = 430;
const HUECO = 14;
const ANCHO_ROLES_MAX = 700;
const ANCHO_ROLES_MIN = 480;

/**
 * Mide el contenedor para decidir si los dos paneles entran uno al lado del
 * otro. No alcanza con preguntar por el ancho de la ventana: esta pantalla
 * vive adentro del menú lateral de la app, así que el espacio real es
 * bastante menos. Si no entran, los paneles se turnan sobre un riel, que es
 * el mismo comportamiento que el diseño define para el teléfono.
 */
const useAnchoDisponible = (ref: React.RefObject<HTMLElement>) => {
    const [ancho, setAncho] = useState(0);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        setAncho(el.clientWidth);
        if (typeof ResizeObserver === 'undefined') return;
        const observador = new ResizeObserver(entradas => {
            setAncho(entradas[0].contentRect.width);
        });
        observador.observe(el);
        return () => observador.disconnect();
    }, [ref]);

    return ancho;
};

const partirNombre = (completo: string) => {
    const partes = (completo || '').trim().split(' ').filter(Boolean);
    return { nombre: partes[0] || '', apellido: partes.slice(1).join(' ') };
};

const FichaUsuarioAdmin: React.FC<Props> = ({
    usuario, grupos, onVolver, onGuardarDatos, onGuardarRoles, onCrear, onEliminar, pedirConfirmacion,
}) => {
    const creando = !usuario;
    const rielRef = useRef<HTMLDivElement>(null);
    const anchoDisponible = useAnchoDisponible(rielRef);
    const dosPaneles = anchoDisponible >= ANCHO_DATOS + HUECO + ANCHO_ROLES_MIN;
    const anchoRoles = Math.min(
        ANCHO_ROLES_MAX,
        Math.max(ANCHO_ROLES_MIN, anchoDisponible - ANCHO_DATOS - HUECO)
    );
    const menosMovimiento = useMenosMovimiento();

    const original = useMemo(() => {
        const { nombre, apellido } = partirNombre(usuario?.name || '');
        return {
            datos: { nombre, apellido, email: usuario?.email || '', activo: usuario?.isActive ?? true },
            roles: usuario ? rolesDe(usuario) : [UserRole.VIEWER],
            variantes: usuario?.coordinatorVariants && usuario.coordinatorVariants.length > 0
                ? usuario.coordinatorVariants
                : (usuario?.coordinatorVariant ? [usuario.coordinatorVariant] : []),
        };
    }, [usuario]);

    const [datos, setDatos] = useState<DatosCuenta>(original.datos);
    const [pass, setPass] = useState('');
    const [pass2, setPass2] = useState('');
    const [passAbierto, setPassAbierto] = useState(creando);
    const [datosOk, setDatosOk] = useState(false);
    const [guardandoDatos, setGuardandoDatos] = useState(false);

    const [roles, setRoles] = useState<UserRole[]>(original.roles);
    const [variantes, setVariantes] = useState<CoordinatorVariant[]>(original.variantes);
    const [area, setArea] = useState<AreaVoluntario>('GROUPS');
    const [guardandoRoles, setGuardandoRoles] = useState(false);

    const [rolesAbierto, setRolesAbierto] = useState(false);
    const [nivelesAbiertos, setNivelesAbiertos] = useState<Record<number, boolean>>(() => {
        const inicial: Record<number, boolean> = {};
        NIVELES.forEach((_, i) => {
            inicial[i] = original.roles.some(r => definicionDe(r)?.nivel === i);
        });
        return inicial;
    });

    const idCargado = useRef<string | null>(usuario?.id ?? null);
    useEffect(() => {
        const idActual = usuario?.id ?? null;
        if (idCargado.current === idActual) return;
        idCargado.current = idActual;
        setDatos(original.datos);
        setRoles(original.roles);
        setVariantes(original.variantes);
        setPass(''); setPass2(''); setPassAbierto(!usuario); setDatosOk(false);
        setRolesAbierto(false);
    }, [usuario, original]);

    const tiene = (r: UserRole) => roles.includes(r);

    const cambiosDatos = creando || (
        datos.nombre !== original.datos.nombre ||
        datos.apellido !== original.datos.apellido ||
        datos.email !== original.datos.email ||
        datos.activo !== original.datos.activo ||
        (pass.length > 0 && pass === pass2)
    );

    const cantidadCambiosRoles = useMemo(() => {
        const suma = roles.filter(r => !original.roles.includes(r)).length
            + original.roles.filter(r => !roles.includes(r)).length;
        const cambioVariantes = variantes.length !== original.variantes.length
            || variantes.some(v => !original.variantes.includes(v));
        return suma + (cambioVariantes ? 1 : 0);
    }, [roles, variantes, original]);

    const passNoCoincide = pass.length > 0 && pass2.length > 0 && pass !== pass2;

    const alTope = () => {
        if (typeof window === 'undefined') return;
        window.scrollTo({ top: 0, behavior: menosMovimiento ? 'auto' : 'smooth' });
    };

    const abrirRoles = (abrir: boolean) => { setRolesAbierto(abrir); alTope(); };

    // ── Roles ─────────────────────────
    const quitarRol = (def: DefinicionRol) => {
        pedirConfirmacion({
            tipo: 'destructivo',
            titulo: `¿Quitarle ${def.nombre} a ${datos.nombre || 'esta persona'}?`,
            texto: 'Pierde el acceso en cuanto guardes. Si estaba trabajando con ese rol, deja de poder entrar a esa sección.',
            detalleTitulo: 'Qué deja de poder hacer',
            detalle: def.pierde,
            etiquetaBoton: 'Sí, quitarle el rol',
            onConfirmar: () => setRoles(prev => prev.filter(r => r !== def.rol)),
        });
    };

    const alternarRol = (def: DefinicionRol) => {
        if (tiene(def.rol)) { quitarRol(def); return; }

        if (def.nivel === 0) {
            pedirConfirmacion({
                tipo: 'control',
                titulo: `¿Darle control total del sistema a ${datos.nombre || 'esta persona'}?`,
                texto: `El rol ${def.nombre} permite cambiar los permisos de cualquier persona, incluidos los tuyos, y editar toda la configuración pública de la app.`,
                detalleTitulo: 'Qué va a poder hacer',
                detalle: 'Administrar usuarios y permisos, y editar la identidad, los banners y los pies que ve toda la iglesia.',
                etiquetaBoton: 'Sí, darle control total',
                onConfirmar: () => setRoles(prev => [...prev, def.rol]),
            });
            return;
        }

        setRoles(prev => [...prev, def.rol]);
    };

    const guardarDatos = async () => {
        if (!cambiosDatos || guardandoDatos) return;
        if (pass.length > 0 && pass !== pass2) return;
        setGuardandoDatos(true);
        const ok = creando
            ? await onCrear(datos, pass, roles, variantes, area)
            : await onGuardarDatos(datos, pass);
        setGuardandoDatos(false);
        if (ok) {
            setPass(''); setPass2(''); setPassAbierto(false); setDatosOk(true);
        }
    };

    const guardarRoles = async () => {
        if (guardandoRoles) return;
        setGuardandoRoles(true);
        await onGuardarRoles(roles, variantes, area);
        setGuardandoRoles(false);
    };

    const descartarDatos = () => {
        setDatos(original.datos);
        setPass(''); setPass2(''); setPassAbierto(false); setDatosOk(false);
    };

    const descartarRoles = () => {
        setRoles(original.roles);
        setVariantes(original.variantes);
    };

    // ── Estilos de la animación ───────
    const curva = 'cubic-bezier(.2,.8,.2,1)';
    const sinMovimiento = menosMovimiento;

    const estiloTrack: React.CSSProperties = dosPaneles
        ? { display: 'flex', gap: HUECO, justifyContent: 'center', alignItems: 'flex-start' }
        : {
            display: 'flex',
            alignItems: 'flex-start',
            width: '200%',
            transform: `translateX(${rolesAbierto ? '-50%' : '0'})`,
            transition: sinMovimiento ? 'none' : `transform .38s ${curva}`,
        };

    // El panel que no se está mirando se colapsa con max-height además de con
    // el ancho. Sin eso, en escritorio el de roles seguía midiendo sus 2000px
    // de alto aunque tuviera ancho 0, y debajo de la ficha quedaba un hueco
    // gris del largo de la lista de permisos.
    //
    // El cambio de max-height es un salto, no una animación: se retrasa hasta
    // que termina el deslizamiento al cerrar, y se aplica de entrada al abrir.
    // Va a `none` y no a un número grande a propósito — un tope en píxeles
    // cortaría la lista el día que crezca.
    const saltoAlto = (visible: boolean, demora: string) => ({
        maxHeight: visible ? 'none' : 0,
        transition: sinMovimiento ? 'none' : `max-height 0s linear ${demora}`,
    });

    const estiloDatos: React.CSSProperties = dosPaneles
        ? { width: ANCHO_DATOS, flex: 'none', display: 'flex', flexDirection: 'column', gap: 12 }
        : {
            width: '50%', flex: 'none', display: 'flex', flexDirection: 'column', gap: 12,
            paddingRight: 14, overflow: 'hidden',
            ...saltoAlto(!rolesAbierto, rolesAbierto ? '.38s' : '0s'),
        };

    const estiloRoles: React.CSSProperties = dosPaneles
        ? {
            flex: 'none', overflow: 'hidden',
            width: rolesAbierto ? anchoRoles : 0,
            opacity: rolesAbierto ? 1 : 0,
            transform: `translateX(${rolesAbierto ? '0' : '-10px'})`,
            maxHeight: rolesAbierto ? 'none' : 0,
            transition: sinMovimiento
                ? 'none'
                : `width .42s ${curva}, opacity .3s ease ${rolesAbierto ? '.12s' : '0s'}, transform .42s ${curva}, max-height 0s linear ${rolesAbierto ? '0s' : '.42s'}`,
        }
        : {
            width: '50%', flex: 'none', paddingLeft: 14, overflow: 'hidden',
            ...saltoAlto(rolesAbierto, rolesAbierto ? '0s' : '.38s'),
        };

    const estiloRolesInner: React.CSSProperties = {
        ...(dosPaneles ? { width: anchoRoles } : {}),
        display: 'flex', flexDirection: 'column', gap: 12,
    };

    // ── Resumen de acceso ─────────────
    const conAcceso = rolesConAcceso(roles);
    const sinRoles = conAcceso.length === 0;
    const nivel = nivelDe(roles);
    const resumen = sinRoles ? { resumen: 'Sin acceso', detalle: 'Puede iniciar sesión pero no ve ninguna sección. Asignale al menos un rol operativo.' } : NIVELES[nivel];

    const grupoVinculado = useMemo(() => {
        const id = usuario?.linkedGroupId;
        if (!id) return '';
        const sistemas: Record<string, string> = { PUNTO: 'Punto de Información', STORE: 'Tienda', GROUPS: 'Grupos de Conexión', ALABANZA: 'Alabanza' };
        if (sistemas[id]) return sistemas[id];
        return grupos.find(g => g.id === id)?.name || 'Grupo sin nombre';
    }, [usuario, grupos]);

    const fila = (etiqueta: string, valor: string) => (
        <div className="flex items-center justify-between gap-3 pt-2.5">
            <span className="flex-none text-[12.5px] font-medium text-black/[.6]">{etiqueta}</span>
            <span className="truncate text-right text-[12.5px] font-semibold text-[#0a0a0a]">{valor}</span>
        </div>
    );

    return (
        <>
            <button
                onClick={onVolver}
                className="flex h-9 items-center gap-[7px] rounded-full bg-white pl-[11px] pr-3.5 text-[12.5px] font-semibold text-black/[.64] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 6l-6 6 6 6" />
                </svg>
                Todos los usuarios
            </button>

            {/* El riel se sale del margen en el teléfono para que el panel que
                entra no aparezca cortado contra el borde. Va escrito al
                derecho (móvil primero) porque este proyecto carga Tailwind por
                CDN y ahí las variantes max-* no existen: la clase quedaría en
                el HTML sin hacer nada. */}
            <div ref={rielRef} className="-mx-3.5 mt-3 overflow-hidden px-3.5 md:mx-0 md:px-0">
                <div style={estiloTrack}>

                    {/* Datos de la cuenta */}
                    <div style={estiloDatos} aria-hidden={!dosPaneles && rolesAbierto}>
                        {!creando && (
                            <div className="rounded-[20px] bg-white px-5 py-[18px]">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 flex-none items-center justify-center overflow-hidden rounded-full bg-[#f2f2f0] text-[13.5px] font-semibold text-black/[.58]">
                                        {iniciales(usuario?.name || usuario?.email || '')}
                                        {usuario?.avatarUrl && (
                                            <img src={usuario.avatarUrl} alt="" className="absolute h-12 w-12 rounded-full object-cover" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[16px] font-semibold text-[#0a0a0a]">{usuario?.name || 'Sin nombre'}</p>
                                        <p className="mt-[3px] truncate text-[12.5px] font-medium text-black/[.6]">{usuario?.email}</p>
                                    </div>
                                </div>
                                <div className="mt-4 border-t border-[#f2f2f0] pt-1.5">
                                    {fila('Estado', usuario?.isActive ? 'Activa' : 'Inactiva')}
                                    {usuario?.phone ? fila('Teléfono', usuario.phone) : null}
                                    {usuario?.age ? fila('Edad', `${usuario.age} años`) : null}
                                    {usuario?.gender ? fila('Sexo', usuario.gender) : null}
                                    {usuario?.birthDate
                                        ? fila('Cumpleaños', new Date(`${usuario.birthDate}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' }))
                                        : null}
                                    {grupoVinculado ? fila('Grupo vinculado', grupoVinculado) : null}
                                </div>
                            </div>
                        )}

                        <div className="rounded-[20px] bg-white px-5 py-[18px]">
                            <Rotulo className="text-black/[.55]">Datos de la cuenta</Rotulo>
                            <p className="mt-2 text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                                Se guardan aparte de los roles: cambiar el nombre no toca los permisos.
                            </p>

                            <div className="mt-4 grid gap-2.5 [grid-template-columns:repeat(2,minmax(0,1fr))] md:[grid-template-columns:minmax(0,1fr)]">
                                <Campo etiqueta="Nombre" valor={datos.nombre} autoComplete="off"
                                    onChange={v => { setDatos(d => ({ ...d, nombre: v })); setDatosOk(false); }} />
                                <Campo etiqueta="Apellido" valor={datos.apellido} autoComplete="off"
                                    onChange={v => { setDatos(d => ({ ...d, apellido: v })); setDatosOk(false); }} />
                            </div>
                            <div className="mt-2.5">
                                <Campo
                                    etiqueta="Email" tipo="email" valor={datos.email} autoComplete="off"
                                    onChange={v => { setDatos(d => ({ ...d, email: v })); setDatosOk(false); }}
                                    ayuda="Es el usuario con el que inicia sesión. Si lo cambiás, tiene que entrar con el nuevo."
                                />
                            </div>

                            <div className="mt-4 border-t border-[#f2f2f0] pt-3.5">
                                {!passAbierto ? (
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="min-w-[130px] flex-1">
                                            <p className="text-[12.5px] font-semibold text-[#0a0a0a]">Contraseña</p>
                                            <p className="mt-1 text-[11.5px] font-medium text-black/[.6]">
                                                Solo se cambia desde acá; no se puede ver la actual.
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setPassAbierto(true)}
                                            className="h-10 flex-none rounded-full bg-[#f2f2f0] px-4 text-[12.5px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                        >
                                            Cambiarla
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-[12.5px] font-semibold text-[#0a0a0a]">
                                            {creando ? 'Contraseña' : 'Nueva contraseña'}
                                        </p>
                                        <p className="mt-1.5 text-[11.5px] font-medium leading-[1.5] text-black/[.62]">
                                            {creando
                                                ? 'Con esta contraseña va a entrar por primera vez. Pasásela por un canal privado.'
                                                : 'Le cierra la sesión en todos sus dispositivos. Avisale antes de guardar.'}
                                        </p>
                                        <div className="mt-2.5">
                                            <input
                                                type="password" value={pass} autoComplete="new-password"
                                                onChange={e => { setPass(e.target.value); setDatosOk(false); }}
                                                placeholder="Al menos 8 caracteres"
                                                className="h-[46px] w-full rounded-[14px] px-3.5 text-[13.5px] font-medium text-[#0a0a0a]"
                                            />
                                        </div>
                                        <div className="mt-2">
                                            <input
                                                type="password" value={pass2} autoComplete="new-password"
                                                onChange={e => { setPass2(e.target.value); setDatosOk(false); }}
                                                placeholder="Repetila"
                                                className="h-[46px] w-full rounded-[14px] px-3.5 text-[13.5px] font-medium text-[#0a0a0a]"
                                            />
                                        </div>
                                        {passNoCoincide && (
                                            <p className="mt-2 text-[11.5px] font-semibold text-[#a32218]">
                                                Las dos contraseñas no coinciden.
                                            </p>
                                        )}
                                        {!creando && (
                                            <button
                                                onClick={() => { setPassAbierto(false); setPass(''); setPass2(''); }}
                                                className="mt-2.5 h-10 rounded-full bg-[#f2f2f0] px-4 text-[12.5px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                            >
                                                Dejarla como está
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#f2f2f0] pt-3.5">
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12.5px] font-semibold text-[#0a0a0a]">Cuenta activa</p>
                                    <p className="mt-1 text-[11.5px] font-medium text-black/[.6]">
                                        Si la desactivás, no puede iniciar sesión.
                                    </p>
                                </div>
                                <button
                                    role="switch"
                                    aria-checked={datos.activo}
                                    aria-label="Cuenta activa"
                                    onClick={() => { setDatos(d => ({ ...d, activo: !d.activo })); setDatosOk(false); }}
                                    className={`relative h-7 w-12 flex-none rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${datos.activo ? 'bg-[#0a0a0a]' : 'bg-[#e4e2dd]'}`}
                                >
                                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${datos.activo ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>

                            <div className="mt-[18px] flex flex-wrap items-center gap-2.5">
                                <button
                                    onClick={guardarDatos}
                                    disabled={!cambiosDatos || guardandoDatos || passNoCoincide || (creando && !pass)}
                                    className={`h-12 rounded-full px-5 text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${cambiosDatos && !passNoCoincide && !(creando && !pass) ? 'bg-[#0a0a0a] text-white' : 'cursor-default bg-[#f2f2f0] text-black/[.45]'}`}
                                >
                                    {guardandoDatos ? 'Guardando…' : creando ? 'Crear la cuenta' : 'Guardar los datos'}
                                </button>
                                {cambiosDatos && !creando && (
                                    <button
                                        onClick={descartarDatos}
                                        className="h-12 rounded-full bg-[#f2f2f0] px-[18px] text-[14px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                    >
                                        Descartar
                                    </button>
                                )}
                                {datosOk && !cambiosDatos && (
                                    <span className="text-[12.5px] font-semibold text-[#0b7a53]">Datos guardados</span>
                                )}
                            </div>

                            {creando && (
                                <p className="mt-3 text-[11.5px] font-medium leading-[1.5] text-black/[.6]">
                                    Los roles que elijas en “Administrar roles” se guardan junto con la cuenta.
                                </p>
                            )}
                        </div>

                        {/* Acceso actual */}
                        <div className={`rounded-[20px] bg-white px-[18px] py-4 ${sinRoles ? 'shadow-[inset_0_0_0_1.5px_#f0d9b4]' : ''}`}>
                            <div className="flex flex-wrap items-baseline gap-2.5">
                                <Rotulo className="text-black/[.55]">Acceso actual</Rotulo>
                                <p className="text-[12.5px] font-semibold text-[#0a0a0a]">{resumen.resumen}</p>
                            </div>
                            <p className="mt-2 text-[12px] font-medium leading-[1.55] text-black/[.62]">{resumen.detalle}</p>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {sinRoles ? (
                                    <span className="text-[12.5px] font-medium text-black/[.6]">
                                        Sin ningún rol: no puede entrar a ninguna sección.
                                    </span>
                                ) : conAcceso.map(r => {
                                    const def = definicionDe(r);
                                    const fuerte = (def?.nivel ?? 4) <= 1;
                                    return (
                                        <button
                                            key={r}
                                            onClick={() => def && quitarRol(def)}
                                            disabled={!def}
                                            aria-label={`Quitar el rol ${nombreDeRol(r)}`}
                                            className={`flex h-[30px] items-center gap-[7px] rounded-full py-0 pl-3 pr-2 text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${fuerte ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.66]'} ${def ? '' : 'cursor-default opacity-70'}`}
                                        >
                                            {nombreDeRol(r)}
                                            {def && (
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                                                    <path d="M6 6l12 12M18 6L6 18" />
                                                </svg>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {variantes.length > 0 && (
                                <p className="mt-3 text-[12px] font-medium text-black/[.62]">
                                    Coordina {variantes.length === 1 ? 'la categoría' : 'las categorías'}{' '}
                                    <span className="font-semibold text-[#0a0a0a]">
                                        {variantes.map(v => v.replace(/_/g, ' ').toLowerCase()).join(', ')}
                                    </span>.
                                </p>
                            )}

                            {cantidadCambiosRoles > 0 && !creando && (
                                <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-[#f2f2f0] pt-3.5">
                                    <button
                                        onClick={guardarRoles}
                                        disabled={guardandoRoles}
                                        className="h-[42px] rounded-full bg-[#0a0a0a] px-[18px] text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                    >
                                        {guardandoRoles ? 'Guardando…' : 'Guardar los cambios'}
                                    </button>
                                    <button
                                        onClick={descartarRoles}
                                        className="h-[42px] rounded-full bg-[#f2f2f0] px-4 text-[13px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                    >
                                        Descartar
                                    </button>
                                    <span className="text-[12px] font-medium text-black/[.6]">
                                        {cantidadCambiosRoles === 1 ? '1 cambio sin guardar' : `${cantidadCambiosRoles} cambios sin guardar`}
                                    </span>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={() => abrirRoles(!rolesAbierto)}
                            className={`flex h-[52px] w-full items-center gap-2.5 rounded-full px-[18px] text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${rolesAbierto ? 'bg-[#f2f2f0] text-[#0a0a0a]' : 'bg-[#0a0a0a] text-white'}`}
                        >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                                <path d="M12 3.2l7.2 3.1v5c0 4.3-3 7.7-7.2 9.5-4.2-1.8-7.2-5.2-7.2-9.5v-5z" />
                                <path d="M9.2 12.2l2 2 3.6-4" />
                            </svg>
                            <span className="min-w-0 flex-1 text-left">
                                {rolesAbierto ? 'Ocultar la asignación de roles' : 'Administrar roles'}
                            </span>
                            <svg
                                width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"
                                className={`flex-none transition-transform duration-300 ${rolesAbierto && dosPaneles ? 'rotate-180' : ''}`}
                            >
                                <path d="M9 6l6 6-6 6" />
                            </svg>
                        </button>

                        {!creando && !rolesDe(usuario!).includes(UserRole.SUPER_ADMIN) && (
                            <button
                                onClick={onEliminar}
                                className="h-12 w-full rounded-full bg-[#fdecea] text-[13.5px] font-semibold text-[#a32218] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a32218] focus-visible:ring-offset-2"
                            >
                                Eliminar la cuenta
                            </button>
                        )}
                    </div>

                    {/* Asignación de roles */}
                    <div style={estiloRoles} aria-hidden={!rolesAbierto}>
                        <div style={estiloRolesInner}>
                            <div className="flex flex-wrap items-center gap-2.5">
                                <button
                                    onClick={() => abrirRoles(false)}
                                    className="flex h-[38px] flex-none items-center gap-1.5 rounded-full bg-white pl-[11px] pr-[15px] text-[12.5px] font-semibold text-black/[.64] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 6l-6 6 6 6" />
                                    </svg>
                                    {dosPaneles ? 'Volver a los datos' : 'Datos de la cuenta'}
                                </button>
                                <Rotulo className="text-black/[.55]">Asignación de roles</Rotulo>
                            </div>

                            {NIVELES.map((nivelDef, idx) => (
                                <TarjetaNivel
                                    key={nivelDef.titulo}
                                    indice={idx as NivelAcceso}
                                    definicion={nivelDef}
                                    roles={roles}
                                    abierto={!!nivelesAbiertos[idx]}
                                    onToggle={() => setNivelesAbiertos(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                    onAlternarRol={alternarRol}
                                    variantes={variantes}
                                    onAlternarVariante={v => setVariantes(prev =>
                                        prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
                                    area={area}
                                    onArea={setArea}
                                />
                            ))}

                            {cantidadCambiosRoles > 0 && !creando && (
                                <div className="sticky bottom-3 flex flex-wrap items-center gap-2 rounded-[20px] bg-[#0a0a0a] px-[18px] py-3.5">
                                    <span className="min-w-0 flex-1 text-[12.5px] font-medium text-white/70">
                                        {cantidadCambiosRoles === 1 ? '1 cambio sin guardar' : `${cantidadCambiosRoles} cambios sin guardar`}
                                    </span>
                                    <button
                                        onClick={descartarRoles}
                                        className="h-[42px] flex-none rounded-full bg-white/[.14] px-4 text-[13px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                    >
                                        Descartar
                                    </button>
                                    <button
                                        onClick={guardarRoles}
                                        disabled={guardandoRoles}
                                        className="h-[42px] flex-none rounded-full bg-white px-[18px] text-[13px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                                    >
                                        {guardandoRoles ? 'Guardando…' : 'Guardar los cambios'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
};

// ── Tarjeta de un nivel ───────────────

const TarjetaNivel: React.FC<{
    indice: NivelAcceso;
    definicion: { titulo: string; sub: string };
    roles: UserRole[];
    abierto: boolean;
    onToggle: () => void;
    onAlternarRol: (def: DefinicionRol) => void;
    variantes: CoordinatorVariant[];
    onAlternarVariante: (v: CoordinatorVariant) => void;
    area: AreaVoluntario;
    onArea: (a: AreaVoluntario) => void;
}> = ({ indice, definicion, roles, abierto, onToggle, onAlternarRol, variantes, onAlternarVariante, area, onArea }) => {
    const delNivel = CATALOGO_ROLES.filter(d => d.nivel === indice);
    const asignados = delNivel.filter(d => roles.includes(d.rol));
    const oscuro = indice === 0;
    const alto = indice <= 1;

    const areas = useMemo(() => {
        const mapa: { nombre: string; roles: DefinicionRol[] }[] = [];
        delNivel.forEach(d => {
            let a = mapa.find(x => x.nombre === d.area);
            if (!a) { a = { nombre: d.area, roles: [] }; mapa.push(a); }
            a.roles.push(d);
        });
        return mapa;
    }, [delNivel]);

    return (
        <div
            className={`rounded-[20px] px-5 py-[18px] ${oscuro ? 'bg-[#0a0a0a]' : 'bg-white'} ${indice === 1 ? 'shadow-[inset_0_0_0_1.5px_#e4e2dd]' : ''}`}
        >
            <button
                onClick={onToggle}
                aria-expanded={abierto}
                className="flex w-full items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0a0a0a]"
            >
                <span
                    className="w-1 flex-none self-stretch rounded-full"
                    style={{
                        minHeight: indice === 0 ? 44 : 38,
                        background: oscuro ? '#fff' : indice === 1 ? '#0a0a0a' : indice === 2 ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.16)',
                    }}
                />
                <span className="min-w-0 flex-1">
                    <span
                        className={`block font-semibold tracking-[-0.01em] ${oscuro ? 'text-white' : 'text-[#0a0a0a]'}`}
                        style={{ fontSize: indice === 0 ? 17 : indice === 1 ? 16 : 15 }}
                    >
                        {definicion.titulo}
                    </span>
                    <span className={`mt-1.5 block text-[12.5px] font-medium leading-[1.55] ${oscuro ? 'text-white/[.66]' : 'text-black/[.6]'}`}>
                        {definicion.sub}
                    </span>
                    {!abierto && (
                        <span
                            className={`mt-2 block text-[12px] font-semibold ${oscuro ? 'text-white/[.72]' : asignados.length ? 'text-[#0a0a0a]' : 'text-black/[.55]'}`}
                        >
                            {asignados.length
                                ? asignados.map(d => d.nombre).join(' · ')
                                : `Ningún rol de este nivel · ${delNivel.length} ${delNivel.length === 1 ? 'disponible' : 'disponibles'}`}
                        </span>
                    )}
                </span>
                <span
                    className={`flex h-6 min-w-[24px] flex-none items-center justify-center rounded-full px-2 text-[11.5px] font-semibold ${oscuro
                        ? asignados.length ? 'bg-white text-[#0a0a0a]' : 'bg-white/[.14] text-white/60'
                        : asignados.length ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.5]'}`}
                >
                    {asignados.length}
                </span>
                <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke={oscuro ? 'rgba(255,255,255,.6)' : 'rgba(0,0,0,.45)'}
                    strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round"
                    className={`mt-[3px] flex-none transition-transform duration-300 ${abierto ? 'rotate-180' : ''}`}
                >
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>

            {abierto && (
                <div className="mt-4 flex flex-col gap-3.5">
                    {areas.map(a => (
                        <div key={a.nombre}>
                            <Rotulo className={oscuro ? 'text-white/[.52]' : 'text-black/[.5]'}>{a.nombre}</Rotulo>
                            <div className="mt-2.5 flex flex-wrap gap-2">
                                {a.roles.map(def => {
                                    const on = roles.includes(def.rol);
                                    return (
                                        <button
                                            key={def.rol}
                                            onClick={() => onAlternarRol(def)}
                                            aria-pressed={on}
                                            className={`flex items-center gap-[9px] rounded-full font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${oscuro ? 'focus-visible:ring-white focus-visible:ring-offset-[#0a0a0a]' : 'focus-visible:ring-[#0a0a0a]'} ${on
                                                ? (oscuro ? 'bg-white text-[#0a0a0a]' : 'bg-[#0a0a0a] text-white')
                                                : (oscuro ? 'bg-white/[.10] text-white' : 'bg-[#f7f7f5] text-black/[.7]')}`}
                                            style={{ height: alto ? 48 : 42, paddingInline: alto ? 18 : 15, fontSize: alto ? 14 : 13 }}
                                        >
                                            <span
                                                className="flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full"
                                                style={{
                                                    background: on
                                                        ? (oscuro ? 'rgba(10,10,10,.12)' : 'rgba(255,255,255,.22)')
                                                        : (oscuro ? 'rgba(255,255,255,.14)' : '#e9e7e3'),
                                                    color: on ? 'currentColor' : 'transparent',
                                                }}
                                            >
                                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M5 12.5l4.5 4.5L19 6.5" />
                                                </svg>
                                            </span>
                                            {def.nombre}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Categorías que coordina — solo con el rol Coordinador puesto */}
                    {indice === 2 && roles.includes(UserRole.COORDINATOR) && (
                        <div className="rounded-[16px] bg-[#f7f7f5] px-4 py-3.5">
                            <Rotulo className="text-black/[.55]">
                                Categorías que coordina ({variantes.length})
                            </Rotulo>
                            <p className="mt-2 text-[12px] font-medium leading-[1.5] text-black/[.62]">
                                Solo ve los grupos de las categorías que elijas. Sin ninguna, su panel queda vacío.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {Object.values(CoordinatorVariant).map(v => {
                                    const on = variantes.includes(v);
                                    return (
                                        <button
                                            key={v}
                                            onClick={() => onAlternarVariante(v)}
                                            aria-pressed={on}
                                            className={`h-9 rounded-full px-3.5 text-[12.5px] font-semibold capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${on ? 'bg-[#0a0a0a] text-white' : 'bg-white text-black/[.66]'}`}
                                        >
                                            {v.replace(/_/g, ' ').toLowerCase()}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Área de un voluntario — el rol específico se agrega al guardar */}
                    {indice === 4 && roles.includes(UserRole.VOLUNTEER) && (
                        <div className="rounded-[16px] bg-[#f7f7f5] px-4 py-3.5">
                            <Rotulo className="text-black/[.55]">Área en la que sirve</Rotulo>
                            <p className="mt-2 text-[12px] font-medium leading-[1.5] text-black/[.62]">
                                Al guardar se le suma el rol de voluntario de esa área. Con “Ninguna” queda como
                                anfitrión de grupo.
                            </p>
                            <select
                                value={area}
                                onChange={e => onArea(e.target.value as AreaVoluntario)}
                                className="mt-3 h-[46px] w-full rounded-[14px] px-3.5 text-[13.5px] font-medium text-[#0a0a0a]"
                            >
                                {AREAS_VOLUNTARIO.map(a => (
                                    <option key={a.valor} value={a.valor}>{a.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FichaUsuarioAdmin;

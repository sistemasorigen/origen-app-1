import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../../services/dbService';
import { supabaseService } from '../../services/supabaseService';
import {
    getMusicaBannerSlides,
    createMusicaBannerSlide,
    updateMusicaBannerSlide,
    deleteMusicaBannerSlide,
    MusicaBannerSlideInput,
} from '../../services/supabaseService';
import {
    AppConfig, CoordinatorVariant, FooterLinks, Group, MusicaBannerSlide, User, UserRole,
} from '../../types';
import AdminAuditLogs from '../../components/admin/RegistroAuditoriaAdmin';
import { ClaveFiltro, nombreDeRol, rolesDe } from './catalogoRoles';
import { ModalConfirmacion, PedidoConfirmacion } from './piezasAdmin';
import UsuariosAdmin from './UsuariosAdmin';
import FichaUsuarioAdmin, { AreaVoluntario, DatosCuenta } from './FichaUsuarioAdmin';
import DirectorioAdmin from './DirectorioAdmin';
import ConfiguracionApp, { SubSeccion } from './ConfiguracionApp';

/**
 * Administración general (design-claude/Admin General).
 *
 * La cabecera separa dos mundos: las personas —usuarios y directorio— y el
 * sistema —configuración pública y registro de cambios—. Los dos ajustes de
 * sistema se entran poco y se salen, así que viven detrás del engranaje en
 * vez de ocupar una pestaña permanente.
 *
 * Todas las escrituras son las de siempre: adminCreateUser, updateUser,
 * deleteUser, saveAppConfig y la tabla del banner de música. Este archivo
 * solo cambia por dónde se llega a ellas.
 */

type Seccion = 'usuarios' | 'directorio' | 'config' | 'auditoria';

const safeUUID = () => {
    // Respaldo para contextos no seguros (http://IP), donde crypto.randomUUID
    // no existe.
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try { return crypto.randomUUID(); } catch { /* contexto no seguro */ }
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
};

/**
 * Roles que la columna `role` de la base acepta. Es un enum de Postgres que
 * quedó atrás del array `roles`, así que hay valores que solo pueden vivir
 * en el array. Sin este filtro, guardar un rol nuevo rompe la escritura
 * entera. Misma lista que antes del rediseño: no se toca sin migrar el enum.
 */
const ROLES_LEGACY_SEGUROS: UserRole[] = [
    UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.ADMIN_PUNTO, UserRole.ADMIN_GROUPS,
    UserRole.ADMIN_STORE, UserRole.ADMIN_ALABANZA, UserRole.ANFITRION, UserRole.CO_ANFITRION,
    UserRole.VIEWER, UserRole.VOLUNTARIO_INFO, UserRole.VOLUNTARIO_GRUPOS, UserRole.ENCARGADO_PUNTO,
    UserRole.ENCARGADO_GRUPOS, UserRole.VOLUNTEER, UserRole.VOLUNTARIO,
    UserRole.ADMIN_CUIDADO_PASTORAL, UserRole.INFLUOS, UserRole.PRODE, UserRole.EVENTOS,
    UserRole.ENCARGADO_EVENTOS, UserRole.ENCARGADO_NINEZ, UserRole.ACREDITACION,
];

/** El área de un voluntario suma su rol específico al guardar. */
const ROL_POR_AREA: Record<string, UserRole> = {
    PUNTO: UserRole.VOLUNTARIO_INFO,
    GROUPS_VOL: UserRole.VOLUNTARIO_GRUPOS,
    WELCOME: UserRole.VOLUNTARIO_BIENVENIDA,
    STORE: UserRole.VOLUNTEER,
    ALABANZA: UserRole.VOLUNTEER,
};

interface AdminProps {
    currentUser: User | null;
    onConfigUpdate?: () => void;
}

const Admin: React.FC<AdminProps> = ({ currentUser, onConfigUpdate }) => {
    const [searchParams, setSearchParams] = useSearchParams();

    const [seccion, setSeccion] = useState<Seccion>('usuarios');
    const [sub, setSub] = useState<SubSeccion>('identidad');
    const [menuSistema, setMenuSistema] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const [usuarios, setUsuarios] = useState<User[]>([]);
    const [grupos, setGrupos] = useState<Group[]>([]);
    const [cargando, setCargando] = useState(true);

    const [busqueda, setBusqueda] = useState('');
    const [filtro, setFiltro] = useState<ClaveFiltro>('todos');
    const [abierto, setAbierto] = useState<User | null>(null);
    const [creando, setCreando] = useState(false);

    const [config, setConfig] = useState<AppConfig>(db.getAppConfig());
    const [pies, setPies] = useState<FooterLinks>({ instagram: '', facebook: '', youtube: '', spotify: '' });
    const [musicaSlides, setMusicaSlides] = useState<MusicaBannerSlide[]>([]);
    const [guardandoMusica, setGuardandoMusica] = useState(false);

    const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);
    const [aviso, setAviso] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null);

    const avisar = useCallback((texto: string, tipo: 'ok' | 'error' = 'ok') => {
        setAviso({ texto, tipo });
        window.setTimeout(() => setAviso(null), 3500);
    }, []);

    // ── Enlaces profundos ─────────────
    // Se siguen entendiendo los nombres viejos (?tab=users|leaders|config|logs)
    // para que un favorito guardado no caiga en cualquier lado.
    useEffect(() => {
        const tab = searchParams.get('tab');
        const equivalencias: Record<string, Seccion> = {
            users: 'usuarios', usuarios: 'usuarios',
            leaders: 'directorio', directorio: 'directorio',
            config: 'config',
            logs: 'auditoria', auditoria: 'auditoria',
        };
        if (tab && equivalencias[tab]) setSeccion(equivalencias[tab]);
    }, [searchParams]);

    const irA = useCallback((destino: Seccion) => {
        setSeccion(destino);
        setMenuSistema(false);
        setAbierto(null);
        setCreando(false);
        const params = new URLSearchParams(searchParams);
        params.set('tab', destino);
        setSearchParams(params, { replace: true });
    }, [searchParams, setSearchParams]);

    // Cerrar el menú de sistema al tocar afuera.
    useEffect(() => {
        if (!menuSistema) return;
        const alTocar = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuSistema(false);
        };
        document.addEventListener('mousedown', alTocar);
        return () => document.removeEventListener('mousedown', alTocar);
    }, [menuSistema]);

    // ── Carga ─────────────────────────
    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const [dbUsuarios, dbGrupos, dbMusica, remoto] = await Promise.all([
                supabaseService.getAllUsers(),
                supabaseService.getGroups(),
                getMusicaBannerSlides(),
                supabaseService.getAppConfig(),
            ]);

            setUsuarios(dbUsuarios);
            setGrupos(dbGrupos);
            setMusicaSlides(dbMusica);

            if (remoto) {
                setConfig(remoto);
                setPies(remoto.footerLinks || { instagram: '', facebook: '', youtube: '', spotify: '' });
                db.saveAppConfig(remoto);
            } else {
                const local = db.getAppConfig();
                setConfig(local);
                setPies(local.footerLinks || { instagram: '', facebook: '', youtube: '', spotify: '' });
            }
        } catch (error) {
            console.error('[Admin] Error cargando datos:', error);
            avisar('No se pudieron cargar los datos. Probá recargar la página.', 'error');
        } finally {
            setCargando(false);
        }
    }, [avisar]);

    useEffect(() => { cargar(); }, [cargar]);

    // Mantiene abierta la ficha de la persona que se está editando cuando la
    // lista se vuelve a traer después de guardar.
    const refrescarUsuarios = useCallback(async (idAbierto?: string) => {
        const frescos = await supabaseService.getAllUsers();
        setUsuarios(frescos);
        if (idAbierto) {
            const actualizado = frescos.find(u => u.id === idAbierto);
            if (actualizado) setAbierto(actualizado);
        }
        return frescos;
    }, []);

    // ── Guardado de un usuario ────────
    /**
     * Arma el User completo y lo escribe. Es la misma lógica que tenía
     * handleSaveUser: rol legacy elegido entre los seguros, el rol específico
     * del área de voluntariado, y las categorías del coordinador solo si
     * conserva ese rol.
     */
    const escribirUsuario = async (
        base: User | null,
        datos: DatosCuenta,
        password: string,
        roles: UserRole[],
        variantes: CoordinatorVariant[],
        area: AreaVoluntario,
    ): Promise<boolean> => {
        const nombreCompleto = `${datos.nombre.trim()} ${datos.apellido.trim()}`.trim();

        if (!nombreCompleto || !datos.email.trim()) {
            avisar('Completá el nombre, el apellido y el email.', 'error');
            return false;
        }
        if (!base && !password) {
            avisar('Asignale una contraseña para que pueda entrar la primera vez.', 'error');
            return false;
        }

        const finales = [...roles];
        if (finales.length === 0) finales.push(UserRole.VIEWER);

        if (finales.includes(UserRole.VOLUNTEER) && area && area !== 'GROUPS') {
            const especifico = ROL_POR_AREA[area];
            if (especifico && !finales.includes(especifico)) finales.push(especifico);
        }

        const rolLegacy = finales.find(r => ROLES_LEGACY_SEGUROS.includes(r)) || UserRole.VIEWER;

        const usuario: User = {
            id: base?.id || safeUUID(),
            name: nombreCompleto,
            email: datos.email.trim(),
            role: rolLegacy,
            roles: finales,
            isActive: datos.activo,
            linkedGroupId: base?.linkedGroupId,
            volunteerRoles: base?.volunteerRoles || [],
            coordinatorVariants: finales.includes(UserRole.COORDINATOR) ? variantes : [],
            coordinatorVariant: finales.includes(UserRole.COORDINATOR) && variantes.length > 0
                ? variantes[0]
                : undefined,
        };

        const ok = base
            ? await supabaseService.updateUser(usuario, password || undefined)
            : !!(await supabaseService.adminCreateUser(usuario, password));

        if (!ok) {
            avisar(base ? 'No se pudo guardar. Probá de nuevo.' : 'No se pudo crear la cuenta.', 'error');
            return false;
        }

        const frescos = await refrescarUsuarios(base?.id);
        if (!base) {
            const nuevo = frescos.find(u => u.email.toLowerCase() === usuario.email.toLowerCase());
            setCreando(false);
            setAbierto(nuevo || null);
        }
        return true;
    };

    const eliminarUsuario = (u: User) => {
        setConfirmacion({
            tipo: 'destructivo',
            titulo: `¿Eliminar la cuenta de ${(u.name || '').split(' ')[0] || 'esta persona'}?`,
            texto: 'Se borra la cuenta y deja de poder iniciar sesión. No se puede deshacer desde acá.',
            detalleTitulo: 'Qué se borra',
            detalle: `${u.name || 'Sin nombre'} · ${u.email}${rolesDe(u).length ? ` · ${rolesDe(u).map(nombreDeRol).join(', ')}` : ''}`,
            etiquetaBoton: 'Sí, eliminar la cuenta',
            onConfirmar: async () => {
                setConfirmacion(null);
                const ok = await supabaseService.deleteUser(u.id);
                if (ok) {
                    await refrescarUsuarios();
                    setAbierto(null);
                    avisar('Cuenta eliminada.');
                } else {
                    avisar('No se pudo eliminar la cuenta.', 'error');
                }
            },
        });
    };

    // ── Guardado de configuración ─────
    const guardarConfig = async (nuevo: AppConfig) => {
        setConfig(nuevo);
        db.saveAppConfig(nuevo);
        const ok = await supabaseService.saveAppConfig(nuevo);
        if (ok) {
            avisar('Configuración guardada.');
            onConfigUpdate?.();
        } else {
            avisar('No se pudo guardar en la nube.', 'error');
        }
    };

    const guardarPies = async () => {
        const actualizado = db.saveFooterLinks(pies);
        const ok = await supabaseService.saveAppConfig(actualizado);
        if (ok) {
            setConfig(actualizado);
            avisar('Enlaces del pie actualizados.');
            onConfigUpdate?.();
        } else {
            avisar('No se pudo guardar en la nube.', 'error');
        }
    };

    const guardarMusica = async (input: MusicaBannerSlideInput, id?: string): Promise<boolean> => {
        setGuardandoMusica(true);
        try {
            if (id) await updateMusicaBannerSlide(id, input);
            else await createMusicaBannerSlide(input);
            setMusicaSlides(await getMusicaBannerSlides());
            avisar('Slide de música guardado.');
            return true;
        } catch (error) {
            console.error('[Admin] Error guardando slide de música:', error);
            avisar('No se pudo guardar el slide.', 'error');
            return false;
        } finally {
            setGuardandoMusica(false);
        }
    };

    const borrarMusica = async (id: string) => {
        await deleteMusicaBannerSlide(id);
        setMusicaSlides(prev => prev.filter(s => s.id !== id));
        avisar('Slide de música borrado.');
    };

    // ── Cabecera ──────────────────────
    const enPersonas = seccion === 'usuarios' || seccion === 'directorio';
    const enSistema = seccion === 'config' || seccion === 'auditoria';

    const titulo = seccion === 'usuarios'
        ? (creando ? 'Nueva cuenta' : abierto ? `Roles de ${(abierto.name || '').split(' ')[0] || 'la cuenta'}` : 'Usuarios y permisos')
        : seccion === 'directorio' ? 'Directorio de responsables'
            : seccion === 'auditoria' ? 'Registro de cambios'
                : 'Configuración de la app';

    const botonNav = (activo: boolean) =>
        `flex h-[38px] flex-none items-center gap-[7px] rounded-full px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 md:h-10 md:px-4 md:text-[13.5px] ${activo ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.62] hover:text-[#0a0a0a]'}`;

    return (
        <div id="admin-general" className="min-h-screen bg-[#f6f6f4]">

            {aviso && (
                <div
                    role="status"
                    className={`fixed left-1/2 top-20 z-[130] -translate-x-1/2 rounded-full px-5 py-3 text-[13px] font-semibold shadow-[0_10px_30px_rgba(0,0,0,.18)] ${aviso.tipo === 'ok' ? 'bg-[#0a0a0a] text-white' : 'bg-[#a32218] text-white'}`}
                >
                    {aviso.texto}
                </div>
            )}

            <header className="border-b border-[#ecebe8] bg-white">
                <div className="mx-auto max-w-[1360px] px-3.5 pt-4 md:px-[26px] md:pt-[18px]">
                    <div className="flex items-start gap-3.5">
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.52]">
                                Administración general
                            </p>
                            <h1 className="mt-[5px] text-[19px] font-semibold tracking-[-0.018em] text-[#0a0a0a] md:text-[21px]">
                                {titulo}
                            </h1>
                        </div>

                        <div className="relative flex-none" ref={menuRef}>
                            <button
                                onClick={() => setMenuSistema(v => !v)}
                                aria-expanded={menuSistema}
                                className={`flex h-[38px] items-center gap-[7px] rounded-full px-3 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 md:px-3.5 ${menuSistema || enSistema ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.66]'}`}
                            >
                                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="3.1" />
                                    <path d="M19.4 14.6l1.5 1.2-1.8 3.1-1.8-.7a7.6 7.6 0 01-2.6 1.5l-.3 2.3h-3.6l-.3-2.3a7.6 7.6 0 01-2.6-1.5l-1.8.7-1.8-3.1 1.5-1.2a7.6 7.6 0 010-3l-1.5-1.2 1.8-3.1 1.8.7a7.6 7.6 0 012.6-1.5l.3-2.3h3.6l.3 2.3a7.6 7.6 0 012.6 1.5l1.8-.7 1.8 3.1-1.5 1.2a7.6 7.6 0 010 3z" />
                                </svg>
                                <span className="hidden md:inline">Sistema</span>
                                <svg
                                    width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
                                    className={`transition-transform duration-200 ${menuSistema ? 'rotate-180' : ''}`}
                                >
                                    <path d="M6 9l6 6 6-6" />
                                </svg>
                            </button>

                            {menuSistema && (
                                <div className="absolute right-0 top-[46px] z-[40] w-[286px] rounded-[20px] bg-[#0a0a0a] p-3.5 shadow-[0_14px_40px_rgba(0,0,0,.28)] md:w-[320px]">
                                    <p className="mx-1 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-white/50">
                                        Administración del sistema
                                    </p>
                                    <button
                                        onClick={() => irA('config')}
                                        className={`mb-[7px] w-full rounded-[16px] px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${seccion === 'config' ? 'bg-white/[.16]' : 'bg-white/[.07] hover:bg-white/[.12]'}`}
                                    >
                                        <span className="block text-[14px] font-semibold text-white">Configuración de la app</span>
                                        <span className="mt-1 block text-[12px] font-medium leading-[1.45] text-white/60">
                                            Identidad, banners, música y pies. Lo ve toda la iglesia.
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => irA('auditoria')}
                                        className={`w-full rounded-[16px] px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${seccion === 'auditoria' ? 'bg-white/[.16]' : 'bg-white/[.07] hover:bg-white/[.12]'}`}
                                    >
                                        <span className="block text-[14px] font-semibold text-white">Registro de cambios</span>
                                        <span className="mt-1 block text-[12px] font-medium leading-[1.45] text-white/60">
                                            Quién tocó qué y cuándo.
                                        </span>
                                    </button>
                                    <p className="mx-1 mb-0.5 mt-3 text-[11.5px] font-medium leading-[1.5] text-white/45">
                                        Dos ajustes que afectan a todo el sistema. Se entra poco y se sale.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Navegación */}
                    <div className="flex items-center gap-1.5 pb-4 pt-3.5 md:gap-2">
                        {enPersonas ? (
                            <>
                                <button onClick={() => irA('usuarios')} className={botonNav(seccion === 'usuarios')}>
                                    Usuarios
                                    <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${seccion === 'usuarios' ? 'bg-white/20 text-white' : 'bg-white text-black/[.55]'}`}>
                                        {usuarios.length}
                                    </span>
                                </button>
                                <button onClick={() => irA('directorio')} className={botonNav(seccion === 'directorio')}>
                                    Directorio
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => irA('usuarios')}
                                    className="flex h-[38px] flex-none items-center gap-1.5 rounded-full bg-white pl-[11px] pr-[15px] text-[12.5px] font-semibold text-black/[.64] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 md:h-10 md:text-[13.5px]"
                                >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M14 6l-6 6 6 6" />
                                    </svg>
                                    Personas
                                </button>
                                <span className="mx-0.5 h-[22px] w-px flex-none bg-[#e4e2dd] md:mx-1" />
                                <button onClick={() => irA('config')} className={botonNav(seccion === 'config')}>
                                    Configuración
                                </button>
                                <button onClick={() => irA('auditoria')} className={botonNav(seccion === 'auditoria')}>
                                    Auditoría
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <div className="mx-auto max-w-[1360px] px-3.5 pb-[26px] pt-3.5 md:px-[26px] md:pb-[30px] md:pt-[18px]">

                {seccion === 'usuarios' && !abierto && !creando && (
                    <UsuariosAdmin
                        usuarios={usuarios}
                        busqueda={busqueda}
                        onBusqueda={setBusqueda}
                        filtro={filtro}
                        onFiltro={setFiltro}
                        onAbrir={u => { setAbierto(u); window.scrollTo({ top: 0 }); }}
                        onNuevo={() => { setCreando(true); window.scrollTo({ top: 0 }); }}
                        cargando={cargando}
                    />
                )}

                {seccion === 'usuarios' && (abierto || creando) && (
                    <FichaUsuarioAdmin
                        key={abierto?.id || 'nueva'}
                        usuario={abierto}
                        grupos={grupos}
                        onVolver={() => { setAbierto(null); setCreando(false); }}
                        onGuardarDatos={async (datos, password) => {
                            if (!abierto) return false;
                            const ok = await escribirUsuario(abierto, datos, password, rolesDe(abierto), abierto.coordinatorVariants || [], 'GROUPS');
                            if (ok) avisar('Datos guardados.');
                            return ok;
                        }}
                        onGuardarRoles={async (roles, variantes, area) => {
                            if (!abierto) return false;
                            const partes = (abierto.name || '').trim().split(' ').filter(Boolean);
                            const datos: DatosCuenta = {
                                nombre: partes[0] || '',
                                apellido: partes.slice(1).join(' '),
                                email: abierto.email,
                                activo: abierto.isActive,
                            };
                            const ok = await escribirUsuario(abierto, datos, '', roles, variantes, area);
                            if (ok) avisar('Permisos actualizados.');
                            return ok;
                        }}
                        onCrear={async (datos, password, roles, variantes, area) => {
                            const ok = await escribirUsuario(null, datos, password, roles, variantes, area);
                            if (ok) avisar('Cuenta creada.');
                            return ok;
                        }}
                        onEliminar={() => abierto && eliminarUsuario(abierto)}
                        pedirConfirmacion={setConfirmacion}
                    />
                )}

                {seccion === 'directorio' && (
                    <DirectorioAdmin
                        usuarios={usuarios}
                        cargando={cargando}
                        onAbrir={u => { irA('usuarios'); setAbierto(u); window.scrollTo({ top: 0 }); }}
                    />
                )}

                {seccion === 'config' && (
                    <ConfiguracionApp
                        sub={sub}
                        onSub={setSub}
                        config={config}
                        onConfig={setConfig}
                        onGuardarConfig={guardarConfig}
                        onGuardarPies={guardarPies}
                        pies={pies}
                        onPies={setPies}
                        musicaSlides={musicaSlides}
                        onGuardarMusica={guardarMusica}
                        onBorrarMusica={borrarMusica}
                        guardandoMusica={guardandoMusica}
                        pedirConfirmacion={setConfirmacion}
                    />
                )}

                {seccion === 'auditoria' && <AdminAuditLogs />}
            </div>

            <ModalConfirmacion pedido={confirmacion} onCancelar={() => setConfirmacion(null)} />
        </div>
    );
};

export default Admin;

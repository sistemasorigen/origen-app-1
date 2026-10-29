import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
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
import BandejaDeDatos from './BandejaDeDatos';
import ReportesSistemas from './ReportesSistemas';
import DepartamentosAdmin from './DepartamentosAdmin';
import GestionNotificaciones from './notificaciones/GestionNotificaciones';
import { reportesSistemas } from '../../services/miCuenta';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';

/**
 * Administración general (design-claude/Admin General).
 *
 * La cabecera separa dos mundos: las personas —usuarios, directorio, reportes
 * y los departamentos de Agenda Origen— y el
 * sistema —configuración pública y registro de cambios—. Los dos ajustes de
 * sistema se entran poco y se salen, así que viven detrás del engranaje en
 * vez de ocupar una pestaña permanente.
 *
 * Todas las escrituras son las de siempre: adminCreateUser, updateUser,
 * deleteUser, saveAppConfig y la tabla del banner de música. Este archivo
 * solo cambia por dónde se llega a ellas.
 */

type Seccion = 'usuarios' | 'directorio' | 'config' | 'auditoria' | 'datos' | 'reportes' | 'departamentos' | 'notificaciones';

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
    const location = useLocation();
    const navigate = useNavigate();
    // /panel-admin/reportes es su propia ruta (el link del email y de la
    // notificación); el resto de las secciones siguen en /panel-admin?tab=.
    const enRutaDeReportes = location.pathname === '/panel-admin/reportes';

    const [seccion, setSeccion] = useState<Seccion>(enRutaDeReportes ? 'reportes' : 'usuarios');
    // La pastilla de "Reportes" en la navegación y el resumen de la cabecera.
    const [reportesNuevos, setReportesNuevos] = useState(0);
    const [reportesTotal, setReportesTotal] = useState<number | null>(null);
    const [sub, setSub] = useState<SubSeccion>('identidad');
    const [menuSistema, setMenuSistema] = useState(false);
    // Mobile: los dos selectores abren una hoja desde abajo con su grupo.
    const [hoja, setHoja] = useState<null | 'personas' | 'sistema'>(null);
    useBloqueoDeFondo(hoja !== null);
    useEffect(() => {
        if (!hoja) return;
        const alEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setHoja(null); };
        document.addEventListener('keydown', alEscape);
        return () => document.removeEventListener('keydown', alEscape);
    }, [hoja]);
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
            datos: 'datos',
            departamentos: 'departamentos',
            notificaciones: 'notificaciones',
        };
        if (enRutaDeReportes) setSeccion('reportes');
        else if (tab && equivalencias[tab]) setSeccion(equivalencias[tab]);
        else if (seccion === 'reportes') setSeccion('usuarios');
    }, [searchParams, enRutaDeReportes]); // eslint-disable-line react-hooks/exhaustive-deps

    // La pastilla de nuevos se ve desde cualquier sección.
    useEffect(() => {
        reportesSistemas().then(l => {
            if (!l) return;
            setReportesNuevos(l.filter(r => r.estado === 'nuevo').length);
            setReportesTotal(l.length);
        });
    }, []);

    const irA = useCallback((destino: Seccion) => {
        setSeccion(destino);
        setMenuSistema(false);
        setHoja(null);
        setAbierto(null);
        setCreando(false);
        if (destino === 'reportes') { navigate('/panel-admin/reportes'); return; }
        if (enRutaDeReportes) { navigate(`/panel-admin?tab=${destino}`); return; }
        const params = new URLSearchParams(searchParams);
        params.set('tab', destino);
        setSearchParams(params, { replace: true });
    }, [searchParams, setSearchParams, navigate, enRutaDeReportes]);

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
            // Este panel es el único lugar donde se corrige el sexo.
            gender: datos.sexo || base?.gender,
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
                // El cierre lo hace ModalConfirmacion.
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
    const enPersonas = seccion === 'usuarios' || seccion === 'directorio' || seccion === 'reportes' || seccion === 'departamentos';
    const enSistema = seccion === 'config' || seccion === 'auditoria' || seccion === 'notificaciones';
    // En el teléfono "Sistema" junta las tres: configuración, registro y datos.
    const enSistemaMovil = enSistema || seccion === 'datos';

    const NOMBRE: Record<Seccion, string> = {
        usuarios: 'Usuarios', directorio: 'Directorio', reportes: 'Reportes', departamentos: 'Departamentos',
        config: 'Configuración', auditoria: 'Registro de cambios', datos: 'Solicitudes de datos',
        notificaciones: 'Notificaciones',
    };
    const DETALLE: Partial<Record<Seccion, string>> = {
        usuarios: 'Cuentas, roles y permisos.',
        directorio: 'Quién es responsable de cada área.',
        reportes: 'Los problemas que reporta la gente.',
        departamentos: 'Las áreas que usan Agenda Origen.',
        config: 'Identidad, banners, música y pies. Lo ve toda la iglesia.',
        auditoria: 'Quién tocó qué y cuándo.',
        datos: 'Pedidos de acceso, corrección o baja (Ley 25.326).',
        notificaciones: 'Qué avisos manda la app, a quién y cuándo.',
    };
    const GRUPO: Record<'personas' | 'sistema', Seccion[]> = {
        personas: ['usuarios', 'directorio', 'reportes', 'departamentos'],
        sistema: ['config', 'auditoria', 'datos', 'notificaciones'],
    };

    const titulo = seccion === 'reportes' ? 'Reportes de problemas'
        : seccion === 'departamentos' ? 'Departamentos'
        : seccion === 'notificaciones' ? 'Gestión de notificaciones'
        : seccion === 'usuarios'
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
                                {seccion === 'reportes' ? 'Sistemas' : 'Administración general'}
                            </p>
                            <h1 className="mt-[5px] text-[19px] font-semibold tracking-[-0.018em] text-[#0a0a0a] md:text-[21px]">
                                {titulo}
                            </h1>
                            {seccion === 'reportes' && reportesTotal !== null && (
                                <p className="mt-1 text-[13.5px] font-medium text-black/[.56]">
                                    {reportesTotal === 0
                                        ? 'Sin reportes'
                                        : `${reportesNuevos} ${reportesNuevos === 1 ? 'nuevo' : 'nuevos'} · ${reportesTotal} en total`}
                                </p>
                            )}
                            {seccion === 'notificaciones' && (
                                <p className="mt-1 text-[13.5px] font-medium text-black/[.56]">{DETALLE.notificaciones}</p>
                            )}
                        </div>

                        <div className="relative hidden flex-none md:block" ref={menuRef}>
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
                                    <button
                                        onClick={() => irA('notificaciones')}
                                        className={`mt-[7px] w-full rounded-[16px] px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${seccion === 'notificaciones' ? 'bg-white/[.16]' : 'bg-white/[.07] hover:bg-white/[.12]'}`}
                                    >
                                        <span className="block text-[14px] font-semibold text-white">Gestión de notificaciones</span>
                                        <span className="mt-1 block text-[12px] font-medium leading-[1.45] text-white/60">
                                            Qué avisos manda la app, a quién y cuándo.
                                        </span>
                                    </button>
                                    <p className="mx-1 mb-0.5 mt-3 text-[11.5px] font-medium leading-[1.5] text-white/45">
                                        Ajustes que afectan a todo el sistema. Se entra poco y se sale.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Navegación — mobile: dos selectores del mismo tamaño, uno
                        abajo del otro (el patrón del Panel GCX). Fila de pastillas
                        no: en 390 px no entraban y empujaban la página de costado. */}
                    <div className="flex flex-col gap-2 pb-4 pt-3.5 md:hidden">
                        {([
                            {
                                grupo: 'personas' as const, activo: enPersonas,
                                texto: enPersonas ? NOMBRE[seccion] : 'Personas',
                                icono: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0111 0M16 5.6a3.2 3.2 0 010 5.8M17.5 13.6A5.5 5.5 0 0120.5 19" /></>,
                            },
                            {
                                grupo: 'sistema' as const, activo: enSistemaMovil,
                                texto: enSistemaMovil ? NOMBRE[seccion] : 'Configuración',
                                icono: <><circle cx="12" cy="12" r="3.1" /><path d="M19.4 14.6l1.5 1.2-1.8 3.1-1.8-.7a7.6 7.6 0 01-2.6 1.5l-.3 2.3h-3.6l-.3-2.3a7.6 7.6 0 01-2.6-1.5l-1.8.7-1.8-3.1 1.5-1.2a7.6 7.6 0 010-3l-1.5-1.2 1.8-3.1 1.8.7a7.6 7.6 0 012.6-1.5l.3-2.3h3.6l.3 2.3a7.6 7.6 0 012.6 1.5l1.8-.7 1.8 3.1-1.5 1.2a7.6 7.6 0 010 3z" /></>,
                            },
                        ]).map(b => (
                            <button
                                key={b.grupo}
                                type="button"
                                onClick={() => setHoja(b.grupo)}
                                aria-haspopup="dialog"
                                aria-expanded={hoja === b.grupo}
                                className={`flex h-[52px] w-full items-center gap-2.5 rounded-full pl-[18px] pr-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${b.activo ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-[#0a0a0a]'}`}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
                                    {b.icono}
                                </svg>
                                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{b.texto}</span>
                                {b.grupo === 'personas' && seccion === 'usuarios' && (
                                    <span className="flex h-[22px] items-center rounded-full bg-white/20 px-[9px] text-[12px] font-semibold">{usuarios.length}</span>
                                )}
                                {b.grupo === 'personas' && reportesNuevos > 0 && seccion !== 'reportes' && (
                                    <span aria-label={`${reportesNuevos} reportes nuevos`} className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#d93025] px-[7px] text-[12px] font-bold text-white">
                                        {reportesNuevos}
                                    </span>
                                )}
                                <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${b.activo ? 'bg-white/15' : 'bg-white'}`}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M6 9l6 6 6-6" />
                                    </svg>
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Navegación — compu */}
                    <div className="hidden items-center gap-2 pb-4 pt-3.5 md:flex">
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
                                {/* design-claude/Panel Admin - Reportes: el bicho y la
                                    pastilla roja de los nuevos, vista desde cualquier
                                    sección. */}
                                <button onClick={() => irA('reportes')} className={botonNav(seccion === 'reportes')}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <rect x="7" y="7" width="10" height="13" rx="5" /><path d="M9.5 7a2.5 2.5 0 015 0M12 11v9M7 12H3.5M20.5 12H17M7.5 17l-3 2M16.5 17l3 2M7.5 9l-3-2M16.5 9l3-2" />
                                    </svg>
                                    Reportes
                                    {reportesNuevos > 0 && (
                                        <span aria-label={`${reportesNuevos} nuevos`} className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#d93025] px-[7px] text-[12px] font-bold text-white">
                                            {reportesNuevos}
                                        </span>
                                    )}
                                </button>
                                {/* design-claude/Sistemas - Departamentos: la grilla
                                    de cuatro cuadrados, el ícono del diseño. */}
                                <button onClick={() => irA('departamentos')} className={botonNav(seccion === 'departamentos')}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z" />
                                    </svg>
                                    Departamentos
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
                                <button onClick={() => irA('datos')} className={botonNav(seccion === 'datos')}>
                                    Solicitudes de datos
                                </button>
                                <button onClick={() => irA('notificaciones')} className={botonNav(seccion === 'notificaciones')}>
                                    Notificaciones
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Hoja de secciones — mobile */}
            {hoja && (
                <div className="fixed inset-0 z-[120] md:hidden">
                    <div className="absolute inset-0 bg-[rgba(10,10,10,.42)]" onClick={() => setHoja(null)} />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label={hoja === 'personas' ? 'Personas' : 'Sistema'}
                        className="absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-auto rounded-t-[28px] bg-white px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-2.5"
                    >
                        <span aria-hidden="true" className="mx-auto mb-4 block h-[5px] w-10 rounded-full bg-black/[.14]" />
                        <p className="mx-1.5 mb-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58]">
                            {hoja === 'personas' ? 'Personas' : 'Sistema'}
                        </p>
                        {GRUPO[hoja].map(id => {
                            const activa = seccion === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => irA(id)}
                                    aria-current={activa ? 'page' : undefined}
                                    className={`mb-[7px] flex min-h-[60px] w-full items-center gap-2.5 rounded-2xl px-[18px] py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${activa ? 'bg-[#0a0a0a] text-white' : 'bg-[#f7f7f5] text-[#0a0a0a]'}`}
                                >
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-[15px] font-semibold">{NOMBRE[id]}</span>
                                        {DETALLE[id] && (
                                            <span className={`mt-0.5 block text-[12.5px] font-medium leading-[1.4] ${activa ? 'text-white/65' : 'text-black/[.55]'}`}>{DETALLE[id]}</span>
                                        )}
                                    </span>
                                    {id === 'usuarios' && (
                                        <span className={`flex h-[22px] flex-none items-center rounded-full px-[9px] text-[11.5px] font-semibold ${activa ? 'bg-white/20 text-white' : 'bg-[#eceae6] text-black/[.62]'}`}>
                                            {usuarios.length}
                                        </span>
                                    )}
                                    {id === 'reportes' && reportesNuevos > 0 && (
                                        <span aria-label={`${reportesNuevos} nuevos`} className="flex h-[22px] min-w-[22px] flex-none items-center justify-center rounded-full bg-[#d93025] px-[7px] text-[12px] font-bold text-white">
                                            {reportesNuevos}
                                        </span>
                                    )}
                                    {activa && (
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none">
                                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="mx-auto max-w-[1360px] px-3.5 pb-[26px] pt-3.5 md:px-[26px] md:pb-[30px] md:pt-[18px]">

                {seccion === 'datos' && <BandejaDeDatos userId={currentUser?.id} />}

                {seccion === 'reportes' && (
                    <ReportesSistemas
                        miNombre={(currentUser?.name || '').trim().split(/\s+/)[0] || 'Sistemas'}
                        onResumen={(n, t) => { setReportesNuevos(n); setReportesTotal(t); }}
                    />
                )}

                {seccion === 'departamentos' && (
                    <DepartamentosAdmin miId={currentUser?.id} avisar={avisar} />
                )}

                {seccion === 'notificaciones' && <GestionNotificaciones avisar={avisar} />}

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
                            // El sexo viaja con lo que ya tenía: guardar permisos no
                            // puede borrar un dato que esta pantalla no está tocando.
                            const datos: DatosCuenta = {
                                nombre: partes[0] || '',
                                apellido: partes.slice(1).join(' '),
                                email: abierto.email,
                                activo: abierto.isActive,
                                sexo: abierto.gender || '',
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
                        avisar={avisar}
                    />
                )}

                {seccion === 'auditoria' && <AdminAuditLogs />}
            </div>

            <ModalConfirmacion pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
        </div>
    );
};

export default Admin;

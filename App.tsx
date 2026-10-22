
import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/layout/Estructura';
import ErrorBoundary from './components/ui/LimiteError';
import Dashboard from './pages/home/Home';
import InfoPoint from './pages/primarias/PuntoInformacion';
import PaginaNuevoBautismo from './pages/punto-informacion/PaginaNuevoBautismo';
import PaginaNuevoPrestamo from './pages/punto-informacion/PaginaNuevoPrestamo';
import PaginaNuevaPresentacion from './pages/punto-informacion/PaginaNuevaPresentacion';
import PaginaNuevoMovimiento from './pages/punto-informacion/PaginaNuevoMovimiento';
import PaginaMovimientosVarios from './pages/punto-informacion/PaginaMovimientosVarios';
import PaginaReportarStock from './pages/punto-informacion/PaginaReportarStock';
import Groups from './pages/groups/Grupos';
import Admin from './pages/admin/Administrador';
import AuthScreen from './pages/auth/PantallaAutenticacion';
import Store from './pages/primarias/Tienda';
import Alabanza from './pages/primarias/Alabanza';
import Pastores from './pages/audiencia/Pastores';
import ReportesGCX from './pages/reportes/ReportesGCX';
import ReportesPuntoInfo from './pages/reportes/ReportesPuntoInfo';
import ReportesPuntoInfoBautismos from './pages/reportes/ReportesPuntoInfoBautismos';
import ReportesPuntoInfoNovedades from './pages/reportes/ReportesPuntoInfoNovedades';
import ReportesPuntoInfoPresentaciones from './pages/reportes/ReportesPuntoInfoPresentaciones';
import DetalleGrupoReporte from './pages/reportes/DetalleGrupoReporte';
import CompararTemporadas from './pages/reportes/CompararTemporadas';
import HostDashboard from './pages/groups/PanelAnfitrion';
import DetalleGrupoAnfitrion from './pages/groups/DetalleGrupoAnfitrion';
import PaginaAsistenciaGrupo from './pages/groups/PaginaAsistenciaGrupo';
import PaginaBajaGrupo from './pages/groups/PaginaBajaGrupo';
import PaginaDerivarMiembro from './pages/groups/PaginaDerivarMiembro';
import PaginaSolicitudesGrupo from './pages/groups/PaginaSolicitudesGrupo';
import PaginaInscriptosGrupo from './pages/groups/PaginaInscriptosGrupo';
import PaginaTransferirGrupo from './pages/groups/PaginaTransferirGrupo';
import PaginaCrearGrupo from './pages/groups/PaginaCrearGrupo';
import PaginaEditarGrupo from './pages/groups/PaginaEditarGrupo';
import PaginaReabrirGrupo from './pages/groups/PaginaReabrirGrupo';
import PaginaInscribirParticipante from './pages/groups/PaginaInscribirParticipante';
import UpdatePassword from './pages/auth/ActualizarContrasena';
import VerifyEmail from './pages/auth/VerificarEmail';
import Bienvenida from './pages/bienvenida/Bienvenida';
import DetalleIngresante from './pages/bienvenida/DetalleIngresante';
import NuevoIngresante from './pages/bienvenida/NuevoIngresante';
import InfluosPage from './pages/influos/InfluosPagina';
import InfluosAcceso from './pages/influos/InfluosAcceso';
import Formulario from './pages/bienvenida/Formulario';
// Tutoriales desactivado — ver la ruta /tutoriales más abajo. El archivo
// pages/user/PaginaTutoriales.tsx sigue en el repo, sin importar.
// import TutorialsPage from './pages/user/PaginaTutoriales';
import Coordinators from './pages/coordinadores/Coordinadores';
import PastoralCareForm from './pages/audiencia/AudienciaServiciosFormulario';
import Notifications from './pages/user/Notificaciones';
import PastoralCareDashboard from './pages/audiencia/AudienciaServiciosPrincipal';
import AudienciaServicioDetalle from './pages/audiencia/AudienciaServicioDetalle';
import MiCuenta from './pages/user/MiCuenta';
import Prode from './pages/prode/Prode';
import AdminProde from './pages/prode/AdminProde';
import ProdeRanking from './pages/prode/ProdeRanking';
import ProdeResultados from './pages/prode/ProdeResultados';
import Eventos from './pages/eventos/Eventos';
import Ninez from './pages/ninez/Ninez';
import ConfiguracionNinez from './pages/ninez/admin/ConfiguracionNinez';
import PanelEventos from './pages/eventos/PanelEventos';
import InscripcionDPadre from './pages/eventos/dpadre/InscripcionDPadre';
import RankingDPadre from './pages/eventos/dpadre/RankingDPadre';
import InscripcionDiaNino from './pages/eventos/dianino/InscripcionDiaNino';
import InscripcionNocturna from './pages/eventos/nocturna/InscripcionNocturna';
import ChequearEntrada from './pages/eventos/nocturna/ChequearEntrada';
import CompraVoluntarios from './pages/voluntarios/CompraVoluntarios';
import InscripcionInfluosDia from './pages/eventos/influos/InscripcionInfluosDia';
import BuscarInfluosDia from './pages/eventos/influos/BuscarInfluosDia';
import AdminInfluosDia from './pages/eventos/influos/AdminInfluosDia';
import AdminEventosGeneral from './pages/eventos/general/AdminEventosGeneral';
import CrearEventoGeneral from './pages/eventos/general/CrearEventoGeneral';
import NuevaInfluosDia from './pages/eventos/influos/NuevaInfluosDia';
import BuscarDiaNino from './pages/eventos/dianino/BuscarDiaNino';
import AdminDiaNino from './pages/eventos/dianino/AdminDiaNino';
import AdminNocturna from './pages/eventos/nocturna/AdminNocturna';
import CrearInscripcionNocturna from './pages/eventos/nocturna/CrearInscripcionNocturna';
import AcreditarNocturna from './pages/eventos/nocturna/AcreditarNocturna';
import DetalleNocturna from './pages/eventos/nocturna/DetalleNocturna';
import ReportesNocturna from './pages/eventos/nocturna/ReportesNocturna';
import DetalleDiaNino from './pages/eventos/dianino/DetalleDiaNino';
import NuevaDiaNino from './pages/eventos/dianino/NuevaDiaNino';
import EscanerDiaNino from './pages/eventos/dianino/EscanerDiaNino';
import AcreditarEscaneoDiaNino from './pages/eventos/dianino/AcreditarEscaneoDiaNino';
import Puntuacion from './pages/eventos/dpadre/Puntuacion';
import AdminDPadre from './pages/eventos/dpadre/AdminDPadre';
import DetalleFamilia from './pages/eventos/dpadre/DetalleFamilia';
import CalendarioGCX from './pages/gcx/CalendarioGCX';
import GestionDeGrupos from './pages/admingcx/GestionDeGrupos';
import DetalleGrupoAdmin from './pages/admingcx/DetalleGrupoAdmin';
import BajasGrupos from './pages/admingcx/BajasGrupos';
import InscriptosGrupo from './pages/admingcx/InscriptosGrupo';
import AgregarMiembroGrupo from './pages/admingcx/AgregarMiembroGrupo';
import CrearGrupoAdmin from './pages/admingcx/CrearGrupoAdmin';
import EditarGrupoAdmin from './pages/admingcx/EditarGrupoAdmin';
import ReabrirGrupoAdmin from './pages/admingcx/ReabrirGrupoAdmin';
import GestionDeAnfitriones from './pages/admingcx/GestionDeAnfitriones';
import GestionDeCoordinadores from './pages/admingcx/GestionDeCoordinadores';
import Categorias from './pages/admingcx/Categorias';
import Etiquetas from './pages/admingcx/Etiquetas';
import Configuracion from './pages/admingcx/Configuracion';
import Temporadas from './pages/admingcx/Temporadas';
import AdminTrivia from './pages/trivia/AdminTrivia';
import CrearJuego from './pages/trivia/CrearJuego';
import TriviaLanding from './pages/trivia/TriviaLanding';
import TriviaUnirse from './pages/trivia/TriviaUnirse';
import TriviaJugador from './pages/trivia/TriviaJugador';
import TriviaProyector from './pages/trivia/TriviaProyector';
import TriviaControl from './pages/trivia/TriviaControl';
import TriviaHistorial from './pages/trivia/TriviaHistorial';
import TriviaPlanilla  from './pages/trivia/TriviaPlanilla';
import SystemLoginModal from './components/modals/ModalLoginSistema';
import CompleteProfileModal from './components/modals/ModalCompletarPerfil';
import AvisoConexion from './components/ui/AvisoConexion';
import PantallaCargaApp from './components/ui/PantallaCargaApp';
import { hayMediaPendiente, olvidarMedia, reservarMedia, suscribirMedia } from './src/utils/mediaDeEntrada';
import { User, UserRole, AppConfig } from './types';
import { db } from './services/dbService';
import SinAcceso, { guardarDestino } from './components/auth/SinAcceso';
import { supabaseService } from './services/supabaseService';
import { hasRole } from './services/authUtils';
import { AudioProvider } from './contexts/AudioContext';
import { ProveedorDeTema } from './contexts/TemaContext';
import { useVersionCheck } from './hooks/useVersionCheck';
import ModalActualizacion from './components/ui/ModalActualizacion';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ToastProvider } from './pages/punto-informacion/context/ContextoToast';
import { RefreshCw, AlertCircle } from 'lucide-react';

// Loading timeout constant
const LOADING_TIMEOUT = 15000; // 15 seconds

// Loading Screen Component with timeout handling
const LoadingScreen: React.FC<{
    onRetry: () => void;
    error?: string | null;
    showTimeout: boolean;
}> = ({ onRetry, error, showTimeout }) => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-black transition-colors">
            {!error && !showTimeout && (
                <>
                    <div className="w-10 h-10 border-4 border-black dark:border-white border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Cargando...</p>
                </>
            )}

            {(showTimeout || error) && (
                <div className="text-center p-8 max-w-md">
                    <div className="w-16 h-16 mx-auto mb-6 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                        {error ? 'Error de Conexión' : 'Carga Lenta'}
                    </h2>

                    <p className="text-slate-500 dark:text-slate-400 mb-6">
                        {error || 'La carga está tardando más de lo esperado. Esto puede deberse a una conexión lenta o un problema temporal.'}
                    </p>

                    <button
                        onClick={onRetry}
                        className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-black dark:bg-white text-white dark:text-black font-bold rounded-xl hover:opacity-90 transition-all"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Reintentar
                    </button>
                </div>
            )}
        </div>
    );
};

/**
 * ¿La primera pantalla de esta visita es el Inicio?
 *
 * Se lee del hash en el arranque, una sola vez, ANTES del primer dibujo:
 * HashRouter todavía no existe cuando esto corre. El Inicio siempre hace
 * esperar —la configuración y, con ella, el video del hero y el banner de
 * música— así que en ese caso el velo se pone de entrada y la pantalla se
 * arma detrás. En cualquier otra ruta el velo sigue decidiéndose como antes,
 * con los 220 ms de gracia: entrar a /form o a /nocturna-inscripcion no tiene
 * por qué pagar un velo que no hace falta.
 */
const entraAlInicio = (): boolean => {
    try {
        const ruta = window.location.hash.replace(/^#/, '').split('?')[0];
        return ruta === '' || ruta === '/';
    } catch {
        return false;
    }
};

// Y la reserva se toma acá, al importar el módulo: antes del primer render,
// no en un efecto.
//
// El Home reserva al montarse, pero los efectos corren DESPUÉS de pintar, y
// el cuadro del medio —el primero en el que el árbol ya está montado y nadie
// reservó nada todavía— se pinta con la barra en 100 y el texto del final.
// Un solo cuadro, pero el texto se funde en cada frase nueva, así que el
// parpadeo se ve.
//
// Es la misma llave que usa el Home ('inicio'), y reservar dos veces no hace
// nada: cuando el Home monta, la reserva ya está, y es él quien la libera
// —con los medios listos, o al irse de la pantalla—. Si el Home nunca llega a
// montarse, el tope de los 6 segundos la suelta igual.
if (entraAlInicio()) reservarMedia('inicio');

const AppContent: React.FC = () => {
    // Authentication State from Context (including isRecoveryMode)
    // Optimized: uses isInitialized for fast hydration check
    const {
        user,
        isLoadingSession, // Only block if we don't know the session yet
        isLoadingProfile, // Sigue en true hasta que llegan los roles
        error: authError,
        signIn,
        signOut,
        retryAuth,
        isRecoveryMode,
        needsProfileCompletion,
        completeProfile
    } = useAuth();

    // Hooks
    const navigate = useNavigate();
    const location = useLocation();

    // App Config
    const [config, setConfig] = useState<AppConfig>(db.getAppConfig());
    const [configLoading, setConfigLoading] = useState(false);

    // State
    const [showLoadingTimeout, setShowLoadingTimeout] = useState(false);
    const [isVolunteerModalOpen, setIsVolunteerModalOpen] = useState(false);

    // Derived/Constant (could be from config)
    const showVolunteerAccess = true;

    // Al cambiar de pantalla, arriba de todo.
    //
    // Va en useLayoutEffect y no en useEffect: el navegador conserva el scroll
    // entre rutas, así que la pantalla nueva nace a la altura a la que estaba
    // la anterior (recortada a su alto). Con un efecto común eso se alcanza a
    // pintar y recién después vuelve al tope: se ve el salto, y el evento de
    // scroll que dispara deja la navbar creyendo que estás scrolleado —gris
    // sobre el hero del inicio—. Antes de pintar, no hay salto ni evento.
    useLayoutEffect(() => {
        window.scrollTo(0, 0);
    }, [location.pathname]);

    // Redirigir post-login con Google usando el destino guardado en sessionStorage.
    // IMPORTANTE: no consumir el destino guardado mientras needsProfileCompletion
    // sea true — si lo hiciéramos apenas `user` está listo, el modal de completar
    // perfil (que reemplaza TODO el árbol de rutas, ver más abajo en este archivo)
    // taparía la navegación real y el destino se perdería sin una segunda
    // oportunidad. Se espera a que el perfil esté 100% completo antes de leer y
    // borrar sessionStorage.
    useEffect(() => {
        if (!user || needsProfileCompletion) return;
        const destino = sessionStorage.getItem('post_login_redirect');
        if (!destino) return;

        // Solo se borra/consume el destino guardado si realmente vamos a
        // navegar — si no estamos en una ruta "neutra", se deja intacto en
        // sessionStorage para la próxima vez que este efecto corra.
        if (location.pathname === '/auth' || location.pathname === '/') {
            sessionStorage.removeItem('post_login_redirect');
            navigate(destino);
        }
    }, [user, needsProfileCompletion, location.pathname]);

    // Effects
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isLoadingSession) {
            timer = setTimeout(() => {
                setShowLoadingTimeout(true);
            }, LOADING_TIMEOUT);
        } else {
            setShowLoadingTimeout(false);
        }
        return () => clearTimeout(timer);
    }, [isLoadingSession]);

    // Handlers
    const handleAuthScreenLogin = () => {
        const from = location.state?.from;
        sessionStorage.removeItem('post_login_redirect');
        if (from && from.pathname) {
            navigate(`${from.pathname}${from.search || ''}${from.hash || ''}`);
        } else {
            navigate('/');
        }
    };

    const onLogoutClick = async () => {
        await signOut();
    };

    const handleLogin = () => {
        // El mismo par de pasos que hace SinAcceso cuando no hay sesión:
        // el destino va por sessionStorage (sobrevive el recargado del login
        // con Google) y por state.from (el login con email).
        guardarDestino(location);
        navigate('/auth', { state: { from: location } });
    };

    const handleGlobalVolunteerLogin = async (email: string, pass: string) => {
        const { success } = await signIn(email, pass);
        if (success) {
            setIsVolunteerModalOpen(false);
        }
        return success;
    };

    const isSuperAdmin = (u: User | null) => {
        if (!u) return false;
        return u.role === UserRole.SUPER_ADMIN || u.roles?.includes(UserRole.SUPER_ADMIN);
    };

    const refreshConfig = () => {
        setConfig(db.getAppConfig());
    };

    // ── Entrada a la app ────────────────────────────────────────────────
    // Después de iniciar sesión hay dos esperas encadenadas: saber que hay
    // sesión y traer el perfil, que es lo que trae los roles. Hasta que los
    // roles no están, el menú deslizable y las rutas no saben qué mostrar, y
    // la pantalla se armaba a la vista: menú corto que después crecía,
    // tarjetas entrando de a una.
    //
    // Cuatro fases: se espera con el velo puesto, el árbol se monta DETRÁS
    // mientras la barra se completa, el velo se va y recién ahí se ve la app,
    // ya dibujada entera.
    const [faseEntrada, setFaseEntrada] = useState<'hidratando' | 'accesos' | 'saliendo' | 'lista'>('hidratando');
    // Quien cae en el Inicio entra con el velo ya puesto. Es el único caso que
    // se sabe antes de dibujar: el Inicio tarda siempre, y a quien llega por
    // primera vez le tarda más que a nadie —no tiene la configuración guardada
    // ni el video en el caché del navegador—. Si esto esperara los 220 ms de
    // gracia, el Inicio a medio armar alcanzaría a verse y recién después lo
    // taparía el velo: un parpadeo peor que no tener velo.
    const [veloVisible, setVeloVisible] = useState(entraAlInicio);
    // Los medios pesados de la pantalla que se está montando detrás. El Home
    // reserva al montarse y libera cuando el video del hero y el banner de
    // música ya se pueden ver; las demás pantallas no reservan nada y entran
    // sin esperar. Ver src/utils/mediaDeEntrada.ts.
    const [mediaLista, setMediaLista] = useState(!hayMediaPendiente());
    useEffect(() => {
        const revisar = () => setMediaLista(!hayMediaPendiente());
        revisar();
        return suscribirMedia(revisar);
    }, []);

    // El velo no aparece de inmediato: con la sesión en caché la app está
    // lista en decenas de milisegundos y sería un parpadeo.
    //
    // El temporizador sigue armado en 'accesos' mientras falten los medios:
    // con la sesión cacheada la autenticación termina enseguida y, si el velo
    // sólo se armara en 'hidratando', el video del hero volvería a entrar a
    // la vista — que es justo lo que esto viene a evitar.
    useEffect(() => {
        if (veloVisible) return;
        const esperando = faseEntrada === 'hidratando' || (faseEntrada === 'accesos' && !mediaLista);
        if (!esperando) return;
        const id = window.setTimeout(() => setVeloVisible(true), 220);
        return () => window.clearTimeout(id);
    }, [faseEntrada, veloVisible, mediaLista]);

    // Recién iniciada la sesión el velo vuelve a ponerse: es el caso que más
    // importa: se viene de /auth, donde no había usuario ni velo, y detrás
    // faltan justo los roles con los que el menú se arma.
    //
    // `faseEntrada === 'lista'` es lo que distingue ese caso del arranque. En
    // los dos el usuario aparece de la nada —uno porque se autenticó, el otro
    // porque se hidrató la sesión guardada— pero sólo en el primero la entrada
    // ya había terminado. Sin esta condición el arranque también reiniciaba, y
    // apagaba por un cuadro el velo que ya estaba puesto. Se lee de la
    // clausura a propósito: en el render donde `user.id` cambia, la fase es la
    // de ese momento, que es justo la que hay que mirar.
    const usuarioPrevio = useRef<string | null>(null);
    useEffect(() => {
        const id = user?.id ?? null;
        if (id && !usuarioPrevio.current && faseEntrada === 'lista') {
            setFaseEntrada('hidratando');
            setVeloVisible(false);
        }
        usuarioPrevio.current = id;
    }, [user?.id]);

    useEffect(() => {
        if (faseEntrada === 'saliendo' || faseEntrada === 'lista') return;
        // Antes, sin sesión se saltaba derecho a 'lista': "las pantallas
        // públicas entran sin velo". Pero eso dejaba afuera justo a quien
        // entra por primera vez —sin sesión que verificar, esto resolvía en
        // decenas de milisegundos— y al Inicio le queda lo más pesado por
        // delante: la configuración, el video del hero, el banner de música.
        // Resultado: la visita que más importa era la única que veía la
        // pantalla armándose sola.
        //
        // Ahora todos pasan por 'accesos' y quien decide es el registro de
        // medios: la pantalla que tiene algo pesado lo reserva y el velo la
        // espera; la que no reserva nada sigue entrando derecho, con o sin
        // sesión (ver el efecto de más abajo y src/utils/mediaDeEntrada.ts).
        if (isLoadingSession || isLoadingProfile) { setFaseEntrada('hidratando'); return; }
        setFaseEntrada('accesos');
    }, [isLoadingSession, isLoadingProfile, faseEntrada]);

    // Con los roles ya en la mano se monta el árbol detrás del velo y se le
    // da un respiro para que el menú y la ruta se dibujen antes de destapar.
    // Si la pantalla de atrás avisó que tiene medios pesados, se espera
    // también a esos: el velo se va con el hero ya dibujado, no con un
    // rectángulo negro esperando el video.
    useEffect(() => {
        // Se mira el registro en vivo además del estado. En el mismo commit en
        // que esta fase monta <Routes>, el Home se monta y reserva ANTES de que
        // corra este efecto —los efectos de los hijos van primero— pero el
        // `mediaLista` de este render todavía dice que no hay nada que esperar.
        // Sin esta lectura directa se programaría una salida que después hay
        // que cancelar.
        if (faseEntrada !== 'accesos' || !mediaLista || hayMediaPendiente()) return;
        // Antes, con "menos movimiento" se saltaba derecho a 'lista' y el velo
        // desaparecía de un cuadro al otro — un corte seco, peor que una
        // transición. Ahora pasa por 'saliendo' como todos: el velo se funde y
        // lo único que se apaga es el desplazamiento, que lo decide el CSS.
        if (!veloVisible) { setFaseEntrada('lista'); return; }
        const id = window.setTimeout(() => setFaseEntrada('saliendo'), 320);
        return () => window.clearTimeout(id);
    }, [faseEntrada, veloVisible, mediaLista]);

    // La app entra con la suya mientras el velo se va. Arranca junto con el
    // desvanecido —no después— para que sea un solo movimiento: el velo se
    // abre hacia adelante y la app sube a ocupar su lugar.
    //
    // La clase dura lo que dura la animación y se saca: lleva un `transform`,
    // y un transform permanente acá abajo rompería el position:fixed de la
    // navbar y de todos los modales de la app.
    const [animandoEntrada, setAnimandoEntrada] = useState(false);
    useEffect(() => {
        if (faseEntrada !== 'saliendo') return;
        setAnimandoEntrada(true);
    }, [faseEntrada]);

    // El reloj que la apaga cuelga de la bandera y NO de la fase. Colgado de
    // la fase se cancelaba solo: 'saliendo' dura 440 ms y la animación 560,
    // así que el paso a 'lista' limpiaba el timeout antes de tiempo y la
    // clase se quedaba puesta para siempre. No se notaba —la animación
    // termina en `transform: none`, que no rompe nada— pero alcanzaba con
    // que ese div se volviera a montar para que la app entrara de nuevo.
    useEffect(() => {
        if (!animandoEntrada) return;
        const id = window.setTimeout(() => setAnimandoEntrada(false), 1000);
        return () => window.clearTimeout(id);
    }, [animandoEntrada]);

    // El tope. Un video que no termina de bajar —o un servidor caído— no
    // puede dejar a nadie mirando la pantalla de carga: a los 6 segundos se
    // deja de esperar y la app se muestra igual, con el hero entrando cuando
    // pueda. Vale la pena esperar un video; no vale la pena quedarse afuera
    // de la app por uno.
    useEffect(() => {
        if (faseEntrada !== 'accesos' || mediaLista) return;
        const id = window.setTimeout(olvidarMedia, 6000);
        return () => window.clearTimeout(id);
    }, [faseEntrada, mediaLista]);

    const entrada = isLoadingSession
        ? { objetivo: 32, etapa: 'Verificando tu sesión…' }
        : isLoadingProfile
            ? { objetivo: 64, etapa: 'Trayendo tu perfil y tus permisos…' }
            : !mediaLista
                // La barra no llega al 100 mientras falte algo: un 100% que
                // se queda quieto se lee como colgado.
                ? { objetivo: 90, etapa: 'Cargando el inicio…' }
                // Sin sesión no hay accesos que preparar: a quien entra por
                // primera vez el velo ahora también lo acompaña, y no tiene
                // sentido contarle de permisos que no tiene.
                : user
                    ? { objetivo: 100, etapa: 'Preparando tus accesos…' }
                    : { objetivo: 100, etapa: 'Listo' };

    // La pantalla con el botón de reintentar se reserva para lo que de
    // verdad necesita una decisión: un error, o una espera que ya es
    // demasiada. La espera normal la cuenta la barra.
    if ((isLoadingSession && showLoadingTimeout) || (authError && !user)) {
        return (
            <LoadingScreen
                onRetry={retryAuth}
                error={authError}
                showTimeout={showLoadingTimeout}
            />
        );
    }

    // Show profile completion modal for OAuth users missing data
    // "Smart Session Hydration": Logic is deemed in AuthContext
    if (needsProfileCompletion && user) {
        return (
            <CompleteProfileModal
                userName={user?.name || 'Usuario'}
                onComplete={completeProfile}
            />
        );
    }

    return (
        <>
        {/* Banda de aviso cuando no se pudo hablar con la base. Va fuera de
            las rutas para que acompañe a la persona esté donde esté, y se
            saca sola cuando el reintento lo logra. */}
        <AvisoConexion />

        {/* El velo de entrada, encima de todo. Mientras está en
            'hidratando' el árbol ni se monta: no tiene con qué decidir. */}
        {faseEntrada !== 'lista' && veloVisible && (
            <PantallaCargaApp
                objetivo={entrada.objetivo}
                etapa={entrada.etapa}
                saliendo={faseEntrada === 'saliendo'}
                onSalida={() => setFaseEntrada('lista')}
            />
        )}

        {faseEntrada !== 'hidratando' && (
        <div className={animandoEntrada ? 'app-entrando' : undefined}>
        <Routes>
            {/* ── RUTAS SIN LAYOUT ────────────────── */}
            <Route
                path="/auth"
                element={
                    !user
                        ? <AuthScreen onLoginSuccess={handleAuthScreenLogin} />
                        : <Navigate to={
                            (location.state as { from?: { pathname: string; search: string } })?.from
                                ? `${(location.state as any).from.pathname}${(location.state as any).from.search || ''}`
                                : '/'
                          } />
                }
            />
            <Route path="/update-password" element={<UpdatePassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/form" element={<Formulario />} />
            <Route path="/dia-del-nino" element={<InscripcionDiaNino />} />
            {/* El escáner va FUERA del Layout, a diferencia del de Día del Niño.
                Es una pantalla de puerta: se usa de noche, de pie y con una
                mano. Adentro del Layout, la navbar y el aviso de notificaciones
                se comen un cuarto de la pantalla y empujan el visor de la
                cámara abajo del pliegue. El guard de roles es el mismo. */}
            <Route path="/panel-eventos/nocturna/acreditar" element={
                (user && hasRole(user, [
                    UserRole.SUPER_ADMIN,
                    UserRole.PASTOR,
                    UserRole.ENCARGADO_EVENTOS,
                    UserRole.ACREDITACION,
                ]))
                    ? <AcreditarNocturna currentUser={user} />
                    : <SinAcceso />
            } />
            {/* Con Layout aunque sea pública: la navbar de siempre arriba,
                pegajosa, con el logo centrado en su tamaño real.

                `sinNavegacion` la deja con el logo solo —sin menú, sin barra
                lateral, sin campana—: esto es un trámite de principio a fin y
                ofrecer una salida en medio de un formulario con datos de
                menores es invitar a abandonarlo. */}
            {/* Chequear la entrada. Publica y sin barra, como la inscripcion:
                se entra desde un link del email, muchas veces con el codigo
                puesto en la URL, y es un tramite de principio a fin. */}
            <Route path="/nocturna-entrada" element={
                <Layout
                    userRole={user?.role || null}
                    currentUser={user}
                    onLogout={onLogoutClick}
                    appConfig={config}
                    sinNavegacion
                >
                    <ChequearEntrada />
                </Layout>
            } />
            <Route path="/nocturna-inscripcion" element={
                <Layout
                    userRole={user?.role || null}
                    currentUser={user}
                    onLogout={onLogoutClick}
                    appConfig={config}
                    sinNavegacion
                >
                    <InscripcionNocturna />
                </Layout>
            } />
            {/* Comprar remeras y buzos del Punto. Es PUBLICA a proposito:
                sin sesion muestra su propia pantalla de entrada y manda al
                login con el destino puesto, en vez de rebotar a SinAcceso.
                No se mira el rol: compra cualquiera, no solo el que atiende
                el stand.

                `sinNavegacion` por lo mismo que Nocturna: es un tramite de
                principio a fin, con un comprobante de por medio, y ofrecer
                una salida en el medio es invitar a abandonarlo. */}
            <Route path="/voluntarios" element={
                <Layout
                    userRole={user?.role || null}
                    currentUser={user}
                    onLogout={onLogoutClick}
                    appConfig={config}
                    sinNavegacion
                >
                    <CompraVoluntarios />
                </Layout>
            } />
            <Route path="/tribal-wars" element={<InscripcionInfluosDia />} />
            <Route path="/tribal-wars/buscar" element={<BuscarInfluosDia />} />
            <Route path="/dia-del-nino/buscar" element={<BuscarDiaNino />} />
            <Route path="/influos-acceso" element={<InfluosAcceso />} />
            <Route path="/id-dpadre" element={<InscripcionDPadre />} />
            <Route path="/eventos/ranking-diadelpadre" element={<RankingDPadre />} />
            {/* Kahoot Origen — rutas públicas de jugadores y proyector */}
            <Route path="/trivia" element={<TriviaLanding />} />
            <Route path="/trivia/unirse/:pin" element={<TriviaUnirse />} />
            <Route path="/trivia/jugar/:pin" element={<TriviaJugador />} />
            <Route path="/trivia/pantalla/:pin" element={<TriviaProyector />} />

            {/* ── RUTAS PÚBLICAS CON LAYOUT ────────── */}
            <Route path="/" element={
                <Layout
                    userRole={user?.role || null}
                    currentUser={user}
                    onLogout={onLogoutClick}
                    appConfig={config}
                    onVolunteerClick={
                        user && showVolunteerAccess
                            ? () => setIsVolunteerModalOpen(true)
                            : undefined
                    }
                >
                    <SystemLoginModal
                        isOpen={isVolunteerModalOpen}
                        onClose={() => setIsVolunteerModalOpen(false)}
                        systemName="Acceso Voluntarios"
                        onLogin={handleGlobalVolunteerLogin}
                    />
                    <Dashboard
                        currentUser={user}
                        onLoginRequest={handleLogin}
                    />
                </Layout>
            } />

            <Route path="/gcx" element={
                <Layout
                    userRole={user?.role || null}
                    currentUser={user}
                    onLogout={onLogoutClick}
                    appConfig={config}
                    onVolunteerClick={
                        user && showVolunteerAccess
                            ? () => setIsVolunteerModalOpen(true)
                            : undefined
                    }
                >
                    <Groups
                        currentUser={user}
                        onLoginRequest={handleLogin}
                    />
                </Layout>
            } />

            <Route path="/eventos" element={
                <Layout
                    userRole={user?.role || null}
                    currentUser={user}
                    onLogout={onLogoutClick}
                    appConfig={config}
                    onVolunteerClick={
                        user && showVolunteerAccess
                            ? () => setIsVolunteerModalOpen(true)
                            : undefined
                    }
                >
                    <Eventos />
                </Layout>
            } />

            {/* Niñez es un módulo interno: ocultarlo del menú no alcanzaba,
                porque /ninez seguía abierta a cualquiera que tuviera el link.
                Mismos roles que el ítem del menú y que /admin-ninez/*. */}
            <Route path="/ninez" element={
                (user && hasRole(user, [
                    UserRole.SUPER_ADMIN,
                    UserRole.PASTOR,
                    UserRole.ENCARGADO_NINEZ,
                ]))
                    ? <Layout
                        userRole={user?.role || null}
                        currentUser={user}
                        onLogout={onLogoutClick}
                        appConfig={config}
                        onVolunteerClick={
                            user && showVolunteerAccess
                                ? () => setIsVolunteerModalOpen(true)
                                : undefined
                        }
                    >
                        <Ninez currentUser={user} />
                    </Layout>
                    : <SinAcceso />
            } />

            {/* ── RUTAS PROTEGIDAS CON LAYOUT ──────── */}
            <Route path="*" element={
                !user
                    // Al login, anotando a dónde quería entrar. Lo hace
                    // SinAcceso y no un <Navigate> suelto para que el destino
                    // salga por los dos caminos: el state de react-router (que
                    // sobrevive un reload porque vive en el history) y
                    // sessionStorage, que es el único que aguanta el login con
                    // Google, donde el navegador recarga en otra URL.
                    ? <SinAcceso />
                    : (
                        <Layout
                            userRole={user?.role || null}
                            currentUser={user}
                            onLogout={onLogoutClick}
                            appConfig={config}
                            onVolunteerClick={
                                showVolunteerAccess
                                    ? () => setIsVolunteerModalOpen(true)
                                    : undefined
                            }
                        >
                            <SystemLoginModal
                                isOpen={isVolunteerModalOpen}
                                onClose={() => setIsVolunteerModalOpen(false)}
                                systemName="Acceso Voluntarios"
                                onLogin={handleGlobalVolunteerLogin}
                            />
                            <Routes>
                                <Route path="/punto-de-informacion" element={<InfoPoint currentUser={user} />} />
                                <Route path="/punto-de-informacion/bautismos/nuevo" element={<PaginaNuevoBautismo />} />
                                <Route path="/punto-de-informacion/prestamos/nuevo" element={<PaginaNuevoPrestamo />} />
                                <Route path="/punto-de-informacion/presentacion-ninos/nuevo" element={<PaginaNuevaPresentacion />} />
                                <Route path="/punto-de-informacion/movimientos/nuevo" element={<PaginaNuevoMovimiento />} />
                                <Route path="/punto-de-informacion/movimientos/varios" element={<PaginaMovimientosVarios />} />
                                <Route path="/punto-de-informacion/reportar" element={<PaginaReportarStock />} />
                                <Route path="/panel-admin" element={
                                    isSuperAdmin(user)
                                        ? <Admin currentUser={user} onConfigUpdate={refreshConfig} />
                                        : <SinAcceso />
                                } />
                                <Route path="/store" element={<Store currentUser={user} />} />
                                <Route path="/alabanza" element={<Alabanza currentUser={user} onLoginRequest={handleLogin} />} />
                                <Route path="/reportes" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_PUNTO,
                                        UserRole.ADMIN_PUNTO,
                                        UserRole.ENCARGADO_GRUPOS,
                                        UserRole.REPORTES,
                                        UserRole.ADMIN_GROUPS
                                    ]))
                                        ? <Pastores currentUser={user} />
                                        : <SinAcceso />
                                } />
                                {/* Tablero nuevo de GCX. Convive con /reportes, que sigue
                                    siendo Pastores.tsx: mismo guard de 7 roles, copiado tal cual. */}
                                <Route path="/reportes/gcx" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_PUNTO,
                                        UserRole.ADMIN_PUNTO,
                                        UserRole.ENCARGADO_GRUPOS,
                                        UserRole.REPORTES,
                                        UserRole.ADMIN_GROUPS
                                    ]))
                                        ? <ReportesGCX currentUser={user} />
                                        : <SinAcceso />
                                } />
                                {/* ⚠️ ANTES de :groupId a propósito — si no, "comp-temp" se
                                    interpreta como un id de grupo. React Router 7 rankea los
                                    segmentos estáticos por encima de los dinámicos incluso si el
                                    dinámico está declarado primero, pero no vale la pena depender
                                    de ese detalle de implementación cuando dejarlo en el orden
                                    correcto sale gratis. */}
                                <Route path="/reportes/gcx/comp-temp" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_PUNTO,
                                        UserRole.ADMIN_PUNTO,
                                        UserRole.ENCARGADO_GRUPOS,
                                        UserRole.REPORTES,
                                        UserRole.ADMIN_GROUPS
                                    ]))
                                        ? <CompararTemporadas currentUser={user} />
                                        : <SinAcceso />
                                } />
                                {/* Tablero del Punto de Información. Convive con /reportes
                                    (Pastores.tsx), igual que el de GCX. Los cinco roles son
                                    los que miran este tablero: el Punto que lo carga, y
                                    PASTOR y REPORTES que lo leen. */}
                                <Route path="/reportes/puntoinfo" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ADMIN_PUNTO,
                                        UserRole.ENCARGADO_PUNTO,
                                        UserRole.REPORTES
                                    ]))
                                        ? <ReportesPuntoInfo />
                                        : <SinAcceso />
                                } />
                                {/* La lista completa de novedades. Los mismos roles
                                    que el tablero del que sale. */}
                                <Route path="/reportes/puntoinfo/novedades" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ADMIN_PUNTO,
                                        UserRole.ENCARGADO_PUNTO,
                                        UserRole.REPORTES
                                    ]))
                                        ? <ReportesPuntoInfoNovedades />
                                        : <SinAcceso />
                                } />
                                <Route path="/reportes/puntoinfo/bautismos-detalles" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ADMIN_PUNTO,
                                        UserRole.ENCARGADO_PUNTO,
                                        UserRole.REPORTES
                                    ]))
                                        ? <ReportesPuntoInfoBautismos />
                                        : <SinAcceso />
                                } />
                                <Route path="/reportes/puntoinfo/presentacion-detalles" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ADMIN_PUNTO,
                                        UserRole.ENCARGADO_PUNTO,
                                        UserRole.REPORTES
                                    ]))
                                        ? <ReportesPuntoInfoPresentaciones />
                                        : <SinAcceso />
                                } />
                                <Route path="/reportes/gcx/:groupId" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_PUNTO,
                                        UserRole.ADMIN_PUNTO,
                                        UserRole.ENCARGADO_GRUPOS,
                                        UserRole.REPORTES,
                                        UserRole.ADMIN_GROUPS
                                    ]))
                                        ? <DetalleGrupoReporte />
                                        : <SinAcceso />
                                } />
                                <Route path="/bienvenida" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ENCARGADO_BIENVENIDA,
                                        UserRole.VOLUNTARIO_BIENVENIDA
                                    ]))
                                        ? <Bienvenida />
                                        : <SinAcceso />
                                } />
                                <Route path="/bienvenida/v/:id" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ENCARGADO_BIENVENIDA,
                                        UserRole.VOLUNTARIO_BIENVENIDA
                                    ]))
                                        ? <DetalleIngresante />
                                        : <SinAcceso />
                                } />
                                <Route path="/bienvenida/nuevo" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ENCARGADO_BIENVENIDA,
                                        UserRole.VOLUNTARIO_BIENVENIDA
                                    ]))
                                        ? <NuevoIngresante />
                                        : <SinAcceso />
                                } />
                                <Route path="/influos" element={
                                    (user && hasRole(user, [
                                        UserRole.INFLUOS,
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR
                                    ]))
                                        ? <InfluosPage />
                                        : <SinAcceso />
                                } />
                                <Route path="/mis-grupos" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <HostDashboard currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/mis-grupos/crear-grupo" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaCrearGrupo currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/mis-grupos/:groupId" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <DetalleGrupoAnfitrion currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/mis-grupos/:groupId/asistencia" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaAsistenciaGrupo currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/mis-grupos/:groupId/bajas" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaBajaGrupo currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/mis-grupos/:groupId/derivar" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaDerivarMiembro currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/mis-grupos/:groupId/inscriptos" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaInscriptosGrupo currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/mis-grupos/:groupId/solicitudes" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaSolicitudesGrupo currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/mis-grupos/:groupId/transferir" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaTransferirGrupo currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/mis-grupos/:groupId/editar-grupo" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaEditarGrupo currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/mis-grupos/:groupId/reabrir-grupo" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaReabrirGrupo currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/mis-grupos/:groupId/inscribir" element={
                                    (user && hasRole(user, [
                                        UserRole.ANFITRION,
                                        UserRole.CO_ANFITRION,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.SUPER_ADMIN
                                    ]))
                                        ? <PaginaInscribirParticipante currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/gcx/calendario" element={
                                    user ? <CalendarioGCX currentUser={user} /> : <SinAcceso />
                                } />
                                <Route path="/admingcx/gestion-de-grupos" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <GestionDeGrupos />
                                        : <SinAcceso />
                                } />
                                <Route path="/admingcx/gestion-de-grupos/bajas" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <BajasGrupos />
                                        : <SinAcceso />
                                } />
                                <Route path="/admingcx/gestion-de-grupos/agregar-grupo" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <AgregarMiembroGrupo />
                                        : <SinAcceso />
                                } />
                                <Route path="/admingcx/gestion-de-grupos/crear-grupo" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <CrearGrupoAdmin />
                                        : <SinAcceso />
                                } />
                                <Route path="/admingcx/gestion-de-grupos/editar-grupo/:groupId" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <EditarGrupoAdmin />
                                        : <SinAcceso />
                                } />
                                <Route path="/admingcx/gestion-de-grupos/reabrir-grupo/:groupId" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <ReabrirGrupoAdmin />
                                        : <SinAcceso />
                                } />
                                <Route path="/admingcx/gestion-de-grupos/inscriptos/:groupId" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <InscriptosGrupo />
                                        : <SinAcceso />
                                } />
                                <Route path="/admingcx/gestion-de-grupos/detalles/:groupId" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <DetalleGrupoAdmin />
                                        : <SinAcceso />
                                } />
                                <Route path="/admingcx/gestion-de-anfitriones" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                        UserRole.ENCARGADO_GRUPOS,
                                    ]))
                                        ? <GestionDeAnfitriones />
                                        : <SinAcceso />
                                } />
                                <Route path="/admingcx/gestion-de-coordinadores" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                    ]))
                                        ? <GestionDeCoordinadores />
                                        : <SinAcceso />
                                } />
                                <Route path="/admingcx/categorias" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                    ]))
                                        ? <Categorias />
                                        : <SinAcceso />
                                } />
                                <Route path="/admingcx/etiquetas" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                    ]))
                                        ? <Etiquetas />
                                        : <SinAcceso />
                                } />
                                <Route path="/admingcx/configuracion" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                    ]))
                                        ? <Configuracion />
                                        : <SinAcceso />
                                } />
                                <Route path="/admingcx/temporadas" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ADMIN_GROUPS,
                                    ]))
                                        ? <Temporadas />
                                        : <SinAcceso />
                                } />
                                <Route path="/coordinators" element={
                                    (user && hasRole(user, [UserRole.COORDINATOR, UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS]))
                                        ? <Coordinators currentUser={user} />
                                        : <SinAcceso />
                                } />
                                {/* Tutoriales desactivado. La ruta se mantiene y redirige a
                                    inicio en vez de borrarse, para que un link viejo o un
                                    favorito no caiga en la nada. Para reponerlo: volver a
                                    <TutorialsPage /> acá y descomentar la entrada del menú
                                    en components/layout/MenuDeslizable.tsx. */}
                                <Route path="/tutoriales" element={<Navigate to="/" replace />} />
                                <Route path="/audiencia-servicios" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ADMIN_CUIDADO_PASTORAL
                                    ]))
                                        ? <PastoralCareDashboard currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/audiencia-servicios/new" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ADMIN_CUIDADO_PASTORAL
                                    ]))
                                        ? <PastoralCareForm currentUser={user} />
                                        : <SinAcceso />
                                } />
                                {/* El detalle de un servicio vive en su propia dirección para
                                    poder compartirla y volver atrás; antes era un modal. */}
                                <Route path="/audiencia-servicios/detalles/:id" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ADMIN_CUIDADO_PASTORAL
                                    ]))
                                        ? <AudienciaServicioDetalle currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/prode" element={<Prode />} />
                                <Route path="/prode/ranking" element={<ProdeRanking />} />
                                <Route path="/prode/resultados" element={<ProdeResultados />} />
                                <Route path="/prode/administracion" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.PRODE
                                    ]))
                                        ? <AdminProde />
                                        : <SinAcceso />
                                } />

                                <Route path="/panel-eventos" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.PRODE,
                                        // Sin esto, quien sólo tiene ACREDITACION no puede
                                        // abrir el índice y la tarjeta de Nocturna queda
                                        // inalcanzable. El índice ya filtra por rol: va a
                                        // ver únicamente Nocturna.
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <PanelEventos currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/eventos/admin/diadelpadre" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <AdminDPadre currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/eventos/admin/diadelnino" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ENCARGADO_NINEZ,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <AdminDiaNino currentUser={user} />
                                        : <SinAcceso />
                                } />
                                {/* Nocturna. Los 4 roles son los mismos que mira
                                    is_nocturna_staff() en la base: si acá y allá no
                                    coinciden, alguien entra a una pantalla que después
                                    no le devuelve datos. */}
                                <Route path="/panel-eventos/nocturna" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <AdminNocturna currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/panel-eventos/nocturna/nueva" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <CrearInscripcionNocturna currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/panel-eventos/nocturna/reportes" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <ReportesNocturna currentUser={user} />
                                        : <SinAcceso />
                                } />
                                {/* La ficha y su edición van DESPUÉS de /nueva, de
                                    /reportes y de /acreditar (esta última vive arriba,
                                    fuera del Layout): si `:id` se declarara primero, se
                                    comería esas rutas tomando "nueva" o "reportes" por
                                    un identificador. Ya pasó en los reportes de GCX. */}
                                <Route path="/panel-eventos/nocturna/:id/editar" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <CrearInscripcionNocturna currentUser={user} modoEdicion />
                                        : <SinAcceso />
                                } />
                                <Route path="/panel-eventos/nocturna/:id" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <DetalleNocturna currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/eventos/admin/tribal-wars" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.INFLUOS,
                                    ]))
                                        ? <AdminInfluosDia currentUser={user} />
                                        : <SinAcceso />
                                } />
                                {/* Guard de SUPER_ADMIN + ENCARGADO_EVENTOS — sin PASTOR, decisión explícita */}
                                <Route path="/eventos/admin/general/crear-evento" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <CrearEventoGeneral />
                                        : <SinAcceso />
                                } />
                                <Route path="/eventos/admin/general" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <AdminEventosGeneral currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/eventos/admin/tribal-wars/nueva" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.INFLUOS,
                                    ]))
                                        ? <NuevaInfluosDia />
                                        : <SinAcceso />
                                } />
                                <Route path="/eventos/admin/diadelnino/nueva" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ENCARGADO_NINEZ,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <NuevaDiaNino />
                                        : <SinAcceso />
                                } />
                                <Route path="/eventos/admin/diadelnino/escaner" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ENCARGADO_NINEZ,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <EscanerDiaNino />
                                        : <SinAcceso />
                                } />
                                <Route path="/eventos/admin/diadelnino/escaner/:ticketId" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ENCARGADO_NINEZ,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <AcreditarEscaneoDiaNino />
                                        : <SinAcceso />
                                } />
                                <Route path="/eventos/admin/diadelnino/:sessionId" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                        UserRole.ENCARGADO_NINEZ,
                                        UserRole.ACREDITACION,
                                    ]))
                                        ? <DetalleDiaNino />
                                        : <SinAcceso />
                                } />
                                <Route path="/eventos/puntuacion" element={
                                    (user && hasRole(user, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.EVENTOS, UserRole.ENCARGADO_EVENTOS]))
                                        ? <Puntuacion zona="trivia" currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/eventos/futboltenis" element={
                                    (user && hasRole(user, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.EVENTOS, UserRole.ENCARGADO_EVENTOS]))
                                        ? <Puntuacion zona="futbol" currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/eventos/dpadre/:id" element={
                                    (user && hasRole(user, [UserRole.SUPER_ADMIN, UserRole.PASTOR, UserRole.EVENTOS, UserRole.ENCARGADO_EVENTOS]))
                                        ? <DetalleFamilia currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/admin-ninez/configuracion" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_NINEZ,
                                    ]))
                                        ? <ConfiguracionNinez />
                                        : <SinAcceso />
                                } />
                                <Route path="/trivia/admin" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <AdminTrivia currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/trivia/admin/nuevo" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <CrearJuego currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/trivia/admin/:id" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <TriviaControl currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/trivia/historial" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <TriviaHistorial currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/trivia/historial/:id" element={
                                    (user && hasRole(user, [
                                        UserRole.SUPER_ADMIN,
                                        UserRole.PASTOR,
                                        UserRole.ENCARGADO_EVENTOS,
                                    ]))
                                        ? <TriviaPlanilla currentUser={user} />
                                        : <SinAcceso />
                                } />
                                <Route path="/notificaciones" element={<Notifications />} />
                                <Route path="/perfil" element={<MiCuenta />} />
                                <Route path="/perfil/:seccion" element={<MiCuenta />} />
                                <Route path="/perfil/:seccion/:id" element={<MiCuenta />} />
                                <Route path="*" element={<Navigate to="/" />} />
                            </Routes>
                        </Layout>
                    )
            } />
        </Routes>
        </div>
        )}
        </>
    );
};

const App: React.FC = () => {
    const { updateAvailable, actualizacionFallida, forceHardReset, posponer } = useVersionCheck();

    return (
        <ErrorBoundary>
            <ProveedorDeTema>
            <AudioProvider>
                <AuthProvider>
                    <NotificationProvider>
                        <ToastProvider>
                            <HashRouter>
                                <AppContent />
                            </HashRouter>
                            {updateAvailable && (
                                <ModalActualizacion
                                    onConfirm={forceHardReset}
                                    onPosponer={posponer}
                                    fallido={actualizacionFallida}
                                />
                            )}
                        </ToastProvider>
                    </NotificationProvider>
                </AuthProvider>
            </AudioProvider>
            </ProveedorDeTema>
        </ErrorBoundary>
    );
};

export default App;

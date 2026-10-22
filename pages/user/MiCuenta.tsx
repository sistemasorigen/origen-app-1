import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSinLeer } from '../../contexts/NotificationContext';
import { useInscripcionesDelUsuario } from '../../src/hooks/useInscripcionesDelUsuario';
import { useBannersDeInicio } from '../../src/hooks/useBannersDeInicio';
import { misCompras, misInscripciones, type CompraPropia, type InscripcionPropia } from '../../services/miCuenta';
import {
    BotonPrimario, BotonRojo, BotonSecundario, EncabezadoSubpagina, ESTILOS_MI_CUENTA,
    EsqueletoDeSeccion, Panel, TituloDePanel, useAvisoFlotante,
} from '../../components/miCuenta/piezas';
import { ESTILOS_DESTACADA, type Destacado } from '../../components/miCuenta/Destacada';
import ListaMiCuenta, { type SeccionDeMiCuenta } from '../../components/miCuenta/ListaMiCuenta';
import {
    ayudaDeAvisos, detalleDeAvisos, estadoDeAvisos,
    PASOS_ANDROID, PASOS_APAGAR, PASOS_INSTALAR, PASOS_IPHONE_AJUSTES,
    type EstadoDeAvisos,
} from '../../components/miCuenta/avisos';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useTema } from '../../contexts/TemaContext';
import EditarPerfil, { CAMPOS_REQUERIDOS } from './miCuenta/EditarPerfil';
import CuentaYSeguridad from './miCuenta/CuentaYSeguridad';

declare const __BUILD_VERSION__: string;

/**
 * Mi cuenta — el centro de la cuenta de cada persona.
 *
 * CÓMO SE REPARTE LA PANTALLA. El .dc dibuja un marco fijo de 1440×900 con
 * dos columnas que scrollean por dentro. Acá no: la app ya tiene su navbar
 * pegada arriba y el documento scrollea entero, y meter scrollers anidados
 * adentro de una página que también scrollea es justo lo que se rompe en
 * iOS. En escritorio el riel izquierdo queda `sticky` bajo la navbar —mismo
 * efecto, una sola barra de scroll— y en el teléfono no hay riel: el índice
 * y cada sección son pantallas separadas, con la transición lateral del .dc.
 *
 * LAS SECCIONES QUE TODAVÍA NO EXISTEN muestran su esqueleto. Son los
 * prompts 3 a 5; la ruta ya funciona, así que los enlaces no se rompen.
 */

const TITULOS: Record<SeccionDeMiCuenta, string> = {
    editar: 'Editar perfil',
    grupos: 'Mis grupos',
    historial: 'Historial de grupos',
    compras: 'Mis compras',
    inscripciones: 'Mis inscripciones',
    servicio: 'Dónde sirvo',
    seguridad: 'Cuenta y seguridad',
    privacidad: 'Privacidad y mis datos',
    terminos: 'Términos y privacidad',
    tutoriales: 'Tutoriales',
    contacto: 'Escribile a la iglesia',
    reportar: 'Reportar un problema',
    app: 'Sobre la app',
};

const SECCIONES = Object.keys(TITULOS) as SeccionDeMiCuenta[];
const esSeccion = (v?: string): v is SeccionDeMiCuenta =>
    !!v && (SECCIONES as string[]).includes(v);

/** Las destacadas que se cerraron, mientras dure la pestaña. */
const CLAVE_CERRADAS = 'miCuenta.destacadasCerradas';

const leerCerradas = (): string[] => {
    try {
        return JSON.parse(sessionStorage.getItem(CLAVE_CERRADAS) || '[]');
    } catch {
        // Ventana privada o almacenamiento bloqueado: la tarjeta se podrá
        // cerrar igual, sólo que vuelve al recargar.
        return [];
    }
};

const guardarCerradas = (lista: string[]) => {
    try { sessionStorage.setItem(CLAVE_CERRADAS, JSON.stringify(lista)); } catch { /* ídem */ }
};

/** 'YYYY-MM-DD' → Date local. new Date('YYYY-MM-DD') parsea en UTC y en
 *  Argentina retrocede un día. Mismo criterio que src/utils/calendario.ts. */
const fechaLocal = (iso?: string | null): Date | null => {
    if (!iso) return null;
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
};

const diasHasta = (iso?: string | null): number | null => {
    const f = fechaLocal(iso);
    if (!f) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((f.getTime() - hoy.getTime()) / 86400000);
};

/** Anfitrion o co-anfitrion, mirando las dos columnas de rol que conviven. */
const esAnfitrion = (u: { role?: unknown; roles?: unknown[] } | null | undefined): boolean => {
    if (!u) return false;
    const todos = [String(u.role ?? ''), ...((u.roles as unknown[] | undefined) || []).map(String)];
    return todos.some(r => r === 'ANFITRION' || r === 'CO_ANFITRION');
};

const DIA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "Viernes 30, 22:00". */
const cuandoEs = (fecha?: string | null, hora?: string | null): string => {
    const f = fechaLocal(fecha);
    if (!f) return '';
    const dia = DIA_LARGO[f.getDay()];
    const texto = `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${f.getDate()}`;
    return hora ? `${texto}, ${hora}` : texto;
};

const MiCuenta: React.FC = () => {
    const navigate = useNavigate();
    const { seccion: enLaUrl, id } = useParams<{ seccion?: string; id?: string }>();
    const { user, signOut } = useAuth();
    const sinLeer = useSinLeer();
    const { inscripciones: deGrupos } = useInscripcionesDelUsuario(user);
    const { config } = useBannersDeInicio();
    const { avisar, Aviso } = useAvisoFlotante();
    const { permission, isSupported, requestPermission } = usePushNotifications();
    const { oscuro, alternar } = useTema();

    // Qué panel de ayuda de avisos está abierto, si hay alguno.
    const [ayudaAvisos, setAyudaAvisos] = useState<null | EstadoDeAvisos>(null);
    const [pestañaAyuda, setPestañaAyuda] = useState<'android' | 'iphone'>('android');

    const [compras, setCompras] = useState<CompraPropia[]>([]);
    const [eventos, setEventos] = useState<InscripcionPropia[]>([]);
    const [cargando, setCargando] = useState(true);
    const [cerradas, setCerradas] = useState<string[]>(leerCerradas);
    const [panel, setPanel] = useState<null | 'salir'>(null);
    const [hayCambiosSinGuardar, setHayCambiosSinGuardar] = useState(false);

    // Ancho: el riel sólo existe de lg para arriba. Se mira una vez y se
    // escucha, porque de esto depende si el índice y la sección conviven.
    const [esAncha, setEsAncha] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
    );
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(min-width: 1024px)');
        const alCambiar = () => setEsAncha(mq.matches);
        mq.addEventListener('change', alCambiar);
        return () => mq.removeEventListener('change', alCambiar);
    }, []);

    useEffect(() => {
        let vigente = true;
        setCargando(true);
        Promise.all([misCompras(), misInscripciones()])
            .then(([c, e]) => { if (vigente) { setCompras(c); setEventos(e); } })
            .finally(() => { if (vigente) setCargando(false); });
        return () => { vigente = false; };
    }, [user?.id]);

    // ── Qué se está mirando ─────────────────────────────────────────────
    //
    // En escritorio /perfil abre "Editar perfil" a la derecha: la columna no
    // puede quedar vacía al lado de un índice que ya se ve entero.
    const seccion: SeccionDeMiCuenta | null = esSeccion(enLaUrl)
        ? enLaUrl
        : (esAncha ? 'editar' : null);
    const enElIndice = !enLaUrl;

    // De qué lado entra la pantalla nueva. Sólo en el teléfono: en escritorio
    // las dos columnas están siempre y animar sería movimiento sin dato.
    const anterior = useRef<string | undefined>(enLaUrl);
    const [direccion, setDireccion] = useState<'der' | 'izq' | null>(null);
    const [pasada, setPasada] = useState(0);
    useEffect(() => {
        if (anterior.current === enLaUrl) return;
        setDireccion(anterior.current && !enLaUrl ? 'izq' : 'der');
        setPasada(n => n + 1);
        anterior.current = enLaUrl;
    }, [enLaUrl]);

    const irA = useCallback((s: SeccionDeMiCuenta) => {
        navigate(`/perfil/${s}`);
    }, [navigate]);

    const volver = useCallback(() => { navigate('/perfil'); }, [navigate]);

    // ── Los números de las filas ────────────────────────────────────────
    const conteos = useMemo(() => ({
        grupos: deGrupos.filter(r => r.status === 'APPROVED').length,
        compras: compras.length,
        inscripciones: eventos.length,
        // Por ahora, las áreas de voluntariado más el rol de anfitrión. La
        // pantalla de "Dónde sirvo" (prompt 3) es la que arma la lista de
        // verdad; este número tiene que coincidir con ella.
        // `roles` llega con valores fuera del enum, asi que se compara como
        // texto: tipar el array no significa que la base lo respete.
        servicio: (user?.volunteerRoles?.length || 0)
            + (esAnfitrion(user) ? 1 : 0),
    }), [deGrupos, compras, eventos, user]);

    const faltantes = useMemo(() => {
        if (!user) return [];
        const valor: Record<string, string> = {
            name: user.name || '',
            phone: user.phone || '',
            birthDate: user.birthDate || '',
            gender: user.gender || '',
        };
        return CAMPOS_REQUERIDOS.filter(c => !valor[c.key].trim());
    }, [user]);

    // ── La destacada ────────────────────────────────────────────────────
    //
    // La PRIMERA que aplique, en este orden. El versículo es el reposo: si no
    // hay nada que avisar, al menos hay algo que leer.
    const destacado: Destacado | null = useMemo(() => {
        const candidatos: Destacado[] = [];

        const proxima = eventos
            .filter(e => {
                const d = diasHasta(e.fecha);
                return d !== null && d >= 0 && d <= 7;
            })
            .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))[0];

        if (proxima) {
            candidatos.push({
                caso: 'entrada',
                titulo: `Tu entrada a ${proxima.evento}`,
                sub: cuandoEs(proxima.fecha, proxima.hora),
                boton: 'Ver mi entrada',
                onIr: () => navigate(`/perfil/inscripciones/${proxima.id}`),
            });
        }

        const lista = compras.find(c => c.estado === 'Listo');
        if (lista) {
            candidatos.push({
                caso: 'pedido',
                titulo: <>Tu pedido <span className="whitespace-nowrap">{lista.codigo}</span> está listo</>,
                sub: 'Retiralo en el Punto de Información',
                boton: 'Ver pedido',
                onIr: () => navigate(`/perfil/compras/${lista.id}`),
            });
        }

        if (faltantes.length > 0) {
            candidatos.push({
                caso: 'perfil',
                titulo: 'Completá tu perfil',
                sub: faltantes.length > 1 ? `Te faltan ${faltantes.length} datos` : 'Te falta 1 dato',
                boton: 'Completar',
                onIr: () => irA('editar'),
            });
        }

        if (!deGrupos.some(r => r.status === 'APPROVED')) {
            candidatos.push({
                caso: 'grupo',
                titulo: 'Todavía no estás en un grupo',
                sub: 'Encontrá el tuyo',
                boton: 'Ver grupos',
                onIr: () => navigate('/gcx'),
            });
        }

        const elegida = candidatos.find(c => !cerradas.includes(c.caso));
        if (elegida) return elegida;

        // El versículo del día, con la misma rotación que el inicio.
        const versos = config?.verses;
        if (versos && versos.length > 0) {
            const inicioDelAnio = new Date(new Date().getFullYear(), 0, 0).getTime();
            const diaDelAnio = Math.floor((Date.now() - inicioDelAnio) / 86400000);
            const v = versos[diaDelAnio % versos.length];
            return { caso: 'verso', titulo: '', sub: '', cita: { texto: v.text, ref: v.ref } };
        }
        return null;
    }, [eventos, compras, faltantes, deGrupos, cerradas, config, navigate, irA]);

    // El estado de los avisos se recalcula con el permiso: pedirlo cambia
    // `permission` y la fila se actualiza sola.
    const estadoAvisos = useMemo(
        () => estadoDeAvisos(isSupported, permission),
        [isSupported, permission],
    );

    const prenderAvisos = async () => {
        if (estadoAvisos !== 'apagado') return;
        const resultado = await requestPermission();
        if (resultado === 'granted') avisar('Te vamos a avisar en este celular');
        else if (resultado === 'denied') avisar('No diste permiso para los avisos');
    };

    const cerrarDestacada = () => {
        if (!destacado || destacado.caso === 'verso') return;
        const nuevas = [...cerradas, destacado.caso];
        setCerradas(nuevas);
        guardarCerradas(nuevas);
    };

    // ── La sección de la derecha ────────────────────────────────────────
    const contenido = () => {
        if (!seccion) return null;

        if (seccion === 'editar') {
            return (
                <EditarPerfil
                    onVolver={esAncha ? undefined : volver}
                    onCambios={setHayCambiosSinGuardar}
                    avisar={avisar}
                />
            );
        }

        if (seccion === 'seguridad') {
            return <CuentaYSeguridad onVolver={esAncha ? undefined : volver} avisar={avisar} />;
        }

        // Prompts 3 y 5. La ruta existe y el título también: lo único que
        // falta es el contenido, y se dice en vez de mostrar una página en
        // blanco que parece rota.
        return (
            <>
                <EncabezadoSubpagina
                    titulo={TITULOS[seccion]}
                    onVolver={esAncha ? undefined : volver}
                />
                <p className="mt-4 mb-0 text-[15px] leading-[1.5] font-medium" style={{ color: 'var(--mc-m50)' }}>
                    Esta pantalla está en camino.
                </p>
                <EsqueletoDeSeccion />
            </>
        );
    };

    const version = (typeof __BUILD_VERSION__ === 'string' ? __BUILD_VERSION__ : 'dev').slice(0, 7);

    const lista = (
        <ListaMiCuenta
            nombre={user?.name || ''}
            email={user?.email || ''}
            avatarUrl={user?.avatarUrl}
            faltan={faltantes.length}
            faltaTexto={faltantes.length === 1 ? `Falta ${faltantes[0].label.toLowerCase()}` : undefined}
            conteos={conteos}
            sinLeer={sinLeer}
            avisos={{
                prendido: estadoAvisos === 'prendido',
                sePuedePrender: estadoAvisos === 'apagado',
                detalle: detalleDeAvisos(estadoAvisos),
                ayuda: ayudaDeAvisos(estadoAvisos),
                onPrender: prenderAvisos,
                onAyuda: () => {
                    setPestañaAyuda(estadoAvisos === 'iphone' ? 'iphone' : 'android');
                    setAyudaAvisos(estadoAvisos);
                },
            }}
            temaOscuro={oscuro}
            onAlternarTema={alternar}
            version={version}
            cargando={cargando}
            destacado={destacado}
            onCerrarDestacado={cerrarDestacada}
            activa={esAncha ? seccion : null}
            onIr={irA}
            onIrAfuera={ruta => navigate(ruta)}
            onCerrarSesion={() => setPanel('salir')}
            onVolver={undefined}
        />
    );

    // La clase de entrada sólo se pone en el teléfono, y cambia en cada
    // navegación para que la animación vuelva a correr aunque sea la misma.
    const entrada = !esAncha && direccion ? `mc-${direccion === 'der' ? 'der' : 'izq'}` : '';

    return (
        <div id="mi-cuenta" className="min-h-screen">
            <style>{ESTILOS_MI_CUENTA}{ESTILOS_DESTACADA}</style>

            <div className="mx-auto max-w-[1180px] lg:grid lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
                {/* El índice. En el teléfono sólo cuando no hay sección. */}
                <div
                    className={`${enElIndice || esAncha ? 'block' : 'hidden'} px-4 pt-[26px] pb-12 lg:px-6 lg:pt-10 lg:pb-14`}
                    style={{ borderRight: esAncha ? '1px solid var(--mc-line)' : undefined }}
                >
                    <div
                        key={esAncha ? 'riel' : `indice-${pasada}`}
                        className={enElIndice ? entrada : ''}
                        style={esAncha ? { position: 'sticky', top: 88 } : undefined}
                    >
                        {lista}
                    </div>
                </div>

                {/* La sección. En el teléfono reemplaza al índice. */}
                <div className={`${seccion && (!enElIndice || esAncha) ? 'block' : 'hidden'} px-4 pt-[26px] pb-12 lg:px-10 lg:pt-10 lg:pb-14`}>
                    <div key={`sec-${enLaUrl || 'editar'}-${id || ''}-${pasada}`} className={`mx-auto max-w-[640px] ${enElIndice ? '' : entrada}`}>
                        {contenido()}
                    </div>
                </div>
            </div>

            <Panel abierto={panel === 'salir'} onCerrar={() => setPanel(null)} etiqueta="¿Cerrar sesión?">
                <TituloDePanel
                    titulo="¿Cerrar sesión?"
                    detalle={hayCambiosSinGuardar
                        ? 'Tenés cambios sin guardar en tu perfil: se van a perder.'
                        : 'Vas a tener que volver a entrar con tu cuenta.'}
                />
                <div className="flex flex-col gap-2.5 mt-[22px]">
                    <BotonRojo onClick={async () => { setPanel(null); await signOut(); }}>
                        Cerrar sesión
                    </BotonRojo>
                    <BotonSecundario ancho onClick={() => setPanel(null)} style={{ background: 'transparent' }}>
                        Cancelar
                    </BotonSecundario>
                </div>
            </Panel>

            <PanelDeAyuda
                estado={ayudaAvisos}
                pestaña={pestañaAyuda}
                onPestaña={setPestañaAyuda}
                onCerrar={() => setAyudaAvisos(null)}
            />

            <Aviso />
        </div>
    );
};

/**
 * Los pasos para prender, apagar o instalar, según el caso.
 *
 * El de "bloqueado" va con dos pestañas porque los pasos son distintos en
 * Android y en iPhone, y no hay forma confiable de saber cuál mira quien
 * está del otro lado: un iPad se presenta como Mac, y una persona puede
 * estar viendo esto en la compu para arreglarlo en el teléfono.
 */
const PanelDeAyuda: React.FC<{
    estado: EstadoDeAvisos | null;
    pestaña: 'android' | 'iphone';
    onPestaña: (p: 'android' | 'iphone') => void;
    onCerrar: () => void;
}> = ({ estado, pestaña, onPestaña, onCerrar }) => {
    if (!estado) return null;

    const esInstalar = estado === 'iphone';
    const esApagar = estado === 'prendido';

    const titulo = esInstalar ? 'Agregá Origen a tu inicio'
        : esApagar ? 'Cómo apagar los avisos'
            : 'Cómo activar los avisos';

    const detalle = esInstalar
        ? 'En iPhone, los avisos funcionan sólo si abrís Origen desde su ícono.'
        : esApagar
            ? 'Los diste permiso en este navegador, así que apagarlos se hace ahí.'
            : 'Los bloqueaste en el navegador. Para volver a prenderlos:';

    const pasos = esInstalar ? PASOS_INSTALAR
        : esApagar ? PASOS_APAGAR
            : (pestaña === 'android' ? PASOS_ANDROID : PASOS_IPHONE_AJUSTES);

    const conPestañas = !esInstalar && !esApagar;

    const pestañaSt = (activa: boolean): React.CSSProperties => ({
        minHeight: 44,
        border: 0,
        borderRadius: 999,
        background: activa ? 'var(--mc-card)' : 'transparent',
        color: activa ? 'var(--mc-ink)' : 'var(--mc-m66)',
        font: 'inherit',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: activa ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
    });

    return (
        <Panel abierto onCerrar={onCerrar} etiqueta={titulo}>
            <TituloDePanel titulo={titulo} detalle={detalle} />

            {conPestañas && (
                <div role="tablist" className="grid grid-cols-2 gap-1 mt-[18px] p-1 rounded-full"
                    style={{ background: 'var(--mc-chip)' }}>
                    <button role="tab" aria-selected={pestaña === 'android'}
                        onClick={() => onPestaña('android')} style={pestañaSt(pestaña === 'android')}>
                        Android (Chrome)
                    </button>
                    <button role="tab" aria-selected={pestaña === 'iphone'}
                        onClick={() => onPestaña('iphone')} style={pestañaSt(pestaña === 'iphone')}>
                        iPhone
                    </button>
                </div>
            )}

            <ol className="list-none m-0 mt-[18px] p-0 flex flex-col gap-3.5">
                {pasos.map((paso, i) => (
                    <li key={paso} className="flex gap-3 items-start">
                        <span className="w-7 h-7 flex-none rounded-full flex items-center justify-center text-[13.5px] font-bold"
                            style={{ background: 'var(--mc-chip)' }}>
                            {i + 1}
                        </span>
                        <span className="pt-[3px] text-[15px] leading-[1.45] font-medium text-pretty">{paso}</span>
                    </li>
                ))}
            </ol>

            <BotonPrimario ancho onClick={onCerrar} className="mt-6">Entendido</BotonPrimario>
        </Panel>
    );
};

export default MiCuenta;

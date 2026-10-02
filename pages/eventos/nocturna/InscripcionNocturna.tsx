import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Check, ChevronLeft, Loader2, Lock, Plus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useBloqueoDeFondo } from '../../../hooks/useBloqueoDeFondo';
import { useBarraDeAppOculta } from '../../../contexts/BarraDeApp';
import { probarConexionBase, supabaseService } from '../../../services/supabaseService';
import { safeUUID } from '../../../services/uuidUtils';
import { calcularEdad, EDAD_MAXIMA, EDAD_MINIMA } from '../../../src/utils/nocturna';
import {
    ADULTO_VACIO,
    AdultoForm,
    adultoCompleto,
    adultoEsMenorDeEdad,
    armarPayloadNocturna,
    ChicoForm,
    chicoFueraDeEdad,
    chicosCompletos,
    edadDelChicoEnElEvento,
    enLista,
    faltanDelChico,
    OTRO_VACIO,
    OtroForm,
    plata,
    retiroCompleto,
    soloDigitos,
    TEXTO_AUTORIZACION,
    TEXTO_FOTOS,
    TRIBUS,
    VERSION_DECLARACIONES,
} from './compartido/formulario';
import {
    NocturnaAltaResultado,
    NocturnaChicoDelGrupo,
    NocturnaConfig,
    NocturnaGrupo,
    NocturnaTribu,
} from '../../../types';

/**
 * Inscripción pública a Nocturna.
 *
 * La completa un adulto responsable que anota a uno o varios chicos. Casi
 * todos entran desde el celular, así que todo está pensado para mobile y el
 * desktop es la misma columna con más aire.
 *
 * Lo que NO se decide acá: el total, la mayoría de edad del adulto y la
 * unicidad de los DNI los valida register_nocturna en la base. Lo de esta
 * pantalla es ayuda visual para no hacerle perder el viaje a nadie.
 */

// El fondo de la pantalla. Está acá y no suelto en el JSX porque lo usan
// dos cosas: el marco de la página y el <body>, que tiene que quedar del
// mismo color (ver el efecto de más abajo).
const FONDO = '#e9e7e3';

// ── Datos del evento y del pago ───────────────────────────────────────────
// La cuenta es de Mercado Pago, así que el número es un CVU y no un CBU. Se
// nombra como lo que es: quien lo pega en el homebanking busca el campo con
// ese nombre, y llamarlo mal hace dudar de si la cuenta es la correcta.
//
// `cvu` son los 22 dígitos pelados —lo que se copia y se pega— y `cvuVisible`
// los mismos con espacios cada cuatro, que es lo único que se lee a ojo.
const DATOS_DE_PAGO = {
    alias: 'eventosorigen.mp',
    cvu: '0000003100036316658390',
    cvuVisible: '0000 0031 0003 6316 6583 90',
    titular: 'Asociación Civil Origen Iglesia',
    cuit: '30-70705090-7',
};

// TODO: teléfono de contacto real.
const TELEFONO_CONTACTO = '11 5566 7788';

// `donde` hoy no se dibuja en ninguna pantalla, pero queda porque es el dato
// del evento y se va a necesitar el día que haya una pantalla de "qué es
// Nocturna".
const EVENTO = {
    // La fecha. Las horas van pegadas —"11pm", no "11 pm"— justamente
    // para que no se puedan partir entre dos renglones: es el dato que la
    // gente viene a buscar.
    cuando: 'Viernes 30 de octubre a\u00a0las 11pm hasta las 6am',
    // La invitación: lo que es Nocturna en una línea.
    propuesta: 'Una noche para pasarla increíble y definir quién es la mejor tribu',
    donde: 'Av. Eva Perón 3932.',
};

/**
 * La foto de apertura.
 *
 * Es la misma del login a propósito: son chicos de la edad de los que van a
 * Nocturna, y usar la foto que la gente ya vio al entrar a la app hace que
 * esta pantalla se lea como parte de Origen y no como un formulario suelto
 * de un tercero — que es la duda razonable de un padre al que le piden el
 * DNI de su hijo.
 *
 * Es de día y el evento es de noche: el velo oscuro de abajo la corre hacia
 * la noche sin disimular lo que es. Cuando haya una foto de una Nocturna
 * real, se cambia acá y no hace falta tocar nada más.
 */
const IMAGEN_HERO = '/auth-bg.jpg';
const LOGO = '/origen-logo.png';

// La app usa HashRouter: para navegar alcanza la ruta pelada, pero un link
// que se copia y se pega en WhatsApp necesita el '#'.
const RUTA = '/nocturna-inscripcion';

// ── Borrador ──────────────────────────────────────────────────────────────
// sessionStorage, no localStorage: tiene que sobrevivir que el celular
// descarte la pestaña mientras la persona está en la app del banco copiando
// el alias, pero no quedar guardado para siempre en un dispositivo
// compartido. Son datos de menores.
const CLAVE_BORRADOR = 'nocturna.inscripcion.borrador';
const VERSION_BORRADOR = 2;

interface Comprobante {
    path: string;
    nombre: string;
}

type Pantalla = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 'noAut';

interface Borrador {
    v: number;
    edicion: number;
    paso: number;
    adulto: AdultoForm;
    chicos: ChicoForm[];
    retiro: 'si' | 'no' | null;
    retiroQuien: 'yo' | 'otro' | null;
    otro: OtroForm;
    autoriza: boolean | null;
    fotos: boolean | null;
    comprobante: Comprobante | null;
    /**
     * La inscripción a la que se le están sumando chicos, si es ese el caso.
     *
     * Va en el borrador porque sin esto una recarga a mitad de camino devolvía
     * a la persona al formulario normal, con los chicos nuevos cargados, para
     * rebotar recién al final contra "ya hay una inscripción con ese DNI".
     */
    grupo?: NocturnaGrupo | null;
}

const chicoNuevo = (apellido = ''): ChicoForm => ({
    id: safeUUID(),
    nombre: '',
    apellido,
    dni: '',
    nac: '',
    tribu: '',
});

// ── Estilo ────────────────────────────────────────────────────────────────
const INK = '#0a0a0a';
const CAMPO = '#f4f4f2';
const PANEL = '#f7f7f5';
const AMBAR = '#fdf3e3';
const AMBAR_INK = '#7a4f10';
const VERDE = '#12783f';
const ROJO = '#b42318';

/**
 * index.html pisa todos los input con !important y nueve :not() encadenados.
 * La única forma de ganarle es la columna de ids, así que todo esto va
 * scopeado por #nocturna-inscripcion. Con clases de Tailwind no alcanza: se
 * escriben en el DOM y no pintan nada.
 */
const ESTILOS = `
    #nocturna-inscripcion {
        color-scheme: light;
        /* Columna de alto completo: sin esto, en los pasos cortos el pie
           sticky se queda a mitad de pantalla con fondo debajo. dvh porque
           en iOS 100vh incluye la barra del navegador.

           Menos los 64 px de la navbar de la app, que ahora va arriba: sin
           restarlos la página mide una pantalla ENTERA debajo de la barra y
           aparece un scroll de 64 px que no lleva a ningún lado. */
        min-height: calc(100vh - 64px);
        min-height: calc(100dvh - 64px);
    }
    /* La portada va sin la barra de la app, así que recupera esos 64 px. */
    #nocturna-inscripcion.sin-barra {
        min-height: 100vh;
        min-height: 100dvh;
        display: flex;
        flex-direction: column;
    }
    #nocturna-inscripcion > main { flex: 1 0 auto; }
    #nocturna-inscripcion .campo {
        width: 100%;
        height: 54px;
        padding: 0 18px !important;
        border: 0 !important;
        border-radius: 16px !important;
        background-color: ${CAMPO} !important;
        color: ${INK} !important;
        /* 16px no es decorativo: con menos, iOS hace zoom al enfocar. */
        font: 600 16px Manrope, system-ui, sans-serif !important;
        outline: none !important;
        box-shadow: none !important;
        -webkit-appearance: none;
        appearance: none;
    }
    #nocturna-inscripcion .campo::placeholder { color: rgba(0,0,0,.42) !important; opacity: 1; }
    #nocturna-inscripcion .campo:focus { box-shadow: 0 0 0 1.5px ${INK} inset !important; }
    #nocturna-inscripcion .campo--cuenta {
        background-color: #fafaf9 !important;
        box-shadow: 0 0 0 1.5px #ecebe8 inset !important;
    }
    #nocturna-inscripcion .campo--cuenta:focus { box-shadow: 0 0 0 1.5px ${INK} inset !important; }
    #nocturna-inscripcion .campo--alerta {
        background-color: ${AMBAR} !important;
        box-shadow: 0 0 0 1.5px #e8b96a inset !important;
    }
    #nocturna-inscripcion .campo::-webkit-date-and-time-value { text-align: left; }
    #nocturna-inscripcion .campo::-webkit-calendar-picker-indicator { opacity: .5; }
`;

const fuente = (peso: number, tam: string, alto?: string): React.CSSProperties => ({
    font: `${peso} ${tam}${alto ? `/${alto}` : ''} Manrope, system-ui, sans-serif`,
});

// ── Piezas visuales ───────────────────────────────────────────────────────

const Boton: React.FC<{
    onClick?: () => void;
    variante?: 'oscuro' | 'suave';
    children: React.ReactNode;
}> = ({ onClick, variante = 'oscuro', children }) => (
    <button
        type="button"
        onClick={onClick}
        className="h-14 rounded-full border-0 cursor-pointer transition-colors"
        style={{
            ...fuente(600, '16px'),
            background: variante === 'oscuro' ? INK : CAMPO,
            color: variante === 'oscuro' ? '#fff' : INK,
        }}
    >
        {children}
    </button>
);

/** Las opciones excluyentes que aparecen en los pasos 3, 4 y 5. */
const Opcion: React.FC<{
    activa: boolean;
    onClick: () => void;
    alineado?: 'center' | 'left';
    children: React.ReactNode;
}> = ({ activa, onClick, alineado = 'center', children }) => (
    <button
        type="button"
        onClick={onClick}
        aria-pressed={activa}
        className="border-0 rounded-[20px] cursor-pointer transition-colors"
        style={{
            minHeight: 58,
            padding: '14px 16px',
            background: activa ? INK : CAMPO,
            color: activa ? '#fff' : INK,
            textAlign: alineado,
            ...fuente(600, '15px'),
        }}
    >
        {children}
    </button>
);

const Tilde: React.FC<{ tam?: number }> = ({ tam = 28 }) => (
    <span
        className="rounded-full flex items-center justify-center flex-none"
        style={{ width: tam, height: tam, background: INK }}
        aria-hidden="true"
    >
        <Check className="text-white" style={{ width: tam * 0.5, height: tam * 0.5 }} strokeWidth={3} />
    </span>
);

/**
 * El margen viaja por prop y no por clase: el estilo inline de abajo le gana
 * a cualquier `mt-*` de Tailwind, así que pasarlo por className no pintaba
 * nada y el rótulo quedaba pegado a lo de arriba.
 */
const Rotulo: React.FC<{ children: React.ReactNode; className?: string; margen?: string }> = ({
    children,
    className = '',
    margen = '0',
}) => (
    <p className={className} style={{ ...fuente(600, '12px'), letterSpacing: '.07em', color: 'rgba(0,0,0,.55)', margin: margen }}>
        {children}
    </p>
);

const Titulo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h1
        className="text-[26px] lg:text-[30px]"
        style={{ ...fuente(600, 'inherit', '1.2'), color: INK, letterSpacing: '-.02em', margin: 0 }}
    >
        {children}
    </h1>
);

const Bajada: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p style={{ ...fuente(500, '14.5px', '1.55'), color: 'rgba(0,0,0,.6)', margin: '8px 0 0' }}>{children}</p>
);

const Marco: React.FC<{ children: React.ReactNode; sinBarra?: boolean }> = ({ children, sinBarra }) => (
    <div id="nocturna-inscripcion" className={sinBarra ? 'sin-barra' : undefined} style={{ background: FONDO }}>
        <style>{ESTILOS}</style>
        {children}
    </div>
);

// ── Pantalla ──────────────────────────────────────────────────────────────

const InscripcionNocturna: React.FC = () => {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();

    const [config, setConfig] = useState<NocturnaConfig | null>(null);
    const [cargando, setCargando] = useState(true);
    const [errorConfig, setErrorConfig] = useState(false);

    const [pantalla, setPantalla] = useState<Pantalla>(0);
    const [adulto, setAdulto] = useState<AdultoForm>(ADULTO_VACIO);
    const [chicos, setChicos] = useState<ChicoForm[]>([]);
    const [abierto, setAbierto] = useState<string | null>(null);
    const [quitado, setQuitado] = useState<{ chico: ChicoForm; idx: number } | null>(null);
    const [retiro, setRetiro] = useState<'si' | 'no' | null>(null);
    const [retiroQuien, setRetiroQuien] = useState<'yo' | 'otro' | null>(null);
    const [otro, setOtro] = useState<OtroForm>(OTRO_VACIO);
    const [autoriza, setAutoriza] = useState<boolean | null>(null);
    const [fotos, setFotos] = useState<boolean | null>(null);
    const [comprobante, setComprobante] = useState<Comprobante | null>(null);

    const [intento, setIntento] = useState(false);
    const [modalSalir, setModalSalir] = useState(false);
    const [copiado, setCopiado] = useState<string | null>(null);

    const [subiendo, setSubiendo] = useState(false);
    const [errorComprobante, setErrorComprobante] = useState<string | null>(null);
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);

    const [enviando, setEnviando] = useState(false);
    const [errorEnvio, setErrorEnvio] = useState<{ conexion: boolean; texto: string } | null>(null);
    const [resultado, setResultado] = useState<NocturnaAltaResultado | null>(null);

    /**
     * La inscripción que esta persona YA tiene, cuando la hay y quedó
     * verificada. Con esto puesto el formulario deja de crear una inscripción
     * nueva y pasa a sumarle chicos a la que existe.
     */
    const [grupo, setGrupo] = useState<NocturnaGrupo | null>(null);
    /** La hoja de aviso, antes de que decida. */
    const [aviso, setAviso] = useState<NocturnaGrupo | null>(null);
    const [buscandoGrupo, setBuscandoGrupo] = useState(false);
    /**
     * El último DNI+fecha que se consultó. Sin esto, volver atrás y tocar
     * "Continuar" de nuevo vuelve a abrir la misma hoja que ya respondió.
     */
    const consultado = useRef('');

    // Candado del doble envío: un ref y no un estado, porque el segundo toque
    // puede llegar antes de que React vuelva a renderizar.
    const enviandoRef = useRef(false);
    const autocompletado = useRef(false);
    // Mientras se cierra la sesión hay un render en el que el estado ya está
    // vacío pero `pantalla` todavía no volvió a 0. Sin este ref, el efecto de
    // guardado volvía a escribir un borrador justo después de borrarlo.
    const saliendo = useRef(false);
    const qrRef = useRef<HTMLDivElement>(null);

    useBloqueoDeFondo(modalSalir || !!aviso);

    /**
     * El fondo, hasta el borde de la pantalla.
     *
     * El Layout pinta slate-50 y le deja 32 px de padding abajo a <main>, que
     * quedan afuera del fondo de esta página: al terminar el scroll se ve un
     * corte de color. El rebote de iOS muestra lo mismo, porque ahí lo que
     * asoma es el fondo del <body>.
     *
     * Se arregla desde acá y no desde el Layout porque el color es de esta
     * pantalla; al desmontarse, todo vuelve como estaba.
     */
    useEffect(() => {
        const main = document.getElementById('main-content');
        const fondoPrevio = document.body.style.backgroundColor;
        const padPrevio = main ? main.style.paddingBottom : '';
        document.body.style.backgroundColor = FONDO;
        if (main) main.style.paddingBottom = '0px';
        return () => {
            document.body.style.backgroundColor = fondoPrevio;
            if (main) main.style.paddingBottom = padPrevio;
        };
    }, []);

    // ── Config + borrador ─────────────────────────────────────────────────
    useEffect(() => {
        let vivo = true;
        (async () => {
            const cfg = await supabaseService.getNocturnaConfig();
            if (!vivo) return;
            if (!cfg) {
                setErrorConfig(true);
                setCargando(false);
                return;
            }
            setConfig(cfg);

            try {
                const crudo = sessionStorage.getItem(CLAVE_BORRADOR);
                if (crudo) {
                    const b = JSON.parse(crudo) as Borrador;
                    // Un borrador de otra edición o de otra versión del
                    // formulario no se intenta arreglar: se descarta.
                    if (b && b.v === VERSION_BORRADOR && b.edicion === cfg.edicion) {
                        setAdulto({ ...ADULTO_VACIO, ...(b.adulto || {}) });
                        setChicos(Array.isArray(b.chicos) ? b.chicos : []);
                        setRetiro(b.retiro ?? null);
                        setRetiroQuien(b.retiroQuien ?? null);
                        setOtro({ ...OTRO_VACIO, ...(b.otro || {}) });
                        setAutoriza(b.autoriza ?? null);
                        setFotos(b.fotos ?? null);
                        setComprobante(b.comprobante ?? null);
                        if (b.grupo?.verificado) setGrupo(b.grupo);
                        const paso = Math.min(6, Math.max(1, Number(b.paso) || 1));
                        setPantalla(paso as Pantalla);
                    } else {
                        sessionStorage.removeItem(CLAVE_BORRADOR);
                    }
                }
            } catch {
                // Un borrador ilegible no puede impedir inscribirse.
                try { sessionStorage.removeItem(CLAVE_BORRADOR); } catch { /* sin storage */ }
            }

            setCargando(false);
        })();
        return () => { vivo = false; };
    }, []);

    const limpiarBorrador = useCallback(() => {
        try { sessionStorage.removeItem(CLAVE_BORRADOR); } catch { /* sin storage */ }
    }, []);

    // Guardado continuo. Solo de los pasos 1 a 6: en el 0 no hay nada cargado
    // y en el 7 la inscripción ya existe en la base.
    useEffect(() => {
        if (cargando || !config || saliendo.current) return;
        const paso = pantalla === 'noAut' ? 4 : pantalla;
        if (typeof paso !== 'number' || paso < 1 || paso > 6) return;
        const b: Borrador = {
            v: VERSION_BORRADOR,
            edicion: config.edicion,
            paso,
            adulto,
            chicos,
            retiro,
            retiroQuien,
            otro,
            autoriza,
            fotos,
            comprobante,
            grupo,
        };
        try { sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b)); } catch { /* sin storage */ }
    }, [cargando, config, pantalla, adulto, chicos, retiro, retiroQuien, otro, autoriza, fotos, comprobante]);

    // ── Autocompletado desde la cuenta ────────────────────────────────────
    const cuenta = useMemo(() => {
        if (!user) return null;
        // user.name es un solo campo: se corta en el primer espacio. Con
        // nombres compuestos sale mal, y por eso los campos son editables.
        const partes = (user.name || '').trim().split(/\s+/).filter(Boolean);
        return {
            nombre: partes[0] || '',
            apellido: partes.length > 1 ? partes.slice(1).join(' ') : '',
            email: user.email || '',
            nac: (user.birthDate || '').slice(0, 10),
        };
    }, [user]);

    // Corre después de restaurar el borrador: si la persona ya tenía algo
    // cargado, eso manda.
    useEffect(() => {
        if (cargando || !cuenta || autocompletado.current) return;
        autocompletado.current = true;
        setAdulto(a => (a.nombre || a.apellido || a.email || a.nac
            ? a
            : { ...a, nombre: cuenta.nombre, apellido: cuenta.apellido, email: cuenta.email, nac: cuenta.nac }));
    }, [cargando, cuenta]);

    // Sin sesión ya no hay nada de lo que salir.
    useEffect(() => { if (!user) saliendo.current = false; }, [user]);

    useEffect(() => {
        if (!copiado) return;
        const t = setTimeout(() => setCopiado(null), 1800);
        return () => clearTimeout(t);
    }, [copiado]);

    useEffect(() => () => { if (vistaPrevia) URL.revokeObjectURL(vistaPrevia); }, [vistaPrevia]);

    // ── Derivados ─────────────────────────────────────────────────────────
    /**
     * Sumando chicos, no se crea nada: se le agregan a la inscripción que ya
     * existe. Cambia el precio, los pasos, lo que dice la pantalla y a qué
     * función de la base se le manda todo.
     */
    const agregando = !!grupo?.verificado;
    const yaAnotados = grupo?.chicos ?? [];

    // Al que suma un hermano se le cobra el precio que pagó cuando se
    // inscribió, no el de hoy: es lo mismo que hace la base al rehacer el
    // total, y si la pantalla dijera otra cosa estaría mintiendo.
    const precio = (agregando ? grupo?.precioUnitario : config?.precioEntrada) ?? 0;
    const cantidad = chicos.length;
    const total = precio * cantidad;
    const varios = cantidad > 1;
    const nombres = chicos.map(c => c.nombre.trim() || 'un joven');

    const edadAdulto = calcularEdad(adulto.nac);
    const adultoEsMenor = adultoEsMenorDeEdad(adulto);

    // Las reglas viven en compartido/formulario.ts: el panel valida igual.
    const faltan = faltanDelChico;
    const incompletos = chicos.filter(c => faltan(c).length > 0);

    const ok1 = adultoCompleto(adulto);
    const ok2 = chicosCompletos(chicos);
    const ok3 = retiroCompleto(retiro === null ? null : retiro === 'si', retiroQuien, otro);

    const puedeSeguir = ((): boolean => {
        switch (pantalla) {
            case 1: return ok1;
            case 2: return ok2;
            case 3: return ok3;
            case 4: return autoriza === true;
            case 5: return fotos !== null;
            case 6: return !!comprobante && !subiendo;
            default: return false;
        }
    })();

    const hayPie = typeof pantalla === 'number' && pantalla >= 1 && pantalla <= 6;

    /**
     * Los que ya están anotados, en gris y con candado.
     *
     * Se dibuja igual en la hoja de aviso y en el paso de los chicos: es el
     * mismo dato y tiene que leerse como el mismo dato. El candado no es
     * decoración — es la única señal de que esas filas no se tocan.
     */
    const listaDeChicos = (cs: NocturnaChicoDelGrupo[]) => (
        <div className="rounded-[20px]" style={{ background: PANEL, padding: '2px 16px' }}>
            {cs.map((c, i) => (
                <div
                    key={`${c.nombre}-${c.dni}-${i}`}
                    className="flex items-center gap-3"
                    style={{ padding: '13px 0', borderTop: i === 0 ? 'none' : '1px solid #ecebe8' }}
                >
                    <Lock className="w-[15px] h-[15px] flex-none" style={{ color: 'rgba(0,0,0,.42)' }} strokeWidth={2.2} />
                    <span className="min-w-0 flex-1">
                        <span className="block truncate" style={{ ...fuente(600, '14.5px'), color: 'rgba(0,0,0,.72)' }}>
                            {`${c.nombre} ${c.apellido}`.trim()}
                        </span>
                        <span className="block" style={{ ...fuente(500, '12.5px'), color: 'rgba(0,0,0,.5)', marginTop: 1 }}>
                            {c.tribu} · DNI {c.dni}
                        </span>
                    </span>
                </div>
            ))}
        </div>
    );

    /**
     * Sumando chicos, la pantalla de las fotos no se muestra.
     *
     * `acepta_fotos` es una sola respuesta para toda la inscripción y ya está
     * contestada; la base ignora lo que mande el formulario. Volver a
     * preguntarlo sería simular que su respuesta de hoy cambia algo.
     *
     * La autorización, en cambio, SÍ se vuelve a pedir: los chicos nuevos no
     * estaban en lo que firmó, y la base guarda esa constancia aparte.
     */
    const ultimoPaso = agregando ? 5 : 6;
    const pasoMostrado = agregando && pantalla === 6 ? 5 : pantalla;

    // ── Acciones ──────────────────────────────────────────────────────────
    const irA = (p: Pantalla) => {
        setPantalla(p);
        setIntento(false);
        setQuitado(null);
        window.scrollTo(0, 0);
    };

    const irAutenticarse = (registro: boolean) => {
        // Dos capas a la vez: sessionStorage sobrevive el redirect completo de
        // Google (que recarga la página y se lleva location.state), y el state
        // cubre email y contraseña, donde no hay recarga. Hacen falta los dos.
        sessionStorage.setItem('post_login_redirect', RUTA);
        navigate(registro ? '/auth?registro=1' : '/auth', { state: { from: { pathname: RUTA } } });
    };

    const atras = () => {
        if (pantalla === 'noAut') return irA(4);
        // Volver es volver: la portada ahora existe también con sesión, así
        // que ya no hay que cerrarla para llegar. Cambiar de cuenta es una
        // decisión aparte y vive en la portada.
        if (pantalla === 1) return irA(0);
        if (agregando && pantalla === 6) return irA(4);
        if (typeof pantalla === 'number' && pantalla > 1) irA((pantalla - 1) as Pantalla);
    };

    const cerrarSesionYVolver = async () => {
        saliendo.current = true;
        setModalSalir(false);
        // En un dispositivo compartido no puede quedar cargado lo de otra
        // familia: se borra el borrador, no solo la sesión.
        limpiarBorrador();
        autocompletado.current = false;
        setAdulto(ADULTO_VACIO);
        setChicos([]);
        setAbierto(null);
        setRetiro(null);
        setRetiroQuien(null);
        setOtro(OTRO_VACIO);
        setAutoriza(null);
        setFotos(null);
        setComprobante(null);
        setVistaPrevia(null);
        await signOut();
        irA(0);
    };

    const editarChico = (id: string, campo: keyof ChicoForm, valor: string) => {
        setChicos(cs => cs.map(c => (c.id === id ? { ...c, [campo]: valor } : c)));
    };

    const agregarChico = () => {
        const nuevo = chicoNuevo(chicos[0]?.apellido || '');
        setChicos(cs => [...cs, nuevo]);
        setAbierto(nuevo.id);
        setQuitado(null);
    };

    const quitarChico = (c: ChicoForm, idx: number) => {
        setQuitado({ chico: c, idx });
        setChicos(cs => cs.filter(x => x.id !== c.id));
        setAbierto(null);
    };

    const deshacerQuitar = () => {
        if (!quitado) return;
        setChicos(cs => {
            const arr = cs.slice();
            arr.splice(quitado.idx, 0, quitado.chico);
            return arr;
        });
        setQuitado(null);
    };

    const copiar = async (clave: string, valor: string) => {
        try {
            await navigator.clipboard.writeText(valor);
            setCopiado(clave);
        } catch {
            // Sin permiso de portapapeles el dato sigue visible y se puede
            // seleccionar a mano: no se avisa un éxito que no pasó.
            setCopiado(null);
        }
    };

    const elegirComprobante = async (file: File | undefined) => {
        if (!file || !config) return;
        setErrorComprobante(null);
        setSubiendo(true);
        const previa = URL.createObjectURL(file);
        const res = await supabaseService.uploadNocturnaComprobante(file, config.edicion);
        setSubiendo(false);
        if (!res.ok || !res.path) {
            URL.revokeObjectURL(previa);
            setErrorComprobante(res.error || 'No pudimos subir el comprobante. Probá de nuevo.');
            return;
        }
        setVistaPrevia(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return previa;
        });
        setComprobante({ path: res.path, nombre: file.name });
    };

    const quitarComprobante = () => {
        // El archivo ya subido queda en el bucket privado sin fila que lo
        // referencie. Borrarlo desde acá pediría DELETE para anon, que es
        // justo el permiso que no queremos dar.
        setVistaPrevia(prev => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
        setComprobante(null);
        setErrorComprobante(null);
    };

    const enviar = async () => {
        if (enviandoRef.current || resultado) return;
        if (!config || !comprobante) return;
        enviandoRef.current = true;
        setEnviando(true);
        setErrorEnvio(null);

        // El mismo payload para los dos caminos. Sumando, la base lee de acá
        // el DNI y la fecha del adulto —para reconocerlo—, los chicos nuevos,
        // el comprobante y la versión de las declaraciones, y lo demás lo
        // saca de la inscripción guardada.
        const payload = armarPayloadNocturna({
            adulto,
            chicos,
            seRetiranSolos: retiro === null ? null : retiro === 'si',
            quienRetira: retiroQuien,
            otro,
            autoriza: autoriza === true,
            aceptaFotos: fotos === true,
            comprobantePath: comprobante.path,
        });

        const res = agregando
            ? await supabaseService.agregarJovenesNocturna(payload)
            : await supabaseService.registerNocturna(payload);

        if (!res.ok) {
            // Un corte de conexión y un rechazo de la inscripción se arreglan
            // distinto, así que no se cuentan igual.
            const hayBase = await probarConexionBase();
            setErrorEnvio(hayBase
                ? { conexion: false, texto: res.error || 'No pudimos completar la inscripción.' }
                : { conexion: true, texto: 'Nos quedamos sin conexión y no se guardó nada. Revisá tu internet y volvé a tocar “Listo”.' });
            enviandoRef.current = false;
            setEnviando(false);
            return;
        }

        limpiarBorrador();
        setResultado(res);
        setEnviando(false);
        // enviandoRef queda en true: la inscripción ya existe y un segundo
        // toque no puede crear otra.
        irA(7);
    };

    /**
     * ¿Este adulto ya tiene una inscripción?
     *
     * Se pregunta al salir del paso de sus datos, no al final. Al final ya
     * transfirió $40.000 y subió el comprobante: enterarse ahí de que no
     * puede inscribirse de nuevo es el peor momento posible.
     *
     * Si la consulta falla, la base contesta "no existe" y se sigue como
     * siempre: el rechazo del final sigue estando, así que nadie se cuela.
     */
    const revisarSiYaEstaInscripto = async () => {
        const clave = `${adulto.dni.trim()}|${adulto.nac}`;

        // Volvió atrás y cambió el DNI o la fecha después de haber aceptado
        // sumar: ese grupo ya no es el suyo. Se deja de sumar y se vuelve a
        // preguntar con los datos nuevos, o terminaría agregándole chicos a
        // una familia que no es la que tiene escrita en la pantalla.
        if (grupo && clave !== consultado.current) setGrupo(null);

        if (consultado.current === clave) { irA(2); return; }

        setBuscandoGrupo(true);
        const encontrado = await supabaseService.buscarGrupoNocturna(adulto.dni.trim(), adulto.nac);
        setBuscandoGrupo(false);
        consultado.current = clave;

        if (!encontrado.existe) { irA(2); return; }
        setAviso(encontrado);
    };

    /** Desde la hoja: sumarle chicos a la inscripción que ya tiene. */
    const sumarAEsteGrupo = () => {
        if (!aviso?.verificado) return;
        setGrupo(aviso);
        setAviso(null);
        // Los chicos del formulario pasan a ser SÓLO los que agrega. Los que
        // ya estaban se muestran aparte y no se tocan.
        setChicos([]);
        setAbierto(null);
        irA(2);
    };

    const seguir = () => {
        if (!puedeSeguir || buscandoGrupo) {
            setIntento(true);
            if (pantalla === 2 && incompletos[0]) setAbierto(incompletos[0].id);
            return;
        }
        if (pantalla === 1) { void revisarSiYaEstaInscripto(); return; }
        if (pantalla === 6) { enviar(); return; }
        // Sumando, de la autorización se va derecho al pago: lo de las fotos
        // ya está contestado para esta inscripción.
        if (agregando && pantalla === 4) { irA(6); return; }
        if (typeof pantalla === 'number') irA((pantalla + 1) as Pantalla);
    };

    const guardarEntrada = () => {
        const svg = qrRef.current?.querySelector('svg');
        if (!svg) return;
        try {
            const texto = new XMLSerializer().serializeToString(svg);
            const img = new Image();
            img.onload = () => {
                const lado = 720;
                const canvas = document.createElement('canvas');
                canvas.width = lado;
                canvas.height = lado;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, lado, lado);
                ctx.drawImage(img, 40, 40, lado - 80, lado - 80);
                canvas.toBlob(blob => {
                    if (!blob) return;
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `nocturna-${resultado?.codigoEntrada || 'entrada'}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                });
            };
            img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(texto)}`;
        } catch {
            // Si el navegador no deja descargar, la captura de pantalla sigue
            // siendo una entrada válida: el texto de arriba ya lo dice.
        }
    };

    /**
     * La portada va sin la barra de la app: abre con la foto a sangre y el
     * logo encima, y la barra sería un segundo logo centrado 30 px más
     * arriba. Los seis pasos del formulario sí la llevan.
     *
     * Va ACÁ y no más abajo aunque sólo importe para la portada: abajo quedan
     * tres `return` tempranos —cargando, error de config, inscripciones
     * cerradas— y un hook después de un return condicional se llama en unos
     * renders y en otros no. React cuenta los hooks por orden, así que al
     * pasar de "cargando" a la portada la cantidad cambiaba y tiraba
     * "Rendered more hooks than during the previous render".
     *
     * Con las inscripciones cerradas no se notaba, porque el componente
     * salía antes siempre y el hook nunca llegaba a correr. Se habría roto
     * el día que se abrieran.
     *
     * Por eso la condición mira también el estado de carga: en las tres
     * pantallas de reemplazo no hay foto ni logo, así que ahí la barra sí va.
     */
    const portadaConFoto = !cargando
        && !errorConfig
        && !!config
        && config.inscripcionesAbiertas
        && pantalla === 0;
    useBarraDeAppOculta(portadaConFoto);

    // ── Pantallas que reemplazan todo ─────────────────────────────────────
    if (cargando) {
        return (
            <Marco>
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: INK }} />
                    <p style={{ ...fuente(500, '14px'), color: 'rgba(0,0,0,.6)', margin: 0 }}>Abriendo la inscripción…</p>
                </div>
            </Marco>
        );
    }

    if (errorConfig || !config) {
        return (
            <Marco>
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                    <Titulo>No pudimos cargar la inscripción</Titulo>
                    <p style={{ ...fuente(500, '14.5px', '1.65'), color: 'rgba(0,0,0,.64)', margin: '12px 0 0', maxWidth: 380 }}>
                        Es un problema de conexión con nuestros servidores, no de tus datos. Probá de nuevo en un rato.
                    </p>
                    <div className="flex flex-col gap-2.5 mt-7 w-full" style={{ maxWidth: 360 }}>
                        <Boton onClick={() => window.location.reload()}>Probar de nuevo</Boton>
                        <Boton variante="suave" onClick={() => navigate('/')}>Volver al inicio</Boton>
                    </div>
                </div>
            </Marco>
        );
    }

    if (!config.inscripcionesAbiertas && pantalla !== 7) {
        return (
            <Marco>
                <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                    <Rotulo>INSCRIPCIÓN</Rotulo>
                    <h1 className="text-[32px] lg:text-[38px]" style={{ ...fuente(600, 'inherit', '1.1'), color: INK, letterSpacing: '-.03em', margin: '10px 0 0' }}>
                        Nocturna
                    </h1>
                    <p style={{ ...fuente(600, '17px'), color: INK, margin: '20px 0 0' }}>Las inscripciones están cerradas</p>
                    <p style={{ ...fuente(500, '14.5px', '1.65'), color: 'rgba(0,0,0,.64)', margin: '10px 0 0', maxWidth: 380 }}>
                        Por ahora no estamos tomando inscripciones. Si ya te anotaste, tu entrada sigue valiendo.
                    </p>
                    <div className="mt-7 w-full flex flex-col" style={{ maxWidth: 360 }}>
                        <Boton variante="suave" onClick={() => navigate('/')}>Volver al inicio</Boton>
                    </div>
                </div>
            </Marco>
        );
    }

    // ── Campos del adulto ─────────────────────────────────────────────────
    type ClaveDeCuenta = 'nombre' | 'apellido' | 'email' | 'nac';

    const campoAdulto = (
        k: keyof AdultoForm,
        label: string,
        tipo: string,
        modo: 'text' | 'numeric' | 'email',
        ph: string,
    ) => {
        const deLaCuenta = !!cuenta && k !== 'dni' && !!cuenta[k as ClaveDeCuenta];
        const igual = deLaCuenta && adulto[k] === cuenta![k as ClaveDeCuenta];
        const alerta = k === 'nac' && adultoEsMenor;
        const clases = ['campo'];
        if (alerta) clases.push('campo--alerta');
        else if (igual) clases.push('campo--cuenta');
        return (
            <div key={k}>
                <div className="flex items-center gap-2 mb-[7px] min-h-[22px]">
                    <label htmlFor={`noc-${k}`} className="flex-1" style={{ ...fuente(600, '13px'), color: 'rgba(0,0,0,.62)' }}>
                        {label}
                    </label>
                    {deLaCuenta && (
                        <span
                            className="h-6 px-2.5 rounded-full flex items-center"
                            style={{
                                ...fuente(600, '11.5px'),
                                background: igual ? CAMPO : AMBAR,
                                color: igual ? 'rgba(0,0,0,.62)' : AMBAR_INK,
                            }}
                        >
                            {igual ? 'De tu cuenta' : 'Cambiado solo acá'}
                        </span>
                    )}
                    {k === 'dni' && !!cuenta && (
                        <span className="h-6 px-2.5 rounded-full flex items-center" style={{ ...fuente(600, '11.5px'), background: CAMPO, color: 'rgba(0,0,0,.62)' }}>
                            No está en tu cuenta
                        </span>
                    )}
                </div>
                <input
                    id={`noc-${k}`}
                    className={clases.join(' ')}
                    type={tipo}
                    inputMode={modo}
                    value={adulto[k]}
                    placeholder={ph}
                    onChange={e => {
                        const v = k === 'dni' ? soloDigitos(e.target.value, 9) : e.target.value;
                        setAdulto(a => ({ ...a, [k]: v }));
                    }}
                />
            </div>
        );
    };

    const nombreAdulto = `${adulto.nombre} ${adulto.apellido}`.trim();
    const resumenAdulto = `${nombreAdulto || '—'} · DNI ${adulto.dni || '—'}`;
    const retiroTexto = retiro === 'si'
        ? varios ? 'Se retiran solos' : 'Se retira solo'
        : retiroQuien === 'yo' ? `Lo retira ${nombreAdulto}`
            : retiroQuien === 'otro' ? `Lo retira ${`${otro.nombre} ${otro.apellido}`.trim()}`
                : '—';

    const pendienteTexto = pantalla === 1
        ? 'Completá todos tus datos para seguir.'
        : pantalla === 2
            ? cantidad === 0 ? 'Agregá al menos un joven.'
                : incompletos.length === 1 ? `A ${incompletos[0].nombre.trim() || 'un joven'} le faltan datos.`
                    : `Hay ${incompletos.length} jóvenes con datos incompletos.`
            : pantalla === 3 ? 'Elegí cómo se retiran.'
                : pantalla === 4 ? 'Elegí una opción.'
                    : pantalla === 5 ? 'Elegí una opción. Cualquiera te deja seguir.'
                        : pantalla === 6 ? 'Subí el comprobante para terminar.' : '';

    const etiquetaSeguir = pantalla === 1 ? 'Continuar' : pantalla === 6 ? 'Listo' : 'Siguiente';

    return (
        <Marco sinBarra={portadaConFoto}>
            {/* La barra de pasos. No va en la apertura: ahí no hay paso al que
                volver ni progreso que mostrar.

                `top-16` y no `top-0` porque la navbar de la app mide 64 px y
                está pegajosa en z-30; con top-0 esta barra se metía debajo de
                aquella al scrollear en vez de apoyarse encima. */}
            {pantalla !== 7 && pantalla !== 0 && (
                <header className="sticky top-16 z-20" style={{ background: '#e9e7e3' }}>
                    <div className="mx-auto px-[18px] lg:px-10 pt-3.5 pb-2" style={{ maxWidth: 596 }}>
                        <div className="flex items-center gap-2.5 min-h-[44px]">
                            {/* Sin ternario: el encabezado ya no se dibuja en la
                                apertura, asi que desde aca siempre hay un paso
                                anterior al que volver. */}
                            <button
                                type="button"
                                onClick={atras}
                                aria-label="Volver al paso anterior"
                                className="w-11 h-11 rounded-full border-0 flex items-center justify-center flex-none cursor-pointer"
                                style={{ background: CAMPO }}
                            >
                                <ChevronLeft className="w-[17px] h-[17px]" style={{ color: INK }} strokeWidth={2.3} />
                            </button>
                            {/* El medio va vacío: de decir dónde está parada la
                                persona ya se ocupan la navbar de arriba —con el
                                logo— y la barra de pasos de abajo. Repetir
                                "Nocturna" entre las dos era una tercera etiqueta
                                para lo mismo. Queda el espacio, que es lo que
                                mantiene el botón a la izquierda y el contador a
                                la derecha. */}
                            <span className="flex-1" />
                            <span className="w-11 text-right flex-none" style={{ ...fuente(600, '12.5px'), color: 'rgba(0,0,0,.55)' }}>
                                {hayPie ? `${pasoMostrado} de ${ultimoPaso}` : ''}
                            </span>
                        </div>
                        {hayPie && (
                            <div className="grid gap-2 mt-3.5" style={{ gridTemplateColumns: '2fr 3fr 1fr' }}>
                                {([
                                    ['1 · Datos', 1, 2],
                                    ['2 · Información', 3, agregando ? 4 : 5],
                                    ['3 · Pago', ultimoPaso, ultimoPaso],
                                ] as [string, number, number][]).map(([label, ini, fin]) => {
                                    const p = pasoMostrado as number;
                                    const tot = fin - ini + 1;
                                    const hechos = Math.max(0, Math.min(tot, p - ini + 1));
                                    const actual = p >= ini && p <= fin;
                                    return (
                                        <div key={label} className="min-w-0">
                                            <div className="h-1 rounded-full overflow-hidden" style={{ background: '#e8e7e4' }}>
                                                <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${(hechos / tot) * 100}%`, background: INK }} />
                                            </div>
                                            <p className="truncate" style={{ ...fuente(600, '12px'), color: actual ? INK : p > fin ? 'rgba(0,0,0,.6)' : 'rgba(0,0,0,.4)', margin: '7px 0 0' }}>
                                                {label}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </header>
            )}

            {/* El hueco de abajo lo deja el propio contenido: con el pie fijo,
                sin este margen los últimos campos quedan tapados por la barra
                y no hay forma de llegar a ellos. 104 px es el alto de la barra
                (botón de 54 + sus paddings) más aire. */}
            <main
                className="mx-auto px-[18px] lg:px-10"
                style={{
                    maxWidth: 596,
                    paddingBottom: hayPie ? 'calc(104px + env(safe-area-inset-bottom))' : 40,
                }}
            >

                {/* Paso 0 — cómo entrar */}
                {pantalla === 0 && (
                    <div>
                        {/* La banda sangra hasta los bordes de la columna: los
                            márgenes negativos son los mismos que el padding de
                            <main>, así que en el teléfono llega al borde de la
                            pantalla y en escritorio al ancho de la columna.

                            Acá vivió un rato el solape redondeado del login —la
                            hoja montando 28 px sobre la foto— y no funcionó: en
                            el login la hoja es BLANCA sobre la imagen y el corte
                            se ve; acá la hoja y la página son el mismo greige, así
                            que el solape no se leía y el logo quedaba flotando en
                            un hueco debajo de una foto oscura. El parecido con el
                            login lo sostienen la foto, el logo y la tipografía, no
                            un recurso que esta paleta no puede mostrar. */}
                        <div className="relative -mx-[18px] lg:-mx-10 h-[190px] lg:h-[230px] overflow-hidden rounded-b-3xl">
                            <img
                                src={IMAGEN_HERO}
                                alt=""
                                aria-hidden="true"
                                className="absolute inset-0 w-full h-full object-cover"
                                /* La foto es vertical y las caras están arriba del
                                   centro; centrada quedaban cortadas al mentón. */
                                style={{ objectPosition: '50% 28%' }}
                            />

                            {/* Dos velos, uno por punta, y el medio limpio.
                                El de arriba es fuerte a propósito: justo debajo del
                                logo cae la pared BLANCA del fondo de la foto, así que
                                un velo suave dejaba el logo blanco sobre gris claro,
                                ilegible. Baja hasta el 60 % porque el logo, en 56 px,
                                llega hasta el 40 % de la banda: sobre todo ese tramo
                                va .88 -> .55.
                                El de abajo es apenas un apoyo: desde que el texto
                                bajó de la foto no tiene que sostener nada, sólo
                                cerrar la imagen para que no termine de golpe contra
                                el borde redondeado. Con la banda en 190 px las caras
                                caen entre el 55 % y el 90 %, donde el velo de arriba
                                ya está por debajo de .22 y el de abajo casi no pesa:
                                se ven limpias. */}
                            <div
                                className="absolute inset-0"
                                style={{
                                    background:
                                        'linear-gradient(to bottom, rgba(10,10,10,.88) 0%, rgba(10,10,10,.78) 26%, rgba(10,10,10,.48) 44%, rgba(10,10,10,.10) 60%, rgba(10,10,10,0) 72%),'
                                        + 'linear-gradient(to top, rgba(10,10,10,.42) 0%, rgba(10,10,10,.12) 30%, rgba(10,10,10,0) 52%)',
                                }}
                            />

                            {/* El logo arriba del todo y al medio, en blanco.
                                Acá la barra de la app no está, así que este es
                                el único lugar donde aparece la marca: es lo
                                primero que ve un padre al que después le van a
                                pedir el documento de su hijo. */}
                            <img
                                src={LOGO}
                                alt="Origen"
                                className="absolute left-1/2 -translate-x-1/2 h-14 w-auto object-contain invert"
                                style={{ top: 20 }}
                            />
                        </div>

                        {/* La bienvenida, centrada entera.
                            ─────────────────────────────────────────────────────
                            Acá había cuatro alineaciones apiladas —título
                            centrado, fecha y texto a la izquierda, botones a lo
                            ancho, notas centradas— y eso es lo que hacía que la
                            sección se viera desarmada. Ahora el bloque de arriba
                            es una unidad centrada y el de abajo, la zona de
                            acción, va a lo ancho. Dos alineaciones, no cuatro.

                            Los tres niveles se separan por peso, cuerpo y color,
                            con una sola familia: el saludo, el dato duro y la
                            invitación. La fecha va en tinta plena porque es la
                            única información con la que alguien decide acá —si
                            puede o no esa noche— y queda pegada al título para
                            que se lean juntos, con más aire recién antes de la
                            invitación, que es tono y no dato. */}
                        <div className="mt-7 text-center">
                            {/* Tres cosas distintas, en este orden: el saludo, el
                                dato que decide si podés venir, y el tono.

                                El título puede ser grande porque ahora es corto:
                                entra en dos renglones y deja el nombre del evento
                                solo en el segundo. Ese corte, y el tamaño, son todo
                                el énfasis que lleva: no hace falta pintar
                                "Nocturna" de otro color para que se note.

                                `textWrap: balance` reparte las palabras entre los
                                renglones en vez de dejar uno largo y uno corto: en
                                texto centrado ese desbalance es lo primero que se
                                ve. Donde no está soportado, se ignora. */}
                            <h1
                                style={{
                                    ...fuente(700, 'inherit', '1.1'),
                                    fontSize: 'clamp(30px, 8vw, 38px)',
                                    color: INK,
                                    letterSpacing: '-.03em',
                                    textWrap: 'balance',
                                    margin: 0,
                                }}
                            >
                                ¡Bienvenidos a Nocturna!
                            </h1>
                            <p
                                style={{
                                    ...fuente(600, '16.5px', '1.4'),
                                    color: INK,
                                    textWrap: 'balance',
                                    margin: '14px auto 0',
                                    maxWidth: 380,
                                }}
                            >
                                {EVENTO.cuando}
                            </p>
                            <p
                                style={{
                                    ...fuente(500, '15px', '1.6'),
                                    color: 'rgba(0,0,0,.58)',
                                    textWrap: 'balance',
                                    margin: '18px auto 0',
                                    maxWidth: 360,
                                }}
                            >
                                {EVENTO.propuesta}
                            </p>
                        </div>

                        {/* La zona de acción. El salto de 32 px la separa de la
                            bienvenida; adentro, todo va junto. */}
                        <div className="flex flex-col gap-2.5 mt-8">
                            {user ? (
                                // Con sesión no hay nada que elegir: una sola
                                // forma de seguir. La portada igual se muestra
                                // —es donde dice qué es Nocturna, cuándo es y
                                // qué hay que tener a mano antes de empezar—.
                                <Boton onClick={() => irA(1)}>Continuar con la inscripción</Boton>
                            ) : (
                                <>
                                    <Boton onClick={() => irAutenticarse(false)}>Continuar iniciando sesión</Boton>
                                    <Boton variante="suave" onClick={() => irA(1)}>Entrar a la inscripción sin sesión</Boton>
                                </>
                            )}
                        </div>

                        {/* Debajo de los botones: no habla de cómo entrar, habla de
                            lo que hay que tener a mano para completar el
                            formulario. El texto va a la izquierda —son tres
                            renglones y centrados se leen peor— y es el único
                            bloque alineado así, por eso lleva recuadro: la caja
                            explica por qué rompe el centrado. */}
                        <div className="mt-5 rounded-[20px]" style={{ background: PANEL, padding: '16px 18px' }}>
                            <p style={{ ...fuente(500, '13.5px', '1.6'), color: 'rgba(0,0,0,.66)', margin: 0 }}>
                                <strong style={{ fontWeight: 600, color: INK }}>Es para jóvenes de {EDAD_MINIMA} a {EDAD_MAXIMA} años.</strong>{' '}
                                La completa un adulto responsable: vas a necesitar el DNI de cada joven y el comprobante de la transferencia.
                            </p>
                        </div>

                        {/* Las dos notas de cuenta eran dos párrafos chicos y
                            centrados, uno arriba del otro: leídos juntos parecían
                            letra chica. Son el mismo tema, así que van en una. */}
                        <p
                            className="text-center"
                            style={{
                                ...fuente(500, '13px', '1.65'),
                                color: 'rgba(0,0,0,.58)',
                                textWrap: 'balance',
                                margin: '20px auto 0',
                                maxWidth: 400,
                            }}
                        >
                            {user ? (
                                // Con sesión, lo único que falta decir es con
                                // qué cuenta se está entrando: en un celular
                                // prestado puede no ser la propia, y se entera
                                // recién al ver sus datos en el paso 1.
                                <>
                                    Entrás como{' '}
                                    <strong style={{ fontWeight: 600, color: INK }}>{user.name || user.email}</strong>
                                    {' '}y tus datos se completan solos.{' '}
                                    <button
                                        type="button"
                                        onClick={() => setModalSalir(true)}
                                        className="border-0 bg-transparent cursor-pointer p-0 underline"
                                        style={{ ...fuente(600, '13px'), color: INK, textUnderlineOffset: 3 }}
                                    >
                                        Usar otra cuenta
                                    </button>
                                </>
                            ) : (
                                <>
                                    Si ya tenés cuenta, iniciá sesión y tus datos se completan solos.{' '}
                                    ¿No tenés?{' '}
                                    <button
                                        type="button"
                                        onClick={() => irAutenticarse(true)}
                                        className="border-0 bg-transparent cursor-pointer p-0 underline"
                                        style={{ ...fuente(600, '13px'), color: INK, textUnderlineOffset: 3 }}
                                    >
                                        Registrate en la app
                                    </button>
                                </>
                            )}
                        </p>
                    </div>
                )}

                {/* Paso 1 — adulto responsable */}
                {pantalla === 1 && (
                    <div className="pt-4">
                        <Titulo>Tus datos</Titulo>
                        <Bajada>Los del adulto responsable de los jóvenes.</Bajada>
                        {!!cuenta && (
                            <div className="flex gap-3 rounded-[18px] mt-4" style={{ background: PANEL, padding: '14px 16px' }}>
                                <Tilde />
                                <p style={{ ...fuente(500, '13px', '1.55'), color: 'rgba(0,0,0,.66)', margin: 0 }}>
                                    <strong style={{ fontWeight: 600, color: INK }}>Completamos esto desde tu cuenta.</strong>{' '}
                                    Revisalo. Si cambiás algo, vale solo para esta inscripción: tu cuenta queda igual.
                                </p>
                            </div>
                        )}
                        <div className="flex flex-col gap-3.5 mt-5">
                            {campoAdulto('nombre', 'Nombre', 'text', 'text', 'Tu nombre')}
                            {campoAdulto('apellido', 'Apellido', 'text', 'text', 'Tu apellido')}
                            {campoAdulto('dni', 'DNI', 'text', 'numeric', 'Sin puntos')}
                            {campoAdulto('email', 'Email', 'email', 'email', 'Acá te llega la entrada')}
                            {campoAdulto('nac', 'Fecha de nacimiento', 'date', 'text', '')}
                        </div>
                        {adultoEsMenor && (
                            <div className="rounded-[20px] mt-4" style={{ background: AMBAR, padding: 18 }}>
                                <p style={{ ...fuente(600, '15.5px'), color: INK, margin: 0 }}>Esta inscripción la tiene que hacer un adulto</p>
                                <p style={{ ...fuente(500, '13.5px', '1.6'), color: '#5c3b0b', margin: '8px 0 0' }}>
                                    Según la fecha que cargaste tenés {edadAdulto} años. Para anotarte a Nocturna, pedile a tu mamá, papá o a un adulto a cargo que complete la inscripción desde su celular.
                                </p>
                                <div className="flex gap-2 mt-3.5 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => copiar('link', `${window.location.origin}/#${RUTA}`)}
                                        className="h-11 rounded-full border-0 cursor-pointer"
                                        style={{ ...fuente(600, '13.5px'), background: INK, color: '#fff', paddingLeft: 18, paddingRight: 18 }}
                                    >
                                        {copiado === 'link' ? 'Link copiado' : 'Copiar el link para un adulto'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdulto(a => ({ ...a, nac: '' }))}
                                        className="h-11 rounded-full border-0 cursor-pointer"
                                        style={{ ...fuente(600, '13.5px'), background: '#fff', color: INK, paddingLeft: 18, paddingRight: 18 }}
                                    >
                                        Corregir la fecha
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Paso 2 — los jóvenes */}
                {pantalla === 2 && (
                    <div className="pt-4">
                        <Titulo>{agregando ? '¿A quién sumás?' : '¿A quién vas a anotar?'}</Titulo>
                        <Bajada>
                            {agregando
                                ? 'Se agregan a la inscripción que ya tenés, sin tocar lo que está cargado.'
                                : `Podés anotar a varios en esta misma inscripción. Nocturna es para jóvenes de ${EDAD_MINIMA} a ${EDAD_MAXIMA} años.`}
                        </Bajada>

                        {agregando && yaAnotados.length > 0 && (
                            <div className="mt-5">
                                <p style={{ ...fuente(600, '13px'), color: 'rgba(0,0,0,.55)', margin: '0 2px 8px' }}>
                                    {yaAnotados.length === 1 ? 'Ya está anotado' : 'Ya están anotados'}
                                </p>
                                {listaDeChicos(yaAnotados)}
                                <p style={{ ...fuente(500, '12.5px', '1.55'), color: 'rgba(0,0,0,.5)', margin: '8px 2px 0' }}>
                                    Desde acá no se editan. Si hay algo para corregir, escribinos al {TELEFONO_CONTACTO} y lo cambiamos nosotros.
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col gap-2.5 mt-5">
                            {chicos.map((c, i) => {
                                const esteAbierto = abierto === c.id;
                                const falt = faltan(c);
                                const nombreCompleto = `${c.nombre} ${c.apellido}`.trim();
                                const edad = calcularEdad(c.nac);
                                // La regla del evento: 13 a 18, medidos el día de
                                // Nocturna. Se mira aparte de `falt` porque no es un
                                // dato que falte sino uno que no entra.
                                const fueraDeEdad = chicoFueraDeEdad(c);
                                const edadEnNocturna = edadDelChicoEnElEvento(c);
                                const trabado = falt.length > 0 || fueraDeEdad;
                                const alerta = trabado && (intento || !esteAbierto);
                                return (
                                    <div
                                        key={c.id}
                                        className="rounded-[22px]"
                                        style={{
                                            background: esteAbierto ? '#fff' : PANEL,
                                            boxShadow: esteAbierto
                                                ? `0 0 0 1.5px ${INK} inset`
                                                : alerta ? '0 0 0 1.5px #f0d9b4 inset' : 'none',
                                        }}
                                    >
                                        {!esteAbierto ? (
                                            <button
                                                type="button"
                                                onClick={() => setAbierto(c.id)}
                                                className="w-full border-0 bg-transparent flex items-center gap-3 cursor-pointer text-left"
                                                style={{ padding: 16 }}
                                            >
                                                <span
                                                    className="w-[46px] h-[46px] rounded-full flex items-center justify-center flex-none"
                                                    style={{
                                                        ...fuente(600, '14px'),
                                                        background: falt.length ? AMBAR : INK,
                                                        color: falt.length ? AMBAR_INK : '#fff',
                                                    }}
                                                >
                                                    {nombreCompleto
                                                        ? nombreCompleto.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
                                                        : String(i + 1)}
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className="block truncate" style={{ ...fuente(600, '15.5px'), color: INK }}>
                                                        {nombreCompleto || `Joven ${i + 1}`}
                                                    </span>
                                                    <span className="block" style={{ ...fuente(500, '13px'), color: falt.length ? AMBAR_INK : 'rgba(0,0,0,.6)', marginTop: 3 }}>
                                                        {falt.length ? `Falta: ${falt.join(', ')}` : `${edad} años · ${c.tribu}`}
                                                    </span>
                                                </span>
                                                <span
                                                    className="h-[34px] px-3.5 rounded-full flex items-center flex-none"
                                                    style={{ ...fuente(600, '12.5px'), background: '#fff', color: INK }}
                                                >
                                                    {falt.length ? 'Completar' : 'Editar'}
                                                </span>
                                            </button>
                                        ) : (
                                            <div style={{ padding: '18px 16px 16px' }}>
                                                <div className="flex items-center gap-2.5">
                                                    <Rotulo className="flex-1">{`JOVEN ${i + 1} DE ${cantidad}`}</Rotulo>
                                                    <button
                                                        type="button"
                                                        onClick={() => quitarChico(c, i)}
                                                        className="h-[34px] px-3 rounded-full border-0 bg-transparent cursor-pointer"
                                                        style={{ ...fuente(600, '12.5px'), color: ROJO }}
                                                    >
                                                        Quitar
                                                    </button>
                                                </div>
                                                <div className="grid gap-2 mt-2.5 grid-cols-1 lg:grid-cols-2">
                                                    <input className="campo" value={c.nombre} placeholder="Nombre" aria-label="Nombre del joven" onChange={e => editarChico(c.id, 'nombre', e.target.value)} />
                                                    <input className="campo" value={c.apellido} placeholder="Apellido" aria-label="Apellido del joven" onChange={e => editarChico(c.id, 'apellido', e.target.value)} />
                                                </div>
                                                <input
                                                    className="campo mt-2"
                                                    value={c.dni}
                                                    placeholder="DNI"
                                                    inputMode="numeric"
                                                    aria-label="DNI del joven"
                                                    onChange={e => editarChico(c.id, 'dni', soloDigitos(e.target.value, 9))}
                                                />
                                                <p style={{ ...fuente(600, '13px'), color: 'rgba(0,0,0,.62)', margin: '18px 0 8px' }}>Fecha de nacimiento</p>
                                                <div className="flex items-center gap-2.5">
                                                    <input
                                                        className="campo"
                                                        style={{ flex: 1, minWidth: 0 }}
                                                        type="date"
                                                        value={c.nac}
                                                        aria-label="Fecha de nacimiento del joven"
                                                        onChange={e => editarChico(c.id, 'nac', e.target.value)}
                                                    />
                                                    <span
                                                        className="h-[54px] px-4 rounded-2xl flex items-center whitespace-nowrap flex-none"
                                                        style={{
                                                            ...fuente(600, '14.5px'),
                                                            background: edad === null ? '#fafaf9' : fueraDeEdad ? AMBAR : INK,
                                                            color: edad === null ? 'rgba(0,0,0,.4)' : fueraDeEdad ? AMBAR_INK : '#fff',
                                                        }}
                                                    >
                                                        {edad === null ? 'Edad —' : `${edad} años`}
                                                    </span>
                                                </div>
                                                {/* El número que importa no es el de hoy sino el
                                                    del día del evento, y por eso el mensaje lo
                                                    dice con todas las letras: si no, alguien que
                                                    ve "12 años" y cumple la semana que viene no
                                                    entiende por qué no lo deja. */}
                                                {fueraDeEdad && (
                                                    <p
                                                        className="rounded-[14px]"
                                                        style={{ ...fuente(500, '13px', '1.55'), color: AMBAR_INK, background: AMBAR, padding: '10px 12px', margin: '10px 0 0' }}
                                                    >
                                                        Nocturna es para jóvenes de {EDAD_MINIMA} a {EDAD_MAXIMA} años.{' '}
                                                        {c.nombre.trim() || 'Este joven'} va a tener {edadEnNocturna} el día del evento.
                                                    </p>
                                                )}
                                                <p style={{ ...fuente(600, '13px'), color: 'rgba(0,0,0,.62)', margin: '18px 0 8px' }}>Tribu</p>
                                                <div className="grid grid-cols-3 gap-1.5">
                                                    {TRIBUS.map(t => (
                                                        <button
                                                            key={t}
                                                            type="button"
                                                            onClick={() => editarChico(c.id, 'tribu', t)}
                                                            aria-pressed={c.tribu === t}
                                                            className="h-12 rounded-full border-0 cursor-pointer"
                                                            style={{
                                                                ...fuente(600, '14px'),
                                                                background: c.tribu === t ? INK : CAMPO,
                                                                color: c.tribu === t ? '#fff' : INK,
                                                            }}
                                                        >
                                                            {t}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => { if (!trabado) setAbierto(null); }}
                                                    className="w-full rounded-full border-0 mt-5"
                                                    style={{
                                                        minHeight: 54,
                                                        padding: '0 18px',
                                                        ...fuente(600, '15px'),
                                                        background: trabado ? CAMPO : INK,
                                                        color: trabado ? 'rgba(0,0,0,.55)' : '#fff',
                                                        cursor: trabado ? 'default' : 'pointer',
                                                    }}
                                                >
                                                    {falt.length
                                                        ? `Falta: ${falt.join(', ')}`
                                                        : fueraDeEdad
                                                            ? 'No entra en la edad de Nocturna'
                                                            : `Listo, guardar a ${c.nombre.trim() || 'este joven'}`}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {cantidad === 0 && (
                                <div className="rounded-[22px] text-center" style={{ background: PANEL, padding: '28px 20px' }}>
                                    <p style={{ ...fuente(600, '15px'), color: INK, margin: 0 }}>Todavía no anotaste a nadie</p>
                                    <p style={{ ...fuente(500, '13.5px'), color: 'rgba(0,0,0,.6)', margin: '6px 0 0' }}>Agregá al primer joven para seguir.</p>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={agregarChico}
                                className="h-[58px] rounded-[22px] bg-transparent flex items-center justify-center gap-2.5 cursor-pointer"
                                style={{ border: '1.5px dashed #d9d8d4', ...fuente(600, '15px'), color: INK }}
                            >
                                <Plus className="w-[17px] h-[17px]" strokeWidth={2.4} />
                                {cantidad ? 'Agregar otro joven' : 'Agregar un joven'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Paso 3 — retiro, una respuesta para toda la familia */}
                {pantalla === 3 && (
                    <div className="pt-4">
                        <Titulo>{varios ? '¿Se retiran solos a las 6 h?' : `¿${nombres[0] || 'Tu hijo'} se retira solo a las 6 h?`}</Titulo>
                        <Bajada>
                            {varios
                                ? `Una respuesta para ${enLista(nombres)}. Salen juntos.`
                                : 'El evento termina el sábado 31 a las 6 de la mañana.'}
                        </Bajada>
                        <div className="grid grid-cols-2 gap-2 mt-5">
                            <Opcion activa={retiro === 'si'} onClick={() => { setRetiro('si'); setRetiroQuien(null); }}>
                                {varios ? 'Sí, se retiran solos' : 'Sí, se retira solo'}
                            </Opcion>
                            <Opcion activa={retiro === 'no'} onClick={() => setRetiro('no')}>No</Opcion>
                        </div>
                        {retiro === 'no' && (
                            <>
                                <Rotulo margen="26px 0 10px">¿QUIÉN LO RETIRA?</Rotulo>
                                <div className="flex flex-col gap-2">
                                    <Opcion activa={retiroQuien === 'yo'} onClick={() => setRetiroQuien('yo')} alineado="left">
                                        <span className="block" style={{ ...fuente(600, '15px'), color: 'inherit' }}>Lo retiro yo</span>
                                        {retiroQuien === 'yo' && (
                                            <span
                                                className="block"
                                                style={{
                                                    marginTop: 10,
                                                    paddingTop: 10,
                                                    borderTop: '1px solid rgba(255,255,255,.18)',
                                                    ...fuente(500, '13px', '1.6'),
                                                    color: 'rgba(255,255,255,.78)',
                                                }}
                                            >
                                                {resumenAdulto}
                                                <br />
                                                Los datos del paso 1. Si algo está mal, volvé a ese paso.
                                            </span>
                                        )}
                                    </Opcion>
                                    <Opcion activa={retiroQuien === 'otro'} onClick={() => setRetiroQuien('otro')} alineado="left">
                                        <span className="block" style={{ ...fuente(600, '15px'), color: 'inherit' }}>Lo retirará otra persona</span>
                                    </Opcion>
                                </div>
                                {retiroQuien === 'otro' && (
                                    <div className="flex flex-col gap-2 mt-3.5">
                                        <input className="campo" value={otro.nombre} placeholder="Nombre" aria-label="Nombre de quien retira" onChange={e => setOtro(o => ({ ...o, nombre: e.target.value }))} />
                                        <input className="campo" value={otro.apellido} placeholder="Apellido" aria-label="Apellido de quien retira" onChange={e => setOtro(o => ({ ...o, apellido: e.target.value }))} />
                                        <input className="campo" value={otro.dni} placeholder="DNI" inputMode="numeric" aria-label="DNI de quien retira" onChange={e => setOtro(o => ({ ...o, dni: soloDigitos(e.target.value, 9) }))} />
                                        <input className="campo" value={otro.telefono} placeholder="Teléfono" inputMode="tel" aria-label="Teléfono de quien retira" onChange={e => setOtro(o => ({ ...o, telefono: e.target.value.replace(/[^\d\s+]/g, '') }))} />
                                        <p style={{ ...fuente(500, '12.5px', '1.5'), color: 'rgba(0,0,0,.58)', margin: '4px 2px 0' }}>
                                            Va a tener que mostrar su DNI en la puerta a las 6 AM.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Paso 4 — autorización */}
                {pantalla === 4 && (
                    <div className="pt-4">
                        <Titulo>Autorización de asistencia</Titulo>
                        <Bajada>Obligatoria: sin esta autorización no pueden asistir.</Bajada>
                        <div className="rounded-[20px] mt-5" style={{ background: PANEL, padding: 20 }}>
                            <p style={{ ...fuente(500, '15px', '1.7'), color: INK, margin: 0 }}>{TEXTO_AUTORIZACION}</p>
                        </div>
                        <p style={{ ...fuente(500, '13px'), color: 'rgba(0,0,0,.6)', margin: '14px 2px 0' }}>Para {enLista(nombres)}.</p>
                        <div className="grid grid-cols-2 gap-2 mt-3.5">
                            <Opcion activa={autoriza === true} onClick={() => setAutoriza(true)}>Autorizo</Opcion>
                            <Opcion activa={false} onClick={() => { setAutoriza(false); irA('noAut'); }}>No autorizo</Opcion>
                        </div>
                    </div>
                )}

                {/* Salida sin autorización */}
                {pantalla === 'noAut' && (
                    <div className="pt-8 text-center">
                        <div className="w-[72px] h-[72px] mx-auto rounded-full flex items-center justify-center" style={{ background: CAMPO }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <path d="M12 7v6M12 16.5v.5" />
                                <circle cx="12" cy="12" r="9" />
                            </svg>
                        </div>
                        <h1 style={{ ...fuente(600, '24px', '1.25'), color: INK, letterSpacing: '-.02em', margin: '22px 0 0' }}>
                            Sin autorización, no pueden asistir
                        </h1>
                        <p style={{ ...fuente(500, '14.5px', '1.65'), color: 'rgba(0,0,0,.64)', margin: '12px auto 0', maxWidth: 380 }}>
                            Para que {enLista(nombres)} {varios ? 'puedan' : 'pueda'} ir a Nocturna necesitamos la autorización de un adulto responsable. No guardamos esta inscripción ni se cobra nada.
                        </p>
                        <div className="flex flex-col gap-2.5 mt-7">
                            <Boton onClick={() => { setAutoriza(null); irA(4); }}>Volver y cambiar mi respuesta</Boton>
                            <Boton variante="suave" onClick={() => { limpiarBorrador(); navigate('/'); }}>Salir de la inscripción</Boton>
                        </div>
                        <p style={{ ...fuente(500, '13px'), color: 'rgba(0,0,0,.55)', margin: '16px 0 0' }}>¿Dudas? Escribinos al {TELEFONO_CONTACTO}.</p>
                    </div>
                )}

                {/* Paso 5 — fotos y video */}
                {pantalla === 5 && (
                    <div className="pt-4">
                        <Titulo>Fotos y video</Titulo>
                        <Bajada>Opcional: respondas lo que respondas, pueden asistir igual.</Bajada>
                        <div className="rounded-[20px] mt-5" style={{ background: PANEL, padding: 20 }}>
                            <p style={{ ...fuente(600, '15px'), color: INK, margin: 0 }}>Aviso sobre registro fotográfico y audiovisual.</p>
                            <p style={{ ...fuente(500, '15px', '1.7'), color: INK, margin: '8px 0 0' }}>{TEXTO_FOTOS}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-4">
                            <Opcion activa={fotos === true} onClick={() => setFotos(true)}>Sí, acepto</Opcion>
                            <Opcion activa={fotos === false} onClick={() => setFotos(false)}>No acepto</Opcion>
                        </div>
                        {fotos === false && (
                            <div className="flex gap-3 rounded-[18px] mt-3" style={{ background: PANEL, padding: '14px 16px' }}>
                                <Tilde tam={26} />
                                <p style={{ ...fuente(500, '13px', '1.55'), color: 'rgba(0,0,0,.66)', margin: 0 }}>
                                    Queda registrado. El equipo va a evitar publicar imágenes donde aparezcan. Podés seguir.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Paso 6 — pago */}
                {pantalla === 6 && (
                    <div className="pt-4">
                        <Titulo>Pago</Titulo>
                        <div className="rounded-[22px] mt-4" style={{ background: INK, padding: 20 }}>
                            <p style={{ ...fuente(600, '13px'), color: 'rgba(255,255,255,.6)', margin: 0 }}>Total a transferir</p>
                            <p style={{ ...fuente(600, '36px'), color: '#fff', letterSpacing: '-.03em', margin: '6px 0 0' }}>{plata(total)}</p>
                            <p style={{ ...fuente(500, '13px'), color: 'rgba(255,255,255,.66)', margin: '4px 0 0' }}>
                                {cantidad} {cantidad === 1 ? 'joven' : 'jóvenes'} × {plata(precio)}
                            </p>
                            {/* Sumando, el monto es sólo por los nuevos y al precio
                                que pagó esta familia. Sin esta línea, quien ya pagó
                                tres entradas ve un número y no sabe si le están
                                cobrando todo de nuevo. */}
                            {agregando && (
                                <p style={{ ...fuente(500, '12.5px', '1.5'), color: 'rgba(255,255,255,.66)', margin: '10px 0 0' }}>
                                    Es sólo por {cantidad === 1 ? 'el que suma' : 'los que suma'}s ahora, al mismo precio que pagaste al inscribirte. Lo que ya pagaste no se vuelve a cobrar.
                                </p>
                            )}
                        </div>
                        {/* Los datos para transferir, en UNA tarjeta.
                            ──────────────────────────────────────────────────
                            Antes eran tres filas iguales, y las tres cosas no
                            son iguales: el alias y el CVU se copian, el titular
                            se LEE para confirmar que la plata va a donde tiene
                            que ir. Como la fila del titular no tenía botón,
                            quedaba un hueco a la derecha que parecía un botón
                            que no cargó.

                            Ahora el titular es la línea de control al pie de la
                            misma tarjeta, y el valor de cada dato ocupa todo el
                            ancho — el CVU son 22 dígitos y antes compartía el
                            renglón con el botón. */}
                        <div className="rounded-[20px] mt-3" style={{ background: PANEL, padding: '4px 18px' }}>
                            {([
                                { k: 'alias', label: 'Alias', visible: DATOS_DE_PAGO.alias, copia: DATOS_DE_PAGO.alias },
                                { k: 'cvu', label: 'CVU', visible: DATOS_DE_PAGO.cvuVisible, copia: DATOS_DE_PAGO.cvu },
                            ] as { k: string; label: string; visible: string; copia: string }[]).map((d, i) => (
                                <div
                                    key={d.k}
                                    style={{ padding: '14px 0', borderTop: i === 0 ? 'none' : '1px solid #ecebe8' }}
                                >
                                    <div className="flex items-center gap-3">
                                        <p className="flex-1" style={{ ...fuente(600, '12.5px'), color: 'rgba(0,0,0,.55)', margin: 0 }}>
                                            {d.label}
                                        </p>
                                        {/* Apagado en reposo y encendido al copiar: el
                                            negro de esta pantalla es del monto. Dos
                                            píldoras negras acá le robaban el golpe. */}
                                        <button
                                            type="button"
                                            onClick={() => copiar(d.k, d.copia)}
                                            className="h-9 px-3.5 rounded-full border-0 cursor-pointer flex-none transition-colors"
                                            style={{
                                                ...fuente(600, '12.5px'),
                                                background: copiado === d.k ? INK : CAMPO,
                                                color: copiado === d.k ? '#fff' : INK,
                                            }}
                                        >
                                            {copiado === d.k ? 'Copiado' : 'Copiar'}
                                        </button>
                                    </div>
                                    <p
                                        style={{
                                            ...fuente(600, '16px', '1.35'),
                                            color: INK,
                                            margin: '2px 0 0',
                                            overflowWrap: 'anywhere',
                                        }}
                                    >
                                        {d.visible}
                                    </p>
                                </div>
                            ))}

                            {/* El titular no se copia: se chequea. Por eso va como
                                frase y no como dato con botón. */}
                            <div style={{ padding: '14px 0', borderTop: '1px solid #ecebe8' }}>
                                <p style={{ ...fuente(500, '13px', '1.5'), color: 'rgba(0,0,0,.6)', margin: 0 }}>
                                    Antes de confirmar, fijate que figure{' '}
                                    <strong style={{ fontWeight: 600, color: INK }}>{DATOS_DE_PAGO.titular}</strong>,
                                    CUIT {DATOS_DE_PAGO.cuit}.
                                </p>
                            </div>
                        </div>

                        {/* Sin el rótulo "COMPROBANTE" arriba: la caja ya dice qué
                            es, y una etiqueta en mayúsculas encima sólo sumaba una
                            línea para leer. */}
                        <div className="mt-4">
                        {subiendo ? (
                            <div className="h-24 rounded-[22px] flex flex-col items-center justify-center gap-1.5" style={{ background: PANEL }}>
                                <Loader2 className="w-5 h-5 animate-spin" style={{ color: INK }} />
                                <span style={{ ...fuente(600, '14px'), color: INK }}>Achicando y subiendo la imagen…</span>
                                <span style={{ ...fuente(500, '12.5px'), color: 'rgba(0,0,0,.55)' }}>No cierres esta pantalla.</span>
                            </div>
                        ) : comprobante ? (
                            <div className="rounded-[20px] flex items-center gap-3" style={{ background: PANEL, padding: 10 }}>
                                <div
                                    className="w-[60px] h-[60px] rounded-[14px] flex-none"
                                    style={{
                                        // El rayado va siempre de fondo: una captura con
                                        // transparencia encima dejaba un hueco que parecía
                                        // un error de carga.
                                        backgroundColor: '#ecebe8',
                                        backgroundImage: vistaPrevia
                                            ? `url(${vistaPrevia}), repeating-linear-gradient(135deg,#ecebe8 0 6px,#e2e1dd 6px 12px)`
                                            : 'repeating-linear-gradient(135deg,#ecebe8 0 6px,#e2e1dd 6px 12px)',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="truncate" style={{ ...fuente(600, '14px'), color: INK, margin: 0 }}>{comprobante.nombre}</p>
                                    <p style={{ ...fuente(500, '12.5px'), color: VERDE, margin: '3px 0 0' }}>Comprobante cargado</p>
                                </div>
                                <label
                                    className="h-[38px] px-3.5 rounded-full flex items-center cursor-pointer flex-none"
                                    style={{ ...fuente(600, '12.5px'), background: '#fff', color: INK }}
                                >
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={e => { quitarComprobante(); elegirComprobante(e.target.files?.[0]); }}
                                    />
                                    Cambiar
                                </label>
                            </div>
                        ) : (
                            <label
                                /* Relleno y alineado a la izquierda, no un recuadro
                                   punteado centrado: el punteado dice "arrastrá un
                                   archivo acá" y acá nadie arrastra nada — es una
                                   persona con el teléfono, volviendo de la app del
                                   banco. Es un botón, y se parece a los demás
                                   bloques de la pantalla. */
                                className="rounded-[20px] flex items-center gap-3.5 cursor-pointer"
                                style={{ background: PANEL, padding: '16px 18px' }}
                            >
                                <input type="file" accept="image/*" className="hidden" onChange={e => elegirComprobante(e.target.files?.[0])} />
                                <span
                                    className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-none"
                                    style={{ background: INK }}
                                >
                                    <Plus className="w-[18px] h-[18px]" style={{ color: '#fff' }} strokeWidth={2.4} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block" style={{ ...fuente(600, '15px'), color: INK }}>
                                        Subí la captura de la transferencia
                                    </span>
                                    <span className="block" style={{ ...fuente(500, '12.5px', '1.5'), color: 'rgba(0,0,0,.55)', marginTop: 2 }}>
                                        Una imagen. Es lo último que falta para terminar.
                                    </span>
                                </span>
                            </label>
                        )}
                        {errorComprobante && (
                            <p style={{ ...fuente(600, '13px', '1.5'), color: ROJO, margin: '10px 2px 0' }}>{errorComprobante}</p>
                        )}
                        </div>

                        {errorEnvio && (
                            <div className="rounded-[18px] mt-4" style={{ background: AMBAR, padding: '14px 16px' }}>
                                <p style={{ ...fuente(600, '13.5px'), color: INK, margin: 0 }}>
                                    {errorEnvio.conexion ? 'No se pudo guardar' : 'Revisá esto antes de seguir'}
                                </p>
                                <p style={{ ...fuente(500, '13px', '1.55'), color: '#5c3b0b', margin: '6px 0 0' }}>{errorEnvio.texto}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Paso 7 — confirmación */}
                {pantalla === 7 && resultado && (
                    <div className="pt-8 pb-4">
                        <div className="text-center">
                            <div className="w-[60px] h-[60px] mx-auto rounded-full flex items-center justify-center" style={{ background: '#eaf6ee' }}>
                                <Check className="w-[26px] h-[26px]" style={{ color: VERDE }} strokeWidth={2.6} />
                            </div>
                            <h1 style={{ ...fuente(600, '26px', '1.2'), color: INK, letterSpacing: '-.02em', margin: '18px 0 0' }}>
                                {agregando ? 'Quedaron sumados' : 'Quedaron anotados'}
                            </h1>
                            <p style={{ ...fuente(500, '14.5px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '10px auto 0', maxWidth: 400 }}>
                                {agregando
                                    ? 'Están en la misma inscripción que ya tenías. El QR y el código no cambiaron: si guardaste la entrada, esa misma sirve para todos.'
                                    : `La entrada también te llega por email a ${adulto.email || 'tu correo'}. Puede demorar un rato, por eso te la dejamos acá.`}
                            </p>
                        </div>
                        <div className="rounded-[24px] mt-5 flex flex-col items-center" style={{ background: PANEL, padding: 22 }}>
                            <div ref={qrRef} className="rounded-[18px] bg-white" style={{ padding: 14 }}>
                                <QRCodeSVG value={resultado.inscripcionId || ''} size={168} level="M" bgColor="#ffffff" fgColor={INK} />
                            </div>
                            <p style={{ ...fuente(600, '14px'), color: INK, margin: '14px 0 0' }}>Entrada · {resultado.codigoEntrada}</p>
                            <p className="text-center" style={{ ...fuente(500, '12.5px', '1.5'), color: 'rgba(0,0,0,.6)', margin: '5px 0 0' }}>
                                Guardala o sacale captura: es lo que se escanea en la puerta. Si el QR no se lee, el código alcanza.
                            </p>
                            <button
                                type="button"
                                onClick={guardarEntrada}
                                className="h-12 rounded-full border-0 cursor-pointer mt-3.5"
                                style={{ ...fuente(600, '14.5px'), background: INK, color: '#fff', paddingLeft: 22, paddingRight: 22 }}
                            >
                                Guardar la entrada
                            </button>
                        </div>
                        <div className="mt-3.5">
                            {([
                                [varios ? 'Jóvenes' : 'Joven', enLista(chicos.map(c => `${c.nombre} ${c.apellido}`.trim() || 'Sin nombre'))],
                                ['A nombre de', nombreAdulto || '—'],
                                ['Retiro', retiroTexto],
                                ['Pagado', plata(resultado.total ?? total)],
                            ] as [string, string][]).map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-3.5" style={{ padding: '12px 4px', borderBottom: '1px solid #f0efec' }}>
                                    <span style={{ ...fuente(500, '13.5px'), color: 'rgba(0,0,0,.6)' }}>{k}</span>
                                    <span className="text-right" style={{ ...fuente(600, '13.5px'), color: INK }}>{v}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col mt-5">
                            <Boton variante="suave" onClick={() => navigate('/')}>Volver al inicio</Boton>
                        </div>
                    </div>
                )}
            </main>

            {/* Deshacer el quitado de un joven */}
            {quitado && pantalla === 2 && (
                <div className="fixed left-4 right-4 z-30 flex justify-center pointer-events-none" style={{ bottom: 104 }}>
                    <div
                        className="pointer-events-auto w-full rounded-[18px] flex items-center gap-3"
                        style={{ maxWidth: 420, background: INK, padding: '10px 10px 10px 18px' }}
                    >
                        <span className="flex-1 min-w-0" style={{ ...fuente(600, '13.5px'), color: '#fff' }}>
                            Quitaste a {quitado.chico.nombre.trim() || 'un joven'}
                        </span>
                        <button
                            type="button"
                            onClick={deshacerQuitar}
                            className="h-[38px] px-4 rounded-full border-0 cursor-pointer flex-none"
                            style={{ ...fuente(600, '13px'), background: '#fff', color: INK }}
                        >
                            Deshacer
                        </button>
                    </div>
                </div>
            )}

            {/* Pie
                ──────────────────────────────────────────────────────────
                `fixed` y no `sticky`. Un elemento sticky se ancla sólo
                mientras su contenedor está a la vista: al llegar al final de
                la página el pie se despegaba y se iba con el scroll, que es
                justo lo que no tiene que pasar con el precio y el botón de
                seguir. Fijo a la ventana no se mueve nunca, y la zona que
                scrollea queda entre la barra de progreso y esta barra. */}
            {hayPie && (
                <div className="fixed bottom-0 left-0 right-0 z-20" style={{ background: '#fff', borderTop: '1px solid #efeeeb' }}>
                    <div
                        className="mx-auto px-[18px] lg:px-10 pt-3"
                        style={{ maxWidth: 596, paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}
                    >
                        <div className="flex items-center gap-3.5">
                            {(pantalla === 2 || pantalla === 6) && (
                                <div className="flex-1 min-w-0">
                                    <p style={{ ...fuente(600, '17px'), color: INK, margin: 0 }}>{plata(total)}</p>
                                    <p style={{ ...fuente(500, '12.5px'), color: 'rgba(0,0,0,.58)', margin: '2px 0 0' }}>
                                        {cantidad
                                            ? `${cantidad} ${cantidad === 1 ? 'joven' : 'jóvenes'} × ${plata(precio)}`
                                            : 'Agregá al menos un joven'}
                                    </p>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={seguir}
                                disabled={enviando || buscandoGrupo}
                                // Sin aria-disabled a propósito: el botón se ve
                                // apagado pero responde, y al tocarlo dice qué
                                // falta. Anunciarlo como deshabilitado sería
                                // mentirle a quien usa lector de pantalla.
                                aria-describedby={intento && !puedeSeguir ? 'noc-pendiente' : undefined}
                                className={`h-[54px] rounded-full border-0 flex items-center justify-center gap-2 ${pantalla === 2 || pantalla === 6 ? 'flex-none' : 'flex-1'}`}
                                style={{
                                    padding: '0 30px',
                                    ...fuente(600, '15.5px'),
                                    background: puedeSeguir ? INK : '#c9c8c4',
                                    color: '#fff',
                                    cursor: enviando ? 'default' : 'pointer',
                                }}
                            >
                                {(enviando || buscandoGrupo) && <Loader2 className="w-4 h-4 animate-spin" />}
                                {enviando ? 'Guardando…' : buscandoGrupo ? 'Revisando…' : etiquetaSeguir}
                            </button>
                        </div>
                        {intento && !puedeSeguir && !(pantalla === 1 && adultoEsMenor) && (
                            <p id="noc-pendiente" role="status" style={{ ...fuente(500, '12.5px'), color: AMBAR_INK, margin: '10px 0 0' }}>{pendienteTexto}</p>
                        )}
                    </div>
                </div>
            )}

            {/* El aviso: con ese DNI ya hay una inscripción.
                ────────────────────────────────────────────────────────────
                Aparece al salir del paso de sus datos y no al final, que es
                donde aparecía antes: para entonces ya transfirió. */}
            {aviso && (
                <div
                    className="fixed inset-0 z-40 flex justify-center items-end lg:items-center"
                    style={{ background: 'rgba(10,10,10,.42)', padding: 12 }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="w-full rounded-[26px]" style={{ maxWidth: 440, background: '#fff', padding: '24px 22px 20px' }}>
                        {aviso.verificado ? (
                            <>
                                <p style={{ ...fuente(600, '19px', '1.3'), color: INK, margin: 0 }}>
                                    Ya tenés una inscripción
                                </p>
                                <p style={{ ...fuente(500, '14px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '10px 0 0' }}>
                                    Con tu DNI ya {(aviso.chicos?.length ?? 0) === 1 ? 'hay un joven anotado' : `hay ${aviso.chicos?.length ?? 0} jóvenes anotados`} para Nocturna. No hace falta hacer otra: podés sumar a quien falte acá mismo y queda todo en la misma entrada.
                                </p>

                                <div className="mt-4">{listaDeChicos(aviso.chicos ?? [])}</div>

                                <p style={{ ...fuente(500, '12.5px', '1.55'), color: 'rgba(0,0,0,.5)', margin: '10px 2px 0' }}>
                                    A ellos no los vas a poder editar desde acá. Si hay algo para corregir, escribinos al {TELEFONO_CONTACTO}.
                                </p>

                                <div className="flex flex-col gap-2 mt-5">
                                    <Boton onClick={sumarAEsteGrupo}>Sumar a alguien más</Boton>
                                    <Boton variante="suave" onClick={() => setAviso(null)}>Revisar mis datos</Boton>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Sin la fecha de nacimiento no se muestra NADA de
                                    esa inscripción: son chicos, y el DNI de un
                                    desconocido no puede ser la llave para verlos. */}
                                <p style={{ ...fuente(600, '19px', '1.3'), color: INK, margin: 0 }}>
                                    Ya hay una inscripción con ese DNI
                                </p>
                                <p style={{ ...fuente(500, '14px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '10px 0 0' }}>
                                    Si es tuya, revisá la fecha de nacimiento: tiene que ser la misma que cargaste cuando te inscribiste. Si no es tuya, fijate que el DNI esté bien escrito.
                                </p>
                                <p style={{ ...fuente(500, '14px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '12px 0 0' }}>
                                    Si sigue sin andar, escribinos al {TELEFONO_CONTACTO} y lo vemos.
                                </p>
                                <div className="flex flex-col gap-2 mt-5">
                                    <Boton onClick={() => setAviso(null)}>Revisar mis datos</Boton>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Cambiar de cuenta, desde la portada */}
            {modalSalir && (
                <div
                    className="fixed inset-0 z-40 flex justify-center items-end lg:items-center"
                    style={{ background: 'rgba(10,10,10,.42)', padding: 12 }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="w-full rounded-[26px]" style={{ maxWidth: 420, background: '#fff', padding: '24px 22px 20px' }}>
                        <p style={{ ...fuente(600, '19px', '1.3'), color: INK, margin: 0 }}>¿Usar otra cuenta?</p>
                        <p style={{ ...fuente(500, '14px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '10px 0 0' }}>
                            Se cierra la sesión{cuenta?.nombre ? ` de ${cuenta.nombre}` : ''} en este dispositivo. Lo que hayas cargado de esta inscripción se borra.
                        </p>
                        <div className="flex flex-col gap-2 mt-5">
                            <Boton onClick={() => setModalSalir(false)}>Seguir con esta cuenta</Boton>
                            <Boton variante="suave" onClick={cerrarSesionYVolver}>Cerrar sesión</Boton>
                        </div>
                    </div>
                </div>
            )}
        </Marco>
    );
};

export default InscripcionNocturna;

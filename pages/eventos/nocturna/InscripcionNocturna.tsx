import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Loader2, Lock, Plus } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useBloqueoDeFondo } from '../../../hooks/useBloqueoDeFondo';
import { probarConexionBase, supabaseService } from '../../../services/supabaseService';
import { safeUUID } from '../../../services/uuidUtils';
import { calcularEdad, QUIENES_ENTRAN } from '../../../src/utils/nocturna';
import {
    ADULTO_VACIO,
    AdultoForm,
    adultoCompleto,
    adultoEsMenorDeEdad,
    armarPayloadNocturna,
    avisoDeEdadDelChico,
    ChicoForm,
    chicoFueraDeEdad,
    chicosCompletos,
    DNI_MINIMO,
    enLista,
    faltanDelChico,
    OTRO_VACIO,
    OtroForm,
    plata,
    RESTRICCIONES,
    retiroCompleto,
    soloDigitos,
    TEXTO_AUTORIZACION,
    TEXTO_FOTOS,
    TRIBUS,
    VERSION_DECLARACIONES,
} from './compartido/formulario';
import {
    anillo,
    arch,
    BotonNoc,
    BotonPulsera,
    Calma,
    Confeti,
    Corchetes,
    EnlaceNoc,
    Esquinas,
    ESTILOS_NOCTURNA,
    Fondo,
    LIMA,
    NEGRO,
    Pie,
    precargarFuentes,
    ROSA,
    TituloLetras,
    Tramo,
    Progreso,
} from './estilo';
import {
    NocturnaAltaResultado,
    NocturnaChicoDelGrupo,
    NocturnaConfig,
    NocturnaGrupo,
    NocturnaRestriccion,
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
const FONDO = ROSA;

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

// Los datos del evento, como los dice el diseño: cortos, con barras, para
// que entren en una línea y se lean de un vistazo. La regla de quién puede ir
// NO está acá: es QUIENES_ENTRAN, en src/utils/nocturna.ts, y se muestra tal
// cual (los textos de las reglas no los cambia el diseño).
const EVENTO = {
    fecha: 'Viernes 30.10 // 11 PM - 6 AM',
    lugar: 'Av. Eva Perón 3932',
    /** El encabezado del talón de la entrada. */
    talon: 'Nocturna // vie 30.10 // 11 PM - 6 AM',
};

const ARBOL = '/nocturna/origen-arbol.png';

// La app usa HashRouter: para navegar alcanza la ruta pelada, pero un link
// que se copia y se pega en WhatsApp necesita el '#'.
const RUTA = '/nocturna-inscripcion';

// ── Borrador ──────────────────────────────────────────────────────────────
// sessionStorage, no localStorage: tiene que sobrevivir que el celular
// descarte la pestaña mientras la persona está en la app del banco copiando
// el alias, pero no quedar guardado para siempre en un dispositivo
// compartido. Son datos de menores.
const CLAVE_BORRADOR = 'nocturna.inscripcion.borrador';
const VERSION_BORRADOR = 3;

interface Comprobante {
    path: string;
    nombre: string;
}

// 6 es la de comida y 7 la del pago; la 8 es el final. Si se agrega una
// pantalla en el medio hay que mover TODOS los números de acá abajo: la barra
// de pasos, puedeSeguir, el borrador y los saltos de `agregando`.
type Pantalla = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'noAut';

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
    restriccion: NocturnaRestriccion | null;
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
    restriccion: 'ninguna',
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
    /* Los campos de los pasos que todavía no tienen el diseño nuevo (1, 3 a
       7). El alto de la página y el resto viven en estilo/estilos.ts. */
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

const Marco: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    precargarFuentes();
    return (
        <div id="nocturna-inscripcion">
            <style>{ESTILOS_NOCTURNA + ESTILOS}</style>
            {children}
        </div>
    );
};

/**
 * Lo que la pantalla le muestra a la persona como "lo que sigue" o "lo que
 * falta" es sólo texto: se arma con el mismo estado y las mismas reglas que
 * deciden si puede seguir (compartido/formulario.ts), nunca con otras.
 */
const listaFaltantes = (pares: [boolean, string][]) => pares.filter(([falta]) => falta).map(([, nombre]) => nombre);

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
    /**
     * La respuesta de la familia sobre comida.
     *
     * Lo que se guarda es la restricción de CADA adolescente (vive en su ficha);
     * esto es la pregunta de la pantalla, que hace falta aparte para
     * distinguir "dijo que ninguno" de "todavía no contestó". Las dos dejan a
     * todos en 'ninguna'.
     */
    const [restriccion, setRestriccion] = useState<NocturnaRestriccion | null>(null);
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
     * En el iPhone había un segundo bache que en Chrome no se ve: el wrapper
     * del Layout mide `min-h-screen` (100vh, el viewport grande de Safari) y
     * esta página mide 100dvh (el chico, con la barra de abajo visible). La
     * diferencia es justo el alto de esa barra, y ahí asomaba el slate-50 del
     * wrapper —que pinta su propio fondo, encima del <body>—. En Chrome los
     * dos altos son iguales y el bache no existe, por eso pasó la primera
     * medición. El wrapper queda transparente y deja ver el fondo del body.
     *
     * Se arregla desde acá y no desde el Layout porque el color es de esta
     * pantalla; al desmontarse, todo vuelve como estaba.
     */
    useEffect(() => {
        const main = document.getElementById('main-content');
        const wrapper = main?.closest<HTMLElement>('.min-h-screen') ?? null;
        const fondoPrevio = document.body.style.backgroundColor;
        const padPrevio = main ? main.style.paddingBottom : '';
        const fondoWrapperPrevio = wrapper ? wrapper.style.backgroundColor : '';
        document.body.style.backgroundColor = FONDO;
        if (main) main.style.paddingBottom = '0px';
        if (wrapper) wrapper.style.backgroundColor = 'transparent';
        return () => {
            document.body.style.backgroundColor = fondoPrevio;
            if (main) main.style.paddingBottom = padPrevio;
            if (wrapper) wrapper.style.backgroundColor = fondoWrapperPrevio;
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
                        setRestriccion(b.restriccion ?? null);
                        setComprobante(b.comprobante ?? null);
                        if (b.grupo?.verificado) setGrupo(b.grupo);
                        const paso = Math.min(7, Math.max(1, Number(b.paso) || 1));
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
        if (typeof paso !== 'number' || paso < 1 || paso > 7) return;
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
            restriccion,
            comprobante,
            grupo,
        };
        try { sessionStorage.setItem(CLAVE_BORRADOR, JSON.stringify(b)); } catch { /* sin storage */ }
    }, [cargando, config, pantalla, adulto, chicos, retiro, retiroQuien, otro, autoriza, fotos, restriccion, comprobante]);

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
    const nombres = chicos.map(c => c.nombre.trim() || 'un adolescente');

    const edadAdulto = calcularEdad(adulto.nac);
    const adultoEsMenor = adultoEsMenorDeEdad(adulto);

    // Las reglas viven en compartido/formulario.ts: el panel valida igual.
    const faltan = faltanDelChico;
    const incompletos = chicos.filter(c => faltan(c).length > 0);

    const ok1 = adultoCompleto(adulto);
    const ok2 = chicosCompletos(chicos);
    const ok3 = retiroCompleto(retiro === null ? null : retiro === 'si', retiroQuien, otro);

    // Contestó lo de comida: o dijo que ninguno, o dijo cuál y marcó a
    // alguien. Decir "celíaco" sin decir quién no le sirve a la cocina.
    const ok6 = restriccion !== null
        && (restriccion === 'ninguna' || chicos.some(c => c.restriccion !== 'ninguna'));

    const puedeSeguir = ((): boolean => {
        switch (pantalla) {
            case 1: return ok1;
            case 2: return ok2;
            case 3: return ok3;
            case 4: return autoriza === true;
            case 5: return fotos !== null;
            case 6: return ok6;
            case 7: return !!comprobante && !subiendo;
            default: return false;
        }
    })();

    const hayPie = typeof pantalla === 'number' && pantalla >= 1 && pantalla <= 7;

    // Para el resumen del final: "Celíaco: Lucas", o "Celíaco: Lucas ·
    // Diabetes: Bruno" si hay de las dos. Vacío si no hay nada.
    //
    // Agrupado por restricción y no por chico: antes se tomaba la del primero
    // y se le colgaban todos los nombres, así que con dos restricciones
    // distintas el resumen decía que el diabético era celíaco.
    const textoRestricciones = RESTRICCIONES
        .filter(r => r.valor !== 'ninguna')
        .map(r => {
            const quienes = chicos.filter(c => c.restriccion === r.valor);
            if (quienes.length === 0) return '';
            return `${r.corto}: ${enLista(quienes.map(c => c.nombre.trim() || 'un adolescente'))}`;
        })
        .filter(Boolean)
        .join(' · ');

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
    const ultimoPaso = agregando ? 6 : 7;
    // Sumando, la pantalla de fotos no se muestra: las que quedan son seis y
    // se numeran de 1 a 6, aunque por dentro sean la 6 y la 7.
    const pasoMostrado = !agregando ? pantalla
        : pantalla === 6 ? 5
            : pantalla === 7 ? 6
                : pantalla;

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

    /**
     * Qué restricción se está marcando.
     *
     * La restricción es de cada adolescente, no de la familia: en una casa
     * puede haber un celíaco y un diabético, y la base lo guarda por chico.
     * Estos tres botones eligen CUÁL se está marcando, y abajo se marca a
     * quiénes; cambiar de botón no toca lo que ya se marcó.
     *
     * Hasta el 2026-10-06 sí lo tocaba: elegir "diabetes" devolvía a
     * "ninguna" a todos los celíacos ya marcados. La familia no se enteraba
     * —el nombre seguía ahí, pero bajo la otra respuesta— y a la cocina le
     * llegaba una restricción de menos.
     *
     * "Ninguna" sigue siendo la respuesta de toda la familia: borra lo
     * marcado, porque es decir que nadie tiene nada.
     *
     * Con un solo adolescente no hay a quién elegir, así que se marca solo y
     * cambiar de respuesta le cambia la suya.
     */
    const elegirRestriccion = (valor: NocturnaRestriccion) => {
        setRestriccion(valor);
        if (valor === 'ninguna') {
            setChicos(cs => cs.map(c => ({ ...c, restriccion: 'ninguna' })));
            return;
        }
        setChicos(cs => (cs.length === 1 ? cs.map(c => ({ ...c, restriccion: valor })) : cs));
    };

    const alternarRestriccionDe = (id: string) => {
        if (!restriccion || restriccion === 'ninguna') return;
        setChicos(cs => cs.map(c => (
            c.id === id
                ? { ...c, restriccion: c.restriccion === restriccion ? 'ninguna' : restriccion }
                : c
        )));
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
        irA(8);
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
        if (pantalla === 7) { enviar(); return; }
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

    // La portada ya no se muestra sin la barra de la app: en el diseño nuevo
    // la barra está en todas las pantallas, también en la primera.

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

    // ── Lo que dice el pie ────────────────────────────────────────────────
    // Sólo texto: si puede seguir lo deciden puedeSeguir y las reglas de
    // compartido/formulario.ts. Esto le cuenta a la persona qué le falta.
    const loLos = varios ? 'los' : 'lo';
    const faltaTexto = ((): string => {
        if (pantalla === 1) {
            const f = listaFaltantes([
                [!adulto.nombre.trim(), 'nombre'],
                [!adulto.apellido.trim(), 'apellido'],
                [adulto.dni.trim().length < DNI_MINIMO, 'DNI'],
                [!adulto.email.trim(), 'email'],
                [!adulto.nac || calcularEdad(adulto.nac) === null, 'fecha de nacimiento'],
            ]);
            return f.length ? `Falta: ${f.join(', ')}.` : 'Revisá tus datos.';
        }
        if (pantalla === 2) {
            if (cantidad === 0) {
                return agregando ? 'Sumá al menos un adolescente nuevo para seguir.' : 'Agregá al menos un adolescente para seguir.';
            }
            if (incompletos.length === 1) {
                return `A ${incompletos[0].nombre.trim() || 'un adolescente'} le falta: ${faltan(incompletos[0]).join(', ')}.`;
            }
            if (incompletos.length > 1) return `Hay ${incompletos.length} adolescentes con datos incompletos.`;
            const fuera = chicos.filter(chicoFueraDeEdad);
            return fuera.length === 1
                ? `${fuera[0].nombre.trim() || 'Un adolescente'} no entra en la edad de Nocturna.`
                : `Hay ${fuera.length} adolescentes que no entran en la edad de Nocturna.`;
        }
        if (pantalla === 3) {
            if (retiro === null) return 'Elegí Sí o No.';
            if (!retiroQuien) return `Elegí quién ${loLos} retira.`;
            const f = listaFaltantes([
                [!otro.nombre.trim(), 'nombre'],
                [!otro.apellido.trim(), 'apellido'],
                [!otro.dni.trim(), 'DNI'],
                [!otro.telefono.trim(), 'teléfono'],
            ]);
            return f.length ? `Faltan datos de quien ${loLos} retira: ${f.join(', ')}.` : `Revisá los datos de quien ${loLos} retira.`;
        }
        if (pantalla === 4) return 'Elegí Autorizo o No autorizo.';
        if (pantalla === 5) return 'Elegí una de las dos respuestas. Cualquiera te deja seguir.';
        if (pantalla === 6) return restriccion === null ? 'Elegí una opción.' : 'Marcá quién tiene esa restricción.';
        if (pantalla === 7) return subiendo ? 'Esperá a que termine de subir el comprobante.' : 'Falta subir el comprobante.';
        return '';
    })();
    const mostrarFalta = intento && !puedeSeguir && !(pantalla === 1 && adultoEsMenor);

    const conRestriccion = chicos.filter(c => c.restriccion !== 'ninguna').length;
    const [pieTitulo, pieNota] = ((): [string, string] => {
        switch (pantalla) {
            case 1: return ['Adulto responsable', ok1 ? nombreAdulto : 'Faltan datos'];
            case 2: return [
                plata(total),
                cantidad
                    ? `${cantidad} ${agregando ? (cantidad === 1 ? 'nuevo' : 'nuevos') : (cantidad === 1 ? 'adolescente' : 'adolescentes')} × ${plata(precio)}`
                    : agregando ? 'Sumá al menos uno nuevo' : 'Agregá al menos un adolescente',
            ];
            case 3: return ['Retiro 6 AM', ok3 ? retiroTexto : 'Falta responder'];
            case 4: return ['Autorización', autoriza === true ? 'Autorizado' : 'Falta responder'];
            case 5: return ['Fotos y videos', fotos === true ? 'Aceptado' : fotos === false ? 'No aceptado // podés seguir' : 'Falta responder'];
            case 6: return [
                'Comida',
                conRestriccion
                    ? `${conRestriccion} ${conRestriccion === 1 ? 'con restricción' : 'con restricciones'}`
                    : restriccion === 'ninguna' ? 'Ninguna restricción' : 'Falta responder',
            ];
            case 7: return [plata(total), comprobante ? 'Comprobante listo' : 'Falta el comprobante'];
            default: return ['', ''];
        }
    })();
    const ocupado = enviando || buscandoGrupo;
    const etiquetaSeguir = enviando ? 'Guardando…' : buscandoGrupo ? 'Revisando…' : pantalla === 7 ? 'Listo' : 'Siguiente';

    // ── El fondo ──────────────────────────────────────────────────────────
    // Cuánto se enfoca la palabra (de 0 a 8), y cuándo baja el volumen: en lo
    // que hay que leer con calma (la autorización sin responder, las fotos,
    // la comida) y en las salidas.
    const etapa = pantalla === 'noAut' ? 4 : pantalla;
    const calma: Calma = pantalla === 'noAut' || (pantalla === 1 && adultoEsMenor)
        ? 'muy'
        : (pantalla === 4 && autoriza !== true) || (pantalla === 5 && fotos === null) || pantalla === 6
            ? 'baja'
            : 'no';

    // La barra de pasos. Sumando chicos no hay pantalla de fotos, así que el
    // tramo del medio tiene uno menos (ver pasoMostrado, más arriba).
    const tramos: Tramo[] = [
        { nombre: 'Datos', pasos: [1, 2] },
        { nombre: 'Información', pasos: agregando ? [3, 4, 5] : [3, 4, 5, 6] },
        { nombre: 'Pago', pasos: [ultimoPaso] },
    ];
    // Volver existe en los pasos 1 a 6 y en la salida sin autorización, como
    // antes. En el pago no: ahí la barra está, pero sin volver, igual que en
    // la versión anterior (que no mostraba ninguna barra en ese paso).
    const conVolver = pantalla === 'noAut' || (typeof pantalla === 'number' && pantalla >= 1 && pantalla <= 6);
    const conTramos = typeof pantalla === 'number' && pantalla >= 1 && pantalla <= 7;

    const nombreDe = (c: { nombre: string; apellido: string }, i: number) =>
        `${c.nombre} ${c.apellido}`.trim() || `Adolescente ${i + 1}`;
    const iniciales = (nombre: string) => nombre.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

    return (
        <Marco>
            <Fondo etapa={etapa} nitida={pantalla === 8} calma={calma} portada={pantalla === 0} />
            <Esquinas aQuien={QUIENES_ENTRAN} fecha={EVENTO.fecha} lugar={EVENTO.lugar} calma={calma} />

            <div className={`noc-contenido${hayPie ? ' noc-con-pie' : ''}`}>
                <div className="noc-cabecera">
                    <div className="noc-fila-marca">
                        <p className="noc-marca">Nocturna</p>
                        <p className="noc-a-quien">{QUIENES_ENTRAN}</p>
                    </div>
                    {(conVolver || conTramos) && (
                        <div className="noc-columna noc-progreso">
                            <Progreso
                                tramos={conTramos ? tramos : []}
                                actual={typeof pasoMostrado === 'number' ? pasoMostrado : 0}
                                onVolver={conVolver ? atras : undefined}
                            />
                        </div>
                    )}
                </div>

                <main className={`noc-columna${pantalla === 8 ? ' ancha' : ''}`}>
                    {/* Una pantalla nueva entra desde abajo. La key hace que la
                        animación vuelva a correr en cada cambio de paso. */}
                    <div
                        key={String(pantalla)}
                        className={`noc-cuerpo${pantalla === 0 ? ' portada' : ''}`}
                        style={{ animation: 'nocEntrada .5s cubic-bezier(.2,.8,.2,1)' }}
                    >

                {/* Paso 0 — la bienvenida */}
                {pantalla === 0 && (
                    <div>
                        <div className="noc-arbol-marco">
                            <img src={ARBOL} alt="Origen" className="noc-arbol" width={300} height={307} />
                        </div>
                        <TituloLetras texto="¡Bienvenidos a Nocturna!" centrado portada style={{ marginTop: 16 }} />
                        {/* La fecha y el lugar. En pantallas anchas están en las
                            esquinas y acá no se repiten. */}
                        <p className="noc-sin-esquinas" style={{ margin: '12px 0 0', textAlign: 'center', ...arch(800, '14px', '1.3'), letterSpacing: '-.025em', textTransform: 'uppercase' }}>
                            {EVENTO.fecha}
                            <br />
                            <Corchetes>{EVENTO.lugar}</Corchetes>
                        </p>

                        <div style={{ marginTop: 22, background: LIMA, borderRadius: 30, boxShadow: anillo(), padding: 20 }}>
                            {user ? (
                                <>
                                    <p style={{ margin: 0, ...arch(800, '11px'), letterSpacing: '.04em', textTransform: 'uppercase' }}>Entraste como</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                                        <span
                                            aria-hidden="true"
                                            style={{ width: 50, height: 50, borderRadius: 999, background: NEGRO, color: LIMA, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', ...arch(900, '17px'), letterSpacing: '-.04em' }}
                                        >
                                            {iniciales(user.name || user.email || '')}
                                        </span>
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{ margin: 0, ...arch(800, '18px'), letterSpacing: '-.03em', overflowWrap: 'anywhere' }}>{user.name || user.email}</p>
                                            {user.name && (
                                                <p style={{ margin: '2px 0 0', ...arch(500, '14px'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</p>
                                            )}
                                        </div>
                                    </div>
                                    <BotonNoc onClick={() => irA(1)} style={{ marginTop: 18 }}>
                                        {cuenta?.nombre ? `Continuar como ${cuenta.nombre}` : 'Continuar con la inscripción'}
                                    </BotonNoc>
                                    <p style={{ margin: '10px 0 0', textAlign: 'center' }}>
                                        <EnlaceNoc onClick={() => setModalSalir(true)}>Usar otra cuenta</EnlaceNoc>
                                    </p>
                                </>
                            ) : (
                                <>
                                    <BotonNoc onClick={() => irAutenticarse(false)}>Continuar iniciando sesión</BotonNoc>
                                    <BotonNoc variante="contorno" onClick={() => irA(1)} style={{ marginTop: 10 }}>Entrar sin sesión</BotonNoc>
                                    <p style={{ margin: '14px 4px 0', textAlign: 'center', ...arch(500, '14px', '1.5') }}>
                                        Si ya tenés cuenta, conviene iniciar sesión: tus datos se completan solos.
                                    </p>
                                    <p style={{ margin: '10px 0 0', textAlign: 'center' }}>
                                        <EnlaceNoc onClick={() => irAutenticarse(true)}>Registrarme en la app</EnlaceNoc>
                                    </p>
                                </>
                            )}
                        </div>
                        <p style={{ margin: '16px 0 0', textAlign: 'center' }}>
                            <EnlaceNoc onClick={() => navigate('/')}>Volver al inicio</EnlaceNoc>
                        </p>
                    </div>
                )}

                {/* Paso 1 — adulto responsable */}
                {pantalla === 1 && (
                    <div className="pt-4">
                        <Titulo>Tus datos</Titulo>
                        <Bajada>Los del adulto responsable de los adolescentes.</Bajada>
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


                {/* Paso 2 — los adolescentes */}
                {pantalla === 2 && (
                    <div>
                        <TituloLetras texto={agregando ? '¿A quién sumás?' : '¿A quién vas a anotar?'} />
                        <p style={{ margin: '10px 0 0', ...arch(600, '15px', '1.45') }}>
                            {agregando
                                ? 'Los que ya estaban quedan como están. Sumá abajo a quien falte.'
                                : 'Podés anotar a varios adolescentes en esta misma inscripción.'}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
                            {/* Los que ya están en la entrada: sin edición, sobre el
                                rosa. Sólo se sabe de ellos lo que la base deja ver
                                (nombre, tribu y el DNI tapado), no la edad. */}
                            {agregando && yaAnotados.length > 0 && (
                                <>
                                    <p style={{ margin: '0 0 -2px 4px', ...arch(900, '13px'), letterSpacing: '-.01em', textTransform: 'uppercase' }}>
                                        <Corchetes>Ya en tu entrada</Corchetes>
                                    </p>
                                    {yaAnotados.map((c, i) => {
                                        const nombre = `${c.nombre} ${c.apellido}`.trim();
                                        return (
                                            <div
                                                key={`${c.nombre}-${c.dni}-${i}`}
                                                style={{ borderRadius: 26, boxShadow: anillo(), padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}
                                            >
                                                <span aria-hidden="true" style={{ width: 50, height: 50, borderRadius: 999, background: NEGRO, color: ROSA, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', ...arch(900, '16px'), letterSpacing: '-.04em' }}>
                                                    {iniciales(nombre)}
                                                </span>
                                                <span style={{ flex: 1, minWidth: 0 }}>
                                                    <span style={{ display: 'block', ...arch(800, '17px'), letterSpacing: '-.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
                                                    <span style={{ display: 'block', marginTop: 3, ...arch(700, '13px'), textTransform: 'uppercase' }}>
                                                        {c.tribu} // DNI {c.dni}
                                                    </span>
                                                </span>
                                                <span style={{ flex: 'none', height: 30, padding: '0 11px', borderRadius: 999, boxShadow: anillo(2), display: 'flex', alignItems: 'center', ...arch(900, '11px'), textTransform: 'uppercase' }}>
                                                    Ya anotado
                                                </span>
                                            </div>
                                        );
                                    })}
                                    <p style={{ margin: '0 4px', ...arch(600, '13px', '1.5') }}>
                                        Desde acá no se editan. Si hay algo para corregir, escribinos al {TELEFONO_CONTACTO} y lo cambiamos nosotros.
                                    </p>
                                    {cantidad > 0 && (
                                        <p style={{ margin: '10px 0 -2px 4px', ...arch(900, '13px'), letterSpacing: '-.01em', textTransform: 'uppercase' }}>
                                            <Corchetes>Sumando ahora</Corchetes>
                                        </p>
                                    )}
                                </>
                            )}

                            {chicos.map((c, i) => {
                                const esteAbierto = abierto === c.id;
                                const falt = faltan(c);
                                const nombreCompleto = `${c.nombre} ${c.apellido}`.trim();
                                const edad = calcularEdad(c.nac);
                                // La regla del evento: nacidos hasta el 30/6/2014 y
                                // 18 años como máximo el día de Nocturna. Se mira
                                // aparte de `falt` porque no es un dato que falte
                                // sino uno que no entra.
                                const fueraDeEdad = chicoFueraDeEdad(c);
                                const avisoDeEdad = avisoDeEdadDelChico(c, c.nombre.trim() || 'Este adolescente');
                                const trabado = falt.length > 0 || fueraDeEdad;
                                const alerta = trabado && (intento || !esteAbierto);
                                return (
                                    <div
                                        key={c.id}
                                        style={{
                                            borderRadius: 26,
                                            background: LIMA,
                                            boxShadow: `${anillo(esteAbierto ? 3 : 2.5)}${alerta ? `, 0 0 0 4px ${NEGRO}` : ''}`,
                                        }}
                                    >
                                        {!esteAbierto ? (
                                            <button
                                                type="button"
                                                onClick={() => setAbierto(c.id)}
                                                aria-label={`${falt.length ? 'Completar' : 'Editar'} a ${nombreDe(c, i)}`}
                                                className="noc-boton"
                                                style={{ width: '100%', border: 0, background: 'transparent', padding: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left', color: NEGRO }}
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    style={{
                                                        width: 50, height: 50, borderRadius: 999, flex: 'none',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: anillo(),
                                                        background: trabado ? LIMA : NEGRO,
                                                        color: trabado ? NEGRO : LIMA,
                                                        ...arch(900, '16px'), letterSpacing: '-.04em',
                                                    }}
                                                >
                                                    {nombreCompleto ? iniciales(nombreCompleto) : String(i + 1)}
                                                </span>
                                                <span style={{ flex: 1, minWidth: 0 }}>
                                                    <span style={{ display: 'block', ...arch(800, '17px'), letterSpacing: '-.03em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {nombreDe(c, i)}
                                                    </span>
                                                    <span style={{ display: 'block', marginTop: 3, ...arch(700, '13px'), letterSpacing: '-.01em', textTransform: 'uppercase' }}>
                                                        {falt.length
                                                            ? `Falta: ${falt.join(', ')}`
                                                            : fueraDeEdad ? 'No entra en la edad de Nocturna' : `${edad} años // ${c.tribu}`}
                                                    </span>
                                                </span>
                                                <span aria-hidden="true" style={{ flex: 'none', ...arch(800, '13px'), letterSpacing: '-.02em', textTransform: 'uppercase' }}>
                                                    <Corchetes>{falt.length ? 'Completar' : fueraDeEdad ? 'Revisar' : 'Editar'}</Corchetes>
                                                </span>
                                            </button>
                                        ) : (
                                            <div style={{ padding: '18px 16px 16px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <p style={{ margin: 0, flex: 1, ...arch(900, '13px'), letterSpacing: '-.01em', textTransform: 'uppercase' }}>
                                                        {agregando ? `Nuevo ${i + 1} de ${cantidad}` : `Adolescente ${i + 1} de ${cantidad}`}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => quitarChico(c, i)}
                                                        style={{ minHeight: 44, padding: '0 4px', border: 0, background: 'transparent', ...arch(800, '13px'), color: NEGRO, cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }}
                                                    >
                                                        Quitar
                                                    </button>
                                                </div>
                                                <div className="grid gap-2 mt-2.5 grid-cols-1 lg:grid-cols-2">
                                                    <input className="noc-campo" value={c.nombre} placeholder="Nombre" aria-label="Nombre del adolescente" autoComplete="off" onChange={e => editarChico(c.id, 'nombre', e.target.value)} />
                                                    <input className="noc-campo" value={c.apellido} placeholder="Apellido" aria-label="Apellido del adolescente" autoComplete="off" onChange={e => editarChico(c.id, 'apellido', e.target.value)} />
                                                </div>
                                                <input
                                                    className="noc-campo"
                                                    style={{ marginTop: 8 }}
                                                    value={c.dni}
                                                    placeholder="DNI"
                                                    inputMode="numeric"
                                                    autoComplete="off"
                                                    aria-label="DNI del adolescente"
                                                    onChange={e => editarChico(c.id, 'dni', soloDigitos(e.target.value, 9))}
                                                />
                                                <p style={{ margin: '18px 0 8px', ...arch(800, '12px'), letterSpacing: '.03em', textTransform: 'uppercase' }}>Fecha de nacimiento</p>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <input
                                                        className="noc-campo"
                                                        style={{ flex: 1 }}
                                                        type="date"
                                                        value={c.nac}
                                                        aria-label="Fecha de nacimiento del adolescente"
                                                        onChange={e => editarChico(c.id, 'nac', e.target.value)}
                                                    />
                                                    <span
                                                        style={{
                                                            height: 58, padding: '0 16px', borderRadius: 18, flex: 'none',
                                                            display: 'flex', alignItems: 'center', whiteSpace: 'nowrap',
                                                            ...arch(900, '16px'), letterSpacing: '-.03em', textTransform: 'uppercase',
                                                            ...(edad === null || fueraDeEdad
                                                                ? { background: 'transparent', color: NEGRO, boxShadow: anillo(2) }
                                                                : { background: NEGRO, color: LIMA }),
                                                        }}
                                                    >
                                                        {edad === null ? 'Edad —' : `${edad} años`}
                                                    </span>
                                                </div>
                                                {/* Fuera de edad: el diseño no lo tiene. Va en negro,
                                                    como todo lo que en esta pantalla hay que leer
                                                    antes de seguir, y dice el dato que lo deja afuera
                                                    —la fecha, o la edad que va a tener esa noche—: si
                                                    sólo dijera la regla, quien cargó mal el año no se
                                                    daría cuenta. */}
                                                {fueraDeEdad && (
                                                    <div style={{ margin: '10px 0 0', borderRadius: 18, background: NEGRO, padding: '12px 14px' }}>
                                                        <p style={{ margin: 0, ...arch(900, '12px'), letterSpacing: '.02em', color: LIMA, textTransform: 'uppercase' }}>
                                                            <Corchetes>Fuera de edad</Corchetes>
                                                        </p>
                                                        <p style={{ margin: '6px 0 0', ...arch(700, '14px', '1.45'), color: LIMA }}>{avisoDeEdad}</p>
                                                    </div>
                                                )}
                                                <p style={{ margin: '20px 0 10px', ...arch(800, '12px'), letterSpacing: '.03em', textTransform: 'uppercase' }}>Tribu · elegí su pulsera</p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                    {TRIBUS.map(t => (
                                                        <BotonPulsera key={t} elegida={c.tribu === t} onClick={() => editarChico(c.id, 'tribu', t)}>
                                                            {t}
                                                        </BotonPulsera>
                                                    ))}
                                                </div>
                                                <BotonNoc
                                                    variante={trabado ? 'contorno' : 'negro'}
                                                    onClick={() => { if (!trabado) setAbierto(null); }}
                                                    style={{ minHeight: 58, padding: '8px 18px', marginTop: 18, ...arch(800, '15px'), cursor: trabado ? 'default' : 'pointer' }}
                                                >
                                                    {falt.length
                                                        ? `Falta: ${falt.join(', ')}`
                                                        : fueraDeEdad
                                                            ? 'No entra en la edad de Nocturna'
                                                            : `Listo, guardar a ${c.nombre.trim() || 'este adolescente'}`}
                                                </BotonNoc>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {cantidad === 0 && (
                                <div style={{ borderRadius: 26, background: LIMA, boxShadow: anillo(), padding: '24px 20px', textAlign: 'center' }}>
                                    <p style={{ margin: 0, ...arch(900, '18px'), letterSpacing: '-.04em', textTransform: 'uppercase' }}>Todavía no anotaste a nadie</p>
                                    <p style={{ margin: '6px 0 0', ...arch(600, '14px') }}>
                                        {agregando ? 'Sumá al primer adolescente nuevo para seguir.' : 'Agregá al primer adolescente para seguir.'}
                                    </p>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={agregarChico}
                                className="noc-boton"
                                style={{ minHeight: 60, border: 0, borderRadius: 26, background: 'transparent', boxShadow: anillo(), ...arch(900, '16px'), letterSpacing: '-.03em', textTransform: 'uppercase', color: NEGRO, cursor: 'pointer' }}
                            >
                                <Corchetes>
                                    <span aria-hidden="true">+ </span>
                                    {agregando
                                        ? (cantidad ? 'Sumar otro adolescente' : 'Sumar un adolescente')
                                        : (cantidad ? 'Agregar otro adolescente' : 'Agregar un adolescente')}
                                </Corchetes>
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

                {/* Paso 6 — comida */}
                {pantalla === 6 && (
                    <div className="pt-4">
                        <Titulo>Comida</Titulo>
                        <Bajada>Una sola pregunta, y es para que haya algo que puedan comer todos.</Bajada>

                        <div className="rounded-[20px] mt-5" style={{ background: PANEL, padding: 20 }}>
                            <p style={{ ...fuente(600, '15px'), color: INK, margin: 0 }}>
                                ¿Alguno tiene una restricción alimentaria?
                            </p>
                            <p style={{ ...fuente(500, '14.5px', '1.65'), color: 'rgba(0,0,0,.66)', margin: '8px 0 0' }}>
                                En Nocturna se come, y la comida se compra antes. Si alguno es celíaco o tiene diabetes, avisanos acá y le preparamos lo suyo aparte. Si no, elegí “Ninguna” y seguí.
                            </p>
                        </div>

                        {/* En el teléfono una abajo de la otra, en pantalla grande
                            las tres en fila: son tres botones cortos y apilados en
                            un monitor quedan tres renglones de nada. */}
                        <div className="grid gap-2 mt-4 sm:grid-cols-3">
                            {RESTRICCIONES.map(r => (
                                <Opcion
                                    key={r.valor}
                                    activa={restriccion === r.valor}
                                    onClick={() => elegirRestriccion(r.valor)}
                                >
                                    {r.etiqueta}
                                </Opcion>
                            ))}
                        </div>

                        {restriccion !== null && restriccion !== 'ninguna' && (
                            <div className="mt-5">
                                <Rotulo margen="0 2px 10px">
                                    {chicos.length === 1 ? 'QUIÉN' : '¿QUIÉNES? PODÉS MARCAR VARIOS'}
                                </Rotulo>

                                {/* Casillas y no un menú desplegable: elegir de una
                                    lista corta con el pulgar es un toque por persona,
                                    y un <select multiple> en el celular se opera
                                    peleando con el teclado. */}
                                <div className="flex flex-col gap-2">
                                    {chicos.map(c => {
                                        const marcado = c.restriccion === restriccion;
                                        const nombreChico = `${c.nombre} ${c.apellido}`.trim();
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => alternarRestriccionDe(c.id)}
                                                aria-pressed={marcado}
                                                className="border-0 rounded-[20px] cursor-pointer flex items-center gap-3 text-left transition-colors"
                                                style={{
                                                    minHeight: 58,
                                                    padding: '14px 16px',
                                                    background: marcado ? INK : CAMPO,
                                                    color: marcado ? '#fff' : INK,
                                                }}
                                            >
                                                <span
                                                    className="w-[22px] h-[22px] rounded-[7px] flex items-center justify-center flex-none"
                                                    style={{
                                                        background: marcado ? '#fff' : 'transparent',
                                                        boxShadow: marcado ? 'none' : 'inset 0 0 0 1.5px rgba(0,0,0,.25)',
                                                    }}
                                                >
                                                    {marcado && <Check className="w-[14px] h-[14px]" style={{ color: INK }} strokeWidth={3} />}
                                                </span>
                                                <span className="min-w-0 truncate" style={{ ...fuente(600, '15px') }}>
                                                    {nombreChico || 'Sin nombre'}
                                                </span>
                                                {/* La otra restricción, si la tiene. Sin esto, al
                                                    cambiar de respuesta el chico aparece sin marcar
                                                    y lo suyo queda cargado sin que nadie lo vea. */}
                                                {!marcado && c.restriccion !== 'ninguna' && (
                                                    <span
                                                        className="flex-none ml-auto"
                                                        style={{ ...fuente(600, '12.5px'), color: 'rgba(0,0,0,.5)' }}
                                                    >
                                                        {RESTRICCIONES.find(r => r.valor === c.restriccion)?.corto}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                <p style={{ ...fuente(500, '12.5px', '1.55'), color: 'rgba(0,0,0,.55)', margin: '10px 2px 0' }}>
                                    Esto lo ve el equipo de cocina. No es un diagnóstico ni queda en ningún otro lado.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Paso 7 — pago */}
                {pantalla === 7 && (
                    <div className="pt-4">
                        <Titulo>Pago</Titulo>
                        <div className="rounded-[22px] mt-4" style={{ background: INK, padding: 20 }}>
                            <p style={{ ...fuente(600, '13px'), color: 'rgba(255,255,255,.6)', margin: 0 }}>Total a transferir</p>
                            <p style={{ ...fuente(600, '36px'), color: '#fff', letterSpacing: '-.03em', margin: '6px 0 0' }}>{plata(total)}</p>
                            <p style={{ ...fuente(500, '13px'), color: 'rgba(255,255,255,.66)', margin: '4px 0 0' }}>
                                {cantidad} {cantidad === 1 ? 'adolescente' : 'adolescentes'} × {plata(precio)}
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
                                        accept="image/*,.jpg,.jpeg,.png,.webp,.heic"
                                        /* sr-only y no hidden: `hidden` es display:none, y
                                           hay navegadores embebidos de Android que no abren
                                           el selector de un input que no está renderizado.
                                           Así queda invisible pero existiendo. */
                                        className="sr-only"
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
                                {/* sr-only y no hidden: ver el otro input de más
                                    arriba. Y `accept` con extensiones además del
                                    image/*: hay selectores de Android que muestran
                                    menos lugares de dónde sacar el archivo cuando
                                    sólo ven el comodín. */}
                                <input
                                    type="file"
                                    accept="image/*,.jpg,.jpeg,.png,.webp,.heic"
                                    className="sr-only"
                                    onChange={e => elegirComprobante(e.target.files?.[0])}
                                />
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


                {/* Paso 8 — la entrada */}
                {pantalla === 8 && resultado && (
                    <div style={{ position: 'relative' }}>
                        <Confeti />
                        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                            <span aria-hidden="true" className="noc-sonrisa">:)</span>
                            <TituloLetras
                                texto={agregando ? '¡Ya están todos!' : '¡Quedaron anotados!'}
                                centrado
                                demora={450}
                                style={{ marginTop: 8 }}
                            />
                            <p style={{ margin: '12px auto 0', maxWidth: 420, ...arch(600, '15px', '1.5') }}>
                                {agregando
                                    ? 'Están en la misma inscripción que ya tenías. El QR y el código no cambiaron: si guardaste la entrada, esa misma sirve para todos.'
                                    : `Esta es la entrada de toda la familia. También te llega por email a ${adulto.email || 'tu correo'}: puede demorar, por eso te la dejamos acá.`}
                            </p>
                        </div>

                        {/* La entrada. El QR va sobre blanco firme y sin nada
                            encima: ni el confeti —que cae por detrás— ni una
                            animación. Se escanea y se captura limpio desde que
                            aparece. */}
                        <div className="noc-entrada">
                            <div style={{ background: '#ffffff', padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div
                                    ref={qrRef}
                                    role="img"
                                    aria-label={`Código QR de la entrada ${resultado.codigoEntrada || ''}`.trim()}
                                    style={{ width: '100%', maxWidth: 240, background: '#ffffff' }}
                                >
                                    <QRCodeSVG
                                        value={resultado.inscripcionId || ''}
                                        size={240}
                                        level="M"
                                        bgColor="#ffffff"
                                        fgColor="#000000"
                                        aria-hidden="true"
                                        style={{ display: 'block', width: '100%', height: 'auto' }}
                                    />
                                </div>
                                <p style={{ margin: '16px 0 0', ...arch(800, '11px'), letterSpacing: '.06em', textTransform: 'uppercase' }}>Código de entrada</p>
                                <p style={{ margin: '4px 0 0', ...arch(900, '30px'), letterSpacing: '.06em' }}>{resultado.codigoEntrada}</p>
                                <p style={{ margin: '8px 0 0', maxWidth: 260, textAlign: 'center', ...arch(600, '13px', '1.45') }}>
                                    Un solo QR para todos. En la puerta también sirve el nombre del adulto.
                                </p>
                            </div>
                            <div className="noc-entrada-talon">
                                <p style={{ margin: 0, ...arch(900, '13px'), letterSpacing: '-.01em', textTransform: 'uppercase' }}>
                                    <Corchetes>{EVENTO.talon}</Corchetes>
                                </p>
                                <div style={{ marginTop: 12 }}>
                                    {([
                                        [varios ? 'Adolescentes' : 'Adolescente', enLista(chicos.map(c => `${c.nombre} ${c.apellido}`.trim() || 'Sin nombre'))],
                                        ['A nombre de', nombreAdulto || '—'],
                                        ['Retiro 6 AM', retiroTexto],
                                        ...(textoRestricciones ? [['Comida', textoRestricciones] as [string, string]] : []),
                                        ['Pagado', plata(resultado.total ?? total)],
                                    ] as [string, string][]).map(([k, v]) => (
                                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, padding: '11px 0', borderTop: `2px solid ${NEGRO}` }}>
                                            <span style={{ ...arch(700, '13.5px'), flex: 'none' }}>{k}</span>
                                            <span style={{ ...arch(800, '14.5px', '1.35'), letterSpacing: '-.02em', textAlign: 'right' }}>{v}</span>
                                        </div>
                                    ))}
                                </div>
                                <BotonNoc onClick={guardarEntrada} style={{ marginTop: 12 }}>Guardar la entrada</BotonNoc>
                            </div>
                        </div>
                        <p style={{ position: 'relative', zIndex: 1, margin: '16px 0 0', textAlign: 'center' }}>
                            <EnlaceNoc onClick={() => navigate('/')}>Volver al inicio</EnlaceNoc>
                        </p>
                    </div>
                )}
                    </div>
                </main>
            </div>

            {/* Deshacer el quitado de un adolescente */}
            {quitado && pantalla === 2 && (
                <div className="noc-deshacer">
                    <div
                        style={{ pointerEvents: 'auto', width: '100%', maxWidth: 420, background: LIMA, borderRadius: 22, boxShadow: `0 0 0 2.5px ${NEGRO}`, padding: '10px 10px 10px 18px', display: 'flex', alignItems: 'center', gap: 12, animation: 'nocAviso .3s ease-out' }}
                    >
                        <span style={{ flex: 1, minWidth: 0, ...arch(800, '14px'), letterSpacing: '-.02em', textTransform: 'uppercase' }}>
                            Quitaste a {quitado.chico.nombre.trim() || 'un adolescente'}
                        </span>
                        <button
                            type="button"
                            onClick={deshacerQuitar}
                            className="noc-boton noc-sobre-negro"
                            style={{ height: 44, padding: '0 18px', border: 0, borderRadius: 999, background: NEGRO, color: LIMA, ...arch(800, '13.5px'), textTransform: 'uppercase', cursor: 'pointer', flex: 'none' }}
                        >
                            Deshacer
                        </button>
                    </div>
                </div>
            )}

            {hayPie && (
                <Pie
                    titulo={pieTitulo}
                    nota={pieNota}
                    falta={mostrarFalta ? faltaTexto : undefined}
                    etiqueta={etiquetaSeguir}
                    corchetes={!ocupado}
                    listo={puedeSeguir}
                    ocupado={ocupado}
                    onSeguir={seguir}
                />
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
                                    Con tu DNI ya {(aviso.chicos?.length ?? 0) === 1 ? 'hay un adolescente anotado' : `hay ${aviso.chicos?.length ?? 0} adolescentes anotados`} para Nocturna. No hace falta hacer otra: podés sumar a quien falte acá mismo y queda todo en la misma entrada.
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

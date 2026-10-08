import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, Flashlight, Keyboard, Loader2, X } from 'lucide-react';
import { useEscanerQR, useMantenerPantallaEncendida } from '../../../hooks/useEscanerQR';
import { probarConexionBase, supabaseService } from '../../../services/supabaseService';
import { User } from '../../../types';
import { enLista } from './compartido/formulario';
import { esCodigoDeEntrada, esLecturaRepetida, esUUID, normalizarCodigo, UltimaLectura } from './compartido/lecturaQR';
import { AMBAR, AMBAR_INK, CAMPO, ESTILOS_PANEL, fuente, INK, ROJO, ROJO_FONDO, VERDE, VERDE_PUNTO } from './compartido/estilos';

/**
 * Acreditación en la puerta.
 *
 * Se usa de noche, de pie, con una mano, y con familias esperando. Todo lo
 * que sigue está decidido por ese contexto: la cámara no se cierra entre una
 * familia y la otra, los botones son grandes, y nada se da por acreditado si
 * la base no lo confirmó.
 */

const CONTENEDOR = 'nocturna-qr';

interface Props {
    currentUser: User;
}

interface JovenAcred {
    id: string;
    nombre: string;
    apellido: string;
    edad: number;
    tribu: string;
    acreditado_at: string | null;
    ausente_at: string | null;
    retirado_at: string | null;
    /** Con quién se va a las 6 AM. 'solo' no tiene a nadie del otro lado. */
    retiro_tipo: 'solo' | 'adulto' | 'otra_persona';
    retiro_nombre: string | null;
    retiro_apellido: string | null;
    retiro_dni: string | null;
    retiro_telefono: string | null;
}

interface InscAcred {
    id: string;
    codigo_entrada: string;
    adulto_nombre: string;
    adulto_apellido: string;
    adulto_dni: string;
    adulto_email: string;
    acepta_fotos: boolean;
    adulto_acreditado_at: string | null;
}

/**
 * Lo que el staff marcó en la puerta, antes de confirmar.
 *
 * Tres estados y no dos: el que no vino hay que poder decirlo, o la familia
 * queda esperando para siempre a alguien que no está. Se rota tocando el
 * nombre: sin marcar → entra → no vino → sin marcar.
 */
type Marca = 'no' | 'entra' | 'ausente';

type Panel =
    | { tipo: 'familia'; insc: InscAcred; jovenes: JovenAcred[]; marcas: Record<string, Marca> }
    /** Las 6 AM, paso 1: quiénes se van. */
    | { tipo: 'salida'; insc: InscAcred; jovenes: JovenAcred[]; quienes: Record<string, boolean> }
    /** Las 6 AM, paso 2: con quién se van. */
    | { tipo: 'salidaQuien'; insc: InscAcred; jovenes: JovenAcred[]; ids: string[] }
    | { tipo: 'aviso'; clase: 'otroEvento' | 'eliminada' | 'yaEntraron' | 'sinPermiso'; titulo: string; rotulo: string; texto: string; lista?: { nombre: string; hora: string }[] }
    | null;

const soloHora = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    // hour12 en false: el evento va de las 23 a las 6, y "11 p. m." se lee
    // peor que "23:00" cuando hay que compararlo con la hora del reloj.
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const pitido = (ok: boolean) => {
    try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new Ctx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = ok ? 880 : 220;
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
    } catch {
        // El navegador puede bloquear el audio sin una interacción previa.
    }
};

const AcreditarNocturna: React.FC<Props> = ({ currentUser }) => {
    const navigate = useNavigate();

    const [panel, setPanel] = useState<Panel>(null);
    const [buscando, setBuscando] = useState(false);
    const [confirmando, setConfirmando] = useState(false);
    const [errorConfirmar, setErrorConfirmar] = useState<{ conexion: boolean; texto: string } | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);
    const [adentro, setAdentro] = useState<number | null>(null);
    const [tecladoAbierto, setTecladoAbierto] = useState(false);
    const [codigoManual, setCodigoManual] = useState('');

    // Espejos de lo que `procesarCodigo` necesita leer. Son refs y no estados
    // porque el callback de la cámara se crea una sola vez: si leyera el
    // estado, leería siempre el del primer render.
    const panelRef = useRef<Panel>(null);
    const procesandoRef = useRef(false);
    const ultimoCodigoRef = useRef<UltimaLectura | null>(null);
    useEffect(() => { panelRef.current = panel; }, [panel]);

    const pantallaSostenida = useMantenerPantallaEncendida(true);

    // ── El código leído ───────────────────────────────────────────────────
    const procesarCodigo = useCallback(async (texto: string, desdeLaCamara = true) => {
        const limpio = (texto || '').trim();

        // Con un panel abierto no se procesa nada. La cámara además queda
        // pausada, pero el freno vive acá por si alguna lectura ya estaba en
        // vuelo cuando el panel se abrió.
        if (procesandoRef.current || panelRef.current) return;

        // El mismo código, de nuevo, enseguida: la familia sigue con el
        // celular levantado. No es una lectura nueva. No corre cuando alguien
        // lo escribió a mano: ahí la está pidiendo a propósito.
        if (desdeLaCamara && esLecturaRepetida(ultimoCodigoRef.current, limpio, Date.now())) return;

        procesandoRef.current = true;
        ultimoCodigoRef.current = { texto: limpio, at: Date.now() };

        // Dos formas de nombrar la misma entrada: el QR lleva el id, y el
        // código de 6 caracteres —el que figura abajo del QR en el email— es
        // el que se tipea cuando la cámara no arranca o la pantalla del celular
        // no se deja leer. El código se resuelve a id acá y de ahí los dos
        // siguen por el mismo camino.
        let idEntrada = limpio;

        if (!esUUID(limpio)) {
            // Los QR del Día del Niño llevan un prefijo; los de otros eventos
            // pueden ser UUID y sí llegan, pero la RPC no los encuentra. En esos
            // casos el mensaje tiene que decir que no es una entrada de
            // Nocturna, no un "código inválido" que no le dice nada a nadie.
            if (!esCodigoDeEntrada(limpio)) {
                pitido(false);
                setPanel({
                    tipo: 'aviso', clase: 'otroEvento', rotulo: 'NO ES DE NOCTURNA',
                    titulo: 'Este QR no es una entrada de Nocturna',
                    texto: 'Puede ser de otro evento, o una captura borrosa. Pediles que suban el brillo del celular y volvé a escanear. Si sigue igual, buscalos por nombre en el panel.',
                });
                procesandoRef.current = false;
                return;
            }

            setBuscando(true);
            const porCodigo = await supabaseService.getNocturnaPorCodigo(limpio);
            setBuscando(false);

            if (!porCodigo.ok || !porCodigo.inscripcionId) {
                pitido(false);
                procesandoRef.current = false;
                // Un código bien formado que no existe es casi siempre un error
                // de tipeo, no una entrada falsa: el aviso va en tono neutro y
                // dice qué revisar.
                setPanel(porCodigo.motivo === 'conexion'
                    ? {
                        tipo: 'aviso', clase: 'eliminada', rotulo: 'SIN CONEXIÓN',
                        titulo: 'No pudimos buscar ese código',
                        texto: 'Se cortó la conexión. No quiere decir que la entrada esté mal: probá de nuevo en un momento.',
                    }
                    : {
                        tipo: 'aviso', clase: 'otroEvento', rotulo: 'CÓDIGO NO ENCONTRADO',
                        titulo: 'No hay ninguna entrada con el código ' + normalizarCodigo(limpio),
                        texto: 'Revisalo con la familia: son 6 caracteres y están abajo del QR, en el email. Si sigue sin aparecer, buscalos por nombre en el panel.',
                    });
                return;
            }

            idEntrada = porCodigo.inscripcionId;
        }

        setBuscando(true);
        const res = await supabaseService.getNocturnaParaAcreditar(idEntrada);
        setBuscando(false);
        procesandoRef.current = false;

        if (!res.ok) {
            pitido(false);
            if (res.motivo === 'sin_permiso') {
                setPanel({
                    tipo: 'aviso', clase: 'sinPermiso', rotulo: 'SIN PERMISO',
                    titulo: 'Tu cuenta no puede acreditar',
                    texto: res.error || 'Pedile a un coordinador que te habilite.',
                });
                return;
            }
            if (res.motivo === 'conexion') {
                setPanel({
                    tipo: 'aviso', clase: 'eliminada', rotulo: 'SIN CONEXIÓN',
                    titulo: 'No pudimos leer la entrada',
                    texto: 'Se cortó la conexión. No quiere decir que la entrada esté mal: probá de nuevo en un momento.',
                });
                return;
            }
            setPanel({
                tipo: 'aviso', clase: 'eliminada', rotulo: 'ENTRADA DADA DE BAJA',
                titulo: 'Esta inscripción ya no existe',
                texto: 'La entrada fue eliminada del sistema, así que con este QR no pueden entrar. Mandalos a la mesa de ayuda.',
            });
            return;
        }

        const insc = res.inscripcion as InscAcred;
        const jovenes = (res.jovenes || []) as JovenAcred[];

        // El mismo QR sirve toda la noche: a las 23 para entrar y a las 6 para
        // salir. Cuál de los dos aparece lo decide en qué estado está la
        // familia, no la hora —el reloj del celular no es un dato confiable, y
        // siempre hay alguien que llega tarde—.
        const pendientes = jovenes.filter(j => !j.acreditado_at && !j.ausente_at);
        const adentro = jovenes.filter(j => j.acreditado_at && !j.retirado_at);

        // Mientras quede alguien por marcar, la puerta es lo que importa; si
        // ya hay gente adentro, desde ahí se pasa a la salida con un botón.
        if (pendientes.length > 0) {
            pitido(true);
            setPanel({
                tipo: 'familia',
                insc,
                jovenes,
                // Lo ya resuelto arranca marcado como está: el estado que se
                // manda es el completo, no sólo lo nuevo.
                marcas: Object.fromEntries(jovenes.map(j => [
                    j.id,
                    j.acreditado_at ? 'entra' : j.ausente_at ? 'ausente' : 'no',
                ])) as Record<string, Marca>,
            });
            return;
        }

        if (adentro.length > 0) {
            pitido(true);
            setPanel({
                tipo: 'salida',
                insc,
                jovenes,
                // Arrancan todos marcados: lo normal es que la familia se vaya
                // junta, y destildar a uno es menos trabajo que tildar a tres.
                quienes: Object.fromEntries(adentro.map(j => [j.id, true])),
            });
            return;
        }

        // No queda nadie adentro: o ya se fueron todos, o no vino ninguno.
        const retirados = jovenes.filter(j => j.retirado_at);
        pitido(false);
        setPanel(retirados.length > 0
            ? {
                tipo: 'aviso', clase: 'yaEntraron', rotulo: 'YA SE RETIRARON',
                titulo: `La familia ${insc.adulto_apellido} ya se fue`,
                texto: 'Esta entrada no tiene a nadie adentro. Si alguien vuelve a entrar, consultá con un coordinador.',
                lista: retirados.map(j => ({ nombre: `${j.nombre} ${j.apellido}`, hora: soloHora(j.retirado_at) })),
            }
            : {
                tipo: 'aviso', clase: 'yaEntraron', rotulo: 'NADIE ENTRÓ',
                titulo: `La familia ${insc.adulto_apellido} figura ausente`,
                texto: 'Están todos marcados como que no vinieron. Si alguno llegó igual, desmarcalo desde la ficha de la inscripción.',
                lista: jovenes.map(j => ({ nombre: `${j.nombre} ${j.apellido}`, hora: soloHora(j.ausente_at) })),
            });
    }, []);

    const escaner = useEscanerQR({ contenedorId: CONTENEDOR, onCodigo: procesarCodigo });

    // Con un panel abierto la lectura se frena. html5-qrcode dispara el
    // callback mientras el código siga enfrente, y sin esto se encimarían
    // paneles de la misma familia.
    const { pausar, reanudar } = escaner;
    useEffect(() => {
        if (panel) pausar();
        else reanudar();
    }, [panel, pausar, reanudar]);

    // ── Cuántos hay adentro ───────────────────────────────────────────────
    useEffect(() => {
        (async () => {
            const res = await supabaseService.getNocturnaInscripciones();
            if (!res.ok) return;
            // Los que están adentro AHORA: entraron y todavía no se fueron.
            // Sólo adolescentes, que el adulto no se acredita.
            const n = res.inscripciones.reduce(
                (a, i) => a + (i.jovenes || []).filter(j => j.acreditadoAt && !j.retiradoAt).length,
                0,
            );
            setAdentro(n);
        })();
    }, []);

    useEffect(() => {
        if (!aviso) return;
        const t = setTimeout(() => setAviso(null), 5000);
        return () => clearTimeout(t);
    }, [aviso]);

    // ── Derivados del panel abierto ───────────────────────────────────────
    const familia = panel?.tipo === 'familia' ? panel : null;

    const cuentas = useMemo(() => {
        if (!familia) return null;
        const marca = (j: JovenAcred) => familia.marcas[j.id] || 'no';
        const total = familia.jovenes.length;
        const marcados = familia.jovenes.filter(j => marca(j) === 'entra').length;
        const ausentes = familia.jovenes.filter(j => marca(j) === 'ausente').length;
        // Lo nuevo: lo que todavía no está guardado en la base.
        const nuevos = familia.jovenes.filter(j => marca(j) === 'entra' && !j.acreditado_at).length;
        const nuevosAusentes = familia.jovenes.filter(j => marca(j) === 'ausente' && !j.ausente_at).length;
        const vuelve = familia.jovenes.some(j => j.acreditado_at || j.ausente_at);
        const faltanPorMarcar = familia.jovenes.some(j => marca(j) === 'no');
        // Ya hay gente adentro: desde la puerta se puede pasar a la salida.
        const hayAdentro = familia.jovenes.some(j => j.acreditado_at && !j.retirado_at);
        return {
            total, marcados, ausentes, nuevos, vuelve, faltanPorMarcar, hayAdentro,
            habilitado: nuevos + nuevosAusentes > 0,
        };
    }, [familia]);

    const sinFotos = familia && !familia.insc.acepta_fotos
        ? familia.jovenes.map(j => j.nombre)
        : [];

    // ── Acciones ──────────────────────────────────────────────────────────
    const cerrarPanel = () => {
        setPanel(null);
        setErrorConfirmar(null);
        // La ventana del "mismo código" arranca al cerrar, no al leer: la
        // familia todavía está enfrente.
        if (ultimoCodigoRef.current) ultimoCodigoRef.current.at = Date.now();
    };

    /**
     * Un toque rota el estado: sin marcar → entra → no vino → sin marcar.
     *
     * Dos toques para "no vino" y no un botón aparte: en la puerta se marca
     * con una mano y mirando a la familia, no a la pantalla, y un segundo
     * control por fila es un error de dedo esperando a pasar.
     */
    const alternarPersona = (clave: string) => {
        setPanel(p => {
            if (p?.tipo !== 'familia') return p;
            // Lo que la base ya tiene no se deshace desde acá: desacreditar y
            // despintar una ausencia van en la ficha, no en la puerta a las 23.
            const joven = p.jovenes.find(j => j.id === clave);
            if (!joven || joven.acreditado_at || joven.ausente_at) return p;
            const sigue: Record<Marca, Marca> = { no: 'entra', entra: 'ausente', ausente: 'no' };
            return { ...p, marcas: { ...p.marcas, [clave]: sigue[p.marcas[clave] || 'no'] } };
        });
    };

    const marcarLosQueFaltan = () => {
        setPanel(p => (p?.tipo !== 'familia' ? p : {
            ...p,
            marcas: Object.fromEntries(p.jovenes.map(j => [
                j.id,
                j.ausente_at ? 'ausente' : 'entra',
            ])) as Record<string, Marca>,
        }));
    };

    /** De la puerta a la salida, sin tener que volver a escanear. */
    const irALaSalida = () => {
        setPanel(p => {
            if (p?.tipo !== 'familia') return p;
            const adentro = p.jovenes.filter(j => j.acreditado_at && !j.retirado_at);
            if (!adentro.length) return p;
            return {
                tipo: 'salida', insc: p.insc, jovenes: p.jovenes,
                quienes: Object.fromEntries(adentro.map(j => [j.id, true])),
            };
        });
        setErrorConfirmar(null);
    };

    const confirmar = async () => {
        if (!familia || !cuentas?.habilitado || confirmando) return;
        setConfirmando(true);
        setErrorConfirmar(null);

        // `sumar`: en la puerta se agrega gente, nunca se saca. Es lo que
        // evita que dos personas del staff se pisen —una escanea a la familia
        // mientras la otra tiene la misma ficha abierta de hace dos minutos—.
        // Con el modo exacto, la segunda en guardar borraba el ingreso de
        // quienes ya habían entrado, y la base contestaba que todo bien.
        //
        // Se sigue mandando el estado completo que ve la pantalla: en este
        // modo, marcar de nuevo a alguien que ya entró no cambia nada.
        const ids = familia.jovenes.filter(j => familia.marcas[j.id] === 'entra').map(j => j.id);
        const ausentes = familia.jovenes.filter(j => familia.marcas[j.id] === 'ausente').map(j => j.id);
        // El adulto va siempre en false: desde el 2026-10-07 no se acredita.
        const res = await supabaseService.setNocturnaAcreditacion(
            familia.insc.id, false, ids, { modo: 'sumar', ausentes },
        );

        if (!res.ok) {
            // Nada se marca como acreditado sin que la base lo confirme: un
            // tilde verde que no se guardó deja pasar a alguien sin registro.
            const hayBase = await probarConexionBase();
            setErrorConfirmar(hayBase
                ? { conexion: false, texto: res.error || 'No pudimos registrar la acreditación.' }
                : { conexion: true, texto: 'Se cortó la conexión y no se guardó nada. Lo que marcaste sigue acá: probá de nuevo.' });
            setConfirmando(false);
            return;
        }

        pitido(true);
        setAdentro(n => (n === null ? n : n + (cuentas.nuevos || 0)));
        setAviso(`Familia ${familia.insc.adulto_apellido} · ${cuentas.marcados}/${cuentas.total} adentro${cuentas.ausentes ? ` · ${cuentas.ausentes} no vino${cuentas.ausentes > 1 ? 'n' : ''}` : ''}`);
        setConfirmando(false);
        cerrarPanel();
    };

    /**
     * Las 6 AM: registrar que se fueron.
     *
     * Dos pasos y dos confirmaciones a propósito —primero quiénes, después
     * con quién—: es el único momento de la noche en que el error no se puede
     * deshacer caminando, porque el chico ya salió a la calle.
     */
    const confirmarSalida = async () => {
        const p = panel?.tipo === 'salidaQuien' ? panel : null;
        if (!p || !p.ids.length || confirmando) return;
        setConfirmando(true);
        setErrorConfirmar(null);

        const res = await supabaseService.setNocturnaRetiro(p.insc.id, p.ids);

        if (!res.ok) {
            // Igual que en el ingreso: sin confirmación de la base no se da
            // por registrada una salida.
            const hayBase = await probarConexionBase();
            setErrorConfirmar(hayBase
                ? { conexion: false, texto: res.error || 'No pudimos registrar la salida.' }
                : { conexion: true, texto: 'Se cortó la conexión y no se guardó nada. Lo que marcaste sigue acá: probá de nuevo.' });
            setConfirmando(false);
            return;
        }

        pitido(true);
        setAdentro(n => (n === null ? n : Math.max(0, n - p.ids.length)));
        setAviso(`Familia ${p.insc.adulto_apellido} · se ${p.ids.length === 1 ? 'retiró 1' : `retiraron ${p.ids.length}`}`);
        setConfirmando(false);
        cerrarPanel();
    };

    const enviarManual = (e: React.FormEvent) => {
        e.preventDefault();
        const v = codigoManual.trim();
        if (!v) return;
        setCodigoManual('');
        setTecladoAbierto(false);
        // Mismo camino que la cámara salvo por el freno de la lectura
        // repetida: quien escribe un código lo está pidiendo a propósito.
        procesarCodigo(v, false);
    };

    // ── Piezas ────────────────────────────────────────────────────────────

    /**
     * Buscar por código, a mano.
     *
     * Está también en la pantalla de "no hay cámara" a propósito: si el
     * permiso falla justo esa noche, sin esto la puerta queda sin ninguna
     * forma de acreditar. El código de 6 caracteres está impreso en el email.
     */
    const BuscadorManual: React.FC<{ oscuro?: boolean }> = ({ oscuro }) => (
        tecladoAbierto ? (
            <form onSubmit={enviarManual} className="flex gap-2">
                <input
                    autoFocus
                    value={codigoManual}
                    onChange={e => setCodigoManual(e.target.value)}
                    placeholder="Pegá el código de la entrada"
                    aria-label="Código de la entrada"
                    className="campo flex-1"
                    /* El código se guarda en mayúsculas igual, pero verlo así
                       mientras se escribe evita el "¿lo puse bien?" con una
                       fila esperando. El teclado del celular arranca en
                       mayúsculas por autoCapitalize, y sin corrector: un
                       código de 6 letras es justo lo que el corrector
                       arruina. */
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                    style={{ minWidth: 0, textTransform: 'uppercase' }}
                />
                <button
                    type="submit"
                    className="border-0 rounded-full cursor-pointer flex-none"
                    style={{ height: 48, padding: '0 18px', background: oscuro ? '#fff' : INK, color: oscuro ? INK : '#fff', ...fuente(600, '14px') }}
                >
                    Buscar
                </button>
            </form>
        ) : (
            <button
                type="button"
                onClick={() => setTecladoAbierto(true)}
                className="w-full border-0 rounded-full flex items-center justify-center gap-2 cursor-pointer"
                style={{
                    height: 48,
                    background: oscuro ? 'rgba(255,255,255,.12)' : CAMPO,
                    color: oscuro ? 'rgba(255,255,255,.85)' : INK,
                    ...fuente(600, '14px'),
                }}
            >
                <Keyboard className="w-4 h-4" />
                Buscar por código
            </button>
        )
    );

    /**
     * Una fila de la puerta. Tres estados, un solo toque para rotar.
     *
     * El ausente va en rojo y el que entra en verde: a las 23, con la fila
     * esperando, el color tiene que decir el estado antes que el texto.
     */
    const Persona: React.FC<{
        nombre: string;
        sub: string;
        marca: Marca;
        /** Lo que la base ya tiene: la fila queda fija y no rota más. */
        fijado: { texto: string; rojo?: boolean } | null;
        sinFoto?: boolean;
        onClick: () => void;
    }> = ({ nombre, sub, marca, fijado, sinFoto, onClick }) => {
        const entra = marca === 'entra';
        const ausente = marca === 'ausente';
        const color = ausente ? ROJO : VERDE_PUNTO;
        return (
            <button
                type="button"
                onClick={onClick}
                aria-pressed={entra || ausente}
                aria-label={`${nombre}. ${ausente ? 'No vino' : entra ? 'Entra' : 'Sin marcar'}${fijado ? '' : '. Tocá para cambiar'}`}
                disabled={!!fijado}
                className="w-full border-0 flex items-center gap-3.5"
                style={{
                    minHeight: 74,
                    padding: '12px 16px 12px 12px',
                    borderRadius: 20,
                    background: fijado ? '#f4f4f2' : ausente ? ROJO_FONDO : entra ? '#eaf7ef' : '#fff',
                    boxShadow: fijado ? 'none' : `0 0 0 ${entra || ausente ? '2px' : '1.5px'} ${entra || ausente ? color : '#dcdbd7'} inset`,
                    cursor: fijado ? 'default' : 'pointer',
                }}
            >
                <span
                    className="flex items-center justify-center flex-none"
                    style={{
                        width: 44, height: 44, borderRadius: 999,
                        background: entra || ausente ? (fijado ? (ausente ? '#e3a19b' : '#86c79f') : color) : '#fff',
                        boxShadow: entra || ausente ? 'none' : '0 0 0 2px #cfcec9 inset',
                    }}
                >
                    {entra && <Check className="w-[18px] h-[18px] text-white" strokeWidth={3} />}
                    {ausente && <X className="w-[18px] h-[18px] text-white" strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0 text-left">
                    <span className="block truncate" style={{ ...fuente(600, '17px'), color: fijado ? 'rgba(0,0,0,.55)' : INK }}>
                        {nombre}
                    </span>
                    <span
                        className="block"
                        style={{
                            ...fuente(500, '13px'),
                            color: fijado ? (fijado.rojo ? ROJO : VERDE) : ausente ? ROJO : 'rgba(0,0,0,.58)',
                            marginTop: 3,
                        }}
                    >
                        {fijado ? fijado.texto : ausente ? 'No vino' : sub}
                    </span>
                </span>
                {sinFoto && (
                    <span
                        className="flex items-center flex-none"
                        style={{ height: 28, padding: '0 10px', borderRadius: 999, background: AMBAR, color: AMBAR_INK, ...fuente(600, '12px') }}
                    >
                        Sin fotos
                    </span>
                )}
            </button>
        );
    };

    /**
     * Las 6 AM, paso 1: quiénes se van.
     *
     * Arrancan todos marcados porque lo normal es que la familia se vaya
     * junta. Los que ya se fueron no están en la lista: una salida no se
     * deshace desde la puerta.
     */
    const PanelSalida: React.FC<{ panel: Extract<Panel, { tipo: 'salida' }> }> = ({ panel: p }) => {
        const adentro = p.jovenes.filter(j => j.acreditado_at && !j.retirado_at);
        const elegidos = adentro.filter(j => p.quienes[j.id]);
        const yaSeFueron = p.jovenes.filter(j => j.retirado_at);
        const varios = elegidos.length > 1;
        return (
            <>
                <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <p style={{ ...fuente(600, '12px'), letterSpacing: '.04em', color: VERDE, margin: 0 }}>
                            SALIDA · {p.insc.codigo_entrada}
                        </p>
                        <h2 style={{ ...fuente(600, '22px', '1.2'), color: INK, letterSpacing: '-.02em', margin: '4px 0 0' }}>
                            ¿Se {adentro.length > 1 ? 'retiran' : 'retira'} del establecimiento?
                        </h2>
                        <p style={{ ...fuente(500, '13px', '1.4'), color: 'rgba(0,0,0,.6)', margin: '2px 0 0' }}>
                            Familia {p.insc.adulto_apellido}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={cerrarPanel}
                        aria-label="Cerrar sin registrar ninguna salida"
                        className="border-0 rounded-full flex items-center justify-center cursor-pointer flex-none"
                        style={{ width: 44, height: 44, background: CAMPO }}
                    >
                        <X className="w-4 h-4" style={{ color: INK }} strokeWidth={2.4} />
                    </button>
                </div>

                <div className="flex flex-col gap-2 mt-3.5">
                    {adentro.map(j => (
                        <Persona
                            key={j.id}
                            nombre={`${j.nombre} ${j.apellido}`}
                            sub={`Entró a las ${soloHora(j.acreditado_at)}`}
                            marca={p.quienes[j.id] ? 'entra' : 'no'}
                            fijado={null}
                            onClick={() => setPanel(x => (x?.tipo !== 'salida' ? x : {
                                ...x, quienes: { ...x.quienes, [j.id]: !x.quienes[j.id] },
                            }))}
                        />
                    ))}
                </div>

                {!!yaSeFueron.length && (
                    <p style={{ ...fuente(500, '12.5px', '1.5'), color: 'rgba(0,0,0,.5)', margin: '10px 2px 0' }}>
                        {enLista(yaSeFueron.map(j => j.nombre))} ya se {yaSeFueron.length > 1 ? 'retiraron' : 'retiró'}.
                    </p>
                )}

                <p className="text-center" style={{ ...fuente(600, '13px'), color: elegidos.length ? VERDE : AMBAR_INK, margin: '12px 2px 0' }}>
                    {elegidos.length
                        ? `Se ${varios ? 'van' : 'va'} ${elegidos.length} de ${adentro.length}.`
                        : 'Marcá a quién se retira.'}
                </p>

                <button
                    type="button"
                    onClick={() => setPanel({ tipo: 'salidaQuien', insc: p.insc, jovenes: p.jovenes, ids: elegidos.map(j => j.id) })}
                    disabled={!elegidos.length}
                    className="w-full border-0 rounded-full cursor-pointer mt-2.5"
                    style={{
                        height: 64,
                        background: elegidos.length ? INK : '#e6e5e1',
                        color: elegidos.length ? '#fff' : 'rgba(0,0,0,.4)',
                        ...fuente(600, '18px'),
                        cursor: elegidos.length ? 'pointer' : 'not-allowed',
                    }}
                >
                    Se retira{varios ? 'n' : ''}
                </button>
                <button
                    type="button"
                    onClick={cerrarPanel}
                    className="w-full border-0 rounded-full cursor-pointer mt-2"
                    style={{ height: 52, background: CAMPO, color: INK, ...fuente(600, '15px') }}
                >
                    Aún no
                </button>
            </>
        );
    };

    /**
     * Las 6 AM, paso 2: con quién se van.
     *
     * Es la pantalla que el staff compara con el DNI que tiene enfrente, así
     * que el dato va grande y sin nada alrededor que distraiga. Quien sale
     * solo no tiene a nadie del otro lado: se dice y listo.
     */
    const PanelSalidaQuien: React.FC<{ panel: Extract<Panel, { tipo: 'salidaQuien' }> }> = ({ panel: p }) => {
        const elegidos = p.jovenes.filter(j => p.ids.includes(j.id));
        const solos = elegidos.filter(j => j.retiro_tipo === 'solo');
        const conAlguien = elegidos.filter(j => j.retiro_tipo !== 'solo');
        // Los que salen con la misma persona se muestran una vez: a las 6 AM,
        // repetir tres veces el mismo DNI es ruido.
        const grupos: { datos: NonNullable<ReturnType<typeof quienRetira>>; chicos: JovenAcred[] }[] = [];
        for (const j of conAlguien) {
            const d = quienRetira(j, p.insc)!;
            const clave = `${d.nombre}|${d.dni}|${d.contacto}`;
            const existente = grupos.find(g => `${g.datos.nombre}|${g.datos.dni}|${g.datos.contacto}` === clave);
            if (existente) existente.chicos.push(j);
            else grupos.push({ datos: d, chicos: [j] });
        }
        return (
            <>
                <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <p style={{ ...fuente(600, '12px'), letterSpacing: '.04em', color: VERDE, margin: 0 }}>
                            SALIDA · PASO 2 DE 2
                        </p>
                        <h2 style={{ ...fuente(600, '22px', '1.2'), color: INK, letterSpacing: '-.02em', margin: '4px 0 0' }}>
                            {conAlguien.length ? 'Pedile el DNI a quien retira' : 'Se retira sin acompañante'}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={cerrarPanel}
                        aria-label="Cerrar sin registrar ninguna salida"
                        className="border-0 rounded-full flex items-center justify-center cursor-pointer flex-none"
                        style={{ width: 44, height: 44, background: CAMPO }}
                    >
                        <X className="w-4 h-4" style={{ color: INK }} strokeWidth={2.4} />
                    </button>
                </div>

                {grupos.map((g, i) => (
                    <div key={i} className="mt-3.5" style={{ background: '#f7f7f5', borderRadius: 20, padding: '16px 18px' }}>
                        <p style={{ ...fuente(500, '12.5px'), color: 'rgba(0,0,0,.58)', margin: 0 }}>
                            Retira a {enLista(g.chicos.map(c => c.nombre))}
                        </p>
                        <p style={{ ...fuente(600, '24px', '1.2'), color: INK, letterSpacing: '-.02em', margin: '6px 0 0' }}>
                            {g.datos.nombre}
                        </p>
                        <div className="flex flex-col mt-2.5">
                            <div className="flex justify-between gap-3" style={{ padding: '9px 0', borderTop: '1px solid #ecebe8' }}>
                                <span style={{ ...fuente(500, '13px'), color: 'rgba(0,0,0,.6)' }}>DNI</span>
                                <span style={{ ...fuente(600, '17px'), color: INK }}>{g.datos.dni}</span>
                            </div>
                            <div className="flex justify-between gap-3" style={{ padding: '9px 0', borderTop: '1px solid #ecebe8' }}>
                                <span style={{ ...fuente(500, '13px'), color: 'rgba(0,0,0,.6)' }}>{g.datos.etiquetaContacto}</span>
                                <span style={{ ...fuente(600, '15px'), color: INK, overflowWrap: 'anywhere' }}>{g.datos.contacto}</span>
                            </div>
                        </div>
                    </div>
                ))}

                {!!solos.length && (
                    <div className="mt-3.5" style={{ background: AMBAR, borderRadius: 20, padding: '16px 18px' }}>
                        <p style={{ ...fuente(600, '15px', '1.45'), color: '#5c3b0b', margin: 0 }}>
                            {enLista(solos.map(j => j.nombre))} se {solos.length > 1 ? 'retiran solos' : 'retira solo'}: la familia lo autorizó al inscribirse.
                        </p>
                    </div>
                )}

                {errorConfirmar && (
                    <div className="rounded-[14px] mt-3" style={{ background: errorConfirmar.conexion ? AMBAR : ROJO_FONDO, padding: '12px 14px' }}>
                        <p style={{ ...fuente(600, '13.5px'), color: errorConfirmar.conexion ? INK : ROJO, margin: 0 }}>
                            {errorConfirmar.conexion ? 'No se guardó' : 'No se pudo registrar la salida'}
                        </p>
                        <p style={{ ...fuente(500, '13px', '1.5'), color: errorConfirmar.conexion ? '#5c3b0b' : 'rgba(0,0,0,.66)', margin: '4px 0 0' }}>
                            {errorConfirmar.texto}
                        </p>
                    </div>
                )}

                <button
                    type="button"
                    onClick={confirmarSalida}
                    disabled={confirmando}
                    className="w-full border-0 rounded-full flex items-center justify-center gap-2 mt-3"
                    style={{
                        height: 64, background: INK, color: '#fff', ...fuente(600, '18px'),
                        cursor: confirmando ? 'not-allowed' : 'pointer',
                    }}
                >
                    {confirmando && <Loader2 className="w-5 h-5 animate-spin" />}
                    {confirmando ? 'Guardando…' : errorConfirmar ? 'Reintentar' : `Se retir${elegidos.length > 1 ? 'aron' : 'ó'}`}
                </button>
                <button
                    type="button"
                    onClick={cerrarPanel}
                    className="w-full border-0 rounded-full cursor-pointer mt-2"
                    style={{ height: 52, background: CAMPO, color: INK, ...fuente(600, '15px') }}
                >
                    Aún no
                </button>
            </>
        );
    };

    /** Con quién se va cada adolescente, para el segundo paso de la salida. */
    const quienRetira = (j: JovenAcred, insc: InscAcred) => {
        if (j.retiro_tipo === 'solo') return null;
        if (j.retiro_tipo === 'adulto') {
            return {
                nombre: `${insc.adulto_nombre} ${insc.adulto_apellido}`.trim(),
                dni: insc.adulto_dni,
                // Del adulto responsable la inscripción guarda el email, no el
                // teléfono: es lo que hay para contactarlo si algo no cierra.
                contacto: insc.adulto_email,
                etiquetaContacto: 'Email',
            };
        }
        return {
            nombre: `${j.retiro_nombre || ''} ${j.retiro_apellido || ''}`.trim() || 'Sin nombre',
            dni: j.retiro_dni || '—',
            contacto: j.retiro_telefono || '—',
            etiquetaContacto: 'Teléfono',
        };
    };

    return (
        <div
            id="nocturna-panel"
            className="flex flex-col"
            style={{ background: '#0b0b0c', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}
        >
            <style>{ESTILOS_PANEL}</style>

            {/* La cámara ocupa el fondo entero. */}
            <div id={CONTENEDOR} className="absolute inset-0" style={{ background: '#0b0b0c' }} />

            {/* Cabecera */}
            {!escaner.error && !escaner.permisoDenegado && (
                <div className="absolute left-0 right-0 top-0 flex items-start gap-2.5 px-4 pt-4 z-10">
                    <button
                        type="button"
                        onClick={() => navigate('/panel-eventos/nocturna')}
                        className="border-0 rounded-full flex items-center gap-1.5 cursor-pointer flex-none"
                        style={{ height: 44, padding: '0 16px 0 12px', background: 'rgba(255,255,255,.12)', color: '#fff', ...fuente(600, '13.5px') }}
                    >
                        <ChevronLeft className="w-4 h-4" strokeWidth={2.3} />
                        Panel
                    </button>
                    {escaner.linterna.disponible && (
                        <button
                            type="button"
                            onClick={escaner.linterna.alternar}
                            aria-pressed={escaner.linterna.encendida}
                            aria-label={escaner.linterna.encendida ? 'Apagar la linterna' : 'Encender la linterna'}
                            className="border-0 rounded-full flex items-center justify-center cursor-pointer flex-none"
                            style={{
                                width: 44, height: 44,
                                background: escaner.linterna.encendida ? '#fff' : 'rgba(255,255,255,.12)',
                                color: escaner.linterna.encendida ? INK : '#fff',
                            }}
                        >
                            <Flashlight className="w-[18px] h-[18px]" />
                        </button>
                    )}
                    <div className="ml-auto text-right">
                        <p style={{ ...fuente(600, '11px'), letterSpacing: '.07em', color: 'rgba(255,255,255,.6)', margin: 0 }}>
                            ADENTRO ESTA NOCHE
                        </p>
                        <p style={{ ...fuente(600, '20px'), color: '#fff', margin: '2px 0 0' }}>
                            {adentro === null ? '—' : adentro}
                        </p>
                    </div>
                </div>
            )}

            {/* El marco y la instrucción */}
            {!escaner.error && !escaner.permisoDenegado && !panel && (
                <>
                    <div
                        className="absolute pointer-events-none"
                        style={{ left: '50%', top: '36%', transform: 'translate(-50%,-50%)', width: 236, height: 236 }}
                        aria-hidden="true"
                    >
                        {([['left:0;top:0', '22px 0 0 0', 'border-left border-top'],
                           ['right:0;top:0', '0 22px 0 0', 'border-right border-top'],
                           ['left:0;bottom:0', '0 0 0 22px', 'border-left border-bottom'],
                           ['right:0;bottom:0', '0 0 22px 0', 'border-right border-bottom']] as [string, string, string][])
                            .map(([pos, radio], i) => {
                                const [a, b] = pos.split(';');
                                const [ka, va] = a.split(':');
                                const [kb, vb] = b.split(':');
                                return (
                                    <span
                                        key={i}
                                        style={{
                                            position: 'absolute', [ka]: va, [kb]: vb, width: 46, height: 46,
                                            borderRadius: radio,
                                            borderLeft: ka === 'left' ? '4px solid #fff' : undefined,
                                            borderRight: ka === 'right' ? '4px solid #fff' : undefined,
                                            borderTop: kb === 'top' ? '4px solid #fff' : undefined,
                                            borderBottom: kb === 'bottom' ? '4px solid #fff' : undefined,
                                        } as React.CSSProperties}
                                    />
                                );
                            })}
                    </div>
                    <div className="absolute left-0 right-0 text-center px-8 pointer-events-none" style={{ top: '53%' }}>
                        <p style={{ ...fuente(600, '17px'), color: '#fff', margin: 0 }}>Apuntá al QR de la entrada</p>
                        <p style={{ ...fuente(500, '13.5px'), color: 'rgba(255,255,255,.66)', margin: '6px 0 0' }}>
                            Uno por familia. Se lee solo.
                        </p>
                    </div>
                </>
            )}

            {/* Teclado manual: el mismo camino que la cámara. */}
            {!escaner.error && !escaner.permisoDenegado && !panel && (
                <div className="absolute left-0 right-0 bottom-0 p-4 z-10">
                    <BuscadorManual oscuro />
                </div>
            )}

            {/* Buscando */}
            {buscando && (
                <div className="absolute inset-0 flex items-center justify-center z-20" style={{ background: 'rgba(0,0,0,.5)' }}>
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                </div>
            )}

            {/* Aviso de éxito */}
            {aviso && (
                <div className="absolute left-3.5 right-3.5 flex justify-center z-30" style={{ top: 76 }}>
                    <div
                        className="w-full flex items-center gap-3"
                        style={{ maxWidth: 400, background: '#16a34a', borderRadius: 20, padding: '12px 16px', boxShadow: '0 10px 30px rgba(0,0,0,.35)' }}
                        role="status"
                    >
                        <span className="flex items-center justify-center flex-none" style={{ width: 34, height: 34, borderRadius: 999, background: 'rgba(255,255,255,.22)' }}>
                            <Check className="w-[18px] h-[18px] text-white" strokeWidth={3} />
                        </span>
                        <div className="flex-1 min-w-0">
                            <p style={{ ...fuente(600, '15px'), color: '#fff', margin: 0 }}>{aviso}</p>
                            <p style={{ ...fuente(500, '12.5px'), color: 'rgba(255,255,255,.88)', margin: '2px 0 0' }}>
                                Listo para la próxima familia
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Sin cámara */}
            {(escaner.error || escaner.permisoDenegado) && (
                <div className="absolute inset-0 overflow-auto z-20" style={{ background: '#fff', padding: '22px 20px 26px' }}>
                    <div className="mx-auto" style={{ maxWidth: 440 }}>
                        <button
                            type="button"
                            onClick={() => navigate('/panel-eventos/nocturna')}
                            className="border-0 rounded-full flex items-center gap-1.5 cursor-pointer mb-4"
                            style={{ height: 40, padding: '0 14px 0 10px', background: CAMPO, color: INK, ...fuente(600, '12.5px') }}
                        >
                            <ChevronLeft className="w-4 h-4" strokeWidth={2.3} />
                            Panel
                        </button>
                        <div className="flex items-center justify-center" style={{ width: 64, height: 64, borderRadius: 999, background: AMBAR }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={AMBAR_INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <rect x="3" y="7" width="18" height="13" rx="3" /><path d="M3 3l18 18" />
                            </svg>
                        </div>
                        <h1 style={{ ...fuente(600, '24px', '1.25'), color: INK, letterSpacing: '-.02em', margin: '18px 0 0' }}>
                            La app no puede usar la cámara
                        </h1>
                        <p style={{ ...fuente(500, '14.5px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '10px 0 0' }}>
                            En algunos Android el aviso para dar permiso no aparece. Activalo a mano, son tres toques:
                        </p>
                        <div className="flex flex-col gap-2 mt-4">
                            {['Tocá el candado al lado de la dirección, arriba', 'Entrá a Permisos', 'Cámara → Permitir'].map((t, i) => (
                                <div key={i} className="flex items-center gap-3" style={{ background: '#f4f4f2', borderRadius: 16, padding: '14px 16px' }}>
                                    <span
                                        className="flex items-center justify-center flex-none"
                                        style={{ width: 30, height: 30, borderRadius: 999, background: INK, color: '#fff', ...fuente(600, '13px') }}
                                    >
                                        {i + 1}
                                    </span>
                                    <span style={{ ...fuente(600, '14.5px', '1.4'), color: INK }}>{t}</span>
                                </div>
                            ))}
                        </div>
                        {escaner.navegadorEmbebido && (
                            <div className="rounded-[16px] mt-3" style={{ background: AMBAR, padding: '14px 16px' }}>
                                <p style={{ ...fuente(500, '13.5px', '1.5'), color: '#5c3b0b', margin: 0 }}>
                                    Abriste el link desde WhatsApp o Instagram, y ahí la cámara casi nunca funciona. Tocá los tres puntos arriba y elegí “Abrir en Chrome”.
                                </p>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={escaner.reintentar}
                            disabled={escaner.reintentando}
                            className="w-full border-0 rounded-full cursor-pointer mt-5"
                            style={{ height: 60, background: INK, color: '#fff', ...fuente(600, '16.5px') }}
                        >
                            {escaner.reintentando ? 'Reintentando…' : 'Reintentar el acceso a la cámara'}
                        </button>
                        <p className="text-center" style={{ ...fuente(500, '13px', '1.5'), color: 'rgba(0,0,0,.58)', margin: '12px 0 0' }}>
                            Si sigue sin andar, cerrá el navegador y volvé a abrir el link. En iPhone: Ajustes → Safari → Cámara → Permitir.
                        </p>

                        {/* Sin esto, una cámara rota deja la puerta sin ninguna
                            forma de acreditar. El código está impreso en el email
                            de la familia. */}
                        <div style={{ borderTop: '1px solid #ecebe8', marginTop: 22, paddingTop: 20 }}>
                            <p style={{ ...fuente(600, '15px'), color: INK, margin: 0 }}>Mientras tanto, buscá por código</p>
                            <p style={{ ...fuente(500, '13px', '1.5'), color: 'rgba(0,0,0,.6)', margin: '4px 0 12px' }}>
                                Pediles el email de la entrada: abajo del QR está el código.
                            </p>
                            <BuscadorManual />
                        </div>
                    </div>
                </div>
            )}

            {/* El panel de la familia */}
            {panel && (
                <div
                    className="absolute inset-0 z-40 flex items-end lg:items-stretch lg:justify-end"
                    style={{ background: 'rgba(0,0,0,.35)' }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div
                        className="w-full lg:w-[440px] lg:m-5 overflow-auto"
                        style={{
                            maxHeight: '92%',
                            background: '#fff',
                            borderRadius: '28px 28px 0 0',
                            padding: '12px 16px 22px',
                        }}
                    >
                        <div className="lg:hidden mx-auto mb-3.5" style={{ width: 44, height: 5, borderRadius: 999, background: '#dddcd8' }} />

                        {familia && cuentas ? (
                            <>
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p style={{ ...fuente(600, '12px'), color: cuentas.vuelve ? VERDE : 'rgba(0,0,0,.55)', margin: 0 }}>
                                            {cuentas.vuelve
                                                ? `VUELVEN A ESCANEAR · ${familia.insc.codigo_entrada}`
                                                : `${familia.insc.codigo_entrada} · ${familia.jovenes.length} ${familia.jovenes.length === 1 ? 'adolescente' : 'adolescentes'}`}
                                        </p>
                                        <h2 style={{ ...fuente(600, '22px', '1.2'), color: INK, letterSpacing: '-.02em', margin: '4px 0 0' }}>
                                            Familia {familia.insc.adulto_apellido}
                                        </h2>
                                        {/* El adulto no se acredita, pero sigue a la
                                            vista: es con su apellido que se busca la
                                            entrada, y es a quien hay que llamar si
                                            algo no cierra. */}
                                        <p style={{ ...fuente(500, '13px', '1.4'), color: 'rgba(0,0,0,.6)', margin: '2px 0 0' }}>
                                            A cargo: {familia.insc.adulto_nombre} {familia.insc.adulto_apellido}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={cerrarPanel}
                                        aria-label="Cerrar sin acreditar a nadie"
                                        className="border-0 rounded-full flex items-center justify-center cursor-pointer flex-none"
                                        style={{ width: 44, height: 44, background: CAMPO }}
                                    >
                                        <X className="w-4 h-4" style={{ color: INK }} strokeWidth={2.4} />
                                    </button>
                                </div>

                                {!!sinFotos.length && (
                                    <div className="flex items-center gap-2.5 mt-3" style={{ background: AMBAR, borderRadius: 14, padding: '10px 14px' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={AMBAR_INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-none" aria-hidden="true">
                                            <rect x="3" y="7" width="18" height="13" rx="3" /><path d="M3 3l18 18" />
                                        </svg>
                                        <span style={{ ...fuente(600, '13.5px', '1.4'), color: '#5c3b0b' }}>
                                            {enLista(sinFotos)} {sinFotos.length > 1 ? 'no tienen' : 'no tiene'} permiso de fotos. Avisale al equipo de fotografía.
                                        </span>
                                    </div>
                                )}

                                <div className="flex flex-col gap-2 mt-3.5">
                                    {familia.jovenes.map(j => (
                                        <Persona
                                            key={j.id}
                                            nombre={`${j.nombre} ${j.apellido}`}
                                            sub={`${j.edad} años · ${j.tribu}`}
                                            marca={familia.marcas[j.id] || 'no'}
                                            fijado={
                                                j.retirado_at ? { texto: `Se retiró a las ${soloHora(j.retirado_at)}` }
                                                    : j.acreditado_at ? { texto: `Ya entró a las ${soloHora(j.acreditado_at)}` }
                                                        : j.ausente_at ? { texto: 'Marcado como que no vino', rojo: true }
                                                            : null
                                            }
                                            sinFoto={!familia.insc.acepta_fotos}
                                            onClick={() => alternarPersona(j.id)}
                                        />
                                    ))}
                                </div>
                                <p className="text-center" style={{ ...fuente(500, '12.5px'), color: 'rgba(0,0,0,.5)', margin: '8px 2px 0' }}>
                                    Tocá una vez para marcar que entra, dos veces si no vino.
                                </p>

                                {cuentas.faltanPorMarcar && (
                                    <button
                                        type="button"
                                        onClick={marcarLosQueFaltan}
                                        className="w-full border-0 rounded-full cursor-pointer mt-2.5"
                                        style={{ height: 48, background: CAMPO, color: INK, ...fuente(600, '14.5px') }}
                                    >
                                        {cuentas.vuelve ? 'Marcar a los que faltan' : 'Llegaron todos'}
                                    </button>
                                )}

                                <p
                                    className="text-center"
                                    style={{ ...fuente(600, '13px'), color: cuentas.habilitado ? VERDE : AMBAR_INK, margin: '12px 2px 0' }}
                                >
                                    {cuentas.habilitado
                                        ? (cuentas.vuelve
                                            ? `Se suma${cuentas.nuevos > 1 ? 'n' : ''} ${cuentas.nuevos}. Quedan ${cuentas.marcados}/${cuentas.total} adentro.`
                                            : `Entran ${cuentas.marcados} de ${cuentas.total}.`)
                                        : 'Marcá a quien acaba de llegar'}
                                </p>

                                {errorConfirmar && (
                                    <div className="rounded-[14px] mt-3" style={{ background: errorConfirmar.conexion ? AMBAR : '#fdecea', padding: '12px 14px' }}>
                                        <p style={{ ...fuente(600, '13.5px'), color: errorConfirmar.conexion ? INK : ROJO, margin: 0 }}>
                                            {errorConfirmar.conexion ? 'No se guardó' : 'No se pudo acreditar'}
                                        </p>
                                        <p style={{ ...fuente(500, '13px', '1.5'), color: errorConfirmar.conexion ? '#5c3b0b' : 'rgba(0,0,0,.66)', margin: '4px 0 0' }}>
                                            {errorConfirmar.texto}
                                        </p>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={confirmar}
                                    disabled={!cuentas.habilitado || confirmando}
                                    className="w-full border-0 rounded-full flex items-center justify-center gap-2 mt-2.5"
                                    style={{
                                        height: 64,
                                        background: cuentas.habilitado ? INK : '#e6e5e1',
                                        color: cuentas.habilitado ? '#fff' : 'rgba(0,0,0,.4)',
                                        ...fuente(600, '18px'),
                                        cursor: cuentas.habilitado && !confirmando ? 'pointer' : 'not-allowed',
                                    }}
                                >
                                    {confirmando && <Loader2 className="w-5 h-5 animate-spin" />}
                                    {confirmando
                                        ? 'Guardando…'
                                        : errorConfirmar
                                            ? 'Reintentar'
                                            : cuentas.habilitado
                                                ? (cuentas.vuelve ? `Acreditar ${cuentas.nuevos} más` : `Acreditar ${cuentas.marcados}/${cuentas.total}`)
                                                : 'Acreditar'}
                                </button>

                                {/* Ya hay gente adentro de esta familia: se puede
                                    registrar una salida sin volver a escanear.
                                    Aparece abajo del todo, y apagado, porque a
                                    las 23 el botón que importa es el de arriba. */}
                                {cuentas.hayAdentro && (
                                    <button
                                        type="button"
                                        onClick={irALaSalida}
                                        className="w-full border-0 rounded-full cursor-pointer mt-2.5"
                                        style={{ height: 52, background: CAMPO, color: INK, ...fuente(600, '15px') }}
                                    >
                                        Registrar una salida
                                    </button>
                                )}
                            </>
                        ) : panel.tipo === 'salida' ? (
                            <PanelSalida panel={panel} />
                        ) : panel.tipo === 'salidaQuien' ? (
                            <PanelSalidaQuien panel={panel} />
                        ) : panel.tipo === 'aviso' ? (
                            <>
                                <div className="flex flex-col items-center text-center pt-1">
                                    <div
                                        className="flex items-center justify-center"
                                        style={{
                                            width: 72, height: 72, borderRadius: 999,
                                            background: panel.clase === 'otroEvento' ? INK : ROJO,
                                        }}
                                    >
                                        <X className="w-8 h-8 text-white" strokeWidth={2.6} />
                                    </div>
                                    <p style={{ ...fuente(600, '12.5px'), letterSpacing: '.06em', color: panel.clase === 'otroEvento' ? 'rgba(0,0,0,.6)' : ROJO, margin: '16px 0 0' }}>
                                        {panel.rotulo}
                                    </p>
                                    <h2 style={{ ...fuente(600, '23px', '1.25'), color: INK, letterSpacing: '-.02em', margin: '6px 0 0' }}>
                                        {panel.titulo}
                                    </h2>
                                    <p style={{ ...fuente(500, '14.5px', '1.6'), color: 'rgba(0,0,0,.66)', margin: '10px 0 0', maxWidth: 360 }}>
                                        {panel.texto}
                                    </p>
                                </div>
                                {!!panel.lista?.length && (
                                    <div className="mt-4" style={{ background: '#f7f7f5', borderRadius: 18, padding: '4px 16px' }}>
                                        {panel.lista.map((l, i) => (
                                            <div key={i} className="flex justify-between gap-3" style={{ padding: '11px 0', borderBottom: i === panel.lista!.length - 1 ? 'none' : '1px solid #ecebe8' }}>
                                                <span style={{ ...fuente(600, '14px'), color: INK }}>{l.nombre}</span>
                                                <span style={{ ...fuente(600, '13px'), color: VERDE }}>Entró {l.hora}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={cerrarPanel}
                                    className="w-full border-0 rounded-full cursor-pointer mt-4.5"
                                    style={{ height: 60, background: INK, color: '#fff', ...fuente(600, '16.5px'), marginTop: 18 }}
                                >
                                    Seguir escaneando
                                </button>
                            </>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AcreditarNocturna;

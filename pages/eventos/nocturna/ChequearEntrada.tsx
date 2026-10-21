// ════════════════════════════════════════════════════════════════════════
// /nocturna-entrada — "Chequeá tu entrada".
//
// Implementa design-claude/Nocturna - Chequear Entrada.dc.html.
//
// La familia escribe el código de 6 caracteres que le llegó por email,
// confirma los últimos 3 dígitos del DNI del adulto responsable, ve que su
// entrada es válida y completa lo que falta.
//
// NADA SE GUARDA EN EL NAVEGADOR. El código y los 3 dígitos viven en el
// estado de este componente y se pierden al cerrar la pestaña: son la llave
// de los datos de una familia con menores, y una llave en localStorage
// queda en el teléfono para el que lo agarre después.
//
// Las cuentas las hace la base (services/nocturnaEntrada.ts → las RPC de
// sql/nocturna_chequear_entrada.sql). Esta pantalla no sabe el DNI, no sabe
// cuántos intentos van y no decide cuándo bloquear: pregunta y dibuja. El
// bloqueo que muestra es el que devuelve la base, en segundos.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
    ESTILOS_NOCTURNA, precargarFuentes, Fondo,
    arch, anillo, LIMA, NEGRO, BLANCO, FUENTE, FUENTE_PALABRA, CURVA,
} from './estilo';
import { useBarraDeAppSuelta } from '../../../contexts/BarraDeApp';
import {
    chequearCodigo, verEntrada, completarDatos, normalizarTelefono, soloDigitos,
    EntradaNocturna, MotivoNocturna,
} from '../../../services/nocturnaEntrada';

// ── Lo fijo ─────────────────────────────────────────────────────────────

/** El alfabeto de los códigos: sin 0, O, 1, I ni L. */
const ALFABETO = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]$/;
/** Los cinco que se confunden al leer y por eso no se generan. */
const CONFUSOS = /[01OIL]/;

type Paso = 'codigo' | 'dni' | 'valida' | 'completar' | 'listo' | 'entrada';

/** Las frases de cada motivo que puede devolver la base. */
const MENSAJES: Partial<Record<MotivoNocturna, string>> = {
    no_existe: 'No encontramos una entrada con ese código. Revisalo en el email de tu entrada.',
    otra_edicion: 'Ese código es de una Nocturna anterior.',
    dni: 'Esos números no coinciden con la inscripción.',
    formato: 'Ese código no tiene la forma de un código de entrada.',
    desconocido: 'No pudimos chequear tu código. Probá de nuevo en un rato.',
};

// ── Animaciones del diseño ──────────────────────────────────────────────

const ANIMACIONES = `
@keyframes ncIn { from { opacity:0; transform:translateY(28px) } to { opacity:1; transform:none } }
@keyframes ncOut { to { opacity:0; transform:translateY(-24px) } }
@keyframes ncPop { 0% { transform:scale(.82) } 60% { transform:scale(1.08) } 100% { transform:none } }
@keyframes ncShake { 0%,100% { transform:none } 20% { transform:translateX(-6px) } 40% { transform:translateX(6px) } 60% { transform:translateX(-4px) } 80% { transform:translateX(3px) } }
@keyframes ncWave { 0%,100% { transform:none } 50% { transform:translateY(-7px) } }
@keyframes ncStamp { 0% { opacity:0; transform:scale(2.4) rotate(-18deg) } 55% { opacity:1; transform:scale(.92) rotate(-4deg) } 78% { transform:scale(1.04) rotate(-7deg) } 100% { opacity:1; transform:rotate(-6deg) } }
@keyframes ncThud { 0%,100% { transform:none } 30% { transform:translate(2px,4px) rotate(.5deg) } 60% { transform:translate(-2px,-1px) rotate(-.3deg) } }
@keyframes ncDraw { from { clip-path:inset(0 100% 0 0) } to { clip-path:inset(0 0 0 0) } }
@keyframes ncSpin { to { transform:rotate(360deg) } }
@keyframes ncRing { 0%,100% { box-shadow:0 0 0 2px ${LIMA} } 50% { box-shadow:0 0 0 5px ${LIMA} } }
@keyframes ncFade { from { opacity:0 } to { opacity:1 } }
@media (prefers-reduced-motion: reduce) {
    #noc-entrada *, #noc-entrada *::before, #noc-entrada *::after {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .01ms !important;
    }
}
`;

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

// ── Piezas ──────────────────────────────────────────────────────────────

const Bang: React.FC<{ tam?: number; invertido?: boolean }> = ({ tam = 24, invertido }) => (
    <span
        aria-hidden="true"
        style={{
            width: tam, height: tam, borderRadius: 999, flex: 'none',
            background: invertido ? LIMA : NEGRO,
            color: invertido ? NEGRO : LIMA,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...arch(900, `${Math.round(tam * 0.58)}px`),
        }}
    >!</span>
);

const Aviso: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 14, animation: 'ncFade .25s ease-out' }}>
        <Bang />
        <p style={{ margin: '2px 0 0', ...arch(800, '15px', '1.4'), color: NEGRO }}>{children}</p>
    </div>
);

const Girador: React.FC = () => (
    <span
        aria-hidden="true"
        style={{
            width: 18, height: 18, borderRadius: 999, flex: 'none',
            border: `2.5px solid rgba(219,228,121,.35)`, borderTopColor: LIMA,
            animation: 'ncSpin .7s linear infinite',
        }}
    />
);

const BotonGrande: React.FC<{
    onClick: () => void;
    habilitado?: boolean;
    cargando?: boolean;
    variante?: 'negro' | 'borde';
    style?: React.CSSProperties;
    children: React.ReactNode;
}> = ({ onClick, habilitado = true, cargando, variante = 'negro', style, children }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={!habilitado || cargando}
        style={{
            width: '100%', minHeight: 62, border: 0, borderRadius: 999,
            background: variante === 'borde' ? 'transparent' : (habilitado ? NEGRO : 'rgba(0,0,0,.16)'),
            boxShadow: variante === 'borde' ? anillo(2.5) : undefined,
            color: variante === 'borde' ? NEGRO : (habilitado ? LIMA : 'rgba(0,0,0,.6)'),
            ...arch(800, '16px'), letterSpacing: '-.01em',
            cursor: habilitado && !cargando ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'background .2s, transform .12s',
            ...style,
        }}
    >
        {cargando && <Girador />}
        <span>{children}</span>
    </button>
);

/** El cartel negro: sin conexión y la espera. */
const Cartel: React.FC<{ titulo?: string; children: React.ReactNode }> = ({ titulo, children }) => (
    <div role="alert" style={{ marginTop: 22, background: NEGRO, borderRadius: 26, padding: 20, animation: 'ncFade .25s ease-out' }}>
        {titulo && (
            <p style={{ margin: 0, font: `400 26px/1 ${FUENTE_PALABRA}`, color: LIMA }}>{titulo}</p>
        )}
        {children}
    </div>
);

/** El troquelado de la entrada: blanco arriba, lima abajo. */
const MASCARA_ARRIBA = 'radial-gradient(circle at 0 100%, transparent 13px, #000 13.5px) left/50.5% 100% no-repeat, radial-gradient(circle at 100% 100%, transparent 13px, #000 13.5px) right/50.5% 100% no-repeat';
const MASCARA_ABAJO = 'radial-gradient(circle at 0 0, transparent 13px, #000 13.5px) left/50.5% 100% no-repeat, radial-gradient(circle at 100% 0, transparent 13px, #000 13.5px) right/50.5% 100% no-repeat';

const FilasDeLaEntrada: React.FC<{ entrada: EntradaNocturna }> = ({ entrada }) => {
    const cuantos = entrada.jovenes.length;
    const filas = [
        { k: 'ADULTO RESPONSABLE', v: entrada.adulto },
        {
            k: cuantos === 1 ? '1 ADOLESCENTE' : `${cuantos} ADOLESCENTES`,
            v: entrada.jovenes.map(j => j.nombre).join(', ') || '—',
        },
        { k: 'CUÁNDO', v: 'Viernes 30 de octubre · 22:00' },
    ];
    return (
        <div
            style={{
                background: LIMA, borderRadius: '0 0 26px 26px', padding: '0 20px 14px',
                WebkitMaskImage: MASCARA_ABAJO, maskImage: MASCARA_ABAJO,
            }}
        >
            <div style={{ borderTop: `3px dashed ${NEGRO}`, marginBottom: 6 }} />
            {filas.map((f, i) => (
                <div
                    key={f.k}
                    style={{
                        display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr)', gap: 12,
                        alignItems: 'baseline', padding: '11px 0',
                        borderTop: i ? `2px solid ${NEGRO}` : 0,
                    }}
                >
                    <span style={{ ...arch(800, '12px'), letterSpacing: '.03em', color: NEGRO }}>{f.k}</span>
                    <span style={{ textAlign: 'right', ...arch(900, '15px', '1.35'), letterSpacing: '-.02em', color: NEGRO }}>{f.v}</span>
                </div>
            ))}
        </div>
    );
};

// ── La pantalla ─────────────────────────────────────────────────────────

const ChequearEntrada: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [paso, setPaso] = useState<Paso>('codigo');
    const [saliendo, setSaliendo] = useState(false);
    const [giro, setGiro] = useState(0);

    const [codigo, setCodigo] = useState<string[]>(['', '', '', '', '', '']);
    const [errorCodigo, setErrorCodigo] = useState<MotivoNocturna | 'confuso' | null>(null);
    const [cajaMala, setCajaMala] = useState(-1);
    const [sacudon, setSacudon] = useState(0);

    const [dni, setDni] = useState<string[]>(['', '', '']);
    const [errorDni, setErrorDni] = useState(false);

    const [nombre, setNombre] = useState('');
    const [entrada, setEntrada] = useState<EntradaNocturna | null>(null);

    const [cargando, setCargando] = useState(false);
    const [sinConexionEn, setSinConexionEn] = useState<Paso | null>(null);
    const [bloqueoHasta, setBloqueoHasta] = useState(0);
    const [ahora, setAhora] = useState(Date.now());

    const [tel, setTel] = useState<Record<string, string>>({});
    const [tocados, setTocados] = useState<Record<string, boolean>>({});
    const [intentoGuardar, setIntentoGuardar] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
    const [completo, setCompleto] = useState(false);
    const [entradaDesde, setEntradaDesde] = useState<Paso>('valida');

    const cajasCodigo = useRef<Array<HTMLInputElement | null>>([]);
    const cajasDni = useRef<Array<HTMLInputElement | null>>([]);
    const primerTel = useRef<HTMLInputElement | null>(null);
    const scroll = useRef<HTMLDivElement | null>(null);
    const yaAutollenado = useRef(false);

    const sinMovimiento = useMemo(
        () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        [],
    );

    useEffect(() => { precargarFuentes(); }, []);

    // La barra de la app, transparente sobre el rosa: esta pantalla se abre
    // desde un link del email y ocupa el alto entero, como la inscripción.
    useBarraDeAppSuelta();

    /**
     * Esta pantalla no se indexa: la URL con ?codigo= es una llave, y un
     * buscador que la guarde la deja a la vista de cualquiera.
     *
     * Va por JS porque la app es una sola página y el index.html es el mismo
     * para todas las rutas. Al salir, la etiqueta se va.
     */
    useEffect(() => {
        const meta = document.createElement('meta');
        meta.name = 'robots';
        meta.content = 'noindex, nofollow';
        document.head.appendChild(meta);
        return () => { meta.remove(); };
    }, []);

    // El reloj del bloqueo, sólo mientras hay bloqueo.
    useEffect(() => {
        if (!bloqueoHasta) return;
        const id = window.setInterval(() => {
            if (Date.now() >= bloqueoHasta) { setBloqueoHasta(0); setAhora(Date.now()); }
            else setAhora(Date.now());
        }, 1000);
        return () => window.clearInterval(id);
    }, [bloqueoHasta]);

    const bloqueado = bloqueoHasta > ahora;
    const restan = Math.max(0, bloqueoHasta - ahora);
    const cuenta = `${Math.floor(restan / 60000)}:${String(Math.floor((restan % 60000) / 1000)).padStart(2, '0')}`;

    const irA = useCallback((siguiente: Paso) => {
        const terminar = () => {
            setPaso(siguiente);
            setSaliendo(false);
            setGiro(g => g + 1);
            if (scroll.current) scroll.current.scrollTop = 0;
            window.setTimeout(() => {
                if (siguiente === 'codigo') cajasCodigo.current[0]?.focus();
                else if (siguiente === 'dni') cajasDni.current[0]?.focus();
                else if (siguiente === 'completar') primerTel.current?.focus();
            }, 80);
        };
        if (sinMovimiento) { terminar(); return; }
        setSaliendo(true);
        window.setTimeout(terminar, 220);
    }, [sinMovimiento]);

    /** Lo que devuelve la base cuando no se puede seguir. */
    const manejarFalla = useCallback((motivo: MotivoNocturna, segundos: number | undefined, donde: Paso) => {
        setCargando(false);
        if (motivo === 'sin_conexion') { setSinConexionEn(donde); return; }
        if (motivo === 'bloqueado') {
            setBloqueoHasta(Date.now() + (segundos || 300) * 1000);
            setAhora(Date.now());
            setErrorCodigo(null);
            setErrorDni(false);
            return;
        }
        setSacudon(s => s + 1);
        if (donde === 'dni') setErrorDni(true);
        else setErrorCodigo(motivo);
    }, []);

    // ── Paso 1 · el código ──────────────────────────────────────────────
    const escribirCodigo = (desde: number, crudo: string) => {
        const chars = crudo.toUpperCase().replace(/[^A-Z0-9]/g, '').split('');
        if (!chars.length) return;
        const copia = codigo.slice();
        let pos = desde;
        for (const ch of chars) {
            if (pos > 5) break;
            if (CONFUSOS.test(ch) || !ALFABETO.test(ch)) {
                setCodigo(copia);
                setErrorCodigo('confuso');
                setCajaMala(pos);
                setSacudon(s => s + 1);
                cajasCodigo.current[pos]?.focus();
                return;
            }
            copia[pos] = ch;
            pos++;
        }
        setCodigo(copia);
        setErrorCodigo(null);
        setCajaMala(-1);
        setSinConexionEn(null);
        // El foco se mueve en el acto, no en el próximo tick: con un
        // setTimeout, quien escribe rápido (o pega) mete dos teclas en la
        // misma casilla antes de que el foco llegue a la siguiente.
        cajasCodigo.current[Math.min(pos, 5)]?.focus();
    };

    const chequear = useCallback(async (codigoDirecto?: string) => {
        const texto = codigoDirecto ?? codigo.join('');
        if (cargando || bloqueado || texto.length < 6) return;
        setCargando(true);
        setErrorCodigo(null);
        setSinConexionEn(null);

        const r = await chequearCodigo(texto);
        if (!r.ok) { manejarFalla(r.motivo, r.segundos, 'codigo'); return; }

        setCargando(false);
        setNombre(r.datos.nombre);
        irA('dni');
    }, [codigo, cargando, bloqueado, irA, manejarFalla]);

    /**
     * El código que viene en el link del email: se escribe solo y se chequea.
     * Una sola vez, aunque la URL cambie después.
     */
    const codigoDeLaUrl = useMemo(() => {
        const q = new URLSearchParams(location.search || (location.hash.split('?')[1] ? `?${location.hash.split('?')[1]}` : ''));
        const c = (q.get('codigo') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        return c.length === 6 && !CONFUSOS.test(c) ? c : null;
    }, [location.search, location.hash]);

    const desdeEmail = !!codigoDeLaUrl;

    useEffect(() => {
        if (!codigoDeLaUrl || yaAutollenado.current) return;
        yaAutollenado.current = true;
        setCodigo(codigoDeLaUrl.split(''));
        const id = window.setTimeout(() => { void chequear(codigoDeLaUrl); }, 650);
        return () => window.clearTimeout(id);
        // chequear cambia con cada tecla; acá sólo interesa la primera vez.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigoDeLaUrl]);

    // ── Paso 2 · el DNI ─────────────────────────────────────────────────
    const escribirDni = (i: number, crudo: string) => {
        const digitos = crudo.replace(/\D/g, '');
        const copia = dni.slice();
        if (!digitos) { copia[i] = ''; setDni(copia); setErrorDni(false); return; }
        let p = i;
        for (const ch of digitos) { if (p > 2) break; copia[p] = ch; p++; }
        setDni(copia);
        setErrorDni(false);
        setSinConexionEn(null);
        cajasDni.current[Math.min(p, 2)]?.focus();
    };

    const confirmar = useCallback(async () => {
        if (cargando || bloqueado || dni.some(d => !d)) return;
        setCargando(true);
        setErrorDni(false);
        setSinConexionEn(null);

        const r = await verEntrada(codigo.join(''), dni.join(''));
        if (!r.ok) { manejarFalla(r.motivo, r.segundos, 'dni'); return; }

        setCargando(false);
        setEntrada(r.datos);
        setTel({});
        setTocados({});
        setIntentoGuardar(false);
        irA('valida');
    }, [cargando, bloqueado, dni, codigo, irA, manejarFalla]);

    // ── Paso 3 · completar ──────────────────────────────────────────────
    /** Lo que falta, en el orden en que se pide: primero el adulto. */
    const faltantes = useMemo(() => {
        if (!entrada) return [] as Array<{ clave: string; etiqueta: string; esAdulto: boolean }>;
        const lista: Array<{ clave: string; etiqueta: string; esAdulto: boolean }> = [];
        if (entrada.faltantes.adultoTelefono) {
            lista.push({ clave: 'adulto', etiqueta: 'TU TELÉFONO', esAdulto: true });
        }
        for (const id of entrada.faltantes.jovenesSinTelefono) {
            const j = entrada.jovenes.find(x => x.id === id);
            lista.push({
                clave: id,
                etiqueta: `TELÉFONO DE ${(j?.nombre || '').toUpperCase()}`.trim(),
                esAdulto: false,
            });
        }
        return lista;
    }, [entrada]);

    const faltanDatos = faltantes.length > 0 && !completo;

    /**
      * "11 2345 6789": los dígitos agrupados como se leen.
      *
      * Lo que sobra se agrega al final en vez de descartarse. El input es
      * controlado: lo que esta función no muestra es lo que se pierde en la
      * siguiente tecla, y escribir +54 9 11 … se cortaba a la mitad.
      */
    const formatear = (d: string) => {
        const partes = d.startsWith('11') ? [2, 4, 4] : [3, 3, 4];
        const out: string[] = [];
        let i = 0;
        for (const n of partes) { if (i >= d.length) break; out.push(d.slice(i, i + n)); i += n; }
        if (i < d.length) out.push(d.slice(i));
        return out.join(' ');
    };

    /**
      * Se guardan los dígitos como se escriben, y se reemplazan por los 10
      * normalizados recién cuando resuelven. Normalizar en cada tecla —y
      * recortar a 10— rompía el formato viejo: 011 15 5111 2233 perdía los
      * últimos dígitos justo antes de que el 15 se pudiera reconocer.
      */
    const escribirTel = (clave: string, crudo: string) => {
        const d = soloDigitos(crudo);
        setTel(t => ({ ...t, [clave]: normalizarTelefono(d) ?? d }));
        setErrorGuardar(null);
    };

    const guardar = useCallback(async () => {
        if (guardando || !entrada) return;
        setIntentoGuardar(true);
        const malos = faltantes.filter(f => !normalizarTelefono(tel[f.clave] || ''));
        if (malos.length) {
            if (malos[0].clave === faltantes[0]?.clave) primerTel.current?.focus();
            return;
        }

        setGuardando(true);
        setErrorGuardar(null);

        const r = await completarDatos(
            codigo.join(''),
            dni.join(''),
            faltantes.some(f => f.esAdulto) ? normalizarTelefono(tel['adulto'] || '') : null,
            faltantes.filter(f => !f.esAdulto).map(f => ({ id: f.clave, telefono: normalizarTelefono(tel[f.clave] || '') || '' })),
        );

        setGuardando(false);

        if (!r.ok) {
            if (r.motivo === 'bloqueado') { manejarFalla(r.motivo, r.segundos, 'completar'); return; }
            setErrorGuardar(
                r.motivo === 'sin_conexion'
                    ? 'No se pudo guardar. Tu dato sigue acá: probá de nuevo.'
                    : r.motivo === 'telefono'
                        ? 'Revisá el número: tiene que tener 10 dígitos, con el código de área.'
                        : 'No se pudo guardar. Probá de nuevo.',
            );
            return;
        }

        // Lo que quedó faltando lo dice la base, no esta pantalla.
        setEntrada(e => (e ? { ...e, faltantes: r.datos } : e));
        setCompleto(true);
        irA('listo');
    }, [guardando, entrada, faltantes, tel, codigo, dni, irA, manejarFalla]);

    // ── Dibujo ──────────────────────────────────────────────────────────
    const esDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
    const totalPasos = faltantes.length ? 4 : 3;
    const nPaso: Record<Paso, number> = { codigo: 0, dni: 1, valida: 2, completar: 3, listo: totalPasos, entrada: totalPasos };
    const etapa = nPaso[paso];

    const animacionEntrada = saliendo
        ? (sinMovimiento ? 'none' : 'ncOut .22s ease-in forwards')
        : (sinMovimiento ? 'none' : `ncIn .45s ${CURVA}`);

    const cajaDeCodigo = (llena: boolean, mala: boolean): React.CSSProperties => ({
        width: '100%', minWidth: 0, height: esDesktop ? 72 : 64, padding: 0, border: 0, borderRadius: 16,
        textAlign: 'center', textTransform: 'uppercase',
        font: `800 ${esDesktop ? 32 : 28}px/1 ${MONO}`,
        color: mala ? '#8A0016' : NEGRO, caretColor: NEGRO,
        background: llena ? LIMA : 'rgba(255,255,255,.22)',
        boxShadow: `inset 0 0 0 ${mala ? 3.5 : 2.5}px ${mala ? '#B3001B' : NEGRO}`,
        transition: sinMovimiento ? 'none' : 'background .2s, box-shadow .2s',
    });

    const sacudida = sinMovimiento ? 'none' : 'ncShake .42s ease';

    const titulo = (texto: string) => (
        <h1 style={{ margin: '6px 0 0', font: `400 ${esDesktop ? 60 : 46}px/0.98 ${FUENTE_PALABRA}`, letterSpacing: '-.01em', color: NEGRO, textWrap: 'balance' as any }}>
            {texto}
        </h1>
    );

    const bajada = (texto: string) => (
        <p style={{ margin: '14px 0 0', ...arch(600, '16px', '1.45'), color: NEGRO, textWrap: 'pretty' as any }}>{texto}</p>
    );

    const carteles = (donde: Paso, reintentar: () => void) => (
        <>
            {sinConexionEn === donde && !cargando && (
                <Cartel titulo="Sin conexión">
                    <p style={{ margin: '10px 0 0', ...arch(600, '15px', '1.45'), color: BLANCO }}>
                        {donde === 'codigo'
                            ? 'No pudimos chequear tu código. Revisá tus datos o el wifi y probá de nuevo.'
                            : 'No pudimos confirmar tus datos. Revisá tus datos o el wifi y probá de nuevo.'}
                    </p>
                    <button
                        type="button"
                        onClick={reintentar}
                        style={{ width: '100%', minHeight: 56, marginTop: 16, border: 0, borderRadius: 999, background: LIMA, color: NEGRO, ...arch(800, '16px'), cursor: 'pointer' }}
                    >
                        [ REINTENTAR ]
                    </button>
                </Cartel>
            )}
            {bloqueado && (
                <Cartel>
                    <p style={{ margin: 0, ...arch(800, '16px', '1.4'), color: BLANCO }}>
                        Hiciste muchos intentos. Esperá 5 minutos y probá de nuevo.
                    </p>
                    <p aria-live="polite" style={{ margin: '8px 0 0', font: `800 46px/1 ${MONO}`, color: LIMA }}>{cuenta}</p>
                </Cartel>
            )}
        </>
    );

    return (
        <div
            id="noc-entrada"
            style={{
                position: 'fixed', inset: 0, background: '#E04497',
                fontFamily: FUENTE, color: NEGRO, overflow: 'hidden',
            }}
        >
            <style>{ESTILOS_NOCTURNA}</style>
            <style>{ANIMACIONES}</style>

            {/* Sin <Esquinas>: su CSS vive scopeado a #nocturna-inscripcion y
                acá salía cruda, encima del título. En la maqueta las esquinas
                son sólo del escritorio, y esta pantalla se abre casi siempre
                desde el email, en un teléfono. */}
            <Fondo etapa={etapa} nitida={paso === 'entrada' || paso === 'valida'} calma="baja" portada={false} />

            <div ref={scroll} style={{ position: 'absolute', inset: 0, overflowY: 'auto', overflowX: 'hidden', zIndex: 3 }}>
                <div
                    style={{
                        width: '100%', maxWidth: 480, margin: '0 auto',
                        // Arriba, el alto de la barra de la app: sin esto el
                        // título queda debajo del logo.
                        padding: esDesktop ? '88px 0 64px' : '76px 20px 40px',
                        animation: animacionEntrada,
                    }}
                    key={giro}
                >
                    {/* ── 1 · El código ── */}
                    {paso === 'codigo' && (
                        <>
                            {titulo('Chequeá tu entrada')}
                            {bajada('Escribí el código de 6 caracteres que está en tu entrada, debajo del QR.')}

                            <div
                                onPaste={e => {
                                    const t = e.clipboardData.getData('text');
                                    if (!t) return;
                                    e.preventDefault();
                                    const limpio = t.toUpperCase().replace(/[^A-Z0-9]/g, '');
                                    const i = cajasCodigo.current.findIndex(r => r === document.activeElement);
                                    escribirCodigo(limpio.length >= 6 ? 0 : Math.max(0, i), limpio);
                                }}
                                style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 8, marginTop: 24 }}
                            >
                                {codigo.map((c, i) => {
                                    const mala = !bloqueado && (
                                        errorCodigo === 'no_existe' || errorCodigo === 'formato'
                                        || (errorCodigo === 'confuso' && cajaMala === i)
                                    );
                                    const anim = sinMovimiento ? 'none'
                                        : mala ? sacudida
                                            : cargando ? `ncWave .9s ease-in-out ${i * 0.08}s infinite`
                                                : c ? `ncPop .28s ${CURVA}` : 'none';
                                    return (
                                        <input
                                            key={`${i}-${sacudon}`}
                                            ref={el => { cajasCodigo.current[i] = el; }}
                                            value={c}
                                            onChange={e => {
                                                // Vaciar la casilla es una
                                                // acción válida: sin esto, el
                                                // borrado por selección no
                                                // hacía nada.
                                                if (e.target.value === '') {
                                                    const copia = codigo.slice();
                                                    copia[i] = '';
                                                    setCodigo(copia);
                                                    setErrorCodigo(null);
                                                    return;
                                                }
                                                escribirCodigo(i, e.target.value);
                                            }}
                                            onKeyDown={e => {
                                                if (e.key === 'Backspace' && !codigo[i] && i > 0) {
                                                    e.preventDefault();
                                                    const copia = codigo.slice(); copia[i - 1] = '';
                                                    setCodigo(copia); setErrorCodigo(null);
                                                    cajasCodigo.current[i - 1]?.focus();
                                                } else if (e.key === 'ArrowLeft' && i > 0) {
                                                    e.preventDefault(); cajasCodigo.current[i - 1]?.focus();
                                                } else if (e.key === 'ArrowRight' && i < 5) {
                                                    e.preventDefault(); cajasCodigo.current[i + 1]?.focus();
                                                } else if (e.key === 'Enter') { void chequear(); }
                                            }}
                                            onFocus={e => e.target.select()}
                                            aria-label={`Carácter ${i + 1} de 6`}
                                            inputMode="text"
                                            autoCapitalize="characters"
                                            autoComplete="one-time-code"
                                            spellCheck={false}
                                            maxLength={2}
                                            style={{ ...cajaDeCodigo(!!c, mala), animation: anim }}
                                        />
                                    );
                                })}
                            </div>

                            {desdeEmail && cargando && (
                                <p style={{ margin: '14px 0 0', ...arch(800, '14px'), letterSpacing: '-.01em', color: NEGRO }}>
                                    Trajimos tu código desde el email.
                                </p>
                            )}

                            {!bloqueado && errorCodigo && (
                                <Aviso>
                                    {errorCodigo === 'confuso'
                                        ? 'Ese carácter no está en los códigos'
                                        : MENSAJES[errorCodigo as MotivoNocturna] || MENSAJES.desconocido}
                                </Aviso>
                            )}

                            {carteles('codigo', () => void chequear())}

                            {!bloqueado && !(sinConexionEn === 'codigo' && !cargando) && (
                                <BotonGrande
                                    onClick={() => void chequear()}
                                    habilitado={codigo.every(Boolean)}
                                    cargando={cargando}
                                    style={{ marginTop: 22 }}
                                >
                                    {cargando ? '[ VERIFICANDO ]' : '[ CHEQUEAR ]'}
                                </BotonGrande>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 34, paddingTop: 20, borderTop: '2px solid rgba(0,0,0,.2)' }}>
                                <div
                                    aria-hidden="true"
                                    style={{ flex: 'none', width: 84, background: NEGRO, borderRadius: 14, padding: '7px 7px 9px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, transform: 'rotate(-4deg)' }}
                                >
                                    <span style={{ display: 'block', width: 70, height: 70, borderRadius: 6, background: 'repeating-conic-gradient(#000 0 25%, #fff 0 50%) 0 0/14px 14px', boxShadow: 'inset 0 0 0 5px #fff' }} />
                                    <span style={{ padding: '2px 5px', borderRadius: 6, font: `800 10px/1.2 ${MONO}`, letterSpacing: '.08em', color: LIMA, animation: sinMovimiento ? 'none' : 'ncRing 1.6s ease-in-out infinite', boxShadow: `0 0 0 2px ${LIMA}` }}>ABC234</span>
                                </div>
                                <p style={{ margin: 0, ...arch(600, '14px', '1.45'), color: NEGRO, textWrap: 'pretty' as any }}>
                                    Lo encontrás en el email de tu entrada, justo debajo del QR.
                                </p>
                            </div>
                        </>
                    )}

                    {/* ── 2 · El DNI ── */}
                    {paso === 'dni' && (
                        <>
                            <p style={{ margin: '6px 0 0', font: `800 12px ${MONO}`, letterSpacing: '.1em', color: NEGRO }}>
                                [ {codigo.join('')} ]
                            </p>
                            {titulo(`Hola, ${nombre}`)}
                            {bajada('Para proteger los datos de los chicos, confirmá los últimos 3 números del DNI del adulto responsable.')}

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24 }}>
                                <span aria-hidden="true" style={{ font: `800 20px ${MONO}`, letterSpacing: '.04em', color: NEGRO, whiteSpace: 'nowrap' }}>
                                    DNI ••.•••.
                                </span>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {dni.map((c, i) => {
                                        const anim = sinMovimiento ? 'none'
                                            : errorDni ? sacudida
                                                : cargando ? `ncWave .9s ease-in-out ${i * 0.08}s infinite`
                                                    : c ? `ncPop .28s ${CURVA}` : 'none';
                                        return (
                                            <input
                                                key={`${i}-${sacudon}`}
                                                ref={el => { cajasDni.current[i] = el; }}
                                                value={c}
                                                onChange={e => escribirDni(i, e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Backspace' && !dni[i] && i > 0) {
                                                        e.preventDefault();
                                                        const copia = dni.slice(); copia[i - 1] = '';
                                                        setDni(copia); cajasDni.current[i - 1]?.focus();
                                                    } else if (e.key === 'Enter') { void confirmar(); }
                                                }}
                                                onFocus={e => e.target.select()}
                                                aria-label={`Número ${i + 1} de 3`}
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                autoComplete="off"
                                                maxLength={2}
                                                style={{ ...cajaDeCodigo(!!c, errorDni), width: 54, height: 64, flex: 'none', font: `800 28px/1 ${MONO}`, animation: anim }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>

                            {errorDni && !bloqueado && <Aviso>{MENSAJES.dni}</Aviso>}

                            {carteles('dni', () => void confirmar())}

                            {!bloqueado && !(sinConexionEn === 'dni' && !cargando) && (
                                <BotonGrande
                                    onClick={() => void confirmar()}
                                    habilitado={dni.every(Boolean)}
                                    cargando={cargando}
                                    style={{ marginTop: 22 }}
                                >
                                    {cargando ? '[ CONFIRMANDO ]' : '[ CONFIRMAR ]'}
                                </BotonGrande>
                            )}

                            <p style={{ margin: '18px 0 0', textAlign: 'center' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCodigo(['', '', '', '', '', '']);
                                        setDni(['', '', '']);
                                        setErrorCodigo(null);
                                        setErrorDni(false);
                                        irA('codigo');
                                    }}
                                    style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 6px', border: 0, background: 'transparent', ...arch(700, '14px'), color: NEGRO, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}
                                >
                                    ¿No sos vos? Escribir otro código
                                </button>
                            </p>
                        </>
                    )}

                    {/* ── 3 · La entrada es válida ── */}
                    {paso === 'valida' && entrada && (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10 }}>
                                <div
                                    style={{
                                        background: NEGRO, borderRadius: 20, padding: '14px 22px 12px',
                                        transform: 'rotate(-6deg)', textAlign: 'center',
                                        boxShadow: `inset 0 0 0 4px ${NEGRO}, inset 0 0 0 6.5px ${LIMA}`,
                                        animation: sinMovimiento ? 'none' : `ncStamp .62s ${CURVA} .1s both`,
                                    }}
                                >
                                    <p style={{ margin: 0, font: `400 ${esDesktop ? 36 : 30}px/1 ${FUENTE_PALABRA}`, color: LIMA, whiteSpace: 'nowrap' }}>
                                        ENTRADA VÁLIDA
                                    </p>
                                    <p style={{ margin: '6px 0 0', font: `800 11.5px ${MONO}`, letterSpacing: '.14em', color: LIMA }}>
                                        NOCTURNA // 30.10.2026
                                    </p>
                                </div>
                            </div>

                            <div style={{ marginTop: 28, animation: sinMovimiento ? 'none' : 'ncThud .32s ease-out .45s' }}>
                                <div
                                    style={{
                                        background: BLANCO, borderRadius: '26px 26px 0 0', padding: '20px 20px 18px', textAlign: 'center',
                                        WebkitMaskImage: MASCARA_ARRIBA, maskImage: MASCARA_ARRIBA,
                                    }}
                                >
                                    <p style={{ margin: 0, ...arch(800, '11px'), letterSpacing: '.1em', color: NEGRO }}>CÓDIGO DE ENTRADA</p>
                                    <p style={{ margin: '6px 0 0', font: `800 40px/1.05 ${MONO}`, letterSpacing: '.14em', color: NEGRO }}>{entrada.codigo}</p>
                                </div>
                                <FilasDeLaEntrada entrada={entrada} />
                            </div>

                            {faltanDatos ? (
                                <div style={{ animation: sinMovimiento ? 'none' : `ncIn .4s ${CURVA} .75s both` }}>
                                    <div style={{ marginTop: 20, background: LIMA, borderRadius: 22, boxShadow: anillo(3), padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                        <Bang tam={26} />
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{ margin: '1px 0 0', ...arch(900, '17px', '1.3'), letterSpacing: '-.03em', color: NEGRO }}>
                                                {faltantes.length > 1
                                                    ? `Te faltan ${faltantes.length} datos para completar tu entrada`
                                                    : 'Te falta un dato para completar tu entrada'}
                                            </p>
                                            <p style={{ margin: '4px 0 0', ...arch(600, '14px', '1.4'), color: NEGRO }}>
                                                {faltantes.map(f => (f.esAdulto ? 'Tu teléfono' : `El de ${entrada.jovenes.find(j => j.id === f.clave)?.nombre || ''}`)).join(' y ')}.
                                            </p>
                                        </div>
                                    </div>
                                    <BotonGrande onClick={() => irA('completar')} style={{ marginTop: 14 }}>
                                        [ COMPLETAR AHORA ]
                                    </BotonGrande>
                                </div>
                            ) : (
                                <div style={{ animation: sinMovimiento ? 'none' : `ncIn .4s ${CURVA} .75s both` }}>
                                    <p style={{ margin: '26px 0 0', textAlign: 'center', font: `400 28px/1.05 ${FUENTE_PALABRA}`, color: NEGRO, textWrap: 'balance' as any }}>
                                        Todo en orden. Nos vemos el viernes.
                                    </p>
                                    <BotonGrande onClick={() => { setEntradaDesde('valida'); irA('entrada'); }} style={{ marginTop: 20 }}>
                                        [ VER MI ENTRADA ]
                                    </BotonGrande>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── 4 · Completar ── */}
                    {paso === 'completar' && entrada && (
                        <>
                            {titulo('Completá lo que falta')}
                            {bajada('Lo usamos solo la noche del evento, por si necesitamos comunicarnos con vos.')}

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 24 }}>
                                {faltantes.map((f, i) => {
                                    const d = tel[f.clave] || '';
                                    const bienEscrito = !!normalizarTelefono(d);
                                    const mal = !bienEscrito && ((tocados[f.clave] && d.length > 0) || intentoGuardar);
                                    const bien = bienEscrito;
                                    return (
                                        <div key={f.clave}>
                                            <label htmlFor={`tel-${f.clave}`} style={{ display: 'block', ...arch(800, '12px'), letterSpacing: '.04em', color: NEGRO }}>
                                                {f.etiqueta}
                                            </label>
                                            <div
                                                style={{
                                                    display: 'flex', alignItems: 'center', height: 62, marginTop: 8,
                                                    padding: '0 10px 0 18px', borderRadius: 18, background: LIMA,
                                                    boxShadow: anillo(mal ? 3.5 : 2, mal ? '#B3001B' : NEGRO),
                                                    animation: mal && intentoGuardar && !sinMovimiento ? sacudida : 'none',
                                                }}
                                            >
                                                <span style={{ ...arch(800, '17px'), color: NEGRO, flex: 'none' }}>+54</span>
                                                <span aria-hidden="true" style={{ width: 2, height: 26, background: NEGRO, margin: '0 12px', flex: 'none' }} />
                                                <input
                                                    id={`tel-${f.clave}`}
                                                    ref={i === 0 ? primerTel : undefined}
                                                    type="tel"
                                                    inputMode="numeric"
                                                    autoComplete={f.esAdulto ? 'tel-national' : 'off'}
                                                    placeholder="11 2345 6789"
                                                    value={formatear(d)}
                                                    onChange={e => escribirTel(f.clave, e.target.value)}
                                                    onBlur={() => setTocados(t => ({ ...t, [f.clave]: true }))}
                                                    style={{ flex: 1, minWidth: 0, height: '100%', border: 0, padding: 0, background: 'transparent', ...arch(700, '18px'), letterSpacing: '.01em', color: NEGRO }}
                                                />
                                                {bien && (
                                                    <span
                                                        aria-label="Número válido"
                                                        style={{ width: 30, height: 30, borderRadius: 999, background: NEGRO, color: LIMA, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', ...arch(900, '15px'), animation: sinMovimiento ? 'none' : `ncPop .3s ${CURVA}` }}
                                                    >✓</span>
                                                )}
                                            </div>
                                            {mal && (
                                                <div role="alert" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 10 }}>
                                                    <Bang tam={22} />
                                                    <p style={{ margin: '1px 0 0', ...arch(800, '14px', '1.4'), color: NEGRO }}>
                                                        Revisá el número: tiene que tener 10 dígitos, con el código de área.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {errorGuardar && (
                                <div role="alert" style={{ marginTop: 22, background: NEGRO, borderRadius: 22, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start', animation: 'ncFade .25s ease-out' }}>
                                    <Bang invertido />
                                    <p style={{ margin: '2px 0 0', ...arch(800, '15px', '1.4'), color: BLANCO }}>{errorGuardar}</p>
                                </div>
                            )}

                            {bloqueado && (
                                <Cartel>
                                    <p style={{ margin: 0, ...arch(800, '16px', '1.4'), color: BLANCO }}>
                                        Hiciste muchos intentos. Esperá 5 minutos y probá de nuevo.
                                    </p>
                                    <p aria-live="polite" style={{ margin: '8px 0 0', font: `800 46px/1 ${MONO}`, color: LIMA }}>{cuenta}</p>
                                </Cartel>
                            )}

                            <BotonGrande onClick={() => void guardar()} cargando={guardando} style={{ marginTop: 26 }}>
                                {guardando ? '[ GUARDANDO ]' : '[ GUARDAR ]'}
                            </BotonGrande>
                        </>
                    )}

                    {/* ── 5 · Listo ── */}
                    {paso === 'listo' && entrada && (
                        <>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14 }}>
                                <div style={{ width: 128, height: 128, borderRadius: 999, background: NEGRO, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: sinMovimiento ? 'none' : `ncPop .5s ${CURVA} both` }}>
                                    <div style={{ transform: 'translateY(-8px) rotate(-45deg)' }}>
                                        <div style={{ width: 58, height: 28, borderLeft: `11px solid ${LIMA}`, borderBottom: `11px solid ${LIMA}`, animation: sinMovimiento ? 'none' : 'ncDraw .45s ease-out .35s both' }} />
                                    </div>
                                </div>
                                <div style={{ marginTop: -18, background: LIMA, borderRadius: 16, padding: '10px 18px 9px', transform: 'rotate(-6deg)', boxShadow: anillo(3), animation: sinMovimiento ? 'none' : `ncStamp .55s ${CURVA} .7s both` }}>
                                    <p style={{ margin: 0, font: `400 ${esDesktop ? 24 : 21}px/1 ${FUENTE_PALABRA}`, color: NEGRO, whiteSpace: 'nowrap' }}>ENTRADA COMPLETA</p>
                                </div>
                            </div>
                            <h1 style={{ margin: '30px 0 0', textAlign: 'center', font: `400 ${esDesktop ? 42 : 34}px/1.02 ${FUENTE_PALABRA}`, color: NEGRO, textWrap: 'balance' as any }}>
                                Gracias, {nombre}. Ya está todo.
                            </h1>
                            <BotonGrande onClick={() => { setEntradaDesde('listo'); irA('entrada'); }} style={{ marginTop: 28 }}>
                                [ VER MI ENTRADA ]
                            </BotonGrande>
                            <BotonGrande variante="borde" onClick={() => navigate('/')} style={{ marginTop: 10 }}>
                                [ VOLVER AL INICIO ]
                            </BotonGrande>
                        </>
                    )}

                    {/* ── La entrada, con el QR ── */}
                    {paso === 'entrada' && entrada && (
                        <>
                            <h1 style={{ margin: '6px 0 0', font: `400 ${esDesktop ? 60 : 46}px/0.98 ${FUENTE_PALABRA}`, color: NEGRO }}>Tu entrada</h1>
                            <p style={{ margin: '10px 0 0', ...arch(800, '16px', '1.4'), letterSpacing: '-.02em', color: NEGRO }}>Guardala en tu celular.</p>

                            <div style={{ marginTop: 20 }}>
                                <div
                                    style={{
                                        background: BLANCO, borderRadius: '26px 26px 0 0', padding: '22px 20px 18px', textAlign: 'center',
                                        WebkitMaskImage: MASCARA_ARRIBA, maskImage: MASCARA_ARRIBA,
                                    }}
                                >
                                    {/* El mismo QR que la entrada de la inscripción: lo que
                                        lee el escáner es el id, no el código. */}
                                    <div
                                        role="img"
                                        aria-label={`Código QR de la entrada ${entrada.codigo}`}
                                        style={{ width: '100%', maxWidth: esDesktop ? 240 : 220, margin: '0 auto', background: BLANCO }}
                                    >
                                        <QRCodeSVG
                                            value={entrada.id}
                                            size={240}
                                            level="M"
                                            bgColor="#ffffff"
                                            fgColor="#000000"
                                            aria-hidden="true"
                                            style={{ display: 'block', width: '100%', height: 'auto' }}
                                        />
                                    </div>
                                    <p style={{ margin: '14px 0 0', ...arch(800, '11px'), letterSpacing: '.1em', color: NEGRO }}>CÓDIGO DE ENTRADA</p>
                                    <p style={{ margin: '6px 0 0', font: `800 40px/1.05 ${MONO}`, letterSpacing: '.14em', color: NEGRO }}>{entrada.codigo}</p>
                                </div>
                                <FilasDeLaEntrada entrada={entrada} />
                            </div>

                            <BotonGrande variante="borde" onClick={() => irA(entradaDesde)} style={{ marginTop: 20 }}>
                                [ VOLVER ]
                            </BotonGrande>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChequearEntrada;

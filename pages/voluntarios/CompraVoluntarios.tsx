// ════════════════════════════════════════════════════════════════════════
// /voluntarios — comprar remeras y buzos del Punto con una transferencia.
//
// Implementa design-claude/Voluntarios - Compra.dc.html: la pantalla 0, los
// pasos —Tu pedido y Pagá— y el ticket final. Eran tres: "Tus datos" se
// retiró, porque lo que confirmaba ya se lee en la 0.
//
// Es PÚBLICA: sin sesión no redirige, muestra la pantalla 0 y de ahí manda
// al login. Volver es la parte delicada y va documentada abajo.
//
// Por la pantalla 0 pasa TODO el mundo, también quien ya tiene la sesión
// puesta. Antes se la salteaba y la compra arrancaba sola: en un teléfono
// prestado, o con la cuenta de otro todavía abierta, uno llegaba al paso de
// pagar sin haber visto nunca a nombre de quién estaba comprando. Con sesión
// la pantalla dice quién sos y ofrece las dos salidas reales: seguir, o
// cerrar la sesión y entrar con la tuya.
//
// Nada que valga plata se decide acá. El precio, el total, el stock y el
// código salen de registrar_venta_voluntario (sql/voluntarios_ventas.sql).
// Esta pantalla junta lo que la persona eligió, manda el total que MOSTRÓ y,
// si no coincide con el de la base, no cobra: avisa y deja mirar de nuevo.
//
// ── La vuelta del login ───────────────────────────────────────────────
// Dos capas a la vez, como Nocturna, porque cubren caminos distintos:
//   · sessionStorage('post_login_redirect') sobrevive el redirect completo
//     de Google, que recarga la página y se lleva el state de react-router.
//     App.tsx lo consume cuando el perfil ya está completo.
//   · navigate('/auth', { state: { from } }) cubre email y contraseña, donde
//     no hay recarga y lo lee handleAuthScreenLogin.
//
// ── El borrador ───────────────────────────────────────────────────────
// El pedido, el paso, el teléfono y el comprobante YA SUBIDO viven en
// sessionStorage. Sin eso, ir a iniciar sesión en el medio de la compra
// borraría todo, que es exactamente cuando más duele. El id de la venta se
// crea UNA vez por pedido y se reusa en cada reintento: dos toques seguidos
// no cobran dos veces.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBarraDeAppSuelta } from '../../contexts/BarraDeApp';
import { useFullBleedHero } from '../../contexts/HeroContext';
import { useBloqueoDeFondo } from '../../hooks/useBloqueoDeFondo';
import { guardarDestino } from '../../components/auth/SinAcceso';
import { safeUUID } from '../../services/uuidUtils';
import {
    getCatalogoVoluntarios, subirComprobanteVoluntario, registrarVentaVoluntario, fechaYHora,
    type ClaseDelCatalogo, type TalleAgotado, type MotivoDeFalla,
} from '../../services/ventasVoluntarios';
import {
    ALIAS, TITULAR, CUIT, ANIMACIONES, tokens, fondoDelPaso, useOscuro, useEsPc,
    fmt, Roll, copiarTexto, IconoRemera, IconoBuzo, Tilde, rot, type Tokens,
} from './piezas';

const RUTA = '/voluntarios';

/** Mientras cambie la forma del borrador, los viejos se descartan solos. */
const BORRADOR = 'voluntarios_borrador_v1';

/**
 * Marca que fue ESTA pantalla la que mandó a iniciar sesión.
 *
 * La pantalla 0 la ve todo el mundo, con sesión o sin ella. La única
 * excepción es volver del login: ahí la persona acaba de pasar por la 0 y
 * pedirle otro toque sería devolverla a la puerta que recién cruzó. Va en
 * sessionStorage y no en el state de react-router por lo mismo que el
 * destino: el login con Google recarga la página entera.
 */
const VOLVIENDO = 'voluntarios_volviendo';

/**
 * La portada, arriba de todo salvo en el ticket.
 *
 * Ocupa el lugar que tenían los tres segmentos del progreso, que se fueron:
 * cada paso lo dice su título. La barra de la app se monta encima, en
 * transparente, como en el inicio —la imagen no trae el logo de Origen
 * justamente porque lo pone la barra—, y recupera su fondo al scrollear.
 *
 * El fondo del recuadro es el mismo azul del archivo, así que la imagen entra
 * entera —`contain`, nunca recortada— y los costados que sobran en una
 * pantalla ancha no se notan.
 *
 * En el ticket no va: esa pantalla ya no es el trámite, es el comprobante que
 * se muestra en el mostrador, y ahí la barra vuelve a ser la de siempre.
 */
const PORTADA = '/voluntarios-portada.jpg';
const PORTADA_FONDO = '#1f2a46';
/** Cuánto sube la hoja sobre la portada; el radio de arriba es el mismo. */
const MONTA = 28;
/** Cuánto sube la imagen dentro de su recuadro, para acercarla al logo. */
const SUBE = 10;

type Paso = 0 | 1 | 2 | 3 | 4;
type EstadoComp = 'vacio' | 'subiendo' | 'listo' | 'error';

interface Linea {
    id: number;
    code: string;
    tipo: 'Remeras' | 'Buzos';
    talle: string;
    cant: number;
    precio: number;
    err?: boolean;
    flash?: boolean;
    saliendo?: boolean;
}

interface Ticket {
    codigo: string;
    lineas: { txt: string; sub: string }[];
    total: string;
    persona: string;
    cuando: string;
}

interface Borrador {
    paso: Paso;
    lineas: Linea[];
    nid: number;
    comp: EstadoComp;
    compPath: string | null;
    compNombre: string;
    compTam: string;
    ventaId: string;
    totalVisto: number | null;
}

const NOMBRE: Record<'Remeras' | 'Buzos', string> = { Remeras: 'Remera', Buzos: 'Buzo' };
const ART: Record<'Remeras' | 'Buzos', string> = { Remeras: 'la remera', Buzos: 'el buzo' };
/** Concordancia: "Cambiala o quitala" para la remera, "...lo" para el buzo. */
const LA_LO: Record<'Remeras' | 'Buzos', string> = { Remeras: 'a', Buzos: 'o' };

/** "248 KB" / "1,2 MB". */
const pesoTexto = (bytes: number): string =>
    bytes >= 1024 * 1024
        ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
        : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const CompraVoluntarios: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isLoadingSession, isLoadingProfile, signOut } = useAuth();
    const oscuro = useOscuro();
    const esPc = useEsPc();
    const t = useMemo(() => tokens(oscuro), [oscuro]);

    // ── Estado ──────────────────────────────────────────────────────────
    // El 1 era "Tus datos", que se retiró: lo único que hacía era mostrar
    // el nombre y el teléfono de la cuenta para que se confirmaran, y eso
    // ahora se ve en la pantalla 0, con la tarjeta de la cuenta. La compra
    // empieza en el pedido.
    const [paso, setPaso] = useState<Paso>(2);
    // La pantalla 0, la que presenta la compra y confirma con qué cuenta se
    // está comprando. Arranca puesta siempre; sólo volver del login la saltea.
    const [pasoCero, setPasoCero] = useState(() => {
        try {
            if (sessionStorage.getItem(VOLVIENDO) === '1') {
                sessionStorage.removeItem(VOLVIENDO);
                return false;
            }
        } catch { /* sin storage: se muestra, que es el camino normal */ }
        return true;
    });
    const [restaurado, setRestaurado] = useState(false);

    const [catalogo, setCatalogo] = useState<ClaseDelCatalogo[] | null>(null);
    const [fallaCatalogo, setFallaCatalogo] = useState(false);

    const [lineas, setLineas] = useState<Linea[]>([]);
    const [nid, setNid] = useState(1);
    const [prod, setProd] = useState<'Remeras' | 'Buzos' | null>(null);
    const [talle, setTalle] = useState<string | null>(null);
    const [cant, setCant] = useState(1);
    const [aviso5, setAviso5] = useState(false);

    const [comp, setComp] = useState<EstadoComp>('vacio');
    const [compPath, setCompPath] = useState<string | null>(null);
    const [compNombre, setCompNombre] = useState('');
    const [compTam, setCompTam] = useState('');
    const [compErr, setCompErr] = useState('');
    const [compW, setCompW] = useState('0%');

    const [confirmando, setConfirmando] = useState(false);
    const [errConexion, setErrConexion] = useState(false);
    const [agotadoMsg, setAgotadoMsg] = useState('');
    const [totalVisto, setTotalVisto] = useState<number | null>(null);
    const [montoCambio, setMontoCambio] = useState(false);
    const [totalAntes, setTotalAntes] = useState(0);

    const [ventaId, setVentaId] = useState(() => safeUUID());
    const [ticket, setTicket] = useState<Ticket | null>(null);

    const [copiado, setCopiado] = useState<'alias' | null>(null);
    const [sheet, setSheet] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    const archivoRef = useRef<HTMLInputElement>(null);
    const hojaRef = useRef<HTMLDivElement>(null);
    const relojes = useRef<number[]>([]);

    const luego = useCallback((fn: () => void, ms: number) => {
        const id = window.setTimeout(fn, ms);
        relojes.current.push(id);
        return id;
    }, []);

    useEffect(() => () => { relojes.current.forEach(window.clearTimeout); }, []);

    const avisar = useCallback((txt: string) => {
        setToast(txt);
        luego(() => setToast(null), 2200);
    }, [luego]);

    // ── Quién es ────────────────────────────────────────────────────────
    const entero = (user?.name || '').trim();
    const nombre = entero ? entero.split(/\s+/)[0] : '';
    const apellido = entero ? entero.split(/\s+/).slice(1).join(' ') : '';
    const iniciales = [nombre, apellido].filter(Boolean)
        .map(p => p[0]?.toUpperCase() || '').join('').slice(0, 2) || '—';
    const telDeLaCuenta = (user?.phone || '').trim();

    // ── La vuelta del login ─────────────────────────────────────────────
    //
    // Si la marca quedó colgada —se entró directo con la sesión puesta, o el
    // destino ya se consumió— se limpia: dejarla haría que un login posterior
    // desde otra pantalla termine acá sin que nadie lo pidiera.
    useEffect(() => {
        if (!user) return;
        try {
            if (sessionStorage.getItem('post_login_redirect') === RUTA) {
                sessionStorage.removeItem('post_login_redirect');
            }
        } catch { /* sin storage */ }
    }, [user]);

    const irAEntrar = () => {
        try { sessionStorage.setItem(VOLVIENDO, '1'); } catch { /* sin storage */ }
        guardarDestino({ pathname: RUTA, search: location.search });
        navigate('/auth', { state: { from: { pathname: RUTA, search: location.search } } });
    };

    /**
     * "Cerrar sesión", desde la pantalla 0.
     *
     * No navega a ningún lado: la pantalla es pública, así que se queda donde
     * está y vuelven los botones de entrar. Se lleva puesto el borrador —el
     * pedido es de quien estaba adentro, y el que entre después no tiene por
     * qué encontrarse el carrito de otro.
     */
    const cerrarSesion = async () => {
        limpiarBorrador();
        setLineas([]);
        setPaso(1);
        setPasoCero(true);
        await signOut();
    };

    // ── El borrador ─────────────────────────────────────────────────────
    useEffect(() => {
        try {
            const crudo = sessionStorage.getItem(BORRADOR);
            if (crudo) {
                const b = JSON.parse(crudo) as Borrador;
                if (b && Array.isArray(b.lineas)) {
                    setPaso(b.paso >= 2 && b.paso <= 3 ? b.paso : 2);
                    setLineas(b.lineas);
                    setNid(b.nid || b.lineas.length + 1);
                    // El comprobante se restaura sólo si llegó a subirse: un
                    // 'subiendo' guardado es una subida que se cortó.
                    if (b.comp === 'listo' && b.compPath) {
                        setComp('listo');
                        setCompPath(b.compPath);
                        setCompNombre(b.compNombre || '');
                        setCompTam(b.compTam || '');
                    }
                    if (b.ventaId) setVentaId(b.ventaId);
                    setTotalVisto(b.totalVisto ?? null);
                }
            }
        } catch { /* sin storage o borrador roto: se arranca limpio */ }
        setRestaurado(true);
    }, []);

    useEffect(() => {
        if (!restaurado) return;
        // Compra confirmada: el borrador se va y no vuelve. Sin esto, este
        // mismo efecto lo reescribía justo después de limpiarlo, y la próxima
        // visita arrancaba con el pedido ya pagado y un comprobante usado.
        if (paso === 4) { limpiarBorrador(); return; }
        try {
            const b: Borrador = {
                paso,
                lineas, nid,
                comp: comp === 'listo' ? 'listo' : 'vacio',
                compPath, compNombre, compTam, ventaId, totalVisto,
            };
            sessionStorage.setItem(BORRADOR, JSON.stringify(b));
        } catch { /* sin storage: el borrador no sobrevive, la compra sí */ }
    }, [restaurado, paso, lineas, nid, comp, compPath, compNombre, compTam, ventaId, totalVisto]);

    const limpiarBorrador = () => {
        try { sessionStorage.removeItem(BORRADOR); } catch { /* sin storage */ }
    };

    // ── El catálogo ─────────────────────────────────────────────────────
    const pedirCatalogo = useCallback(async () => {
        setFallaCatalogo(false);
        const c = await getCatalogoVoluntarios();
        if (!c) setFallaCatalogo(true); else setCatalogo(c);
    }, []);

    useEffect(() => { if (user) pedirCatalogo(); }, [user, pedirCatalogo]);

    const porTipo = (tipo: 'Remeras' | 'Buzos') => catalogo?.find(c => c.tipo === tipo);
    const tallesDe = (tipo: 'Remeras' | 'Buzos') => porTipo(tipo)?.talles ?? [];

    // ── Las cuentas ─────────────────────────────────────────────────────
    const vivas = useMemo(() => lineas.filter(l => !l.saliendo), [lineas]);
    const total = useMemo(() => vivas.reduce((a, l) => a + l.cant * l.precio, 0), [vivas]);
    const nProd = vivas.reduce((a, l) => a + l.cant, 0);
    const hayErr = vivas.some(l => l.err);

    const arriba = () => {
        try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch { window.scrollTo(0, 0); }
    };

    const ir = (p: Paso) => { setPaso(p); setSheet(false); arriba(); };

    /**
     * Volver, paso por paso, hasta la pantalla 0.
     *
     * Del primer paso no sale a la app: devuelve a la 0. Ahí está "Cerrar
     * sesión", que es a lo que vuelve quien se dio cuenta de que entró con la
     * cuenta de otro —y es el único lugar donde eso se puede arreglar.
     * El pedido no se toca: sigue en el borrador, y Continuar lo devuelve
     * donde estaba.
     */
    const atras = () => {
        if (paso === 2) { setPasoCero(true); setSheet(false); arriba(); return; }
        setMontoCambio(false);
        ir((paso - 1) as Paso);
    };

    // ── Armar el pedido ─────────────────────────────────────────────────
    const agregar = () => {
        if (!prod || !talle) return;
        const info = tallesDe(prod).find(x => x.code === talle);
        if (!info) return;

        const ex = vivas.find(l => l.code === info.code);
        if (ex) {
            const nc = ex.cant + cant;
            setLineas(ls => ls.map(l => (l.id === ex.id
                ? { ...l, cant: Math.min(5, nc), flash: true, err: false }
                : l)));
            setAviso5(nc > 5);
            luego(() => setLineas(ls => ls.map(l => (l.id === ex.id ? { ...l, flash: false } : l))), 700);
        } else {
            setLineas(ls => ls.concat([{
                id: nid, code: info.code, tipo: prod, talle: info.size,
                cant, precio: info.precio, err: false,
            }]));
            setNid(n => n + 1);
            setAviso5(false);
        }
        setTalle(null);
        setCant(1);
    };

    const quitar = (id: number) => {
        setLineas(ls => ls.map(l => (l.id === id ? { ...l, saliendo: true } : l)));
        setAviso5(false);
        luego(() => setLineas(ls => ls.filter(l => l.id !== id)), 260);
    };

    const cambiarCant = (id: number, delta: number) => {
        setLineas(ls => ls.map(l => (l.id === id
            ? { ...l, cant: Math.min(5, Math.max(1, l.cant + delta)) }
            : l)));
    };

    // ── El comprobante ──────────────────────────────────────────────────
    //
    // La barra NO llega a 100 % hasta que el archivo está arriba de verdad.
    // supabase-js no informa el progreso, así que se avanza hasta donde se
    // puede prometer y el tramo final lo dispara la respuesta. Una barra que
    // se llena y después muestra un error es una mentira corta y cara.
    const elegirArchivo = () => archivoRef.current?.click();

    const alElegirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file || !user) return;

        setComp('subiendo');
        setCompW('6%');
        setErrConexion(false);
        luego(() => setCompW('72%'), 60);

        const r = await subirComprobanteVoluntario(file, user.id);

        // `'error' in r` y no `!r.ok`: sin strictNullChecks el booleano no
        // angosta la unión y TypeScript sigue viendo las dos ramas.
        if ('error' in r) {
            setComp('error');
            setCompErr(r.error);
            setCompW('0%');
            return;
        }

        setCompW('100%');
        setCompPath(r.path);
        setCompNombre(file.name || 'comprobante');
        setCompTam(pesoTexto(file.size));
        luego(() => setComp('listo'), 220);
    };

    const quitarComp = () => {
        setComp('vacio');
        setCompPath(null);
        setCompNombre('');
        setCompTam('');
        setCompW('0%');
    };

    // ── Confirmar ───────────────────────────────────────────────────────
    const confirmar = async () => {
        if (comp !== 'listo' || !compPath || confirmando || !vivas.length) return;
        setConfirmando(true);
        setErrConexion(false);

        const r = await registrarVentaVoluntario({
            id: ventaId,
            items: vivas.map(l => ({ code: l.code, cantidad: l.cant })),
            comprobantePath: compPath,
            totalEsperado: total,
        });

        setConfirmando(false);

        // Primero lo que NO se pudo cobrar, por el mismo motivo de arriba.
        if ('motivo' in r) {
            atenderRechazo(r.motivo, r.items, r.total);
            return;
        }

        {
            limpiarBorrador();
            setTicket({
                codigo: r.codigo,
                lineas: vivas.map(l => ({
                    txt: `${l.cant} × ${NOMBRE[l.tipo]} · Talle ${l.talle}`,
                    sub: fmt(l.cant * l.precio),
                })),
                total: fmt(r.total),
                persona: `${entero}${telDeLaCuenta ? ` · ${telDeLaCuenta}` : ''}`,
                // La hora del SERVIDOR, no la del telefono: el ticket se
                // muestra en el stand y el reloj de un celular puede estar
                // corrido. fechaYHora ya lo escribe en hora argentina.
                cuando: fechaYHora(r.createdAt),
            });
            setMontoCambio(false);
            ir(4);
        }
    };

    /** Lo que contesta la base cuando no se puede cobrar, traducido a pantalla. */
    const atenderRechazo = (motivo: MotivoDeFalla, items?: TalleAgotado[], nuevo?: number) => {
        if (motivo === 'sin_stock') {
            const agotados = new Set((items || []).map(i => i.code));
            // El comprobante NO se toca: ya está pago y subido.
            setLineas(ls => ls.map(l => (agotados.has(l.code) ? { ...l, err: true } : l)));
            const primero = (items || [])[0];
            if (primero) {
                const tipo: 'Remeras' | 'Buzos' = primero.type === 'Buzos' ? 'Buzos' : 'Remeras';
                setAgotadoMsg(
                    `Se agotó ${ART[tipo]} talle ${primero.size} mientras comprabas. `
                    + `Cambial${LA_LO[tipo]} o quital${LA_LO[tipo]}.`,
                );
            } else {
                setAgotadoMsg('Se agotó un talle mientras comprabas. Cambialo o quitalo.');
            }
            setTotalVisto(total);
            pedirCatalogo();
            ir(2);
            return;
        }

        if (motivo === 'precio_cambio') {
            setTotalAntes(total);
            setMontoCambio(true);
            if (typeof nuevo === 'number') {
                // El precio de la base manda: se reescriben los renglones con
                // él para que el total de la pantalla deje de mentir.
                pedirCatalogo();
                setTotalVisto(nuevo);
            }
            ir(3);
            return;
        }

        if (motivo === 'comprobante_invalido') {
            quitarComp();
            setCompErr('No encontramos ese comprobante. Subilo de nuevo.');
            setComp('error');
            ir(3);
            return;
        }

        if (motivo === 'falta_telefono') {
            ir(1);
            return;
        }

        if (motivo === 'pedido_invalido') {
            setAgotadoMsg('Revisá el pedido: hay algo que no podemos cobrar así.');
            ir(2);
            return;
        }

        setErrConexion(true);
    };

    // ── El precio de la base, cuando cambia ─────────────────────────────
    //
    // Al refrescar el catálogo después de un precio_cambio, los renglones
    // tienen que tomar el precio nuevo: si no, el total que se muestra sigue
    // siendo el viejo y la base lo volvería a rechazar.
    useEffect(() => {
        if (!catalogo) return;
        setLineas(ls => ls.map(l => {
            const info = tallesDe(l.tipo).find(x => x.code === l.code);
            return info && info.precio !== l.precio ? { ...l, precio: info.precio } : l;
        }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catalogo]);

    // ── Copiar ──────────────────────────────────────────────────────────
    const copiar = async (cual: 'alias', texto: string) => {
        const ok = await copiarTexto(texto);
        if (!ok) { avisar('No pudimos copiarlo. Anotalo a mano.'); return; }
        setCopiado(cual);
        luego(() => setCopiado(c => (c === cual ? null : c)), 1800);
    };

    // ── La hoja del teléfono ────────────────────────────────────────────
    useBloqueoDeFondo(sheet);

    useEffect(() => {
        if (!sheet) return;
        const alTecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setSheet(false); };
        window.addEventListener('keydown', alTecla);
        hojaRef.current?.focus();
        return () => window.removeEventListener('keydown', alTecla);
    }, [sheet]);

    const arrastre = useRef<{ y: number; dy: number } | null>(null);
    const alArrastrar = {
        onPointerDown: (e: React.PointerEvent) => {
            arrastre.current = { y: e.clientY, dy: 0 };
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* da igual */ }
            if (hojaRef.current) hojaRef.current.style.transition = 'none';
        },
        onPointerMove: (e: React.PointerEvent) => {
            if (!arrastre.current) return;
            const dy = Math.max(0, e.clientY - arrastre.current.y);
            arrastre.current.dy = dy;
            if (hojaRef.current) hojaRef.current.style.transform = `translateY(${dy}px)`;
        },
        onPointerUp: () => {
            if (!arrastre.current) return;
            const { dy } = arrastre.current;
            arrastre.current = null;
            const el = hojaRef.current;
            if (el) { el.style.transition = 'transform .2s ease'; el.style.transform = ''; }
            if (dy > 90) setSheet(false);
        },
    };

    // ── El botón principal ──────────────────────────────────────────────
    let principalTxt = '';
    let principalOff = true;
    let razon = '';
    let principal: () => void = () => { };

    if (paso === 2) {
        principalTxt = 'Ir a pagar';
        principalOff = !vivas.length || hayErr;
        razon = !vivas.length
            ? 'Agregá al menos una prenda.'
            : hayErr ? 'Cambiá o quitá el producto agotado para seguir.' : '';
        principal = () => {
            if (principalOff) return;
            const cambio = totalVisto != null && totalVisto !== total;
            setMontoCambio(cambio);
            setTotalAntes(totalVisto || 0);
            setTotalVisto(cambio ? totalVisto : total);
            setAviso5(false);
            ir(3);
        };
    } else if (paso === 3) {
        principalTxt = confirmando ? 'Confirmando…' : 'Confirmar compra';
        principalOff = comp !== 'listo' || confirmando;
        razon = comp !== 'listo' && !confirmando ? 'Subí el comprobante para confirmar.' : '';
        principal = confirmar;
    }

    // ── Qué pantalla toca ───────────────────────────────────────────────
    const cargandoSesion = isLoadingSession || isLoadingProfile;
    // Con sesión la pantalla 0 también se muestra, hasta que se toque
    // "Continuar". Sin sesión no hay otra cosa que mostrar.
    const mostrarSplash = !cargandoSesion && (!user || pasoCero) && paso !== 4;
    // El esqueleto espera su turno detrás de la 0: mientras se lee con qué
    // cuenta se compra, el catálogo se trae por atrás y no hay nada que
    // avisar. Los dos bloques son hermanos en el JSX, así que sin esto se
    // apilarían uno debajo del otro.
    const mostrarEsqueleto = !mostrarSplash
        && (cargandoSesion || (!!user && !restaurado) || (!!user && !catalogo && !fallaCatalogo));
    const enPasos = !!user && !pasoCero && !mostrarEsqueleto && paso >= 2 && paso <= 3;
    const mostrarListo = paso === 4 && !!ticket;

    /** El ticket es la única pantalla sin portada. */
    const hayPortada = !mostrarListo;

    // Con portada, la barra de la app se monta encima en transparente y el
    // contenido sube los 64px de la barra, igual que el hero del inicio. En
    // el ticket no hay imagen detrás: la barra vuelve a tener su fondo, y se
    // apaga sola al salir de la ruta.
    //
    // Transparente SIEMPRE, no sólo arriba de todo: como la barra ya no se
    // pega al scroll, recuperar el fondo blanco al primer desplazamiento se
    // vería como un parpadeo justo antes de irse de pantalla.
    useFullBleedHero(hayPortada, hayPortada);

    // Acá la barra no sigue al dedo: es la cabecera de la portada, se queda
    // arriba de todo y se va con ella. Vuelve a pegarse al salir de la ruta.
    useBarraDeAppSuelta();

    const bg = fondoDelPaso(mostrarSplash ? 0 : mostrarListo ? 4 : paso, oscuro);
    const padInferior = esPc ? 64 : (vivas.length ? 250 : 200);

    // ── Estilos que se repiten ──────────────────────────────────────────
    const circulo = (dis: boolean): React.CSSProperties => ({
        width: 44, height: 44, flex: 'none', border: 0, borderRadius: 999,
        background: t.chip, color: t.ink, display: 'flex', alignItems: 'center',
        justifyContent: 'center', cursor: dis ? 'default' : 'pointer', opacity: dis ? 0.35 : 1,
    });
    const chipBtn: React.CSSProperties = {
        height: 44, padding: '0 16px', border: 0, borderRadius: 999,
        background: t.chip, color: t.ink, fontSize: 13.5, fontWeight: 600,
        cursor: 'pointer', whiteSpace: 'nowrap',
    };
    const tarjeta: React.CSSProperties = {
        background: t.card, borderRadius: 26, padding: 20, boxShadow: t.shadow,
    };
    const zona: React.CSSProperties = {
        width: '100%', minHeight: 150, padding: 22, border: `2px dashed ${t.m22}`,
        borderRadius: 22, background: oscuro ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,.55)',
        color: t.ink, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 12, textAlign: 'center', cursor: 'pointer',
    };
    const principalStyle: React.CSSProperties = {
        width: '100%', height: 58, border: 0, borderRadius: 999,
        background: t.prim, color: t.primInk, display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: 10, fontSize: 16.5, fontWeight: 600,
        cursor: principalOff ? 'default' : 'pointer',
        opacity: principalOff && !confirmando ? 0.3 : 1, transition: 'opacity .2s',
    };
    const skel: React.CSSProperties = {
        background: t.skel, borderRadius: 10, animation: 'vcPulse 1.2s ease-in-out infinite',
    };

    const compEstado = comp === 'listo' ? 'Comprobante subido'
        : comp === 'subiendo' ? 'Subiendo el comprobante…'
            : comp === 'error' ? 'El comprobante no se pudo subir'
                : 'Falta subir el comprobante';

    const resumen = vivas.map(l => ({
        txt: `${l.cant} × ${NOMBRE[l.tipo]} · Talle ${l.talle}`,
        sub: fmt(l.cant * l.precio),
        ink: l.err ? t.red : t.ink,
    }));

    // ── El panel del pedido (aside en PC, hoja en el teléfono) ──────────
    const CuerpoResumen = (
        <>
            <p style={rot(t)}>TU PEDIDO</p>
            <div style={{ marginTop: 12 }}>
                {resumen.map((r, i) => (
                    <div key={i} style={{
                        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                        gap: 12, padding: '10px 0', borderBottom: `1px solid ${t.line}`,
                        animation: 'vcLine .3s ease both',
                    }}>
                        <span style={{ fontSize: 14.5, fontWeight: 600, color: r.ink }}>{r.txt}</span>
                        <span style={{ fontSize: 14.5, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap' }}>{r.sub}</span>
                    </div>
                ))}
                {!vivas.length && (
                    <p style={{
                        margin: 0, padding: '10px 0 14px', fontSize: 14, color: t.m52,
                        borderBottom: `1px solid ${t.line}`,
                    }}>Todavía no agregaste nada.</p>
                )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 16 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: t.m52 }}>Total</span>
                <Roll valor={total} tam={26} color={t.ink} />
            </div>
            <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginTop: 16,
                padding: '12px 14px', borderRadius: 16, background: t.surf,
            }}>
                <span style={{
                    width: 9, height: 9, flex: 'none', borderRadius: 999,
                    background: comp === 'listo' ? t.ink : 'transparent',
                    boxShadow: `inset 0 0 0 2px ${comp === 'listo' ? t.ink : t.m38}`,
                }} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: t.ink }}>{compEstado}</span>
            </div>
        </>
    );

    return (
        <div
            className="vc"
            style={{
                minHeight: '100vh', background: bg, transition: 'background-color .4s ease',
                color: t.ink, fontFamily: "Manrope, system-ui, sans-serif",
            }}
        >
            <style>{ANIMACIONES}</style>
            <input
                ref={archivoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                onChange={alElegirArchivo}
                style={{ display: 'none' }}
                aria-hidden="true"
                tabIndex={-1}
            />

            {/* ══ La portada ══ */}
            {hayPortada && (
                <div style={{
                    position: 'relative', width: '100%', background: PORTADA_FONDO,
                    height: esPc ? 260 : undefined, lineHeight: 0, overflow: 'hidden',
                }}>
                    {/* La imagen sube SUBE px y el recuadro se queda con su
                        alto: lo que se recorta arriba es azul vacío, y abajo
                        asoma el mismo azul del archivo. El texto de la portada
                        queda más cerca del logo de la barra, que es lo que lo
                        hace leerse como una sola cabecera y no como dos cosas
                        sueltas con un hueco en el medio. */}
                    <img
                        src={PORTADA}
                        alt="Punto de Información · Información y novedades"
                        style={{
                            display: 'block', width: '100%', marginTop: -SUBE,
                            height: esPc ? `calc(100% + ${SUBE}px)` : 'auto', objectFit: 'contain',
                        }}
                    />
                </div>
            )}

            {/* ══ La hoja, montada sobre la portada ══
                Lleva el fondo del paso —no blanco— para que cada tramo
                conserve su color; lo que se ve por las esquinas redondeadas
                es la portada de atrás. */}
            <div style={{
                position: 'relative', background: bg,
                transition: 'background-color .4s ease',
                marginTop: hayPortada ? -MONTA : 0,
                borderTopLeftRadius: hayPortada ? MONTA : 0,
                borderTopRightRadius: hayPortada ? MONTA : 0,
                // Llena la pantalla sin pasarse: en el teléfono la portada
                // mide 53vw —el alto de la imagen a todo el ancho— y la hoja
                // se monta MONTA px sobre ella. Sin portada lo único que hay
                // arriba es la barra de la app, que mide 64.
                minHeight: !hayPortada
                    ? 'calc(100vh - 64px)'
                    : esPc
                        ? `calc(100vh - ${260 - MONTA}px)`
                        : `calc(100vh - 53vw + ${MONTA}px)`,
            }}>

            {/* ══ 0 · Sin sesión ══ */}
            {mostrarSplash && (
                <div style={{
                    display: 'flex', flexDirection: 'column',
                    padding: esPc ? 40 : '34px 20px 60px',
                    animation: 'vcIn .35s ease both',
                }}>
                    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto' }}>
                        {/* El saludo y lo que lo completa son UNA frase partida
                            en dos tamaños, no un título con su bajada: por eso
                            van pegados —8px— y no separados como dos bloques.
                            Es lo único que levanta la voz en la pantalla; la
                            tarjeta de la cuenta y los botones siguen en el tono
                            de siempre.

                            El rótulo "ORIGEN · VOLUNTARIOS" se fue antes, y por
                            el mismo motivo: la portada ya dice de quién es esto
                            y el saludo dice a qué entraste. */}
                        <h1 style={{
                            margin: 0, fontSize: esPc ? 42 : 36, lineHeight: 1.05, fontWeight: 700,
                            letterSpacing: '-.035em', color: t.ink,
                        }}>¡Bienvenidos!</h1>
                        <p style={{
                            margin: '8px 0 0', fontSize: esPc ? 18 : 17, lineHeight: 1.45,
                            fontWeight: 500, color: t.m52,
                            // Renglones parejos y cortos: una frase de ancho
                            // completo al lado de un saludo corto se lee como
                            // letra chica, no como la segunda mitad de la frase.
                            textWrap: 'balance', maxWidth: '30ch',
                        }}>Al punto de ventas de remeras y buzos de los voluntarios de la casa.</p>

                        {/* Con sesión: quién sos, y las dos salidas. El nombre
                            va antes que los botones porque es lo que decide
                            cuál de los dos tocar.

                            Los espacios de acá abajo no son parejos a propósito:
                            agrupan. La tarjeta dice quién sos; los dos botones y
                            la línea chica que los explica son lo que se hace con
                            eso, y van juntos; "Volver al inicio" es otra cosa
                            —irse— y por eso queda lejos. Parejos, los cuatro
                            bloques se leían como una sola lista. */}
                        {user && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 16, marginTop: 30,
                                padding: 16, borderRadius: 22, background: t.card, boxShadow: t.shadow,
                            }}>
                                <div style={{
                                    width: 44, height: 44, flex: 'none', borderRadius: 999, overflow: 'hidden',
                                    background: t.prim, color: t.primInk, display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontSize: 15, fontWeight: 600,
                                }}>
                                    {user.avatarUrl
                                        ? <img src={user.avatarUrl} alt="" aria-hidden="true" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : iniciales}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <p style={{
                                        margin: 0, fontSize: 16, fontWeight: 600, color: t.ink,
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>{entero || 'Tu cuenta'}</p>
                                    {user.email && (
                                        <p style={{
                                            margin: '2px 0 0', fontSize: 13.5, color: t.m52,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>{user.email}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* El bloque de botones arranca bien abajo de lo que
                            lo precede —la tarjeta de la cuenta, o el saludo si
                            no hay sesión—: lo que está arriba se lee, y recién
                            después se decide. La nota y "Volver al inicio"
                            bajan con él, que es lo que los mantiene agrupados. */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 40 }}>
                            {user && (
                                <>
                                    <button type="button" onClick={() => setPasoCero(false)} style={{
                                        height: 58, border: 0, borderRadius: 999, background: t.prim,
                                        color: t.primInk, fontSize: 16.5, fontWeight: 600, cursor: 'pointer',
                                    }}>Continuar</button>
                                    <button type="button" onClick={cerrarSesion} style={{
                                        height: 58, border: `1px solid ${t.line}`, borderRadius: 999,
                                        background: t.card, color: t.ink, fontSize: 16.5, fontWeight: 600,
                                        cursor: 'pointer',
                                    }}>Cerrar sesión</button>
                                </>
                            )}
                            {/* Un solo botón, y dice lo que hace.
                                Acá había dos —"Continuar con Google" y "Entrar
                                con email"— y los dos llamaban a la MISMA
                                función: ninguno entra, los dos llevan a /auth,
                                que es donde se elige cómo entrar. El de Google
                                además llevaba el logo, así que prometía entrar
                                con Google y no lo hacía. Si algún día esta
                                pantalla arranca el login de Google de verdad,
                                vuelve el botón con su logo y se gana el lugar. */}
                            {!user && (
                                <button type="button" onClick={irAEntrar} style={{
                                    height: 58, border: 0, borderRadius: 999, background: t.prim,
                                    color: t.primInk, fontSize: 16.5, fontWeight: 600, cursor: 'pointer',
                                }}>Entrar para comprar</button>
                            )}
                        </div>
                        <p style={{ margin: '16px 0 0', textAlign: 'center', fontSize: 13.5, lineHeight: 1.45, color: t.m52 }}>
                            {user
                                ? 'Si no sos vos, cerrá la sesión y entrá con la tuya.'
                                : 'Después de entrar, volvés directo acá.'}
                        </p>

                        {/* La salida de la pantalla. Va acá abajo y en voz
                            baja —ancho de su texto, fondo de chip— porque es
                            lo contrario de lo que esta pantalla propone: no
                            tiene que competir con Continuar ni con Entrar. */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 30 }}>
                            <button type="button" onClick={() => navigate('/')} style={{
                                height: 44, padding: '0 20px', border: 0, borderRadius: 999,
                                background: t.chip, color: t.ink, fontSize: 14.5, fontWeight: 600,
                                cursor: 'pointer',
                            }}>Volver al inicio</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ══ Volviendo de iniciar sesión / trayendo el catálogo ══ */}
            {mostrarEsqueleto && (
                <div aria-busy="true" style={{ maxWidth: 1040, margin: '0 auto', padding: esPc ? '40px 40px 64px' : '16px 16px 40px' }}>
                    <div style={{ maxWidth: 560 }}>
                        <p style={{ margin: '0 0 16px', fontSize: 13.5, fontWeight: 600, color: t.m52 }}>
                            {user ? 'Preparando tu pedido…' : 'Volviendo de iniciar sesión…'}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ ...skel, width: 44, height: 44, borderRadius: 999 }} />
                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6 }}>
                                {[0, 1, 2].map(i => <div key={i} style={{ ...skel, height: 4 }} />)}
                            </div>
                        </div>
                        <div style={{ ...skel, width: 150, height: 26, marginTop: 30 }} />
                        <div style={{ background: t.card, borderRadius: 26, padding: 20, marginTop: 18 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ ...skel, width: 52, height: 52, borderRadius: 999 }} />
                                <div style={{ ...skel, width: 160, height: 16 }} />
                            </div>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{ ...skel, height: 52, marginTop: i === 0 ? 18 : 8, borderRadius: 16 }} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ══ 1 · 2 · 3 ══ */}
            {enPasos && (
                <div style={{ maxWidth: 1040, margin: '0 auto', padding: esPc ? '40px 40px 64px' : `16px 16px ${padInferior}px` }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: esPc ? 'minmax(0,560px) minmax(0,380px)' : 'minmax(0,1fr)',
                        gap: 48, justifyContent: 'center', alignItems: 'start',
                    }}>
                        <div style={{ minWidth: 0 }}>
                            {/* Acá vivían los tres segmentos del progreso, que
                                se fueron: cada paso lo anuncia su título.

                                Queda el volver, en el mismo tono bajo que
                                "Volver al inicio": retrocede un paso, y del
                                primero devuelve a la pantalla 0, que es donde
                                está "Cerrar sesión". */}
                            <button type="button" onClick={atras} style={{
                                height: 40, padding: '0 16px 0 11px', marginBottom: 18,
                                border: 0, borderRadius: 999, background: t.chip, color: t.ink,
                                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
                                Volver
                            </button>

                            {/* ── Paso 2 · Armá tu pedido ── */}
                            {paso === 2 && (
                                <div style={{ animation: 'vcIn .35s ease both' }}>
                                    <h2 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.025em', color: t.ink }}>Armá tu pedido</h2>

                                    {(hayErr || agotadoMsg) && (
                                        <div role="alert" style={{ background: t.card, borderRadius: 20, padding: '14px 16px', marginTop: 16 }}>
                                            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.45, fontWeight: 600, color: t.red }}>{agotadoMsg}</p>
                                            <p style={{ margin: '5px 0 0', fontSize: 13, lineHeight: 1.5, color: t.m52 }}>
                                                Tu comprobante sigue cargado. Si el total cambia, te lo marcamos antes de pagar.
                                            </p>
                                        </div>
                                    )}

                                    {fallaCatalogo && (
                                        <div role="alert" style={{ background: t.card, borderRadius: 20, padding: '14px 16px', marginTop: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                                            <p style={{ margin: 0, flex: '1 1 200px', fontSize: 14.5, lineHeight: 1.45, fontWeight: 600, color: t.red }}>
                                                No pudimos traer los talles disponibles.
                                            </p>
                                            <button type="button" onClick={pedirCatalogo} style={chipBtn}>Reintentar</button>
                                        </div>
                                    )}

                                    <div style={{ ...tarjeta, marginTop: 18 }}>
                                        <p style={rot(t)}>PRODUCTO</p>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, marginTop: 10 }}>
                                            {(['Remeras', 'Buzos'] as const).map(k => {
                                                const info = porTipo(k);
                                                const off = !info || info.talles.length === 0;
                                                const sel = prod === k;
                                                return (
                                                    <button
                                                        key={k}
                                                        type="button"
                                                        disabled={off}
                                                        aria-pressed={sel}
                                                        onClick={() => { if (!off) { setProd(k); setTalle(null); setAviso5(false); } }}
                                                        style={{
                                                            position: 'relative', minHeight: 150, padding: '16px 12px 14px',
                                                            borderRadius: 22, display: 'flex', flexDirection: 'column',
                                                            alignItems: 'center', justifyContent: 'center', gap: 4,
                                                            textAlign: 'center', fontFamily: 'inherit', background: t.surf,
                                                            color: t.ink, border: `2px solid ${sel ? t.ink : 'transparent'}`,
                                                            cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.5 : 1,
                                                            transition: 'border-color .15s',
                                                        }}
                                                    >
                                                        {sel && (
                                                            <span style={{
                                                                position: 'absolute', top: 10, right: 10, width: 24, height: 24,
                                                                borderRadius: 999, background: t.prim, color: t.primInk,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            }}><Tilde tam={13} /></span>
                                                        )}
                                                        {k === 'Remeras' ? <IconoRemera tam={54} /> : <IconoBuzo tam={54} />}
                                                        <span style={{ fontSize: 16, fontWeight: 600 }}>{NOMBRE[k]}</span>
                                                        <span style={{ fontSize: 13.5, fontWeight: 500, color: t.m52 }}>
                                                            {off ? 'Sin talles por ahora' : fmt(info!.precio)}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <p style={{ ...rot(t), marginTop: 22 }}>TALLE</p>
                                        {prod ? (
                                            <div role="radiogroup" aria-label="Talle" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', gap: 8, marginTop: 10 }}>
                                                {tallesDe(prod).map(x => {
                                                    const sel = talle === x.code;
                                                    return (
                                                        <button
                                                            key={x.code}
                                                            type="button"
                                                            role="radio"
                                                            aria-checked={sel}
                                                            onClick={() => { setTalle(x.code); setAviso5(false); }}
                                                            style={{
                                                                height: 56, border: 0, borderRadius: 16, fontSize: 17, fontWeight: 600,
                                                                cursor: 'pointer', transition: 'background .15s, color .15s',
                                                                background: sel ? t.prim : t.surf, color: sel ? t.primInk : t.ink,
                                                            }}
                                                        >{x.size}</button>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div style={{
                                                marginTop: 10, height: 56, borderRadius: 16, background: t.surf,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 14, fontWeight: 500, color: t.m52,
                                            }}>Primero elegí remera o buzo</div>
                                        )}

                                        <p style={{ ...rot(t), marginTop: 22 }}>CANTIDAD</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
                                            <button type="button" aria-label="Menos" disabled={cant <= 1}
                                                onClick={() => setCant(c => Math.max(1, c - 1))} style={circulo(cant <= 1)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 12h12" /></svg>
                                            </button>
                                            <span aria-live="polite" style={{ minWidth: 28, textAlign: 'center', fontSize: 20, fontWeight: 600, color: t.ink }}>{cant}</span>
                                            <button type="button" aria-label="Más" disabled={cant >= 5}
                                                onClick={() => setCant(c => Math.min(5, c + 1))} style={circulo(cant >= 5)}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 6v12M6 12h12" /></svg>
                                            </button>
                                        </div>

                                        {(() => {
                                            const puede = !!(prod && talle);
                                            const info = prod && talle ? tallesDe(prod).find(x => x.code === talle) : null;
                                            return (
                                                <button
                                                    type="button"
                                                    disabled={!puede}
                                                    onClick={agregar}
                                                    style={{
                                                        width: '100%', height: 54, marginTop: 22, border: 0, borderRadius: 999,
                                                        background: t.chip, color: t.ink, fontSize: 15.5, fontWeight: 600,
                                                        cursor: puede ? 'pointer' : 'default', opacity: puede ? 1 : 0.45,
                                                    }}
                                                >
                                                    {puede && info ? `Agregar al pedido · ${fmt(info.precio * cant)}`
                                                        : prod ? 'Elegí un talle' : 'Elegí producto y talle'}
                                                </button>
                                            );
                                        })()}

                                        {aviso5 && (
                                            <p role="status" style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: t.ink }}>
                                                Hasta 5 por talle.
                                            </p>
                                        )}
                                    </div>

                                    <p style={{ ...rot(t), marginTop: 28 }}>
                                        {`TU PEDIDO${nProd ? ` · ${nProd} ${nProd === 1 ? 'PRODUCTO' : 'PRODUCTOS'}` : ''}`}
                                    </p>
                                    <div style={{ background: t.card, borderRadius: 26, marginTop: 10, overflow: 'hidden', boxShadow: t.shadow }}>
                                        {lineas.length > 0 ? lineas.map(l => {
                                            const sal = !!l.saliendo;
                                            return (
                                                <div key={l.id} style={{
                                                    overflow: 'hidden', animation: 'vcLine .3s ease both',
                                                    transition: 'max-height .24s ease, opacity .2s ease, padding .24s ease, background-color .5s ease',
                                                    maxHeight: sal ? 0 : 240, opacity: sal ? 0 : 1,
                                                    padding: sal ? '0 16px' : '14px 16px',
                                                    borderBottom: `1px solid ${sal ? 'transparent' : t.line}`,
                                                    background: l.flash ? t.flash : 'transparent',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <span style={{
                                                            width: 44, height: 44, flex: 'none', borderRadius: 14, background: t.surf,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ink,
                                                        }}>
                                                            {l.tipo === 'Remeras' ? <IconoRemera tam={26} grosor={1.5} /> : <IconoBuzo tam={26} grosor={1.5} />}
                                                        </span>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <p style={{ margin: 0, fontSize: 15.5, fontWeight: 600, color: t.ink }}>
                                                                {NOMBRE[l.tipo]} · Talle {l.talle}
                                                            </p>
                                                            {l.err && (
                                                                <p style={{ margin: '3px 0 0', fontSize: 13, lineHeight: 1.4, fontWeight: 600, color: t.red }}>
                                                                    Se agotó mientras comprabas. Cambialo o quitalo.
                                                                </p>
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => quitar(l.id)}
                                                            aria-label={`Quitar ${NOMBRE[l.tipo].toLowerCase()} talle ${l.talle}`}
                                                            style={{
                                                                width: 44, height: 44, flex: 'none', border: 0, borderRadius: 999,
                                                                background: 'transparent', color: t.m52, display: 'flex',
                                                                alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                                            }}
                                                        >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></svg>
                                                        </button>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, paddingLeft: 56 }}>
                                                        <button type="button" aria-label="Uno menos" disabled={l.cant <= 1}
                                                            onClick={() => cambiarCant(l.id, -1)} style={circulo(l.cant <= 1)}>
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 12h12" /></svg>
                                                        </button>
                                                        <span style={{ minWidth: 22, textAlign: 'center', fontSize: 16, fontWeight: 600, color: t.ink }}>{l.cant}</span>
                                                        <button type="button" aria-label="Uno más" disabled={l.cant >= 5}
                                                            onClick={() => cambiarCant(l.id, 1)} style={circulo(l.cant >= 5)}>
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 6v12M6 12h12" /></svg>
                                                        </button>
                                                        <span style={{ marginLeft: 'auto', fontSize: 15.5, fontWeight: 600, color: t.ink }}>
                                                            {fmt(l.cant * l.precio)}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div style={{ padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                                                <span style={{
                                                    width: 56, height: 56, borderRadius: 999, background: t.surf,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.m38,
                                                }}>
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></svg>
                                                </span>
                                                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: t.m52 }}>Todavía no agregaste nada.</p>
                                            </div>
                                        )}
                                        <div style={{
                                            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                                            gap: 12, padding: '16px 20px 18px', borderTop: `1px solid ${t.line}`,
                                        }}>
                                            <span style={{ fontSize: 15, fontWeight: 600, color: t.m52 }}>Total</span>
                                            <Roll valor={total} tam={esPc ? 32 : 30} color={t.ink} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Paso 3 · Pagá ── */}
                            {paso === 3 && (
                                <div style={{ animation: 'vcIn .35s ease both' }}>
                                    <h2 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: '-.025em', color: t.ink }}>Pagá</h2>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 20 }}>
                                        <span style={rot(t)}>TRANSFERÍ</span>
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px',
                                            borderRadius: 999, fontSize: 15, fontWeight: 700,
                                            transition: 'background .3s, color .3s',
                                            background: montoCambio ? t.prim : t.chip,
                                            color: montoCambio ? t.primInk : t.ink,
                                        }}>{fmt(total)}</span>
                                        <span style={rot(t)}>A</span>
                                    </div>
                                    {montoCambio && (
                                        <p role="status" style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.5, fontWeight: 600, color: t.ink }}>
                                            El total cambió por el producto agotado. Antes era {fmt(totalAntes)}: transferí el monto nuevo.
                                        </p>
                                    )}

                                    <div style={{ ...tarjeta, marginTop: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={rot(t)}>ALIAS</p>
                                                <p style={{
                                                    margin: '6px 0 0', fontSize: esPc ? 28 : 25, lineHeight: 1.1, fontWeight: 600,
                                                    letterSpacing: '-.02em', color: t.ink, overflowWrap: 'anywhere',
                                                }}>{ALIAS}</p>
                                            </div>
                                            <button type="button" onClick={() => copiar('alias', ALIAS)} style={{
                                                height: 44, padding: '0 16px', flex: 'none', border: 0, borderRadius: 999,
                                                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600,
                                                cursor: 'pointer', transition: 'background .15s, color .15s',
                                                background: copiado === 'alias' ? t.prim : t.chip,
                                                color: copiado === 'alias' ? t.primInk : t.ink,
                                            }}>
                                                {copiado === 'alias' && <Tilde tam={14} />}
                                                {copiado === 'alias' ? '¡Copiado!' : 'Copiar'}
                                            </button>
                                        </div>
                                        <div style={{ height: 1, background: t.line, margin: '16px 0' }} />
                                        <p style={rot(t)}>TITULAR</p>
                                        <p style={{ margin: '5px 0 0', fontSize: 15, fontWeight: 600, color: t.ink }}>{TITULAR}</p>
                                        <div style={{ height: 1, background: t.line, margin: '16px 0' }} />
                                        <p style={rot(t)}>CUIT</p>
                                        <p style={{ margin: '5px 0 0', fontSize: 15, fontWeight: 600, color: t.ink }}>{CUIT}</p>
                                    </div>
                                    <p style={{ margin: '12px 4px 0', fontSize: 13.5, lineHeight: 1.55, color: t.m52 }}>
                                        Una sola transferencia por el total del pedido. Guardá la captura del comprobante.
                                    </p>

                                    <p style={{ ...rot(t), marginTop: 26 }}>COMPROBANTE</p>
                                    <div style={{ marginTop: 10 }}>
                                        {comp === 'vacio' && (
                                            <button type="button" onClick={elegirArchivo} style={zona}>
                                                <span style={{
                                                    width: 48, height: 48, borderRadius: 999, background: t.chip,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V5M7 10l5-5 5 5M5 19h14" /></svg>
                                                </span>
                                                <span style={{ fontSize: 15.5, fontWeight: 600 }}>Subir la captura del comprobante</span>
                                            </button>
                                        )}
                                        {comp === 'subiendo' && (
                                            <div role="status" style={{ background: t.card, borderRadius: 22, padding: 20 }}>
                                                <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.ink }}>Subiendo el comprobante…</p>
                                                <div style={{ height: 6, borderRadius: 999, background: t.track, marginTop: 14, overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%', width: compW, borderRadius: 999, background: t.ink,
                                                        transition: 'width 1.2s cubic-bezier(.3,.6,.3,1)',
                                                    }} />
                                                </div>
                                            </div>
                                        )}
                                        {comp === 'listo' && (
                                            <div style={{
                                                background: t.card, borderRadius: 22, padding: 14, display: 'flex',
                                                alignItems: 'center', gap: 14, flexWrap: 'wrap', animation: 'vcIn .3s ease both',
                                            }}>
                                                <div style={{ position: 'relative', width: 56, height: 72, flex: 'none', borderRadius: 12, background: t.thumb }}>
                                                    <span style={{
                                                        position: 'absolute', right: -6, bottom: -6, width: 24, height: 24,
                                                        borderRadius: 999, background: t.prim, color: t.primInk, display: 'flex',
                                                        alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 3px ${t.card}`,
                                                    }}><Tilde tam={13} /></span>
                                                </div>
                                                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: t.ink, overflowWrap: 'anywhere' }}>{compNombre}</p>
                                                    <p style={{ margin: '3px 0 0', fontSize: 13, color: t.m52 }}>Listo · {compTam}</p>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button type="button" onClick={elegirArchivo} style={chipBtn}>Cambiar</button>
                                                    <button type="button" onClick={quitarComp} style={chipBtn}>Quitar</button>
                                                </div>
                                            </div>
                                        )}
                                        {comp === 'error' && (
                                            <button type="button" onClick={elegirArchivo} style={zona}>
                                                <span role="alert" style={{ fontSize: 15, lineHeight: 1.45, fontWeight: 600, color: t.red }}>{compErr}</span>
                                                <span style={{ ...chipBtn, display: 'flex', alignItems: 'center' }}>Elegir otro archivo</span>
                                            </button>
                                        )}
                                        <p style={{ margin: '8px 4px 0', fontSize: 13, color: t.m52 }}>Imagen o PDF · hasta 10 MB</p>
                                    </div>

                                    {errConexion && (
                                        <div role="alert" style={{
                                            background: t.card, borderRadius: 20, padding: 16, marginTop: 18,
                                            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                                        }}>
                                            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                                                <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.45, fontWeight: 600, color: t.red }}>
                                                    Sin conexión. Tu pedido no se envió todavía.
                                                </p>
                                                <p style={{ margin: '4px 0 0', fontSize: 13, color: t.m52 }}>Tu comprobante sigue cargado.</p>
                                            </div>
                                            <button type="button" onClick={confirmar} style={chipBtn}>Reintentar</button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* En PC el botón vive debajo de la columna, no en una barra. */}
                            {esPc && (
                                <div style={{ marginTop: 28 }}>
                                    {!!razon && (
                                        <p style={{ margin: '0 0 10px', textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: t.m52 }}>{razon}</p>
                                    )}
                                    <button type="button" onClick={principal} disabled={principalOff} style={principalStyle}>
                                        {confirmando && (
                                            <span style={{
                                                width: 18, height: 18, borderRadius: 999, border: '2.5px solid currentColor',
                                                borderRightColor: 'transparent', animation: 'vcSpin .7s linear infinite',
                                            }} />
                                        )}
                                        {principalTxt}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* ── El aside de PC ── */}
                        {esPc && (
                            <aside style={{ position: 'sticky', top: 24, ...tarjeta, padding: 22 }}>
                                {CuerpoResumen}
                            </aside>
                        )}
                    </div>
                </div>
            )}

            {/* ══ 4 · ¡Listo! ══ */}
            {mostrarListo && ticket && (
                <div style={{ padding: esPc ? '48px 40px 56px' : '34px 20px 56px', animation: 'vcIn .4s ease both' }}>
                    <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                        <svg width="92" height="92" viewBox="0 0 52 52" fill="none" stroke="currentColor" strokeWidth="2.4"
                            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: t.ink }}>
                            <circle cx="26" cy="26" r="24" strokeDasharray="151" style={{ strokeDashoffset: 0, animation: 'vcCircle .6s ease-out both' }} />
                            <path d="M15 27l7 7 15-16" strokeDasharray="36" style={{ strokeDashoffset: 0, animation: 'vcCheck .4s .45s ease-out both' }} />
                        </svg>
                        <h1 style={{ margin: '20px 0 0', fontSize: 30, lineHeight: 1.1, fontWeight: 600, letterSpacing: '-.03em', color: t.ink }}>
                            ¡Compra confirmada!
                        </h1>
                        <p style={{ margin: '10px 0 0', fontSize: 16, color: t.m52 }}>Ya recibimos tu comprobante.</p>

                        <div style={{ position: 'relative', width: '100%', marginTop: 26, background: t.card, borderRadius: 24, textAlign: 'left', boxShadow: t.shadow }}>
                            <div style={{ padding: '22px 22px 18px' }}>
                                <p style={rot(t)}>PEDIDO N.º</p>
                                <p style={{ margin: '6px 0 0', font: '600 30px/1 ui-monospace,Menlo,monospace', letterSpacing: '.04em', color: t.ink }}>
                                    {ticket.codigo}
                                </p>
                            </div>
                            <div style={{ position: 'relative', height: 0, borderTop: `2px dashed ${t.dash}`, margin: '0 18px' }}>
                                <span style={{ position: 'absolute', left: -30, top: -12, width: 22, height: 22, borderRadius: 999, background: bg }} />
                                <span style={{ position: 'absolute', right: -30, top: -12, width: 22, height: 22, borderRadius: 999, background: bg }} />
                            </div>
                            <div style={{ padding: '18px 22px 22px' }}>
                                {ticket.lineas.map((tk, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 0' }}>
                                        <span style={{ fontSize: 14.5, fontWeight: 600, color: t.ink }}>{tk.txt}</span>
                                        <span style={{ flex: 1, minWidth: 12, borderBottom: `2px dotted ${t.dash}`, transform: 'translateY(-4px)' }} />
                                        <span style={{ fontSize: 14.5, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap' }}>{tk.sub}</span>
                                    </div>
                                ))}
                                <p style={{
                                    margin: '12px 0 0', paddingTop: 12, borderTop: `1px solid ${t.line}`,
                                    fontSize: 16, fontWeight: 700, color: t.ink,
                                }}>Total {ticket.total} · Transferencia</p>
                                <p style={{ margin: '8px 0 0', fontSize: 14, color: t.m52 }}>{ticket.persona}</p>
                                <p style={{ margin: '3px 0 0', fontSize: 14, color: t.m52 }}>{ticket.cuando}</p>
                            </div>
                        </div>
                        <p style={{ margin: '18px 0 0', fontSize: 15, lineHeight: 1.5, fontWeight: 600, color: t.ink }}>
                            Retiralo en el Punto de Información mostrando esta pantalla.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', marginTop: 24 }}>
                            <button type="button" onClick={() => navigate('/')} style={{
                                height: 58, border: 0, borderRadius: 999, background: t.prim, color: t.primInk,
                                fontSize: 16.5, fontWeight: 600, cursor: 'pointer',
                            }}>Volver al inicio</button>
                            <button
                                type="button"
                                onClick={() => {
                                    limpiarBorrador();
                                    setLineas([]); setNid(1); setProd(null); setTalle(null); setCant(1);
                                    quitarComp();
                                    setTotalVisto(null); setMontoCambio(false); setAgotadoMsg('');
                                    setTicket(null);
                                    // Un pedido nuevo es una venta nueva: id nuevo.
                                    setVentaId(safeUUID());
                                    pedirCatalogo();
                                    ir(2);
                                }}
                                style={{
                                    height: 58, border: 0, borderRadius: 999, background: t.chip, color: t.ink,
                                    fontSize: 16.5, fontWeight: 600, cursor: 'pointer',
                                }}
                            >Hacer otro pedido</button>
                        </div>
                    </div>
                </div>
            )}

            </div>{/* fin de la hoja */}

            {/* ══ La barra de abajo, sólo en el teléfono ══ */}
            {!esPc && enPasos && (
                <div style={{
                    position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10, background: bg,
                    transition: 'background-color .4s ease', borderTop: `1px solid ${t.line}`,
                    padding: '10px 16px calc(env(safe-area-inset-bottom, 0px) + 16px)',
                }}>
                    {vivas.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setSheet(true)}
                            aria-label="Ver el detalle del pedido"
                            style={{
                                width: '100%', height: 48, marginBottom: 8, padding: '0 4px', border: 0,
                                background: 'transparent', display: 'flex', alignItems: 'center', gap: 10,
                                color: t.ink, cursor: 'pointer',
                            }}
                        >
                            <span style={{ fontSize: 15, fontWeight: 600 }}>
                                {nProd} {nProd === 1 ? 'producto' : 'productos'} · {fmt(total)}
                            </span>
                            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13.5, fontWeight: 600, color: t.m52 }}>
                                Ver detalle
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg>
                            </span>
                        </button>
                    )}
                    {!!razon && (
                        <p style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: t.m52 }}>{razon}</p>
                    )}
                    <button type="button" onClick={principal} disabled={principalOff} style={principalStyle}>
                        {confirmando && (
                            <span style={{
                                width: 18, height: 18, borderRadius: 999, border: '2.5px solid currentColor',
                                borderRightColor: 'transparent', animation: 'vcSpin .7s linear infinite',
                            }} />
                        )}
                        {principalTxt}
                    </button>
                </div>
            )}

            {/* ══ La hoja del detalle — sube desde abajo, nunca un modal ══ */}
            {sheet && !esPc && (
                <div
                    onClick={() => setSheet(false)}
                    style={{
                        position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,.45)',
                        display: 'flex', alignItems: 'flex-end', animation: 'vcFade .2s ease',
                    }}
                >
                    <div
                        ref={hojaRef}
                        tabIndex={-1}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Detalle del pedido"
                        onClick={e => e.stopPropagation()}
                        style={{
                            width: '100%', maxHeight: '92%', overflowY: 'auto', background: t.card,
                            borderRadius: '28px 28px 0 0', padding: '0 20px 34px', outline: 'none',
                            animation: 'vcUp .28s cubic-bezier(.2,.8,.2,1)',
                        }}
                    >
                        <div {...alArrastrar} style={{ padding: '10px 0 6px', touchAction: 'none', cursor: 'grab' }}>
                            <div style={{ width: 40, height: 5, borderRadius: 999, background: t.m38, margin: '0 auto' }} />
                        </div>
                        <div style={{ marginTop: 10 }}>{CuerpoResumen}</div>
                        <button type="button" onClick={() => setSheet(false)} style={{
                            width: '100%', height: 54, marginTop: 18, border: 0, borderRadius: 999,
                            background: t.chip, color: t.ink, fontSize: 15.5, fontWeight: 600, cursor: 'pointer',
                        }}>Listo</button>
                    </div>
                </div>
            )}

            {/* ══ El aviso ══ */}
            {toast && (
                <div role="status" style={{
                    position: 'fixed', left: '50%', top: 20, zIndex: 60, transform: 'translateX(-50%)',
                    width: 'max-content', maxWidth: 'calc(100% - 32px)', padding: '12px 18px',
                    borderRadius: 999, background: t.prim, color: t.primInk, fontSize: 14,
                    fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,.2)', animation: 'vcIn .2s ease',
                }}>{toast}</div>
            )}
        </div>
    );
};

export default CompraVoluntarios;

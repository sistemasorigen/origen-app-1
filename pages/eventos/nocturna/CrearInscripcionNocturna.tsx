import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Check, ChevronLeft, Loader2 } from 'lucide-react';
import { supabaseService } from '../../../services/supabaseService';
import { safeUUID } from '../../../services/uuidUtils';
import { calcularEdad } from '../../../src/utils/nocturna';
import { NocturnaAltaResultado, NocturnaConfig, NocturnaEdicionResultado, User } from '../../../types';
import {
    ADULTO_VACIO,
    AdultoForm,
    adultoCompleto,
    adultoEsMenorDeEdad,
    armarPayloadNocturna,
    ChicoForm,
    chicosCompletos,
    faltanDelChico,
    OTRO_VACIO,
    OtroForm,
    plata,
    retiroCompleto,
    soloDigitos,
    TEXTO_AUTORIZACION,
    TEXTO_FOTOS,
    TRIBUS,
} from './compartido/formulario';
import {
    AMBAR,
    AMBAR_INK,
    BORDE,
    CAMPO,
    CAMPO_HONDO,
    CARTA,
    ESTILOS_PANEL,
    FONDO,
    fuente,
    INK,
    ROJO,
    VERDE,
    VERDE_FONDO,
} from './compartido/estilos';

/**
 * Alta y edición de una inscripción de Nocturna desde el panel.
 *
 * El staff la completa con la familia enfrente, y suele cargar varias
 * seguidas. Por eso es una sola página con todo a la vista y recorrible con
 * el tabulador, y no el flujo de seis pasos de la inscripción pública: ahí la
 * persona está sola en su celular y conviene llevarla de a una cosa por vez.
 *
 * La misma pantalla sirve para editar: son exactamente los mismos campos, y
 * tener dos formularios con los mismos campos es tener dos formularios que
 * dentro de un mes no coinciden. Lo que cambia en modo edición:
 *   · precarga los datos y los chicos conservan su id
 *   · la autorización se muestra pero no se toca: es una declaración legal
 *   · no se confirma el pago de nuevo; se muestra la diferencia si cambió
 *     la cantidad de chicos
 *
 * Las reglas de validación y el armado del payload salen de
 * `compartido/formulario.ts`, los mismos que usa la pública.
 */

interface Props {
    currentUser: User;
    /** En true, la pantalla edita la inscripción de la URL en vez de crear. */
    modoEdicion?: boolean;
}

const chicoNuevo = (apellido = ''): ChicoForm => ({
    id: safeUUID(),
    nombre: '',
    apellido,
    dni: '',
    nac: '',
    tribu: '',
});

const CrearInscripcionNocturna: React.FC<Props> = ({ currentUser, modoEdicion = false }) => {
    const navigate = useNavigate();
    const { id: idDeLaUrl } = useParams<{ id: string }>();

    const [config, setConfig] = useState<NocturnaConfig | null>(null);
    const [cargando, setCargando] = useState(true);
    const [errorCarga, setErrorCarga] = useState<string | null>(null);

    // Sólo en edición: el precio que pagó esta familia y el email original,
    // para saber si cambió y ofrecer el reenvío.
    const [precioOriginal, setPrecioOriginal] = useState<number | null>(null);
    const [emailOriginal, setEmailOriginal] = useState('');
    const [chicosOriginales, setChicosOriginales] = useState(0);
    const [guardado, setGuardado] = useState<NocturnaEdicionResultado | null>(null);
    const [reenviando, setReenviando] = useState(false);
    const [reenviado, setReenviado] = useState(false);

    const [adulto, setAdulto] = useState<AdultoForm>(ADULTO_VACIO);
    const [chicos, setChicos] = useState<ChicoForm[]>([chicoNuevo()]);
    const [seRetiranSolos, setSeRetiranSolos] = useState<boolean | null>(null);
    const [quienRetira, setQuienRetira] = useState<'yo' | 'otro' | null>(null);
    const [otro, setOtro] = useState<OtroForm>(OTRO_VACIO);
    const [autoriza, setAutoriza] = useState(false);
    const [aceptaFotos, setAceptaFotos] = useState<boolean | null>(null);
    const [pagoVerificado, setPagoVerificado] = useState(false);

    const [intento, setIntento] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultado, setResultado] = useState<NocturnaAltaResultado | null>(null);
    const [seguirCargando, setSeguirCargando] = useState(false);

    // El candado del doble envío es un ref y no un estado: el segundo toque
    // puede llegar antes de que React vuelva a renderizar.
    const enviandoRef = useRef(false);
    const primerCampo = useRef<HTMLInputElement>(null);

    useEffect(() => {
        (async () => {
            setConfig(await supabaseService.getNocturnaConfig());

            if (modoEdicion && idDeLaUrl) {
                const res = await supabaseService.getNocturnaInscripcion(idDeLaUrl);
                if (!res.ok || !res.inscripcion) {
                    setErrorCarga(res.error || 'No pudimos leer la inscripción.');
                    setCargando(false);
                    return;
                }
                const i = res.inscripcion;
                setAdulto({
                    nombre: i.adultoNombre,
                    apellido: i.adultoApellido,
                    dni: i.adultoDni,
                    email: i.adultoEmail,
                    nac: (i.adultoFechaNacimiento || '').slice(0, 10),
                });
                // El id de cada chico viaja de vuelta: es lo que le dice a la
                // base que lo actualice en el lugar y no lo recree.
                setChicos((i.jovenes || []).map(j => ({
                    id: j.id,
                    existente: true,
                    nombre: j.nombre,
                    apellido: j.apellido,
                    dni: j.dni,
                    nac: (j.fechaNacimiento || '').slice(0, 10),
                    tribu: j.tribu,
                })));
                const primero = (i.jovenes || [])[0];
                const tipo = primero?.retiro?.tipo;
                setSeRetiranSolos(tipo === 'solo' ? true : tipo ? false : null);
                setQuienRetira(tipo === 'otra_persona' ? 'otro' : tipo === 'adulto' ? 'yo' : null);
                if (tipo === 'otra_persona') {
                    setOtro({
                        nombre: primero?.retiro?.nombre || '',
                        apellido: primero?.retiro?.apellido || '',
                        dni: primero?.retiro?.dni || '',
                        telefono: primero?.retiro?.telefono || '',
                    });
                }
                setAutoriza(true);                 // no se edita
                setAceptaFotos(i.aceptaFotos);
                setPagoVerificado(true);           // ya estaba pago
                setPrecioOriginal(i.precioUnitario);
                setEmailOriginal(i.adultoEmail);
                setChicosOriginales((i.jovenes || []).length);
            }

            setCargando(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modoEdicion, idDeLaUrl]);

    // ── Derivados ─────────────────────────────────────────────────────────
    // En edición vale el precio que pagó esta familia, no el de hoy: es lo
    // mismo que recalcula la base.
    const precio = modoEdicion ? (precioOriginal ?? 0) : (config?.precioEntrada ?? 0);
    const cantidad = chicos.length;
    const total = precio * cantidad;
    const adultoMenor = adultoEsMenorDeEdad(adulto);

    const ok = adultoCompleto(adulto)
        && chicosCompletos(chicos)
        && retiroCompleto(seRetiranSolos, quienRetira, otro)
        && autoriza
        && aceptaFotos !== null
        && pagoVerificado;

    const faltan = useMemo(() => {
        const f: string[] = [];
        if (!adultoCompleto(adulto)) f.push(adultoMenor ? 'el adulto es menor de 18' : 'datos del adulto');
        const incompletos = chicos.filter(c => faltanDelChico(c).length);
        if (!chicos.length) f.push('agregar un chico');
        else if (incompletos.length === 1) f.push(`datos de ${incompletos[0].nombre.trim() || 'el chico'}`);
        else if (incompletos.length > 1) f.push(`datos de ${incompletos.length} chicos`);
        if (!retiroCompleto(seRetiranSolos, quienRetira, otro)) f.push('cómo se retiran');
        if (!autoriza) f.push('la autorización');
        if (aceptaFotos === null) f.push('la respuesta sobre fotos');
        if (!pagoVerificado && !modoEdicion) f.push('confirmar el pago');
        return f;
    }, [adulto, adultoMenor, chicos, seRetiranSolos, quienRetira, otro, autoriza, aceptaFotos, pagoVerificado]);

    // ── Acciones ──────────────────────────────────────────────────────────
    const editarChico = (id: string, campo: keyof ChicoForm, valor: string) =>
        setChicos(cs => cs.map(c => (c.id === id ? { ...c, [campo]: valor } : c)));

    const limpiar = () => {
        setAdulto(ADULTO_VACIO);
        setChicos([chicoNuevo()]);
        setSeRetiranSolos(null);
        setQuienRetira(null);
        setOtro(OTRO_VACIO);
        setAutoriza(false);
        setAceptaFotos(null);
        setPagoVerificado(false);
        setIntento(false);
        setError(null);
        setResultado(null);
        enviandoRef.current = false;
        primerCampo.current?.focus();
    };

    const guardarEdicion = async () => {
        if (enviandoRef.current || !idDeLaUrl) return;
        if (!ok) { setIntento(true); return; }
        enviandoRef.current = true;
        setEnviando(true);
        setError(null);

        const res = await supabaseService.adminEditarNocturna(idDeLaUrl, armarPayloadNocturna({
            adulto,
            chicos,
            seRetiranSolos,
            quienRetira,
            otro,
            autoriza: true,
            aceptaFotos: aceptaFotos === true,
        }));

        setEnviando(false);
        enviandoRef.current = false;

        if (!res.ok) {
            // El mensaje viene de la RPC ya redactado en español.
            setError(res.error || 'No pudimos guardar los cambios.');
            return;
        }
        setGuardado(res);
    };

    const reenviarEntrada = async () => {
        if (!idDeLaUrl) return;
        setReenviando(true);
        const res = await supabaseService.reenviarNocturnaEmail(idDeLaUrl);
        setReenviando(false);
        if (res.ok) setReenviado(true);
        else setError(res.error || 'No pudimos pedir el reenvío.');
    };

    const crear = async (seguir: boolean) => {
        if (enviandoRef.current || resultado) return;
        if (!ok) { setIntento(true); return; }
        enviandoRef.current = true;
        setEnviando(true);
        setError(null);
        setSeguirCargando(seguir);

        const res = await supabaseService.adminCrearNocturna(armarPayloadNocturna({
            adulto,
            chicos,
            seRetiranSolos,
            quienRetira,
            otro,
            autoriza,
            aceptaFotos: aceptaFotos === true,
        }));

        setEnviando(false);

        if (!res.ok) {
            // El mensaje viene de la RPC ya redactado en español.
            setError(res.error || 'No pudimos cargar la inscripción.');
            enviandoRef.current = false;
            return;
        }

        setResultado(res);
        // enviandoRef queda en true: la inscripción ya existe.
    };

    // ── Piezas ────────────────────────────────────────────────────────────
    const Carta: React.FC<{ rotulo: string; extra?: React.ReactNode; children: React.ReactNode }> = ({ rotulo, extra, children }) => (
        <div className="rounded-[22px]" style={{ background: CARTA, padding: 20 }}>
            <div className="flex items-baseline justify-between gap-2">
                <p style={{ ...fuente(600, '11px'), letterSpacing: '.07em', color: 'rgba(0,0,0,.55)', margin: 0 }}>{rotulo}</p>
                {extra}
            </div>
            {children}
        </div>
    );

    const Elegible: React.FC<{ activa: boolean; onClick: () => void; children: React.ReactNode }> = ({ activa, onClick, children }) => (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={activa}
            className="border-0 rounded-full cursor-pointer"
            style={{ height: 46, background: activa ? INK : CAMPO_HONDO, color: activa ? '#fff' : INK, ...fuente(600, '13.5px') }}
        >
            {children}
        </button>
    );

    const Tilde: React.FC<{ activa: boolean }> = ({ activa }) => (
        <span
            className="flex items-center justify-center flex-none"
            style={{
                width: 22, height: 22, borderRadius: 999,
                background: activa ? '#16a34a' : CARTA,
                boxShadow: activa ? 'none' : '0 0 0 1.5px #d6d5d1 inset',
            }}
            aria-hidden="true"
        >
            {activa && <Check className="w-3 h-3 text-white" strokeWidth={3.2} />}
        </span>
    );

    // ── Pantallas completas ───────────────────────────────────────────────
    if (cargando) {
        return (
            <div id="nocturna-panel" className="min-h-screen flex flex-col items-center justify-center gap-3" style={{ background: FONDO }}>
                <style>{ESTILOS_PANEL}</style>
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: INK }} />
            </div>
        );
    }

    // Después de crear: el QR en pantalla. La familia está enfrente y puede
    // sacarle una foto en el momento, sin esperar el email.
    if (errorCarga) {
        return (
            <div id="nocturna-panel" className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: FONDO }}>
                <style>{ESTILOS_PANEL}</style>
                <p style={{ ...fuente(600, '19px'), color: INK, margin: 0 }}>No pudimos abrir la inscripción</p>
                <p style={{ ...fuente(500, '14px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '10px 0 0', maxWidth: 380 }}>{errorCarga}</p>
                <button
                    type="button"
                    onClick={() => navigate('/panel-eventos/nocturna')}
                    className="border-0 rounded-full cursor-pointer mt-6"
                    style={{ height: 48, padding: '0 22px', background: INK, color: '#fff', ...fuente(600, '14px') }}
                >
                    Volver a la planilla
                </button>
            </div>
        );
    }

    // Después de guardar una edición. No hay QR que mostrar —la entrada es la
    // misma— pero sí dos cosas que el staff necesita: cuánto cobrar o
    // devolver, y si conviene reenviar la entrada al email nuevo.
    if (guardado) {
        const dif = guardado.diferencia ?? 0;
        const cambioElEmail = adulto.email.trim() !== emailOriginal.trim();
        return (
            <div id="nocturna-panel" className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: FONDO }}>
                <style>{ESTILOS_PANEL}</style>
                <div className="w-full rounded-[24px]" style={{ maxWidth: 460, background: CARTA, padding: '28px 24px' }}>
                    <div className="mx-auto flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 999, background: VERDE_FONDO }}>
                        <Check className="w-6 h-6" style={{ color: VERDE }} strokeWidth={2.6} />
                    </div>
                    <p className="text-center" style={{ ...fuente(600, '20px'), color: INK, margin: '16px 0 0' }}>Cambios guardados</p>
                    <p className="text-center" style={{ ...fuente(500, '14px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '8px 0 0' }}>
                        {adulto.nombre} {adulto.apellido} · {guardado.chicos} {guardado.chicos === 1 ? 'chico' : 'chicos'}
                    </p>

                    {dif !== 0 && (
                        <div className="rounded-[16px] mt-4" style={{ background: dif > 0 ? AMBAR : VERDE_FONDO, padding: 16 }}>
                            <p style={{ ...fuente(600, '15px'), color: dif > 0 ? '#5c3b0b' : VERDE, margin: 0 }}>
                                {dif > 0 ? `Hay que cobrar ${plata(dif)}` : `Hay que devolver ${plata(Math.abs(dif))}`}
                            </p>
                            <p style={{ ...fuente(500, '13px', '1.5'), color: dif > 0 ? '#5c3b0b' : 'rgba(0,0,0,.66)', margin: '4px 0 0' }}>
                                El total pasó de {plata(guardado.totalAnterior ?? 0)} a {plata(guardado.total ?? 0)}, a {plata(guardado.precioUnitario ?? 0)} por entrada — el precio que pagó esta familia, no el de hoy.
                            </p>
                        </div>
                    )}

                    {cambioElEmail && (
                        <div className="rounded-[16px] mt-3" style={{ background: '#f7f7f5', padding: 16 }}>
                            <p style={{ ...fuente(600, '14px'), color: INK, margin: 0 }}>Cambiaste el email</p>
                            <p style={{ ...fuente(500, '13px', '1.5'), color: 'rgba(0,0,0,.64)', margin: '4px 0 10px' }}>
                                La entrada que ya salió fue a {emailOriginal}. Podés mandarla de nuevo a {adulto.email.trim()}.
                            </p>
                            <button
                                type="button"
                                onClick={reenviarEntrada}
                                disabled={reenviando || reenviado}
                                className="w-full border-0 rounded-full cursor-pointer"
                                style={{ height: 46, background: reenviado ? VERDE_FONDO : INK, color: reenviado ? VERDE : '#fff', ...fuente(600, '13.5px') }}
                            >
                                {reenviado ? 'Se pidió el reenvío' : reenviando ? 'Pidiendo…' : 'Reenviar la entrada al email nuevo'}
                            </button>
                        </div>
                    )}

                    {error && (
                        <p style={{ ...fuente(500, '13px', '1.5'), color: ROJO, margin: '12px 2px 0' }}>{error}</p>
                    )}

                    <div className="flex flex-col gap-2 mt-6">
                        <button
                            type="button"
                            onClick={() => navigate(`/panel-eventos/nocturna/${idDeLaUrl}`)}
                            className="border-0 rounded-full cursor-pointer"
                            style={{ height: 50, background: INK, color: '#fff', ...fuente(600, '14.5px') }}
                        >
                            Volver a la ficha
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/panel-eventos/nocturna')}
                            className="border-0 rounded-full cursor-pointer"
                            style={{ height: 50, background: CAMPO, color: INK, ...fuente(600, '14.5px') }}
                        >
                            Volver a la planilla
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (resultado) {
        return (
            <div id="nocturna-panel" className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: FONDO }}>
                <style>{ESTILOS_PANEL}</style>
                <div className="w-full rounded-[24px] text-center" style={{ maxWidth: 460, background: CARTA, padding: '28px 24px' }}>
                    <div className="mx-auto flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 999, background: VERDE_FONDO }}>
                        <Check className="w-6 h-6" style={{ color: VERDE }} strokeWidth={2.6} />
                    </div>
                    <p style={{ ...fuente(600, '20px'), color: INK, margin: '16px 0 0' }}>Quedaron anotados</p>
                    <p style={{ ...fuente(500, '14px', '1.6'), color: 'rgba(0,0,0,.64)', margin: '8px 0 0' }}>
                        {adulto.nombre} {adulto.apellido} · {cantidad} {cantidad === 1 ? 'entrada' : 'entradas'} · {plata(resultado.total ?? total)}
                    </p>

                    <div className="rounded-[20px] mx-auto mt-5 inline-block bg-white" style={{ padding: 14, boxShadow: `0 0 0 1px ${BORDE}` }}>
                        <QRCodeSVG value={resultado.inscripcionId || ''} size={180} level="M" bgColor="#ffffff" fgColor={INK} />
                    </div>
                    <p style={{ ...fuente(600, '18px'), color: INK, margin: '14px 0 0', letterSpacing: '2px' }}>{resultado.codigoEntrada}</p>
                    <p style={{ ...fuente(500, '13px', '1.55'), color: 'rgba(0,0,0,.6)', margin: '8px 0 0' }}>
                        Que le saquen una foto ahora. La entrada también les llega por email a {adulto.email}.
                    </p>

                    <div className="flex flex-col gap-2 mt-6">
                        <button
                            type="button"
                            onClick={limpiar}
                            className="border-0 rounded-full cursor-pointer"
                            style={{ height: 50, background: INK, color: '#fff', ...fuente(600, '14.5px') }}
                        >
                            Cargar otra inscripción
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/panel-eventos/nocturna')}
                            className="border-0 rounded-full cursor-pointer"
                            style={{ height: 50, background: CAMPO, color: INK, ...fuente(600, '14.5px') }}
                        >
                            Volver a la planilla
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div id="nocturna-panel" className="min-h-screen flex flex-col" style={{ background: FONDO }}>
            <style>{ESTILOS_PANEL}</style>

            <header className="flex-none" style={{ background: CARTA, borderBottom: `1px solid ${BORDE}` }}>
                <div className="mx-auto px-4 lg:px-8 pt-5 pb-4" style={{ maxWidth: 1120 }}>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => navigate(modoEdicion && idDeLaUrl ? `/panel-eventos/nocturna/${idDeLaUrl}` : '/panel-eventos/nocturna')}
                            className="border-0 rounded-full flex items-center gap-1.5 cursor-pointer"
                            style={{ height: 40, padding: '0 14px 0 10px', background: CAMPO, color: INK, ...fuente(600, '12.5px') }}
                        >
                            <ChevronLeft className="w-4 h-4" strokeWidth={2.3} />
                            {modoEdicion ? 'Ficha' : 'Planilla'}
                        </button>
                        <span
                            className="ml-auto flex items-center"
                            style={{ height: 28, padding: '0 12px', borderRadius: 999, background: CAMPO, ...fuente(600, '11.5px'), color: 'rgba(0,0,0,.62)' }}
                        >
                            {modoEdicion ? 'Edición' : 'Carga de administrador'}
                        </span>
                    </div>
                    <h1 className="text-[22px] lg:text-[26px]" style={{ ...fuente(600, 'inherit'), color: INK, letterSpacing: '-.02em', margin: '14px 0 0' }}>
                        {modoEdicion ? 'Editar inscripción' : 'Crear una inscripción'}
                    </h1>
                    <p style={{ ...fuente(500, '13px'), color: 'rgba(0,0,0,.6)', margin: '4px 0 0' }}>
                        {modoEdicion
                            ? 'La entrada y su código no cambian. Lo que cambie el total se cobra o se devuelve aparte.'
                            : 'Todo en una sola página. Tab para pasar de campo en campo.'}
                    </p>
                </div>
            </header>

            <main className="flex-1">
                <div
                    className="mx-auto px-4 lg:px-8 py-4 lg:py-5 grid gap-3.5 items-start"
                    style={{ maxWidth: 1120, gridTemplateColumns: 'minmax(0,1fr)' }}
                >
                    <div className="grid gap-3.5 items-start" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
                        <div className="lg:grid lg:gap-3.5" style={{ gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)' }}>
                            {/* Columna de carga */}
                            <div className="flex flex-col gap-3 min-w-0">
                                {/* 1 · Adulto */}
                                <Carta rotulo="1 · ADULTO RESPONSABLE">
                                    <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                                        <input ref={primerCampo} className="campo" value={adulto.nombre} placeholder="Nombre" aria-label="Nombre del adulto" onChange={e => setAdulto(a => ({ ...a, nombre: e.target.value }))} />
                                        <input className="campo" value={adulto.apellido} placeholder="Apellido" aria-label="Apellido del adulto" onChange={e => setAdulto(a => ({ ...a, apellido: e.target.value }))} />
                                        <input className="campo" value={adulto.dni} placeholder="DNI" inputMode="numeric" aria-label="DNI del adulto" onChange={e => setAdulto(a => ({ ...a, dni: soloDigitos(e.target.value, 9) }))} />
                                        <input className="campo" value={adulto.email} placeholder="Email · acá llega la entrada" type="email" inputMode="email" aria-label="Email del adulto" onChange={e => setAdulto(a => ({ ...a, email: e.target.value }))} />
                                    </div>
                                    <p style={{ ...fuente(600, '12px'), color: 'rgba(0,0,0,.6)', margin: '12px 0 6px' }}>Fecha de nacimiento</p>
                                    <div className="flex items-center gap-2.5">
                                        <input
                                            className={`campo ${adultoMenor ? 'campo--alerta' : ''}`}
                                            style={{ flex: 1, minWidth: 0 }}
                                            type="date"
                                            value={adulto.nac}
                                            aria-label="Fecha de nacimiento del adulto"
                                            onChange={e => setAdulto(a => ({ ...a, nac: e.target.value }))}
                                        />
                                        <span
                                            className="flex items-center whitespace-nowrap flex-none"
                                            style={{ height: 48, padding: '0 14px', borderRadius: 14, background: adulto.nac && calcularEdad(adulto.nac) !== null ? INK : '#fafaf9', color: adulto.nac && calcularEdad(adulto.nac) !== null ? '#fff' : 'rgba(0,0,0,.4)', ...fuente(600, '14px') }}
                                        >
                                            {adulto.nac && calcularEdad(adulto.nac) !== null ? `${calcularEdad(adulto.nac)} años` : 'Edad —'}
                                        </span>
                                    </div>
                                    {adultoMenor && (
                                        <p style={{ ...fuente(600, '13px', '1.5'), color: AMBAR_INK, margin: '10px 2px 0' }}>
                                            Tiene {calcularEdad(adulto.nac)} años. El adulto responsable tiene que ser mayor de 18: la base lo rechaza igual.
                                        </p>
                                    )}
                                </Carta>

                                {/* 2 · Chicos */}
                                <Carta
                                    rotulo="2 · CHICOS"
                                    extra={<span style={{ ...fuente(600, '12px'), color: 'rgba(0,0,0,.55)' }}>{cantidad} {cantidad === 1 ? 'chico' : 'chicos'}</span>}
                                >
                                    {chicos.map((c, i) => (
                                        <div key={c.id} className="rounded-[16px]" style={{ marginTop: 12, padding: 14, background: '#fafaf9' }}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="flex-1" style={{ ...fuente(600, '12.5px'), color: INK }}>
                                                    Chico {i + 1}
                                                </span>
                                                {chicos.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setChicos(cs => cs.filter(x => x.id !== c.id))}
                                                        className="border-0 bg-transparent cursor-pointer"
                                                        style={{ height: 30, padding: '0 10px', ...fuente(600, '12px'), color: ROJO }}
                                                    >
                                                        Quitar
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                                                <input className="campo campo--claro" value={c.nombre} placeholder="Nombre" aria-label={`Nombre del chico ${i + 1}`} onChange={e => editarChico(c.id, 'nombre', e.target.value)} />
                                                <input className="campo campo--claro" value={c.apellido} placeholder="Apellido" aria-label={`Apellido del chico ${i + 1}`} onChange={e => editarChico(c.id, 'apellido', e.target.value)} />
                                                <input className="campo campo--claro" value={c.dni} placeholder="DNI" inputMode="numeric" aria-label={`DNI del chico ${i + 1}`} onChange={e => editarChico(c.id, 'dni', soloDigitos(e.target.value, 9))} />
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <input
                                                    className="campo campo--claro"
                                                    style={{ flex: 1, minWidth: 0 }}
                                                    type="date"
                                                    value={c.nac}
                                                    aria-label={`Fecha de nacimiento del chico ${i + 1}`}
                                                    onChange={e => editarChico(c.id, 'nac', e.target.value)}
                                                />
                                                <span
                                                    className="flex items-center whitespace-nowrap flex-none"
                                                    style={{ height: 48, padding: '0 14px', borderRadius: 14, background: calcularEdad(c.nac) !== null ? INK : CARTA, color: calcularEdad(c.nac) !== null ? '#fff' : 'rgba(0,0,0,.4)', ...fuente(600, '13.5px') }}
                                                >
                                                    {calcularEdad(c.nac) !== null ? `${calcularEdad(c.nac)} años` : 'Edad —'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-1.5 mt-2">
                                                {TRIBUS.map(t => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => editarChico(c.id, 'tribu', t)}
                                                        aria-pressed={c.tribu === t}
                                                        className="border-0 rounded-full cursor-pointer"
                                                        style={{ height: 44, background: c.tribu === t ? INK : CARTA, color: c.tribu === t ? '#fff' : INK, ...fuente(600, '13px') }}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                            {intento && !!faltanDelChico(c).length && (
                                                <p style={{ ...fuente(500, '12px'), color: AMBAR_INK, margin: '8px 2px 0' }}>
                                                    Falta: {faltanDelChico(c).join(', ')}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => setChicos(cs => [...cs, chicoNuevo(cs[0]?.apellido || '')])}
                                        className="w-full bg-transparent cursor-pointer mt-2.5"
                                        style={{ height: 48, border: '1.5px dashed #d9d8d4', borderRadius: 16, ...fuente(600, '14px'), color: INK }}
                                    >
                                        + Agregar otro chico
                                    </button>
                                </Carta>

                                {/* 3 · Retiro */}
                                <Carta rotulo="3 · RETIRO A LAS 6 H">
                                    <div className="grid grid-cols-3 gap-1.5 mt-3">
                                        <Elegible activa={seRetiranSolos === true} onClick={() => { setSeRetiranSolos(true); setQuienRetira(null); }}>
                                            Solos
                                        </Elegible>
                                        <Elegible activa={seRetiranSolos === false && quienRetira === 'yo'} onClick={() => { setSeRetiranSolos(false); setQuienRetira('yo'); }}>
                                            El adulto
                                        </Elegible>
                                        <Elegible activa={seRetiranSolos === false && quienRetira === 'otro'} onClick={() => { setSeRetiranSolos(false); setQuienRetira('otro'); }}>
                                            Otra persona
                                        </Elegible>
                                    </div>
                                    {seRetiranSolos === false && quienRetira === 'otro' && (
                                        <>
                                            <div className="grid gap-2 mt-2.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                                                <input className="campo" value={otro.nombre} placeholder="Nombre" aria-label="Nombre de quien retira" onChange={e => setOtro(o => ({ ...o, nombre: e.target.value }))} />
                                                <input className="campo" value={otro.apellido} placeholder="Apellido" aria-label="Apellido de quien retira" onChange={e => setOtro(o => ({ ...o, apellido: e.target.value }))} />
                                                <input className="campo" value={otro.dni} placeholder="DNI" inputMode="numeric" aria-label="DNI de quien retira" onChange={e => setOtro(o => ({ ...o, dni: soloDigitos(e.target.value, 9) }))} />
                                                <input className="campo" value={otro.telefono} placeholder="Teléfono" inputMode="tel" aria-label="Teléfono de quien retira" onChange={e => setOtro(o => ({ ...o, telefono: e.target.value.replace(/[^\d\s+]/g, '') }))} />
                                            </div>
                                            <p style={{ ...fuente(500, '12.5px', '1.5'), color: 'rgba(0,0,0,.58)', margin: '8px 2px 0' }}>
                                                Va a tener que mostrar su DNI en la puerta a las 6 AM.
                                            </p>
                                        </>
                                    )}
                                </Carta>

                                {/* 4 · Declaraciones */}
                                <Carta rotulo={modoEdicion ? "4 · DECLARACIONES" : "4 · DECLARACIONES · LEÉSELAS A LA PERSONA"}>
                                    <div className="rounded-[16px] mt-3" style={{ background: '#f7f7f5', padding: 16 }}>
                                        <p style={{ ...fuente(600, '13px'), color: INK, margin: 0 }}>Autorización de asistencia · obligatoria</p>
                                        <p style={{ ...fuente(500, '14px', '1.65'), color: INK, margin: '8px 0 0' }}>“{TEXTO_AUTORIZACION}”</p>
                                        {modoEdicion ? (
                                            /* No se edita: es una declaración legal. Un
                                               interruptor para ponerla en false dejaría
                                               menores en la base sin autorización. */
                                            <div
                                                className="w-full rounded-full flex items-center gap-2.5 mt-3"
                                                style={{ height: 48, padding: '0 14px', background: VERDE_FONDO, ...fuente(600, '13.5px'), color: INK }}
                                            >
                                                <Tilde activa />
                                                La familia autorizó · no se puede cambiar
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setAutoriza(v => !v)}
                                                aria-pressed={autoriza}
                                                className="w-full border-0 rounded-full flex items-center gap-2.5 cursor-pointer mt-3"
                                                style={{ height: 48, padding: '0 14px', background: autoriza ? VERDE_FONDO : CARTA, boxShadow: autoriza ? 'none' : '0 0 0 1.5px #e3e2de inset', ...fuente(600, '13.5px'), color: INK }}
                                            >
                                                <Tilde activa={autoriza} />
                                                La persona autoriza
                                            </button>
                                        )}
                                        {!autoriza && intento && !modoEdicion && (
                                            <p style={{ ...fuente(500, '12.5px', '1.5'), color: AMBAR_INK, margin: '8px 2px 0' }}>
                                                Sin la autorización no se puede cargar la inscripción. Si la persona no autoriza, no sigas.
                                            </p>
                                        )}
                                    </div>

                                    <div className="rounded-[16px] mt-2.5" style={{ background: '#f7f7f5', padding: 16 }}>
                                        <p style={{ ...fuente(600, '13px'), color: INK, margin: 0 }}>Fotos y video · opcional</p>
                                        <p style={{ ...fuente(500, '14px', '1.65'), color: INK, margin: '8px 0 0' }}>“{TEXTO_FOTOS}”</p>
                                        <div className="flex items-center gap-2.5 mt-3">
                                            <span className="flex-1 min-w-0" style={{ ...fuente(600, '13.5px'), color: INK }}>
                                                Respuesta de la familia
                                            </span>
                                            <div className="flex gap-1 flex-none" style={{ background: CARTA, borderRadius: 999, padding: 3 }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setAceptaFotos(true)}
                                                    aria-pressed={aceptaFotos === true}
                                                    className="border-0 rounded-full cursor-pointer"
                                                    style={{ height: 34, padding: '0 14px', background: aceptaFotos === true ? INK : 'transparent', color: aceptaFotos === true ? '#fff' : 'rgba(0,0,0,.62)', ...fuente(600, '12.5px') }}
                                                >
                                                    Acepta
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAceptaFotos(false)}
                                                    aria-pressed={aceptaFotos === false}
                                                    className="border-0 rounded-full cursor-pointer"
                                                    style={{ height: 34, padding: '0 14px', background: aceptaFotos === false ? INK : 'transparent', color: aceptaFotos === false ? '#fff' : 'rgba(0,0,0,.62)', ...fuente(600, '12.5px') }}
                                                >
                                                    No acepta
                                                </button>
                                            </div>
                                        </div>
                                        <p style={{ ...fuente(500, '12px', '1.5'), color: 'rgba(0,0,0,.58)', margin: '8px 2px 0' }}>
                                            Vale para toda la familia. Cualquiera de las dos respuestas deja seguir.
                                        </p>
                                    </div>
                                </Carta>
                            </div>

                            {/* Columna del pago */}
                            <div className="rounded-[22px] mt-3 lg:mt-0 lg:sticky lg:top-4" style={{ background: CARTA, padding: 20 }}>
                                <p style={{ ...fuente(600, '11px'), letterSpacing: '.07em', color: 'rgba(0,0,0,.55)', margin: 0 }}>5 · PAGO</p>
                                <p style={{ ...fuente(600, '32px'), color: INK, letterSpacing: '-.03em', margin: '12px 0 0' }}>{plata(total)}</p>
                                <p style={{ ...fuente(500, '13px'), color: 'rgba(0,0,0,.6)', margin: '2px 0 0' }}>
                                    {cantidad} {cantidad === 1 ? 'entrada' : 'entradas'} × {plata(precio)}
                                    {modoEdicion && ' · el precio que pagó esta familia'}
                                </p>

                                {modoEdicion ? (
                                    cantidad !== chicosOriginales && (
                                        <div className="rounded-[14px] mt-4" style={{ background: AMBAR, padding: '12px 14px' }}>
                                            <p style={{ ...fuente(600, '13.5px'), color: '#5c3b0b', margin: 0 }}>
                                                {cantidad > chicosOriginales
                                                    ? `Hay que cobrar ${plata((cantidad - chicosOriginales) * precio)} más`
                                                    : `Hay que devolver ${plata((chicosOriginales - cantidad) * precio)}`}
                                            </p>
                                            <p style={{ ...fuente(500, '12.5px', '1.5'), color: '#5c3b0b', margin: '4px 0 0' }}>
                                                Pasa de {chicosOriginales} a {cantidad} {cantidad === 1 ? 'entrada' : 'entradas'}. El cobro se hace aparte.
                                            </p>
                                        </div>
                                    )
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setPagoVerificado(v => !v)}
                                            aria-pressed={pagoVerificado}
                                            className="w-full border-0 rounded-full flex items-center gap-2.5 cursor-pointer mt-4"
                                            style={{ height: 50, padding: '0 14px', background: pagoVerificado ? VERDE_FONDO : CAMPO_HONDO, ...fuente(600, '13.5px'), color: INK, textAlign: 'left' }}
                                        >
                                            <Tilde activa={pagoVerificado} />
                                            Verifiqué que el pago está hecho
                                        </button>
                                        <p style={{ ...fuente(500, '12px', '1.5'), color: 'rgba(0,0,0,.58)', margin: '10px 2px 0' }}>
                                            Esta carga no lleva comprobante. En la planilla va a figurar “Acreditado por un administrador · {currentUser.name}”.
                                        </p>
                                    </>
                                )}

                                {intento && !ok && (
                                    <p style={{ ...fuente(500, '12.5px', '1.5'), color: AMBAR_INK, margin: '14px 2px 0' }}>
                                        Falta: {faltan.join(', ')}.
                                    </p>
                                )}

                                {error && (
                                    <div className="rounded-[14px] mt-3.5" style={{ background: AMBAR, padding: '12px 14px' }}>
                                        <p style={{ ...fuente(500, '13px', '1.5'), color: '#5c3b0b', margin: 0 }}>{error}</p>
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => (modoEdicion ? guardarEdicion() : crear(false))}
                                    disabled={enviando}
                                    className="w-full border-0 rounded-full flex items-center justify-center gap-2 cursor-pointer mt-4"
                                    style={{ height: 52, background: ok ? INK : '#c9c8c4', color: '#fff', ...fuente(600, '14.5px') }}
                                >
                                    {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {enviando
                                        ? (modoEdicion ? 'Guardando…' : 'Creando…')
                                        : (modoEdicion ? 'Guardar cambios' : 'Crear inscripción')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default CrearInscripcionNocturna;

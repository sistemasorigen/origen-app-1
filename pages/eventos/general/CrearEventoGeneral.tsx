// ════════════════════════════════════════════════════════════════════════
// /eventos/admin/general/crear-evento — alta y edición de un evento.
//
// Implementa design-claude/Eventos Generales.dc.html (pantalla "formulario").
//
// Lo que el diseño agrega respecto del formulario anterior:
//
//   · La vista previa de cómo queda la tarjeta en /eventos, al lado en la
//     compu y detrás de "Ver cómo queda" en el teléfono. Antes había que
//     guardar y salir a mirar.
//   · El botón de guardar dice POR QUÉ no se puede guardar, en vez de
//     quedar gris sin explicación.
//   · El horario se valida (termina después de empezar) y el link también
//     (https y un dominio de verdad), con ámbar y no con rojo: todavía no
//     pasó nada, sólo falta corregirlo.
//   · Salir con cambios sin guardar pregunta antes.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { ChevronLeft, Eye, Loader2, Upload } from 'lucide-react';
import {
    getEventoGeneralById, createEventoGeneral, updateEventoGeneral, supabaseService,
} from '../../../services/supabaseService';
import {
    T, rotulo, botonBase, AMBAR, AMBAR_OSCURO,
    Hoja, Aviso, useAviso, VistaPrevia,
    fechaCorta, horario, esPasado, linkValido, dominioDe, hoyIso,
} from './piezas';

const ESTILOS = `
@keyframes egIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
#evento-form .eg-entra { animation: egIn .3s ease both }
@media (prefers-reduced-motion: reduce) {
    #evento-form *, #evento-form *::before, #evento-form *::after {
        animation: none !important;
        transition: none !important;
    }
}
`;

const MAX_DESC = 400;
const MAX_NOMBRE = 80;
/** Lo mismo que valida components/media/SubidaImagen. */
const MAX_PESO = 5 * 1024 * 1024;

interface Formulario {
    nombre: string;
    fecha: string;
    inicio: string;
    fin: string;
    descripcion: string;
    link: string;
    portada: string;
}

const VACIO: Formulario = { nombre: '', fecha: '', inicio: '', fin: '', descripcion: '', link: '', portada: '' };

type EstadoPortada = 'vacia' | 'subiendo' | 'lista' | 'error';

const useEsCompu = () => {
    const consulta = '(min-width: 1024px)';
    const [es, setEs] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
    useEffect(() => {
        const mq = window.matchMedia(consulta);
        const cambiar = () => setEs(mq.matches);
        mq.addEventListener('change', cambiar);
        return () => mq.removeEventListener('change', cambiar);
    }, []);
    return es;
};

/**
 * Un campo del formulario: acá va sólo la medida y la letra.
 *
 * El fondo, el radio y el anillo —gris normal, ámbar de 2px cuando está mal
 * escrito— los pone index.html scopeado por `#evento-form`. Tienen que vivir
 * ahí porque el override global de esa hoja usa !important y, al enfocar, su
 * halo azul reemplaza al box-shadow de cualquier clase: escrito en Tailwind,
 * enfocar un campo mal escrito borraría la marca de que está mal. El estado
 * lo dice `aria-invalid`, el mismo dato que lee el lector de pantalla.
 */
const campo = 'block w-full max-w-full min-w-0 h-14 px-[18px] text-[16px] font-semibold appearance-none text-left';

const Rotulo: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span className={`block ${rotulo}`}>{children}</span>
);

const CrearEventoGeneral: React.FC = () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const idDeLaUrl = params.get('id');
    const esCompu = useEsCompu();
    const sinMovimiento = useReducedMotion();
    const { aviso, avisar } = useAviso();

    const [form, setForm] = useState<Formulario>(VACIO);
    const [inicial, setInicial] = useState<string>(JSON.stringify(VACIO));
    const [cargando, setCargando] = useState(!!idDeLaUrl);
    const [guardando, setGuardando] = useState(false);
    const [portada, setPortada] = useState<EstadoPortada>('vacia');
    const [avance, setAvance] = useState('0%');
    const [salida, setSalida] = useState(false);
    const [previa, setPrevia] = useState(false);
    /** Sube con cada tecla: le da la `key` a la vista previa para que entre. */
    const [version, setVersion] = useState(0);

    const archivo = useRef<HTMLInputElement | null>(null);
    const hoy = useMemo(() => hoyIso(), []);
    const esOscuro = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    // ── Cargar lo que se está editando ──────────────────────────────────
    useEffect(() => {
        if (!idDeLaUrl) return;
        let vivo = true;
        getEventoGeneralById(idDeLaUrl).then(ev => {
            if (!vivo) return;
            if (ev) {
                const cargado: Formulario = {
                    nombre: ev.name,
                    fecha: ev.startDate,
                    inicio: (ev.startTime || '').slice(0, 5),
                    fin: (ev.endTime || '').slice(0, 5),
                    descripcion: ev.description || '',
                    link: ev.registrationLink || '',
                    portada: ev.imageUrl || '',
                };
                setForm(cargado);
                setInicial(JSON.stringify(cargado));
                setPortada(ev.imageUrl ? 'lista' : 'vacia');
            }
            setCargando(false);
        });
        return () => { vivo = false; };
    }, [idDeLaUrl]);

    const poner = <K extends keyof Formulario>(clave: K, valor: Formulario[K]) => {
        setForm(f => ({ ...f, [clave]: valor }));
        setVersion(v => v + 1);
    };

    // ── Validación ──────────────────────────────────────────────────────
    const link = form.link.trim();
    const malHorario = !!(form.inicio && form.fin && form.fin <= form.inicio);
    const malLink = !!link && !linkValido(link);
    const dominio = link && !malLink ? dominioDe(link) : '';
    const falta = !form.nombre.trim() || !form.fecha;

    const noSePuede = falta || malHorario || malLink || portada === 'subiendo' || guardando;
    const razon = guardando ? ''
        : falta ? 'Completá el nombre y la fecha.'
            : malHorario || malLink ? 'Corregí lo marcado.'
                : portada === 'subiendo' ? 'Esperá a que termine de subir la portada.'
                    : '';

    const hayCambios = JSON.stringify(form) !== inicial;

    // ── La portada ──────────────────────────────────────────────────────
    const elegirArchivo = () => archivo.current?.click();

    const subir = async (file: File) => {
        if (!file.type.startsWith('image/')) { setPortada('error'); return; }
        if (file.size > MAX_PESO) { setPortada('error'); return; }

        setPortada('subiendo');
        // La barra no mide bytes —Storage no los informa— pero sí que la
        // subida empezó y sigue. El salto al 100% lo da la respuesta.
        setAvance('6%');
        window.setTimeout(() => setAvance(a => (a === '6%' ? '70%' : a)), 60);
        try {
            const url = await supabaseService.uploadImage(file, 'eventos-general');
            if (!url) throw new Error('sin url');
            setAvance('100%');
            setForm(f => ({ ...f, portada: url }));
            setVersion(v => v + 1);
            setPortada('lista');
        } catch (e) {
            console.error('[EventosGenerales] portada:', e);
            setPortada('error');
        }
    };

    const quitarPortada = () => {
        setForm(f => ({ ...f, portada: '' }));
        setVersion(v => v + 1);
        setPortada('vacia');
    };

    // ── Guardar y salir ─────────────────────────────────────────────────
    const guardar = async () => {
        if (noSePuede) return;
        setGuardando(true);

        const entrada = {
            name: form.nombre.trim(),
            imageUrl: form.portada || undefined,
            startDate: form.fecha,
            startTime: form.inicio || undefined,
            endTime: form.fin || undefined,
            description: form.descripcion.trim() || undefined,
            registrationLink: link || undefined,
        };

        const id = idDeLaUrl
            ? ((await updateEventoGeneral(idDeLaUrl, entrada)) ? idDeLaUrl : null)
            : await createEventoGeneral(entrada);

        setGuardando(false);
        if (!id) { avisar('No se pudo guardar. Probá de nuevo.'); return; }

        // `?guardado=` hace que la lista despliegue su año y lo encienda un
        // momento: con treinta eventos, encontrar el que se acaba de tocar
        // no puede quedar a ojo.
        navigate(`/eventos/admin/general?guardado=${id}`);
    };

    const salir = useCallback(() => {
        if (hayCambios) { setSalida(true); return; }
        navigate('/eventos/admin/general');
    }, [hayCambios, navigate]);

    // ── Lo que muestra la vista previa ──────────────────────────────────
    const horaPrevia = horario(form.inicio, malHorario ? '' : form.fin);
    const vistaPrevia = (
        <VistaPrevia
            nombre={form.nombre}
            fecha={form.fecha}
            hora={horaPrevia}
            descripcion={form.descripcion}
            hayLink={!!dominio}
            portada={form.portada}
            version={version}
        />
    );

    if (cargando) {
        return (
            <div className={`min-h-screen flex items-center justify-center ${T.fondo}`}>
                <Loader2 className={`w-6 h-6 animate-spin ${T.tenue}`} />
            </div>
        );
    }

    const botonGuardar = (
        <button
            type="button"
            onClick={() => void guardar()}
            disabled={noSePuede}
            className={`${botonBase} ${T.primario} ${T.foco} flex-1 lg:flex-none lg:min-w-[200px]
                h-[58px] lg:h-[50px] px-6 text-[16.5px] lg:text-[15.5px]
                transition-opacity disabled:cursor-default ${noSePuede && !guardando ? 'opacity-30' : 'hover:opacity-[.88]'}`}
        >
            {guardando && <Loader2 className="w-[18px] h-[18px] animate-spin" />}
            {guardando ? 'Guardando…' : idDeLaUrl ? 'Guardar cambios' : 'Guardar evento'}
        </button>
    );

    const botonCancelar = (
        <button
            type="button"
            onClick={salir}
            className={`${botonBase} ${T.chip} ${T.chipHover} ${T.foco} shrink-0 h-[58px] lg:h-[50px] px-[22px] text-[16px] lg:text-[15.5px]`}
        >
            Cancelar
        </button>
    );

    return (
        <div id="evento-form" className={`min-h-screen ${T.fondo} ${T.tinta} ${T.fuente}`}>
            <style>{ESTILOS}</style>

            <input
                ref={archivo}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void subir(f);
                }}
            />

            <div className="eg-entra max-w-[1080px] mx-auto px-4 pt-6 pb-[170px] lg:px-10 lg:pt-8 lg:pb-20">

                <div className="flex items-center gap-3.5">
                    <button
                        type="button"
                        onClick={salir}
                        aria-label="Volver a la lista"
                        className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center ${T.chip} ${T.chipHover} ${T.foco} transition-colors`}
                    >
                        <ChevronLeft className="w-[18px] h-[18px]" strokeWidth={2.2} />
                    </button>
                    <div className="min-w-0">
                        <p className={rotulo}>EVENTOS GENERALES</p>
                        <h1 className="mt-1 m-0 text-[26px] lg:text-[30px] leading-[1.1] font-semibold tracking-[-.025em]">
                            {idDeLaUrl ? 'Editar evento' : 'Nuevo evento'}
                        </h1>
                    </div>
                </div>

                <div className="grid lg:grid-cols-[minmax(0,560px)_minmax(0,380px)] gap-12 items-start mt-6">

                    {/* ── Los campos ── */}
                    <div className="min-w-0 flex flex-col gap-[22px]">

                        {!!idDeLaUrl && !!form.fecha && esPasado(form.fecha, hoy) && (
                            <div role="note" className={`flex items-start gap-3 px-4 py-3.5 rounded-[20px] ${T.tarjeta}`}>
                                <span className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${T.chip} ${T.suave}`}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
                                        strokeLinecap="round" strokeLinejoin="round" className="w-[15px] h-[15px]" aria-hidden="true">
                                        <path d="M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2" />
                                    </svg>
                                </span>
                                <p className="mt-[3px] m-0 text-[14px] leading-[1.5] font-medium">
                                    Este evento ya pasó. Los cambios se ven igual en /eventos si está visible.
                                </p>
                            </div>
                        )}

                        {/* Portada */}
                        <div>
                            <Rotulo>PORTADA</Rotulo>
                            <div className="mt-2.5">
                                {portada === 'vacia' && (
                                    <button
                                        type="button"
                                        onClick={elegirArchivo}
                                        className={`w-full max-w-[280px] aspect-square p-5 rounded-[22px]
                                            border-2 border-dashed border-black/20 dark:border-white/20
                                            bg-white/60 dark:bg-white/[.02] ${T.tinta} ${T.foco}
                                            flex flex-col items-center justify-center gap-2.5 text-center`}
                                    >
                                        <span className={`w-[52px] h-[52px] rounded-full flex items-center justify-center ${T.chip}`}>
                                            <Upload className="w-[22px] h-[22px]" strokeWidth={2} />
                                        </span>
                                        <span className="text-[15.5px] font-semibold">Subir portada</span>
                                        <span className={`text-[13px] font-medium ${T.suave}`}>Cuadrada, 500 × 500</span>
                                    </button>
                                )}

                                {portada === 'subiendo' && (
                                    <div role="status" className={`w-full max-w-[280px] aspect-square p-5 rounded-[22px] ${T.tarjeta}
                                        flex flex-col items-center justify-center gap-4 text-center`}
                                    >
                                        <span className="text-[15px] font-semibold">Subiendo la portada…</span>
                                        <div className="w-[70%] h-1.5 rounded-full overflow-hidden bg-black/10 dark:bg-white/[.12]">
                                            <div
                                                className="h-full rounded-full bg-[#0a0a0a] dark:bg-white transition-[width] duration-1000 ease-[cubic-bezier(.3,.6,.3,1)]"
                                                style={{ width: avance }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {portada === 'lista' && (
                                    <>
                                        <div className={`w-full max-w-[280px] aspect-square rounded-[22px] overflow-hidden ${T.chip}`}>
                                            {!!form.portada && <img src={form.portada} alt="Portada del evento" className="w-full h-full object-cover" />}
                                        </div>
                                        <div className="flex gap-2 mt-2.5">
                                            <button type="button" onClick={elegirArchivo}
                                                className={`${botonBase} ${T.chip} ${T.chipHover} ${T.foco} h-11 px-[18px] text-[14px]`}>
                                                Cambiar
                                            </button>
                                            <button type="button" onClick={quitarPortada}
                                                className={`${botonBase} ${T.chip} ${T.chipHover} ${T.foco} h-11 px-[18px] text-[14px]`}>
                                                Quitar
                                            </button>
                                        </div>
                                    </>
                                )}

                                {portada === 'error' && (
                                    <button
                                        type="button"
                                        onClick={elegirArchivo}
                                        className={`w-full max-w-[280px] aspect-square p-5 rounded-[22px] border-2 border-dashed
                                            bg-transparent ${T.tinta} ${T.foco}
                                            flex flex-col items-center justify-center gap-3.5 text-center`}
                                        style={{ borderColor: esOscuro ? AMBAR_OSCURO : AMBAR }}
                                    >
                                        <span role="alert" className="text-[15px] leading-[1.45] font-semibold">
                                            No se pudo subir. Probá con otra imagen.
                                        </span>
                                        <span className={`${botonBase} ${T.chip} h-11 px-[18px] text-[14px]`}>
                                            Elegir otra imagen
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Nombre */}
                        <label className="block">
                            <Rotulo>NOMBRE</Rotulo>
                            <input
                                type="text"
                                value={form.nombre}
                                onChange={e => poner('nombre', e.target.value)}
                                maxLength={MAX_NOMBRE}
                                placeholder="Ej.: Noche de adoración"
                                className={`${campo} mt-2.5`}
                            />
                        </label>

                        {/* Fecha */}
                        <label className="block">
                            <Rotulo>FECHA</Rotulo>
                            <input
                                type="date"
                                value={form.fecha}
                                onChange={e => poner('fecha', e.target.value)}
                                className={`${campo} mt-2.5`}
                                style={{ colorScheme: esOscuro ? 'dark' : 'light' }}
                            />
                        </label>

                        {/* Horario */}
                        <div>
                            <Rotulo>HORARIO</Rotulo>
                            <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                                <label className="block min-w-0">
                                    <span className={`text-[13px] font-semibold ${T.suave}`}>Empieza</span>
                                    <input
                                        type="time"
                                        value={form.inicio}
                                        onChange={e => poner('inicio', e.target.value)}
                                        className={`${campo} mt-1.5`}
                                        style={{ colorScheme: esOscuro ? 'dark' : 'light' }}
                                    />
                                </label>
                                <label className="block min-w-0">
                                    <span className={`text-[13px] font-semibold ${T.suave}`}>Termina (opcional)</span>
                                    <input
                                        type="time"
                                        value={form.fin}
                                        onChange={e => poner('fin', e.target.value)}
                                        aria-invalid={malHorario}
                                        className={`${campo} mt-1.5`}
                                        style={{ colorScheme: esOscuro ? 'dark' : 'light' }}
                                    />
                                </label>
                            </div>
                            {malHorario && (
                                <p role="alert" className="mt-2 mx-1 m-0 text-[13.5px] leading-[1.45] font-semibold">
                                    Tiene que terminar después de empezar.
                                </p>
                            )}
                        </div>

                        {/* Descripción */}
                        <label className="block">
                            <span className="flex items-baseline justify-between gap-2.5">
                                <Rotulo>DESCRIPCIÓN</Rotulo>
                                <span className={`text-[12.5px] font-semibold ${T.tenue}`}>
                                    {form.descripcion.length} / {MAX_DESC}
                                </span>
                            </span>
                            <textarea
                                value={form.descripcion}
                                onChange={e => poner('descripcion', e.target.value)}
                                maxLength={MAX_DESC}
                                rows={4}
                                placeholder="Opcional. Contá de qué se trata."
                                className="block w-full min-h-[120px] mt-2.5 px-[18px] py-3.5 resize-y text-[16px] leading-[1.5] font-medium"
                            />
                        </label>

                        {/* Link */}
                        <label className="block">
                            <Rotulo>LINK DE INSCRIPCIÓN</Rotulo>
                            <input
                                type="url"
                                inputMode="url"
                                value={form.link}
                                onChange={e => poner('link', e.target.value)}
                                placeholder="https://"
                                aria-invalid={malLink}
                                className={`${campo} mt-2.5`}
                            />
                            {malLink && (
                                <span role="alert" className="block mt-2 mx-1 text-[13.5px] leading-[1.45] font-semibold">
                                    El link tiene que empezar con https:// y ser una dirección válida.
                                </span>
                            )}
                            {!!dominio && (
                                <span className={`block mt-2 mx-1 text-[13px] font-semibold ${T.suave}`}>Abre {dominio}</span>
                            )}
                        </label>

                        {!esCompu && (
                            <button
                                type="button"
                                onClick={() => setPrevia(true)}
                                className={`${botonBase} ${T.chip} ${T.chipHover} ${T.foco} w-full h-14 text-[15.5px]`}
                            >
                                <Eye className="w-[18px] h-[18px]" strokeWidth={2} />
                                Ver cómo queda
                            </button>
                        )}

                        {esCompu && (
                            <div className="pt-1.5">
                                {!!razon && <p className={`m-0 mb-2.5 text-[13.5px] font-semibold ${T.suave}`}>{razon}</p>}
                                <div className="flex gap-2.5">
                                    {botonGuardar}
                                    {botonCancelar}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Así se ve en /eventos ── */}
                    {esCompu && (
                        <aside className="sticky top-6">
                            <p className={`${rotulo} mb-3`}>ASÍ SE VE EN /EVENTOS</p>
                            {vistaPrevia}
                        </aside>
                    )}
                </div>
            </div>

            {/* ── La barra de abajo, en el teléfono ── */}
            {!esCompu && (
                <div className={`fixed left-0 right-0 bottom-0 z-40 px-4 pt-2.5 pb-[34px] border-t ${T.linea} ${T.fondo}`}>
                    {!!razon && <p className={`m-0 mb-2 text-center text-[13px] font-semibold ${T.suave}`}>{razon}</p>}
                    <div className="flex gap-2">
                        {botonCancelar}
                        {botonGuardar}
                    </div>
                </div>
            )}

            {/* ── Salir sin guardar ── */}
            <Hoja abierta={salida} etiqueta="Salir sin guardar" onCerrar={() => setSalida(false)}>
                <div className="px-1 pt-3.5 text-center">
                    <p className="m-0 text-[20px] font-semibold tracking-[-.015em]">¿Salir sin guardar?</p>
                    <p className={`mt-2 m-0 text-[14.5px] leading-[1.5] ${T.suave}`}>
                        Los cambios que hiciste se pierden.
                    </p>
                </div>
                <div className="flex flex-col lg:flex-row-reverse gap-2.5 mt-[22px]">
                    <button
                        type="button"
                        onClick={() => setSalida(false)}
                        className={`${botonBase} ${T.primario} ${T.foco} w-full h-14 lg:h-[50px] text-[15.5px] hover:opacity-[.88]`}
                    >
                        Seguir editando
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate('/eventos/admin/general')}
                        className={`${botonBase} ${T.chip} ${T.chipHover} ${T.foco} w-full h-14 lg:h-[50px] text-[15.5px]`}
                    >
                        Salir sin guardar
                    </button>
                </div>
            </Hoja>

            {/* ── La vista previa, en el teléfono ── */}
            <Hoja abierta={previa} etiqueta="Vista previa" onCerrar={() => setPrevia(false)}>
                <p className={`${rotulo} mx-1 mt-1.5 mb-3`}>ASÍ SE VE EN /EVENTOS</p>
                {vistaPrevia}
                <button
                    type="button"
                    onClick={() => setPrevia(false)}
                    className={`${botonBase} ${T.chip} ${T.chipHover} ${T.foco} w-full h-14 mt-3.5 text-[15.5px]`}
                >
                    Seguir editando
                </button>
            </Hoja>

            <Aviso texto={aviso} abajo={esCompu ? '32px' : '150px'} />
        </div>
    );
};

export default CrearEventoGeneral;

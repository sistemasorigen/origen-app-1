// ════════════════════════════════════════════════════════════════════════
// Formulario de un grupo — crear y editar comparten pantalla.
//
// Del diseño (Editar Grupo.dc.html, turno 1):
//   1a cerrado y con una sección abierta · 1b dónde y cuándo + corrector
//   1c crear de cero · 1d desktop en dos columnas
//
// Son 14 campos que no se sienten como 14: cuatro secciones plegables en
// una sola página, todas cerradas al entrar y cada fila mostrando lo que el
// grupo tiene hoy. Para cambiar una cosa se abre una sola sección; para
// crear de cero, el resumen se reemplaza por "Sin completar". No hay pasos
// ni pestañas: los pasos obligan a pasar por todo y las pestañas esconden
// lo que falta.
//
// La lógica (validaciones, submit, fetch) NO vive acá: cada página la
// conserva y este componente sólo la presenta.
// ════════════════════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { User, GroupTag, SeasonSettings } from '../../../types';
import { ArrowLeft, Check, Loader2, Search, Wand2, X } from 'lucide-react';
import ImageUpload from '../../media/SubidaImagen';
import { useIsMobile } from '../../../src/hooks/useIsMobile';
import { T, btnPrimarioBase, btnSecundarioBase, rotulo } from '../patron';

export const DIAS_DE_REUNION = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
export const GENEROS = ['Mixto', 'Hombre', 'Mujer'];

export interface DatosGrupo {
    name: string;
    categoryId: string;
    meetingDay: string;
    meetingTime: string;
    location: string;
    isOnline: boolean;
    description: string;
    maxCapacity: number | string;
    imageUrl: string;
    coHostFirstName: string;
    coHostLastName: string;
    minAge: number | string;
    maxAge: number | string;
    targetGender: string;
    tags: string[];
    startDate: string;
    endDate: string;
}

export interface CoAnfitrion {
    modo: 'manual' | 'search';
    setModo: (m: 'manual' | 'search') => void;
    termino: string;
    setTermino: (t: string) => void;
    id: string | null;
    setId: (id: string | null) => void;
    resultados: User[];
    buscando: boolean;
    desplegado: boolean;
    setDesplegado: (b: boolean) => void;
    contenedor: React.RefObject<HTMLDivElement>;
}

export interface Ortografia {
    revisando: boolean;
    corrigiendo: boolean;
    hayErrores: boolean;
    estado: 'idle' | 'correcting' | 'success' | 'error';
    sugerencia: string | null;
    /** Botón chico del propio campo: corrige y no guarda. */
    onCorregir: () => void;
    /** Abierta cuando se intentó guardar con errores sin corregir. */
    hojaAbierta: boolean;
    /** Botón principal de la hoja: corrige y guarda, en una sola acción. */
    onCorregirYGuardar: () => void;
    onGuardarIgual: () => void;
    onCerrarHoja: () => void;
}

export interface Tour {
    paso: number;                 // 0 = sin tour
    onSiguiente: (n: number) => void;
    onSaltar: () => void;
    onTerminar: () => void;
}

type Seccion = 'identidad' | 'donde' | 'quienes' | 'etiquetas';

const NOMBRE_SECCION: Record<Seccion, string> = {
    identidad: 'Identidad',
    donde: 'Dónde y cuándo',
    quienes: 'Quiénes',
    etiquetas: 'Etiquetas',
};

const ORDEN: Seccion[] = ['identidad', 'donde', 'quienes', 'etiquetas'];

// Un campo está lleno si tiene algo. 0 cuenta (edad mínima 0 es una edad).
const lleno = (v: unknown): boolean => {
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'number') return !Number.isNaN(v);
    return String(v ?? '').trim() !== '';
};

// ── Piezas del formulario ───────────────────────────────────────────────

// El recuadro gris con el rótulo adentro. El control va desnudo: el borde
// y el fondo los dibuja esta caja, no el input.
const Caja: React.FC<{
    etiqueta: string;
    children: React.ReactNode;
    alto?: string;
    onClick?: () => void;
    className?: string;
}> = ({ etiqueta, children, alto = 'h-[60px]', onClick, className = '' }) => (
    <div
        onClick={onClick}
        className={`relative ${alto} rounded-[20px] ${T.interna} px-[18px] flex flex-col justify-center ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
        <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-black/40 dark:text-white/40 pointer-events-none">
            {etiqueta}
        </span>
        {children}
    </div>
);

const claseControl = 'campo-desnudo w-full text-[15.5px] font-medium placeholder:text-black/35 dark:placeholder:text-white/35';

const Chevron: React.FC<{ abierto?: boolean; clase?: string }> = ({ abierto, clase = 'text-black/35 dark:text-white/35' }) => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round"
        className={`shrink-0 transition-transform ${clase} ${abierto ? 'rotate-180' : ''}`} aria-hidden="true">
        <path d="M6 9l6 6 6-6" />
    </svg>
);

// El tooltip del recorrido guiado. Se mantiene tal cual estaba en las dos
// páginas: es la única ayuda que tiene un anfitrión nuevo.
const Globo: React.FC<{
    titulo: string;
    texto: string;
    paso: number;
    total: number;
    onSiguiente: () => void;
    onSaltar: () => void;
    ultimo?: boolean;
}> = ({ titulo, texto, paso, total, onSiguiente, onSaltar, ultimo }) => (
    <div className="absolute top-full left-0 mt-3 w-72 z-[9999] bg-white dark:bg-[#1b1b1a] rounded-[22px] p-5 shadow-[0_10px_40px_rgba(0,0,0,.18)] text-left">
        <div className="flex justify-between items-start gap-3 mb-2.5">
            <p className="text-[17px] font-semibold tracking-[-.01em] leading-tight">{titulo}</p>
            <span className={`${T.chip} text-[11.5px] font-semibold px-2 py-1 rounded-full shrink-0`}>{paso} / {total}</span>
        </div>
        <p className="text-[14px] leading-[1.6] font-medium text-black/55 dark:text-white/55 mb-5">{texto}</p>
        <div className="flex items-center justify-between">
            <button type="button" onClick={onSaltar} className="text-[13.5px] font-semibold text-black/40 dark:text-white/40 hover:opacity-70">
                Saltar
            </button>
            <button type="button" onClick={onSiguiente} className={`${btnPrimarioBase} h-[42px] px-5 text-[14px]`}>
                {ultimo ? 'Finalizar' : 'Siguiente'}
            </button>
        </div>
    </div>
);

// ── Componente principal ────────────────────────────────────────────────

export interface PropsFormularioGrupo {
    /**
     * 'reabrir' arranca con los datos del grupo que terminó, pero son
     * editables: lo que quede en el formulario es lo que se guarda en el
     * grupo nuevo (`cloneGroupForNewSeason` recibe los cambios). Lo único
     * propio del modo es la tarjeta de temporada arriba, que es la decisión
     * obligatoria — sin una temporada distinta no hay nada que reabrir.
     */
    modo: 'crear' | 'editar' | 'reabrir';
    /** Segunda línea del encabezado: el nombre del grupo, o el aviso de revisión. */
    subtitulo: string;
    onVolver: () => void;
    form: DatosGrupo;
    setForm: React.Dispatch<React.SetStateAction<any>>;
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
    categorias: { id: string; name: string }[];
    etiquetas: GroupTag[];
    onToggleEtiqueta: (id: string) => void;
    coAnfitrion: CoAnfitrion;
    ortografia: Ortografia;
    anio: number;
    temporadas: SeasonSettings['seasons'];
    onGuardar: (e: React.FormEvent) => void;
    guardando: boolean;
    /** Sólo en 'editar': cuántos campos difieren de lo guardado. */
    cambios?: number;
    /** Cartel arriba del formulario (p. ej. "se enviará a revisión"). */
    aviso?: React.ReactNode;
    /** Pisa el texto del botón de guardar. */
    textoGuardar?: string;
    tour?: Tour;
}

const FormularioGrupo: React.FC<PropsFormularioGrupo> = ({
    modo, subtitulo, onVolver, form, setForm, onChange,
    categorias, etiquetas, onToggleEtiqueta, coAnfitrion, ortografia,
    anio, temporadas, onGuardar, guardando, cambios = 0, aviso, textoGuardar, tour,
}) => {
    const esCrear = modo === 'crear';
    const esReabrir = modo === 'reabrir';
    const enTour = (tour?.paso ?? 0) > 0;
    const angosto = useIsMobile(1024);

    // Cerradas al entrar: se verifica todo el grupo sin abrir nada. En crear
    // la primera viene abierta porque no hay nada que verificar.
    const [abierta, setAbierta] = React.useState<Seccion | null>(esCrear ? 'identidad' : null);

    const claveTemporada = useMemo(
        () => (['S1', 'S2', 'S3'] as const).find(k =>
            form.startDate === `${anio}-${temporadas[k].startDate}` &&
            form.endDate === `${anio}-${temporadas[k].endDate}`
        ) || null,
        [form.startDate, form.endDate, anio, temporadas]
    );

    // ── Completitud ─────────────────────────────────────────────────────
    // Los opcionales (co-anfitrión, etiquetas) no cuentan: la barra tiene
    // que poder llegar a 14 de 14 sin obligar a nadie a poner etiquetas.
    const requeridos: Record<Seccion, boolean[]> = {
        identidad: [lleno(form.imageUrl), lleno(form.name), lleno(form.description)],
        donde: [
            lleno(form.categoryId),
            ...(form.isOnline ? [] : [lleno(form.location)]),
            lleno(form.meetingDay), lleno(form.meetingTime),
            lleno(form.startDate), lleno(form.endDate),
        ],
        quienes: [lleno(form.maxCapacity), lleno(form.minAge), lleno(form.maxAge), lleno(form.targetGender)],
        etiquetas: [],
    };
    const faltantes = (s: Seccion) => requeridos[s].filter(v => !v).length;
    const total = ORDEN.reduce((n, s) => n + requeridos[s].length, 0);
    const completos = total - ORDEN.reduce((n, s) => n + faltantes(s), 0);
    const completo = completos === total;

    // ── Resúmenes de sección cerrada ────────────────────────────────────
    const nombreCategoria = categorias.find(c => c.id === form.categoryId)?.name;
    const nombresEtiquetas = etiquetas.filter(t => form.tags.includes(t.id)).map(t => t.name);
    const coAnfitrionTexto = coAnfitrion.modo === 'search'
        ? (coAnfitrion.id ? coAnfitrion.termino : '')
        : `${form.coHostFirstName} ${form.coHostLastName}`.trim();

    const resumenBase = (s: Seccion): { titulo: string; detalle?: string; vacio: boolean } => {
        const sinCompletar = (n: number) => ({
            titulo: `Sin completar · ${n} ${n === 1 ? 'campo' : 'campos'}`,
            vacio: true,
        });
        switch (s) {
            case 'identidad': {
                if (!lleno(form.name) && !lleno(form.description)) return sinCompletar(faltantes(s));
                return {
                    titulo: form.name || 'Sin nombre',
                    detalle: [
                        form.imageUrl ? 'Foto cargada' : 'Sin foto',
                        form.description ? `Descripción de ${form.description.length} caracteres` : 'Sin descripción',
                    ].join(' · '),
                    vacio: false,
                };
            }
            case 'donde': {
                if (faltantes(s) === requeridos[s].length) return sinCompletar(faltantes(s));
                return {
                    titulo: `${form.meetingDay} ${form.meetingTime} · ${form.isOnline ? 'Online' : 'Presencial'}`,
                    detalle: [
                        form.isOnline ? nombreCategoria : (form.location || nombreCategoria),
                        claveTemporada ? temporadas[claveTemporada].label : (form.startDate ? 'Fechas propias' : null),
                    ].filter(Boolean).join(' · ') || undefined,
                    vacio: false,
                };
            }
            case 'quienes':
                return {
                    titulo: `Hasta ${form.maxCapacity || '—'} personas · ${form.minAge} a ${form.maxAge} años`,
                    detalle: [
                        coAnfitrionTexto ? `Co-anfitrión: ${coAnfitrionTexto}` : null,
                        form.targetGender,
                    ].filter(Boolean).join(' · '),
                    vacio: false,
                };
            case 'etiquetas':
                return nombresEtiquetas.length > 0
                    ? { titulo: nombresEtiquetas.join(', '), vacio: false }
                    : { titulo: 'Opcional', vacio: true };
        }
    };

    // Creando, varios campos vienen con un valor por defecto (día, horario,
    // capacidad, temporada), así que decir "Sin completar" sería mentira.
    // Se dice qué falta al lado de lo que ya hay.
    const resumen = (s: Seccion) => {
        const r = resumenBase(s);
        const n = faltantes(s);
        if (!esCrear || n === 0 || r.vacio) return r;
        const falta = `${n === 1 ? 'Falta' : 'Faltan'} ${n} ${n === 1 ? 'campo' : 'campos'}`;
        return { ...r, detalle: r.detalle ? `${r.detalle} · ${falta}` : falta };
    };

    // ── Contenido de cada sección ───────────────────────────────────────
    // Se arma una sola vez y se coloca en el acordeón o en el panel de
    // escritorio, nunca en los dos: si se duplicara, los id del recorrido
    // guiado quedarían repetidos y getElementById tomaría el escondido.
    const envoltorioTour = (n: number, titulo: string, texto: string, hijos: React.ReactNode, ultimo = false) => (
        <div
            id={`tour-wrap-${n}`}
            className={`relative rounded-[22px] transition-all ${tour?.paso === n ? 'ring-4 ring-black/80 dark:ring-white/80 p-2 -m-2 z-[60]' : ''}`}
        >
            {tour?.paso === n && (
                <Globo
                    titulo={titulo} texto={texto} paso={n} total={9} ultimo={ultimo}
                    onSiguiente={() => (ultimo ? tour.onTerminar() : tour.onSiguiente(n + 1))}
                    onSaltar={tour.onSaltar}
                />
            )}
            {hijos}
        </div>
    );

    const bloqueTemporada = (
        <div>
            {/* Reabriendo, el título de la tarjeta ya dice que esto es la
                temporada: el rótulo sobra. */}
            {!esReabrir && <p className={`${rotulo} px-1 mb-2.5`}>Temporada</p>}
            <div className="flex flex-col gap-2">
                {(['S1', 'S2', 'S3'] as const).map(key => {
                    const temporada = temporadas[key];
                    const cerrada = !temporada.isOpen;
                    const desde = `${anio}-${temporada.startDate}`;
                    const hasta = `${anio}-${temporada.endDate}`;
                    const elegida = claveTemporada === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            disabled={cerrada}
                            onClick={() => setForm((prev: any) => ({ ...prev, startDate: desde, endDate: hasta }))}
                            className={`w-full text-left rounded-[20px] px-[18px] py-3.5 transition-colors ${cerrada
                                ? `${T.interna} opacity-45 cursor-not-allowed`
                                : elegida
                                    ? 'bg-[#0a0a0a] dark:bg-white text-white dark:text-black'
                                    : `${T.interna} hover:opacity-80`}`}
                        >
                            <div className="flex items-center gap-2.5">
                                <span className="flex-1 text-[15px] font-semibold truncate">{temporada.label}</span>
                                {cerrada && <span className="text-[12px] font-medium opacity-60 shrink-0">No disponible</span>}
                                {elegida && <Check className="w-[17px] h-[17px] shrink-0" strokeWidth={2.6} />}
                            </div>
                            <p className={`mt-1 text-[13px] font-medium ${elegida ? 'text-white/60 dark:text-black/55' : 'text-black/45 dark:text-white/45'}`}>
                                {new Date(desde + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                                {' — '}
                                {new Date(hasta + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} {anio}
                            </p>
                        </button>
                    );
                })}
            </div>

            {/* Fechas a mano: sólo si el grupo ya venía con
                fechas fuera de las temporadas oficiales. */}
            {!claveTemporada && form.startDate && (
                <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                    <Caja etiqueta="Inicio">
                        <input type="date" name="startDate" value={form.startDate} onChange={onChange} className={claseControl} />
                    </Caja>
                    <Caja etiqueta="Fin">
                        <input type="date" name="endDate" value={form.endDate} onChange={onChange} className={claseControl} />
                    </Caja>
                </div>
            )}
        </div>
    );

    const contenido = (s: Seccion): React.ReactNode => {
        switch (s) {
            case 'identidad':
                return (
                    // En escritorio la portada va al lado de los campos: sola
                    // arriba se comería media pantalla antes de llegar al nombre.
                    <div className="flex flex-col gap-2.5 lg:grid lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] lg:gap-5 lg:items-start">
                        {envoltorioTour(1, 'La portada de tu grupo',
                            'Subí una foto de tu galería. La recortás acá mismo, sin salir del formulario.',
                            <ImageUpload
                                className="caja-portada"
                                currentImage={form.imageUrl}
                                folder="groups"
                                variant="minimal"
                                onImageUpload={(url) => setForm((prev: any) => ({ ...prev, imageUrl: url }))}
                                aspectRatio="wide"
                                placeholder="Subir una foto de portada"
                            />
                        )}

                        <div className="contents lg:flex lg:flex-col lg:gap-3">
                        {envoltorioTour(2, 'Nombrá tu grupo',
                            'Elegí un nombre claro. Ej: "Jóvenes Profesionales" o "Estudio de Juan".',
                            <Caja etiqueta="Nombre del grupo">
                                <input
                                    type="text" name="name" value={form.name} onChange={onChange}
                                    className={claseControl} placeholder="Ej: Jóvenes Profesionales" required
                                />
                            </Caja>
                        )}

                        {envoltorioTour(3, 'De qué se trata',
                            'Explicá qué van a hacer y a quién va dirigido. La ortografía la revisamos nosotros.',
                            <div className={`rounded-[20px] ${T.interna} px-[18px] pt-3.5 pb-4`}>
                                <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-black/40 dark:text-white/40">
                                    Descripción
                                </span>
                                <textarea
                                    name="description" value={form.description} onChange={onChange} rows={4}
                                    className={`${claseControl} mt-1.5 resize-none leading-[1.6] text-[14.5px]`}
                                    placeholder="Un grupo para…"
                                />
                                {(ortografia.revisando || ortografia.hayErrores || ortografia.estado === 'correcting' || ortografia.estado === 'success') && (
                                    <div className="flex items-center gap-3 mt-3.5 pt-3.5 border-t border-black/[.07] dark:border-white/10">
                                        <span className="flex-1 text-[13px] leading-[1.45] font-medium text-black/50 dark:text-white/50">
                                            {ortografia.revisando
                                                ? 'Revisando la ortografía…'
                                                : ortografia.estado === 'success'
                                                    ? 'Descripción corregida'
                                                    : 'Hay errores de ortografía'}
                                        </span>
                                        {ortografia.hayErrores && (
                                            <button
                                                type="button" onClick={ortografia.onCorregir} disabled={ortografia.corrigiendo}
                                                className={`${btnPrimarioBase} h-10 px-3.5 text-[13.5px] shrink-0`}
                                            >
                                                {ortografia.corrigiendo
                                                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Corrigiendo…</>
                                                    : <><Wand2 className="w-3.5 h-3.5" /> Corregir</>}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        </div>
                    </div>
                );

            case 'donde':
                return (
                    <div className="flex flex-col gap-2.5">
                        {envoltorioTour(4, 'Categoría principal',
                            'Clasificá el grupo para que lo encuentren desde el buscador.',
                            <Caja etiqueta="Categoría">
                                <div className="flex items-center gap-2">
                                    <select name="categoryId" value={form.categoryId} onChange={onChange} className={`${claseControl} appearance-none`}>
                                        <option value="">Sin elegir</option>
                                        {categorias.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                    </select>
                                    <Chevron clase="text-black/40 dark:text-white/40" />
                                </div>
                            </Caja>
                        )}

                        {envoltorioTour(5, 'Dónde se juntan',
                            'Si el grupo es online no hace falta dirección: el campo desaparece.',
                            <>
                                {/* Un par de píldoras del ancho completo. Al elegir
                                    Online la dirección desaparece en vez de quedar
                                    deshabilitada: un campo gris que no se puede
                                    tocar sigue pareciendo un campo pendiente. */}
                                <div className="flex gap-2.5" role="radiogroup" aria-label="Modalidad del grupo">
                                    {[false, true].map(online => (
                                        <button
                                            key={String(online)}
                                            type="button"
                                            role="radio"
                                            aria-checked={form.isOnline === online}
                                            onClick={() => setForm((prev: any) => ({ ...prev, isOnline: online }))}
                                            className={`flex-1 h-[56px] rounded-full font-semibold text-[15.5px] transition-colors ${form.isOnline === online
                                                ? 'bg-[#0a0a0a] dark:bg-white text-white dark:text-black'
                                                : `${T.interna} text-black/55 dark:text-white/55`}`}
                                        >
                                            {online ? 'Online' : 'Presencial'}
                                        </button>
                                    ))}
                                </div>
                                {!form.isOnline && (
                                    <Caja etiqueta="Dirección" className="mt-2.5">
                                        <input
                                            type="text" name="location" value={form.location} onChange={onChange}
                                            className={claseControl} placeholder="Calle, altura y piso"
                                        />
                                    </Caja>
                                )}
                            </>
                        )}

                        {envoltorioTour(6, 'Cuándo se juntan',
                            'Elegí el día y la hora. La constancia es lo que sostiene al grupo.',
                            <div className="grid grid-cols-2 gap-2.5">
                                <Caja etiqueta="Día">
                                    <div className="flex items-center gap-2">
                                        <select name="meetingDay" value={form.meetingDay} onChange={onChange} className={`${claseControl} appearance-none`}>
                                            {DIAS_DE_REUNION.map(d => <option key={d} value={d}>{d}</option>)}
                                        </select>
                                        <Chevron clase="text-black/40 dark:text-white/40" />
                                    </div>
                                </Caja>
                                <Caja etiqueta="Horario">
                                    <input type="time" name="meetingTime" value={form.meetingTime} onChange={onChange} className={claseControl} />
                                </Caja>
                            </div>
                        )}

                        {/* Reabriendo, la temporada es LA decisión de la
                            pantalla: sale del acordeón y va suelta arriba. */}
                        {!esReabrir && envoltorioTour(7, 'Cuánto dura',
                            'Elegí una temporada de la comunidad y las fechas se completan solas.',
                            bloqueTemporada)}
                    </div>
                );

            case 'quienes':
                return (
                    <div className="flex flex-col gap-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                            <Caja etiqueta="Capacidad">
                                <input type="number" name="maxCapacity" value={form.maxCapacity} onChange={onChange} className={claseControl} />
                            </Caja>
                            {envoltorioTour(8, 'Para quién es',
                                'Definí si el grupo es para hombres, para mujeres o mixto.',
                                <Caja etiqueta="Género">
                                    <div className="flex items-center gap-2">
                                        <select name="targetGender" value={form.targetGender} onChange={onChange} className={`${claseControl} appearance-none`}>
                                            {GENEROS.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                        <Chevron clase="text-black/40 dark:text-white/40" />
                                    </div>
                                </Caja>
                            )}
                            <Caja etiqueta="Edad mínima">
                                <input type="number" name="minAge" value={form.minAge} onChange={onChange} className={claseControl} />
                            </Caja>
                            <Caja etiqueta="Edad máxima">
                                <input type="number" name="maxAge" value={form.maxAge} onChange={onChange} className={claseControl} />
                            </Caja>
                        </div>

                        <div className="pt-1.5">
                            <div className="flex items-center justify-between gap-3 px-1 mb-2.5">
                                {/* En 375px el rótulo largo empujaba el conmutador
                                    y "A mano" se partía en dos renglones. */}
                                <p className={`${rotulo} truncate`}>
                                    Co-anfitrión<span className="hidden lg:inline"> · opcional</span>
                                </p>
                                <div className={`flex shrink-0 ${T.interna} p-1 rounded-full`}>
                                    {(['search', 'manual'] as const).map(m => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => {
                                                coAnfitrion.setModo(m);
                                                if (m === 'manual') { coAnfitrion.setId(null); coAnfitrion.setTermino(''); }
                                                else setForm((prev: any) => ({ ...prev, coHostFirstName: '', coHostLastName: '' }));
                                            }}
                                            className={`px-3.5 h-8 rounded-full text-[12.5px] font-semibold whitespace-nowrap transition-colors ${coAnfitrion.modo === m
                                                ? 'bg-[#0a0a0a] dark:bg-white text-white dark:text-black'
                                                : 'text-black/50 dark:text-white/50'}`}
                                        >
                                            {m === 'search' ? 'Buscar' : 'A mano'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {coAnfitrion.modo === 'manual' ? (
                                <div className="grid grid-cols-2 gap-2.5">
                                    <Caja etiqueta="Nombre">
                                        <input type="text" name="coHostFirstName" value={form.coHostFirstName} onChange={onChange} className={claseControl} placeholder="Nombre" />
                                    </Caja>
                                    <Caja etiqueta="Apellido">
                                        <input type="text" name="coHostLastName" value={form.coHostLastName} onChange={onChange} className={claseControl} placeholder="Apellido" />
                                    </Caja>
                                </div>
                            ) : (
                                <div ref={coAnfitrion.contenedor} className="relative">
                                    {coAnfitrion.id ? (
                                        <div className={`h-[60px] rounded-[20px] ${T.interna} px-[18px] flex items-center gap-3`}>
                                            <Check className="w-[18px] h-[18px] shrink-0" strokeWidth={2.6} />
                                            <span className="flex-1 text-[15.5px] font-semibold truncate">{coAnfitrion.termino}</span>
                                            <button
                                                type="button"
                                                onClick={() => { coAnfitrion.setId(null); coAnfitrion.setTermino(''); }}
                                                aria-label="Quitar co-anfitrión"
                                                className="shrink-0 text-black/40 dark:text-white/40 hover:opacity-70"
                                            >
                                                <X className="w-[18px] h-[18px]" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className={`h-[60px] rounded-[20px] ${T.interna} px-[18px] flex items-center gap-2.5`}>
                                            <Search className="w-[17px] h-[17px] shrink-0 text-black/40 dark:text-white/40" />
                                            <input
                                                type="text"
                                                value={coAnfitrion.termino}
                                                onChange={e => { coAnfitrion.setTermino(e.target.value); coAnfitrion.setId(null); }}
                                                onFocus={() => coAnfitrion.resultados.length > 0 && coAnfitrion.setDesplegado(true)}
                                                placeholder="Buscar por nombre o email"
                                                className={claseControl}
                                            />
                                            {coAnfitrion.buscando && <Loader2 className="w-4 h-4 animate-spin shrink-0 text-black/30 dark:text-white/30" />}
                                        </div>
                                    )}

                                    {coAnfitrion.desplegado && !coAnfitrion.id && coAnfitrion.termino.trim() && (
                                        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#1b1b1a] rounded-[22px] shadow-[0_10px_40px_rgba(0,0,0,.16)] overflow-hidden z-[999] max-h-[264px] overflow-y-auto">
                                            {coAnfitrion.resultados.length > 0 ? coAnfitrion.resultados.map(u => (
                                                <button
                                                    key={u.id}
                                                    type="button"
                                                    onMouseDown={e => {
                                                        e.preventDefault();
                                                        coAnfitrion.setId(u.id);
                                                        coAnfitrion.setTermino(u.name);
                                                        coAnfitrion.setDesplegado(false);
                                                    }}
                                                    className="w-full flex items-center gap-3 h-[62px] px-4 text-left transition-colors hover:bg-black/[.03] dark:hover:bg-white/[.05]"
                                                >
                                                    <div className={`w-9 h-9 shrink-0 rounded-full ${T.chip} flex items-center justify-center text-[12.5px] font-semibold text-black/60 dark:text-white/60`}>
                                                        {u.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[14.5px] font-semibold truncate">{u.name}</p>
                                                        <p className="text-[12.5px] font-medium text-black/40 dark:text-white/40 truncate">{u.email}</p>
                                                    </div>
                                                </button>
                                            )) : !coAnfitrion.buscando && (
                                                <p className="px-4 py-5 text-center text-[14px] font-medium text-black/40 dark:text-white/40">
                                                    Sin resultados para "{coAnfitrion.termino}"
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'etiquetas':
                return (
                    <div className="flex flex-wrap gap-2">
                        {etiquetas.length === 0 ? (
                            <p className="text-[14px] font-medium text-black/45 dark:text-white/45">
                                Todavía no hay etiquetas cargadas.
                            </p>
                        ) : etiquetas.map(tag => {
                            const puesta = form.tags.includes(tag.id);
                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    onClick={() => onToggleEtiqueta(tag.id)}
                                    aria-pressed={puesta}
                                    className={`h-[42px] px-[18px] rounded-full text-[14px] font-semibold transition-colors ${puesta
                                        ? 'bg-[#0a0a0a] dark:bg-white text-white dark:text-black'
                                        : `${T.interna} text-black/55 dark:text-white/55 hover:opacity-80`}`}
                                >
                                    {tag.name}
                                </button>
                            );
                        })}
                    </div>
                );
        }
    };

    // ── Guardar ─────────────────────────────────────────────────────────
    const puedeGuardar = esCrear ? completo : cambios > 0;
    const rotuloGuardar = guardando
        ? 'Guardando…'
        : textoGuardar
            ?? (esCrear
                ? 'Crear el grupo'
                : `Guardar ${cambios} ${cambios === 1 ? 'cambio' : 'cambios'}`);

    const botonGuardar = (
        <div id="tour-wrap-9" className="relative">
            {tour?.paso === 9 && (
                <Globo
                    titulo="Listo" texto="Revisá que esté todo y guardá." paso={9} total={9} ultimo
                    onSiguiente={tour.onTerminar} onSaltar={tour.onSaltar}
                />
            )}
            <button
                type="submit"
                disabled={!puedeGuardar || guardando || ortografia.revisando}
                className={`${btnPrimarioBase} w-full h-[60px] text-[17px] shadow-[0_6px_22px_rgba(0,0,0,.18)]`}
            >
                {guardando && <Loader2 className="w-5 h-5 animate-spin" />}
                {rotuloGuardar}
            </button>
        </div>
    );

    // ── Encabezado ──────────────────────────────────────────────────────
    const encabezado = (
        <div className="bg-white dark:bg-[#1b1b1a] rounded-b-[28px] px-5 pt-4 pb-[18px] lg:rounded-none lg:px-8 lg:py-[18px]">
            <div className="max-w-[430px] lg:max-w-[1160px] mx-auto">
                {angosto ? (
                    <div className="flex items-center gap-3.5">
                        <button
                            type="button" onClick={onVolver} aria-label="Volver"
                            className={`w-10 h-10 shrink-0 rounded-full ${T.chip} flex items-center justify-center transition-opacity hover:opacity-70`}
                        >
                            <ArrowLeft className="w-[18px] h-[18px]" strokeWidth={2.2} />
                        </button>
                        <div className="min-w-0">
                            <p className="text-[18px] font-semibold tracking-[-.01em] truncate">
                                {esCrear ? 'Crear un grupo' : esReabrir ? 'Reabrir el grupo' : 'Editar el grupo'}
                            </p>
                            <p className="text-[13px] font-medium text-black/45 dark:text-white/45 truncate">{subtitulo}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <button
                            type="button" onClick={onVolver} aria-label="Volver"
                            className={`w-11 h-11 shrink-0 rounded-full ${T.chip} flex items-center justify-center transition-opacity hover:opacity-70`}
                        >
                            <ArrowLeft className="w-[19px] h-[19px]" strokeWidth={2.2} />
                        </button>
                        <span className="text-[14.5px] font-medium text-black/50 dark:text-white/50">Mis grupos</span>
                        <span className="text-[14.5px] font-medium text-black/28 dark:text-white/28">/</span>
                        {/* Creando no hay grupo todavía: el subtítulo es una
                            frase, no un nombre, y en un breadcrumb no va. */}
                        {!esCrear && (
                            <>
                                <span className="text-[14.5px] font-medium text-black/50 dark:text-white/50 truncate max-w-[280px]">{subtitulo}</span>
                                <span className="text-[14.5px] font-medium text-black/28 dark:text-white/28">/</span>
                            </>
                        )}
                        <span className="text-[14.5px] font-semibold">
                            {esCrear ? 'Crear un grupo' : esReabrir ? 'Reabrir' : 'Editar'}
                        </span>

                        <div className="ml-auto flex items-center gap-3.5 shrink-0">
                            {modo === 'editar' && cambios > 0 && (
                                <span className="text-[13px] font-medium text-black/45 dark:text-white/45">
                                    {cambios} {cambios === 1 ? 'cambio' : 'cambios'} sin guardar
                                </span>
                            )}
                            {esCrear && !completo && (
                                <span className="text-[13px] font-medium text-black/45 dark:text-white/45">
                                    {completos} de {total} campos
                                </span>
                            )}
                            <button
                                type="submit"
                                disabled={!puedeGuardar || guardando || ortografia.revisando}
                                className={`${btnPrimarioBase} h-12 px-[26px] text-[15.5px]`}
                            >
                                {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
                                {esCrear ? 'Crear el grupo' : textoGuardar ?? 'Guardar'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Barra de completitud: sólo al crear. Editando no hay nada
                    que completar, hay algo que cambiar. */}
                {esCrear && angosto && (
                    <div className="flex items-center gap-3 mt-[18px]">
                        <div className="flex-1 h-1.5 rounded-full bg-[#eceae6] dark:bg-[#2a2a28] overflow-hidden">
                            <div
                                className="h-full rounded-full bg-[#0a0a0a] dark:bg-white transition-all duration-500"
                                style={{ width: `${total ? Math.round((completos / total) * 100) : 0}%` }}
                            />
                        </div>
                        <span className="text-[12.5px] font-semibold text-black/45 dark:text-white/45 whitespace-nowrap">
                            {completos} de {total}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );

    // ── Hoja del corrector ──────────────────────────────────────────────
    // No abre un diálogo propio: usa la misma hoja inferior que el resto del
    // sistema, con las palabras marcadas y "Guardar como está" siempre a mano.
    const cambiosDeTexto = useMemo(() => {
        if (!ortografia.sugerencia) return [];
        const antes = form.description.split(/\s+/).filter(Boolean);
        const despues = ortografia.sugerencia.split(/\s+/).filter(Boolean);
        // Sin la misma cantidad de palabras no se pueden aparear una a una;
        // en ese caso la hoja muestra el aviso general y nada más.
        if (antes.length !== despues.length) return [];
        // Un punto final o una mayúscula de arranque no son una palabra mal
        // escrita: listarlas como "bienvenidos → bienvenidos." no enseña nada.
        const nucleo = (p: string) => p
            .replace(/^[¿¡"'(]+|[.,;:!?"')]+$/g, '')
            .toLocaleLowerCase('es');
        return antes
            .map((p, i) => ({ antes: p, despues: despues[i] }))
            .filter(p => nucleo(p.antes) !== nucleo(p.despues))
            .slice(0, 6);
    }, [form.description, ortografia.sugerencia]);

    const hoja = ortografia.hojaAbierta && typeof document !== 'undefined' && createPortal(
        <div className={`${T.fuente} ${T.tinta} fixed inset-0 z-[9999] flex items-end sm:items-center justify-center`}>
            <div className="absolute inset-0 bg-black/38" onClick={ortografia.onCerrarHoja} />
            <div
                role="dialog"
                aria-modal="true"
                className="relative w-full sm:max-w-[420px] bg-white dark:bg-[#1b1b1a] rounded-t-[30px] sm:rounded-[30px] px-[22px] pt-3.5 pb-[26px] animate-slideIn"
            >
                <div className="w-[38px] h-1 rounded-full bg-[#e2e2de] dark:bg-[#333331] mx-auto mb-5 sm:hidden" />
                <p className="text-[21px] leading-[1.3] font-semibold tracking-[-.01em]">
                    {cambiosDeTexto.length > 0
                        ? `Hay ${cambiosDeTexto.length} ${cambiosDeTexto.length === 1 ? 'error' : 'errores'} de ortografía`
                        : 'Hay errores de ortografía'}
                </p>
                <p className="mt-3 text-[14.5px] leading-[1.6] font-medium text-black/55 dark:text-white/55">
                    Los encontramos en la descripción. Podés corregirlos ahora o guardar el grupo como está.
                </p>

                {cambiosDeTexto.length > 0 && (
                    <div className={`${T.interna} rounded-[20px] px-[18px] mt-[18px]`}>
                        {cambiosDeTexto.map((p, i) => (
                            <React.Fragment key={`${p.antes}-${i}`}>
                                {i > 0 && <div className="h-px bg-black/[.06] dark:bg-white/[.08]" />}
                                <div className="flex items-center gap-3 h-[52px]">
                                    <span className="flex-1 text-[14.5px] font-medium text-black/50 dark:text-white/50 line-through truncate">{p.antes}</span>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                                        strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-black/30 dark:text-white/30" aria-hidden="true">
                                        <path d="M5 12h13M13 7l5 5-5 5" />
                                    </svg>
                                    <span className="flex-1 text-right text-[14.5px] font-semibold truncate">{p.despues}</span>
                                </div>
                            </React.Fragment>
                        ))}
                    </div>
                )}

                <button
                    type="button"
                    onClick={ortografia.onCorregirYGuardar}
                    disabled={ortografia.corrigiendo}
                    className={`${btnPrimarioBase} w-full h-[58px] text-[16.5px] mt-5`}
                >
                    {ortografia.corrigiendo ? <><Loader2 className="w-5 h-5 animate-spin" /> Corrigiendo…</> : 'Corregir y guardar'}
                </button>
                <button
                    type="button"
                    onClick={ortografia.onGuardarIgual}
                    disabled={ortografia.corrigiendo}
                    className={`${btnSecundarioBase} w-full h-[56px] px-6 text-[16px] mt-2.5`}
                >
                    Guardar como está
                </button>
            </div>
        </div>,
        document.body
    );

    // ── Armado final ────────────────────────────────────────────────────
    // En escritorio el plegado se aplana: las cuatro secciones pasan a una
    // columna de navegación y sólo la elegida se muestra a la derecha. Nunca
    // hay que plegar ni desplegar, y el formulario mantiene una medida
    // legible en vez de estirarse a 1160px.
    const seccionVisible: Seccion = abierta ?? 'identidad';
    const siguienteSeccion = ORDEN[(ORDEN.indexOf(seccionVisible) + 1) % ORDEN.length];

    // Reabriendo, elegir la temporada es TODO lo que hace la pantalla: va en
    // su propia tarjeta, arriba, antes de lo que sólo se mira.
    const tarjetaTemporada = esReabrir && (
        <div className="bg-white dark:bg-[#1b1b1a] rounded-[26px] p-[18px] lg:rounded-[28px] lg:p-7">
            <p className="text-[19px] lg:text-[22px] font-semibold tracking-[-.01em]">
                ¿Para qué temporada lo reabrís?
            </p>
            <p className="mt-2 mb-[18px] text-[14px] leading-[1.6] font-medium text-black/50 dark:text-white/50">
                Se crea un grupo nuevo, sin miembros, con los datos de abajo — vienen
                copiados del grupo que terminó y podés ajustarlos antes de enviar. El grupo
                que terminó queda como está, con su historial.
            </p>
            {bloqueTemporada}
            {/* El botón queda apagado hasta que se elija otra temporada; sin
                esta línea no se entiende por qué. */}
            {cambios === 0 && (
                <p className="mt-3.5 px-1 text-[13px] leading-[1.55] font-medium text-black/45 dark:text-white/45">
                    Elegí una temporada distinta a la que el grupo ya tenía. Si ninguna está
                    abierta, esperá a que se habilite la próxima.
                </p>
            )}
        </div>
    );

    return (
        <form id="gcx-formulario" onSubmit={onGuardar} className={`min-h-screen ${T.fondo} ${T.fuente} ${T.tinta}`}>
            {encabezado}

            {angosto ? (
                <div className="max-w-[430px] mx-auto px-4 pt-4 pb-[124px] flex flex-col gap-3">
                    {aviso}
                    {tarjetaTemporada}
                    {esReabrir && (
                        <p className={`${rotulo} px-1.5 pt-2`}>Datos del grupo nuevo</p>
                    )}
                    {ORDEN.map(s => {
                        const desplegada = enTour || abierta === s;
                        const r = resumen(s);
                        return (
                            <div key={s} className="bg-white dark:bg-[#1b1b1a] rounded-[26px] p-[18px]">
                                <button
                                    type="button"
                                    onClick={() => setAbierta(abierta === s ? null : s)}
                                    aria-expanded={desplegada}
                                    className="w-full flex items-center gap-3.5 text-left"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className={rotulo}>{NOMBRE_SECCION[s]}</p>
                                        {/* Cerrada, la fila dice lo que hoy tiene el
                                            grupo: se verifica todo sin abrir nada. */}
                                        {!desplegada && (
                                            <>
                                                <p className={`mt-2 text-[16.5px] font-semibold truncate ${r.vacio ? 'text-black/35 dark:text-white/35' : ''}`}>
                                                    {r.titulo}
                                                </p>
                                                {r.detalle && (
                                                    <p className="mt-[5px] text-[13.5px] leading-[1.5] font-medium text-black/50 dark:text-white/50 truncate">
                                                        {r.detalle}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                    {!desplegada && s === 'identidad' && form.imageUrl && (
                                        <img src={form.imageUrl} alt="" className="w-14 h-14 shrink-0 rounded-[18px] object-cover" loading="lazy" />
                                    )}
                                    <Chevron abierto={desplegada} />
                                </button>
                                {desplegada && <div className="mt-4">{contenido(s)}</div>}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="max-w-[1160px] mx-auto px-8 pt-7 pb-10 grid grid-cols-[minmax(0,300px)_minmax(0,1fr)] gap-7 items-start">
                    <nav className="bg-white dark:bg-[#1b1b1a] rounded-[28px] p-4 sticky top-7 flex flex-col gap-1">
                        {ORDEN.map(s => {
                            const r = resumen(s);
                            const activa = seccionVisible === s;
                            return (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setAbierta(s)}
                                    aria-current={activa ? 'true' : undefined}
                                    className={`text-left rounded-[22px] px-4 py-3.5 transition-colors ${activa ? T.chip : 'hover:bg-black/[.03] dark:hover:bg-white/[.04]'}`}
                                >
                                    <p className="text-[15px] font-semibold">{NOMBRE_SECCION[s]}</p>
                                    <p className={`mt-1 text-[12.5px] font-medium truncate ${r.vacio ? 'text-black/35 dark:text-white/35' : 'text-black/50 dark:text-white/50'}`}>
                                        {r.titulo}
                                    </p>
                                </button>
                            );
                        })}
                    </nav>

                    <div className="min-w-0 flex flex-col gap-4">
                        {aviso}
                        {tarjetaTemporada}
                        <div className="bg-white dark:bg-[#1b1b1a] rounded-[28px] p-7">
                            <div className="flex items-baseline justify-between gap-4">
                                <h2 className="text-[24px] font-semibold tracking-[-.015em]">{NOMBRE_SECCION[seccionVisible]}</h2>
                                {esReabrir && <p className={rotulo}>Se copia del grupo actual · editable</p>}
                            </div>
                            <div className="mt-[22px]">{contenido(seccionVisible)}</div>

                            <div className="h-px bg-black/[.07] dark:bg-white/10 my-7" />
                            <div className="flex items-center gap-4">
                                <span className="flex-1 text-[13.5px] font-medium text-black/45 dark:text-white/45">
                                    {esReabrir
                                        ? 'Lo que ajustes acá va al grupo nuevo. El que terminó no se toca.'
                                        : 'Los cambios se guardan para las cuatro secciones a la vez.'}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setAbierta(siguienteSeccion)}
                                    className={`${btnSecundarioBase} h-[52px] px-[26px] text-[15.5px] shrink-0`}
                                >
                                    Ir a {NOMBRE_SECCION[siguienteSeccion].toLowerCase()}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* La píldora de guardar sólo aparece cuando hay algo para guardar,
                y dice cuánto. En escritorio vive en el encabezado. */}
            {angosto && (puedeGuardar || guardando || esCrear || esReabrir) && (
                <div className="fixed left-0 right-0 bottom-0 px-4 pt-3.5 pb-5 bg-gradient-to-t from-[#f6f6f4] from-[62%] to-transparent dark:from-[#111110]">
                    <div className="max-w-[430px] mx-auto">{botonGuardar}</div>
                </div>
            )}

            {hoja}
        </form>
    );
};

export default FormularioGrupo;

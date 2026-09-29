import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Minus, Plus } from 'lucide-react';
import { User, ServiceStatistic } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import {
    AREAS_VOLUNTARIOS, CAMPOS_MARTES, CAMPOS_NINEZ, CAMPOS_SEGUIMIENTO, CATEGORIAS,
    GRUPOS_DE_AREAS, TIPOS_DE_DOMINGO, aFecha, anioDe, fechaCorta, fmt, horarioDe,
} from './datosDeAudiencia';

/**
 * Cargar o editar un servicio — design-claude/Audiencia - Cargar Servicio.
 *
 * Tres pasos que responden tres preguntas en orden: qué servicio es, cuánta
 * gente vino y qué más hay que anotar. Los pasos siguen siendo los mismos que
 * antes; lo que cambia es cómo se cargan los números.
 *
 * Las áreas de voluntarios eran diecisiete casilleros numéricos en una grilla
 * de tres columnas, todos iguales. Ahora van agrupadas, con subtotal por grupo
 * y con − y + al costado: las áreas se cuentan de memoria y de a una, y en el
 * teléfono tocar un botón es más rápido y más difícil de errar que abrir el
 * teclado numérico diecisiete veces. Escribir el número sigue funcionando.
 *
 * Lo que NO cambió, porque de eso dependen los números históricos: el campo
 * grande es el auditorio COMPLETO —voluntarios incluidos— y al guardar se le
 * resta el total de voluntarios para obtener la columna `auditorio` de la base,
 * que siempre guardó el auditorio sin ellos.
 */

interface Props { currentUser: User | null; }

type FormData = Omit<ServiceStatistic, 'id'> & { id?: string };

const EMPTY_FORM: FormData = {
    name: '',
    service_date: '',
    service_time: 'AM',
    service_hour: '',
    category: '',
    service_type: '',
    observations: '',
    conecta: 0, store: 0, host_prevencion: 0, punto_info: 0, produccion: 0,
    equipo_ministracion: 0, atmosfera: 0, visuales: 0, redes: 0,
    sala_bienvenida: 0, sonido: 0, ea: 0, streaming: 0, camaras: 0,
    fotos: 0, profes_ninez: 0, auditorio: 0,
    ninos_3_6: 0, ninos_7_10: 0, ninos_hd: 0, borders: 0,
    online: 0, voluntarios_repetidos: 0, aceptaron: 0,
    asistieron_primera_vez: 0, reconciliaron: 0, podcast: 0, oracion: 0,
};

/**
 * Lo que "Martes" no mide. Se limpia al ELEGIR Martes a mano, por la misma
 * regla que al salir de Martes: nada queda guardado sin que nadie lo vea. Un
 * registro viejo de Martes que se abre para editar conserva lo que tenía,
 * porque ahí nadie cambió la categoría.
 */
const CAMPOS_QUE_MARTES_NO_MIDE: string[] = [
    ...AREAS_VOLUNTARIOS.map(f => f.key),
    ...CAMPOS_NINEZ.map(f => f.key),
    ...CAMPOS_SEGUIMIENTO.map(f => f.key),
    'online',
    'voluntarios_repetidos',
];

const PASOS = [
    { titulo: '1 · Servicio', vacio: 'Fecha y categoría' },
    { titulo: '2 · Asistencia', vacio: 'Auditorio y áreas' },
    { titulo: '3 · Otros datos', vacio: 'Online y notas' },
];

const rotulo = 'text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.55]';
const tarjeta = 'rounded-[20px] bg-white p-[18px] md:px-6 md:py-[22px]';

const AudienciaServiciosFormulario: React.FC<Props> = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const editRecord: any | undefined = (location.state as any)?.record;
    const isEdit = !!editRecord;

    /** El auditorio como se carga: todos los presentes, voluntarios incluidos. */
    const [totalAuditorio, setTotalAuditorio] = useState<number>(() => {
        if (!editRecord) return 0;
        const vols = AREAS_VOLUNTARIOS.reduce((a, f) => a + (Number(editRecord[f.key]) || 0), 0);
        return (Number(editRecord.auditorio) || 0) + vols;
    });

    const [paso, setPaso] = useState(0);
    const [form, setForm] = useState<FormData>(() => {
        if (!editRecord) return { ...EMPTY_FORM };
        const copia: any = { ...EMPTY_FORM };
        Object.keys(EMPTY_FORM).forEach(k => {
            if (editRecord[k] !== undefined && editRecord[k] !== null) copia[k] = editRecord[k];
        });
        copia.id = editRecord.id;
        copia.service_time = editRecord.service_time ?? 'AM';
        return copia as FormData;
    });

    const [guardado, setGuardado] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [errorGuardar, setErrorGuardar] = useState('');
    const [errorFecha, setErrorFecha] = useState('');
    const [aviso, setAviso] = useState('');

    /** Los servicios ya cargados, sólo para poder copiar las áreas del último igual. */
    const [previos, setPrevios] = useState<any[]>([]);
    useEffect(() => {
        let vivo = true;
        supabaseService.getServiceStatistics().then(d => { if (vivo) setPrevios(d); });
        return () => { vivo = false; };
    }, []);

    const esMartes = form.category === 'Martes';
    const pasos = esMartes ? [PASOS[0]] : PASOS;
    const ultimoPaso = pasos.length - 1;

    const setCampo = (key: string, value: string | number | any[]) => {
        setForm(prev => ({ ...prev, [key]: value } as FormData));
        if (key === 'service_date') setErrorFecha('');
    };

    const num = (v: any) => {
        const n = parseInt(String(v), 10);
        return isNaN(n) ? 0 : Math.max(0, n);
    };

    const totalVol = AREAS_VOLUNTARIOS.reduce((a, f) => a + num((form as any)[f.key]), 0);
    const ninez = CAMPOS_NINEZ.reduce((a, f) => a + num((form as any)[f.key]), 0);
    const online = num(form.online);
    const repetidos = num(form.voluntarios_repetidos);
    const volUnicos = Math.max(0, totalVol - repetidos);

    // El auditorio de la base es sin voluntarios; el presencial, todo junto.
    const auditorioSinVol = Math.max(0, totalAuditorio - totalVol);
    const presencial = auditorioSinVol + ninez + totalVol;
    const combinado = presencial + online;
    const baseVol = auditorioSinVol + ninez;
    const pctVol = baseVol > 0 ? Math.round((totalVol / baseVol) * 100) : 0;

    /**
     * Salir de "Martes" limpia sus dos métricas, y entrar a "Martes" limpia
     * todas las que Martes no muestra: si no, quedan guardadas sin que nadie
     * las vea en pantalla. Se limpian sólo cuando la persona cambia la
     * categoría a mano, para no pisar lo que ya tenía un registro viejo.
     */
    const setCategoria = (value: string) => {
        const entraAMartes = value === 'Martes' && form.category !== 'Martes';
        const saleDeMartes = form.category === 'Martes' && value !== 'Martes';
        setForm(prev => ({
            ...prev,
            category: value,
            ...(saleDeMartes ? { podcast: 0, oracion: 0 } : {}),
            ...(entraAMartes ? Object.fromEntries(CAMPOS_QUE_MARTES_NO_MIDE.map(k => [k, 0])) : {}),
            ...(value !== 'Servicio de Domingo' ? { service_type: '' } : {}),
        } as FormData));
        if (entraAMartes) {
            setTotalAuditorio(0);
            setPaso(0);
            setAviso('Los martes se cargan distinto: sólo podcast, oración y observaciones. Lo demás se guarda en cero.');
        }
        if (saleDeMartes) setAviso('');
    };

    const ok1 = !!form.service_date && !!form.category;
    const ok2 = esMartes || totalAuditorio > 0;
    const puedeSeguir = paso === 0 ? ok1 : paso === 1 ? ok2 : true;

    const irAlPaso = (n: number) => {
        if (guardado || n > ultimoPaso) return;
        if (n === 0 || (n === 1 && ok1) || (n === 2 && ok1 && ok2)) setPaso(n);
    };

    const siguiente = () => {
        if (paso === 0 && !form.service_date) {
            setErrorFecha('Sin la fecha no se puede guardar el servicio.');
            return;
        }
        if (!puedeSeguir) return;
        if (paso < ultimoPaso) { setAviso(''); setPaso(p => p + 1); }
        else guardar();
    };

    const guardar = async () => {
        if (!form.service_date) {
            setErrorFecha('Sin la fecha no se puede guardar el servicio.');
            setPaso(0);
            return;
        }
        setGuardando(true);
        setErrorGuardar('');
        const payload = { ...form, auditorio: auditorioSinVol };
        const { data, error } = await supabaseService.upsertServiceStatistic(payload);
        setGuardando(false);
        if (error || !data) {
            setErrorGuardar(error || 'No pudimos guardar el servicio. Probá de nuevo en un momento.');
            return;
        }
        setGuardado(true);
    };

    /** Copia las áreas del último servicio de la misma categoría. */
    const ultimoIgual = useMemo(() => {
        if (!form.category) return null;
        const candidatos = previos
            .filter(r => (r.category || '') === form.category && String(r.id) !== String(form.id))
            .sort((a, b) => aFecha(b.service_date).getTime() - aFecha(a.service_date).getTime());
        return candidatos[0] || null;
    }, [previos, form.category, form.id]);

    const copiarAreas = useCallback(() => {
        if (!ultimoIgual) return;
        setForm(prev => {
            const copia: any = { ...prev };
            AREAS_VOLUNTARIOS.forEach(f => { copia[f.key] = Number(ultimoIgual[f.key]) || 0; });
            return copia as FormData;
        });
        setAviso(`Copiamos las áreas del ${fechaCorta(ultimoIgual.service_date)}. Revisá y corregí lo que cambió.`);
    }, [ultimoIgual]);

    // ── Pantalla de guardado ──
    if (guardado) {
        return (
            <div id="audiencia-servicios" className="min-h-screen bg-[#f6f6f4] px-4 py-16">
                <div className="mx-auto flex max-w-[460px] flex-col items-center rounded-[20px] bg-white px-6 py-10 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eaf6ee]">
                        <Check className="h-7 w-7 text-[#12783f]" strokeWidth={2.6} />
                    </div>
                    <p className="mt-[18px] text-[19px] font-semibold text-[#0a0a0a]">
                        {isEdit ? 'Cambios guardados' : 'Servicio guardado'}
                    </p>
                    <p className="mt-2 text-[13.5px] font-medium leading-[1.6] text-black/[.62]">
                        {fechaCorta(form.service_date)}
                        {form.service_hour ? ` · ${form.service_hour}` : ` · ${form.service_time}`}
                        {' · '}{fmt(combinado)} personas en total
                    </p>
                    <div className="mt-[22px] flex flex-wrap justify-center gap-2.5">
                        <button
                            onClick={() => navigate('/audiencia-servicios')}
                            className="h-12 rounded-full bg-[#0a0a0a] px-[22px] text-[14.5px] font-semibold text-white transition-colors hover:bg-[#242424]"
                        >
                            Volver a la planilla
                        </button>
                        {!isEdit && (
                            <button
                                onClick={() => {
                                    setForm({ ...EMPTY_FORM });
                                    setTotalAuditorio(0);
                                    setPaso(0);
                                    setGuardado(false);
                                    setAviso('');
                                }}
                                className="h-12 rounded-full bg-[#f2f2f0] px-[22px] text-[14.5px] font-semibold text-[#0a0a0a] transition-colors hover:bg-[#e6e5e1]"
                            >
                                Cargar otro servicio
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    /** Un casillero de área: − número +. */
    const Contador: React.FC<{ etiqueta: string; campo: string }> = ({ etiqueta, campo }) => {
        const valor = (form as any)[campo];
        const lleno = num(valor) > 0;
        return (
            <div className="flex items-center gap-2.5 border-b border-[#f2f2f0] py-2">
                <span
                    className="min-w-0 flex-1 truncate text-[14px] font-semibold"
                    style={{ color: lleno ? '#0a0a0a' : 'rgba(0,0,0,.6)' }}
                    title={etiqueta}
                >
                    {etiqueta}
                </span>
                <button
                    type="button"
                    onClick={() => setCampo(campo, Math.max(0, num(valor) - 1))}
                    aria-label={`Restar uno a ${etiqueta}`}
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[#0a0a0a] transition-colors hover:bg-[#e6e5e1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    <Minus className="h-3.5 w-3.5" strokeWidth={2.6} />
                </button>
                <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label={etiqueta}
                    value={num(valor) === 0 ? '' : num(valor)}
                    placeholder="0"
                    onFocus={e => e.currentTarget.select()}
                    onChange={e => setCampo(campo, num(e.target.value))}
                    className={`campo-area h-10 w-[58px] flex-none ${lleno ? 'campo-area-lleno' : ''}`}
                />
                <button
                    type="button"
                    onClick={() => setCampo(campo, num(valor) + 1)}
                    aria-label={`Sumar uno a ${etiqueta}`}
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#0a0a0a] text-white transition-colors hover:bg-[#242424] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
                </button>
            </div>
        );
    };

    /** Un número suelto con su rótulo, para niñez y seguimiento. */
    const Numero: React.FC<{ etiqueta: string; campo: string }> = ({ etiqueta, campo }) => (
        <div>
            <label className="mb-1.5 block text-[12px] font-semibold text-black/[.55]">{etiqueta}</label>
            <input
                type="number"
                inputMode="numeric"
                min={0}
                value={num((form as any)[campo]) === 0 ? '' : num((form as any)[campo])}
                placeholder="0"
                onFocus={e => e.currentTarget.select()}
                onChange={e => setCampo(campo, num(e.target.value))}
                className="h-[46px] w-full px-4 text-[15px] font-semibold"
            />
        </div>
    );

    return (
        <div id="audiencia-servicios" className="min-h-screen bg-[#f6f6f4] pb-[104px]">

            {/* ── Encabezado ── */}
            <div className="border-b border-[#ecebe8] bg-white">
                <div className="mx-auto max-w-[1160px] px-4 pb-4 pt-3.5 md:px-7 md:pb-[18px] md:pt-[18px]">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/audiencia-servicios')}
                            className="flex h-[38px] flex-none items-center gap-1.5 rounded-full bg-[#f2f2f0] pl-2.5 pr-3.5 text-[12.5px] font-semibold text-[#0a0a0a] transition-colors hover:bg-[#e6e5e1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            <ArrowLeft className="h-[15px] w-[15px]" strokeWidth={2.3} />
                            <span className="hidden sm:inline">Volver a la planilla</span>
                            <span className="sm:hidden">Planilla</span>
                        </button>
                        {isEdit && (
                            <span className="ml-auto flex h-7 flex-none items-center rounded-full bg-[#eaf0fc] px-3 text-[11.5px] font-semibold text-[#1d4ed8]">
                                Editando un registro guardado
                            </span>
                        )}
                    </div>

                    <p className={`mt-4 ${rotulo}`}>Audiencia de Servicios</p>
                    <h1 className="mt-[5px] text-[21px] font-semibold tracking-[-0.02em] text-[#0a0a0a] md:text-[24px]">
                        {isEdit
                            ? `Editar ${fechaCorta(form.service_date)}${form.service_hour ? ` · ${form.service_hour}` : ''}`
                            : 'Cargar servicio'}
                    </h1>

                    {/* Los pasos: barra, título y un resumen de lo que ya tiene cada uno. */}
                    <div
                        className="mt-4 grid gap-2"
                        style={{ gridTemplateColumns: `repeat(${pasos.length}, minmax(0,1fr))` }}
                    >
                        {pasos.map((p, i) => {
                            const actual = paso === i;
                            const listo = i === 0 ? ok1 : i === 1 ? ok2 : online > 0 || !!form.observations;
                            const resumen = i === 0
                                ? (ok1 ? `${fechaCorta(form.service_date)} · ${form.category}` : p.vacio)
                                : i === 1
                                    ? (totalAuditorio > 0 ? `${fmt(totalAuditorio)} · ${fmt(totalVol)} voluntarios` : p.vacio)
                                    : (online > 0 ? `${fmt(online)} online` : p.vacio);
                            return (
                                <button
                                    key={p.titulo}
                                    type="button"
                                    onClick={() => irAlPaso(i)}
                                    className="min-w-0 text-left"
                                >
                                    <span
                                        className="block h-[5px] rounded-full"
                                        style={{ background: actual ? '#0a0a0a' : listo ? '#2563eb' : '#e6e5e1' }}
                                    />
                                    <span
                                        className="mt-2 block truncate text-[12.5px] font-semibold"
                                        style={{ color: actual ? '#0a0a0a' : 'rgba(0,0,0,.6)' }}
                                    >
                                        {esMartes ? 'Martes' : p.titulo}
                                    </span>
                                    <span className="mt-0.5 block truncate text-[11.5px] font-medium text-black/[.55]">
                                        {resumen}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Cuerpo ── */}
            <div className="mx-auto max-w-[1160px] px-4 pt-3.5 md:px-7 md:pt-[22px]">
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">

                    <div className="min-w-0">

                        {aviso && (
                            <div className="mb-3 flex items-start gap-3 rounded-2xl bg-[#fdf3e3] px-4 py-3.5">
                                <p className="flex-1 text-[13px] font-medium leading-[1.55] text-[#5c3b0b]">{aviso}</p>
                                <button
                                    onClick={() => setAviso('')}
                                    className="h-8 flex-none rounded-full bg-white px-3 text-[12px] font-semibold text-[#0a0a0a]"
                                >
                                    Entendido
                                </button>
                            </div>
                        )}

                        {/* ── Paso 1 ── */}
                        {paso === 0 && (
                            <div className={tarjeta}>
                                <p className="text-[17px] font-semibold text-[#0a0a0a]">¿Qué servicio vas a cargar?</p>

                                <p className={`mb-2 mt-5 ${rotulo}`}>Fecha</p>
                                <input
                                    type="date"
                                    value={form.service_date}
                                    onChange={e => setCampo('service_date', e.target.value)}
                                    className="h-[50px] w-full max-w-[280px] px-4 text-[15px] font-semibold"
                                />
                                {errorFecha && (
                                    <p className="mt-2 text-[12.5px] font-semibold text-[#a32218]">{errorFecha}</p>
                                )}

                                <p className={`mb-2 mt-[22px] ${rotulo}`}>Categoría</p>
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                                    {CATEGORIAS.map(c => {
                                        const on = form.category === c.nombre;
                                        return (
                                            <button
                                                key={c.nombre}
                                                type="button"
                                                onClick={() => setCategoria(c.nombre)}
                                                className={`min-h-[74px] rounded-2xl px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${on ? 'bg-[#0a0a0a]' : 'bg-[#f2f2f0] hover:bg-[#e9e8e5]'}`}
                                            >
                                                <span className={`block text-[14.5px] font-semibold ${on ? 'text-white' : 'text-[#0a0a0a]'}`}>
                                                    {c.nombre}
                                                </span>
                                                <span className={`mt-1 block text-[12px] font-medium ${on ? 'text-white/70' : 'text-black/[.55]'}`}>
                                                    {c.detalle}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <p className={`mb-2 mt-[22px] ${rotulo}`}>Horario</p>
                                <div className="flex flex-wrap items-center gap-2.5">
                                    <input
                                        type="time"
                                        value={form.service_hour ?? ''}
                                        onChange={e => setCampo('service_hour', e.target.value)}
                                        className="h-[50px] w-[150px] flex-none px-4 text-[15px] font-semibold"
                                    />
                                    <div className="flex gap-2">
                                        {(['AM', 'PM'] as const).map(t => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setCampo('service_time', t)}
                                                className={`h-[50px] w-[78px] rounded-2xl text-[14px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${form.service_time === t ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-[#0a0a0a] hover:bg-[#e9e8e5]'}`}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <p className={`mb-2 mt-[22px] ${rotulo}`}>Nombre · opcional</p>
                                <input
                                    type="text"
                                    value={form.name ?? ''}
                                    placeholder="Ej: Conferencia de mujeres"
                                    onChange={e => setCampo('name', e.target.value)}
                                    className="h-[50px] w-full px-4 text-[15px] font-semibold"
                                />

                                {form.category === 'Servicio de Domingo' && (
                                    <>
                                        <p className={`mb-2 mt-[22px] ${rotulo}`}>Tipo de servicio · opcional</p>
                                        <div className="flex flex-wrap gap-2">
                                            {TIPOS_DE_DOMINGO.map(t => {
                                                const on = form.service_type === t;
                                                return (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => setCampo('service_type', on ? '' : t)}
                                                        className={`h-10 rounded-full px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${on ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-[#0a0a0a] hover:bg-[#e9e8e5]'}`}
                                                    >
                                                        {t}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}

                                {/* Martes entra acá: son tres campos, no justifican dos pasos más. */}
                                {esMartes && (
                                    <>
                                        <div className="mt-7 border-t border-[#f2f2f0] pt-6">
                                            <p className="text-[17px] font-semibold text-[#0a0a0a]">Métricas del martes</p>
                                            <p className="mt-1 text-[13px] font-medium text-black/[.6]">
                                                Los martes no se cargan voluntarios, niñez ni online.
                                            </p>
                                            <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                                                {CAMPOS_MARTES.map(f => (
                                                    <Numero key={f.key} etiqueta={f.label} campo={f.key} />
                                                ))}
                                            </div>
                                        </div>

                                        <p className={`mb-2 mt-[22px] ${rotulo}`}>Observaciones · opcional</p>
                                        <textarea
                                            rows={4}
                                            value={form.observations ?? ''}
                                            onChange={e => setCampo('observations', e.target.value)}
                                            placeholder="Algo que explique los números."
                                            className="w-full resize-y px-4 py-3.5 text-[14px] font-medium leading-[1.6]"
                                        />
                                    </>
                                )}
                            </div>
                        )}

                        {/* ── Paso 2 ── */}
                        {paso === 1 && !esMartes && (
                            <>
                                <div className={tarjeta}>
                                    <p className="text-[17px] font-semibold text-[#0a0a0a]">¿Cuánta gente vino?</p>
                                    <p className="mt-1.5 text-[13px] font-medium leading-[1.55] text-black/[.6]">
                                        Contá a todos los que estaban en el auditorio, voluntarios incluidos.
                                    </p>
                                    <div className="mt-4 flex items-center gap-2.5">
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            min={0}
                                            aria-label="Personas en el auditorio"
                                            value={totalAuditorio === 0 ? '' : totalAuditorio}
                                            placeholder="0"
                                            onFocus={e => e.currentTarget.select()}
                                            onChange={e => setTotalAuditorio(num(e.target.value))}
                                            className="campo-auditorio h-[62px] w-[170px] flex-none px-5 text-[28px] font-semibold tracking-[-0.02em]"
                                        />
                                        <span className="text-[13px] font-semibold text-black/[.6]">
                                            personas en el auditorio
                                        </span>
                                    </div>
                                    {totalAuditorio > 0 && totalAuditorio < totalVol && (
                                        <p className="mt-3 rounded-2xl bg-[#fdf3e3] px-4 py-3 text-[12.5px] font-medium leading-[1.55] text-[#5c3b0b]">
                                            Cargaste {fmt(totalVol)} voluntarios pero {fmt(totalAuditorio)} en el auditorio.
                                            El auditorio va con los voluntarios adentro, así que ese número tendría
                                            que ser al menos {fmt(totalVol)}.
                                        </p>
                                    )}
                                </div>

                                <div className={`${tarjeta} mt-3`}>
                                    <div className="flex flex-wrap items-start gap-3">
                                        <div className="min-w-[180px] flex-1">
                                            <p className="text-[17px] font-semibold text-[#0a0a0a]">Voluntarios por área</p>
                                            <p className="mt-1.5 text-[13px] font-medium leading-[1.55] text-black/[.6]">
                                                {AREAS_VOLUNTARIOS.length} áreas. Tocá + por cada persona o escribí el número.
                                            </p>
                                        </div>
                                        {ultimoIgual && (
                                            <button
                                                type="button"
                                                onClick={copiarAreas}
                                                className="h-10 flex-none rounded-full bg-[#f2f2f0] px-4 text-[12.5px] font-semibold text-[#0a0a0a] transition-colors hover:bg-[#e6e5e1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                            >
                                                Copiar del {fechaCorta(ultimoIgual.service_date)}
                                            </button>
                                        )}
                                    </div>

                                    {GRUPOS_DE_AREAS.map(g => {
                                        const subtotal = g.items.reduce((a, f) => a + num((form as any)[f.key]), 0);
                                        return (
                                            <div key={g.titulo} className="mt-5">
                                                <div className="mb-1.5 flex items-baseline justify-between gap-2.5">
                                                    <p className={rotulo}>{g.titulo}</p>
                                                    <span className="text-[12px] font-semibold text-black/[.55]">
                                                        {subtotal} {subtotal === 1 ? 'persona' : 'personas'}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
                                                    {g.items.map(f => (
                                                        <Contador key={f.key} etiqueta={f.label} campo={f.key} />
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <div className="mt-5 flex items-baseline justify-between gap-2.5 border-t border-[#f2f2f0] pt-4">
                                        <span className="text-[13px] font-semibold text-[#0a0a0a]">Total de voluntarios</span>
                                        <span className="text-[18px] font-semibold text-[#0a0a0a]">{fmt(totalVol)}</span>
                                    </div>
                                </div>

                                <div className={`${tarjeta} mt-3`}>
                                    <p className="text-[17px] font-semibold text-[#0a0a0a]">Niñez</p>
                                    <p className="mt-1.5 text-[13px] font-medium leading-[1.55] text-black/[.6]">
                                        Los chicos que estuvieron en sus salas. Los profes ya van arriba, como
                                        voluntarios.
                                    </p>
                                    <div className="mt-4 grid grid-cols-2 gap-3.5 md:grid-cols-4">
                                        {CAMPOS_NINEZ.map(f => (
                                            <Numero key={f.key} etiqueta={f.label} campo={f.key} />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── Paso 3 ── */}
                        {paso === 2 && !esMartes && (
                            <>
                                <div className={tarjeta}>
                                    <p className="text-[17px] font-semibold text-[#0a0a0a]">Lo que falta</p>

                                    <div className="mt-4 grid grid-cols-1 gap-3.5 md:grid-cols-2">
                                        <div>
                                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#6d4fc8]">
                                                Asistencia online
                                            </p>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min={0}
                                                aria-label="Asistencia online"
                                                value={online === 0 ? '' : online}
                                                placeholder="0"
                                                onFocus={e => e.currentTarget.select()}
                                                onChange={e => setCampo('online', num(e.target.value))}
                                                className="campo-online h-[56px] w-full px-4 text-[22px] font-semibold"
                                            />
                                            <p className="mt-2 text-[12px] font-medium leading-[1.5] text-black/[.55]">
                                                Pico de conexiones del streaming.
                                            </p>
                                        </div>
                                        <div>
                                            <p className={`mb-2 ${rotulo}`}>Voluntarios repetidos</p>
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                min={0}
                                                aria-label="Voluntarios repetidos"
                                                value={repetidos === 0 ? '' : repetidos}
                                                placeholder="0"
                                                onFocus={e => e.currentTarget.select()}
                                                onChange={e => setCampo('voluntarios_repetidos', num(e.target.value))}
                                                className="h-[56px] w-full px-4 text-[22px] font-semibold"
                                            />
                                            <p className="mt-2 text-[12px] font-medium leading-[1.5] text-black/[.55]">
                                                Personas que sirvieron en dos áreas. Se usan para contar voluntarios
                                                distintos, sin tocar el total cargado.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-6 border-t border-[#f2f2f0] pt-5">
                                        <p className={rotulo}>Seguimiento</p>
                                        <div className="mt-3 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                                            {CAMPOS_SEGUIMIENTO.map(f => (
                                                <Numero key={f.key} etiqueta={f.label} campo={f.key} />
                                            ))}
                                        </div>
                                    </div>

                                    <p className={`mb-2 mt-6 ${rotulo}`}>Observaciones · opcional</p>
                                    <textarea
                                        rows={4}
                                        value={form.observations ?? ''}
                                        onChange={e => setCampo('observations', e.target.value)}
                                        placeholder="Algo que explique los números: lluvia, bautismos, un corte del streaming…"
                                        className="w-full resize-y px-4 py-3.5 text-[14px] font-medium leading-[1.6]"
                                    />
                                </div>
                            </>
                        )}

                        {errorGuardar && (
                            <div className="mt-3 rounded-2xl bg-[#fdecea] px-4 py-3.5">
                                <p className="text-[13px] font-semibold leading-[1.55] text-[#a32218]">{errorGuardar}</p>
                            </div>
                        )}
                    </div>

                    {/* ── Así queda (sólo escritorio) ── */}
                    <div className="sticky top-4 hidden rounded-[14px] border border-[#e8e9ec] bg-white px-5 py-[18px] lg:block">
                        <p className={rotulo}>Así queda</p>
                        <p className="mt-2.5 text-[15px] font-semibold text-[#0f172a]">
                            {form.service_date
                                ? `${fechaCorta(form.service_date)}${form.service_hour ? ` · ${form.service_hour}` : ` · ${form.service_time}`}`
                                : 'Servicio sin elegir'}
                        </p>
                        <p className="mt-0.5 text-[12.5px] font-medium text-[#6b7280]">
                            {form.category || 'Categoría pendiente'}
                        </p>

                        <p className="mt-[18px] text-[12px] font-semibold text-[#6b7280]">Total con online</p>
                        <p className="mt-1 text-[32px] font-semibold leading-none tracking-[-0.03em] text-[#0f172a]">
                            {combinado > 0 ? fmt(combinado) : '—'}
                        </p>
                        <div className="mt-2.5 flex h-2.5 overflow-hidden rounded-full bg-[#f2f3f5]">
                            <span
                                className="block bg-[#2563eb]"
                                style={{ width: `${combinado > 0 ? (presencial / combinado) * 100 : 0}%` }}
                            />
                            <span
                                className="block bg-[#a48ce8]"
                                style={{ width: `${combinado > 0 ? (online / combinado) * 100 : 0}%` }}
                            />
                        </div>
                        <div className="mt-[7px] flex justify-between">
                            <span className="text-[12px] font-semibold text-[#1d4ed8]">{fmt(presencial)} presencial</span>
                            <span className="text-[12px] font-semibold text-[#6d4fc8]">{fmt(online)} online</span>
                        </div>

                        <div className="my-[18px] h-px bg-[#eef0f3]" />

                        <div className="flex items-baseline justify-between">
                            <span className="text-[12px] font-semibold text-[#6b7280]">Voluntarios distintos</span>
                            <span className="text-[18px] font-semibold text-[#0f172a]">{fmt(volUnicos)}</span>
                        </div>
                        <p className="mt-1 text-[12px] font-medium text-[#6b7280]">
                            {fmt(totalVol)} cargados{repetidos > 0 ? ` − ${fmt(repetidos)} repetidos` : ''}
                        </p>
                        <div className="mt-3 flex items-center gap-2.5">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#f0efec]">
                                <div className="h-full bg-[#0a0a0a]" style={{ width: `${Math.min(100, pctVol * 4)}%` }} />
                            </div>
                            <span className="text-[13px] font-bold text-[#0a0a0a]">{pctVol}%</span>
                        </div>
                        <p className="mt-1.5 text-[12px] font-medium text-[#6b7280]">del auditorio sirvió ese día</p>

                        {ninez > 0 && (
                            <p className="mt-3 text-[12px] font-medium text-[#6b7280]">
                                Incluye {fmt(ninez)} en niñez.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Pie con la navegación ── */}
            <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#ecebe8] bg-white px-4 pb-4 pt-3 md:px-7 md:py-3.5">
                <div className="mx-auto max-w-[1160px]">
                    <div className="mb-2.5 flex items-center justify-between gap-2.5 lg:hidden">
                        <span className="truncate text-[12.5px] font-semibold text-[#0a0a0a]">
                            {combinado > 0
                                ? `${fmt(combinado)} en total · ${fmt(volUnicos)} voluntarios`
                                : (paso === 0 && ok1 ? `${fechaCorta(form.service_date)} · ${form.category}` : 'Todavía sin números')}
                        </span>
                        {!esMartes && (
                            <span className="flex-none text-[12px] font-semibold text-black/[.55]">{pctVol}% voluntarios</span>
                        )}
                    </div>
                    <div className="flex justify-stretch gap-2 lg:justify-end">
                        {paso > 0 && (
                            <button
                                onClick={() => { setAviso(''); setPaso(p => Math.max(0, p - 1)); }}
                                className="h-[52px] flex-1 rounded-full bg-[#f2f2f0] px-[22px] text-[15px] font-semibold text-[#0a0a0a] transition-colors hover:bg-[#e6e5e1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 lg:flex-none"
                            >
                                Atrás
                            </button>
                        )}
                        <button
                            onClick={siguiente}
                            disabled={!puedeSeguir || guardando}
                            className="flex h-[52px] flex-[2] items-center justify-center gap-2 rounded-full px-7 text-[15px] font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 lg:flex-none"
                            style={{ background: puedeSeguir && !guardando ? '#0a0a0a' : '#c9c8c4' }}
                        >
                            {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
                            {guardando
                                ? 'Guardando…'
                                : paso === 0 && !esMartes
                                    ? 'Siguiente: asistencia'
                                    : paso === 1
                                        ? 'Siguiente: otros datos'
                                        : isEdit ? 'Guardar los cambios' : 'Guardar servicio'}
                        </button>
                    </div>
                    {!puedeSeguir && !guardando && (
                        <p className="mt-2 text-center text-[12px] font-medium text-black/[.55] lg:text-right">
                            {paso === 0
                                ? 'Falta la fecha y la categoría.'
                                : 'Falta cuánta gente había en el auditorio.'}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AudienciaServiciosFormulario;

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { User, ServiceStatistic } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { ChevronLeft, ChevronRight, Check, ArrowLeft, Calendar, User as UserIcon, Heart, Loader2 } from 'lucide-react';

interface PastoralCareFormProps { currentUser: User | null; }

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

interface FieldDef { key: keyof FormData; label: string; }

const STEP1_METRICS: FieldDef[] = [
    { key: 'conecta', label: 'Conecta' }, { key: 'store', label: 'Store' },
    { key: 'host_prevencion', label: 'Host + Prevención' }, { key: 'punto_info', label: 'Punto de Información' },
    { key: 'produccion', label: 'Producción' }, { key: 'equipo_ministracion', label: 'Equipo de Ministración' },
    { key: 'atmosfera', label: 'Atmosfera' }, { key: 'visuales', label: 'Visuales' },
    { key: 'redes', label: 'Redes' }, { key: 'sala_bienvenida', label: 'Sala de Bienvenida' },
    { key: 'sonido', label: 'Sonido' }, { key: 'ea', label: 'EA' },
    { key: 'streaming', label: 'Streaming' }, { key: 'camaras', label: 'Cámaras' },
    { key: 'fotos', label: 'Fotos' }, { key: 'profes_ninez', label: 'Profes Niñez' },
    { key: 'auditorio', label: 'Auditorio' },
];

const STEP2_FIELDS: FieldDef[] = [
    { key: 'ninos_3_6', label: 'Niños 3 a 6' }, { key: 'ninos_7_10', label: 'Niños 7 a 10' },
    { key: 'ninos_hd', label: 'Niños HD' }, { key: 'borders', label: 'Borders' },
];

const STEP3_FIELDS: FieldDef[] = [
    { key: 'online', label: 'Online' }, { key: 'voluntarios_repetidos', label: 'Voluntarios Repetidos' },
    { key: 'aceptaron', label: 'Aceptaron' }, { key: 'asistieron_primera_vez', label: 'Asistieron por Primera Vez' },
    { key: 'reconciliaron', label: 'Reconciliaron' }, { key: 'podcast', label: 'Podcast' },
    { key: 'oracion', label: 'Oración' },
];

const STEPS = [
    { title: 'Áreas de Servicio', subtitle: 'Voluntarios del servicio', icon: UserIcon },
    { title: 'Niñez', subtitle: 'Asistencia de niños', icon: Heart },
    { title: 'Seguimiento', subtitle: 'Métricas generales', icon: Calendar },
];

const CATEGORIES = ['Servicio de Domingo', 'CXV', 'Evento', 'Conferencia', 'Oración Martes'];

const SUNDAY_SERVICE_TYPES = [
    'Tradicional',
    'Invitado',
    'Día de la Madre',
    'Día del Padre',
    'Día del Niño',
    'Bautismos',
    'Semana Santa',
    'Servicio de Milagros',
    'Navidad',
    'Año Nuevo',
    'Acción de Gracias',
];

const inputCls = 'w-full p-3 bg-white border border-slate-300 rounded-lg outline-none font-bold placeholder-slate-400 focus:border-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 transition-all text-black text-base appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const selectCls = 'w-full p-3 bg-white border border-slate-300 rounded-lg outline-none font-bold text-black text-base focus:border-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 transition-all cursor-pointer';

const NumericInput: React.FC<{
    label: string;
    value: number;
    onChange: (v: number) => void;
    max?: number;
    error?: string;
}> = ({ label, value, onChange, max, error }) => (
    <div>
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            {label}
        </label>
        <input
            type="number"
            min={0}
            max={max}
            value={value === 0 ? '' : value}
            placeholder="0"
            onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                const clamped = max ? Math.min(max, Math.max(0, isNaN(n) ? 0 : n)) : Math.max(0, isNaN(n) ? 0 : n);
                onChange(clamped);
            }}
            className={`${inputCls} ${error ? 'border-red-500' : ''}`}
        />
        {error && <p className="text-red-600 text-xs font-bold mt-1">{error}</p>}
    </div>
);

const PastoralCareForm: React.FC<PastoralCareFormProps> = ({ currentUser }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const editRecord: any | undefined = (location.state as any)?.record;
    const isEdit = !!editRecord;

    const [totalAuditorioInput, setTotalAuditorioInput] = useState<number>(() => {
        if (editRecord) {
            const volunteerKeys = [
                'conecta', 'store', 'host_prevencion', 'punto_info',
                'produccion', 'equipo_ministracion', 'atmosfera', 'visuales',
                'redes', 'sala_bienvenida', 'sonido', 'ea',
                'streaming', 'camaras', 'fotos', 'profes_ninez'
            ];
            const totalVols = volunteerKeys.reduce((acc, k) => acc + (Number(editRecord[k]) || 0), 0);
            return (Number(editRecord.auditorio) || 0) + totalVols;
        }
        return 0;
    });

    const [step, setStep] = useState(0);
    const [form, setForm] = useState<FormData>(() => {
        if (editRecord) {
            return {
                id: editRecord.id,
                name: editRecord.name ?? '',
                service_date: editRecord.service_date ?? '',
                service_time: editRecord.service_time ?? 'AM',
                service_hour: editRecord.service_hour ?? '',
                category: editRecord.category ?? '',
                service_type: editRecord.service_type ?? '',
                observations: editRecord.observations ?? '',
                conecta: editRecord.conecta ?? 0, store: editRecord.store ?? 0,
                host_prevencion: editRecord.host_prevencion ?? 0, punto_info: editRecord.punto_info ?? 0,
                produccion: editRecord.produccion ?? 0, equipo_ministracion: editRecord.equipo_ministracion ?? 0,
                atmosfera: editRecord.atmosfera ?? 0, visuales: editRecord.visuales ?? 0,
                redes: editRecord.redes ?? 0, sala_bienvenida: editRecord.sala_bienvenida ?? 0,
                sonido: editRecord.sonido ?? 0, ea: editRecord.ea ?? 0,
                streaming: editRecord.streaming ?? 0, camaras: editRecord.camaras ?? 0,
                fotos: editRecord.fotos ?? 0, profes_ninez: editRecord.profes_ninez ?? 0,
                auditorio: editRecord.auditorio ?? 0,
                ninos_3_6: editRecord.ninos_3_6 ?? 0, ninos_7_10: editRecord.ninos_7_10 ?? 0,
                ninos_hd: editRecord.ninos_hd ?? 0, borders: editRecord.borders ?? 0,
                online: editRecord.online ?? 0, voluntarios_repetidos: editRecord.voluntarios_repetidos ?? 0,
                aceptaron: editRecord.aceptaron ?? 0, asistieron_primera_vez: editRecord.asistieron_primera_vez ?? 0,
                reconciliaron: editRecord.reconciliaron ?? 0, podcast: editRecord.podcast ?? 0,
                oracion: editRecord.oracion ?? 0,
            };
        }
        return { ...EMPTY_FORM };
    });
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [dateError, setDateError] = useState('');

    // --- LÓGICA CRÍTICA: resetear service_type si la categoría cambia a algo distinto de "Servicio de Domingo" ---
    useEffect(() => {
        if (form.category !== 'Servicio de Domingo') {
            setForm(prev => ({ ...prev, service_type: '' }));
        }
    }, [form.category]);

    const setField = (key: keyof FormData, value: string | number | any[]) => {
        setForm(prev => ({ ...prev, [key]: value }));
        if (key === 'service_date') setDateError('');
    };

    // Limpiar error de fecha cuando se completa el campo
    useEffect(() => {
        if (form.service_date) setDateError('');
    }, [form.service_date]);


    const validateStep = (): boolean => {
        if (step === 0 && !form.service_date) {
            setDateError('La fecha del servicio es requerida.');
            return false;
        }
        return true;
    };

    const nextStep = () => { if (!validateStep()) return; setStep(s => Math.min(s + 1, 2)); };
    const prevStep = () => setStep(s => Math.max(s - 1, 0));

    const handleSubmit = async () => {
        if (!validateStep()) return;
        setSaving(true);
        setSaveError('');

        const volunteerKeys: (keyof FormData)[] = [
            'conecta', 'store', 'host_prevencion', 'punto_info',
            'produccion', 'equipo_ministracion', 'atmosfera', 'visuales',
            'redes', 'sala_bienvenida', 'sonido', 'ea',
            'streaming', 'camaras', 'fotos', 'profes_ninez'
        ];
        const totalVols = volunteerKeys.reduce((acc, k) => acc + (Number(form[k]) || 0), 0);
        const auditorioCalculado = Math.max(0, totalAuditorioInput - totalVols);

        const payloadToSave = { ...form, auditorio: auditorioCalculado };

        const { data, error } = await supabaseService.upsertServiceStatistic(payloadToSave);
        setSaving(false);
        if (error || !data) {
            setSaveError(error || 'Error al guardar. Verificá que la tabla service_statistics exista en Supabase.');
            return;
        }
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
                <div className="text-center max-w-sm w-full">
                    <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Check className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tight mb-3">
                        {isEdit ? '¡Registro actualizado!' : '¡Registro guardado!'}
                    </h2>
                    <p className="text-slate-500 text-sm font-bold mb-8">
                        Las estadísticas del servicio fueron {isEdit ? 'actualizadas' : 'registradas'} correctamente.
                    </p>
                    <div className="flex flex-col gap-3 w-full">
                        {!isEdit && (
                            <button
                                onClick={() => { setForm({ ...EMPTY_FORM }); setTotalAuditorioInput(0); setStep(0); setSubmitted(false); }}
                                className="w-full py-4 bg-white text-slate-700 font-bold uppercase tracking-widest border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                            >
                                Nuevo Registro
                            </button>
                        )}
                        <button
                            onClick={() => navigate('/audiencia-servicios')}
                            className="w-full py-4 bg-black text-white font-bold uppercase tracking-widest rounded-lg hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                        >
                            Ver Panel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const StepIcon = STEPS[step].icon;

    return (
        <div className="min-h-screen bg-slate-50 pb-28 animate-fadeIn">

            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={() => navigate('/audiencia-servicios')}
                        className="w-10 h-10 flex items-center justify-center border border-slate-300 bg-white hover:bg-slate-50 rounded-lg transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                        aria-label="Volver"
                    >
                        <ArrowLeft className="w-4 h-4 text-slate-700" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight leading-none text-black">
                            {isEdit ? 'Editar Registro' : 'Nuevo Registro'}
                        </h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Cuidado Pastoral</p>
                    </div>
                </div>

                {/* Step indicators */}
                <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-4">
                    <div className="flex items-center gap-2">
                        {STEPS.map((s, idx) => (
                            <React.Fragment key={s.title}>
                                <div className={`flex items-center gap-2 transition-all ${idx === step ? 'opacity-100' : 'opacity-50'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                                        ${idx <= step ? 'bg-black text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        {idx < step ? <Check className="w-4 h-4" /> : idx + 1}
                                    </div>
                                    <span className="hidden sm:block text-[11px] font-bold uppercase tracking-wider text-black whitespace-nowrap">
                                        {s.title}
                                    </span>
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <div className={`flex-1 h-0.5 rounded-full transition-colors ${idx < step ? 'bg-black' : 'bg-slate-200'}`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-4">

                {/* Step header card */}
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center flex-shrink-0">
                        <StepIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Paso {step + 1} de {STEPS.length}
                        </p>
                        <h2 className="text-lg font-bold uppercase tracking-tight text-black">{STEPS[step].title}</h2>
                    </div>
                </div>

                {/* Step 1 */}
                {step === 0 && (
                    <>
                        {/* Info del servicio */}
                        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-sm uppercase tracking-tight border-b border-slate-200 pb-2 mb-4 text-black">
                                Información del Servicio
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                {/* Nombre */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        Nombre <span className="text-slate-400 normal-case font-medium">(Opcional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name ?? ''}
                                        placeholder="Ej: Servicio Domingo"
                                        onChange={(e) => setField('name', e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                                {/* Fecha */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        Fecha <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={form.service_date}
                                        onChange={(e) => setField('service_date', e.target.value)}
                                        className={`${inputCls} ${dateError ? 'border-red-500' : ''}`}
                                    />
                                    {dateError && <p className="text-red-600 text-xs font-bold mt-1">{dateError}</p>}
                                </div>
                            </div>

                            {/* Horario: time picker + AM/PM */}
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                    Horario <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-3 items-center">
                                    {/* Input hora:minuto */}
                                    <input
                                        type="time"
                                        value={form.service_hour ?? ''}
                                        onChange={(e) => setField('service_hour', e.target.value)}
                                        className={`${inputCls} w-40 flex-shrink-0`}
                                    />
                                    {/* Botones AM/PM */}
                                    <div className="flex gap-2 flex-1">
                                        <button
                                            type="button"
                                            onClick={() => setField('service_time', 'AM')}
                                            className={`flex-1 py-3 font-bold text-sm uppercase tracking-wider rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2
                                                ${form.service_time === 'AM'
                                                    ? 'bg-black text-white'
                                                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                                        >
                                            AM
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setField('service_time', 'PM')}
                                            className={`flex-1 py-3 font-bold text-sm uppercase tracking-wider rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2
                                                ${form.service_time === 'PM'
                                                    ? 'bg-black text-white'
                                                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                                        >
                                            PM
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Categoría */}
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                    Categoría <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={form.category ?? ''}
                                    onChange={(e) => setField('category', e.target.value)}
                                    className={selectCls}
                                >
                                    <option value="">— Seleccioná una categoría —</option>
                                    {CATEGORIES.map((cat) => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Tipo de Servicio — solo visible si categoría = "Servicio de Domingo" */}
                            {form.category === 'Servicio de Domingo' && (
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                        Tipo de Servicio
                                    </label>
                                    <select
                                        value={form.service_type ?? ''}
                                        onChange={(e) => setField('service_type', e.target.value)}
                                        className={selectCls}
                                    >
                                        <option value="">— Seleccioná un tipo —</option>
                                        {SUNDAY_SERVICE_TYPES.map((tipo) => (
                                            <option key={tipo} value={tipo}>{tipo}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {/* Voluntarios */}
                        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                            <h3 className="font-bold text-sm uppercase tracking-tight border-b border-slate-200 pb-2 mb-4 text-black">
                                Áreas de Voluntarios
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {STEP1_METRICS.map((f) => {
                                    if (f.key === 'auditorio') {
                                        return (
                                            <NumericInput
                                                key="auditorio"
                                                label="Total Auditorio (Con Voluntarios)"
                                                value={totalAuditorioInput}
                                                onChange={setTotalAuditorioInput}
                                            />
                                        );
                                    }
                                    return <NumericInput key={f.key} label={f.label} value={form[f.key] as number} onChange={(v) => setField(f.key, v)} />;
                                })}
                            </div>
                        </div>
                    </>
                )}

                {/* Step 2 */}
                {step === 1 && (
                    <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-sm uppercase tracking-tight border-b border-slate-200 pb-2 mb-4 text-black">
                            Asistencia por grupo de edad
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {STEP2_FIELDS.map((f) => (
                                <NumericInput key={f.key} label={f.label} value={form[f.key] as number} onChange={(v) => setField(f.key, v)} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 3 */}
                {step === 2 && (
                    <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-sm uppercase tracking-tight border-b border-slate-200 pb-2 mb-4 text-black">
                            Métricas generales del servicio
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {STEP3_FIELDS.map((f) => (
                                <NumericInput key={f.key} label={f.label} value={form[f.key] as number} onChange={(v) => setField(f.key, v)} />
                            ))}
                        </div>


                        {/* Observaciones */}
                        <div className="mt-8">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                Observaciones
                            </label>
                            <textarea
                                value={form.observations ?? ''}
                                onChange={(e) => setField('observations', e.target.value)}
                                placeholder="Anotá cualquier detalle relevante del servicio..."
                                rows={4}
                                className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none font-bold placeholder-slate-400 focus:border-black transition-all text-black text-base resize-none"
                            />
                        </div>

                        {saveError && (
                            <div className="mt-4 p-3 border border-red-300 bg-red-50 text-red-700 text-xs font-bold rounded-lg">
                                {saveError}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Loading overlay */}
            {saving && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-lg text-center">
                        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-black" />
                        <p className="font-bold text-sm uppercase tracking-widest">Guardando...</p>
                    </div>
                </div>
            )}

            {/* Navigation — Fixed bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-20 px-3 py-2 sm:px-4 sm:py-3">
                <div className="max-w-3xl mx-auto flex items-center gap-2 sm:gap-3">
                    <button
                        onClick={prevStep}
                        disabled={step === 0}
                        className="flex items-center justify-center gap-1 px-3 sm:px-5 py-2.5 sm:py-3.5 border border-slate-300 text-slate-700 font-bold text-xs sm:text-sm uppercase tracking-wider rounded-lg hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition-colors flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Atrás</span>
                    </button>

                    <div className="flex gap-1.5 flex-1 justify-center">
                        {STEPS.map((_, idx) => (
                            <div key={idx} className={`h-1.5 sm:h-2 transition-all rounded-full ${idx === step ? 'bg-black w-5 sm:w-6' : 'bg-slate-200 w-1.5 sm:w-2'}`} />
                        ))}
                    </div>

                    {step < 2 ? (
                        <button
                            onClick={nextStep}
                            className="flex items-center justify-center gap-1.5 flex-1 py-2.5 sm:py-3.5 bg-black text-white font-bold text-xs sm:text-sm uppercase tracking-wider rounded-lg hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                        >
                            Siguiente <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="flex items-center justify-center gap-1.5 flex-1 py-2.5 sm:py-3.5 bg-black text-white font-bold text-xs sm:text-sm uppercase tracking-wider rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PastoralCareForm;

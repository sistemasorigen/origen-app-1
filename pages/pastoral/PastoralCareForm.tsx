import React, { useState } from 'react';
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

const inputCls = 'w-full p-3 bg-white border-2 border-black rounded-lg outline-none font-bold placeholder-neutral-400 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all text-black text-base appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const NumericInput: React.FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
    <div>
        <label className="block text-xs font-black text-neutral-600 uppercase tracking-widest mb-1.5">{label}</label>
        <input
            type="number" min={0}
            value={value === 0 ? '' : value}
            placeholder="0"
            onChange={(e) => { const n = parseInt(e.target.value, 10); onChange(isNaN(n) ? 0 : Math.max(0, n)); }}
            className={inputCls}
        />
    </div>
);

const PastoralCareForm: React.FC<PastoralCareFormProps> = ({ currentUser }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const editRecord: any | undefined = (location.state as any)?.record;
    const isEdit = !!editRecord;

    const [step, setStep] = useState(0);
    const [form, setForm] = useState<FormData>(() => {
        if (editRecord) {
            return {
                id: editRecord.id,
                name: editRecord.name ?? '',
                service_date: editRecord.service_date ?? '',
                service_time: editRecord.service_time ?? 'AM',
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

    const setField = (key: keyof FormData, value: string | number) => {
        setForm(prev => ({ ...prev, [key]: value }));
        if (key === 'service_date') setDateError('');
    };

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
        const { data, error } = await supabaseService.upsertServiceStatistic(form);
        setSaving(false);
        if (error || !data) {
            setSaveError(error || 'Error al guardar. Verificá que la tabla service_statistics exista en Supabase.');
            return;
        }
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
                <div className="text-center max-w-sm w-full">
                    <div className="w-20 h-20 bg-black flex items-center justify-center mx-auto mb-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                        <Check className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-black uppercase tracking-tight mb-3">
                        {isEdit ? '¡Registro actualizado!' : '¡Registro guardado!'}
                    </h2>
                    <p className="text-neutral-600 text-sm font-bold mb-8">
                        Las estadísticas del servicio fueron {isEdit ? 'actualizadas' : 'registradas'} correctamente.
                    </p>
                    <div className="flex flex-col gap-3 w-full">
                        {!isEdit && (
                            <button
                                onClick={() => { setForm({ ...EMPTY_FORM }); setStep(0); setSubmitted(false); }}
                                className="w-full py-4 bg-white text-black font-black uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-white hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
                            >
                                Nuevo Registro
                            </button>
                        )}
                        <button
                            onClick={() => navigate('/pastoral-care')}
                            className="w-full py-4 bg-black text-white font-black uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-white hover:text-black hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
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
        <div className="min-h-screen bg-neutral-50 pb-28 animate-fadeIn">

            {/* Header */}
            <div className="bg-white border-b-4 border-black sticky top-0 z-10">
                <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
                    <button
                        onClick={() => navigate('/pastoral-care')}
                        className="w-10 h-10 flex items-center justify-center border-2 border-black bg-white hover:bg-black hover:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex-shrink-0"
                        aria-label="Volver"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className="text-xl font-black uppercase tracking-tight leading-none text-black">
                            {isEdit ? 'Editar Registro' : 'Nuevo Registro'}
                        </h1>
                        <p className="text-xs text-neutral-500 font-black uppercase tracking-widest">Cuidado Pastoral</p>
                    </div>
                </div>

                {/* Step indicators */}
                <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-4">
                    <div className="flex items-center gap-2">
                        {STEPS.map((s, idx) => (
                            <React.Fragment key={s.title}>
                                <div className={`flex items-center gap-2 transition-all ${idx === step ? 'opacity-100' : 'opacity-40'}`}>
                                    <div className={`w-7 h-7 flex items-center justify-center border-2 border-black text-xs font-black transition-colors
                                        ${idx <= step ? 'bg-black text-white' : 'bg-white text-neutral-400'}`}>
                                        {idx < step ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                                    </div>
                                    <span className="hidden sm:block text-xs font-black uppercase tracking-wider text-black whitespace-nowrap">
                                        {s.title}
                                    </span>
                                </div>
                                {idx < STEPS.length - 1 && (
                                    <div className={`flex-1 h-0.5 transition-colors ${idx < step ? 'bg-black' : 'bg-neutral-300'}`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 space-y-4">

                {/* Step header card */}
                <div className="bg-white p-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3">
                    <div className="w-10 h-10 bg-black flex items-center justify-center flex-shrink-0">
                        <StepIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-neutral-500">
                            Paso {step + 1} de {STEPS.length}
                        </p>
                        <h2 className="text-xl font-black uppercase tracking-tight text-black">{STEPS[step].title}</h2>
                    </div>
                </div>

                {/* Step 1 */}
                {step === 0 && (
                    <>
                        {/* Info del servicio */}
                        <div className="bg-white p-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="font-black text-sm uppercase tracking-widest border-b-2 border-black pb-2 mb-4 text-black">
                                Información del Servicio
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-neutral-600 uppercase tracking-widest mb-1.5">
                                        Nombre <span className="text-neutral-400 normal-case font-bold">(Opcional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name ?? ''}
                                        placeholder="Ej: Servicio Domingo"
                                        onChange={(e) => setField('name', e.target.value)}
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-neutral-600 uppercase tracking-widest mb-1.5">
                                        Fecha <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={form.service_date}
                                        onChange={(e) => setField('service_date', e.target.value)}
                                        className={`${inputCls} ${dateError ? 'border-red-500 shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]' : ''}`}
                                    />
                                    {dateError && <p className="text-red-500 text-xs font-bold mt-1">{dateError}</p>}
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-neutral-600 uppercase tracking-widest mb-1.5">
                                        Horario <span className="text-red-500">*</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setField('service_time', 'AM')}
                                            className={`flex-1 py-3 font-black text-sm uppercase tracking-wider border-2 border-black transition-all
                                                ${form.service_time === 'AM'
                                                    ? 'bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                                    : 'bg-white text-black hover:bg-black hover:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}
                                        >
                                            AM
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setField('service_time', 'PM')}
                                            className={`flex-1 py-3 font-black text-sm uppercase tracking-wider border-2 border-black transition-all
                                                ${form.service_time === 'PM'
                                                    ? 'bg-black text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                                                    : 'bg-white text-black hover:bg-black hover:text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'}`}
                                        >
                                            PM
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Voluntarios */}
                        <div className="bg-white p-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <h3 className="font-black text-sm uppercase tracking-widest border-b-2 border-black pb-2 mb-4 text-black">
                                Áreas de Voluntarios
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {STEP1_METRICS.map((f) => (
                                    <NumericInput key={f.key} label={f.label} value={form[f.key] as number} onChange={(v) => setField(f.key, v)} />
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* Step 2 */}
                {step === 1 && (
                    <div className="bg-white p-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="font-black text-sm uppercase tracking-widest border-b-2 border-black pb-2 mb-4 text-black">
                            Asistencia por grupo de edad
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {STEP2_FIELDS.map((f) => (
                                <NumericInput key={f.key} label={f.label} value={form[f.key] as number} onChange={(v) => setField(f.key, v)} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Step 3 */}
                {step === 2 && (
                    <div className="bg-white p-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <h3 className="font-black text-sm uppercase tracking-widest border-b-2 border-black pb-2 mb-4 text-black">
                            Métricas generales del servicio
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {STEP3_FIELDS.map((f) => (
                                <NumericInput key={f.key} label={f.label} value={form[f.key] as number} onChange={(v) => setField(f.key, v)} />
                            ))}
                        </div>
                        {saveError && (
                            <div className="mt-4 p-3 border-2 border-red-500 bg-red-50 text-red-700 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(239,68,68,1)]">
                                {saveError}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Navigation — Fixed bottom bar */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-black z-20 px-4 py-3">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <button
                        onClick={prevStep}
                        disabled={step === 0}
                        className="flex items-center justify-center gap-1.5 px-5 py-3.5 bg-white text-black font-black text-sm uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-black hover:text-white hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 disabled:opacity-30 disabled:pointer-events-none transition-all flex-shrink-0"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Atrás</span>
                    </button>

                    <div className="flex gap-1.5 flex-1 justify-center">
                        {STEPS.map((_, idx) => (
                            <div key={idx} className={`h-2 transition-all rounded-full ${idx === step ? 'bg-black w-6' : 'bg-neutral-300 w-2'}`} />
                        ))}
                    </div>

                    {step < 2 ? (
                        <button
                            onClick={nextStep}
                            className="flex items-center justify-center gap-1.5 flex-1 py-3.5 bg-black text-white font-black text-sm uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-white hover:text-black hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all"
                        >
                            Siguiente <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="flex items-center justify-center gap-1.5 flex-1 py-3.5 bg-black text-white font-black text-sm uppercase tracking-widest border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-white hover:text-black hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:pointer-events-none"
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

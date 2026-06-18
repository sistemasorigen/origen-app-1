import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabaseService } from '../../services/supabaseService';
import {
    User, TriviaColor, TRIVIA_COLORES, TRIVIA_ICONOS
} from '../../types';
import {
    Plus, Trash2, Loader2, Check, ChevronLeft,
    ChevronDown, ChevronUp, Image, X, Zap, AlertCircle
} from 'lucide-react';

interface OpcionEdit {
    _key: string;
    id?: string;
    texto: string;
    esCorrecta: boolean;
    color: TriviaColor;
    orden: number;
}

interface PreguntaEdit {
    _key: string;
    id?: string;
    texto: string;
    imagenUrl?: string;
    imagenFile?: File;
    tiempoLimite: number;
    esDoble: boolean;
    opciones: OpcionEdit[];
    expandida: boolean;
}

const COLORES_ORDEN: TriviaColor[] = [
    'rojo', 'azul', 'amarillo', 'verde', 'naranja', 'violeta'
];

const nuevaPreguntaVacia = (): PreguntaEdit => ({
    _key:         crypto.randomUUID(),
    texto:        '',
    tiempoLimite: 20,
    esDoble:      false,
    expandida:    true,
    opciones: [
        { _key: crypto.randomUUID(), texto: '', esCorrecta: true,  color: 'rojo',     orden: 0 },
        { _key: crypto.randomUUID(), texto: '', esCorrecta: false, color: 'azul',     orden: 1 },
        { _key: crypto.randomUUID(), texto: '', esCorrecta: false, color: 'amarillo', orden: 2 },
        { _key: crypto.randomUUID(), texto: '', esCorrecta: false, color: 'verde',    orden: 3 },
    ],
});

const CrearJuego: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const navigate        = useNavigate();
    const [searchParams]  = useSearchParams();
    const editId          = searchParams.get('edit');
    const isEdit          = !!editId;

    const [titulo, setTitulo]       = useState('');
    const [preguntas, setPreguntas] = useState<PreguntaEdit[]>([nuevaPreguntaVacia()]);
    const [juegoId, setJuegoId]     = useState<string | null>(editId);
    const [loading, setLoading]     = useState(isEdit);
    const [saving, setSaving]       = useState(false);
    const [saved, setSaved]         = useState(false);
    const [error, setError]         = useState<string | null>(null);

    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    useEffect(() => {
        if (!editId) return;
        supabaseService.getTriviaJuego(editId)
            .then(juego => {
                if (!juego) { navigate('/trivia/admin'); return; }
                setTitulo(juego.titulo);
                setJuegoId(juego.id);
                setPreguntas(
                    (juego.preguntas || []).map(p => ({
                        _key:         p.id,
                        id:           p.id,
                        texto:        p.texto,
                        imagenUrl:    p.imagenUrl,
                        tiempoLimite: p.tiempoLimite,
                        esDoble:      p.esDoble,
                        expandida:    false,
                        opciones: (p.opciones || []).map(o => ({
                            _key:       o.id,
                            id:         o.id,
                            texto:      o.texto,
                            esCorrecta: o.esCorrecta,
                            color:      o.color,
                            orden:      o.orden,
                        })),
                    }))
                );
            })
            .finally(() => setLoading(false));
    }, [editId]);

    const agregarPregunta = () =>
        setPreguntas(p => [...p, nuevaPreguntaVacia()]);

    const eliminarPregunta = (key: string) =>
        setPreguntas(p => p.filter(x => x._key !== key));

    const toggleExpandida = (key: string) =>
        setPreguntas(p => p.map(x =>
            x._key === key ? { ...x, expandida: !x.expandida } : x
        ));

    const updatePregunta = (key: string, changes: Partial<PreguntaEdit>) =>
        setPreguntas(p => p.map(x =>
            x._key === key ? { ...x, ...changes } : x
        ));

    const agregarOpcion = (pregKey: string) =>
        setPreguntas(p => p.map(x => {
            if (x._key !== pregKey) return x;
            if (x.opciones.length >= 6) return x;
            const nextColor = COLORES_ORDEN[x.opciones.length] || 'rojo';
            return {
                ...x,
                opciones: [
                    ...x.opciones,
                    { _key: crypto.randomUUID(), texto: '', esCorrecta: false, color: nextColor, orden: x.opciones.length }
                ]
            };
        }));

    const eliminarOpcion = (pregKey: string, opKey: string) =>
        setPreguntas(p => p.map(x => {
            if (x._key !== pregKey) return x;
            if (x.opciones.length <= 2) return x;
            return {
                ...x,
                opciones: x.opciones
                    .filter(o => o._key !== opKey)
                    .map((o, i) => ({ ...o, orden: i }))
            };
        }));

    const setCorrectaUnica = (pregKey: string, opKey: string) =>
        setPreguntas(p => p.map(x => {
            if (x._key !== pregKey) return x;
            return { ...x, opciones: x.opciones.map(o => ({ ...o, esCorrecta: o._key === opKey })) };
        }));

    const updateOpcion = (pregKey: string, opKey: string, text: string) =>
        setPreguntas(p => p.map(x => {
            if (x._key !== pregKey) return x;
            return { ...x, opciones: x.opciones.map(o => o._key === opKey ? { ...o, texto: text } : o) };
        }));

    const handleImagenFile = (pregKey: string, file: File) => {
        const url = URL.createObjectURL(file);
        setPreguntas(p => p.map(x =>
            x._key === pregKey ? { ...x, imagenFile: file, imagenUrl: url } : x
        ));
    };

    const quitarImagen = (pregKey: string) =>
        setPreguntas(p => p.map(x =>
            x._key === pregKey ? { ...x, imagenFile: undefined, imagenUrl: undefined } : x
        ));

    const handleGuardar = async () => {
        setError(null);

        if (!titulo.trim()) {
            setError('El título del juego es obligatorio.');
            return;
        }
        if (preguntas.length === 0) {
            setError('Agregá al menos una pregunta.');
            return;
        }
        for (const p of preguntas) {
            if (!p.texto.trim()) {
                setError('Todas las preguntas deben tener texto.');
                return;
            }
            if (p.opciones.length < 2) {
                setError('Cada pregunta debe tener al menos 2 opciones.');
                return;
            }
            for (const o of p.opciones) {
                if (!o.texto.trim()) {
                    setError('Todas las opciones deben tener texto.');
                    return;
                }
            }
            if (!p.opciones.some(o => o.esCorrecta)) {
                setError(`La pregunta "${p.texto.slice(0, 30)}..." no tiene opción correcta.`);
                return;
            }
        }

        setSaving(true);
        try {
            let id = juegoId;
            if (!id) {
                const juego = await supabaseService.crearTriviaJuego(titulo, currentUser.id);
                if (!juego) throw new Error('Error al crear el juego.');
                id = juego.id;
                setJuegoId(id);
            }

            const preguntasConUrls = await Promise.all(
                preguntas.map(async (p, idx) => {
                    let imagenUrl = p.imagenUrl;
                    if (p.imagenFile) {
                        imagenUrl = await supabaseService.subirImagenTrivia(p.imagenFile);
                    }
                    return {
                        id:           p.id,
                        orden:        idx,
                        texto:        p.texto.trim(),
                        imagenUrl,
                        tiempoLimite: p.tiempoLimite,
                        esDoble:      p.esDoble,
                        opciones: p.opciones.map((o, oi) => ({
                            id:         o.id,
                            texto:      o.texto.trim(),
                            esCorrecta: o.esCorrecta,
                            color:      o.color,
                            orden:      oi,
                        })),
                    };
                })
            );

            const ok = await supabaseService.guardarTriviaPreguntas(id, preguntasConUrls);
            if (!ok) throw new Error('Error al guardar las preguntas.');

            setSaved(true);
            setTimeout(() => navigate('/trivia/admin'), 1200);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Error inesperado.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-white flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
    );

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-3xl mx-auto px-4 md:px-8 py-10 md:py-14">

                {/* Header */}
                <div className="mb-8 pb-8 border-b border-gray-100">
                    <button
                        onClick={() => navigate('/trivia/admin')}
                        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-4 font-medium"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Mis juegos
                    </button>
                    <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">
                        {isEdit ? 'Editar juego' : 'Nuevo juego'}
                    </h1>
                </div>

                {/* Título */}
                <div className="mb-8">
                    <label className="text-[11px] font-medium uppercase tracking-wide text-gray-400 block mb-2">
                        Título del juego
                    </label>
                    <input
                        type="text"
                        placeholder="Ej: Trivia Día del Padre"
                        value={titulo}
                        onChange={e => setTitulo(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl border border-gray-200 text-base font-semibold text-gray-900 placeholder:font-normal placeholder:text-gray-300 focus:outline-none focus:border-gray-400 focus:ring-4 focus:ring-gray-50 transition-all"
                    />
                </div>

                {/* Preguntas */}
                <div className="space-y-4 mb-8">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        Preguntas ({preguntas.length})
                    </p>

                    <AnimatePresence>
                        {preguntas.map((preg, pregIdx) => (
                            <motion.div
                                key={preg._key}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden"
                            >
                                {/* Header acordeón */}
                                <div
                                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                    onClick={() => toggleExpandida(preg._key)}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                                            {pregIdx + 1}
                                        </span>
                                        <p className={`text-sm font-medium truncate ${preg.texto ? 'text-gray-900' : 'text-gray-300'}`}>
                                            {preg.texto || 'Pregunta sin título'}
                                        </p>
                                        {preg.esDoble && (
                                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold shrink-0">
                                                <Zap className="w-3 h-3" />
                                                ×2
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={e => { e.stopPropagation(); eliminarPregunta(preg._key); }}
                                            className="w-7 h-7 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 flex items-center justify-center transition-all"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                        {preg.expandida
                                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                            : <ChevronDown className="w-4 h-4 text-gray-400" />
                                        }
                                    </div>
                                </div>

                                {/* Cuerpo */}
                                {preg.expandida && (
                                    <div className="px-5 pb-5 space-y-5 border-t border-gray-50">

                                        {/* Texto */}
                                        <div className="pt-4">
                                            <textarea
                                                placeholder="Escribí la pregunta..."
                                                value={preg.texto}
                                                onChange={e => updatePregunta(preg._key, { texto: e.target.value })}
                                                rows={2}
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 focus:ring-4 focus:ring-gray-50 resize-none transition-all"
                                            />
                                        </div>

                                        {/* Tiempo + doble puntos */}
                                        <div className="flex items-center gap-4 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
                                                    Tiempo
                                                </label>
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {[5, 10, 15, 20, 30, 45, 60].map(t => (
                                                        <button
                                                            key={t}
                                                            type="button"
                                                            onClick={() => updatePregunta(preg._key, { tiempoLimite: t })}
                                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${preg.tiempoLimite === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                        >
                                                            {t}s
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => updatePregunta(preg._key, { esDoble: !preg.esDoble })}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${preg.esDoble ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                            >
                                                <Zap className="w-3.5 h-3.5" />
                                                Doble puntos
                                            </button>
                                        </div>

                                        {/* Imagen opcional */}
                                        <div>
                                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide block mb-2">
                                                Imagen (opcional)
                                            </label>
                                            {preg.imagenUrl ? (
                                                <div className="relative inline-block">
                                                    <img
                                                        src={preg.imagenUrl}
                                                        alt="preview"
                                                        className="h-28 rounded-xl object-cover border border-gray-100"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => quitarImagen(preg._key)}
                                                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        ref={el => { fileInputRefs.current[preg._key] = el; }}
                                                        className="hidden"
                                                        onChange={e => {
                                                            const f = e.target.files?.[0];
                                                            if (f) handleImagenFile(preg._key, f);
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRefs.current[preg._key]?.click()}
                                                        className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all"
                                                    >
                                                        <Image className="w-4 h-4" />
                                                        Subir imagen
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {/* Opciones */}
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide block">
                                                Opciones de respuesta
                                            </label>
                                            {preg.opciones.map(op => (
                                                <div key={op._key} className="flex items-center gap-2">
                                                    {/* Color badge */}
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0 select-none"
                                                        style={{ backgroundColor: TRIVIA_COLORES[op.color] }}
                                                        title={op.color}
                                                    >
                                                        {TRIVIA_ICONOS[op.color]}
                                                    </div>
                                                    {/* Input */}
                                                    <input
                                                        type="text"
                                                        placeholder="Opción..."
                                                        value={op.texto}
                                                        onChange={e => updateOpcion(preg._key, op._key, e.target.value)}
                                                        className="flex-1 h-10 px-3 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 focus:ring-4 focus:ring-gray-50 transition-all"
                                                    />
                                                    {/* Correcta */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setCorrectaUnica(preg._key, op._key)}
                                                        title="Marcar como correcta"
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${op.esCorrecta ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'}`}
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    {/* Eliminar opción */}
                                                    {preg.opciones.length > 2 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => eliminarOpcion(preg._key, op._key)}
                                                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all shrink-0"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {/* Agregar opción */}
                                            {preg.opciones.length < 6 && (
                                                <button
                                                    type="button"
                                                    onClick={() => agregarOpcion(preg._key)}
                                                    className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all w-full mt-1"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    Agregar opción
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {/* Agregar pregunta */}
                    <button
                        type="button"
                        onClick={agregarPregunta}
                        className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all w-full"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar pregunta
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 mb-6">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-600 font-medium">{error}</p>
                    </div>
                )}

                {/* Guardar */}
                <button
                    type="button"
                    onClick={handleGuardar}
                    disabled={saving || saved}
                    className={`w-full h-12 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${saved
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-900 text-white hover:bg-black active:scale-[0.98] disabled:opacity-50'
                    }`}
                >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saved && <Check className="w-4 h-4" />}
                    {saved ? 'Guardado' : saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear juego'}
                </button>
            </div>
        </div>
    );
};

export default CrearJuego;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Check, Loader2, AlertCircle, ChevronRight, Lock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabaseService } from '../../services/supabaseService';
import { getRoleDisplayNames } from '../../services/authUtils';
import AvatarUpload from '../../components/media/SubidaAvatar';

// ── Estilos de página ───────────────────────────────────────────────────
//
// index.html define overrides globales de formulario ("GLOBAL INPUT
// OVERRIDES — HIGH READABILITY") con !important: fondo blanco forzado
// —también en dark—, borde slate-300, radio 0.5rem y outline azul en
// foco. Ese selector encadena nueve :not([type=...]) y pesa (0,9,1), así
// que ninguna clase de Tailwind lo toca: `focus:border-emerald-500` y
// `rounded-xl` se escriben en el HTML pero no llegan a pintar nada.
//
// Scopear por id da (1,x,x) y gana por la columna de ids sin importar el
// resto. Es la única forma de que esta página tenga su propio tratamiento
// de formulario sin editar el override global, que lo usa toda la app.
//
// De paso corrige el modo oscuro: el override global deja los inputs
// blancos sobre fondo negro, que es lo que hoy se ve en dark.
const estilos = `
    #perfil-page .campo {
        width: 100%;
        padding: 0.8125rem 1rem;
        font-size: 0.9375rem;
        font-weight: 500;
        line-height: 1.4;
        background-color: #ffffff !important;
        color: #0f172a !important;
        border: 1px solid #e2e8f0 !important;
        border-radius: 0.75rem !important;
        outline: none !important;
        box-shadow: none;
        transition: border-color .15s ease, box-shadow .15s ease;
    }
    #perfil-page .campo:hover:not(:focus) {
        border-color: #cbd5e1 !important;
    }
    /* El foco pinta borde + halo en el verde de la casa. El outline
       transparente no se ve en pantalla pero sobrevive a forced-colors
       (alto contraste de Windows), donde box-shadow se descarta y el
       campo quedaría sin ninguna marca de foco. */
    #perfil-page .campo:focus,
    #perfil-page .campo:focus-visible {
        border-color: #059669 !important;
        box-shadow: 0 0 0 3px rgba(5, 150, 105, .15) !important;
        outline: 2px solid transparent !important;
        outline-offset: 2px;
    }
    #perfil-page .campo::placeholder { color: #94a3b8 !important; opacity: 1; }

    .dark #perfil-page .campo {
        background-color: #18181b !important;
        color: #ffffff !important;
        border-color: #3f3f46 !important;
    }
    .dark #perfil-page .campo:hover:not(:focus) { border-color: #52525b !important; }
    .dark #perfil-page .campo::placeholder { color: #71717a !important; }

    /* El select nativo trae su propia flecha, distinta en cada sistema.
       Se reemplaza por una que coincide con los chevrons de lucide que
       usa el resto de la página. */
    #perfil-page select.campo {
        appearance: none;
        -webkit-appearance: none;
        padding-right: 2.75rem;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 1rem center;
        background-size: 1rem;
    }
    .dark #perfil-page select.campo {
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    }

    /* El ícono de calendario nativo viene gris fijo y desaparece sobre
       fondo oscuro. */
    #perfil-page input[type="date"]::-webkit-calendar-picker-indicator {
        cursor: pointer;
        opacity: .5;
        transition: opacity .15s ease;
    }
    #perfil-page input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }
    .dark #perfil-page input[type="date"]::-webkit-calendar-picker-indicator {
        filter: invert(1);
        opacity: .6;
    }

    /* Entrada escalonada: el encabezado primero, después la identidad y
       las dos secciones del formulario. Misma curva que el fadeInUp
       global (index.html) — arranca rápido y frena suave. */
    #perfil-page .aparece {
        opacity: 0;
        animation: perfilAparece .5s cubic-bezier(.16, 1, .3, 1) forwards;
    }
    #perfil-page .retraso-1 { animation-delay: .06s; }
    #perfil-page .retraso-2 { animation-delay: .12s; }
    #perfil-page .retraso-3 { animation-delay: .18s; }
    @keyframes perfilAparece {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
        #perfil-page .aparece {
            animation: none;
            opacity: 1;
        }
    }
`;

// Etiqueta de sección: el registro de "rótulo estructural" que usa Home
// para "Empieza en" y "Versículo del día".
const rotuloClass = 'text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-zinc-400';
// Etiqueta de campo: caja baja y semibold. Se diferencia a propósito del
// rótulo — mayúsculas espaciadas marcan estructura, caja baja marca dato.
const etiquetaClass = 'text-sm font-semibold text-slate-700 dark:text-zinc-200';
const tarjetaClass = 'bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm';

const calculateAge = (birthDate: string): number => {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
};

type CampoNombre = 'name' | 'phone' | 'birthDate' | 'gender';

// Los cuatro campos que ModalCompletarPerfil exige antes de dejar entrar a
// la app. Acá se marcan igual: si le faltan a alguien que llegó por otro
// camino, la página dice cuáles y dónde, en vez de dejarlo adivinar.
const CAMPOS_REQUERIDOS: { key: CampoNombre; label: string }[] = [
    { key: 'name', label: 'Nombre y apellido' },
    { key: 'phone', label: 'Teléfono' },
    { key: 'birthDate', label: 'Fecha de nacimiento' },
    { key: 'gender', label: 'Sexo' },
];

// Encabezado de un campo: nombre, aviso de dato faltante y punto de
// "editado sin guardar". El punto es lo que hace que el formulario sea
// legible de un vistazo cuando se tocaron dos cosas y no se sabe cuáles.
const Campo: React.FC<{
    id: string;
    label: string;
    falta?: boolean;
    editado?: boolean;
    ayuda?: string;
    children: React.ReactNode;
}> = ({ id, label, falta, editado, ayuda, children }) => (
    <div>
        <div className="flex items-center gap-2 mb-1.5">
            <label htmlFor={id} className={etiquetaClass}>{label}</label>
            {falta && (
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700 dark:text-amber-500 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded">
                    Falta
                </span>
            )}
            {editado && (
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                    Editado
                </span>
            )}
        </div>
        {children}
        {ayuda && (
            <p className="mt-1.5 text-xs font-normal text-slate-500 dark:text-zinc-400">{ayuda}</p>
        )}
    </div>
);

const ProfilePage: React.FC = () => {
    const navigate = useNavigate();
    const { user, refreshSession, updateAvatar } = useAuth();

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        birthDate: '',
        gender: '',
    });

    const [isSaving, setIsSaving] = useState(false);
    // Un solo aviso, con su texto: guardar el perfil y cambiar la foto son
    // dos acciones distintas y cada una tiene que decir lo suyo.
    const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                phone: user.phone || '',
                birthDate: user.birthDate || '',
                gender: user.gender || '',
            });
        }
    }, [user]);

    const setCampo = (key: CampoNombre, value: string) =>
        setFormData(prev => ({ ...prev, [key]: value }));

    // La referencia de "sin cambios" sale de `user`, no de un estado
    // aparte: al guardar, refreshSession() actualiza `user`, el efecto de
    // arriba recarga el formulario y el diff vuelve a cero solo.
    const guardado = {
        name: user?.name || '',
        phone: user?.phone || '',
        birthDate: user?.birthDate || '',
        gender: user?.gender || '',
    };
    const editados = (Object.keys(guardado) as CampoNombre[]).filter(k => formData[k] !== guardado[k]);
    const hayCambios = editados.length > 0;

    const faltantes = CAMPOS_REQUERIDOS.filter(c => !formData[c.key].trim());

    const hoyISO = new Date().toISOString().split('T')[0];

    // Mismo rango que valida ModalCompletarPerfil antes de dejar entrar:
    // acá se avisa en el campo en vez de rechazar el envío sin explicar.
    const errorFecha = (() => {
        if (!formData.birthDate) return null;
        const fecha = new Date(formData.birthDate + 'T00:00:00');
        if (Number.isNaN(fecha.getTime())) return 'Revisá la fecha.';
        if (formData.birthDate > hoyISO) return 'La fecha no puede ser futura.';
        if (calculateAge(formData.birthDate) > 120) return 'Revisá el año de nacimiento.';
        return null;
    })();

    const edad = formData.birthDate && !errorFecha ? calculateAge(formData.birthDate) : null;

    const handleSave = async () => {
        if (!user || !hayCambios || errorFecha) return;
        setIsSaving(true);
        setAviso(null);

        try {
            const age = formData.birthDate
                ? calculateAge(formData.birthDate)
                : user.age || 0;

            const profileOk = await supabaseService.updateUserProfile(user.id, {
                phone: formData.phone,
                gender: formData.gender,
                birthDate: formData.birthDate,
                age,
            });

            const nameOk = await supabaseService.updateUser({
                ...user,
                name: formData.name,
            });

            if (profileOk && nameOk) {
                await refreshSession();
                setAviso({ tipo: 'ok', texto: 'Cambios guardados.' });
                setTimeout(() => setAviso(null), 3000);
            } else {
                throw new Error('No se pudieron guardar los cambios. Revisá tu conexión e intentá de nuevo.');
            }
        } catch (err: unknown) {
            const texto = err instanceof Error
                ? err.message
                : 'No se pudieron guardar los cambios. Revisá tu conexión e intentá de nuevo.';
            setAviso({ tipo: 'error', texto });
        } finally {
            setIsSaving(false);
        }
    };

    // `roles` es el array real; `role` quedó como campo heredado. La página
    // mostraba sólo el heredado, así que a quien tiene dos roles le faltaba
    // uno.
    const rolesUsuario = user
        ? (user.roles?.length ? user.roles : [user.role])
        : [];
    const etiquetasRol = getRoleDisplayNames(rolesUsuario);

    return (
        <div id="perfil-page" className="w-full">
            <style>{estilos}</style>

            {/* === ENCABEZADO ===
                Sin barra a sangre: Estructura.tsx ya encierra esta ruta en
                un max-w-7xl con padding, así que una franja de ancho
                completo no llega a ningún borde — queda flotando con doble
                margen. El título vive dentro de la misma columna que el
                contenido. */}
            <div className="max-w-5xl mx-auto">
                <header className="aparece flex items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
                    <button
                        onClick={() => navigate(-1)}
                        aria-label="Volver"
                        className="w-10 h-10 mt-0.5 shrink-0 rounded-full border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-slate-900 hover:text-white hover:border-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/10 dark:focus-visible:ring-white/10"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white">
                            Mi perfil
                        </h1>
                        <p className="mt-1 text-sm font-normal text-slate-500 dark:text-zinc-400">
                            Revisá tus datos y actualizá lo que haga falta.
                        </p>
                    </div>
                </header>

                {/* === GRILLA ===
                    Izquierda, quién sos; derecha, lo que podés cambiar. Es
                    la división real del contenido: el nombre y el teléfono
                    son tuyos, el email y el rol te los asigna la comunidad.
                    En mobile se apila en ese mismo orden. */}
                <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-5 lg:gap-6 items-start">

                    {/* === IDENTIDAD ===
                        Espejo en vivo del formulario: el nombre y la edad
                        salen de lo que hay escrito a la derecha, no de lo
                        último guardado. Editar la fecha de nacimiento y ver
                        cambiar la edad es lo que vuelve literal el "estos
                        son tus datos". */}
                    {/* Se reacomoda dos veces: apilada y centrada en mobile;
                        horizontal entre sm y lg, donde la tarjeta ocupa todo
                        el ancho y una foto centrada dejaría medio metro de
                        aire al costado; y de vuelta en vertical dentro del
                        rail angosto de desktop. */}
                    <aside className={`aparece retraso-1 ${tarjetaClass} p-6 lg:sticky lg:top-20`}>
                        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6 lg:flex-col lg:items-center lg:gap-5">
                            <div className="shrink-0">
                                <AvatarUpload
                                    currentAvatarUrl={user?.avatarUrl}
                                    userName={user?.name || 'Usuario'}
                                    userId={user?.id || ''}
                                    size="lg"
                                    onUploadComplete={async (url) => {
                                        await supabaseService.updateUserProfile(user!.id, { avatarUrl: url });
                                        updateAvatar(url);
                                        setAviso({ tipo: 'ok', texto: 'Foto actualizada.' });
                                        setTimeout(() => setAviso(null), 3000);
                                    }}
                                />
                            </div>

                            <div className="min-w-0 w-full sm:flex-1 lg:w-full text-center sm:text-left lg:text-center">
                                {/* El nombre en Light 300 a tamaño grande — el
                                    mismo registro con el que Home abre su cierre
                                    ("¿Querés conocernos?"). Un nombre propio no
                                    es un titular que grita. */}
                                <p className="text-2xl font-light tracking-[-0.02em] leading-tight text-slate-900 dark:text-white break-words">
                                    {formData.name.trim() || 'Sin nombre'}
                                </p>
                                <p className="mt-1 text-sm font-normal text-slate-500 dark:text-zinc-400 break-all">
                                    {user?.email}
                                </p>

                                {etiquetasRol.length > 0 && (
                                    <div className="mt-5 pt-5 border-t border-slate-100 dark:border-zinc-800 text-left">
                                        <div className={rotuloClass}>Rol en Origen</div>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {etiquetasRol.map(nombre => (
                                                <span
                                                    key={nombre}
                                                    className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                                >
                                                    {nombre}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* La edad es el único número derivado de la
                                    página: no se escribe, sale de la fecha.
                                    Black (900) con tabular-nums, el tratamiento
                                    que Home reserva para el contador — y acá
                                    también se usa una sola vez. */}
                                {edad !== null && (
                                    <div className="mt-5 pt-5 border-t border-slate-100 dark:border-zinc-800 text-left">
                                        <div className={rotuloClass}>Edad</div>
                                        <div className="mt-1.5 flex items-baseline gap-1.5">
                                            <span className="text-3xl font-black tabular-nums tracking-[-0.03em] leading-none text-slate-900 dark:text-white">
                                                {edad}
                                            </span>
                                            <span className="text-sm font-normal text-slate-500 dark:text-zinc-400">
                                                {edad === 1 ? 'año' : 'años'}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    <div className="space-y-5 lg:space-y-6">

                        {/* === TUS DATOS === */}
                        <section className={`aparece retraso-2 ${tarjetaClass} p-5 sm:p-6`}>
                            <h2 className={rotuloClass}>Tus datos</h2>

                            {faltantes.length > 0 && (
                                <p className="mt-2 text-sm font-normal text-amber-700 dark:text-amber-500">
                                    {faltantes.length === 1
                                        ? `Falta un dato para completar tu perfil: ${faltantes[0].label.toLowerCase()}.`
                                        : `Faltan ${faltantes.length} datos para completar tu perfil.`}
                                </p>
                            )}

                            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                                <div className="sm:col-span-2">
                                    <Campo
                                        id="perfil-nombre"
                                        label="Nombre y apellido"
                                        falta={!formData.name.trim()}
                                        editado={editados.includes('name')}
                                    >
                                        <input
                                            id="perfil-nombre"
                                            type="text"
                                            className="campo"
                                            value={formData.name}
                                            placeholder="Tu nombre y apellido"
                                            autoComplete="name"
                                            onChange={(e) => setCampo('name', e.target.value)}
                                        />
                                    </Campo>
                                </div>

                                <div className="sm:col-span-2">
                                    <Campo
                                        id="perfil-telefono"
                                        label="Teléfono"
                                        falta={!formData.phone.trim()}
                                        editado={editados.includes('phone')}
                                    >
                                        <input
                                            id="perfil-telefono"
                                            type="tel"
                                            className="campo"
                                            value={formData.phone}
                                            placeholder="+54 9 11 1234 5678"
                                            autoComplete="tel"
                                            inputMode="tel"
                                            onChange={(e) => setCampo('phone', e.target.value)}
                                        />
                                    </Campo>
                                </div>

                                <Campo
                                    id="perfil-nacimiento"
                                    label="Fecha de nacimiento"
                                    falta={!formData.birthDate}
                                    editado={editados.includes('birthDate')}
                                    ayuda={errorFecha ?? undefined}
                                >
                                    <input
                                        id="perfil-nacimiento"
                                        type="date"
                                        className="campo"
                                        value={formData.birthDate}
                                        max={hoyISO}
                                        autoComplete="bday"
                                        aria-invalid={!!errorFecha}
                                        onChange={(e) => setCampo('birthDate', e.target.value)}
                                    />
                                </Campo>

                                <Campo
                                    id="perfil-sexo"
                                    label="Sexo"
                                    falta={!formData.gender}
                                    editado={editados.includes('gender')}
                                >
                                    <select
                                        id="perfil-sexo"
                                        className="campo"
                                        value={formData.gender}
                                        onChange={(e) => setCampo('gender', e.target.value)}
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="Masculino">Masculino</option>
                                        <option value="Femenino">Femenino</option>
                                        <option value="No especificar">No especificar</option>
                                    </select>
                                </Campo>
                            </div>

                            {/* === GUARDAR ===
                                El botón queda apagado mientras no haya nada
                                que guardar: antes se podía apretar con el
                                formulario intacto y escribía igual. El conteo
                                al lado dice qué se está por mandar. */}
                            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-zinc-800">
                                {aviso && (
                                    <div
                                        role="status"
                                        className={`mb-4 p-3.5 rounded-xl flex items-center gap-2.5 text-sm font-semibold ${aviso.tipo === 'ok'
                                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                                            : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                                            }`}
                                    >
                                        {aviso.tipo === 'ok'
                                            ? <Check className="w-4 h-4 shrink-0" />
                                            : <AlertCircle className="w-4 h-4 shrink-0" />}
                                        {aviso.texto}
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row-reverse sm:items-center sm:justify-between gap-3">
                                    <button
                                        onClick={handleSave}
                                        disabled={isSaving || !hayCambios || !!errorFecha}
                                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-semibold hover:bg-black dark:hover:bg-slate-200 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/20 dark:focus-visible:ring-white/20"
                                    >
                                        {isSaving && <Loader2 className="w-5 h-5 animate-spin" />}
                                        {isSaving ? 'Guardando...' : 'Guardar cambios'}
                                    </button>

                                    <p className="text-sm font-normal text-slate-500 dark:text-zinc-400 text-center sm:text-left">
                                        {hayCambios
                                            ? `${editados.length} ${editados.length === 1 ? 'cambio' : 'cambios'} sin guardar`
                                            : 'Todo guardado'}
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* === TU CUENTA ===
                            Lo que no se edita acá. Va en su propia tarjeta
                            en vez de mezclado entre los campos: un campo
                            deshabilitado dentro del formulario se lee como
                            algo que falla, no como algo que es así. */}
                        <section className={`aparece retraso-3 ${tarjetaClass} p-5 sm:p-6`}>
                            <h2 className={rotuloClass}>Tu cuenta</h2>

                            <div className="mt-5">
                                <div className={etiquetaClass}>Email</div>
                                <div className="mt-1.5 flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-800">
                                    <Lock className="w-4 h-4 shrink-0 text-slate-400 dark:text-zinc-500" />
                                    <span className="text-[15px] font-medium text-slate-600 dark:text-zinc-300 break-all">
                                        {user?.email}
                                    </span>
                                </div>
                                <p className="mt-1.5 text-xs font-normal text-slate-500 dark:text-zinc-400">
                                    Tu email identifica tu cuenta y no se puede cambiar.
                                </p>
                            </div>

                            <div className="mt-5 pt-5 border-t border-slate-100 dark:border-zinc-800">
                                <button
                                    onClick={() => navigate('/update-password')}
                                    className="group w-full flex items-center justify-between gap-3 text-left rounded-xl -m-1 p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                                >
                                    <span className={etiquetaClass}>Cambiar contraseña</span>
                                    <ChevronRight className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors" />
                                </button>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;

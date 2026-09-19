import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { supabaseService } from '../../services/supabaseService';

/**
 * Acompañante de una inscripción (design-claude/Admin GCX - Detalle e Inscriptos).
 *
 * Tres pasos: si tiene email, buscar la cuenta, y cargar lo que falte. Con
 * cuenta se vincula y solo se pide el teléfono; sin cuenta se carga a mano y
 * queda invitada, para que se vincule sola el día que se registre.
 *
 * Lo usan la lista de inscriptos —donde guarda contra la inscripción— y el
 * alta a mano, donde solo completa el formulario antes de crearla.
 */

export interface DatosPareja {
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
}

interface ModalParejaInscripcionProps {
    isOpen: boolean;
    onClose: () => void;
    /** Nombre de quien encabeza la inscripción. */
    titular: string;
    /** Datos ya cargados, si se está editando. */
    inicial?: { datos?: DatosPareja; userId?: string | null };
    onGuardar: (datos: DatosPareja, userId: string | null) => void | Promise<void>;
    guardando?: boolean;
}

const iniciales = (nombre: string) =>
    (nombre || '').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';

const ModalParejaInscripcion: React.FC<ModalParejaInscripcionProps> = ({
    isOpen, onClose, titular, inicial, onGuardar, guardando = false,
}) => {
    const [paso, setPaso] = useState(1);
    const [tieneEmail, setTieneEmail] = useState<boolean | null>(null);
    const [email, setEmail] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [cuenta, setCuenta] = useState<{ id: string; name: string; phone?: string } | null>(null);
    const [busco, setBusco] = useState(false);
    const [nombre, setNombre] = useState('');
    const [apellido, setApellido] = useState('');
    const [telefono, setTelefono] = useState('');
    const [error, setError] = useState<string | null>(null);
    const abiertoRef = useRef(false);

    // Al abrir: si ya hay pareja cargada se entra directo al último paso con
    // sus datos; si no, se arranca por la pregunta del email.
    //
    // El guard del ref es necesario: `inicial` llega como objeto literal, así
    // que cambia de identidad en cada render del padre —y el padre re-renderiza
    // solo, por ejemplo cuando aparece un toast—. Sin el guard, el formulario
    // se reiniciaría mientras la persona lo está completando.
    useEffect(() => {
        if (!isOpen) { abiertoRef.current = false; return; }
        if (abiertoRef.current) return;
        abiertoRef.current = true;
        setError(null);
        setBuscando(false);
        const d = inicial?.datos;
        if (d) {
            setTieneEmail(!!d.email);
            setEmail(d.email || '');
            setNombre(d.firstName || '');
            setApellido(d.lastName || '');
            setTelefono(d.phone || '');
            setBusco(true);
            setCuenta(inicial?.userId ? { id: inicial.userId, name: `${d.firstName} ${d.lastName}`.trim(), phone: d.phone } : null);
            setPaso(3);
        } else {
            setTieneEmail(null);
            setEmail(''); setNombre(''); setApellido(''); setTelefono('');
            setCuenta(null); setBusco(false);
            setPaso(1);
        }
    }, [isOpen, inicial]);

    useEffect(() => {
        if (!isOpen) return;
        const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', tecla);
        return () => document.removeEventListener('keydown', tecla);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const buscarCuenta = async () => {
        if (!email.trim()) { setError('Escribí el email para poder buscar.'); return; }
        setError(null);
        setBuscando(true);
        try {
            const encontrada = await supabaseService.findUserByEmail(email.trim());
            setCuenta(encontrada);
            setBusco(true);
            if (encontrada) {
                const partes = (encontrada.name || '').split(' ').filter(Boolean);
                setNombre(partes[0] || '');
                setApellido(partes.slice(1).join(' ') || '');
                if (encontrada.phone) setTelefono(encontrada.phone);
            }
            setPaso(3);
        } finally {
            setBuscando(false);
        }
    };

    const guardar = async () => {
        if (!nombre.trim() || !apellido.trim() || !telefono.trim()) {
            setError('Faltan el nombre, el apellido o el teléfono.');
            return;
        }
        if (tieneEmail && !email.trim()) {
            setError('Faltó el email del acompañante.');
            return;
        }
        setError(null);
        const datos: DatosPareja = tieneEmail
            ? { firstName: nombre.trim(), lastName: apellido.trim(), email: email.trim(), phone: telefono.trim() }
            : { firstName: nombre.trim(), lastName: apellido.trim(), phone: telefono.trim() };
        await onGuardar(datos, cuenta?.id || null);
    };

    const barra = (n: number) =>
        `h-[5px] flex-1 rounded-full ${paso >= n ? 'bg-[#0a0a0a]' : 'bg-[#eceae6]'}`;

    const campo = 'flex h-[58px] flex-col justify-center rounded-[18px] bg-[#f7f7f5] px-[17px]';
    const rotulo = 'text-[10.5px] font-semibold uppercase tracking-[0.06em] text-black/[.58]';
    const entrada = 'campo-desnudo w-full bg-transparent text-[14.5px] font-medium text-[#0a0a0a]';
    const principal = 'h-[52px] min-w-[150px] flex-1 rounded-full bg-[#0a0a0a] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2';
    const secundario = 'h-[52px] rounded-full bg-[#f2f2f0] px-5 text-[15px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2';

    const esEdicion = !!inicial?.datos;
    const pasoBuscar = paso === 2;
    const pasoEncontrada = paso === 3 && !!cuenta;
    const pasoManual = paso === 3 && !cuenta;

    return (
        <div className="fixed inset-0 z-[80]">
            <div className="absolute inset-0 bg-[rgba(10,10,10,.42)]" onClick={onClose} />
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Acompañante de la inscripción"
                className="absolute inset-x-3 top-10 max-h-[88vh] overflow-auto rounded-[26px] bg-white shadow-[0_20px_50px_rgba(0,0,0,.25)] md:inset-x-auto md:left-1/2 md:top-[70px] md:w-[560px] md:-translate-x-1/2"
            >
                <div className="px-6 pb-[22px] pt-5">
                    <div className="flex items-start gap-3.5">
                        <div className="min-w-0 flex-1">
                            <span className="flex h-[26px] w-fit items-center rounded-full bg-[#fbeef4] px-[11px] text-[11.5px] font-semibold text-[#9d1d5c]">
                                Acompañante
                            </span>
                            <p className="mt-3 text-[18px] font-semibold tracking-[-0.015em] text-[#0a0a0a]">
                                {esEdicion ? 'Datos de la pareja' : 'Sumar una pareja a la inscripción'}
                            </p>
                            <p className="mt-[7px] text-[12.5px] font-medium text-black/[.62]">
                                Una inscripción, dos personas. La inscripción sigue a nombre de {titular}.
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            aria-label="Cerrar"
                            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[#0a0a0a]"
                        >
                            <X className="h-[15px] w-[15px]" />
                        </button>
                    </div>

                    <div className="mt-[18px] flex items-center gap-[7px]">
                        <div className={barra(1)} /><div className={barra(2)} /><div className={barra(3)} />
                        <span className="ml-1.5 whitespace-nowrap text-[11.5px] font-semibold text-black/[.6]">
                            Paso {paso} de 3
                        </span>
                    </div>

                    {/* Paso 1 — ¿tiene email? */}
                    {paso === 1 && (
                        <>
                            <p className="mt-5 text-[16px] font-semibold text-[#0a0a0a]">¿El acompañante tiene email?</p>
                            <p className="mt-2 text-[13px] font-medium leading-[1.6] text-black/[.62]">
                                Con el email buscamos si ya tiene cuenta en la app y evitamos cargar datos dos veces.
                            </p>
                            <div className="mt-[18px] flex flex-wrap gap-2.5">
                                <button
                                    onClick={() => { setTieneEmail(true); setCuenta(null); setBusco(false); setPaso(2); }}
                                    className={principal}
                                >
                                    Sí, tiene email
                                </button>
                                <button
                                    onClick={() => { setTieneEmail(false); setEmail(''); setCuenta(null); setBusco(true); setPaso(3); }}
                                    className={`${secundario} min-w-[130px] flex-1`}
                                >
                                    No tiene
                                </button>
                            </div>
                        </>
                    )}

                    {/* Paso 2 — buscar la cuenta */}
                    {pasoBuscar && (
                        <>
                            <p className="mt-5 text-[16px] font-semibold text-[#0a0a0a]">Buscar la cuenta por email</p>
                            <div className="mt-3.5 flex h-[54px] items-center gap-2.5 rounded-[18px] bg-[#f7f7f5] px-[18px]">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') buscarCuenta(); }}
                                    placeholder="nombre@email.com"
                                    aria-label="Email del acompañante"
                                    autoFocus
                                    className="campo-desnudo min-w-0 flex-1 bg-transparent text-[15px] font-medium text-[#0a0a0a]"
                                />
                                {buscando && <Loader2 className="h-4 w-4 flex-none animate-spin text-black/30" />}
                            </div>
                            <div className="mt-[18px] flex flex-wrap gap-2.5">
                                <button onClick={buscarCuenta} disabled={buscando} className={principal}>
                                    {buscando ? 'Buscando…' : 'Buscar cuenta'}
                                </button>
                                <button onClick={() => { setPaso(1); setCuenta(null); setBusco(false); }} className={secundario}>
                                    Atrás
                                </button>
                            </div>
                        </>
                    )}

                    {/* Paso 3 — con cuenta */}
                    {pasoEncontrada && (
                        <>
                            <div className="mt-5 rounded-[18px] bg-[#f3faf5] px-[18px] py-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-white text-[13px] font-semibold text-black/[.62]">
                                        {iniciales(cuenta!.name)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[14.5px] font-semibold text-[#0a0a0a]">{cuenta!.name}</p>
                                        <p className="mt-[3px] truncate text-[12.5px] font-medium text-black/[.62]">{email || 'Sin email'}</p>
                                    </div>
                                    <span className="flex h-6 flex-none items-center rounded-full bg-[#e9f6ed] px-2.5 text-[11px] font-semibold text-[#15803d]">
                                        Vinculada
                                    </span>
                                </div>
                            </div>
                            <p className="mt-4 text-[13px] font-medium leading-[1.6] text-black/[.62]">
                                Los datos vienen de su cuenta. Solo falta el teléfono para contactarla.
                            </p>
                            <div className={`${campo} mt-3`}>
                                <label htmlFor="pareja-tel" className={rotulo}>Teléfono</label>
                                <input id="pareja-tel" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="11 6033 1180" className={entrada} />
                            </div>
                        </>
                    )}

                    {/* Paso 3 — a mano */}
                    {pasoManual && (
                        <>
                            <p className="mt-5 text-[16px] font-semibold text-[#0a0a0a]">
                                {tieneEmail && busco && email ? 'No hay cuenta con ese email' : 'Cargar los datos a mano'}
                            </p>
                            <p className="mt-2 text-[13px] font-medium leading-[1.6] text-black/[.62]">
                                {tieneEmail && email
                                    ? 'Se carga a mano y queda invitada: cuando cree su cuenta con ese email, la inscripción se vincula sola.'
                                    : 'Sin email no hay cuenta que vincular, así que los datos quedan cargados a mano. No va a poder entrar a la app.'}
                            </p>
                            <div className="mt-3.5 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                                <div className={campo}>
                                    <label htmlFor="pareja-nombre" className={rotulo}>Nombre</label>
                                    <input id="pareja-nombre" type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Valeria" className={entrada} />
                                </div>
                                <div className={campo}>
                                    <label htmlFor="pareja-apellido" className={rotulo}>Apellido</label>
                                    <input id="pareja-apellido" type="text" value={apellido} onChange={e => setApellido(e.target.value)} placeholder="Aguirre" className={entrada} />
                                </div>
                                <div className={campo}>
                                    <label htmlFor="pareja-telefono" className={rotulo}>Teléfono</label>
                                    <input id="pareja-telefono" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="11 6033 1180" className={entrada} />
                                </div>
                            </div>
                        </>
                    )}

                    {error && (
                        <div className="mt-3 rounded-[14px] bg-[#fdecea] px-3 py-2 text-[12.5px] font-semibold text-[#a32218]">
                            {error}
                        </div>
                    )}

                    {paso === 3 && (
                        <div className="mt-[18px] flex flex-wrap gap-2.5">
                            <button onClick={guardar} disabled={guardando} className={principal}>
                                {guardando ? 'Guardando…' : 'Guardar la pareja'}
                            </button>
                            <button
                                onClick={() => { setPaso(tieneEmail ? 2 : 1); setCuenta(null); }}
                                className={secundario}
                            >
                                Atrás
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModalParejaInscripcion;

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, GroupRegistration } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { Search, X, Loader2, Trash2, Phone, Mail } from 'lucide-react';
import { T, Encabezado, Vacio, HojaConfirmacion, rotulo } from '../../components/GCX/patron';
import { linkDeWhatsApp } from '../../src/utils/whatsapp';

/**
 * Inscriptos de un grupo, para el anfitrión.
 *
 * El panel ya listaba los miembros, pero sólo el nombre: para escribirle a
 * alguien había que ir a buscar el teléfono a otro lado. Acá va una tarjeta
 * por inscripción con todos los datos y las dos cosas que el anfitrión
 * realmente hace: escribirle, o sacarlo del grupo.
 *
 * Toma la forma de la lista de inscriptos del panel GCX —avatar cuadrado,
 * nombre, renglón chico con el tipo de inscripción, píldora de estado y el
 * filo rosa en las parejas— con los tokens de `patron`, que son los de estas
 * pantallas y además funcionan en oscuro.
 *
 * Una inscripción de pareja es UNA fila con dos personas adentro, y cada una
 * tiene su propio teléfono: por eso el bloque de contacto se repite por
 * persona, mientras que sacar del grupo borra la inscripción entera.
 */

const ROSA = '#9d1d5c';

const iniciales = (nombre: string) =>
    (nombre || '').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';

const estadoDe = (estado: GroupRegistration['status']) => {
    if (estado === 'APPROVED') return { bg: '#e9f6ed', fg: '#15803d', dot: '#16a34a', label: 'Aprobada' };
    if (estado === 'PENDING') return { bg: '#fdf0dc', fg: '#7a4f10', dot: '#b45309', label: 'Pendiente' };
    return { bg: '#fdecea', fg: '#a32218', dot: '#c62a1d', label: 'Rechazada' };
};

const desdeCuando = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `Anotado el ${d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
};

interface Persona {
    nombre: string;
    email?: string;
    telefono?: string;
    esPareja?: boolean;
}

/** Las una o dos personas que viven dentro de una inscripción. */
const personasDe = (r: GroupRegistration): Persona[] => {
    const titular: Persona = {
        nombre: `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Sin nombre',
        email: r.email,
        telefono: r.phone,
    };
    if (!r.partnerData) return [titular];
    return [titular, {
        nombre: `${r.partnerData.firstName || ''} ${r.partnerData.lastName || ''}`.trim() || 'Sin nombre',
        email: r.partnerData.email,
        telefono: r.partnerData.phone,
        esPareja: true,
    }];
};

const PaginaInscriptosGrupo: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const [groupName, setGroupName] = useState('');
    const [inscriptos, setInscriptos] = useState<GroupRegistration[]>([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [enCurso, setEnCurso] = useState<string | null>(null);
    const [aSacar, setASacar] = useState<GroupRegistration | null>(null);
    const [aviso, setAviso] = useState<string | null>(null);

    // El grupo se resuelve con getGroupsByHost, que trae también los que la
    // persona co-anfitriona: es la misma puerta que usan las otras pantallas
    // del panel, y deja afuera los grupos ajenos.
    const traer = useCallback(async () => {
        if (!currentUser || !groupId) return;
        setCargando(true);
        try {
            const propios = await supabaseService.getGroupsByHost(currentUser.id);
            const grupo = propios.find(g => g.id === groupId);
            if (!grupo) {
                navigate('/mis-grupos', { replace: true });
                return;
            }
            setGroupName(grupo.name);
            setInscriptos(await supabaseService.getGroupRegistrations(groupId));
        } finally {
            setCargando(false);
        }
    }, [currentUser, groupId, navigate]);

    useEffect(() => { traer(); }, [traer]);

    useEffect(() => {
        if (!aviso) return;
        const t = setTimeout(() => setAviso(null), 3200);
        return () => clearTimeout(t);
    }, [aviso]);

    const sacar = async (r: GroupRegistration) => {
        setEnCurso(r.id);
        const ok = await supabaseService.deleteGroupRegistration(r.id, groupId!);
        setEnCurso(null);
        setASacar(null);
        if (ok) {
            setInscriptos(prev => prev.filter(a => a.id !== r.id));
            setAviso(`${r.firstName} salió del grupo`);
        } else {
            setAviso('No se pudo sacar a esa persona');
        }
    };

    const q = busqueda.trim().toLowerCase();
    const filtrados = inscriptos.filter(r => {
        if (!q) return true;
        return personasDe(r).some(p =>
            p.nombre.toLowerCase().includes(q)
            || (p.email || '').toLowerCase().includes(q)
            || (p.telefono || '').includes(q));
    });

    // Las que esperan respuesta primero: son las únicas que piden una decisión.
    const orden = { PENDING: 0, APPROVED: 1, REJECTED: 2 } as const;
    const lista = [...filtrados].sort((a, b) => (orden[a.status] ?? 3) - (orden[b.status] ?? 3));

    const nParejas = inscriptos.filter(r => !!r.partnerData).length;

    const pildora = (r: GroupRegistration) => {
        const c = estadoDe(r.status);
        return (
            <span
                className="flex h-[26px] w-fit flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] text-[11.5px] font-semibold"
                style={{ background: c.bg, color: c.fg }}
            >
                <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: c.dot }} />
                {c.label}
            </span>
        );
    };

    const bloqueDePersona = (p: Persona, unica: boolean) => {
        const wa = linkDeWhatsApp(p.telefono);
        return (
            <div key={p.nombre + (p.telefono || '')} className={`rounded-[18px] ${T.interna} px-4 py-3.5`}>
                {!unica && (
                    <p className="text-[13.5px] font-semibold" style={p.esPareja ? { color: ROSA } : undefined}>
                        {p.nombre}
                    </p>
                )}
                <div className={`flex flex-col gap-1.5 ${unica ? '' : 'mt-2'}`}>
                    <p className="flex items-center gap-2 text-[13.5px] font-medium text-black/[.62] dark:text-white/[.62]">
                        <Phone className="h-[13px] w-[13px] flex-none" />
                        {p.telefono || 'sin teléfono'}
                    </p>
                    <p className="flex items-center gap-2 text-[13.5px] font-medium text-black/[.62] dark:text-white/[.62]">
                        <Mail className="h-[13px] w-[13px] flex-none" />
                        <span className="truncate">{p.email || 'sin email'}</span>
                    </p>
                </div>

                {wa ? (
                    <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#0a0a0a] text-[14.5px] font-semibold text-white transition-opacity hover:opacity-[.88] dark:bg-white dark:text-black"
                    >
                        Escribirle al WhatsApp
                    </a>
                ) : (
                    // Sin botón a propósito: con lo guardado no se puede armar
                    // un número confiable, y uno inventado abre el chat de otra
                    // persona sin que quien escribe se entere.
                    <p className="mt-3 text-[12.5px] font-medium leading-[1.5] text-black/40 dark:text-white/40">
                        {p.telefono
                            ? 'No podemos abrir WhatsApp: al teléfono le falta la característica.'
                            : 'No dejó teléfono, así que no hay WhatsApp al que escribirle.'}
                    </p>
                )}
            </div>
        );
    };

    return (
        <div id="gcx-accion" className={`min-h-screen ${T.fondo} ${T.fuente} ${T.tinta}`}>
            <div className="bg-white dark:bg-[#1b1b1a] rounded-b-[28px] px-5 pt-4 pb-[18px] lg:px-8 lg:py-5">
                <div className="max-w-[760px] mx-auto">
                    <Encabezado
                        accion="Inscriptos"
                        grupo={groupName}
                        onVolver={() => navigate(`/mis-grupos/${groupId}`)}
                    />
                </div>
            </div>

            <div className="max-w-[760px] mx-auto px-4 pt-4 pb-8">
                <div className={`flex h-[56px] items-center gap-2.5 rounded-full ${T.tarjeta} pl-[18px] pr-2.5`}>
                    <Search className="h-[17px] w-[17px] flex-none text-black/40 dark:text-white/40" />
                    <input
                        type="text"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar por nombre, teléfono o email"
                        aria-label="Buscar inscriptos"
                        className="campo-desnudo min-w-0 flex-1 bg-transparent text-[15px] font-medium"
                    />
                    {busqueda && (
                        <button
                            type="button"
                            onClick={() => setBusqueda('')}
                            aria-label="Limpiar la búsqueda"
                            className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${T.chip}`}
                        >
                            <X className="h-[14px] w-[14px]" />
                        </button>
                    )}
                </div>

                <p className={`${rotulo} mt-4 px-1`}>
                    {cargando
                        ? 'Cargando…'
                        : inscriptos.length === 0
                            ? 'Todavía sin inscriptos'
                            : `${lista.length} de ${inscriptos.length} ${inscriptos.length === 1 ? 'inscripción' : 'inscripciones'}${nParejas > 0 ? ` · ${nParejas} ${nParejas === 1 ? 'es pareja' : 'son parejas'}` : ''}`}
                </p>

                {cargando ? (
                    <div className={`${T.tarjeta} mt-3 flex justify-center rounded-[26px] py-20`}>
                        <Loader2 className="h-7 w-7 animate-spin text-black/20 dark:text-white/20" />
                    </div>
                ) : lista.length === 0 ? (
                    <div className={`${T.tarjeta} mt-3 rounded-[26px]`}>
                        <Vacio
                            titulo={inscriptos.length === 0 ? 'Todavía no hay inscriptos' : 'Nadie coincide con la búsqueda'}
                            detalle={inscriptos.length === 0
                                ? 'Cuando alguien se anote desde el catálogo va a aparecer acá con sus datos.'
                                : 'Probá con el apellido, con parte del teléfono, o con el email.'}
                            accion={inscriptos.length === 0
                                ? { texto: 'Inscribir a alguien', onClick: () => navigate(`/mis-grupos/${groupId}/inscribir`) }
                                : { texto: 'Limpiar la búsqueda', onClick: () => setBusqueda('') }}
                        />
                    </div>
                ) : (
                    <div className="mt-3 flex flex-col gap-3">
                        {lista.map(r => {
                            const gente = personasDe(r);
                            const esPareja = gente.length > 1;
                            const titulo = gente.map(p => p.nombre).join(' y ');
                            return (
                                <div
                                    key={r.id}
                                    className={`${T.tarjeta} rounded-[26px] p-5`}
                                    style={esPareja ? { boxShadow: `inset 3px 0 0 ${ROSA}` } : undefined}
                                >
                                    <div className="flex items-start gap-3.5">
                                        <div
                                            className="flex h-12 w-12 flex-none items-center justify-center rounded-[15px] text-[14px] font-semibold"
                                            style={esPareja
                                                ? { background: '#fbeef4', color: ROSA }
                                                : { background: '#f2f2f0', color: 'rgba(0,0,0,.58)' }}
                                        >
                                            {iniciales(gente[0].nombre)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[16.5px] font-semibold tracking-[-.01em]">{titulo}</p>
                                            <p
                                                className="mt-[3px] text-[13px] font-medium text-black/[.62] dark:text-white/[.62]"
                                                style={esPareja ? { color: ROSA } : undefined}
                                            >
                                                {esPareja ? 'Inscripción de pareja · ocupa dos lugares' : 'Inscripción individual'}
                                            </p>
                                            {desdeCuando(r.timestamp) && (
                                                <p className="mt-0.5 text-[13px] font-medium text-black/40 dark:text-white/40">
                                                    {desdeCuando(r.timestamp)}
                                                </p>
                                            )}
                                        </div>
                                        {pildora(r)}
                                    </div>

                                    <div className="mt-3.5 flex flex-col gap-2.5">
                                        {gente.map(p => bloqueDePersona(p, !esPareja))}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setASacar(r)}
                                        disabled={enCurso === r.id}
                                        className="mt-2.5 flex h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#fdecea] text-[14.5px] font-semibold text-[#a32218] transition-opacity hover:opacity-[.88] disabled:opacity-40"
                                    >
                                        {enCurso === r.id
                                            ? <Loader2 className="h-4 w-4 animate-spin" />
                                            : <Trash2 className="h-[15px] w-[15px]" />}
                                        {esPareja ? 'Sacar a los dos del grupo' : 'Sacar del grupo'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Sacar a alguien borra la inscripción y no se deshace, así que
                va por la hoja de confirmación del patrón: es la que usan las
                otras acciones serias del panel y la que frena el scroll de
                atrás como corresponde. */}
            <HojaConfirmacion
                abierta={!!aSacar}
                titulo={aSacar ? `¿Sacar a ${`${aSacar.firstName} ${aSacar.lastName}`.trim()} del grupo?` : ''}
                antes={aSacar?.partnerData
                    ? 'Es una inscripción de pareja, así que salen los dos y se liberan dos lugares. '
                    : 'Se borra la inscripción y el lugar queda libre. '}
                consecuencia="Esto no se puede deshacer."
                textoConfirmar="Sí, sacar del grupo"
                onConfirmar={() => aSacar && sacar(aSacar)}
                onCancelar={() => setASacar(null)}
                cargando={!!aSacar && enCurso === aSacar.id}
            />

            {aviso && (
                <div
                    role="status"
                    className="fixed bottom-6 left-1/2 z-[210] -translate-x-1/2 rounded-full bg-[#0a0a0a] px-5 py-3 text-[14px] font-semibold text-white shadow-lg dark:bg-white dark:text-black"
                >
                    {aviso}
                </div>
            )}
        </div>
    );
};

export default PaginaInscriptosGrupo;

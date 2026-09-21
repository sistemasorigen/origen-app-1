import React, { useEffect, useMemo, useState } from 'react';
import { dondeSeReune } from '../../src/utils/modalidad';
import { GroupRegistration } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import {
    GrupoConDatos,
    PastillaEstado,
    Segmentado,
    Rotulo,
    TarjetaVacia,
    conComa,
    escribirlePorWhatsApp,
    iniciales,
    leerSenal,
    nombreAnfitrion,
    primerNombre,
} from './comunes';

/**
 * Grupos de las categorías que coordina.
 *
 * Dos pantallas: el listado y la ficha de un grupo. La ficha es de lectura,
 * salvo por una cosa: sacar a alguien del grupo, que el panel anterior ya
 * permitía y sigue estando acá, ahora con una confirmación en la misma fila
 * en vez de borrar al primer toque.
 *
 * La asistencia de cada miembro se cuenta de verdad, reunión por reunión:
 * un inscripto figura presente si su id está en la fila de esa fecha. Las
 * parejas se cuentan aparte, con el sufijo "-partner", igual que en el
 * reporte de un grupo.
 */

interface Props {
    datos: GrupoConDatos[];
    promedioIglesia: number;
    nombreCategorias: string;
    preseleccionado: string | null;
    onLimpiarPreseleccion: () => void;
    onRefrescar: () => void;
}

const GruposCoordinador: React.FC<Props> = ({
    datos,
    promedioIglesia,
    nombreCategorias,
    preseleccionado,
    onLimpiarPreseleccion,
    onRefrescar,
}) => {
    const [busqueda, setBusqueda] = useState('');
    const [filtro, setFiltro] = useState<'activos' | 'finalizados'>('activos');
    const [abiertoId, setAbiertoId] = useState<string | null>(null);
    const [aviso, setAviso] = useState('');

    // Llegar desde una alerta de Inicio o desde el calendario abre la ficha
    // directamente, y el filtro se acomoda para que el grupo exista en la
    // lista a la que se vuelve.
    useEffect(() => {
        if (!preseleccionado) return;
        const encontrado = datos.find(d => d.grupo.id === preseleccionado);
        if (encontrado) {
            setAbiertoId(encontrado.grupo.id);
            setFiltro(encontrado.finalizado ? 'finalizados' : 'activos');
        }
        onLimpiarPreseleccion();
    }, [preseleccionado, datos, onLimpiarPreseleccion]);

    const delFiltro = useMemo(
        () => datos.filter(d => (filtro === 'activos' ? !d.finalizado : d.finalizado)),
        [datos, filtro]
    );

    const listados = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return delFiltro;
        return delFiltro.filter(d =>
            (d.grupo.name || '').toLowerCase().includes(q) ||
            nombreAnfitrion(d.grupo).toLowerCase().includes(q)
        );
    }, [delFiltro, busqueda]);

    const abierto = useMemo(() => datos.find(d => d.grupo.id === abiertoId) || null, [datos, abiertoId]);

    if (abierto) {
        return (
            <FichaGrupo
                dato={abierto}
                promedioIglesia={promedioIglesia}
                onVolver={() => setAbiertoId(null)}
                onRefrescar={onRefrescar}
                aviso={aviso}
                setAviso={setAviso}
            />
        );
    }

    return (
        <>
            <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex h-[42px] w-full min-w-0 items-center gap-2.5 rounded-full bg-white pl-[17px] pr-2 md:w-auto md:min-w-[260px] md:flex-1">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.58)" strokeWidth={2.2} strokeLinecap="round" className="flex-none">
                        <circle cx="11" cy="11" r="6.5" />
                        <path d="M16 16l4 4" />
                    </svg>
                    <input
                        type="text"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                        placeholder="Buscar por grupo o anfitrión"
                        className="campo-desnudo min-w-0 flex-1 text-[13.5px] font-medium text-[#0a0a0a]"
                    />
                    {busqueda && (
                        <button
                            onClick={() => setBusqueda('')}
                            aria-label="Limpiar la búsqueda"
                            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#f2f2f0]"
                        >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth={2.4} strokeLinecap="round">
                                <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                        </button>
                    )}
                </div>
                <Segmentado
                    valor={filtro}
                    onChange={v => setFiltro(v as 'activos' | 'finalizados')}
                    fondo="bg-[#eceae6]"
                    opciones={[
                        { valor: 'activos', label: 'Activos' },
                        { valor: 'finalizados', label: 'Finalizados' },
                    ]}
                />
            </div>

            <p className="mx-0.5 mt-3.5 text-[12px] font-semibold text-black/[.62]">
                {listados.length} de {delFiltro.length} grupos {filtro} de tus categorías
            </p>

            {listados.length === 0 ? (
                <div className="mt-3">
                    <TarjetaVacia
                        titulo={delFiltro.length === 0 ? `No hay grupos ${filtro}` : 'Ningún grupo coincide'}
                        texto={delFiltro.length === 0
                            ? `Cuando un grupo de ${nombreCategorias || 'tus categorías'} pase a ${filtro === 'activos' ? 'activo' : 'finalizado'} va a aparecer acá.`
                            : `Recordá que solo ves los grupos de tus categorías: ${nombreCategorias}.`}
                    >
                        {busqueda && (
                            <button
                                onClick={() => setBusqueda('')}
                                className="mt-[18px] h-[46px] rounded-full bg-[#f2f2f0] px-[22px] text-[14px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                Limpiar la búsqueda
                            </button>
                        )}
                    </TarjetaVacia>
                </div>
            ) : (
                <div className="mt-3 grid gap-3 [grid-template-columns:minmax(0,1fr)] md:[grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
                    {listados.map(d => (
                        <TarjetaGrupo
                            key={d.grupo.id}
                            dato={d}
                            promedioIglesia={promedioIglesia}
                            onAbrir={() => setAbiertoId(d.grupo.id)}
                        />
                    ))}
                </div>
            )}
        </>
    );
};

// ── Tarjeta del listado ───────────────

const TarjetaGrupo: React.FC<{
    dato: GrupoConDatos;
    promedioIglesia: number;
    onAbrir: () => void;
}> = ({ dato, promedioIglesia, onAbrir }) => {
    const [fotoRota, setFotoRota] = useState(false);
    const { grupo, finalizado } = dato;
    const senal = leerSenal(dato, promedioIglesia);
    const anfitrion = nombreAnfitrion(grupo);
    const pct = dato.capacidad > 0 ? Math.min(100, Math.round((dato.ocupados / dato.capacidad) * 100)) : 0;
    const donde = dondeSeReune(grupo, 'Online');

    return (
        <button
            onClick={onAbrir}
            className="block w-full min-w-0 rounded-[20px] bg-white px-[18px] py-4 text-left transition-shadow hover:shadow-[0_2px_14px_rgba(0,0,0,.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
        >
            <div className="flex items-start gap-3">
                <div
                    className={`relative flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-[14px] bg-[#f2f2f0] text-[12.5px] font-semibold text-black/[.58] ${finalizado ? 'grayscale' : ''}`}
                >
                    {iniciales(grupo.name || '')}
                    {grupo.imageUrl && !fotoRota && (
                        <img
                            src={grupo.imageUrl}
                            alt=""
                            onError={() => setFotoRota(true)}
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <p className={`truncate text-[15px] font-semibold ${finalizado ? 'text-black/[.6]' : 'text-[#0a0a0a]'}`}>
                        {grupo.name || 'Sin nombre'}
                    </p>
                    <p className="mt-[3px] truncate text-[12.5px] font-medium text-black/[.62]">{dato.categoria}</p>
                </div>
                <PastillaEstado finalizado={finalizado} />
            </div>

            <p className="mt-3 truncate text-[13px] font-medium text-black/[.66]">{anfitrion}</p>
            <p className="mt-1 truncate text-[13px] font-medium text-black/[.66]">
                {grupo.meetingDay} {grupo.meetingTime} · {donde}
            </p>

            <div className="mt-3 flex items-center gap-[11px]">
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f0efec]">
                    <span
                        className="block h-full rounded-full"
                        style={{ width: `${pct}%`, background: finalizado ? '#c9c8c4' : '#0a0a0a' }}
                    />
                </span>
                <span className="whitespace-nowrap text-[12.5px] font-semibold text-black/[.66]">
                    {dato.ocupados}/{dato.capacidad || '—'}
                </span>
            </div>

            <p
                className="mt-3 border-t border-[#f4f3f1] pt-[11px] text-[12px] font-semibold"
                style={{ color: senal.tono === 'verde' ? '#0b7a53' : '#7a4f10' }}
            >
                {senal.texto}
            </p>
        </button>
    );
};

// ── Ficha de un grupo ─────────────────

const FichaGrupo: React.FC<{
    dato: GrupoConDatos;
    promedioIglesia: number;
    onVolver: () => void;
    onRefrescar: () => void;
    aviso: string;
    setAviso: (v: string) => void;
}> = ({ dato, promedioIglesia, onVolver, onRefrescar, aviso, setAviso }) => {
    const { grupo, finalizado } = dato;
    const [busquedaMiembro, setBusquedaMiembro] = useState('');
    const [porQuitar, setPorQuitar] = useState<string | null>(null);
    const [quitando, setQuitando] = useState<string | null>(null);
    const [fotoRota, setFotoRota] = useState(false);

    const senal = leerSenal(dato, promedioIglesia);
    const anfitrion = nombreAnfitrion(grupo);
    const donde = dondeSeReune(grupo, 'Online');

    // Cada inscripción aprobada son una o dos personas. La asistencia se
    // cuenta por persona, con el mismo id que guarda group_attendance.
    const personas = useMemo(() => {
        const reuniones = dato.reportes.length;
        const presentesDe = (id: string) => dato.reportes.filter(r => r.ids.includes(id)).length;

        const lista: {
            claveFila: string;
            registro: GroupRegistration;
            nombre: string;
            esPareja: boolean;
            pendiente: boolean;
            presentes: number;
            reuniones: number;
        }[] = [];

        (grupo.registrations || []).forEach(r => {
            const pendiente = r.status === 'PENDING';
            if (r.status === 'REJECTED') return;

            lista.push({
                claveFila: r.id,
                registro: r,
                nombre: `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Sin nombre',
                esPareja: false,
                pendiente,
                presentes: presentesDe(String(r.id)),
                reuniones,
            });

            if (r.partnerData) {
                lista.push({
                    claveFila: `${r.id}-partner`,
                    registro: r,
                    nombre: `${r.partnerData.firstName || ''} ${r.partnerData.lastName || ''}`.trim() || 'Su pareja',
                    esPareja: true,
                    pendiente,
                    presentes: presentesDe(`${r.id}-partner`),
                    reuniones,
                });
            }
        });

        return lista.sort((a, b) => b.presentes - a.presentes);
    }, [grupo.registrations, dato.reportes]);

    const miembros = useMemo(() => {
        const q = busquedaMiembro.trim().toLowerCase();
        if (!q) return personas;
        return personas.filter(p =>
            p.nombre.toLowerCase().includes(q) ||
            (p.registro.email || '').toLowerCase().includes(q)
        );
    }, [personas, busquedaMiembro]);

    const quitar = async (registro: GroupRegistration) => {
        setQuitando(registro.id);
        setAviso('');
        try {
            const ok = await supabaseService.deleteGroupRegistration(registro.id, grupo.id);
            if (ok) {
                setPorQuitar(null);
                setAviso(`${registro.firstName} salió del grupo.`);
                onRefrescar();
            } else {
                setAviso('No se pudo sacar a esa persona. Probá de nuevo en un momento.');
            }
        } catch (error) {
            console.error('[Coordinadores] Error quitando inscripción:', error);
            setAviso('No se pudo sacar a esa persona. Probá de nuevo en un momento.');
        } finally {
            setQuitando(null);
        }
    };

    const contactar = () => {
        const mensaje = dato.reporta
            ? `Hola ${primerNombre(anfitrion)}, ¿cómo viene ${grupo.name}?`
            : `Hola ${primerNombre(anfitrion)}, ¿podés cargar la asistencia de ${grupo.name}?`;
        const abrio = escribirlePorWhatsApp(grupo.leaderPhone, mensaje);
        if (!abrio) setAviso(`${anfitrion} no tiene teléfono cargado en su ficha.`);
    };

    const fila = (etiqueta: string, valor: string) => (
        <div className="flex items-center justify-between gap-3.5 border-b border-[#f4f3f1] py-[11px] last:border-b-0">
            <span className="flex-none text-[12.5px] font-medium text-black/[.62]">{etiqueta}</span>
            <span className="text-right text-[12.5px] font-semibold text-[#0a0a0a]">{valor}</span>
        </div>
    );

    return (
        <>
            <button
                onClick={onVolver}
                className="flex h-9 items-center gap-[7px] rounded-full bg-white pl-[11px] pr-3.5 text-[12.5px] font-semibold text-black/[.64] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
            >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 6l-6 6 6 6" />
                </svg>
                Todos los grupos
            </button>

            {aviso && (
                <p className="mt-3 rounded-[16px] bg-white px-4 py-3 text-[13px] font-medium text-[#0a0a0a]">{aviso}</p>
            )}

            <div className="mt-3 grid gap-3.5 [grid-template-columns:minmax(0,1fr)] lg:[grid-template-columns:minmax(0,1.4fr)_minmax(0,1fr)]">

                {/* Ficha */}
                <div className="min-w-0 overflow-hidden rounded-[20px] bg-white">
                    <div className="flex h-[130px] items-center justify-center bg-[#f2f2f0] md:h-[170px]">
                        {grupo.imageUrl && !fotoRota ? (
                            <img
                                src={grupo.imageUrl}
                                alt={`Portada de ${grupo.name}`}
                                onError={() => setFotoRota(true)}
                                className={`h-full w-full object-cover ${finalizado ? 'grayscale' : ''}`}
                            />
                        ) : (
                            <span className="text-[12px] font-medium text-black/[.5]">Sin foto cargada</span>
                        )}
                    </div>
                    <div className="px-[22px] py-5">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <h2 className="text-[20px] font-semibold tracking-[-0.018em] text-[#0a0a0a]">
                                {grupo.name || 'Sin nombre'}
                            </h2>
                            <PastillaEstado finalizado={finalizado} />
                        </div>

                        <div className="mt-4">
                            {fila('Anfitrión', anfitrion)}
                            {fila('Día y horario', `${grupo.meetingDay || '—'} ${grupo.meetingTime || ''}`.trim())}
                            {fila('Ubicación', donde)}
                            {fila('Categoría', dato.categoria)}
                            {fila('Cupo', dato.capacidad ? `${dato.ocupados} de ${dato.capacidad} lugares` : `${dato.ocupados} inscriptos`)}
                            {fila('Bajas', dato.bajas === 0 ? 'Ninguna' : `${dato.bajas} en la temporada`)}
                            {fila('Reuniones reportadas', dato.reportes.length === 0 ? 'Ninguna' : String(dato.reportes.length))}
                        </div>

                        {grupo.description && (
                            <p className="mt-4 border-t border-[#f0efec] pt-3.5 text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                                {grupo.description}
                            </p>
                        )}

                        <p className="mt-4 border-t border-[#f0efec] pt-3.5 text-[12.5px] font-medium leading-[1.6] text-black/[.62]">
                            Como coordinador podés mirar y acompañar. Editar la ficha o aprobar inscripciones le
                            corresponde al anfitrión.
                        </p>
                    </div>
                </div>

                {/* Cómo viene + miembros */}
                <div className="flex min-w-0 flex-col gap-3.5">
                    <div
                        className="rounded-[20px] bg-white px-[22px] py-5"
                        style={{ boxShadow: `inset 0 0 0 1.5px ${senal.tono === 'verde' ? '#cfe9dc' : '#f0d9b4'}` }}
                    >
                        <Rotulo className={senal.tono === 'verde' ? 'text-[#0b7a53]' : 'text-[#7a4f10]'}>
                            Cómo viene
                        </Rotulo>
                        <p className="mt-[11px] text-[17px] font-semibold leading-[1.4] text-[#0a0a0a]">{senal.titulo}</p>
                        <p className="mt-2.5 text-[13px] font-medium leading-[1.6] text-black/[.66]">{senal.detalle}</p>
                        <button
                            onClick={contactar}
                            className="mt-4 h-11 rounded-full bg-[#0a0a0a] px-[18px] text-[13.5px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            {senal.accion}
                        </button>
                    </div>

                    <div className="rounded-[20px] bg-white px-[22px] py-5">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <p className="min-w-[110px] flex-1 text-[15px] font-semibold text-[#0a0a0a]">
                                Miembros
                                <span className="ml-2 text-[12.5px] font-medium text-black/[.62]">{personas.length}</span>
                            </p>
                            {personas.length > 6 && (
                                <div className="flex h-[38px] w-full items-center gap-2 rounded-full bg-[#f7f7f5] px-3.5 md:w-[180px]">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.58)" strokeWidth={2.2} strokeLinecap="round" className="flex-none">
                                        <circle cx="11" cy="11" r="6.5" />
                                        <path d="M16 16l4 4" />
                                    </svg>
                                    <input
                                        type="text"
                                        value={busquedaMiembro}
                                        onChange={e => setBusquedaMiembro(e.target.value)}
                                        placeholder="Buscar"
                                        className="campo-desnudo min-w-0 flex-1 text-[13px] font-medium text-[#0a0a0a]"
                                    />
                                </div>
                            )}
                        </div>

                        {dato.reportes.length > 0 && (
                            <p className="mt-2 text-[12px] font-medium text-black/[.58]">
                                Asistencia sobre {dato.reportes.length} {dato.reportes.length === 1 ? 'reunión reportada' : 'reuniones reportadas'}.
                            </p>
                        )}

                        <div className="mt-4 flex flex-col gap-3">
                            {miembros.length === 0 ? (
                                <p className="py-6 text-center text-[13px] font-medium text-black/[.6]">
                                    {personas.length === 0 ? 'Todavía no hay nadie inscripto.' : 'Nadie coincide con esa búsqueda.'}
                                </p>
                            ) : (
                                miembros.map(p => (
                                    <div key={p.claveFila} className="flex items-center gap-[11px]">
                                        <div className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-[11.5px] font-semibold ${p.esPareja ? 'bg-[#fbeef4] text-[#9d1d5c]' : 'bg-[#f2f2f0] text-black/[.6]'}`}>
                                            {iniciales(p.nombre)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[13px] font-medium text-black/[.8]">{p.nombre}</p>
                                            {(p.esPareja || p.pendiente) && (
                                                <p className="mt-[2px] text-[11.5px] font-semibold text-black/[.58]">
                                                    {[p.esPareja ? 'Pareja' : '', p.pendiente ? 'Pendiente de aprobar' : ''].filter(Boolean).join(' · ')}
                                                </p>
                                            )}
                                        </div>

                                        {porQuitar === p.claveFila ? (
                                            <div className="flex flex-none items-center gap-1.5">
                                                <button
                                                    onClick={() => quitar(p.registro)}
                                                    disabled={quitando === p.registro.id}
                                                    className="h-8 rounded-full bg-[#fdecea] px-3 text-[12px] font-semibold text-[#a32218] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                                >
                                                    {quitando === p.registro.id ? 'Sacando…' : 'Sacar'}
                                                </button>
                                                <button
                                                    onClick={() => setPorQuitar(null)}
                                                    className="h-8 rounded-full bg-[#f2f2f0] px-3 text-[12px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                                >
                                                    No
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="flex-none whitespace-nowrap text-[12px] font-semibold text-black/[.62]">
                                                    {dato.reportes.length > 0 ? `${p.presentes}/${p.reuniones}` : 'Sin datos'}
                                                </span>
                                                <button
                                                    onClick={() => { setPorQuitar(p.claveFila); setAviso(''); }}
                                                    aria-label={`Sacar a ${p.nombre} del grupo`}
                                                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-black/[.45] transition-colors hover:bg-[#fdecea] hover:text-[#a32218] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                                >
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                                                        <path d="M6 6l12 12M18 6L6 18" />
                                                    </svg>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {porQuitar && (
                            <p className="mt-4 rounded-[16px] bg-[#fdfaf4] px-4 py-3 text-[12.5px] font-medium leading-[1.55] text-black/[.66]">
                                Sacar a alguien borra su inscripción del grupo. No se le avisa por mail y no se puede
                                deshacer desde acá.
                            </p>
                        )}
                    </div>

                    {dato.reportes.length > 0 && (
                        <div className="rounded-[20px] bg-white px-[22px] py-5">
                            <p className="text-[15px] font-semibold text-[#0a0a0a]">Últimas reuniones</p>
                            <p className="mt-[5px] text-[12.5px] font-medium text-black/[.62]">
                                Promedia {conComa(dato.promedio)} presentes por reunión.
                            </p>
                            <div className="mt-4 flex flex-col gap-2.5">
                                {dato.reportes.slice(0, 6).map(r => (
                                    <div key={r.fecha} className="flex items-center gap-3">
                                        <span className="w-[86px] flex-none text-[12.5px] font-medium text-black/[.66]">
                                            {new Date(`${r.fecha}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                        </span>
                                        <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f0efec]">
                                            <span
                                                className="block h-full rounded-full"
                                                style={{
                                                    width: `${personas.length ? Math.min(100, Math.round((r.presentes / personas.length) * 100)) : 0}%`,
                                                    background: personas.length && r.presentes / personas.length >= 0.6 ? '#0b7a53' : '#e8b96a',
                                                }}
                                            />
                                        </span>
                                        <span className="w-[74px] flex-none text-right text-[12px] font-semibold text-[#0a0a0a]">
                                            {r.presentes} {r.presentes === 1 ? 'presente' : 'presentes'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default GruposCoordinador;

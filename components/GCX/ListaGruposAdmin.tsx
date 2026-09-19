import React from 'react';
import { Group, GroupCategory, GroupTag } from '../../types';

/**
 * Lista de grupos del panel (design-claude/Admin GCX - Panel).
 *
 * Escritorio: una tabla de filas de 58px con la ocupación como barra.
 * Mobile: una tarjeta por grupo. En los dos casos el "···" abre las mismas
 * acciones, que son todas las que el panel tenía antes.
 */

interface GroupsAdminListProps {
    groups: Group[];
    categories: GroupCategory[];
    tags: GroupTag[];
    onReview: (group: Group) => void;
    onReopen: (groupId: string) => void;
    onViewRegistrations: (group: Group) => void;
    onAddMember: (group: Group) => void;
    onEdit: (group: Group) => void;
    onDelete: (groupId: string) => void;
    onToggleCapacityLock: (group: Group) => void;
    onToggleVisibility: (group: Group) => void;
    openMenuGroupId: string | null;
    setOpenMenuGroupId: (id: string | null) => void;
    isLoading: boolean;
    seleccionados: string[];
    onToggleSeleccion: (id: string) => void;
    onToggleTodos: () => void;
    resumen: string;
    vacioTitulo: string;
    vacioTexto: string;
    vacioAccion: string;
    onVacioAccion: () => void;
}

interface EstiloEstado {
    bg: string;
    fg: string;
    dot: string;
    label: string;
}

const ESTADO_APROBADO: EstiloEstado = { bg: '#e9f6ed', fg: '#15803d', dot: '#16a34a', label: 'Aprobado' };
const ESTADO_PENDIENTE: EstiloEstado = { bg: '#fdf0dc', fg: '#7a4f10', dot: '#b45309', label: 'Pendiente' };
const ESTADO_FINALIZADO: EstiloEstado = { bg: '#f0efec', fg: 'rgba(0,0,0,.62)', dot: '#8f8f8a', label: 'Finalizado' };
const ESTADO_RECHAZADO: EstiloEstado = { bg: '#fdecea', fg: '#a32218', dot: '#a32218', label: 'Rechazado' };

const iniciales = (nombre: string) =>
    nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const GroupsAdminList: React.FC<GroupsAdminListProps> = ({
    groups,
    categories,
    tags,
    onReview,
    onReopen,
    onViewRegistrations,
    onAddMember,
    onEdit,
    onDelete,
    onToggleCapacityLock,
    onToggleVisibility,
    openMenuGroupId,
    setOpenMenuGroupId,
    isLoading,
    seleccionados,
    onToggleSeleccion,
    onToggleTodos,
    resumen,
    vacioTitulo,
    vacioTexto,
    vacioAccion,
    onVacioAccion,
}) => {
    const estaFinalizado = (group: Group) => {
        if (!group.endDate) return false;
        return group.endDate < new Date().toISOString().split('T')[0];
    };

    // Los grupos de parejas ocupan dos lugares por inscripción, así que el
    // cupo se cuenta distinto. Es la misma regla que usa el catálogo.
    const ocupados = (group: Group) => {
        const cat = categories.find(c => c.id === group.categoryId);
        const esParejas = (cat?.name?.toLowerCase() === 'parejas'
            || group.tags?.some(tId => tags.find(t => t.id === tId)?.name?.toLowerCase() === 'parejas'))
            && group.targetGender === 'Mixto';
        const inscriptos = group.registrations?.length || 0;
        return esParejas ? inscriptos * 2 : inscriptos;
    };

    const porcentaje = (group: Group) =>
        Math.min(100, Math.round((ocupados(group) / (group.maxCapacity || 1)) * 100));

    const estilo = (group: Group): EstiloEstado => {
        if (estaFinalizado(group) || group.status === 'finished') return ESTADO_FINALIZADO;
        if (group.status === 'rejected') return ESTADO_RECHAZADO;
        if (group.status === 'approved') return ESTADO_APROBADO;
        return ESTADO_PENDIENTE;
    };

    const prioridad = (group: Group): number => {
        if (estaFinalizado(group) || group.status === 'finished') return 3;
        if (group.status === 'rejected') return 2;
        if (group.status === 'approved') return 1;
        return 0;
    };

    const ordenados = [...groups].sort((a, b) => prioridad(a) - prioridad(b));

    const GRID = 'grid-cols-[30px_minmax(0,2.1fr)_minmax(0,1.25fr)_minmax(0,1.2fr)_124px_124px_92px]';

    const pill = (c: EstiloEstado, extra = '') => (
        <span
            className={`flex h-[26px] w-fit items-center gap-1.5 whitespace-nowrap rounded-full px-[11px] text-[11.5px] font-semibold ${extra}`}
            style={{ background: c.bg, color: c.fg }}
        >
            <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: c.dot }} />
            {c.label}
        </span>
    );

    const marcaOculto = (
        <span className="flex h-[26px] w-fit items-center whitespace-nowrap rounded-full bg-[#f0efec] px-[11px] text-[11.5px] font-semibold text-black/[.62]">
            Oculto
        </span>
    );

    const marcaCupos = (
        <span className="flex h-[26px] w-fit items-center whitespace-nowrap rounded-full bg-[#f0efec] px-[11px] text-[11.5px] font-semibold text-black/[.62]">
            Cupos bloqueados
        </span>
    );

    const accionesDe = (group: Group, movil: boolean) => {
        const finalizado = estaFinalizado(group);
        const pendiente = group.status === 'pending' || !group.status;
        const base = movil
            ? 'h-[42px] w-full rounded-full text-[13.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-1'
            : 'h-9 rounded-full px-[15px] text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-1';
        const normal = `${base} ${movil ? 'bg-[#f7f7f5]' : 'bg-white'} text-black/[.66]`;
        return (
            <>
                {pendiente && (
                    <button onClick={() => { onReview(group); setOpenMenuGroupId(null); }} className={`${base} bg-[#fdf0dc] text-[#7a4f10]`}>
                        Revisar la solicitud
                    </button>
                )}
                {(group.status === 'rejected' || finalizado) && (
                    <button onClick={() => { onReopen(group.id); setOpenMenuGroupId(null); }} className={normal}>
                        Re-abrir en otra temporada
                    </button>
                )}
                <button onClick={() => { onViewRegistrations(group); setOpenMenuGroupId(null); }} className={normal}>
                    Ver inscriptos
                </button>
                <button onClick={() => { onAddMember(group); setOpenMenuGroupId(null); }} className={normal}>
                    Agregar miembro
                </button>
                <button onClick={() => { onReview(group); setOpenMenuGroupId(null); }} className={normal}>
                    Ver detalle
                </button>
                <button onClick={() => { onEdit(group); setOpenMenuGroupId(null); }} className={normal}>
                    Editar
                </button>
                <button onClick={() => { onToggleCapacityLock(group); setOpenMenuGroupId(null); }} className={normal}>
                    {group.capacityLocked ? 'Desbloquear los cupos' : 'Bloquear los cupos'}
                </button>
                <button onClick={() => { onToggleVisibility(group); setOpenMenuGroupId(null); }} className={normal}>
                    {group.isHidden ? 'Mostrar en el catálogo' : 'Ocultar del catálogo'}
                </button>
                {!movil && <div className="flex-1" />}
                <button onClick={() => { onDelete(group.id); setOpenMenuGroupId(null); }} className={`${base} bg-[#fdecea] text-[#a32218]`}>
                    Eliminar grupo
                </button>
            </>
        );
    };

    if (isLoading) {
        return (
            <div className="mt-3.5 flex justify-center rounded-[20px] bg-white py-20">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#eceae6] border-t-[#0a0a0a]" />
            </div>
        );
    }

    if (ordenados.length === 0) {
        return (
            <div className="mt-3.5 flex flex-col items-center rounded-[20px] bg-white px-8 py-14 text-center">
                <div
                    className="h-[88px] w-[88px] rounded-full"
                    style={{ background: 'repeating-linear-gradient(135deg,#eceae6 0 8px,#e3e1dc 8px 16px)' }}
                />
                <p className="mt-[22px] text-[17px] font-semibold text-[#0a0a0a]">{vacioTitulo}</p>
                <p className="mt-[9px] max-w-[340px] text-[13.5px] font-medium leading-[1.6] text-black/[.62]">{vacioTexto}</p>
                <button
                    onClick={onVacioAccion}
                    className="mt-5 h-[46px] rounded-full bg-[#f2f2f0] px-[22px] text-[14px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                >
                    {vacioAccion}
                </button>
            </div>
        );
    }

    const todosTildados = ordenados.length > 0 && ordenados.every(g => seleccionados.includes(g.id));

    return (
        <>
            {/* Escritorio */}
            <div className="mt-3.5 hidden overflow-hidden rounded-[18px] bg-white md:block">
                <div className={`grid ${GRID} items-center gap-3.5 border-b border-[#f0efec] bg-[#fafaf9] px-[18px] py-[11px]`}>
                    <input
                        type="checkbox"
                        checked={todosTildados}
                        onChange={onToggleTodos}
                        aria-label="Tildar todos los grupos de la lista"
                        className="h-[17px] w-[17px] cursor-pointer accent-[#0a0a0a]"
                    />
                    {['Grupo', 'Anfitrión', 'Cuándo', 'Ocupación', 'Estado'].map(h => (
                        <span key={h} className="text-[11px] font-semibold uppercase tracking-[0.05em] text-black/[.6]">{h}</span>
                    ))}
                    <span />
                </div>

                {ordenados.map(group => {
                    const c = estilo(group);
                    const finalizado = estaFinalizado(group);
                    const pct = porcentaje(group);
                    const categoria = categories.find(cat => cat.id === group.categoryId)?.name || 'General';
                    const abierto = openMenuGroupId === group.id;
                    return (
                        <React.Fragment key={group.id}>
                            <div className={`grid ${GRID} h-[58px] items-center gap-3.5 border-b border-[#f4f3f1] px-[18px]`}>
                                <input
                                    type="checkbox"
                                    checked={seleccionados.includes(group.id)}
                                    onChange={() => onToggleSeleccion(group.id)}
                                    aria-label={`Tildar ${group.name}`}
                                    className="h-[17px] w-[17px] cursor-pointer accent-[#0a0a0a]"
                                />

                                <div className="flex min-w-0 items-center gap-[11px]">
                                    <div
                                        className={`relative flex h-[34px] w-[34px] flex-none items-center justify-center overflow-hidden rounded-[10px] bg-[#f2f2f0] text-[11px] font-semibold text-black/[.58] ${finalizado || group.isHidden ? 'grayscale' : ''}`}
                                    >
                                        {iniciales(group.name)}
                                        {group.imageUrl && (
                                            <img
                                                src={group.imageUrl}
                                                alt=""
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                className="absolute inset-0 h-full w-full object-cover"
                                            />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-[13.5px] font-semibold" style={{ color: finalizado ? 'rgba(0,0,0,.6)' : '#0a0a0a' }}>
                                            {group.name}
                                        </p>
                                        <p className="mt-0.5 truncate text-[11.5px] font-medium text-black/[.62]">
                                            {categoria}{group.imageUrl ? '' : ' · sin foto'}
                                        </p>
                                    </div>
                                </div>

                                <span className="truncate text-[13px] font-medium text-black/[.66]">
                                    {group.leaderName} {group.leaderSurname}
                                    {group.coHostFirstName ? ` y ${group.coHostFirstName}` : ''}
                                </span>

                                <span className="truncate text-[13px] font-medium text-black/[.66]">
                                    {group.meetingDay} {group.meetingTime}
                                </span>

                                <div className="flex items-center gap-[9px]">
                                    <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f0efec]">
                                        <div className="h-full" style={{ width: `${pct}%`, background: finalizado ? '#c9c8c4' : '#0a0a0a' }} />
                                    </div>
                                    <span className="whitespace-nowrap text-[12px] font-semibold text-black/[.66]">
                                        {ocupados(group)}/{group.maxCapacity}
                                    </span>
                                </div>

                                <div className="flex flex-col gap-1">
                                    {pill(c)}
                                    {group.isHidden && marcaOculto}
                                    {group.capacityLocked && marcaCupos}
                                </div>

                                <div className="flex justify-end gap-1.5">
                                    {/* "Ver" abre la ficha del grupo, que es la
                                        puerta de entrada: desde sus pestañas se
                                        llega a los inscriptos y al alta a mano. */}
                                    <button
                                        onClick={() => onReview(group)}
                                        className="h-8 rounded-full bg-[#f2f2f0] px-3 text-[12px] font-semibold text-black/[.66] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                                    >
                                        Ver
                                    </button>
                                    <button
                                        onClick={() => setOpenMenuGroupId(abierto ? null : group.id)}
                                        aria-label={`Acciones de ${group.name}`}
                                        aria-expanded={abierto}
                                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-semibold leading-[.5] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] ${abierto ? 'bg-[#0a0a0a] text-white' : 'text-black/[.58] hover:bg-[#f2f2f0]'}`}
                                    >
                                        ···
                                    </button>
                                </div>
                            </div>

                            {abierto && (
                                <div className="flex flex-wrap gap-2 border-b border-[#f0efec] bg-[#fafaf9] px-[18px] pb-3.5 pt-2.5">
                                    {accionesDe(group, false)}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}

                <div className="flex items-center justify-between gap-3.5 bg-[#fcfcfb] px-[18px] py-[13px]">
                    <span className="text-[12.5px] font-medium text-black/[.62]">{resumen}</span>
                    <span className="text-[12.5px] font-medium text-black/[.62]">Las acciones en rojo no se pueden deshacer.</span>
                </div>
            </div>

            {/* Mobile */}
            <div className="mt-3 flex flex-col gap-2.5 md:hidden">
                {ordenados.map(group => {
                    const c = estilo(group);
                    const finalizado = estaFinalizado(group);
                    const pct = porcentaje(group);
                    const categoria = categories.find(cat => cat.id === group.categoryId)?.name || 'General';
                    const abierto = openMenuGroupId === group.id;
                    return (
                        <div key={group.id} className="rounded-[20px] bg-white px-4 py-3.5">
                            <div className="flex items-start gap-3">
                                <div
                                    className={`relative flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-[13px] bg-[#f2f2f0] text-[13px] font-semibold text-black/[.58] ${finalizado || group.isHidden ? 'grayscale' : ''}`}
                                >
                                    {iniciales(group.name)}
                                    {group.imageUrl && (
                                        <img
                                            src={group.imageUrl}
                                            alt=""
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            className="absolute inset-0 h-full w-full object-cover"
                                        />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[15.5px] font-semibold" style={{ color: finalizado ? 'rgba(0,0,0,.6)' : '#0a0a0a' }}>
                                        {group.name}
                                    </p>
                                    <p className="mt-[3px] text-[12.5px] font-medium text-black/[.62]">
                                        {categoria}{group.imageUrl ? '' : ' · sin foto'}
                                    </p>
                                </div>
                                {pill(c)}
                            </div>

                            <div className="mt-3 flex flex-col gap-[5px]">
                                <p className="text-[13px] font-medium text-black/[.66]">
                                    {group.leaderName} {group.leaderSurname}
                                    {group.coHostFirstName ? ` y ${group.coHostFirstName} ${group.coHostLastName || ''}` : ''}
                                </p>
                                <p className="text-[13px] font-medium text-black/[.66]">{group.meetingDay} {group.meetingTime}</p>
                                {(group.isHidden || group.capacityLocked) && (
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                        {group.isHidden && marcaOculto}
                                        {group.capacityLocked && marcaCupos}
                                    </div>
                                )}
                            </div>

                            <div className="mt-3 flex items-center gap-[11px]">
                                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f0efec]">
                                    <div className="h-full" style={{ width: `${pct}%`, background: finalizado ? '#c9c8c4' : '#0a0a0a' }} />
                                </div>
                                <span className="whitespace-nowrap text-[12.5px] font-semibold text-black/[.66]">
                                    {ocupados(group)}/{group.maxCapacity}
                                </span>
                            </div>

                            <div className="mt-3.5 flex gap-2">
                                {/* Misma puerta de entrada que en escritorio: la
                                    ficha. Los inscriptos siguen a un toque, desde
                                    sus pestañas o desde el "···" de acá al lado. */}
                                <button
                                    onClick={() => onReview(group)}
                                    className="h-[42px] flex-1 rounded-full bg-[#f2f2f0] text-[13.5px] font-semibold text-[#0a0a0a]"
                                >
                                    Ver la ficha
                                </button>
                                <button
                                    onClick={() => setOpenMenuGroupId(abierto ? null : group.id)}
                                    aria-label={`Acciones de ${group.name}`}
                                    aria-expanded={abierto}
                                    className={`h-[42px] w-[46px] rounded-full text-[16px] font-semibold leading-[.5] ${abierto ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.58]'}`}
                                >
                                    ···
                                </button>
                            </div>

                            {abierto && (
                                <div className="mt-2.5 flex flex-col gap-[7px] border-t border-[#f0efec] pt-3">
                                    {accionesDe(group, true)}
                                </div>
                            )}
                        </div>
                    );
                })}

                <p className="mx-0.5 mt-1 text-[12px] font-medium text-black/[.62]">{resumen}</p>
            </div>
        </>
    );
};

export default GroupsAdminList;

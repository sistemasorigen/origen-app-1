import React, { useState } from 'react';
import { Search, X, Plus, SlidersHorizontal, MoreHorizontal } from 'lucide-react';
import { Group } from '../../types';

/**
 * Barra de la sección Grupos (design-claude/Admin GCX - Panel).
 *
 * Escritorio: buscador, temporada, Moderación y Crear grupo en una línea;
 * abajo los chips de estado con su número. Mobile: buscador, Filtros —que
 * abre una hoja con estado y temporada— y el botón de acciones.
 */

export type EstadoGrupo = 'ALL' | 'APPROVED' | 'PENDING' | 'FINALIZED';
export type TemporadaFiltro = 'ALL' | 'S1' | 'S2' | 'S3';

interface GroupsAdminToolbarProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    statusFilter: EstadoGrupo;
    setStatusFilter: (status: EstadoGrupo) => void;
    seasonFilter: TemporadaFiltro;
    setSeasonFilter: (season: TemporadaFiltro) => void;
    /** Grupos de la temporada elegida, para contar cada estado. */
    gruposDeTemporada: Group[];
    /** Cuántos quedan después de aplicar estado y búsqueda. */
    resultados: number;
    pendingDropoutCount: number;
    onCreateGroup: () => void;
    onOpenModeracion: () => void;
    onResetFiltros: () => void;
}

const esFinalizado = (g: Group) => !!g.endDate && g.endDate < new Date().toISOString().split('T')[0];

const GroupsAdminToolbar: React.FC<GroupsAdminToolbarProps> = ({
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    seasonFilter, setSeasonFilter,
    gruposDeTemporada,
    resultados,
    pendingDropoutCount,
    onCreateGroup,
    onOpenModeracion,
    onResetFiltros,
}) => {
    const [hojaFiltros, setHojaFiltros] = useState(false);

    const cuenta = {
        ALL: gruposDeTemporada.length,
        APPROVED: gruposDeTemporada.filter(g => g.status === 'approved' && !esFinalizado(g)).length,
        PENDING: gruposDeTemporada.filter(g => g.status === 'pending' || !g.status).length,
        FINALIZED: gruposDeTemporada.filter(g => g.status === 'approved' && esFinalizado(g)).length,
    };

    const filtrosActivos = (statusFilter === 'ALL' ? 0 : 1) + (seasonFilter === 'ALL' ? 0 : 1);

    const chip = (activo: boolean, enHoja = false) =>
        `h-9 px-3.5 rounded-full flex items-center gap-2 text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${activo ? 'bg-[#0a0a0a] text-white' : `${enHoja ? 'bg-[#f7f7f5]' : 'bg-white'} text-black/[.64] hover:text-[#0a0a0a]`}`;

    const chipN = (activo: boolean) =>
        `text-[12px] font-semibold ${activo ? 'text-white/70' : 'text-black/[.6]'}`;

    const seg = (activo: boolean) =>
        `h-9 px-[15px] rounded-full text-[12.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] ${activo ? 'bg-[#0a0a0a] text-white' : 'text-black/[.62] hover:text-[#0a0a0a]'}`;

    const ancho = (activo: boolean) =>
        `min-w-[64px] h-[52px] px-5 rounded-full text-[15px] font-semibold ${activo ? 'flex-1 bg-[#0a0a0a] text-white' : 'flex-none bg-[#f2f2f0] text-black/[.64]'}`;

    const ESTADOS: { id: EstadoGrupo; label: string; punto?: string }[] = [
        { id: 'ALL', label: 'Todos' },
        { id: 'APPROVED', label: 'Aprobados', punto: '#16a34a' },
        { id: 'PENDING', label: 'Pendientes', punto: '#b45309' },
        { id: 'FINALIZED', label: 'Finalizados', punto: '#8f8f8a' },
    ];

    const TEMPORADAS: { id: TemporadaFiltro; corto: string; largo: string }[] = [
        { id: 'ALL', corto: 'Todas', largo: 'Todas' },
        { id: 'S1', corto: 'T1', largo: 'Temporada 1' },
        { id: 'S2', corto: 'T2', largo: '2' },
        { id: 'S3', corto: 'T3', largo: '3' },
    ];

    const chipsEstado = (enHoja = false) => (
        <div className="flex flex-wrap gap-2">
            {ESTADOS.map(e => {
                const activo = statusFilter === e.id;
                return (
                    <button key={e.id} onClick={() => setStatusFilter(e.id)} className={chip(activo, enHoja)}>
                        {e.punto && <span className="h-[7px] w-[7px] rounded-full" style={{ background: e.punto }} />}
                        {e.label}
                        <span className={chipN(activo)}>{cuenta[e.id]}</span>
                    </button>
                );
            })}
        </div>
    );

    return (
        <>
            <div className="flex flex-wrap items-center gap-2.5">
                {/* Buscador */}
                <div className="flex h-[42px] min-w-[132px] flex-1 items-center gap-2.5 rounded-full bg-white pl-[17px] pr-2 md:min-w-[180px]">
                    <Search className="h-4 w-4 flex-none text-black/[.58]" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por grupo o por líder"
                        aria-label="Buscar grupos"
                        className="campo-desnudo min-w-0 flex-1 bg-transparent text-[13.5px] font-medium text-[#0a0a0a]"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            aria-label="Limpiar la búsqueda"
                            className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-[#f2f2f0] text-[#0a0a0a]"
                        >
                            <X className="h-[13px] w-[13px]" />
                        </button>
                    )}
                </div>

                {/* Mobile: filtros y acciones */}
                <button
                    onClick={() => setHojaFiltros(true)}
                    className="flex h-[42px] flex-none items-center gap-1.5 rounded-full bg-white px-3 text-[13px] font-semibold text-black/[.64] md:hidden"
                >
                    <SlidersHorizontal className="h-[15px] w-[15px]" />
                    Filtros
                    <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${filtrosActivos ? 'bg-[#0a0a0a] text-white' : 'bg-[#f0efec] text-black/[.6]'}`}>
                        {filtrosActivos}
                    </span>
                </button>
                <button
                    onClick={onOpenModeracion}
                    aria-label="Moderación y acciones"
                    className="relative flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-white text-black/[.58] md:hidden"
                >
                    <MoreHorizontal className="h-[18px] w-[18px]" />
                    {pendingDropoutCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#a32218] px-1 text-[10px] font-semibold text-white">
                            {pendingDropoutCount > 9 ? '9+' : pendingDropoutCount}
                        </span>
                    )}
                </button>

                {/* Escritorio: temporada, moderación y crear */}
                <div className="hidden flex-none items-center gap-2.5 md:flex">
                    <div className="flex gap-[3px] rounded-full bg-[#eceae6] p-[3px]">
                        {TEMPORADAS.map(t => (
                            <button key={t.id} onClick={() => setSeasonFilter(t.id)} className={seg(seasonFilter === t.id)}>
                                {t.corto}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={onOpenModeracion}
                        className="relative flex h-[42px] items-center gap-2 rounded-full bg-white px-[17px] text-[13px] font-semibold text-black/[.64] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        <SlidersHorizontal className="h-[15px] w-[15px]" />
                        Moderación
                        {pendingDropoutCount > 0 && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#a32218] px-1.5 text-[11px] font-semibold text-white">
                                {pendingDropoutCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={onCreateGroup}
                        className="flex h-[42px] items-center gap-2 rounded-full bg-[#0a0a0a] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        <Plus className="h-[15px] w-[15px]" />
                        Crear grupo
                    </button>
                </div>
            </div>

            {/* Chips de estado — escritorio */}
            <div className="mt-3.5 hidden md:block">{chipsEstado()}</div>

            {/* Resumen — mobile */}
            <p className="mx-0.5 mt-3.5 text-[12px] font-semibold text-black/[.62] md:hidden">
                {resultados} de {gruposDeTemporada.length} grupos
            </p>

            {/* Hoja de filtros — mobile */}
            {hojaFiltros && (
                <div className="fixed inset-0 z-[60] md:hidden">
                    <div className="absolute inset-0 bg-[rgba(10,10,10,.4)]" onClick={() => setHojaFiltros(false)} />
                    <div className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-auto rounded-t-[28px] bg-white px-[18px] pb-6 pt-3.5">
                        <div className="mx-auto mb-[18px] h-1 w-[38px] rounded-full bg-[#e2e2de]" />
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58]">Estado</p>
                        {chipsEstado(true)}
                        <p className="mb-3 mt-[22px] text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58]">Temporada</p>
                        <div className="flex gap-2">
                            {TEMPORADAS.map(t => (
                                <button key={t.id} onClick={() => setSeasonFilter(t.id)} className={ancho(seasonFilter === t.id)}>
                                    {seasonFilter === t.id ? t.largo : t.corto}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => setHojaFiltros(false)}
                            className="mt-[22px] h-[54px] w-full rounded-full bg-[#0a0a0a] text-[16px] font-semibold text-white"
                        >
                            Ver {resultados} grupos
                        </button>
                        <button
                            onClick={() => { onResetFiltros(); setHojaFiltros(false); }}
                            className="mt-[9px] h-12 w-full rounded-full bg-[#f2f2f0] text-[15px] font-semibold text-[#0a0a0a]"
                        >
                            Limpiar filtros
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default GroupsAdminToolbar;

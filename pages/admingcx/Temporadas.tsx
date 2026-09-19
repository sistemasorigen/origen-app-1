import React, { useState, useEffect } from 'react';
import { AppConfig, SeasonSettings, DEFAULT_SEASON_SETTINGS, Group } from '../../types';
import { db } from '../../services/dbService';
import { supabaseService } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import { Loader2 } from 'lucide-react';

/**
 * Sección Temporadas del panel (design-claude/Admin GCX - Panel).
 *
 * Una tarjeta por temporada con su estado, las dos fechas y cuántos grupos
 * arrancan adentro de ese rango. Mientras no se esté editando, la tarjeta
 * es de sola lectura: son fechas que se tocan dos o tres veces al año.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "03-23" (MM-DD) → "23 mar" */
const fechaLegible = (mmdd: string) => {
    if (!mmdd || !mmdd.includes('-')) return '—';
    const [mes, dia] = mmdd.split('-');
    const i = parseInt(mes, 10) - 1;
    if (isNaN(i) || !MESES[i]) return '—';
    return `${parseInt(dia, 10)} ${MESES[i]}`;
};

/** "03-23" → 323, para comparar dos fechas sin año. */
const aNumero = (mmdd: string) => {
    if (!mmdd || !mmdd.includes('-')) return null;
    const [mes, dia] = mmdd.split('-').map(n => parseInt(n, 10));
    if (isNaN(mes) || isNaN(dia)) return null;
    return mes * 100 + dia;
};

const TemporadasContent: React.FC = () => {
    const { showToast } = useAdminGCXToast();
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingSeasons, setEditingSeasons] = useState<SeasonSettings | null>(null);
    const [isSavingSeasons, setIsSavingSeasons] = useState(false);

    useEffect(() => {
        setLoading(true);
        Promise.all([
            supabaseService.getAppConfig().then(remoteConfig => {
                if (remoteConfig) {
                    db.saveAppConfig(remoteConfig);
                    setConfig(remoteConfig);
                } else {
                    setConfig(db.getAppConfig());
                }
            }),
            supabaseService.getGroupsForAdmin().then(setGroups).catch(() => setGroups([])),
        ]).finally(() => setLoading(false));
    }, []);

    const handleSaveSeasonSettings = async () => {
        if (!editingSeasons || !config) return;
        setIsSavingSeasons(true);
        try {
            const updatedConfig: AppConfig = {
                ...config,
                groupsConfig: {
                    ...config?.groupsConfig,
                    activeBlurLevel: config?.groupsConfig?.activeBlurLevel || 'md',
                    seasonSettings: editingSeasons
                }
            };
            db.saveAppConfig(updatedConfig);
            const ok = await supabaseService.saveAppConfig(updatedConfig);
            if (ok) {
                setConfig(updatedConfig);
                setEditingSeasons(null);
                showToast('Temporadas guardadas');
            } else {
                showToast('Error al guardar', 'error');
            }
        } catch {
            showToast('Error al guardar', 'error');
        } finally {
            setIsSavingSeasons(false);
        }
    };

    if (loading || !config) {
        return (
            <div className="flex justify-center rounded-[20px] bg-white py-20">
                <Loader2 className="h-7 w-7 animate-spin text-black/20" />
            </div>
        );
    }

    const seasonSettings: SeasonSettings = config?.groupsConfig?.seasonSettings ?? DEFAULT_SEASON_SETTINGS;
    const enEdicion = !!editingSeasons;
    const vista = editingSeasons ?? seasonSettings;

    // Cuántos grupos arrancan dentro del rango de cada temporada. Se compara
    // día y mes, sin año, porque las fechas de la temporada se guardan así.
    const gruposDe = (inicio: string, fin: string) => {
        const desde = aNumero(inicio);
        const hasta = aNumero(fin);
        if (desde === null || hasta === null) return 0;
        return groups.filter(g => {
            if (!g.startDate) return false;
            const partes = g.startDate.split('-');
            if (partes.length < 3) return false;
            const md = parseInt(partes[1], 10) * 100 + parseInt(partes[2], 10);
            return md >= desde && md <= hasta;
        }).length;
    };

    const actualizar = (clave: 'S1' | 'S2' | 'S3', campo: 'label' | 'startDate' | 'endDate' | 'isOpen', valor: string | boolean) => {
        if (!editingSeasons) return;
        const copia: SeasonSettings = JSON.parse(JSON.stringify(editingSeasons));
        (copia.seasons[clave] as any)[campo] = valor;
        setEditingSeasons(copia);
    };

    const pill = (abierta: boolean) => abierta
        ? { background: '#e9f6ed', color: '#15803d' }
        : { background: '#f0efec', color: 'rgba(0,0,0,.62)' };

    return (
        <>
            {/* Año activo y edición */}
            <div className="flex flex-wrap items-center gap-3.5 rounded-[20px] bg-white px-5 py-4">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-black/[.58]">Año activo</p>
                    {enEdicion ? (
                        <input
                            type="number"
                            min={2024}
                            max={2030}
                            value={editingSeasons!.activeYear}
                            onChange={e => setEditingSeasons({ ...editingSeasons!, activeYear: parseInt(e.target.value) || new Date().getFullYear() })}
                            aria-label="Año activo de las temporadas"
                            className="mt-1 h-11 w-28 px-3 text-[17px]"
                        />
                    ) : (
                        <p className="mt-0.5 text-[21px] font-semibold tracking-[-0.018em] text-[#0a0a0a]">{seasonSettings.activeYear}</p>
                    )}
                    <p className="mt-1 text-[12.5px] font-medium text-black/[.62]">
                        Las fechas de abajo se aplican a este año.
                    </p>
                </div>

                <div className="flex flex-none gap-2">
                    {!enEdicion ? (
                        <button
                            onClick={() => setEditingSeasons(JSON.parse(JSON.stringify(seasonSettings)))}
                            className="h-[42px] rounded-full bg-[#0a0a0a] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                        >
                            Editar las temporadas
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={() => setEditingSeasons(null)}
                                className="h-[42px] rounded-full bg-[#f2f2f0] px-5 text-[14px] font-semibold text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveSeasonSettings}
                                disabled={isSavingSeasons}
                                className="h-[42px] rounded-full bg-[#0a0a0a] px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                {isSavingSeasons ? 'Guardando…' : 'Guardar'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Las tres temporadas */}
            <div className="mt-3 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
                {(['S1', 'S2', 'S3'] as const).map(clave => {
                    const s = vista.seasons[clave];
                    const cantidad = gruposDe(s.startDate, s.endDate);
                    return (
                        <div key={clave} className="rounded-[20px] bg-white p-5">
                            <div className="flex items-center gap-2.5">
                                {enEdicion ? (
                                    <input
                                        type="text"
                                        value={s.label}
                                        onChange={e => actualizar(clave, 'label', e.target.value)}
                                        aria-label={`Nombre de la ${clave}`}
                                        className="h-10 min-w-0 flex-1 px-3 text-[15px]"
                                    />
                                ) : (
                                    <p className="min-w-0 flex-1 truncate text-[17px] font-semibold text-[#0a0a0a]">{s.label}</p>
                                )}

                                {enEdicion ? (
                                    <button
                                        onClick={() => actualizar(clave, 'isOpen', !s.isOpen)}
                                        aria-pressed={s.isOpen}
                                        className="flex h-[26px] flex-none items-center rounded-full px-[11px] text-[11.5px] font-semibold"
                                        style={pill(s.isOpen)}
                                    >
                                        {s.isOpen ? 'Abierta' : 'Cerrada'}
                                    </button>
                                ) : (
                                    <span
                                        className="flex h-[26px] flex-none items-center rounded-full px-[11px] text-[11.5px] font-semibold"
                                        style={pill(s.isOpen)}
                                    >
                                        {s.isOpen ? 'Abierta' : 'Cerrada'}
                                    </span>
                                )}
                            </div>

                            <div className="mt-4 flex gap-2.5">
                                {([['Inicio', 'startDate'], ['Fin', 'endDate']] as const).map(([rotulo, campo]) => (
                                    <div key={campo} className="flex h-14 flex-1 flex-col justify-center rounded-[16px] bg-[#f7f7f5] px-[15px]">
                                        <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-black/[.58]">{rotulo}</span>
                                        {enEdicion ? (
                                            <input
                                                type="text"
                                                placeholder="23-03"
                                                maxLength={5}
                                                value={(s[campo] || '').split('-').reverse().join('-')}
                                                onChange={e => actualizar(clave, campo, e.target.value.split('-').reverse().join('-'))}
                                                aria-label={`${rotulo} de la ${s.label} (día-mes)`}
                                                className="campo-desnudo w-full bg-transparent text-[14px] font-medium tabular-nums text-[#0a0a0a]"
                                            />
                                        ) : (
                                            <span className="text-[14px] font-medium text-[#0a0a0a]">
                                                {fechaLegible(s[campo])} {vista.activeYear}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <p className="mt-3.5 text-[12.5px] font-medium leading-[1.55] text-black/[.62]">
                                {enEdicion
                                    ? 'Las fechas se escriben día-mes, por ejemplo 23-03.'
                                    : `${cantidad} ${cantidad === 1 ? 'grupo arranca' : 'grupos arrancan'} dentro de este rango. ${s.isOpen ? 'Los anfitriones pueden crear grupos en esta temporada.' : 'Está cerrada: no se pueden crear grupos.'}`}
                            </p>
                        </div>
                    );
                })}
            </div>
        </>
    );
};

const Temporadas: React.FC = () => (
    <AdminGCXLayout title="Temporadas">
        <TemporadasContent />
    </AdminGCXLayout>
);

export default Temporadas;

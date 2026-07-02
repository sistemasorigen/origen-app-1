import React, { useState, useEffect } from 'react';
import { AppConfig, SeasonSettings, DEFAULT_SEASON_SETTINGS } from '../../types';
import { db } from '../../services/dbService';
import { supabaseService } from '../../services/supabaseService';
import AdminGCXLayout, { useAdminGCXToast } from '../../components/layout/AdminGCXLayout';
import { Loader2 } from 'lucide-react';

const TemporadasContent: React.FC = () => {
    const { showToast } = useAdminGCXToast();
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingSeasons, setEditingSeasons] = useState<SeasonSettings | null>(null);
    const [isSavingSeasons, setIsSavingSeasons] = useState(false);

    useEffect(() => {
        setLoading(true);
        supabaseService.getAppConfig().then(remoteConfig => {
            if (remoteConfig) {
                db.saveAppConfig(remoteConfig);
                setConfig(remoteConfig);
            } else {
                setConfig(db.getAppConfig());
            }
            setLoading(false);
        });
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
                showToast('Configuración de temporadas guardada', 'success');
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
            <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
            </div>
        );
    }

    const seasonSettings: SeasonSettings = config?.groupsConfig?.seasonSettings ?? DEFAULT_SEASON_SETTINGS;

    return (
            <div className="max-w-4xl">
                <div className="bg-white p-8 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-black">
                        <div>
                            <h4 className="font-black text-base uppercase tracking-tight">Configuración de Temporadas</h4>
                            <p className="text-xs font-medium text-neutral-500 mt-1">
                                Habilitá o deshabilitá en qué temporadas se puede crear o re-abrir un grupo. También podés ajustar el año activo y las fechas exactas.
                            </p>
                        </div>
                        {!editingSeasons ? (
                            <button
                                onClick={() => setEditingSeasons(JSON.parse(JSON.stringify(seasonSettings)))}
                                className="px-4 py-2 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all shrink-0"
                            >
                                Editar
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingSeasons(null)}
                                    className="px-4 py-2 text-xs font-black uppercase tracking-widest border-2 border-black hover:bg-neutral-100 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveSeasonSettings}
                                    disabled={isSavingSeasons}
                                    className="px-4 py-2 bg-black text-white text-xs font-black uppercase tracking-widest border-2 border-black hover:opacity-80 transition-all disabled:opacity-50 shrink-0"
                                >
                                    {isSavingSeasons ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Año activo */}
                    <div className="mb-6 p-4 border-2 border-neutral-200 bg-neutral-50 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest text-neutral-600">Año activo de temporadas</p>
                            <p className="text-[10px] font-medium text-neutral-400 mt-0.5">Las fechas de cada temporada se aplicarán a este año.</p>
                        </div>
                        {editingSeasons ? (
                            <input
                                type="number"
                                min={2024}
                                max={2030}
                                value={editingSeasons.activeYear}
                                onChange={e => setEditingSeasons({ ...editingSeasons, activeYear: parseInt(e.target.value) || new Date().getFullYear() })}
                                className="w-24 h-10 px-3 border-2 border-black font-black text-center text-base focus:outline-none focus:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            />
                        ) : (
                            <span className="text-3xl font-black tabular-nums">{seasonSettings.activeYear}</span>
                        )}
                    </div>

                    {/* Las 3 temporadas */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(['S1', 'S2', 'S3'] as const).map(key => {
                            const s = editingSeasons ? editingSeasons.seasons[key] : seasonSettings.seasons[key];
                            const year = editingSeasons ? editingSeasons.activeYear : seasonSettings.activeYear;
                            return (
                                <div
                                    key={key}
                                    className={`border-2 p-5 transition-all ${s.isOpen ? 'border-black bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'border-neutral-200 bg-neutral-50'}`}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{key}</p>
                                        {editingSeasons ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = JSON.parse(JSON.stringify(editingSeasons));
                                                    updated.seasons[key].isOpen = !updated.seasons[key].isOpen;
                                                    setEditingSeasons(updated);
                                                }}
                                                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider border-2 transition-all ${editingSeasons.seasons[key].isOpen ? 'bg-black border-black text-white' : 'bg-white border-neutral-300 text-neutral-400 hover:border-black'}`}
                                            >
                                                {editingSeasons.seasons[key].isOpen ? 'Abierta' : 'Cerrada'}
                                            </button>
                                        ) : (
                                            <span className={`px-2 py-1 text-[9px] font-black uppercase tracking-wider ${s.isOpen ? 'bg-black text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                                                {s.isOpen ? 'Abierta' : 'Cerrada'}
                                            </span>
                                        )}
                                    </div>

                                    {editingSeasons ? (
                                        <input
                                            type="text"
                                            value={editingSeasons.seasons[key].label}
                                            onChange={e => {
                                                const updated = JSON.parse(JSON.stringify(editingSeasons));
                                                updated.seasons[key].label = e.target.value;
                                                setEditingSeasons(updated);
                                            }}
                                            className="w-full h-8 px-2 border-2 border-black font-black text-sm uppercase tracking-tight mb-3 focus:outline-none"
                                        />
                                    ) : (
                                        <p className="font-black text-base uppercase tracking-tight mb-3">{s.label}</p>
                                    )}

                                    <div className="space-y-2">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Inicio (DD-MM)</p>
                                            {editingSeasons ? (
                                                <input
                                                    type="text"
                                                    placeholder="23-03"
                                                    maxLength={5}
                                                    value={editingSeasons.seasons[key].startDate.split('-').reverse().join('-')}
                                                    onChange={e => {
                                                        const updated = JSON.parse(JSON.stringify(editingSeasons));
                                                        updated.seasons[key].startDate = e.target.value.split('-').reverse().join('-');
                                                        setEditingSeasons(updated);
                                                    }}
                                                    className="w-full h-8 px-2 border-2 border-black font-bold text-sm text-center tabular-nums focus:outline-none"
                                                />
                                            ) : (
                                                <p className="text-sm font-bold tabular-nums text-neutral-600">{(s.startDate || '').split('-').reverse().join('-')} · {year}</p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 mb-1">Fin (DD-MM)</p>
                                            {editingSeasons ? (
                                                <input
                                                    type="text"
                                                    placeholder="17-05"
                                                    maxLength={5}
                                                    value={editingSeasons.seasons[key].endDate.split('-').reverse().join('-')}
                                                    onChange={e => {
                                                        const updated = JSON.parse(JSON.stringify(editingSeasons));
                                                        updated.seasons[key].endDate = e.target.value.split('-').reverse().join('-');
                                                        setEditingSeasons(updated);
                                                    }}
                                                    className="w-full h-8 px-2 border-2 border-black font-bold text-sm text-center tabular-nums focus:outline-none"
                                                />
                                            ) : (
                                                <p className="text-sm font-bold tabular-nums text-neutral-600">{(s.endDate || '').split('-').reverse().join('-')} · {year}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
    );
};

const Temporadas: React.FC = () => (
    <AdminGCXLayout title="Temporadas">
        <TemporadasContent />
    </AdminGCXLayout>
);

export default Temporadas;

import React, { useState, useEffect } from 'react';
import { supabaseService } from '../../../services/supabaseService';
import { supabase } from '../../../services/supabaseClient';
import { DpadreFamilia } from '../../../types';
import { LeaderboardRankings } from '@/components/ui/leaderboard-rankings';
import { LeaderboardPodium } from '@/components/ui/leaderboard-podium';

const RankingDPadre: React.FC = () => {
    const [ranking, setRanking] = useState<DpadreFamilia[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabaseService.getRankingDPadre()
            .then(data => { setRanking(data); setLoading(false); });
    }, []);

    useEffect(() => {
        const channel = supabase
            .channel('ranking-dpadre')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'dpadre_familias' },
                () => { supabaseService.getRankingDPadre().then(setRanking); }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const rankingItems = ranking.map((f, idx) => ({
        userId:   f.id,
        userName: `${f.padreNombre} ${f.padreApellido}`,
        rank:     idx + 1,
        value:    f.totalPoints,
        byline:   (f.hijos || []).length > 0
            ? (f.hijos || []).map(h => h.nombre).join(', ')
            : null,
        displayed: true,
    }));

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-2xl mx-auto px-4 py-10">

                {/* Header */}
                <div className="text-center mb-10">
                    <img
                        src="/origen-logo.png"
                        alt="Origen"
                        className="h-10 w-auto object-contain mx-auto mb-4"
                    />
                    <h1 className="text-3xl font-semibold text-gray-900 tracking-tight mb-1">
                        Ranking
                    </h1>
                    <p className="text-sm text-gray-400 font-normal">
                        Día del Padre
                    </p>
                </div>

                {/* Loading */}
                {loading && (
                    <div className="space-y-3">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="h-16 rounded-2xl bg-gray-50 border border-gray-100 animate-pulse" />
                        ))}
                    </div>
                )}

                {/* Vacío */}
                {!loading && ranking.length === 0 && (
                    <div className="text-center py-16">
                        <p className="text-sm text-gray-400 font-medium">
                            Todavía no hay familias inscriptas
                        </p>
                    </div>
                )}

                {/* Ranking */}
                {!loading && ranking.length > 0 && (
                    <div className="space-y-8">
                        {/* Podio top 3 */}
                        <LeaderboardPodium
                            rankings={rankingItems.slice(0, 3)}
                            showAvatar={false}
                            valueLabel="pts"
                        />

                        {/* Tabla completa */}
                        <div>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-3">
                                Clasificación
                            </p>
                            <LeaderboardRankings
                                rankings={rankingItems}
                                showPagination={rankingItems.length > 10}
                                defaultPageSize={25}
                            />
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default RankingDPadre;

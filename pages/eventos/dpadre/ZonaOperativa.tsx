import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabaseService } from '../../../services/supabaseService';
import { DpadreFamilia, User } from '../../../types';
import { Search, Loader2, Users, ChevronRight } from 'lucide-react';

interface ZonaOperativaProps {
    zona: 'trivia' | 'futbol';
    titulo: string;
    currentUser: User;
}

const ZonaOperativa: React.FC<ZonaOperativaProps> = ({ zona, titulo, currentUser }) => {
    const navigate = useNavigate();

    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults]       = useState<DpadreFamilia[]>([]);
    const [searching, setSearching]   = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        clearTimeout(debounceRef.current);
        if (!searchTerm.trim()) {
            setResults([]);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            const data = await supabaseService.buscarFamilias(searchTerm);
            setResults(data);
            setSearching(false);
        }, 350);
        return () => clearTimeout(debounceRef.current);
    }, [searchTerm]);

    return (
        <div className="min-h-screen bg-white">
            <div className="max-w-2xl mx-auto px-4 py-10">

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-semibold text-gray-900 tracking-tight">
                        {titulo}
                    </h1>
                </div>

                {/* Buscador */}
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-300 pointer-events-none" />
                    {searching && (
                        <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 animate-spin" />
                    )}
                    <input
                        type="text"
                        autoFocus
                        placeholder="Buscar por nombre o apellido..."
                        aria-label="Buscar familia por nombre o apellido"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full h-14 pl-12 pr-12 rounded-2xl border border-gray-200 text-base font-medium text-gray-900 placeholder:text-gray-300 shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus:outline-none focus:border-gray-400 focus:ring-4 focus:ring-gray-50 transition-all"
                    />
                </div>

                {/* Resultados */}
                {results.length > 0 && (
                    <div className="space-y-2">
                        {results.map(familia => (
                            <button
                                key={familia.id}
                                type="button"
                                onClick={() => navigate(`/eventos/dpadre/${familia.id}?zona=${zona}`)}
                                className="w-full flex items-center justify-between px-5 py-4 bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-[2px] transition-all duration-200 text-left"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-semibold text-gray-500">
                                            {familia.padreNombre.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 text-sm truncate">
                                            {familia.padreNombre} {familia.padreApellido}
                                        </p>
                                        <p className="text-xs text-gray-400 font-normal truncate">
                                            {(familia.hijos || []).length} hijo{(familia.hijos || []).length !== 1 ? 's' : ''}
                                            {' · '}
                                            <span className="font-semibold text-gray-600">
                                                {familia.totalPoints} pts
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                            </button>
                        ))}
                    </div>
                )}

                {/* Sin resultados */}
                {searchTerm.trim() && !searching && results.length === 0 && (
                    <div className="text-center py-12">
                        <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                        <p className="text-sm text-gray-400 font-medium">
                            No encontramos familias con ese nombre
                        </p>
                    </div>
                )}

                {/* Estado inicial */}
                {!searchTerm.trim() && (
                    <div className="text-center py-12">
                        <p className="text-sm text-gray-300 font-medium">
                            Escribí el nombre o apellido para buscar
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ZonaOperativa;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { searchDianinoSession, DianinoSearchResultRow } from '../../../services/supabaseService';
import { ArrowLeft, Search, User, Baby, Loader2, Check } from 'lucide-react';

const LOGO_URL = '/origen-logo-full.png';

const inputClass = 'w-full p-3 border-2 border-black font-bold text-black bg-white outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-shadow placeholder:text-neutral-300';
const labelClass = 'block text-[11px] font-black uppercase tracking-widest text-black mb-1.5';
const primaryBtn = 'w-full flex items-center justify-center gap-2 py-3 bg-black text-white font-black uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:bg-black disabled:hover:text-white focus-visible:outline-none';

const buildQrValue = (ticketId: string) => `ORIGEN-DIANINO-${ticketId}`;

const TicketResult: React.FC<{ row: DianinoSearchResultRow }> = ({ row }) => {
    const Icon = row.isAdult ? User : Baby;
    return (
        <div className="border-2 border-black bg-white">
            <div className="px-4 py-2.5 flex items-center gap-2 bg-black text-white">
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                    {row.isAdult ? 'Adulto responsable' : 'Niño/a'}
                </span>
            </div>
            <div className="p-5 border-t-2 border-dashed border-black flex flex-col items-center text-center gap-3">
                <p className="font-black uppercase text-lg text-black">{row.firstName} {row.lastName}</p>

                <div className="p-3 bg-white border-2 border-black">
                    <QRCodeSVG value={buildQrValue(row.ticketId)} size={160} />
                </div>

                {row.status === 'CHECKED_IN' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-white bg-black px-3 py-1.5">
                        <Check className="w-3.5 h-3.5" strokeWidth={3} /> Ya ingresó al evento
                    </span>
                )}
            </div>
        </div>
    );
};

const BuscarDiaNino: React.FC = () => {
    const navigate = useNavigate();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [dni, setDni] = useState('');
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [results, setResults] = useState<DianinoSearchResultRow[]>([]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setSearched(false);
        const data = await searchDianinoSession(firstName.trim(), lastName.trim(), dni.trim());
        setResults(data);
        setSearched(true);
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-neutral-100 py-8 px-4">
            <div className="max-w-lg mx-auto">
                <button
                    onClick={() => navigate('/dia-del-nino')}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-black hover:underline mb-6 focus-visible:outline-none"
                >
                    <ArrowLeft className="w-4 h-4" /> Volver a la inscripción
                </button>

                <div className="text-center mb-8">
                    <img src={LOGO_URL} alt="Origen" className="h-8 md:h-9 mx-auto mb-5 object-contain" />
                    <h1 className="text-3xl font-black uppercase tracking-tighter text-black">Buscá tu inscripción</h1>
                    <div className="h-1 w-16 bg-black mx-auto my-3" />
                    <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">
                        Ingresá los datos del adulto responsable con los que se inscribió
                    </p>
                </div>

                <form
                    onSubmit={handleSearch}
                    className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 md:p-8 space-y-4"
                >
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="bd-firstName" className={labelClass}>Nombre</label>
                            <input
                                id="bd-firstName" type="text" placeholder="Nombre" autoComplete="given-name" required
                                value={firstName} onChange={e => setFirstName(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label htmlFor="bd-lastName" className={labelClass}>Apellido</label>
                            <input
                                id="bd-lastName" type="text" placeholder="Apellido" autoComplete="family-name" required
                                value={lastName} onChange={e => setLastName(e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="bd-dni" className={labelClass}>DNI</label>
                        <input
                            id="bd-dni" type="text" placeholder="DNI" inputMode="numeric" required
                            value={dni} onChange={e => setDni(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <button type="submit" disabled={loading} className={`${primaryBtn} mt-2`}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Buscar
                    </button>
                </form>

                {searched && !loading && (
                    <div className="mt-6">
                        {results.length === 0 ? (
                            <div className="bg-white border-2 border-dashed border-black p-8 text-center">
                                <p className="font-black uppercase tracking-tight text-black">
                                    No encontramos ninguna inscripción con esos datos.
                                </p>
                                <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mt-2">
                                    Verificá que estén escritos igual a como los cargaste al inscribirte.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-xs font-black uppercase tracking-widest text-neutral-500">
                                    Encontramos {results.length} entrada{results.length !== 1 ? 's' : ''}:
                                </p>
                                {results.map(r => <TicketResult key={r.ticketId} row={r} />)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BuscarDiaNino;

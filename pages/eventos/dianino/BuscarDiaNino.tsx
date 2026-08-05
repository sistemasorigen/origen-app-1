import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { searchDianinoSession, DianinoSearchResultRow } from '../../../services/supabaseService';
import { ArrowLeft, Search, User, Baby, Loader2, Check, Calendar, Clock, Ticket } from 'lucide-react';

const LOGO_URL = '/origen-logo-full.png';

// ── Mismo sistema de color "Día del Niño" que InscripcionDiaNino.tsx ──
const INK = '#2A211B';
const CRAYON_RED = '#E63B2E';
const CRAYON_BLUE = '#4A7FC9';
const CRAYON_GREEN = '#4CAF50';
const CRAYON_MUSTARD = '#F5B942';
const CRAYON_PINK = '#F2A9C4';
const BRAND_ORANGE = '#F0703A';

const TICKET_TAB_COLORS: { bg: string; fg: string }[] = [
    { bg: CRAYON_BLUE, fg: '#FFFFFF' },
    { bg: CRAYON_RED, fg: '#FFFFFF' },
    { bg: CRAYON_GREEN, fg: '#FFFFFF' },
    { bg: CRAYON_MUSTARD, fg: INK },
    { bg: BRAND_ORANGE, fg: '#FFFFFF' },
    { bg: CRAYON_PINK, fg: INK },
];

const primaryBtn = 'w-full py-3.5 rounded-full bg-[#F0703A] text-white font-black uppercase tracking-wide shadow-[0_8px_20px_-6px_rgba(240,112,58,0.55)] hover:bg-[#E4652F] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#F0703A]/25';
const inputClass = 'w-full px-4 py-3 rounded-xl border-2 border-[#EAD9BE] bg-white font-semibold text-[#2A211B] placeholder:text-[#C9B79A] outline-none focus:border-[#F0703A] focus:ring-4 focus:ring-[#F0703A]/15 transition-all';
const labelClass = 'block text-[11px] font-black uppercase tracking-widest text-[#8A7857] mb-1.5';

const buildQrValue = (ticketId: string) => `ORIGEN-DIANINO-${ticketId}`;

// Misma franja de datos del evento que en InscripcionDiaNino.tsx —
// recordatorio persistente, no un paso propio.
const EventFactsStrip: React.FC = () => (
    <div className="flex flex-wrap justify-center gap-2 mb-7" aria-label="Datos del evento">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-black uppercase tracking-wide" style={{ backgroundColor: CRAYON_MUSTARD, color: INK }}>
            <Calendar className="w-3.5 h-3.5" /> Sáb 15/08
        </span>
        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-black uppercase tracking-wide" style={{ backgroundColor: CRAYON_BLUE, color: '#FFFFFF' }}>
            <Clock className="w-3.5 h-3.5" /> 16 a 19 hs
        </span>
        <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-black uppercase tracking-wide" style={{ backgroundColor: CRAYON_GREEN, color: '#FFFFFF' }}>
            <Ticket className="w-3.5 h-3.5" /> Entrada gratis
        </span>
    </div>
);

// Misma lógica de ticket individual con QR que el wizard hermano,
// con el color de tab cíclico por índice (TICKET_TAB_COLORS).
const TicketResult: React.FC<{ row: DianinoSearchResultRow; index: number }> = ({ row, index }) => {
    const Icon = row.isAdult ? User : Baby;
    const tab = TICKET_TAB_COLORS[index % TICKET_TAB_COLORS.length];
    return (
        <div className="rounded-3xl overflow-hidden shadow-[0_10px_40px_-12px_rgba(42,33,27,0.18)]" style={{ border: '2px solid #EAD9BE' }}>
            <div className="px-4 py-2.5 flex items-center gap-2" style={{ backgroundColor: tab.bg, color: tab.fg }}>
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="text-[10px] font-black uppercase tracking-widest">
                    {row.isAdult ? 'Adulto responsable' : 'Niño/a'}
                </span>
            </div>
            <div className="p-5 bg-white flex flex-col items-center text-center gap-3">
                <p className="font-black uppercase text-lg" style={{ color: INK }}>{row.firstName} {row.lastName}</p>

                <div className="p-3 rounded-2xl bg-white" style={{ border: '2px solid #EAD9BE' }}>
                    <QRCodeSVG value={buildQrValue(row.ticketId)} size={160} />
                </div>

                <div className="w-full rounded-xl px-3 py-2 text-center" style={{ border: '2px dashed #EAD9BE', backgroundColor: '#FBF6EC' }}>
                    <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: '#B9A88C' }}>Código de ingreso manual</p>
                    <p className="font-mono font-black text-sm tracking-widest break-all" style={{ color: INK }}>{row.ticketId}</p>
                </div>

                {row.status === 'CHECKED_IN' && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full" style={{ color: '#FFFFFF', backgroundColor: CRAYON_GREEN }}>
                        <Check className="w-3.5 h-3.5" strokeWidth={3} /> Ya ingresó al evento
                    </span>
                )}
            </div>
        </div>
    );
};

const BuscarDiaNino: React.FC = () => {
    const navigate = useNavigate();
    const shouldReduceMotion = useReducedMotion();
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
        <div className="min-h-screen py-8 px-4" style={{ backgroundColor: '#FDF6E9' }}>
            <div className="max-w-lg mx-auto">
                <button
                    onClick={() => navigate('/dia-del-nino')}
                    className="flex items-center gap-2 text-xs font-black uppercase tracking-widest mb-6 hover:opacity-70 transition-opacity focus-visible:outline-none"
                    style={{ color: INK }}
                >
                    <ArrowLeft className="w-4 h-4" /> Volver a la inscripción
                </button>

                <div className="text-center mb-6">
                    <img src={LOGO_URL} alt="Origen" className="h-8 md:h-9 mx-auto mb-5 object-contain" />
                    <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-2" style={{ color: INK }}>
                        <span className="inline-block" style={{ color: CRAYON_BLUE, transform: 'rotate(-3deg)' }}>Buscá</span> tu inscripción
                    </h1>
                    <p className="text-xs font-bold uppercase tracking-widest mb-6" style={{ color: '#B9A88C' }}>
                        Ingresá los datos del adulto responsable con los que se inscribió
                    </p>
                    <EventFactsStrip />
                </div>

                <form
                    onSubmit={handleSearch}
                    className="bg-white rounded-3xl shadow-[0_10px_40px_-12px_rgba(42,33,27,0.18)] p-6 md:p-8 space-y-4"
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
                    <button type="submit" disabled={loading} className={`${primaryBtn} flex items-center justify-center gap-2 mt-2`}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Buscar
                    </button>
                </form>

                <AnimatePresence>
                    {searched && !loading && (
                        <motion.div
                            key="results"
                            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
                            transition={{ duration: 0.25 }}
                            className="mt-6"
                        >
                            {results.length === 0 ? (
                                <div className="rounded-2xl p-6 text-center" style={{ backgroundColor: '#FDEDEB', border: `2px solid ${CRAYON_RED}` }}>
                                    <p className="font-black uppercase tracking-tight" style={{ color: CRAYON_RED }}>
                                        No encontramos ninguna inscripción con esos datos.
                                    </p>
                                    <p className="text-xs font-bold uppercase tracking-widest mt-2" style={{ color: '#8A7857' }}>
                                        Verificá que estén escritos igual a como los cargaste al inscribirte.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-xs font-black uppercase tracking-widest" style={{ color: '#8A7857' }}>
                                        Encontramos {results.length} entrada{results.length !== 1 ? 's' : ''}:
                                    </p>
                                    {results.map((r, idx) => <TicketResult key={r.ticketId} row={r} index={idx} />)}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default BuscarDiaNino;

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { checkinDianinoTicket, getDianinoSessionForCheckin, DianinoSessionCheckinTicket } from '../../../services/supabaseService';
import { ChevronLeft, Camera, CameraOff, Keyboard, CheckCircle2, AlertTriangle, Clock, XCircle, RotateCcw, User, Baby, X, Users } from 'lucide-react';

const QR_PREFIX = 'ORIGEN-DIANINO-';

type ResultType = 'SUCCESS' | 'WAIVER_REJECTED' | 'ALREADY_CHECKED_IN' | 'NOT_FOUND' | 'INVALID';

interface ScanResult {
    type: ResultType;
    name?: string;
    time?: string;
}

const playBeep = (ok: boolean) => {
    try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.frequency.value = ok ? 880 : 220;
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.18);
    } catch (e) {
        // Silencioso si el navegador bloquea audio sin interacción previa
    }
};

const EscanerDiaNino: React.FC = () => {
    const navigate = useNavigate();
    const scannerRef = useRef<Html5Qrcode | null>(null);

    const [cameraError, setCameraError] = useState<string | null>(null);
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualValue, setManualValue] = useState('');

    const [result, setResult] = useState<ScanResult | null>(null);
    const [processing, setProcessing] = useState(false);
    const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Dropdown de acreditación (aparece al escanear el QR maestro del adulto)
    const [familyDropdown, setFamilyDropdown] = useState<{
        sessionId: string;
        declaracionJuradaAceptada: boolean;
        tickets: DianinoSessionCheckinTicket[];
    } | null>(null);
    const [checkingInId, setCheckingInId] = useState<string | null>(null);

    // Refs espejo de processing/result — permiten que handleTicketCode
    // lea el valor más reciente sin que la función cambie de referencia
    // (evita reinicializar la cámara en cada escaneo).
    const processingRef = useRef(false);
    const resultRef = useRef<ScanResult | null>(null);
    useEffect(() => { processingRef.current = processing; }, [processing]);
    useEffect(() => { resultRef.current = result; }, [result]);

    const handleTicketCode = useCallback(async (rawValue: string) => {
        if (processingRef.current || resultRef.current) return;
        setProcessing(true);
        processingRef.current = true;

        if (!rawValue.startsWith(QR_PREFIX)) {
            playBeep(false);
            setResult({ type: 'INVALID' });
            setProcessing(false);
            processingRef.current = false;
            return;
        }

        const ticketId = rawValue.slice(QR_PREFIX.length);

        // Si es el QR maestro (el adulto), abrir el dropdown
        // familiar. El adulto se acredita solo, de fondo, sin
        // pedirle a nadie que lo tilde — el dropdown solo
        // muestra a los niños para acreditar.
        const sessionInfo = await getDianinoSessionForCheckin(ticketId);
        if (sessionInfo?.isAdultScan && sessionInfo.sessionId && sessionInfo.tickets) {
            const adultTicket = sessionInfo.tickets.find(t => t.isAdult);
            if (adultTicket) {
                // Fire-and-forget: no bloquea la apertura del
                // dropdown esperando esta respuesta.
                checkinDianinoTicket(adultTicket.id).catch(() => {});
            }

            setProcessing(false);
            processingRef.current = false;
            setFamilyDropdown({
                sessionId: sessionInfo.sessionId,
                declaracionJuradaAceptada: !!sessionInfo.declaracionJuradaAceptada,
                tickets: sessionInfo.tickets.filter(t => !t.isAdult)
            });
            return;
        }
        // Si no es el adulto (QR viejo de un niño de algún
        // email anterior a este cambio, o no se pudo resolver
        // la sesión), sigue el flujo normal de check-in
        // individual — se mantiene por compatibilidad hacia
        // atrás, no por diseño nuevo.

        const res = await checkinDianinoTicket(ticketId);
        setProcessing(false);
        processingRef.current = false;

        if (!res || res.result === 'NOT_FOUND') {
            playBeep(false);
            setResult({ type: 'NOT_FOUND' });
            return;
        }

        const fullName = `${res.firstName} ${res.lastName}`;
        const time = res.checkedInAt
            ? new Date(res.checkedInAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
            : undefined;

        if (res.result === 'ALREADY_CHECKED_IN') {
            playBeep(false);
            setResult({ type: 'ALREADY_CHECKED_IN', name: fullName, time });
            return;
        }

        // result === 'SUCCESS'
        if (res.declaracionJuradaAceptada === false) {
            playBeep(false);
            setResult({ type: 'WAIVER_REJECTED', name: fullName });
            return;
        }

        playBeep(true);
        setResult({ type: 'SUCCESS', name: fullName });
    }, []);

    const handleFamilyCheckIn = async (ticketId: string) => {
        setCheckingInId(ticketId);
        const res = await checkinDianinoTicket(ticketId);
        setCheckingInId(null);

        if (res && (res.result === 'SUCCESS' || res.result === 'ALREADY_CHECKED_IN')) {
            playBeep(res.result === 'SUCCESS');
            setFamilyDropdown(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    tickets: prev.tickets.map(t =>
                        t.id === ticketId
                            ? { ...t, status: 'CHECKED_IN', checkedInAt: res.checkedInAt || new Date().toISOString() }
                            : t
                    )
                };
            });
        } else {
            playBeep(false);
        }
    };

    const closeFamilyDropdown = () => setFamilyDropdown(null);

    // ── Inicializar escáner de cámara ──
    useEffect(() => {
        const containerId = 'dianino-qr-reader';
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;

        scanner.start(
            { facingMode: 'environment' },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
                handleTicketCode(decodedText);
            },
            () => {
                // No-QR-in-frame — no es un error real
            }
        )
            .catch((err) => {
                setCameraError('No pudimos acceder a la cámara. Revisá los permisos del navegador e intentá de nuevo.');
                console.error('[EscanerDiaNino] Camera error:', err);
            });

        return () => {
            try {
                // html5-qrcode lanza un throw sincrónico (no una promesa rechazada)
                // si el scanner nunca llegó a arrancar (p.ej. falló el acceso a cámara) —
                // el .catch() no lo atrapa, por eso el try/catch alrededor.
                scanner.stop().then(() => scanner.clear()).catch(() => {});
            } catch {
                // no-op: no había nada corriendo que detener
            }
            scannerRef.current = null;
        };
    }, [handleTicketCode]);

    const handleContinue = () => {
        if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
        setResult(null);
    };

    // Auto-resume a los 2.5s
    useEffect(() => {
        if (!result) return;
        resumeTimeoutRef.current = setTimeout(() => setResult(null), 2500);
        return () => { if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current); };
    }, [result]);

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualValue.trim()) return;
        const value = manualValue.trim().startsWith(QR_PREFIX) ? manualValue.trim() : `${QR_PREFIX}${manualValue.trim()}`;
        handleTicketCode(value);
        setManualValue('');
        setShowManualInput(false);
    };

    // ── Resultado a pantalla completa ──
    // ── Resultado a pantalla completa (overlay, sin desmontar la cámara) ──
    const resultOverlay = (() => {
        if (!result) return null;
        const config: Record<ResultType, { bg: string; icon: React.ReactNode; title: string; subtitle?: string }> = {
            SUCCESS: { bg: 'bg-emerald-500', icon: <CheckCircle2 className="w-24 h-24" />, title: 'Puede pasar' },
            WAIVER_REJECTED: { bg: 'bg-amber-500', icon: <AlertTriangle className="w-24 h-24" />, title: 'No aceptó la declaración', subtitle: 'Decidí si puede ingresar' },
            ALREADY_CHECKED_IN: { bg: 'bg-blue-500', icon: <Clock className="w-24 h-24" />, title: 'Ya había ingresado' },
            NOT_FOUND: { bg: 'bg-red-600', icon: <XCircle className="w-24 h-24" />, title: 'No encontrado' },
            INVALID: { bg: 'bg-red-600', icon: <XCircle className="w-24 h-24" />, title: 'QR inválido', subtitle: 'No es de este evento' },
        };
        const c = config[result.type];
        return (
            <div
                className={`fixed inset-0 z-50 flex flex-col items-center justify-center text-white p-6 text-center ${c.bg}`}
                onPointerDown={handleContinue}
            >
                {c.icon}
                <h1 className="text-3xl font-black uppercase tracking-tight mt-6">{c.title}</h1>
                {result.name && <p className="text-xl font-semibold mt-2">{result.name}</p>}
                {result.time && <p className="text-sm opacity-80 mt-1">Ingresó a las {result.time}</p>}
                {c.subtitle && <p className="text-sm opacity-90 mt-2">{c.subtitle}</p>}

                <button
                    onPointerDown={(e) => { e.stopPropagation(); handleContinue(); }}
                    style={{ touchAction: 'manipulation' }}
                    className="mt-10 flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 rounded-full font-bold text-sm transition-colors"
                >
                    <RotateCcw className="w-4 h-4" /> Escanear otro
                </button>
            </div>
        );
    })();

    return (
        <div className="min-h-screen bg-black flex flex-col">
            {/* Overlay de resultado — se muestra encima sin desmontar la cámara */}
            {resultOverlay}

            {/* Dropdown familiar — Escaneo Simple */}
            {familyDropdown && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
                    <div className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-slate-700" />
                                <h3 className="font-black uppercase text-sm text-black">Marcar ingresos</h3>
                            </div>
                            <button onClick={closeFamilyDropdown} className="text-slate-400 hover:text-black">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {!familyDropdown.declaracionJuradaAceptada && (
                            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs font-bold text-amber-700">
                                    Esta familia NO aceptó la Declaración de Conformidad. Decidí si pueden ingresar.
                                </p>
                            </div>
                        )}

                        <div className="space-y-2">
                            {familyDropdown.tickets.map(t => {
                                const isChecked = t.status === 'CHECKED_IN';
                                const isLoading = checkingInId === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        onClick={() => !isChecked && !isLoading && handleFamilyCheckIn(t.id)}
                                        disabled={isChecked || isLoading}
                                        className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${isChecked ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${isChecked ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                            {isLoading ? <RotateCcw className="w-4 h-4 animate-spin" /> : isChecked ? <CheckCircle2 className="w-4 h-4" /> : (t.isAdult ? <User className="w-4 h-4" /> : <Baby className="w-4 h-4" />)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-slate-900 truncate">{t.firstName} {t.lastName}</p>
                                            <p className="text-xs text-slate-400">
                                                {t.isAdult ? 'Adulto responsable' : 'Niño/a'}
                                                {isChecked && t.checkedInAt && ` · Ingresó a las ${new Date(t.checkedInAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={closeFamilyDropdown}
                            className="w-full py-3 bg-black text-white font-semibold rounded-lg text-sm hover:bg-slate-800 transition-colors"
                        >
                            Listo
                        </button>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between p-4 gap-3 flex-wrap">
                <button
                    onClick={() => navigate('/eventos/admin/diadelnino')}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/60 hover:text-white transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" /> Día del Niño
                </button>
            </div>

            <div className="flex-1 relative flex items-center justify-center px-4">
                {cameraError ? (
                    <div className="text-center text-white/80 max-w-sm">
                        <CameraOff className="w-12 h-12 mx-auto mb-4 text-white/40" />
                        <p className="text-sm">{cameraError}</p>
                    </div>
                ) : (
                    <div id="dianino-qr-reader" className="w-full max-w-md rounded-2xl overflow-hidden" />
                )}


            </div>

            <div className="p-4">
                {showManualInput ? (
                    <form onSubmit={handleManualSubmit} className="flex gap-2">
                        <input
                            type="text"
                            autoFocus
                            placeholder="ID del ticket (sin el prefijo)"
                            value={manualValue}
                            onChange={e => setManualValue(e.target.value)}
                            className="flex-1 px-4 py-3 bg-white/10 text-white placeholder-white/40 rounded-lg outline-none text-sm"
                        />
                        <button type="submit" className="px-4 py-3 bg-white text-black font-bold rounded-lg text-sm">
                            Validar
                        </button>
                    </form>
                ) : (
                    <button
                        onClick={() => setShowManualInput(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-white/10 text-white/80 rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors"
                    >
                        <Keyboard className="w-4 h-4" /> Ingresar código a mano
                    </button>
                )}
            </div>
        </div>
    );
};

export default EscanerDiaNino;

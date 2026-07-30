import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { checkinDianinoTicket } from '../../../services/supabaseService';
import { ChevronLeft, Camera, CameraOff, Keyboard, CheckCircle2, AlertTriangle, Clock, XCircle, RotateCcw } from 'lucide-react';

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
    // ── DIAGNÓSTICO TEMPORAL — sacar una vez resuelto el bug del escáner ──
    const [lastDecodeAttempt, setLastDecodeAttempt] = useState<{ at: number; message: string } | null>(null);
    const [scannerStarted, setScannerStarted] = useState(false);
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualValue, setManualValue] = useState('');

    const [result, setResult] = useState<ScanResult | null>(null);
    const [processing, setProcessing] = useState(false);
    const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
                setScannerStarted(true);
                handleTicketCode(decodedText);
            },
            () => {
                // Se dispara constantemente mientras no hay QR
                // en cuadro — no es un error real, solo feedback
                // de "sigo buscando".
                setLastDecodeAttempt({ at: Date.now(), message: 'buscando QR...' });
            }
        )
            .then(() => setScannerStarted(true))
            .catch((err) => {
                setCameraError('No pudimos acceder a la cámara. Revisá los permisos del navegador e intentá de nuevo.');
                console.error('[EscanerDiaNino] Camera error:', err);
            });

        return () => {
            scanner.stop().then(() => scanner.clear()).catch(() => {});
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
            <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center text-white p-6 text-center ${c.bg}`}>
                {c.icon}
                <h1 className="text-3xl font-black uppercase tracking-tight mt-6">{c.title}</h1>
                {result.name && <p className="text-xl font-semibold mt-2">{result.name}</p>}
                {result.time && <p className="text-sm opacity-80 mt-1">Ingresó a las {result.time}</p>}
                {c.subtitle && <p className="text-sm opacity-90 mt-2">{c.subtitle}</p>}

                <button
                    onClick={handleContinue}
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

            <div className="flex items-center justify-between p-4">
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

                {/* ── DIAGNÓSTICO TEMPORAL — panel visible, sacar cuando se confirme el fix ── */}
                <div className="absolute bottom-2 left-2 right-2 bg-black/80 text-white text-[10px] font-mono p-2 rounded-lg space-y-1 pointer-events-none">
                    <p>Cámara iniciada: {scannerStarted ? '✅ SÍ' : '⏳ esperando...'}</p>
                    <p>
                        Último intento de decodificación:{' '}
                        {lastDecodeAttempt
                            ? `hace ${Math.round((Date.now() - lastDecodeAttempt.at) / 1000)}s — "${lastDecodeAttempt.message}"`
                            : 'ninguno todavía'}
                    </p>
                </div>
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

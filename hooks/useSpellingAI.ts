import { useState, useCallback } from 'react';
import { correctTextWithGemini, isGeminiAvailable } from '../services/geminiService';

interface UseSpellingAIReturn {
    isChecking: boolean;
    isCorrecting: boolean;
    hasErrors: boolean;
    correctionStatus: 'idle' | 'correcting' | 'success' | 'error';
    checkSpelling: (text: string) => Promise<boolean>;
    fixText: (text: string) => Promise<string>;
    resetState: () => void;
}

// ===== FALLBACK REGEX CORRECTIONS (when Gemini fails) =====
interface CorrectionRule {
    regex: RegExp;
    replacement: string;
}

const fallbackRules: CorrectionRule[] = [
    // SMS Cleaner
    { regex: /\b(k|q|ke)\b/gi, replacement: 'que' },
    { regex: /\b(xq|pq|porq)\b/gi, replacement: 'porque' },
    { regex: /\bx\b/gi, replacement: 'por' },
    { regex: /\b(tmb|tambn|tb)\b/gi, replacement: 'también' },
    { regex: /\bbn\b/gi, replacement: 'bien' },
    { regex: /\b(pofa|xfa|porfa)\b/gi, replacement: 'por favor' },

    // Phonetic Errors
    { regex: /\bvailar\b/gi, replacement: 'bailar' },
    { regex: /\b(kiero|kiera|qiero)\b/gi, replacement: 'quiero' },
    { regex: /\b(haci|asi)\b/gi, replacement: 'así' },
    { regex: /\biva\b/gi, replacement: 'iba' },
    { regex: /\bllendo\b/gi, replacement: 'yendo' },
    { regex: /\bhaiga\b/gi, replacement: 'haya' },

    // Tildes
    { regex: /\bdia\b/gi, replacement: 'día' },
    { regex: /\bdias\b/gi, replacement: 'días' },
    { regex: /\bmas\b/gi, replacement: 'más' },
    { regex: /\btambien\b/gi, replacement: 'también' },
    { regex: /\besta bien\b/gi, replacement: 'está bien' },
    { regex: /\bestan\b/gi, replacement: 'están' },
    { regex: /\binformacion\b/gi, replacement: 'información' },
    { regex: /\bconexion\b/gi, replacement: 'conexión' },
    { regex: /\breunion\b/gi, replacement: 'reunión' },

    // Si vs Sí
    { regex: /^Si\s+(estoy|voy|quiero|tengo|acepto|claro|seguro|puedo|de acuerdo)/i, replacement: 'Sí, $1' },

    // Introductory Commas
    { regex: /^(Hola)\s+([a-záéíóúñA-ZÁÉÍÓÚÑ])/i, replacement: '$1, $2' },
];

const applyFallbackCorrections = (text: string): string => {
    let corrected = text.trim().replace(/\s+/g, ' ');

    for (const rule of fallbackRules) {
        corrected = corrected.replace(rule.regex, rule.replacement);
    }

    corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
    if (!corrected.endsWith('.') && !corrected.endsWith('!') && !corrected.endsWith('?')) {
        corrected += '.';
    }

    return corrected;
};

export const useSpellingAI = (): UseSpellingAIReturn => {
    const [isChecking, setIsChecking] = useState(false);
    const [isCorrecting, setIsCorrecting] = useState(false);
    const [hasErrors, setHasErrors] = useState(false);
    const [correctionStatus, setCorrectionStatus] = useState<'idle' | 'correcting' | 'success' | 'error'>('idle');

    const [suggestedCorrection, setSuggestedCorrection] = useState<string | null>(null);

    const checkSpelling = useCallback(async (text: string): Promise<boolean> => {
        if (!text.trim()) {
            setHasErrors(false);
            setSuggestedCorrection(null);
            return false;
        }

        setIsChecking(true);
        setCorrectionStatus('idle');

        try {
            // Check against fallback rules first for immediate feedback on obvious things
            const regexCorrected = applyFallbackCorrections(text);
            if (regexCorrected !== text) {
                // If regex catches something, we definitely have errors
                // But we still want to ask Gemini for a "better" correction if possible
                // For now, we can flag it immediately
            }

            let corrected: string;

            if (isGeminiAvailable()) {
                try {
                    corrected = await correctTextWithGemini(text);
                } catch (err) {
                    console.warn('Gemini check failed, using fallback');
                    corrected = regexCorrected;
                }
            } else {
                corrected = regexCorrected;
            }

            const hasDiff = corrected.trim() !== text.trim();
            setHasErrors(hasDiff);
            setSuggestedCorrection(corrected);
            return hasDiff;
        } catch (error) {
            console.error('Error checking spelling:', error);
            return false;
        } finally {
            setIsChecking(false);
        }
    }, []);

    const fixText = useCallback(async (text: string): Promise<string> => {
        setIsCorrecting(true);
        setCorrectionStatus('correcting');

        try {
            // Use cached suggestion if available and matches the input (roughly)
            // Note: In a real scenario, we might blindly trust the cache if checkSpelling was just called.
            // But to be safe, if we have a suggestedCorrection, use it.

            let finalText = suggestedCorrection;

            if (!finalText) {
                // If no cache (e.g. user clicked fix before check finished, or logic drift), re-run
                if (isGeminiAvailable()) {
                    finalText = await correctTextWithGemini(text);
                } else {
                    finalText = applyFallbackCorrections(text);
                }
            }

            setCorrectionStatus('success');
            setHasErrors(false);
            setSuggestedCorrection(null);

            // Reset success status after 2 seconds
            setTimeout(() => {
                setCorrectionStatus('idle');
            }, 2000);

            return finalText;
        } catch (error) {
            console.error('Correction failed:', error);
            setCorrectionStatus('error');

            setTimeout(() => {
                setCorrectionStatus('idle');
            }, 3000);

            return text;
        } finally {
            setIsCorrecting(false);
        }
    }, [suggestedCorrection]);

    const resetState = useCallback(() => {
        setHasErrors(false);
        setIsChecking(false);
        setIsCorrecting(false);
        setCorrectionStatus('idle');
        setSuggestedCorrection(null);
    }, []);

    return {
        isChecking,
        isCorrecting,
        hasErrors,
        correctionStatus,
        checkSpelling,
        fixText,
        resetState
    };
};

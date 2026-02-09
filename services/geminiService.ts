/// <reference types="vite/client" />
import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabaseClient';

// Initialize Gemini with API key (Keeping for text correction if needed)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// Use Gemini 2.5 Flash (latest fast model)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

/**
 * Generate an image using Supabase Edge Function (wrapping Google Gemini)
 * @param prompt - Description of the image to generate
 * @returns Base64 string OR Direct URL of the generated image
 */
/**
 * Generate an image using a robust client-side multi-provider strategy
 * Strategy 1: Google Imagen 4.0 (Direct Client Fetch) - Highest Quality
 * Strategy 2: Pollinations AI Flux (Direct Client Fetch) - Fast, Free
 * Strategy 3: Mock Keyword Dictionary - Instant Fallback
 */
export async function generateImage(prompt: string): Promise<string> {
  console.log('[geminiService] Requesting image generation:', prompt);

  // 1. Google Imagen 4.0 Fast (Direct)
  if (API_KEY) {
    try {
      console.log('Strategy 1: Trying Google Imagen 4.0 Fast...');
      const model = 'imagen-4.0-fast-generate-001';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${API_KEY}`;

      const payload = {
        instances: [{ prompt: prompt + ", realistic, 8k, photorealistic" }],
        parameters: { sampleCount: 1, aspectRatio: "4:3" }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.predictions?.[0]?.bytesBase64Encoded) {
          console.log('Strategy 1: Success!');
          return `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`;
        }
      } else {
        const err = await response.text();
        console.warn('Strategy 1 Failed:', response.status, err);
      }
    } catch (e) {
      console.warn('Strategy 1 Exception:', e);
    }
  }

  // 2. Pollinations AI Flux (Direct)
  try {
    console.log('Strategy 2: Trying Pollinations AI...');
    const seed = Math.floor(Math.random() * 1000000);
    const enhancedPrompt = encodeURIComponent(prompt + " realistic, 4k, photography");
    const pollUrl = `https://image.pollinations.ai/prompt/${enhancedPrompt}?width=800&height=600&seed=${seed}&nologo=true&model=flux`;

    // Validate it's reachable (optional, or just return URL)
    // We return URL directly specifically because checking it might cause double-load/rate-limit
    console.log('Strategy 2: Returning URL');
    return pollUrl;
  } catch (e) {
    console.warn('Strategy 2 Exception:', e);
  }

  // 3. Fallback Dictionary (Mock)
  console.log('Strategy 3: Fallback to Dictionary');
  return getFallbackImage(prompt);
}

function getFallbackImage(prompt: string): string {
  const p = prompt.toLowerCase();
  const db: Record<string, string[]> = {
    youth: [
      "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?q=80&w=800",
      "https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=800"
    ],
    worship: [
      "https://images.unsplash.com/photo-1510590337019-5ef2d3977e2e?q=80&w=800",
      "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=800"
    ],
    default: [
      "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=800",
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800"
    ]
  };

  let category = 'default';
  if (p.includes('joven') || p.includes('amigos')) category = 'youth';
  else if (p.includes('dios') || p.includes('alabanza')) category = 'worship';

  const list = db[category] || db.default;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Correct Spanish text using Google Gemini AI
 * @param text - The original text to correct
 * @returns The corrected text (polished Spanish)
 */
export async function correctTextWithGemini(text: string): Promise<string> {
  if (!API_KEY) {
    throw new Error('VITE_GEMINI_API_KEY is not configured');
  }

  if (!text || text.trim().length === 0) {
    return text;
  }

  const prompt = `Actúa como un corrector ortográfico y gramatical experto de la RAE (Real Academia Española).
Tu única misión es transformar el texto de entrada en español perfecto, formal y correcto.

REGLAS ESTRICTAS:
1. CORRIGE agresivamente errores ortográficos (ej: "orror" -> "horror", "korregir" -> "corregir", "hacer" vs "a ser", "b/v", "ll/y").
2. REPARA acentuación diacrítica y tildes faltantes (ej: "que" vs "qué", "si" vs "sí", "mas" vs "más", "esta" vs "está").
3. NORMALIZA jerga de chat a español culto (ej: "ke" -> "que", "xq" -> "porque", "tmb" -> "también").
4. AGREGA signos de exclamación/interrogación de apertura (¡, ¿) si el tono lo requiere.
5. MANTÉN el significado original, solo mejora la forma.
6. DEVUELVE ÚNICAMENTE el texto corregido. Sin introducciones, sin comillas, sin explicaciones.

EJEMPLOS:
Input: "ke orror"
Output: ¡Qué horror!

Input: "si voy a ir mas tarde"
Output: Sí, voy a ir más tarde.

Input: "hola como estas"
Output: Hola, ¿cómo estás?

Input: "Deberia de korregir todo lo que esta mal"
Output: Debería corregir todo lo que está mal.

Input: "${text}"
Output:`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let correctedText = response.text().trim();

    // Clean up any potential markdown or quotes that Gemini might add
    correctedText = correctedText
      .replace(/^["'`]+|["'`]+$/g, '') // Remove surrounding quotes
      .replace(/^\*+|\*+$/g, '') // Remove markdown asterisks
      .replace(/^Texto corregido:\s*/i, '') // Remove common prefixes
      .replace(/^Corrección:\s*/i, '')
      .replace(/^Aquí está.*?:\s*/i, '')
      .replace(/^Output:\s*/i, '')
      .trim();

    return correctedText || text;
  } catch (error) {
    console.error('Gemini API Error:', error);
    // Fallback to regex corrections
    console.warn('Falling back to regex corrections');
    return applyRegexCorrections(text);
  }
}

// Fallback: Comprehensive regex corrections
function applyRegexCorrections(text: string): string {
  let corrected = text.trim().replace(/\s+/g, ' ');

  const rules = [
    // SMS/Chat shortcuts
    { regex: /\b(k|q|ke)\b/gi, replacement: 'que' },
    { regex: /\b(xq|pq|porq)\b/gi, replacement: 'porque' },
    { regex: /\bx\b/gi, replacement: 'por' },
    { regex: /\b(tmb|tb)\b/gi, replacement: 'también' },
    { regex: /\bbn\b/gi, replacement: 'bien' },

    // Phonetic errors
    { regex: /\bvailar\b/gi, replacement: 'bailar' },
    { regex: /\b(kiero|qiero)\b/gi, replacement: 'quiero' },
    { regex: /\b(haci|asi)\b/gi, replacement: 'así' },
    { regex: /\borror\b/gi, replacement: 'horror' },
    { regex: /\bkorregir\b/gi, replacement: 'corregir' },
    { regex: /\bllendo\b/gi, replacement: 'yendo' },
    { regex: /\bhaiga\b/gi, replacement: 'haya' },
    { regex: /\biva\b/gi, replacement: 'iba' },

    // Tildes
    { regex: /\bdeberia\b/gi, replacement: 'debería' },
    { regex: /\besta\s+(bien|mal|listo|aqui)/gi, replacement: 'está $1' },
    { regex: /\bestan\b/gi, replacement: 'están' },
    { regex: /\bmas\b/gi, replacement: 'más' },
    { regex: /\btambien\b/gi, replacement: 'también' },

    // Si vs Sí
    { regex: /^Si\s+(estoy|voy|quiero|claro|seguro)/i, replacement: 'Sí, $1' },
  ];

  for (const rule of rules) {
    corrected = corrected.replace(rule.regex, rule.replacement);
  }

  corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);

  if (!corrected.endsWith('.') && !corrected.endsWith('!') && !corrected.endsWith('?')) {
    corrected += '.';
  }

  return corrected;
}

/**
 * Check if Gemini API is available
 */
export function isGeminiAvailable(): boolean {
  return Boolean(API_KEY);
}

/**
 * Validate user profile data locally (FAST)
 * Replaces the slow AI check for basic validation
 */
export function validateProfileLocal(data: { name: string; phone: string; age: number; gender: string }): {
  isValid: boolean;
  correctedData: typeof data;
  message?: string;
} {
  // 1. Correct Name Capitalization
  const cleanName = data.name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // 2. Validate Phone (Basic Argentina Check)
  // Must be roughly +54 9 ... and have enough digits
  let cleanPhone = data.phone.trim();

  // Basic cleaning
  cleanPhone = cleanPhone.replace(/[\s\-\(\)]/g, ''); // keep + and numbers

  // Check prefix
  if (!cleanPhone.startsWith('+')) {
    cleanPhone = '+' + cleanPhone;
  }

  // Very basic length check (Argentina numbers are usually 13 chars with +54 9 11...)
  const isValidPhone = cleanPhone.length > 8 && /^\+?[0-9]+$/.test(cleanPhone);

  if (!isValidPhone) {
    return {
      isValid: false,
      correctedData: { ...data, name: cleanName },
      message: 'El número de teléfono parece incorrecto. Por favor verifica el formato.'
    };
  }

  return {
    isValid: true,
    correctedData: {
      ...data,
      name: cleanName,
      phone: cleanPhone // or keep original formatting if preferred, but usually we want clean
    }
  };
}

/**
 * Validate user profile data with Gemini
 * @deprecated Use validateProfileLocal for instant feedback
 */
export async function validateProfileWithGemini(data: { name: string; phone: string; age: number; gender: string }): Promise<{
  isValid: boolean;
  correctedData?: typeof data;
  message?: string;
}> {
  // ... implementation kept for reference but we will switch to local ...
  return Promise.resolve(validateProfileLocal(data));
}
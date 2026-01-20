import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini with API key
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(API_KEY);

// Use Gemini 2.5 Flash (latest fast model)
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
// ════════════════════════════════════════════════════════════════════════
// Preguntas frecuentes de Nocturna 2026, tal como las revisó Ignacio.
//
// El texto va TEXTUAL: no se reescribe, no se resume, no se "mejora". Si
// hay que cambiar una respuesta, se cambia acá y en ningún otro lado.
//
// Lo usa /eventos (pages/eventos/Eventos.tsx), que lo muestra hasta
// FAQ_NOCTURNA_VISIBLE_HASTA.
// ════════════════════════════════════════════════════════════════════════

/** Un tramo de texto, o un teléfono que se puede tocar. */
export type TramoFaq = string | { telefono: string; href: string };

export interface PreguntaFaq {
    pregunta: string;
    /** Un párrafo (en tramos) o una lista de viñetas. */
    respuesta: { parrafo: TramoFaq[] } | { vinetas: string[] };
}

/** Hasta cuándo se ve: el final del evento, 6 AM del sábado 31, hora argentina. */
export const FAQ_NOCTURNA_VISIBLE_HASTA = '2026-10-31T06:00:00-03:00';

export const FAQ_NOCTURNA: PreguntaFaq[] = [
    {
        pregunta: '¿A qué hora comienza y termina el evento?',
        respuesta: { parrafo: ['El evento comienza a las 11:00 PM y finaliza a las 6:00 AM.'] },
    },
    {
        pregunta: '¿A qué hora puedo llegar al evento?',
        respuesta: { parrafo: ['La entrada estará abierta entre 11:00 PM y 12:30 AM. Después de ese horario no se permitirá el ingreso por seguridad.'] },
    },
    {
        pregunta: '¿Puedo retirarme antes de las 6:00 AM?',
        respuesta: { parrafo: ['Sí, pero solo si te viene a buscar tu padre, madre, tutor legal o el adulto responsable de la inscripción.'] },
    },
    {
        pregunta: '¿Qué documentación necesito llevar?',
        respuesta: { parrafo: ['Cada asistente al evento debe asistir con su DNI.'] },
    },
    {
        pregunta: '¿Qué incluye mi entrada?',
        respuesta: {
            vinetas: [
                'Cena (Combo de hamburguesa con papas y bebida).',
                'Desayuno.',
                'Acceso a todos los juegos e inflables.',
            ],
        },
    },
    {
        pregunta: '¿Puedo llevar mi propia comida o bebida?',
        respuesta: { parrafo: ['No, no está permitido ingresar comida o bebida del exterior. Si sos celíaco o tenés diabetes, indicalo en la inscripción y lo tenemos en cuenta para tu comida.'] },
    },
    {
        pregunta: '¿Habrá seguridad en el evento?',
        respuesta: { parrafo: ['Sí, contaremos con personal de seguridad y adultos responsables durante toda la noche.'] },
    },
    {
        pregunta: '¿Qué no incluye mi entrada?',
        respuesta: { vinetas: ['Licuados.'] },
    },
    {
        pregunta: '¿Qué cosas NO puedo llevar?',
        respuesta: {
            vinetas: [
                'Sustancias ilegales o peligrosas.',
                'Bebidas energéticas o alcohólicas.',
                'Objetos punzantes o peligrosos.',
                'Parlantes personales.',
            ],
        },
    },
    {
        pregunta: '¿Habrá lugar seguro para guardar mis cosas?',
        respuesta: { parrafo: ['Sí, tendremos una zona de objetos personales, pero recomendamos no traer objetos de valor.'] },
    },
    {
        pregunta: '¿Cómo puedo contactar a los organizadores durante el evento?',
        respuesta: {
            parrafo: [
                'Tendremos una línea directa para padres activa durante toda la noche: ',
                { telefono: '11-3789-0178', href: 'tel:+5491137890178' },
            ],
        },
    },
    {
        pregunta: '¿Y si hay una emergencia?',
        respuesta: { parrafo: ['Estamos preparados para emergencias con primeros auxilios, personal capacitado y contacto inmediato con padres o tutores.'] },
    },
];

/** Si el FAQ todavía se muestra. Es un instante con zona: la comparación ya es en hora argentina. */
export const faqNocturnaVisible = (ahora: Date = new Date()): boolean =>
    ahora.getTime() < new Date(FAQ_NOCTURNA_VISIBLE_HASTA).getTime();

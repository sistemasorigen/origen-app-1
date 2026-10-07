// Supabase Edge Function: send-nocturna-entrada-v2 — TEMPORAL.
//
// Existe para poder ver el email del rediseño en un cliente de verdad sin
// tocar lo que reciben las 8 familias ya inscriptas. No la dispara ningún
// trigger: se la llama a mano con un `inscripcion_id`.
//
// No copia el código de la función de producción, lo importa: así no hay dos
// versiones que se puedan separar sin que nadie lo note. La diferencia con lo
// que hoy está desplegado en producción es solamente `plantilla.ts`, que en
// esta rama ya tiene el HTML nuevo y todavía no se desplegó.
//
// Se borra en el prompt 6, cuando la plantilla nueva pase a producción.
//
// Importar este módulo alcanza: `index.ts` llama a serve() al cargarse.
import "../send-nocturna-entrada/index.ts";

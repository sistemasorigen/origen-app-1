// Regenera supabase/functions/send-reporte-problema/plantilla.ts desde el diseño.
// Uso: node scripts/generar-plantilla-reporte.cjs "design-claude/Email - Nuevo Reporte.dc.html" supabase/functions/send-reporte-problema/plantilla.ts
// Saca emailHtml() del .dc del email y lo corre con las variables, para que la
// plantilla de la función sea exactamente la del diseño.
// Uso: node generar.cjs <diseño.dc.html> <salida.ts>
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const ini = src.indexOf('const SANS =');
const fin = src.indexOf('class Component extends DCLogic');
const codigo = src.slice(ini, fin);
const emailHtml = new Function(codigo + '\nreturn emailHtml;')();

const html = emailHtml({
    codigo: '{{codigo}}', nombre: '{{nombre}}', email: '{{email}}', telefono: '{{telefono}}',
    pantalla: '{{pantalla}}', fecha: '{{fecha}}', version: '{{version}}', dispositivo: '{{dispositivo}}',
    descripcionHtml: '{{descripcion}}', tieneCaptura: '{{tieneCaptura}}', linkPanel: '{{linkPanel}}',
    preheader: '{{preheader}}',
}, false);

// ── Cambio pedido por Ignacio (2026-10-22): sin la fila "Origen · Sistemas ·
// Reportes"; en su lugar, el logo de Origen centrado. Negro en claro y blanco
// en oscuro (los clientes que entienden prefers-color-scheme: Apple Mail,
// iOS, Outlook). Las imágenes viven en el bucket público `images`, como la
// cabecera de Nocturna: el email no depende de que se publique el sitio.
const LOGO = 'https://oqtumgalnozppqnnjjdb.supabase.co/storage/v1/object/public/images/email/origen/origen-logo-';
const filaVieja = /<tr><td class="px" style="padding:0 8px 14px">[\s\S]*?Sistemas · Reportes<\/td>\s*<\/tr><\/table>\s*<\/td><\/tr>/;
if (!filaVieja.test(html)) throw new Error('No encontré la fila de la cabecera en el diseño');
let conLogo = html.replace(filaVieja,
    `<tr><td class="px" align="center" style="padding:6px 8px 20px">` +
    `<img src="${LOGO}negro.png" width="116" height="36" alt="Origen" class="logo-claro" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:116px;height:36px">` +
    `<!--[if !mso]><!--><div class="logo-oscuro" style="display:none;max-height:0;overflow:hidden;mso-hide:all">` +
    `<img src="${LOGO}blanco.png" width="116" height="36" alt="Origen" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:116px;height:36px">` +
    `</div><!--<![endif]-->` +
    `</td></tr>`);
conLogo = conLogo.replace('@media (prefers-color-scheme:dark){',
    '@media (prefers-color-scheme:dark){.logo-claro{display:none !important}.logo-oscuro{display:block !important;max-height:none !important;overflow:visible !important}');
if (!conLogo.includes('.logo-oscuro{display:block')) throw new Error('No encontré el @media oscuro');
const html2 = conLogo;

const salida = `// Plantilla del email de un reporte nuevo — design-claude/Email - Nuevo Reporte.dc.html.
//
// Un cambio sobre el diseño, pedido por Ignacio: la fila de arriba ("Origen" a
// la izquierda y "Sistemas · Reportes" a la derecha) se reemplazó por el logo
// de Origen centrado, negro en claro y blanco en oscuro.
// Se genera con scripts/generar-plantilla-reporte.cjs.
//
// Generada con el emailHtml() del propio diseño en modo "Variables" (versión
// clara; el oscuro lo resuelve el @media del mismo HTML). Si se toca el
// diseño, hay que regenerarla. Va como string porque en tiempo de ejecución
// la función no puede leer archivos del repo.
//
// Variables (todas se escapan antes de entrar, en armado.ts):
//   {{codigo}} {{nombre}} {{email}} {{telefono}} {{pantalla}} {{fecha}}
//   {{version}} {{dispositivo}} {{descripcion}} {{tieneCaptura}}
//   {{linkPanel}} {{preheader}}

export const PLANTILLA = ${JSON.stringify(html2)};
`;
fs.writeFileSync(process.argv[3], salida);
console.log("plantilla:", html2.length, 'caracteres; variables:', [...new Set(html2.match(/\{\{\w+\}\}/g))].join(' '));

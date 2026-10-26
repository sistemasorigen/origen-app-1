// Agenda Origen · plantillas de email (tablas + estilos inline). window.AOMail
(function () {
  const F = "Manrope,Arial,Helvetica,sans-serif";
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const br = s => esc(s).replace(/\n/g, '<br>');
  const DARK = '.canvas,td.canvas{background-color:#141413 !important}td.card,.card{background-color:#1c1c1a !important}td.soft,.soft{background-color:#262624 !important}.ink{color:#f4f3f0 !important}.muted{color:#b3b1ac !important}td.btn,.btn{background-color:#f4f3f0 !important}.btn a{color:#0a0a0a !important}.rule{border-top-color:#2f2f2c !important}td.ok,.ok{background-color:#163222 !important}.okink{color:#7ee2a8 !important}td.pill,.pill{background-color:#2a2a28 !important}';

  function shell(o, dark) {
    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(o.asunto)}</title>
<!--[if mso]><style>body,table,td,a,p{font-family:Arial,Helvetica,sans-serif !important}</style><![endif]-->
<style>
:root{color-scheme:light dark;supported-color-schemes:light dark}
@media (max-width:620px){.px{padding-left:20px !important;padding-right:20px !important}.h1{font-size:23px !important;line-height:29px !important}.lbl{width:96px !important}}
@media (prefers-color-scheme:dark){${DARK}}
${dark ? DARK : ''}
</style></head>
<body class="canvas" bgcolor="#f6f6f4" style="margin:0;padding:0;background-color:#f6f6f4;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%">
<span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;max-height:0;overflow:hidden;mso-hide:all">${esc(o.pre)}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="canvas" bgcolor="#f6f6f4" style="background-color:#f6f6f4;width:100%"><tr><td class="canvas" align="center" style="padding:24px 12px 40px;background-color:#f6f6f4">
<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600"><tr><td><![endif]-->
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:600px">
<tr><td class="px" style="padding:0 8px 14px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
  <td class="ink" style="font-family:${F};font-size:17px;line-height:20px;font-weight:800;letter-spacing:-0.01em;color:#0a0a0a">Origen</td>
  <td align="right" class="muted" style="font-family:${F};font-size:12px;line-height:16px;font-weight:600;color:#5f5d58">Agenda Origen</td>
</tr></table></td></tr>
<tr><td class="card" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:26px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${o.body}
</table></td></tr>
<tr><td class="px muted" align="center" style="padding:20px 24px 0;font-family:${F};font-size:12.5px;line-height:19px;font-weight:500;color:#5f5d58">${o.pie}<br>Iglesia Origen · Buenos Aires</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
  }
  const kicker = (txt, bg, ink, cls) => `<tr><td class="px" style="padding:28px 32px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="${cls}" bgcolor="${bg}" style="padding:6px 12px;background-color:${bg};border-radius:999px;font-family:${F};font-size:11px;line-height:14px;letter-spacing:0.08em;font-weight:700;color:${ink}">${txt}</td></tr></table></td></tr>`;
  const h1 = t => `<tr><td class="px h1 ink" style="padding:14px 32px 0;font-family:${F};font-size:26px;line-height:32px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:-0.02em;color:#0a0a0a">${t}</td></tr>`;
  const row = (k, v, first) => `<tr><td class="lbl muted" width="120" valign="top" style="padding:${first ? '0' : '12px'} 12px 0 0;width:120px;font-family:${F};font-size:11px;line-height:20px;letter-spacing:0.07em;font-weight:700;color:#5f5d58;text-transform:uppercase">${k}</td><td class="ink" valign="top" style="padding:${first ? '0' : '12px'} 0 0;font-family:${F};font-size:15px;line-height:20px;font-weight:600;color:#0a0a0a;word-break:break-word">${v}</td></tr>`;
  const dot = c => `<span style="display:inline-block;width:9px;height:9px;border-radius:9px;background-color:${c};vertical-align:middle;margin-right:7px"></span>`;
  const label = t => `<p class="muted" style="margin:0;font-family:${F};font-size:11px;line-height:14px;letter-spacing:0.08em;font-weight:700;color:#5f5d58">${t}</p>`;
  const button = (txt, href) => `<tr><td class="px" style="padding:26px 32px 32px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="btn" bgcolor="#0a0a0a" style="background-color:#0a0a0a;border-radius:999px">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${esc(href)}" style="height:52px;v-text-anchor:middle;width:230px" arcsize="50%" fillcolor="#0a0a0a" stroke="f"><center style="color:#ffffff;font-family:Arial;font-size:15px;font-weight:bold">${txt}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${esc(href)}" style="display:inline-block;padding:16px 30px;font-family:${F};font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${txt} &rarr;</a><!--<![endif]-->
</td></tr></table></td></tr>`;
  // Tarjeta de tarea: barra de color + contenido
  const taskCard = (color, inner) => `<tr><td class="px" style="padding:22px 32px 0">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="soft" bgcolor="#f2f2f0" style="background-color:#f2f2f0;border-radius:20px"><tr>
<td width="6" bgcolor="${color}" style="width:6px;background-color:${color};border-radius:20px 0 0 20px;font-size:0;line-height:0">&nbsp;</td>
<td class="soft" style="padding:20px 20px 20px 18px;background-color:#f2f2f0;border-radius:0 20px 20px 0">${inner}</td>
</tr></table></td></tr>`;

  function asignada(d, dark) {
    const rows = [
      row('Día', esc(d.dia), true), row('Horario', esc(d.horario)),
      row('Equipo', `${esc(d.departamento)} &rsaquo; ${dot(d.color)}${esc(d.sub_departamento)}`),
      row('Prioridad', `${dot(d.prio_color)}${esc(d.prioridad)}`)
    ].join('') + (d.carpeta ? (d.vars ? '{{#carpeta}}' : '') + row('Carpeta', esc(d.carpeta)) + (d.vars ? '{{/carpeta}}' : '') : '');
    const inner = `<p class="ink" style="margin:0 0 16px;font-family:${F};font-size:19px;line-height:25px;font-weight:700;color:#0a0a0a">${esc(d.nombre_tarea)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>`;
    const body = kicker('NUEVA TAREA', '#ebebe8', '#0a0a0a', 'pill ink') + h1(`Hola ${esc(d.nombre)}, tenés una tarea nueva`)
      + `<tr><td class="px muted" style="padding:8px 32px 0;font-family:${F};font-size:15px;line-height:23px;font-weight:500;color:#4a4844">${esc(d.departamento)} te la asignó en Agenda Origen. Ya la tenés en tu agenda.</td></tr>`
      + taskCard(d.color, inner)
      + `<tr><td class="px" style="padding:24px 32px 0">${label('DETALLES')}</td></tr>`
      + `<tr><td class="px ink" style="padding:8px 32px 0;font-family:${F};font-size:15.5px;line-height:25px;font-weight:500;color:#0a0a0a;word-break:break-word">${d.vars ? esc(d.detalles) : br(d.detalles)}</td></tr>`
      + `<tr><td class="px" style="padding:22px 32px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td class="rule" style="border-top:1px solid #ecebe8;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`
      + `<tr><td class="px muted" style="padding:14px 32px 0;font-family:${F};font-size:13px;line-height:19px;font-weight:600;color:#5f5d58">Asignada por ${esc(d.creador)} el ${esc(d.fecha_creacion)}</td></tr>`
      + button('Ver en mi Agenda', d.link_agenda);
    return shell({ asunto: `Nueva tarea: ${d.nombre_tarea} · ${d.fecha_corta}`, pre: `${d.departamento} te asignó una tarea en Agenda Origen`, body, pie: `Te llega porque sos parte de ${esc(d.sub_departamento)} en ${esc(d.departamento)}.` }, dark);
  }

  function completada(d, dark) {
    const rows = [
      row('Marcó', `${esc(d.completo_por)}<br><span class="muted" style="font-weight:500;color:#5f5d58">${esc(d.completo_fecha)}</span>`, true),
      row('Día', `${esc(d.dia)} · ${esc(d.horario)}`),
      row('Equipo', `${esc(d.departamento)} &rsaquo; ${dot(d.color)}${esc(d.sub_departamento)}`),
      row('Prioridad', `${dot(d.prio_color)}${esc(d.prioridad)}`)
    ].join('') + (d.carpeta ? (d.vars ? '{{#carpeta}}' : '') + row('Carpeta', esc(d.carpeta)) + (d.vars ? '{{/carpeta}}' : '') : '');
    const inner = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px"><tr><td class="ok okink" bgcolor="#dcf2e3" style="padding:5px 11px;background-color:#dcf2e3;border-radius:999px;font-family:${F};font-size:12px;line-height:15px;font-weight:700;color:#11612f">&#10003; Completada</td></tr></table>
<p class="ink" style="margin:0 0 16px;font-family:${F};font-size:19px;line-height:25px;font-weight:700;color:#0a0a0a">${esc(d.nombre_tarea)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>`;
    const people = d.vars ? esc(d.integrantes) : d.integrantes.map(p => esc(p)).join('<br>');
    const body = kicker('&#10003; TAREA COMPLETADA', '#dcf2e3', '#11612f', 'ok okink') + h1(`Se completó una tarea de ${esc(d.sub_departamento)}`)
      + `<tr><td class="px muted" style="padding:8px 32px 0;font-family:${F};font-size:15px;line-height:23px;font-weight:500;color:#4a4844">Te avisamos porque sos encargado/a de ${esc(d.departamento)}.</td></tr>`
      + taskCard(d.color, inner)
      + `<tr><td class="px" style="padding:24px 32px 0">${label('LA TENÍAN')}</td></tr>`
      + `<tr><td class="px ink" style="padding:8px 32px 0;font-family:${F};font-size:15px;line-height:24px;font-weight:600;color:#0a0a0a">${people}</td></tr>`
      + `<tr><td class="px" style="padding:22px 32px 0">${label('DETALLES')}</td></tr>`
      + `<tr><td class="px ink" style="padding:8px 32px 0;font-family:${F};font-size:15.5px;line-height:25px;font-weight:500;color:#0a0a0a;word-break:break-word">${d.vars ? esc(d.detalles) : br(d.detalles)}</td></tr>`
      + `<tr><td class="px" style="padding:22px 32px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td class="rule" style="border-top:1px solid #ecebe8;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`
      + `<tr><td class="px muted" style="padding:14px 32px 0;font-family:${F};font-size:13px;line-height:20px;font-weight:600;color:#5f5d58">Creada por ${esc(d.creador)} el ${esc(d.fecha_creacion)}`
      + (d.solicitante ? (d.vars ? '{{#solicitante}}' : '') + `<br>Solicitada por ${esc(d.solicitante)} el ${esc(d.fecha_solicitud)}` + (d.vars ? '{{/solicitante}}' : '') : '') + `</td></tr>`
      + button('Ver en el panel', d.link_panel);
    return shell({ asunto: `✓ Completada: ${d.nombre_tarea} · ${d.sub_departamento}`, pre: `${d.completo_por} marcó la tarea como completada`, body, pie: `Te llega porque sos encargado/a de ${esc(d.departamento)}.` }, dark);
  }
  window.AOMail = { asignada, completada };
})();

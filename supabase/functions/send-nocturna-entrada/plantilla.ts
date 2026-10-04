// Plantilla del email de la entrada de Nocturna.
//
// Es una copia EXACTA de `design-claude/Email - Entrada Nocturna.html`, con un
// cambios: la fila del pago decía "{{cantidadChicos}} entradas", que con
// un chico daba "1 entradas" — el número y la palabra ahora son dos variables;
// y el rótulo "Tribu " era literal, así que a un chico sin tribu le salía
// "Tribu Sin tribu". Ahora el rótulo lo arma la función.
//
// Va embebida como string porque en tiempo de ejecución la función no puede
// leer archivos del repo. Si se toca el diseño, hay que regenerar este archivo.
//
// El QR se referencia con `cid:` y viaja como adjunto incrustado, no como URL:
// una imagen remota la bloquea Outlook por defecto, y subirla a un bucket
// público dejaría la entrada de una familia a la vista de cualquiera.

export const PLANTILLA_ENTRADA = String.raw`<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Tu entrada para Nocturna</title>
<!--[if mso]>
<style>body,table,td,a,p,h1{font-family:Arial,Helvetica,sans-serif !important}</style>
<![endif]-->
<style>
@media (max-width:620px){
  .px{padding-left:20px !important;padding-right:20px !important}
  .h1{font-size:26px !important;line-height:32px !important}
  .code{font-size:26px !important;letter-spacing:3px !important}
}
@media (prefers-color-scheme:dark){
  .canvas,.canvas td{background-color:#141413 !important}
  td.card,.card,.card td{background-color:#1c1c1a !important}
  td.soft,.soft,.soft td{background-color:#262624 !important}
  .ink{color:#f4f3f0 !important}
  .muted{color:#a8a6a1 !important}
  .rule td{border-top-color:#2f2f2c !important}
  td.qrbox,.qrbox,.qrbox td{background-color:#ffffff !important}
}
body.force-dark .canvas,body.force-dark .canvas td{background-color:#141413 !important}
body.force-dark td.card,body.force-dark .card,body.force-dark .card td{background-color:#1c1c1a !important}
body.force-dark td.soft,body.force-dark .soft,body.force-dark .soft td{background-color:#262624 !important}
body.force-dark .ink{color:#f4f3f0 !important}
body.force-dark .muted{color:#a8a6a1 !important}
body.force-dark .rule td{border-top-color:#2f2f2c !important}
body.force-dark td.qrbox,body.force-dark .qrbox,body.force-dark .qrbox td{background-color:#ffffff !important}
</style>
</head>
<body style="margin:0;padding:0;background-color:#f2f2f0" bgcolor="#f2f2f0">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">Un solo QR para toda la familia. Viernes 30 de Octubre a las 11 PM hasta Sábado 31 de Octubre hasta las 6 AM. Av. Eva Perón 3932.</div>

<table role="presentation" class="canvas" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f2f0" style="background-color:#f2f2f0">
<tr><td align="center" bgcolor="#f2f2f0" style="background-color:#f2f2f0;padding:24px 12px 40px">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f2f0" style="width:100%;max-width:600px;background-color:#f2f2f0">

    <tr><td bgcolor="#f2f2f0" style="background-color:#f2f2f0;padding:0 8px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f2f0" style="background-color:#f2f2f0">
        <tr>
          <td align="left" bgcolor="#f2f2f0" style="background-color:#f2f2f0;vertical-align:middle">
            <img src="https://app.origeniglesia.org/origen-logo-full.png" width="104" height="46" alt="Origen Iglesia" style="display:block;width:104px;height:46px;border:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;color:#0a0a0a">
          </td>
          <td align="right" class="muted" bgcolor="#f2f2f0" style="background-color:#f2f2f0;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:600;color:#6b6a66">Nocturna 2026</td>
        </tr>
      </table>
    </td></tr>

    <tr><td class="card" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:24px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:24px">

        <tr><td class="px ink" bgcolor="#ffffff" style="background-color:#ffffff;padding:32px 36px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#0a0a0a">Hola {{nombreAdulto}}, tu inscripción a Nocturna quedó confirmada.</td></tr>
        <tr><td class="px ink h1" bgcolor="#ffffff" style="background-color:#ffffff;padding:10px 36px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:30px;line-height:36px;font-weight:600;letter-spacing:-0.5px;color:#0a0a0a">Esta es tu entrada</td></tr>
        <tr><td class="px muted" bgcolor="#ffffff" style="background-color:#ffffff;padding:8px 36px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:22px;color:#55534e"><strong class="ink" style="color:#0a0a0a;font-weight:600">Un solo QR para toda la familia.</strong> Entran todos con este mismo código, no hay uno por adolescente.</td></tr>

        <tr><td class="px" align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:22px 36px 0">
          <table role="presentation" class="qrbox" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #e3e2de;border-radius:20px">
            <tr><td class="qrbox" align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:24px;border-radius:20px">
              <img src="{{qrUrl}}" width="300" height="300" alt="QR de la entrada · código {{codigoEntrada}}" style="display:block;width:100%;max-width:300px;height:auto;border:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#0a0a0a">
            </td></tr>
          </table>
        </td></tr>

        <tr><td class="px muted" align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:20px 36px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;font-weight:600;letter-spacing:1px;color:#6b6a66">CÓDIGO DE ENTRADA</td></tr>
        <tr><td class="px ink code" align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:6px 36px 0;font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:30px;line-height:36px;font-weight:700;letter-spacing:4px;color:#0a0a0a">{{codigoEntrada}}</td></tr>
        <tr><td class="px muted" align="center" bgcolor="#ffffff" style="background-color:#ffffff;padding:10px 44px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#55534e">Si el QR no se ve, en la puerta decí este código o el nombre del adulto responsable: <strong class="ink" style="color:#0a0a0a;font-weight:600">{{nombreAdulto}}</strong>.</td></tr>

        <tr><td class="px" bgcolor="#ffffff" style="background-color:#ffffff;padding:28px 36px 0">
          <table role="presentation" class="soft" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f2" style="background-color:#f4f4f2;border-radius:18px">
            <tr><td class="soft" bgcolor="#f4f4f2" style="background-color:#f4f4f2;padding:16px 20px 4px;border-radius:18px 18px 0 0">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f2" style="background-color:#f4f4f2">
                <tr>
                  <td class="muted" width="70" valign="top" bgcolor="#f4f4f2" style="background-color:#f4f4f2;padding:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6b6a66">Cuándo</td>
                  <td class="ink" valign="top" bgcolor="#f4f4f2" style="background-color:#f4f4f2;padding:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:600;color:#0a0a0a">Viernes 30 de Octubre a las 11 PM hasta Sábado 31 de Octubre hasta las 6 AM</td>
                </tr>
                <tr>
                  <td class="muted" width="70" valign="top" bgcolor="#f4f4f2" style="background-color:#f4f4f2;padding:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6b6a66">Lugar</td>
                  <td class="ink" valign="top" bgcolor="#f4f4f2" style="background-color:#f4f4f2;padding:0 0 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:600;color:#0a0a0a">Av. Eva Perón 3932</td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td class="px" bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 36px 0">
          <table role="presentation" class="rule" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff">
            <tr><td bgcolor="#ffffff" style="background-color:#ffffff;border-top:1px solid #ecebe8;font-size:0;line-height:0;height:1px">&nbsp;</td></tr>
          </table>
        </td></tr>
        <tr><td class="px" bgcolor="#ffffff" style="background-color:#ffffff;padding:16px 36px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff">
            <tr>
              <td class="muted" bgcolor="#ffffff" style="background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#55534e">Pago · {{cantidadChicos}} {{palabraEntradas}}</td>
              <td class="ink" align="right" bgcolor="#ffffff" style="background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:16px;line-height:20px;font-weight:600;color:#0a0a0a">{{totalPagado}}</td>
            </tr>
          </table>
        </td></tr>

        <tr><td class="px" bgcolor="#ffffff" style="background-color:#ffffff;padding:28px 36px 36px">
          <table role="presentation" class="soft" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f2" style="background-color:#f4f4f2;border-radius:18px">
            <tr><td class="soft" bgcolor="#f4f4f2" style="background-color:#f4f4f2;padding:18px 20px 6px;border-radius:18px 18px 0 0">
              <span class="ink" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;font-weight:600;color:#0a0a0a">En la puerta</span>
              
            </td></tr>
            <tr><td class="soft ink" bgcolor="#f4f4f2" style="background-color:#f4f4f2;padding:6px 20px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#0a0a0a">1.&nbsp; El ingreso abre 11pm. Llegá con tiempo.</td></tr>
            <tr><td class="soft ink" bgcolor="#f4f4f2" style="background-color:#f4f4f2;padding:8px 20px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#0a0a0a">2.&nbsp; Tené el QR a mano, se te pedirá para poder ingresar.</td></tr>
            <tr><td class="soft ink" bgcolor="#f4f4f2" style="background-color:#f4f4f2;padding:8px 20px 18px;border-radius:0 0 18px 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:14px;line-height:21px;color:#0a0a0a">3.&nbsp; A las 6 am, el adulto que retira a cada chico debe mostrar su DNI.</td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>

    <tr><td class="muted" align="center" bgcolor="#f2f2f0" style="background-color:#f2f2f0;padding:20px 24px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#6b6a66">Guardá este email: es la entrada de toda la familia.<br>Origen Iglesia · Av. Eva Perón 3932</td></tr>
  </table>

</td></tr>
</table>
</body>
</html>
`;

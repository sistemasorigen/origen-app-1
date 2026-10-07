// Plantilla del email de la entrada de Nocturna.
//
// Es `design-claude/Email - Entrada Nocturna v2.html` con tres cambios, todos
// a propósito:
//
//   1. La cabecera sale del bucket público `images` y no de
//      app.origeniglesia.org. Así el email no depende de que se publique el
//      frontend: si la plantilla saliera antes que el sitio, las familias
//      recibirían la entrada con la cabecera rota. Es una imagen decorativa y
//      sin datos, por eso puede ir a un bucket público.
//   2. Los tres pasos de "En la puerta" llevan el texto que ya estaba en el
//      código, no el del diseño. Son instrucciones operativas: las redacta
//      quien está en la puerta, no el diseño.
//   3. La línea de "si el QR no se ve" vuelve a nombrar al adulto
//      responsable. El diseño la dejó sin el nombre, pero es justo el dato
//      que el staff necesita para encontrar la inscripción a mano.
//
// Las seis variables son las mismas de siempre y con los mismos nombres, así
// que `armado.ts` e `index.ts` no cambian: {{nombreAdulto}},
// {{codigoEntrada}}, {{cantidadChicos}}, {{palabraEntradas}},
// {{totalPagado}} y {{qrUrl}}.
//
// Va embebida como string porque en tiempo de ejecución la función no puede
// leer archivos del repo. Si se toca el diseño, hay que regenerar este
// archivo.
//
// El QR se referencia con `cid:` y viaja como adjunto incrustado, no como
// URL: una imagen remota la bloquea Outlook por defecto, y subirla a un
// bucket público dejaría la entrada de una familia a la vista de cualquiera.
// La cabecera sí puede ir por URL porque no dice nada de nadie.

export const PLANTILLA_ENTRADA = String.raw`
<!DOCTYPE html>
<html lang="es" style="background-color:#ffffff;" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Tu entrada para Nocturna</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
:root{color-scheme:light only;supported-color-schemes:light only}
html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;background-color:#ffffff!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
a[x-apple-data-detectors]{color:inherit!important;text-decoration:none!important}
@media (prefers-color-scheme:dark){
.nc-rosa{background-color:#E04497!important}
.nc-lima{background-color:#DBE479!important}
.nc-blanco{background-color:#ffffff!important}
.nc-negro{background-color:#000000!important}
.nc-tn{color:#000000!important}
.nc-tl{color:#DBE479!important}
}
[data-ogsb] .nc-rosa{background-color:#E04497!important}
[data-ogsb] .nc-lima{background-color:#DBE479!important}
[data-ogsb] .nc-blanco{background-color:#ffffff!important}
[data-ogsb] .nc-negro{background-color:#000000!important}
[data-ogsc] .nc-tn{color:#000000!important}
[data-ogsc] .nc-tl{color:#DBE479!important}
@media screen and (max-width:620px){
.nc-pad{padding-left:16px!important;padding-right:16px!important}
.nc-marco{padding:8px!important}
.nc-h1{font-size:44px!important}
.nc-cod{font-size:34px!important;letter-spacing:3px!important}
}
</style>
</head>
<body class="nc-blanco" bgcolor="#ffffff" style="margin:0; padding:0; background-color:#ffffff;">
<div class="nc-blanco" style="background-color:#ffffff; margin:0; padding:0; width:100%;">

<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#E04497; opacity:0;">Tu entrada para Nocturna: un solo QR para toda la familia. Viernes 30.10, de 11 PM a 6 AM, en Av. Eva Perón 3932.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>

<table role="presentation" class="nc-blanco" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;">
<tr>
<td class="nc-blanco nc-marco" align="center" bgcolor="#ffffff" style="background-color:#ffffff; padding:14px;">

<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" class="nc-rosa" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E04497" style="max-width:600px; width:100%; background-color:#E04497; border:3px solid #000000; border-radius:28px;">

<!-- CABECERA -->
<tr>
<td class="nc-rosa" bgcolor="#E04497" style="background-color:#E04497; padding:0; font-size:0; line-height:0;">
<div style="border-radius:25px 25px 0 0; overflow:hidden; font-size:0; line-height:0;">
<img src="https://oqtumgalnozppqnnjjdb.supabase.co/storage/v1/object/public/images/email/nocturna/nocturna-cabecera.jpg" width="600" alt="NOCTURNA 2026 · Origen Iglesia" style="display:block; width:100%; max-width:600px; height:auto; border:0; border-radius:25px 25px 0 0; outline:none; text-decoration:none; background-color:#E04497; color:#000000; font-family:Arial,Helvetica,sans-serif; font-size:28px; font-weight:bold; line-height:1.2; text-align:center;">
</div>
</td>
</tr>

<tr>
<td class="nc-rosa nc-pad" bgcolor="#E04497" style="background-color:#E04497; padding:22px 28px 0 28px; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<p class="nc-tn nc-h1" style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:56px; line-height:0.95; font-weight:900; letter-spacing:-2px; color:#000000;">NOCTURNA</p>
<p class="nc-tn" style="margin:8px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:1.3; font-weight:bold; letter-spacing:-0.3px; color:#000000;">[ 2026 ]</p>
</td>
</tr>

<!-- SALUDO -->
<tr>
<td class="nc-rosa nc-pad" bgcolor="#E04497" style="background-color:#E04497; padding:18px 28px 22px 28px;">
<p class="nc-tn" style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:19px; line-height:1.4; font-weight:bold; letter-spacing:-0.3px; color:#000000;">Hola {{nombreAdulto}}, tu inscripción a Nocturna quedó confirmada.</p>
</td>
</tr>

<!-- ENTRADA -->
<tr>
<td class="nc-rosa nc-pad" bgcolor="#E04497" style="background-color:#E04497; padding:0 28px;">
<table role="presentation" class="nc-negro" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color:#000000; border-radius:26px;">
<tr>
<td class="nc-negro" bgcolor="#000000" style="background-color:#000000; padding:3px; border-radius:26px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

<tr>
<td class="nc-lima" bgcolor="#DBE479" align="center" style="background-color:#DBE479; padding:16px 16px 14px 16px; border-radius:23px 23px 0 0;">
<p class="nc-tn" style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.2; font-weight:900; letter-spacing:-0.3px; color:#000000;">[ ESTA ES TU ENTRADA ]</p>
</td>
</tr>

<tr>
<td class="nc-blanco" bgcolor="#ffffff" align="center" style="background-color:#ffffff; padding:18px 12px 6px 12px;">
<table role="presentation" class="nc-blanco" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color:#ffffff;">
<tr>
<td class="nc-blanco" bgcolor="#ffffff" style="background-color:#ffffff; padding:0; font-size:0; line-height:0;">
<img src="{{qrUrl}}" width="300" height="300" alt="QR de la entrada {{codigoEntrada}}" style="display:block; width:300px; max-width:100%; height:auto; border:0; background-color:#ffffff; color:#000000; font-family:Arial,Helvetica,sans-serif; font-size:16px; font-weight:bold;">
</td>
</tr>
</table>
</td>
</tr>

<tr>
<td class="nc-blanco" bgcolor="#ffffff" align="center" style="background-color:#ffffff; padding:10px 20px 22px 20px;">
<p class="nc-tn" style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:12px; line-height:1.2; font-weight:bold; letter-spacing:1px; color:#000000;">CÓDIGO DE ENTRADA</p>
<p class="nc-tn nc-cod" style="margin:6px 0 0 0; font-family:'Courier New',Courier,monospace; font-size:40px; line-height:1.1; font-weight:bold; letter-spacing:5px; color:#000000;">{{codigoEntrada}}</p>
<p class="nc-tn" style="margin:12px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:14px; line-height:1.45; font-weight:normal; color:#000000;">Si el QR no se ve, en la puerta decí este código o el nombre del adulto responsable: <strong style="font-weight:900;">{{nombreAdulto}}</strong>.</p>
</td>
</tr>

<tr>
<td class="nc-lima" bgcolor="#DBE479" style="background-color:#DBE479; padding:18px 22px 6px 22px; border-top:3px dashed #000000;">
<p class="nc-tn" style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.45; color:#000000;"><strong style="font-weight:900;">Un solo QR para toda la familia.</strong> Entran todos con este mismo código, no hay uno por adolescente.</p>
</td>
</tr>

<tr>
<td class="nc-lima" bgcolor="#DBE479" style="background-color:#DBE479; padding:8px 22px 20px 22px; border-radius:0 0 23px 23px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="nc-lima nc-tn" bgcolor="#DBE479" valign="top" style="background-color:#DBE479; padding:12px 0; border-top:2px solid #000000; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; font-weight:bold; color:#000000; width:84px;">CUÁNDO</td>
<td class="nc-lima nc-tn" bgcolor="#DBE479" valign="top" align="right" style="background-color:#DBE479; padding:12px 0; border-top:2px solid #000000; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:1.35; font-weight:900; letter-spacing:-0.2px; color:#000000;">VIERNES 30.10 // 11&nbsp;PM&nbsp;-&nbsp;6&nbsp;AM</td>
</tr>
<tr>
<td class="nc-lima nc-tn" bgcolor="#DBE479" valign="top" style="background-color:#DBE479; padding:12px 0; border-top:2px solid #000000; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; font-weight:bold; color:#000000;">DÓNDE</td>
<td class="nc-lima nc-tn" bgcolor="#DBE479" valign="top" align="right" style="background-color:#DBE479; padding:12px 0; border-top:2px solid #000000; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:1.35; font-weight:900; letter-spacing:-0.2px; color:#000000;">Av. Eva Perón 3932</td>
</tr>
<tr>
<td class="nc-lima nc-tn" bgcolor="#DBE479" valign="top" style="background-color:#DBE479; padding:12px 0 0 0; border-top:2px solid #000000; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; font-weight:bold; color:#000000;">PAGO</td>
<td class="nc-lima nc-tn" bgcolor="#DBE479" valign="top" align="right" style="background-color:#DBE479; padding:12px 0 0 0; border-top:2px solid #000000; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:1.35; font-weight:900; letter-spacing:-0.2px; color:#000000;">{{cantidadChicos}} {{palabraEntradas}} // {{totalPagado}}</td>
</tr>
</table>
</td>
</tr>

</table>
</td>
</tr>
</table>
</td>
</tr>

<!-- EN LA PUERTA -->
<tr>
<td class="nc-rosa nc-pad" bgcolor="#E04497" style="background-color:#E04497; padding:30px 28px 0 28px;">
<p class="nc-tn" style="margin:0 0 12px 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.2; font-weight:900; letter-spacing:-0.3px; color:#000000;">[ EN LA PUERTA ]</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="nc-rosa nc-tn" bgcolor="#E04497" valign="top" style="background-color:#E04497; width:44px; padding:12px 0; border-top:2px solid #000000; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:26px; line-height:1; font-weight:900; color:#000000;">1</td>
<td class="nc-rosa nc-tn" bgcolor="#E04497" valign="top" style="background-color:#E04497; padding:13px 0; border-top:2px solid #000000; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.45; font-weight:bold; color:#000000;">El ingreso abre 11pm. Llegá con tiempo.</td>
</tr>
<tr>
<td class="nc-rosa nc-tn" bgcolor="#E04497" valign="top" style="background-color:#E04497; width:44px; padding:12px 0; border-top:2px solid #000000; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:26px; line-height:1; font-weight:900; color:#000000;">2</td>
<td class="nc-rosa nc-tn" bgcolor="#E04497" valign="top" style="background-color:#E04497; padding:13px 0; border-top:2px solid #000000; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.45; font-weight:bold; color:#000000;">Tené el QR a mano, se te pedirá para poder ingresar.</td>
</tr>
<tr>
<td class="nc-rosa nc-tn" bgcolor="#E04497" valign="top" style="background-color:#E04497; width:44px; padding:12px 0; border-top:2px solid #000000; border-bottom:2px solid #000000; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:26px; line-height:1; font-weight:900; color:#000000;">3</td>
<td class="nc-rosa nc-tn" bgcolor="#E04497" valign="top" style="background-color:#E04497; padding:13px 0; border-top:2px solid #000000; border-bottom:2px solid #000000; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:16px; line-height:1.45; font-weight:bold; color:#000000;">A las 6 am, el adulto que retira a cada chico debe mostrar su DNI.</td>
</tr>
</table>
</td>
</tr>

<!-- GUARDAR -->
<tr>
<td class="nc-rosa nc-pad" bgcolor="#E04497" style="background-color:#E04497; padding:26px 28px 0 28px;">
<table role="presentation" class="nc-lima" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#DBE479" style="background-color:#DBE479; border:3px solid #000000; border-radius:22px;">
<tr>
<td class="nc-lima" bgcolor="#DBE479" align="center" style="background-color:#DBE479; padding:18px 18px; border-radius:20px;">
<p class="nc-tn" style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:17px; line-height:1.4; font-weight:900; letter-spacing:-0.3px; color:#000000;">Guardá este email: es la entrada de toda la familia.</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- PIE -->
<tr>
<td class="nc-rosa nc-pad" bgcolor="#E04497" align="center" style="background-color:#E04497; padding:30px 28px 40px 28px; border-radius:0 0 25px 25px;">
<p class="nc-tn" style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.5; font-weight:bold; color:#000000;">ORIGEN IGLESIA // AV. EVA PERÓN 3932</p>
<p class="nc-tn" style="margin:6px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.5; font-weight:bold; color:#000000;"><a class="nc-tn" href="https://instagram.com/influos.ogn" style="color:#000000; text-decoration:underline;">@INFLUOS.OGN</a> &nbsp;//&nbsp; <a class="nc-tn" href="https://instagram.com/origeniglesia" style="color:#000000; text-decoration:underline;">@ORIGENIGLESIA</a></p>
</td>
</tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->

</td>
</tr>
</table>
</div>
</body>
</html>
`;

// Plantilla del email "te falta un dato" de Nocturna.
//
// Es design-claude/Email - Nocturna Datos Faltantes.html tal cual, con UN
// cambio: la cabecera sale del bucket publico `images` y no de
// app.origeniglesia.org. En el sitio, /email/nocturna-cabecera.jpg devuelve
// el index.html de la SPA —200, pero text/html—, asi que la imagen saldria
// rota en todos los emails. Es una foto decorativa y sin datos de nadie, por
// eso puede vivir en un bucket publico. Mismo criterio que el email de la
// entrada.
//
// Tres variables: {{nombreAdulto}}, {{codigoEntrada}} y {{linkCompletar}}.
// Las tres se escapan antes de entrar (ver armado.ts).
//
// Va embebida como string porque en tiempo de ejecucion la funcion no puede
// leer archivos del repo. Si se toca el diseno, hay que regenerar este
// archivo.

export const PLANTILLA_DATOS_FALTANTES = String.raw`
<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Te falta un dato para tu entrada a Nocturna</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><style>*{font-family:Arial,Helvetica,sans-serif!important}</style><![endif]-->
<!--[if !mso]><!--><link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&family=Bagel+Fat+One&display=swap" rel="stylesheet"><!--<![endif]-->
<style>
:root{color-scheme:light only;supported-color-schemes:light only}
body{margin:0!important;padding:0!important;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
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
.nc-h1{font-size:40px!important}
.nc-h2{font-size:30px!important}
.nc-cod{font-size:38px!important;letter-spacing:6px!important}
}
</style>
</head>
<body class="nc-rosa" bgcolor="#E04497" style="margin:0; padding:0; background-color:#E04497;">

<div style="display:none; max-height:0; overflow:hidden; mso-hide:all; font-size:1px; line-height:1px; color:#E04497; opacity:0;">Completalo en un minuto con tu código de entrada.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>

<table role="presentation" class="nc-rosa" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E04497" style="background-color:#E04497;">
<tr>
<td class="nc-rosa" align="center" bgcolor="#E04497" style="background-color:#E04497; padding:0;">

<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td><![endif]-->
<table role="presentation" class="nc-rosa" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E04497" style="max-width:600px; width:100%; background-color:#E04497;">

<!-- CABECERA -->
<tr>
<td class="nc-rosa" bgcolor="#E04497" style="background-color:#E04497; padding:0; font-size:0; line-height:0;">
<img src="https://oqtumgalnozppqnnjjdb.supabase.co/storage/v1/object/public/images/email/nocturna/nocturna-cabecera.jpg" width="600" alt="NOCTURNA 2026 · Origen Iglesia" style="display:block; width:100%; max-width:600px; height:auto; border:0; outline:none; text-decoration:none; background-color:#E04497; color:#000000; font-family:Arial,Helvetica,sans-serif; font-size:28px; font-weight:bold; line-height:1.2; text-align:center;">
</td>
</tr>

<tr>
<td class="nc-rosa nc-pad" bgcolor="#E04497" style="background-color:#E04497; padding:22px 28px 0 28px;">
<p class="nc-tn nc-h1" style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:56px; line-height:0.95; font-weight:900; letter-spacing:-2px; color:#000000;">NOCTURNA</p>
<p class="nc-tn" style="margin:8px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:1.3; font-weight:bold; letter-spacing:-0.3px; color:#000000;">[ VIERNES 30.10 // 22:00 ]</p>
</td>
</tr>

<!-- TITULO + CUERPO -->
<tr>
<td class="nc-rosa nc-pad" bgcolor="#E04497" style="background-color:#E04497; padding:26px 28px 0 28px;">
<p class="nc-tn nc-h2" style="margin:0; font-family:'Bagel Fat One','Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif; font-size:36px; line-height:1.05; font-weight:900; color:#000000;">Te falta un dato</p>
<p class="nc-tn" style="margin:18px 0 0 0; font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:18px; line-height:1.45; font-weight:bold; color:#000000;">Hola, {{nombreAdulto}}:</p>
<p class="nc-tn" style="margin:8px 0 0 0; font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:17px; line-height:1.5; font-weight:500; color:#000000;">Tu entrada a Nocturna ya es válida, pero falta tu número de teléfono. Lo vamos a necesitar la noche del viernes 30, por si tenemos que comunicarnos con vos.</p>
</td>
</tr>

<!-- CODIGO (TROQUEL) -->
<tr>
<td class="nc-rosa nc-pad" bgcolor="#E04497" style="background-color:#E04497; padding:26px 28px 0 28px;">
<table role="presentation" class="nc-negro" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color:#000000; border-radius:26px;">
<tr>
<td class="nc-negro" bgcolor="#000000" style="background-color:#000000; padding:3px; border-radius:26px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="nc-blanco" bgcolor="#ffffff" align="center" style="background-color:#ffffff; padding:22px 16px 20px 16px; border-radius:23px 23px 0 0;">
<p class="nc-tn" style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:12px; line-height:1.2; font-weight:bold; letter-spacing:1.5px; color:#000000;">TU CÓDIGO DE ENTRADA</p>
<p class="nc-tn nc-cod" style="margin:8px 0 0 0; font-family:'Courier New',Courier,monospace; font-size:46px; line-height:1.1; font-weight:bold; letter-spacing:8px; color:#000000;">{{codigoEntrada}}</p>
</td>
</tr>
<tr>
<td class="nc-lima" bgcolor="#DBE479" style="background-color:#DBE479; padding:16px 22px 18px 22px; border-top:3px dashed #000000; border-radius:0 0 23px 23px;">
<p class="nc-tn" style="margin:0; font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:15px; line-height:1.45; font-weight:bold; color:#000000;">Te vamos a pedir los últimos 3 números de tu DNI para confirmar que sos vos.</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</td>
</tr>

<!-- BOTON -->
<tr>
<td class="nc-rosa nc-pad" align="center" bgcolor="#E04497" style="background-color:#E04497; padding:26px 28px 0 28px;">
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{linkCompletar}}" style="height:62px; v-text-anchor:middle; width:544px;" arcsize="50%" stroke="f" fillcolor="#000000">
<w:anchorlock/>
<center style="color:#DBE479; font-family:Arial,sans-serif; font-size:17px; font-weight:bold;">[ COMPLETAR MIS DATOS ]</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td class="nc-negro" align="center" bgcolor="#000000" style="background-color:#000000; border-radius:999px;">
<a class="nc-tl" href="{{linkCompletar}}" target="_blank" style="display:block; padding:21px 20px; font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:17px; line-height:20px; font-weight:900; letter-spacing:-0.2px; color:#DBE479; text-decoration:none; border-radius:999px;">[ COMPLETAR MIS DATOS ]</a>
</td>
</tr>
</table>
<!--<![endif]-->
<p class="nc-tn" style="margin:16px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.5; color:#000000;">Si el botón no funciona, copiá este link en el navegador:<br><a class="nc-tn" href="{{linkCompletar}}" style="color:#000000; text-decoration:underline; word-break:break-all;">{{linkCompletar}}</a></p>
</td>
</tr>

<!-- PLAZO -->
<tr>
<td class="nc-rosa nc-pad" bgcolor="#E04497" style="background-color:#E04497; padding:26px 28px 0 28px;">
<table role="presentation" class="nc-lima" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#DBE479" style="background-color:#DBE479; border:3px solid #000000; border-radius:22px;">
<tr>
<td class="nc-lima" bgcolor="#DBE479" align="center" style="background-color:#DBE479; padding:18px 18px; border-radius:20px;">
<p class="nc-tn" style="margin:0; font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:17px; line-height:1.4; font-weight:900; letter-spacing:-0.3px; color:#000000;">Completalo antes del jueves 29 de octubre.</p>
</td>
</tr>
</table>
</td>
</tr>

<!-- PIE -->
<tr>
<td class="nc-rosa nc-pad" bgcolor="#E04497" align="center" style="background-color:#E04497; padding:30px 28px 40px 28px;">
<p class="nc-tn" style="margin:0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.5; font-weight:bold; color:#000000;">ORIGEN IGLESIA // AV. EVA PERÓN 3932</p>
<p class="nc-tn" style="margin:6px 0 0 0; font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:13px; line-height:1.5; font-weight:bold; color:#000000;"><a class="nc-tn" href="https://instagram.com/influos.ogn" style="color:#000000; text-decoration:underline;">@INFLUOS.OGN</a> &nbsp;//&nbsp; <a class="nc-tn" href="https://instagram.com/origeniglesia" style="color:#000000; text-decoration:underline;">@ORIGENIGLESIA</a></p>
</td>
</tr>

</table>
<!--[if mso]></td></tr></table><![endif]-->

</td>
</tr>
</table>
</body>
</html>
`;

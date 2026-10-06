# Textos que cambiaron — rediseño de Nocturna, prompt 1/6

Pantallas 0 (bienvenida), 2 (adolescentes) y 8 (entrada), más lo que comparten
todas: la cabecera, la barra de pasos, el pie y el aviso de "Deshacer".

**Cómo leer la tabla**

- **Antes**: el texto de la versión anterior al rediseño.
- **Después**: el texto nuevo, que sale del diseño (`design-claude/Nocturna - Inscripcion.dc.html`), con "adolescentes" donde el diseño dice "chicos".
- Las MAYÚSCULAS las pone el CSS. En el código el texto está escrito normal, para que el lector de pantalla no lo deletree. Por eso en la tabla van como se escriben en el código.
- Los corchetes `[ … ]` son decorado. El lector de pantalla no los lee.

**Marcas**

- 🔒 **Regla o texto legal**: se dejó como está en el código, aunque el diseño diga otra cosa.
- ⚠️ **Para revisar**: es un cambio de contenido, no sólo de redacción.

## Para revisar primero

| | Qué | Por qué |
|---|---|---|
| ⚠️ | La fecha de la portada pasa de **"Viernes 30 de octubre a las 11pm hasta las 6am"** a **"VIERNES 30.10 // 11 PM - 6 AM"**. | El texto anterior lo eligió Ignacio a principios de octubre. El del diseño es más corto y va en el lenguaje de barras del resto. |
| ⚠️ | Se quitó **"Una noche para pasarla increíble y definir quién es la mejor tribu"** de la portada. | El diseño no la tiene. También la eligió Ignacio. |
| ⚠️ | Se quitó **"La completa un adulto responsable: vas a necesitar el DNI de cada adolescente y el comprobante de la transferencia."** de la portada. | El diseño no la tiene. Avisaba qué tener a mano antes de empezar. |
| ⚠️ | **"TRIBU · ELEGÍ SU PULSERA"** | Dice que cada tribu tiene una pulsera. Confirmar que es así. |
| ⚠️ | **"@INFLUOS.OGN // @ORIGENIGLESIA"**, en la esquina de abajo a la derecha (sólo en pantallas de 1200 px o más) | Son cuentas que hoy no aparecen en ningún lado de la app. Confirmar que son esas. |
| ⚠️ | **"Un solo QR para todos. En la puerta también sirve el nombre del adulto."** | Reemplaza a "Guardala o sacale captura: es lo que se escanea en la puerta. Si el QR no se lee, el código alcanza." Dice que en la puerta alcanza con el nombre: el email de la entrada ya lo dice ("decí este código o el nombre del adulto responsable"). |
| 🔒 | La regla de edad (**"adolescentes nacidos hasta el 30 de junio de 2014, con 18 años como máximo"**) en la cabecera y en las esquinas | El diseño dice "ADOLESCENTES DE 13 A 18 AÑOS :)". Va el texto del código (`QUIENES_ENTRAN`). Ocupa cuatro renglones donde el diseño tenía dos. |
| 🔒 | El teléfono de contacto | Queda `TELEFONO_CONTACTO = '11 5566 7788'`, como en el código. El diseño muestra otro número. **Hay que poner el real antes de publicar.** |

## Lo que comparten todas las pantallas

| Dónde | Antes | Después | |
|---|---|---|---|
| Cabecera | *(no había)* | `NOCTURNA` y, al lado, la regla de edad | 🔒 la regla |
| Barra de pasos | botón ‹ (sin texto) | `[ VOLVER ]` | |
| Barra de pasos | `3 de 7` (contador) | *(sin contador: lo dicen los segmentos)* | |
| Barra de pasos | `1 · Datos` · `2 · Información` · `3 · Pago` | `DATOS` · `INFORMACIÓN` · `PAGO` | |
| Esquinas (≥ 1200 px) | *(no había)* | `NOCTURNA` · regla de edad · `VIERNES 30.10 // 11 PM - 6 AM` `[ AV. EVA PERÓN 3932 ]` · `@INFLUOS.OGN` `@ORIGENIGLESIA` | 🔒 regla · ⚠️ cuentas |
| Botón del pie, paso 1 | `Continuar` | `[ SIGUIENTE ]` | |
| Botón del pie, pasos 2 a 6 | `Siguiente` | `[ SIGUIENTE ]` | |
| Botón del pie, paso 7 | `Listo` | `[ LISTO ]` | |
| Botón del pie, ocupado | `Guardando…` · `Revisando…` | `GUARDANDO…` · `REVISANDO…` | |
| Pie, a la izquierda, paso 1 | *(nada)* | `ADULTO RESPONSABLE` / nombre del adulto, o `FALTAN DATOS` | |
| Pie, paso 2 | `$80.000` / `2 adolescentes × $40.000` | igual, en mayúsculas. Sumando: `2 NUEVOS × $40.000` | 🔒 precios |
| Pie, paso 2 sin nadie | `Agregá al menos un adolescente` | igual. Sumando: `Sumá al menos uno nuevo` | |
| Pie, paso 3 | *(nada)* | `RETIRO 6 AM` / cómo se retiran, o `FALTA RESPONDER` | |
| Pie, paso 4 | *(nada)* | `AUTORIZACIÓN` / `AUTORIZADO` o `FALTA RESPONDER` | |
| Pie, paso 5 | *(nada)* | `FOTOS Y VIDEOS` / `ACEPTADO`, `NO ACEPTADO // PODÉS SEGUIR` o `FALTA RESPONDER` | |
| Pie, paso 6 | *(nada)* | `COMIDA` / `1 CON RESTRICCIÓN`, `NINGUNA RESTRICCIÓN` o `FALTA RESPONDER` | |
| Pie, paso 7 | `$80.000` / `2 adolescentes × $40.000` | `$80.000` / `COMPROBANTE LISTO` o `FALTA EL COMPROBANTE` | 🔒 precios |
| Qué falta, paso 1 | `Completá todos tus datos para seguir.` | `Falta: nombre, DNI.` (los que falten) o `Revisá tus datos.` | |
| Qué falta, paso 2 | `Agregá al menos un adolescente.` | `Agregá al menos un adolescente para seguir.` Sumando: `Sumá al menos un adolescente nuevo para seguir.` | |
| Qué falta, paso 2 | `A Martina le faltan datos.` | `A Martina le falta: DNI, tribu.` | |
| Qué falta, paso 2 | *(con alguien fuera de edad decía "Hay 0 adolescentes con datos incompletos.")* | `Lucas no entra en la edad de Nocturna.` | |
| Qué falta, paso 3 | `Elegí cómo se retiran.` | `Elegí Sí o No.` · `Elegí quién lo retira.` · `Faltan datos de quien lo retira: teléfono.` | |
| Qué falta, paso 4 | `Elegí una opción.` | `Elegí Autorizo o No autorizo.` | |
| Qué falta, paso 5 | `Elegí una opción. Cualquiera te deja seguir.` | `Elegí una de las dos respuestas. Cualquiera te deja seguir.` | |
| Qué falta, paso 7 | `Subí el comprobante para terminar.` | `Falta subir el comprobante.` · subiendo: `Esperá a que termine de subir el comprobante.` | |
| Deshacer | `Quitaste a Martina` · `Deshacer` | igual, en mayúsculas | |

## Pantalla 0 — Bienvenida

| Antes | Después | |
|---|---|---|
| Foto de chicos y logo de Origen | El árbol de Origen (texto alternativo "Origen") | |
| `¡Bienvenidos a Nocturna!` | igual | |
| `Viernes 30 de octubre a las 11pm hasta las 6am` | `VIERNES 30.10 // 11 PM - 6 AM` | ⚠️ |
| *(no estaba)* | `[ AV. EVA PERÓN 3932 ]` | |
| `Una noche para pasarla increíble y definir quién es la mejor tribu` | *(se quitó)* | ⚠️ |
| `Es para adolescentes nacidos hasta el 30 de junio de 2014, con 18 años como máximo.` | va arriba, al lado de `NOCTURNA` | 🔒 |
| `La completa un adulto responsable: vas a necesitar el DNI de cada adolescente y el comprobante de la transferencia.` | *(se quitó)* | ⚠️ |
| **Sin sesión:** `Continuar iniciando sesión` | igual | |
| `Entrar a la inscripción sin sesión` | `ENTRAR SIN SESIÓN` | |
| `Si ya tenés cuenta, iniciá sesión y tus datos se completan solos. ¿No tenés? Registrate en la app` | `Si ya tenés cuenta, conviene iniciar sesión: tus datos se completan solos.` + `[ REGISTRARME EN LA APP ]` | |
| **Con sesión:** `Continuar con la inscripción` | `CONTINUAR COMO MARIELA` (el nombre de la cuenta) | |
| `Entrás como Mariela Ramos y tus datos se completan solos.` | `ENTRASTE COMO`, con las iniciales, el nombre y el email | |
| `Usar otra cuenta` | `[ USAR OTRA CUENTA ]` (abre el mismo diálogo de antes) | |
| `Volver al Inicio` | `[ VOLVER AL INICIO ]` | |

## Pantalla 2 — Los adolescentes

| Antes | Después | |
|---|---|---|
| `¿A quién vas a anotar?` · `¿A quién sumás?` | igual | |
| `Podés anotar a varios en esta misma inscripción. Nocturna es para adolescentes nacidos hasta…` | `Podés anotar a varios adolescentes en esta misma inscripción.` (la regla está en la cabecera) | 🔒 la regla no cambia |
| Sumando: `Se agregan a la inscripción que ya tenés, sin tocar lo que está cargado.` | `Los que ya estaban quedan como están. Sumá abajo a quien falte.` | |
| `Ya está anotado` · `Ya están anotados` | `[ YA EN TU ENTRADA ]` | |
| Fila de un anotado: `Trueno · DNI ••••778` | `TRUENO // DNI ••••778` + `YA ANOTADO` | |
| `Desde acá no se editan. Si hay algo para corregir, escribinos al 11 5566 7788 y lo cambiamos nosotros.` | igual | 🔒 teléfono |
| *(no estaba)* | `[ SUMANDO AHORA ]` | |
| Tarjeta cerrada: `15 años · Trueno` | `15 AÑOS // TRUENO` | 🔒 edad de hoy, como la calcula el código |
| `Falta: DNI, tribu` | igual, en mayúsculas | |
| *(con alguien fuera de edad, la tarjeta cerrada no lo decía)* | `NO ENTRA EN LA EDAD DE NOCTURNA` | |
| `Completar` · `Editar` | `[ COMPLETAR ]` · `[ EDITAR ]` · fuera de edad: `[ REVISAR ]` | |
| `ADOLESCENTE 1 DE 2` | igual. Sumando: `NUEVO 1 DE 2` | |
| `Quitar` | igual | |
| `Fecha de nacimiento` | `FECHA DE NACIMIENTO` | |
| Aviso de edad: `Nocturna es para adolescentes nacidos hasta el 30 de junio de 2014. Lucas nació el 01/07/2014.` | igual, con el título `[ FUERA DE EDAD ]` | 🔒 |
| `Tribu` | `TRIBU · ELEGÍ SU PULSERA` | ⚠️ |
| `Listo, guardar a Martina` · `No entra en la edad de Nocturna` | igual, en mayúsculas | |
| `Todavía no anotaste a nadie` / `Agregá al primer adolescente para seguir.` | igual. Sumando: `Sumá al primer adolescente nuevo para seguir.` | |
| `Agregar un adolescente` · `Agregar otro adolescente` | `[ + AGREGAR UN ADOLESCENTE ]` · `[ + AGREGAR OTRO ADOLESCENTE ]` | |
| Sumando: `Agregar otro adolescente` | `[ + SUMAR UN ADOLESCENTE ]` · `[ + SUMAR OTRO ADOLESCENTE ]` | |

## Pantalla 8 — La entrada

| Antes | Después | |
|---|---|---|
| Tilde verde | `:)` | |
| `Quedaron anotados` · `Quedaron sumados` | `¡QUEDARON ANOTADOS!` · `¡YA ESTÁN TODOS!` | |
| `La entrada también te llega por email a laura@…. Puede demorar un rato, por eso te la dejamos acá.` | `Esta es la entrada de toda la familia. También te llega por email a laura@…: puede demorar, por eso te la dejamos acá.` | |
| Sumando: `Están en la misma inscripción que ya tenías. El QR y el código no cambiaron…` | igual | |
| `Entrada · GLD234` | `CÓDIGO DE ENTRADA` / `GLD234` | |
| `Guardala o sacale captura: es lo que se escanea en la puerta. Si el QR no se lee, el código alcanza.` | `Un solo QR para todos. En la puerta también sirve el nombre del adulto.` | ⚠️ |
| *(el QR no tenía texto alternativo)* | `Código QR de la entrada GLD234` (sólo para el lector de pantalla) | |
| *(no estaba)* | `[ NOCTURNA // VIE 30.10 // 11 PM - 6 AM ]` | |
| `Retiro` | `Retiro 6 AM` | |
| `Adolescentes` · `A nombre de` · `Comida` · `Pagado` | igual | 🔒 el monto |
| `Guardar la entrada` | igual | |
| `Volver al inicio` | `[ VOLVER AL INICIO ]` | |

## Lo que no se tocó

- Los pasos 1 y 3 a 7, la salida sin autorización y los dos diálogos (inscripción existente y cambiar de cuenta) conservan sus textos. Son de los prompts siguientes.
- No cambió ningún texto legal (`TEXTO_AUTORIZACION`, `TEXTO_FOTOS`, `VERSION_DECLARACIONES`) ni ningún mensaje que venga del servidor.

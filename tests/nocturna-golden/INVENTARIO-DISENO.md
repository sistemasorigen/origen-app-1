# Inventario de los diseños — rediseño de Nocturna

Relevado el 2026-10-06 (prompt 0/6), contra el código de la rama
`nocturna-rediseno` recién creada desde `main` (`ed2b5ba`).

## Los archivos

| Archivo | Qué es |
|---|---|
| `design-claude/Nocturna - Inscripcion.dc.html` | El diseño de la inscripción: un lienzo `.dc` con todas las pantallas y estados, con datos de ejemplo. **No es un archivo nuevo**: es el que ya existía, modificado (1561 líneas). |
| `design-claude/Email - Entrada Nocturna v2.html` | **El HTML final del email**, listo para enviar. Usa las variables `{{nombreAdulto}}`, `{{codigoEntrada}}`, `{{qrUrl}}`, `{{cantidadChicos}}`, `{{palabraEntradas}}` y `{{totalPagado}}`, las mismas 6 que ya completa `supabase/functions/send-nocturna-entrada/`. |
| `design-claude/Email - Nocturna Entrada v2.dc.html` | **El lienzo de vistas del email**: no se envía. Carga el anterior con `fetch('Email - Entrada Nocturna v2.html')` y lo muestra en 6 vistas (celular, imágenes bloqueadas, modo oscuro, escritorio), con datos de ejemplo. |

Lo que vale para implementar es `Email - Entrada Nocturna v2.html`.

## Correspondencia pantalla del diseño ↔ estado del código

Código: `pages/eventos/nocturna/InscripcionNocturna.tsx`.

| Pantalla del diseño (`sc-if`) | Estado en el código |
|---|---|
| `p0` (con variantes `isMobile` / `isDesktop`) | `pantalla === 0` |
| `sinSesion` | `pantalla === 0 && !user` ("Continuar iniciando sesión" / "Entrar a la inscripción sin sesión") |
| `conSesion` ("Entraste como…") | `pantalla === 0 && user` ("Entrás como…", "Continuar con la inscripción", "Usar otra cuenta") |
| `p1` | `pantalla === 1` |
| `f.hasTag` ("De tu cuenta" / "editado // solo acá" / "tu cuenta no lo tiene") | `campoAdulto` con `deLaCuenta` ("De tu cuenta" / "Cambiado solo acá" / "No está en tu cuenta") |
| `p1m` / `hayEdadAdulto` (menor de 18) | `pantalla === 1 && adultoEsMenor` |
| `p2`, `c.cerrado`, `c.editando`, `c.bloqueado`, `c.hayHeader` | `pantalla === 2`: tarjeta cerrada, abierta (`abierto === c.id`), y chicos ya anotados con candado (`agregando`, `yaAnotados`) |
| `sinChicos` | `pantalla === 2 && chicos.length === 0` |
| `hayDeshacer` | `quitado !== null` ("Deshacer") |
| `p3`, `retEsSi`, `retEsNo`, `quienYo`, `quienOtra` | `pantalla === 3`, `retiro` y `retiroQuien` |
| `p4`, `sinAutorizar`, `autorizado` | `pantalla === 4`, `autoriza` |
| `p4x` | `pantalla === 'noAut'` |
| `p5`, `fotosEsNo` | `pantalla === 5`, `fotos` |
| `p6` | `pantalla === 6` (comida: `restriccion` y casillas por chico) |
| `p7`, `compVacio`, `compSubiendo`, `compSubido` | `pantalla === 7`, `comprobante`, `subiendo` |
| `compError` ("eso no es una imagen") | `errorComprobante` |
| `compErrRed` ("se cortó la conexión / la subida se frenó en el N%") | `errorComprobante` (ver diferencias: no hay porcentaje) |
| `p8` | `pantalla === 8` (`resultado`) |
| `pCargando` | `cargando` |
| `pCerrado` | `config.inscripcionesAbiertas === false` |
| `pOffline` | `errorConfig` ("Probar de nuevo") |
| `hayPie`, `hayFalta` | el pie con `puedeSeguir`, `intento` y `pendienteTexto` (el botón que explica qué falta) |
| `hayErrServidor`, `hayOffline` | `errorEnvio` (`conexion: false` / `true`) |
| `dlgA` | `aviso && aviso.verificado` ("Sumar a alguien más" / "Revisar mis datos") |
| `dlgB` | `aviso && !aviso.verificado` ("Revisar mis datos") |
| `dlgLogout` | `modalSalir` ("Seguir con esta cuenta" / "Cerrar sesión") |
| `sumandoChip` | `agregando` (modo "sumar chicos") |
| guardando | `enviando` ("Guardando…") y `buscandoGrupo` ("Revisando…") |

## Estados sin diseño, y diseños sin estado

**Estados del código que no tienen diseño propio:**

- **El aviso de edad de cada chico.** Hoy dice, por ejemplo, "Nocturna es para adolescentes nacidos hasta el 30 de junio de 2014. Lucas nació el 01/07/2014.", con el botón "No entra en la edad de Nocturna". El diseño no tiene la tarjeta de un chico fuera de edad.
- **La vista previa del comprobante a pantalla completa** (`vistaPrevia`).
- **La descarga de la entrada como imagen** (`a.download = nocturna-<código>.png` en el paso 8).
- **"Revisando…"**: el botón mientras consulta si el DNI ya tiene inscripción (`buscandoGrupo`).
- **El aviso "Copiado"** de los botones de copiar alias y CVU (`copiado`). El diseño muestra "¡Link copiado!", que es otro botón.

**Diseños sin estado en el código. No se implementan, porque serían funcionalidad nueva:**

- **`hayConfeti`**: confeti al llegar a la entrada. Es decorativo, pero hoy no existe. Lo decide Ignacio.
- **`[ COMPLETANDO TU ENTRADA // NOC-R2M9 ]`**: muestra un código de entrada durante el recorrido. Ese código lo genera la base recién al guardar; antes del paso 8 no existe.
- **El porcentaje de subida** ("la subida se frenó en el N%"): la subida de supabase-js no informa progreso.
- **La "palabra de fondo"** que se enfoca con cada paso, y **la cuenta regresiva de 3 a 1** en el pago: son efectos visuales sin dato detrás. Se pueden hacer, pero no tienen equivalente.

## Diferencias de textos y de datos

Los textos legales del código mandan siempre. Están en `compartido/formulario.ts`: `TEXTO_AUTORIZACION`, `TEXTO_FOTOS` y `VERSION_DECLARACIONES = nocturna-2026-v1`. **La versión de las declaraciones viaja en el payload**: si cambia un texto legal, cambia lo que se manda y el golden lo detecta.

**Datos del diseño que no coinciden con el código:**

| Dato | Diseño | Código (manda) |
|---|---|---|
| Edad | "ADOLESCENTES DE 13 A 18 AÑOS :)" | Nacidos hasta el 30/06/2014, con 18 años como máximo (`QUIENES_ENTRAN`). Definido el 2026-10-05. |
| Fecha | "VIERNES 30.10 // 11 PM - 6 AM" | Portada: "Viernes 30 de octubre a las 11pm hasta las 6am". Email: "Viernes 30 de Octubre a las 11 PM hasta Sábado 31 de Octubre hasta las 6 AM". |
| Edad del adulto | "N AÑOS EL DÍA DE NOCTURNA": se mide contra el 30/10 | Se mide contra **hoy**, en el formulario (`calcularEdad`) y en la base (`age(current_date, …)`). Mostrarla al día del evento puede decir "18" a quien hoy tiene 17 y la base rechaza: hay que mantener la de hoy. |
| Bloqueo de menor de 18 | "[ COPIAR EL LINK ]" / "¡Link copiado!" | Existe: "Copiar el link para un adulto" / "Link copiado". Cambia sólo el texto. |
| Teléfono de contacto | "11 4021 7788" | `TELEFONO_CONTACTO = '11 5566 7788'` ⚠ **parece inventado. Confirmar el número real antes de publicar.** |
| Cómo se llama a los chicos | "chicos" | "adolescentes" (botones, títulos, avisos) |
| Tribu | "Tribu · elegí su pulsera" | "Tribu" (la pulsera no se menciona) |
| Email: "En la puerta" | "El ingreso abre a las 11 PM…", "Tené el QR a mano: se te va a pedir para ingresar.", "…tiene que mostrar su DNI." | El texto oficial: "1. El ingreso abre 11pm. Llegá con tiempo." / "2. Tené el QR a mano, se te pedirá para poder ingresar." / "3. A las 6 am, el adulto que retira a cada chico debe mostrar su DNI." |
| Email: pie | "@INFLUOS.OGN // @ORIGENIGLESIA" | No hay redes en el email actual. Confirmar los usuarios. |

**Diferencias de microcopy.** En el diseño hay unos 130 textos que no aparecen tal cual en el código. Algunos ejemplos:

| Diseño | Código |
|---|---|
| "Entrar sin sesión" | "Entrar a la inscripción sin sesión" |
| "Continuar como Mariela" | "Continuar con la inscripción" |
| "[ Quedarme acá ]" / "Cerrar sesión y volver" | "Seguir con esta cuenta" / "Cerrar sesión" |
| "[ Cambiar mi respuesta ]" | "Volver y cambiar mi respuesta" |
| "[ Reintentar ]" | "Probar de nuevo" |
| "¿Se retiran solos?" | "¿Se retiran solos a las 6 h?" |
| "Los retirará otra persona" | "Lo retirará otra persona" |

Si el rediseño adopta estos textos, hay que actualizar los selectores en `soporte/formulario.ts`. Es el único lugar donde están, y el golden no cambia, porque compara pedidos y no textos. La lista completa salió de comparar los textos del lienzo contra el código.

**Hallazgo funcional, no de diseño.** El diseño, la base y el escenario 2 del golden suponen que en una familia puede haber un chico celíaco y otro con diabetes. **El formulario actual no lo permite**: elegir una restricción resetea a todos los chicos a "ninguna" (`elegirRestriccion`). Cambiarlo sería funcionalidad nueva y está fuera del alcance de esta serie.

## Fuentes e imágenes

**Fuentes:**

- Inscripción: **Archivo** (500 a 900) y **Bagel Fat One**, desde Google Fonts. Hoy el formulario usa Proxima Nova, local en `/fonts`.
  - ⚠ **El CSP de `index.html` bloquea** pedidos a `fonts.googleapis.com` en `connect-src`. La hoja de estilos se carga con `<link>` (`style-src`), pero conviene **servir las fuentes desde `/fonts`**, como Proxima Nova, y no depender de Google: en el navegador de Instagram o con mala señal, la fuente puede no llegar.
- Email: **Helvetica Neue / Helvetica / Arial**, que vienen con el sistema. No hace falta cargar nada.

**Imágenes:**

- `design-claude/assets/origen-arbol.png` (logo del árbol, en la inscripción). Hay que copiarla a `public/`.
- `design-claude/assets/email/nocturna-cabecera.jpg`: la cabecera del email. El HTML la pide en **`https://app.origeniglesia.org/email/nocturna-cabecera.jpg`**, que **hoy no existe** (`public/email/` no está). El lienzo dice que es "un recorte provisorio del flyer".
- `design-claude/uploads/nocturna_APP 1920x1080.jpg`: el flyer. Es la fuente de la cabecera; no lo usa ninguna pantalla directamente.
- El código usa hoy `/auth-bg.jpg` (la foto de la portada) y `/origen-logo.png`. El diseño no usa la foto.

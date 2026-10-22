# Inventario de "Mi cuenta"

De los 5 diseños de `design-claude/`, leídos completos el 2026-10-22. Es el
mapa para los prompts 2 a 5: qué pantalla hay, qué estados tiene, y de qué
dato real sale cada cosa.

Convención de la columna **Dato**:

- **Ya existe** — sale de una tabla o RPC que ya está en producción.
- **Nuevo (prompt 1)** — lo crea el SQL de este prompt.
- **Sólo UI** — no toca la base (navegación, ayuda, textos legales).

---

## 0 · Qué es `MiCuentaLista`

**No es un kit de piezas sueltas: es la pantalla índice de Mi cuenta entera,
empaquetada como componente.** Las 4 pantallas la importan con
`<dc-import name="MiCuentaLista" …>` y le pasan `file`, `sel`, `t` (tema),
`desk`, `dark`, `falta`, `notifs`, `push`, `featKey`, `counts`, `foto`,
`nombre` y los callbacks `onRow` / `onDismiss` / `onPush` / `onDark`.

Sirve para dos cosas a la vez, y por eso vive aparte:

- **En el teléfono** es la primera pantalla: el índice completo de Mi cuenta.
- **En la compu** es el riel izquierdo fijo de 440px, con la fila activa
  marcada (`sel`), mientras la derecha muestra el detalle.

Contiene: el botón de volver + "Mi cuenta", el esqueleto de carga, la tarjeta
de la persona (foto/iniciales, nombre, email, aviso de dato faltante), la
**tarjeta destacada**, los 5 grupos de filas, "Cerrar sesión" y la versión.

> En la implementación esto es **un componente React compartido**, no cuatro
> copias. Lo que el diseño llama "archivos" son rutas: `/perfil`,
> `/perfil/...`. El `OWN`/`FILES` del diseño (que salta de archivo en archivo)
> es sólo el truco para navegar entre prototipos.

### La tarjeta destacada (`featKey`)

Una sola, la primera que aplique de esta lista, y se puede ocultar (`onDismiss`):

| # | Clave | Cuándo | Lleva a | Dato |
|---|-------|--------|---------|------|
| 1 | `entrada` | Hay una inscripción a un evento que no pasó | Detalle de la inscripción | **Nuevo**: `mis_inscripciones_eventos()` |
| 2 | `pedido` | Hay una venta en estado "Listo" | Detalle del pedido | **Nuevo**: `ventas_voluntarios.lista_at` |
| 3 | `perfil` | Falta teléfono y/o fecha de nacimiento | Editar perfil | Ya existe: `users` |
| 4 | `grupo` | No está en ningún grupo | /gcx · Buscar grupos | Ya existe: `group_registrations` |
| 5 | `verso` | Ninguna de las anteriores | — | Ya existe: versículo del día |

### Las 5 secciones de filas

| Sección | Filas | Dato |
|---|---|---|
| MI VIDA EN ORIGEN | Mis grupos (N) · Mi calendario (externo) · Historial de grupos · Mis compras (N) · Mis inscripciones (N) · Dónde sirvo (N) | Grupos/historial/sirvo: **ya existe**. Compras e inscripciones: **nuevo** |
| PREFERENCIAS | Notificaciones (badge sin leer) · Avisos en este celular (interruptor) · Modo oscuro (interruptor) | Ya existe |
| CUENTA Y SEGURIDAD | Cuenta y seguridad | Ya existe (`auth`) |
| PRIVACIDAD | Privacidad y mis datos | **Nuevo**: `solicitudes_datos` |
| AYUDA Y OTROS | Tutoriales · Escribile a la iglesia · Reportar un problema · Términos y privacidad · Sobre la app (vX) | Reportar: **nuevo**. El resto: sólo UI |

**Estado del interruptor de avisos** (`push`): `off` · `on` · `blocked`
(los bloqueó en el navegador) · `ios` (iPhone sin instalar en el inicio) ·
`unsupported`. Los tres últimos lo dejan apagado y deshabilitado, y agregan
una fila de ayuda debajo.

---

## 1 · Mi Cuenta - Inicio → **Editar perfil**

| Pieza | Dato |
|---|---|
| Foto (112px) con subida, recorte circular y zoom | Ya existe (bucket de avatares) |
| Nombre y apellido (pide 2 palabras) | Ya existe: `users` |
| Teléfono (10 dígitos, sin 0 ni 15) | Ya existe: `users` |
| Fecha de nacimiento + edad calculada | Ya existe: `users` |
| Sexo — **bloqueado**, "para cambiarlo, escribinos" | Ya existe |
| Email — **bloqueado**, "es el de tu cuenta" | Ya existe: `auth.users` |

**Estados:** cargando · perfil completo · falta 1 dato · faltan 2 · errores en
línea · guardando / guardado · "¿salir sin guardar?" · hoja de foto (galería /
cámara / ejemplo / quitar) · recortador · subiendo / falla al subir ·
"¿cerrar sesión?" · toast.

**Detalle de diseño:** cada campo sin guardar muestra un punto; los que faltan,
una pastilla ámbar "Falta". Guardar queda deshabilitado si no hay cambios.

---

## 2 · Mi Cuenta - Mi vida en Origen

Seis sub-pantallas. `PARENT` define que *Pedido* cuelga de *Mis compras* y
*Inscripción* de *Mis inscripciones*.

| Sub-pantalla | Qué muestra | Dato |
|---|---|---|
| **Mis grupos** | Tarjeta por grupo: nombre, rol, día y hora, pastilla de estado (Aprobado / Esperando aprobación) | Ya existe |
| **Historial de grupos** | Agrupado por temporada (S3/S2/S1 2026), con rol, rango de meses y cómo terminó ("En curso", "Terminó la temporada", "Cambiaste de grupo", "Te diste de baja") | Ya existe |
| **Mis compras** | Tarjeta por venta: código `VOL-XXXX`, fecha, N.º de productos, total, pastilla de estado | **Nuevo**: estado derivado de `lista_at` / `retirada_at` |
| **Detalle del pedido** | Ticket troquelado con el código, las líneas, el total, medio de pago y "Comprobante enviado ✓"; **línea de tiempo Pagado → Listo → Retirado**; botón "Mostrar en el Punto" (pantalla grande para que la lea el voluntario) | **Nuevo** |
| **Mis inscripciones** | Tarjeta con bloque de fecha (VIE 30 OCT), evento, hora, N.º de adolescentes, pastilla Próximo / Hoy (con punto verde latiendo) / Ya pasó | **Nuevo**: `mis_inscripciones_eventos()` |
| **Detalle de la inscripción** | Código de entrada troquelado, aviso ámbar "Te falta un dato" con botón Completar, adulto responsable, lista de adolescentes con cómo se retira cada uno y su estado de la noche (Adentro desde 22:14 / Todavía no entró / Se retiró 06:02 / No vino), botón **Mostrar QR** a pantalla completa | **Nuevo**: `mi_inscripcion_detalle()` |
| **Dónde sirvo** | Tarjeta por rol con detalle y botón "Ir al panel" | Ya existe |

**Estados:** con datos · vacío (texto propio por sub-pantalla) · cargando ·
pedido Pagado/Listo/Retirado · inscripción Próxima/Hoy/Pasada · falta un dato ·
QR abierto · "Mostrar en el Punto" abierto.

**Nota de privacidad del detalle:** el diseño muestra del tercero que retira
**sólo nombre de pila e inicial** ("Otra persona: Juan P."). Ni DNI, ni
teléfono, ni email de terceros. El SQL lo respeta.

---

## 3 · Mi Cuenta - Preferencias y seguridad

| Pieza | Dato |
|---|---|
| **Notificaciones** — pantalla de transición que abre el centro que ya existe | Ya existe |
| **Email** — bloqueado | Ya existe: `auth.users` |
| **Cómo entrás** — "Con Google" o "Con email y contraseña" | Ya existe: `auth.identities` |
| **Contraseña** — sólo si entra con email: medidor de fuerza (4 barras), 3 requisitos (8 caracteres, una mayúscula, un número), repetir | Ya existe: `auth` |
| **Sesiones** — "Cerrar sesión en todos mis dispositivos" | Ya existe: `auth` |
| **Eliminar mi cuenta** — lleva a Privacidad | **Nuevo**: `solicitudes_datos` |

**Estados del permiso de avisos:** apagado · pidiendo permiso (con el diálogo
del navegador dibujado) · prendido · bloqueado · iPhone sin instalar · no
soportado. Los dos últimos abren hojas de ayuda con pasos, una por sistema.

---

## 4 · Mi Cuenta - Privacidad y ayuda

| Sub-pantalla | Qué muestra | Dato |
|---|---|---|
| **Privacidad y mis datos** | Responsable (razón social, CUIT, email) · **6 categorías desplegables** (Cuenta, Perfil, Grupos, Eventos, Compras, Servicio) con "qué guardamos / para qué / quién lo ve" · los 3 derechos (acceso, rectificación, supresión) · **Mis solicitudes** · el párrafo obligatorio de la AAIP | **Nuevo**: `solicitudes_datos` |
| **Eliminar mi cuenta** | 3 pasos + confirmación: (1) qué pasa y qué se conserva igual, (2) motivo opcional de una lista de 5 con "Otro" libre, (3) escribir ELIMINAR, (4) "Recibimos tu pedido N.º 0042" | **Nuevo**: solicitud de tipo `supresion` |
| **Términos y privacidad** | 7 secciones con índice que salta y botón flotante "Arriba" | Sólo UI |
| **Tutoriales** | 5 videos con duración y pastilla "Visto" | Sólo UI (por ahora) |
| **Escribile a la iglesia** | WhatsApp, email, horario y dirección | Sólo UI |
| **Reportar un problema** | Qué pasó (texto) · en qué pantalla (6 opciones) · captura opcional · caja "esto se envía automáticamente" (versión, dispositivo) | **Nuevo**: `reportes_problemas` + bucket |
| **Sobre la app** | Logo, versión, buscar actualización (última / hay una nueva / error) | Ya existe: `app_version` |

**Estados de una solicitud:** Recibida · En curso · Resuelta.
**Tipos que muestra la lista:** "Acceso a mis datos", "Corrección",
"Eliminar mi cuenta" → en la base: `acceso`, `rectificacion`, `supresion`.

---

## 5 · Lo que el diseño asume y conviene confirmar

1. **Mínimo de la descripción del reporte.** El diseño exige **10 caracteres**
   antes de dejar enviar; el prompt pide que la base acepte 1–2000. Se
   implementa 1–2000 en la base (como pide el prompt) y los 10 quedan como
   regla de pantalla, que es donde se le puede explicar a la persona.
2. **El N.º de solicitud es compartido.** El diseño numera con una sola serie
   (0039, 0041, 0042…) para los tres tipos, incluida la eliminación. Se hace
   con una secuencia única.
3. **"Eliminar mi cuenta" no borra nada sola.** Es una solicitud que alguien
   resuelve a mano, y el diseño lo dice: "tu cuenta sigue activa" hasta que
   respondan. El SQL no borra usuarios.
4. **El QR lleva el `id` de la inscripción, no el código.** El código de 6
   caracteres se muestra para leerlo en voz alta; el escáner ya lee el `id`.
5. **Versión y dispositivo del reporte** los arma el frontend (prompt 5): la
   base sólo los guarda como texto.

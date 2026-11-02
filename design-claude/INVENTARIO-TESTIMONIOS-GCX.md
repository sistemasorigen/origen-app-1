# Inventario · Testimonios de los GCX

Lo que hay en los dos `.dc`, pantalla por pantalla y estado por estado, qué
hace cada cosa y de qué dato de la base sale. Escrito para que los prompts 2,
3 y 4 no tengan que volver a abrir el diseño ni adivinar de dónde sale algo.

| Archivo | Rutas | Prompt |
|---|---|---|
| `GCX Testimonios - Dejar testimonio.dc.html` | `/testimonios-gcx` | 2 |
| `GCX Testimonios - Testimonios.dc.html` | `/testimonios` y `/testimonios/:groupId` | 3 |

La base es `sql/testimonios_gcx.sql` y el servicio `services/testimonios.ts`
(una función por RPC). Los nombres de RPC de abajo son los de la base; entre
paréntesis, el del servicio.

**La barra de arriba de cada diseño** (VISTA · SESIÓN · PLAZO · GALERÍA ·
DETALLE · AVISOS en uno; VISTA · ESTADO · SIMULAR en el otro) es el andamio
para mirar los estados: **no se implementa**. La vista pasa a ser el tamaño
real de la pantalla y el estado, el de la carga.

**Todos los datos del diseño son inventados**: 8 GCX, 22 testimonios, nombres
de personas, "Daniela Ferreyra" como la persona con sesión, el plazo 29/12. Se
verificó contra la base el 2026-11-02: ningún nombre de persona ni de grupo
del diseño existe en producción. Nada se copia.

**Columna "Origen"**: `pedido` = lo que pidió Ignacio (las reglas del prompt 1,
sección B); `diseño` = lo sumó Claude Design; `PROPUESTA` = lo sumó y además
lleva la etiqueta "Propuesta" en el lienzo. Sólo dos piezas llevan esa
etiqueta, y las dos están en el diseño de dejar testimonio.

---

## 0 · Cómo se ve todo (los dos diseños)

Estilo del login (sección 8 de instrucciones): Manrope 500/600/700/800, fondo
`#f6f6f4`, tarjetas blancas (radio 22–28), tinta `#0a0a0a`, gris `#f2f2f0`,
botones pastilla negros (alto 56–64 en las acciones principales, 44–46 en los
secundarios), rótulos de 11px con `letter-spacing .1em` en gris `rgba(0,0,0,.38)`.
Avatar sin foto: círculo con iniciales sobre un pastel (`#e3ece5 #efe6dc
#e2e6ee #ece4ea #e9e7dc`). Rojo de error `#b42318` (fondo `#fdecea`); ámbar del
contador `#8a5200` / `#c08a2e`; corazón dado `#d9402f` sobre `#fdebe7`.
Animaciones: entrada `tIn` (subir 12px y aparecer), hoja que sube `tUp` en el
teléfono y zoom `tZoom` en la compu, pulso de los esqueletos, sacudida `tShake`
del campo que falta, `tPop` del corazón y `tRoll` del contador; todo se apaga
con `prefers-reduced-motion`. Teléfono < 600px, compu ≥ 1024px.

---

## A · `/testimonios-gcx` — Dejar testimonio

### A1 · Sin sesión (estado "Sin sesión · login")

| Qué se ve | Qué hace | Dato | Origen |
|---|---|---|---|
| Título "Iniciá sesión para dejar tu testimonio" | — | — | pedido |
| "Así sabemos de qué GCX fuiste parte en la Tercera temporada · 2026." | — | `testimonios_temporada` (`getTemporadaTestimonios`) → `etiqueta` | diseño |
| Botón blanco con el logo de Google, "Continuar con Google" | Login con Google, vuelve a `/testimonios-gcx` | login de la app (sección 26) | diseño |
| Botón negro "Entrar con email" | Login con email, vuelve acá | login de la app | diseño |
| "¿No tenés cuenta? **Crear cuenta**" (subrayado) | Registro, vuelve acá | login de la app | diseño |
| "Después de entrar, seguís acá para escribir tu testimonio." | — | — | diseño |

### A2 · Cargando (estados "Volviendo del login" y "Cargando")

| Qué se ve | Qué hace | Dato | Origen |
|---|---|---|---|
| Texto arriba: "Volviendo de iniciar sesión…" o "Buscando tus GCX de esta temporada…" | — | según venga del login o no | diseño |
| Esqueleto: título, bajada, rótulo, 1 o 3 opciones (1 si es un solo GCX), caja del texto | Pulso | — | diseño |
| Al terminar, si hay un solo GCX, viene elegido | — | `testimonios_mis_grupos` | diseño |

### A3 · El formulario (estados "Con sesión · varios GCX", "Un solo GCX", "Ya enviado en un GCX", "Falta algo obligatorio", "Cerca del límite")

| Qué se ve | Qué hace | Dato | Origen |
|---|---|---|---|
| Rótulo "TU TESTIMONIO" | — | — | diseño |
| Título "Tercera temporada · 2026" | — | `temporada.etiqueta` | pedido |
| Reloj + "Podés dejar tu testimonio hasta el 29 de diciembre" | — | `temporada.cargaHasta` → `diaYMesLargo()` | pedido (el plazo); el texto, diseño |
| Rótulo "¿EN QUÉ GCX?" (varios) o "TU GCX" (uno) | — | cantidad de `grupos` | diseño |
| Error a la derecha del rótulo: "Elegí un GCX" (rojo, `role=alert`) y la lista se sacude | Al tocar Enviar sin elegir | — | diseño |
| Opción por GCX (radio, mín. 88px): portada 56×56, nombre, anfitrión y co-anfitrión con avatar de iniciales "Nombre · Rol" | Tocar la elige; la elegida lleva borde negro 2px y el círculo negro con tilde | `testimonios_mis_grupos` → `grupos[].nombre/portada/anfitriones[]` (`nombre`, `rol`, `foto`) | pedido (elegir el GCX); el armado, diseño |
| GCX donde ya escribí: fondo `#fbfbfa`, chip "✓ Ya enviado", no se puede elegir (`aria-disabled`) | — | `grupos[].yaPublicado` | diseño |
| Debajo: "Ya dejaste tu testimonio en este GCX." + "**Ver mi testimonio**" | Abre `/testimonios/:groupId?testimonio=:id` | `grupos[].testimonioId` | diseño |
| Un solo GCX: "Es el único GCX en el que estuviste esta temporada, así que ya viene elegido." | Ya viene elegido | `grupos.length === 1` | diseño |
| Rótulo "¿QUÉ VIVISTE EN TU GCX?" (label del textarea) | — | — | pedido |
| Error "Escribí tu testimonio" + borde rojo + sacudida | Al tocar Enviar sin texto | — | diseño |
| Textarea (alto 220 teléfono / 240 compu, redimensionable) con el ejemplo "Por ejemplo: cómo llegaste al grupo, qué te llevaste de los encuentros, algo que cambió en vos o una frase que te quedó grabada." | `maxLength=1000`, recorta a 1000 | — | pedido (1000); el ejemplo, diseño |
| Contador "N / 1000" abajo a la derecha (`aria-live`) | — | `LIMITE_TEXTO` | pedido |
| Desde 900: "Te quedan N caracteres" en ámbar y borde ámbar | — | `AVISO_TEXTO` | diseño |
| En 1000: "Llegaste al límite de 1000 caracteres" en rojo y borde rojo | — | — | diseño |
| Botón negro "Enviar testimonio" (64px); apagado al 30% mientras falte algo, pero se puede tocar (marca lo que falta) | Abre el modal de consentimiento | — | pedido |
| Botón gris "Volver atrás" (64px, debajo en teléfono) | Vuelve a la pantalla anterior | — | diseño |
| Debajo, el porqué del botón apagado: "Elegí tu GCX y escribí tu testimonio para enviarlo." / "Elegí tu GCX para enviarlo." / "Escribí tu testimonio para enviarlo." | — | — | diseño |
| Sólo compu: tarjeta "QUÉ SE PUBLICA" con la etiqueta **PROPUESTA**: Tu nombre (Daniela Ferreyra) · El GCX (el elegido o "El que elijas") · La temporada · El texto ("Tal cual lo escribiste"); abajo "Antes de publicarlo te pedimos que lo confirmes." | — | `miNombre`, el GCX elegido, `temporada.etiqueta` | **PROPUESTA** |

### A4 · El modal de consentimiento (estados "Consentimiento", "Enviando", "Error al enviar")

Hoja desde abajo en el teléfono (se arrastra para cerrar, más de 90px), modal
centrado de 520px en la compu. Escape y tocar afuera lo cierran, salvo
mientras envía.

| Qué se ve | Qué hace | Dato | Origen |
|---|---|---|---|
| "ANTES DE PUBLICAR" + título "¿Publicamos tu testimonio?" | — | — | pedido |
| "Al confirmar, tu testimonio sale publicado en Testimonios de los Grupos de Conexión para que otras personas lo puedan leer. Se publica:" | — | — | pedido |
| Lista: Tu nombre · El GCX · La temporada · El texto ("Tu testimonio completo") | — | `miNombre`, el GCX, `temporada.etiqueta` | pedido |
| "ASÍ SE VA A VER": tarjeta con avatar de iniciales, el nombre, "Tercera temporada · 2026" y el texto cortado a 3 líneas | — | `miNombre` | diseño |
| "Una vez publicado no se puede editar." + etiqueta **PROPUESTA** | — | — | **PROPUESTA** (coincide con la regla "no se edita nunca") |
| Error: "No pudimos enviarlo · Tu texto sigue guardado." + "Reintentar" | Reintenta | respuesta de `testimonios_publicar` ≠ ok | diseño |
| Botón "Confirmar"; enviando: ruedita + "Enviando…" (`aria-busy`) | `testimonios_publicar(groupId, texto, true)` (`publicarTestimonio`) | devuelve `id` | pedido |
| Botón gris "Volver atrás" | Cierra el modal sin perder el texto | — | diseño |

### A5 · Enviado (estados "Enviado · le quedan GCX" y "Enviado · todos los GCX")

| Qué se ve | Qué hace | Dato | Origen |
|---|---|---|---|
| Círculo y tilde que se dibujan | — | — | diseño |
| "¡Gracias por compartir lo que viviste!" | — | — | pedido |
| "Tu testimonio ya está publicado en {GCX}. Puede animar a alguien a sumarse a un grupo." | — | `grupo` de la respuesta | diseño |
| Si quedan GCX: tarjeta "Te queda 1 GCX por contar" / "Te quedan N GCX por contar", sus nombres separados con "·" y "Dejar otro testimonio" | Vuelve al formulario vacío; si queda uno, ya elegido | `grupos` sin `yaPublicado` | diseño |
| Si no queda ninguno: "Ver mis testimonios" | Abre "Mis testimonios" (prompt 4) | — | diseño |
| "Volver al inicio" | Va al inicio | — | diseño |

### A6 · Sin GCX, plazo cerrado y error de carga

| Estado | Qué se ve | Botón | Dato | Origen |
|---|---|---|---|---|
| Sin GCX esta temporada | Ícono de personas, "No encontramos un GCX tuyo en esta temporada", "Para dejar un testimonio tenés que haber sido parte de un GCX de la Tercera temporada · 2026. Mientras tanto, podés leer lo que vivieron otros." | "Ver los testimonios" → `/testimonios` | `grupos.length === 0` | pedido (la regla); el texto, diseño |
| Plazo cerrado | Ícono de calendario tachado, "Los testimonios de la Tercera temporada · 2026 cerraron el 29/12", "Los que se publicaron se siguen viendo. Cuando termine la próxima temporada vas a poder contar lo que viviste." | "Ver los testimonios" | `temporada.cargaAbierta === false`, `diaYMes(cargaHasta)` | pedido |
| Error de carga | Ícono de wifi tachado, "No pudimos cargar los testimonios", "Revisá tu conexión y probá de nuevo." (`role=alert`) | "Reintentar" | motivo `red` | diseño |

### A7 · Avisos sueltos

Toast negro abajo al centro (teléfono) o arriba a la derecha (compu), 2,4 s.
En el diseño sólo se usa para simular navegación; en la app no hace falta.

---

## B · `/testimonios` — La galería

### B1 · Arriba

| Qué se ve | Qué hace | Dato | Origen |
|---|---|---|---|
| Título "Testimonios de los Grupos de Conexión" (32 / 44 / 52px) | — | — | pedido |
| "Tercera temporada · 2026" | — | `testimonios_temporada` / `testimonios_grupos` → `temporada.etiqueta` | pedido |
| Si el plazo está abierto: tarjeta "¿Fuiste parte de un GCX esta temporada?" + reloj "Hasta el 29/12" + botón negro "Dejar mi testimonio" (60px, con lápiz) | → `/testimonios-gcx` | `temporada.cargaAbierta`, `diaYMes(cargaHasta)` | diseño |
| Buscador redondo (56px, máx. 560px en compu): lupa, "Buscá por GCX, anfitrión o persona", X para limpiar (44px) cuando hay texto; borde negro con el foco | Filtra | `testimonios_grupos(p_busqueda)` (`getGruposTestimonios`) | pedido |
| Contador (`aria-live`): "Cargando testimonios…" / "8 GCX de la Tercera temporada · 2026" / "1 GCX coincide" / "N GCX coinciden" | — | `grupos.length` | diseño |

### B2 · La grilla (1 / 2 / 3 columnas)

| Qué se ve | Qué hace | Dato | Origen |
|---|---|---|---|
| Tarjeta: portada 4:3 (`aria-label` "Portada del GCX …") | — | `grupos[].portada` (sin portada: el degradé de la app) | pedido |
| Buscando por persona: chip "💬 Testimonio de Laura Gómez" o "Testimonios de X y Y" (hasta dos nombres) | — | `coincide === 'testimonio'`, `autores[]`, `autoresTotal` | diseño |
| Nombre (2 líneas máx.) | — | `nombre` | pedido |
| Anfitrión y co-anfitrión: avatar de iniciales 32px, nombre, rol | — | `anfitriones[]` (con `foto` se puede mostrar la foto; el diseño sólo dibuja iniciales) | pedido |
| "Todavía sin testimonios" si no tiene | — | `testimonios === 0` | diseño |
| Botón cuadrado de compartir (46px) | Abre "Compartir testimonios" (B5) | — | pedido |
| Botón negro "Ver testimonios →" | → `/testimonios/:groupId` | `id` | pedido |
| Entrada escalonada de 50ms por tarjeta (hasta 8) | — | — | diseño |

Los GCX salen **todos** los aprobados de la temporada vigente, tengan o no
testimonios, ordenados por nombre (hoy son 45). El diseño no tiene paginado.

### B3 · Estados de la galería

| Estado | Qué se ve | Dato | Origen |
|---|---|---|---|
| Cargando | 2 / 4 / 6 tarjetas esqueleto (`aria-busy`) | — | diseño |
| Error | "No pudimos cargar los testimonios" + "Revisá tu conexión y probá de nuevo." + "Reintentar" | `red` | diseño |
| Sin resultados | Lupa con menos, "Sin resultados para “…”", "Probá con el nombre del GCX, de quien lo coordina o de quien dejó el testimonio." + "Limpiar búsqueda" | `grupos.length === 0` con búsqueda | diseño |
| Plazo cerrado | Igual, sin la tarjeta "¿Fuiste parte…?" | `cargaAbierta === false` | pedido |

### B4 · Sesión

La galería se ve igual con y sin sesión.

### B5 · Compartir (hoja / modal de 460px)

| Qué se ve | Qué hace | Dato | Origen |
|---|---|---|---|
| X para cerrar (44px) | — | — | diseño |
| "COMPARTIR TESTIMONIOS" + nombre del GCX + "Testimonios · Tercera temporada · 2026" | — | — | pedido (compartir) |
| Testimonio: "COMPARTIR TESTIMONIO" + "Testimonio de X" + "GCX · Tercera temporada · 2026" | — | — | pedido |
| Código QR del link (200 / 216px) + "Escaneá para leer los testimonios" / "…este testimonio" | — | el link | diseño |
| El link en una pastilla gris + "Copiar link" → "✓ ¡Copiado!" (2 s) y toast "Link copiado" | Copia al portapapeles | ver conflicto 1 | diseño |
| "Compartir por WhatsApp" (negro) | Abre WhatsApp con el link | — | diseño |
| Sólo teléfono: "Más opciones" | `navigator.share` | — | diseño |

Link del diseño: `origeniglesia.org/testimonios/:groupId` y, para un
testimonio, `…?testimonio=:id`.

---

## C · `/testimonios/:groupId` — El detalle

Compu: dos columnas (420px fija + el resto, 48px de separación); la de la
izquierda queda pegada al hacer scroll. Teléfono y tablet: una columna.

### C1 · El grupo

| Qué se ve | Qué hace | Dato | Origen |
|---|---|---|---|
| Botón "← Testimonios" o "← Testimonios · “búsqueda”" | Vuelve a la galería con la misma búsqueda | — | diseño |
| Portada 4:3, nombre (30px) | — | `testimonios_grupo` (`getGrupoTestimonios`) → `grupo.portada/nombre` | pedido |
| Anfitrión y co-anfitrión: avatar 40px, nombre y rol | — | `grupo.anfitriones[]` | pedido |
| Descripción cortada a 100 caracteres con "ver más" / "ver menos" (`aria-expanded`) | Despliega | `grupo.descripcion` (la base la manda completa) | diseño |

### C2 · Los testimonios

| Qué se ve | Qué hace | Dato | Origen |
|---|---|---|---|
| "TESTIMONIOS · N" + "Más nuevos primero" | — | `testimonios.length` (vienen ordenados) | pedido |
| Tarjeta: avatar de iniciales 40px, nombre de quien escribió, "Tercera temporada · 2026" | — | `autor`, `temporada`, `anio` | pedido |
| El texto en una caja gris, respetando los saltos de línea, cortado a 100 caracteres con "ver más" / "ver menos" | Despliega | `texto` | diseño (el corte) |
| Corazón con número (44px): gris sin dar; rojo relleno al dar, con salto y número que rueda (`aria-pressed`, `aria-label` "Dar corazón al testimonio de X · N") | Sin sesión: aviso de sesión (C4). Con sesión: `testimonios_corazon` (`darCorazon`) | `corazones`, `yoDi` | pedido |
| Botón redondo de compartir | Compartir testimonio (B5) | `id` | pedido |
| Entrar con `?testimonio=:id`: se despliega, scroll hasta él y un recuadro negro con fondo amarillo que se apaga en 3,2 s | — | `id` del link | diseño |

### C3 · Estados del detalle

| Estado | Qué se ve | Dato | Origen |
|---|---|---|---|
| Cargando | Esqueleto de las dos columnas | — | diseño |
| Error | "No pudimos cargar los testimonios" + "Reintentar" | `red` | diseño |
| Sin testimonios, plazo abierto | "Todavía nadie contó su experiencia en este grupo", "Si fuiste parte, podés ser la primera persona en contarlo. Tenés hasta el 29/12." + "Dejar mi testimonio" → `/testimonios-gcx` | `testimonios.length === 0`, `cargaAbierta` | diseño |
| Sin testimonios, plazo cerrado | "…", "La carga de testimonios de esta temporada ya cerró." | — | diseño |
| GCX que no existe o de otra temporada | **No está en el diseño** | motivos `no_existe` / `fuera_de_temporada` | — |

### C4 · Aviso de sesión (al dar corazón sin sesión)

| Qué se ve | Qué hace | Dato | Origen |
|---|---|---|---|
| Candado, "Iniciá sesión para dar corazón", "Dar corazón solo está disponible para personas con la sesión iniciada. Al entrar volvés a este mismo testimonio y el corazón queda dado." | — | — | pedido (corazón con sesión); el texto, diseño |
| "Iniciar sesión" (negro) / "Volver atrás" (gris) | Login y vuelve al mismo testimonio | — | — |
| Al volver: velo "Volviendo de iniciar sesión…" con ruedita, el corazón queda dado y toast "Listo, tu corazón quedó dado" | `testimonios_corazon(id, true)` al volver | — | diseño |

---

## D · Lo que la base tiene para cada cosa

| RPC | Servicio | Sesión | Para |
|---|---|---|---|
| `testimonios_temporada()` | `getTemporadaTestimonios` | no | título, plazo, pantalla de cerrado |
| `testimonios_grupos(p_busqueda)` | `getGruposTestimonios` | no | B1–B3 (con `coincide`, `autores`, `autores_total`) |
| `testimonios_grupo(p_group_id)` | `getGrupoTestimonios` | no (con sesión suma `yo_di` y `es_mio`) | C1–C3 |
| `testimonios_mis_grupos()` | `getMisGruposTestimonios` | sí | A2, A3, A5, A6 (`mi_nombre` para la vista previa) |
| `testimonios_publicar(...)` | `publicarTestimonio` | sí | A4 |
| `testimonios_corazon(id, dar)` | `darCorazon` | sí | C2, C4 |
| `testimonios_mios()` | `getMisTestimonios` | sí | "Mis testimonios" (prompt 4) y "Ver mis testimonios" |
| `testimonios_solicitar_eliminacion(id, motivo)` | `solicitarEliminacion` | sí | "Mis testimonios" (prompt 4) |
| `testimonios_admin_listar(...)` | `getTestimoniosAdmin` | SUPER_ADMIN | moderación (prompt 4) |
| `testimonios_admin_resolver(id, accion)` | `resolverTestimonio` | SUPER_ADMIN | moderación (prompt 4) |

"Mis testimonios" y la moderación **no tienen diseño todavía**: la base trae
todo lo que pide el prompt 1 (estado, corazones, fechas, motivo del pedido,
quién decidió).

---

## E · Conflictos y cosas a decidir

1. **El link de compartir.** El diseño muestra `origeniglesia.org/testimonios/…`;
   la app vive en `app.origeniglesia.org` con `HashRouter`, así que el link real
   es `https://app.origeniglesia.org/#/testimonios/:id`. A decidir en el prompt 3.
2. **Las fotos.** El diseño dibuja sólo iniciales. La base manda la `foto` del
   anfitrión y del co-anfitrión; de quien escribe, sólo el nombre.
3. **El nombre de la temporada.** La configuración dice "Tercer Temporada"; el
   diseño, "Tercera temporada". La base arma el nombre fijo por clave
   (`Primera/Segunda/Tercera temporada`), como el diseño.
4. **Corazón al propio testimonio.** El diseño no dice nada. La base lo deja.
5. **GCX que no existe o de otra temporada** en `/testimonios/:id`: sin diseño.
6. **Anfitriones y co-anfitriones** no pueden dejar testimonio: la regla pide
   inscripción aprobada y ellos no la tienen. Para ellos se ve "No encontramos
   un GCX tuyo en esta temporada".
7. **Login del diseño** ("Continuar con Google", "Entrar con email", "Crear
   cuenta"): hay que usar el login que ya existe y volver a `/testimonios-gcx`.

# Inventario · Reportes de Punto de Información

Lo que hay en los tres `.dc`, pieza por pieza, y de qué dato real sale cada
cosa. Escrito para que los prompts 2 y 3 no tengan que volver a leer el
diseño ni adivinar de dónde sale un número.

**Los tres archivos son el MISMO documento.** Sólo cambia la línea 418:

```js
PANTALLA = 'tablero' | 'bautismos' | 'presentaciones';
```

| Archivo | PANTALLA | Ruta |
|---|---|---|
| `Reportes Punto de Informacion.dc.html` | `tablero` | `/reportes/puntoinfo` |
| `Reportes Punto de Informacion - Bautismos.dc.html` | `bautismos` | `/reportes/puntoinfo/bautismos-detalles` |
| `Reportes Punto de Informacion - Presentaciones.dc.html` | `presentaciones` | `/reportes/puntoinfo/presentacion-detalles` |

La barra de arriba de todo (VISTA · ESTADO · PANTALLA, líneas 14-33) es el
andamio del diseño para mirarlo: **no se implementa**. `device` pasa a ser el
tamaño real de la pantalla y `estado` pasa a ser el estado de la carga.

El diseño simula `HOY = 14/10/2026` y todos sus datos son inventados
(`generar()`, líneas 445-491): ni un número del `.dc` se copia.

---

## 0 · Qué se reutiliza y qué hay que crear

### Se reutiliza tal cual

| Pieza | Dónde vive | Para qué acá |
|---|---|---|
| `C` (tokens), `FUENTE` | `components/Reportes/PiezasTablero.tsx` | Los colores del `.dc` **son** estos tokens: `#0f172a` = `C.tinta`, `#6b7280` = `C.apagado`, `#9ca3af` = `C.tenue`, `#2563eb` = `C.azul`, `#c9d4ea` = `C.azulClaro`, `#e8e9ec` = `C.borde`, `#eef0f3` = `C.bordeSuave`, `#f7f8fa` = `C.fondo` |
| `Tarjeta` | ídem | Toda caja blanca `border-radius:14px` del diseño. `destacada` = la tarjeta ámbar del KPI con stock bajo |
| `TituloTarjeta` | ídem | Título + detalle + `extra` (el selector Stock/Período) + `descargas` (Excel) |
| `Kpi` | ídem | Los 4 KPIs del tablero y los 2 del detalle |
| `NotaCobertura` | ídem | La nota al pie: "El mínimo de cada talle se configura en Punto de Información." y `dNota` |
| `Esqueleto` | ídem | Todos los `{{ sk }}` del diseño |
| `SelectorDeRango` | `pages/audiencia/SelectorDeRango.tsx` | El calendario. **Se importa, no se copia.** Props: `valor`, `onCambiar`, `serviciosPorDia: Map<string, number>`, `atajos` |
| `descargarExcel`, `HojaExcel` | `pages/reportes/exportacion.ts` | Los botones "Excel" |
| `useBloqueoDeFondo` | `hooks/useBloqueoDeFondo.ts` | Las hojas de abajo en mobile |
| `recharts` | ya en el proyecto | Las barras del inventario |

### Hay que crear

| Qué | Dónde | Notas |
|---|---|---|
| `pages/reportes/ReportesPuntoInfo.tsx` | nuevo | El tablero (prompt 2) |
| `pages/reportes/ReportesPuntoInfoBautismos.tsx` | nuevo | Detalle (prompt 3) |
| `pages/reportes/ReportesPuntoInfoPresentaciones.tsx` | nuevo | Detalle (prompt 3) |
| `services/reportesPuntoInfo.ts` | **hecho en este prompt** | Todas las consultas y cálculos |
| Tarjeta de inventario con selector + barras | prompt 2 | No existe nada parecido en PiezasTablero |
| Planilla de pendientes (máx. 4 filas) | prompt 2 | Grilla en PC, lista apilada en mobile |
| Pastilla de estado (Pendiente / Realizado / Cancelado) | prompt 2-3 | Colores en §6 |
| Hoja/modal de detalle de una solicitud | prompt 3 | Mobile: hoja desde abajo. PC: modal centrado |
| Buscador + pestañas + paginado | prompt 3 | 8 filas por página |

---

## 1 · Encabezado (todas las pantallas, líneas 39-54)

| Elemento | Mobile | PC | Dato |
|---|---|---|---|
| Volver | `‹ Punto de Información` (tablero) · `‹ Reportes de Punto de Información` (detalle) | igual | Link fijo |
| `<h1>` | 23px | 28px | `Reportes de Punto de Información` · `Bautismos` · `Presentación de niños` |
| Período | 13.5px `#6b7280` | igual | `rangoTxt`: `1 oct – 14 oct 2026`; si es un solo día, `14 oct 2026` |
| Botón calendario | ancho completo, alto 48 | auto, min 230px, alto 42 | `etiqueta()`: `Octubre 2026` si el rango es el mes entero o hasta hoy; `Todo 2026` si es el año; si no, el rango |

El `.dc` dibuja su propio calendario (líneas 338-376). **Se reemplaza por
`SelectorDeRango`**, que ya hace lo mismo con otra piel: atajos, dos meses en
PC, uno en mobile, hoja desde abajo, puntos en los días con datos. Los atajos
del diseño son `Este mes`, `Mes pasado`, `Últimos 3 meses`, `Este año`.

---

## 2 · Estados de pantalla

| Estado | Qué muestra | Textos |
|---|---|---|
| Cargando | Esqueletos con la forma de cada tarjeta (líneas 66-84 tablero, 237-248 detalle) | — |
| Error | Tarjeta centrada, círculo rojo `#fdecea` | **"No pudimos cargar los reportes"** · "Revisá tu conexión e intentá de nuevo. Los datos de Punto de Información no se perdieron." · botón **"Reintentar"** |
| Vacío | No es una pantalla aparte: cada tarjeta tiene su propio vacío | §3, §4, §5 |

---

## 3 · Novedades (tablero, líneas 87-109)

Tarjeta con título **"Novedades"** y detalle **"Los últimos 3 movimientos del
período"**. Máximo 3 filas; cada una: círculo de 30px con flecha, la frase,
la hora a la derecha.

| Dato del diseño | De dónde sale de verdad |
|---|---|
| `n.frase` | `getNovedades()` · ver abajo |
| `n.cuando` | `movements.date` → `Hoy 18:40` / `Ayer 11:05` / `12 oct 20:15` |
| `n.por` ("Editado por Carolina Méndez") | `movements."createdByName"` — **columna nueva de este prompt**. Sólo en Ajuste y sólo si no es NULL |
| Icono | Entrada ↓, Salida ↑, Ajuste lápiz. Ajuste en ámbar (`#fbf0e2`/`#8a5a12`), los otros en gris (`#f1f2f4`/`#374151`) |
| Vacío | **"No hubo movimientos en este período."** |

**Las frases** (línea 517-522 del `.dc`, con la concordancia pedida):

| Tipo (base) | Frase |
|---|---|
| `Entrada`, 1 | `Se ingresó 1 remera talle 2` |
| `Entrada`, N | `Se ingresaron 12 remeras talle 2` |
| `Salida`, 1 | `Se vendió una remera talle 3` (buzo → `un buzo`) |
| `Salida`, N | `Se vendieron 2 buzos talle 3` |
| `Ajuste` | `Se editó el stock de buzos talle 4: quedó en 9 (antes 12)` |
| `Ajuste` sin `previousStock` | `Se editó el stock de buzos talle 4: quedó en 9` |

> **Diferencia 1 — los tipos.** El diseño usa `ingreso/venta/ajuste`; la base
> usa `Entrada/Salida/Ajuste`. El servicio traduce.
>
> **Diferencia 2 — el "antes".** Los 26 movimientos que ya existen tienen
> `previousStock` NULL: ahí el paréntesis no se muestra. De acá en adelante lo
> completa el disparador.
>
> **Diferencia 3 — el autor.** El diseño lo muestra sólo en los ajustes. Se
> respeta, aunque la base ahora lo guarde en los tres tipos.

---

## 4 · KPIs del tablero (líneas 111-120)

Encima, en 12.5px `#9ca3af`: **"Estos números son de hoy: no cambian con el
período."** Grilla de 4 en PC, 2×2 en mobile. Valor 30px / 26px.

| # | Label | Valor | Nota |
|---|---|---|---|
| 1 | `Remeras en stock` | Suma de `stock` de las remeras | `3 talles por debajo del mínimo` / `1 talle por debajo del mínimo` / `Todos los talles sobre el mínimo` |
| 2 | `Buzos en stock` | Suma de `stock` de los buzos | ídem |
| 3 | `Bautismos pendientes` | Cuántos pendientes hay hoy | `La más antigua espera hace 23 días` / `No hay pendientes` |
| 4 | `Presentaciones pendientes` | ídem | ídem |

Si hay talles por debajo del mínimo: tarjeta ámbar (`destacada`) y la nota en
`#8a5a12`.

> **Diferencia 4 — el mínimo.** El diseño usa una constante `MIN = 5` para
> todos los talles y compara `stock < MIN`. En la base cada producto tiene su
> propio `"minStock"` y la app (`pages/punto-informacion/Inventario.tsx`)
> avisa con `stock <= minStock`. **Manda la app**: `stock <= minStock`, por
> producto. El texto del diseño no cambia.
>
> **Diferencia 5 — "hace N días".** Con un solo día dice "hace 1 días". El
> servicio devuelve el número (`diasDeEspera`); la redacción del singular
> queda para la pantalla.

---

## 5 · Inventario (tablero, líneas 122-190)

`<h2>` **"Inventario"** (18px) y dos tarjetas: **Remeras** y **Buzos**. Una
al lado de la otra en PC, apiladas en mobile.

Cabecera de cada tarjeta:

- Título: `Remeras` / `Buzos`
- Detalle: `Unidades por talle, hoy` (modo stock) · `Ingresos y ventas por talle · 1 oct – 14 oct 2026` (modo período)
- Selector de dos botones: **"Stock actual"** / **"En el período"** (uno por tarjeta, independiente)
- Botón **"Excel"** (`aria-label="Descargar en Excel"`)
- En modo período, una línea arriba de las barras: **`Ingresaron 34 · Se vendieron 12`**

Leyenda (cuadraditos de 10px):

| Modo | Leyenda |
|---|---|
| Stock actual | `En stock` (`#2563eb`) · `Por debajo del mínimo` (`#e5ad5c`) |
| En el período | `Ingresaron` (`#2563eb`) · `Se vendieron` (`#c9d4ea`) |

**Gráfico — PC (líneas 149-168):** barras verticales, alto 220px, una columna
por talle, el número encima de cada barra, los talles 1-10 debajo y la
palabra `Talle` centrada abajo. Tooltip al pasar el mouse.

**Gráfico — mobile (líneas 169-185):** barras horizontales. Grilla de tres
columnas: `TALLE` (40px) · barra · valor a la derecha (`UNIDADES`, 34px; o
`ING. · VEND.`, 58px). En modo período cada talle lleva dos barritas finas
apiladas. Tooltip al tocar.

**Tooltips:**

- Stock: `Talle 3 · 18 unidades · mínimo 5` (singular: `1 unidad`)
- Período: `Talle 3 · Ingresaron 4 · Se vendieron 2`

**Vacío (sólo en modo período):** caja gris, alto 258px en PC / 200px en
mobile: **"No hubo ingresos ni ventas de remeras en este período."**

**Nota al pie:** "El mínimo de cada talle se configura en Punto de
Información."

**Excel:** archivo `Remeras - 2026-10-01 a 2026-10-14`, columnas
`Talle · Stock actual · Mínimo · Ingresaron (período) · Se vendieron (período)`.
El prompt 2 lo arma con `descargarExcel` en **un solo libro con dos hojas**
(Remeras y Buzos), que es lo que pidió Ignacio.

> **Diferencia 6 — siempre 10 talles.** El diseño asume 10 talles por tipo.
> `getInventarioPuntoInfo` devuelve siempre del 1 al 10, con 0 en los que no
> existan como producto.
>
> **Diferencia 7 — hoy no hay Entradas.** En producción hay 26 movimientos:
> 21 Ajuste y 5 Salida, ninguna Entrada. El modo "En el período" va a mostrar
> `Ingresaron 0` hasta que se cargue la primera. No es un error de la pantalla.
>
> **Diferencia 8 — los ajustes no se grafican.** El diseño sólo suma
> ingresos y ventas en el modo período; los ajustes quedan fuera (y son 21 de
> 26 movimientos). Se respeta: un ajuste no es una entrada ni una venta.

---

## 6 · Bautismos y Presentaciones (tablero, líneas 192-232)

`<h2>` **"Bautismos y Presentaciones de niños"**. Dos planillas, hasta 4
filas cada una, ordenadas de la solicitud **más vieja a la más nueva**.

| | Bautismos | Presentaciones |
|---|---|---|
| Título | `Bautismos pendientes` | `Presentaciones pendientes` |
| Detalle | `4 de 11 · los que más esperan, primero` · `1 pendiente · …` · `Nadie está esperando` | ídem |
| Pastilla | `3 solicitudes nuevas en el período` · `1 solicitud nueva en el período` · `Sin solicitudes nuevas en el período` | ídem |
| Columnas PC | `SOLICITUD` · `NOMBRE Y APELLIDO DEL SOLICITANTE` · `NÚMERO DE TELÉFONO` | `SOLICITUD` · `NOMBRE Y APELLIDO DEL NIÑO` · `NOMBRE Y APELLIDO DE LOS PADRES` · `TELÉFONO DE CONTACTO` |
| Celda 1 | `Solicitud de bautismo` + debajo `23 sep 2026 · 10:17` | `Solicitud de Presentación` + debajo la fecha y hora |
| Vacío | `No hay bautismos pendientes.` | `No hay presentaciones pendientes.` |
| Pie | `Ver más detalles →` (44px de alto) | ídem |

Pastilla con fondo azul `#eaf0fc`/`#1e3a8a` si hay nuevas, gris
`#f1f2f4`/`#6b7280` si no.

En mobile la fila se apila (sin encabezados de columna) y el teléfono ocupa
44px de alto; en PC es una grilla y el teléfono 28px. El teléfono es un
`<a href="tel:+549…">` azul `#2563eb`.

Datos: `getPendientes('bautismos' | 'presentaciones', rango)`.

> **Diferencia 9 — "los padres".** El diseño junta madre y padre con " y " y
> saltea el que falte. En la base pueden faltar los dos: entonces la celda
> queda con `—`.

---

## 7 · Pantallas de detalle (líneas 236-334)

### KPIs (2, siempre al 50 %)

| Label | Valor | Nota |
|---|---|---|
| `Bautismos realizados` / `Presentaciones realizados` ⚠ | realizados con `completion_date` en el rango | `En el período elegido` |
| `Bautismos pendientes` / `Presentaciones pendientes` | pendientes de hoy | `No depende del período` |

> ⚠ **Diferencia 10.** El diseño arma el label con `sust + ' realizados'` y
> `sust = 'Presentaciones'`, así que en esa pantalla dice *"Presentaciones
> realizados"*. Es un error de concordancia del diseño. Se implementa
> **"Presentaciones realizadas"**.

### Tarjeta de la tabla

- Título **"Todas las solicitudes"**, detalle `1 oct – 14 oct 2026 · más los pendientes de hoy`
- Pestañas: `Todos` · `Pendientes` · `Realizados` · `Cancelados`, cada una con su número al lado. En mobile, grilla 2×2
- Buscador: `Buscar por nombre, apellido o teléfono` (bautismos) · `Buscar por niño/a, madre, padre o teléfono` (presentaciones). Con texto, aparece la × para limpiar
- Botón **"Excel"**
- Paginado: 8 por página. `1–8 de 23`. En PC se ven los números de página; en mobile, sólo las flechas
- Pie: `Muestra las solicitudes y los bautismos del período, más todos los pendientes de hoy. Es solo de lectura.` (presentaciones: `…y las presentaciones del período…`)

**Qué filas entran** (línea 660): las pendientes **todas** (sin importar el
período) + las que tengan la solicitud o la realización dentro del período.
Ordenadas por solicitud, de la más nueva a la más vieja.

### Columnas

**Bautismos:** `SOLICITUD` (fecha + hora debajo) · `NOMBRE` · `APELLIDO` ·
`TELÉFONO` · `EMAIL` · `ESTADO` (pastilla) · `FECHA DE REALIZACIÓN` (`—` si
no hay).

**Presentaciones:** `SOLICITUD` · `NIÑO/A` · `MADRE` · `PADRE` · `TELÉFONO` ·
`EMAIL` · `FECHA AGENDADA` · `ESTADO` · `REALIZACIÓN`.

En mobile la tabla se convierte en una lista: nombre, pastilla de estado y un
botón **"Ver detalles"** de 44px.

### Pastillas de estado

| Estado | Fondo | Tinta |
|---|---|---|
| Pendiente | `#fbf0e2` | `#8a5a12` |
| Realizado | `#eaf0fc` | `#1e3a8a` |
| Cancelado | `#f1f2f4` | `#4b5563` |

### Vacíos

| Caso | Título | Texto |
|---|---|---|
| Con búsqueda | `Ninguna solicitud coincide con “juan”` | `Probá con otro nombre o con parte del teléfono.` + botón `Limpiar la búsqueda` |
| Pestaña Realizados | `No hubo bautismos realizados en este período.` / `No hubo presentaciones realizadas en este período.` | `Elegí otro período en el calendario de arriba.` |
| Resto | `No hay solicitudes en este período.` | ídem |

### Ficha de una solicitud (líneas 378-412)

Mobile: hoja desde abajo con agarradera, se arrastra para cerrar (`dy > 90`),
`border-radius: 28px 28px 0 0`, alto máximo 92 %. PC: modal centrado de
580px con una × arriba a la derecha.

- Volanta: `Solicitud de bautismo` / `Solicitud de presentación`
- Título: el nombre completo / el nombre del niño
- Campos (bautismos): `Nombre` · `Apellido` · `Teléfono` · `Email` · `Fecha y hora de la solicitud` · `Estado` (pastilla) · `Fecha de realización`
- Campos (presentaciones): `Niño/a` · `Madre` · `Padre` · `Teléfono de contacto` · `Email` · `Fecha y hora de la solicitud` · `Fecha agendada` · `Estado` · `Fecha de realización`
- Dos botones de 48px: **Llamar** (negro, `tel:+549…`) y **WhatsApp** (gris, `https://wa.me/549…`)

> **Diferencia 11 — el teléfono.** El diseño arma `+549` + los dígitos sin
> mirar lo que hay. En la base el teléfono es texto libre y puede venir con
> `+54`, con `0`, con `15` o vacío. `telParaWhatsApp()` devuelve `null` si no
> llega a un número argentino válido, **y entonces el botón de WhatsApp no se
> muestra**. `telParaLlamar()` es más permisivo: cualquier cosa con dígitos.

---

## 8 · Formato de fechas y horas

| Caso | Diseño | Implementación |
|---|---|---|
| Fecha | `14 oct 2026` | `es-AR`, hora argentina |
| Fecha + hora | `23 sep 2026 · 10:17` | ídem, 24 h |
| Novedades | `Hoy 18:40` · `Ayer 11:05` · `12 oct 20:15` | ídem |
| Sin fecha | `—` | ídem |

Nunca `new Date('YYYY-MM-DD')`: eso es medianoche UTC y en Argentina cae el
día anterior.

---

## 9 · Lo que el diseño no muestra y la base sí

- `movements."paymentMethod"` (`Efectivo` / `Mercado Pago`): no aparece en
  ningún lado del tablero. Queda fuera.
- `movements."createdBy"`: se guarda el uuid, pero la pantalla usa sólo
  `"createdByName"`.
- `info_products.price`: el tablero no habla de plata.
- `baptisms.is_pending` / `presentations."isPending"`: ver §10.

## 10 · "Pendiente": qué criterio se usa

Las dos pantallas del panel (`pages/punto-informacion/Bautismos.tsx` línea 24
y `PresentacionNinos.tsx` línea 24) filtran por **`isPending`**, no por
`status`. Los reportes usan **el mismo**: `is_pending = 1` /
`"isPending" = 1`.

Hoy en producción las dos columnas coinciden en todas las filas (0
inconsistencias), así que el criterio no cambia ningún número. `status` se
sigue usando para la pastilla y para las pestañas del detalle, que es lo que
hace el diseño.

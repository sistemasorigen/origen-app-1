# Inventario · Barra de accesos rápidos

Diseño: `design-claude/Barra de accesos rapidos.dc.html`. Los nombres que aparecen en el diseño
(Daniela, Carolina, Valeria) son de ejemplo; no tiene emails ni teléfonos.

## Selector del diseño

| Fila | Opciones |
|---|---|
| Vista | iPhone 390, iPhone 430, Android 412, Tablet 768, Tablet 1024, Compu 1280 |
| Entorno | App instalada, Navegador (sin barra) |
| Perfil | Usuario común, SUPER_ADMIN |
| Barra | Blanca con sombra · **elegida**, Translúcida con desenfoque |
| Música | Sin reproductor, Con reproductor, Mini pegado a la barra · **Propuesta** |
| Movimiento | Normal, Reducir movimiento |
| Pantalla | Inicio, GCX, Notificaciones, Perfil, 5.º activo, Login (sin barra), Trámite (sin barra) |
| Avisos | Sin notificaciones, Con 3, Con 120, Llega una nueva |
| Scroll | Tamaño normal, Achicada al bajar, Volviendo al parar |
| 5.º botón | "+" vacío, Hoja usuario común, Hoja SUPER_ADMIN, Sin resultados, Elegido, Cambiar / quitar, Perdió el acceso |
| Escondida | Con una hoja abierta, Con el teclado |

## La barra

**Cambió después del diseño (Ignacio, 2026-11-05):** sin nombres y con botones parejos.
Normal: botones de 60 × 56, ícono de 27, barra de 312 × 68. Achicada: 42 × 40, ícono de 19,
barra de 218 × 48. La tabla de abajo es lo que dice el diseño.

| Qué | Normal | Achicada al bajar |
|---|---|---|
| Ancho de los botones | 62, 62, 86, 62, 62 | 46 cada uno |
| Alto de los botones | 60 | 42 |
| Padding | 6 | 4 |
| Total | 346 × 72 | 238 × 50 |
| Ícono | escala 1 | escala .8 |
| Nombre | 10 px, 700, -.015em, línea 13, margen 4 | sin alto, sin margen, opacidad 0 |

- **Orden:** Inicio, GCX, Notificaciones, Perfil, 5.º botón ("Agregar" con un "+" hasta que se elige).
- **Piel elegida:** `#fff`, sombra `0 8px 28px rgba(0,0,0,.12), 0 1px 3px rgba(0,0,0,.06)`, radio 999.
- **Activo:** pastilla `#0a0a0a` que se desliza, ícono y texto blancos, trazo 2.25 (si no, 1.75 y `rgba(0,0,0,.62)`).
- **Abajo, medido desde el borde físico de la pantalla:** iPhone 24, Android 20, tablet 22, compu 24.
- **Íconos:** 22 px con los trazos propios del diseño. "+": círculo de 28 con un anillo de 1.75.
- **Contador:** rojo `#e5484d`, alto 18, mínimo 18, 11 px, 800, anillo de 2 px del color de atrás, arriba -6, izquierda 13. "99+" desde 100.

## Tiempos y animaciones

| Nombre | Qué hace | Tiempo |
|---|---|---|
| Tamaño | ancho, alto, padding, abajo y transformación | 220 ms `cubic-bezier(.2,.8,.2,1)` |
| Opacidad de la barra | | 200 ms |
| Pastilla activa | se desliza | 260 ms `cubic-bezier(.3,.8,.2,1)` |
| Nombre | se apaga | 160 ms |
| `qbRing` | la campana suena una vez | 750 ms |
| `qbPop` | el contador salta | 350 ms |
| `qbIn` | entra el "+" o la función | 300 y 350 ms |
| `qbUp` y `qbZoom` | abre la hoja y el modal | 320 y 240 ms |
| `qbFade` | el fondo y el aviso | 200 ms |

- **Reducir movimiento:** sin ninguna animación ni transición.
- **Scroll:** arriba de 24 px siempre normal; bajar más de 3 achica; subir más de 6 agranda; 500 ms sin scroll agranda.
- **Escondida:** `translate(-50%, 160%)` y opacidad 0.
- **Teclado:** se esconde sólo debajo de 1280 de ancho.

## El 5.º botón

- **Elegir:** tocar el "+".
- **Cambiar o quitar:** mantener apretado 520 ms, o dos toques en menos de 320 ms. El primer toque ya navega.
- **Avisos:** "Listo, X está en tu barra", "X sigue en tu barra", "Sacamos X de tu barra". Duran 2,6 s.
- **Aviso, lugar:** en el teléfono, centrado y 14 px arriba de la barra; en la compu, arriba a la derecha.
- **Etiqueta accesible:** "X. Mantené apretado para cambiarlo" y "Agregar un acceso rápido".
- **Perdió el acceso:** vuelve al "+" sin error.

## La hoja

| Qué | Teléfono | Desde 768 |
|---|---|---|
| Forma | hoja desde abajo, 86% de alto, radio 28 arriba, manija, se arrastra (más de 90 px cierra) | modal de 520, hasta 82%, radio 28 |
| Entrada | `qbUp` | `qbZoom` |

- **Textos:** "Elegí tu acceso rápido", "Va a aparecer en tu barra, al lado de Perfil.", "Buscá una función".
- **Fila:** alto 60, círculo de 40, 15.5 px y 600. Elegida: círculo negro y pastilla "En tu barra".
- **Sin resultados:** "No encontramos “X”", "Probá con otra palabra. Acá están solo las funciones que podés abrir.", "Limpiar búsqueda".
- **Al cambiar:** "Quitar de la barra", rojo `#d1343a`, alto 56.

## Mi cuenta → Preferencias

- **Fila "Barra de accesos rápidos":** detalle "Tu 5.º botón: X" o "Elegí qué va en el 5.º botón". Abre la misma hoja.
- **Nota al pie:** "La barra aparece solo en la app instalada en tu pantalla de inicio."

## Reproductor

| Opción | Qué hace |
|---|---|
| Con reproductor | el de 96 px abajo y la barra 12 px arriba de él |
| Mini · **Propuesta** | sin el de 96 px: una tarjeta de 52 de alto, 8 px arriba de la barra y de su mismo ancho, con carátula de 36, título, artista y un botón de 44. Se achica y se esconde con la barra |

**Implementado:** "Con reproductor". El mini se descartó (Ignacio, 2026-11-04).

## Espacio abajo

Lo que se deja al final de la pantalla: abajo de la barra + 72 + 20.

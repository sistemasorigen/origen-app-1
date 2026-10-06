# Nocturna — red de seguridad del rediseño

Banco de pruebas para el rediseño **sólo estético** de `/nocturna-inscripcion`
(rama `nocturna-rediseno`). Se armó con la versión anterior al rediseño
(prompt 0/6) y es la referencia: con la versión nueva tiene que seguir en verde.

**Nada de esto toca la base.** Todo pedido a Supabase lo intercepta y lo
contesta `soporte/supabase-falso.ts`. Lo único real son las tres respuestas
de `golden/respuestas-reales.json`, grabadas una sola vez contra una inscripción
"PRUEBA" que ya se borró.

## Cómo se corre

```bash
# Todo: los 9 escenarios del golden + la calidad, en los 10 dispositivos
npx playwright test -c tests/nocturna-golden

# Un solo dispositivo
npx playwright test -c tests/nocturna-golden --project=iphone-se

# Sólo el golden, o sólo la calidad
npx playwright test -c tests/nocturna-golden golden
npx playwright test -c tests/nocturna-golden calidad

# El reporte con capturas y trazas de lo que falló
npx playwright show-report tests/nocturna-golden/reporte
```

La primera vez hay que bajar los navegadores: `npx playwright install chromium webkit firefox`.

Corre contra un **build de producción** en el puerto 5199, en
`tests/nocturna-golden/.dist`. No usa el servidor de desarrollo, porque ahí
React corre en StrictMode y repite los efectos, y tampoco el `dist/` del repo,
que es el que se publica.

## Qué se compara (golden master)

`golden.spec.ts` recorre los 9 escenarios de `escenarios.ts` y compara contra
`golden/*.json`:

| # | Escenario |
|---|---|
| 1 | Sin sesión, 1 chico, se retira solo, acepta fotos, sin restricciones |
| 2 | Sin sesión, 3 chicos, los retira otra persona, no acepta fotos, celíaco + diabetes (*) |
| 3 | Con sesión (autocompletado), 2 chicos, "lo retiro yo", apellido corregido a mano |
| 4 | Adulto menor de 18 → bloqueo |
| 5 | "No autorizo" → salida |
| 6 | Sumar chicos: DNI + fecha coinciden con una inscripción existente |
| 7 | Mismo DNI, fecha distinta → cara B del diálogo |
| 8 | Recarga en el paso del pago → el borrador se restaura |
| 9 | Doble toque en el botón final → un solo envío |

(*) Regrabado después del arreglo 3d65205: Martina celíaca, Bruno con diabetes.

De cada escenario se guarda:

- **`pedidos`**: el cuerpo exacto de cada pedido de la inscripción
  (`nocturna_config`, `nocturna_buscar_grupo`, `register_nocturna`,
  `nocturna_agregar_jovenes` y la subida del comprobante). De la subida se
  guarda la ruta y las partes del multipart, no los bytes: el JPEG que sale
  del canvas no es idéntico en cada navegador.
- **`secuencia`**: las pantallas recorridas (0 a 8, `noAut`, `fuera`).
- **`pasos`**: el `sessionStorage` completo después de cada acción.

### Qué se normaliza (y nada más)

| Valor | Por qué cambia | Se guarda como |
|---|---|---|
| UUID que genera el navegador (id local de cada chico, nombre del archivo del comprobante) | `safeUUID()` | `<uuid-1>`, `<uuid-2>`… en orden de aparición |
| Fechas con hora ISO | por si algún campo anota cuándo | `<fecha-hora>` |
| Números de 13 dígitos tipo `Date.now()` | idem | `<epoch-ms>` |
| `boundary` de un multipart | lo elige el navegador | `boundary=<boundary>` |

Las fechas sin hora (`2012-03-03`) son datos del formulario y no se tocan.

### Volver a grabar

**Sólo con la versión de referencia.** Si se graba con la versión nueva, el
golden aprueba cualquier cambio.

```bash
GRABAR=1 npx playwright test -c tests/nocturna-golden golden --project=desktop-1280
```

## Calidad (`calidad.spec.ts`)

En cada dispositivo y en cada pantalla, incluidos los diálogos, el modo
"sumar", las inscripciones cerradas y "sin conexión":

- **Capturas** a pantalla completa en `capturas/<dispositivo>/`, para mirarlas
  (no se comparan píxel a píxel: el rediseño cambia todo lo visual). Las de la
  versión de referencia están en `capturas-referencia/`.
- **Scroll horizontal**: no tiene que haber nunca.
- **Accesibilidad** con axe-core (WCAG 2.1 A/AA): fallan `critical` y `serious`.
- **Errores de consola** y excepciones sin atrapar.

Los hallazgos de cada prueba quedan en `hallazgos/*.json` (fuera de `resultados/`, que Playwright vacía en cada corrida).

## Dispositivos

| Proyecto | Motor | Pantalla |
|---|---|---|
| `iphone-se`, `iphone-14` | WebKit (Safari, y todo navegador de iPhone, incluidos WhatsApp e Instagram) | 375×667 · 390×844 |
| `iphone-14-sin-movimiento` | WebKit, con `prefers-reduced-motion` | 390×844 |
| `pixel-7`, `android-chico` | Chromium | 412×915 · 360×740 |
| `android-lento` | Chromium con la CPU ×4 más lenta | 360×740 |
| `desktop-1280`, `desktop-1440` | Chromium | 1280 · 1440 |
| `desktop-1440-sin-movimiento` | Chromium, con `prefers-reduced-motion` | 1440 |
| `firefox` | Firefox | 1280 |

Los navegadores embebidos de WhatsApp e Instagram no se pueden automatizar: en
iPhone son WebKit (los cubren los proyectos `iphone-*`) y en Android son un
WebView de Chromium (lo cubren `pixel-7` y `android-*`). Lo que sí cambia en
ellos, como la barra propia o que no haya botón de atrás, se prueba a mano.

## Probar en un celular de verdad, sin publicar nada

Con la PC y el celular en la **misma red Wi-Fi**:

```bash
npx vite build --outDir tests/nocturna-golden/.dist --emptyOutDir && npx vite preview --outDir tests/nocturna-golden/.dist --host
```

Desde el celular se abre `http://<ip-de-la-pc>:4173/#/nocturna-inscripcion`.
Al 2026-10-06 la IP de la PC en la red de la casa era `192.168.1.60`; puede
cambiar, y se ve con `ipconfig` ("Dirección IPv4").

Es a propósito que no sea `npm run build && npx vite preview --host`: ese
build escribe en `dist/`, que está en git y es lo que se publica. Además,
`npm run build` regenera `.build-version`.

**Ojo: esa prueba usa la base REAL.** No es el banco de arriba: una inscripción
completa en el celular queda guardada en producción y manda el email de la
entrada. Para probar el flujo entero, usar apellido "PRUEBA" y borrarla
después, o frenar antes de "Listo" en el paso del pago.

Limitaciones de esa prueba, que **no son errores** del rediseño:

- **Es `http`, no `https`.** El botón de copiar alias/CVU puede no andar,
  porque la API del portapapeles exige un contexto seguro.
- **El login con Google no funciona.** Supabase sólo redirige a URLs
  autorizadas, y `http://192.168.x.x:4173` no lo está. Hay que probar con
  email y contraseña, o sin sesión.
- **El firewall de Windows** puede bloquear el puerto 4173 la primera vez. Si
  el celular no carga, hay que permitir Node.js en redes privadas.
- **Safari en iPhone** puede guardar en caché una versión vieja. Si un cambio
  no aparece, abrir la página en una pestaña privada.

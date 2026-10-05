# 🛸 Origen App — IA Instructions & Style Guide
> Versión 6.0 · Octubre 2026 · Obligatorio leer antes de cualquier intervención

Este archivo es la **memoria central y autoridad arquitectónica** del proyecto.
Todo agente de IA que trabaje en este repositorio debe leerlo completo antes
de escribir una sola línea de código. Su cumplimiento no es opcional.

### ⚠️ Lo que cambió respecto de la v5.0 y más se rompe si se ignora

1. **El router es `HashRouter`.** Las URLs son `/#/ruta`. La v5.0 decía
   `BrowserRouter`: era falso. Ver secciones 1 y 7.12.
2. **El estilo neo-brutalista quedó en el pasado.** La sección 8 de la v5.0
   mandaba bordes negros gruesos, sombras duras y `font-black`. Seguirla
   deshace el rediseño de toda la app. El estándar actual es el del login.
3. **El repositorio es público** y `npm run deploy` hace `git add -A`: todo
   lo que esté en la carpeta se publica. Ver sección 12.
4. **Seguridad:** la auditoría de septiembre de 2026 encontró una escalación
   a `SUPER_ADMIN` sin sesión y dos fugas de datos personales. Las reglas que
   salieron de ahí están en la sección 12 y no son opcionales.
5. **Verificar contra el código y la base, no contra este archivo.** Si algo
   de acá no coincide con lo que hay, manda lo que hay — y se corrige acá.

---

## 1. STACK TECNOLÓGICO

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Componentes funcionales, sin clases |
| Estilos | Tailwind CSS vía CDN | Config personalizada en `index.html` |
| Backend / DB | Supabase | Auth, Postgres, Storage, Edge Functions, Realtime, `pg_net`, `pg_cron`, Vault |
| IA / Texto | Google Gemini 2.5 Flash | `@google/generative-ai` + `@google/genai` |
| Animaciones | Framer Motion 12 | `motion`, `AnimatePresence` |
| Iconos | Lucide React | Siempre desde `lucide-react` |
| Routing | React Router DOM 7 | **`HashRouter`** — las URLs son `/#/ruta` |
| Gráficos | Recharts | Dashboards con datos reales |
| QR | `html5-qrcode` (escanear), `qrcode.react` (dibujar), `npm:qrcode` (Edge Functions) | |
| Emails | Resend | **100 emails por día** en el plan actual (sección 35) |
| Tutoriales | `react-joyride` | Configuración en `src/config/tours.ts` |
| Estado global | React Context API | Sin Redux ni Zustand |
| Audio | Context API propio | `contexts/AudioContext.tsx` |

**Dependencias instaladas — NO instalar alternativas:**
`@google/genai`, `@google/generative-ai`, `@supabase/supabase-js`,
`class-variance-authority`, `clsx`, `framer-motion`, `html5-qrcode`, `idb`,
`lucide-react`, `qrcode.react`, `react-easy-crop`, `react-joyride`,
`react-router-dom`, `recharts`, `tailwind-merge`, `xlsx`

⚠️ **`matter-js` y `@types/matter-js` siguen instalados pero no se usan**
(solo los importa el archivo huérfano `Home-IgnacioPC.tsx`). Pendiente:
`npm uninstall matter-js @types/matter-js`. No usarlos en código nuevo.

---

## 2. ESTRUCTURA DE CARPETAS

```
origen-app/
├── components/
│   ├── GCX/              # Módulo Grupos de Conexión
│   ├── Reportes/         # Paneles de analíticas
│   ├── admin/            # Componentes del panel Admin
│   ├── calendar/         # CalendarioIglesia.tsx
│   ├── info-point/       # Sidebar y menús del Punto de Info
│   ├── layout/           # Estructura, MenuDeslizable, AdminGCXLayout, ReproductorGlobal
│   ├── media/            # SubidaImagen, SubidaVideo, SubidaAvatar, EncuadreMedia
│   ├── modals/           # ModalLoginSistema, ModalCompletarPerfil, ModalCodigoQR
│   ├── notifications/    # BannerPermisoNotificaciones, InterfazNotificaciones
│   ├── onboarding/       # Tours (ControladorTutorial, TourBienvenida)
│   └── ui/               # NeoModal, CarruselHero, CargadorEsqueleto, LimiteError
├── contexts/             # AuthContext, AudioContext, NotificationContext
├── design-claude/        # Diseños exportados de Claude Design (*.dc.html) — sección 36
├── hooks/                # useRole, useEscanerQR, useVersionCheck, useBarraDeProgreso,
│                         # useBloqueoDeFondo, useAttendanceReminder, useSpellingAI, ...
├── pages/
│   ├── admin/            # Administrador.tsx (/panel-admin), ConfiguracionApp.tsx
│   ├── admingcx/         # Administración de GCX (/admingcx/*) — sección 21
│   ├── audiencia/        # Audiencia de Servicios + Pastores (/reportes viejo)
│   ├── auth/             # PantallaAutenticacion, ActualizarContrasena, ...
│   ├── bienvenida/       # Planilla de ingresantes, alta, detalle, formulario público
│   ├── coordinadores/    # Panel de coordinadores
│   ├── eventos/          # PanelEventos, Eventos + dianino/, dpadre/, general/,
│   │                     # influos/ (Tribal Wars), nocturna/
│   ├── gcx/              # CalendarioGCX
│   ├── groups/           # Grupos (/gcx), PanelAnfitrion y páginas de /mis-grupos
│   ├── home/             # Home.tsx
│   ├── influos/          # InfluosPagina, InfluosAcceso
│   ├── ninez/            # Niñez y su configuración
│   ├── primarias/        # PuntoInformacion, Tienda, Alabanza
│   ├── prode/            # Prode Mundial 2026
│   ├── punto-informacion/# Vistas del Punto de Info + context/ContextoToast
│   ├── reportes/         # Reportes GCX (/reportes/gcx/*) — sección 31
│   ├── trivia/           # Trivia Origen
│   └── user/             # PaginaPerfil, Notificaciones, PaginaTutoriales
├── scripts/              # generate-build-version, publish-dist, notify-deploy — sección 27
├── services/
│   ├── supabaseClient.ts # Cliente Supabase (exporta `supabase`)
│   ├── supabaseService.ts# Todas las queries a Supabase
│   ├── authUtils.ts      # hasRole(), getRoleDisplayNames()
│   ├── dbService.ts      # Módulos del sistema, config local
│   ├── geminiService.ts  # Corrector ortográfico con Gemini
│   └── db.ts             # dbAPI — wrapper de supabaseService
├── src/
│   ├── config/tours.ts   # Tours de onboarding (los pasos apuntan a ids del DOM)
│   ├── hooks/            # useIsMobile, useTutorial
│   └── utils/            # ver tabla abajo
├── supabase/functions/   # Edge Functions (Deno + Resend) — sección 10
├── sql/                  # Migraciones y scripts. PROBAR_*.sql = suites de prueba
├── types.ts              # ÚNICA fuente de tipos globales
└── App.tsx               # Rutas, providers, lógica de sesión
```

**`src/utils/` — helpers puros, reusar antes de reescribir:**

| Archivo | Qué hace |
|---|---|
| `calendario.ts` | Genera el `.ics` de la reunión semanal de un grupo |
| `cropImage.ts` | Recorte de avatares (necesita un `pixelCrop`; no sirve para comprimir) |
| `cupos.ts` | Cuántos lugares ocupa cada inscripción de un GCX (las parejas ocupan dos) |
| `filtrosRecordados.ts` | Recordar los filtros de una lista mientras dura la sesión |
| `mediaDeEntrada.ts` | Qué medios espera la pantalla de entrada antes de mostrar la app |
| `modalidad.ts` | Modalidad de un grupo: presencial, online o híbrido |
| `nocturna.ts` | `calcularEdad`, `esMayorDeEdad`, `comprimirImagen` y helpers de Nocturna |
| `scrollRecordado.ts` | Recordar el scroll de una lista mientras dura la sesión |
| `temporadaActiva.ts` | Si un grupo pertenece a la temporada abierta hoy |
| `whatsapp.ts` | Armar el link de WhatsApp a partir de un teléfono cargado a mano |

---

## 3. CONVENCIONES DE NOMENCLATURA

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes React | `PascalCase` | `NeoModal.tsx`, `TarjetaGrupo.tsx` |
| Hooks | `camelCase` con prefijo `use` | `useRole.ts`, `useSpellingAI.ts` |
| Servicios / Utilidades | `camelCase` | `supabaseService.ts`, `authUtils.ts` |
| Interfaces / Tipos | `PascalCase` | `WelcomeVisitor`, `UserRole` |
| Archivos CSS | `kebab-case` | `index.css` |
| Variables y funciones | `camelCase` descriptivo | `fetchAttendees`, `handleSubmit` |
| Constantes de módulo | `UPPER_SNAKE_CASE` | `COUNTRIES`, `INTEREST_OPTIONS` |

**Nota crítica sobre carpetas:** El proyecto usa **español** en los nombres de
carpetas y archivos de `pages/` y la mayoría de `components/`.
Al crear archivos nuevos, respetar el idioma del directorio donde se inserten.

---

## 4. REGLAS DE IMPORTACIÓN

**El proyecto usa rutas relativas `../../`, NO el alias `@/`.**

Aunque `vite.config.ts` define el alias `@/`, el código real del proyecto
usa rutas relativas en todos los archivos. Seguir el patrón existente:

```typescript
// ✅ CORRECTO — rutas relativas
import NeoModal from '../../components/ui/NeoModal';
import { supabase } from '../../services/supabaseClient';
import { ToastProvider, useToast } from '../punto-informacion/context/ContextoToast';
import { hasRole } from '../../services/authUtils';

// ❌ INCORRECTO — no usar alias aunque esté configurado
import NeoModal from '@/components/ui/NeoModal';
```

---

## 5. RUTAS PÚBLICAS Y PROTEGIDAS

Las rutas se declaran en `App.tsx`. Hay **tres zonas**. La frontera real: todo
lo que vive dentro del `<Route path="*">` (≈ línea 605) **exige sesión**; si no
hay usuario, ese `*` muestra el login.

**Regla de orden:** las rutas con parámetro (`:id`, `:groupId`) van **después**
de las rutas literales del mismo nivel (`/nueva`, `/acreditar`, `/comp-temp`).
Si no, el parámetro captura el literal como si fuera un id.

### Zona 1 — Públicas sin Layout (sin auth, sin chrome)
| Ruta | Componente | Notas |
|---|---|---|
| `/auth` | PantallaAutenticacion | Acepta modo registro por query (leído del router) |
| `/update-password` | ActualizarContrasena | |
| `/verify-email` | VerificarEmail | |
| `/form` | Formulario | Formulario público de Bienvenida |
| `/dia-del-nino`, `/dia-del-nino/buscar` | Inscripción y búsqueda del Día del Niño | **Desactivadas** con `EVENT_ENDED` (sección 28) |
| `/tribal-wars`, `/tribal-wars/buscar` | Inscripción y búsqueda de Tribal Wars | |
| `/nocturna-inscripcion` | InscripcionNocturna | Sección 29 |
| `/influos-acceso` | InfluosAcceso | Verificador público de tribu |
| `/id-dpadre`, `/eventos/ranking-diadelpadre` | Día del Padre | |
| `/trivia`, `/trivia/unirse/:pin`, `/trivia/jugar/:pin`, `/trivia/pantalla/:pin` | Trivia (jugador y proyector) | Sección 20 |

**Caso especial:** `/panel-eventos/nocturna/acreditar` (escáner) está **fuera
del Layout** a propósito —la navbar le quitaba un cuarto de pantalla al
visor— pero **con guard de roles**: `SUPER_ADMIN`, `PASTOR`,
`ENCARGADO_EVENTOS`, `ACREDITACION`.

### Zona 2 — Públicas con Layout (sin auth, con chrome)
`currentUser` puede ser `null`. Ver sección 7.6.
| Ruta | Componente |
|---|---|
| `/` | Home |
| `/gcx` | Grupos (catálogo público) |
| `/eventos` | Eventos (listado público) |

### Zona 3 — Requieren sesión (con Layout)
"Sin rol" = basta con tener sesión.

| Ruta | Módulo | Roles |
|---|---|---|
| `/punto-de-informacion` | Punto de Información | Sin rol (la vista interna se decide adentro por rol) |
| `/punto-de-informacion/{anuncios,eventos,bautismos,prestamos,movimientos,presentacion-ninos}/nuevo` | Altas del Punto de Info | **Sin guard de rol** — ⚠️ verificar que cada página o el RLS bloquee a quien no corresponde |
| `/panel-admin` | Admin general | Solo `SUPER_ADMIN` (`isSuperAdmin`) |
| `/store`, `/alabanza`, `/tutoriales`, `/notificaciones`, `/perfil` | | Sin rol |
| `/gcx/calendario` | Calendario GCX | Sin rol |
| `/prode`, `/prode/ranking`, `/prode/resultados` | Prode | Sin rol; el género se chequea adentro (sección 18) |
| `/prode/administracion` | Admin Prode | `SUPER_ADMIN`, `PASTOR`, `PRODE` |
| `/reportes` | Reportes (versión vieja, `Pastores.tsx`) | `SUPER_ADMIN`, `PASTOR`, `ENCARGADO_PUNTO`, `ADMIN_PUNTO`, `ENCARGADO_GRUPOS`, `REPORTES`, `ADMIN_GROUPS` |
| `/reportes/gcx`, `/reportes/gcx/comp-temp`, `/reportes/gcx/:groupId` | Reportes GCX | Los mismos 7 roles — sección 31 |
| `/bienvenida`, `/bienvenida/nuevo`, `/bienvenida/v/:id` | Bienvenida | `SUPER_ADMIN`, `ENCARGADO_BIENVENIDA`, `VOLUNTARIO_BIENVENIDA` — sección 32 |
| `/influos` | Influos | `SUPER_ADMIN`, `PASTOR`, `INFLUOS` |
| `/mis-grupos/*` (12 rutas) | Panel de Anfitrión | `SUPER_ADMIN`, `ADMIN_GROUPS`, `ANFITRION`, `CO_ANFITRION` — sección 22 |
| `/admingcx/*` (14 rutas) | Admin GCX | Ver sección 21 |
| `/coordinators` | Coordinadores | `SUPER_ADMIN`, `ADMIN_GROUPS`, `COORDINATOR` |
| `/audiencia-servicios`, `/audiencia-servicios/new`, `/audiencia-servicios/detalles/:id` | Audiencia de Servicios | `SUPER_ADMIN`, `PASTOR`, `ADMIN_CUIDADO_PASTORAL` — sección 33 |
| `/ninez`, `/admin-ninez/configuracion` | Niñez | `SUPER_ADMIN`, `PASTOR`, `ENCARGADO_NINEZ` |
| `/panel-eventos` | Panel de Eventos | `SUPER_ADMIN`, `PASTOR`, `ENCARGADO_EVENTOS`, `PRODE`, `ACREDITACION` |
| `/eventos/admin/diadelnino`, `/nueva`, `/escaner`, `/escaner/:ticketId`, `/:sessionId` | Día del Niño (admin) | `SUPER_ADMIN`, `PASTOR`, `ENCARGADO_EVENTOS`, `ENCARGADO_NINEZ`, `ACREDITACION` |
| `/panel-eventos/nocturna`, `/nueva`, `/:id`, `/:id/editar` | Nocturna (admin) | `SUPER_ADMIN`, `PASTOR`, `ENCARGADO_EVENTOS`, `ACREDITACION` |
| `/eventos/admin/tribal-wars`, `/nueva` | Tribal Wars (admin) | `SUPER_ADMIN`, `PASTOR`, `ENCARGADO_EVENTOS`, `INFLUOS` |
| `/eventos/admin/general`, `/crear-evento` | Eventos generales | `SUPER_ADMIN`, `ENCARGADO_EVENTOS` |
| `/eventos/admin/diadelpadre` | Día del Padre (admin) | `SUPER_ADMIN`, `PASTOR`, `ENCARGADO_EVENTOS` |
| `/eventos/puntuacion`, `/eventos/futboltenis`, `/eventos/dpadre/:id` | Día del Padre | `SUPER_ADMIN`, `PASTOR`, `EVENTOS`, `ENCARGADO_EVENTOS` |
| `/trivia/admin`, `/nuevo`, `/:id`, `/trivia/historial`, `/:id` | Trivia (admin) | `SUPER_ADMIN`, `PASTOR`, `ENCARGADO_EVENTOS` |

---

## 6. ROLES DEL SISTEMA

```typescript
enum UserRole {
    SUPER_ADMIN, PASTOR,
    ADMIN_PUNTO, ADMIN_GROUPS, ADMIN_STORE, ADMIN_ALABANZA,
    ANFITRION, CO_ANFITRION,
    ENCARGADO_PUNTO, ENCARGADO_GRUPOS, ENCARGADO_STORE,
    ENCARGADO_ALABANZA, ENCARGADO_BIENVENIDA,
    ENCARGADO_NINEZ,    // Módulo Niñez + Día del Niño
    VOLUNTARIO, VOLUNTARIO_INFO, VOLUNTARIO_GRUPOS, VOLUNTARIO_BIENVENIDA,
    COORDINATOR,        // Usa coordinatorVariants (array) — sección 25
    ADMIN_CUIDADO_PASTORAL,
    INFLUOS,            // Módulo de menores + Tribal Wars
    REPORTES,
    PRODE,              // Administración del Prode Mundial
    EVENTOS, ENCARGADO_EVENTOS,  // Eventos + Trivia — secciones 20 y 25
    ACREDITACION,       // Puerta de eventos: Día del Niño y Nocturna (acceso completo a ambos)
    USUARIO, VIEWER, VOLUNTEER   // Roles básicos / legacy
}
```

**Dos columnas de rol conviven en `users`:**
- `users.role` — singular, tipada con el enum `user_role` de Postgres
- `users.roles` — **`text[]`**, no `user_role[]`. En SQL, comparar con
  `::text[]`; castear a `user_role[]` hace abortar el `CREATE POLICY`

**⚠️ Rol nuevo = `ALTER TYPE` manual.** Cada valor nuevo de `UserRole` necesita
`ALTER TYPE user_role ADD VALUE 'NUEVO_ROL';` en la base, o escribir ese rol en
`users.role` falla. `ACREDITACION` y `ENCARGADO_NINEZ` ya están en el enum
(verificado contra `pg_enum`). Para `ADMIN_CUIDADO_PASTORAL` y `PRODE`, la v5.0
decía que faltaban: **verificar** con
`SELECT enumlabel FROM pg_enum WHERE enumtypid = 'user_role'::regtype;`

**Un trigger protege los roles:** `proteger_columnas_de_rol` pisa `role`/`roles`
cuando escribe `anon` o `authenticated`. Asignar roles desde el cliente no
funciona — va por las RPCs de admin (sección 12).

Para verificar permisos usar siempre `hasRole()`:
```typescript
import { hasRole } from '../../services/authUtils';
if (hasRole(user, [UserRole.SUPER_ADMIN, UserRole.PASTOR])) { ... }
```

Para el rol actual en un componente:
```typescript
import { useRole } from '../../hooks/useRole';
const { isSuperAdmin, isAnfitrion, canManageGroups } = useRole();
```

**Un rol nuevo necesita tres puertas en la app**, no solo permiso en la base:
la ruta en `App.tsx`, la tarjeta en el panel correspondiente, y el ítem en
`MenuDeslizable.tsx` (incluido su separador). `ACREDITACION` tuvo permiso en la
base y ninguna puerta en la app hasta que se probó con un usuario real.

---

## 7. PATRONES DE CÓDIGO OBLIGATORIOS

### 7.1 Toast Notifications
```typescript
// SIEMPRE importar desde ContextoToast
import { ToastProvider, useToast } from '../punto-informacion/context/ContextoToast';

// La página debe estar envuelta en ToastProvider
const MiPagina = () => (
    <ToastProvider>
        <MiPaginaContenido />
    </ToastProvider>
);

// Dentro del componente hijo:
const toast = useToast();
toast.success('Operación exitosa');
toast.error('Algo salió mal');
toast.neutral('Información');
```

### 7.2 Modales
```typescript
// SIEMPRE usar NeoModal de components/ui/NeoModal
import NeoModal from '../../components/ui/NeoModal';

<NeoModal
    isOpen={isOpen}
    onClose={onClose}
    title="Título del Modal"
    maxWidth="max-w-2xl"     // opcional, default max-w-2xl
    persistent={false}        // opcional, impide cerrarlo
    disableScrollLock={false} // opcional
>
    {/* Contenido */}
</NeoModal>
```

### 7.3 Queries a Supabase
```typescript
import { supabase } from '../../services/supabaseClient';

// Patrón estándar con manejo de error
const { data, error } = await supabase
    .from('nombre_tabla')
    .select('campo1, campo2')
    .eq('columna', valor)
    .order('created_at', { ascending: false });

if (error) throw error;
```

### 7.4 Componente de página con ToastProvider
```typescript
const MiPaginaContenido: React.FC = () => {
    const toast = useToast();
    // lógica...
    return <div>...</div>;
};

const MiPagina: React.FC = () => (
    <ToastProvider>
        <MiPaginaContenido />
    </ToastProvider>
);

export default MiPagina;
```

### 7.5 Subida de imágenes
```typescript
// Para imágenes generales (portadas, banners)
import ImageUpload from '../../components/media/SubidaImagen';

// Para avatar de perfil circular
import AvatarUpload from '../../components/media/SubidaAvatar';
```

### 7.6 Páginas con modo público
`Home (/)` y `Grupos (/gcx)` son accesibles sin login. `currentUser` puede
ser `null` en estos componentes. Reglas:

- **NUNCA** asumir que `currentUser` existe en `pages/home/Home.tsx` ni en `pages/groups/Grupos.tsx`
- Siempre usar optional chaining: `currentUser?.role`
- Botón UNIRME en Grupos: si `!currentUser`, navegar a `/auth` con state `{ from: { pathname: '/gcx' } }`
- El `Layout` recibe `currentUser={null}` en estas rutas y muestra "Ingresar"/"Registrarse" en el header

```typescript
// ✅ CORRECTO en componentes de zona pública
currentUser?.role
currentUser ? hasRole(currentUser, [...]) : false

// ❌ INCORRECTO — crashea si currentUser es null
currentUser.role
hasRole(currentUser, [...])  // sin guard previo
```

```typescript
// Patrón de redirección en handleJoinClick (Grupos.tsx)
const handleJoinClick = (g: Group) => {
    if (!currentUser) {
        navigate('/auth', { state: { from: { pathname: '/gcx' } } });
        return;
    }
    // ... lógica con usuario autenticado
};
```

### 7.7 MenuDeslizable — patrones extendidos

La interfaz `SubMenuItem` soporta dos campos nuevos:

```typescript
interface SubMenuItem {
    label: string;
    path?: string;          // opcional: separadores no tienen path
    roles?: UserRole[];
    separator?: boolean;    // si true: etiqueta gris no clickeable
}
```

Los **separadores** se usan para organizar secciones
dentro de un grupo de sub-items (ej: GCX tiene
separadores "Coordinación" y "Administración").

La interfaz `MenuItem` soporta `requiresAuth?: boolean`
para ocultar ítems a usuarios sin sesión aunque
`roles: []` los haga visibles a todos los autenticados.
### 7.8 Rutas nuevas: su propio ToastProvider, y esperar antes de navegar
Una ruta nueva **no hereda** el `ToastProvider` de la página que la enlaza.
Usar el patrón Content + Provider (7.4) en cada página nueva.

`toast.success(...)` seguido de `navigate(...)` desmonta el toast antes de que
se pinte. Esperar unos 600 ms antes de navegar (medido: el toast aparece a los
~270 ms).

### 7.9 Un fallo de consulta no es un dato vacío
**Es la causa de un incidente real.** Cuando la base se cayó, el perfil no se
pudo traer, el código lo trató como "perfil vacío" y le mostró a **todos** los
usuarios el modal de "completá tu perfil". La gente lo llenaba y fallaba sin
parar.

- Nunca desestructurar `{ data }` descartando el `error`
- Distinguir "la consulta anduvo y no hay datos" de "la consulta falló"
- `AuthContext` usa un estado explícito: `'pendiente' | 'ok' | 'sin-perfil' |
  'error-db'`. El modal de perfil solo aparece con `'sin-perfil'`
- En listas: si la consulta falla, mostrar error, **nunca** una lista vacía
  que diga "no hay inscripciones"

### 7.10 Fechas: parseo manual
`new Date('YYYY-MM-DD')` se interpreta en UTC y **en Argentina (UTC-3) da un
día menos**. Para edades, eso puede hacer pasar como mayor de 18 a alguien
que no lo es.
- Parsear `YYYY-MM-DD` a mano. Usar `calcularEdad()` y `esMayorDeEdad()` de
  `src/utils/nocturna.ts`
- Horas de eventos en formato de **24 h** (a las 23 en una puerta, "08:52 p. m."
  se lee mal)

### 7.11 Imágenes
- **Comprimir antes de subir** con `comprimirImagen()` (`src/utils/nocturna.ts`):
  una foto de celular pesa 3 a 8 MB. Medido: 52 MB → 1,2 MB
- **El bucket `images` es público.** Sirve para portadas y banners, **nunca**
  para comprobantes de pago ni documentos. `uploadBase64Image()` sube ahí
- Datos sensibles → bucket **privado** + **URL firmada** con vencimiento corto,
  generada **al hacer clic**, no al cargar la lista
- La ruta de un archivo **no lleva datos personales** (ni DNI ni nombre): UUID

### 7.12 HashRouter
- Un link para compartir (WhatsApp, email) **lleva `/#/`**:
  `https://app.origeniglesia.org/#/nocturna-inscripcion`. Sin eso no abre.
- Los query params viven **dentro del hash**: `window.location.search` viene
  vacío. Leerlos con `useLocation().search`.
- Los links en emails también llevan `#`.

### 7.13 Tutoriales: no perder los ids
Los pasos de `src/config/tours.ts` apuntan a **ids del DOM**
(`#btn-new-visitor`, `#auth-form`, `#tour-wrap-5`, ...). Si se reescribe una
sección, **preservar los ids**. Joyride no tira error: salta el paso en
silencio.

### 7.14 Formularios largos
- **Borrador en `sessionStorage`** mientras se completa, restaurado al volver,
  borrado al terminar y al cerrar sesión. Caso real: el padre sale a la app del
  banco a transferir y el celular descarta la pestaña. `sessionStorage` y no
  `localStorage`: no queda guardado para siempre en un dispositivo compartido.
- **Bloquear el doble envío** (probar con varios clicks sincrónicos)
- **Nombres con `.trim()`** al guardar: un espacio de más rompe búsquedas por
  igualdad exacta (pasó en el formulario público de Bienvenida)
- `window.open()` **antes** de cualquier `await` (sección 16)

### 7.15 Accesibilidad mínima
Un botón que responde no se anuncia como `aria-disabled`. Si se ve apagado pero
explica qué falta al tocarlo, apuntarlo a un `role="status"`. Botones con texto
partido (`"Entrada $40.000 Editar"`) llevan `aria-label`.

---

## 8. ESTÉTICA — EL ESTILO DEL LOGIN

> **La v5.0 mandaba el sistema neo-brutalista** (bordes `border-2 border-black`,
> sombras `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`, `font-black uppercase`) y
> **prohibía** `rounded-lg` y `shadow-sm`. **Eso quedó en el pasado.** La app se
> rediseñó módulo por módulo durante 2026. Lo neo-brutalista que quede es
> **legacy pendiente de migrar**: no copiarlo en código nuevo.

### La referencia: `pages/auth/PantallaAutenticacion.tsx`
```
input:     w-full px-4 py-3.5 rounded-xl outline-none
           text-black font-medium placeholder-slate-400
label:     block text-[13px] font-semibold text-slate-700 mb-1.5
botón 1°:  w-full py-4 bg-black text-white font-semibold rounded-full
           hover:bg-neutral-800 active:scale-[0.99]
botón 2°:  bg-slate-100 text-black font-semibold rounded-full
```
Lo distintivo: **botones píldora**, campos `rounded-xl`, negro puro como
primario, gris casi blanco como secundario, `font-semibold`, mucho aire.

### Tokens generales (fuente: `pages/home/Home.tsx`)
```
Fondo de página:  bg-slate-50 dark:bg-zinc-950
Tarjetas:         bg-white dark:bg-zinc-900
                  border border-slate-200 dark:border-zinc-800
                  rounded-2xl shadow-sm hover:shadow-lg
Botón primario:   bg-slate-900 dark:bg-white text-white dark:text-slate-900
                  font-semibold active:scale-[0.98]
                  focus-visible:ring-4 focus-visible:ring-slate-900/20
Inputs:           rounded-xl border border-slate-200 dark:border-zinc-800
                  focus:ring-4 focus:ring-slate-900/10
```

### Reglas
- **Tipografía:** `font-semibold` para casi todo; `font-bold` para títulos y
  números grandes. **`font-black` solo en el `<h1>` de página**, si acaso.
- **Dark mode:** en oscuro, la familia de grises es **`zinc`**, no `slate`.
- **Breakpoint mobile/desktop: `lg`**, no `md`. Usar `md` rompe las tablets.
- **Separar mobile de desktop con CSS** (`lg:hidden`), no detectando el ancho
  con JavaScript: con JS hay parpadeos y casos de resize.
- **Mobile:** en iOS, alto completo con `100dvh` (`100vh` cuenta la barra del
  navegador). En tablas anchas, versión en tarjetas para mobile.
- **Fuente:** Proxima Nova, cargada globalmente — no cambiar.

### Variantes por contexto
| Contexto | Estilo |
|---|---|
| Páginas públicas y de usuario | Login + tokens de `Home.tsx` |
| Paneles de administración | "Admin GCX Soft": `AdminGCXLayout.tsx` + `AdminDiaNino.tsx` como referencia (`rounded-lg`, `border-slate-200`, `shadow-sm`) |
| Panel admin de GCX dentro de `Grupos.tsx` | Solo modo claro, por decisión |
| Heroes (`/`, `/gcx`, `/ninez`) | `CarruselHero` con `theme="soft"` |
| Trivia en vivo | "Electric Communion" (sección 20) |

### Colores funcionales — no se tocan al rediseñar
Un color que **codifica información** se conserva; lo que se suaviza es el
tratamiento (bordes, sombras), no el color. Ejemplos:
- Colores por tribu (Influos) y por etapa (`STAGE_CONFIG` de Bienvenida)
- Estados: verde aprobado / ámbar pendiente / rojo rechazado / gris finalizado
- `fill` y `stroke` de las series de `recharts`
- Ámbar = editar, rojo = eliminar
- Rosa = parejas

### Color de identidad por módulo
| Módulo | Color |
|---|---|
| Grupos (GCX) | `#28a946` y esmeralda |
| Coordinadores | esmeralda |
| Bienvenida | emerald-500 |
| Influos | violeta |
| Reportes | ámbar |
| Alabanza | rosa |

### Detectar neo-brutalismo que quedó
```bash
grep -cE "border-[2-9] border-black|shadow-\[[0-9]+px_[0-9]+px_0px_0px_rgba\(0,0,0" archivo.tsx
grep -c "font-black" archivo.tsx
```
El patrón tiene que incluir **variantes direccionales** (`border-b-4`,
`border-t-2`) y **alfas distintos de 1** (`rgba(0,0,0,0.5)`). Si un patrón es
prefijo de otro, reemplazar del más largo al más corto. Hay archivos con
fin de línea **CRLF**: los patrones multilínea necesitan `\r?\n`.

---

## 9. SKILLS DISPONIBLES — CUÁNDO USAR CADA UNA

Antes de crear cualquier componente visual complejo o archivo especial,
verificar si alguna skill aplica. Las skills codifican las mejores prácticas
para cada tipo de entrega y **deben leerse antes de escribir código**.

### Mapa de skills → contexto de uso

| Skill | Leer cuando... |
|---|---|
| `frontend-design` | Se pide crear o mejorar cualquier componente UI, página, landing, dashboard o flujo visual. Esta es la skill más relevante para Origen App — guía la estética, tipografía, animaciones y calidad de producción. |
| `pdf` | Se necesita generar, combinar, dividir, rellenar o extraer contenido de archivos `.pdf`. |
| `pdf-reading` | Se sube un `.pdf` y hay que leer, extraer texto o tablas de él. |
| `docx` | Se pide crear o editar un documento Word (`.docx`), reporte, memo o plantilla. |
| `xlsx` | Se trabaja con planillas `.xlsx`, `.csv`, datos tabulares o modelos financieros. |
| `pptx` | Se pide crear o editar una presentación (`.pptx`), slide deck o informe visual. |
| `file-reading` | Se sube cualquier archivo cuyo contenido no está visible en el contexto. Es el router que indica cómo leer cada tipo. |
| `product-self-knowledge` | Se pregunta sobre capacidades de Claude, la API de Anthropic, precios, modelos o SDKs. |

### Cómo aplicarlas

```
1. El usuario hace una solicitud.
2. Identificar si alguna skill del mapa aplica.
3. Leer el SKILL.md correspondiente ANTES de escribir código.
4. Ejecutar siguiendo las instrucciones de la skill.
```

**Para este proyecto, `frontend-design` aplica en la mayoría de los casos.**
Leerla antes de crear cualquier componente nuevo, página o rediseño de UI.
### Diseños de Claude Design
Los diseños se hacen en Claude Design y se exportan a `design-claude/` como
`*.dc.html` (HTML plano, se lee directo). Al implementar uno, ver sección 36.

---

## 10. EDGE FUNCTIONS (Supabase / Deno)

Las Edge Functions viven en `supabase/functions/`. Todas usan Deno + TypeScript.

| Función | Propósito |
|---|---|
| `email-notifier` | Central de emails (Resend). Recibe webhooks de triggers SQL. |
| `welcome-reminder` | Cron job semanal (pg_cron, lunes 10am UTC). Busca `welcome_visitors` con `stage='NEW'` y `form_reminder_count < 3`. Envía recordatorios a bienvenida@origeniglesia.org |
| `send-group-confirmation` | Email de confirmación de inscripción a grupos |
| `send-gcx-welcome` | Email de bienvenida al módulo GCX |
| `send-whatsapp` | Envío de mensajes por WhatsApp Business API |
| `generate-image` | Generación de imágenes con Google Imagen (Gemini) |
| `admin-manage-user` | Gestión administrativa de usuarios vía service role |
| `prode-sync-results` | Sincronización automática de resultados del Mundial con worldcup26.ir. Cron cada 5 min. Calcula puntos automáticamente. |
| `send-dianino-tickets` | Email con los QR del Día del Niño. **Sin verificación de la clave: cualquiera puede invocarla.** |
| `send-nocturna-entrada` | Email con la entrada de Nocturna. La dispara `trigger_nocturna_entrada` y la RPC `reenviar_nocturna_email`. Acepta **sólo** la clave de servicio. |

> ⚠️ **El límite de Resend es de 100 emails por día.** No es teórico: un día de
> muchas inscripciones se alcanza. Cualquier función que mande emails en lote
> tiene que registrar qué salió y qué no, y dejar reenviar. `nocturna_inscripciones`
> lo hace con `email_enviado_at`, `email_error` y `email_intentos`.

**Autenticación de las funciones que disparan triggers.** `verify_jwt` NO
alcanza: la clave `anon` también es un JWT válido y viaja en el bundle del
frontend, así que con `verify_jwt = true` cualquiera que abra la app puede
llamar a la función. Hay que comparar el bearer contra la clave de servicio
adentro de la función, como hace `send-nocturna-entrada`.

**Variables de entorno requeridas en las Edge Functions:**
- `RESEND_API_KEY` — Proveedor de emails
- `SUPABASE_URL` — URL del proyecto
- `ORIGEN_SERVICE_ROLE_KEY` — Service role para operaciones admin
- `GOOGLE_IMAGEN_KEY` — API Key de Google para generación de imágenes
- `WC2026_API_EMAIL` — Credencial API worldcup26.ir
- `WC2026_API_PASSWORD` — Credencial API worldcup26.ir

**Nunca hardcodear estas keys. Siempre usar `Deno.env.get('...')`.**

**Reglas que salieron de construir `send-nocturna-entrada` (aplicar a toda
función nueva):**
- El trigger manda **solo el id**, nunca `row_to_json(NEW)`: `pg_net` guarda el
  cuerpo de cada pedido en `net._http_request_queue` y `net._http_response`.
  Con la fila entera, DNI y emails quedan escritos ahí.
- `timeout_milliseconds := 20000` en el `net.http_post` si la función hace
  algo pesado (generar un QR y esperar a Resend no entra en los 5000 por
  defecto).
- La clave para invocar va en Vault (`webhook_service_role_key`), no en
  `current_setting()`.
- Un archivo que se importa en `index.ts` y llama a `serve()` no se puede
  probar: separar la lógica en un módulo aparte (`armado.ts`).

**URL del proyecto hardcodeada:** los triggers de webhook y los cron jobs
tienen escrita la URL `https://oqtumgalnozppqnnjjdb.supabase.co/functions/v1/...`
(Día del Niño, Nocturna, GCX, `welcome-reminder`, `prode-sync-results`), y
también `pages/prode/AdminProde.tsx`. Si el proyecto cambiara de **ref**, hay
que reescribirlas todas. Una **transferencia** de proyecto entre
organizaciones conserva el ref y no las afecta.

**Estado conocido:**
- `prode-sync-results` falla cada 5 minutos con `API login failed: 404`
  (visto en `net._http_response`). Revisar las credenciales de worldcup26.ir.

---

## 11. BASE DE DATOS — TABLAS PRINCIPALES

**Proyecto Supabase:** ref `oqtumgalnozppqnnjjdb`. Hay una transferencia
planificada a una organización oficial de la iglesia; una transferencia
conserva el ref. Confirmar el ref vigente antes de usar el MCP.

### Global y GCX
| Tabla | Descripción |
|---|---|
| `users` | Perfil. `role` (enum singular) + `roles` (`text[]`) — sección 6 |
| `groups` | Grupos de conexión — ver columnas abajo |
| `group_registrations` | Inscripciones. `status` en **MAYÚSCULAS** (`APPROVED`, `PENDING`, `REJECTED`) |
| `group_categories`, `group_tags` | Categorías (11 en uso) y etiquetas |
| `group_attendance` | `date DATE`, `present_members JSONB`, `meeting_mode` (sección 19) |
| `group_dropout_requests` | Solicitudes de baja (el nombre **no** es `dropout_requests`) |
| `group_transfer_requests` | Transferencia de titularidad entre anfitriones |
| `welcome_visitors` | Ingresantes de Bienvenida |
| `service_statistics` | Audiencia de Servicios — sección 33 |
| `app_events`, `announcements` | Punto de Información |
| `notifications` | Notificaciones in-app |
| `audit_logs` | Auditoría |
| `app_version` | Una fila con la versión publicada (sección 27) |

### Eventos
| Tabla | Descripción |
|---|---|
| `dianino_sessions`, `dianino_tickets` | Día del Niño — sección 28 |
| `influos_attendees` | Asistentes de Influos (**menores**) |
| `influos_dia_registrations` | Tribal Wars. `comprobante_url` apunta al bucket público `images` (ver sección 38) |
| `eventos_general` | Eventos generales del listado público |
| `nocturna_config` | Una fila: edición, precio, inscripciones abiertas. Única de Nocturna que lee el público |
| `nocturna_inscripciones` | Una por familia. El `id` es lo que codifica el QR. **Datos de menores** |
| `nocturna_jovenes` | Un chico por fila, con su retiro. La edad se calcula, no se guarda |

### Contenido y banners
| Tabla | Descripción |
|---|---|
| `ninez_banner_slides` | Banner de `/ninez` |
| `home_musica_banner_slides` | Banner "Origen Música" de la Home. `target_url` nunca se muestra |
| `punto_info_banner_slides` | Banner de `/punto-de-informacion` |

### Prode y Trivia
Ver secciones 18 y 20 (`prode_*`, `trivia_*`).

### Columnas y comportamientos que hay que conocer
- **`groups.status` va en minúsculas** (`approved`, `pending`, `rejected`) y
  `group_registrations.status` en mayúsculas. Comparar con `upper()` o
  conociendo la tabla.
- **`groups_status_check` no acepta `'finished'`.** Un grupo "finalizado" se
  deriva de `end_date`, no del status. Ver sección 19 (re-apertura).
- `groups.is_online`, `groups.is_hybrid` (con un `CHECK` que impide las dos a
  la vez), `capacity_locked`, `is_hidden`, `co_host_id`, `parent_group_id`.
- **3 grupos tenían `co_host_id = host_id`** (el anfitrión como su propio
  co-anfitrión). Los reportes los excluyen. Es un dato sucio en origen.
- `group_registrations.transfer_from_group_id` — la inscripción es una
  derivación desde ese grupo (sección 22).
- **`group_attendance.present_members` guarda ids de inscripción, y la pareja
  va con el sufijo `-partner`.** Sin contemplarlo, toda pareja figura como que
  nunca asistió.
- **`groups.members_count` lo mantiene el trigger `trg_update_members_count`**
  (`COUNT(*) WHERE status='APPROVED'`). Es la fuente de verdad. **No sumar ni
  restar a mano**: `manage_group_registration_v3` lo hacía y dejaba 52 de 82
  grupos con el número mal.
- `users.coordinator_variants` (`text[]`) convive con el legacy singular.

### Storage
| Bucket | Visibilidad | Uso |
|---|---|---|
| `images` | **Público** | Portadas, banners, avatares. Nunca datos sensibles |
| `nocturna-comprobantes` | **Privado** | Comprobantes de Nocturna. 5 MB, solo imágenes. Lectura con URL firmada |

**Todas las tablas tienen RLS habilitado.** Ver sección 12 antes de crear una.

---

## 12. SEGURIDAD — REGLAS OBLIGATORIAS

> Salen de una auditoría real (septiembre de 2026) que encontró: una forma de
> que **cualquiera sin sesión se diera `SUPER_ADMIN`**, funciones para borrar
> usuarios y grupos sin ningún chequeo, cuatro versiones de
> `manage_group_registration` que permitían aprobar cualquier inscripción sin
> sesión, y **dos fugas de datos personales** (`group_registrations` con 572
> personas legibles sin sesión, e `influos_attendees`).

### En PL/pgSQL
1. **`IF NULL THEN` vale falso y saltea el `RAISE`.** Sin sesión, `auth.uid()`
   es `NULL`, y `IF caller_role != 'ADMIN' THEN RAISE ...` **no se dispara**.
   Usar siempre `IS DISTINCT FROM` / `IS NOT DISTINCT FROM`, y chequear
   `auth.uid() IS NULL` explícitamente.
2. **Toda función `SECURITY DEFINER` lleva `SET search_path = public`.**
3. **`CREATE OR REPLACE FUNCTION` vuelve a dar `EXECUTE` a `PUBLIC`**, y
   Supabase además se lo da a `anon` aparte. Después de crear o recrear:
   ```sql
   REVOKE EXECUTE ON FUNCTION public.fn(args) FROM PUBLIC;
   REVOKE EXECUTE ON FUNCTION public.fn(args) FROM anon;
   GRANT  EXECUTE ON FUNCTION public.fn(args) TO authenticated;
   ```
   Verificar con `has_function_privilege('anon', 'public.fn(args)', 'EXECUTE')`.
4. **Nunca confiar en el cliente:** precios, totales, edades, unicidad,
   permisos — se validan en la base. Un total enviado por el cliente se ignora.
5. **Las validaciones en un solo lugar.** Si el alta y la edición validan lo
   mismo, factorizar la validación en una función interna, no copiarla.

### RLS
6. **Ninguna policy `FOR SELECT TO anon` sobre tablas con datos personales.**
   El acceso público va por RPCs `SECURITY DEFINER` que devuelven lo mínimo.
7. **Las policies permisivas se combinan con OR.** Si hay dos y una tiene
   `USING (true)`, cerrar la otra no sirve: revisarlas todas. Una policy
   duplicada anuló en silencio un fix en `groups` (sección 24).
8. **`USING` dice qué filas se tocan; `WITH CHECK`, cómo pueden quedar.** Sin
   `WITH CHECK`, un usuario que puede editar su inscripción puede ponerse
   `status = 'APPROVED'` y auto-aprobarse.
9. **Cerrar una policy puede romper algo que la usaba.** Antes de restringir,
   buscar qué código lee o escribe esa tabla directo (no por RPC), y con qué
   rol. Si un panel queda vacío sin error, falta un rol en la policy.

### Edge Functions
10. **`verify_jwt` no alcanza**: la clave `anon` es un JWT válido y viaja en el
    bundle. Comparar el bearer contra la clave de servicio adentro de la
    función (como `send-nocturna-entrada`).

### Repositorio y datos
11. **El repo `sistemasorigen/origen-app-1` es público**, y `npm run deploy`
    hace **`git add -A`**: todo lo que esté en la carpeta se publica. Nunca
    dejar en la carpeta datos personales, exportaciones, comprobantes ni
    capturas de pantallas con datos reales. **Ojo con `design-claude/uploads/`**:
    lo que se pega en Claude Design se guarda ahí y se publica en el próximo
    deploy.
12. El `.gitignore` excluye `test_*.js` pero **no** `.cjs` ni `.mjs`, ni
    `*.backup_*`, ni `design-claude/uploads/` (ver sección 38).
13. **Nunca** commitear `.env` ni claves. Usar `import.meta.env.VITE_*` en el
    frontend y `Deno.env.get()` en las funciones.
14. **No escribir datos personales reales en este archivo** (emails, teléfonos,
    DNI): el archivo es público.
15. `SUPER_ADMIN` es el único que asigna roles privilegiados, y lo hace por RPC
    (el trigger `proteger_columnas_de_rol` bloquea hacerlo desde el cliente).
16. El caché de `localStorage` nunca decide acceso: solo sirve para render
    optimista.

### Cómo probar seguridad
- **Ataques simulados reales** dentro de `BEGIN ... ROLLBACK`, no solo leer el
  código: `SET LOCAL role = 'anon'`, y para un usuario,
  `set_config('request.jwt.claims', ...)` + `SET LOCAL role = 'authenticated'`.
- Probar **con la clave anon**, que es el ataque realista.
- Probar con un usuario **autenticado sin el rol**, no solo sin sesión.
- Para crear usuarios de prueba: insertar en `auth.users` dispara
  `handle_new_user`, que crea la fila en `public.users` con `{VIEWER}`. Usar
  `ON CONFLICT DO UPDATE` para asignarle el rol de la prueba.

---

## 13. TYPESCRIPT — REGLAS ESTRICTAS

- **Prohibido usar `any`** salvo en callbacks de librerías externas donde no hay alternativa
- Todas las interfaces globales van en `types.ts`
- Interfaces locales a un solo archivo se declaran al inicio de ese archivo
- Usar `unknown` + type narrowing en lugar de `any` para errores:
  ```typescript
  } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
  }
  ```
- Los enums de roles usan siempre `UserRole.NOMBRE` — nunca strings directos

---

## 14. FLUJO DE TRABAJO — MODOS DE OPERACIÓN

La IA opera en dos modos. El usuario elige cuál usar.

### 🗺 MODO PLAN (análisis y arquitectura)
Activado cuando el usuario describe una funcionalidad nueva o pide análisis.

La IA debe:
1. **Leer** los archivos relevantes antes de responder
2. **Analizar** el estado actual del código
3. **Proponer** el plan técnico: qué archivos tocar, qué crear, qué patrón usar
4. **Justificar** las decisiones arquitectónicas

⛔ **STOP:** En Modo Plan la IA NO escribe código de implementación.
Debe esperar la confirmación explícita del usuario para avanzar.

### 🔨 MODO BUILD (implementación)
Activado cuando el usuario aprueba el plan o pide implementación directa.

La IA debe:
1. Leer los archivos exactos que va a modificar
2. Aplicar los cambios quirúrgicamente con `str_replace`
3. No tocar código fuera del alcance definido
4. Confirmar qué cambios se aplicaron

---

## 15. REGLAS DE ORO — CHECKLIST ANTES DE EJECUTAR

- [ ] ¿Leí `instrucciones_ia.md` completo?
- [ ] ¿Leí todos los archivos que voy a modificar, en su estado actual?
- [ ] ¿Usé rutas relativas (`../../`) en los imports?
- [ ] ¿Leí la skill correspondiente (`frontend-design` para UI)?
- [ ] ¿El estilo es el del login (sección 8), no el neo-brutalista?
- [ ] ¿Respeté los colores funcionales?
- [ ] ¿Usé `NeoModal` para modales y `ContextoToast` para toasts?
- [ ] ¿Evité `any` en TypeScript?
- [ ] ¿Los campos nuevos tienen su columna SQL + tipo en `types.ts` + mapeo
      de lectura **y** de escritura en el servicio?
- [ ] ¿La ruta nueva tiene guard en `App.tsx`, y está después de las literales?
- [ ] ¿Las funciones SQL nuevas son NULL-safe, con `search_path` y permisos
      revocados (sección 12)?
- [ ] ¿Los links que se comparten llevan `/#/`?
- [ ] ¿Un fallo de consulta se distingue de un dato vacío?
- [ ] ¿Preservé los ids que usan los tutoriales?
- [ ] ¿No hardcodeé ninguna clave?
- [ ] ¿En zona pública usé `currentUser?.role`?
- [ ] ¿Dejé producción limpia y sin datos de prueba (sección 37)?

---

## 16. COMENTARIOS EN CÓDIGO

Comentar **solo el "por qué"** de lógicas no obvias. Nunca comentar lo que
el código ya dice por sí mismo.

```typescript
// ✅ Útil: explica una decisión no obvia
// CRÍTICO: window.open ANTES del await.
// Safari iOS bloquea window.open después de cualquier await
// porque lo considera un popup no iniciado por el usuario.
window.open(url, '_blank');
await supabase.from('welcome_visitors').insert({...});

// ❌ Inútil: repite lo que el código ya dice
// Incrementar el contador
counter++;
```

---

## 17. ARQUITECTURA DE ACCESO PÚBLICO

### Contexto
`Home (/)` y `Grupos (/gcx)` son páginas híbridas: accesibles sin autenticación
pero con funcionalidad extendida para usuarios con sesión.

### Comportamiento por estado de sesión

| Elemento | Sin sesión | Con sesión |
|---|---|---|
| Home — cards de módulos | Muestra contenido general | Solo los permitidos por rol |
| Grupos — grilla | Visible completa | Visible completa |
| Grupos — botón UNIRME | Redirige a `/auth` con `state.from` | Abre modal de inscripción |
| Grupos — tab Admin | Oculto | Visible si tiene rol GCX |
| Layout — header | Botones "Ingresar" / "Registrarse" | Avatar + campana notificaciones |
| MenuDeslizable — footer | Botón "Iniciar Sesión" → `/auth` | Botón "Cerrar Sesión" |
| Menú — items con roles | Ocultos | Visibles según rol |
| Menú — Inicio, GCX, Tutoriales | Visibles (roles: `[]`) | Visibles |

### RLS de Supabase para acceso público

> ⚠️ **Actualizado tras la auditoría de seguridad (2026-09).** La versión
> anterior de esta sección decía que `group_registrations` tenía `SELECT`
> abierto a `anon`. **Ya no es así, y no hay que volver a abrirlo**: esa
> policy fue una de las dos fugas reales del proyecto (la otra fue
> `influos_attendees`). Un agente que lea lo viejo puede tomarlo como permiso
> vigente y reabrirla.

Tablas con `SELECT` abierto al rol `anon`:
- `groups` — solo `status = 'approved'` y `is_hidden IS NOT TRUE`
- `group_categories` — sin restricciones adicionales
- `group_tags` — sin restricciones adicionales
- `nocturna_config` — solo precio y si las inscripciones están abiertas; a
  propósito no guarda nada sensible

Tablas donde `anon` **escribe pero no lee**:
- `group_registrations` — `anon` tiene únicamente `INSERT` (la inscripción
  pública). El `SELECT` es para `authenticated` y además autorizado: la
  propia persona, su pareja, el anfitrión o co-anfitrión del grupo, o staff.

**Datos de menores — ninguna policy para `anon`, ni de lectura:**
- `nocturna_inscripciones`, `nocturna_jovenes` — todo el acceso público pasa
  por RPCs `SECURITY DEFINER` acotadas. Ver `sql/create_nocturna.sql`.
- `influos_attendees`, `dianino_sessions`, `dianino_tickets` — mismo criterio.

**Comprobantes de pago:** van a buckets **privados** y se leen con URL
firmada. El bucket `images` es **público** — no sirve para esto.

Política de ejemplo:
```sql
CREATE POLICY "groups_public_select"
    ON public.groups FOR SELECT
    TO anon, authenticated
    USING (status = 'approved');
```

### Regla de código
En componentes con `currentUser` nullable, NUNCA usar:
```typescript
currentUser.role          // ❌ crashea si null
hasRole(currentUser, [...])  // ❌ sin guard previo
```
Siempre usar:
```typescript
currentUser?.role                          // ✅
currentUser ? hasRole(currentUser, [...]) : false  // ✅
```

---

## 18. MÓDULO PRODE MUNDIAL 2026

### Acceso
Ruta raíz `/prode` y sub-rutas. Protegido para
usuarios con `gender === 'Masculino'`. La restricción
de género se aplica internamente en cada página
(no en App.tsx). Usuarios Femenino o sin género
ven una pantalla de acceso restringido.

### Estructura de páginas
| Ruta | Componente | Descripción |
|---|---|---|
| `/prode` | `pages/prode/Prode.tsx` | Landing con banner, CTAs y formulario de predicciones |
| `/prode/ranking` | `pages/prode/ProdeRanking.tsx` | Ranking global con medallas top 3 |
| `/prode/resultados` | `pages/prode/ProdeResultados.tsx` | Resultados publicados + historial de predicciones del usuario |
| `/prode/administracion` | `pages/prode/AdminProde.tsx` | Panel admin: Config, Partidos, Resultados, Ranking, Predicciones |

### Sistema de puntuación (configurable desde admin)
| Resultado | Puntos default |
|---|---|
| Marcador exacto | 6 |
| Ganador o empate acertado | 3 |
| Goles de alguno acertados | 1 |
| Sin acierto | 0 |

Los valores se guardan en `app_config.prodeConfig` y
se leen en runtime — NO están hardcodeados.

### Selector de banderas
Los equipos usan códigos ISO alpha-2 (ej: `'ar'`, `'es'`)
renderizados como `<img src="https://flagcdn.com/[iso].svg">`.
NO usar emojis de bandera — no renderizan en todos
los dispositivos. Escocia: `gb-sct`, Inglaterra: `gb-eng`.
La constante `WORLD_CUP_2026_TEAMS` en `AdminProde.tsx`
contiene los 48 equipos con sus códigos ISO.

### Sync automático de resultados
Edge Function `prode-sync-results` conecta con
`https://worldcup26.ir`. La API devuelve:
- `finished` como STRING `"TRUE"`/`"FALSE"` (no boolean)
- `time_elapsed` como `"finished"`/`"notstarted"`
- `home_score`/`away_score` como STRINGS

**CRÍTICO:** Siempre verificar `finished === 'TRUE'`
Y `time_elapsed === 'finished'` antes de procesar.
Nunca comparar con booleano `true`.

### Cálculo de puntos
La función `setProdeMatchResult` en supabaseService
usa sistema de **delta** para evitar duplicación:
calcula `(puntos nuevos) - (puntos anteriores)` y
suma/resta del total del participante. Permite
editar resultados sin corromper totales.

---

## 19. FEATURES GCX — EXTENSIONES 2026

### Transferencia de grupos
Un anfitrión puede transferir la titularidad de su
grupo a otro usuario con rol ANFITRION.

**Flujo:** Modal 3 pasos (buscar → datos → confirmar
escribiendo "Transferir") → crea registro en
`group_transfer_requests` con status=pending →
el destinatario ve el grupo en gris en su panel →
acepta o rechaza.

**Al aceptar:** `groups.host_id` cambia al nuevo
anfitrión, el original pierde el grupo de su lista.

Componente: `components/GCX/ModalTransferirGrupo.tsx`

### Re-apertura de grupos por temporada
El reopen ya NO sobreescribe el grupo original.
Crea un NUEVO grupo con nuevo UUID y el campo
`parent_group_id` apuntando al original.

⚠️ **Contradicción a resolver:** esta sección decía que el original pasa a
`status = 'finished'`, pero `groups_status_check` **no acepta** `'finished'`.
Verificar qué hace hoy `cloneGroupForNewSeason` con el original. Mientras
tanto, "finalizado" se deriva de `end_date`.

Al reabrir, el grupo nuevo **hereda** `is_online` e `is_hybrid` del original
(el clon copia del grupo en la base, no del formulario: los campos de
`PaginaReabrirGrupo` no se envían).

**Función:** `supabaseService.cloneGroupForNewSeason(
originalGroupId, newStartDate, newEndDate, isAdminView)`

### Configuración de temporadas
Las 3 temporadas (S1/S2/S3) son configurables desde
el panel admin de Grupos (tab CONFIG → sección
"Configuración de Temporadas"). Se guardan en
`app_config.groupsConfig.seasonSettings`.

Estructura en `types.ts`: `SeasonSettings`, `SeasonConfig`,
`DEFAULT_SEASON_SETTINGS`.

### Calendario GCX
Ruta: `/gcx/calendario` — Componente: `pages/gcx/CalendarioGCX.tsx`

Muestra calendarios semanales separados por rol:
- "Calendario de Anfitrión" (grupos donde es host/co-host)
- "Calendario de Participante" (grupos donde está inscripto)

Cada grupo aparece en el día de la semana según
`meeting_day` del grupo, durante toda la temporada
(`startDate` → `endDate`).

Permite agregar grupos a Google Calendar (URL con
RRULE recurrente) o descargar `.ics` para Apple/Outlook.
El modal de selección permite elegir qué grupos agregar.

**Acceso mobile:** botón "Mis grupos anotados"
debajo del filtro de etiquetas en `/gcx`.

### Modalidad: presencial, online o híbrido
- `groups.is_online` y `groups.is_hybrid` (un `CHECK` impide las dos a la vez).
  Lógica en `src/utils/modalidad.ts`.
- **Presencial:** con dirección. **Online:** sin dirección (`location` vacío).
  **Híbrido:** con dirección, y a veces online; al tomar asistencia el
  anfitrión elige cómo fue **esa** reunión (`group_attendance.meeting_mode`).
- `admin_update_group_v2` guarda `is_online` e `is_hybrid`. Hubo un defecto en
  el que editar desde el panel del anfitrión no guardaba la modalidad
  (`sql/fix_host_edit_group_v2.sql`). **Todo campo nuevo de `groups` tiene que
  pasar también por esa RPC**, o el panel lo pierde al editar.

### Funciones de 2026 en `/gcx` y `/mis-grupos`
- **Filtro de disponibilidad** en `/gcx`: varios días + franja (mañana antes de
  las 12, tarde de 12 a 18, noche desde las 18). Días con O entre sí, días y
  franjas con Y.
- **Agregar al calendario** desde la tarjeta, para miembros aprobados, con
  `src/utils/calendario.ts`. ⚠️ El Calendario GCX (`/gcx/calendario`) tiene su
  **propio** generador de `.ics`: son dos implementaciones del mismo formato.
- **Baja directa** de un miembro por el anfitrión (sección 22).
- **Derivar** a un miembro a otro grupo (sección 22).
- **Historial de grupos** en `/perfil` (`getMiHistorialDeGrupos`).
- **Postulación a anfitrión** como franja arriba del catálogo, sin botón
  flotante.

---

## 20. TRIVIA ORIGEN (clon de Kahoot)

### Acceso y rutas

Públicas, sin guard de roles (comentario en el código:
`{/* Kahoot Origen — rutas públicas de jugadores y proyector */}`):

| Ruta | Componente | Uso |
|---|---|---|
| `/trivia` | `TriviaLanding` | Landing: input de PIN de 6 dígitos |
| `/trivia/unirse/:pin` | `TriviaUnirse` | Registro de nickname + avatar emoji |
| `/trivia/jugar/:pin` | `TriviaJugador` | Vista del jugador en el celular |
| `/trivia/pantalla/:pin` | `TriviaProyector` | Pantalla/proyector para TV (QR, preguntas, podio) |

Protegidas — todas con el mismo guard
`[SUPER_ADMIN, PASTOR, ENCARGADO_EVENTOS]`:

| Ruta | Componente | Uso |
|---|---|---|
| `/trivia/admin` | `AdminTrivia` | Listado de plantillas, crear sala, eliminar |
| `/trivia/admin/nuevo` | `CrearJuego` | Editor de preguntas/opciones/tiempo/imagen |
| `/trivia/admin/:id` | `TriviaControl` | Control en vivo (iniciar, avanzar, pausar, saltar) |
| `/trivia/historial` | `TriviaHistorial` | Listado histórico de partidas jugadas |
| `/trivia/historial/:id` | `TriviaPlanilla` | Detalle/edición manual de una partida finalizada |

### Tablas de Supabase (6 tablas `trivia_*`)

| Tabla | Columnas clave |
|---|---|
| `trivia_juegos` | `pin`, `estado` (default `'esperando'`), `pregunta_actual_idx` (default `-1`), `timer_pausado` (bool), `started_at`, `finished_at`, `is_template` (bool) |
| `trivia_preguntas` | `juego_id`, `orden`, `texto`, `imagen_url`, `tiempo_limite` (default `20`), `es_doble_puntos` (bool) |
| `trivia_opciones` | `pregunta_id`, `texto`, `es_correcta` (bool), `color`, `orden` |
| `trivia_jugadores` | `juego_id`, `nickname`, `avatar_emoji`, `puntaje_total`, `racha_actual`, `max_racha` |
| `trivia_respuestas` | `jugador_id`, `pregunta_id`, `opcion_id`, `tiempo_respuesta_ms`, `puntos_ganados`, `es_correcta` |
| `trivia_estado_pregunta` | `juego_id`, `pregunta_id`, `estado`, `total_respuestas` |

Enums en `types.ts`:
```typescript
export type TriviaColor = 'rojo' | 'azul' | 'amarillo' | 'verde' | 'naranja' | 'violeta';
export type TriviaEstadoJuego = 'esperando' | 'en_curso' | 'entre_preguntas' | 'finalizando' | 'finalizado';
export type TriviaEstadoPregunta = 'esperando' | 'abierta' | 'cerrada' | 'revelada';
```

// TODO: confirmar políticas RLS de las tablas `trivia_*`
(no se auditaron en este pase, solo `information_schema.columns`).
No existe un `.sql` de migración versionado en `sql/` para estas
tablas — el schema real solo se pudo confirmar contra la DB viva.

### Funciones en `supabaseService.ts` (bloque `// TRIVIA ORIGEN`)

`crearTriviaJuego`, `getTriviaJuegos`, `getTriviaJuego`,
`getTriviaJuegoPorPin`, `guardarTriviaPreguntas`,
`eliminarTriviaPreguntas`, `subirImagenTrivia`, `unirseTrivia`,
`getTriviaRanking`, `responderTrivia`, `avanzarTriviaJuego`,
`setTriviaPreguntaEstado`, `setTriviaTimerPausado`,
`saltarSiguientePregunta`, `clonarTriviaJuego`,
`reiniciarTriviaJuego` (alias de `clonarTriviaJuego`),
`getTriviaRespuestaJugador`, `eliminarTriviaJuego`,
`renombrarTriviaJuego`, `editarTriviaJugador`,
`eliminarTriviaJugador`.

### Sincronización de cronómetro — patrón híbrido

**NO** es un `setInterval` puramente local. La cuenta regresiva
inicial (3-2-1 antes de cada pregunta) se resincroniza contra un
timestamp absoluto del servidor (`started_at`), comparado con
`Date.now()`, para que un cliente que se conecta tarde o refresca
la página calcule cuántos segundos ya pasaron en vez de arrancar
siempre desde 3:

```typescript
// TriviaJugador.tsx / TriviaProyector.tsx (patrón idéntico)
const DURACION_MS = 3000;
const elapsed = startedAtIso
    ? Math.max(0, Date.now() - new Date(startedAtIso).getTime())
    : 0;
if (elapsed >= DURACION_MS) { cargarPregunta(juegoData, idx); return; }
const remainingMs = DURACION_MS - elapsed;
```

**Por qué:** evita el desfase típico entre dispositivos con
`setInterval` sin ancla — dos celulares que se conectan en
momentos distintos igual convergen en el mismo instante real de
inicio de pregunta. El tick visual del contador de cada pregunta
(los N segundos de `tiempoLimite`) sí usa un `setInterval` local
de 1000ms una vez ya sincronizado el arranque. El anti-trampa real
de puntaje no depende del display: se mide
`tiempoRespuestaMs = Date.now() - tiempoInicioPregunta` y se
valida server-side contra `tiempo_limite`.

### Estética "Electric Communion"

Fondo `#1A0A2E` (morado oscuro casi negro) + colores neón por
opción (`TRIVIA_COLORES` en `types.ts`: rojo `#FF3B5C`, azul
`#4B8BFF`, amarillo `#FFD700`, verde `#46D483`, naranja `#FF8C00`,
violeta `#9B59B6`, con íconos de forma `▲ ◆ ● ■ ★ ♥`). Usado
**exclusivamente** en las pantallas de juego en vivo (`TriviaLanding`,
`TriviaUnirse`, `TriviaJugador`, `TriviaProyector`) — el panel admin
(`AdminTrivia`, `CrearJuego`, `TriviaControl`, `TriviaHistorial`,
`TriviaPlanilla`) usa la estética estándar actual de la app (sección 8). No mezclar ambos sistemas visuales.

### Sistema de puntos

```typescript
// responderTrivia en supabaseService.ts
const tiempoRestante = Math.max(0, tiempoLimiteMs - tiempoRespuestaMs);
const ratio = tiempoRestante / tiempoLimiteMs;
let puntos = esCorrecta ? Math.max(50, Math.round(1000 * ratio)) : 0;
if (esDoble) puntos *= 2; // trivia_preguntas.es_doble_puntos
```

- Correcta: entre 50 (piso mínimo, respuesta justo al límite) y
  ~1000 (respuesta instantánea) puntos, lineal según velocidad.
- `es_doble_puntos` (flag por pregunta, editable en `CrearJuego.tsx`)
  multiplica `×2` el resultado.
- Racha (`racha_actual`/`max_racha`): se incrementa en respuesta
  correcta y se resetea a 0 en incorrecta — es **puramente
  informativa** (se muestra en UI con ícono `Flame`), NO multiplica
  puntos. A diferencia de Kahoot original, el único multiplicador
  de puntaje es el de "doble puntos" por pregunta.

---

## 21. ADMIN GCX (`/admingcx/*`)

### Migración desde `/gcx?tab=X`

Toda la administración de Grupos de Conexión vive hoy en páginas
propias bajo `/admingcx/*` (14 rutas planas, sin nesting real de
React Router). El menú principal (`components/layout/MenuDeslizable.tsx`)
ya apunta directo a las rutas nuevas. Para compatibilidad con links
viejos guardados (favoritos, mensajes de WhatsApp con
`/gcx?tab=GROUPS` etc.), `pages/groups/Grupos.tsx` mantiene un
redirect automático:

```typescript
// Grupos.tsx — redirect de links viejos: /gcx?tab=X ahora vive en /admingcx/*
const TAB_TO_ADMINGCX_ROUTE: Record<string, string> = {
    GROUPS: '/admingcx/gestion-de-grupos',
    HOSTS: '/admingcx/gestion-de-anfitriones',
    COORDINATORS: '/admingcx/gestion-de-coordinadores',
    CATEGORIES: '/admingcx/categorias',
    TAGS: '/admingcx/etiquetas',
    CONFIG: '/admingcx/configuracion',
    SEASONS: '/admingcx/temporadas',
};
```

### Páginas reales (`pages/admingcx/`)

Guard de roles `[SUPER_ADMIN, ADMIN_GROUPS, ENCARGADO_GRUPOS]` salvo
donde se indica:

| Ruta | Componente |
|---|---|
| `/admingcx/gestion-de-grupos` | `GestionDeGrupos` |
| `/admingcx/gestion-de-grupos/bajas` | `BajasGrupos` |
| `/admingcx/gestion-de-grupos/agregar-grupo` | `AgregarMiembroGrupo` |
| `/admingcx/gestion-de-grupos/crear-grupo` | `CrearGrupoAdmin` |
| `/admingcx/gestion-de-grupos/editar-grupo/:groupId` | `EditarGrupoAdmin` |
| `/admingcx/gestion-de-grupos/inscriptos/:groupId` | `InscriptosGrupo` |
| `/admingcx/gestion-de-grupos/detalles/:groupId` | `DetalleGrupoAdmin` |
| `/admingcx/gestion-de-anfitriones` | `GestionDeAnfitriones` |
| `/admingcx/gestion-de-coordinadores` | `GestionDeCoordinadores` — solo `[SUPER_ADMIN, ADMIN_GROUPS]` |
| `/admingcx/categorias` | `Categorias` — solo `[SUPER_ADMIN, ADMIN_GROUPS]` |
| `/admingcx/etiquetas` | `Etiquetas` — solo `[SUPER_ADMIN, ADMIN_GROUPS]` |
| `/admingcx/configuracion` | `Configuracion` — solo `[SUPER_ADMIN, ADMIN_GROUPS]` |
| `/admingcx/temporadas` | `Temporadas` — solo `[SUPER_ADMIN, ADMIN_GROUPS]` |

### Patrón obligatorio `Content` + `Layout`

Cada página se separa en un componente `XxxContent` (la lógica
real) envuelto por un componente `Xxx` que renderiza
`<AdminGCXLayout>`:

```typescript
const GestionDeAnfitrionesContent: React.FC = () => {
    const { showToast } = useAdminGCXToast();
    // ...lógica real, fetch, estado...
};

const GestionDeAnfitriones: React.FC = () => (
    <AdminGCXLayout title="Gestión de Anfitriones">
        <GestionDeAnfitrionesContent />
    </AdminGCXLayout>
);

export default GestionDeAnfitriones;
```

**Por qué:** `AdminGCXLayout` define y exporta el hook
`useAdminGCXToast`, que lee un `ToastContext.Provider` montado
DENTRO del propio `AdminGCXLayout` (por encima de `children` en el
árbol). Si `XxxContent` llamara a `useAdminGCXToast()` en el mismo
componente que recién monta `<AdminGCXLayout>`, el hook se
ejecutaría antes de que el Provider exista en el árbol y tira:
`Error: useAdminGCXToast debe usarse dentro de AdminGCXLayout`.
Separar en dos componentes garantiza que `Content` sea hijo, nunca
hermano, del Provider.

`AdminGCXLayout` acepta:
```typescript
interface AdminGCXLayoutProps {
    title: string;
    children: React.ReactNode;
    backTo?: string;   // default '/gcx'
    backLabel?: string; // default 'Volver a GCX'
}
```

**Ruta agregada:** `/admingcx/gestion-de-grupos/reabrir-grupo/:groupId`
(`ReabrirGrupoAdmin`), con el guard de los 3 roles.

**El panel de administración de GCX existe dos veces**: estas páginas de
`/admingcx/*`, y las sub-pestañas de `view === 'admin'` dentro de
`pages/groups/Grupos.tsx` (grupos, categorías, etiquetas, configuración,
anfitriones, coordinadores, temporadas). **Por decisión, se mantienen las dos
por ahora**; todo cambio funcional se aplica en ambas o una va a divergir.
`Grupos.tsx` mezcla el catálogo público con ese panel (~2900 líneas):
separarlo es la mejora pendiente más grande del módulo.

---

## 22. PANEL DE ANFITRIÓN (`/mis-grupos/*`)

### De acciones inline a páginas propias

"Mis Grupos" pasó de expandir acciones inline por card a un botón
único **"Ver Grupo"** que navega a `/mis-grupos/:groupId`
(`DetalleGrupoAnfitrion.tsx`: foto, descripción, planilla de
integrantes, botones de acción). Cada acción pesada tiene su propia
página — ya NO son modales:

| Ruta | Componente | Guard |
|---|---|---|
| `/mis-grupos` | `PanelAnfitrion.tsx` (`HostDashboard`) | `[SUPER_ADMIN, ADMIN_GROUPS, ANFITRION, CO_ANFITRION]` |
| `/mis-grupos/crear-grupo` | `PaginaCrearGrupo` | ídem |
| `/mis-grupos/:groupId` | `DetalleGrupoAnfitrion` | ídem |
| `/mis-grupos/:groupId/asistencia` | `PaginaAsistenciaGrupo` | ídem |
| `/mis-grupos/:groupId/bajas` | `PaginaBajaGrupo` | ídem |
| `/mis-grupos/:groupId/solicitudes` | `PaginaSolicitudesGrupo` | ídem |
| `/mis-grupos/:groupId/transferir` | `PaginaTransferirGrupo` | ídem |
| `/mis-grupos/:groupId/editar-grupo` | `PaginaEditarGrupo` | ídem |
| `/mis-grupos/:groupId/reabrir-grupo` | `PaginaReabrirGrupo` | ídem |
| `/mis-grupos/:groupId/inscribir` | `PaginaInscribirParticipante` | ídem |

### Patrón de fetch autónomo

Cada página trae sus propios datos con `getGroupsByHost` + búsqueda
por `groupId` de la URL, en vez de recibir `group` como prop:

```typescript
// Repetido literalmente en 7 de las 8 páginas de acción
// (DetalleGrupoAnfitrion, PaginaInscribirParticipante, PaginaSolicitudesGrupo,
//  PaginaAsistenciaGrupo, PaginaBajaGrupo, PaginaTransferirGrupo, PaginaEditarGrupo, PaginaReabrirGrupo)
const fetchGroup = useCallback(async () => {
    if (!currentUser || !groupId) return;
    const owned = await supabaseService.getGroupsByHost(currentUser.id);
    const found = owned.find(g => g.id === groupId);
    if (!found) { navigate('/mis-grupos', { replace: true }); return; }
    setGroup(found);
}, [currentUser, groupId, navigate]);
```

### Modales originales (`components/GCX/Modal*.tsx`) — estado real

Los 9 archivos de modal siguen existiendo en el repo; NO todos
están vivos:

| Modal | Estado |
|---|---|
| `ModalUnirseGrupo.tsx` | **Vivo** — inscripción pública desde `/gcx` (`Grupos.tsx`) |
| `ModalCrearGrupoAdmin.tsx` | **Vivo** — crear grupo desde el panel admin embebido en `/gcx` |
| `ModalAgregarMiembroAdmin.tsx` | **Vivo** — agregar miembro desde el panel admin embebido en `/gcx` |
| `ModalSolicitantes.tsx` | **Vivo en `Grupos.tsx`** (reenvío masivo de emails); huérfano en `PanelAnfitrion.tsx` (sin `onClick` que lo dispare) |
| `ModalCrearGrupo.tsx` | **Vivo**, doble uso: alta de grupo vía `?modal=createGroup` (link desde Tutoriales), y **reciclado con `isReopenRequest={true}`** como modal de re-apertura desde `Grupos.tsx`/`GestionDeGrupos.tsx` — no existe un `ModalReabrirGrupo.tsx` separado |
| `ModalAsistencia.tsx`, `ModalSolicitudBaja.tsx`, `ModalTransferirGrupo.tsx` | **Huérfanos** — siguen importados y con estado (`useState`) en `PanelAnfitrion.tsx`, pero ningún botón visible los dispara ya (reemplazados por `PaginaAsistenciaGrupo`, `PaginaBajaGrupo`, `PaginaTransferirGrupo`). Código muerto pendiente de limpieza, no removido en la migración. `ModalTransferirGrupo.tsx` tampoco se usa desde `/admingcx/gestion-de-grupos`. |
| `ModalCrearGrupo-IgnacioPC.tsx` | Archivo de desarrollo, no importado en ningún lado |

### Rutas agregadas
| Ruta | Componente |
|---|---|
| `/mis-grupos/:groupId/derivar` | `PaginaDerivarMiembro` |
| `/mis-grupos/:groupId/inscriptos` | `PaginaInscriptosGrupo` |

### Baja directa (sin aprobación)
- **Dar de baja a un miembro** es inmediato: `deleteGroupRegistration`, y
  **después**, solo si salió bien, se deja el registro histórico en
  `group_dropout_requests` con `status: 'APPROVED'`.
- **Cerrar el grupo entero** sigue siendo una solicitud `PENDING` que aprueba
  un administrador.
- Confirmación en dos pasos con el nombre de la persona. Es irreversible:
  `deleteGroupRegistration` borra la fila, no la marca.

### Derivar a un miembro a otro grupo
El anfitrión manda a un miembro a otro grupo; el anfitrión del destino lo
aprueba como cualquier inscripción. El miembro no participa desde la app.
- RPC **`derivar_miembro(p_registration_id, p_to_group_id)`**: valida permisos,
  duplicados (por `user_id` y por email), y copia los datos y la pareja. Va en
  la base porque con el RLS actual el anfitrión de origen no ve las
  inscripciones del destino: un chequeo desde el cliente daría siempre vacío.
- Crea una inscripción `PENDING` en el destino con `transfer_from_group_id`.
- **La baja del grupo de origen la hace `manage_group_registration_v3` al
  aprobar, en la misma transacción.** Si el destino rechaza, la persona sigue
  en su grupo. Si el grupo de origen ya no existe, la derivación se completa
  igual.
- En las solicitudes, un cartel: "Derivado desde [Grupo] — si aceptás, sale de
  ese grupo automáticamente".
- Se llama **"Derivar"** y no "transferir": transferir es pasar el grupo
  entero a otro anfitrión.

---

## 23. INSCRIPCIÓN DE PAREJAS (wizard)

### Cómo se determina si un grupo es "de parejas"

```typescript
// Mismo cálculo replicado en ModalUnirseGrupo.tsx y PaginaInscribirParticipante.tsx
const categoryName = (() => {
    if (!group.categoryId) return '';
    if (group.categoryId.toLowerCase() === 'parejas') return 'parejas';
    const cat = categories.find(c => c.id === group.categoryId);
    return cat?.name?.toLowerCase() || '';
})();
const hasParejasTag = group.tags?.some(tId => tags.find(t => t.id === tId)?.name?.toLowerCase() === 'parejas') || false;
const isCouplesGroup = (categoryName === 'parejas' || hasParejasTag) && group.targetGender === 'Mixto';
```

### Wizard de 2 preguntas

1. "¿Querés inscribir a tu pareja?" (Sí/No)
2. Si Sí: "¿Tu pareja tiene email?" (Sí/No)

### Pareja sin email

Si la pareja no tiene email, `partnerData` se guarda **sin la
clave `email`** (no como string vacío), para evitar que dos
inscripciones sin email hagan falso match entre sí:
```typescript
partnerData?: { firstName: string; lastName: string; email?: string; phone: string };
```

### Bloqueo de campos hasta confirmar email

Cuando la pareja tiene email, nombre/apellido/teléfono quedan
`disabled` hasta que el `onBlur` del campo email resuelva
`findUserByEmail(email)` — si encuentra cuenta, autocompleta y
muestra badge "Cuenta encontrada"; si no, desbloquea los campos
vacíos para carga manual.

### Duplicación deliberada

La misma lógica (wizard + bloqueo + `findUserByEmail`) está
**duplicada intencionalmente**, no compartida en un componente
único, en 3 superficies:
1. `components/GCX/ModalUnirseGrupo.tsx` — inscripción pública
2. `pages/groups/PaginaInscribirParticipante.tsx` — anfitrión inscribe a un tercero
3. `pages/groups/PaginaSolicitudesGrupo.tsx` / `pages/admingcx/InscriptosGrupo.tsx` — editar/agregar pareja post-inscripción (vía `supabaseService.updateRegistrationPartnerData`)

---

## 24. BLOQUEO DE CUPOS Y OCULTAR GRUPOS

### Columnas y RPCs

`groups.capacity_locked` y `groups.is_hidden` (ambas `boolean NOT
NULL DEFAULT false`). Cada una tiene su propio RPC `SECURITY
DEFINER` con el chequeo de rol adentro, en vez de reusar el RPC
general de edición `admin_update_group_v2` — **por qué:** evita
tocar un RPC delicado ya usado en muchos lugares, y permite un
chequeo de autorización más granular por acción.

```sql
-- toggle_group_capacity_lock(p_group_id text, p_locked boolean)
-- autoriza: host, co-host, O SUPER_ADMIN/ADMIN_GROUPS/ENCARGADO_GRUPOS

-- toggle_group_visibility(p_group_id text, p_hidden boolean)
-- autoriza SOLO: SUPER_ADMIN/ADMIN_GROUPS/ENCARGADO_GRUPOS (sin host/co-host)
```

Wrappers en `supabaseService.ts`: `toggleGroupCapacityLock(groupId,
locked)`, `toggleGroupVisibility(groupId, hidden)`.

### Roles

- **Bloquear cupos:** host, co-host (desde `PanelAnfitrion.tsx` /
  `DetalleGrupoAnfitrion.tsx`) O los 3 roles admin de grupos.
- **Ocultar grupo:** SOLO `SUPER_ADMIN`/`ADMIN_GROUPS`/`ENCARGADO_GRUPOS`
  — el botón únicamente existe en `ListaGruposAdmin.tsx`, no en el
  panel de anfitrión.

### Representación visual

Card pública (`TarjetaGrupo.tsx`): badge "LLENO" cuando
`capacityLocked || isFull` (no distingue visualmente bloqueo manual
de cupo numérico agotado). Grupo oculto: badge "OCULTO" (ícono
`EyeOff`) + `grayscale opacity-60`, visible solo si
`canSeeHidden` (los 3 roles admin).

### Enforcement real a nivel de base de datos

El filtro de `is_hidden` en `Grupos.tsx` (`if (g.isHidden &&
!canSeeHiddenGroups) return false;`) es una capa de UX, pero la
protección real vive en RLS de Postgres sobre la tabla `groups`.

**Historial del fix:** la tabla `groups` tenía 5 policies de SELECT
permisivas (se combinan entre sí con OR — si UNA sola permite el
acceso, alcanza). Dos de ellas no filtraban `is_hidden` en
absoluto, incluyendo un duplicado exacto (`groups_select_approved`)
que habría anulado en silencio cualquier fix aplicado a una sola
policy. Se consolidaron en una migración
(`fix_groups_rls_respect_is_hidden`):
- `groups_select_approved` (duplicado sin filtro) → ELIMINADA.
- `groups_public_select` → reescrita con
  `is_hidden IS NOT TRUE OR [rol admin]`.
- `Hosts and Co-Hosts can view their groups` → su rama
  `OR status='approved'` corregida con el mismo criterio.
- `groups_select_admin` y `groups_select_own` no necesitaron
  cambios (ya eran correctas).

**Roles con acceso a grupos ocultos vía RLS:** `SUPER_ADMIN`,
`ADMIN_GROUPS`, `ENCARGADO_GRUPOS` (chequeado contra `users.role`
con un `EXISTS` dentro de la policy — NO usar `'SUPERADMIN'`, ese
valor no existe en el enum `user_role` de Postgres y rompería la
migración).

**Nota aparte, sin resolver:** `groups_select_admin` y la policy de
Hosts/Co-Hosts también le dan a `PASTOR` visibilidad de todos los
grupos sin importar `status`/`is_hidden` — comportamiento
preexistente a este fix, no introducido por él. Queda pendiente
decidir si se acota en el futuro.

---

## 25. ROLES NUEVOS Y MULTI-ROL

### `ENCARGADO_EVENTOS` y Panel de Eventos

Nuevo respecto a v4.0: `UserRole.EVENTOS` y
`UserRole.ENCARGADO_EVENTOS`. Guardan `/panel-eventos`
(`pages/eventos/PanelEventos.tsx`), `/eventos/admin/diadelpadre`,
`/eventos/puntuacion`, `/eventos/futboltenis`, `/eventos/dpadre/:id`,
y las rutas de Trivia Admin (sección 20). La ruta base `/eventos`
no tiene guard de rol, solo requiere sesión.

### Coordinador multi-rol

`coordinatorVariant?: CoordinatorVariant` (singular, **@deprecated**,
comentario explícito en `types.ts`) convive con
`coordinatorVariants?: CoordinatorVariant[]` (plural, array — mismo
patrón que `role`/`roles[]`). En DB: `users.coordinator_variant`
(`text`) y `users.coordinator_variants` (`text[]`, `NOT NULL`).

**✅ Conectado (resuelto en código, pendiente de
verificación en navegador).** `Coordinadores.tsx`
ya filtra por `currentUser.coordinatorVariants`
(array, con fallback al campo legacy singular si
un usuario todavía no fue migrado en memoria):

```typescript
const coordinatorVariants = (currentUser.coordinatorVariants && currentUser.coordinatorVariants.length > 0)
    ? currentUser.coordinatorVariants
    : (currentUser.coordinatorVariant ? [currentUser.coordinatorVariant] : []);

const categoryFilters = Array.from(new Set(
    coordinatorVariants
        .map(v => coordinatorVariantToCategory(v))
        .filter((c): c is string => !!c)
));
```

Un coordinador con varios departamentos asignados
ve los grupos de TODAS sus categorías combinadas
en Dashboard, Grupos, Asistencia y Calendario
(filtro por `categoryId` O `categoryName` contra
CUALQUIERA de `categoryFilters`, no solo la
primera). El título del panel muestra las
categorías unidas con `" + "` (ej. "Biblia +
Finanzas"). `tsc --noEmit` sin errores nuevos.

`// TODO: confirmar` con prueba manual en
navegador (no se pudo levantar el dev server en la
sesión donde se aplicó este fix): coordinador con
una sola categoría sin regresión, coordinador con
varias viendo el combinado real, coordinador sin
categoría sigue viendo la alerta, SUPER_ADMIN sigue
sin filtro.

### Enum `user_role` de Postgres — requiere `ALTER TYPE` manual

Confirmado por comparación directa: `types.ts` define
`ADMIN_CUIDADO_PASTORAL` y `PRODE` en el enum TypeScript, pero
**ninguno de los dos existe todavía** en el enum `user_role` de
Postgres. Si algún código intentara escribir
`role = 'ADMIN_CUIDADO_PASTORAL'` o `'PRODE'` en la columna `role`
(tipo enum singular), la escritura fallaría en la DB (la columna
plural `roles`, al ser `text[]` sin enforcement de enum, no tiene
este problema). **Regla:** cada rol nuevo agregado a `UserRole` en
`types.ts` requiere correr manualmente
`ALTER TYPE user_role ADD VALUE 'NUEVO_ROL';` contra la base — no
es automático. Ver `sql/fix_user_role_enum_eventos.sql` como
ejemplo del patrón ya usado para `EVENTOS`/`ENCARGADO_EVENTOS`.

### `ENCARGADO_NINEZ` y `ACREDITACION`
- **`ENCARGADO_NINEZ`:** `/ninez`, `/admin-ninez/configuracion` y el Día del
  Niño. Helper SQL `is_ninez_staff()`.
- **`ACREDITACION`:** rol de la puerta. **Acceso completo** al Día del Niño y a
  Nocturna (incluye eliminar, precio y comprobantes), y entra a
  `/panel-eventos`. No ve nada más. Si en algún momento lo tienen voluntarios
  que solo escanean, conviene separar un helper `is_*_acreditador()` para
  escanear y acreditar.

---

## 26. LOGIN Y REDIRECTS SEGUROS PARA OAUTH

### El problema de fondo

El login con Google hace un redirect COMPLETO del navegador
(`supabase.auth.signInWithOAuth`), no una navegación SPA — por lo
que `location.state` de React Router se pierde. El login con
email/contraseña es 100% SPA, así que `location.state` sí
sobrevive.

### La solución de doble capa

```typescript
// App.tsx — handleLogin
const handleLogin = () => {
    sessionStorage.setItem('post_login_redirect', `${location.pathname}${location.search || ''}`);
    navigate('/auth', { state: { from: location } });
};

// App.tsx — useEffect que resuelve el redirect cuando `user` pasa a no-nulo
useEffect(() => {
    if (!user) return;
    const destino = sessionStorage.getItem('post_login_redirect');
    if (destino) {
        sessionStorage.removeItem('post_login_redirect');
        if (location.pathname === '/auth' || location.pathname === '/') navigate(destino);
    }
}, [user]);
```

`AuthContext.tsx` (`signInWithGoogle`) lee ese mismo
`post_login_redirect` para construir el `redirectTo` que le pasa a
Google. El caso email/contraseña usa `location.state.from`
directamente en `handleAuthScreenLogin` (`App.tsx`), sin depender
de `sessionStorage`.

### Regla de oro

Cualquier botón que redirija a `/auth` sin sesión DEBE usar este
mismo mecanismo de doble capa (`sessionStorage` + `state`), no
`navigate('/auth', { state })` solo — de lo contrario el regreso se
rompe específicamente para usuarios que eligen Google. Implementado
así hoy en `App.tsx:handleLogin` y en
`Grupos.tsx:redirectToLoginForGroup` (botón UNIRME).

**⚠️ Excepción conocida:** el guard automático de rutas protegidas
(`<Route path="*">` en `App.tsx`, para un usuario anónimo que entra
directo a una URL protegida) usa solo `location.state`, sin poblar
`sessionStorage`. Si ese usuario elige login con Google desde ahí,
pierde el destino original (cae en `/`). `// TODO: confirmar` si
vale la pena unificarlo con el mecanismo de doble capa.

---

**Con `HashRouter`, los query params van dentro del hash.** El modo registro
de `/auth` se pasa por query y se lee con `useLocation().search`, no con
`window.location.search` (que viene vacío).

**El redirect espera al perfil:** `App.tsx` consume `post_login_redirect`
recién cuando `needsProfileCompletion` es `false`. Una cuenta nueva completa el
perfil y después vuelve a donde estaba.

**Login en mobile:** antes del formulario, un splash con la imagen de
`/auth-bg.jpg` y dos botones (email / Google). Se separa con `lg:hidden`. El
splash solo aparece en modo `LOGIN`: el modo registro lo saltea.

---

## 27. DEPLOY Y SISTEMA DE ACTUALIZACIÓN

### El deploy
```
npm run deploy =
  git pull upstream main
  → npm run build            (generate-build-version.js + vite build)
  → git add -f dist && git add -A && git commit -m "chore: deploy"
  → git push upstream main
  → node scripts/publish-dist.js   (sube dist/ por FTPS y confirma)
  → node scripts/notify-deploy.js  (avisa a la app que hay versión nueva)
```
- **`dist/` se commitea** (con `-f`, porque está en el `.gitignore`).
  Todo cambio de frontend necesita build antes de publicarse.
- **`git add -A` agrega todo lo que haya en la carpeta.** Ver sección 12.
- El hook `pre-push` está **desactivado** (`.git/hooks/pre-push.disabled`) en
  las dos máquinas de trabajo: tenía una condición de carrera que borraba el
  JS viejo sin subir el nuevo y dejó producción sin JavaScript.
- El hosting es Apache (cPanel) y responde **200 `text/html`** a cualquier ruta
  que no existe (fallback de SPA). Un archivo JS que falta no da 404: da HTML,
  y el navegador falla con "Failed to load module script".

### Aviso de versión nueva
- `scripts/generate-build-version.js` toma la versión de
  `git rev-parse HEAD` (no de la fecha: un rebuild sin commit nuevo no tiene
  que disparar el aviso). `vite.config.ts` la embebe como `__BUILD_VERSION__`.
- `notify-deploy.js` espera 20 s (propagación del hosting) y escribe la versión
  en la tabla `app_version`.
- `hooks/useVersionCheck.ts` escucha `app_version` por **Realtime** (no por
  polling: el CDN cacheaba las consultas). Si cambia, ofrece actualizar y hace
  un hard reset con verificación y hasta 3 reintentos.
- `index.html` tiene un listener que detecta el error de MIME y reintenta con
  cache-busting **antes** de que monte React.
- `public/.htaccess` define `Cache-Control` reales (vía `mod_headers`).

**Ya no hay recarga automática por inactividad:** `useAutoRefresh` se eliminó
porque el aviso por Realtime lo hace innecesario. La config de la Home se
sigue cacheando en `localStorage`, como respaldo ante fallas de red.

---

## 28. MÓDULO EVENTOS

`/panel-eventos` (`PanelEventos.tsx`) muestra una tarjeta por evento según el
rol. Cada evento tiene su propio helper SQL de staff — **no compartirlos**: el
aislamiento entre eventos fue una decisión explícita.

### Día del Niño (agosto 2026 — terminado)
- `dianino_sessions` (la inscripción) y `dianino_tickets` (cada persona).
  Helper `is_dianino_staff()`.
- **Un QR maestro por familia**, enviado al adulto (texto con prefijo
  `ORIGEN-DIANINO-`). Al escanearlo se acredita al adulto y se abre
  `/eventos/admin/diadelnino/escaner/:ticketId` para tildar a los chicos.
- El contador "N de M" cuenta **solo a los chicos**.
- Desacreditar: RPC `uncheckin_dianino_ticket`.
- **Inscripción cerrada:** `InscripcionDiaNino.tsx` y `BuscarDiaNino.tsx` tienen
  una constante `EVENT_ENDED = true` que muestra el cartel de evento terminado.
  Para reabrir el año que viene, pasarla a `false`.
- El email (`send-dianino-tickets`) sube el QR al bucket **público** `images`
  con `margin: 1`, y no verifica quién la llama (sección 38).

### Tribal Wars (Influos)
- `/tribal-wars`: inscripción en 4 pasos (datos, tribu, comprobante,
  confirmación). `influos_dia_registrations`, RPC `register_influos_dia`.
- Helper `is_influos_dia_staff()`, separado del Día del Niño.
- El comprobante va al bucket público `images` (sección 38).

### Eventos generales
- `eventos_general`, listado público en `/eventos`, administración en
  `/eventos/admin/general`.
- **`is_eventos_general_staff()` incluye solo a `ENCARGADO_EVENTOS`**, por
  decisión explícita. La ruta admite también `SUPER_ADMIN`: verificar si puede
  escribir o si el RLS lo frena.

### Nocturna
Sección 29.

---

## 29. NOCTURNA

Evento para adolescentes: 30 de octubre de 2026, de 23 a 6 h, Av. Eva Perón
3932. Un adulto responsable inscribe a uno o varios chicos.

### Rutas
| Ruta | Qué es |
|---|---|
| `/nocturna-inscripcion` | Inscripción pública, con o sin sesión |
| `/panel-eventos/nocturna` | Planilla, búsqueda, precio, interruptor de inscripciones |
| `/panel-eventos/nocturna/nueva` | Alta por el staff |
| `/panel-eventos/nocturna/acreditar` | Escáner de la puerta (fuera del Layout) |
| `/panel-eventos/nocturna/:id` | Ficha, acreditación manual |
| `/panel-eventos/nocturna/:id/editar` | Edición (mismo componente que el alta, `modoEdicion`) |

Staff: `is_nocturna_staff()` = `SUPER_ADMIN`, `PASTOR`, `ENCARGADO_EVENTOS`,
`ACREDITACION`.

### Base (`sql/create_nocturna.sql`, `create_nocturna_email.sql`, `nocturna_edicion.sql`)
- **Cero policies para `anon`** en inscripciones y chicos. Todo entra por RPC.
- RPCs: `register_nocturna` (pública), `admin_crear_nocturna`,
  `admin_editar_nocturna`, `get_nocturna_para_acreditar`,
  `set_nocturna_acreditacion`, `update_nocturna_precio`,
  `reenviar_nocturna_email`. La validación vive una sola vez en
  `nocturna_validar_payload`.
- **Se valida en la base:** adulto de 18 o más, al menos un chico,
  `autoriza_asistencia = true` (además con un `CHECK`), comprobante en la
  pública, DNI de chico único por edición, retiro completo.
- **Se calcula en la base:** `precio_unitario` (foto del precio al inscribirse:
  cambiar el precio no toca las anteriores), `total`, `codigo_entrada` (6
  caracteres sin ambiguos).
- `edicion` está denormalizada en `nocturna_jovenes`, atada con una **FK
  compuesta** `(inscripcion_id, edicion)`. No hay otra FK simple al mismo
  padre: con dos, PostgREST no puede embeber.
- Las referencias al staff (`cargado_por_admin`, `updated_by`) son
  `ON DELETE SET NULL`.

### Reglas de negocio
- **Retiro:** la base lo guarda **por chico**; la interfaz pregunta **una vez
  por familia** y lo copia a todos (`aplicarRetiroFamiliar`).
- **"No autorizo" corta** la inscripción. **"No acepto" las fotos sigue**, y se
  marca en el panel para el equipo de fotografía (es por familia).
- **Estados:** `Inscripto` o `Aprobado`. Aprobado = **acreditado en la puerta**.
- **El contador cuenta adulto + chicos** ("2/4"). Para aprobar hace falta **el
  adulto y al menos un chico**. Volver a escanear suma a los que faltaban y no
  pisa la hora de los que ya entraron.
- `set_nocturna_acreditacion` fija el **estado exacto**: hay que mandarle los
  que ya estaban más los nuevos.
- La edición deja agregar y quitar chicos (no al último ni a uno acreditado),
  conserva sus ids y acreditación, recalcula el total con el **precio
  original** y devuelve la diferencia a cobrar. La autorización no se edita.

### Antes de abrir inscripciones
Las inscripciones quedan **cerradas** (`inscripciones_abiertas = false`) hasta
reemplazar en `InscripcionNocturna.tsx` los datos de pago y el teléfono de
contacto (marcados `// TODO`), y el texto "En la puerta · texto provisorio"
del email. Abiertas con datos de ejemplo, una familia transferiría a una cuenta
que no existe.

### Pruebas
`sql/PROBAR_nocturna*.sql` (suites SQL). Hay una verificación de punta a punta
pendiente, que incluye **dos personas del staff acreditando a la misma familia
a la vez** (por el estado exacto de `set_nocturna_acreditacion`).

---

## 30. ESCÁNER QR

`hooks/useEscanerQR.ts` concentra lo que costó varias rondas en el Día del
Niño. **Usarlo para cualquier escáner nuevo**, no copiar código.

Lo que resuelve:
- `html5-qrcode` (reemplazó a `qr-scanner`, que fallaba en iOS Safari),
  cámara trasera
- Refs espejo para que el `useEffect` no reinicie la cámara en bucle
- `try/catch` en la limpieza ("Cannot stop, scanner is not running")
- **`await` real antes de crear otra instancia**: sin eso, el reintento
  crasheaba en Android (dos instancias sobre el mismo `div`)
- Reintento del permiso de cámara, aviso de navegador embebido (WhatsApp,
  Instagram) y de permiso denegado, y log de `err.name`
- **Wake Lock** para que la pantalla no se apague, con liberación correcta
  (hubo dos fugas que dejaban el celular encendido)

Lo que agrega cada pantalla (ver `AcreditarNocturna.tsx` y
`nocturna/compartido/lecturaQR.ts`):
- Pausar la lectura mientras hay un panel abierto, e **ignorar el mismo código
  unos segundos** al cerrarlo: `html5-qrcode` dispara la lectura mientras el
  QR esté frente a la cámara
- Validar el formato antes de llamar a la base
- **Buscador por código manual** cuando no hay cámara: sin eso, un permiso
  denegado deja la puerta sin forma de acreditar
- Con corte de red: el panel no se cierra y **nada se da por acreditado sin
  confirmación de la base**

`EscanerDiaNino.tsx` **no** está migrado al hook (está enredado con la lógica
propia del Día del Niño y no se puede probar sin cámara).

---

## 31. REPORTES GCX

`/reportes/gcx` (dashboard), `/reportes/gcx/:groupId` (detalle) y
`/reportes/gcx/comp-temp` (comparativa). El `/reportes` viejo
(`Pastores.tsx`) sigue funcionando aparte.

### Datos
- **Llamar a `getReportesGCX(season, year)`**, que devuelve todo junto.
  Usa `_cargarBaseReportesGCX`: 5 consultas por temporada, cacheadas 30 s.
- Funciones: `getKPIsReportesGCX`, `getAsistenciaPersonas`,
  `getGruposQueReportan`, `getGeneroPorCategoria`, `getEdadesPorCategoria`,
  `getTablaGruposReporte`, `getDetalleGrupoReporte`. Las de asistencia
  aceptan filtros de **modalidad** y **grupo** (secciones Presencial, Online e
  Híbrido), aplicados después de la caché.
- Temporadas con `getSeasonFromDate()` (S1 23/3–31/5, S2 29/6–23/8,
  S3 5/10–29/11).

### Decisiones
- **Solo inscripciones `APPROVED`, en todo el tablero.** La función vieja
  `getGroupRegistrationAnalytics` cuenta también `PENDING` y `REJECTED` (por
  eso daba 133 donde el tablero da 127). **No mezclar las dos** en una pantalla.
- **"Asistieron" = vinieron al menos una vez.** Solo se puede calcular sobre los
  grupos que cargan asistencia; el resto se muestra como `sinDatos`, no se
  esconde.
- **Género y edad cubren ~84%** de los inscriptos: los anotados a mano por el
  anfitrión no tienen cuenta ni esos datos. Se muestra como `sinDato`.
- Edad: `birth_date` calculada, con `age` de respaldo.
- Categorías en **barras horizontales**: los nombres largos no entran en un
  eje X.
- **El "veredicto" de salud del grupo** (sano / en marcha / en riesgo) usa
  umbrales propuestos que **el equipo de grupos no validó todavía**. Están en
  `diagnosticar()` de `DetalleGrupoReporte.tsx`.
- No se muestra el "origen" de una inscripción (solicitud propia o carga
  manual): el esquema no lo guarda. Solo se distingue la derivación.

---

## 32. BIENVENIDA

- `/bienvenida`: **planilla** (ya no Kanban) con filtro de etapa en un
  `<select>`, KPIs y buscador. `/bienvenida/nuevo` (alta) y `/bienvenida/v/:id`
  (detalle y edición, con selector de etapa).
- Lee y escribe `welcome_visitors` directo (sin RPC).
- **`.trim()` en nombre y apellido** al guardar: el formulario público busca por
  igualdad exacta.
- En el alta, **`window.open` del WhatsApp va antes del `await`** (Safari iOS).
- `STAGE_CONFIG` y los colores de los KPIs son funcionales.
- El tutorial apunta a `#btn-new-visitor`, `#visitor-stages-menu` y
  `#visitors-grid`: se preservaron al pasar a planilla.

---

## 33. AUDIENCIA DE SERVICIOS

- `service_statistics`. Categorías: `'Servicio de Domingo'`, `'CXV'`,
  `'Evento'`, `'Conferencia'`, `'Martes'`. **"Martes" no mide voluntarios ni
  niñez**: los gráficos que dependen de eso no aplican a esos registros.
- `auditorio` se guarda **neto de voluntarios**: el formulario pide el total y
  resta los voluntarios al guardar.
- Columnas de la planilla: Online, **Total c/ Online** (auditorio + online) y
  Observaciones. `/audiencia-servicios` es de ancho completo
  (`isFullWidthPage` en `Estructura.tsx`).
- Detalle en `/audiencia-servicios/detalles/:id`.
- ⚠️ El formulario (`/new`) recibe el registro a editar por
  **`location.state`**, no por un id en la URL: si se recarga o se abre en otra
  pestaña, pierde los datos.

---

## 34. HOME, NIÑEZ Y PUNTO DE INFORMACIÓN

### Home
- Hero con `CarruselHero` (`theme="soft"`). Los videos usan `playWithRetry`:
  si el primer `play()` falla, reintenta en `canplay`.
- **Banner "Origen Música":** `home_musica_banner_slides`, editado desde
  `/panel-admin` (Música). Lectura pública, escritura solo `SUPER_ADMIN`.
  Cada slide abre su `target_url` en pestaña nueva; la URL no se muestra.
- `Estructura.tsx`: `isDashboard` (`/`, `/gcx`, `/ninez`) pone la navbar
  transparente sobre el hero; `isFullWidthPage` saca el `max-w-7xl`.

### Niñez
`/ninez` y `/admin-ninez/configuracion`. `ninez_banner_slides`,
`is_ninez_staff()`.

### Punto de Información
- **Requiere sesión.** A quien no tiene roles internos le muestra la vista
  pública (`InicioPublico.tsx`); el resto ve el panel interno (dashboard,
  anuncios, eventos, bautismos, presentación de niños, inventario,
  movimientos, préstamos, configuración).
- Banner propio: `punto_info_banner_slides`, editado desde
  `PanelAdministrador.tsx` (`SUPER_ADMIN`, `ADMIN_PUNTO`, `ENCARGADO_PUNTO`).
- Problema conocido en la vista pública: el link de un anuncio solo se abre a
  través del QR, que no sirve en el celular; y los eventos no muestran su
  imagen ni su ubicación aunque las tienen. Hay un rediseño en curso.

---

## 35. EMAILS

- **Resend: 100 emails por día**, compartidos por todas las funciones.
  Registrar qué salió y qué no, y dejar reenviar.
- **HTML de email, no de web:** maquetado con tablas, estilos en línea, ancho
  máximo 600 px, sin JavaScript, fuentes del sistema, botones hechos con tablas.
- **Modo oscuro de Gmail:** poner el fondo en el atributo `bgcolor` **y** en el
  `style` de cada `<table>` y `<td>`, y las meta `color-scheme` y
  `supported-color-schemes`.
- **Imágenes importantes (un QR) incrustadas con CID** (`content_id` en el
  adjunto, `cid:` en el HTML): se ven aunque el cliente bloquee las imágenes
  remotas, y no quedan en un bucket público. Usar el envío individual de
  Resend. QR con `margin: 4` y fondo blanco propio.
- **Respaldo en texto** de todo lo importante (un código corto debajo del QR).
- **Escapar todo lo que viene del usuario** antes de meterlo en el HTML.
- Los links llevan `/#/`.
- `email-notifier` (`emailTemplates.ts`) tiene las plantillas de "grupo nuevo"
  y "postulación a anfitrión": hoy sin botón ni link directo, y la de
  postulación no muestra si la persona completó "Crecer" y el curso de líderes
  (`leader_applications.completed_hiciste_crecer`, `completed_leader_course`).

---

## 36. DISEÑO CON CLAUDE DESIGN

1. El diseño se hace en Claude Design y se exporta a `design-claude/` como
   `*.dc.html`.
2. Al implementar, **el `.dc` es la fuente de verdad de lo visual**, pero:
   - **Los números del diseño son maqueta** (mostraba 17 categorías y un 57%
     que no existían). Los datos salen del servicio.
   - **La lógica existente se preserva.** No pegar el código del diseño encima
     de una pantalla que ya funciona.
   - Si el diseño pide algo que el esquema no tiene, **no fabricarlo**: decirlo
     y adaptar.
3. **Pedirle pantallas de a una o dos.** Cuando se le piden muchas juntas, hace
   una y se olvida del resto.
4. En los prompts aclarar que **el menú lateral global no se toca**.
5. Para emails, pedir explícitamente HTML de email (sección 35).
6. **Lo que se pega en Claude Design queda en `design-claude/uploads/` y se
   publica.** No pegar capturas con datos reales.

---

## 37. VERIFICACIÓN Y PRUEBAS

**Un cambio no está listo porque compila.**

- **Dry run** de los reemplazos: confirmar que cada patrón matchea el conteo
  esperado antes de escribir, y abortar sin tocar nada si alguno falla.
- **`tsc --noEmit`** contra el baseline: hoy **105 líneas**, incluidos los
  errores de tipos de Deno de las Edge Functions. Lo que importa es que no haya
  errores **nuevos**.
- **`git diff` filtrado**: en un rediseño, solo deberían cambiar `className`.
- **Verificar contra la base**, no contra lo que dice el prompt. Si un número no
  coincide, investigar antes de seguir.
- **SQL dentro de `BEGIN ... ROLLBACK`**, nunca `COMMIT` en pruebas.
- **Datos de prueba con apellido "PRUEBA"**, borrados al terminar. Reportar el
  estado final de producción **con la consulta**, no de memoria.
- **Emails de prueba solo a la casilla de Ignacio** (preguntarle cuál) y
  contados: la cuota es compartida.
- **Si se apaga un trigger** para cargar volumen, volver a prenderlo y
  verificarlo (`tgenabled = 'O'`). Un trigger de email apagado no da ningún
  error: simplemente nadie recibe nada.
- Lo que solo se prueba con un dispositivo (cámara, Gmail en modo oscuro,
  Outlook) va en un **checklist para Ignacio**.
- Puede haber **ediciones en paralelo** de Ignacio en el mismo archivo: leer el
  estado actual antes de tocar, y no pisar lo que no es del prompt.

---

## 38. DEUDA TÉCNICA Y PENDIENTES CONOCIDOS

### Seguridad
| Pendiente | Riesgo |
|---|---|
| `send-dianino-tickets` invocable sin autenticación | Cualquiera puede quemar la cuota diaria y mandar emails a familias |
| Comprobantes de Tribal Wars en el bucket público `images` | Nombre, CBU y monto detrás de una URL pública |
| `influos_attendees`: la sección 17 la da por cerrada, pero `sql/influos_public_select_policy.sql` crea un `SELECT` para `anon` | **Confirmar con `pg_policies`.** Son teléfonos de menores |
| `get_registrations_by_partner_email` y `upsert_couple_registration` | Existe `sql/fix_partner_email_rpc.sql`: verificar que esté aplicado |
| `/punto-de-informacion/*/nuevo` sin guard de rol | Verificar que la página o el RLS frenen a quien no corresponde |
| 7 FK con `ON DELETE NO ACTION`: `audit_logs.changed_by`, `dianino_tickets.checked_in_by`, `group_dropout_requests.host_id` y `.target_user_id`, `group_registrations.partner_user_id`, `service_statistics.created_by` | No se puede dar de baja a esos usuarios; con `partner_user_id`, **`admin_delete_user` falla** para quien figura como pareja |
| `.gitignore` | Agregar `test_*.cjs`, `test_*.mjs`, `*.backup_*`, `design-claude/uploads/` |
| Protección de contraseñas filtradas | Toggle manual en el dashboard de Supabase |
| `pg_net` y `pg_trgm` en el schema `public` | Moverlos se prueba primero en una rama |
| `PASTOR` ve los grupos ocultos | Decidir si se acota (sección 24) |

### Código
- `npm uninstall matter-js @types/matter-js`
- Archivos huérfanos: `pages/auth/IniciarSesion.tsx`,
  `pages/punto-informacion/welcome/Bienvenida.tsx`, los `*-IgnacioPC.tsx`,
  `Pastores.tsx.backup_ui_*`, y los modales huérfanos de la sección 22
- Conviven 4 versiones de `manage_group_registration`; **solo `v3`** tiene la
  corrección de seguridad, la derivación y el contador sin doble conteo
- `groups_status_check` sin `'finished'` vs la re-apertura (sección 19)
- Dos generadores de `.ics`
- `EscanerDiaNino.tsx` sin migrar a `useEscanerQR`
- El formulario de Audiencia edita por `location.state`
- `Grupos.tsx` mezcla catálogo y panel admin; el panel GCX está duplicado
- `uploadBase64Image` sube al bucket público
- `getGroups()` embebe `group_registrations`, que sin sesión vuelve vacío
- `groups.location` es texto libre (no permite buscar por cercanía)
- 3 grupos con `co_host_id = host_id`
- Comprobantes huérfanos en `nocturna-comprobantes` (subidos en inscripciones
  abandonadas); limpiarlos requiere una tarea del lado del servidor

### Operativo
- `prode-sync-results` falla cada 5 minutos (`404` en el login de la API)
- Nocturna: datos de pago, teléfono y texto de la puerta antes de abrir
- El plan de Resend: 100 emails por día

---

*Última actualización: Octubre 2026 — Versión 6.0*

*Cambios v6.0: corrección del router (`HashRouter`, no `BrowserRouter`);
sección 8 reescrita (estilo del login; el neo-brutalismo pasa a legacy);
rutas reales extraídas de `App.tsx` (~30 nuevas) y regla de orden de rutas
con parámetro; roles `ENCARGADO_NINEZ` y `ACREDITACION`; `users.roles` es
`text[]`; patrones nuevos (7.8–7.15); tablas, buckets y comportamientos de la
base (11); seguridad reescrita con las lecciones de la auditoría (12);
modalidad híbrida, derivación, baja directa y funciones nuevas de GCX (19, 22);
deploy y aviso de versión (27); eventos, Nocturna y escáner (28–30); Reportes
GCX (31); Bienvenida, Audiencia, Home, Niñez y Punto de Información (32–34);
emails (35); flujo con Claude Design (36); estándar de verificación (37); y
la lista de deuda técnica y pendientes (38).*

*Cambios v5.0: Trivia Origen (20), migración de Gestión de Grupos y Panel de
Anfitrión a páginas propias (21-22), wizard de parejas (23), bloqueo de cupos y
ocultar grupos (24), coordinador multi-rol y `ENCARGADO_EVENTOS` (25), login
seguro con Google OAuth (26).*

*Repositorio: github.com/sistemasorigen/origen-app-1*
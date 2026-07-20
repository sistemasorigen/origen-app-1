# 🛸 Origen App — IA Instructions & Style Guide
> Versión 5.0 · Obligatorio leer antes de cualquier intervención

Este archivo es la **memoria central y autoridad arquitectónica** del proyecto.
Todo agente de IA que trabaje en este repositorio debe leerlo completo antes
de escribir una sola línea de código. Su cumplimiento no es opcional.

---

## 1. STACK TECNOLÓGICO

| Capa | Tecnología | Notas |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Componentes funcionales, sin clases |
| Estilos | Tailwind CSS vía CDN | Config personalizada en `index.html` |
| Backend / DB | Supabase | Auth, Postgres, Storage, Edge Functions |
| IA / Texto | Google Gemini 2.5 Flash | `@google/generative-ai` + `@google/genai` |
| Animaciones | Framer Motion 12 | `motion`, `AnimatePresence` |
| Iconos | Lucide React 0.555 | Siempre desde `lucide-react` |
| Física | Matter.js | Solo para efectos decorativos en Home |
| Audio | Context API propio | `contexts/AudioContext.tsx` |
| Estado global | React Context API | Sin Redux ni Zustand |
| Routing | React Router DOM 7 | BrowserRouter (`/ruta`) |
| Gráficos | Recharts 2 | Solo para dashboards de datos reales |

**Dependencias instaladas — NO instalar alternativas:**
`clsx`, `framer-motion`, `idb`, `lucide-react`, `matter-js`, `react-easy-crop`,
`react-joyride`, `react-router-dom`, `recharts`, `tailwind-merge`, `xlsx`

---

## 2. ESTRUCTURA DE CARPETAS

```
origen-app/
├── components/
│   ├── GCX/              # Módulo Grupos de Conexión (13 componentes)
│   ├── Reportes/         # Paneles de analíticas
│   ├── admin/            # Componentes del panel Admin
│   ├── calendar/         # CalendarioIglesia.tsx
│   ├── info-point/       # Sidebar y menús del Punto de Info
│   ├── layout/           # Estructura, MenuDeslizable, ReproductorGlobal
│   ├── media/            # SubidaImagen, SubidaAvatar, EntradaImagenInteligente
│   ├── modals/           # ModalLoginSistema, ModalCompletarPerfil, ModalCodigoQR
│   ├── notifications/    # BannerPermisoNotificaciones, InterfazNotificaciones
│   ├── onboarding/       # Tours interactivos (ControladorTutorial, TourBienvenida)
│   └── ui/               # NeoModal, CarruselHero, CargadorEsqueleto, LimiteError
├── contexts/             # AuthContext, AudioContext, NotificationContext
├── hooks/                # useRole, useSpellingAI, usePushNotifications, etc.
├── pages/
│   ├── admin/            # Administrador.tsx
│   ├── audiencia/        # Pastores, AudienciaServiciosPrincipal, Formulario
│   ├── auth/             # PantallaAutenticacion, ActualizarContrasena, etc.
│   ├── bienvenida/       # Bienvenida, Formulario, modales de visitantes
│   ├── coordinadores/    # Coordinadores y subpaneles
│   ├── groups/           # Grupos, PanelAnfitrion
│   ├── home/             # Home.tsx (Dashboard principal)
│   ├── influos/          # InfluosPagina, InfluosAcceso, modales
│   ├── primarias/        # PuntoInformacion, Tienda, Alabanza
│   ├── punto-informacion/# Subvistas del Punto de Info + context/ContextoToast
│   └── user/             # PaginaPerfil, Notificaciones, PaginaTutoriales
├── services/
│   ├── supabaseClient.ts # Cliente Supabase (exporta `supabase`)
│   ├── supabaseService.ts# Todas las queries a Supabase
│   ├── authUtils.ts      # hasRole(), getRoleDisplayNames()
│   ├── dbService.ts      # Módulos del sistema, config local
│   ├── geminiService.ts  # Corrector ortográfico con Gemini
│   └── db.ts             # dbAPI — wrapper de supabaseService
├── src/
│   ├── config/tours.ts   # Configuración de tours de onboarding
│   ├── hooks/            # useIsMobile, useTutorial
│   └── utils/cropImage.ts# Utilidad de recorte de imágenes
├── supabase/functions/   # Edge Functions (Deno + Resend)
├── sql/                  # Migraciones y scripts SQL
├── types.ts              # ÚNICA fuente de tipos globales
└── App.tsx               # Rutas, providers, lógica de sesión
```

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

Las rutas se declaran en `App.tsx`. Hay **tres zonas**:

### Zona 1 — Públicas sin Layout (sin auth, sin chrome)
| Ruta | Componente |
|---|---|
| `/auth` | PantallaAutenticacion |
| `/update-password` | ActualizarContrasena |
| `/verify-email` | VerificarEmail |
| `/form` | Formulario (público de bienvenida) |
| `/influos-acceso` | InfluosAcceso (verificador público) |

### Zona 2 — Públicas con Layout (sin auth, con chrome)
Accesibles sin login. `currentUser` puede ser `null` en estos componentes.
| Ruta | Componente | Notas |
|---|---|---|
| `/` | Home / Dashboard | Sin sesión muestra contenido general |
| `/gcx` | Grupos (Grupos.tsx) | Botón UNIRME requiere sesión para inscribirse |

### Zona 3 — Protegidas con Layout (requieren auth)
Redirigen a `/auth` con `state.from` si no hay sesión activa.
| Ruta | Módulo | Roles (guard en App.tsx) |
|---|---|---|
| `/punto-de-informacion` | Punto de Información | Todos (autenticados) |
| `/panel-admin` | Sistemas / Admin | SUPER_ADMIN |
| `/store` | Tienda | Todos (autenticados) |
| `/alabanza` | Alabanza | Todos (autenticados) |
| `/reportes` | Reportes | SUPER_ADMIN, PASTOR, ENCARGADO_PUNTO, ADMIN_PUNTO, ENCARGADO_GRUPOS, REPORTES, ADMIN_GROUPS |
| `/bienvenida` | Bienvenida | SUPER_ADMIN, ENCARGADO_BIENVENIDA, VOLUNTARIO_BIENVENIDA |
| `/influos` | Influos | SUPER_ADMIN, PASTOR, INFLUOS |
| `/mis-grupos` | Panel Anfitrión | SUPER_ADMIN, ADMIN_GROUPS, ANFITRION, CO_ANFITRION |
| `/coordinators` | Coordinadores | SUPER_ADMIN, COORDINATOR |
| `/tutoriales` | Tutoriales | Todos (autenticados) |
| `/audiencia-servicios` | Audiencia Servicios | SUPER_ADMIN, PASTOR, ADMIN_CUIDADO_PASTORAL |
| `/audiencia-servicios/new` | Formulario Pastoral | SUPER_ADMIN, PASTOR, ADMIN_CUIDADO_PASTORAL |
| `/notificaciones` | Notificaciones | Todos (autenticados) |
| `/perfil` | Perfil Personal | Todos (autenticados) |
| `/prode` | Prode Mundial | Solo gender='Masculino' |
| `/prode/ranking` | Ranking Prode | Solo gender='Masculino' |
| `/prode/resultados` | Resultados + Predicciones | Solo gender='Masculino' |
| `/prode/administracion` | Admin Prode | SUPER_ADMIN, PASTOR, PRODE |
| `/gcx/calendario` | Calendario GCX | Autenticados con grupos |
| `/admingcx/*` (13 rutas) | Admin GCX | SUPER_ADMIN, ADMIN_GROUPS (+ ENCARGADO_GRUPOS en 7 de las 13) — ver sección 21 |
| `/mis-grupos/*` (10 rutas) | Panel Anfitrión | SUPER_ADMIN, ADMIN_GROUPS, ANFITRION, CO_ANFITRION — ver sección 22 |
| `/trivia/*` (públicas) | Trivia Origen (jugador/proyector) | Sin guard — ver sección 20 |
| `/trivia/admin`, `/trivia/admin/nuevo`, `/trivia/admin/:id`, `/trivia/historial`, `/trivia/historial/:id` | Trivia Origen (admin) | SUPER_ADMIN, PASTOR, ENCARGADO_EVENTOS — ver sección 20 |
| `/panel-eventos` | Panel de Eventos | SUPER_ADMIN, PASTOR, ENCARGADO_EVENTOS |
| `/eventos` | Eventos (landing) | Autenticados, sin guard de rol |
| `/eventos/admin/diadelpadre`, `/eventos/puntuacion`, `/eventos/futboltenis`, `/eventos/dpadre/:id` | Módulo Día del Padre | SUPER_ADMIN, PASTOR, ENCARGADO_EVENTOS (+ EVENTOS en 3 de las 4) |

---

## 6. ROLES DEL SISTEMA

```typescript
enum UserRole {
    SUPER_ADMIN, PASTOR,
    ADMIN_PUNTO, ADMIN_GROUPS, ADMIN_STORE, ADMIN_ALABANZA,
    ANFITRION, CO_ANFITRION,
    ENCARGADO_PUNTO, ENCARGADO_GRUPOS, ENCARGADO_STORE,
    ENCARGADO_ALABANZA, ENCARGADO_BIENVENIDA,
    VOLUNTARIO, VOLUNTARIO_INFO, VOLUNTARIO_GRUPOS, VOLUNTARIO_BIENVENIDA,
    COORDINATOR,        // Usa coordinatorVariants (array) — ver sección 25
    ADMIN_CUIDADO_PASTORAL,
    INFLUOS,            // Módulo gestión de menores
    REPORTES,
    PRODE,              // Administración del Prode Mundial
    EVENTOS, ENCARGADO_EVENTOS,  // Módulo Eventos + Trivia Origen — ver secciones 20 y 25
    USUARIO, VIEWER, VOLUNTEER  // Roles básicos / legacy
}
```

**⚠️ Desincronización conocida con el enum de Postgres (`user_role`):**
`ADMIN_CUIDADO_PASTORAL` y `PRODE` existen en este enum de
TypeScript pero **todavía no** en el enum `user_role` de la base de
datos real — escribir esos valores en la columna `users.role`
(singular, tipada) falla hasta correr un `ALTER TYPE ... ADD VALUE`
manual. Ver sección 25 para el detalle y el patrón ya usado con
`EVENTOS`/`ENCARGADO_EVENTOS` (`sql/fix_user_role_enum_eventos.sql`).

Para verificar permisos usar siempre `hasRole()` de `services/authUtils.ts`:
```typescript
import { hasRole } from '../../services/authUtils';
if (hasRole(user, [UserRole.SUPER_ADMIN, UserRole.PASTOR])) { ... }
```

Para obtener el rol actual del usuario en un componente:
```typescript
import { useRole } from '../../hooks/useRole';
const { isSuperAdmin, isAnfitrion, canManageGroups } = useRole();
```

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

---

## 8. ESTÉTICA — SISTEMA NEO-BRUTALIST

El proyecto tiene un sistema de diseño propio y definido. Toda UI nueva
debe ser coherente con él.

### Reglas visuales
- **Bordes:** `border-2 border-black` (o `border-4` para contenedores principales)
- **Sombras brutalist:** `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
  o `shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]` para elementos destacados
- **Tipografía:** `font-black uppercase tracking-tight` para títulos
- **Labels de campos:** `text-[11px] font-black uppercase tracking-widest`
- **Fuente:** Proxima Nova (cargada globalmente — NO cambiar)
- **Botón primario:**
  ```
  bg-black text-white font-black uppercase tracking-widest
  border-2 border-black hover:bg-white hover:text-black
  hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all
  ```
- **Input estándar:**
  ```
  border-2 border-black font-bold text-black bg-white
  focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none
  ```
- **Dark mode:** clases `dark:` en paralelo. El modo se maneja con `darkMode: 'class'`
- **Animaciones:** Framer Motion para transiciones de pantalla, CSS para microinteracciones
- **NO usar:** rounded-lg en elementos principales, sombras suaves tipo `shadow-sm`,
  colores pasteles sin contexto, gradientes genéricos

### Colores de acento por módulo
| Módulo | Color |
|---|---|
| Grupos (GCX) | `#28a946` (verde — usado en TarjetaGrupo, botones UNIRME, badges) |
| Bienvenida | emerald-500 |
| Influos | violet-600 |
| Pastoral / Audiencia | violet-700 |
| Reportes | amber-500 |
| Admin / Sistemas | neutral-900 |
| Alabanza | pink-500 |

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

**Variables de entorno requeridas en las Edge Functions:**
- `RESEND_API_KEY` — Proveedor de emails
- `SUPABASE_URL` — URL del proyecto
- `ORIGEN_SERVICE_ROLE_KEY` — Service role para operaciones admin
- `GOOGLE_IMAGEN_KEY` — API Key de Google para generación de imágenes
- `WC2026_API_EMAIL` — Credencial API worldcup26.ir
- `WC2026_API_PASSWORD` — Credencial API worldcup26.ir

**Nunca hardcodear estas keys. Siempre usar `Deno.env.get('...')`.**

---

## 11. BASE DE DATOS — TABLAS PRINCIPALES

| Tabla | Módulo | Descripción |
|---|---|---|
| `users` | Global | Perfil de usuarios (roles, avatar, datos personales) |
| `groups` | GCX | Grupos de conexión con anfitriones |
| `group_registrations` | GCX | Inscripciones a grupos |
| `group_categories` | GCX | Categorías de grupos |
| `group_tags` | GCX | Etiquetas de grupos |
| `group_attendance` | GCX | Asistencias a grupos. Columnas: `date DATE`, `present_members JSONB` (array de registration IDs) |
| `dropout_requests` | GCX | Solicitudes de baja de grupos |
| `welcome_visitors` | Bienvenida | Registro de nuevos ingresantes. Columnas relevantes: `accepted_jesus TEXT`, `localidad TEXT`, `form_reminder_count INT`, `form_reminder_sent_at TIMESTAMPTZ` |
| `influos_attendees` | Influos | Asistentes al evento Influos (menores). Columnas relevantes: `tribu TEXT`, `localidad TEXT`, `accepted_jesus TEXT` |
| `service_statistics` | Pastoral | Estadísticas de servicios dominicales |
| `app_events` | Info Point | Eventos del calendario |
| `announcements` | Info Point | Anuncios del tablero |
| `notifications` | Global | Notificaciones in-app |
| `audit_logs` | Admin | Registro de auditoría |
| `group_transfer_requests` | GCX | Solicitudes de transferencia de titularidad de grupos entre anfitriones. Estados: pending/accepted/rejected/cancelled |
| `prode_matches` | Prode | Partidos del Mundial 2026. Campos clave: external_match_id, is_open, is_finished, home/away_score_real |
| `prode_participants` | Prode | Participantes del prode (con o sin cuenta). Acumula total_points |
| `prode_predictions` | Prode | Predicciones por participante por partido. points_earned null hasta que haya resultado |
| `prode_sync_log` | Prode | Auditoría de sincronizaciones automáticas con API externa |
| `trivia_juegos` | Trivia | Partidas/plantillas. Columnas: `pin`, `estado`, `pregunta_actual_idx`, `timer_pausado`, `started_at`, `finished_at`, `is_template` |
| `trivia_preguntas` | Trivia | Preguntas por juego. `juego_id`, `orden`, `texto`, `tiempo_limite`, `es_doble_puntos` |
| `trivia_opciones` | Trivia | Opciones por pregunta. `pregunta_id`, `texto`, `es_correcta`, `color`, `orden` |
| `trivia_jugadores` | Trivia | Jugadores por partida. `juego_id`, `nickname`, `avatar_emoji`, `puntaje_total`, `racha_actual`, `max_racha` |
| `trivia_respuestas` | Trivia | Respuestas registradas. `jugador_id`, `pregunta_id`, `opcion_id`, `tiempo_respuesta_ms`, `puntos_ganados` |
| `trivia_estado_pregunta` | Trivia | Estado en vivo de cada pregunta. `juego_id`, `pregunta_id`, `estado`, `total_respuestas` |

**Columnas nuevas en tablas existentes (v5.0):**
- `groups.capacity_locked` (bool, default `false`) — bloqueo manual de cupo, ver sección 24
- `groups.is_hidden` (bool, default `false`) — ocultar de `/gcx`, ver sección 24
- `groups.co_host_id` (uuid) — co-anfitrión del grupo
- `users.coordinator_variants` (`text[]`, NOT NULL) — multi-rol de coordinador, ver sección 25 (convive con `users.coordinator_variant` legacy singular)
- `users.roles` (`text[]`) — array de roles, convive con `users.role` (singular, enum `user_role`)

**Todas las tablas tienen RLS habilitado.** Al crear tablas nuevas siempre
agregar policies correspondientes. Ver Sección 17 para tablas con acceso `anon`.

---

## 12. SEGURIDAD — REGLAS OBLIGATORIAS

- **Nunca** exponer API keys en código fuente. Usar `import.meta.env.VITE_*`
- **Nunca** commitear archivos `.env`, `test_*.js`, `debug_*.js` o `*.backup`
- El archivo `supabase/.temp/` contiene el project ID — no publicar
- Las Edge Functions deben verificar autenticación antes de ejecutar lógica
- El `SUPER_ADMIN` es el único rol que puede asignar roles privilegiados
- El cache de `localStorage` nunca se usa para decisiones de acceso — solo para render optimista

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

Antes de escribir cualquier código, confirmar mentalmente:

- [ ] ¿Leí `instrucciones_ia.md` completo?
- [ ] ¿Leí todos los archivos que voy a modificar?
- [ ] ¿Usé rutas relativas (`../../`) en los imports?
- [ ] ¿Apliqué la skill correspondiente si existe?
- [ ] ¿Usé `NeoModal` para modales y `ContextoToast` para toasts?
- [ ] ¿Evité `any` en TypeScript?
- [ ] ¿El estilo es coherente con el sistema neo-brutalist?
- [ ] ¿Los campos nuevos tienen su columna SQL + tipo en `types.ts`?
- [ ] ¿La nueva ruta tiene su guard de roles en `App.tsx`?
- [ ] ¿No hardcodeé ninguna API key?
- [ ] ¿En componentes de zona pública usé `currentUser?.role` con optional chaining?

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
Las siguientes tablas tienen SELECT abierto al rol `anon`:
- `groups` — solo `status = 'approved'`
- `group_categories` — sin restricciones adicionales
- `group_tags` — sin restricciones adicionales
- `group_registrations` — solo SELECT; INSERT/UPDATE/DELETE requieren `authenticated`

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
`parent_group_id` apuntando al original. El original
pasa a status `finished` conservando su historial.

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
`TriviaPlanilla`) usa la estética neo-brutalist clara estándar del
resto de la app (sección 8). No mezclar ambos sistemas visuales.

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
propias bajo `/admingcx/*` (13 rutas planas, sin nesting real de
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

*Cambios v4.0: Módulo Prode Mundial 2026 completo (sección 18), features GCX 2026 (sección 19),
 BrowserRouter confirmado, rol PRODE agregado,
 tablas group_transfer_requests/prode_matches/prode_participants/prode_predictions/prode_sync_log,
 Edge Function prode-sync-results, calendario GCX,
 re-apertura por temporada con parent_group_id,
 configuración de temporadas, transferencia de grupos,
 patrones SubMenuItem extendidos (sección 7.7)*

*Última actualización: Julio 2026 — Versión 5.0*
*Cambios v5.0: Trivia Origen completo (sección 20),
 migración completa de Gestión de Grupos y Panel de
 Anfitrión de modales a páginas propias bajo
 /admingcx y /mis-grupos (secciones 21-22), wizard
 de inscripción de pareja con soporte de pareja sin
 email (sección 23), bloqueo de cupos y ocultar
 grupos (sección 24), coordinador multi-rol y rol
 ENCARGADO_EVENTOS (sección 25), mecanismo de doble
 capa para login seguro con Google OAuth (sección 26)*

*Repositorio: github.com/sistemasorigen/origen-app-1*

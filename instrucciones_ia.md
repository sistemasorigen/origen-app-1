# 🛸 Antigravity - IA Instructions & Style Guide

Este archivo sirve como la memoria central y manual de estilo para todas las interacciones con la IA en el proyecto **Antigravity**. Su cumplimiento es obligatorio para mantener la coherencia arquitectónica.

## 🛠 Stack Tecnológico

- **Frontend:** React 19 (Vite) + TypeScript.
- **Estilos:** Tailwind CSS (vía CDN con configuración personalizada en `index.html`).
- **Backend/Base de Datos:** Supabase (Auth, DB, Storage).
- **IA:** Google Gemini API (`@google/generative-ai`).
- **Animaciones:** Framer Motion.
- **Iconos:** Lucide React.
- **Física/Gráficos:** Matter.js.
- **Estado/Datos:** Context API y servicios modulares.

## 📐 Reglas de Estructura y Nomenclatura

### 1. Organización de Carpetas
El proyecto utiliza una estructura plana en la raíz para facilitar el acceso modular:
- `components/`: Componentes reutilizables.
- `pages/`: Vistas principales de la aplicación.
- `services/`: Lógica de negocio, clientes de API (Supabase, Gemini) y utilidades.
- `hooks/`: Hooks personalizados de React.
- `contexts/`: Proveedores de estado global (Audio, Auth, etc.).
- `types.ts`: Definiciones de tipos e interfaces globales.

### 2. Convenciones de Nomenclatura
- **Componentes:** `PascalCase` (ej. `NeoModal.tsx`, `HeroCarousel.tsx`).
- **Servicios/Hooks/Utilidades:** `camelCase` (ej. `supabaseService.ts`, `useAudio.ts`).
- **Variables y Funciones:** `camelCase` descriptivo.
- **Interfaces/Tipos:** `PascalCase` (ej. `UserRole`, `AppConfig`).
- **Archivos CSS:** `kebab-case` (ej. `index.css`).

## 🎨 Enfoque y Tono

- **Código Limpio y Modular:** Priorizar la separación de intereses. La lógica compleja debe residir en `services/` o `hooks/`, manteniendo los componentes visuales limpios.
- **Sin Dependencias Innecesarias:** Antes de sugerir una nueva librería, verificar si el stack actual (o JS nativo) puede resolverlo.
- **Estética "Neo-Minimalista":** La UI debe ser limpia, con un enfoque en tipografía (`Proxima Nova`), modo oscuro nativo y transiciones suaves.
- **Seguridad:** Nunca exponer llaves de API directamente. Usar variables de entorno y el objeto `process.env` configurado en Vite.

## 📝 Formato de Respuesta de la IA

Antes de realizar cualquier cambio o escribir código, la IA debe seguir este formato:

1. **Análisis:** Breve explicación de lo que se ha detectado o lo que se necesita hacer.
2. **Plan de Acción:** Listado de pasos técnicos que se ejecutarán.
3. **Justificación:** Por qué se ha elegido ese enfoque (especialmente si afecta a la arquitectura).
4. **Ejecución:** Código o comandos resultantes.

> [!IMPORTANT]
> **Nota estricta sobre el flujo de trabajo:**
> Si el usuario habla en **Modo Plan**, la IA debe detenerse obligatoriamente en el **paso 3 (Justificación)** y preguntar si se aprueba el plan. **NUNCA** se debe generar el **paso 4 (Ejecución/Código)** hasta que el usuario dé la orden explícita de pasar a **Modo Build**.

## 🚀 Reglas de Oro
- **Alias de Importación:** Usar siempre `@/` para referirse a la raíz del proyecto (ej. `import { db } from '@/services/dbService'`).
- **TypeScript Estricto:** Evitar el uso de `any`. Definir interfaces precisas en `types.ts` o localmente si son específicas.
- **Comentarios:** Solo para explicar el "por qué" de lógicas no triviales. No comentar lo obvio.

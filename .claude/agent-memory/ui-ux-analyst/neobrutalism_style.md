---
name: Neo-brutalismo Style Guide - Origen App
description: Patrones de diseño neo-brutalista aplicados en Origen App (bordes negros, sombras duras, tipografía bold)
type: reference
---

## Estilo Neo-brutalista en Origen App

**Características visuales:**
- Bordes negros gruesos: `border-2 border-black` / `border-4 border-black`
- Sombras duras sin blur: `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
- Tipografía: `font-black`, `font-bold`, `uppercase`, `tracking-widest/tight`
- Paleta: blanco/negro predominante con acentos (violeta, ámbar, rojo)
- Interacciones hover: `-translate-y-0.5` con aumento de sombra

**Clases comunes:**
- Inputs: `p-3 bg-white border-2 border-black rounded-lg font-bold focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
- Botones primarios: `bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5`
- Cards: `bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`

**Archivos de referencia:**
- `pages/pastoral/PastoralCareDashboard.tsx`
- `pages/pastoral/PastoralCareForm.tsx`

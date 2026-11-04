# Tareas compartidas: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una tarea pueda ser de varios sub-departamentos a la vez y se complete recién cuando todos dieron el finalizado.

**Architecture:** Tabla `agenda_tarea_equipos` con el avance por equipo y `agenda_tareas.compartida`, con `subdepartamento_id` NULL en esas tareas. La base arma el JSON según quién mira: el integrante recibe un `subdepartamento` y un `estado` normales, así que sólo las pantallas del admin y el formulario cambian de verdad.

**Tech Stack:** PostgreSQL de Supabase (RPC `SECURITY DEFINER`), React 19 + TypeScript, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-04-tareas-compartidas-design.md`

## Global Constraints

- Las tareas no compartidas y las copias por equipo no cambian: lo que se manda con un solo equipo sigue idéntico a `scratchpad/secciones/payloads/antes`.
- Sin `npm run deploy` ni `npm run build`. Commit local sí, push no.
- El SQL se aplica en producción sólo con aprobación explícita de Ignacio (Task 6). Hasta entonces sólo corre dentro de `BEGIN … ROLLBACK`.
- Cada función se parte de su definición VIVA (`pg_get_functiondef`), no de los `.sql` viejos: `agenda_tareas_avisar` tiene cuatro versiones en el repo.
- Toda RPC se prueba como `authenticated` (memoria `rpc-probar-como-authenticated`). Una RPC abierta que llama auxiliares cerradas es `SECURITY DEFINER` con `search_path` fijo.
- Ningún push ni aviso real: los `PROBAR_` terminan en `RAISE EXCEPTION` + `ROLLBACK`.
- tsc del front: 24 errores (94 en total), ninguno nuevo. Verificar en WebKit además de Chrome.
- No tocar copias `*-IgnacioPC.*`. Pruebas en `tests/nocturna-golden/` (excluido de git), capturas al scratchpad.

## Review Focus

1. Dos integrantes de equipos distintos dan el finalizado al mismo tiempo: la tarea queda completada una sola vez. Prueba en Task 2.
2. Doble toque o reintento al crear una compartida: una sola tarea y sin equipos duplicados. Prueba en Task 1.
3. Un integrante sale del equipo con la tarea a medias: deja de verla, y el finalizado de su equipo se conserva. Prueba en Task 2.
4. "Todas las que faltan" en una serie compartida: no borra los finalizados de repeticiones pasadas ni completadas. Prueba en Task 2.
5. Front publicado con JSON viejo, o integrante sin `equipos`: `compartida` cae en `false` y `equipos` en `null`, sin romper ninguna pantalla. Prueba en Task 7.

---

### Task 1: Modelo, crear y lo que ve cada uno

**Files:**
- Create: `sql/agenda_tareas_compartidas.sql`, `sql/ROLLBACK_agenda_tareas_compartidas.sql`, `sql/PROBAR_agenda_tareas_compartidas.sql`
- Create (scratchpad): `sql/definiciones.cjs` (guarda `pg_get_functiondef` de cada función en un archivo; `consulta.cjs` corta a 4000 caracteres) y `sql/probar-compartidas.cjs` (manda migración + PROBAR en una sola transacción)

**Interfaces:**
- Produces, tabla: `agenda_tarea_equipos(tarea_id, subdepartamento_id, finalizado_at, finalizado_por)`
- Produces, JSON: `compartida: boolean`; `equipos: [{id, nombre, color, archivado, finalizado_at, finalizado_por: {id, nombre}|null}] | null`
- Produces, funciones: `agenda_tarea_json(t agenda_tareas, p_contexto uuid DEFAULT NULL)`; `agenda_mis_equipos_de_tarea(p_tarea uuid) RETURNS uuid[]` (equipos de `auth.uid()` en esa tarea, no archivados); `agenda_crear_tarea(…, p_subs uuid[] DEFAULT NULL)`

- [ ] **Step 1: Escribir los casos en el PROBAR**, con el estilo de `PROBAR_agenda_plazos_y_repeticiones.sql` (Elsa encargada, equipos A y B con Lalo y Mina, Otto ajeno):
  - crear con `p_subs` de 2 equipos deja una fila, `compartida = true`, `subdepartamento_id IS NULL`, `estado = 'en_proceso'`, 2 filas de equipos
  - `p_subs` con 1 equipo → motivo `compartida_minimo`; con un equipo ajeno → `sub_ajeno`; con uno archivado → `archivado`
  - mismo `p_id` dos veces → `ya_existia`, siguen 2 filas de equipos (Review Focus 2)
  - con `p_frecuencia` y 6 fechas → 6 tareas y 12 filas de equipos
  - Elsa recibe `equipos` y `subdepartamento = null`; Lalo recibe su `subdepartamento`, `estado` de su equipo y `equipos = null`; `la_tienen` de Lalo trae sólo a su equipo; Otto → `sin_permiso`
  - `agenda_mis_tareas`, `agenda_tareas_subdepartamento` y `agenda_tareas_departamento` la incluyen una vez cada una, y sin duplicar a quien está en dos equipos
  - sin `p_subs`, el JSON de una tarea común es igual al de antes más `compartida: false, equipos: null`
- [ ] **Step 2: Correrlo** con `node probar-compartidas.cjs`. Esperado: falla porque no existe la tabla.
- [ ] **Step 3: Escribir la migración de esta parte**: tabla con RLS y `REVOKE ALL`, columna, `agenda_tareas_completada_ck` nueva (`estado <> 'completada' OR subdepartamento_id IS NOT NULL OR compartida`), y las funciones de Interfaces más `agenda_puede_ver_tarea`, `agenda_tarea`, `agenda_mis_tareas`, `agenda_tareas_subdepartamento`, `agenda_tareas_departamento`. Al cambiar una firma, `DROP` de la anterior y mismos `GRANT`.
- [ ] **Step 4: Correrlo.** Esperado: todos los casos OK y, al final, el `ROLLBACK`.
- [ ] **Step 5: Commit** `feat(agenda): tareas compartidas, modelo y creación`

### Task 2: Finalizar, deshacer, editar y reasignar

**Files:** Modify los tres `sql/*agenda_tareas_compartidas.sql`

**Interfaces:**
- Consumes: `agenda_tarea_equipos`, `agenda_mis_equipos_de_tarea`
- Produces: `agenda_cambiar_estado_tarea(p_id uuid, p_estado text, p_sub uuid DEFAULT NULL)`; `agenda_editar_tarea(…, p_subs uuid[] DEFAULT NULL)`; `agenda_recalcular_compartida(p_tarea uuid)` (cerrada); motivos `solo_el_departamento`, `es_compartida`, `sin_equipos`

`agenda_recalcular_compartida` aplica la regla del spec, siempre con la fila tomada con `FOR UPDATE`:

| Equipos no archivados | Resultado |
|---|---|
| Alguno pendiente | `en_proceso`, sin `completada_at` |
| Todos terminados (al menos uno) | `completada`, con `completada_at` y `completada_por = auth.uid()` si no lo estaba |
| Ninguno, y algún finalizado en los archivados | `completada` |
| Ninguno, y ningún finalizado | `esperando` |

- [ ] **Step 1: Agregar casos**:
  - Lalo (equipo A) finaliza: A marcado, tarea `en_proceso`; Lalo la ve `completada`, Mina (equipo B) `en_proceso`
  - Mina finaliza: tarea `completada`, `completada_por = Mina`. También en el orden inverso
  - dos finalizados seguidos del mismo equipo → `sin_cambios`, sin tocar `finalizado_por`
  - concurrencia: comprobar que la función toma `FOR UPDATE` antes de contar y que un segundo cierre no vuelve a escribir `completada_at` (Review Focus 1)
  - Lalo deshace → `solo_el_departamento`; Elsa deshace A con `p_sub` → A pendiente y tarea de vuelta a `en_proceso`
  - Elsa finaliza por B con `p_sub`; Elsa sin `p_sub` en una compartida → `sin_equipos`
  - persona en A y B, sin `p_sub`: marca los dos; con `p_sub = A`: sólo A
  - Mina sale de B: deja de verla, y lo que B había finalizado sigue (Review Focus 3)
  - editar con `p_subs`: sumar C deja C pendiente; sacar al único pendiente completa la tarea; `p_subs` vacío → `sin_equipos`; Lalo editando → `sin_permiso`
  - repetición: `solo_esta` toca sólo esa; `las_que_faltan` con otra frecuencia rearma las pendientes con los equipos, sin finalizados, y deja intactas las pasadas y las completadas (Review Focus 4)
  - `agenda_reasignar_tarea` sobre una compartida → `es_compartida`
  - una tarea común sigue reabriéndose por su integrante
- [ ] **Step 2: Correrlo.** Esperado: fallan los nuevos.
- [ ] **Step 3: Implementar** las funciones de Interfaces y el corte de `agenda_reasignar_tarea`. Una tarea compartida no se puede volver común ni al revés: `p_subs` en una común → `es_compartida`.
- [ ] **Step 4: Correrlo.** Esperado: todos OK.
- [ ] **Step 5: Commit** `feat(agenda): finalizado por equipo en las tareas compartidas`

### Task 3: Avisos

**Files:** Modify los tres `sql/*agenda_tareas_compartidas.sql`; `pages/admin/notificaciones/piezas.tsx` (ejemplo del aviso nuevo)

**Interfaces:**
- Produces: catálogo `agenda_tarea_equipo_termino`, variables `tarea`, `subdepartamento`, `pendientes`; tipo de aviso `equipo_termino:<sub>`

- [ ] **Step 1: Agregar casos**, contando filas de `app_notifications`:
  - crear compartida para A y B: "asignada" a la gente de ambos, sin encargados; quien está en los dos recibe una
  - serie compartida: un solo aviso por persona
  - A finaliza: a los encargados, un "terminó un equipo" que nombra lo que falta; deshacer y volver a finalizar no lo repite
  - último equipo: a los encargados, un `agenda_tarea_completada` con los nombres de los equipos, no "Sin equipo"
  - sumar C al editar: "asignada" sólo a C
  - `agenda_plazos_vencidos_tick`: sólo a los equipos pendientes
  - una tarea común: los mismos avisos que antes
- [ ] **Step 2: Correrlo.** Esperado: fallan los nuevos.
- [ ] **Step 3: Implementar**: ampliar `agenda_avisos.tipo` para aceptar `equipo_termino:%`, fila de catálogo, trigger sobre `agenda_tarea_equipos` que respeta `agenda.serie_en_lote`, y cambios en `agenda_tareas_avisar`, `agenda_avisar_serie` y `agenda_plazos_vencidos_tick`.
- [ ] **Step 4: Correrlo.** Esperado: todos OK.
- [ ] **Step 5: Commit** `feat(agenda): avisos de las tareas compartidas`

### Task 4: Contadores y archivar o eliminar un equipo

**Files:** Modify los tres `sql/*agenda_tareas_compartidas.sql`

- [ ] **Step 1: Agregar casos**:
  - `agenda_departamento`: una compartida cuenta 1 en `en_proceso`, y `para_hoy` igual
  - `agenda_subdepartamento`, `agenda_departamentos_admin`, `agenda_mi_acceso`: `en_proceso` del equipo son sus partes pendientes; `completadas_mes` sus `finalizado_at` del mes
  - archivar B con A terminado: la tarea se completa; archivar B con A pendiente: sigue en proceso; archivar A y B sin finalizados: `esperando`; una de ellas ya finalizada: `completada`
  - eliminar un equipo: igual que archivar, y su fila desaparece
  - borrar la tarea: las filas de equipos se van por cascada
- [ ] **Step 2: Correrlo.** Esperado: fallan los nuevos.
- [ ] **Step 3: Implementar** los cambios en esas funciones.
- [ ] **Step 4: Correrlo.** Esperado: todos OK.
- [ ] **Step 5: Commit** `feat(agenda): contadores y archivado con tareas compartidas`

### Task 5: Rollback y regresión

**Files:** Modify `sql/ROLLBACK_agenda_tareas_compartidas.sql`

- [ ] **Step 1: Completar el ROLLBACK**: restaura cada definición viva guardada por `definiciones.cjs`, la restricción y el CHECK de avisos; borra catálogo, trigger, tabla y columna. Si ya hay compartidas, el script frena con una excepción en vez de borrar datos.
- [ ] **Step 2: Probarlo** en una transacción: migración + ROLLBACK + `definiciones.cjs` comparado con el original. Esperado: sin diferencias en las funciones.
- [ ] **Step 3: Correr la regresión**: migración + `PROBAR_agenda_origen.sql` y migración + `PROBAR_agenda_plazos_y_repeticiones.sql`, cada una en su transacción. Esperado: iguales que sin la migración.
- [ ] **Step 4: Revisar permisos**: `select proname from pg_proc where not prosecdef and has_function_privilege('authenticated', oid, 'execute')` no suma ninguna función `agenda_*`; `agenda_tarea_equipos` y las auxiliares nuevas cerradas para `authenticated`.
- [ ] **Step 5: Commit** `feat(agenda): rollback de las tareas compartidas`

### Task 6: Aplicar en producción

- [x] **Step 1: Pedir la aprobación explícita de Ignacio** con el resultado de las pruebas. Sin ella, frenar acá: las tareas siguientes se pueden hacer con datos interceptados, pero no se publican.
- [x] **Step 2: Aplicar** `sql/agenda_tareas_compartidas.sql`.
- [x] **Step 3: Verificar** como `authenticated`, en `BEGIN … ROLLBACK`, una compartida completa con personas de prueba. Esperado: los mismos resultados y 0 filas nuevas después.
- [x] **Step 4: Anotar** la aplicación en `instrucciones_ia.md`, sección 39.

### Task 7: Servicio y pantallas del integrante

**Files:** Modify `services/agenda.ts`, `pages/agenda/piezasAgenda.tsx`, `pages/departamentos/tareas/TarjetaTarea.tsx`, `pages/agenda/calendario.ts`, `components/agenda/DetalleTarea.tsx`; Create `tests/nocturna-golden/vistazo-agenda-compartidas.spec.ts`

**Interfaces:**
- Produces: `interface EquipoDeTarea { id; nombre; color; archivado: boolean; finalizadoAt: string | null; finalizadoPor: { id: string; nombre: string | null } | null }`
- Produces: `Tarea.compartida: boolean` y `Tarea.equipos: EquipoDeTarea[] | null`
- Produces: `DatosDeTarea.subdepartamentoIds?: string[] | null` → `p_subs`; `cambiarEstadoTarea(id, estado, subId?: string)`
- Produces: `avanceDeTarea(t: Tarea): string` en `pages/agenda/plazos.ts` ("Diseño ya terminó · falta Video"; "Falta Diseño y Video" si no terminó ninguno)

- [ ] **Step 1: Escribir las pruebas**: mapeo sin `compartida` ni `equipos` → `false` y `null` sin error (Review Focus 5); un integrante ve la etiqueta "Compartida", no ve otros equipos ni avance, y no tiene "Volver a En proceso" con su parte terminada; `avanceDeTarea` en la suite pura.
- [ ] **Step 2: Correrlas.** Esperado: fallan.
- [ ] **Step 3: Implementar** las Interfaces; `mensajeDeMotivo` con `solo_el_departamento`, `es_compartida`, `sin_equipos`, `compartida_minimo`; la etiqueta; `estaEsperando` falso para una compartida en proceso.
- [ ] **Step 4: Correrlas**, junto con tsc. Esperado: pasan, tsc sin errores nuevos.
- [ ] **Step 5: Commit** `feat(agenda): tareas compartidas en el servicio y la vista del integrante`

### Task 8: La pregunta en el formulario y editar equipos

**Files:** Modify `components/agenda/FormularioTarea.tsx`, `components/agenda/ComboboxDeSub.tsx`, `pages/departamentos/tareas/PestanaTareas.tsx`, `pages/departamentos/solicitudes/PestanaSolicitudes.tsx`

**Interfaces:**
- Consumes: `DatosDeTarea.subdepartamentoIds`, `Tarea.compartida`, `Tarea.equipos`
- Produces: estado `compartida: boolean | null`; `ComboboxDeSub` con prop opcional `sinOpcionSinAsignar`

- [ ] **Step 1: Escribir las pruebas**:
  - con 2 equipos aparece "¿La tarea es compartida?", sin marcar, y "Falta: si es compartida." lleva hasta ahí; error: "Elegí si la tarea es compartida."
  - "Todos" también la muestra; volver a 1 equipo o a "Sin asignar" la saca y borra la respuesta
  - "Sí, una sola tarea": un solo `agenda_crear_tarea`, con `p_sub: null`, `p_subs` con los dos y `p_solicitud` si la hay; botón "Crear tarea"; aviso "Tarea compartida creada para 2 equipos."
  - "No, una por equipo": sigue el flujo de copias, botón "Crear 2 tareas"
  - "La van a ver" dice "Se completa cuando todos los equipos dan el finalizado."
  - el tilde de "Quién" exige la respuesta
  - editar una compartida: varios equipos, sin "Sin asignar" ni la pregunta; manda `p_subs` sólo si cambiaron; sin equipos, no guarda
  - la comparación con `payloads/antes` sigue idéntica
- [ ] **Step 2: Correrlas.** Esperado: fallan.
- [ ] **Step 3: Implementar.** `compartida` se suma a `invalido` y a `queFrena` entre "sub-departamento" y "día".
- [ ] **Step 4: Correrlas**, en compu y WebKit, con capturas. Esperado: pasan.
- [ ] **Step 5: Commit** `feat(agenda): preguntar si la tarea es compartida`

### Task 9: Lo que ve el admin

**Files:** Modify `components/agenda/DetalleTarea.tsx`, `pages/agenda/piezasAgenda.tsx`, `pages/departamentos/tareas/TarjetaTarea.tsx`, `components/agenda/piezasPlazo.tsx`, `pages/agenda/calendario.ts`, `pages/agenda/PaginaAgenda.tsx`

**Interfaces:**
- Consumes: `cambiarEstadoTarea(id, estado, subId)`, `avanceDeTarea`, `Tarea.equipos`

- [ ] **Step 1: Escribir las pruebas**:
  - detalle: una fila por equipo con su estado, "Marcar terminado" o "Deshacer" con confirmación, y las llamadas con `p_sub`
  - no aparecen "Marcar como completada", "Volver a En proceso" ni "Reasignar" globales
  - tarjeta, Lista, Semana, Día y Mes: línea de avance y color neutro
  - filtro de equipos: se ve si está prendido alguno de sus equipos, y se oculta si están todos apagados
  - una compartida en proceso no cae en "Esperando asignación"
- [ ] **Step 2: Correrlas.** Esperado: fallan.
- [ ] **Step 3: Implementar.** `colorDe` devuelve el `GRIS` existente en una compartida del admin.
- [ ] **Step 4: Correr todas las suites de Agenda** en compu y WebKit, tsc y las pruebas puras, y revisar las capturas. Esperado: todo pasa y las tareas comunes no cambian (comparación de píxeles contra HEAD en Semana y Mes).
- [ ] **Step 5: Documentar** en `instrucciones_ia.md`, sección 39.
- [ ] **Step 6: Commit** `feat(agenda): el avance de las tareas compartidas para el admin`

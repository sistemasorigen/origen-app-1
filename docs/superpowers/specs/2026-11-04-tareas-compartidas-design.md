# Tareas compartidas entre sub-departamentos

Diseño para aprobar. Fecha: 2026-11-04. Pedido por Ignacio. Lo marcado **[mi decisión]** no lo definió él: lo propuse yo y puede corregirlo al leer.

## Para qué

Al crear una tarea para varios sub-departamentos hoy sale una copia por equipo, y cada copia se completa por su lado. A veces un mismo trabajo necesita que varios equipos cumplan su parte, y recién está terminado cuando cumplieron todos. El admin del departamento necesita seguir ese avance; los equipos, no: a cada uno le importa sólo su parte.

## Qué tiene que pasar

| Momento | Comportamiento |
|---|---|
| Crear o asignar con 2 o más equipos (también "Todos") | Aparece "¿La tarea es compartida?", sin respuesta marcada. Es obligatoria: sin contestarla no se guarda |
| Contesta "No" | Una tarea por equipo, como ya funciona (commit `52ddd96`) |
| Contesta "Sí" | Una sola tarea, vinculada a todos los equipos elegidos |
| Un equipo da el finalizado | Para ese equipo pasa a completada: sale de sus pendientes y de su Agenda, y queda en su historial de completadas |
| Equipos que faltan | La siguen viendo "En proceso", sin saber cómo van los demás |
| Admin del departamento | Es el único que ve el avance ("Diseño ya terminó · falta Video") |
| Finaliza el último equipo | La tarea queda completada |
| Deshacer un finalizado | Sólo el admin del departamento. La tarea vuelve a pendientes de ese equipo y, si estaba completada, vuelve a En proceso |

Aprobado también por Ignacio:

- Cualquier integrante del equipo da el finalizado, y vale por todo su equipo.
- A cada equipo le llega el aviso de tarea asignada. El admin recibe uno cuando termina cada equipo y otro cuando se completa toda la tarea.
- Si se pasa la fecha, figura vencida sólo para los equipos que no terminaron.
- Con repeticiones, cada repetición se finaliza por separado, equipo por equipo.
- Editar y borrar son sólo del admin, y valen para todos los equipos.
- El admin puede sumar o sacar equipos después de crearla. Si saca al único que faltaba, la tarea se completa.
- Si se archiva un equipo con su parte pendiente, deja de contar para completar la tarea.
- Una solicitud asignada como compartida queda vinculada a esa única tarea.

## Qué no entra

- Convertir una tarea existente de compartida a no compartida, o al revés **[mi decisión]**.
- Cambiar cómo funcionan las tareas de un solo equipo o las copias por equipo: tienen que seguir idénticas.
- Mostrarles a los equipos el avance de los otros.

Sería un fracaso aunque "funcione" si: un equipo ve cómo van los demás; una tarea queda completada faltando un equipo activo; o cambia algo para las tareas no compartidas.

## Cómo se guarda

El modelo actual dice "una tarea, un equipo" en 24 funciones de la base. Producción no tiene tareas cargadas (0 filas al 2026-11-04), así que no hay datos que migrar.

**Tabla nueva `agenda_tarea_equipos`**: `tarea_id`, `subdepartamento_id` (clave compuesta, las dos con `ON DELETE CASCADE`), `finalizado_at`, `finalizado_por`. RLS activa y sin policies: como el resto de las tablas de tareas, se usa sólo por RPC.

**`agenda_tareas.compartida boolean NOT NULL DEFAULT false`**. En una compartida, `subdepartamento_id` queda NULL: los equipos viven en la tabla nueva. Se descartó guardar "un equipo principal" en esa columna, porque cada consulta que filtra por ella perdería a los demás equipos sin dar error.

**Restricción que cambia:** `agenda_tareas_completada_ck` exige hoy un sub-departamento para completar. Pasa a `estado <> 'completada' OR subdepartamento_id IS NOT NULL OR compartida`.

**`estado` de la fila** es el de la tarea entera: `en_proceso` hasta que terminen todos los equipos que cuentan, y `completada` después, con `completada_por` en quien cerró la última parte. Cuentan los equipos no archivados.

**Sin ningún equipo que cuente** **[mi decisión]**: si los equipos que quedan están todos archivados, la tarea se completa si alguno había terminado, y si no, pasa a `esperando` para que el admin le asigne otros.

## Lo que ve cada uno

Lo resuelve la base, como ya hace con `vencida`. El JSON de una compartida depende de quién mira:

| Quién mira | `subdepartamento` | `estado` | `vencida` | `equipos` |
|---|---|---|---|---|
| Admin, sin contexto de equipo | null | el de la tarea entera | si no está completada y pasó la fecha | la lista con el avance |
| Admin, en el panel de un equipo | ese equipo | el de ese equipo | el de ese equipo | la lista con el avance |
| Integrante | el suyo | el de su equipo | sólo si su equipo no terminó | no viene |

Como el integrante recibe un `subdepartamento` y un `estado` normales, sus pantallas casi no cambian. `la_tienen` también sale filtrado: el integrante ve sólo a su equipo.

**Campo nuevo `compartida`** en el JSON. El integrante ve una etiqueta "Compartida", sin los demás equipos ni el avance **[mi decisión]**: saber que hay otros no es ver el progreso, y explica por qué no puede reabrirla.

**Persona en dos equipos de la misma tarea** **[mi decisión]**: la ve mientras alguno de los suyos no haya terminado, y su finalizado vale para todos los suyos pendientes. Desde el panel de un equipo vale sólo para ese.

**Admin que además integra un equipo**: manda la vista de admin.

## Cambios en la base

Todo en `sql/agenda_tareas_compartidas.sql`, con `ROLLBACK_` y `PROBAR_`. Compatible con el front publicado: los parámetros nuevos tienen valor por defecto y una tarea no compartida responde igual. Al cambiar firmas se borra la anterior para no dejar dos versiones.

| Función | Cambio |
|---|---|
| `agenda_crear_tarea` | `p_subs uuid[] DEFAULT NULL`: si viene, crea una compartida con esos equipos (mínimo 2). Con repetición, una fila de equipos por cada repetición. Sigue idempotente por `p_id` |
| `agenda_editar_tarea` | `p_subs uuid[] DEFAULT NULL`: suma y saca equipos (mínimo 1), y completa la tarea si sólo faltaba el que se sacó. Respeta `p_alcance`. Al rearmar una serie, copia los equipos a las repeticiones nuevas, sin finalizados |
| `agenda_cambiar_estado_tarea` | `p_sub uuid DEFAULT NULL`. Completar marca la parte del equipo; deshacer es sólo del admin (motivo nuevo `solo_el_departamento`). El admin puede marcar o deshacer por cualquier equipo **[mi decisión]**, como hoy puede completar cualquier tarea |
| `agenda_reasignar_tarea` | Una compartida devuelve el motivo nuevo `es_compartida` |
| `agenda_tarea_json`, `agenda_tarea` | La tabla de "Lo que ve cada uno" |
| `agenda_puede_ver_tarea`, `agenda_mis_tareas`, `agenda_tareas_subdepartamento`, `agenda_tareas_departamento` | Incluyen las compartidas según la tabla de equipos. El equipo que terminó la sigue teniendo como completada |
| `agenda_departamento`, `agenda_subdepartamento`, `agenda_departamentos_admin`, `agenda_mi_acceso` | Contadores: en el departamento, una compartida cuenta una vez; en un equipo, `en_proceso` son sus partes pendientes y `completadas_mes` sus `finalizado_at` del mes |
| `agenda_plazos_vencidos_tick` | Avisa sólo a los equipos que no terminaron |
| `agenda_avisar_serie`, `agenda_tareas_avisar` | Aviso de asignada a cada equipo, un solo aviso por serie. `completada` nombra a los equipos en vez de "Sin equipo" |
| `agenda_archivar_subdepartamento`, `agenda_eliminar_subdepartamento` | Sacan al equipo de la cuenta; completan o devuelven a `esperando` según corresponda |

Las otras funciones de las 24 (`agenda_agregar_miembros`, `agenda_cambiar_lider`, `agenda_es_miembro`, `agenda_guardar_subdepartamento`, `agenda_mover_miembro`, `agenda_quitar_miembro`) no leen ni escriben tareas: miran `subdepartamento_id` de los miembros, y no cambian.

**Avisos.** `agenda_avisos` no repite por `(tarea, usuario, tipo, canal)` y su `tipo` hoy sólo admite `asignada` y `completada`. "Terminó un equipo" necesita un `tipo` por equipo: se amplía ese CHECK para aceptar `equipo_termino:<sub>`. Por esa misma regla, deshacer y volver a finalizar no repite el aviso, igual que hoy al reabrir y completar, y una persona en dos equipos recibe un solo "asignada". Al sumar un equipo después, le llega "asignada" a su gente. El aviso nuevo se llama `agenda_tarea_equipo_termino` y va al catálogo de `sql/notif_catalogo.sql`, con su fila en la pantalla de notificaciones.

## Cambios en las pantallas

**Formulario.** En "Quién la hace", debajo del selector y sólo al crear con 2 o más equipos: "¿La tarea es compartida?" con dos opciones, "Sí, una sola tarea" y "No, una por equipo", sin ninguna marcada.

- Falta contestar: el aviso dice "Falta: si es compartida", lleva hasta ahí y aparece el error debajo del campo.
- Bajar a un solo equipo o a "Sin asignar" borra la respuesta.
- El botón dice "Crear tarea" si es compartida y "Crear N tareas" si no.
- La aclaración de "La van a ver" cambia a "Se completa cuando todos los equipos dan el finalizado."
- El tilde de la pastilla "Quién" exige también esta respuesta.
- Con un solo equipo, lo que se manda a la base tiene que seguir idéntico.

**Editar una compartida (admin).** El selector permite varios y exige al menos uno; no ofrece "Sin asignar" ni la pregunta.

**Detalle (admin).** Lista de equipos con su estado, con "Marcar terminado" o "Deshacer" en cada uno, con confirmación. No aparecen "Marcar como completada" global, "Volver a En proceso" global ni "Reasignar".

**Detalle (integrante).** "Marcar como completada" como siempre. Con su parte terminada no hay "Volver a En proceso".

**Tarjetas y Agenda (admin).** Una línea de avance ("Diseño ya terminó · falta Video"). Sin color de un solo equipo: usa un color neutro **[mi decisión]**. `estaEsperando` deja de tratar como "esperando" a una compartida. El filtro por equipo de la Agenda la muestra si está prendido alguno de sus equipos.

**Avisos en pantalla.** `mensajeDeMotivo` suma `solo_el_departamento` y `es_compartida`. Los textos después de crear dicen "Tarea compartida creada para N equipos."

## Cómo se prueba

- `PROBAR_agenda_tareas_compartidas.sql`, en una transacción que termina en `ROLLBACK`. Las RPC se llaman **como `authenticated`**, no como postgres: así salió roto "¿Se repite?" en producción.
- Casos: dos equipos terminan en los dos órdenes; deshacer; sacar al último; archivar; persona en dos equipos; un integrante no puede deshacer ni ver `equipos`; repeticiones; contadores; avisos sin repetir.
- Corren también `PROBAR_agenda_origen.sql` y `PROBAR_agenda_plazos_y_repeticiones.sql`, para confirmar que lo no compartido no cambió.
- Playwright en compu y WebKit: formulario, los tres puntos de vista y la comparación de lo que se manda con un solo equipo.

## Orden de puesta en marcha

1. Escribir el SQL y probarlo sin dejar datos en producción.
2. Aplicarlo con aprobación explícita de Ignacio. El front publicado sigue funcionando.
3. Publicar las pantallas sólo cuando Ignacio pida el deploy.

## Queda a criterio de quien lo construya

Nombres internos y mensajes de los motivos, diseño de la lista de equipos en el detalle, y el texto exacto del aviso nuevo.

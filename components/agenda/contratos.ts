import type { Carpeta, Prioridad, Subdepartamento, Tarea } from '../../services/agenda';
import type { PedidoConfirmacion } from '../../pages/admin/piezasAdmin';

/**
 * El contrato de las piezas de tarea que se reusan.
 *
 * `DetalleTarea` y `FormularioTarea` los usan la pestaña Tareas de un
 * departamento (prompt 4), las Solicitudes (prompt 5) y la Agenda (prompt 7).
 * Esas tres pantallas tienen su propio modal de confirmación y su propio
 * aviso flotante, así que las piezas no traen uno: lo piden.
 *
 * Nada de esto decide permisos. Lo que se puede hacer con una tarea lo dice
 * `agenda_tarea` en `puedeEditar` y `puedeCambiarEstado`; estos tipos sólo
 * dicen qué tiene a mano la pantalla que la muestra.
 */

export interface AccionesDeAgenda {
    /** Abre el modal de confirmación de la pantalla. */
    confirmar: (pedido: PedidoConfirmacion) => void;
    /** El aviso flotante de la pantalla. */
    avisar: (texto: string, tipo?: 'ok' | 'error') => void;
}

/**
 * Lo que hace falta para editar o reasignar una tarea: los equipos, las
 * carpetas y las prioridades del departamento. La Agenda de un miembro no
 * los tiene, y sin ellos esas acciones no se ofrecen.
 */
export interface DatosParaEditar {
    departamentoId: string;
    /** Los sub-departamentos vivos del departamento (los archivados no vienen). */
    subdepartamentos: Subdepartamento[];
    carpetas: Carpeta[];
    prioridades: Prioridad[];
    /** Para la nota al pie del formulario ("por Nombre Apellido"). */
    miNombre?: string | null;
    /**
     * "Nueva carpeta…": la pantalla abre SU formulario de carpeta y avisa
     * cuál se creó. Así el formulario de tarea no depende de una pantalla.
     */
    onPedirCarpeta?: (alCrear: (carpeta: Carpeta) => void) => void;
    /** Lleva a la configuración del departamento (no hay prioridades cargadas). */
    onIrAConfig?: () => void;
}

/** Lo que pasó con una tarea, para que la lista de atrás se actualice. */
export type CambioDeTarea =
    | { tipo: 'guardada'; tarea: Tarea; creada: boolean }
    | { tipo: 'eliminada'; id: string };

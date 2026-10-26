/**
 * Agenda Origen · colores, íconos y estados.
 *
 * La ÚNICA fuente: las pantallas de departamentos, sub-departamentos, tareas
 * y solicitudes importan de acá, para que un "Violeta" o un "En proceso" sean
 * el mismo en todas.
 *
 * Salen de los diseños (design-claude/agenda-core.js, que comparten
 * "Sistemas - Departamentos.dc.html" y las demás pantallas de la Agenda):
 *   · PALETA  → los 12 colores, en el orden del selector.
 *   · ICONOS  → los 24 íconos de departamento. La clave es el nombre de
 *     lucide en kebab-case, que es lo que guarda agenda_departamentos.icono
 *     (el CHECK de la base pide ^[a-z0-9-]{2,30}$). El diseño los llamaba
 *     distinto en dos casos: "hands" es hand-heart y "message" es
 *     message-circle (mismos trazos). Verificados contra lucide-react 0.555.
 *   · ESTADOS → los colores de los tres estados de una tarea.
 *
 * Sólo datos: sin componentes ni imports de UI.
 */

import type { EstadoTarea } from '../../services/agenda';

export interface ColorDeAgenda {
    hex: string;
    nombre: string;
}

/** Los 12 colores de departamentos, sub-departamentos, carpetas y prioridades. */
export const PALETA: readonly ColorDeAgenda[] = [
    { hex: '#7c3aed', nombre: 'Violeta' },
    { hex: '#4f46e5', nombre: 'Índigo' },
    { hex: '#2563eb', nombre: 'Azul' },
    { hex: '#0e7490', nombre: 'Cian' },
    { hex: '#0f766e', nombre: 'Verde azulado' },
    { hex: '#15803d', nombre: 'Verde' },
    { hex: '#4d7c0f', nombre: 'Oliva' },
    { hex: '#b45309', nombre: 'Ámbar' },
    { hex: '#c2410c', nombre: 'Naranja' },
    { hex: '#dc2626', nombre: 'Rojo' },
    { hex: '#db2777', nombre: 'Rosa' },
    { hex: '#c026d3', nombre: 'Fucsia' },
];

export interface IconoDeDepartamento {
    /** Nombre lucide en kebab-case: lo que se guarda en la base. */
    clave: string;
    nombre: string;
}

/** Los 24 íconos de departamento, en el orden del selector. */
export const ICONOS: readonly IconoDeDepartamento[] = [
    { clave: 'palette', nombre: 'Paleta' },
    { clave: 'camera', nombre: 'Cámara' },
    { clave: 'video', nombre: 'Video' },
    { clave: 'mic', nombre: 'Micrófono' },
    { clave: 'music', nombre: 'Música' },
    { clave: 'megaphone', nombre: 'Megáfono' },
    { clave: 'heart', nombre: 'Corazón' },
    { clave: 'hand-heart', nombre: 'Manos' },
    { clave: 'users', nombre: 'Personas' },
    { clave: 'book', nombre: 'Libro' },
    { clave: 'calendar', nombre: 'Calendario' },
    { clave: 'coffee', nombre: 'Café' },
    { clave: 'star', nombre: 'Estrella' },
    { clave: 'shield', nombre: 'Escudo' },
    { clave: 'monitor', nombre: 'Monitor' },
    { clave: 'pencil', nombre: 'Lápiz' },
    { clave: 'wrench', nombre: 'Herramienta' },
    { clave: 'baby', nombre: 'Bebé' },
    { clave: 'globe', nombre: 'Globo' },
    { clave: 'message-circle', nombre: 'Mensaje' },
    { clave: 'car', nombre: 'Auto' },
    { clave: 'house', nombre: 'Casa' },
    { clave: 'gift', nombre: 'Regalo' },
    { clave: 'sparkles', nombre: 'Chispa' },
];

export interface ColoresDeEstado {
    /** Cómo se dice en pantalla. */
    etiqueta: string;
    /** El texto de la pastilla. */
    tinta: string;
    /** El fondo de la pastilla. */
    fondo: string;
    /** El punto de color. */
    punto: string;
}

/** Los tres estados de una tarea. */
export const ESTADOS: Readonly<Record<EstadoTarea, ColoresDeEstado>> = {
    esperando: { etiqueta: 'Esperando asignación', tinta: '#8a4b06', fondo: 'rgba(180,83,9,.12)', punto: '#d08a2c' },
    en_proceso: { etiqueta: 'En proceso', tinta: '#1d4ed8', fondo: 'rgba(37,99,235,.11)', punto: '#2563eb' },
    completada: { etiqueta: 'Completada', tinta: '#15803d', fondo: 'rgba(21,128,61,.12)', punto: '#16a34a' },
};

/** Las cuatro que crea "Usar las sugeridas" (agenda_prioridades_sugeridas), en ese orden. */
export const PRIORIDADES_SUGERIDAS: readonly ColorDeAgenda[] = [
    { hex: '#9ca3af', nombre: 'Baja' },
    { hex: '#2563eb', nombre: 'Normal' },
    { hex: '#f97316', nombre: 'Alta' },
    { hex: '#dc2626', nombre: 'Urgente' },
];

// ════════════════════════════════════════════════════════════════════════
// /reportes/puntoinfo/bautismos-detalles
//
// Implementa design-claude/Reportes Punto de Informacion - Bautismos.dc.html.
// La pantalla entera vive en components/Reportes/PlanillaSolicitudes.tsx:
// acá sólo está lo que distingue a los bautismos de las presentaciones.
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import PlanillaSolicitudes, {
    DefinicionPlanilla, PASTILLA, fechaDeDia,
} from '../../components/Reportes/PlanillaSolicitudes';
import { fechaCorta, horaCorta, fechaYHora } from '../../services/reportesPuntoInfo';

/** Lo que no está cargado se escribe así, nunca vacío. */
const oGuion = (valor: string | null | undefined) => valor && valor.trim() ? valor : '—';

const BAUTISMOS: DefinicionPlanilla = {
    tipo: 'bautismos',
    titulo: 'Bautismos',
    sustantivo: 'Bautismos',
    subFicha: 'Solicitud de bautismo',
    nombreDe: f => f.nombreCompleto,

    columnas: [
        {
            titulo: 'SOLICITUD',
            ancho: 'minmax(0,1.1fr)',
            celda: f => ({ tipo: 'texto', txt: fechaCorta(f.solicitud) || '—', sub: horaCorta(f.solicitud), fuerte: true }),
        },
        { titulo: 'NOMBRE', ancho: 'minmax(0,.9fr)', celda: f => ({ tipo: 'texto', txt: oGuion(f.nombre), fuerte: true }) },
        { titulo: 'APELLIDO', ancho: 'minmax(0,.9fr)', celda: f => ({ tipo: 'texto', txt: oGuion(f.apellido), fuerte: true }) },
        { titulo: 'TELÉFONO', ancho: 'minmax(0,1fr)', celda: f => ({ tipo: 'texto', txt: oGuion(f.telefono) }) },
        { titulo: 'EMAIL', ancho: 'minmax(0,1.7fr)', celda: f => ({ tipo: 'texto', txt: oGuion(f.email), tenue: true }) },
        { titulo: 'ESTADO', ancho: '104px', celda: f => ({ tipo: 'pastilla', estado: f.estado }) },
        { titulo: 'FECHA DE REALIZACIÓN', ancho: 'minmax(0,1fr)', celda: f => ({ tipo: 'texto', txt: fechaDeDia(f.realizacion) }) },
    ],

    campos: f => [
        { rotulo: 'Nombre', valor: oGuion(f.nombre) },
        { rotulo: 'Apellido', valor: oGuion(f.apellido) },
        { rotulo: 'Teléfono', valor: oGuion(f.telefono) },
        { rotulo: 'Email', valor: oGuion(f.email) },
        { rotulo: 'Fecha y hora de la solicitud', valor: fechaYHora(f.solicitud) || '—' },
        { rotulo: 'Estado', valor: f.estado, pastilla: PASTILLA[f.estado] },
        { rotulo: 'Fecha de realización', valor: fechaDeDia(f.realizacion) },
    ],

    buscarEn: f => [f.nombre, f.apellido, f.nombreCompleto],
    buscarPh: 'Buscar por nombre, apellido o teléfono',

    excel: f => ({
        'SOLICITUD': fechaYHora(f.solicitud),
        'NOMBRE': f.nombre || '',
        'APELLIDO': f.apellido || '',
        'TELÉFONO': f.telefono || '',
        'EMAIL': f.email || '',
        'ESTADO': f.estado,
        'FECHA DE REALIZACIÓN': f.realizacion ? fechaDeDia(f.realizacion) : '',
    }),
    archivo: 'Bautismos',

    sinRealizados: 'No hubo bautismos realizados en este período.',
    nota: 'Muestra las solicitudes y los bautismos del período, más todos los pendientes de hoy. Es solo de lectura.',
};

const ReportesPuntoInfoBautismos: React.FC = () => <PlanillaSolicitudes def={BAUTISMOS} />;

export default ReportesPuntoInfoBautismos;

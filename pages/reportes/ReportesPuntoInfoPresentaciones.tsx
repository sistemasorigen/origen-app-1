// ════════════════════════════════════════════════════════════════════════
// /reportes/puntoinfo/presentacion-detalles
//
// Implementa design-claude/Reportes Punto de Informacion - Presentaciones.dc.html
// —que es el mismo archivo que el de bautismos con una línea distinta—, así
// que la pantalla entera vive en components/Reportes/PlanillaSolicitudes.tsx
// y acá sólo está lo propio de las presentaciones.
//
// La madre y el padre van en columnas separadas, cada uno con su guión si no
// está cargado: nunca se los junta con " y ", que con uno solo dejaba la
// frase colgada.
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import PlanillaSolicitudes, {
    DefinicionPlanilla, PASTILLA, fechaDeDia,
} from '../../components/Reportes/PlanillaSolicitudes';
import { fechaCorta, horaCorta, fechaYHora } from '../../services/reportesPuntoInfo';

/** Lo que no está cargado se escribe así, nunca vacío. */
const oGuion = (valor: string | null | undefined) => valor && valor.trim() ? valor : '—';

const PRESENTACIONES: DefinicionPlanilla = {
    tipo: 'presentaciones',
    titulo: 'Presentación de niños',
    sustantivo: 'Presentaciones',
    subFicha: 'Solicitud de presentación',
    nombreDe: f => f.nombreCompleto,

    columnas: [
        {
            titulo: 'SOLICITUD',
            ancho: 'minmax(0,1.05fr)',
            celda: f => ({ tipo: 'texto', txt: fechaCorta(f.solicitud) || '—', sub: horaCorta(f.solicitud), fuerte: true }),
        },
        { titulo: 'NIÑO/A', ancho: 'minmax(0,1.1fr)', celda: f => ({ tipo: 'texto', txt: oGuion(f.nombreCompleto), fuerte: true }) },
        { titulo: 'MADRE', ancho: 'minmax(0,1.1fr)', celda: f => ({ tipo: 'texto', txt: oGuion(f.madre) }) },
        { titulo: 'PADRE', ancho: 'minmax(0,1.1fr)', celda: f => ({ tipo: 'texto', txt: oGuion(f.padre) }) },
        { titulo: 'TELÉFONO', ancho: 'minmax(0,.95fr)', celda: f => ({ tipo: 'texto', txt: oGuion(f.telefono) }) },
        { titulo: 'EMAIL', ancho: 'minmax(0,1.5fr)', celda: f => ({ tipo: 'texto', txt: oGuion(f.email), tenue: true }) },
        { titulo: 'FECHA AGENDADA', ancho: 'minmax(0,.85fr)', celda: f => ({ tipo: 'texto', txt: fechaDeDia(f.agendada) }) },
        { titulo: 'ESTADO', ancho: '100px', celda: f => ({ tipo: 'pastilla', estado: f.estado }) },
        { titulo: 'REALIZACIÓN', ancho: 'minmax(0,.85fr)', celda: f => ({ tipo: 'texto', txt: fechaDeDia(f.realizacion) }) },
    ],

    campos: f => [
        { rotulo: 'Niño/a', valor: oGuion(f.nombreCompleto) },
        { rotulo: 'Madre', valor: oGuion(f.madre) },
        { rotulo: 'Padre', valor: oGuion(f.padre) },
        { rotulo: 'Teléfono de contacto', valor: oGuion(f.telefono) },
        { rotulo: 'Email', valor: oGuion(f.email) },
        { rotulo: 'Fecha y hora de la solicitud', valor: fechaYHora(f.solicitud) || '—' },
        { rotulo: 'Fecha agendada', valor: fechaDeDia(f.agendada) },
        { rotulo: 'Estado', valor: f.estado, pastilla: PASTILLA[f.estado] },
        { rotulo: 'Fecha de realización', valor: fechaDeDia(f.realizacion) },
    ],

    buscarEn: f => [f.nombreCompleto, f.madre, f.padre],
    buscarPh: 'Buscar por niño/a, madre, padre o teléfono',

    excel: f => ({
        'SOLICITUD': fechaYHora(f.solicitud),
        'NIÑO/A': f.nombreCompleto || '',
        'MADRE': f.madre || '',
        'PADRE': f.padre || '',
        'TELÉFONO': f.telefono || '',
        'EMAIL': f.email || '',
        'FECHA AGENDADA': f.agendada ? fechaDeDia(f.agendada) : '',
        'ESTADO': f.estado,
        'REALIZACIÓN': f.realizacion ? fechaDeDia(f.realizacion) : '',
    }),
    archivo: 'Presentaciones',

    sinRealizados: 'No hubo presentaciones realizadas en este período.',
    nota: 'Muestra las solicitudes y las presentaciones del período, más todos los pendientes de hoy. Es solo de lectura.',
};

const ReportesPuntoInfoPresentaciones: React.FC = () => <PlanillaSolicitudes def={PRESENTACIONES} />;

export default ReportesPuntoInfoPresentaciones;

// ════════════════════════════════════════════════════════════════════════
// Exportación del tablero de /reportes/gcx.
//
// Dos formatos, con criterios distintos:
//
// - EXCEL: sólo los datos, sin títulos ni adornos. Los encabezados son las
//   claves de cada objeto, así que están escritos como se le habla a una
//   persona ("Edad promedio (femenino)"), nunca como la variable del código
//   ("promedioF"). Una columna por dato, para que se pueda filtrar y sumar
//   en la planilla sin tener que separar nada a mano.
//
// - PDF: no hay librería de PDF en el proyecto, y el patrón que ya usa
//   components/Reportes/PanelInteracciones es window.print() + @media print.
//   Se sigue ese: imprime los gráficos de verdad (SVG, no un screenshot),
//   pagina solo y no agrega una dependencia. La pantalla decide qué tarjeta
//   se imprime; acá sólo vive el armado de los datos.
// ════════════════════════════════════════════════════════════════════════
import * as XLSX from 'xlsx';
import { ReportesGCXTemporada, TemporadaGCX, EdadesPorCategoriaFila } from '../../types';
import { NOMBRE_MODALIDAD } from '../../src/utils/modalidad';

// ── Fechas ──────────────────────────────────────────────────────────────
// Viven acá y no en la pantalla porque las usan las dos: el eje del
// calendario y la columna "Día de la semana" del Excel tienen que decir lo
// mismo. El mediodía evita el corrimiento de un día que produce parsear un
// DATE pelado como UTC estando en GMT-3.
export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const aFecha = (iso: string) => new Date(`${iso}T12:00:00`);
export const fechaCorta = (iso: string) => { const d = aFecha(iso); return `${d.getDate()}/${d.getMonth() + 1}`; };
export const fechaLarga = (iso: string) => { const d = aFecha(iso); return `${DIAS_SEMANA[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
export const nombreDia = (iso: string) => DIAS_SEMANA[aFecha(iso).getDay()];
/** dd/mm/aaaa — el formato que una planilla argentina espera leer. */
export const fechaCompleta = (iso: string) => {
    const d = aFecha(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

// ── Modelo de la exportación ────────────────────────────────────────────

/** Cada gráfico del tablero, con la clave que usa la pantalla para imprimirlo. */
export type ClaveGrafico =
    | 'indicadores'
    | 'asistencia'
    | 'reportan'
    | 'cobertura'
    | 'genero'
    | 'edades'
    | 'masReportan'
    | 'noReportan'
    | 'grupoDetalle'
    | 'calendario'
    | 'tabla';

export interface HojaExcel {
    /** Nombre de la pestaña. Se recorta y limpia antes de escribir. */
    nombre: string;
    filas: Array<Record<string, string | number>>;
}

export interface ContextoExport {
    temporada: TemporadaGCX;
    anio: number;
    /** Rango etario elegido en pantalla, que recorta el gráfico de edades. */
    edadMin: number;
    edadMax: number;
}

const NOMBRE_TEMPORADA: Record<TemporadaGCX, string> = { S1: '1', S2: '2', S3: '3' };

const porcentaje = (parte: number, total: number) => total > 0 ? Math.round((parte / total) * 100) : 0;
const promedio = (a: number[]) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;

// ── Una función por gráfico ─────────────────────────────────────────────
// Cada una devuelve las hojas de SU gráfico. El export completo es la
// concatenación de todas, así que no hay dos definiciones de los mismos
// datos que puedan divergir.

const hojaIndicadores = (d: ReportesGCXTemporada): HojaExcel[] => [{
    nombre: 'Indicadores',
    filas: [
        { Indicador: 'Grupos activos', Valor: d.kpis.totalGrupos },
        { Indicador: 'Anfitriones distintos', Valor: d.kpis.anfitriones },
        { Indicador: 'Co-anfitriones distintos', Valor: d.kpis.coAnfitriones },
        { Indicador: 'Personas únicas', Valor: d.kpis.personasUnicas },
        { Indicador: 'Inscripciones totales', Valor: d.kpis.inscripcionesTotales },
        { Indicador: 'Personas en un solo grupo', Valor: d.kpis.distribucion.unGrupo },
        { Indicador: 'Personas en dos grupos', Valor: d.kpis.distribucion.dosGrupos },
        { Indicador: 'Personas en tres o más grupos', Valor: d.kpis.distribucion.tresOMas },
    ],
}];

const hojaAsistencia = (d: ReportesGCXTemporada): HojaExcel[] => {
    const a = d.asistenciaPersonas;
    const base = a.asistieron + a.nuncaAsistieron;
    return [{
        nombre: 'Asistencia de personas',
        filas: [
            { Situación: 'Fue a todas las reuniones de sus grupos', Personas: a.frecuencia.todas, 'Porcentaje sobre la base': `${porcentaje(a.frecuencia.todas, base)}%` },
            { Situación: 'Fue 6 o más veces (sin llegar a todas)', Personas: a.frecuencia.seisOMas, 'Porcentaje sobre la base': `${porcentaje(a.frecuencia.seisOMas, base)}%` },
            { Situación: 'Fue 4 a 5 veces', Personas: a.frecuencia.cuatroACinco, 'Porcentaje sobre la base': `${porcentaje(a.frecuencia.cuatroACinco, base)}%` },
            { Situación: 'Fue 1 a 3 veces', Personas: a.frecuencia.unaATres, 'Porcentaje sobre la base': `${porcentaje(a.frecuencia.unaATres, base)}%` },
            { Situación: 'Asistió al menos una vez (suma de las cuatro de arriba)', Personas: a.asistieron, 'Porcentaje sobre la base': `${porcentaje(a.asistieron, base)}%` },
            { Situación: 'No fue a ninguna', Personas: a.nuncaAsistieron, 'Porcentaje sobre la base': `${porcentaje(a.nuncaAsistieron, base)}%` },
            { Situación: 'De las que no asistieron: su grupo nunca cargó asistencia', Personas: a.sinCarga, 'Porcentaje sobre la base': `${porcentaje(a.sinCarga, base)}%` },
            { Situación: 'Total de personas inscriptas', Personas: a.total, 'Porcentaje sobre la base': '100%' },
        ],
    }];
};

const hojaReportan = (d: ReportesGCXTemporada): HojaExcel[] => {
    const r = d.gruposQueReportan;
    return [{
        nombre: 'Reporte de asistencia',
        filas: [
            { Situación: 'Cargó todas las reuniones que le tocaban', Grupos: r.frecuencia.todas, Porcentaje: `${porcentaje(r.frecuencia.todas, r.total)}%` },
            { Situación: 'Cargó 6 o más (sin llegar a todas)', Grupos: r.frecuencia.seisOMas, Porcentaje: `${porcentaje(r.frecuencia.seisOMas, r.total)}%` },
            { Situación: 'Cargó 4 a 5', Grupos: r.frecuencia.cuatroACinco, Porcentaje: `${porcentaje(r.frecuencia.cuatroACinco, r.total)}%` },
            { Situación: 'Cargó 1 a 3', Grupos: r.frecuencia.unaATres, Porcentaje: `${porcentaje(r.frecuencia.unaATres, r.total)}%` },
            { Situación: 'Cargó al menos una reunión (suma de las cuatro de arriba)', Grupos: r.reportan, Porcentaje: `${porcentaje(r.reportan, r.total)}%` },
            { Situación: 'Nunca cargó una reunión', Grupos: r.noReportan, Porcentaje: `${porcentaje(r.noReportan, r.total)}%` },
            { Situación: 'Total de grupos activos', Grupos: r.total, Porcentaje: '100%' },
        ],
    }];
};

// Personas únicas, igual que la pantalla: el total de género sale de
// d.demografia y no de sumar las filas por categoría, que contaría dos veces
// a quien está en grupos de dos categorías.
const hojaCobertura = (d: ReportesGCXTemporada): HojaExcel[] => {
    const g = d.demografia;
    const a = d.asistenciaPersonas;
    const baseAsistencia = a.asistieron + a.nuncaAsistieron;
    return [{
        nombre: 'Cobertura de los datos',
        filas: [
            {
                'Qué alimenta': 'Género y edades',
                'Personas con el dato': g.conDato,
                'Personas únicas': g.personas,
                Cobertura: `${porcentaje(g.conDato, g.personas)}%`,
                'Por qué faltan': 'Cargadas a mano por su anfitrión, sin cuenta detrás',
            },
            {
                'Qué alimenta': 'Asistencia',
                'Personas con el dato': a.total - a.sinCarga,
                'Personas únicas': a.total,
                Cobertura: `${porcentaje(a.total - a.sinCarga, a.total)}%`,
                'Por qué faltan': 'Ninguno de sus grupos cargó una reunión: cuentan como ausentes',
            },
        ],
    }];
};

const hojaGenero = (d: ReportesGCXTemporada): HojaExcel[] => [{
    nombre: 'Género por categoría',
    filas: d.generoPorCategoria.map(f => ({
        Categoría: f.categoriaNombre,
        Masculino: f.masculino,
        Femenino: f.femenino,
        'No especificar': f.noEspecifica,
        'Sin dato (carga manual)': f.sinDato,
        'Total de personas': f.masculino + f.femenino + f.noEspecifica + f.sinDato,
    })),
}];

const hojaEdades = (edades: EdadesPorCategoriaFila[], ctx: ContextoExport): HojaExcel[] => [{
    nombre: 'Edades por categoría',
    filas: edades.map(f => ({
        Categoría: f.categoriaNombre,
        'Edad promedio (masculino)': f.masculino.length ? promedio(f.masculino) : 'Sin datos',
        'Personas (masculino)': f.masculino.length,
        'Edad promedio (femenino)': f.femenino.length ? promedio(f.femenino) : 'Sin datos',
        'Personas (femenino)': f.femenino.length,
        'Edad promedio (no especificar)': f.noEspecifica.length ? promedio(f.noEspecifica) : 'Sin datos',
        'Personas (no especificar)': f.noEspecifica.length,
        'Sin edad registrada o fuera del rango': f.sinDato,
        'Rango etario aplicado': `${ctx.edadMin} a ${ctx.edadMax} años`,
    })),
}];

/** Las dos tortas de disciplina y la lupa comparten el mismo padrón. */
const filasPorGrupo = (d: ReportesGCXTemporada) => [...d.cargaPorGrupo]
    .sort((a, b) => b.cargadas - a.cargadas || a.nombre.localeCompare(b.nombre))
    .map(f => ({
        Grupo: f.nombre,
        'Reuniones cargadas': f.cargadas,
        'Reuniones que le tocaban': f.esperadas,
        'Reuniones sin cargar': f.sinCargar,
        'Porcentaje cargado': f.esperadas > 0 ? `${porcentaje(f.cargadas, f.esperadas)}%` : 'Todavía no le toca ninguna',
        'Personas inscriptas': f.personas,
        'Personas que asistieron al menos una vez': f.asistieron,
        'Porcentaje que asistió': f.personas > 0 ? `${porcentaje(f.asistieron, f.personas)}%` : 'Sin inscriptos',
    }));

const hojaMasReportan = (d: ReportesGCXTemporada): HojaExcel[] => [{
    nombre: 'Quiénes reportan más',
    filas: filasPorGrupo(d),
}];

const hojaNoReportan = (d: ReportesGCXTemporada): HojaExcel[] => [{
    nombre: 'Quiénes no reportan',
    filas: [...d.cargaPorGrupo]
        .sort((a, b) => b.sinCargar - a.sinCargar || a.nombre.localeCompare(b.nombre))
        .map(f => ({
            Grupo: f.nombre,
            'Reuniones sin cargar': f.sinCargar,
            'Reuniones que le tocaban': f.esperadas,
            'Reuniones cargadas': f.cargadas,
            'Porcentaje sin cargar': f.esperadas > 0 ? `${porcentaje(f.sinCargar, f.esperadas)}%` : 'Todavía no le toca ninguna',
        })),
}];

const hojaGrupoDetalle = (d: ReportesGCXTemporada): HojaExcel[] => [{
    nombre: 'Detalle grupo por grupo',
    filas: filasPorGrupo(d),
}];

/**
 * El calendario se exporta NORMALIZADO: una fila por grupo y por día, en vez
 * de una fila por día con los nombres apilados en una celda. Así se puede
 * filtrar por grupo o por fecha en la planilla, que es lo que alguien va a
 * querer hacer con esto.
 */
const hojaCalendario = (d: ReportesGCXTemporada): HojaExcel[] => {
    const filas: Array<Record<string, string | number>> = [];
    d.asistenciaPorFecha.forEach(dia => {
        dia.grupos.forEach(g => filas.push({
            Fecha: fechaCompleta(dia.fecha),
            'Día de la semana': nombreDia(dia.fecha),
            Grupo: g.nombre,
            '¿Cargó la asistencia?': 'Sí',
            Asistentes: g.presentes,
            'Cupo del grupo': g.capacidad || 'Sin cupo cargado',
        }));
        dia.sinCargar.forEach(g => filas.push({
            Fecha: fechaCompleta(dia.fecha),
            'Día de la semana': nombreDia(dia.fecha),
            Grupo: g.nombre,
            '¿Cargó la asistencia?': 'No',
            Asistentes: 'Sin dato',
            'Cupo del grupo': g.capacidad || 'Sin cupo cargado',
        }));
    });
    return [{ nombre: 'Días con asistencia', filas }];
};

const hojaTabla = (d: ReportesGCXTemporada): HojaExcel[] => [{
    nombre: 'Detalle por grupo',
    filas: d.tablaGrupos.map(f => ({
        Grupo: f.nombre,
        Categoría: f.categoriaNombre || 'Sin categoría',
        Anfitrión: f.anfitrion,
        'Co-anfitrión': f.coAnfitrion || 'No tiene',
        'Día de encuentro': f.diaReunion || 'Sin definir',
        Horario: f.horaReunion || 'Sin definir',
        Modalidad: NOMBRE_MODALIDAD[f.modalidad],
        Inscriptos: f.inscriptos,
        Cupo: f.capacidad,
        Ocupación: f.capacidad > 0 ? `${porcentaje(f.inscriptos, f.capacidad)}%` : 'Sin cupo cargado',
        '¿Reporta asistencia?': f.reportaAsistencia ? 'Sí' : 'No',
    })),
}];

// ── Registro de gráficos ────────────────────────────────────────────────

/** Título humano de cada gráfico. Se usa en los botones y en el archivo. */
export const TITULO_GRAFICO: Record<ClaveGrafico, string> = {
    indicadores: 'Panorama de la temporada',
    asistencia: 'Asistencia de personas',
    reportan: 'Reporte de asistencia',
    cobertura: 'Cobertura de los datos',
    genero: 'Género por categoría',
    edades: 'Edades por categoría',
    masReportan: 'Quiénes reportan más',
    noReportan: 'Quiénes no reportan',
    grupoDetalle: 'Un grupo en detalle',
    calendario: 'Días con asistencia cargada',
    tabla: 'Detalle por grupo',
};

/** Orden en el que van las pestañas del export completo. */
export const ORDEN_GRAFICOS: ClaveGrafico[] = [
    'indicadores', 'asistencia', 'reportan', 'cobertura',
    'genero', 'edades', 'masReportan', 'noReportan',
    'grupoDetalle', 'calendario', 'tabla',
];

export const hojasDe = (
    clave: ClaveGrafico,
    datos: ReportesGCXTemporada,
    edades: EdadesPorCategoriaFila[],
    ctx: ContextoExport
): HojaExcel[] => {
    switch (clave) {
        case 'indicadores': return hojaIndicadores(datos);
        case 'asistencia': return hojaAsistencia(datos);
        case 'reportan': return hojaReportan(datos);
        case 'cobertura': return hojaCobertura(datos);
        case 'genero': return hojaGenero(datos);
        case 'edades': return hojaEdades(edades, ctx);
        case 'masReportan': return hojaMasReportan(datos);
        case 'noReportan': return hojaNoReportan(datos);
        case 'grupoDetalle': return hojaGrupoDetalle(datos);
        case 'calendario': return hojaCalendario(datos);
        case 'tabla': return hojaTabla(datos);
    }
};

// ── Escritura del archivo ───────────────────────────────────────────────

/**
 * Excel no acepta pestañas de más de 31 caracteres ni con : \ / ? * [ ],
 * y falla al abrir el archivo sin decir por qué. Se limpia acá y no en cada
 * definición para que los nombres de arriba se puedan escribir en castellano
 * normal sin pensar en el límite.
 */
const nombreDePestana = (nombre: string, usados: Set<string>): string => {
    let limpio = nombre.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Hoja';
    if (usados.has(limpio)) {
        // Sufijo numérico sin pasarse de 31.
        let i = 2;
        while (usados.has(`${limpio.slice(0, 28)} ${i}`)) i += 1;
        limpio = `${limpio.slice(0, 28)} ${i}`;
    }
    usados.add(limpio);
    return limpio;
};

/** Ancho de columna al contenido más largo, con techo: sin esto todo sale
 *  en 8 caracteres y hay que arrastrar cada borde a mano. */
const anchos = (filas: Array<Record<string, string | number>>) => {
    if (filas.length === 0) return undefined;
    return Object.keys(filas[0]).map(clave => {
        const largos = filas.map(f => String(f[clave] ?? '').length);
        return { wch: Math.min(46, Math.max(clave.length, ...largos) + 2) };
    });
};

export const descargarExcel = (hojas: HojaExcel[], archivo: string) => {
    const libro = XLSX.utils.book_new();
    const usados = new Set<string>();

    hojas.forEach(h => {
        // Una hoja sin filas igual se crea, con sus encabezados: que la
        // pestaña exista y esté vacía dice "no hubo datos", que falte parece
        // un error de la descarga.
        const hoja = h.filas.length > 0
            ? XLSX.utils.json_to_sheet(h.filas)
            : XLSX.utils.aoa_to_sheet([['Sin datos para esta temporada']]);
        const ancho = anchos(h.filas);
        if (ancho) hoja['!cols'] = ancho;
        XLSX.utils.book_append_sheet(libro, hoja, nombreDePestana(h.nombre, usados));
    });

    XLSX.writeFile(libro, archivo);
};

/** Reportes-GCX-temporada-1-2026-Asistencia-de-personas.xlsx */
export const nombreArchivo = (ctx: ContextoExport, titulo: string, extension: string) => {
    const limpio = titulo
        // Sin tildes ni ñ: el archivo viaja por WhatsApp y mail, donde un
        // nombre con acentos vuelve como "Asistencia%20de%20d%C3%ADas".
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    return `Reportes-GCX-temporada-${NOMBRE_TEMPORADA[ctx.temporada]}-${ctx.anio}-${limpio}.${extension}`;
};

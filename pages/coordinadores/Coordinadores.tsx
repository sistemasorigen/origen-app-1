import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    User,
    UserRole,
    Group,
    GroupCategory,
    GroupTag,
    DropoutRequest,
    SeasonSettings,
    DEFAULT_SEASON_SETTINGS,
    coordinatorVariantToCategory,
} from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { db } from '../../services/dbService';
import { hasRole } from '../../services/authUtils';
import {
    GrupoConDatos,
    esGrupoFinalizado,
    estaAprobado,
    lugaresOcupados,
    personasDeGrupo,
    categoriaDe,
    nombreAnfitrion,
    Recorte,
    TEMPORADAS,
    NUMERO_TEMPORADA,
    claveRecorte,
    recorteDeGrupo,
    recorteDeHoy,
    yaArranco,
    Segmentado,
} from './comunes';

import InicioCoordinador from './PanelCoordinador';
import GruposCoordinador from './GruposCoordinador';
import AsistenciaCoordinador from './AsistenciaCoordinador';
import CalendarioCoordinador from './CalendarioCoordinador';

/**
 * Panel de coordinación (design-claude/Coordinadores GCX).
 *
 * Un coordinador acompaña a los anfitriones de una o más categorías. No
 * administra: mira, detecta y llama. Por eso el panel no arranca con una
 * grilla de números sino con la lista de grupos que necesitan una llamada.
 *
 * La barra lateral del diseño anterior se reemplaza por cuatro pestañas en
 * la cabecera blanca, iguales a las del Panel GCX: en el teléfono dejan de
 * estar escondidas detrás de un botón de menú.
 *
 * Este archivo trae los datos una sola vez y arma la lectura de cada grupo
 * —cuánto promedia, si reporta, cuántas bajas tuvo—; las cuatro secciones
 * solo la muestran.
 */

type Pestana = 'inicio' | 'grupos' | 'asistencia' | 'calendario';

const PESTANAS: { id: Pestana; label: string; icono: React.ReactNode }[] = [
    {
        id: 'inicio',
        label: 'Inicio',
        icono: (
            <>
                <path d="M4 11l8-6.5 8 6.5" />
                <path d="M6.5 10v9h11v-9" />
            </>
        ),
    },
    {
        id: 'grupos',
        label: 'Grupos',
        icono: (
            <>
                <rect x="3.5" y="4.5" width="7" height="7" rx="2" />
                <rect x="13.5" y="4.5" width="7" height="7" rx="2" />
                <rect x="3.5" y="14" width="7" height="5.5" rx="2" />
                <rect x="13.5" y="14" width="7" height="5.5" rx="2" />
            </>
        ),
    },
    {
        id: 'asistencia',
        label: 'Asistencia',
        icono: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
    },
    {
        id: 'calendario',
        label: 'Calendario',
        icono: (
            <>
                <rect x="3.5" y="5" width="17" height="15" rx="3" />
                <path d="M8 3v3.5M16 3v3.5M3.5 10h17" />
            </>
        ),
    },
];

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

interface CoordinatorsProps {
    currentUser: User;
}

const Coordinadores: React.FC<CoordinatorsProps> = ({ currentUser }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [pestana, setPestana] = useState<Pestana>('inicio');
    const [grupoPreseleccionado, setGrupoPreseleccionado] = useState<string | null>(null);

    const [grupos, setGrupos] = useState<Group[]>([]);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    const [tags, setTags] = useState<GroupTag[]>([]);
    const [dropouts, setDropouts] = useState<DropoutRequest[]>([]);
    const [asistencias, setAsistencias] = useState<{ groupId: string; date: string; presentMembers: string[] }[]>([]);
    // La asistencia de TODOS los grupos y la temporada de cada uno: con eso
    // se saca el promedio de la iglesia de la temporada elegida.
    const [asistenciaIglesia, setAsistenciaIglesia] = useState<{ groupId: string; presentMembers: string[] }[]>([]);
    const [temporadaPorGrupo, setTemporadaPorGrupo] = useState<Map<string, string>>(new Map());
    const [cargando, setCargando] = useState(true);

    // Año y temporada que se miran. Todo el panel —inicio, grupos,
    // asistencia y calendario— responde a este recorte, igual que el tablero
    // de /reportes/gcx. Viaja en la URL (?anio=2026&temporada=S2) para que un
    // enlace o una recarga caigan en la misma temporada.
    const [recorte, setRecorte] = useState<Recorte>(() => {
        const anio = Number(searchParams.get('anio'));
        const temporada = searchParams.get('temporada');
        const base = recorteDeHoy();
        return {
            anio: anio >= 2000 && anio <= 2100 ? anio : base.anio,
            temporada: temporada === 'S1' || temporada === 'S2' || temporada === 'S3' ? temporada : base.temporada,
        };
    });
    const clave = claveRecorte(recorte);

    const cambiarRecorte = useCallback((nuevo: Recorte) => {
        setRecorte(nuevo);
        setGrupoPreseleccionado(null);
        const params = new URLSearchParams(searchParams);
        params.set('anio', String(nuevo.anio));
        params.set('temporada', nuevo.temporada);
        setSearchParams(params, { replace: true });
    }, [searchParams, setSearchParams]);

    // Categorías que coordina. Se mantiene el respaldo al campo singular
    // viejo para los usuarios que todavía no migraron a coordinatorVariants.
    const variantes = (currentUser.coordinatorVariants && currentUser.coordinatorVariants.length > 0)
        ? currentUser.coordinatorVariants
        : (currentUser.coordinatorVariant ? [currentUser.coordinatorVariant] : []);

    // Un admin de grupos ve el panel entero. Sin esto, un admin que además
    // estaba asignado como coordinador de un departamento quedaba recortado
    // a ese departamento. Mismo criterio que useRole.isAdmin.
    const accesoTotal = hasRole(currentUser, [UserRole.SUPER_ADMIN, UserRole.ADMIN_GROUPS]);

    const filtrosCategoria = useMemo(() => accesoTotal ? [] : Array.from(new Set(
        variantes
            .map(v => coordinatorVariantToCategory(v))
            .filter((c): c is string => !!c)
    )), [accesoTotal, variantes.join('|')]);

    const nombreCategorias = filtrosCategoria.length > 0
        ? filtrosCategoria.join(' + ')
        : (accesoTotal ? 'Todas las categorías' : '');

    const sinCategoria = filtrosCategoria.length === 0 && !accesoTotal;

    // Deep link de pestaña, para que un enlace guardado siga cayendo donde
    // caía antes (?tab=groups) y también con los nombres nuevos.
    useEffect(() => {
        const tab = searchParams.get('tab');
        const equivalencias: Record<string, Pestana> = {
            dashboard: 'inicio', inicio: 'inicio',
            groups: 'grupos', grupos: 'grupos',
            attendance: 'asistencia', asistencia: 'asistencia',
            calendar: 'calendario', calendario: 'calendario',
        };
        if (tab && equivalencias[tab]) setPestana(equivalencias[tab]);
    }, [searchParams]);

    const irA = useCallback((destino: Pestana) => {
        setPestana(destino);
        const params = new URLSearchParams(searchParams);
        params.set('tab', destino);
        setSearchParams(params, { replace: true });
    }, [searchParams, setSearchParams]);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const [todosLosGrupos, cats, etiquetas, bajas] = await Promise.all([
                supabaseService.getGroupsForAdmin(),
                supabaseService.getGroupCategories(),
                supabaseService.getGroupTags(),
                supabaseService.getAllDropoutRequests(),
            ]);

            setCategories(cats);
            setTags(etiquetas);

            // Los grupos que le tocan a este coordinador. La categoría puede
            // venir por id o por nombre según cómo se cargó el grupo.
            let mios = todosLosGrupos;
            if (filtrosCategoria.length > 0) {
                const ids = filtrosCategoria.map(nombre => {
                    const encontrada = cats.find(c => c.name.toLowerCase().trim() === nombre.toLowerCase().trim());
                    return encontrada ? encontrada.id : nombre;
                });
                const nombresMinuscula = filtrosCategoria.map(c => c.toLowerCase().trim());
                mios = todosLosGrupos.filter(g =>
                    ids.includes(g.categoryId || '') ||
                    (g.categoryName && nombresMinuscula.includes(g.categoryName.toLowerCase().trim()))
                );
            }

            setGrupos(mios);
            const idsMios = new Set(mios.map(g => g.id));
            setDropouts(bajas.filter(d => idsMios.has(d.groupId)));

            // La asistencia se pide de TODOS los grupos, no solo de los del
            // coordinador: con eso se calcula el promedio de la iglesia, que
            // es la vara contra la que se lee cada grupo. Es una sola
            // consulta y sirve para las dos cosas. Tampoco se filtra por
            // estado: si un grupo cargó asistencia, esa asistencia existe.
            const historial = await supabaseService.getAttendanceHistoryForGroups(todosLosGrupos.map(g => g.id));

            setAsistencias(historial.filter(a => idsMios.has(a.groupId)));
            setAsistenciaIglesia(historial);
            const temporadas = new Map<string, string>();
            todosLosGrupos.forEach(g => {
                const r = recorteDeGrupo(g);
                if (r) temporadas.set(g.id, claveRecorte(r));
            });
            setTemporadaPorGrupo(temporadas);
        } catch (error) {
            console.error('[Coordinadores] Error cargando datos:', error);
        } finally {
            setCargando(false);
        }
    }, [filtrosCategoria.join('|')]);

    useEffect(() => {
        if (sinCategoria) { setCargando(false); return; }
        cargar();
    }, [cargar, sinCategoria]);

    // ── Lectura de cada grupo ─────────
    const datos: GrupoConDatos[] = useMemo(() => {
        const porGrupo = new Map<string, { fecha: string; presentes: number; ids: string[] }[]>();
        asistencias.forEach(a => {
            const lista = porGrupo.get(a.groupId) || [];
            lista.push({ fecha: a.date, presentes: a.presentMembers.length, ids: a.presentMembers });
            porGrupo.set(a.groupId, lista);
        });

        const bajasPorGrupo = new Map<string, number>();
        dropouts.forEach(d => bajasPorGrupo.set(d.groupId, (bajasPorGrupo.get(d.groupId) || 0) + 1));

        // El único recorte es la temporada y el año que se están mirando: un
        // grupo entra por su fecha de arranque, no por su estado. Antes se
        // pedía además que estuviera aprobado o finalizado, y eso escondía
        // del panel a los que están esperando aprobación — justo los que un
        // coordinador querría ver venir. Cada tarjeta dice en qué estado
        // está, así que el dato no se pierde.
        return grupos
            .filter(g => temporadaPorGrupo.get(g.id) === clave)
            .map(grupo => {
                const reportes = (porGrupo.get(grupo.id) || []).sort((a, b) => b.fecha.localeCompare(a.fecha));
                const presentes = reportes.reduce((s, r) => s + r.presentes, 0);
                return {
                    grupo,
                    ocupados: lugaresOcupados(grupo, categories, tags),
                    personas: personasDeGrupo(grupo),
                    capacidad: grupo.maxCapacity || grupo.maxMembers || 0,
                    reportes,
                    promedio: reportes.length > 0 ? presentes / reportes.length : 0,
                    reporta: reportes.length > 0,
                    bajas: bajasPorGrupo.get(grupo.id) || 0,
                    finalizado: esGrupoFinalizado(grupo),
                    categoria: categoriaDe(grupo, categories),
                };
            })
            .sort((a, b) => (a.grupo.name || '').localeCompare(b.grupo.name || '', 'es'));
    }, [grupos, asistencias, dropouts, categories, tags, temporadaPorGrupo, clave]);

    // El promedio de la iglesia sale de la MISMA temporada: comparar un grupo
    // contra el promedio de todos los años mezclaría temporadas que se
    // llenan distinto.
    const promedioIglesia = useMemo(() => {
        const filas = asistenciaIglesia.filter(a => temporadaPorGrupo.get(a.groupId) === clave);
        const presentes = filas.reduce((suma, a) => suma + a.presentMembers.length, 0);
        return filas.length > 0 ? presentes / filas.length : 0;
    }, [asistenciaIglesia, temporadaPorGrupo, clave]);

    // Las bajas de los grupos de la temporada, para Inicio.
    const bajasDelRecorte = useMemo(() => {
        const ids = new Set(datos.map(d => d.grupo.id));
        return dropouts.filter(d => ids.has(d.groupId));
    }, [datos, dropouts]);

    // "Activos" = en curso (ya arrancó y no terminó): la insignia de
    // Asistencia cuenta sólo lo que todavía se puede resolver con una llamada.
    const activos = useMemo(() => datos.filter(d => !d.finalizado && yaArranco(d.grupo) && estaAprobado(d.grupo)), [datos]);
    const sinReportar = useMemo(() => activos.filter(d => !d.reporta), [activos]);

    // Pastillas de alcance: cuántos grupos activos tiene cada categoría. Un
    // coordinador tiene una o dos; un admin de grupos las ve todas, y ahí la
    // línea se vuelve un muro de pastillas, así que se muestran las cuatro
    // más grandes y el resto se cuenta.
    const [verTodasLasCategorias, setVerTodasLasCategorias] = useState(false);

    const categoriasConGrupos = useMemo(() => {
        const conteo = new Map<string, number>();
        datos.forEach(d => conteo.set(d.categoria, (conteo.get(d.categoria) || 0) + 1));
        return Array.from(conteo.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
            .map(([nombre, n]) => ({ nombre, n }));
    }, [datos]);

    const pastillasCategoria = verTodasLasCategorias
        ? categoriasConGrupos
        : categoriasConGrupos.slice(0, 4);
    const categoriasOcultas = categoriasConGrupos.length - pastillasCategoria.length;

    const temporadas: SeasonSettings = db.getAppConfig()?.groupsConfig?.seasonSettings ?? DEFAULT_SEASON_SETTINGS;
    const proxima = useMemo(() => {
        const abierta = (['S1', 'S2', 'S3'] as const).find(k => temporadas.seasons[k]?.isOpen);
        const clave = abierta || 'S1';
        const inicio = temporadas.seasons[clave]?.startDate;
        if (!inicio) return '';
        const [mes, dia] = inicio.split('-').map(Number);
        if (!mes || !dia) return '';
        const numero = clave === 'S1' ? '1' : clave === 'S2' ? '2' : '3';
        return `La temporada ${numero} arranca el ${dia} de ${MESES[mes - 1]}.`;
    }, [temporadas]);

    // El calendario abre en el mes de hoy si la temporada está en curso, y
    // si no, en el mes en que arrancó su primer grupo: abrir en septiembre
    // una temporada de marzo mostraría un mes vacío.
    const mesInicialDelRecorte = useMemo(() => {
        const hoy = new Date();
        const hoyISO = hoy.toLocaleDateString('en-CA');
        const enCurso = datos.some(d => (d.grupo.startDate || '') <= hoyISO && (!d.grupo.endDate || d.grupo.endDate >= hoyISO));
        if (enCurso || datos.length === 0) return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        const primero = datos.map(d => d.grupo.startDate || '').filter(Boolean).sort()[0];
        const [a, m] = primero.split('-').map(Number);
        return new Date(a, m - 1, 1);
    }, [datos]);

    const abrirGrupo = useCallback((groupId: string) => {
        setGrupoPreseleccionado(groupId);
        irA('grupos');
    }, [irA]);

    // ── Cabecera ──────────────────────
    const pestanaDesktop = (p: typeof PESTANAS[number]) => {
        const activa = pestana === p.id;
        return (
            <button
                key={p.id}
                onClick={() => irA(p.id)}
                aria-current={activa ? 'page' : undefined}
                className={`flex h-[42px] flex-none items-center gap-[9px] rounded-full px-[18px] text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 ${activa ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.62] hover:text-[#0a0a0a]'}`}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    {p.icono}
                </svg>
                {p.label}
                {p.id === 'asistencia' && sinReportar.length > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#b45309] px-1.5 text-[11px] font-semibold text-white">
                        {sinReportar.length}
                    </span>
                )}
            </button>
        );
    };

    const pestanaMobile = (p: typeof PESTANAS[number]) => {
        const activa = pestana === p.id;
        return (
            <button
                key={p.id}
                onClick={() => irA(p.id)}
                aria-current={activa ? 'page' : undefined}
                className={`relative flex h-[58px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] ${activa ? 'bg-[#0a0a0a] text-white' : 'bg-[#f2f2f0] text-black/[.62]'}`}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    {p.icono}
                </svg>
                <span className="text-[11px] font-semibold">{p.label}</span>
                {p.id === 'asistencia' && sinReportar.length > 0 && (
                    <span className="absolute right-[calc(50%-22px)] top-[7px] flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#b45309] px-1 text-[10px] font-semibold text-white">
                        {sinReportar.length}
                    </span>
                )}
            </button>
        );
    };

    // ── Cuerpo ────────────────────────
    const cuerpo = () => {
        if (sinCategoria) return <SinCategoria nombre={currentUser.name} />;

        if (cargando) return <Cargando />;

        if (datos.length === 0) {
            // Una temporada que ya pasó sin grupos no "todavía" va a tenerlos:
            // se dice distinto que una que está por arrancar.
            const hoy = recorteDeHoy();
            const yaPaso = recorte.anio < hoy.anio
                || (recorte.anio === hoy.anio && TEMPORADAS.indexOf(recorte.temporada) < TEMPORADAS.indexOf(hoy.temporada));
            const nombreTemporada = `la temporada ${NUMERO_TEMPORADA[recorte.temporada]} de ${recorte.anio}`;
            return (
                <div className="flex flex-col items-center rounded-[22px] bg-white px-[22px] py-[38px] text-center md:px-10 md:py-14">
                    <div
                        className="h-[88px] w-[88px] rounded-full"
                        style={{ background: 'repeating-linear-gradient(135deg,#eceae6 0 8px,#e3e1dc 8px 16px)' }}
                    />
                    <p className="mt-[22px] text-[19px] font-semibold text-[#0a0a0a]">
                        {yaPaso
                            ? `${nombreCategorias || 'Tu categoría'} no tuvo grupos en ${nombreTemporada}`
                            : `${nombreCategorias || 'Tu categoría'} todavía no tiene grupos en ${nombreTemporada}`}
                    </p>
                    <p className="mt-[11px] max-w-[400px] text-[13.5px] font-medium leading-[1.65] text-black/[.64]">
                        {yaPaso
                            ? 'Elegí otro año o temporada arriba para ver los grupos que sí hubo.'
                            : `Los anfitriones crean sus grupos unas semanas antes de que arranque la temporada. ${proxima}`}
                    </p>
                    <button
                        onClick={cargar}
                        className="mt-[22px] h-12 rounded-full bg-[#0a0a0a] px-[22px] text-[14.5px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                    >
                        Buscar de nuevo
                    </button>
                </div>
            );
        }

        switch (pestana) {
            case 'inicio':
                return (
                    <InicioCoordinador
                        datos={datos}
                        dropouts={bajasDelRecorte}
                        promedioIglesia={promedioIglesia}
                        onAbrirGrupo={abrirGrupo}
                        onVerAsistencia={() => irA('asistencia')}
                    />
                );
            case 'grupos':
                return (
                    <GruposCoordinador
                        datos={datos}
                        promedioIglesia={promedioIglesia}
                        nombreCategorias={nombreCategorias}
                        preseleccionado={grupoPreseleccionado}
                        onLimpiarPreseleccion={() => setGrupoPreseleccionado(null)}
                        onRefrescar={cargar}
                    />
                );
            case 'asistencia':
                return (
                    <AsistenciaCoordinador
                        datos={datos}
                        promedioIglesia={promedioIglesia}
                        onAbrirGrupo={abrirGrupo}
                    />
                );
            case 'calendario':
                // key: al cambiar de temporada el calendario vuelve a su mes
                // inicial en vez de quedarse parado en uno de la anterior.
                return <CalendarioCoordinador key={clave} datos={datos} mesInicial={mesInicialDelRecorte} onAbrirGrupo={abrirGrupo} />;
            default:
                return null;
        }
    };

    return (
        <div id="gcx-coordinadores" className="min-h-screen bg-[#f6f6f4]">

            <header className="border-b border-[#ecebe8] bg-white">
                <div className="mx-auto max-w-[1360px] px-4 pt-4 md:px-[26px] md:pt-[18px]">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                        <h1 className="text-[19px] font-semibold tracking-[-0.018em] text-[#0a0a0a] md:text-[21px]">
                            Panel de coordinación
                        </h1>
                        {!sinCategoria && <SelectorTemporada recorte={recorte} onCambiar={cambiarRecorte} />}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-[12.5px] font-medium text-black/[.62]">
                            {sinCategoria
                                ? 'Categorías asignadas:'
                                : cargando
                                    ? 'Buscando tus grupos…'
                                    : `Temporada ${NUMERO_TEMPORADA[recorte.temporada]} de ${recorte.anio} · ${datos.length} ${datos.length === 1 ? 'grupo' : 'grupos'} de`}
                        </span>
                        {sinCategoria ? (
                            <span className="flex h-7 items-center rounded-full bg-[#f2f2f0] px-3 text-[12px] font-semibold text-black/[.62]">
                                ninguna todavía
                            </span>
                        ) : (
                            <>
                                {pastillasCategoria.map(c => (
                                    <span
                                        key={c.nombre}
                                        className="flex h-7 max-w-full items-center gap-[7px] rounded-full bg-[#e7f5ee] px-3 text-[12px] font-semibold text-[#0b7a53]"
                                    >
                                        <span className="truncate">{c.nombre}</span>
                                        <span className="flex-none text-[11px] font-semibold text-[#0b7a53]/70">{c.n}</span>
                                    </span>
                                ))}
                                {(categoriasOcultas > 0 || verTodasLasCategorias) && (
                                    <button
                                        onClick={() => setVerTodasLasCategorias(v => !v)}
                                        className="flex h-7 items-center rounded-full bg-[#f2f2f0] px-3 text-[12px] font-semibold text-black/[.62] transition-colors hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                                    >
                                        {verTodasLasCategorias ? 'Ver menos' : `+${categoriasOcultas} más`}
                                    </button>
                                )}
                            </>
                        )}
                    </div>

                    {!sinCategoria && (
                        <>
                            <div className="mt-3.5 hidden flex-wrap gap-2 pb-[18px] md:flex">
                                {PESTANAS.map(pestanaDesktop)}
                            </div>
                            <div className="mt-3.5 flex gap-[7px] pb-4 md:hidden">
                                {PESTANAS.map(pestanaMobile)}
                            </div>
                        </>
                    )}
                    {sinCategoria && <div className="h-4" />}
                </div>
            </header>

            <div className="mx-auto max-w-[1360px] px-3.5 pb-[26px] pt-3.5 md:px-[26px] md:pb-[30px] md:pt-[18px]">
                {cuerpo()}
            </div>
        </div>
    );
};

// ── Año y temporada ───────────────────

/**
 * Mismo control que el tablero de /reportes/gcx —año con flechas, y las
 * tres temporadas—, con la estética de las pestañas de este panel.
 */
const SelectorTemporada: React.FC<{ recorte: Recorte; onCambiar: (r: Recorte) => void }> = ({ recorte, onCambiar }) => {
    const flecha = (direccion: -1 | 1) => (
        <button
            type="button"
            onClick={() => onCambiar({ ...recorte, anio: recorte.anio + direccion })}
            aria-label={direccion < 0 ? 'Año anterior' : 'Año siguiente'}
            className="flex h-8 w-8 items-center justify-center rounded-full text-black/[.62] transition-colors hover:bg-white hover:text-[#0a0a0a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
        >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d={direccion < 0 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
            </svg>
        </button>
    );

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-none items-center gap-[3px] rounded-full bg-[#f2f2f0] p-[3px]">
                {flecha(-1)}
                <span className="min-w-[46px] text-center text-[13.5px] font-semibold tabular-nums text-[#0a0a0a]" aria-live="polite">
                    {recorte.anio}
                </span>
                {flecha(1)}
            </div>
            <div className="flex flex-none items-center gap-2">
                <span className="text-[12.5px] font-medium text-black/[.62]">Temporada</span>
                <Segmentado
                    valor={recorte.temporada}
                    onChange={v => onCambiar({ ...recorte, temporada: v as Recorte['temporada'] })}
                    opciones={TEMPORADAS.map(t => ({ valor: t, label: NUMERO_TEMPORADA[t] }))}
                />
            </div>
        </div>
    );
};

// ── Estados que no dependen de los datos ──

const SinCategoria: React.FC<{ nombre?: string }> = ({ nombre }) => {
    const saludo = nombre ? `Hola, ${nombre.split(' ')[0]}` : 'Hola';
    const puntos = [
        'Ver cómo viene cada grupo de tu categoría, sin mezclarte con los del resto de la iglesia.',
        'Saber qué anfitrión dejó de reportar y necesita una llamada.',
        'Seguir la asistencia reunión a reunión y el calendario del mes.',
    ];

    return (
        <div className="flex flex-col items-center rounded-[22px] bg-white px-[22px] py-[38px] text-center md:px-10 md:py-14">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#e7f5ee]">
                <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#0b7a53" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="3.6" />
                    <path d="M4.5 20c0-4 3.4-7 7.5-7s7.5 3 7.5 7" />
                </svg>
            </div>
            <p className="mt-6 text-[22px] font-semibold tracking-[-0.018em] text-[#0a0a0a]">{saludo}</p>
            <p className="mt-3 max-w-[420px] text-[14.5px] font-medium leading-[1.7] text-black/[.66]">
                Un coordinador acompaña a los anfitriones de una o más categorías de grupos. Todavía no te asignaron
                ninguna, así que no hay grupos para mostrarte.
            </p>

            <div className="mt-6 w-full max-w-[460px] rounded-[20px] bg-[#f7f7f5] px-5 py-[18px] text-left">
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-black/[.58]">
                    Cuando te asignen una categoría vas a poder
                </p>
                <div className="mt-3.5 flex flex-col gap-2.5">
                    {puntos.map(p => (
                        <div key={p} className="flex items-start gap-2.5">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0b7a53" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-none">
                                <path d="M5 12.5l4.5 4.5L19 6.5" />
                            </svg>
                            <span className="text-[13.5px] font-medium leading-[1.55] text-black/[.66]">{p}</span>
                        </div>
                    ))}
                </div>
            </div>

            <a
                href="mailto:sistemas@origeniglesia.org?subject=Categor%C3%ADa%20de%20coordinaci%C3%B3n"
                className="mt-[22px] flex h-[52px] items-center rounded-full bg-[#0a0a0a] px-[26px] text-[15px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
            >
                Pedirle una categoría al administrador
            </a>
            <p className="mt-3.5 text-[12.5px] font-medium text-black/[.6]">
                Le escribe al equipo de grupos.
            </p>
        </div>
    );
};

const Cargando: React.FC = () => (
    <>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[0, 1, 2, 3].map(i => (
                <div key={i} className="h-[110px] rounded-[18px] bg-white" />
            ))}
        </div>
        <div className="mt-3.5 rounded-[20px] bg-white px-[22px] py-5">
            <div className="h-3.5 w-[180px] rounded-full bg-[#f0efec]" />
            <div className="mt-6 flex h-[200px] items-end gap-2.5">
                {[56, 78, 44, 67, 88, 52].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-md bg-[#f2f2f0]" style={{ height: `${h}%` }} />
                ))}
            </div>
            <p className="mt-5 text-[12.5px] font-medium text-black/[.6]">Cargando los grupos de tus categorías…</p>
        </div>
    </>
);

export default Coordinadores;

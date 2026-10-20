// ════════════════════════════════════════════════════════════════════════
// /panel-eventos — la puerta de entrada a los paneles de cada evento.
//
// Implementa design-claude/Panel de Eventos.dc.html.
//
// Tres cosas que el diseño cambió respecto de la grilla anterior:
//
//   · Los eventos se agrupan POR AÑO, en secciones que se pliegan. Con dos
//     ediciones encima, una grilla plana obliga a leer el nombre de cada
//     tarjeta para saber cuál es la de este año.
//   · "Configurar /eventos" sale de la grilla y sube al encabezado. No es un
//     evento: es la pantalla que publica los eventos de la página pública, y
//     mezclada entre los paneles se abría por error.
//   · Las herramientas que no son un evento —el Kahoot— van en su propia
//     sección al final.
//
// Los tokens salen de components/GCX/patron: el diseño está dibujado contra
// esa misma paleta (#f6f6f4/#111110, #f2f2f0/#2a2a28, el rótulo de 12px), y
// repetir los valores a mano acá los dejaría divergir en la próxima pasada.
// ════════════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Settings } from 'lucide-react';
import { User, UserRole } from '../../types';
import { hasRole } from '../../services/authUtils';
import { T, rotulo } from '../../components/GCX/patron';

interface PanelEventosProps {
    currentUser: User;
}

/**
 * Los íconos son del diseño, no de lucide, y a propósito.
 *
 * Son dibujos del evento —una corbata para el Día del Padre, un globo para
 * el del Niño— y no el genérico más cercano que tenga la librería. Con seis
 * tarjetas iguales en forma y tamaño, el dibujo es lo único que distingue
 * una de otra de un vistazo.
 */
const ICONOS = {
    luna: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
    globo: 'M12 15c-3.3 0-5.5-3-5.5-6.2A5.5 5.5 0 0112 3a5.5 5.5 0 015.5 5.8c0 3.2-2.2 6.2-5.5 6.2zM12 15l-1 1.5h2L12 15M12 16.5c0 2 1.5 2.5 1.5 4.5',
    corbata: 'M10 3h4l-1 3h-2zM11 6l-2.5 9.5L12 21l3.5-5.5L13 6',
    escudo: 'M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z',
    copa: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3',
    pregunta: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17h.01',
    calendario: 'M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2zM8 3v4M16 3v4M4 10h16',
} as const;

type NombreDeIcono = keyof typeof ICONOS;

interface Panel {
    id: string;
    titulo: string;
    descripcion: string;
    ruta: string;
    icono: NombreDeIcono;
    roles: UserRole[];
}

interface PanelDeEvento extends Panel {
    anio: number;
}

/**
 * La edición que se está administrando.
 *
 * Cuando abra la 2027, se cambia este número y los paneles de 2026 que
 * sigan teniendo pantalla propia se quedan con `anio: 2026` escrito a mano.
 * Las secciones salen solas de los años que haya: no hay nada más que tocar.
 */
const EDICION_EN_CURSO = 2026;

/**
 * Los paneles de evento. Agregar acá cada evento con panel propio.
 *
 * El orden de esta lista es el orden dentro de su año.
 */
const PANELES_EVENTOS: PanelDeEvento[] = [
    {
        id: 'nocturna',
        anio: EDICION_EN_CURSO,
        titulo: 'Nocturna',
        descripcion: 'Planilla de inscripciones, entradas y acreditación del evento.',
        ruta: '/panel-eventos/nocturna',
        icono: 'luna',
        roles: [
            UserRole.SUPER_ADMIN,
            UserRole.PASTOR,
            UserRole.ENCARGADO_EVENTOS,
            // Los mismos cuatro de is_nocturna_staff().
            UserRole.ACREDITACION,
        ],
    },
    {
        id: 'dia-del-nino',
        anio: EDICION_EN_CURSO,
        titulo: 'Día del Niño',
        descripcion: 'Gestión de inscripciones, entradas y check-in del evento.',
        ruta: '/eventos/admin/diadelnino',
        icono: 'globo',
        roles: [
            UserRole.SUPER_ADMIN,
            UserRole.PASTOR,
            UserRole.ENCARGADO_EVENTOS,
        ],
    },
    {
        id: 'dia-del-padre',
        anio: EDICION_EN_CURSO,
        titulo: 'Día del Padre',
        descripcion: 'Gestión de inscripciones, puntos y ranking del evento.',
        ruta: '/eventos/admin/diadelpadre',
        icono: 'corbata',
        roles: [
            UserRole.SUPER_ADMIN,
            UserRole.PASTOR,
            UserRole.ENCARGADO_EVENTOS,
        ],
    },
    {
        id: 'tribal-wars',
        anio: EDICION_EN_CURSO,
        titulo: 'Tribal Wars',
        descripcion: 'Gestión de inscripciones por tribu del evento.',
        ruta: '/eventos/admin/tribal-wars',
        icono: 'escudo',
        roles: [
            UserRole.SUPER_ADMIN,
            UserRole.PASTOR,
            UserRole.ENCARGADO_EVENTOS,
        ],
    },
    {
        id: 'prode-mundial',
        anio: EDICION_EN_CURSO,
        titulo: 'Prode Mundial',
        descripcion: 'Gestión de configuración, partidos y resultados del Prode.',
        ruta: '/prode/administracion',
        icono: 'copa',
        roles: [
            UserRole.SUPER_ADMIN,
            UserRole.PASTOR,
            UserRole.PRODE,
        ],
    },
];

/** Lo que no es un evento pero se administra desde acá. */
const HERRAMIENTAS: Panel[] = [
    {
        id: 'trivia',
        titulo: 'Kahoot Origen',
        descripcion: 'Crear y gestionar juegos de trivia en vivo con PIN.',
        ruta: '/trivia/admin',
        icono: 'pregunta',
        roles: [
            UserRole.SUPER_ADMIN,
            UserRole.PASTOR,
            UserRole.ENCARGADO_EVENTOS,
        ],
    },
];

/** La configuración de /eventos: vive en el encabezado, no en la grilla. */
const CONFIGURAR = {
    ruta: '/eventos/admin/general',
    ayuda: 'Crear, editar y publicar los eventos de la página pública.',
    roles: [UserRole.SUPER_ADMIN, UserRole.ENCARGADO_EVENTOS],
};

/**
 * Las dos entradas del diseño, con su apagado para quien pidió menos
 * movimiento. Van en un <style> y no en Tailwind porque llevan retardo
 * escalonado, que se calcula por tarjeta.
 */
const ESTILOS = `
@keyframes peIn { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes peFade { from { opacity: 0 } to { opacity: 1 } }
#panel-eventos .pe-entra { animation: peIn .38s ease both }
#panel-eventos .pe-aparece { animation: peFade .3s ease both }
@media (prefers-reduced-motion: reduce) {
    #panel-eventos *, #panel-eventos *::before, #panel-eventos *::after {
        animation: none !important;
        transition: none !important;
    }
}
`;

// ── Piezas ──────────────────────────────────────────────────────────────

const Icono: React.FC<{ nombre: NombreDeIcono; className?: string; grosor?: number }> = ({
    nombre, className = 'w-[22px] h-[22px]', grosor = 1.8,
}) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={grosor}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <path d={ICONOS[nombre]} />
    </svg>
);

/**
 * Una tarjeta de panel.
 *
 * El hover es CSS y no estado de React: son hasta seis tarjetas y cada
 * movimiento del mouse volvería a dibujar la pantalla entera. La flecha se
 * corre también con el foco del teclado, que es cuando hace falta saber
 * cuál está seleccionada.
 */
const TarjetaDePanel: React.FC<{ panel: Panel; retardo: number; onIr: () => void }> = ({ panel, retardo, onIr }) => (
    <button
        type="button"
        onClick={onIr}
        style={{ animationDelay: `${retardo}ms` }}
        className={`pe-aparece group w-full min-h-[96px] flex items-center gap-4 p-5 rounded-[26px] text-left
            ${T.tarjeta} ${T.tinta}
            transition-[transform,box-shadow] duration-200
            hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(0,0,0,.08)] dark:hover:shadow-[0_10px_28px_rgba(0,0,0,.45)]
            active:scale-[.98]
            focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/15 dark:focus-visible:ring-white/20`}
    >
        <span className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center ${T.chip}`}>
            <Icono nombre={panel.icono} />
        </span>
        <span className="flex-1 min-w-0 flex flex-col gap-1">
            <span className="text-[17px] leading-[1.25] font-semibold">{panel.titulo}</span>
            {/* Dos líneas y corta: con tres, las tarjetas de la misma fila
                dejan de medir igual y la grilla se desarma. */}
            <span className={`text-[14px] leading-[1.45] font-medium ${T.suave} line-clamp-2`}>
                {panel.descripcion}
            </span>
        </span>
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`w-5 h-5 shrink-0 ${T.tenue} transition-[transform,color] duration-200
                group-hover:translate-x-1 group-hover:text-[#0a0a0a] dark:group-hover:text-white
                group-focus-visible:translate-x-1 group-focus-visible:text-[#0a0a0a] dark:group-focus-visible:text-white`}
        >
            <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
    </button>
);

/** La grilla: dos columnas anchas en la compu, una sola en el teléfono. */
const GRILLA = 'grid grid-cols-1 lg:[grid-template-columns:repeat(auto-fill,minmax(440px,1fr))] gap-3 pb-1.5';

// ── Pantalla ────────────────────────────────────────────────────────────

const PanelEventos: React.FC<PanelEventosProps> = ({ currentUser }) => {
    const navigate = useNavigate();

    const eventos = useMemo(
        () => PANELES_EVENTOS.filter(p => hasRole(currentUser, p.roles)),
        [currentUser],
    );
    const herramientas = useMemo(
        () => HERRAMIENTAS.filter(p => hasRole(currentUser, p.roles)),
        [currentUser],
    );
    const verConfigurar = hasRole(currentUser, CONFIGURAR.roles);

    /** Los años que de verdad tienen paneles, del más nuevo al más viejo. */
    const anios = useMemo(() => {
        const porAnio = new Map<number, PanelDeEvento[]>();
        for (const e of eventos) {
            const lista = porAnio.get(e.anio);
            if (lista) lista.push(e);
            else porAnio.set(e.anio, [e]);
        }
        return [...porAnio.entries()]
            .sort((a, b) => b[0] - a[0])
            .map(([anio, paneles]) => ({ anio, paneles }));
    }, [eventos]);

    /**
     * Qué secciones están abiertas. La más nueva abre desplegada y las
     * anteriores cerradas: lo que se administra es la edición en curso, y
     * las viejas se consultan de vez en cuando.
     */
    const [abiertos, setAbiertos] = useState<Record<number, boolean>>(() =>
        Object.fromEntries(anios.map(({ anio }, i) => [anio, i === 0])),
    );
    const alternar = (anio: number) => setAbiertos(a => ({ ...a, [anio]: !a[anio] }));

    const vacio = anios.length === 0 && herramientas.length === 0;

    return (
        <div id="panel-eventos" className={`min-h-screen ${T.fondo} ${T.tinta} ${T.fuente}`}>
            <style>{ESTILOS}</style>

            <div className="max-w-[1120px] mx-auto px-4 pt-6 pb-14 lg:px-10 lg:pt-8 lg:pb-20">

                {/* ── Encabezado ── */}
                <div className="pe-entra flex flex-wrap items-end gap-x-6 gap-y-4">
                    <div className="flex-1 basis-[320px] min-w-0">
                        <p className={rotulo}>ADMINISTRACIÓN</p>
                        <h1 className="mt-2 m-0 text-[30px] lg:text-[36px] leading-[1.08] font-semibold tracking-[-.03em]">
                            Panel de eventos
                        </h1>
                        <p className={`mt-2 m-0 text-[15.5px] leading-[1.5] ${T.suave}`}>
                            Elegí el evento que querés administrar.
                        </p>
                    </div>

                    {verConfigurar && (
                        // En la compu la explicación es un globo que sale al
                        // pasar por encima; en el teléfono no hay "encima", así
                        // que va escrita debajo del botón.
                        <div className="group/cfg relative flex-1 basis-full min-w-0 lg:flex-none lg:basis-auto">
                            <button
                                type="button"
                                onClick={() => navigate(CONFIGURAR.ruta)}
                                aria-describedby="pe-cfg-ayuda"
                                className={`w-full lg:w-auto h-[52px] lg:h-[46px] px-5 rounded-full
                                    flex items-center justify-center gap-2.5 text-[15px] font-semibold whitespace-nowrap
                                    ${T.chip} ${T.tinta}
                                    transition-[background-color,transform] duration-150
                                    hover:bg-[#e9e8e4] dark:hover:bg-[#333331] active:scale-[.98]
                                    focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/15 dark:focus-visible:ring-white/20`}
                            >
                                <Settings className="w-[18px] h-[18px]" strokeWidth={2} aria-hidden="true" />
                                Configurar /eventos
                            </button>
                            <p
                                id="pe-cfg-ayuda"
                                className={`mt-2 mx-1 text-[13px] leading-[1.45] ${T.suave}
                                    lg:absolute lg:right-0 lg:top-[calc(100%+10px)] lg:z-10 lg:w-[260px] lg:m-0 lg:px-3.5 lg:py-2.5
                                    lg:rounded-2xl lg:bg-[#0a0a0a] lg:text-white dark:lg:bg-white dark:lg:text-[#0a0a0a]
                                    lg:font-semibold lg:pointer-events-none
                                    lg:opacity-0 lg:-translate-y-1 lg:transition-[opacity,transform] lg:duration-150
                                    lg:group-hover/cfg:opacity-100 lg:group-hover/cfg:translate-y-0
                                    lg:group-focus-within/cfg:opacity-100 lg:group-focus-within/cfg:translate-y-0`}
                            >
                                {CONFIGURAR.ayuda}
                            </p>
                        </div>
                    )}
                </div>

                {/* ── Un año, una sección ── */}
                {anios.map(({ anio, paneles }, i) => {
                    const abierto = !!abiertos[anio];
                    return (
                        <section
                            key={anio}
                            className={`pe-entra ${i === 0 ? 'mt-8 lg:mt-11' : 'mt-5'}`}
                            style={{ animationDelay: `${80 + i * 70}ms` }}
                        >
                            <button
                                type="button"
                                onClick={() => alternar(anio)}
                                aria-expanded={abierto}
                                aria-controls={`pe-anio-${anio}`}
                                className="w-full min-h-[56px] mb-3 pl-1.5 pr-1 py-1.5 rounded-[20px]
                                    flex items-center gap-3 text-left transition-colors duration-150
                                    hover:bg-black/[.03] dark:hover:bg-white/[.04]
                                    focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-black/15 dark:focus-visible:ring-white/20"
                            >
                                <span className="text-[26px] lg:text-[30px] leading-none font-semibold tracking-[-.03em]">
                                    {anio}
                                </span>
                                <span className={`text-[14.5px] font-semibold ${T.suave}`}>
                                    {paneles.length} {paneles.length === 1 ? 'evento' : 'eventos'}
                                </span>
                                <span className={`ml-auto w-11 h-11 shrink-0 rounded-full flex items-center justify-center ${T.chip}`}>
                                    <ChevronDown
                                        className={`w-[18px] h-[18px] transition-transform duration-[250ms] ${abierto ? 'rotate-180' : ''}`}
                                        strokeWidth={2.2}
                                        aria-hidden="true"
                                    />
                                </span>
                            </button>

                            {/* El plegado va por grid-template-rows y no por
                                altura: así la animación sale sin medir el
                                contenido ni fijarle un alto a mano.

                                `inert` cuando está plegada porque el recorte
                                es visual: sin eso las tarjetas se siguen
                                alcanzando con el tabulador y el lector de
                                pantalla las lee, escondidas y todo. */}
                            <div
                                id={`pe-anio-${anio}`}
                                className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.3,.7,.2,1)]"
                                style={{ gridTemplateRows: abierto ? '1fr' : '0fr' }}
                                inert={!abierto}
                            >
                                <div className="overflow-hidden min-h-0">
                                    <div className={GRILLA}>
                                        {paneles.map((p, j) => (
                                            <TarjetaDePanel
                                                key={p.id}
                                                panel={p}
                                                retardo={40 + j * 45}
                                                onIr={() => navigate(p.ruta)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    );
                })}

                {/* ── Herramientas ── */}
                {herramientas.length > 0 && (
                    <section
                        className="pe-entra flex flex-col gap-3 mt-9"
                        style={{ animationDelay: `${80 + anios.length * 70}ms` }}
                    >
                        <p className={`${rotulo} px-1`}>HERRAMIENTAS</p>
                        <div className={GRILLA}>
                            {herramientas.map((p, j) => (
                                <TarjetaDePanel
                                    key={p.id}
                                    panel={p}
                                    retardo={j * 45}
                                    onIr={() => navigate(p.ruta)}
                                />
                            ))}
                        </div>
                    </section>
                )}

                {/* ── Sin nada que administrar ── */}
                {vacio && (
                    <div
                        className={`pe-entra mt-10 px-6 py-16 rounded-[28px] flex flex-col items-center text-center ${T.tarjeta}`}
                        style={{ animationDelay: '80ms' }}
                    >
                        <span className={`w-16 h-16 rounded-full flex items-center justify-center ${T.chip} ${T.suave}`}>
                            <Icono nombre="calendario" className="w-7 h-7" grosor={1.6} />
                        </span>
                        <p className="mt-5 m-0 text-[18px] font-semibold">
                            Todavía no tenés eventos para administrar
                        </p>
                        <p className={`mt-2 m-0 max-w-[320px] text-[14.5px] leading-[1.55] ${T.suave}`}>
                            Si creés que es un error, hablá con el encargado de eventos.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PanelEventos;

// ════════════════════════════════════════════════════════════════════════
// El armazón de las dos pantallas de detalle del tablero del Punto:
// /reportes/puntoinfo/bautismos-detalles y .../presentacion-detalles.
//
// POR AHORA ES UN ESQUELETO. El prompt 3 le pone adentro la tabla, el
// buscador, las pestañas, el paginado y la ficha de cada solicitud
// (design-claude/Reportes Punto de Informacion - Bautismos.dc.html).
//
// Lo que ya hace y no hay que rehacer: hereda el período de la URL y vuelve
// al tablero sin perderlo.
// ════════════════════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { C, FUENTE, Tarjeta, Esqueleto } from '../../components/Reportes/PiezasTablero';
import type { Rango } from '../audiencia/SelectorDeRango';

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const dos = (n: number) => String(n).padStart(2, '0');

const isoDeHoy = () => { const d = new Date(); return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`; };

export const rangoDeLaUrl = (search: string): Rango => {
    const q = new URLSearchParams(search);
    const desde = q.get('desde');
    const hasta = q.get('hasta');
    if (desde && hasta && ES_FECHA.test(desde) && ES_FECHA.test(hasta) && desde <= hasta) return { desde, hasta };
    const hoy = isoDeHoy();
    return { desde: `${hoy.slice(0, 7)}-01`, hasta: hoy };
};

export const textoDeRango = ({ desde, hasta }: Rango) => {
    const diaMes = (iso: string) => `${Number(iso.slice(8, 10))} ${MES[Number(iso.slice(5, 7)) - 1]}`;
    const fin = `${diaMes(hasta)} ${hasta.slice(0, 4)}`;
    if (desde === hasta) return fin;
    const mismoAnio = desde.slice(0, 4) === hasta.slice(0, 4);
    return `${diaMes(desde)}${mismoAnio ? '' : ` ${desde.slice(0, 4)}`} – ${fin}`;
};

const DetalleDelPunto: React.FC<{ titulo: string }> = ({ titulo }) => {
    const navigate = useNavigate();
    const { search } = useLocation();
    const rango = useMemo(() => rangoDeLaUrl(search), [search]);

    return (
        <div className="min-h-screen" style={{ background: C.fondo, fontFamily: FUENTE }}>
            <div className="mx-auto max-w-[1240px] px-4 pt-[18px] pb-10 md:px-10 md:pt-[30px] md:pb-14">
                <button
                    type="button"
                    onClick={() => navigate({ pathname: '/reportes/puntoinfo', search: `?desde=${rango.desde}&hasta=${rango.hasta}` })}
                    className="inline-flex items-center gap-1.5 min-h-9 text-[13px] font-semibold"
                    style={{ color: C.medio }}
                >
                    <ChevronLeft className="w-4 h-4" />
                    Reportes de Punto de Información
                </button>
                <h1 className="mt-1.5 m-0 text-[23px] md:text-[28px] leading-[1.15] font-semibold tracking-[-.02em]" style={{ color: C.tinta }}>
                    {titulo}
                </h1>
                <p className="mt-1.5 m-0 text-[13.5px] font-medium" style={{ color: C.apagado }}>{textoDeRango(rango)}</p>

                <div aria-busy="true" className="mt-6">
                    <div className="grid grid-cols-2 gap-3">
                        {[0, 1].map(i => (
                            <Tarjeta key={i} className="p-[14px] md:px-[18px] md:py-4">
                                <Esqueleto alto={12} ancho="70%" />
                                <div className="mt-3"><Esqueleto alto={26} ancho="36%" /></div>
                                <div className="mt-3"><Esqueleto alto={11} ancho="60%" /></div>
                            </Tarjeta>
                        ))}
                    </div>
                    <Tarjeta className="mt-5 px-5 py-[18px]">
                        <Esqueleto alto={14} ancho="180px" />
                        <div className="mt-4"><Esqueleto alto={44} /></div>
                        <div className="mt-2.5 flex flex-col gap-2.5">
                            {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <Esqueleto key={i} alto={40} />)}
                        </div>
                    </Tarjeta>
                </div>
            </div>
        </div>
    );
};

export default DetalleDelPunto;

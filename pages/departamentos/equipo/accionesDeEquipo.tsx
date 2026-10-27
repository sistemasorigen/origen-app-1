import React, { useState } from 'react';
import { ArrowLeftRight, UserMinus } from 'lucide-react';
import {
    cambiarLider, mensajeDeMotivo, moverMiembro, quitarMiembro,
    type Persona, type Subdepartamento,
} from '../../../services/agenda';
import { Avatar } from '../../admin/departamentos/piezas';
import HojaPersonas from './HojaPersonas';
import { Hoja, HojaElegir, usePanel } from './piezas';

/**
 * Lo que se hace con la gente de un equipo, igual desde el detalle de un
 * sub-departamento que desde la pestaña Personal:
 *
 *   · el menú ⋯ de un integrante → Mover a otro sub-departamento · Quitar;
 *   · "Cambiar" quién dirige.
 *
 * Cada una termina en una confirmación que dice qué cambia en la Agenda de
 * esa persona, y después vuelve a pedir el departamento.
 */

const nombreDe = (p: Persona | null | undefined) => p?.nombre || 'Esta persona';

type HojaAbierta =
    | { tipo: 'menu'; sub: Subdepartamento; persona: Persona }
    | { tipo: 'mover'; sub: Subdepartamento; persona: Persona }
    | { tipo: 'lider'; sub: Subdepartamento };

export const useAccionesDeEquipo = () => {
    const { datos, recargar, avisar, confirmar } = usePanel();
    const [hoja, setHoja] = useState<HojaAbierta | null>(null);
    const cerrar = () => setHoja(null);

    const pedirQuitar = (sub: Subdepartamento, persona: Persona) => confirmar({
        tipo: 'destructivo',
        rotulo: 'Quitar del sub-departamento',
        titulo: `¿Quitar a ${nombreDe(persona)} de ${sub.nombre}?`,
        texto: `${nombreDe(persona)} va a dejar de ver las tareas de ${sub.nombre} en su Agenda. Esto no borra las tareas.`,
        etiquetaBoton: 'Quitar',
        onConfirmar: async () => {
            const r = await quitarMiembro(sub.id, persona.id);
            if (!r.ok) { avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
            avisar(`${nombreDe(persona)} ya no está en ${sub.nombre}.`);
            await recargar();
        },
    });

    const pedirMover = (sub: Subdepartamento, persona: Persona, destinoId: string) => {
        const destino = datos.subdepartamentos.find(s => s.id === destinoId);
        if (!destino) return;
        confirmar({
            tipo: 'control',
            rotulo: 'Mover de equipo',
            titulo: `¿Mover a ${nombreDe(persona)} a ${destino.nombre}?`,
            texto: `Deja de ver las tareas de ${sub.nombre} y empieza a ver las de ${destino.nombre} en su Agenda.`,
            etiquetaBoton: `Mover a ${destino.nombre}`,
            onConfirmar: async () => {
                const r = await moverMiembro(sub.id, destino.id, persona.id);
                if (!r.ok) { avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
                avisar(`${nombreDe(persona)} pasó a ${destino.nombre}.`);
                await recargar();
            },
        });
    };

    const pedirLider = (sub: Subdepartamento, nueva: Persona) => confirmar({
        tipo: 'control',
        rotulo: 'Quién lo dirige',
        titulo: `${nombreDe(nueva)} va a dirigir ${sub.nombre}.`,
        texto: sub.lider
            ? `${nombreDe(sub.lider)} sigue como integrante y no pierde sus tareas.`
            : 'Va a ver el panel del sub-departamento y sus tareas.',
        etiquetaBoton: 'Cambiar',
        onConfirmar: async () => {
            const r = await cambiarLider(sub.id, nueva.id);
            if (!r.ok) { avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
            avisar(`${nombreDe(nueva)} ahora dirige ${sub.nombre}.`);
            await recargar();
        },
    });

    const nodo = (
        <>
            {hoja?.tipo === 'menu' && (
                <Hoja
                    titulo={nombreDe(hoja.persona)}
                    subtitulo={`Integrante de ${hoja.sub.nombre}`}
                    adelante={<Avatar persona={hoja.persona} color={hoja.sub.color} tam={44} />}
                    onCerrar={cerrar}
                    ancho={420}
                >
                    <div role="menu" aria-label={`Opciones para ${nombreDe(hoja.persona)}`} className="flex flex-col gap-1 pb-2">
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => setHoja({ tipo: 'mover', sub: hoja.sub, persona: hoja.persona })}
                            disabled={datos.subdepartamentos.length < 2}
                            className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3 text-left text-[14.5px] font-bold text-[#0a0a0a] hover:bg-[#f6f6f4] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a]"
                        >
                            <ArrowLeftRight size={18} strokeWidth={1.9} aria-hidden="true" />
                            Mover a otro sub-departamento
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            onClick={() => { const { sub, persona } = hoja; cerrar(); pedirQuitar(sub, persona); }}
                            className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3 text-left text-[14.5px] font-bold text-[#b42318] hover:bg-[#fdf3f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b42318]"
                        >
                            <UserMinus size={18} strokeWidth={1.9} aria-hidden="true" />
                            Quitar del sub-departamento
                        </button>
                    </div>
                </Hoja>
            )}

            {hoja?.tipo === 'mover' && (
                <HojaElegir
                    titulo={`Mover a ${nombreDe(hoja.persona)}`}
                    subtitulo={`Hoy está en ${hoja.sub.nombre}. ¿A qué sub-departamento pasa?`}
                    opciones={datos.subdepartamentos
                        .filter(s => s.id !== hoja.sub.id)
                        .map(s => ({ id: s.id, nombre: s.nombre, color: s.color, meta: `${s.cantMiembros} ${s.cantMiembros === 1 ? 'integrante' : 'integrantes'}` }))}
                    vacio="No hay otro sub-departamento al que moverla."
                    etiqueta="Elegir"
                    onElegir={id => { pedirMover(hoja.sub, hoja.persona, id); return true; }}
                    onCerrar={cerrar}
                />
            )}

            {hoja?.tipo === 'lider' && (
                <HojaPersonas
                    titulo={`Quién dirige ${hoja.sub.nombre}`}
                    subtitulo="Ve el panel del sub-departamento y cambia el estado de sus tareas."
                    uno
                    excluir={hoja.sub.lider ? [hoja.sub.lider.id] : []}
                    color={hoja.sub.color}
                    etiqueta={() => 'Elegir'}
                    etiquetaBusqueda="Buscar a quién va a dirigir"
                    textoAgregar="Elegir para dirigir"
                    onAceptar={([nueva]) => { pedirLider(hoja.sub, nueva); return true; }}
                    onCerrar={cerrar}
                />
            )}
        </>
    );

    return {
        nodo,
        abrirMenu: (sub: Subdepartamento, persona: Persona) => setHoja({ tipo: 'menu', sub, persona }),
        cambiarQuienDirige: (sub: Subdepartamento) => setHoja({ tipo: 'lider', sub }),
    };
};

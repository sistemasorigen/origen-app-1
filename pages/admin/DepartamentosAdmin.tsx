import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Plus, Search } from 'lucide-react';
import {
    eliminarDepartamento, getDepartamentosAdmin, mensajeDeMotivo,
    type DepartamentoAdmin, type MotivoAgenda,
} from '../../services/agenda';
import { useAccesoAgenda } from '../../hooks/useAccesoAgenda';
import { ModalConfirmacion, type PedidoConfirmacion } from './piezasAdmin';
import TarjetaDepartamento from './departamentos/TarjetaDepartamento';
import FormularioDepartamento, { type ModoFormulario } from './departamentos/FormularioDepartamento';
import { plural, sinAcentos } from './departamentos/piezas';

/**
 * /panel-admin?tab=departamentos — design-claude/Sistemas - Departamentos.dc.html.
 *
 * Donde SUPER_ADMIN crea, edita y borra los departamentos de Agenda Origen.
 * Vive adentro del layout de Administrador.tsx, como Reportes: la cabecera y
 * la navegación son las de ese layout; esto es el cuerpo.
 *
 * Todo va por las RPC de sql/agenda_origen.sql, que sólo le responden a
 * SUPER_ADMIN. Si la base dice sin_permiso, se muestra eso y nada más.
 *
 * Las confirmaciones (borrar, descartar cambios) son de esta sección y no del
 * layout: cuando se abre una encima del formulario, el formulario tiene que
 * saberlo para no cerrarse él también con el mismo Escape.
 */

/*
 * Los dos buscadores viven adentro de una pastilla que dibuja el recuadro.
 * index.html les pone a los campos de #admin-general fondo gris y borde con
 * !important y ocho :not() —(1,8,1)—, que le gana a .campo-desnudo (1,6,1).
 * Con un segundo id esta regla queda en (2,1,1) y gana. El foco se ve en la
 * pastilla entera (:focus-within), no en el campo.
 */
const ESTILOS = `
#admin-general #departamentos-admin input[type="search"] {
  background: transparent !important; border: 0 !important; border-radius: 0 !important;
  box-shadow: none !important; outline: none !important; padding: 0 !important; color: #0a0a0a !important;
}
#departamentos-admin .dep-pastilla:focus-within { outline: 2px solid #0a0a0a; outline-offset: 2px; }
@keyframes depFade { from { opacity: 0 } to { opacity: 1 } }
@keyframes depSube { from { transform: translateY(100%) } to { transform: none } }
@keyframes depAparece { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
@keyframes depBrillo { 0% { opacity: .55 } 50% { opacity: 1 } 100% { opacity: .55 } }
`;

type Carga =
    | { estado: 'cargando' }
    | { estado: 'error'; motivo: MotivoAgenda }
    | { estado: 'listo'; departamentos: DepartamentoAdmin[] };

const Esqueleto: React.FC = () => (
    <div aria-busy="true" aria-label="Cargando departamentos" className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 min-[1100px]:grid-cols-3">
        {[0, 1, 2].map(i => (
            <div key={i} className="flex h-[168px] flex-col gap-3 rounded-[26px] bg-white p-5">
                <div className="h-12 w-12 rounded-full bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_infinite]" />
                <div className="h-3.5 w-3/5 rounded-lg bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_infinite]" />
                <div className="h-3 w-2/5 rounded-lg bg-[#f2f2f0] motion-safe:animate-[depBrillo_1.2s_infinite]" />
            </div>
        ))}
    </div>
);

const Aviso: React.FC<{ titulo: string; texto: string; icono?: boolean; children?: React.ReactNode }> = ({ titulo, texto, icono, children }) => (
    <div className="mt-4 flex flex-col items-center rounded-[26px] bg-white px-6 py-12 text-center">
        {icono && (
            <span className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#f2f2f0] text-black/[.62]" aria-hidden="true">
                <LayoutGrid size={26} strokeWidth={1.75} />
            </span>
        )}
        <p className="m-0 text-[19px] font-bold text-[#0a0a0a]">{titulo}</p>
        <p className="m-0 mt-2 max-w-[380px] text-[14px] font-medium leading-[1.6] text-black/[.62]">{texto}</p>
        {children}
    </div>
);

const DepartamentosAdmin: React.FC<{
    /** Para saber si al guardar cambió el acceso de quien está usando el panel. */
    miId?: string;
    /** El aviso del layout (la píldora de arriba). */
    avisar: (texto: string, tipo?: 'ok' | 'error') => void;
}> = ({ miId, avisar }) => {
    const { recargar: recargarAcceso } = useAccesoAgenda();
    const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
    const [q, setQ] = useState('');
    const [form, setForm] = useState<ModoFormulario | null>(null);
    const [confirmacion, setConfirmacion] = useState<PedidoConfirmacion | null>(null);

    const cargar = useCallback(async () => {
        setCarga({ estado: 'cargando' });
        const r = await getDepartamentosAdmin();
        setCarga(r.ok ? { estado: 'listo', departamentos: r.departamentos } : { estado: 'error', motivo: r.motivo });
    }, []);
    useEffect(() => { cargar(); }, [cargar]);

    const todos = carga.estado === 'listo' ? carga.departamentos : [];
    // Por nombre del departamento o de un encargado, sin acentos ni mayúsculas.
    const filtrados = useMemo(() => {
        const k = sinAcentos(q);
        if (!k) return todos;
        return todos.filter(d => sinAcentos(`${d.nombre} ${d.encargados.map(e => e.nombre || '').join(' ')}`).includes(k));
    }, [todos, q]);

    // ── Borrar ──────────────────────────────────────────────────────────
    const pedirBorrado = (d: DepartamentoAdmin) => {
        // Con los números reales, y sin "sus 0 sub-departamentos": lo que no
        // hay no se nombra.
        //   "Creativos, sus 4 sub-departamentos, sus carpetas, prioridades, solicitudes y 23 tareas"
        //   "Creativos y sus carpetas, prioridades y solicitudes"
        const subs = d.cantSubdepartamentos === 1 ? 'su sub-departamento'
            : d.cantSubdepartamentos > 1 ? `sus ${d.cantSubdepartamentos} sub-departamentos` : '';
        const resto = d.cantTareas
            ? `sus carpetas, prioridades, solicitudes y ${plural(d.cantTareas, 'tarea', 'tareas')}`
            : 'sus carpetas, prioridades y solicitudes';
        const lista = subs ? `${d.nombre}, ${subs}, ${resto}` : `${d.nombre} y ${resto}`;
        setConfirmacion({
            tipo: 'destructivo',
            titulo: `¿Eliminar ${d.nombre}?`,
            texto: `Se van a borrar ${lista}.${d.cantTareas ? ' Nadie las va a ver más en su Agenda.' : ''} Esto no se puede deshacer.`,
            etiquetaBoton: 'Eliminar departamento',
            escribirParaConfirmar: d.nombre,
            onConfirmar: async () => {
                const r = await eliminarDepartamento(d.id);
                if (!r.ok) { avisar(mensajeDeMotivo(r.motivo), 'error'); return; }
                // Lo que devolvió la base, no lo que decía la tarjeta.
                const b = r.borrados;
                const partes = [
                    ...(b.subdepartamentos ? [plural(b.subdepartamentos, 'sub-departamento', 'sub-departamentos')] : []),
                    ...(b.tareas ? [plural(b.tareas, 'tarea', 'tareas')] : []),
                    ...(b.solicitudes ? [plural(b.solicitudes, 'solicitud', 'solicitudes')] : []),
                ];
                avisar(partes.length === 0
                    ? `Se eliminó ${d.nombre}.`
                    : `Se eliminó ${d.nombre}, con ${partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`}.`);
                setForm(null);
                if (miId && d.encargados.some(e => e.id === miId)) recargarAcceso();
                cargar();
            },
        });
    };

    // ── Cerrar con cambios ──────────────────────────────────────────────
    const pedirDescarte = () => setConfirmacion({
        tipo: 'destructivo',
        rotulo: 'Cambios sin guardar',
        titulo: '¿Descartar los cambios?',
        texto: 'Lo que cargaste en este departamento se pierde.',
        etiquetaBoton: 'Descartar',
        onConfirmar: () => setForm(null),
    });

    const alGuardar = (r: { creado: boolean; nombre: string; encargados: string[] }) => {
        // Si quien guarda entró o salió de los encargados, cambia lo que ve
        // en la Agenda y en el menú.
        const antes = form?.tipo === 'editar' ? form.departamento.encargados.map(e => e.id) : [];
        if (miId && (antes.includes(miId) !== r.encargados.includes(miId))) recargarAcceso();
        setForm(null);
        avisar(r.creado ? 'Departamento creado' : 'Cambios guardados');
        cargar();
    };

    // ── Pantalla ────────────────────────────────────────────────────────
    const sinPermiso = carga.estado === 'error' && (carga.motivo === 'sin_permiso' || carga.motivo === 'sin_sesion');

    return (
        <section id="departamentos-admin" aria-label="Departamentos" className="font-[Manrope,system-ui,sans-serif] text-[#0a0a0a]">
            <style>{ESTILOS}</style>

            {sinPermiso ? (
                <Aviso
                    titulo="No tenés permiso"
                    texto="Los departamentos de Agenda Origen los administra Sistemas. Si necesitás uno, pedíselo a quien tenga acceso a esta sección."
                />
            ) : (
                <>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <label className="dep-pastilla flex h-12 min-w-[200px] flex-1 items-center gap-2.5 rounded-full bg-white px-4 shadow-[0_1px_2px_rgba(0,0,0,.04)]">
                            <Search size={17} strokeWidth={2} className="flex-none text-black/50" aria-hidden="true" />
                            <input
                                type="search"
                                value={q}
                                onChange={e => setQ(e.target.value)}
                                placeholder="Buscar departamento o encargado"
                                aria-label="Buscar departamento o encargado"
                                className="campo-desnudo min-w-0 flex-1 text-[14.5px] font-semibold"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => setForm({ tipo: 'crear' })}
                            disabled={carga.estado !== 'listo'}
                            className="flex h-12 flex-none items-center gap-2 rounded-full bg-[#0a0a0a] pl-4 pr-5 text-[14.5px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2 disabled:opacity-40"
                        >
                            <Plus size={16} strokeWidth={2.4} aria-hidden="true" />
                            Crear departamento
                        </button>
                    </div>

                    {carga.estado === 'cargando' && <Esqueleto />}

                    {carga.estado === 'error' && (
                        <Aviso titulo="No pudimos cargar los departamentos" texto="Puede ser la conexión. Probá de nuevo.">
                            <button
                                type="button"
                                onClick={cargar}
                                className="mt-[18px] h-12 rounded-full bg-[#0a0a0a] px-[22px] text-[14.5px] font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a0a0a] focus-visible:ring-offset-2"
                            >
                                Reintentar
                            </button>
                        </Aviso>
                    )}

                    {carga.estado === 'listo' && filtrados.length === 0 && (
                        q.trim()
                            ? <Aviso icono titulo="No encontramos ese departamento" texto="Probá con otro nombre o con el nombre de un encargado." />
                            : <Aviso icono titulo="Todavía no hay departamentos" texto="Creá el primero para que un equipo empiece a usar Agenda Origen." />
                    )}

                    {carga.estado === 'listo' && filtrados.length > 0 && (
                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 min-[1100px]:grid-cols-3">
                            {filtrados.map(d => (
                                <TarjetaDepartamento
                                    key={d.id}
                                    departamento={d}
                                    onEditar={() => setForm({ tipo: 'editar', departamento: d })}
                                    onEliminar={() => pedirBorrado(d)}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}

            {form && (
                <FormularioDepartamento
                    // Otro departamento (u otra creación) es otro formulario:
                    // arranca de cero y con su propio id nuevo.
                    key={form.tipo === 'editar' ? form.departamento.id : 'nuevo'}
                    modo={form}
                    onCerrar={() => setForm(null)}
                    onGuardado={alGuardar}
                    onEliminar={form.tipo === 'editar' ? () => pedirBorrado(form.departamento) : undefined}
                    onDescartar={pedirDescarte}
                    confirmacionAbierta={!!confirmacion}
                />
            )}

            <ModalConfirmacion pedido={confirmacion} onCerrar={() => setConfirmacion(null)} />
        </section>
    );
};

export default DepartamentosAdmin;

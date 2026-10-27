import React, { useState } from 'react';
import type { Persona } from '../../../services/agenda';
import SelectorDeEncargados from '../../admin/departamentos/SelectorDeEncargados';
import { Hoja, PieDeHoja } from './piezas';

/**
 * Elegir personas en una hoja: agregar integrantes, sumar encargados o
 * cambiar quién dirige (`uno`). El buscador es el mismo selector de Sistemas
 * (agenda_buscar_usuarios, 2 letras, 300 ms, sin acentos).
 */
const HojaPersonas: React.FC<{
    titulo: string;
    subtitulo?: string;
    uno?: boolean;
    /** Quienes no se ofrecen (los que ya están). */
    excluir: string[];
    color: string;
    /** El texto del botón según cuántas hay elegidas. */
    etiqueta: (cantidad: number) => string;
    /** true = salió bien y se cierra. */
    onAceptar: (personas: Persona[]) => Promise<boolean> | boolean;
    onCerrar: () => void;
    etiquetaBusqueda: string;
    textoAgregar: string;
}> = ({ titulo, subtitulo, uno = false, excluir, color, etiqueta, onAceptar, onCerrar, etiquetaBusqueda, textoAgregar }) => {
    const [elegidas, setElegidas] = useState<Persona[]>([]);
    const [guardando, setGuardando] = useState(false);
    const [falta, setFalta] = useState(false);

    const aceptar = async () => {
        if (guardando) return;
        if (elegidas.length === 0) { setFalta(true); return; }
        setGuardando(true);
        const ok = await onAceptar(elegidas);
        setGuardando(false);
        if (ok) onCerrar();
    };

    return (
        <Hoja
            titulo={titulo}
            subtitulo={subtitulo}
            onCerrar={onCerrar}
            ocupada={guardando}
            pie={<PieDeHoja onCancelar={onCerrar} onAceptar={aceptar} etiqueta={etiqueta(elegidas.length)} guardando={guardando} apagado={elegidas.length === 0} />}
        >
            <SelectorDeEncargados
                elegidos={elegidas}
                onCambiar={p => { setElegidas(p); setFalta(false); }}
                color={color}
                error={falta ? (uno ? 'Elegí a una persona.' : 'Elegí al menos a una persona.') : null}
                rotulo={null}
                idBase="hoja-personas"
                uno={uno}
                excluir={excluir}
                etiquetaBusqueda={etiquetaBusqueda}
                textoAgregar={textoAgregar}
                etiquetaElegidos="Personas elegidas"
            />
        </Hoja>
    );
};

export default HojaPersonas;

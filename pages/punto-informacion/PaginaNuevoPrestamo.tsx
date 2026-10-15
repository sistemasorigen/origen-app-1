import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppProvider, useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { puedeEntrarAlPunto } from '../../services/authUtils';
import SinAcceso from '../../components/auth/SinAcceso';
import { ProductType, INFO_POINT_SIZES } from '../../types';
import { safeUUID } from '../../services/uuidUtils';
import {
    PantallaFormulario, Campo, ParDeCampos, BotonGuardar, Opciones, campo,
} from '../../components/info-point/FormularioDelPunto';

const VOLVER = '/punto-de-informacion?view=LOANS';

const PaginaNuevoPrestamoContent: React.FC = () => {
    const navigate = useNavigate();
    const { addLoan, showNotification } = useStore();
    const [form, setForm] = useState({
        lenderName: '',
        lenderSurname: '',
        itemType: ProductType.REMERA,
        itemSize: '1',
    });
    const [guardando, setGuardando] = useState(false);

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setGuardando(true);
        try {
            await addLoan({
                id: safeUUID(),
                ...form,
                loanDate: new Date().toISOString(),
                status: 'ACTIVE',
            });
            showNotification(`${form.itemType} talle ${form.itemSize} para ${form.lenderName}.`);
            navigate(VOLVER);
        } catch (error) {
            console.error(error);
            showNotification('No se pudo registrar el préstamo.', 'error');
        } finally {
            setGuardando(false);
        }
    };

    return (
        <PantallaFormulario
            volverA={VOLVER}
            volverTexto="Préstamos"
            titulo="Prestar una prenda"
            bajada="Queda anotada como no devuelta hasta que vuelva al mostrador."
        >
            <form onSubmit={guardar} className="space-y-4">
                <ParDeCampos>
                    <Campo etiqueta="Nombre" para="prestamo-nombre">
                        <input
                            id="prestamo-nombre" type="text" autoComplete="given-name" required
                            placeholder="Marta"
                            value={form.lenderName}
                            onChange={e => setForm({ ...form, lenderName: e.target.value })}
                            className={campo}
                        />
                    </Campo>
                    <Campo etiqueta="Apellido" para="prestamo-apellido">
                        <input
                            id="prestamo-apellido" type="text" autoComplete="family-name" required
                            placeholder="Suárez"
                            value={form.lenderSurname}
                            onChange={e => setForm({ ...form, lenderSurname: e.target.value })}
                            className={campo}
                        />
                    </Campo>
                </ParDeCampos>

                {/* Dos opciones: se tocan, no se despliegan. */}
                <Campo etiqueta="Qué se lleva">
                    <Opciones
                        etiquetaGrupo="Remera o buzo"
                        valor={form.itemType}
                        opciones={Object.values(ProductType).map(t => ({ valor: t }))}
                        onElegir={v => setForm({ ...form, itemType: v as ProductType })}
                    />
                </Campo>

                <Campo etiqueta="Talle" para="prestamo-talle">
                    <select
                        id="prestamo-talle"
                        className={`${campo} cursor-pointer`}
                        value={form.itemSize}
                        onChange={e => setForm({ ...form, itemSize: e.target.value })}
                    >
                        {INFO_POINT_SIZES.map(s => <option key={s} value={s}>Talle {s}</option>)}
                    </select>
                </Campo>

                <div className="pt-2">
                    <BotonGuardar guardando={guardando}>Anotar el préstamo</BotonGuardar>
                </div>
            </form>
        </PantallaFormulario>
    );
};

// useStore pide el store del Punto, y esta ruta es suelta: trae el suyo.
//
// Y el mismo portero que las de movimientos: se llega por link, sin pasar por
// el panel, así que el permiso del panel no la cubre. Mientras el perfil está
// en camino no se decide nada: `user` todavía es null y rebotaría a quien sí
// tiene permiso.
const PaginaNuevoPrestamo: React.FC = () => {
    const { user, isLoadingSession, isLoadingProfile } = useAuth();

    if (isLoadingSession || isLoadingProfile) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-medium">Cargando</span>
            </div>
        );
    }
    if (!puedeEntrarAlPunto(user)) return <SinAcceso />;

    return (
        <AppProvider currentUser={user}>
            <PaginaNuevoPrestamoContent />
        </AppProvider>
    );
};

export default PaginaNuevoPrestamo;

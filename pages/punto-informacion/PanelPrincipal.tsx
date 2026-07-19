import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Package, Droplets, Baby, CalendarDays, BarChart3, ArrowLeft } from 'lucide-react';
import { ProductType, INFO_POINT_SIZES, User, UserRole } from '../../types';
import SkeletonLoader from '../../components/ui/CargadorEsqueleto';
import { useAuth } from '../../contexts/AuthContext';
import { hasRole } from '../../services/authUtils';

interface DashboardProps {
    currentUser?: User | null;
    onLoginRequest?: (email: string, pass: string) => Promise<boolean>;
}

const Dashboard: React.FC<DashboardProps> = ({ currentUser, onLoginRequest }) => {
    const navigate = useNavigate();
    const { products, baptisms, presentations, events, isLoading } = useStore();
    const { user: authUser } = useAuth();

    // Determine which user object to use (prop takes precedence)
    const activeUser = currentUser || authUser;

    // Check if user can access Reports
    const canViewReports = activeUser && hasRole(activeUser, [
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN_PUNTO,
        UserRole.ENCARGADO_PUNTO
    ]);

    // Stats Calculations
    const stockRemeras = products.filter(p => p.type === ProductType.REMERA).reduce((acc, p) => acc + p.stock, 0);
    const stockBuzos = products.filter(p => p.type === ProductType.BUZO).reduce((acc, p) => acc + p.stock, 0);

    const activeEvents = events.filter(e => new Date(e.date) >= new Date()).length;
    const pendingBaptisms = baptisms.filter(b => b.isPending === 1).length;
    const pendingPresentations = presentations.filter(p => p.isPending === 1).length;

    // Chart Data Preparation (Grouped by Size)
    const chartData = INFO_POINT_SIZES.map(size => {
        const remera = products.find(p => p.type === ProductType.REMERA && p.size === size);
        const buzo = products.find(p => p.type === ProductType.BUZO && p.size === size);
        return {
            name: `T${size}`,
            Remeras: remera ? remera.stock : 0,
            Buzos: buzo ? buzo.stock : 0
        };
    });

    // Un solo acento en todo el módulo: amarillo marcador. Acá lo usamos
    // con sentido — el chip amarillo señala "esto requiere tu atención"
    // (pendientes), no es decoración. El resto queda en negro/blanco.
    const StatCard = ({ title, value, icon: Icon, highlight, onClick }: {
        title: string; value: React.ReactNode; icon: any; highlight?: boolean; onClick?: () => void;
    }) => (
        <div
            onClick={onClick}
            className={`p-5 md:p-6 bg-white border-2 md:border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all flex flex-col justify-between h-36 ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="flex justify-between items-start gap-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-neutral-500 leading-tight">{title}</span>
                <div className={`p-2 border-2 border-black shrink-0 ${highlight ? 'text-black' : 'bg-black text-white'}`} style={highlight ? { backgroundColor: '#FACC15' } : undefined}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <div className="flex items-end gap-2">
                <span className="text-4xl md:text-5xl font-black tracking-tighter tabular-nums leading-none">{value}</span>
                {highlight && (
                    <span className="mb-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 border-2 border-black text-black" style={{ backgroundColor: '#FACC15' }}>
                        Pendiente
                    </span>
                )}
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="space-y-8 animate-fadeIn">
                <SkeletonLoader width="200px" height="32px" />
                <div id="info-stats-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-32 border-2 border-black bg-neutral-100 animate-pulse shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" />
                    ))}
                </div>
                <div className="border-4 border-black bg-white h-96 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-6">
                    <SkeletonLoader className="w-full h-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn p-1">
            <button
                onClick={() => navigate('/punto-de-informacion')}
                className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-black hover:opacity-70 transition-opacity"
            >
                <ArrowLeft className="w-4 h-4" />
                Volver al Inicio
            </button>

            {/* Acceso rápido a Reportes (solo desktop, roles con permiso).
                El título de la vista ya lo muestra el header del panel. */}
            {canViewReports && (
                <div className="hidden md:flex justify-end">
                    <button
                        id="reports-btn"
                        onClick={() => navigate('/reportes')}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-black border-2 border-black font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                    >
                        <BarChart3 size={18} />
                        Reportes
                    </button>
                </div>
            )}

            {/* Top Cards Grid */}
            <div id="stats-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                <StatCard title="Stock remeras" value={stockRemeras} icon={Package} />
                <StatCard title="Stock buzos" value={stockBuzos} icon={Package} />
                <StatCard title="Eventos activos" value={activeEvents} icon={CalendarDays} />
                <StatCard title="Bautismos pend." value={pendingBaptisms} icon={Droplets} highlight={pendingBaptisms > 0} />
                <StatCard title="Present. pend." value={pendingPresentations} icon={Baby} highlight={pendingPresentations > 0} />
            </div>

            {/* Stock Chart */}
            <div className="bg-white border-2 md:border-4 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-black text-xl uppercase tracking-tight mb-6 border-b-4 border-black inline-block pb-1">
                    Distribución de Stock
                </h3>
                <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#000" opacity={0.1} />
                            <XAxis
                                dataKey="name"
                                axisLine={{ stroke: '#000', strokeWidth: 2 }}
                                tickLine={false}
                                tick={{ fill: '#000', fontSize: 12, fontWeight: 700 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#000', fontSize: 12, fontWeight: 700 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#000',
                                    border: '2px solid black',
                                    borderRadius: '0px',
                                    color: '#fff',
                                    boxShadow: '4px 4px 0px 0px rgba(0,0,0,0.2)'
                                }}
                                itemStyle={{ color: '#fff' }}
                                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="square" />
                            <Bar
                                dataKey="Remeras"
                                name="REMERAS"
                                fill="#000000"
                                radius={[0, 0, 0, 0]}
                                barSize={40}
                                stroke="#000"
                                strokeWidth={2}
                            />
                            <Bar
                                dataKey="Buzos"
                                name="BUZOS"
                                fill="#FACC15"
                                radius={[0, 0, 0, 0]}
                                barSize={40}
                                stroke="#000"
                                strokeWidth={2}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
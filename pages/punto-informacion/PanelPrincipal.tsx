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

    // El chip ámbar señala "esto requiere tu atención" (pendientes),
    // no es decoración. El resto queda en slate neutro (estilo GCX).
    const StatCard = ({ title, value, icon: Icon, highlight, onClick }: {
        title: string; value: React.ReactNode; icon: any; highlight?: boolean; onClick?: () => void;
    }) => (
        <div
            onClick={onClick}
            className={`p-5 bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between h-36 ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="flex justify-between items-start gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500 leading-tight">{title}</span>
                <div className={`p-2 rounded-lg shrink-0 ${highlight ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <div className="flex items-end gap-2">
                <span className="text-4xl md:text-5xl font-black tracking-tight tabular-nums leading-none text-slate-900">{value}</span>
                {highlight && (
                    <span className="mb-1 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
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
                        <div key={i} className="h-36 border border-slate-200 bg-white rounded-lg shadow-sm animate-pulse" />
                    ))}
                </div>
                <div className="border border-slate-200 bg-white rounded-lg h-96 shadow-sm p-6">
                    <SkeletonLoader className="w-full h-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fadeIn p-1">
            <button
                onClick={() => navigate('/punto-de-informacion')}
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-black transition-colors font-bold uppercase tracking-wide"
            >
                <ArrowLeft className="w-4 h-4" />
                Volver al inicio
            </button>

            {/* Acceso rápido a Reportes (solo desktop, roles con permiso).
                El título de la vista ya lo muestra el header del panel. */}
            {canViewReports && (
                <div className="hidden md:flex justify-end">
                    <button
                        id="reports-btn"
                        onClick={() => navigate('/reportes')}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-lg shadow-sm font-bold uppercase tracking-widest text-xs hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
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
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
                <h3 className="font-black text-lg uppercase tracking-tight text-slate-900 mb-6">
                    Distribución de stock
                </h3>
                <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} debounce={50}>
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="name"
                                axisLine={{ stroke: '#e2e8f0' }}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 12, fontWeight: 700 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    color: '#0f172a',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                                }}
                                itemStyle={{ color: '#0f172a' }}
                                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="circle" />
                            <Bar
                                dataKey="Remeras"
                                name="REMERAS"
                                fill="#118f46"
                                radius={[4, 4, 0, 0]}
                                barSize={40}
                            />
                            <Bar
                                dataKey="Buzos"
                                name="BUZOS"
                                fill="#94a3b8"
                                radius={[4, 4, 0, 0]}
                                barSize={40}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
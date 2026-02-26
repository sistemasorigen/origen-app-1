import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Package, Droplets, Baby, CalendarDays, BarChart3 } from 'lucide-react';
import { ProductType, INFO_POINT_SIZES, User, UserRole } from '../../types';
import SkeletonLoader from '../../components/SkeletonLoader';
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

    const StatCard = ({ title, value, icon: Icon, colorClass, bgClass, onClick }: any) => (
        <div
            onClick={onClick}
            className={`p-6 border-2 md:border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 transition-all flex flex-col justify-between h-36 ${bgClass || 'bg-white'} ${onClick ? 'cursor-pointer' : ''}`}
        >
            <div className="flex justify-between items-start">
                <span className="text-xs font-black uppercase tracking-widest border-b-2 border-black pb-1 mb-2">{title}</span>
                <div className={`p-2 border-2 border-black ${colorClass || 'bg-black text-white'}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <span className="text-4xl font-black tracking-tighter">{value}</span>
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
            {/* Header con título y botón de Reportes (solo desktop) */}
            <div className="flex flex-col gap-3">
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-black">
                    Resumen General
                </h2>
                {canViewReports && (
                    <div>
                        <button
                            id="reports-btn"
                            onClick={() => navigate('/pastores')}
                            className="hidden md:flex items-center gap-2 px-4 py-2 bg-white text-black border-2 border-black font-black uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-0.5 hover:shadow-none transition-all"
                        >
                            <BarChart3 size={18} />
                            REPORTES
                        </button>
                    </div>
                )}
            </div>

            {/* Top Cards Grid */}
            <div id="stats-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                <StatCard
                    title="Stock Remeras"
                    value={stockRemeras}
                    icon={Package}
                    colorClass="bg-indigo-600 text-white"
                />



                <StatCard
                    title="Stock Buzos"
                    value={stockBuzos}
                    icon={Package}
                    colorClass="bg-pink-600 text-white"
                />
                <StatCard
                    title="Eventos Activos"
                    value={activeEvents}
                    icon={CalendarDays}
                    colorClass="bg-orange-500 text-white"
                />
                <StatCard
                    title="Bautismos Pend."
                    value={pendingBaptisms}
                    icon={Droplets}
                    colorClass="bg-cyan-500 text-white"
                    bgClass="bg-cyan-50"
                />
                <StatCard
                    title="Present. Pend."
                    value={pendingPresentations}
                    icon={Baby}
                    colorClass="bg-purple-500 text-white"
                    bgClass="bg-purple-50"
                />
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
                                fill="#4f46e5"
                                radius={[0, 0, 0, 0]}
                                barSize={40}
                                stroke="#000"
                                strokeWidth={2}
                            />
                            <Bar
                                dataKey="Buzos"
                                name="BUZOS"
                                fill="#db2777"
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

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { InfoPointProduct, Movement, Baptism, ChildPresentation, Loan, AppSettings, ProductType, User } from './types';
import { safeUUID } from './services/uuidUtils';
import { db } from './services/dbService';
import { dbAPI } from './services/db';

interface NotificationState {
    show: boolean;
    message: string;
    type: 'success' | 'error';
}

interface AppContextType {
    products: InfoPointProduct[];
    movements: Movement[];
    baptisms: Baptism[];
    presentations: ChildPresentation[];
    loans: Loan[];
    settings: AppSettings;
    isLoading: boolean;
    notification: NotificationState;

    refreshData: () => Promise<void>;
    updateSettings: (s: AppSettings) => Promise<void>;
    showNotification: (message: string, type?: 'success' | 'error') => void;

    // CRUD Helpers
    addProduct: (p: InfoPointProduct) => Promise<void>;
    deleteProduct: (code: string) => Promise<void>;
    addMovement: (m: Movement) => Promise<void>;
    /** Varios de una vez. Devuelve si pudo, para poder decirlo. */
    addMovements: (ms: Movement[]) => Promise<{ ok: true } | { ok: false; motivo: 'alta' | 'stock'; sinStock: string[] }>;
    /** Para lo que no pasa por el store, como el reporte de stock (va por una RPC). */
    registrarEnBitacora: (accion: string, detalle: string) => void;
    deleteMovement: (id: string) => Promise<void>;
    addBaptism: (b: Baptism) => Promise<void>;
    updateBaptism: (b: Baptism) => Promise<void>;
    deleteBaptism: (id: string) => Promise<void>;
    addPresentation: (p: ChildPresentation) => Promise<void>;
    updatePresentation: (p: ChildPresentation) => Promise<void>;
    deletePresentation: (id: string) => Promise<void>;
    addLoan: (l: Loan) => Promise<void>;
    updateLoan: (l: Loan) => Promise<void>;
    deleteLoan: (id: string) => Promise<void>;
}

const DEFAULT_SETTINGS: AppSettings = {
    appName: 'Origen Iglesia',
    appSubtitle: 'Punto de Información',
    primaryColor: '#2563eb',
    inventoryAlertThreshold: 5,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode, currentUser: User | null }> = ({ children, currentUser }) => {
    const [products, setProducts] = useState<InfoPointProduct[]>([]);
    const [movements, setMovements] = useState<Movement[]>([]);
    const [baptisms, setBaptisms] = useState<Baptism[]>([]);
    const [presentations, setPresentations] = useState<ChildPresentation[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Notification State
    const [notification, setNotification] = useState<NotificationState>({ show: false, message: '', type: 'success' });

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ show: true, message, type });
        setTimeout(() => {
            setNotification(prev => ({ ...prev, show: false }));
        }, 3000);
    };

    // Helper to Log Actions
    const logAction = (action: string, details: string) => {
        if (currentUser) {
            db.addLog({
                id: safeUUID(),
                userId: currentUser.id,
                action: `Punto Info: ${action}`,
                details: `Usuario: ${currentUser.name}. Detalle: ${details}`,
                timestamp: new Date().toISOString()
            });
        }
    };

    const refreshData = async () => {
        // Prevent concurrent refresh calls
        if (isRefreshing) {
            console.log('[store] Refresh already in progress, skipping...');
            return;
        }

        setIsRefreshing(true);

        try {
            const [p, m, b, pres, l, s] = await Promise.all([
                dbAPI.getAllProducts().catch(() => []),
                dbAPI.getAllMovements().catch(() => []),
                dbAPI.getAllBaptisms().catch(() => []),
                dbAPI.getAllPresentations().catch(() => []),
                dbAPI.getAllLoans().catch(() => []),
                dbAPI.getSettings().catch(() => undefined)
            ]);

            setProducts(p || []);
            setMovements(m || []);
            setBaptisms(b || []);
            setPresentations(pres || []);
            setLoans(l || []);

            if (s) {
                setSettings(s);
            } else {
                try {
                    await dbAPI.saveSettings(DEFAULT_SETTINGS);
                } catch (e) {
                    console.warn('Could not save default settings:', e);
                }
            }
        } catch (err) {
            console.error("Failed to load DB data:", err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

    // --- CRUD Wrappers with Optimistic Updates & Logging ---

    const addProduct = async (p: InfoPointProduct) => {
        // Optimistic update
        setProducts(prev => [...prev, p]);
        await dbAPI.addProduct(p);
        logAction('Crear Producto', `Producto: ${p.name} (${p.code})`);
        await refreshData();
    };

    const deleteProduct = async (code: string) => {
        const prodName = products.find(p => p.code === code)?.name || code;
        setProducts(prev => prev.filter(p => p.code !== code));
        try {
            await dbAPI.deleteProduct(code);
            logAction('Eliminar Producto', `Producto: ${prodName}`);
        } catch (e) {
            console.error(e);
            await refreshData();
        }
    };

    const addMovement = async (m: Movement) => {
        // Note: Stock calculation happens in Supabase/dbAPI, so we must refresh to see new stock
        await dbAPI.addMovement(m);
        logAction('Registrar Movimiento', `${m.type} de ${m.quantity}u. para ${m.productName}`);
        await refreshData();
    };

    const registrarEnBitacora = (accion: string, detalle: string) => logAction(accion, detalle);

    const addMovements = async (ms: Movement[]) => {
        const resultado = await dbAPI.addMovements(ms);
        logAction(
            'Registrar Movimientos',
            `${ms.length} en una carga — ` + ms.map(m => `${m.type} ${m.quantity}u. ${m.productName}`).join(' · '),
        );
        await refreshData();
        return resultado;
    };

    const deleteMovement = async (id: string) => {
        const move = movements.find(m => m.id === id);
        setMovements(prev => prev.filter(m => m.id !== id));
        try {
            await dbAPI.deleteMovement(id);
            if (move) logAction('Eliminar Movimiento', `Revertido: ${move.type} de ${move.quantity}u. (${move.productName})`);
            await refreshData();
        } catch (e) {
            console.error(e);
            await refreshData();
        }
    };

    const addBaptism = async (b: Baptism) => {
        setBaptisms(prev => [...prev, b]);
        await dbAPI.addBaptism(b);
        logAction('Registrar Bautismo', `Inscripción: ${b.firstName} ${b.lastName}`);
        await refreshData();
    };

    const updateBaptism = async (b: Baptism) => {
        setBaptisms(prev => prev.map(item => item.id === b.id ? b : item));
        await dbAPI.updateBaptism(b);
        logAction('Actualizar Bautismo', `Actualización datos/estado: ${b.firstName} ${b.lastName}`);
    };

    const deleteBaptism = async (id: string) => {
        const name = baptisms.find(b => b.id === id)?.lastName || 'Registro';
        setBaptisms(prev => prev.filter(b => b.id !== id));
        try {
            await dbAPI.deleteBaptism(id);
            logAction('Eliminar Bautismo', `Borrado: ${name}`);
        } catch (e) {
            console.error(e);
            await refreshData();
        }
    };

    const addPresentation = async (p: ChildPresentation) => {
        setPresentations(prev => [...prev, p]);
        await dbAPI.addPresentation(p);
        logAction('Agendar Presentación', `Niño/a: ${p.childName} ${p.childSurname}`);
        await refreshData();
    };

    const updatePresentation = async (p: ChildPresentation) => {
        setPresentations(prev => prev.map(item => item.id === p.id ? p : item));
        await dbAPI.updatePresentation(p);
        logAction('Actualizar Presentación', `Datos: ${p.childName} ${p.childSurname}`);
    };

    const deletePresentation = async (id: string) => {
        const name = presentations.find(p => p.id === id)?.childName || 'Registro';
        setPresentations(prev => prev.filter(p => p.id !== id));
        try {
            await dbAPI.deletePresentation(id);
            logAction('Eliminar Presentación', `Borrado: ${name}`);
        } catch (e) {
            console.error(e);
            await refreshData();
        }
    };

    const addLoan = async (l: Loan) => {
        setLoans(prev => [...prev, l]);
        await dbAPI.addLoan(l);
        logAction('Nuevo Préstamo', `Prestado: ${l.itemType} a ${l.lenderName} ${l.lenderSurname}`);
        await refreshData();
    };

    const updateLoan = async (l: Loan) => {
        setLoans(prev => prev.map(item => item.id === l.id ? l : item));
        await dbAPI.updateLoan(l);
        if (l.status === 'RETURNED') logAction('Devolución Préstamo', `${l.itemType} devuelto por ${l.lenderName} ${l.lenderSurname}`);
    };

    const deleteLoan = async (id: string) => {
        setLoans(prev => prev.filter(l => l.id !== id));
        try {
            await dbAPI.deleteLoan(id);
            logAction('Eliminar Préstamo', 'Registro borrado del historial');
        } catch (e) {
            console.error(e);
            await refreshData();
        }
    };

    const updateSettings = async (s: AppSettings) => {
        setSettings(s);
        await dbAPI.saveSettings(s);
        logAction('Configuración Info', 'Actualización de configuración general del Punto de Info.');
    };

    return (
        <AppContext.Provider value={{
            products, movements, baptisms, presentations, loans, settings, isLoading, notification,
            refreshData, updateSettings, showNotification,
            addProduct, deleteProduct,
            addMovement, addMovements, deleteMovement, registrarEnBitacora,
            addBaptism, updateBaptism, deleteBaptism,
            addPresentation, updatePresentation, deletePresentation,
            addLoan, updateLoan, deleteLoan
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useStore = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useStore must be used within an AppProvider');
    }
    return context;
};

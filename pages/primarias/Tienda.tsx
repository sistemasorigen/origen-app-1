
import React, { useState, useEffect, useMemo } from 'react';
import { User, StoreProduct, StoreCartItem, StoreOrder, ClothingSize, UserRole, ProductSizeInfo, StoreCheckoutConfig, StoreConfig, BannerSlide, StoreBanner, AppConfig } from '../../types';
import { db } from '../../services/dbService';
import { supabaseService } from '../../services/supabaseService';
import { hasRole } from '../../services/authUtils';
import HeroCarousel, { HeroSlideData } from '../../components/ui/CarruselHero';
import {
    ShoppingBag,
    ShoppingCart,
    Plus,
    Minus,
    X,
    Trash2,
    Settings,
    ArrowLeft,
    Search,
    Check,
    Truck,
    Edit2,
    ArrowRight,
    CreditCard,
    Banknote,
    QrCode,
    Package,
    Clock,
    DollarSign,
    AlertCircle,
    ChevronRight,
    Eye,
    Tag,
    Layers,
    Users,
    Image as ImageIcon,
    Save,
    Link as LinkIcon,
    UserPlus,
    XCircle,
    CheckCircle,
    MapPin,
    RefreshCw,
    ClipboardList
} from 'lucide-react';

interface StoreProps {
    currentUser: User | null;
}

// --- CHECKOUT COMPONENT ---
interface StoreCheckoutProps {
    cart: StoreCartItem[];
    total: number;
    onClose: () => void;
    onPlaceOrder: (formData: any, paymentMethod: string) => void;
    config?: StoreCheckoutConfig;
}

const StoreCheckout: React.FC<StoreCheckoutProps> = ({ cart, total, onClose, onPlaceOrder, config }) => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: ''
    });
    const [paymentMethod, setPaymentMethod] = useState('');

    const isFormValid =
        formData.firstName.trim() !== '' &&
        formData.lastName.trim() !== '' &&
        formData.email.trim() !== '' &&
        formData.phone.trim() !== '' &&
        paymentMethod !== '';

    const handleSubmit = () => {
        if (isFormValid) {
            onPlaceOrder(formData, paymentMethod);
        }
    };

    const paymentMethods = config?.paymentMethods;

    // GLOBAL INPUT STYLE: White BG, Black Text, Visible Border
    const inputClass = "w-full p-3 bg-white text-black border border-slate-300 rounded-lg outline-none text-sm font-medium focus:border-black focus:ring-1 focus:ring-black transition-all placeholder-slate-400";

    return (
        <div className="fixed inset-0 z-[100] bg-white text-black overflow-y-auto animate-fadeIn">
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 border-b border-black px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-black uppercase tracking-tighter">Finalizar Compra</h2>
                <button onClick={onClose} className="flex items-center gap-2 text-sm font-bold uppercase hover:underline text-red-600">
                    <X className="w-5 h-5" /> Cancelar
                </button>
            </div>

            <div className="max-w-7xl mx-auto p-6 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-12">

                {/* SECTION A: Customer & Billing */}
                <div className="lg:col-span-7 space-y-10">
                    <section>
                        <h3 className="text-lg font-black uppercase tracking-wider mb-6 pb-2 border-b border-slate-200 flex items-center gap-2">
                            <Users className="w-5 h-5" /> {config?.titles.billing || 'Datos del Cliente'}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold uppercase mb-2 text-slate-500">Nombre *</label>
                                <input
                                    type="text"
                                    value={formData.firstName}
                                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                    className={inputClass}
                                    placeholder="Ej. Juan"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase mb-2 text-slate-500">Apellido *</label>
                                <input
                                    type="text"
                                    value={formData.lastName}
                                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                    className={inputClass}
                                    placeholder="Ej. Pérez"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase mb-2 text-slate-500">Email de Contacto *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className={inputClass}
                                    placeholder="juan@ejemplo.com"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase mb-2 text-slate-500">Teléfono / WhatsApp *</label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className={inputClass}
                                    placeholder="+54 9 11 ..."
                                />
                            </div>
                        </div>
                    </section>

                    {/* SECTION B: Pickup Info (ENFORCED) */}
                    <section className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                        <h3 className="text-sm font-black uppercase tracking-wider mb-3 flex items-center gap-2 text-slate-800">
                            <MapPin className="w-4 h-4 text-black" /> Punto de Retiro
                        </h3>
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white rounded-lg border border-slate-200 shadow-sm">
                                <Package className="w-6 h-6 text-black" />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-black leading-tight">Retiro por Iglesia</p>
                                <p className="text-sm text-slate-500 mt-1 max-w-md">
                                    Tu pedido será preparado para retirar en el stand de la iglesia al finalizar las reuniones o coordinando con secretaría.
                                </p>
                                <span className="inline-block mt-2 text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 px-2 py-1 rounded">
                                    Envío Gratis
                                </span>
                            </div>
                        </div>
                    </section>

                    {/* SECTION C: Payment Methods */}
                    <section>
                        <h3 className="text-lg font-black uppercase tracking-wider mb-6 pb-2 border-b border-slate-200 flex items-center gap-2">
                            <CreditCard className="w-5 h-5" /> {config?.titles.payment || 'Medios de Pago'}
                        </h3>
                        <div className="space-y-4">
                            {/* Transfer */}
                            {paymentMethods?.transfer.enabled && (
                                <div
                                    onClick={() => setPaymentMethod('transfer')}
                                    className={`relative border p-6 rounded-xl cursor-pointer transition-all ${paymentMethod === 'transfer' ? 'border-black bg-slate-50 shadow-md' : 'border-slate-200 hover:border-slate-400 hover:bg-white'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'transfer' ? 'border-black' : 'border-slate-300'}`}>
                                            {paymentMethod === 'transfer' && <div className="w-2.5 h-2.5 bg-black rounded-full"></div>}
                                        </div>
                                        <div>
                                            <span className="font-bold uppercase text-sm block">{paymentMethods.transfer.label}</span>
                                            <span className="text-xs text-slate-500">Pago manual vía homebanking</span>
                                        </div>
                                    </div>
                                    {paymentMethod === 'transfer' && (
                                        <div className="mt-4 p-4 bg-white border border-slate-200 rounded-lg text-sm animate-fadeIn text-slate-700">
                                            <p className="font-bold mb-2">Datos para transferir:</p>
                                            <ul className="space-y-1 text-xs font-mono">
                                                <li>Banco: {paymentMethods.transfer.details.bank}</li>
                                                <li>CBU: {paymentMethods.transfer.details.cbu}</li>
                                                <li>Alias: {paymentMethods.transfer.details.alias}</li>
                                            </ul>
                                            <p className="mt-3 text-xs text-slate-500 italic">⚠️ Envía el comprobante por WhatsApp tras confirmar el pedido.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Mercado Pago */}
                            {paymentMethods?.mercadopago.enabled && (
                                <div
                                    onClick={() => setPaymentMethod('mercadopago')}
                                    className={`relative border p-6 rounded-xl cursor-pointer transition-all ${paymentMethod === 'mercadopago' ? 'border-black bg-slate-50 shadow-md' : 'border-slate-200 hover:border-slate-400 hover:bg-white'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'mercadopago' ? 'border-black' : 'border-slate-300'}`}>
                                            {paymentMethod === 'mercadopago' && <div className="w-2.5 h-2.5 bg-black rounded-full"></div>}
                                        </div>
                                        <div>
                                            <span className="font-bold uppercase text-sm block">{paymentMethods.mercadopago.label}</span>
                                            <span className="text-xs text-slate-500">Tarjetas de crédito, débito y dinero en cuenta.</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Cash */}
                            {paymentMethods?.cash.enabled && (
                                <div
                                    onClick={() => setPaymentMethod('cash')}
                                    className={`relative border p-6 rounded-xl cursor-pointer transition-all ${paymentMethod === 'cash' ? 'border-black bg-slate-50 shadow-md' : 'border-slate-200 hover:border-slate-400 hover:bg-white'}`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'cash' ? 'border-black' : 'border-slate-300'}`}>
                                            {paymentMethod === 'cash' && <div className="w-2.5 h-2.5 bg-black rounded-full"></div>}
                                        </div>
                                        <div>
                                            <span className="font-bold uppercase text-sm block">{paymentMethods.cash.label}</span>
                                            <span className="text-xs text-slate-500">{paymentMethods.cash.message}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* SECTION D: Order Summary */}
                <div className="lg:col-span-5">
                    <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 sticky top-24 shadow-sm">
                        <h3 className="text-lg font-black uppercase tracking-wider mb-6 pb-2 border-b border-slate-200">
                            {config?.titles.summary || 'Resumen del Pedido'}
                        </h3>

                        <div className="space-y-4 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {cart.map((item, idx) => (
                                <div key={`${item.id}-${idx}`} className="flex gap-4 p-3 bg-white border border-slate-100 rounded-lg">
                                    <div className="w-12 h-14 bg-slate-100 border border-slate-200 flex-shrink-0 overflow-hidden rounded">
                                        <img src={item.image} className="w-full h-full object-cover" alt={item.name} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-xs uppercase leading-tight truncate">{item.name}</h4>
                                        <div className="flex justify-between items-center mt-1">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold bg-slate-100 px-1.5 py-0.5 rounded">Talle: {item.selectedSize}</p>
                                            <p className="text-xs text-slate-500">x {item.quantity}</p>
                                        </div>
                                    </div>
                                    <span className="font-mono text-xs font-bold text-slate-700">${(item.price * item.quantity).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>

                        <div className="space-y-3 pt-6 border-t border-slate-200">
                            <div className="flex justify-between text-sm">
                                <span className="uppercase font-bold text-slate-500">Subtotal</span>
                                <span className="font-mono font-bold">${total.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="uppercase font-bold text-slate-500">Entrega</span>
                                <span className="font-bold text-emerald-600 uppercase text-xs bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Sin Cargo</span>
                            </div>
                            <div className="flex justify-between text-2xl mt-4 pt-4 border-t border-black">
                                <span className="uppercase font-black tracking-tight">Total</span>
                                <span className="font-mono font-black tracking-tight">${total.toLocaleString()}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={!isFormValid}
                            className={`w-full py-4 mt-8 font-black uppercase tracking-[0.15em] text-sm rounded-xl transition-all shadow-lg ${isFormValid
                                ? 'bg-black text-white hover:bg-neutral-800 hover:scale-[1.02] active:scale-[0.98]'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                }`}
                        >
                            {paymentMethod === 'mercadopago' ? 'Continuar a Mercado Pago' : 'Confirmar Pedido'}
                        </button>

                        {!isFormValid && (
                            <p className="text-[10px] text-center text-red-500 mt-3 font-bold uppercase animate-pulse">
                                * Completa todos los campos obligatorios
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- END HELPER FUNCTIONS ---

const generateSizeStock = (sizes: ClothingSize[], defaultStock: number = 0): Record<ClothingSize, ProductSizeInfo> => {
    const stock: any = {};
    const allSizes: ClothingSize[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único'];
    allSizes.forEach(s => {
        stock[s] = {
            active: sizes.includes(s),
            stock: sizes.includes(s) ? defaultStock : 0
        };
    });
    return stock;
};

// --- STORE ADMIN MENU CONFIGURATION ---
type StoreAdminTabId = 'DASHBOARD' | 'PRODUCTS' | 'ORDERS' | 'CATEGORIES' | 'TAGS' | 'VOLUNTEERS' | 'CONFIG';

const STORE_ADMIN_TABS: { id: StoreAdminTabId; label: string; roles: string[] }[] = [
    { id: 'DASHBOARD', label: 'Dashboard', roles: ['ADMIN_STORE', 'SUPER_ADMIN'] },
    { id: 'PRODUCTS', label: 'Productos', roles: ['ADMIN_STORE', 'SUPER_ADMIN', 'LEADER'] },
    { id: 'ORDERS', label: 'Pedidos', roles: ['ADMIN_STORE', 'SUPER_ADMIN', 'LEADER'] },
    { id: 'CATEGORIES', label: 'Categorías', roles: ['ADMIN_STORE', 'SUPER_ADMIN'] },
    { id: 'TAGS', label: 'Etiquetas', roles: ['ADMIN_STORE', 'SUPER_ADMIN'] },
    { id: 'VOLUNTEERS', label: 'Voluntarios', roles: ['ADMIN_STORE', 'SUPER_ADMIN'] },
    { id: 'CONFIG', label: 'Config', roles: ['ADMIN_STORE', 'SUPER_ADMIN'] },
];

const Store: React.FC<StoreProps> = ({ currentUser }) => {
    // --- STATE ---
    const [view, setView] = useState<'PUBLIC' | 'ADMIN' | 'CHECKOUT'>('PUBLIC');
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [cart, setCart] = useState<StoreCartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
    const [modalSelectedSize, setModalSelectedSize] = useState<ClothingSize | null>(null);
    const [orders, setOrders] = useState<StoreOrder[]>([]);
    const [storeConfig, setStoreConfig] = useState<StoreConfig | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    // Filters (Public)
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');

    // Admin State
    const [adminTab, setAdminTab] = useState<StoreAdminTabId>('PRODUCTS');
    const [editingProduct, setEditingProduct] = useState<Partial<StoreProduct> | null>(null);
    const [adminSearchTerm, setAdminSearchTerm] = useState('');
    const [viewingOrder, setViewingOrder] = useState<StoreOrder | null>(null);

    // Admin Management State
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newTagName, setNewTagName] = useState('');
    const [volunteerForm, setVolunteerForm] = useState({ name: '', surname: '', email: '', password: '' });
    const [storeVolunteers, setStoreVolunteers] = useState<User[]>([]);

    // Edit Category/Tag States
    const [editingCategoryName, setEditingCategoryName] = useState<{ original: string, current: string } | null>(null);
    const [editingTagName, setEditingTagName] = useState<{ original: string, current: string } | null>(null);

    // Banner Management State
    const [editingBanner, setEditingBanner] = useState<Partial<StoreBanner> | null>(null);
    const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);

    // Image Preview States (Admin)
    const [imgError, setImgError] = useState<Record<string, boolean>>({});

    // Toast Notification State
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

    // Initial Data Fetch
    useEffect(() => {
        fetchData();
        const appConfig = db.getAppConfig();
        setStoreConfig(appConfig.storeConfig);
        loadVolunteers();
    }, [view]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [fetchedProducts, fetchedOrders] = await Promise.all([
                supabaseService.getStoreProducts(),
                supabaseService.getStoreOrders()
            ]);
            setProducts(fetchedProducts);
            setOrders(fetchedOrders);
        } catch (e) {
            console.error("Failed to load store data", e);
            showToast("Error cargando datos de la tienda", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const loadVolunteers = () => {
        const allUsers = db.getUsers();
        setStoreVolunteers(allUsers.filter(u => hasRole(u, UserRole.ANFITRION) && u.linkedGroupId === 'STORE'));
    };

    useEffect(() => {
        if (selectedProduct || isCartOpen || view === 'CHECKOUT' || editingProduct || viewingOrder || isBannerModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [selectedProduct, isCartOpen, view, editingProduct, viewingOrder, isBannerModalOpen]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 5000);
    };

    const isStoreAdmin = currentUser && hasRole(currentUser, [UserRole.SUPER_ADMIN, UserRole.ADMIN_STORE]);
    const isStoreVolunteer = currentUser && hasRole(currentUser, UserRole.ANFITRION) && currentUser.linkedGroupId === 'STORE';
    const canAccessAdmin = isStoreAdmin || isStoreVolunteer;

    const allowedTabs = useMemo(() => {
        return STORE_ADMIN_TABS.filter(tab => {
            // Super Admin & Store Admin see everything
            if (isStoreAdmin) return true;
            // Volunteers ONLY see Dashboard, Products, Orders
            if (isStoreVolunteer && ['DASHBOARD', 'PRODUCTS', 'ORDERS'].includes(tab.id)) return true;
            return false;
        });
    }, [isStoreAdmin, isStoreVolunteer]);

    useEffect(() => {
        if (view === 'ADMIN') {
            const isAllowed = allowedTabs.some(t => t.id === adminTab);
            if (!isAllowed && allowedTabs.length > 0) {
                setAdminTab(allowedTabs[0].id);
            }
        }
    }, [adminTab, allowedTabs, view]);

    const addToCart = (product: StoreProduct, size: ClothingSize, qty: number) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id && item.selectedSize === size);
            if (existing) {
                return prev.map(item =>
                    item.id === product.id && item.selectedSize === size
                        ? { ...item, quantity: item.quantity + qty }
                        : item
                );
            }
            return [...prev, { ...product, selectedSize: size, quantity: qty }];
        });
        setIsCartOpen(true);
        setSelectedProduct(null);
        setModalSelectedSize(null);
    };

    const handleQuickAdd = (e: React.MouseEvent, product: StoreProduct) => {
        e.stopPropagation();
        const firstAvailableSize = (Object.keys(product.sizes) as ClothingSize[]).find(
            size => product.sizes[size].active && product.sizes[size].stock > 0
        );

        if (firstAvailableSize) {
            addToCart(product, firstAvailableSize, 1);
        } else {
            alert("No hay stock disponible para este producto.");
        }
    };

    const removeFromCart = (itemId: string, size: ClothingSize) => {
        setCart(prev => prev.filter(item => !(item.id === itemId && item.selectedSize === size)));
    };

    const updateCartQty = (itemId: string, size: ClothingSize, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.id === itemId && item.selectedSize === size) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const handlePlaceOrder = async (formData: any, paymentMethod: string) => {
        if (paymentMethod === 'mercadopago' && storeConfig?.checkout?.paymentMethods.mercadopago.link) {
            window.open(storeConfig.checkout.paymentMethods.mercadopago.link, '_blank');
        }

        // DATA SNAPSHOT: Deep copy items to persist price/name at time of purchase
        const snapshotItems: StoreCartItem[] = cart.map(item => ({
            ...item,
            id: item.id,
            name: item.name,
            price: Number(item.price), // Ensure number
            quantity: Number(item.quantity),
            selectedSize: item.selectedSize
        }));

        const newOrder: StoreOrder = {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            status: 'Procesando',
            items: snapshotItems,
            total: Number(cartTotal),
            customer: {
                name: `${formData.firstName} ${formData.lastName}`,
                email: formData.email,
                phone: formData.phone,
                address: 'Retiro por Iglesia',
                city: 'Local',
                zip: '-'
            },
            payment: { method: paymentMethod as any }
        };

        const created = await supabaseService.createStoreOrder(newOrder);

        if (created) {
            setCart([]);
            setView('PUBLIC');
            // Refresh Orders List
            setOrders(prev => [created, ...prev]);
            showToast('Pedido realizado exitosamente. Puede retirarlo por el stand.', 'success');
        } else {
            showToast('Hubo un error al procesar el pedido.', 'error');
        }
    };

    const logAction = (action: string, details: string) => {
        if (currentUser) {
            db.addLog({
                id: crypto.randomUUID(),
                userId: currentUser.id,
                action: `Store: ${action}`,
                details,
                timestamp: new Date().toISOString()
            });
        }
    };

    const handleSaveProduct = async () => {
        if (!editingProduct?.name || !editingProduct?.price || !editingProduct?.category) return;

        const totalStock = (Object.values(editingProduct.sizes || {}) as ProductSizeInfo[]).reduce((acc: number, s: ProductSizeInfo) => acc + (s.stock || 0), 0);

        const newProd: StoreProduct = {
            id: editingProduct.id || crypto.randomUUID(),
            sku: editingProduct.sku || `SKU-${Date.now()}`,
            name: editingProduct.name,
            price: Number(editingProduct.price || 0),
            category: editingProduct.category,
            image: editingProduct.image || '',
            description: editingProduct.description || '',
            sizes: editingProduct.sizes || generateSizeStock(['M'], 0),
            totalStock: totalStock,
            eventIds: editingProduct.eventIds || [],
            material: editingProduct.material,
            tags: editingProduct.tags || []
        };

        const saved = await supabaseService.saveStoreProduct(newProd);

        if (saved) {
            // Update local state to reflect changes immediately
            if (editingProduct.id) {
                setProducts(prev => prev.map(p => p.id === saved.id ? saved : p));
                logAction('Editar Producto', `Producto: ${saved.name}`);
            } else {
                setProducts(prev => [...prev, saved]);
                logAction('Crear Producto', `Producto: ${saved.name}`);
            }

            setEditingProduct(null);
            setImgError({});
            showToast('Producto guardado correctamente.');
        } else {
            showToast('Error al guardar el producto.', 'error');
        }
    };

    const handleDeleteProduct = async (id: string) => {
        if (confirm('¿Seguro que deseas eliminar este producto?')) {
            const success = await supabaseService.deleteStoreProduct(id);
            if (success) {
                setProducts(prev => prev.filter(p => p.id !== id));
                logAction('Eliminar Producto', `ID: ${id}`);
                showToast('Producto eliminado.');
            } else {
                showToast('Error al eliminar producto.', 'error');
            }
        }
    };

    // INVENTORY TRIGGER SYSTEM
    const handleUpdateOrderStatus = async (orderId: string, newStatus: StoreOrder['status']) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        const oldStatus = order.status;
        const success = await supabaseService.updateOrderStatus(orderId, newStatus);

        if (!success) {
            showToast('Error actualizando estado.', 'error');
            return;
        }

        // 1. TRIGGER: Approval (Deduct Stock)
        if ((newStatus === 'Pagado' || newStatus === 'Enviado' || newStatus === 'Entregado') && (oldStatus === 'Procesando' || oldStatus === 'Cancelado')) {
            if (oldStatus !== 'Pagado' && oldStatus !== 'Enviado' && oldStatus !== 'Entregado') {
                await supabaseService.updateStockFromOrder(order.items, false); // false = deduct
            }
        }

        // 2. TRIGGER: Cancellation (Restock)
        if (newStatus === 'Cancelado' && (oldStatus === 'Pagado' || oldStatus === 'Enviado' || oldStatus === 'Entregado')) {
            await supabaseService.updateStockFromOrder(order.items, true); // true = restock/reverse
        }

        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        showToast(`Pedido actualizado: ${newStatus}`);
    };

    // --- CATEGORY & TAG MANAGEMENT ---
    const updateStoreConfig = async (newConfig: StoreConfig) => {
        // Update Local
        setStoreConfig(newConfig);
        const appConfig = db.getAppConfig();
        const updatedAppConfig = { ...appConfig, storeConfig: newConfig };

        // Persist
        db.saveAppConfig(updatedAppConfig);
        await supabaseService.saveAppConfig(updatedAppConfig);
        showToast('Configuración actualizada');
    };

    // Category CRUD
    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        const currentCats = storeConfig?.categories || [];
        if (currentCats.includes(newCategoryName.trim())) {
            showToast('Esa categoría ya existe', 'error');
            return;
        }
        const updatedCats = [...currentCats, newCategoryName.trim()];
        await updateStoreConfig({ ...storeConfig, categories: updatedCats });
        setNewCategoryName('');
    };

    const handleUpdateCategory = async () => {
        if (!editingCategoryName || !editingCategoryName.current.trim()) return;
        const currentCats = storeConfig?.categories || [];
        const updatedCats = currentCats.map(c => c === editingCategoryName.original ? editingCategoryName.current.trim() : c);
        await updateStoreConfig({ ...storeConfig, categories: updatedCats });
        setEditingCategoryName(null);
    };

    const handleDeleteCategory = async (cat: string) => {
        // No confirmation needed as per request
        const currentCats = storeConfig?.categories || [];
        const updatedCats = currentCats.filter(c => c !== cat);
        await updateStoreConfig({ ...storeConfig, categories: updatedCats });
    };

    // Tag CRUD
    const handleAddTag = async () => {
        if (!newTagName.trim()) return;
        const currentTags = storeConfig?.tags || [];
        if (currentTags.includes(newTagName.trim())) {
            showToast('Esa etiqueta ya existe', 'error');
            return;
        }
        const updatedTags = [...currentTags, newTagName.trim()];
        await updateStoreConfig({ ...storeConfig, tags: updatedTags });
        setNewTagName('');
    };

    const handleUpdateTag = async () => {
        if (!editingTagName || !editingTagName.current.trim()) return;
        const currentTags = storeConfig?.tags || [];
        const updatedTags = currentTags.map(t => t === editingTagName.original ? editingTagName.current.trim() : t);
        await updateStoreConfig({ ...storeConfig, tags: updatedTags });
        setEditingTagName(null);
    };

    const handleDeleteTag = async (tag: string) => {
        // No confirmation needed as per request
        const currentTags = storeConfig?.tags || [];
        const updatedTags = currentTags.filter(t => t !== tag);
        await updateStoreConfig({ ...storeConfig, tags: updatedTags });
    };

    // --- RENDER ---

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const banners = storeConfig?.banners || [];
    const heroSlides: HeroSlideData[] = banners.map(b => ({
        id: b.id,
        imageUrl: b.imageUrl || '',
        titlePrefix: b.titlePrefix,
        titleHighlight: b.titleHighlight,
        description: b.description,
        buttonText: b.buttonText,
        onButtonClick: () => {
            const element = document.getElementById('store-products');
            element?.scrollIntoView({ behavior: 'smooth' });
        }
    }));

    if (view === 'CHECKOUT') {
        return (
            <StoreCheckout
                cart={cart}
                total={cartTotal}
                onClose={() => setView('PUBLIC')}
                onPlaceOrder={handlePlaceOrder}
                config={storeConfig?.checkout}
            />
        );
    }

    if (view === 'ADMIN') {
        return (
            <div className="min-h-screen bg-slate-50 p-8">
                {/* Admin Navbar */}
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black uppercase">Panel Tienda</h2>
                    <div className="flex gap-4">
                        <button onClick={() => setView('PUBLIC')} className="text-sm font-bold uppercase text-slate-500 hover:text-black">
                            Volver a la Tienda
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-8 border-b border-slate-200">
                    {allowedTabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setAdminTab(tab.id)}
                            className={`pb-2 px-4 text-xs font-bold uppercase border-b-2 transition-all ${adminTab === tab.id ? 'border-black text-black' : 'border-transparent text-slate-400'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    {adminTab === 'DASHBOARD' && (
                        <div>
                            <h3 className="text-xl font-bold mb-4">Resumen</h3>
                            <div className="grid grid-cols-3 gap-6">
                                <div className="p-6 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Pedidos Totales</span>
                                    <p className="text-3xl font-black mt-2">{orders.length}</p>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Productos</span>
                                    <p className="text-3xl font-black mt-2">{products.length}</p>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-lg border border-slate-100">
                                    <span className="text-xs font-bold text-slate-400 uppercase">Pendientes</span>
                                    <p className="text-3xl font-black mt-2">{orders.filter(o => o.status === 'Procesando').length}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {adminTab === 'PRODUCTS' && (
                        <div>
                            <div className="flex justify-between mb-4">
                                <input
                                    type="text"
                                    placeholder="Buscar producto..."
                                    value={adminSearchTerm}
                                    onChange={e => setAdminSearchTerm(e.target.value)}
                                    className="p-2 border border-slate-200 rounded-lg text-sm w-64"
                                />
                                <button
                                    onClick={() => setEditingProduct({ name: '', price: 0, stock: 0 })}
                                    className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold uppercase"
                                >
                                    + Nuevo Producto
                                </button>
                            </div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-3">Producto</th>
                                        <th className="p-3">Precio</th>
                                        <th className="p-3">Stock Total</th>
                                        <th className="p-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.filter(p => p.name.toLowerCase().includes(adminSearchTerm.toLowerCase())).map(p => (
                                        <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="p-3 font-bold">{p.name}</td>
                                            <td className="p-3">${p.price}</td>
                                            <td className="p-3">{p.totalStock}</td>
                                            <td className="p-3 text-right">
                                                <button onClick={() => setEditingProduct(p)} className="text-blue-600 mr-2 hover:underline">Editar</button>
                                                <button onClick={() => handleDeleteProduct(p.id)} className="text-red-600 hover:underline">Borrar</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {adminTab === 'ORDERS' && (
                        <div>
                            <h3 className="text-xl font-bold mb-4">Pedidos Recientes</h3>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-3">ID</th>
                                        <th className="p-3">Cliente</th>
                                        <th className="p-3">Total</th>
                                        <th className="p-3">Estado</th>
                                        <th className="p-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(order => (
                                        <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="p-3 font-mono text-xs">{order.id.slice(0, 8)}...</td>
                                            <td className="p-3">{order.customer.name}</td>
                                            <td className="p-3 font-bold">${order.total}</td>
                                            <td className="p-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${order.status === 'Pagado' ? 'bg-emerald-100 text-emerald-700' :
                                                    order.status === 'Cancelado' ? 'bg-red-100 text-red-700' :
                                                        'bg-yellow-100 text-yellow-700'
                                                    }`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <select
                                                    value={order.status}
                                                    onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as any)}
                                                    className="p-1 border border-slate-300 rounded text-xs"
                                                >
                                                    <option value="Procesando">Procesando</option>
                                                    <option value="Pagado">Pagado</option>
                                                    <option value="Enviado">Enviado</option>
                                                    <option value="Entregado">Entregado</option>
                                                    <option value="Cancelado">Cancelado</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {adminTab === 'CATEGORIES' && (
                        <div className="max-w-2xl">
                            <h3 className="text-xl font-bold mb-6">Gestión de Categorías</h3>

                            <div className="flex gap-2 mb-6">
                                <input
                                    type="text"
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                    placeholder="Nueva Categoría..."
                                    className="flex-1 p-2 border border-slate-200 rounded-lg text-sm"
                                />
                                <button onClick={handleAddCategory} className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold uppercase">Agregar</button>
                            </div>

                            <ul className="space-y-2">
                                {(storeConfig?.categories || []).map((cat, idx) => (
                                    <li key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                        {editingCategoryName?.original === cat ? (
                                            <input
                                                type="text"
                                                value={editingCategoryName.current}
                                                onChange={e => setEditingCategoryName({ ...editingCategoryName, current: e.target.value })}
                                                className="flex-1 p-1 border border-slate-300 rounded text-sm mr-2"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="font-medium text-sm">{cat}</span>
                                        )}

                                        <div className="flex gap-2">
                                            {editingCategoryName?.original === cat ? (
                                                <button onClick={handleUpdateCategory} className="p-1.5 bg-green-100 text-green-700 rounded"><Check className="w-4 h-4" /></button>
                                            ) : (
                                                <button onClick={() => setEditingCategoryName({ original: cat, current: cat })} className="p-1.5 text-slate-400 hover:text-black"><Edit2 className="w-4 h-4" /></button>
                                            )}
                                            <button onClick={() => handleDeleteCategory(cat)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {adminTab === 'TAGS' && (
                        <div className="max-w-2xl">
                            <h3 className="text-xl font-bold mb-6">Gestión de Etiquetas (Tags)</h3>

                            <div className="flex gap-2 mb-6">
                                <input
                                    type="text"
                                    value={newTagName}
                                    onChange={e => setNewTagName(e.target.value)}
                                    placeholder="Nueva Etiqueta..."
                                    className="flex-1 p-2 border border-slate-200 rounded-lg text-sm"
                                />
                                <button onClick={handleAddTag} className="bg-black text-white px-4 py-2 rounded-lg text-xs font-bold uppercase">Agregar</button>
                            </div>

                            <ul className="space-y-2">
                                {(storeConfig?.tags || []).map((tag, idx) => (
                                    <li key={idx} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg">
                                        {editingTagName?.original === tag ? (
                                            <input
                                                type="text"
                                                value={editingTagName.current}
                                                onChange={e => setEditingTagName({ ...editingTagName, current: e.target.value })}
                                                className="flex-1 p-1 border border-slate-300 rounded text-sm mr-2"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="font-medium text-sm">#{tag}</span>
                                        )}

                                        <div className="flex gap-2">
                                            {editingTagName?.original === tag ? (
                                                <button onClick={handleUpdateTag} className="p-1.5 bg-green-100 text-green-700 rounded"><Check className="w-4 h-4" /></button>
                                            ) : (
                                                <button onClick={() => setEditingTagName({ original: tag, current: tag })} className="p-1.5 text-slate-400 hover:text-black"><Edit2 className="w-4 h-4" /></button>
                                            )}
                                            <button onClick={() => handleDeleteTag(tag)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Placeholder for other tabs if not implemented in truncated code */}
                    {['VOLUNTEERS', 'CONFIG'].includes(adminTab) && (
                        <div className="text-center py-10 text-slate-400">
                            Funcionalidad de {adminTab} en desarrollo.
                        </div>
                    )}
                </div>

                {/* Edit Modal */}
                {editingProduct && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                        <div className="bg-white w-full max-w-2xl rounded-xl p-6 max-h-[90vh] overflow-y-auto">
                            <h3 className="text-xl font-bold mb-4">{editingProduct.id ? 'Editar Producto' : 'Nuevo Producto'}</h3>
                            <div className="space-y-4">
                                <input type="text" placeholder="Nombre" value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} className="w-full p-2 border rounded" />
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="number" placeholder="Precio" value={editingProduct.price} onChange={e => setEditingProduct({ ...editingProduct, price: parseInt(e.target.value) })} className="w-full p-2 border rounded" />
                                    <select
                                        value={editingProduct.category || ''}
                                        onChange={e => setEditingProduct({ ...editingProduct, category: e.target.value })}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="">Seleccionar Categoría...</option>
                                        {storeConfig?.categories?.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <textarea placeholder="Descripción" value={editingProduct.description} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} className="w-full p-2 border rounded h-20" />
                                <input type="text" placeholder="URL Imagen" value={editingProduct.image} onChange={e => setEditingProduct({ ...editingProduct, image: e.target.value })} className="w-full p-2 border rounded" />

                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 mb-2 block">Etiquetas</label>
                                    <div className="flex flex-wrap gap-2">
                                        {storeConfig?.tags?.map(tag => {
                                            const isSelected = (editingProduct.tags || []).includes(tag);
                                            return (
                                                <button
                                                    key={tag}
                                                    onClick={() => {
                                                        const current = editingProduct.tags || [];
                                                        const next = isSelected ? current.filter(t => t !== tag) : [...current, tag];
                                                        setEditingProduct({ ...editingProduct, tags: next });
                                                    }}
                                                    className={`px-2 py-1 text-xs border rounded ${isSelected ? 'bg-black text-white border-black' : 'bg-white text-slate-500 border-slate-200'}`}
                                                >
                                                    {tag}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-2">
                                <button onClick={() => setEditingProduct(null)} className="px-4 py-2 text-slate-500">Cancelar</button>
                                <button onClick={handleSaveProduct} className="px-4 py-2 bg-black text-white rounded font-bold">Guardar</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- PUBLIC VIEW ---
    return (
        <div className="min-h-screen bg-white">
            {toast.show && (
                <div className={`fixed top-24 right-8 z-[100] px-6 py-4 rounded-xl shadow-xl flex items-center gap-3 animate-slideIn ${toast.type === 'success' ? 'bg-black text-white' : 'bg-red-600 text-white'}`}>
                    <span className="font-bold text-sm uppercase">{toast.message}</span>
                </div>
            )}

            {/* Navbar & Cart Toggle */}
            <nav className="sticky top-16 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200 h-16 flex items-center px-6 justify-between">
                <h1 className="font-black text-xl uppercase tracking-tighter">Tienda Origen</h1>
                <div className="flex items-center gap-4">
                    {canAccessAdmin && (
                        <button onClick={() => setView('ADMIN')} className="text-xs font-bold uppercase hover:underline">
                            Admin
                        </button>
                    )}
                    <button onClick={() => setIsCartOpen(true)} className="relative p-2">
                        <ShoppingBag className="w-6 h-6" />
                        {cart.length > 0 && (
                            <span className="absolute top-0 right-0 w-4 h-4 bg-red-600 text-white text-[9px] font-bold flex items-center justify-center rounded-full">
                                {cart.length}
                            </span>
                        )}
                    </button>
                </div>
            </nav>

            {/* Hero */}
            <HeroCarousel slides={heroSlides} theme="store" heightClass="h-[60vh]" />

            {/* Content */}
            <div id="store-products" className="max-w-[1920px] mx-auto px-6 py-12">
                <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                    <div className="flex gap-4 overflow-x-auto pb-2">
                        <button onClick={() => setSelectedCategory('Todas')} className={`text-sm font-bold uppercase border-b-2 ${selectedCategory === 'Todas' ? 'border-black' : 'border-transparent text-slate-400'}`}>Todas</button>
                        {storeConfig?.categories?.map(cat => (
                            <button key={cat} onClick={() => setSelectedCategory(cat)} className={`text-sm font-bold uppercase border-b-2 ${selectedCategory === cat ? 'border-black' : 'border-transparent text-slate-400'}`}>{cat}</button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-full text-sm w-64"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {filteredProducts.map(product => (
                        <div key={product.id} className="group cursor-pointer" onClick={() => setSelectedProduct(product)}>
                            <div className="aspect-[3/4] bg-neutral-100 mb-4 overflow-hidden relative">
                                <img src={product.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={product.name} />
                                {product.totalStock === 0 && (
                                    <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                                        <span className="bg-black text-white text-xs font-bold uppercase px-3 py-1">Agotado</span>
                                    </div>
                                )}
                                <button
                                    onClick={(e) => handleQuickAdd(e, product)}
                                    className="absolute bottom-4 right-4 bg-white p-3 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-black hover:text-white"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>
                            <h3 className="font-bold uppercase text-sm">{product.name}</h3>
                            <p className="text-neutral-500 text-sm">${product.price}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Cart Sidebar */}
            {isCartOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
                    <div className="relative w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col animate-slideInRight">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black uppercase">Tu Carrito</h2>
                            <button onClick={() => setIsCartOpen(false)}><X className="w-6 h-6" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4">
                            {cart.map((item, idx) => (
                                <div key={`${item.id}-${item.selectedSize}`} className="flex gap-4 border-b border-slate-100 pb-4">
                                    <img src={item.image} className="w-20 h-24 object-cover bg-slate-50" />
                                    <div className="flex-1">
                                        <h4 className="font-bold text-sm uppercase">{item.name}</h4>
                                        <p className="text-xs text-slate-500 mb-2">Talle: {item.selectedSize}</p>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => updateCartQty(item.id, item.selectedSize, -1)} className="p-1 bg-slate-100 rounded hover:bg-slate-200"><Minus className="w-3 h-3" /></button>
                                            <span className="text-sm font-bold">{item.quantity}</span>
                                            <button onClick={() => updateCartQty(item.id, item.selectedSize, 1)} className="p-1 bg-slate-100 rounded hover:bg-slate-200"><Plus className="w-3 h-3" /></button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col justify-between items-end">
                                        <span className="font-bold">${item.price * item.quantity}</span>
                                        <button onClick={() => removeFromCart(item.id, item.selectedSize)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                            ))}
                            {cart.length === 0 && <p className="text-center text-slate-400 py-10">Tu carrito está vacío.</p>}
                        </div>

                        <div className="border-t border-slate-200 pt-6 mt-4">
                            <div className="flex justify-between text-xl font-black uppercase mb-6">
                                <span>Total</span>
                                <span>${cartTotal}</span>
                            </div>
                            <button
                                onClick={() => { setIsCartOpen(false); setView('CHECKOUT'); }}
                                disabled={cart.length === 0}
                                className="w-full bg-black text-white py-4 font-bold uppercase tracking-widest hover:bg-neutral-800 disabled:opacity-50"
                            >
                                Finalizar Compra
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Detail Modal */}
            {selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl relative max-h-[90vh]">
                        <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 z-10 p-2 bg-white rounded-full shadow-md hover:bg-slate-100"><X className="w-5 h-5" /></button>
                        <div className="bg-neutral-100 h-full">
                            <img src={selectedProduct.image} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-8 md:p-12 overflow-y-auto">
                            <h2 className="text-3xl font-black uppercase tracking-tight mb-2">{selectedProduct.name}</h2>
                            <p className="text-2xl text-neutral-500 mb-6">${selectedProduct.price}</p>
                            <p className="text-slate-600 mb-8 leading-relaxed">{selectedProduct.description}</p>

                            <div className="mb-8">
                                <label className="text-xs font-bold uppercase text-slate-400 mb-2 block">Seleccionar Talle</label>
                                <div className="flex gap-2 flex-wrap">
                                    {(Object.entries(selectedProduct.sizes) as [ClothingSize, ProductSizeInfo][]).map(([size, info]) => (
                                        <button
                                            key={size}
                                            disabled={!info.active || info.stock <= 0}
                                            onClick={() => setModalSelectedSize(size)}
                                            className={`w-10 h-10 flex items-center justify-center border rounded-lg text-sm font-bold transition-all ${modalSelectedSize === size
                                                ? 'bg-black text-white border-black'
                                                : (!info.active || info.stock <= 0)
                                                    ? 'opacity-30 cursor-not-allowed border-slate-200'
                                                    : 'border-slate-300 hover:border-black'
                                                }`}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                disabled={!modalSelectedSize}
                                onClick={() => { if (modalSelectedSize) addToCart(selectedProduct, modalSelectedSize, 1); }}
                                className="w-full bg-black text-white py-4 font-bold uppercase tracking-widest hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {modalSelectedSize ? 'Agregar al Carrito' : 'Elige un Talle'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Store;

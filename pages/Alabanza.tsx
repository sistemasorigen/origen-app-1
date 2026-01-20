
import React, { useState, useEffect } from 'react';
import { db } from '../services/dbService';
import { dbAPI } from '../services/db';
import { hasRole } from '../services/authUtils';
import { Song, User, UserRole, BannerSlide, AppConfig, AlabanzaApplication, AlabanzaCategory, AlabanzaArtist, PlaybackRecord } from '../types';
import {
    Play, Pause, Search, Music, Settings, LogIn, Plus, Trash2, Edit2,
    Image as ImageIcon, ArrowLeft, CheckCircle, X, ClipboardList,
    UserPlus, Check, XCircle, Phone, Mic2, Layers,
    BarChart3, Youtube, Link as LinkIcon
} from 'lucide-react';
import SystemLoginModal from '../components/SystemLoginModal';
import { useAudio } from '../contexts/AudioContext';
import HeroCarousel, { HeroSlideData } from '../components/HeroCarousel';
import ImageUpload from '../components/ImageUpload';

// Helper to extract YouTube Video ID
const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

interface AlabanzaProps {
    currentUser: User | null;
    onLoginRequest: (email: string, pass: string) => Promise<boolean>;
}

const Alabanza: React.FC<AlabanzaProps> = ({ currentUser, onLoginRequest }) => {
    const { playSong, currentSong, isPlaying } = useAudio();

    // --- GLOBAL STATE ---
    const [view, setView] = useState<'PUBLIC' | 'ADMIN'>('PUBLIC');
    const [loginModalOpen, setLoginModalOpen] = useState(false);

    // --- DATA STATE ---
    const [songs, setSongs] = useState<Song[]>([]);
    const [categories, setCategories] = useState<AlabanzaCategory[]>([]);
    const [artists, setArtists] = useState<AlabanzaArtist[]>([]);
    const [applications, setApplications] = useState<AlabanzaApplication[]>([]);
    const [playbackHistory, setPlaybackHistory] = useState<PlaybackRecord[]>([]);
    const [config, setConfig] = useState<AppConfig>(db.getAppConfig());

    // --- UI STATE (Public) ---
    const [selectedCategory, setSelectedCategory] = useState('Todos');
    const [searchTerm, setSearchTerm] = useState('');
    const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
    const [appForm, setAppForm] = useState({
        firstName: '', lastName: '', email: '', phone: '',
        attendsChurch: false, didCrecer: false, didTraining: false
    });
    const [appLoading, setAppLoading] = useState(false);

    // --- UI STATE (Admin) ---
    const [adminTab, setAdminTab] = useState<'DASHBOARD' | 'SONGS' | 'ARTISTS' | 'CATEGORIES' | 'BANNERS' | 'APPLICATIONS'>('DASHBOARD');
    const [adminSearchTerm, setAdminSearchTerm] = useState('');

    const [editingSong, setEditingSong] = useState<Partial<Song> | null>(null);
    const [editingBanner, setEditingBanner] = useState<Partial<BannerSlide> | null>(null);
    const [editingCategory, setEditingCategory] = useState<Partial<AlabanzaCategory> | null>(null);
    const [editingArtist, setEditingArtist] = useState<Partial<AlabanzaArtist> | null>(null);
    const [viewingApplication, setViewingApplication] = useState<AlabanzaApplication | null>(null);

    // Embed Player State
    const [playingYoutubeId, setPlayingYoutubeId] = useState<string | null>(null);

    const [imgError, setImgError] = useState<Record<string, boolean>>({});
    const [toast, setToast] = useState<{ show: boolean, msg: string, type: 'success' | 'error' }>({ show: false, msg: '', type: 'success' });

    useEffect(() => {
        const loadData = async () => {
            try {
                const [loadedSongs, loadedCats, loadedArtists] = await Promise.all([
                    dbAPI.getAllSongs(),
                    dbAPI.getAllAlabanzaCategories(),
                    dbAPI.getAllAlabanzaArtists()
                ]);
                setSongs(loadedSongs || []);
                setCategories(loadedCats || []);
                setArtists(loadedArtists || []);

                if (currentUser && hasRole(currentUser, [UserRole.SUPER_ADMIN, UserRole.ADMIN_ALABANZA])) {
                    const [loadedApps, loadedHistory] = await Promise.all([
                        dbAPI.getAllAlabanzaApplications(),
                        dbAPI.getAllPlaybackHistory()
                    ]);
                    setApplications(loadedApps || []);
                    setPlaybackHistory(loadedHistory || []);
                }
            } catch (e) {
                console.error("Error loading Alabanza data", e);
            }
        };
        loadData();
        setConfig(db.getAppConfig());
    }, [view, currentUser]);

    const getFilteredSongs = () => {
        return songs.filter(s => {
            const matchesCategory = selectedCategory === 'Todos' || s.category === selectedCategory;
            const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) || s.artist.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    };

    const canAccessAdmin = currentUser && hasRole(currentUser, [UserRole.SUPER_ADMIN, UserRole.ADMIN_ALABANZA]);

    const handleLoginSuccess = async (email: string, pass: string) => {
        const success = await onLoginRequest(email, pass);
        if (success) {
            setLoginModalOpen(false);
            return true;
        }
        return false;
    };

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const banners = config.alabanzaConfig?.banners || [];
    const applicationsEnabled = config.alabanzaConfig?.applicationsEnabled ?? false;

    // --- MODULE 4: AUDITIONS ---
    const handleApplicationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAppLoading(true);

        if (!appForm.firstName || !appForm.lastName || !appForm.email || !appForm.phone) {
            showToast('Por favor completa todos los campos de contacto.', 'error');
            setAppLoading(false);
            return;
        }

        const newApp: AlabanzaApplication = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            firstName: appForm.firstName,
            lastName: appForm.lastName,
            email: appForm.email,
            phone: appForm.phone,
            questionnaire: {
                attendsChurch: appForm.attendsChurch,
                didCrecer: appForm.didCrecer,
                didTraining: appForm.didTraining,
            },
            status: 'PENDING'
        };

        try {
            await dbAPI.addAlabanzaApplication(newApp);
            showToast('¡Postulación enviada exitosamente! Nos contactaremos pronto.');
            setIsApplicationModalOpen(false);
            setAppForm({ firstName: '', lastName: '', email: '', phone: '', attendsChurch: false, didCrecer: false, didTraining: false });
        } catch (error) {
            showToast('Error al enviar la postulación. Intenta nuevamente.', 'error');
        } finally {
            setAppLoading(false);
        }
    };

    const updateApplicationStatus = async (app: AlabanzaApplication, status: 'ACCEPTED' | 'REJECTED') => {
        const updatedApp = { ...app, status };
        await dbAPI.addAlabanzaApplication(updatedApp);
        setApplications(await dbAPI.getAllAlabanzaApplications());
        setViewingApplication(null);
        showToast(`Postulación ${status === 'ACCEPTED' ? 'aceptada' : 'rechazada'}`);
    };

    const handleDeleteApplication = async (id: string) => {
        if (confirm('¿Eliminar esta postulación permanentemente?')) {
            await dbAPI.deleteAlabanzaApplication(id);
            setApplications(await dbAPI.getAllAlabanzaApplications());
            setViewingApplication(null);
            showToast('Postulación eliminada');
        }
    };

    // --- MODULE 1: SONGS ---
    const handleSaveSong = async () => {
        if (!editingSong?.title || !editingSong.artist) {
            showToast('Título y Artista son obligatorios', 'error');
            return;
        }

        const ytId = editingSong.youtubeLink ? getYoutubeId(editingSong.youtubeLink) : undefined;

        if (!editingSong.audioFile && !ytId && !editingSong.id) {
            showToast('Debes agregar un enlace de audio o YouTube', 'error');
            return;
        }

        let finalAudio = editingSong.audioFile;
        if (!finalAudio && editingSong.id) {
            const existing = songs.find(s => s.id === editingSong.id);
            if (existing) finalAudio = existing.audioFile;
        }

        const newSong: Song = {
            id: editingSong.id || crypto.randomUUID(),
            title: editingSong.title,
            artist: editingSong.artist,
            category: editingSong.category || 'Alabanza',
            coverUrl: editingSong.coverUrl || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1770&q=80',
            audioFile: finalAudio || '',
            youtubeLink: editingSong.youtubeLink,
            youtubeId: ytId || undefined,
            addedAt: editingSong.addedAt || new Date().toISOString()
        };

        try {
            await dbAPI.saveSong(newSong);
            setSongs(await dbAPI.getAllSongs());
            setEditingSong(null);
            setImgError({});
            showToast('Canción guardada correctamente');
        } catch (error) {
            showToast('Error al guardar canción', 'error');
        }
    };

    const handleDeleteSong = async (id: string) => {
        if (confirm('¿Eliminar esta canción?')) {
            await dbAPI.deleteSong(id);
            setSongs(await dbAPI.getAllSongs());
            showToast('Canción eliminada');
        }
    };

    // --- MODULE 2: TAXONOMY ---
    const handleSaveCategory = async () => {
        if (!editingCategory?.name) return;
        const newCat: AlabanzaCategory = {
            id: editingCategory.id || crypto.randomUUID(),
            name: editingCategory.name,
            color: editingCategory.color || '#000000'
        };
        await dbAPI.saveAlabanzaCategory(newCat);
        setCategories(await dbAPI.getAllAlabanzaCategories());
        setEditingCategory(null);
        showToast('Categoría guardada');
    };

    const handleDeleteCategory = async (id: string) => {
        if (confirm('¿Eliminar esta categoría?')) {
            await dbAPI.deleteAlabanzaCategory(id);
            setCategories(await dbAPI.getAllAlabanzaCategories());
            showToast('Categoría eliminada');
        }
    };

    const handleSaveArtist = async () => {
        if (!editingArtist?.name) return;
        const newArtist: AlabanzaArtist = {
            id: editingArtist.id || crypto.randomUUID(),
            name: editingArtist.name,
            imageUrl: editingArtist.imageUrl || ''
        };
        await dbAPI.saveAlabanzaArtist(newArtist);
        setArtists(await dbAPI.getAllAlabanzaArtists());
        setEditingArtist(null);
        setImgError({});
        showToast('Artista guardado');
    };

    const handleDeleteArtist = async (artist: AlabanzaArtist) => {
        // Integrity Check
        const hasSongs = songs.some(s => s.artist.toLowerCase() === artist.name.toLowerCase());
        if (hasSongs) {
            alert(`⚠️ No se puede eliminar a "${artist.name}" porque tiene canciones asociadas.\n\nElimina las canciones primero o cambia su artista.`);
            return;
        }

        if (confirm('¿Eliminar este artista?')) {
            await dbAPI.deleteAlabanzaArtist(artist.id);
            setArtists(await dbAPI.getAllAlabanzaArtists());
            showToast('Artista eliminado');
        }
    };

    // --- MODULE 3: VISUALS ---
    const handleSaveBanner = () => {
        if (!editingBanner) return;

        const currentBanners = config.alabanzaConfig?.banners || [];
        let updatedBanners;

        const bannerData: BannerSlide = {
            id: editingBanner.id || crypto.randomUUID(),
            imageUrl: editingBanner.imageUrl || '',
            titlePrefix: editingBanner.titlePrefix || '',
            titleHighlight: editingBanner.titleHighlight || '',
            description: editingBanner.description || ''
        };

        if (editingBanner.id) {
            updatedBanners = currentBanners.map(b => b.id === editingBanner.id ? bannerData : b);
        } else {
            updatedBanners = [...currentBanners, bannerData];
        }

        const newConfig: AppConfig = {
            ...config,
            alabanzaConfig: {
                ...config.alabanzaConfig,
                banners: updatedBanners,
                applicationsEnabled: config.alabanzaConfig?.applicationsEnabled ?? false
            }
        };

        db.saveAppConfig(newConfig);
        setConfig(newConfig);
        setEditingBanner(null);
        setImgError({});
        showToast('Banner guardado correctamente');
    };

    const handleDeleteBanner = (id: string) => {
        if (confirm('¿Eliminar este banner?')) {
            const currentBanners = config.alabanzaConfig?.banners || [];
            const updatedBanners = currentBanners.filter(b => b.id !== id);

            const newConfig: AppConfig = {
                ...config,
                alabanzaConfig: {
                    ...config.alabanzaConfig,
                    banners: updatedBanners,
                    applicationsEnabled: config.alabanzaConfig?.applicationsEnabled ?? false
                }
            };

            db.saveAppConfig(newConfig);
            setConfig(newConfig);
            showToast('Banner eliminado');
        }
    };

    const toggleApplicationsEnabled = () => {
        const newConfig: AppConfig = {
            ...config,
            alabanzaConfig: {
                ...config.alabanzaConfig,
                applicationsEnabled: !config.alabanzaConfig?.applicationsEnabled,
                banners: config.alabanzaConfig?.banners || []
            }
        };
        db.saveAppConfig(newConfig);
        setConfig(newConfig);
        showToast(newConfig.alabanzaConfig?.applicationsEnabled ? 'Postulaciones Habilitadas' : 'Postulaciones Deshabilitadas');
    };

    const getAdminFilteredSongs = () => {
        if (!adminSearchTerm) return songs;
        return songs.filter(s =>
            s.title.toLowerCase().includes(adminSearchTerm.toLowerCase()) ||
            s.artist.toLowerCase().includes(adminSearchTerm.toLowerCase())
        );
    };

    const getAdminFilteredApps = () => {
        if (!adminSearchTerm) return applications;
        return applications.filter(a =>
            a.firstName.toLowerCase().includes(adminSearchTerm.toLowerCase()) ||
            a.lastName.toLowerCase().includes(adminSearchTerm.toLowerCase()) ||
            a.email.toLowerCase().includes(adminSearchTerm.toLowerCase())
        );
    };

    // Construct Slides for HeroCarousel
    const heroSlides: HeroSlideData[] = banners.map(b => ({
        id: b.id,
        imageUrl: b.imageUrl,
        titlePrefix: b.titlePrefix,
        titleHighlight: b.titleHighlight,
        description: b.description
    }));

    // --- PUBLIC VIEW ---
    if (view === 'PUBLIC') {
        const filteredSongs = getFilteredSongs();

        return (
            <div className="min-h-screen bg-white text-black font-sans pb-32 animate-fadeIn">
                {toast.show && (
                    <div className={`fixed top-24 right-8 z-[100] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slideIn ${toast.type === 'success' ? 'bg-black text-white' : 'bg-red-600 text-white'}`}>
                        <span className="font-bold text-sm uppercase tracking-wide">{toast.msg}</span>
                    </div>
                )}

                <SystemLoginModal
                    isOpen={loginModalOpen}
                    onClose={() => setLoginModalOpen(false)}
                    systemName="Gestión Alabanza"
                    onLogin={handleLoginSuccess}
                />

                {/* Navbar */}
                <nav className="sticky top-16 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-100 transition-all duration-300 h-16">
                    <div className="w-full px-6 lg:px-12 h-full flex items-center justify-between relative max-w-[1920px] mx-auto">
                        <div className="flex-1 flex justify-start">
                            {applicationsEnabled && (
                                <button
                                    onClick={() => setIsApplicationModalOpen(true)}
                                    className="flex items-center gap-2 px-5 py-2 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
                                >
                                    <UserPlus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Audiciones</span>
                                </button>
                            )}
                        </div>

                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                            <h1 className="text-2xl font-black tracking-tighter text-black uppercase">
                                ALABANZA<span className="text-neutral-300">.</span>
                            </h1>
                        </div>

                        <div className="flex-1 flex justify-end items-center gap-4">
                            {!canAccessAdmin ? (
                                <button
                                    onClick={() => setLoginModalOpen(true)}
                                    className="flex items-center gap-2 px-5 py-2 border border-black text-xs font-bold uppercase tracking-widest text-black hover:bg-black hover:text-white transition-all"
                                >
                                    <LogIn className="w-4 h-4" />
                                    <span className="hidden sm:inline">Equipo</span>
                                </button>
                            ) : (
                                <button
                                    onClick={() => setView('ADMIN')}
                                    className="flex items-center gap-2 px-5 py-2 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-colors"
                                >
                                    <Settings className="w-4 h-4" />
                                    <span className="hidden sm:inline">Admin</span>
                                </button>
                            )}
                        </div>
                    </div>
                </nav>

                {/* Hero Carousel */}
                <section className="h-[60vh]">
                    <HeroCarousel slides={heroSlides} theme="alabanza" heightClass="h-full" />
                </section>

                {/* Main Content */}
                <div className="max-w-[1920px] mx-auto px-6 lg:px-12 mt-16 relative z-20">

                    {/* Toolbar */}
                    <div className="flex flex-col md:flex-row gap-8 items-end justify-between mb-12 border-b border-neutral-200 pb-6">
                        {/* Categories */}
                        <div className="flex gap-8 overflow-x-auto scrollbar-hide pb-2 w-full md:w-auto">
                            <button
                                onClick={() => setSelectedCategory('Todos')}
                                className={`text-sm font-bold uppercase tracking-widest pb-1 border-b-2 transition-all whitespace-nowrap ${selectedCategory === 'Todos' ? 'text-black border-black' : 'text-neutral-400 border-transparent hover:text-black'}`}
                            >
                                Todos
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.name)}
                                    className={`text-sm font-bold uppercase tracking-widest pb-1 border-b-2 transition-all whitespace-nowrap ${selectedCategory === cat.name ? 'text-black border-black' : 'text-neutral-400 border-transparent hover:text-black'}`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>

                        {/* Search Input */}
                        <div className="relative w-full md:w-80 group">
                            <Search className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 group-hover:text-black transition-colors" />
                            <input
                                type="text"
                                placeholder="BUSCAR..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-transparent border-b border-neutral-300 py-2 pr-8 text-sm font-bold uppercase tracking-wide text-black placeholder-neutral-300 outline-none focus:border-black transition-colors"
                            />
                        </div>
                    </div>

                    {/* Songs Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-8 gap-y-12">
                        {filteredSongs.map(song => {
                            const hasAudio = !!song.audioFile && song.audioFile.trim() !== '';
                            const hasYoutube = !!song.youtubeId;
                            const isPlayable = hasAudio || hasYoutube;

                            return (
                                <div
                                    key={song.id}
                                    className={`group ${isPlayable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                                    onClick={() => {
                                        if (hasYoutube) {
                                            setPlayingYoutubeId(song.youtubeId!);
                                        } else if (hasAudio) {
                                            playSong(song);
                                        }
                                    }}
                                >
                                    <div className="aspect-square bg-neutral-100 overflow-hidden mb-4 relative">
                                        <img src={song.coverUrl} className={`w-full h-full object-cover transition-transform duration-700 ease-out ${isPlayable ? 'group-hover:scale-105' : 'grayscale'}`} />

                                        {/* Overlay */}
                                        {isPlayable && (
                                            <div className={`absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity duration-300 ${currentSong?.id === song.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-2xl transform hover:scale-110 transition-transform">
                                                    {hasYoutube ? (
                                                        <Youtube className="w-8 h-8 text-red-600" />
                                                    ) : (
                                                        currentSong?.id === song.id && isPlaying ? <Pause className="w-6 h-6 fill-black text-black" /> : <Play className="w-6 h-6 fill-black text-black ml-1" />
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {!isPlayable && (
                                            <div className="absolute top-2 right-2 bg-neutral-800 text-white text-[10px] font-bold px-2 py-1 rounded">
                                                Sin Audio
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className={`font-black text-sm uppercase tracking-tight leading-tight ${currentSong?.id === song.id ? 'text-black underline decoration-2' : 'text-black'}`}>{song.title}</h3>
                                        <p className="text-xs text-neutral-500 uppercase tracking-wide">{song.artist}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {filteredSongs.length === 0 && (
                        <div className="py-32 text-center border-t border-b border-neutral-100 my-12">
                            <h3 className="text-2xl font-black text-neutral-300 uppercase mb-2">Sin Resultados</h3>
                        </div>
                    )}
                </div>

                {/* Application Modal */}
                {isApplicationModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white w-full max-w-lg shadow-2xl flex flex-col border border-black max-h-[90vh]">
                            <div className="p-6 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
                                <h3 className="font-black text-lg uppercase tracking-tight">Formulario de Audición</h3>
                                <button onClick={() => setIsApplicationModalOpen(false)}><X className="w-6 h-6" /></button>
                            </div>
                            <form onSubmit={handleApplicationSubmit} className="p-8 overflow-y-auto space-y-6">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold uppercase text-neutral-500">Nombre</label>
                                            <input type="text" required value={appForm.firstName} onChange={e => setAppForm({ ...appForm, firstName: e.target.value })} className="w-full p-3 border border-neutral-300 outline-none text-sm font-bold uppercase focus:border-black" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold uppercase text-neutral-500">Apellido</label>
                                            <input type="text" required value={appForm.lastName} onChange={e => setAppForm({ ...appForm, lastName: e.target.value })} className="w-full p-3 border border-neutral-300 outline-none text-sm font-bold uppercase focus:border-black" />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold uppercase text-neutral-500">Email</label>
                                        <input type="email" required value={appForm.email} onChange={e => setAppForm({ ...appForm, email: e.target.value })} className="w-full p-3 border border-neutral-300 outline-none text-sm font-medium focus:border-black" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold uppercase text-neutral-500">Teléfono</label>
                                        <input type="tel" required value={appForm.phone} onChange={e => setAppForm({ ...appForm, phone: e.target.value })} className="w-full p-3 border border-neutral-300 outline-none text-sm font-medium focus:border-black" />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-neutral-100">
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" checked={appForm.attendsChurch} onChange={e => setAppForm({ ...appForm, attendsChurch: e.target.checked })} className="w-5 h-5 accent-black" />
                                        <label className="text-sm font-bold text-black uppercase">¿Asistes a la iglesia?</label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" checked={appForm.didCrecer} onChange={e => setAppForm({ ...appForm, didCrecer: e.target.checked })} className="w-5 h-5 accent-black" />
                                        <label className="text-sm font-bold text-black uppercase">¿Hiciste Curso Crecer?</label>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <input type="checkbox" checked={appForm.didTraining} onChange={e => setAppForm({ ...appForm, didTraining: e.target.checked })} className="w-5 h-5 accent-black" />
                                        <label className="text-sm font-bold text-black uppercase">¿Realizaste Entrenamiento?</label>
                                    </div>
                                </div>

                                <button type="submit" disabled={appLoading} className="w-full py-4 bg-black text-white font-bold uppercase tracking-widest hover:bg-neutral-800 disabled:opacity-50">
                                    {appLoading ? 'Enviando...' : 'Enviar Solicitud'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* YouTube Modal */}
                {playingYoutubeId && (
                    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setPlayingYoutubeId(null)}>
                        <div className="w-full max-w-4xl aspect-video bg-black shadow-2xl relative">
                            <iframe
                                src={`https://www.youtube.com/embed/${playingYoutubeId}?autoplay=1`}
                                title="YouTube video player"
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            ></iframe>
                            <button onClick={() => setPlayingYoutubeId(null)} className="absolute -top-10 right-0 text-white hover:text-red-500 font-bold uppercase flex items-center gap-2">
                                <X className="w-6 h-6" /> Cerrar
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- ADMIN VIEW ---
    const adminTabs = [
        { id: 'DASHBOARD', label: 'Stats', icon: BarChart3 },
        { id: 'SONGS', label: 'Canciones', icon: Music },
        { id: 'ARTISTS', label: 'Artistas', icon: Mic2 },
        { id: 'CATEGORIES', label: 'Categorías', icon: Layers },
        { id: 'BANNERS', label: 'Banners', icon: ImageIcon },
        { id: 'APPLICATIONS', label: 'Audiciones', icon: ClipboardList, count: applications.filter(a => a.status === 'PENDING').length }
    ];

    const adminFilteredSongs = getAdminFilteredSongs();
    const adminFilteredApps = getAdminFilteredApps();

    return (
        <div className="min-h-screen bg-white text-black font-sans pb-20">
            {toast.show && (
                <div className={`fixed top-24 right-8 z-[100] px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slideIn ${toast.type === 'success' ? 'bg-black text-white' : 'bg-red-600 text-white'}`}>
                    <span className="font-bold text-sm uppercase tracking-wide">{toast.msg}</span>
                </div>
            )}

            <header className="sticky top-16 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200 transition-all duration-300">
                <div className="max-w-[1920px] mx-auto px-6 h-20 flex items-center justify-between gap-8">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-black flex items-center justify-center text-white">
                            <Settings className="w-5 h-5" />
                        </div>
                        <h1 className="font-black text-xl uppercase tracking-tight hidden sm:block">Panel Alabanza</h1>
                    </div>

                    <div className="flex-1 overflow-x-auto scrollbar-hide flex justify-center">
                        <div className="flex gap-4 sm:gap-8">
                            {adminTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => { setAdminTab(tab.id as any); setAdminSearchTerm(''); }}
                                    className={`
                                        relative flex items-center gap-2 py-2 text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap
                                        ${adminTab === tab.id
                                            ? 'text-black border-b-2 border-black'
                                            : 'text-neutral-400 hover:text-black border-b-2 border-transparent'
                                        }
                                    `}
                                >
                                    <tab.icon className="w-4 h-4" />
                                    <span className="hidden lg:inline">{tab.label}</span>
                                    {tab.count !== undefined && tab.count > 0 && (
                                        <span className="ml-1 bg-black text-white text-[9px] px-1.5 py-0.5 font-bold">
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => setView('PUBLIC')}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-black transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Salir
                    </button>
                </div>
            </header>

            <main className="max-w-[1920px] mx-auto p-8 md:p-12 animate-fadeIn">
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b border-neutral-100 pb-6 gap-6">
                    <div>
                        <h2 className="text-4xl font-black text-black uppercase tracking-tighter mb-2">
                            {adminTabs.find(t => t.id === adminTab)?.label}
                        </h2>
                        <p className="text-neutral-500 text-sm font-medium uppercase tracking-wide">Gestión del sistema</p>
                    </div>

                    <div className="flex gap-4 items-center">
                        {(adminTab === 'SONGS' || adminTab === 'APPLICATIONS') && (
                            <div className="relative group">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-hover:text-black" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    value={adminSearchTerm}
                                    onChange={e => setAdminSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 py-3 border border-neutral-200 text-sm font-medium outline-none focus:border-black w-64 bg-white"
                                />
                            </div>
                        )}

                        {adminTab === 'SONGS' && (
                            <button
                                onClick={() => setEditingSong({ title: '', artist: '', category: 'Adoración' })}
                                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all"
                            >
                                <Plus className="w-4 h-4" /> Nueva Canción
                            </button>
                        )}

                        {adminTab === 'ARTISTS' && (
                            <button
                                onClick={() => setEditingArtist({ name: '', imageUrl: '' })}
                                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all"
                            >
                                <Plus className="w-4 h-4" /> Nuevo Artista
                            </button>
                        )}

                        {adminTab === 'CATEGORIES' && (
                            <button
                                onClick={() => setEditingCategory({ name: '', color: '#000000' })}
                                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all"
                            >
                                <Plus className="w-4 h-4" /> Nueva Categoría
                            </button>
                        )}

                        {adminTab === 'BANNERS' && (
                            <button
                                onClick={() => setEditingBanner({ titlePrefix: '', titleHighlight: '', description: '', imageUrl: '' })}
                                className="flex items-center gap-2 px-6 py-3 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all"
                            >
                                <Plus className="w-4 h-4" /> Nuevo Banner
                            </button>
                        )}
                    </div>
                </div>

                {/* Tab Contents */}
                {adminTab === 'DASHBOARD' && (
                    <div className="space-y-12">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="p-8 border border-neutral-200 bg-neutral-50">
                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Total Canciones</span>
                                <h3 className="text-5xl font-black text-black mt-4">{songs.length}</h3>
                            </div>
                            <div className="p-8 border border-neutral-200 bg-neutral-50">
                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Audiciones Pendientes</span>
                                <h3 className="text-5xl font-black text-black mt-4">{applications.filter(a => a.status === 'PENDING').length}</h3>
                            </div>
                            <div className="p-8 border border-neutral-200 bg-neutral-50">
                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Reproducciones Históricas</span>
                                <h3 className="text-5xl font-black text-black mt-4">{playbackHistory.length.toLocaleString()}</h3>
                            </div>
                        </div>
                    </div>
                )}

                {adminTab === 'SONGS' && (
                    <div className="border border-neutral-200">
                        <table className="w-full text-left">
                            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase font-bold text-neutral-500">
                                <tr>
                                    <th className="p-6">Canción</th>
                                    <th className="p-6">Artista</th>
                                    <th className="p-6">Categoría</th>
                                    <th className="p-6 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {adminFilteredSongs.map(song => (
                                    <tr key={song.id} className="hover:bg-neutral-50 transition-colors group">
                                        <td className="p-6 flex items-center gap-4">
                                            <div className="w-12 h-12 bg-neutral-200 overflow-hidden flex-shrink-0">
                                                <img src={song.coverUrl} className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <span className="font-bold text-black uppercase text-sm block">{song.title}</span>
                                                {song.youtubeId && <span className="text-[10px] text-red-600 font-bold flex items-center gap-1"><Youtube className="w-3 h-3" /> YouTube</span>}
                                            </div>
                                        </td>
                                        <td className="p-6 text-neutral-600 uppercase text-xs font-bold">{song.artist}</td>
                                        <td className="p-6">
                                            <span className="text-xs font-bold uppercase border border-neutral-200 px-3 py-1 bg-white">{song.category}</span>
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setEditingSong(song)} className="text-black hover:underline text-xs font-bold uppercase">Editar</button>
                                                <button onClick={() => handleDeleteSong(song.id)} className="text-red-600 hover:underline text-xs font-bold uppercase">Borrar</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ARTISTS TAB */}
                {adminTab === 'ARTISTS' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {artists.map(artist => (
                            <div key={artist.id} className="border border-neutral-200 p-6 flex flex-col items-center group relative hover:border-black transition-colors">
                                <div className="w-20 h-20 rounded-full bg-neutral-100 mb-4 overflow-hidden">
                                    {artist.imageUrl ? <img src={artist.imageUrl} className="w-full h-full object-cover" /> : <Mic2 className="w-8 h-8 m-auto mt-6 text-neutral-300" />}
                                </div>
                                <h4 className="font-bold text-black uppercase text-center">{artist.name}</h4>
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button onClick={() => setEditingArtist(artist)} className="p-1.5 bg-white border border-neutral-200 hover:bg-neutral-100"><Edit2 className="w-3 h-3" /></button>
                                    <button onClick={() => handleDeleteArtist(artist)} className="p-1.5 bg-white border border-neutral-200 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* CATEGORIES TAB */}
                {adminTab === 'CATEGORIES' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        {categories.map(cat => (
                            <div key={cat.id} className="border border-neutral-200 p-6 group relative hover:border-black transition-colors" style={{ borderLeftWidth: 4, borderLeftColor: cat.color }}>
                                <h4 className="font-bold text-black uppercase">{cat.name}</h4>
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button onClick={() => setEditingCategory(cat)} className="p-1.5 bg-white border border-neutral-200 hover:bg-neutral-100"><Edit2 className="w-3 h-3" /></button>
                                    <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 bg-white border border-neutral-200 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {adminTab === 'BANNERS' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {banners.map(banner => (
                            <div key={banner.id} className="border border-neutral-200 group relative">
                                <div className="aspect-video bg-neutral-100 relative overflow-hidden">
                                    <img src={banner.imageUrl} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                        <button onClick={() => setEditingBanner(banner)} className="p-2 bg-white text-black hover:bg-neutral-200"><Edit2 className="w-4 h-4" /></button>
                                        <button onClick={() => handleDeleteBanner(banner.id)} className="p-2 bg-red-600 text-white hover:bg-red-700"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                </div>
                                <div className="p-4">
                                    <h5 className="font-bold text-sm uppercase">{banner.titlePrefix} <span className="text-neutral-400">{banner.titleHighlight}</span></h5>
                                    <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{banner.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {adminTab === 'APPLICATIONS' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center bg-neutral-50 p-4 border border-neutral-200">
                            <span className="text-xs font-bold uppercase text-neutral-500">Estado del Formulario</span>
                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold ${applicationsEnabled ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {applicationsEnabled ? 'ACTIVADO' : 'DESACTIVADO'}
                                </span>
                                <button
                                    onClick={toggleApplicationsEnabled}
                                    className={`w-10 h-5 rounded-full relative transition-colors ${applicationsEnabled ? 'bg-black' : 'bg-neutral-300'}`}
                                >
                                    <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${applicationsEnabled ? 'translate-x-5' : ''}`}></div>
                                </button>
                            </div>
                        </div>

                        <div className="border border-neutral-200">
                            <table className="w-full text-left">
                                <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase font-bold text-neutral-500">
                                    <tr>
                                        <th className="p-4">Postulante</th>
                                        <th className="p-4">Contacto</th>
                                        <th className="p-4">Fecha</th>
                                        <th className="p-4">Estado</th>
                                        <th className="p-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-100">
                                    {adminFilteredApps.map(app => (
                                        <tr key={app.id} className="hover:bg-neutral-50 transition-colors">
                                            <td className="p-4 font-bold text-sm uppercase">{app.firstName} {app.lastName}</td>
                                            <td className="p-4 text-xs text-neutral-600">
                                                <div className="flex flex-col">
                                                    <span>{app.email}</span>
                                                    <span>{app.phone}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-xs font-mono text-neutral-500">{new Date(app.timestamp).toLocaleDateString()}</td>
                                            <td className="p-4">
                                                <span className={`text-[10px] font-bold px-2 py-1 uppercase border ${app.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                    app.status === 'REJECTED' ? 'bg-red-100 text-red-700 border-red-200' :
                                                        'bg-neutral-100 text-neutral-600 border-neutral-200'
                                                    }`}>
                                                    {app.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setViewingApplication(app)} className="px-3 py-1.5 bg-black text-white text-[10px] font-bold uppercase rounded hover:bg-neutral-800">Ver Respuestas</button>
                                                    <button onClick={() => handleDeleteApplication(app.id)} className="p-2 hover:bg-red-100 rounded text-red-600"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            {/* Application Detail Modal - REBUILT for Boolean Questionnaire */}
            {viewingApplication && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-lg shadow-2xl border border-black">
                        <div className="p-6 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
                            <h3 className="font-black text-lg uppercase">Respuestas Cuestionario</h3>
                            <button onClick={() => setViewingApplication(null)}><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-16 h-16 bg-neutral-200 rounded-full flex items-center justify-center font-black text-2xl text-neutral-500">
                                    {viewingApplication.firstName.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="text-xl font-bold uppercase">{viewingApplication.firstName} {viewingApplication.lastName}</h4>
                                    <p className="text-sm text-neutral-500">{viewingApplication.email}</p>
                                    <p className="text-sm text-neutral-500">{viewingApplication.phone}</p>
                                </div>
                            </div>

                            <div className="space-y-4 bg-neutral-50 p-6 border border-neutral-200">
                                <div className="flex justify-between items-center border-b border-neutral-200 pb-2">
                                    <span className="text-sm font-bold text-neutral-600 uppercase">¿Asiste a la iglesia?</span>
                                    <span className={`font-black text-sm px-2 py-1 rounded ${viewingApplication.questionnaire.attendsChurch ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {viewingApplication.questionnaire.attendsChurch ? 'SÍ' : 'NO'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center border-b border-neutral-200 pb-2">
                                    <span className="text-sm font-bold text-neutral-600 uppercase">¿Curso Crecer?</span>
                                    <span className={`font-black text-sm px-2 py-1 rounded ${viewingApplication.questionnaire.didCrecer ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {viewingApplication.questionnaire.didCrecer ? 'SÍ' : 'NO'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-neutral-600 uppercase">¿Entrenamiento?</span>
                                    <span className={`font-black text-sm px-2 py-1 rounded ${viewingApplication.questionnaire.didTraining ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                        {viewingApplication.questionnaire.didTraining ? 'SÍ' : 'NO'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button onClick={() => updateApplicationStatus(viewingApplication, 'REJECTED')} className="flex-1 py-3 border border-black text-black font-bold uppercase text-xs hover:bg-neutral-100">Rechazar</button>
                                <button onClick={() => updateApplicationStatus(viewingApplication, 'ACCEPTED')} className="flex-1 py-3 bg-black text-white font-bold uppercase text-xs hover:bg-neutral-800">Aceptar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Editing Category Modal */}
            {editingCategory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-sm shadow-2xl p-6 border border-black">
                        <h3 className="font-black text-lg uppercase mb-4">Categoría</h3>
                        <div className="space-y-4">
                            <input type="text" placeholder="Nombre" value={editingCategory.name || ''} onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })} className="w-full p-3 border border-neutral-300 outline-none text-sm font-bold uppercase focus:border-black" />
                            <div>
                                <label className="text-xs font-bold uppercase text-neutral-500 block mb-1">Color Identificador</label>
                                <input type="color" value={editingCategory.color || '#000000'} onChange={e => setEditingCategory({ ...editingCategory, color: e.target.value })} className="w-full h-10 cursor-pointer" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setEditingCategory(null)} className="text-xs font-bold uppercase text-neutral-500">Cancelar</button>
                            <button onClick={handleSaveCategory} className="bg-black text-white px-4 py-2 text-xs font-bold uppercase">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Editing Artist Modal */}
            {editingArtist && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-sm shadow-2xl p-6 border border-black">
                        <h3 className="font-black text-lg uppercase mb-4">Artista</h3>
                        <div className="space-y-4">
                            <input type="text" placeholder="Nombre" value={editingArtist.name || ''} onChange={e => setEditingArtist({ ...editingArtist, name: e.target.value })} className="w-full p-3 border border-neutral-300 outline-none text-sm font-bold uppercase focus:border-black" />
                            <div>
                                <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Foto del Artista</label>
                                <ImageUpload
                                    currentImage={editingArtist.imageUrl || ''}
                                    folder="artists"
                                    onImageUpload={(url) => setEditingArtist({ ...editingArtist, imageUrl: url })}
                                    aspectRatio="square"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setEditingArtist(null)} className="text-xs font-bold uppercase text-neutral-500">Cancelar</button>
                            <button onClick={handleSaveArtist} className="bg-black text-white px-4 py-2 text-xs font-bold uppercase">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Editing Banner Modal */}
            {editingBanner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-md shadow-2xl p-6 border border-black">
                        <h3 className="font-black text-lg uppercase mb-4">Banner Home</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Imagen del Banner</label>
                                <ImageUpload
                                    currentImage={editingBanner.imageUrl || ''}
                                    folder="alabanza-banners"
                                    onImageUpload={(url) => setEditingBanner({ ...editingBanner, imageUrl: url })}
                                    aspectRatio="wide"
                                />
                            </div>
                            <input type="text" placeholder="Prefijo Título" value={editingBanner.titlePrefix || ''} onChange={e => setEditingBanner({ ...editingBanner, titlePrefix: e.target.value })} className="w-full p-3 border border-neutral-300 outline-none text-sm font-bold uppercase focus:border-black" />
                            <input type="text" placeholder="Texto Destacado" value={editingBanner.titleHighlight || ''} onChange={e => setEditingBanner({ ...editingBanner, titleHighlight: e.target.value })} className="w-full p-3 border border-neutral-300 outline-none text-sm font-bold uppercase focus:border-black" />
                            <textarea placeholder="Descripción" value={editingBanner.description || ''} onChange={e => setEditingBanner({ ...editingBanner, description: e.target.value })} className="w-full p-3 border border-neutral-300 outline-none text-sm font-medium focus:border-black h-20 resize-none" />
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setEditingBanner(null)} className="text-xs font-bold uppercase text-neutral-500">Cancelar</button>
                            <button onClick={handleSaveBanner} className="bg-black text-white px-4 py-2 text-xs font-bold uppercase">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Editing Song Modal - REFACTORED FOR YOUTUBE & URL ONLY */}
            {editingSong && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] border border-black">
                        <div className="p-8 border-b border-neutral-200 flex justify-between items-center">
                            <h3 className="font-black text-2xl uppercase">Editor de Canción</h3>
                            <button onClick={() => { setEditingSong(null); setImgError({}); }}><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-8 overflow-y-auto space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div><label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Título</label><input type="text" value={editingSong.title || ''} onChange={e => setEditingSong({ ...editingSong, title: e.target.value })} className="w-full p-4 bg-white border border-neutral-300 outline-none text-sm font-bold uppercase focus:border-black" /></div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Artista</label>
                                    <input type="text" value={editingSong.artist || ''} onChange={e => setEditingSong({ ...editingSong, artist: e.target.value })} className="w-full p-4 bg-white border border-neutral-300 outline-none text-sm font-bold uppercase focus:border-black" list="artists-list" />
                                    <datalist id="artists-list">{artists.map(a => <option key={a.id} value={a.name} />)}</datalist>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Categoría</label>
                                    <select value={editingSong.category || ''} onChange={e => setEditingSong({ ...editingSong, category: e.target.value })} className="w-full p-4 bg-white border border-neutral-300 outline-none text-sm font-bold uppercase focus:border-black">
                                        {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                        <option value="Alabanza">Alabanza (Default)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">URL Audio MP3 (Directo)</label>
                                    <input
                                        type="url"
                                        value={editingSong.audioFile || ''}
                                        onChange={e => setEditingSong({ ...editingSong, audioFile: e.target.value })}
                                        className="w-full p-4 bg-white border border-neutral-300 outline-none text-sm font-medium focus:border-black"
                                        placeholder="https://.../song.mp3"
                                    />
                                    <p className="text-[10px] text-neutral-400 mt-1">* Prioridad 1: Audio Link</p>
                                </div>
                            </div>

                            {/* YouTube Field */}
                            <div>
                                <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block flex items-center gap-2"><Youtube className="w-4 h-4 text-red-600" /> Link de YouTube</label>
                                <input
                                    type="url"
                                    value={editingSong.youtubeLink || ''}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setEditingSong({ ...editingSong, youtubeLink: val });
                                    }}
                                    className="w-full p-4 bg-white border border-neutral-300 outline-none text-sm font-medium focus:border-black"
                                    placeholder="https://youtube.com/watch?v=..."
                                />
                                {editingSong.youtubeLink && getYoutubeId(editingSong.youtubeLink) && (
                                    <div className="mt-2 aspect-video w-48 bg-black">
                                        <iframe
                                            src={`https://www.youtube.com/embed/${getYoutubeId(editingSong.youtubeLink)}`}
                                            className="w-full h-full"
                                            title="Preview"
                                        ></iframe>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-neutral-500 mb-2 block">Portada de la Canción</label>
                                <ImageUpload
                                    currentImage={editingSong.coverUrl || ''}
                                    folder="song-covers"
                                    onImageUpload={(url) => setEditingSong({ ...editingSong, coverUrl: url })}
                                    aspectRatio="square"
                                />
                            </div>
                        </div>
                        <div className="p-8 border-t border-neutral-200 flex justify-end gap-4 bg-neutral-50">
                            <button onClick={() => { setEditingSong(null); setImgError({}); }} className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-neutral-500 hover:text-black">Cancelar</button>
                            <button onClick={handleSaveSong} className="px-8 py-4 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-neutral-800">Guardar Canción</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Alabanza;

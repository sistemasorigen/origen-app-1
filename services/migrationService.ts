
import { supabase } from './supabaseClient';
import { db } from './dbService';
import { dbAPI } from './db';

export const migrateToSupabase = async (onProgress: (msg: string) => void) => {
    try {
        onProgress("Iniciando migración...");

        // 1. App Config
        onProgress("Migrando Configuración Global...");
        const config = db.getAppConfig();
        const { error: configError } = await supabase
            .from('app_config')
            .upsert({ id: 'global', config: config });
        if (configError) throw configError;

        // 2. Users
        onProgress("Migrando Usuarios...");
        const users = db.getUsers();
        // Intentar recuperar credenciales locales si existen para no perder acceso
        // Nota: Esto es un hack para migración local. En producción, las contraseñas deberían ser hash.
        let credentials: Record<string, string> = {};
        try {
            const storedCreds = localStorage.getItem('credentials');
            if (storedCreds) credentials = JSON.parse(storedCreds);
        } catch (e) { console.warn("No se pudieron leer credenciales locales"); }

        const usersPayload = users.reduce((acc, u) => {
            // NUNCA usar contraseña default
            if (!credentials[u.email]) {
                console.warn(`Usuario ${u.email} omitido: sin credencial local`);
                return acc;
            }
            acc.push({
                id: u.id,
                name: u.name,
                email: u.email,
                role: u.role,
                isActive: u.isActive,
                linkedGroupId: u.linkedGroupId,
                volunteerRoles: u.volunteerRoles,
                password: credentials[u.email] 
            });
            return acc;
        }, [] as any[]);

        const { error: usersError } = await supabase.from('users').upsert(usersPayload);
        if (usersError) throw usersError;

        // 3. Group Categories & Tags
        onProgress("Migrando Categorías y Etiquetas de Grupos...");
        const categories = db.getCategories();
        if (categories.length > 0) {
            const { error: catError } = await supabase.from('group_categories').upsert(categories);
            if (catError) throw catError;
        }

        const tags = db.getTags();
        if (tags.length > 0) {
            const { error: tagError } = await supabase.from('group_tags').upsert(tags);
            if (tagError) throw tagError;
        }

        // 4. Groups
        onProgress("Migrando Grupos...");
        const groups = db.getGroups();
        if (groups.length > 0) {
            const groupsPayload = groups.map(g => ({
                id: g.id,
                name: g.name,
                leaderName: g.leaderName,
                leaderSurname: g.leaderSurname,
                leaderPhone: g.leaderPhone,
                meetingDay: g.meetingDay,
                meetingTime: g.meetingTime,
                startDate: g.startDate,
                location: g.location,
                membersCount: g.membersCount,
                maxCapacity: g.maxCapacity,
                description: g.description,
                imageUrl: g.imageUrl,
                categoryId: g.categoryId,
                tags: g.tags
            }));
            const { error: groupsError } = await supabase.from('groups').upsert(groupsPayload);
            if (groupsError) throw groupsError;

            // 5. Group Registrations (Nested in local, separate table in SQL)
            onProgress("Migrando Miembros de Grupos...");
            const allRegistrations = groups.flatMap(g => (g.registrations || []).map(r => ({
                id: r.id,
                groupId: g.id,
                firstName: r.firstName,
                lastName: r.lastName,
                dni: r.dni,
                phone: r.phone,
                email: r.email,
                timestamp: r.timestamp
            })));
            
            if (allRegistrations.length > 0) {
                const { error: regError } = await supabase.from('group_registrations').upsert(allRegistrations);
                if (regError) throw regError;
            }
        }

        // 6. Store Products
        onProgress("Migrando Productos de la Tienda...");
        const storeProducts = db.getProducts(); // LocalStorage products (Legacy/Base)
        // Nota: Si usas la nueva estructura StoreProduct, asegúrate de que db.getProducts() la devuelva o adapta aquí.
        // Asumiremos que db.getProducts devuelve la estructura compatible o vacía si no se usó.
        // Si tienes productos en el nuevo formato (StoreProduct), deberíamos migrarlos.
        // Como el DBService original devolvía `Product[]` (interfaz simple), pero el componente `Store` usaba `supabaseService` o local state,
        // intentaremos leer del localStorage directo si existe la clave 'store_products' usada anteriormente si existiera.
        
        // Intento de leer productos de tienda si existen en localStorage bajo una key específica o convertirlos
        // Para este script, usaremos los datos que devuelve supabaseService.getStoreProducts() si queremos sincronizar,
        // PERO el objetivo es Local -> Supabase. Si no hay datos locales de tienda, omitimos.

        // 7. Alabanza (Songs) - IndexedDB
        onProgress("Migrando Canciones (Alabanza)...");
        const songs = await dbAPI.getAllSongs();
        if (songs.length > 0) {
             const songsPayload = songs.map(s => ({
                 id: s.id,
                 title: s.title,
                 artist: s.artist,
                 coverUrl: s.coverUrl,
                 category: s.category,
                 audioFile: s.audioFile, // Base64 strings might be large!
                 youtubeLink: s.youtubeLink,
                 youtubeId: s.youtubeId,
                 addedAt: s.addedAt
             }));
             
             // Batch insert to avoid payload limits if audio files are large
             for (const song of songsPayload) {
                 const { error: songError } = await supabase.from('songs').upsert(song);
                 if (songError) console.error("Error migrando canción " + song.title, songError);
             }
        }

        // 8. Alabanza Categories - IndexedDB
        onProgress("Migrando Categorías Alabanza...");
        const alabanzaCats = await dbAPI.getAllAlabanzaCategories();
        if (alabanzaCats.length > 0) {
            const { error: aCatError } = await supabase.from('alabanza_categories').upsert(alabanzaCats);
            if (aCatError) throw aCatError;
        }

        // 9. Alabanza Artists - IndexedDB
        onProgress("Migrando Artistas...");
        const alabanzaArtists = await dbAPI.getAllAlabanzaArtists();
        if (alabanzaArtists.length > 0) {
            const { error: artistError } = await supabase.from('alabanza_artists').upsert(alabanzaArtists);
            if (artistError) throw artistError;
        }

        onProgress("¡Migración completada con éxito!");
        return true;

    } catch (error: any) {
        console.error("Migration Error:", error);
        onProgress(`Error: ${error.message || JSON.stringify(error)}`);
        return false;
    }
};

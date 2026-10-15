import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { Group, GroupCategory, GroupTag, User } from '../../types';
import { supabaseService } from '../../services/supabaseService';
import { useInscripcionesDelUsuario } from '../../src/hooks/useInscripcionesDelUsuario';
import { useGruposParaVos } from '../../src/hooks/useGruposParaVos';
import GruposCarousel from './GruposCarousel';
import JoinGroupModal from '../GCX/ModalUnirseGrupo';

/**
 * El bloque "Grupos para vos" de la portada, entero: los grupos, la
 * recomendación, el carrusel y el camino para anotarse.
 *
 * Trae consigo sus propios datos —grupos, categorías y etiquetas— porque
 * nadie más de la pantalla los usa. Antes los pedía el Home en el mismo
 * efecto que los eventos; son los mismos tres pedidos, en el mismo momento.
 */
const SeccionGruposParaVos: React.FC<{ currentUser: User | null }> = ({ currentUser }) => {
    const navigate = useNavigate();

    const [groups, setGroups] = useState<Group[]>([]);
    const [categories, setCategories] = useState<GroupCategory[]>([]);
    // Las etiquetas las pide la tarjeta de /gcx, que las muestra abajo del todo.
    const [tags, setTags] = useState<GroupTag[]>([]);

    useEffect(() => {
        // Es una sección de la portada: si no llega, la portada sigue en pie
        // sin ella. Lo que no puede quedar es el error suelto, ahora que los
        // servicios lo levantan en vez de devolver una lista vacía inventada.
        supabaseService.getGroups()
            .then(setGroups)
            .catch(e => console.error('[Inicio] No se pudieron cargar los grupos:', e));
        supabaseService.getGroupCategories().then(setCategories);
        supabaseService.getGroupTags().then(setTags);
    }, []);

    // ── Unirse a un grupo desde el Home ──────────────────────────────
    //
    // Antes "Unirme" mandaba a /gcx?groupId=… y el modal se abría allá. Eso
    // significaba perder el Home —y el scroll— para hacer algo que se puede
    // hacer acá mismo. Ahora el modal es el mismo componente y se abre en el
    // lugar, con los mismos dos controles previos que hace /gcx: sin sesión
    // se manda a entrar (y se vuelve), y la edad se chequea antes de abrir.
    const { estadoEnGrupo, recargar: recargarInscripciones } = useInscripcionesDelUsuario(currentUser);
    const [grupoAUnirse, setGrupoAUnirse] = useState<Group | null>(null);
    const [avisoGrupo, setAvisoGrupo] = useState('');

    const mostrarAviso = (texto: string) => {
        setAvisoGrupo(texto);
        window.setTimeout(() => setAvisoGrupo(''), 3500);
    };

    const handleJoinClick = (g: Group) => {
        if (!currentUser) {
            // Mismo guardado que /gcx: después de entrar, la persona vuelve
            // al grupo que estaba mirando, no a la portada.
            sessionStorage.setItem('post_login_redirect', `/gcx?groupId=${g.id}`);
            navigate('/auth', { state: { from: { pathname: '/gcx', search: `?groupId=${g.id}` } } });
            return;
        }

        if (currentUser.age) {
            const minima = g.minAge || 0;
            const maxima = g.maxAge || 100;
            if (currentUser.age < minima) {
                mostrarAviso(`No podés unirte: hay que tener al menos ${minima} años.`);
                return;
            }
            if (currentUser.age > maxima) {
                mostrarAviso(`No podés unirte: la edad máxima es ${maxima} años.`);
                return;
            }
        }

        setGrupoAUnirse(g);
    };

    const { recomendados, categoriaPrincipal } = useGruposParaVos(groups, categories, currentUser);

    return (
        <>
            {/* === GRUPOS PARA VOS — carrusel de grupos reales con lugar disponible === */}
            {recomendados.length > 0 && (
                <div className="lg:col-span-3">
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                        <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight leading-[1.05] text-slate-900 dark:text-white">Grupos para vos</h2>
                        <button
                            onClick={() => navigate('/gcx')}
                            className="shrink-0 inline-flex items-center gap-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            Ver todos <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <p className="text-sm font-normal text-slate-500 dark:text-zinc-400 mb-4">
                        {categoriaPrincipal
                            ? <>Como participás de grupos de <span className="font-semibold text-slate-700 dark:text-zinc-200">{categoriaPrincipal}</span>, esto te puede interesar.</>
                            : 'Grupos con lugar disponible esta semana.'}
                    </p>
                    <GruposCarousel
                        groups={recomendados}
                        categories={categories}
                        tags={tags}
                        currentUser={currentUser}
                        onJoin={handleJoinClick}
                        estadoEnGrupo={estadoEnGrupo}
                    />
                </div>
            )}

            {/* El modal de inscripción, el mismo de /gcx. Se monta sólo con un
                grupo elegido para que no quede escuchando de fondo. Va por
                portal a <body>, así que no es parte de la grilla de la
                portada aunque se escriba acá adentro. */}
            {grupoAUnirse && (
                <JoinGroupModal
                    isOpen
                    onClose={() => setGrupoAUnirse(null)}
                    group={grupoAUnirse}
                    currentUser={currentUser}
                    userStatus={estadoEnGrupo(grupoAUnirse.id)}
                    onSuccess={recargarInscripciones}
                    categories={categories}
                    tags={tags}
                />
            )}

            {/* Para los dos avisos de edad, que son lo único que esta sección
                tiene que decir antes de abrir el modal. */}
            {avisoGrupo && (
                <div
                    role="status"
                    className="fixed left-1/2 top-20 z-[130] -translate-x-1/2 rounded-full bg-[#0a0a0a] px-5 py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,.18)]"
                >
                    {avisoGrupo}
                </div>
            )}
        </>
    );
};

export default SeccionGruposParaVos;

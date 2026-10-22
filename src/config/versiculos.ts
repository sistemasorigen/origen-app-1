import type { BiblicalVerse } from '../../types';

/**
 * Los versículos de respaldo.
 *
 * POR QUÉ EXISTE ESTO. La app siempre leyó los versículos de
 * `app_config.verses`, pero esa lista está vacía: el valor por defecto en
 * dbService es `[]`, en la base hay cero y no existe ninguna pantalla para
 * cargarlos. O sea que el versículo del día nunca se mostró en ningún lado —
 * ni en el inicio, que lo esconde con `{todaysVerse && …}`, ni en la tarjeta
 * destacada de Mi cuenta, que se quedaba sin su estado de reposo y
 * desaparecía entera.
 *
 * Una tarjeta que desaparece es peor que una que dice algo: deja un hueco
 * donde la persona esperaba encontrar algo, y no hay forma de saber si falla
 * o si simplemente no hay nada.
 *
 * `app_config.verses` SIGUE GANANDO. Esto es el piso, no el techo: en cuanto
 * alguien cargue versículos en la configuración, se usan esos. La rotación
 * es por día del año, así que el mismo día muestra el mismo a todo el mundo.
 */
export const VERSICULOS_POR_DEFECTO: BiblicalVerse[] = [
    { text: 'Lámpara es a mis pies tu palabra, y lumbrera a mi camino.', ref: 'Salmo 119:105' },
    { text: 'Jehová es mi pastor; nada me faltará.', ref: 'Salmo 23:1' },
    { text: 'Esfuérzate y sé valiente; no temas ni desmayes, porque Jehová tu Dios estará contigo dondequiera que vayas.', ref: 'Josué 1:9' },
    { text: 'Todo lo puedo en Cristo que me fortalece.', ref: 'Filipenses 4:13' },
    { text: 'El amor es sufrido, es benigno; no busca lo suyo, no se irrita.', ref: '1 Corintios 13:4-5' },
    { text: 'Echad sobre él toda vuestra ansiedad, porque él tiene cuidado de vosotros.', ref: '1 Pedro 5:7' },
    { text: 'Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar.', ref: 'Mateo 11:28' },
    { text: 'Mas buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas.', ref: 'Mateo 6:33' },
    { text: 'Fíate de Jehová de todo tu corazón, y no te apoyes en tu propia prudencia.', ref: 'Proverbios 3:5' },
    { text: 'Nuevas son cada mañana sus misericordias; grande es su fidelidad.', ref: 'Lamentaciones 3:23' },
    { text: 'En esto conocerán todos que sois mis discípulos, si tuviereis amor los unos con los otros.', ref: 'Juan 13:35' },
    { text: 'La paz os dejo, mi paz os doy; no se turbe vuestro corazón, ni tenga miedo.', ref: 'Juan 14:27' },
];

/**
 * El versículo de hoy: el de la configuración si hay, y si no el de respaldo.
 *
 * La rotación es la misma que usaba el inicio —día del año módulo la
 * cantidad— para que las dos pantallas muestren el mismo el mismo día.
 */
export const versiculoDelDia = (deLaConfig?: BiblicalVerse[] | null): BiblicalVerse | null => {
    const lista = deLaConfig && deLaConfig.length > 0 ? deLaConfig : VERSICULOS_POR_DEFECTO;
    if (lista.length === 0) return null;

    const inicioDelAnio = new Date(new Date().getFullYear(), 0, 0).getTime();
    const diaDelAnio = Math.floor((Date.now() - inicioDelAnio) / 86400000);
    return lista[diaDelAnio % lista.length];
};

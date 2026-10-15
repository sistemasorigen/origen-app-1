import { useEffect, useState } from 'react';
import { AppConfig, FooterLinks, MusicaBannerSlide } from '../../types';
import { db } from '../../services/dbService';
import { supabaseService, getMusicaBannerSlides } from '../../services/supabaseService';
import { liberarMedia, precargarMedia, reservarMedia } from '../utils/mediaDeEntrada';
import type { BannerLinkSlide } from '../../components/inicio/BannerLinkCarousel';

/**
 * Los banners de la portada: el principal, Origen Música y Origen en Youvers,
 * más los links del pie.
 *
 * Estaba todo suelto adentro de pages/home/Home.tsx. Se mueve entero —con la
 * caché en localStorage y con la espera de la pantalla de entrada— porque son
 * una sola cosa: QUÉ se muestra arriba y CUÁNDO se puede destapar.
 */

export interface BannersDeInicio {
    config: AppConfig;
    footerLinks: FooterLinks;
    /** Arranca en false y pasa a true a los 100 ms: dispara las animaciones. */
    isLoaded: boolean;
    musicaSlides: MusicaBannerSlide[];
    youversSlides: BannerLinkSlide[];
}

const SIN_REDES: FooterLinks = { instagram: '', facebook: '', youtube: '', spotify: '' };

export const useBannersDeInicio = (): BannersDeInicio => {
    const [config, setConfig] = useState<AppConfig>(db.getAppConfig());
    const [footerLinks, setFooterLinks] = useState<FooterLinks>(SIN_REDES);
    const [isLoaded, setIsLoaded] = useState(false);
    const [musicaSlides, setMusicaSlides] = useState<MusicaBannerSlide[]>([]);

    // Para la pantalla de entrada: si los datos llegaron ya se sabe QUÉ hay
    // que precargar. "Resuelto" incluye que la consulta haya fallado — lo que
    // no puede pasar es quedarse esperando una respuesta que no viene.
    const [configResuelta, setConfigResuelta] = useState(false);
    const [musicaResuelta, setMusicaResuelta] = useState(false);

    useEffect(() => {
        getMusicaBannerSlides()
            .then(setMusicaSlides)
            .catch(() => { /* sin banner de música se sigue igual */ })
            .finally(() => setMusicaResuelta(true));
    }, []);

    // ── La pantalla de entrada espera a los dos medios pesados de acá ──
    //
    // El velo de App.tsx ya esperaba la sesión y los roles, pero el video del
    // hero empieza a bajar recién cuando llega la config, bastante después:
    // el velo se iba y arriba quedaba un rectángulo negro que se llenaba un
    // segundo más tarde. Lo mismo con el banner de Origen Música.
    //
    // Se precarga SÓLO el primer slide de cada carrusel: es el que se ve al
    // destapar. Esperar los cinco sería esperar lo que nadie está mirando.
    //
    // La reserva se toma al montar, antes de saber qué hay que cargar: si se
    // esperara a tener los datos, el velo ya se habría ido para cuando esta
    // pantalla levanta la mano.
    useEffect(() => {
        reservarMedia('inicio');
        // Irse del Home libera: nadie tiene que esperar un video que ya no
        // está en pantalla.
        return () => liberarMedia('inicio');
    }, []);

    const heroPrimero = config.banner?.slides?.[0];
    const musicaPrimero = musicaSlides[0];

    useEffect(() => {
        if (!configResuelta || !musicaResuelta) return;

        let vivo = true;
        const pendientes: Promise<void>[] = [];

        if (heroPrimero) {
            pendientes.push(heroPrimero.mediaType === 'video' && heroPrimero.videoUrl
                ? precargarMedia(heroPrimero.videoUrl, 'video')
                : precargarMedia(heroPrimero.imageUrl, 'image'));
        }
        if (musicaPrimero) {
            pendientes.push(musicaPrimero.mediaType === 'video' && musicaPrimero.videoUrl
                ? precargarMedia(musicaPrimero.videoUrl, 'video')
                : precargarMedia(musicaPrimero.mediaUrl, 'image'));
        }

        // `precargarMedia` nunca rechaza y tiene su propio tope, así que esto
        // siempre termina.
        Promise.all(pendientes).then(() => { if (vivo) liberarMedia('inicio'); });

        return () => { vivo = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [configResuelta, musicaResuelta, heroPrimero?.id, heroPrimero?.videoUrl, heroPrimero?.imageUrl, musicaPrimero?.id]);

    useEffect(() => {
        const init = async () => {
            const remoteConfig = await supabaseService.getAppConfig();
            const activeConfig = remoteConfig || db.getAppConfig();
            setConfig(activeConfig);
            setFooterLinks(activeConfig.footerLinks || SIN_REDES);
            // Cachea la config real en localStorage — protege contra fallas
            // de red transitorias: si una consulta futura a Supabase falla,
            // se usa la última config buena guardada acá en vez de caer al
            // DEFAULT_CONFIG (banner.slides: [] a propósito), que mostraría
            // el slide de respaldo sin video. Sólo se cachea si la consulta
            // realmente respondió — no queremos pisar un cache bueno con el
            // fallback local ante una falla puntual.
            if (remoteConfig) db.saveAppConfig(remoteConfig);
        };

        init().finally(() => setConfigResuelta(true));
        if (!isLoaded) {
            setTimeout(() => setIsLoaded(true), 100);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Los slides de Youvers viven en la config (app_config.config, un JSONB de
    // lectura pública), no en una tabla propia como los de música: son sólo
    // imagen + link, y así se publican sin depender de ninguna migración.
    const youversSlides: BannerLinkSlide[] = (config.youversBanner?.slides || []).map(s => ({
        id: s.id,
        mediaUrl: s.imageUrl,
        mediaType: 'image' as const,
        focalX: s.focalX,
        focalY: s.focalY,
        zoom: s.zoom,
        title: s.title,
        targetUrl: s.targetUrl
    }));

    return { config, footerLinks, isLoaded, musicaSlides, youversSlides };
};

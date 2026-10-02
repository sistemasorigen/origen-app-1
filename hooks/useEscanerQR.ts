import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

/**
 * El núcleo de cámara del escáner de QR, extraído de
 * `pages/eventos/dianino/EscanerDiaNino.tsx`.
 *
 * Cada corrección de acá salió de un problema real en un celular real, y
 * ninguna es opcional:
 *
 *  · `html5-qrcode` y no `qr-scanner`: el segundo no arranca en iOS Safari.
 *  · `facingMode: 'environment'`: la cámara trasera, no la selfie.
 *  · El callback del código vive en un ref. Si fuera una dependencia del
 *    efecto, cada vez que cambiara la función se reiniciaría la cámara —y
 *    cambia en cada render de quien usa el hook.
 *  · `initScanner` hace `await` de verdad al `stop()` y al `clear()` de la
 *    instancia anterior ANTES de crear la nueva. Sin ese await, dos
 *    instancias pelean por el mismo div y el reintento crasheaba en Android.
 *  · Todas las limpiezas van en try/catch: detener un escáner que no está
 *    corriendo tira "Cannot stop, scanner is not running".
 *  · Se detectan los navegadores embebidos (WhatsApp, Instagram) que
 *    bloquean la cámara sin avisar, y el permiso ya denegado, que en la
 *    mayoría de los navegadores no se vuelve a pedir solo.
 */

export interface EstadoEscaner {
    /** La cámara está corriendo. */
    activa: boolean;
    /** Mensaje de error de cámara, listo para mostrar. */
    error: string | null;
    /** Está abierto en WhatsApp, Instagram o similar. */
    navegadorEmbebido: boolean;
    /** El permiso ya fue denegado antes: el navegador no vuelve a preguntar. */
    permisoDenegado: boolean;
    reintentando: boolean;
    reintentar: () => Promise<void>;
    /** Frena la lectura sin apagar la cámara. */
    pausar: () => void;
    reanudar: () => void;
    linterna: {
        disponible: boolean;
        encendida: boolean;
        alternar: () => Promise<void>;
    };
}

interface Opciones {
    /** El id del div donde se monta el video. Tiene que existir en el DOM. */
    contenedorId: string;
    /** Se llama con el texto leído. Puede cambiar en cada render sin costo. */
    onCodigo: (texto: string) => void;
    /** En false no se abre la cámara (por ejemplo, mientras carga la sesión). */
    activo?: boolean;
}

export const useEscanerQR = ({ contenedorId, onCodigo, activo = true }: Opciones): EstadoEscaner => {
    const escanerRef = useRef<Html5Qrcode | null>(null);
    const onCodigoRef = useRef(onCodigo);
    const pausadoRef = useRef(false);
    /**
     * El arranque en vuelo.
     *
     * `iniciar` es asincrónico y se puede llamar dos veces casi a la vez: en
     * desarrollo React monta, desmonta y vuelve a montar el efecto, y el
     * reintento manual puede llegar mientras el primero todavía está pidiendo
     * la cámara. Sin este candado quedaban DOS instancias en el mismo div, y
     * por lo tanto dos <video> apilados ocupando media pantalla cada uno.
     */
    const enMarchaRef = useRef<Promise<void> | null>(null);

    const [activa, setActiva] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [navegadorEmbebido, setNavegadorEmbebido] = useState(false);
    const [permisoDenegado, setPermisoDenegado] = useState(false);
    const [reintentando, setReintentando] = useState(false);
    const [linternaDisponible, setLinternaDisponible] = useState(false);
    const [linternaEncendida, setLinternaEncendida] = useState(false);

    // El callback se guarda en un ref: así `iniciar` no depende de él y la
    // cámara no se reinicia cada vez que quien usa el hook vuelve a renderizar.
    useEffect(() => { onCodigoRef.current = onCodigo; }, [onCodigo]);

    /**
     * Agranda el video hasta tapar su contenedor, con un transform.
     *
     * No con width/height: html5-qrcode copia cada cuadro a un lienzo del
     * tamaño del elemento y mapea la región con `videoWidth / clientWidth` en
     * X y `videoHeight / clientHeight` en Y. Cambiarle la caja al video
     * descoloca esos dos factores —el cuadro llega deformado y no se lee
     * nada— y además infla el lienzo. Un transform es puro dibujo: el layout
     * no se entera, el lienzo queda del tamaño del stream y la copia es 1:1.
     *
     * Se recalcula cuando cambia el tamaño del stream (evento `resize` del
     * video) y cuando gira el teléfono.
     */
    const ajustarEscala = useCallback(() => {
        const contenedor = document.getElementById(contenedorId);
        const video = contenedor?.querySelector('video');
        if (!contenedor || !video) return;
        const { clientWidth: ancho, clientHeight: alto } = video;
        if (!ancho || !alto) return;
        const escala = Math.max(
            contenedor.clientWidth / ancho,
            contenedor.clientHeight / alto,
        );
        if (!Number.isFinite(escala) || escala <= 0) return;
        video.style.transform = `translate(-50%, -50%) scale(${escala})`;
    }, [contenedorId]);

    const iniciar = useCallback(async () => {
        // Si ya hay un arranque en curso, se espera a que termine antes de
        // empezar otro.
        if (enMarchaRef.current) {
            try { await enMarchaRef.current; } catch { /* el anterior ya reportó lo suyo */ }
        }
        const tarea = arrancar();
        enMarchaRef.current = tarea;
        try { await tarea; } finally {
            if (enMarchaRef.current === tarea) enMarchaRef.current = null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contenedorId]);

    const arrancar = useCallback(async () => {
        setPermisoDenegado(false);
        setNavegadorEmbebido(false);
        setError(null);
        setLinternaDisponible(false);
        setLinternaEncendida(false);

        // Se espera de VERDAD a que la instancia anterior suelte el div. Sin
        // este await, el reintento dejaba dos instancias peleando por el mismo
        // elemento y tiraba una excepción sin atrapar (crash real en Android).
        if (escanerRef.current) {
            try {
                await escanerRef.current.stop();
                await escanerRef.current.clear();
            } catch {
                // no-op: no había nada corriendo que detener
            }
            escanerRef.current = null;
        }
        setActiva(false);

        // WhatsApp, Instagram, Facebook y Messenger bloquean la cámara sin
        // avisar en Android. En iOS casi siempre abren en Safari, por eso el
        // problema se ve sobre todo en los que no son iPhone.
        const ua = navigator.userAgent || '';
        if (/Instagram|FBAN|FBAV|FB_IAB|WhatsApp|Line\//i.test(ua)) {
            setNavegadorEmbebido(true);
        }

        // Si el permiso ya está denegado, la mayoría de los navegadores no
        // vuelven a mostrar el cartel nunca más: conviene decir eso y no el
        // mensaje genérico.
        if (navigator.permissions?.query) {
            navigator.permissions
                .query({ name: 'camera' as PermissionName })
                .then(estado => { if (estado.state === 'denied') setPermisoDenegado(true); })
                .catch(() => {
                    // Hay navegadores que no saben consultar 'camera'. No es crítico.
                });
        }

        // Red de seguridad: si una instancia anterior se perdió sin limpiar
        // (el cleanup no puede esperar a que su stop() resuelva), su <video>
        // sigue en el DOM. Se vacía el contenedor antes de crear el nuevo.
        const contenedor = document.getElementById(contenedorId);
        if (contenedor) contenedor.innerHTML = '';

        // Sólo QR. Por omisión la librería prueba además una docena de
        // códigos de barras en cada cuadro, y eso duplica el tiempo de
        // lectura —medido: 69 ms contra 34 ms por cuadro con un QR de
        // entrada—. Acá no hay otra cosa que leer.
        const escaner = new Html5Qrcode(contenedorId, {
            verbose: false,
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        });
        escanerRef.current = escaner;

        try {
            await escaner.start(
                { facingMode: 'environment' },
                // Sin `qrbox` a propósito. Con él, html5-qrcode dibuja SU
                // recuadro sombreado encima del marco del diseño —se veían
                // dos— y además limita la lectura a un cuadrado centrado que
                // no coincide con el marco que la persona está mirando. Sin
                // qrbox se lee todo el cuadro, que en una puerta es más
                // perdonador. Probado: con qrbox, una entrada acercada de más
                // se sale del recuadro y deja de leerse.
                {
                    // 25 y no 10: entre cuadro y cuadro la librería duerme
                    // 1000/fps. Con 10 eran 100 ms de nada en cada intento,
                    // y la lectura ahora tarda menos que esa siesta.
                    fps: 25,
                    // Cada cuadro que NO tiene QR —o sea, todos los que la
                    // persona pasa apuntando— se decodifica dos veces: la
                    // segunda, espejado. Una entrada en la pantalla de un
                    // celular nunca está espejada, así que ese segundo
                    // intento es la mitad del trabajo tirada a la basura.
                    disableFlip: true,
                },
                texto => {
                    if (pausadoRef.current) return;
                    onCodigoRef.current(texto);
                },
                () => {
                    // No hay QR en el cuadro. No es un error.
                },
            );
            pausadoRef.current = false;
            setActiva(true);

            // El video ya está en el DOM con su tamaño natural: ahora se lo
            // agranda hasta tapar. El rAF es por si el layout todavía no
            // asentó; el evento `resize` del video cubre el caso de la cámara
            // que cambia de resolución sola.
            ajustarEscala();
            requestAnimationFrame(ajustarEscala);
            const video = document.getElementById(contenedorId)?.querySelector('video');
            video?.addEventListener('resize', ajustarEscala);

            // La linterna sólo existe en algunos dispositivos y navegadores.
            // Si no está, el botón no se muestra: mejor que uno que no hace nada.
            try {
                const capacidades: any = escaner.getRunningTrackCapabilities?.();
                if (capacidades && 'torch' in capacidades) setLinternaDisponible(true);
            } catch {
                // no-op: sin linterna
            }
        } catch (err: any) {
            setActiva(false);
            setError('No pudimos acceder a la cámara. Revisá los permisos del navegador e intentá de nuevo.');
            // El nombre real del error (NotAllowedError, NotReadableError…)
            // sirve para diagnosticar sin tener el dispositivo a mano.
            console.error('[useEscanerQR] error de cámara:', err?.name || 'desconocido', err);
        }
    }, [contenedorId, ajustarEscala]);

    // Girar el teléfono cambia el contenedor, no el stream: hay que volver a
    // calcular cuánto tiene que agrandarse el video para taparlo.
    useEffect(() => {
        const alCambiar = () => ajustarEscala();
        window.addEventListener('resize', alCambiar);
        window.addEventListener('orientationchange', alCambiar);
        return () => {
            window.removeEventListener('resize', alCambiar);
            window.removeEventListener('orientationchange', alCambiar);
        };
    }, [ajustarEscala]);


    // Sólo al montar. El reintento llama a `iniciar` directo, sin pasar por
    // acá: así React no dispara el efecto y la limpieza asincrónica de la
    // instancia anterior al mismo tiempo.
    useEffect(() => {
        if (!activo) return;
        iniciar();

        return () => {
            const escaner = escanerRef.current;
            escanerRef.current = null;
            if (escaner) {
                // Sólo stop(), no clear(): el stop resuelve después, y para
                // entonces el div puede ser ya el de la instancia nueva. Un
                // clear() tardío le borraría el video al que está andando. De
                // vaciar el DOM se encarga `arrancar`.
                try { escaner.stop().catch(() => {}); } catch { /* no estaba corriendo */ }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activo]);

    const reintentar = useCallback(async () => {
        setReintentando(true);
        await iniciar();
        setReintentando(false);
    }, [iniciar]);

    /**
     * Frena la lectura sin apagar la cámara.
     *
     * html5-qrcode dispara el callback mientras el código siga enfrente: sin
     * esto, la misma entrada se procesa decenas de veces por segundo. El
     * `false` es para que el video se siga viendo: apagarlo daría la impresión
     * de que el escáner se colgó.
     */
    const pausar = useCallback(() => {
        pausadoRef.current = true;
        try { escanerRef.current?.pause(false); } catch { /* no estaba corriendo */ }
    }, []);

    const reanudar = useCallback(() => {
        pausadoRef.current = false;
        try { escanerRef.current?.resume(); } catch { /* no estaba corriendo */ }
    }, []);

    const alternarLinterna = useCallback(async () => {
        const escaner = escanerRef.current;
        if (!escaner) return;
        const proxima = !linternaEncendida;
        try {
            await (escaner as any).applyVideoConstraints({ advanced: [{ torch: proxima }] });
            setLinternaEncendida(proxima);
        } catch (err) {
            // Hay dispositivos que la declaran y después la rechazan. Se deja
            // de ofrecer antes que dejar un botón que no responde.
            console.error('[useEscanerQR] la linterna no respondió:', err);
            setLinternaDisponible(false);
        }
    }, [linternaEncendida]);

    return {
        activa,
        error,
        navegadorEmbebido,
        permisoDenegado,
        reintentando,
        reintentar,
        pausar,
        reanudar,
        linterna: {
            disponible: linternaDisponible,
            encendida: linternaEncendida,
            alternar: alternarLinterna,
        },
    };
};

/**
 * Pide que la pantalla no se apague sola.
 *
 * El celular del staff se bloquea a los dos minutos y se lleva la cámara con
 * él, en el medio de una fila de familias. El bloqueo se pierde al cambiar de
 * app, así que se vuelve a pedir cuando la pestaña se hace visible.
 *
 * Funciona en Chrome de Android y en Safari desde iOS 16.4. Donde no está, no
 * pasa nada: la pantalla se apaga como siempre y el resto sigue andando.
 */
export const useMantenerPantallaEncendida = (activo: boolean): boolean => {
    const bloqueoRef = useRef<any>(null);
    const [sostenida, setSostenida] = useState(false);

    useEffect(() => {
        if (!activo) return;
        const api = (navigator as any).wakeLock;
        if (!api?.request) return;

        let vivo = true;

        const pedir = async () => {
            if (!vivo || document.visibilityState !== 'visible') return;

            // Al volver de otra app el navegador ya soltó el bloqueo anterior,
            // pero no en todos: pedir uno nuevo encima del viejo dejaba el
            // primero tomado para siempre. Se suelta antes de pedir.
            if (bloqueoRef.current) {
                try { await bloqueoRef.current.release?.(); } catch { /* ya liberado */ }
                bloqueoRef.current = null;
            }

            try {
                const bloqueo = await api.request('screen');
                // Entre el pedido y la respuesta la pantalla puede haberse
                // cerrado. Sin esto quedaba un bloqueo tomado y sin nadie que
                // lo suelte: la pantalla del celular se queda encendida
                // después de salir del escáner.
                if (!vivo || document.visibilityState !== 'visible') {
                    try { await bloqueo.release?.(); } catch { /* ya liberado */ }
                    return;
                }
                bloqueoRef.current = bloqueo;
                setSostenida(true);
                bloqueo.addEventListener?.('release', () => setSostenida(false));
            } catch (err) {
                // Lo rechaza con la batería baja, entre otros motivos. No es
                // un error que valga la pena mostrarle a nadie.
                console.warn('[pantalla] no se pudo mantener encendida:', err);
                setSostenida(false);
            }
        };

        // Al volver de otra app el bloqueo ya no existe: hay que pedirlo otra vez.
        const alVolver = () => { if (document.visibilityState === 'visible') pedir(); };

        pedir();
        document.addEventListener('visibilitychange', alVolver);

        return () => {
            vivo = false;
            document.removeEventListener('visibilitychange', alVolver);
            try { bloqueoRef.current?.release?.(); } catch { /* ya liberado */ }
            bloqueoRef.current = null;
            setSostenida(false);
        };
    }, [activo]);

    return sostenida;
};

/**
 * Armar el link de WhatsApp a partir de un teléfono cargado a mano.
 *
 * wa.me necesita el número completo en formato internacional y sin signos.
 * Lo que hay guardado no lo está: sobre ~660 inscripciones, 531 son diez
 * dígitos sueltos (511 empiezan en 11, el resto son otras características),
 * 112 ya vienen como 549…, 41 como 54… sin el 9, y 16 como 9 + diez dígitos.
 *
 * El 9 va después del 54 y antes de la característica: es lo que le dice a
 * la red que es un celular. Sin él, wa.me abre un chat que no existe.
 *
 * Cuando el número no alcanza para armar algo confiable —muy corto, o con el
 * viejo 15 adelante sin característica— devuelve null en vez de adivinar.
 * Un número inventado no falla en silencio: abre el chat de otra persona, y
 * quien escribe no tiene forma de darse cuenta.
 */
export const aNumeroDeWhatsApp = (telefono?: string | null): string | null => {
    const d = (telefono || '').replace(/\D/g, '');
    if (!d) return null;

    // Ya trae el país.
    if (d.startsWith('54')) {
        const resto = d.slice(2);
        // 54 + 9 + característica + número: lo que wa.me espera.
        if (resto.startsWith('9') && resto.length === 11) return d;
        // 54 sin el 9 de celular: se lo agregamos.
        if (resto.length === 10) return `549${resto}`;
        return null;
    }

    // 9 + característica + número, sin el país.
    if (d.startsWith('9') && d.length === 11) return `54${d}`;

    // Diez dígitos sueltos: característica + número. El 15 adelante es el
    // prefijo viejo de celular y se escribía SIN característica, así que no
    // hay forma de saber de qué ciudad es. Preferimos no ofrecer el botón.
    if (d.length === 10) {
        if (d.startsWith('15')) return null;
        return `549${d}`;
    }

    return null;
};

/** El link listo, o null si el teléfono no da para armarlo. */
export const linkDeWhatsApp = (telefono?: string | null): string | null => {
    const n = aNumeroDeWhatsApp(telefono);
    return n ? `https://wa.me/${n}` : null;
};

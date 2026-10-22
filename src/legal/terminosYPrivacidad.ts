/**
 * Los términos, la privacidad y qué datos guarda la app.
 *
 * Está acá y no adentro de una pantalla porque lo leen dos: la pantalla de
 * Términos y la de Privacidad. Si hubiera dos copias, una quedaría vieja.
 *
 * EL TEXTO ES EL QUE IGNACIO REVISÓ (design-claude/Mi Cuenta - Privacidad y
 * ayuda.dc), con tres correcciones que él mismo indicó:
 *
 *   · La iglesia NO tiene email de contacto. Todo lo que en el diseño decía
 *     "escribinos a contacto@origeniglesia.org" se reemplazó por el canal que
 *     existe de verdad: la solicitud desde la app, y WhatsApp. La respuesta
 *     llega al email de la cuenta de cada persona.
 *   · WhatsApp y horario reales.
 *   · La dirección real.
 *
 * Nada de esto promete algo que la app no haga. Si mañana cambia lo que se
 * guarda, cambia acá y las dos pantallas lo dicen igual.
 */

export const RESPONSABLE = {
    razonSocial: 'Asociación Civil Fuente de Vida',
    nombre: 'Origen Iglesia',
    cuit: '30-70705090-6',
    direccion: 'Avenida Eva Perón 3932',
    ciudad: 'Ciudad Autónoma de Buenos Aires',
};

export const WHATSAPP = {
    /** Como se muestra. */
    visible: '+54 9 11 3789-0178',
    /** El link, con un saludo ya escrito: nadie tiene que arrancar de cero. */
    link: 'https://wa.me/5491137890178?text=' + encodeURIComponent('Hola, les escribo desde la app de Origen'),
    horario: 'Lunes a viernes, de 9 a 19 h',
};

/** El mapa de Google con la dirección de la iglesia. */
export const COMO_LLEGAR =
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(`${RESPONSABLE.direccion}, ${RESPONSABLE.ciudad}`);

/** Cuándo se actualizó este texto por última vez. */
export const ULTIMA_ACTUALIZACION = '22 de octubre de 2026';

/**
 * Qué datos tiene la app de cada persona.
 *
 * Tres preguntas por categoría, siempre las mismas: qué guardamos, para qué y
 * quién lo ve. Es el orden en que la gente las hace.
 */
export interface CategoriaDeDatos {
    nombre: string;
    /** El ícono, del juego de Mi cuenta. */
    icono: string;
    resumen: string;
    que: string;
    para: string;
    quien: string;
}

export const CATEGORIAS_DE_DATOS: CategoriaDeDatos[] = [
    {
        nombre: 'Cuenta',
        icono: 'M3.5 6h17v12h-17zM3.5 7l8.5 6.5L20.5 7',
        resumen: 'Email y cómo entrás',
        que: 'Tu email y cómo entrás a la app: con Google o con una contraseña.',
        para: 'Para que puedas entrar y para avisarte cosas importantes de tu cuenta.',
        quien: 'Vos y el equipo técnico de la app.',
    },
    {
        nombre: 'Perfil',
        icono: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0',
        resumen: 'Nombre, teléfono, nacimiento, sexo y foto',
        que: 'Nombre y apellido, teléfono, fecha de nacimiento, sexo y foto.',
        para: 'Para que tus anfitriones y coordinadores te conozcan y te puedan contactar, y para armar los grupos por edad.',
        quien: 'Vos, los anfitriones de tus grupos y los coordinadores de GCX.',
    },
    {
        nombre: 'Grupos',
        icono: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.3a3.5 3.5 0 010 6.4M17.5 14a6.5 6.5 0 014 6',
        resumen: 'Inscripciones y asistencia',
        que: 'A qué grupos te sumaste, con qué rol, y tu asistencia a cada encuentro.',
        para: 'Para organizar los grupos y acompañarte durante la temporada.',
        quien: 'Los anfitriones de tus grupos y los coordinadores de GCX.',
    },
    {
        nombre: 'Eventos',
        icono: 'M3.5 7h17v3.2a1.8 1.8 0 000 3.6V17h-17v-3.2a1.8 1.8 0 000-3.6zM14.5 7v10',
        resumen: 'Inscripciones y datos de menores',
        que: 'Tus inscripciones a eventos. Si inscribiste menores: su nombre, su edad, quién los retira y un teléfono de contacto.',
        para: 'Para tu entrada, para cuidar a los chicos y para comunicarnos con vos durante el evento.',
        quien: 'El equipo del evento y el área de acreditación.',
    },
    {
        nombre: 'Compras',
        icono: 'M5 8h14l-1.2 12H6.2zM9 8a3 3 0 016 0',
        resumen: 'Pedidos y comprobantes',
        que: 'Tus pedidos y el comprobante de cada transferencia.',
        para: 'Para preparar y entregar tu pedido, y porque la ley contable nos pide guardarlos.',
        quien: 'El equipo del Punto de Información y administración.',
    },
    {
        nombre: 'Servicio',
        icono: 'M12 9.2c-1-1.8-4-1.5-4 .8 0 1.8 4 4 4 4s4-2.2 4-4c0-2.3-3-2.6-4-.8zM3 16h3.5l3.5 3h6.5l4.5-3.5M3 16v4',
        resumen: 'Áreas donde servís',
        que: 'Las áreas donde servís y tus turnos.',
        para: 'Para organizar los equipos de voluntarios.',
        quien: 'Los líderes de cada área.',
    },
];

/**
 * La leyenda de la Agencia de Acceso a la Información Pública.
 *
 * TEXTUAL. Es la que exige la Ley 25.326 y no se reescribe ni se acorta.
 */
export const LEYENDA_AAIP =
    'La AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA, en su carácter de Órgano de Control de la Ley N° 25.326, '
    + 'tiene la atribución de atender las denuncias y reclamos que interpongan quienes resulten afectados en sus '
    + 'derechos por incumplimiento de las normas vigentes en materia de protección de datos personales.';

export interface SeccionLegal {
    titulo: string;
    parrafos: string[];
}

export const TERMINOS: SeccionLegal[] = [
    {
        titulo: 'Quiénes somos',
        parrafos: [
            `Origen App es la aplicación de ${RESPONSABLE.nombre}, a cargo de la ${RESPONSABLE.razonSocial}, `
            + `CUIT ${RESPONSABLE.cuit}, con domicilio en ${RESPONSABLE.direccion}, ${RESPONSABLE.ciudad}.`,
            'Al usar la app aceptás estos términos. Si algo no te queda claro, escribinos por WhatsApp desde '
            + '«Escribile a la iglesia».',
        ],
    },
    {
        titulo: 'Qué datos usamos',
        parrafos: [
            'Usamos los datos que nos das al crear tu cuenta y completar tu perfil, y los que se generan cuando usás '
            + 'la app: grupos, inscripciones a eventos, compras y áreas de servicio.',
            'No usamos tu ubicación ni accedemos a tus contactos.',
        ],
    },
    {
        titulo: 'Para qué',
        parrafos: [
            'Para que puedas usar la app, organizar los grupos y los eventos, preparar tus pedidos y comunicarnos '
            + 'con vos.',
            'No vendemos tus datos ni los usamos para publicidad.',
        ],
    },
    {
        titulo: 'Con quién se comparten',
        parrafos: [
            'Dentro de la iglesia, sólo con las personas que los necesitan para su tarea: anfitriones, '
            + 'coordinadores, líderes de área y el equipo de cada evento.',
            'Fuera de la iglesia, sólo con los servicios técnicos que hacen funcionar la app, como el alojamiento '
            + 'de los datos y el envío de emails.',
        ],
    },
    {
        titulo: 'Datos de menores',
        parrafos: [
            'Cuando inscribís a un menor a un evento, nos das sus datos como su adulto responsable. Los usamos sólo '
            + 'para ese evento y para su cuidado.',
            'Sólo los ve el equipo del evento y el área de acreditación.',
        ],
    },
    {
        titulo: 'Tus derechos (Ley 25.326)',
        parrafos: [
            'Podés pedir una copia de tus datos, corregirlos o pedir que los borremos, desde «Privacidad y mis '
            + 'datos».',
            'El acceso es gratis una vez cada 6 meses y te respondemos en hasta 10 días corridos. Las correcciones '
            + 'y la supresión, en hasta 5 días hábiles. Te respondemos al email de tu cuenta.',
            LEYENDA_AAIP,
        ],
    },
    {
        titulo: 'Contacto',
        parrafos: [
            `Para cualquier consulta sobre tus datos o estos términos, escribinos por WhatsApp al `
            + `${WHATSAPP.visible}. ${WHATSAPP.horario}.`,
            `También podés acercarte a ${RESPONSABLE.direccion}, ${RESPONSABLE.ciudad}.`,
        ],
    },
];

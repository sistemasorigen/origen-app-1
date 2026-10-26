// Agenda Origen · datos de ejemplo y helpers compartidos (window.AO)
(function () {
  const I = {
    palette: 'M12 22a10 10 0 1 1 10-10c0 1.7-1.3 3-3 3h-2.5a2 2 0 0 0-1.5 3.3 1.6 1.6 0 0 1-1.2 2.7z M13.5 6.5h.01 M17.5 10.5h.01 M8.5 7.5h.01 M6.5 12.5h.01',
    camera: 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z M9 13a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
    video: 'M16 13l5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11 M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
    mic: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v3',
    music: 'M9 18V5l12-2v13 M3 18a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M15 16a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
    megaphone: 'M3 11l18-5v12L3 14v-3z M11.6 16.8a3 3 0 1 1-5.8-1.6',
    heart: 'M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z',
    hands: 'M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16 M7 20l1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9 M2 15l6 6 M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12z',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
    book: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20',
    calendar: 'M8 2v4 M16 2v4 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M3 10h18',
    coffee: 'M10 2v2 M14 2v2 M6 2v2 M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1',
    star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
    shield: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
    monitor: 'M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M8 21h8 M12 17v4',
    pencil: 'M21.17 6.81a2.83 2.83 0 0 0-4-4L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z M15 5l4 4',
    wrench: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z',
    baby: 'M9 12h.01 M15 12h.01 M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5 M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1',
    globe: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20 M2 12h20',
    message: 'M7.9 20A9 9 0 1 0 4 16.1L2 22z',
    car: 'M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2 M5 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0 M9 17h6 M15 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
    house: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8 M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    gift: 'M4 8h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z M12 8v13 M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7 M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5',
    sparkles: 'M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.13-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.13a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0z M20 3v4 M22 5h-4',
    // UI
    chevL: 'M15 18l-6-6 6-6', chevR: 'M9 18l6-6-6-6', chevD: 'M6 9l6 6 6-6', chevU: 'M18 15l-6-6-6 6',
    check: 'M20 6L9 17l-5-5', x: 'M18 6L6 18 M6 6l12 12', plus: 'M12 5v14 M5 12h14',
    folder: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
    search: 'M3 11a8 8 0 1 0 16 0a8 8 0 1 0-16 0 M21 21l-4.3-4.3', filter: 'M4 7h16 M7 12h10 M10 17h4',
    clock: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M12 6v6l4 2', more: 'M5 12h.01 M12 12h.01 M19 12h.01',
    trash: 'M3 6h18 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    arrowL: 'M19 12H5 M12 19l-7-7 7-7', grip: 'M9 5h.01 M9 12h.01 M9 19h.01 M15 5h.01 M15 12h.01 M15 19h.01',
    up: 'M12 19V5 M5 12l7-7 7 7', down: 'M12 5v14 M19 12l-7 7-7-7',
    inbox: 'M22 12h-6l-2 3h-4l-2-3H2 M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
    alert: 'M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M12 8v4 M12 16h.01',
    refresh: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8 M21 3v5h-5 M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16 M8 16H3v5',
    lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z M7 11V7a5 5 0 0 1 10 0v4',
    swap: 'M16 3l4 4-4 4 M20 7H4 M8 21l-4-4 4-4 M4 17h16', menu: 'M4 7h16 M4 12h16 M4 17h10',
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z',
    send: 'M14.5 21.7a.5.5 0 0 0 .9-.1l6.5-19a.5.5 0 0 0-.6-.6l-19 6.5a.5.5 0 0 0-.1.9l7.9 3.2a2 2 0 0 1 1.1 1.1z M21.9 2.1L10.9 13.1',
    mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 7l-10 7L2 7',
    home: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8 M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 14.6l1.5 1.2-1.8 3.1-1.8-.7a7.6 7.6 0 01-2.6 1.5l-.3 2.3h-3.6l-.3-2.3a7.6 7.6 0 01-2.6-1.5l-1.8.7-1.8-3.1 1.5-1.2a7.6 7.6 0 010-3l-1.5-1.2 1.8-3.1 1.8.7a7.6 7.6 0 012.6-1.5l.3-2.3h3.6l.3 2.3a7.6 7.6 0 012.6 1.5l1.8-.7 1.8 3.1-1.5 1.2a7.6 7.6 0 010 3z',
    userPlus: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M5 7a4 4 0 1 0 8 0a4 4 0 1 0-8 0 M19 8v6 M22 11h-6'
  };
  const ICONOS_DEPTO = [
    ['palette', 'Paleta'], ['camera', 'Cámara'], ['video', 'Video'], ['mic', 'Micrófono'], ['music', 'Música'], ['megaphone', 'Megáfono'],
    ['heart', 'Corazón'], ['hands', 'Manos'], ['users', 'Personas'], ['book', 'Libro'], ['calendar', 'Calendario'], ['coffee', 'Café'],
    ['star', 'Estrella'], ['shield', 'Escudo'], ['monitor', 'Monitor'], ['pencil', 'Lápiz'], ['wrench', 'Herramienta'], ['baby', 'Bebé'],
    ['globe', 'Globo'], ['message', 'Mensaje'], ['car', 'Auto'], ['house', 'Casa'], ['gift', 'Regalo'], ['sparkles', 'Chispa']
  ];
  const PALETA = [
    ['#7c3aed', 'Violeta'], ['#4f46e5', 'Índigo'], ['#2563eb', 'Azul'], ['#0e7490', 'Cian'], ['#0f766e', 'Verde azulado'], ['#15803d', 'Verde'],
    ['#4d7c0f', 'Oliva'], ['#b45309', 'Ámbar'], ['#c2410c', 'Naranja'], ['#dc2626', 'Rojo'], ['#db2777', 'Rosa'], ['#c026d3', 'Fucsia']
  ];
  const ESTADOS = {
    espera: { label: 'Esperando asignación', ink: '#8a4b06', bg: 'rgba(180,83,9,.12)', dot: '#d08a2c' },
    proceso: { label: 'En proceso', ink: '#1d4ed8', bg: 'rgba(37,99,235,.11)', dot: '#2563eb' },
    completada: { label: 'Completada', ink: '#15803d', bg: 'rgba(21,128,61,.12)', dot: '#16a34a' }
  };
  const TONOS = ['#ede7fb', '#fbe4ef', '#fdecd5', '#e0eafd', '#dcf2e3', '#e3f1f4', '#f3e8d8', '#ebe9f8'];
  const N = [
    ['u1', 'Lucía', 'Ferreyra'], ['u2', 'Tomás', 'Aguirre'], ['u3', 'Valentina', 'Ríos'], ['u4', 'Joaquín', 'Medina'],
    ['u5', 'Sofía', 'Benítez'], ['u6', 'Mateo', 'Quiroga'], ['u7', 'Camila', 'Ledesma'], ['u8', 'Bruno', 'Castillo'],
    ['u9', 'Martina', 'Vega'], ['u10', 'Nicolás', 'Paz'], ['u11', 'Julieta', 'Romero'], ['u12', 'Franco', 'Díaz'],
    ['u13', 'Agustina', 'Molina'], ['u14', 'Ezequiel', 'Suárez'], ['u15', 'Rocío', 'Herrera'], ['u16', 'Ignacio', 'Ponce'],
    ['u17', 'Florencia', 'Navarro'], ['u18', 'Santiago', 'Godoy'], ['u19', 'Milagros', 'Ibarra'], ['u20', 'Gonzalo', 'Acosta'],
    ['u21', 'Carolina', 'Méndez'], ['u22', 'Federico', 'Luna'], ['u23', 'Abril', 'Cabrera'], ['u24', 'Héctor', 'Villalba'],
    ['u25', 'Paula', 'Giménez'], ['u26', 'Ramiro', 'Ortiz'], ['u27', 'Elena', 'Robles'], ['u28', 'Diego', 'Carrizo']
  ];
  const strip = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const USERS = N.map(([id, n, a], i) => ({ id, nombre: n, apellido: a, full: n + ' ' + a, ini: n[0] + a[0], email: strip(n) + '.' + strip(a) + '@gmail.com', tono: TONOS[i % TONOS.length] }));

  const SEED = {
    depts: [
      { id: 'd1', nombre: 'Creativos', color: '#7c3aed', icon: 'palette', encargados: ['u1', 'u2'],
        prioridades: [
          { id: 'p1', nombre: 'Baja', color: 'rgba(0,0,0,.5)' }, { id: 'p2', nombre: 'Normal', color: '#2563eb' },
          { id: 'p3', nombre: 'Alta', color: '#c2410c' }, { id: 'p4', nombre: 'Urgente', color: '#dc2626' }] },
      { id: 'd2', nombre: 'Producción', color: '#c2410c', icon: 'mic', encargados: ['u18', 'u26'],
        prioridades: [
          { id: 'q1', nombre: 'Puede esperar', color: 'rgba(0,0,0,.5)' }, { id: 'q2', nombre: 'Para el domingo', color: '#b45309' },
          { id: 'q3', nombre: 'Urgente', color: '#dc2626' }] },
      { id: 'd3', nombre: 'Bienvenida', color: '#0f766e', icon: 'hands', encargados: ['u27', 'u25', 'u28', 'u6'], prioridades: [] }
    ],
    subs: [
      { id: 's1', dept: 'd1', nombre: 'Diseño', color: '#db2777', lider: 'u3', miembros: ['u1', 'u5', 'u7', 'u9'] },
      { id: 's2', dept: 'd1', nombre: 'Fotografía', color: '#b45309', lider: 'u4', miembros: ['u6', 'u8', 'u10'] },
      { id: 's3', dept: 'd1', nombre: 'Video', color: '#2563eb', lider: 'u11', miembros: ['u12', 'u13', 'u14', 'u24', 'u28'] },
      { id: 's4', dept: 'd1', nombre: 'Redes', color: '#15803d', lider: 'u15', miembros: ['u1', 'u16', 'u17'] },
      { id: 's5', dept: 'd2', nombre: 'Sonido', color: '#0e7490', lider: 'u19', miembros: ['u20', 'u21', 'u22'] },
      { id: 's6', dept: 'd2', nombre: 'Luces', color: '#4f46e5', lider: 'u1', miembros: ['u23', 'u24', 'u26'] },
      { id: 's7', dept: 'd3', nombre: 'Puerta', color: '#0f766e', lider: 'u27', miembros: ['u25', 'u28', 'u6'] },
      { id: 's8', dept: 'd3', nombre: 'Café', color: '#b45309', lider: 'u25', miembros: ['u27', 'u21'] },
      { id: 's9', dept: 'd3', nombre: 'Primera visita', color: '#db2777', lider: 'u28', miembros: ['u9', 'u5', 'u22', 'u20'] }
    ],
    folders: [
      { id: 'f1', dept: 'd1', nombre: 'Serie Noviembre', color: '#4f46e5', creada: '2026-10-05T10:14' },
      { id: 'f2', dept: 'd1', nombre: 'Nocturna 2026', color: '#c026d3', creada: '2026-09-18T19:40' },
      { id: 'f3', dept: 'd1', nombre: 'Navidad', color: '#15803d', creada: '2026-10-20T21:02' },
      { id: 'f4', dept: 'd2', nombre: 'Nocturna 2026', color: '#c026d3', creada: '2026-09-22T11:30' }
    ],
    tasks: [
      { id: 't1', dept: 'd1', sub: 's1', folder: 'f1', fecha: '2026-10-26', desde: '19:00', hasta: '20:30', prio: 'p2', estado: 'proceso', nombre: 'Reunión de planificación',
        detalles: 'Repasamos las piezas de la Serie Noviembre y repartimos lo que falta.\nTraigan bocetos aunque estén a medias.\n\nEs en la sala 2, arriba de la recepción.', creada: '2026-10-19T09:12', por: 'u1' },
      { id: 't2', dept: 'd1', sub: 's1', folder: 'f1', fecha: '2026-10-26', prio: 'p3', estado: 'proceso', nombre: 'Placas para la Serie Noviembre',
        detalles: 'Cuatro placas, una por domingo:\n· Portada de la serie\n· Versión historia (1080×1920)\n· Versión pantalla del auditorio (16:9)\n\nLos títulos de cada mensaje están en la carpeta compartida.', creada: '2026-10-20T18:40', por: 'u2' },
      { id: 't3', dept: 'd1', sub: 's2', folder: null, fecha: '2026-10-26', prio: 'p2', estado: 'completada', nombre: 'Selección de fotos del domingo',
        detalles: 'Elegir 30 fotos del servicio de las 11 y subirlas al álbum.', creada: '2026-10-25T13:05', por: 'u1', completo: { por: 'u8', at: '2026-10-26T11:20' } },
      { id: 't4', dept: 'd1', sub: 's3', folder: 'f2', fecha: '2026-10-27', desde: '10:00', hasta: '13:00', prio: 'p4', estado: 'proceso', nombre: 'Edición del video resumen Nocturna',
        detalles: 'Duración máxima 90 segundos. Música sin letra.\nSe pasa el viernes en el ensayo.', creada: '2026-10-21T20:15', por: 'u2' },
      { id: 't5', dept: 'd1', sub: 's4', folder: 'f1', fecha: '2026-10-27', prio: 'p2', estado: 'proceso', nombre: 'Calendario de publicaciones de noviembre',
        detalles: 'Armar la grilla de posteos del mes en la planilla de siempre.', creada: '2026-10-22T10:00', por: 'u1' },
      { id: 't6', dept: 'd1', sub: 's1', folder: 'f2', fecha: '2026-10-28', prio: 'p3', estado: 'proceso', nombre: 'Flyer Nocturna para escuelas',
        detalles: 'Versión A5 para imprimir y versión digital para WhatsApp.', creada: '2026-10-23T16:30', por: 'u2', solicitud: { por: 'u21', at: '2026-10-22T19:02' } },
      { id: 't7', dept: 'd1', sub: 's2', folder: 'f2', fecha: '2026-10-28', desde: '20:00', hasta: '22:00', prio: 'p2', estado: 'proceso', nombre: 'Fotos del ensayo general',
        detalles: 'Cubrir el ensayo de la banda y de los chicos de teatro.', creada: '2026-10-23T16:41', por: 'u2' },
      { id: 't8', dept: 'd1', sub: 's4', folder: 'f2', fecha: '2026-10-29', prio: 'p3', estado: 'proceso', nombre: 'Historias de cuenta regresiva Nocturna',
        detalles: 'Una historia por día hasta el viernes.', creada: '2026-10-24T09:00', por: 'u1' },
      { id: 't9', dept: 'd1', sub: null, folder: null, fecha: '2026-10-29', prio: 'p1', estado: 'espera', nombre: 'Logo para el grupo de Jóvenes',
        detalles: 'Quieren algo simple para remeras y redes. Pasan referencias por mensaje.', creada: '2026-10-25T21:10', por: 'u2', solicitud: { por: 'u20', at: '2026-10-24T18:30' } },
      { id: 't10', dept: 'd1', sub: 's3', folder: 'f1', fecha: '2026-10-30', desde: '18:00', hasta: '21:00', prio: 'p2', estado: 'proceso', nombre: 'Grabar testimonios',
        detalles: 'Tres testimonios de 2 minutos. Ya están confirmadas las personas.', creada: '2026-10-20T11:45', por: 'u1' },
      { id: 't11', dept: 'd1', sub: 's4', folder: null, fecha: '2026-10-31', prio: 'p2', estado: 'proceso', nombre: 'Reels del sábado',
        detalles: 'Dos reels cortos con lo mejor de la semana.', creada: '2026-10-24T15:20', por: 'u1' },
      { id: 't12', dept: 'd1', sub: 's2', folder: 'f2', fecha: '2026-10-31', desde: '19:00', hasta: '23:00', prio: 'p4', estado: 'proceso', nombre: 'Cobertura de fotos Nocturna',
        detalles: 'Dos fotógrafos en el salón y uno en la entrada.\nEntregar una selección el domingo a la mañana.', creada: '2026-10-18T10:30', por: 'u2' },
      { id: 't13', dept: 'd1', sub: 's1', folder: 'f1', fecha: '2026-11-01', desde: '09:00', hasta: '11:00', prio: 'p2', estado: 'proceso', nombre: 'Pantallas del servicio',
        detalles: 'Cargar las placas de anuncios antes del primer servicio.', creada: '2026-10-24T12:00', por: 'u1' },
      { id: 't14', dept: 'd1', sub: 's3', folder: null, fecha: '2026-10-26', desde: '15:00', hasta: '17:00', prio: 'p3', estado: 'completada', nombre: 'Video de anuncios del domingo',
        detalles: 'Grabar y editar los anuncios para el servicio.', creada: '2026-10-22T09:30', por: 'u2', completo: { por: 'u11', at: '2026-10-26T13:58' } },
      { id: 't15', dept: 'd1', sub: null, folder: 'f3', fecha: '2026-11-02', prio: 'p2', estado: 'espera', nombre: 'Banner web de Navidad',
        detalles: 'Para la página de inicio de la web, 1920×600.', creada: '2026-10-26T10:05', por: 'u1' },
      { id: 't16', dept: 'd1', sub: 's1', folder: 'f3', fecha: '2026-11-03', prio: 'p2', estado: 'proceso', nombre: 'Paleta y tipografías de Navidad',
        detalles: 'Proponer dos opciones para mostrar en la reunión del miércoles.', creada: '2026-10-21T17:00', por: 'u2' },
      { id: 't17', dept: 'd1', sub: 's2', folder: 'f3', fecha: '2026-11-04', desde: '17:00', hasta: '19:00', prio: 'p2', estado: 'proceso', nombre: 'Sesión de fotos para Navidad',
        detalles: 'Fotos de familias para la campaña. Lugar: auditorio.', creada: '2026-10-21T17:10', por: 'u2' },
      { id: 't18', dept: 'd1', sub: 's1', folder: 'f3', fecha: '2026-11-04', desde: '19:00', hasta: '20:30', prio: 'p2', estado: 'proceso', nombre: 'Reunión de planificación de Navidad',
        detalles: 'Definimos piezas, fechas y quién hace qué.', creada: '2026-10-21T17:12', por: 'u1' },
      { id: 't19', dept: 'd1', sub: 's3', folder: 'f3', fecha: '2026-11-05', prio: 'p3', estado: 'proceso', nombre: 'Teaser de Navidad',
        detalles: '30 segundos para redes y pantallas.', creada: '2026-10-22T08:50', por: 'u2' },
      { id: 't20', dept: 'd1', sub: 's4', folder: 'f1', fecha: '2026-11-02', prio: 'p2', estado: 'proceso', nombre: 'Posteos de la Serie Noviembre · semana 1',
        detalles: 'Usar las placas que arma Diseño.', creada: '2026-10-22T10:10', por: 'u1' },
      { id: 't21', dept: 'd1', sub: 's1', folder: null, fecha: '2026-11-06', desde: '19:00', hasta: '20:00', prio: 'p2', estado: 'proceso', nombre: 'Revisión de piezas con pastores',
        detalles: 'Mostrar todo lo de noviembre impreso.', creada: '2026-10-23T12:00', por: 'u2' },
      { id: 't22', dept: 'd1', sub: 's3', folder: null, fecha: '2026-10-28', prio: 'p1', estado: 'completada', nombre: 'Subtítulos del video de bautismos',
        detalles: 'Revisar nombres y fechas.', creada: '2026-10-19T19:00', por: 'u1', completo: { por: 'u13', at: '2026-10-25T22:10' } },
      { id: 't23', dept: 'd1', sub: 's4', folder: null, fecha: '2026-10-26', desde: '11:00', hasta: '12:00', prio: 'p2', estado: 'completada', nombre: 'Responder mensajes de la semana',
        detalles: 'Mensajes directos e Instagram.', creada: '2026-10-25T20:00', por: 'u1', completo: { por: 'u1', at: '2026-10-26T12:02' } },
      { id: 't30', dept: 'd2', sub: 's5', folder: 'f4', fecha: '2026-10-30', desde: '18:00', hasta: '20:00', prio: 'q3', estado: 'proceso', nombre: 'Prueba de sonido Nocturna',
        detalles: 'Banda completa + micrófonos de teatro.', creada: '2026-10-20T10:00', por: 'u18' },
      { id: 't31', dept: 'd2', sub: 's6', folder: 'f4', fecha: '2026-10-31', desde: '14:00', hasta: '18:00', prio: 'q2', estado: 'proceso', nombre: 'Armado de luces del escenario',
        detalles: 'Seguir el plano que está pegado en la cabina.\nLlevar alargues extra.', creada: '2026-10-20T10:20', por: 'u18' },
      { id: 't32', dept: 'd2', sub: 's5', folder: null, fecha: '2026-10-27', prio: 'q1', estado: 'completada', nombre: 'Revisar micrófonos inalámbricos',
        detalles: 'Cambiar pilas y probar los cuatro.', creada: '2026-10-19T09:00', por: 'u18', completo: { por: 'u20', at: '2026-10-25T17:30' } },
      { id: 't33', dept: 'd2', sub: 's6', folder: null, fecha: '2026-11-03', prio: 'q1', estado: 'proceso', nombre: 'Programar escenas de luces para Navidad',
        detalles: 'Cinco escenas para el especial.', creada: '2026-10-22T14:00', por: 'u26' },
      { id: 't34', dept: 'd2', sub: 's6', folder: null, fecha: '2026-10-29', desde: '10:00', hasta: '12:00', prio: 'q2', estado: 'proceso', nombre: 'Cambiar lámparas del hall',
        detalles: 'Hay repuestos en el depósito, estante 3.', creada: '2026-10-23T09:40', por: 'u18' },
      { id: 't35', dept: 'd2', sub: null, folder: null, fecha: '2026-11-05', prio: 'q1', estado: 'espera', nombre: 'Inventario de cables',
        detalles: 'Contar y etiquetar todo lo que hay en la cabina.', creada: '2026-10-24T11:00', por: 'u26' }
    ],
    solicitudes: [
      { id: 'r1', dept: 'd1', por: 'u24', at: '2026-10-26T12:10', prio: 'p3', estado: 'nueva',
        detalles: 'Necesitamos una placa para anunciar el almuerzo de adultos mayores del domingo 8 de noviembre, a las 13 h en el salón de abajo. Si se puede, que tenga letra grande porque muchos la van a ver impresa en la cartelera. También nos vendría bien una versión para mandar por WhatsApp a los grupos.' },
      { id: 'r2', dept: 'd1', por: 'u20', at: '2026-10-26T09:24', prio: 'p2', estado: 'nueva',
        detalles: 'Video corto (1 minuto) para presentar el nuevo grupo de matrimonios en el servicio del 15 de noviembre. Ya tenemos a dos parejas que quieren contar su experiencia.' },
      { id: 'r3', dept: 'd1', por: 'u22', at: '2026-10-25T21:40', prio: 'p4', estado: 'nueva',
        detalles: 'Fotos individuales de los 12 servidores nuevos de Bienvenida para las credenciales. Las necesitamos antes del viernes.' },
      { id: 'r4', dept: 'd1', por: 'u21', at: '2026-10-24T17:05', prio: 'p2', estado: 'aceptada',
        detalles: 'Diseño de los certificados del curso Crecer. Son 40 nombres; la lista la paso por email.\nEntrega: 20 de noviembre.' },
      { id: 'r5', dept: 'd2', por: 'u9', at: '2026-10-26T08:15', prio: 'q2', estado: 'nueva',
        detalles: 'Un micrófono extra para el coro de chicos este domingo.' }
    ]
  };

  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const pad = n => String(n).padStart(2, '0');
  const D = iso => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const addDays = (s, n) => { const d = D(s); d.setDate(d.getDate() + n); return iso(d); };
  const HOY = '2026-10-26', AHORA = '14:32';
  const diff = (a, b) => Math.round((D(a) - D(b)) / 864e5);
  const fmt = {
    dia: s => { const d = D(s); return cap(DIAS[d.getDay()]) + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; },
    diaLargo: s => { const d = D(s); return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()]; },
    lista: s => { const n = diff(s, HOY), d = D(s), base = DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()];
      return n === 0 ? 'Hoy · ' + base : n === 1 ? 'Mañana · ' + base : n === -1 ? 'Ayer · ' + base : cap(base); },
    corta: s => { const d = D(s); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear(); },
    ddmm: s => { const d = D(s); return pad(d.getDate()) + '/' + pad(d.getMonth() + 1); },
    stamp: s => fmt.corta(s) + ' a las ' + s.slice(11, 16),
    hace: s => { const dd = diff(HOY, s); const t = s.slice(11, 16);
      if (dd === 0) { const [h, m] = t.split(':').map(Number), [H, M] = AHORA.split(':').map(Number); const min = (H * 60 + M) - (h * 60 + m);
        return (min < 60 ? 'hace ' + min + ' min' : 'hace ' + Math.floor(min / 60) + ' h') + ' · ' + fmt.ddmm(s) + ' ' + t; }
      return (dd === 1 ? 'ayer' : 'hace ' + dd + ' días') + ' · ' + fmt.ddmm(s) + ' ' + t; },
    horario: t => t.desde ? t.desde + '–' + t.hasta : 'Todo el día',
    mesAnio: s => { const d = D(s); return cap(MESES[d.getMonth()]) + ' ' + d.getFullYear(); },
    registro: () => 'lunes 26/10/2026 · 14:32'
  };
  const tint = (c, a) => c.startsWith('#') ? c + (a || '1f') : 'rgba(0,0,0,.06)';
  const ink = c => c.startsWith('#') ? c : 'rgba(0,0,0,.62)';
  const clone = o => JSON.parse(JSON.stringify(o));
  const user = id => USERS.find(u => u.id === id);

  function resolve(db, t) {
    const dept = db.depts.find(d => d.id === t.dept);
    const sub = t.sub ? db.subs.find(s => s.id === t.sub) : null;
    const folder = t.folder ? db.folders.find(f => f.id === t.folder) : null;
    const prio = dept && dept.prioridades.find(p => p.id === t.prio);
    const gente = sub ? [sub.lider, ...sub.miembros.filter(m => m !== sub.lider)].map(user) : [];
    return { t, dept, sub, folder, prio, gente, color: sub ? sub.color : 'rgba(0,0,0,.3)', est: ESTADOS[t.estado] };
  }

  const S = {
    avatar: (u, size, ring) => 'width:' + size + 'px; height:' + size + 'px; flex:none; border-radius:999px; background:' + (u ? u.tono : '#f2f2f0') + '; color:rgba(0,0,0,.7); display:flex; align-items:center; justify-content:center; font:700 ' + Math.round(size * 0.36) + 'px Manrope,system-ui,sans-serif' + (ring ? '; box-shadow:0 0 0 2px #fff' : ''),
    chip: c => 'height:24px; padding:0 9px; border-radius:999px; background:' + tint(c) + '; display:inline-flex; align-items:center; gap:6px; font:700 11.5px Manrope,system-ui,sans-serif; white-space:nowrap; flex:none; color:rgba(0,0,0,.78)',
    dot: (c, s) => 'width:' + (s || 8) + 'px; height:' + (s || 8) + 'px; border-radius:999px; flex:none; background:' + c,
    estado: k => { const e = ESTADOS[k]; return 'height:24px; padding:0 10px 0 8px; border-radius:999px; background:' + e.bg + '; color:' + e.ink + '; display:inline-flex; align-items:center; gap:6px; font:700 11.5px Manrope,system-ui,sans-serif; white-space:nowrap; flex:none'; },
    tab: on => 'height:40px; padding:0 16px; border:0; border-radius:999px; flex:none; cursor:pointer; display:flex; align-items:center; gap:7px; font:600 13.5px Manrope,system-ui,sans-serif; white-space:nowrap; transition:background-color .15s,color .15s; ' + (on ? 'background:#0a0a0a; color:#fff' : 'background:#f2f2f0; color:rgba(0,0,0,.62)'),
    seg: on => 'height:36px; padding:0 14px; border:0; border-radius:999px; cursor:pointer; font:600 13px Manrope,system-ui,sans-serif; white-space:nowrap; flex:none; ' + (on ? 'background:#fff; color:#0a0a0a; box-shadow:0 1px 3px rgba(0,0,0,.1)' : 'background:transparent; color:rgba(0,0,0,.62)'),
    tool: on => 'height:30px; padding:0 12px; border:0; border-radius:999px; cursor:pointer; font:600 12px Manrope,system-ui,sans-serif; white-space:nowrap; ' + (on ? 'background:#0a0a0a; color:#fff' : 'background:transparent; color:rgba(0,0,0,.62)'),
    prim: dis => 'height:48px; padding:0 22px; border:0; border-radius:999px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:8px; font:700 14.5px Manrope,system-ui,sans-serif; white-space:nowrap; transition:opacity .15s; background:#0a0a0a; color:#fff' + (dis ? '; opacity:.32' : ''),
    input: err => 'width:100%; height:50px; padding:0 16px; border:0; border-radius:16px; background:#f6f6f4; font:600 15px Manrope,system-ui,sans-serif; color:#0a0a0a; box-shadow:' + (err ? 'inset 0 0 0 2px #b42318' : 'inset 0 0 0 1px rgba(0,0,0,.06)'),
    swatch: (c, on) => 'width:44px; height:44px; border-radius:999px; border:0; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center; color:#fff; background:' + c + '; box-shadow:' + (on ? '0 0 0 3px #fff, 0 0 0 5px ' + c : 'none'),
    pick: (c, on) => 'min-height:44px; padding:0 14px; border:0; border-radius:999px; cursor:pointer; display:inline-flex; align-items:center; gap:8px; font:700 13.5px Manrope,system-ui,sans-serif; ' + (on ? 'background:' + tint(c, '24') + '; color:#0a0a0a; box-shadow:inset 0 0 0 2px ' + (c.startsWith('#') ? c : 'rgba(0,0,0,.5)') : 'background:#f2f2f0; color:rgba(0,0,0,.62)'),
    iconCircle: (c, s) => 'width:' + s + 'px; height:' + s + 'px; flex:none; border-radius:999px; background:' + tint(c, '1f') + '; color:' + c + '; display:flex; align-items:center; justify-content:center',
    switch: on => 'width:48px; height:28px; flex:none; border-radius:999px; position:relative; transition:background-color .2s; background:' + (on ? '#0a0a0a' : 'rgba(0,0,0,.16)'),
    knob: on => 'position:absolute; top:3px; left:' + (on ? '23px' : '3px') + '; width:22px; height:22px; border-radius:999px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.2); transition:left .2s',
    rot: (open) => 'flex:none; transition:transform .2s; transform:rotate(' + (open ? '0' : '-90') + 'deg)'
  };

  // Hoja inferior (mobile) / modal centrado (tablet+). Devuelve estilos y manejadores de arrastre.
  function sheet(comp, key, mobile, opts) {
    opts = opts || {};
    const st = comp.state, dy = st._dragY || 0, w = opts.w || 520;
    const back = 'position:absolute; inset:0; z-index:80; background:rgba(10,10,10,' + (mobile ? '.36' : '.32') + '); animation:aoFade .18s ease both';
    const panel = mobile
      ? 'position:absolute; left:0; right:0; bottom:0; z-index:81; max-height:92%; display:flex; flex-direction:column; background:#fff; border-radius:28px 28px 0 0; box-shadow:0 -10px 40px rgba(0,0,0,.18); transform:translateY(' + dy + 'px); ' + (st._dragging ? '' : 'transition:transform .22s ease; ') + 'animation:aoUp .26s cubic-bezier(.2,.8,.2,1) both'
      : 'position:absolute; left:50%; top:50%; z-index:81; width:min(' + w + 'px, calc(100% - 48px)); max-height:calc(100% - 64px); display:flex; flex-direction:column; background:#fff; border-radius:28px; box-shadow:0 24px 60px rgba(0,0,0,.22); transform:translate(-50%,-50%); animation:aoPop .2s ease both';
    let y0 = null;
    return {
      back, panel,
      close: () => comp.setState({ [key]: null, _dragY: 0 }),
      down: e => { if (!mobile) return; y0 = e.clientY; e.currentTarget.setPointerCapture && e.currentTarget.setPointerCapture(e.pointerId); comp.setState({ _dragging: true }); },
      move: e => { if (y0 == null) return; comp.setState({ _dragY: Math.max(0, e.clientY - y0) }); },
      up: () => { if (y0 == null) return; y0 = null; const far = (comp.state._dragY || 0) > 110; comp.setState({ _dragging: false, _dragY: 0, ...(far ? { [key]: null } : {}) }); }
    };
  }

  function bp(w) { return { w, mobile: w < 600, tablet: w >= 600 && w < 1100, desk: w >= 1100, wide: w >= 1280 }; }
  const ANCHOS = [[390, 'Mobile 390'], [768, 'Tablet 768'], [1024, 'Tablet 1024'], [1280, 'Notebook 1280'], [1440, 'Desktop 1440']];

  function remember(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('ao:' + k) || 'null'); localStorage.setItem('ao:' + k, JSON.stringify(v)); } catch (e) { return null; } }

  function anchos(comp, reset) {
    const tool = S.tool;
    return ANCHOS.map(([w, t]) => ({ t, style: tool(comp.state.w === w), ir: () => comp.setState({ w, ...(reset || {}) }) }));
  }
  function frame(w) { const b = bp(w); return { frameW: w + 'px', frameH: b.mobile ? '844px' : (w < 1100 ? '960px' : '880px'), frameR: b.mobile ? '44px' : '18px' }; }
  function toast(comp, msg) { clearTimeout(comp._tt); comp.setState({ toast: msg }); comp._tt = setTimeout(() => comp.setState({ toast: null }), 2800); }
  function toastStyle(mobile) { return 'position:absolute; z-index:120; display:flex; align-items:center; gap:10px; padding:12px 16px; border-radius:18px; background:#0a0a0a; color:#fff; font:600 14px/1.4 Manrope,system-ui,sans-serif; box-shadow:0 10px 30px rgba(0,0,0,.25); animation:aoToast .22s ease both; ' + (mobile ? 'left:16px; right:16px; bottom:30px' : 'right:24px; top:24px; max-width:380px'); }
  function buscar(q, excl) { const k = strip(q || '').trim(); excl = excl || []; return USERS.filter(u => !excl.includes(u.id) && (!k || strip(u.full + ' ' + u.email).includes(k))).slice(0, 6); }

  // Selector de período (mismo patrón que Audiencia de Servicios): borrador + Aplicar.
  function period(comp, mobile, hasDay) {
    const st = comp.state, P = st.per, open = !!st.perOpen, dr = st.perDraft || P, base = st.perMonth || P.from.slice(0, 8) + '01';
    const mLbl = s => { const d = D(s); return d.getDate() + ' ' + MESES[d.getMonth()].slice(0, 3); };
    const lbl = p => mLbl(p.from) + ' – ' + mLbl(p.to) + ' ' + D(p.to).getFullYear();
    const month = start => {
      const m = D(start), gs = addDays(start, -((m.getDay() + 6) % 7)), cells = [];
      for (let i = 0; i < 42; i++) {
        const s = addDays(gs, i), d = D(s), inM = d.getMonth() === m.getMonth();
        if (i >= 35 && !inM) break;
        const a = dr.from, z = dr.to || dr.from, edge = s === a || s === z, inR = s > a && s < z;
        cells.push({ n: inM ? d.getDate() : '', aria: fmt.dia(s),
          style: 'position:relative; height:40px; border:0; padding:0; cursor:' + (inM ? 'pointer' : 'default') + '; display:flex; align-items:center; justify-content:center; font:700 13px Manrope,system-ui,sans-serif; border-radius:' + (edge ? '999px' : inR ? '0' : '999px') + '; ' +
            (!inM ? 'background:transparent; visibility:hidden' : edge ? 'background:#0a0a0a; color:#fff' : inR ? 'background:#f2f2f0; color:#0a0a0a' : 'background:transparent; color:' + (s === HOY ? '#dc2626' : '#0a0a0a')),
          dot: 'position:absolute; bottom:5px; width:4px; height:4px; border-radius:999px; background:' + (inM && hasDay && hasDay(s) ? (edge ? '#fff' : 'rgba(0,0,0,.45)') : 'transparent'),
          ir: () => { if (!inM) return; if (!dr.to || dr.to !== dr.from || st._perPicking !== true) comp.setState({ perDraft: { from: s, to: s }, _perPicking: true }); else comp.setState({ perDraft: s < dr.from ? { from: s, to: dr.from } : { from: dr.from, to: s }, _perPicking: false }); } });
      }
      return { titulo: cap(MESES[m.getMonth()]) + ' ' + m.getFullYear(), cells };
    };
    const nb = (s, n) => { const d = D(s); d.setMonth(d.getMonth() + n); return iso(d); };
    const ends = s => { const d = D(s); d.setMonth(d.getMonth() + 1); d.setDate(0); return iso(d); };
    const shortcuts = [
      ['Este mes', { from: '2026-10-01', to: '2026-10-31' }], ['Próximas 3 semanas', { from: '2026-10-19', to: '2026-11-15' }],
      ['Últimos 3 meses', { from: '2026-08-01', to: '2026-10-31' }], ['2026', { from: '2026-01-01', to: '2026-12-31' }], ['2025', { from: '2025-01-01', to: '2025-12-31' }]
    ];
    return {
      label: lbl(P), open, draftTxt: lbl({ from: dr.from, to: dr.to || dr.from }) + (st._perPicking ? ' · elegí el último día' : ''),
      toggle: () => comp.setState({ perOpen: !open, perDraft: P, perMonth: P.from.slice(0, 8) + '01', _perPicking: false }),
      close: () => comp.setState({ perOpen: false }),
      months: (mobile ? [base] : [base, nb(base, 1)]).map(month),
      prev: () => comp.setState({ perMonth: nb(base, -1) }), next: () => comp.setState({ perMonth: nb(base, 1) }),
      atajos: shortcuts.map(([t, p]) => ({ t, style: S.pick('#0a0a0a', dr.from === p.from && dr.to === p.to) + '; min-height:38px; font-size:12.5px', ir: () => comp.setState({ perDraft: p, perMonth: p.from.slice(0, 8) + '01', _perPicking: false }) })),
      aplicar: () => comp.setState({ per: { from: dr.from, to: dr.to || dr.from }, perOpen: false, _perPicking: false }),
      ends
    };
  }

  // Selector único de sección (reemplaza la fila de pastillas). Popover en desktop/tablet, hoja en mobile.
  function secMenu(comp, items, mobile, titulo) {
    const open = !!comp.state.secOpen, cur = items.find(i => i.on) || items[0];
    const other = items.filter(i => !i.on && i.badge).reduce((n, i) => n + i.badge, 0);
    return { open, pop: open && !mobile, sheet: open && mobile, titulo: titulo || 'Ir a', actual: cur.t, actualPath: I[cur.icon], hayBadge: other > 0, badge: String(other),
      toggle: () => comp.setState({ secOpen: !open, _dragY: 0 }), close: () => comp.setState({ secOpen: null }), sh: sheet(comp, 'secOpen', true),
      items: items.map(i => ({ t: i.t, desc: i.desc, path: I[i.icon], on: !!i.on, hayBadge: !!i.badge, badge: String(i.badge || ''),
        style: 'width:100%; min-height:58px; padding:8px 12px; border:0; border-radius:16px; cursor:pointer; display:flex; align-items:center; gap:12px; text-align:left; background:' + (i.on ? '#f2f2f0' : 'transparent'),
        ir: () => { comp.setState({ secOpen: null }); if (i.href) location.href = i.href; else if (i.go) i.go(); } })) };
  }

  window.AO = { secMenu, anchos, frame, toast, toastStyle, buscar, period, I, ICONOS_DEPTO, PALETA, ESTADOS, USERS, SEED, seed: () => clone(SEED), user, resolve, fmt, D, iso, addDays, diff, HOY, AHORA, DIAS, MESES, cap, tint, ink, S, sheet, bp, ANCHOS, remember, strip, YO: 'u1' };
})();

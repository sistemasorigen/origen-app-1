/**
 * Los movimientos de Nocturna.
 *
 * Todos animan sólo `transform` y `opacity`: son las dos propiedades que el
 * navegador resuelve en la placa de video sin volver a dibujar. Un Android de
 * gama media se traba con cualquier otra cosa, sobre todo con un desenfoque
 * que cambia: por eso la palabra de fondo NO anima su `blur`, sino que cruza
 * capas ya desenfocadas (ver Fondo.tsx).
 *
 * Con "reducir movimiento" todo se resuelve al instante y queda en su
 * estado final: las letras de los títulos aparecen enteras, el árbol no se
 * mueve y el confeti no existe.
 */
export const ANIMACIONES_CSS = `
@keyframes nocEntrada { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: none; } }
@keyframes nocLetra { from { opacity: 0; transform: translateY(.55em) scale(.85); } to { opacity: 1; transform: none; } }
@keyframes nocVaiven { 0%, 100% { transform: translateY(0) rotate(-1deg); } 50% { transform: translateY(-8px) rotate(1deg); } }
@keyframes nocChasquido { 0% { transform: rotate(-9deg) scale(1.1); } 60% { transform: rotate(1deg) scale(.98); } 100% { transform: rotate(-2deg) scale(1); } }
@keyframes nocSonrisa { 0% { transform: scale(0) rotate(-30deg); } 70% { transform: scale(1.15) rotate(8deg); } 100% { transform: scale(1) rotate(0); } }
@keyframes nocAviso { from { transform: translateY(30px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes nocFundido { from { opacity: 0; } to { opacity: 1; } }
@keyframes nocHoja { from { transform: translateY(40px); opacity: .4; } to { transform: none; opacity: 1; } }
@keyframes nocConfeti {
    0% { transform: translate3d(0, -40px, 0) rotate(0); opacity: 1; }
    80% { opacity: 1; }
    100% { transform: translate3d(var(--dx), var(--caida), 0) rotate(620deg); opacity: 0; }
}
@keyframes nocEncendido { 0% { transform: scale(.95); } 55% { transform: scale(1.04); } 100% { transform: none; } }
/* La espera sin porcentaje: la subida no informa cuánto lleva, así que la
   barra va y viene en vez de llenarse. */
@keyframes nocEspera { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }

@media (prefers-reduced-motion: reduce) {
    #nocturna-inscripcion *,
    #nocturna-inscripcion *::before,
    #nocturna-inscripcion *::after {
        animation-duration: .01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: .01ms !important;
    }
    #nocturna-inscripcion .noc-confeti { display: none !important; }
    /* La barra de espera queda quieta, a medio llenar: el texto de al lado
       ya dice que está subiendo. */
    #nocturna-inscripcion .noc-espera > span { animation: none !important; transform: none !important; width: 100%; opacity: .35; }
}
`;

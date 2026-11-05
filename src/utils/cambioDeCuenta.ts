/**
 * "Cambiar de cuenta": cerrar la sesión y caer directo en el login.
 *
 * El parámetro le dice a la pantalla de login de dónde se viene: sin splash, y
 * con el selector de cuentas de Google. Va en la ruta porque se tiene que poder
 * leer también después de volver atrás en esa misma pantalla.
 *
 * La marca cubre el rato del medio. Al perder la sesión en una pantalla
 * protegida, SinAcceso manda a /auth antes de que termine el cierre, sin el
 * parámetro, y en el celular asomaría el splash.
 */
export const RUTA_CAMBIO_DE_CUENTA = '/auth?ingresar=1';

const CLAVE = 'origen_cambiando_de_cuenta';

export const marcarCambioDeCuenta = (): void => {
    try { sessionStorage.setItem(CLAVE, '1'); } catch { /* sin storage: asoma el splash un instante */ }
};

export const hayCambioDeCuenta = (): boolean => {
    try { return sessionStorage.getItem(CLAVE) === '1'; } catch { return false; }
};

export const terminarCambioDeCuenta = (): void => {
    try { sessionStorage.removeItem(CLAVE); } catch { /* sin storage */ }
};

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { iniciarDiagnostico } from './src/utils/diagnostico';
import { escucharInstalacion } from './src/utils/instalacion';
import { registrarServiceWorker } from './src/utils/push';

// Antes de montar: el arranque queda anotado aunque React no llegue a
// dibujar nada, y el aviso de instalación de Chrome —que llega una sola vez y
// temprano— no se pierde por no haber nadie escuchando todavía.
iniciarDiagnostico();
escucharInstalacion();
// El service worker de las notificaciones push (public/sw.js). No cachea nada
// y no pide ningún permiso: el permiso se pide sólo cuando la persona toca
// "Activar". Si el registro falla, la app sigue igual.
registrarServiceWorker();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
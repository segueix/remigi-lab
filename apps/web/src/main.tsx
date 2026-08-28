import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

/*
 * Aquí el joc de producció hi tenia la migració de les claus velles
 * (`rummikub:*` → `remigi:*`). Al laboratori no hi és a posta: aquest clon
 * desa dins del seu propi espai de noms (`storage/namespace.ts`) i no ha
 * d'escriure mai a les claus del Remigi de debò, amb qui comparteix origen.
 */

/*
 * A l'app instal·lada, el gest d'enrere d'Android tancaria el joc a mitja
 * partida: es planta una entrada d'historial i es replanta a cada intent,
 * així el gest no fa res. Només a l'app (display-mode standalone): en una
 * pestanya normal l'enrere del navegador s'ha de respectar, i el gest de la
 * vora ja el frena l'overscroll-behavior del CSS.
 */
if (window.matchMedia('(display-mode: standalone)').matches) {
  try {
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', () => history.pushState(null, '', location.href));
  } catch {
    // Si l'historial no es deixa tocar, el joc funciona igual.
  }
}

const container = document.getElementById('root');
if (!container) throw new Error('No s’ha trobat l’element arrel de l’aplicació');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/*
 * El service worker només al build de producció: en desenvolupament només
 * faria nosa, servint fitxers desats en comptes dels que s'acaben de tocar.
 * Si el registre falla (navegador sense suport, servit per http...), el joc
 * funciona igual, només que sense connexió no s'obrirà.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => {
        /*
         * L'app instal·lada pot quedar-se oberta dies sense recarregar mai, i
         * llavors les correccions publicades no li arriben. Cada cop que s'hi
         * torna (canvi de visibilitat), es comprova si hi ha versió nova.
         */
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void registration.update();
        });
      })
      .catch((error) => {
        console.warn('No s’ha pogut registrar el service worker:', error);
      });

    /*
     * Quan una versió nova pren el control (el service worker fa skipWaiting i
     * claim), es recarrega la pàgina un sol cop per executar-la: la partida es
     * desa a cada moviment, així que es reprèn exactament on era. El primer
     * registre de la vida no recarrega: llavors no hi havia controlador.
     */
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      location.reload();
    });
  });
}

/*
 * Service worker del joc: serveix per poder jugar sense connexió.
 *
 * Dues estratègies diferents, perquè els dos tipus de fitxer tenen problemes
 * diferents:
 *
 * - La **pàgina** es demana sempre a la xarxa primer, i només si no hi ha
 *   connexió es fa servir l'última que es va desar. Així una versió nova del
 *   joc arriba de seguida i no es queda ningú amb una pàgina antiga.
 * - Els **fitxers de codi i estils** porten un nom amb empremta (canvia a cada
 *   build), així que servir-los de la memòria mai no dona contingut caducat:
 *   si el fitxer ha canviat, també n'ha canviat el nom.
 */

/*
 * La memòria cau és per **origen**, i aquest clon es publica al mateix origen
 * que el Remigi de producció: per això el laboratori té el seu prefix i, en
 * netejar generacions velles, només esborra les seves. Tocar la memòria cau
 * del joc de debò el deixaria sense poder obrir-se sense connexió.
 */
const CACHE_PREFIX = 'remigi-lab-';
const CACHE = `${CACHE_PREFIX}v1`;
const APP_SHELL = new URL('./index.html', self.registration.scope).toString();

self.addEventListener('install', () => {
  // La versió nova entra a manar de seguida, sense esperar que es tanquin
  // les pestanyes obertes.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE)
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE);
          await cache.put(APP_SHELL, response.clone());
          return response;
        } catch {
          const cached = await caches.match(APP_SHELL);
          if (cached) return cached;
          throw new Error('sense connexió i sense còpia desada');
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const fromNetwork = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached ?? fromNetwork;
    })(),
  );
});

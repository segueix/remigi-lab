import { expect, test } from '@playwright/test';

/**
 * El que ha de complir el build tal com es publica: rutes correctes sota
 * `/remigi/`, dades d'instal·lació com a aplicació, i funcionar sense
 * connexió un cop visitat. En aquest clon, l'entrada per defecte és el
 * laboratori (Remigi AI Lab); la partida humana continua a `#joc`.
 */

test('tots els fitxers pengen de la ruta publicada', async ({ page }) => {
  const fallits: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) fallits.push(`${response.status()} ${response.url()}`);
  });

  await page.goto('./');
  // L'app entra directament al laboratori.
  await expect(page.locator('.lab-motors')).toBeVisible();

  const src = await page.locator('script[type=module]').first().getAttribute('src');
  expect(src, 'el codi ha de penjar de /remigi/').toContain('/remigi/assets/');
  expect(fallits, fallits.join(' | ')).toHaveLength(0);
});

test('es pot instal·lar com a aplicació', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel=manifest]').getAttribute('href');
  expect(href).toBeTruthy();

  const manifestUrl = new URL(href!, page.url()).toString();
  const resposta = await request.get(manifestUrl);
  expect(resposta.ok()).toBe(true);

  const manifest = await resposta.json();
  expect(manifest.name).toBe('Remigi AI Lab');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

  // Les icones han d'existir de debò, no només estar declarades.
  for (const icona of manifest.icons) {
    const imatge = await request.get(new URL(icona.src, manifestUrl).toString());
    expect(imatge.ok(), `falta la icona ${icona.src}`).toBe(true);
    expect(imatge.headers()['content-type']).toContain('image/png');
  }
});

test('registra el service worker i funciona sense connexió', async ({ page, context }) => {
  await page.goto('./');
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
    timeout: 15_000,
  });

  // Es visita una vegada amb connexió perquè es desi tot...
  await expect(page.locator('.lab-motors')).toBeVisible();

  // ...i llavors es talla i el laboratori s'ha d'obrir igualment.
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.lab-motors')).toBeVisible();

  await context.setOffline(false);
});

import { expect, test, type Page } from '@playwright/test';

/**
 * El laboratori (Remigi AI Lab): la pantalla principal d'aquest clon. Les
 * proves fan el que faria un desenvolupador de motors: mirar una partida,
 * inspeccionar torns, executar un torneig i reproduir-ne una partida.
 */

async function obreLaboratori(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('.lab-motors')).toBeVisible();
}

/** Juga la partida en curs a màxima velocitat fins al final. */
async function jugaFinsAlFinal(page: Page): Promise<void> {
  await page.selectOption('[aria-label="Velocitat de reproducció"]', 'max');
  await page.getByRole('button', { name: 'Reprodueix la partida' }).click();
  await expect(page.locator('[data-prova="resultat"]')).toBeVisible({ timeout: 30_000 });
}

test('el laboratori és la pantalla principal, amb Motor A vs Motor B', async ({ page }) => {
  await obreLaboratori(page);

  // Les dues targetes amb el Campió i la referència d'entrada, i el VS al mig.
  await expect(page.getByRole('region', { name: 'Motor A' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Motor B' })).toBeVisible();
  await expect(page.locator('.lab-vs')).toHaveText('VS');
  await expect(page.locator('.motor-a .motor-rol')).toHaveText('Campió');
  // La referència no porta insígnia: no és campió ni challenger.
  await expect(page.locator('.motor-b .motor-rol')).toHaveCount(0);
  await expect(page.locator('.motor-a select')).toHaveValue('expert-v2');
  await expect(page.locator('.motor-b select')).toHaveValue('expert-v1');

  // Les dues mans es veuen senceres: 14 fitxes cadascuna, res d'amagat.
  await expect(page.locator('.lab-ma-a .tile')).toHaveCount(14);
  await expect(page.locator('.lab-ma-b .tile')).toHaveCount(14);

  // L'estat de la partida diu la llavor amb què es reproduirà.
  await expect(page.locator('[aria-label="Llavor de la partida"]')).toHaveValue('42');
});

test('pas a pas: cada «Següent jugada» avança exactament un torn', async ({ page }) => {
  await obreLaboratori(page);
  await expect(page.locator('.lab-estat')).toContainText('torn 1');
  await page.getByRole('button', { name: 'Següent jugada' }).click();
  await expect(page.locator('.lab-estat')).toContainText('torn 2');
  await page.getByRole('button', { name: 'Següent jugada' }).click();
  await expect(page.locator('.lab-estat')).toContainText('torn 3');
  // La fitxa de diagnòstic descriu l'última jugada.
  await expect(page.locator('.move-card')).toContainText('torn 2');
});

test('una partida sencera a màxima velocitat: guanyador, marcador i timeline', async ({
  page,
}) => {
  await obreLaboratori(page);
  await jugaFinsAlFinal(page);

  // El resultat diu qui guanya i els punts, i la victòria puja a la targeta.
  const resultat = page.locator('[data-prova="resultat"]');
  await expect(resultat).toContainText(/Guanya [AB]/);
  const victoriesA = await page.locator('.motor-a .motor-victories strong').textContent();
  const victoriesB = await page.locator('.motor-b .motor-victories strong').textContent();
  expect(Number(victoriesA) + Number(victoriesB)).toBe(1);

  // El dashboard de la partida té números de debò.
  await expect(page.locator('.lab-dashboard')).toContainText('Jeroglífics');
  const moviments = page.locator('.lab-dashboard tbody tr').first().locator('td');
  expect(Number(await moviments.first().textContent())).toBeGreaterThan(5);

  // La timeline és als detalls, amb un torn per fila, i inspeccionar rebobina.
  await page.getByRole('button', { name: 'Detalls', exact: true }).click();
  const files = page.locator('.lab-torn');
  expect(await files.count()).toBeGreaterThan(10);
  await files.nth(4).click();
  await expect(page.locator('.lab-inspeccio')).toContainText('Estàs inspeccionant');
  await page.getByRole('button', { name: 'Torna al directe' }).click();
  await expect(page.locator('.lab-inspeccio')).toHaveCount(0);
});

test('la mateixa llavor reprodueix exactament la mateixa partida', async ({ page }) => {
  await obreLaboratori(page);
  await jugaFinsAlFinal(page);
  const primera = await page.locator('[data-prova="resultat"]').textContent();

  await page.getByRole('button', { name: 'Reinicia' }).click();
  await expect(page.locator('.lab-estat')).toContainText('torn 1');
  await jugaFinsAlFinal(page);
  const segona = await page.locator('[data-prova="resultat"]').textContent();

  // Mateixa llavor, mateix guanyador, mateixos punts, mateixos torns.
  expect(segona).toBe(primera);
});

test('canviar un motor invalida el marcador i mostra les diferències', async ({ page }) => {
  await obreLaboratori(page);
  await jugaFinsAlFinal(page);

  await page.locator('.motor-b select').selectOption('advanced-v1');
  // Marcador de zero i partida nova preparada amb el motor nou.
  await expect(page.locator('.motor-a .motor-victories strong')).toHaveText('0');
  await expect(page.locator('.motor-b .motor-victories strong')).toHaveText('0');
  await expect(page.locator('.lab-estat')).toContainText('torn 1');

  await page.getByRole('button', { name: 'Detalls', exact: true }).click();
  const diferencies = page.locator('.lab-diferencies');
  await expect(diferencies).toContainText('nivell');
  await expect(diferencies).toContainText('rearrangesTable');
});

test('un torneig curt compta victòries i les partides interessants es reprodueixen', async ({
  page,
}) => {
  await obreLaboratori(page);

  await page.getByRole('button', { name: '10', exact: true }).click();
  await page.getByRole('button', { name: 'Executa el torneig' }).click();

  const marcador = page.locator('[data-prova="marcador-torneig"]');
  await expect(marcador).toBeVisible({ timeout: 60_000 });
  const winsA = Number(await marcador.getAttribute('data-wins-a'));
  const winsB = Number(await marcador.getAttribute('data-wins-b'));
  expect(winsA + winsB).toBe(10);

  // El dashboard passa a l'últim torneig, amb les mètriques comparatives.
  await expect(page.locator('.lab-dashboard')).toContainText('% victòries');
  await expect(page.locator('.lab-dashboard')).toContainText('Jeroglífics/partida');

  // Reproduir una partida interessant carrega la seva llavor a la taula.
  const primera = page.locator('.lab-interessants li').first();
  const descripcio = (await primera.textContent()) ?? '';
  const llavor = /llavor (\d+)/.exec(descripcio)![1];
  await primera.getByRole('button', { name: 'Reprodueix' }).click();
  await expect(page.locator('[aria-label="Llavor de la partida"]')).toHaveValue(llavor);
  await expect(page.locator('.lab-estat')).toContainText('torn 1');

  // I la partida reproduïda es pot veure sencera.
  await jugaFinsAlFinal(page);
});

test('l’informe del torneig s’exporta com a AI_REPORT.md', async ({ page }) => {
  await obreLaboratori(page);
  await page.getByRole('button', { name: '10', exact: true }).click();
  await page.getByRole('button', { name: 'Executa el torneig' }).click();
  await expect(page.locator('[data-prova="marcador-torneig"]')).toBeVisible({ timeout: 60_000 });

  const baixada = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporta AI_REPORT.md' }).click();
  expect((await baixada).suggestedFilename()).toBe('AI_REPORT.md');
});

test('la partida humana continua viva a #joc, i s’hi va i es torna', async ({ page }) => {
  await obreLaboratori(page);
  await page.getByRole('button', { name: 'Partida humana' }).click();

  // El joc de sempre: faristol amb fitxes i el teu jugador.
  await expect(page.locator('.rack .tile').first()).toBeVisible();

  // I des del menú del jugador es torna al laboratori.
  await page.getByRole('button', { name: 'El teu jugador' }).click();
  await page.getByRole('button', { name: 'Laboratori de motors' }).click();
  await expect(page.locator('.lab-motors')).toBeVisible();
});

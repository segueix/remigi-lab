import { expect, test } from '@playwright/test';
import { baixaGrup, entraAmbPartida, f, obreMenu } from './ajudants';

/**
 * El repàs de després de la partida: robar havent-hi jugada queda apuntat, el
 * final ho diu, i el quiz torna a posar aquella taula i aquell faristol perquè
 * la jugada la trobis tu (o te l'ensenyi, sobre el mateix tauler).
 *
 * La partida preparada dona al jugador tres ocasions de robar amb el grup de
 * nous a la mà: la segona és el mateix error (no s'apunta) i la tercera és més
 * grossa (mentrestant ha robat el quart nou), així que el repàs en té DUES.
 * El bot no pot jugar mai, i quan el sac s'acaba la partida queda bloquejada.
 */
test('robar havent-hi jugada acaba en quiz sobre el mateix tauler', async ({ page }) => {
  await entraAmbPartida(page, {
    rack: [f('red', 9), f('blue', 9), f('black', 9), f('orange', 13)],
    board: [],
    haObert: true,
    // Per ordre de robar: el jugador, el bot, i el quart nou per al jugador.
    sac: [f('black', 2, 'b'), f('blue', 13, 'b'), f('orange', 9)],
  });

  const roba = page.getByRole('button', { name: 'Robar fitxa' });
  const misses = () =>
    page.evaluate(() => {
      const saved = localStorage.getItem('remigi-lab:game');
      return saved ? (JSON.parse(saved).misses?.length ?? 0) : -1;
    });

  // Primer torn: robar tot i tenir el grup de nous és la primera oportunitat,
  // i queda desada amb la partida, per si es tanca la pestanya a mitges.
  await roba.click();
  await expect.poll(misses).toBe(1);

  // Segon torn: el mateix error exacte NO s'apunta una altra vegada.
  await expect(roba).toBeEnabled();
  await roba.click();
  await expect.poll(() => page.locator('.rack .tile').count()).toBe(6);
  await expect.poll(misses).toBe(1);

  // Tercer torn: ara el quart nou és a la mà, l'error ha crescut i sí que
  // s'apunta. El sac és buit: passar bloqueja la partida i s'acaba.
  const passa = page.getByRole('button', { name: 'Passar torn' });
  await expect(passa).toBeEnabled();
  await passa.click();

  // El final ofereix el repàs comptant errors diferents, no torns robats.
  const crida = page.locator('.quiz-crida');
  await expect(crida).toContainText('n’han sortit 2 jeroglífics');
  await page.getByRole('button', { name: 'Fes els jeroglífics' }).click();

  // Oportunitat 1: la taula i el faristol tornen a ser els d'aquell moment,
  // el quiz diu quantes fitxes baixava la jugada i les marca al faristol.
  await expect(page.locator('.quiz-cap')).toContainText('Jeroglífic 1 de 2');
  await expect(page.locator('.quiz-cap')).toContainText('al torn 5');
  await expect(page.locator('.quiz .rack .tile')).toHaveCount(4);
  await expect(page.locator('.quiz .board .meld')).toHaveCount(0);
  await expect(page.locator('.hint')).toContainText('baixava 3 fitxes');
  await expect(page.locator('.hint')).toContainText('queden 3 per col·locar');
  await expect(page.locator('.quiz .rack .tile.played')).toHaveCount(3);

  // El comptador baixa a mesura que es col·loquen les marcades…
  await page.locator('.rack .tile[aria-label^="9 vermell"]').click();
  await page.getByRole('button', { name: '+ Jugada nova' }).click();
  await expect(page.locator('.hint')).toContainText('queden 2 per col·locar');

  // …desfer torna el pas enrere i refer el recupera.
  await page.getByRole('button', { name: 'Desfés' }).click();
  await expect(page.locator('.hint')).toContainText('queden 3 per col·locar');
  await expect(page.locator('.quiz .board .meld')).toHaveCount(0);
  await page.getByRole('button', { name: 'Refés' }).click();
  await expect(page.locator('.hint')).toContainText('queden 2 per col·locar');
  await expect(page.locator('.quiz .board .meld .tile')).toHaveCount(1);

  // Una jugada a mitges rep l'error del motor, com a la partida.
  await page.locator('.rack .tile[aria-label^="9 blau"]').click();
  await page.locator('.board .meld').first().click();
  await page.getByRole('button', { name: 'Comprova la jugada' }).click();
  await expect(page.locator('.error')).toContainText('com a mínim 3');

  // Completada i comprovada: cada fitxa al seu lloc, amb el marc verd.
  await page.locator('.rack .tile[aria-label^="9 negre"]').click();
  await page.locator('.board .meld').first().click();
  await page.getByRole('button', { name: 'Comprova la jugada' }).click();
  // El gran símbol verd de correcte, al mig de la pantalla.
  await expect(page.locator('.quiz-encert')).toBeVisible();
  await expect(page.locator('.hint-be')).toContainText('Perfecte!');
  await expect(page.locator('.quiz .board .tile.correct')).toHaveCount(3);
  await expect(page.locator('.quiz .board .tile.wrong')).toHaveCount(0);

  // Oportunitat 2 (el grup de quatre): es baixa només el de tres — vàlid,
  // però no és la millor jugada. La correcció ho diu, marca les tres en
  // vermell i el que faltava, i «Corregeix» deixa refer-ho fins al verd.
  await page.getByRole('button', { name: 'Següent' }).click();
  await expect(page.locator('.quiz-cap')).toContainText('Jeroglífic 2 de 2');
  await expect(page.locator('.quiz-cap')).toContainText('al torn 9');
  await expect(page.locator('.quiz .rack .tile')).toHaveCount(6);
  await expect(page.locator('.hint')).toContainText('baixava 4 fitxes');
  await expect(page.locator('.quiz .rack .tile.played')).toHaveCount(4);

  await page.locator('.rack .tile[aria-label^="9 vermell"]').click();
  await page.getByRole('button', { name: '+ Jugada nova' }).click();
  await page.locator('.rack .tile[aria-label^="9 blau"]').click();
  await page.locator('.board .meld').first().click();
  await page.locator('.rack .tile[aria-label^="9 negre"]').click();
  await page.locator('.board .meld').first().click();
  await page.getByRole('button', { name: 'Comprova la jugada' }).click();
  await expect(page.locator('.hint-be')).toContainText('Jugada vàlida');
  await expect(page.locator('.hint-be')).toContainText('3 en un altre lloc');
  await expect(page.locator('.hint-be')).toContainText('quedaven 1 per baixar');
  await expect(page.locator('.quiz .board .tile.wrong')).toHaveCount(3);
  await expect(page.locator('.quiz .board .tile.correct')).toHaveCount(0);

  await page.getByRole('button', { name: 'Corregeix' }).click();
  await page.locator('.rack .tile[aria-label^="9 taronja"]').click();
  await page.locator('.board .meld').first().click();
  await page.getByRole('button', { name: 'Comprova la jugada' }).click();
  await expect(page.locator('.hint-be')).toContainText('Perfecte!');
  await expect(page.locator('.quiz .board .tile.correct')).toHaveCount(4);

  // El resum: totes dues trobades (corregir no la compta dos cops).
  await page.getByRole('button', { name: 'Acaba els jeroglífics' }).click();
  await expect(page.locator('.quiz-final')).toContainText('N’has resolt 2 de 2');
  await page.getByRole('button', { name: 'Torna al resum' }).click();
  await expect(page.getByRole('button', { name: 'Una altra partida' })).toBeVisible();
  await expect(crida).toBeVisible();
});

/**
 * Quan la jugada que hi havia demanava desfer una jugada de la taula, el marc
 * ho diu: turquesa per a les fitxes que venien del faristol i daurat per a les
 * de la taula que es recol·locaven. Aquí l'escala vermella 7-8-9 s'ha de
 * desfer per fer el grup de sets i l'escala 8-9-10-11.
 */
test('la solució distingeix amb marcs les teves fitxes de les recol·locades', async ({ page }) => {
  await entraAmbPartida(page, {
    rack: [f('blue', 7), f('black', 7), f('red', 10), f('red', 11)],
    board: [[f('red', 7), f('red', 8), f('red', 9)]],
    haObert: true,
  });

  await page.getByRole('button', { name: 'Robar fitxa' }).click();
  const passa = page.getByRole('button', { name: 'Passar torn' });
  await expect(passa).toBeEnabled();
  await passa.click();

  await expect(page.locator('.quiz-crida')).toContainText('n’ha sortit 1 jeroglífic');
  await page.getByRole('button', { name: 'Fes els jeroglífics' }).click();

  // Mentre proves, només les teves fitxes van marcades: la pista de la
  // recol·locació la diu el text, i les fitxes de la taula queden netes
  // (dins de la partida els marcs de taula volen dir altres coses).
  await expect(page.locator('.hint')).toContainText('baixava 4 fitxes');
  await expect(page.locator('.hint')).toContainText('recol·locar');
  await expect(page.locator('.quiz .rack .tile.played')).toHaveCount(4);
  await expect(page.locator('.quiz .board .tile.moved')).toHaveCount(0);
  await expect(page.locator('.quiz .board .tile.played')).toHaveCount(0);

  await page.getByRole('button', { name: 'Mostra la solució' }).click();

  await expect(page.locator('.quiz .board .meld')).toHaveCount(2);
  await expect(page.locator('.quiz .board .tile.played')).toHaveCount(4);
  await expect(page.locator('.quiz .board .tile.moved')).toHaveCount(3);
  await expect(page.locator('.hint-be')).toContainText(
    'recol·locant les 3 de marc daurat que ja eren a la taula',
  );
});

/**
 * L'altra cara: si no t'has deixat cap jugada, el final ho diu i no hi ha quiz.
 * Guanyar baixant l'única jugada possible no en deixa cap per repassar.
 */
test('sense oportunitats perdudes no hi ha quiz, i es felicita', async ({ page }) => {
  await entraAmbPartida(page, {
    rack: [f('red', 9), f('blue', 9), f('black', 9)],
    board: [],
    haObert: true,
  });

  await baixaGrup(page, ['9 vermell', '9 blau', '9 negre']);
  await page.getByRole('button', { name: 'Acabar jugada' }).click();

  await expect(page.locator('.quiz-crida-neta')).toContainText('No se t’ha escapat cap jugada');
  await expect(page.locator('.quiz-crida')).toHaveCount(0);
});

/**
 * La col·lecció: els jeroglífics de totes les partides es guarden, i quan n'hi
 * ha prou el menú del jugador ofereix triar entre jugar o fer jeroglífics —
 * en qualsevol moment, no cal esperar el final de la partida.
 */
test('amb prou jeroglífics guardats, el menú ofereix jugar-los', async ({ page }) => {
  const jero = (value: number) => ({
    turn: value,
    board: [],
    rack: [f('red', value), f('blue', value), f('black', value)],
    hasOpened: true,
    solution: [[f('red', value), f('blue', value), f('black', value)]],
    tilesUsed: 3,
  });
  await entraAmbPartida(page, {
    rack: [f('orange', 13)],
    haObert: true,
    jeroglifics: [jero(4), jero(5), jero(6)],
  });

  await obreMenu(page);
  await page.getByRole('button', { name: 'Jeroglífics (3)' }).click();

  // S'obre el primer de la col·lecció, sobre el tauler de sempre.
  await expect(page.locator('.quiz-cap')).toContainText('Jeroglífic 1 de 3');
  await expect(page.locator('.quiz .rack .tile.played')).toHaveCount(3);

  // I sortir-ne torna a la partida, que continuava allà mateix.
  await page.getByRole('button', { name: 'Surt dels jeroglífics' }).click();
  await expect(page.locator('.rack .tile[aria-label="13 taronja"]')).toBeVisible();
});

/**
 * Una resposta diferent de la programada però igual de bona val igual: la
 * millor jugada era l'escala sencera del 5 al 10, i partir-la en dues escales
 * de tres és legal i baixa les mateixes sis fitxes. Res de marcs vermells.
 */
test('una resposta correcta per un altre camí també és perfecta', async ({ page }) => {
  await entraAmbPartida(page, {
    rack: [f('red', 5), f('red', 6), f('red', 7), f('red', 8), f('red', 9), f('red', 10)],
    board: [],
    haObert: true,
  });

  await page.getByRole('button', { name: 'Robar fitxa' }).click();
  const passa = page.getByRole('button', { name: 'Passar torn' });
  await expect(passa).toBeEnabled();
  await passa.click();

  await page.getByRole('button', { name: 'Fes els jeroglífics' }).click();
  await expect(page.locator('.hint')).toContainText('baixava 6 fitxes');

  // Dues escales de tres, en comptes de l'escala de sis de la solució.
  for (const [value, dest] of [[5, 'nova'], [6, 0], [7, 0], [8, 'nova'], [9, 1], [10, 1]] as const) {
    await page.locator(`.rack .tile[aria-label^="${value} vermell"]`).click();
    if (dest === 'nova') await page.getByRole('button', { name: '+ Jugada nova' }).click();
    else await page.locator('.board .meld').nth(dest).click();
  }
  await page.getByRole('button', { name: 'Comprova la jugada' }).click();

  await expect(page.locator('.quiz-encert')).toBeVisible();
  await expect(page.locator('.hint-be')).toContainText('Perfecte!');
  await expect(page.locator('.hint-be')).toContainText('un altre camí igual de bo');
  await expect(page.locator('.quiz .board .tile.correct')).toHaveCount(6);
  await expect(page.locator('.quiz .board .tile.wrong')).toHaveCount(0);
  // Resolt de debò: només queda passar al següent (aquí, acabar).
  await expect(page.getByRole('button', { name: 'Corregeix' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mostra la solució' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Acaba els jeroglífics' }).click();
  await expect(page.locator('.quiz-final')).toContainText('N’has resolt 1 de 1');
});

import { expect, type Page } from '@playwright/test';

export const PROFILE_KEY = 'remigi:profile:local';

/** Obre el menú del jugador (tocar la teva targeta, a dalt). */
export async function obreMenu(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'El teu jugador' }).click();
  await expect(page.locator('.menu-usuari')).toBeVisible();
}

/** Tanca el menú tocant fora. */
export async function tancaMenu(page: Page): Promise<void> {
  await page.locator('.menu-fons').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.menu-usuari')).toHaveCount(0);
}

/**
 * Entra al joc amb un perfil net: l'app reparteix una partida directament, i
 * el nom es posa pel menú del jugador (la pantalla d'inici ja no existeix).
 * En aquest clon la pantalla principal és el laboratori (Remigi AI Lab); la
 * partida humana viu a `#joc`, i és on entren totes les proves del joc.
 */
export async function comencaDeZero(page: Page, nom = 'Daniel'): Promise<void> {
  /*
   * L'emmagatzematge es neteja ABANS que l'app arrenqui: com que ara reparteix
   * una partida només arribar i la desa a cada moviment, esborrar després de
   * carregar era una cursa contra els bots. El senyal evita que una recàrrega
   * posterior de la mateixa prova ho torni a esborrar.
   */
  await page.addInitScript(() => {
    if (localStorage.getItem('e2e:net')) return;
    localStorage.clear();
    localStorage.setItem('e2e:net', '1');
  });
  await page.goto('./#joc');
  await expect(page.locator('.rack .tile').first()).toBeVisible();
  if (nom !== 'Jugador') {
    await obreMenu(page);
    await page.getByLabel('El teu nom').fill(nom);
    await page.getByRole('button', { name: 'Desa el nom' }).click();
    await tancaMenu(page);
  }
}

/** Comença una partida nova contra tants oponents, des del menú del jugador. */
export async function jugaContra(page: Page, oponents: 1 | 2 | 3): Promise<void> {
  await obreMenu(page);
  await page.getByRole('button', { name: String(oponents), exact: true }).click();
  await page.getByRole('button', { name: 'Partida nova' }).click();
  await expect(page.locator('.menu-usuari')).toHaveCount(0);
  await expect(page.locator('.player')).toHaveCount(oponents + 1);
  await expect(page.locator('.rack .tile').first()).toBeVisible();
}

const finalPartida = (page: Page) => page.getByRole('button', { name: 'Una altra partida' });

/**
 * Porta la partida fins al final robant a cada torn. No mira de jugar bé: el
 * que es comprova és que una partida sencera acaba sense petar.
 */
export async function robaFinsAlFinal(page: Page, maxTorns = 400): Promise<boolean> {
  for (let i = 0; i < maxTorns; i++) {
    if (await finalPartida(page).isVisible().catch(() => false)) return true;
    const roba = page.getByRole('button', { name: /Robar fitxa|Passar torn/ });
    if (await roba.isEnabled().catch(() => false)) await roba.click();
    await page.waitForTimeout(20);
  }
  return finalPartida(page).isVisible();
}

/**
 * Roba fins que hi hagi jugades a la taula. Com que el jugador no fa res més que
 * robar, tot el que hi aparegui l'hi han posat els bots.
 */
export async function robaFinsQueUnBotJugui(page: Page, maxTorns = 40): Promise<boolean> {
  for (let i = 0; i < maxTorns; i++) {
    if ((await page.locator('.board .meld').count()) > 0) break;
    if (await finalPartida(page).isVisible().catch(() => false)) break;
    const roba = page.getByRole('button', { name: /Robar fitxa|Passar torn/ });
    if (await roba.isEnabled().catch(() => false)) await roba.click();
    await page.waitForTimeout(40);
  }
  if ((await page.locator('.board .meld').count()) === 0) return false;
  // Els bots poden estar jugant encara: cal esperar el torn per poder tocar res.
  await expect(page.getByRole('button', { name: /Robar fitxa|Passar torn/ })).toBeEnabled();
  return true;
}

/** Baixa un grup a la taula com a jugada nova. */
export async function baixaGrup(page: Page, fitxes: string[]): Promise<void> {
  await page.locator(`.rack .tile[aria-label="${fitxes[0]}"]`).first().click();
  await page.getByRole('button', { name: '+ Jugada nova' }).click();
  for (const fitxa of fitxes.slice(1)) {
    await page.locator(`.rack .tile[aria-label="${fitxa}"]`).first().click();
    await page.locator('.board .meld').last().click();
  }
}

/* ---------- Partides preparades ---------- */

type Fitxa = { id: string; kind: 'number'; color: string; value: number };

/** Fitxa amb l'identificador que fa servir el motor. */
export function f(color: string, value: number, copia: 'a' | 'b' = 'a'): Fitxa {
  return { id: `${color}-${value}-${copia}`, kind: 'number', color, value };
}

/**
 * Entra a una partida amb una mà i una taula concretes.
 *
 * Deixar-ho a l'atzar faria que segons quines proves no es poguessin fer (una
 * mà de 14 fitxes pot no tenir cap jugada possible), i una prova que es salta
 * sola no garanteix res. S'aprofita el mateix camí que fa servir el joc per
 * continuar una partida a mitges, així que no cal cap porta del darrere: el que
 * es prepara ha de passar la mateixa validació que qualsevol partida desada.
 */
export async function entraAmbPartida(
  page: import('@playwright/test').Page,
  partida: {
    rack: Fitxa[];
    board?: Fitxa[][];
    haObert?: boolean;
    autors?: [string, number][];
    /** Fitxes del sac, en ordre de robar. Per defecte, una de sola. */
    sac?: Fitxa[];
    /** Col·lecció de jeroglífics ja guardada, per provar el menú. */
    jeroglifics?: unknown[];
  },
): Promise<void> {
  // La partida s'injecta abans que l'app arrenqui (vegeu `comencaDeZero`).
  await page.addInitScript(
    ([dades]) => {
      if (localStorage.getItem('e2e:llavor')) return;
      localStorage.clear();
      localStorage.setItem('e2e:llavor', '1');
      if (dades.jeroglifics.length > 0) {
        localStorage.setItem('remigi:jeroglifics', JSON.stringify(dades.jeroglifics));
      }
      localStorage.setItem(
        'remigi:profile:local',
        JSON.stringify({
          id: 'local',
          name: 'Daniel',
          rating: 1100,
          gamesPlayed: 0,
          wins: 0,
          history: [],
        }),
      );
      localStorage.setItem(
        'remigi:game',
        JSON.stringify({
          setup: { playerName: 'Daniel', opponents: ['easy'] },
          owners: dades.autors,
          game: {
            seed: 1,
            bag: dades.sac,
            board: dades.board,
            players: [
              { id: 'p1', name: 'Daniel', kind: 'human', rack: dades.rack, hasOpened: dades.haObert },
              {
                id: 'p2',
                name: 'Bot 1',
                kind: 'ai',
                aiLevel: 'easy',
                rack: [{ id: 'orange-1-b', kind: 'number', color: 'orange', value: 1 }],
                hasOpened: true,
              },
            ],
            currentPlayer: 0,
            turn: 5,
            consecutivePasses: 0,
            status: 'playing',
          },
        }),
      );
    },
    [
      {
        rack: partida.rack,
        board: partida.board ?? [],
        haObert: partida.haObert ?? false,
        autors: partida.autors ?? [],
        sac: partida.sac ?? [{ id: 'black-1-b', kind: 'number', color: 'black', value: 1 }],
        jeroglifics: partida.jeroglifics ?? [],
      },
    ],
  );
  /*
   * L'app entra directament a la partida desada: no cal cap clic. La
   * recàrrega és necessària: si la prova ja era a `./#joc`, tornar-hi amb
   * `goto` és una navegació de fragment (mateix document) i l'script
   * d'injecció no s'executaria — la partida preparada no entraria mai.
   */
  await page.goto('./#joc');
  await page.reload();
  await expect(page.locator('.rack .tile').first()).toBeVisible();
}

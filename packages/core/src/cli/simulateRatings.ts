/**
 * Compara els punts intermedis contra els dos extrems, alternant qui comença.
 * Executar des de l'arrel: node --import tsx packages/core/src/cli/simulateRatings.ts 80
 * Les proporcions són mesures, no probabilitats garantides per l'Elo.
 */
import { createEngine, createGame, applyMove, TOTAL_TILES } from '../engine';

const games = Number(process.argv[2] ?? 80);
if (!Number.isInteger(games) || games < 2 || games > 10000) {
  throw new Error('Cal indicar entre 2 i 10000 partides per comparació.');
}
for (const rating of [900, 1100, 1300, 1500]) {
  for (const rival of [rating - 100, rating + 100]) {
    let wins = 0;
    for (let trial = 0; trial < games; trial++) {
      const measured = trial % 2;
      let game = createGame({ seed: 100 + trial, players: [
        { name: 'A', kind: 'ai' }, { name: 'B', kind: 'ai' },
      ] });
      const engine = createEngine({ seed: 1000 + trial });
      while (game.status === 'playing' && game.turn < 1000) {
        game = applyMove(game, engine.play(game, {
          rating: game.currentPlayer === measured ? rating : rival,
        }).move);
        const tiles = [...game.bag, ...game.board.flat(), ...game.players.flatMap((p) => p.rack)];
        if (tiles.length !== TOTAL_TILES || new Set(tiles.map((t) => t.id)).size !== TOTAL_TILES) {
          throw new Error('La simulació ha perdut o duplicat fitxes.');
        }
      }
      if (game.status !== 'finished') throw new Error('La partida no ha acabat en 1000 torns.');
      wins += Number(game.winnerId === game.players[measured].id);
    }
    console.log(`${rating} contra ${rival}: ${wins}/${games} victòries (${(100 * wins / games).toFixed(1)}%)`);
  }
}

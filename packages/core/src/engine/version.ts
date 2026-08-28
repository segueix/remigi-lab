/**
 * Versió del motor Remigi (semàntica: MAJOR.MINOR.PATCH), independent de la
 * versió del paquet npm. És la que surt a cada decisió (`engineVersion`), a
 * l'artefacte `dist/remigi-engine.js` i al simulador, perquè sempre es pugui
 * dir quina versió del motor ha jugat una partida o produït una simulació.
 *
 * Es puja a mà: MAJOR si canvia l'API pública del motor, MINOR si la IA juga
 * diferent (més fort o més fluix), PATCH per a correccions que no canvien cap
 * decisió.
 */
export const ENGINE_VERSION = '1.1.0';

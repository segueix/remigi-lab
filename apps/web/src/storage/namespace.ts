/**
 * L'espai de noms del laboratori al navegador.
 *
 * Publicat, aquest clon viu al **mateix origen** que el Remigi de producció
 * (tots dos pengen de `segueix.github.io`, només canvia la ruta). I
 * `localStorage` és per **origen**, no per ruta: amb les claus de sempre
 * (`remigi:game`, `remigi:profile:local`…), jugar la partida humana del
 * laboratori sobreescriuria el perfil i la partida a mitges del joc de debò.
 *
 * Per això tot el que el laboratori desa al navegador porta el seu propi
 * prefix. Les dades del joc de producció queden intactes, i les dues coses es
 * poden tenir obertes alhora sense trepitjar-se.
 */
export const LAB_NAMESPACE = 'remigi-lab:';

/**
 * La clau equivalent dins de l'espai de noms del laboratori. Les claus que
 * venen del motor amb el prefix `remigi:` (el perfil, per exemple) el
 * bescanvien pel del laboratori, de manera que no se n'acumulen dos.
 */
export function labKey(key: string): string {
  const bare = key.startsWith('remigi:') ? key.slice('remigi:'.length) : key;
  return LAB_NAMESPACE + bare;
}

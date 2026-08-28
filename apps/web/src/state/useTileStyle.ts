import { useCallback, useState } from 'react';
import { labKey } from '../storage/namespace';

/**
 * L'aspecte de les fitxes: del color amb el número i la forma en blanc (el
 * predeterminat), o crema amb el número i la forma del color (les
 * clàssiques). És una preferència visual del dispositiu, així que viu a
 * localStorage i no al perfil; si l'emmagatzematge falla (navegació privada),
 * es queda el predeterminat i no passa res.
 */
export type TileStyle = 'classic' | 'invers';

const KEY = labKey('fitxes');

export function useTileStyle(): [TileStyle, (style: TileStyle) => void] {
  const [style, setStyle] = useState<TileStyle>(() => {
    try {
      return localStorage.getItem(KEY) === 'classic' ? 'classic' : 'invers';
    } catch {
      return 'invers';
    }
  });

  const set = useCallback((next: TileStyle) => {
    setStyle(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Sense emmagatzematge, la tria dura mentre duri la pestanya.
    }
  }, []);

  return [style, set];
}

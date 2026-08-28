import { useCallback, useState } from 'react';
import { missKey, validMisses, type MissedChance } from '../game/missedChances';
import { labKey } from '../storage/namespace';

/**
 * La col·lecció de jeroglífics: els trencaclosques que se t'han escapat, de
 * totes les partides, per jugar-los quan vulguis des del menú del jugador.
 * Viu a localStorage com les preferències (i com elles, si l'emmagatzematge
 * falla es queda en memòria i no passa res). El mateix grup de fitxes només
 * hi entra un cop, i la col·lecció es queda amb els més nous.
 */
const KEY = labKey('jeroglifics');

/** Amb menys que això, el menú encara no ofereix jugar-hi. */
export const MIN_JEROGLIFICS = 3;

/** Els més nous que es guarden; els vells van sortint per sota. */
const MAX_JEROGLIFICS = 30;

export interface JeroglificsHandle {
  items: MissedChance[];
  /** Afegeix els que siguin nous (mateix grup de fitxes = mateix jeroglífic). */
  add(items: readonly MissedChance[]): void;
}

function load(): MissedChance[] {
  try {
    return validMisses(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    return [];
  }
}

export function useJeroglifics(): JeroglificsHandle {
  const [items, setItems] = useState<MissedChance[]>(load);

  const add = useCallback((incoming: readonly MissedChance[]) => {
    setItems((current) => {
      const known = new Set(current.map(missKey));
      const fresh = incoming.filter((miss) => {
        const key = missKey(miss);
        if (known.has(key)) return false;
        known.add(key);
        return true;
      });
      if (fresh.length === 0) return current;
      const next = [...current, ...fresh].slice(-MAX_JEROGLIFICS);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Sense emmagatzematge, la col·lecció dura mentre duri la pestanya.
      }
      return next;
    });
  }, []);

  return { items, add };
}

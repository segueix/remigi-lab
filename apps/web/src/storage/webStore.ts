import { MemoryStore, type KeyValueStore } from '@remigi/core';
import { labKey } from './namespace';

/**
 * Adaptador de `localStorage` a la interfície `KeyValueStore` del motor.
 *
 * `localStorage` falla de maneres que no es poden preveure amb una comprovació
 * de tipus: navegació privada, permisos de galetes bloquejats, quota exhaurida o
 * el mateix objecte inaccessible dins d'un iframe. Per això aquí no es dona mai
 * per fet que hi és, i cap error d'emmagatzematge no ha de tombar la partida.
 */
export class LocalStorageStore implements KeyValueStore {
  constructor(private readonly storage: Storage) {}

  async get(key: string): Promise<string | null> {
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }

  /**
   * Si l'escriptura falla (típicament, quota exhaurida) es perd el desat però
   * **no es llança**: val més seguir jugant sense desar que tallar la partida.
   */
  async set(key: string, value: string): Promise<void> {
    try {
      this.storage.setItem(key, value);
    } catch (error) {
      console.warn('No s’ha pogut desar a localStorage:', error);
    }
  }

  async remove(key: string): Promise<void> {
    try {
      this.storage.removeItem(key);
    } catch (error) {
      console.warn('No s’ha pogut esborrar de localStorage:', error);
    }
  }
}

/**
 * Posa tot el que es desa dins de l'espai de noms del laboratori (vegeu
 * `namespace.ts`): el clon comparteix origen amb el Remigi de producció i no
 * li ha de tocar mai les dades.
 */
export class NamespacedStore implements KeyValueStore {
  constructor(private readonly inner: KeyValueStore) {}

  get(key: string): Promise<string | null> {
    return this.inner.get(labKey(key));
  }

  set(key: string, value: string): Promise<void> {
    return this.inner.set(labKey(key), value);
  }

  remove(key: string): Promise<void> {
    return this.inner.remove(labKey(key));
  }
}

/**
 * Comprova que `localStorage` no només existeix, sinó que **deixa escriure-hi**:
 * al Safari en mode privat, per exemple, l'objecte hi és però `setItem` peta.
 */
export function isStorageUsable(storage: Storage | undefined): storage is Storage {
  if (!storage) return false;
  const probe = '__remigi_probe__';
  try {
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Emmagatzematge per a l'aplicació web: `localStorage` quan es pot fer servir i,
 * si no, memòria (el perfil viurà només mentre duri la pestanya).
 */
export function createWebStore(storage: Storage | undefined = globalThis.localStorage): KeyValueStore {
  if (isStorageUsable(storage)) return new NamespacedStore(new LocalStorageStore(storage));
  console.warn('localStorage no disponible: el perfil no es conservarà en tancar la pestanya.');
  return new NamespacedStore(new MemoryStore());
}

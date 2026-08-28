import { ProfileRepository, createProfile } from '@remigi/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageStore, createWebStore, isStorageUsable } from './webStore';

/** `localStorage` de mentida, amb la possibilitat de fer fallar l'escriptura. */
class FakeStorage implements Storage {
  private data = new Map<string, string>();
  constructor(private readonly failOnWrite = false) {}

  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    if (this.failOnWrite) throw new DOMException('QuotaExceededError');
    this.data.set(key, value);
  }
}

afterEach(() => vi.restoreAllMocks());

describe('LocalStorageStore', () => {
  it('desa, recupera i esborra', async () => {
    const store = new LocalStorageStore(new FakeStorage());
    expect(await store.get('k')).toBeNull();
    await store.set('k', 'valor');
    expect(await store.get('k')).toBe('valor');
    await store.remove('k');
    expect(await store.get('k')).toBeNull();
  });

  it('si l’escriptura falla, avisa però no llança: la partida ha de continuar', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = new LocalStorageStore(new FakeStorage(true));
    await expect(store.set('k', 'valor')).resolves.toBeUndefined();
    expect(await store.get('k')).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});

describe('detecció de localStorage', () => {
  it('rebutja un emmagatzematge absent o que no deixa escriure', () => {
    expect(isStorageUsable(undefined)).toBe(false);
    expect(isStorageUsable(new FakeStorage(true))).toBe(false);
    expect(isStorageUsable(new FakeStorage())).toBe(true);
  });

  it('no deixa rastre de la comprovació', () => {
    const storage = new FakeStorage();
    isStorageUsable(storage);
    expect(storage.length).toBe(0);
  });
});

describe('createWebStore', () => {
  it('fa servir localStorage quan es pot, dins de l’espai de noms del laboratori', async () => {
    const storage = new FakeStorage();
    await createWebStore(storage).set('k', 'v');
    expect(storage.getItem('remigi-lab:k')).toBe('v');
    // I no deixa res a la clau pelada, que seria la del joc de producció.
    expect(storage.getItem('k')).toBeNull();
  });

  it('degrada a memòria, sense petar, quan no es pot escriure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const store = createWebStore(new FakeStorage(true));
    await store.set('k', 'v');
    expect(await store.get('k')).toBe('v'); // funciona, però només en memòria
  });
});

describe('integració amb el motor', () => {
  it('el perfil del jugador sobreviu a una recàrrega de la pàgina', async () => {
    const storage = new FakeStorage();
    await new ProfileRepository(createWebStore(storage)).save({
      ...createProfile('local', 'Anna'),
      rating: 1234,
    });

    // Una pestanya nova: store i repositori nous sobre el mateix localStorage.
    const loaded = await new ProfileRepository(createWebStore(storage)).load('local');
    expect(loaded).toMatchObject({ name: 'Anna', rating: 1234 });
  });
});

/*
 * Publicat, el laboratori comparteix origen amb el Remigi de producció, i
 * localStorage és per origen: si el clon escrivís a les claus de sempre,
 * jugar-hi una partida humana s'enduria el perfil i la partida desada del joc
 * de debò. Això ho fixa.
 */
describe('el laboratori no toca les dades del joc de producció', () => {
  it('el perfil del clon va a la seva clau, no a la de producció', async () => {
    const storage = new FakeStorage();
    await new ProfileRepository(createWebStore(storage)).save(createProfile('local', 'Anna'));

    expect(storage.getItem('remigi-lab:profile:local')).not.toBeNull();
    expect(storage.getItem('remigi:profile:local')).toBeNull();
  });

  it('un perfil de producció ja desat no es llegeix ni es sobreescriu', async () => {
    const storage = new FakeStorage();
    const produccio = JSON.stringify({ ...createProfile('local', 'Daniel'), rating: 1600 });
    storage.setItem('remigi:profile:local', produccio);

    const repository = new ProfileRepository(createWebStore(storage));
    expect(await repository.load('local')).toBeNull(); // el clon comença de zero
    await repository.save(createProfile('local', 'Laboratori'));

    expect(storage.getItem('remigi:profile:local')).toBe(produccio); // intacte
  });
});

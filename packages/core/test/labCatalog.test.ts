import { describe, expect, it } from 'vitest';
import {
  ENGINE_CATALOG,
  engineSpecById,
  engineSpecDiff,
  instantiateEngine,
  resolveEngineParams,
} from '../src/lab/catalog';
import { ENGINE_VERSION } from '../src/engine';

describe('catàleg de motors', () => {
  it('els ids són únics i tots els especs estan complets', () => {
    const ids = ENGINE_CATALOG.map((spec) => spec.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const spec of ENGINE_CATALOG) {
      expect(spec.name).toBeTruthy();
      expect(spec.version).toBeTruthy();
      expect(spec.strategy).toBeTruthy();
      expect(spec.description).toBeTruthy();
      expect(spec.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(spec.engineVersion).toBe(ENGINE_VERSION);
    }
  });

  it('expert-v2 és el Campió vigent, i només n’hi pot haver un', () => {
    const champion = engineSpecById('expert-v2');
    expect(champion.role).toBe('champion');
    expect(champion.config.level).toBe('expert');
    expect(champion.config.maxNodes).toBe(500_000);
    expect(ENGINE_CATALOG.filter((spec) => spec.role === 'champion')).toHaveLength(1);
  });

  it('expert-v1 queda congelat com a línia de base: 120k nodes i cap rol', () => {
    const baseline = engineSpecById('expert-v1');
    expect(baseline.role).toBeUndefined();
    expect(baseline.config.maxNodes).toBe(120_000);
    // El nivell expert per defecte juga ara a 500k: la referència es pinta
    // explícitament a 120k perquè el seu comportament no es mogui mai.
    expect(resolveEngineParams(baseline).maxNodes).toBe(120_000);
    expect(resolveEngineParams(engineSpecById('expert-v2')).maxNodes).toBe(500_000);
  });

  it('demanar un motor que no existeix falla amb un missatge clar', () => {
    expect(() => engineSpecById('no-existeix')).toThrowError(/no-existeix.*expert-v1/);
  });

  it('els paràmetres efectius apliquen nivell, substitucions i sostre de nodes', () => {
    const challenger = engineSpecById('challenger-30k');
    const params = resolveEngineParams(challenger);
    expect(params.rearrangesTable).toBe(true);
    expect(params.mistakeRate).toBe(0);
    expect(params.maxNodes).toBe(30_000);

    const rookie = resolveEngineParams(engineSpecById('rookie-v1'));
    expect(rookie.usesJokers).toBe(false);
    expect(rookie.maxNodes).toBeNull();
  });

  it('la diferència entre el Campió i la referència és només el sostre de nodes', () => {
    const diff = engineSpecDiff(engineSpecById('expert-v2'), engineSpecById('expert-v1'));
    expect(diff.map((d) => d.key)).toEqual(['versió', 'maxNodes']);
    const maxNodes = diff.find((d) => d.key === 'maxNodes')!;
    expect(maxNodes.a).toBe('500000');
    expect(maxNodes.b).toBe('120000');
  });

  it('un espec comparat amb ell mateix no té cap diferència', () => {
    const spec = engineSpecById('expert-v1');
    expect(engineSpecDiff(spec, spec)).toEqual([]);
  });

  it('la diferència entre nivells inclou els paràmetres que canvien', () => {
    const diff = engineSpecDiff(engineSpecById('expert-v1'), engineSpecById('rookie-v1'));
    const keys = diff.map((d) => d.key);
    expect(keys).toContain('nivell');
    expect(keys).toContain('mistakeRate');
    expect(keys).toContain('rearrangesTable');
  });

  it('instanciar un espec dona un motor de la interfície pública', () => {
    const engine = instantiateEngine(engineSpecById('expert-v1'), { seed: 3 });
    expect(engine.version).toBe(ENGINE_VERSION);
    expect(typeof engine.play).toBe('function');
    expect(typeof engine.analyze).toBe('function');
  });
});

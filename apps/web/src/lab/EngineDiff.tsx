import { engineSpecDiff, type EngineSpec } from '@remigi/core';

interface Props {
  specA: EngineSpec;
  specB: EngineSpec;
}

/** Les diferències de configuració entre els dos motors, o «cap». */
export function EngineDiff({ specA, specB }: Props) {
  const differences = engineSpecDiff(specA, specB);
  return (
    <section className="lab-panell lab-diferencies" aria-label="Diferències entre motors">
      <h3>Diferències</h3>
      {differences.length === 0 ? (
        <p className="muted small">
          Cap: els dos costats juguen amb paràmetres idèntics (només canvia la llavor del seu
          RNG).
        </p>
      ) : (
        <table className="lab-taula">
          <thead>
            <tr>
              <th scope="col">paràmetre</th>
              <th scope="col">A · {specA.name}</th>
              <th scope="col">B · {specB.name}</th>
            </tr>
          </thead>
          <tbody>
            {differences.map((difference) => (
              <tr key={difference.key}>
                <th scope="row">{difference.key}</th>
                <td>{difference.a}</td>
                <td>{difference.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

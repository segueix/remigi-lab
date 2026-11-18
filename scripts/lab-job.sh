#!/usr/bin/env bash
#
# Una feina del torneig repartit (acció «Torneig del laboratori»): juga els
# shards que li toquen, en paral·lel i un procés per shard, i els deixa a
# $OUT_DIR. La fusió i l'informe es fan després, un cop tenim totes les feines
# (vegeu docs/AI-LAB.md, «Tornejos grans»).
#
# Tot arriba per variables d'entorn, mai interpolat al codi:
#   ENGINE_A, ENGINE_B   ids del catàleg
#   GAMES, SEED          partides del torneig sencer i llavor base
#   JOBS, JOB            nombre de feines i número d'aquesta (1..JOBS)
#   PROCS                processos en paral·lel dins d'aquesta feina
#   PAIRED               'true' (per defecte) o 'false'
#   OUT_DIR              on deixar els fitxers de shard (per defecte shards/)
#
# Cada feina juga PROCS shards de JOBS·PROCS en total: la feina J juga els
# shards (J-1)·PROCS+1 … J·PROCS. Si un procés falla, la feina falla.
set -euo pipefail

: "${ENGINE_A:?}" "${ENGINE_B:?}" "${GAMES:?}" "${SEED:?}" "${JOBS:?}" "${JOB:?}" "${PROCS:?}"
PAIRED="${PAIRED:-true}"
OUT_DIR="${OUT_DIR:-shards}"

total=$((JOBS * PROCS))
mkdir -p "$OUT_DIR" "$OUT_DIR/.logs"

cores=$(nproc 2>/dev/null || echo 1)
if [ "$cores" -lt "$PROCS" ]; then
  echo "⚠️  Aquesta màquina té $cores nuclis i s'hi demanen $PROCS processos: aniran més lents i els temps (p95) es distorsionaran." >&2
fi

extra=()
if [ "$PAIRED" = "false" ]; then extra+=(--no-pair); fi

pids=()
for p in $(seq 0 $((PROCS - 1))); do
  shard=$(((JOB - 1) * PROCS + p + 1))
  name=$(printf 'shard-%04d' "$shard")
  echo "→ shard $shard/$total"
  npm run --silent lab -- \
    --engine-a "$ENGINE_A" --engine-b "$ENGINE_B" \
    --games "$GAMES" --seed "$SEED" "${extra[@]}" \
    --shard "$shard/$total" --shard-out "$OUT_DIR/$name.json" \
    >"$OUT_DIR/.logs/$name.log" 2>&1 &
  pids+=($!)
done

status=0
for i in "${!pids[@]}"; do
  if ! wait "${pids[$i]}"; then status=1; fi
done

for log in "$OUT_DIR"/.logs/*.log; do
  echo "──── $(basename "$log")"
  tail -n 6 "$log"
done
exit $status

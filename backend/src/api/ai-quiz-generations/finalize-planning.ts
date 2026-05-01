/** Max candidate questions passed to a single finalize LLM call (input size cap). */
export const MAX_FINALIZE_CANDIDATES_PER_CALL = 20;

export type FinalizeBatchPlan = {
  /** Length G; each entry is how many candidates go in that batch; sums to N. */
  groupSizes: number[];
  /** Same length; how many final questions to select from each batch; sums to T. */
  targets: number[];
};

/**
 * Balanced candidate batches (sizes differ by at most 1) + Hamilton largest-remainder
 * allocation of final question targets per batch.
 */
export function computeFinalizeBatchPlan(params: {
  candidateCount: number;
  finalQuestionCount: number;
  maxCandidatesPerBatch?: number;
}): FinalizeBatchPlan {
  const C = params.maxCandidatesPerBatch ?? MAX_FINALIZE_CANDIDATES_PER_CALL;
  const N = params.candidateCount;
  const T = params.finalQuestionCount;
  if (N <= 0 || T <= 0) {
    return { groupSizes: [], targets: [] };
  }

  const G = Math.ceil(N / C);
  const baseSize = Math.floor(N / G);
  const extra = N % G;
  const groupSizes: number[] = [];
  for (let i = 0; i < G; i++) {
    groupSizes.push(i < extra ? baseSize + 1 : baseSize);
  }

  const targets = allocateTargetsByLargestRemainder(groupSizes, T, N);
  return { groupSizes, targets };
}

function allocateTargetsByLargestRemainder(
  groupSizes: number[],
  T: number,
  N: number,
): number[] {
  const G = groupSizes.length;
  if (G === 0) return [];
  const meta: { index: number; floor: number; frac: number; cap: number }[] = [];
  let sumFloor = 0;
  for (let i = 0; i < G; i++) {
    const s = groupSizes[i]!;
    const exact = (T * s) / N;
    const floor = Math.floor(exact);
    const frac = exact - floor;
    sumFloor += floor;
    meta.push({ index: i, floor, frac, cap: s });
  }
  const targets = meta.map((m) => m.floor);
  let remaining = T - sumFloor;
  const priority = [...meta].sort((a, b) => {
    if (b.frac !== a.frac) return b.frac - a.frac;
    if (b.cap !== a.cap) return b.cap - a.cap;
    return a.index - b.index;
  });

  while (remaining > 0) {
    let progressed = false;
    for (const m of priority) {
      if (remaining <= 0) break;
      if (targets[m.index]! < m.cap) {
        targets[m.index]!++;
        remaining--;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  let rr = 0;
  while (remaining > 0) {
    const idx = rr % G;
    if (targets[idx]! < groupSizes[idx]!) {
      targets[idx]!++;
      remaining--;
    }
    rr++;
    if (rr > G * (N + 1)) break;
  }
  return targets;
}

/** Split `items` into consecutive groups with sizes from the plan. */
export function splitIntoConsecutiveBatches<T>(
  items: T[],
  groupSizes: number[],
): T[][] {
  const out: T[][] = [];
  let offset = 0;
  for (const size of groupSizes) {
    out.push(items.slice(offset, offset + size));
    offset += size;
  }
  return out;
}

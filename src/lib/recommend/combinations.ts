/**
 * Generate all k-length combinations from an array.
 *
 * Uses a recursive head/tail pattern. Safe to enumerate at the scale of
 * Phase 5's firm pool: C(12,3) = 220 combinations.
 *
 * NO "server-only" import — must be importable by Vitest in a Node environment.
 */

/**
 * Returns all k-length sub-sequences of `arr`, preserving insertion order
 * within each combination. Order of combinations is deterministic (stable
 * across identical inputs).
 *
 * Base cases:
 *   k === 0  → [[]]  (one empty combination)
 *   arr.length < k  → []  (impossible to fill k slots)
 */
export function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...tail] = arr;
  const withHead = combinations(tail, k - 1).map((combo) => [head, ...combo]);
  const withoutHead = combinations(tail, k);
  return [...withHead, ...withoutHead];
}

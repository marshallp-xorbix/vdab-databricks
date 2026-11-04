/**
 * Deterministic LCG PRNG seeded from a string (shared by story canvas previews).
 */
export function createSeededRng(seedKey: string): () => number {
  let seed = 0;
  for (let i = 0; i < seedKey.length; i++) {
    seed = (seed * 31 + seedKey.charCodeAt(i)) >>> 0;
  }

  return (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

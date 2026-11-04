/** Stable numeric seed for faker / json-schema-faker from arbitrary string keys. */
export function stablePreviewSeed(key: string): number {
  let hash = 5381;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 33) ^ key.charCodeAt(i);
  }
  return Math.abs(hash) % 2147483647;
}

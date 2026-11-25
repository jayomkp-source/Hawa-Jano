export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_MAX_CACHE_ENTRIES = 500;

export function setBoundedCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
  nowMs: number,
  maxEntries = DEFAULT_MAX_CACHE_ENTRIES
): void {
  if (cache.has(key)) {
    cache.delete(key);
  } else if (cache.size >= maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { value, expiresAt: nowMs + ttlMs });
}

export function getValidCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  nowMs: number
): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

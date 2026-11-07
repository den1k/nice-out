import { budgetClientKey, noteStaleServed } from '@/lib/api-guards'

// Bounded in-memory copies of provider responses. A fresh copy saves a billed
// call. An older one is what visitors get when the daily budget is gone or the
// provider is down, so a drained ceiling degrades to older data rather than an
// error. Lost on restart, like the counters. On globalThis because Next bundles
// routes and pages separately.

export type CachePolicy = {
  name: string
  freshMs: number
  staleMs: number
  maxBytes: number
}

type Entry = { at: number; data: unknown; size: number; owner: string }
type Cache = {
  entries: Map<string, Entry>
  bytes: number
  inflight: Map<string, Promise<unknown>>
}

const ENTRY_OVERHEAD_BYTES = 512

const store = globalThis as unknown as {
  __niceOutProviderCache?: Map<string, Cache>
}
const caches = () => (store.__niceOutProviderCache ??= new Map())

export const resetProviderCacheForTest = () => {
  store.__niceOutProviderCache = new Map()
}

const cacheFor = (name: string): Cache => {
  let cache = caches().get(name)
  if (!cache) {
    cache = { entries: new Map(), bytes: 0, inflight: new Map() }
    caches().set(name, cache)
  }
  return cache
}

const remove = (cache: Cache, key: string) => {
  const entry = cache.entries.get(key)
  if (!entry) return
  cache.bytes -= entry.size
  cache.entries.delete(key)
}

// Evicts from whichever client holds the most entries. The traffic that drains a
// ceiling would otherwise also flush every other visitor's fallback. A visitor
// holds a few places, so to reach them an attacker has to spread over enough
// clients that each holds as few.
function evictFromHeaviestOwner(cache: Cache) {
  const counts = new Map<string, number>()
  let heaviest = ''
  let most = 0
  for (const { owner } of cache.entries.values()) {
    const count = (counts.get(owner) ?? 0) + 1
    counts.set(owner, count)
    if (count > most) {
      most = count
      heaviest = owner
    }
  }
  // Maps iterate in insertion order, so the first key found is the oldest
  for (const [key, entry] of cache.entries) {
    if (entry.owner !== heaviest) continue
    remove(cache, key)
    return
  }
}

function retain(
  cache: Cache,
  policy: CachePolicy,
  key: string,
  data: unknown,
  owner: string,
) {
  remove(cache, key)
  const size =
    key.length + (JSON.stringify(data)?.length ?? 0) + ENTRY_OVERHEAD_BYTES
  cache.entries.set(key, { at: Date.now(), data, size, owner })
  cache.bytes += size
  while (cache.bytes > policy.maxBytes) evictFromHeaviestOwner(cache)
}

export async function cachedProviderCall<T>(
  policy: CachePolicy,
  key: string,
  client: Headers,
  fetcher: () => Promise<T>,
): Promise<{ data: T; stale: boolean }> {
  const cache = cacheFor(policy.name)
  const hit = cache.entries.get(key)
  if (hit && Date.now() - hit.at < policy.freshMs)
    return { data: hit.data as T, stale: false }

  let pending = cache.inflight.get(key) as Promise<T> | undefined
  if (!pending) {
    const owner = budgetClientKey(client)
    pending = (async () => {
      try {
        const data = await fetcher()
        retain(cache, policy, key, data, owner)
        return data
      } finally {
        cache.inflight.delete(key)
      }
    })()
    cache.inflight.set(key, pending)
  }

  try {
    return { data: await pending, stale: false }
  } catch (error) {
    // Callers validate input first, so an entry here means this key once worked
    const old = cache.entries.get(key)
    if (!old || Date.now() - old.at >= policy.staleMs) throw error
    noteStaleServed()
    return { data: old.data as T, stale: true }
  }
}

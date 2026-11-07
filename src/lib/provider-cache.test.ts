import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '@/utils/httpError'
import { resetGuardsForTest } from './api-guards'
import {
  cachedProviderCall,
  CachePolicy,
  resetProviderCacheForTest,
} from './provider-cache'

const MIN = 60_000
const policy: CachePolicy = {
  name: 'test',
  freshMs: 15 * MIN,
  staleMs: 60 * MIN,
  maxBytes: 5_000,
}
const client = (ip: string) => new Headers({ 'x-real-ip': ip })
const a = client('1.1.1.1')
const budgetGone = () => {
  throw new HttpError('Daily provider budget reached', 429)
}

beforeEach(() => {
  resetGuardsForTest()
  resetProviderCacheForTest()
  vi.useRealTimers()
})

const later = (ms: number) => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.advanceTimersByTime(ms)
}

describe('cachedProviderCall', () => {
  it('reuses a fresh value without another upstream call', async () => {
    const fetcher = vi.fn(async () => 'v')
    await cachedProviderCall(policy, 'k', a, fetcher)
    expect(await cachedProviderCall(policy, 'k', client('2.2.2.2'), fetcher)).toEqual({
      data: 'v',
      stale: false,
    })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('shares one upstream call between concurrent misses', async () => {
    const fetcher = vi.fn(async () => 'v')
    await Promise.all([
      cachedProviderCall(policy, 'k', a, fetcher),
      cachedProviderCall(policy, 'k', a, fetcher),
    ])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('refetches once the fresh window passes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const fetcher = vi.fn(async () => 'v')
    await cachedProviderCall(policy, 'k', a, fetcher)
    vi.advanceTimersByTime(16 * MIN)
    await cachedProviderCall(policy, 'k', a, fetcher)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('serves the last good value, marked stale, when the budget is exhausted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    await cachedProviderCall(policy, 'k', a, async () => 'v')
    vi.advanceTimersByTime(30 * MIN)
    expect(await cachedProviderCall(policy, 'k', a, budgetGone)).toEqual({
      data: 'v',
      stale: true,
    })
  })

  it('serves the last good value when the provider fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    await cachedProviderCall(policy, 'k', a, async () => 'v')
    vi.advanceTimersByTime(30 * MIN)
    const down = async () => {
      throw new HttpError('Bad Gateway', 502)
    }
    expect((await cachedProviderCall(policy, 'k', a, down)).stale).toBe(true)
  })

  it('still fails when nothing is cached, or the copy is too old', async () => {
    await expect(cachedProviderCall(policy, 'none', a, budgetGone)).rejects.toThrow(
      /budget/,
    )
    vi.useFakeTimers({ toFake: ['Date'] })
    await cachedProviderCall(policy, 'k', a, async () => 'v')
    vi.advanceTimersByTime(61 * MIN)
    await expect(cachedProviderCall(policy, 'k', a, budgetGone)).rejects.toThrow(
      /budget/,
    )
  })

  it('does not store failures', async () => {
    const fetcher = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new HttpError('x', 503))
      .mockResolvedValueOnce('v')
    await expect(cachedProviderCall(policy, 'k', a, fetcher)).rejects.toThrow()
    expect((await cachedProviderCall(policy, 'k', a, fetcher)).data).toBe('v')
  })
})

describe('what an attacker can do to the fallback', () => {
  const entry = 'x'.repeat(500) // about 1 KB with overhead, so 5 fit

  it('one client churning keys evicts only its own entries', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const victim = client('2.2.2.2')
    await cachedProviderCall(policy, 'saved-place', victim, async () => 'real')
    for (let i = 0; i < 100; i++)
      await cachedProviderCall(policy, `junk${i}`, a, async () => entry)
    vi.advanceTimersByTime(30 * MIN)
    expect(
      await cachedProviderCall(policy, 'saved-place', victim, budgetGone),
    ).toEqual({ data: 'real', stale: true })
    await expect(cachedProviderCall(policy, 'junk0', a, budgetGone)).rejects.toThrow()
    expect((await cachedProviderCall(policy, 'junk99', a, budgetGone)).stale).toBe(true)
  })

  it('several clients churning keys cannot push out a lighter visitor', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const victim = client('2.2.2.2')
    await cachedProviderCall(policy, 'saved-place', victim, async () => 'real')
    for (let i = 0; i < 200; i++)
      await cachedProviderCall(policy, `junk${i}`, client(`3.3.3.${i % 3}`), async () => entry)
    vi.advanceTimersByTime(30 * MIN)
    expect((await cachedProviderCall(policy, 'saved-place', victim, budgetGone)).data).toBe('real')
  })

  it('stays within its byte limit when every client holds one entry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    for (let i = 0; i < 20; i++)
      await cachedProviderCall(policy, `k${i}`, client(`3.3.3.${i}`), async () => entry)
    vi.advanceTimersByTime(30 * MIN)
    await expect(cachedProviderCall(policy, 'k0', a, budgetGone)).rejects.toThrow()
    expect((await cachedProviderCall(policy, 'k19', a, budgetGone)).data).toBe(entry)
  })

  it('keeps separate policies apart', async () => {
    await cachedProviderCall(policy, 'k', a, async () => 'one')
    const other = { ...policy, name: 'other' }
    expect((await cachedProviderCall(other, 'k', a, async () => 'two')).data).toBe('two')
  })
})

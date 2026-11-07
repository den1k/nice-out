import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpError } from '@/utils/httpError'
import {
  allowClient,
  boundCardName,
  isForeignBrowserRequest,
  isValidPlaceId,
  normalizeCoords,
  resetGuardsForTest,
  spendProviderBudget,
} from './api-guards'

const fromIp = (ip: string) => new Headers({ 'x-real-ip': ip })

beforeEach(() => resetGuardsForTest())

describe('normalizeCoords', () => {
  it('rounds to 3 decimals and never emits anything but a plain number', () => {
    expect(normalizeCoords('40.71278', '-74.00597')).toEqual({
      lat: '40.713',
      lon: '-74.006',
    })
    expect(normalizeCoords('1e-7', '0')).toEqual({ lat: '0', lon: '0' })
  })

  it.each([
    ['../../x', '1'],
    ['1', '1?y'],
    ['1/../..', '1'],
    ['91', '0'],
    ['0', '181'],
    ['Infinity', '0'],
    ['', '0'],
    [null, '0'],
  ])('rejects %s,%s', (lat, lon) => {
    expect(normalizeCoords(lat, lon)).toBeNull()
  })
})

describe('isValidPlaceId', () => {
  it('accepts Google ids and rejects anything that could alter the URL', () => {
    expect(isValidPlaceId('ChIJOwg_06VPwokRYv534QaPC8g')).toBe(true)
    expect(isValidPlaceId('Ei0xMjMgTWFpbi1TdHJlZXQ_abc')).toBe(true)
    expect(isValidPlaceId('x&key=z#')).toBe(false)
    expect(isValidPlaceId('')).toBe(false)
    expect(isValidPlaceId(null)).toBe(false)
    expect(isValidPlaceId('a'.repeat(2000))).toBe(false)
  })
})

describe('allowClient', () => {
  it('limits per client IP without affecting other clients', () => {
    for (let i = 0; i < 60; i++)
      expect(allowClient(fromIp('1.1.1.1'))).toBe(true)
    expect(allowClient(fromIp('1.1.1.1'))).toBe(false)
    expect(allowClient(fromIp('2.2.2.2'))).toBe(true)
  })

  it('reopens once the window passes', () => {
    const t0 = 1_000_000
    for (let i = 0; i < 61; i++) allowClient(fromIp('1.1.1.1'), t0)
    expect(allowClient(fromIp('1.1.1.1'), t0)).toBe(false)
    expect(allowClient(fromIp('1.1.1.1'), t0 + 61_000)).toBe(true)
  })

  it('ignores a spoofed X-Forwarded-For: only nginx-set X-Real-IP counts', () => {
    for (let i = 0; i < 60; i++) {
      const h = fromIp('1.1.1.1')
      h.set('x-forwarded-for', `9.9.9.${i}`)
      allowClient(h)
    }
    const h = fromIp('1.1.1.1')
    h.set('x-forwarded-for', '8.8.8.8')
    expect(allowClient(h)).toBe(false)
  })

  it('buckets an IPv6 client by /64', () => {
    for (let i = 0; i < 60; i++)
      allowClient(fromIp(`2001:db8:1:2:0:0:0:${i.toString(16)}`))
    expect(allowClient(fromIp('2001:db8:1:2:ffff:0:0:1'))).toBe(false)
  })

  it('buckets a compressed IPv6 address by its real /64', () => {
    // nginx prints the compressed form. A provider address such as
    // 2600:3c00::f03c:91ff:fe00:1 has a zero run inside the /64 prefix, so the
    // first four colon-separated fields are not the prefix.
    for (let i = 0; i < 60; i++)
      allowClient(fromIp(`2001:db8::${i.toString(16)}:1:2:3`))
    expect(allowClient(fromIp('2001:db8::ffff:1:2:3'))).toBe(false)
  })

  it('does not merge different /64s that compress alike', () => {
    for (let i = 0; i < 60; i++) allowClient(fromIp('2001:db8:1::1'))
    expect(allowClient(fromIp('2001:db8:1::1'))).toBe(false)
    expect(allowClient(fromIp('2001:db8:1:5::1'))).toBe(true)
  })

  it('keeps IPv4-mapped clients apart', () => {
    for (let i = 0; i < 60; i++) allowClient(fromIp('::ffff:1.2.3.4'))
    expect(allowClient(fromIp('::ffff:1.2.3.4'))).toBe(false)
    expect(allowClient(fromIp('::ffff:5.6.7.8'))).toBe(true)
  })
})

describe('spendProviderBudget', () => {
  const t0 = Date.UTC(2026, 0, 1, 12)
  const DAY = 24 * 3600 * 1000
  // A different client for each call, to reach the global ceiling
  const spendFromManyClients = (n: number) => {
    for (let i = 0; i < n; i++)
      spendProviderBudget(
        'google',
        fromIp(`10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`),
        t0,
      )
  }

  it('stops a provider at its daily ceiling, independent of other providers', () => {
    spendFromManyClients(1000)
    const other = fromIp('2.2.2.2')
    expect(() => spendProviderBudget('google', other, t0)).toThrow(/budget/i)
    expect(() => spendProviderBudget('weatherkit', other, t0)).not.toThrow()
    expect(() => spendProviderBudget('google', other, t0 + DAY)).not.toThrow()
  })

  it('stops one client long before it can drain the shared ceiling', () => {
    const attacker = fromIp('1.1.1.1')
    let spent = 0
    const spendAll = () => {
      try {
        for (let i = 0; i < 6000; i++) {
          spendProviderBudget('google', attacker, t0)
          spent++
        }
      } catch (e) {
        expect((e as HttpError).status).toBe(429)
      }
    }
    spendAll()
    expect(spent).toBe(200)
    // Everyone else is unaffected, including on other providers for this client
    expect(() =>
      spendProviderBudget('google', fromIp('2.2.2.2'), t0),
    ).not.toThrow()
    expect(() => spendProviderBudget('weatherkit', attacker, t0)).not.toThrow()
    // And the client recovers the next UTC day
    expect(() =>
      spendProviderBudget('google', attacker, t0 + DAY),
    ).not.toThrow()
  })

  it('buckets the daily allowance by IPv6 /48, so extra /64s do not help', () => {
    for (let i = 0; i < 200; i++)
      spendProviderBudget(
        'google',
        fromIp(`2001:db8:1:${i.toString(16)}::1`),
        t0,
      )
    expect(() =>
      spendProviderBudget('google', fromIp('2001:db8:1:ffff::1'), t0),
    ).toThrow(/too many/i)
    expect(() =>
      spendProviderBudget('google', fromIp('2001:db8:2::1'), t0),
    ).not.toThrow()
  })

  it('takes five clients at their full allowance to drain Google', () => {
    let clients = 0
    const drain = () => {
      for (; clients < 1000; clients++) {
        const ip = fromIp(`10.0.${clients >> 8}.${clients & 255}`)
        for (let i = 0; i < 200; i++) spendProviderBudget('google', ip, t0)
      }
    }
    expect(drain).toThrow(/budget/i)
    expect(clients).toBe(5)
  })

  it('logs hourly usage without addresses, and warns once at the ceiling', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    spendProviderBudget('google', fromIp('203.0.113.9'), t0)
    spendProviderBudget('google', fromIp('203.0.113.9'), t0 + 3_600_000)
    const line = log.mock.calls[0][0] as string
    expect(line).toContain('[budget] 2026-01-01')
    expect(line).toContain('google=1/1000 clients=1 maxClient=1 refused=0')
    expect(line).not.toContain('203.0.113')
    spendFromManyClients(998)
    const other = fromIp('2.2.2.2')
    expect(() => spendProviderBudget('google', other, t0 + 3_600_000)).toThrow()
    expect(() => spendProviderBudget('google', other, t0 + 3_600_000)).toThrow()
    expect(warn).toHaveBeenCalledTimes(1)
    vi.restoreAllMocks()
  })

  it('does not charge the ceiling for a client over its allowance', () => {
    const attacker = fromIp('1.1.1.1')
    for (let i = 0; i < 5000; i++) {
      try {
        spendProviderBudget('google', attacker, t0)
      } catch {}
    }
    spendFromManyClients(800)
    expect(() => spendProviderBudget('google', fromIp('2.2.2.2'), t0)).toThrow(
      /budget/i,
    )
  })
})

describe('isForeignBrowserRequest', () => {
  const site = (v?: string) =>
    new Headers(v ? { 'sec-fetch-site': v } : undefined)
  it.each(['cross-site', 'same-site'])('flags %s', (v) => {
    expect(isForeignBrowserRequest(site(v))).toBe(true)
  })
  it.each(['same-origin', 'none', undefined])('allows %s', (v) => {
    expect(isForeignBrowserRequest(site(v))).toBe(false)
  })
})

describe('boundCardName', () => {
  it('passes names the bundled fonts can render, without limit', () => {
    for (let i = 0; i < 1000; i++) {
      expect(boundCardName(`Zürich Αθήνα Москва Hà Nội ${i}`)).toBe(
        `Zürich Αθήνα Москва Hà Nội ${i}`,
      )
    }
  })

  it('keeps non-Roboto names until the distinct-name budget is spent, then strips', () => {
    const cjk = (i: number) => `東京${String.fromCodePoint(0x4e00 + i)}`
    for (let i = 0; i < 256; i++) expect(boundCardName(cjk(i))).toBe(cjk(i))
    expect(boundCardName(cjk(0))).toBe(cjk(0)) // already admitted: still free
    expect(boundCardName('東京 Tokyo')).toBe('Tokyo')
    expect(boundCardName('東京都')).toBeNull()
  })
})

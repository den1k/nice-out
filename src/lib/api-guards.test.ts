import { beforeEach, describe, expect, it } from 'vitest'
import {
  allowClient,
  boundCardName,
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
})

describe('spendProviderBudget', () => {
  it('stops a provider at its daily ceiling, independent of other providers', () => {
    const t0 = Date.UTC(2026, 0, 1, 12)
    for (let i = 0; i < 5000; i++) spendProviderBudget('google', t0)
    expect(() => spendProviderBudget('google', t0)).toThrow(/budget/i)
    expect(() => spendProviderBudget('weatherkit', t0)).not.toThrow()
    expect(() =>
      spendProviderBudget('google', t0 + 24 * 3600 * 1000),
    ).not.toThrow()
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

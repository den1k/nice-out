import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchLocationCoordinates,
  fetchSearchLocations,
} from './fetchSearchLocations'
import { shouldRetryQuery, HttpError } from './httpError'

const respond = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  )

afterEach(() => vi.unstubAllGlobals())

describe('fetchLocationCoordinates', () => {
  const place = {
    coords: { latitude: 40.7, longitude: -74 },
    name: 'Brooklyn',
    googleLocationID: 'abc',
  }

  it('returns a resolved place', async () => {
    respond(200, place)
    expect(await fetchLocationCoordinates('abc')).toEqual(place)
  })

  it.each([400, 429, 500])('returns null for a %i error body', async (s) => {
    respond(s, { error: 'nope' })
    expect(await fetchLocationCoordinates('abc')).toBeNull()
  })

  it('returns null for a 200 with no usable coordinates', async () => {
    respond(200, { error: 'nope' })
    expect(await fetchLocationCoordinates('abc')).toBeNull()
    respond(200, { coords: { latitude: '1', longitude: 2 } })
    expect(await fetchLocationCoordinates('abc')).toBeNull()
  })

  it('returns null when the network fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    expect(await fetchLocationCoordinates('abc')).toBeNull()
  })
})

describe('fetchSearchLocations', () => {
  it('returns predictions, and an empty list means no matches', async () => {
    respond(200, [{ description: 'Aruba' }])
    expect(await fetchSearchLocations('Aru')).toEqual([
      { description: 'Aruba' },
    ])
    respond(200, [])
    expect(await fetchSearchLocations('zzz')).toEqual([])
  })

  it('returns null on failure, so it is not shown as "no matches"', async () => {
    respond(429, { error: 'Too many requests' })
    expect(await fetchSearchLocations('Aru')).toBeNull()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    expect(await fetchSearchLocations('Aru')).toBeNull()
  })
})

describe('shouldRetryQuery', () => {
  it.each([400, 403, 429])('never retries a %i', (status) => {
    expect(shouldRetryQuery(0, new HttpError('x', status))).toBe(false)
  })
  it('retries a server error once, since each retry can spend provider quota', () => {
    expect(shouldRetryQuery(0, new HttpError('x', 502))).toBe(true)
    expect(shouldRetryQuery(1, new HttpError('x', 502))).toBe(false)
  })
  it('keeps the default three retries for network errors', () => {
    expect(shouldRetryQuery(2, new Error('offline'))).toBe(true)
    expect(shouldRetryQuery(3, new Error('offline'))).toBe(false)
  })
})

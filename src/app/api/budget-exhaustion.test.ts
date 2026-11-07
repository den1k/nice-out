import { generateKeyPairSync } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetGuardsForTest, spendProviderBudget } from '@/lib/api-guards'
import { resetProviderCacheForTest } from '@/lib/provider-cache'
import { GET as weather } from './weather/route'
import { GET as search } from './locationSearch/route'
import { GET as coordinates } from './locationCoordinates/route'
import { GET as nameInfo } from './locationNameInfo/route'

// What a visitor gets once other clients have drained a provider's daily ceiling

const CEILINGS = { weatherkit: 15_000, google: 1_000, openweathermap: 15_000 }
const drain = (provider: keyof typeof CEILINGS) => {
  // Stops at the ceiling, which earlier spends in the test bring closer
  try {
    for (let i = 0; i <= CEILINGS[provider]; i++)
      spendProviderBudget(
        provider,
        new Headers({ 'x-real-ip': `10.${i >> 16}.${(i >> 8) & 255}.${i & 255}` }),
      )
  } catch {}
}

const hours = [{ forecastStart: '2026-01-01T00:00:00Z' }]
const forecast = {
  currentWeather: { temperature: 20 },
  forecastHourly: { hours },
  forecastDaily: { days: hours },
}
const responses: Record<string, unknown> = {
  'weatherkit.apple.com': forecast,
  'api.openweathermap.org': [{ name: 'Testville', state: 'TS', country: 'DL' }],
}
const googleBody = (url: string) =>
  url.includes('autocomplete')
    ? { status: 'OK', predictions: [{ description: 'Testville', place_id: 'p1' }] }
    : {
        status: 'OK',
        results: [
          {
            geometry: { location: { lat: 40.7, lng: -74 } },
            address_components: [{ types: ['locality'], long_name: 'Testville' }],
          },
        ],
      }
const fetchMock = vi.fn(async (input: string) => {
  const url = new URL(input)
  const body =
    url.hostname === 'maps.googleapis.com'
      ? googleBody(input)
      : responses[url.hostname]
  return new Response(JSON.stringify(body), { status: 200 })
})

const get = (path: string, ip = '1.1.1.1') =>
  new Request(`http://local${path}`, { headers: { 'x-real-ip': ip } })

beforeEach(() => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  vi.stubEnv(
    'PRIVATE_KEY',
    Buffer.from(
      privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
    ).toString('base64'),
  )
  for (const k of ['APP_ID', 'TEAM_ID', 'KEY_ID', 'GOOGLE_API', 'OPEN_WEATHER_MAP_API_KEY'])
    vi.stubEnv(k, 'dummy')
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 0, 1, 6) })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  resetGuardsForTest()
  resetProviderCacheForTest()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

const SIXTEEN_MIN = 16 * 60_000

describe('/api/weather', () => {
  const path = '/api/weather?lat=40.7&lon=-74'

  it('marks a live answer as not stale', async () => {
    const res = await weather(get(path))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-data-stale')).toBeNull()
  })

  it('serves a repeat from the cache without another call', async () => {
    await weather(get(path))
    await weather(get(path, '2.2.2.2'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('serves the last forecast, marked stale, to anyone once drained', async () => {
    await weather(get(path))
    vi.advanceTimersByTime(SIXTEEN_MIN)
    drain('weatherkit')
    const res = await weather(get(path, '2.2.2.2'))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-data-stale')).toBe('1')
    expect(await res.json()).toEqual(forecast)
  })

  it('still answers 429 for a place nobody has looked up', async () => {
    drain('weatherkit')
    const res = await weather(get('/api/weather?lat=1&lon=1'))
    expect(res.status).toBe(429)
  })

  it('does not keep an incomplete forecast as the fallback', async () => {
    fetchMock.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify({ currentWeather: {} }), { status: 200 }),
    )
    expect((await weather(get(path))).status).toBe(502)
    drain('weatherkit')
    expect((await weather(get(path))).status).toBe(429)
  })
})

describe('/api/locationSearch', () => {
  const path = '/api/locationSearch?searchTerm=Testv'

  it('serves earlier results for the same term once drained, in any case', async () => {
    await search(get(path))
    vi.advanceTimersByTime(2 * 3_600_000)
    drain('google')
    const res = await search(get('/api/locationSearch?searchTerm=TESTV', '2.2.2.2'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([{ description: 'Testville', place_id: 'p1' }])
  })

  it('never caches a Google error as an empty result', async () => {
    fetchMock.mockImplementationOnce(
      async () =>
        new Response(
          JSON.stringify({ status: 'OVER_QUERY_LIMIT', predictions: [] }),
          { status: 200 },
        ),
    )
    expect((await search(get(path))).status).toBe(502)
    expect(await (await search(get(path))).json()).toHaveLength(1)
  })

  it('caches a genuine no-match', async () => {
    fetchMock.mockImplementationOnce(
      async () =>
        new Response(JSON.stringify({ status: 'ZERO_RESULTS', predictions: [] }), {
          status: 200,
        }),
    )
    expect(await (await search(get(path))).json()).toEqual([])
    expect(await (await search(get(path))).json()).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('/api/locationCoordinates', () => {
  it('serves known coordinates once drained', async () => {
    const path = '/api/locationCoordinates?id=p1'
    await coordinates(get(path))
    vi.advanceTimersByTime(25 * 3_600_000)
    drain('google')
    const res = await coordinates(get(path, '2.2.2.2'))
    expect(res.status).toBe(200)
    expect((await res.json()).name).toBe('Testville')
  })
})

describe('/api/locationNameInfo', () => {
  const path = '/api/locationNameInfo?lat=40.713&lon=-74.006'

  it('serves a known name once drained', async () => {
    await nameInfo(get(path))
    vi.advanceTimersByTime(25 * 3_600_000)
    drain('openweathermap')
    expect((await (await nameInfo(get(path, '2.2.2.2'))).json()).name).toBe(
      'Testville',
    )
  })

  it('falls back to coordinates so an unnamed GPS fix still gets its forecast', async () => {
    drain('openweathermap')
    const res = await nameInfo(get(path))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      name: '40.713, -74.006',
      timeZone: 'America/New_York',
      degraded: true,
    })
  })
})

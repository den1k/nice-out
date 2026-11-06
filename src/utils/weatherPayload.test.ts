import { describe, expect, it } from 'vitest'
import { generateGraphData } from '@/lib/generate-graph-data'
import {
  isCompleteForecast,
  isUsableWeatherData,
  sanitizePersistedClient,
} from './weatherPayload'

const HOUR = 3600 * 1000
const start = Date.UTC(2026, 10, 1)
const iso = (ms: number) => new Date(ms).toISOString()

const hours = Array.from({ length: 24 * 8 }, (_, i) => ({
  forecastStart: iso(start + i * HOUR),
  temperature: 10 + (i % 12),
  temperatureApparent: 9,
  precipitationAmount: 0,
  precipitationChance: 0.1,
  conditionCode: 'Clear',
  daylight: true,
}))
const days = Array.from({ length: 10 }, (_, i) => ({
  forecastStart: iso(start + i * 24 * HOUR),
  sunrise: iso(start + i * 24 * HOUR + 6 * HOUR),
  sunset: iso(start + i * 24 * HOUR + 18 * HOUR),
  temperatureMin: 5,
  temperatureMax: 20,
}))
const good = () =>
  structuredClone({
    timezone: 'America/New_York',
    current: { temperature: 12, conditionCode: 'Clear', daylight: true },
    hourly: hours,
    daily: days,
    locationName: 'Brooklyn',
    locationId: 'weather-Brooklyn-NY-US',
    googleLocationID: '',
    isGPSLocation: false,
    location: { coords: { latitude: 40.7, longitude: -74 } },
  }) as any

const draw = (w: any) => generateGraphData(w, 800, 400)

describe('isUsableWeatherData', () => {
  it('accepts a real payload, which also draws', () => {
    expect(isUsableWeatherData(good())).toBe(true)
    expect(() => draw(good())).not.toThrow()
  })

  it('accepts a polar day with no sunrise or sunset', () => {
    const w = good()
    w.daily[0].sunrise = undefined
    w.daily[0].sunset = null
    expect(isUsableWeatherData(w)).toBe(true)
    expect(() => draw(w)).not.toThrow()
  })

  // The contract that protects every load: whatever a restored payload looks
  // like, it is either rejected here or it draws without throwing
  const junk = [undefined, null, 0, '', 'garbage', [], {}, [null], [{}], true]
  const paths: string[][] = [
    [],
    ['timezone'],
    ['current'],
    ['hourly'],
    ['daily'],
    ['location'],
    ['location', 'coords'],
    ['location', 'coords', 'latitude'],
    ['location', 'coords', 'longitude'],
    ['hourly', '0'],
    ['hourly', '0', 'forecastStart'],
    ['hourly', '0', 'temperature'],
    ['hourly', '5', 'forecastStart'],
    ['daily', '0'],
    ['daily', '0', 'forecastStart'],
    ['daily', '0', 'sunrise'],
    ['daily', '0', 'sunset'],
    ['daily', '3'],
    ['daily', '9', 'forecastStart'],
  ]
  const cases = paths.flatMap((path) => junk.map((v) => [path, v] as const))
  it.each(cases)('rejects or survives %j = %j', (path, value) => {
    let w = good()
    if (path.length === 0) w = value
    else {
      let o = w
      for (const k of path.slice(0, -1)) o = o[k]
      o[path.at(-1)!] = value
    }
    if (isUsableWeatherData(w)) expect(() => draw(w)).not.toThrow()
  })

  it('rejects the known crashers', () => {
    for (const k of ['hourly', 'daily']) {
      const w = good()
      w[k] = []
      expect(isUsableWeatherData(w)).toBe(false)
    }
    const w = good()
    w.location.coords.latitude = '40.7' // .toFixed throws in useWeatherData
    expect(isUsableWeatherData(w)).toBe(false)
  })
})

describe('isCompleteForecast', () => {
  const raw = () => ({
    currentWeather: { temperature: 1 },
    forecastHourly: { hours: structuredClone(hours) },
    forecastDaily: { days: structuredClone(days) },
  })
  it('accepts a real forecast', () => {
    expect(isCompleteForecast(raw())).toBe(true)
  })
  it('rejects missing, empty, non-array and undated lists', () => {
    expect(isCompleteForecast({})).toBe(false)
    expect(isCompleteForecast(null)).toBe(false)
    expect(isCompleteForecast({ ...raw(), currentWeather: undefined })).toBe(
      false,
    )
    expect(isCompleteForecast({ ...raw(), forecastDaily: { days: [] } })).toBe(
      false,
    )
    expect(
      isCompleteForecast({ ...raw(), forecastHourly: { hours: 'x' } }),
    ).toBe(false)
    expect(
      isCompleteForecast({ ...raw(), forecastDaily: { days: [{}] } }),
    ).toBe(false)
  })
})

describe('sanitizePersistedClient', () => {
  const entry = (key: string, data: unknown) => ({
    queryKey: [key, { lat: 1, lon: 2 }],
    queryHash: key,
    state: { data, status: 'success' },
  })
  const client = (queries: unknown[]) =>
    ({
      timestamp: 1,
      buster: '',
      clientState: { queries, mutations: [] },
    }) as any

  it('keeps saved places and drops only what cannot render', () => {
    const name = { name: 'x', id: 'weather-x', timeZone: 'UTC' }
    const out = sanitizePersistedClient(
      client([
        entry('location', name),
        entry('location', null),
        entry('weather-good', good()),
        entry('weather-bad', { ...good(), daily: [] }),
        { queryKey: [7], state: { data: {} } },
        { queryKey: 'x', state: { data: {} } },
        null,
      ]),
    )
    expect(
      out?.clientState.queries.map((q: any) => [q.queryKey[0], q.state.data]),
    ).toEqual([
      ['location', name],
      ['weather-good', good()],
    ])
  })

  it('passes through nothing-saved and survives a corrupt shell', () => {
    expect(sanitizePersistedClient(undefined)).toBeUndefined()
    expect(sanitizePersistedClient({} as any)).toBeUndefined()
    expect(
      sanitizePersistedClient({ clientState: { queries: 'x' } } as any),
    ).toBeUndefined()
  })
})

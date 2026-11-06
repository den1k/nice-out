import { generateKeyPairSync } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetGuardsForTest } from './api-guards'
import {
  fetchWeatherKit,
  getShareCardData,
  isCompleteForecast,
  parseShareCardParams,
  resetShareCardCacheForTest,
} from './weatherkit-server'

const payload = {
  currentWeather: { temperature: 20, conditionCode: 'Clear', daylight: true },
  forecastDaily: { days: [{ temperatureMax: 25, temperatureMin: 15 }] },
  forecastHourly: { hours: [{}] },
}
const client = new Headers({ 'x-real-ip': '1.1.1.1' })
const fetchMock = vi.fn(
  async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify(payload), { status: 200 }),
)
const card = {
  lat: '40.7',
  lon: '-74',
  name: null,
  isTempMetric: true,
  isDistanceMetric: true,
}

beforeEach(() => {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  vi.stubEnv(
    'PRIVATE_KEY',
    Buffer.from(
      privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
    ).toString('base64'),
  )
  vi.stubEnv('APP_ID', 'a')
  vi.stubEnv('TEAM_ID', 't')
  vi.stubEnv('KEY_ID', 'k')
  fetchMock.mockClear()
  vi.stubGlobal('fetch', fetchMock)
  resetGuardsForTest()
  resetShareCardCacheForTest()
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('fetchWeatherKit', () => {
  it('refuses path traversal at the egress point, before any upstream call', async () => {
    await expect(fetchWeatherKit('../../x', '1?y', client)).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never opts in to the Next data cache, whose key contains the fresh JWT', async () => {
    await fetchWeatherKit('1', '1', client)
    const init = fetchMock.mock.calls[0][1] as RequestInit & { next?: unknown }
    expect(init.cache).toBe('no-store')
    expect(init.next).toBeUndefined()
  })
})

describe('getShareCardData', () => {
  it('dedupes repeat lookups even when each would sign a different JWT', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    await getShareCardData(card, client)
    vi.advanceTimersByTime(5000)
    await getShareCardData(card, client)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('collapses sub-3-decimal coordinate variations into one lookup', async () => {
    const a = parseShareCardParams({ lat: '40.70001', lon: '-74' })!
    const b = parseShareCardParams({ lat: '40.70002', lon: '-74' })!
    await getShareCardData(a, client)
    await getShareCardData(b, client)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches after the 15-minute window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    await getShareCardData(card, client)
    vi.advanceTimersByTime(901_000)
    await getShareCardData(card, client)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('holds a bounded number of entries however many coordinates are asked for', async () => {
    for (let i = 0; i < 510; i++)
      await getShareCardData({ ...card, lat: String(i / 100) }, client)
    fetchMock.mockClear()
    await getShareCardData({ ...card, lat: String(509 / 100) }, client) // newest: kept
    expect(fetchMock).toHaveBeenCalledTimes(0)
    await getShareCardData({ ...card, lat: '0' }, client) // oldest: evicted
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not cache failures', async () => {
    fetchMock.mockImplementationOnce(
      async () => new Response('', { status: 503 }),
    )
    await expect(getShareCardData(card, client)).rejects.toThrow()
    await getShareCardData(card, client)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('per-client WeatherKit allowance', () => {
  it('charges the requesting client only when an upstream call happens', async () => {
    for (let i = 0; i < 1500; i++) await fetchWeatherKit('1', '1', client)
    await expect(fetchWeatherKit('1', '1', client)).rejects.toThrow(/too many/i)
    await expect(
      fetchWeatherKit('1', '1', new Headers({ 'x-real-ip': '2.2.2.2' })),
    ).resolves.toBeTruthy()
  })
})

describe('isCompleteForecast', () => {
  it('rejects the payloads that crash generate-graph-data once persisted', () => {
    expect(isCompleteForecast(payload)).toBe(true)
    expect(
      isCompleteForecast({ ...payload, forecastDaily: { days: [] } }),
    ).toBe(false)
    expect(
      isCompleteForecast({ ...payload, forecastHourly: { hours: [] } }),
    ).toBe(false)
    expect(isCompleteForecast({})).toBe(false)
  })
})

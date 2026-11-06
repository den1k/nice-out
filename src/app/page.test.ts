import { beforeEach, describe, expect, it, vi } from 'vitest'

// Next 15+ passes searchParams and headers() as promises.
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-real-ip': '198.51.100.7' }),
}))
vi.mock('./components/HomeClient', () => ({ default: () => null }))
vi.mock('@/lib/weatherkit-server', async (original) => ({
  ...(await original<typeof import('@/lib/weatherkit-server')>()),
  getShareCardData: async () => ({
    name: 'Paris',
    temperature: 10,
    tempUnit: 'C',
    condition: 'Cloudy',
    high: 12,
    low: 8,
    feelsLike: 9,
    humidity: 70,
  }),
}))

import { generateMetadata } from './page'
import { resetGuardsForTest } from '@/lib/api-guards'

const meta = (query: Record<string, string>) =>
  generateMetadata({ searchParams: Promise.resolve(query) } as never)

describe('generateMetadata', () => {
  beforeEach(() => resetGuardsForTest())

  it('builds the live card for a shared link', async () => {
    const m = await meta({ lat: '48.857', lon: '2.352', name: 'Paris' })
    expect(m.title).toEqual({ absolute: 'Paris — 10°C, Cloudy' })
    expect(m.openGraph?.images).toEqual([
      expect.objectContaining({
        url: expect.stringContaining('/api/og?lat=48.857&lon=2.352'),
      }),
    ])
  })

  it('falls back to the brand card for a bare URL', async () => {
    const m = await meta({})
    expect(m.title).toEqual({ absolute: 'Nice Out' })
  })
})

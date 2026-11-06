import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { proxy } from './proxy'

const at = (method: string) =>
  proxy(new NextRequest('http://x.test/', { method }))

describe('proxy', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('refuses %s', (method) => {
    expect(at(method).status).toBe(405)
  })
  it.each(['GET', 'HEAD', 'OPTIONS'])('passes %s through', (method) => {
    expect(at(method).headers.get('x-middleware-next')).toBe('1')
  })

  const fromSite = (path: string, site?: string) =>
    proxy(
      new NextRequest(`http://x.test${path}`, {
        headers: site ? { 'sec-fetch-site': site } : undefined,
      }),
    )

  it.each([
    '/api/weather?lat=1&lon=1',
    '/api/locationSearch?searchTerm=abc',
    '/api/locationCoordinates?id=abc',
    '/api/locationNameInfo?lat=1&lon=1',
    '/api/anything-added-later',
  ])('refuses %s from another site', (path) => {
    expect(fromSite(path, 'cross-site').status).toBe(403)
    expect(fromSite(path, 'same-site').status).toBe(403)
  })

  it.each([undefined, 'same-origin', 'none'])(
    'lets the app and non-browser clients reach the API (sec-fetch-site: %s)',
    (site) => {
      const res = fromSite('/api/weather?lat=1&lon=1', site)
      expect(res.headers.get('x-middleware-next')).toBe('1')
    },
  )

  it('leaves share cards and pages reachable from other sites', () => {
    for (const path of ['/api/og?lat=1&lon=1', '/?lat=1&lon=1', '/search']) {
      const res = fromSite(path, 'cross-site')
      expect(res.headers.get('x-middleware-next')).toBe('1')
    }
  })
})

import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { middleware } from './middleware'

const at = (method: string) =>
  middleware(new NextRequest('http://x.test/', { method }))

describe('middleware', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('refuses %s', (method) => {
    expect(at(method).status).toBe(405)
  })
  it.each(['GET', 'HEAD', 'OPTIONS'])('passes %s through', (method) => {
    expect(at(method).headers.get('x-middleware-next')).toBe('1')
  })
})

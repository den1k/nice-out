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
})

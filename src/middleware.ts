import { NextRequest, NextResponse } from 'next/server'

// Every route in this app is read-only and it defines no Server Actions, yet
// Next 14 still decodes a multipart POST to any App Router page before checking
// the action ID. Refusing other methods here keeps that decoder unreachable,
// which matters because Next 14 no longer receives fixes for it.
export function middleware(req: NextRequest) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return new NextResponse(null, {
      status: 405,
      headers: { Allow: 'GET, HEAD, OPTIONS' },
    })
  }
  return NextResponse.next()
}

export const config = { matcher: '/((?!_next/static).*)' }

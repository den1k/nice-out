import { NextRequest, NextResponse } from 'next/server'

// Every route in this app is read-only and it defines no Server Actions, so
// nothing should reach the App Router's action decoder. Refusing other methods
// here keeps that attack surface closed regardless of the Next version.
export function proxy(req: NextRequest) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return new NextResponse(null, {
      status: 405,
      headers: { Allow: 'GET, HEAD, OPTIONS' },
    })
  }
  return NextResponse.next()
}

export const config = { matcher: '/((?!_next/static).*)' }

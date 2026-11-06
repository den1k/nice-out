import { NextRequest, NextResponse } from 'next/server'
import { isForeignBrowserRequest } from '@/lib/api-guards'

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
  // The API exists only for this app's own pages. Share cards stay reachable
  // because link previews may load them from anywhere; the og route serves
  // other sites the brand card, which costs no provider call.
  if (
    req.nextUrl.pathname.startsWith('/api/') &&
    req.nextUrl.pathname !== '/api/og' &&
    isForeignBrowserRequest(req.headers)
  ) {
    return new NextResponse(null, { status: 403 })
  }
  return NextResponse.next()
}

export const config = { matcher: '/((?!_next/static).*)' }

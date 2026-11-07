import { HttpError } from '@/utils/httpError'

// Input validation and spend limits for the anonymous routes that call paid
// providers with server-held credentials. Counters live on globalThis because
// Next bundles route handlers and pages separately, and module state would
// otherwise be per-bundle. They are per-process and reset on restart.

// ---- Inputs ----

// The client already rounds to 3 decimals (useWeatherData); the same rounding
// here keeps cache keys bounded and guarantees the output is a plain number,
// safe to place in a provider URL path.
const COORD_DECIMALS = 3

export function normalizeCoords(
  latRaw: string | null | undefined,
  lonRaw: string | null | undefined,
): { lat: string; lon: string } | null {
  if (!latRaw || !lonRaw) return null
  const lat = Number(latRaw)
  const lon = Number(lonRaw)
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    Math.abs(lat) > 90 ||
    Math.abs(lon) > 180
  )
    return null
  const round = (n: number) => String(Number(n.toFixed(COORD_DECIMALS)))
  return { lat: round(lat), lon: round(lon) }
}

export const isValidPlaceId = (id: string | null): id is string =>
  !!id && /^[\w-]{1,1024}$/.test(id)

// ---- Limits ----

const WINDOW_MS = 60_000
const PER_CLIENT_PER_WINDOW = 60
const DAY_MS = 24 * 3600 * 1000

// Ceilings on provider calls per UTC day, across all clients. WeatherKit's
// included tier is 500k calls/month. Autocomplete and Geocoding are billed per
// call, so Google gets the tightest cap.
const DAILY_PROVIDER_BUDGET = {
  weatherkit: 15_000,
  google: 5_000,
  openweathermap: 15_000,
}
export type Provider = keyof typeof DAILY_PROVIDER_BUDGET

// One client's daily share of each ceiling. Without it, the per-minute limit
// alone lets a single IP drain the Google ceiling in under 90 minutes and deny
// that provider to every visitor. Draining now takes at least this many IPs
// per provider. Trade-off: visitors sharing one IP (CGNAT, an office) share an
// allowance, about 80 searches a day on Google.
const CLIENT_SHARE_DIVISOR = 10
const clientAllowance = (provider: Provider) =>
  Math.ceil(DAILY_PROVIDER_BUDGET[provider] / CLIENT_SHARE_DIVISOR)

// Bounds memory if someone cycles IPv6 prefixes. Clearing only forgives
// allowances: the ceilings still hold.
const MAX_TRACKED_CLIENT_SPENDS = 100_000

type GuardState = {
  windowStart: number
  clients: Map<string, number>
  day: number
  spent: Map<Provider, number>
  clientSpent: Map<string, number>
  admittedNames: Set<string>
}

const freshState = (): GuardState => ({
  windowStart: 0,
  clients: new Map(),
  day: 0,
  spent: new Map(),
  clientSpent: new Map(),
  admittedNames: new Set(),
})

const store = globalThis as unknown as { __niceOutGuards?: GuardState }
const state = () => (store.__niceOutGuards ??= freshState())

export const resetGuardsForTest = () => {
  store.__niceOutGuards = freshState()
}

// The leading `count` 16-bit groups of an IPv6 address in any textual form.
// nginx prints the compressed form, where a zero run can sit inside the prefix.
const ipv6Prefix = (ip: string, count: number) => {
  const [head, tail] = ip.split('%')[0].split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const zeros = Array(Math.max(0, 8 - left.length - right.length)).fill('0')
  return [...left, ...zeros, ...right]
    .slice(0, count)
    .map((group) => group.toLowerCase().replace(/^0+(?=.)/, ''))
    .join(':')
}

// nginx sets X-Real-IP to $remote_addr. X-Forwarded-For is client-appendable,
// so it is deliberately not consulted. An IPv6 client owns a whole /64.
const clientKey = (headers: Headers) => {
  const ip = headers.get('x-real-ip') ?? 'unknown'
  if (!ip.includes(':')) return ip
  // IPv4-mapped: the client is the IPv4 address, not the all-zero prefix
  if (ip.includes('.')) return ip.slice(ip.lastIndexOf(':') + 1)
  return ipv6Prefix(ip, 4)
}

export function allowClient(headers: Headers, now = Date.now()): boolean {
  const s = state()
  if (now - s.windowStart >= WINDOW_MS) {
    // Dropping the whole map each window also bounds its size
    s.windowStart = now
    s.clients = new Map()
  }
  const key = clientKey(headers)
  const count = (s.clients.get(key) ?? 0) + 1
  s.clients.set(key, count)
  return count <= PER_CLIENT_PER_WINDOW
}

export const tooManyRequests = () =>
  new Response(JSON.stringify({ error: 'Too many requests' }), {
    status: 429,
    headers: { 'Retry-After': '60' },
  })

// Sec-Fetch-Site is set by browsers and cannot be set by page script. A page on
// another site could otherwise spend the shared ceilings from its visitors'
// IPs. Absent means a non-browser client or an old browser: those pass, and the
// limits above still apply to them. same-site counts as foreign because the app
// only ever calls its own origin, and other vimsical.com subdomains are other apps.
export const isForeignBrowserRequest = (headers: Headers) => {
  const site = headers.get('sec-fetch-site')
  return site === 'cross-site' || site === 'same-site'
}

// Call immediately before each credentialed upstream call. The client is
// required so no new caller can skip its allowance.
export function spendProviderBudget(
  provider: Provider,
  client: Headers,
  now = Date.now(),
) {
  const s = state()
  const day = Math.floor(now / DAY_MS)
  if (day !== s.day) {
    s.day = day
    s.spent = new Map()
    s.clientSpent = new Map()
  }
  const clientSpendKey = `${provider}|${clientKey(client)}`
  const clientSpent = s.clientSpent.get(clientSpendKey) ?? 0
  if (clientSpent >= clientAllowance(provider))
    throw new HttpError('Too many requests today', 429)
  const spent = s.spent.get(provider) ?? 0
  if (spent >= DAILY_PROVIDER_BUDGET[provider])
    throw new HttpError('Daily provider budget reached', 429)
  s.spent.set(provider, spent + 1)
  if (s.clientSpent.size >= MAX_TRACKED_CLIENT_SPENDS) s.clientSpent.clear()
  s.clientSpent.set(clientSpendKey, clientSpent + 1)
}

// ---- OG card names ----

// Characters present in all three bundled Roboto weights. Satori fetches a
// Google Fonts subset for anything else and @vercel/og keeps it in a
// module-level Map forever, keyed by the text. So each distinct name outside
// this set pins memory for the life of the process.
const ROBOTO_ONLY = /^[ -~ -ſ΄-ΊΌΎ-ΡΣ-ώЀ-҆҈-ԓẠ-ỹ‐‑–-―‘-„†-•…]*$/
const NOT_ROBOTO = /[^ -~ -ſ΄-ΊΌΎ-ΡΣ-ώЀ-҆҈-ԓẠ-ỹ‐‑–-―‘-„†-•…]/g
const MAX_NON_ROBOTO_NAMES = 256

// Real non-Latin place names keep rendering until the process has seen
// MAX_NON_ROBOTO_NAMES of them; past that, new ones lose those characters.
export function boundCardName(name: string | null): string | null {
  if (!name || ROBOTO_ONLY.test(name)) return name
  const { admittedNames } = state()
  if (admittedNames.has(name)) return name
  if (admittedNames.size < MAX_NON_ROBOTO_NAMES) {
    admittedNames.add(name)
    return name
  }
  return name.replace(NOT_ROBOTO, '').trim() || null
}

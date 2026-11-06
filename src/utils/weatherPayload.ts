import type { PersistedClient } from '@tanstack/react-query-persist-client'

// Shape checks for forecast data on its way into the persisted query cache.
// That cache never expires and generateGraphData runs on it at every load, so a
// bad entry would otherwise break the app until the visitor clears site data.

const isValidDate = (v: unknown) =>
  (typeof v === 'string' || typeof v === 'number') &&
  Number.isFinite(new Date(v).getTime())

// Sunrise and sunset are absent during polar day and night
const isOptionalDate = (v: unknown) => v == null || isValidDate(v)

const isDatedList = (list: unknown) =>
  Array.isArray(list) &&
  list.length > 0 &&
  list.every((entry) => isValidDate(entry?.forecastStart))

// The provider's response, checked by /api/weather and again by the client,
// because the service worker can answer with a 200 stored before this check
export const isCompleteForecast = (data: any): boolean =>
  !!data?.currentWeather &&
  isDatedList(data.forecastHourly?.hours) &&
  isDatedList(data.forecastDaily?.days)

// The app's own WeatherData, as restored from localStorage
export const isUsableWeatherData = (w: any): boolean =>
  typeof w?.timezone === 'string' &&
  w.timezone !== '' &&
  !!w.current &&
  typeof w.current === 'object' &&
  isDatedList(w.hourly) &&
  isDatedList(w.daily) &&
  w.daily.every(
    (day: any) => isOptionalDate(day.sunrise) && isOptionalDate(day.sunset),
  ) &&
  // useWeatherData calls toFixed on these
  typeof w.location?.coords?.latitude === 'number' &&
  typeof w.location?.coords?.longitude === 'number'

const isRenderableQuery = (q: any) => {
  const key = Array.isArray(q?.queryKey) ? q.queryKey[0] : undefined
  const data = q?.state?.data
  if (typeof key !== 'string' || !data || typeof data !== 'object') return false
  return !key.startsWith('weather-') || isUsableWeatherData(data)
}

// Drops only entries that cannot render. A cache-wide buster would be simpler,
// but saved places live in this cache and visitors would lose them.
export const sanitizePersistedClient = (
  client: PersistedClient | undefined,
): PersistedClient | undefined => {
  const queries = client?.clientState?.queries
  if (!client || !Array.isArray(queries)) return undefined
  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: queries.filter(isRenderableQuery),
    },
  }
}

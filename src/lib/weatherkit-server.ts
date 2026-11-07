import jwt from 'jsonwebtoken'
import { HttpError } from '@/utils/httpError'
import { normalizeCoords, spendProviderBudget } from '@/lib/api-guards'
import { cachedProviderCall, CachePolicy } from '@/lib/provider-cache'
import { isCompleteForecast } from '@/utils/weatherPayload'
import {
  getConvertedTemperature,
  getConvertedWindSpeed,
} from '@/utils/unitConverter'
import { weatherKitConditionCodes } from '@/utils/WeatherKitConditionCodes'
import {
  dayAppleConditionCodesWeatherGradient,
  nightAppleConditionCodesWeatherGradient,
} from '@/hooks/useGradientColorStops'

// Server-side WeatherKit access shared by /api/weather, the home page's
// generateMetadata, and the /api/og card renderer.
// Reference: https://developer.apple.com/documentation/weatherkitrestapi

export async function fetchWeatherKit(
  lat: string,
  lon: string,
  client: Headers,
) {
  // Validated here, at the egress point, so no caller can reach another
  // weatherkit.apple.com path with the operator's token
  const coords = normalizeCoords(lat, lon)
  if (!coords) throw new HttpError('Invalid coordinates', 400)

  if (
    !process.env.PRIVATE_KEY ||
    !process.env.APP_ID ||
    !process.env.TEAM_ID ||
    !process.env.KEY_ID
  )
    throw new HttpError('Missing Credentials', 400)

  // decode the base64 encoded .p8 secret key file stored in PRIVATE_KEY
  const privateKey = Buffer.from(process.env.PRIVATE_KEY, 'base64').toString(
    'ascii',
  )

  // @ts-ignore
  const token = jwt.sign(
    {
      sub: process.env.APP_ID,
    },
    privateKey,
    {
      issuer: process.env.TEAM_ID,
      expiresIn: '10h',
      keyid: process.env.KEY_ID,
      algorithm: 'ES256',
      header: {
        id: process.env.TEAM_ID + '.' + process.env.APP_ID,
      },
    },
  )

  spendProviderBudget('weatherkit', client)

  const url = `https://weatherkit.apple.com/api/v1/weather/en/${coords.lat}/${coords.lon}?dataSets=currentWeather,forecastHourly,forecastDaily`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    // Not the Next data cache: its key includes headers, so the fresh JWT above
    // would write a new on-disk entry per call, and it never evicts.
    // getForecast dedupes in memory instead.
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new HttpError(response.statusText, response.status)
  }

  return response.json()
}

// A day of staleness outlasts any drained ceiling, which clears at UTC midnight.
// A forecast measured 135 KB, so this holds about 740 places.
const FORECAST_CACHE: CachePolicy = {
  name: 'forecast',
  freshMs: 900_000, // match the app's 15-minute weather staleTime
  staleMs: 24 * 3600 * 1000,
  maxBytes: 96 * 1024 * 1024,
}

// The one way to read a forecast, shared by /api/weather, page metadata and the
// share card, so that any of them can reuse a copy fetched by another
export function getForecast(lat: string, lon: string, client: Headers) {
  const coords = normalizeCoords(lat, lon)
  if (!coords) throw new HttpError('Invalid coordinates', 400)
  return cachedProviderCall(
    FORECAST_CACHE,
    `${coords.lat},${coords.lon}`,
    client,
    async () => {
      const data = await fetchWeatherKit(coords.lat, coords.lon, client)
      if (!isCompleteForecast(data))
        throw new HttpError('Incomplete forecast', 502)
      return data
    },
  )
}

// ---- Shareable-link preview card data ----

export type ShareCardParams = {
  lat: string
  lon: string
  name: string | null
  isTempMetric: boolean
  isDistanceMetric: boolean
}

type SearchParamsLike = {
  [key: string]: string | string[] | undefined
}

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v

// Mirrors the client-side readUrlState validation in GlobalContext: both
// coords present, finite, and in range; units default to metric like the app
export function parseShareCardParams(
  searchParams: SearchParamsLike,
): ShareCardParams | null {
  const coords = normalizeCoords(
    first(searchParams.lat),
    first(searchParams.lon),
  )
  if (!coords) return null
  const name = first(searchParams.name)?.trim().slice(0, 60) || null
  return {
    lat: coords.lat,
    lon: coords.lon,
    name,
    isTempMetric: first(searchParams.temp) !== 'f',
    isDistanceMetric: first(searchParams.dist) !== 'mi',
  }
}

export type ShareCardData = {
  name: string | null
  tempUnit: 'C' | 'F'
  windUnit: 'km/h' | 'mph'
  temperature: number
  feelsLike: number
  high: number
  low: number
  humidity: number
  windSpeed: number
  condition: string
  daylight: boolean
  gradient: string[]
}

export async function getShareCardData(
  params: ShareCardParams,
  client: Headers,
): Promise<ShareCardData> {
  const { data: json } = await getForecast(params.lat, params.lon, client)
  const current = json.currentWeather
  const today = json.forecastDaily?.days?.[0]
  if (!current) throw new HttpError('No current weather', 502)

  const convert = (t: number | undefined) =>
    Math.round(getConvertedTemperature(t, params.isTempMetric) ?? 0)
  const daylight = current.daylight ?? true
  const gradientMap = daylight
    ? dayAppleConditionCodesWeatherGradient
    : nightAppleConditionCodesWeatherGradient

  return {
    name: params.name,
    tempUnit: params.isTempMetric ? 'C' : 'F',
    windUnit: params.isDistanceMetric ? 'km/h' : 'mph',
    temperature: convert(current.temperature),
    feelsLike: convert(current.temperatureApparent),
    high: convert(today?.temperatureMax),
    low: convert(today?.temperatureMin),
    humidity: Math.round((current.humidity ?? 0) * 100),
    windSpeed: Math.round(
      getConvertedWindSpeed(current.windSpeed, params.isDistanceMetric) ?? 0,
    ),
    condition:
      weatherKitConditionCodes.find((c) => c.code === current.conditionCode)
        ?.description ?? String(current.conditionCode ?? ''),
    daylight,
    gradient: gradientMap[current.conditionCode] || gradientMap['Cloudy'],
  }
}

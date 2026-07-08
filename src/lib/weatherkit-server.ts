import jwt from 'jsonwebtoken'
import { HttpError } from '@/utils/httpError'
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
  {
    dataSets = 'currentWeather,forecastHourly,forecastDaily',
    revalidate,
  }: { dataSets?: string; revalidate?: number } = {},
) {
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

  const url = `https://weatherkit.apple.com/api/v1/weather/en/${lat}/${lon}?dataSets=${dataSets}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    // Next's data cache keys on the URL, so a revalidate window dedupes the
    // crawler-triggered metadata + og-image fetches for the same coords
    ...(revalidate !== undefined
      ? { next: { revalidate } }
      : { cache: 'no-store' as const }),
  })

  if (!response.ok) {
    throw new HttpError(response.statusText, response.status)
  }

  return response.json()
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
  const latRaw = first(searchParams.lat)
  const lonRaw = first(searchParams.lon)
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
  const name = first(searchParams.name)?.trim().slice(0, 60) || null
  return {
    lat: String(lat),
    lon: String(lon),
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

const CARD_REVALIDATE_SECONDS = 900 // match the app's 15-minute weather staleTime

export async function getShareCardData(
  params: ShareCardParams,
): Promise<ShareCardData> {
  const json = await fetchWeatherKit(params.lat, params.lon, {
    dataSets: 'currentWeather,forecastDaily',
    revalidate: CARD_REVALIDATE_SECONDS,
  })
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

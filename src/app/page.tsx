import type { Metadata } from 'next'
import HomeClient from './components/HomeClient'
import {
  parseShareCardParams,
  getShareCardData,
} from '@/lib/weatherkit-server'

const BASE_URL = 'https://niceout.vimsical.com'

type Props = {
  searchParams: { [key: string]: string | string[] | undefined }
}

// Shared links (/?lat=..&lon=..&name=..&temp=..&dist=..) get live per-location
// OG tags so iMessage/WhatsApp/etc render a weather card; a bare / keeps the
// generic app metadata from the root layout. Reading searchParams makes this
// route server-rendered per request — required for per-link tags, and the
// page itself stays a pure client component.
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const params = parseShareCardParams(searchParams)
  if (!params) return {}
  try {
    const card = await getShareCardData(params)
    const place = card.name || 'Shared forecast'
    const title = `${place} — ${card.temperature}°${card.tempUnit}, ${card.condition}`
    const description = `H ${card.high}° · L ${card.low}° · Feels like ${card.feelsLike}° · Humidity ${card.humidity}% — live weather on Nice Out`

    const shareParams = new URLSearchParams({
      lat: params.lat,
      lon: params.lon,
      temp: params.isTempMetric ? 'c' : 'f',
      dist: params.isDistanceMetric ? 'km' : 'mi',
    })
    if (params.name) shareParams.set('name', params.name)
    const imageUrl = `${BASE_URL}/api/og?${shareParams.toString()}`

    return {
      // absolute: skip the root layout's "%s - PWA" title template
      title: { absolute: title },
      description,
      openGraph: {
        type: 'website',
        siteName: 'Nice Out',
        url: `${BASE_URL}/?${shareParams.toString()}`,
        title: { absolute: title },
        description,
        images: [{ url: imageUrl, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        title: { absolute: title },
        description,
        images: [imageUrl],
      },
    }
  } catch {
    // Never break the page over preview metadata; fall back to layout defaults
    return {}
  }
}

export default function Home() {
  return <HomeClient />
}

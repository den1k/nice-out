import type { Metadata } from 'next'
import { headers } from 'next/headers'
import HomeClient from './components/HomeClient'
import { allowClient } from '@/lib/api-guards'
import {
  parseShareCardParams,
  getShareCardData,
} from '@/lib/weatherkit-server'

const BASE_URL = 'https://niceout.vimsical.com'

type Props = {
  searchParams: { [key: string]: string | string[] | undefined }
}

// Branded tags + card for the bare base URL (and for any metadata failure),
// so https://niceout.vimsical.com/ itself unfurls nicely in messengers
const brandMetadata = (): Metadata => {
  const title = 'Nice Out'
  const description =
    'Is it nice out? A beautiful hour-by-hour forecast, seven days out.'
  const imageUrl = `${BASE_URL}/api/og`
  return {
    title: { absolute: title },
    description,
    openGraph: {
      type: 'website',
      siteName: 'Nice Out',
      url: `${BASE_URL}/`,
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
}

// Shared links (/?lat=..&lon=..&name=..&temp=..&dist=..) get live per-location
// OG tags so iMessage/WhatsApp/etc render a weather card; a bare / gets the
// branded card. Reading searchParams makes this route server-rendered per
// request — required for per-link tags, and the page itself stays a pure
// client component.
export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const params = parseShareCardParams(searchParams)
  if (!params || !allowClient(headers())) return brandMetadata()
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
    // Never break the page over preview metadata
    return brandMetadata()
  }
}

export default function Home() {
  return <HomeClient />
}

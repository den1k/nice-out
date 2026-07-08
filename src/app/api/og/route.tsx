import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  parseShareCardParams,
  getShareCardData,
  ShareCardData,
} from '@/lib/weatherkit-server'

// 1200x630 link-preview card for shared /?lat=..&lon=.. URLs, rendered with
// the app's own gradients and thin Roboto typography. Node runtime is
// required: the WeatherKit JWT signing uses jsonwebtoken.
export const runtime = 'nodejs'

const WIDTH = 1200
const HEIGHT = 630

const loadFont = (file: string) =>
  readFile(path.join(process.cwd(), 'src/assets/fonts', file))

const Chip = ({ label, value }: { label: string; value: string }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      padding: '18px 30px',
      borderRadius: 24,
      background: 'rgba(255,255,255,0.13)',
      border: '1px solid rgba(255,255,255,0.18)',
    }}
  >
    <div
      style={{
        fontSize: 21,
        fontWeight: 400,
        letterSpacing: 2.5,
        textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.62)',
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 40, fontWeight: 300, color: '#ffffff' }}>
      {value}
    </div>
  </div>
)

const Card = ({ card }: { card: ShareCardData }) => {
  const stops = card.gradient.join(', ')
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px 72px 48px',
        backgroundImage: `linear-gradient(to bottom, ${stops})`,
        fontFamily: 'Roboto',
        color: '#ffffff',
      }}
    >
      {/* Soft darkening toward the bottom for depth and text contrast.
          Linear, not radial: satori renders radial stops with a hard edge */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: WIDTH,
          height: HEIGHT,
          backgroundImage:
            'linear-gradient(to bottom, rgba(0,0,0,0.10), rgba(0,0,0,0.16), rgba(0,0,0,0.34))',
        }}
      />

      {/* Top row: place + condition on the left, hero temperature right */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 26,
            maxWidth: 640,
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 300, lineHeight: 1.1 }}>
            {card.name || 'Shared forecast'}
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 400,
              marginTop: 14,
              color: 'rgba(255,255,255,0.72)',
            }}
          >
            {card.condition}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {/* String(): satori errors out on raw number children */}
          <div style={{ fontSize: 260, fontWeight: 100, lineHeight: 1 }}>
            {String(card.temperature)}
          </div>
          <div style={{ display: 'flex', marginTop: 30 }}>
            <div style={{ fontSize: 90, fontWeight: 100 }}>°</div>
            <div style={{ fontSize: 56, fontWeight: 300, marginTop: 10 }}>
              {card.tempUnit}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: detail chips + wordmark */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', gap: 22 }}>
          <Chip label="High / Low" value={`${card.high}° / ${card.low}°`} />
          <Chip label="Feels like" value={`${card.feelsLike}°`} />
          <Chip label="Humidity" value={`${card.humidity}%`} />
          <Chip label="Wind" value={`${card.windSpeed} ${card.windUnit}`} />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 40,
          }}
        >
          <div style={{ fontSize: 34, fontWeight: 300 }}>Nice Out</div>
          <div
            style={{
              fontSize: 25,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            niceout.vimsical.com
          </div>
        </div>
      </div>
    </div>
  )
}

// Weather-less fallback so a bad upstream still yields a branded card
const FallbackCard = ({ name }: { name: string | null }) => (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '56px 72px 48px',
      backgroundImage:
        'linear-gradient(to bottom, #555f6e, #45505d, #414c59, #4e525b, #68534c, #684338)',
      fontFamily: 'Roboto',
      color: '#ffffff',
    }}
  >
    <div style={{ fontSize: 64, fontWeight: 300, marginTop: 26 }}>
      {name || 'Shared forecast'}
    </div>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}
    >
      <div style={{ fontSize: 34, fontWeight: 300 }}>Nice Out</div>
      <div
        style={{
          fontSize: 25,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.55)',
        }}
      >
        niceout.vimsical.com
      </div>
    </div>
  </div>
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const params = parseShareCardParams(
    Object.fromEntries(searchParams.entries()),
  )
  if (!params) {
    return new Response(JSON.stringify({ error: 'Invalid coordinates' }), {
      status: 400,
    })
  }

  const [thin, light, regular] = await Promise.all([
    loadFont('Roboto-Thin.ttf'),
    loadFont('Roboto-Light.ttf'),
    loadFont('Roboto-Regular.ttf'),
  ])
  const options = {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Roboto', data: thin, weight: 100 as const },
      { name: 'Roboto', data: light, weight: 300 as const },
      { name: 'Roboto', data: regular, weight: 400 as const },
    ],
  }

  // Buffer the PNG so satori render errors surface inside the try block —
  // ImageResponse streams lazily and would otherwise fail after we return.
  // Also replace ImageResponse's default year-long immutable Cache-Control:
  // the card shows live weather, so cache it like the app's 15-min staleTime
  const materialize = async (image: ImageResponse) => {
    const headers = new Headers(image.headers)
    headers.set('Cache-Control', 'public, max-age=900, s-maxage=900')
    return new Response(await image.arrayBuffer(), { headers })
  }

  try {
    const card = await getShareCardData(params)
    return await materialize(new ImageResponse(<Card card={card} />, options))
  } catch (error) {
    console.log('og card fallback:', error)
    return materialize(
      new ImageResponse(<FallbackCard name={params.name} />, options),
    )
  }
}

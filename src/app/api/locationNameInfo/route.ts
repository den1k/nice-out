import { HttpError } from '@/utils/httpError'
import {
  allowClient,
  normalizeCoords,
  spendProviderBudget,
  tooManyRequests,
} from '@/lib/api-guards'
import { cachedProviderCall, CachePolicy } from '@/lib/provider-cache'
var tzlookup = require('tz-lookup')

// Place names barely change, and the client keeps its own copy for 30 hours
const NAME_CACHE: CachePolicy = {
  name: 'place-name',
  freshMs: 24 * 3600 * 1000,
  staleMs: 30 * 24 * 3600 * 1000,
  maxBytes: 8 * 1024 * 1024,
}

function timeZoneAt(lat: string, lon: string) {
  try {
    return tzlookup(Number(lat), Number(lon))
  } catch (err) {
    console.log(err)
    return 'Etc/GMT'
  }
}

export async function GET(req: Request) {
  if (!allowClient(req.headers)) return tooManyRequests()
  try {
    const { searchParams } = new URL(req.url)
    if (!process.env.OPEN_WEATHER_MAP_API_KEY)
      throw new HttpError('Missing Open Weather Credentials', 400)

    const coords = normalizeCoords(
      searchParams.get('lat'),
      searchParams.get('lon'),
    )
    if (!coords) throw new HttpError('Invalid coordinates', 400)
    const { lat, lon } = coords

    const lookUpName = async () => {
      spendProviderBudget('openweathermap', req.headers)
      const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${process.env.OPEN_WEATHER_MAP_API_KEY}`

      // get the data
      const response = await fetch(url, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new HttpError(response.statusText, response.status)
      }

      // get the JSON data
      const json = await response.json()
      if (!json[0]) throw new HttpError('No place found', 502)
      return json[0]
    }

    let place
    try {
      place = (
        await cachedProviderCall(
          NAME_CACHE,
          `${lat},${lon}`,
          req.headers,
          lookUpName,
        )
      ).data
    } catch (error) {
      // The forecast only needs a label. Without one, a GPS visitor would get no
      // weather at all, so a drained or failing name provider falls back to the
      // coordinates. degraded tells the client to ask again soon.
      if (!(error instanceof HttpError)) console.error(error)
      place = { name: `${lat}, ${lon}`, degraded: true }
    }

    // // return the data to your front end
    return Response.json(
      { ...place, timeZone: timeZoneAt(lat, lon) },
      { status: 200 },
    )
  } catch (error) {
    let errorMessage = 'An unknown error occurred'
    let status = 500

    if (error instanceof HttpError) {
      errorMessage = error.message
      status = error.status
    } else {
      console.error(error)
    }

    return new Response(JSON.stringify({ error: errorMessage }), { status })
  }
}

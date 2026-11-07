import { HttpError } from '@/utils/httpError'
import {
  allowClient,
  isValidPlaceId,
  spendProviderBudget,
  tooManyRequests,
} from '@/lib/api-guards'
import { cachedProviderCall, CachePolicy } from '@/lib/provider-cache'

// A place id's coordinates do not move. Google allows keeping them 30 days.
const PLACE_CACHE: CachePolicy = {
  name: 'place',
  freshMs: 24 * 3600 * 1000,
  staleMs: 30 * 24 * 3600 * 1000,
  maxBytes: 8 * 1024 * 1024,
}

async function lookUpPlace(googleLocationID: string, client: Headers) {
  spendProviderBudget('google', client)

  const fetchCoords = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?place_id=${googleLocationID}&key=${process.env.GOOGLE_API}`,
  )
    .then((response) => {
      return response.json()
    })
    .then((res) => res.results[0])
    .catch((error) => {
      console.log(error)
    })

  const { geometry, address_components } = fetchCoords
  const cityName = address_components.find(
    (component: { types: string | string[] }) => {
      return component.types.includes('locality')
    },
  )?.long_name
  const subLocalityName = address_components.find(
    (component: { types: string | string[] }) => {
      return component.types.includes('sublocality')
    },
  )?.long_name
  const countryName = address_components.find(
    (component: { types: string | string[] }) => {
      return component.types.includes('country')
    },
  )?.long_name
  const coords = {
    latitude: geometry.location.lat,
    longitude: geometry.location.lng,
  }
  return {
    coords,
    name: cityName || subLocalityName || countryName,
    googleLocationID,
    isCurrentlocation: false,
  }
}

export async function GET(req: Request) {
  if (!allowClient(req.headers)) return tooManyRequests()
  try {
    const { searchParams } = new URL(req.url)
    const googleLocationID = searchParams.get('id')
    if (!isValidPlaceId(googleLocationID))
      throw new HttpError('Invalid place id', 400)

    if (!process.env.GOOGLE_API)
      throw new HttpError('Missing Open Weather Credentials', 400)

    const { data } = await cachedProviderCall(
      PLACE_CACHE,
      googleLocationID,
      req.headers,
      () => lookUpPlace(googleLocationID, req.headers),
    )

    // // return the data to your front end
    return Response.json(data, { status: 200 })
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

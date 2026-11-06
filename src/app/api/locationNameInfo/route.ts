import { HttpError } from '@/utils/httpError'
import {
  allowClient,
  normalizeCoords,
  spendProviderBudget,
  tooManyRequests,
} from '@/lib/api-guards'
var tzlookup = require('tz-lookup')

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
    const data = await response.json()
    let locationTimeZone = ''
    try {
      locationTimeZone = tzlookup(Number(lat), Number(lon))
    } catch (err) {
      console.log(err)
      locationTimeZone = 'Etc/GMT'
    }

    data[0]['timeZone'] = locationTimeZone

    // // return the data to your front end
    return Response.json(data[0], { status: 200 })
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

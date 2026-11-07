import { HttpError } from '@/utils/httpError'
import { allowClient, normalizeCoords, tooManyRequests } from '@/lib/api-guards'
import { getForecast } from '@/lib/weatherkit-server'

export async function GET(req: Request) {
  if (!allowClient(req.headers)) return tooManyRequests()
  try {
    const { searchParams } = new URL(req.url)
    const coords = normalizeCoords(
      searchParams.get('lat'),
      searchParams.get('lon'),
    )
    if (!coords) throw new HttpError('Invalid coordinates', 400)

    const { data, stale } = await getForecast(
      coords.lat,
      coords.lon,
      req.headers,
    )

    // // return the data to your front end
    return Response.json(data, {
      status: 200,
      headers: stale ? { 'X-Data-Stale': '1' } : undefined,
    })
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

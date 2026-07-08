import { HttpError } from '@/utils/httpError'
import { fetchWeatherKit } from '@/lib/weatherkit-server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = searchParams.get('lat')
    const lon = searchParams.get('lon')
    if (!lat || !lon) throw new HttpError('Missing coordinates', 400)

    const data = await fetchWeatherKit(lat, lon)

    // // return the data to your front end
    return Response.json(data, { status: 200 })
  } catch (error) {
    let errorMessage = 'An unknown error occurred'
    let status = 500

    if (error instanceof HttpError) {
      errorMessage = error.message
      status = error.status
    } else if (error instanceof Error) {
      errorMessage = error.message
    }

    return new Response(JSON.stringify({ error: errorMessage }), { status })
  }
}

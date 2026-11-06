import { HttpError } from '@/utils/httpError'
import {
  allowClient,
  spendProviderBudget,
  tooManyRequests,
} from '@/lib/api-guards'

const MIN_TERM_LENGTH = 2 // the search page only queries past 2 characters
const MAX_TERM_LENGTH = 100

export async function GET(req: Request) {
  if (!allowClient(req.headers)) return tooManyRequests()
  try {
    const { searchParams } = new URL(req.url)
    const searchTerm = searchParams.get('searchTerm')?.trim() ?? ''
    if (searchTerm.length < MIN_TERM_LENGTH) return Response.json([])
    if (searchTerm.length > MAX_TERM_LENGTH)
      throw new HttpError('Search term too long', 400)

    if (!process.env.GOOGLE_API)
      throw new HttpError('Missing Open Weather Credentials', 400)

    spendProviderBudget('google')

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(searchTerm)}&types=locality|postal_code|sublocality|country&key=${process.env.GOOGLE_API}`

    // get the data
    const response = await fetch(url, {
      method: 'GET',
    })

    if (!response.ok) {
      throw new HttpError(response.statusText, response.status)
    }

    // get the JSON data
    const data = await response.json()

    // // return the data to your front end
    return Response.json(data.predictions, { status: 200 })
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

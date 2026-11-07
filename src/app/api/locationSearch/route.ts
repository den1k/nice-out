import { HttpError } from '@/utils/httpError'
import {
  allowClient,
  spendProviderBudget,
  tooManyRequests,
} from '@/lib/api-guards'
import { cachedProviderCall, CachePolicy } from '@/lib/provider-cache'

// Kept in memory for at most a day. The Google Maps terms limit storing Places
// results, so remove this wrapper if that matters more than surviving a drained
// ceiling.
const SEARCH_CACHE: CachePolicy = {
  name: 'search',
  freshMs: 3600 * 1000,
  staleMs: 24 * 3600 * 1000,
  maxBytes: 16 * 1024 * 1024,
}

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

    const { data } = await cachedProviderCall(
      SEARCH_CACHE,
      searchTerm.toLowerCase(),
      req.headers,
      async () => {
        spendProviderBudget('google', req.headers)

        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(searchTerm)}&types=locality|postal_code|sublocality|country&key=${process.env.GOOGLE_API}`

        // get the data
        const response = await fetch(url, {
          method: 'GET',
        })

        if (!response.ok) {
          throw new HttpError(response.statusText, response.status)
        }

        // get the JSON data
        const json = await response.json()

        // Google reports quota and key errors as 200 with no predictions
        if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS')
          throw new HttpError('Search provider error', 502)

        return json.predictions
      },
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

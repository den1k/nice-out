// Both return null on any failure (rate limit, provider error, network), so the
// search page can tell "failed" apart from "no matches" and never treats an
// error body as a result.

export const fetchSearchLocations = async (searchTerm: string | null) => {
  try {
    const response = await fetch(
      `/api/locationSearch?searchTerm=${encodeURIComponent(searchTerm ?? '')}`,
    )
    if (!response.ok) return null
    const results = await response.json()
    return Array.isArray(results) ? results : null
  } catch (error) {
    console.log(error)
    return null
  }
}

export const fetchLocationCoordinates = async (id: string | null) => {
  try {
    const response = await fetch(
      `/api/locationCoordinates?id=${encodeURIComponent(id ?? '')}`,
    )
    if (!response.ok) return null
    const place = await response.json()
    return Number.isFinite(place?.coords?.latitude) &&
      Number.isFinite(place?.coords?.longitude)
      ? place
      : null
  } catch (error) {
    console.log(error)
    return null
  }
}

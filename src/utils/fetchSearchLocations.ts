export const fetchSearchLocations = async (searchTerm: string | null) => {
  const result = await fetch(
    `/api/locationSearch?searchTerm=${encodeURIComponent(searchTerm ?? '')}`,
  )
    .then((response) => {
      // The search page expects an array; an error body would crash its filter
      return response.ok ? response.json() : []
    })
    .then((res) => {
      return res
    })
    .catch((error) => {
      console.log(error)
    })
  return result
}

export const fetchLocationCoordinates = async (id: string | null) => {
  const result = await fetch(
    `/api/locationCoordinates?id=${encodeURIComponent(id ?? '')}`,
  )
    .then((response) => {
      return response.json()
    })
    .then((res) => {
      return res
    })
    .catch((error) => {
      console.log(error)
    })
  return result
}

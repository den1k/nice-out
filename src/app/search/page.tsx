'use client'
import Background from '../components/Background'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { fetchSearchLocations } from '@/utils/fetchSearchLocations'
import { cachedLocation } from '@/types/weatherKit'
import { fetchLocationCoordinates } from '@/utils/fetchSearchLocations'
import { useWeatherData } from '@/hooks/useWeatherData'
import { useRouter } from 'next/navigation'
import { useCachedLocations } from '@/hooks/useGetCachedLocations'
import { useGlobalContext } from '@/lib/GlobalContext'
import { roboto } from '@/app/fonts'
import clsx from 'clsx'

const SearchIcon = ({ className }: { className?: string }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.2-3.2" />
  </svg>
)

const PinIcon = ({ className }: { className?: string }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="2.6" />
  </svg>
)

const ChevronIcon = ({ className }: { className?: string }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="m9 6 6 6-6 6" />
  </svg>
)

const CloseGlyph = ({ className }: { className?: string }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

const Search = () => {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([{ description: '' }])
  const [newLocation, setnewLocation] = useState<any>(null)
  const [selecting, setSelecting] = useState(false)
  const { activeLocationId, initialGradient } = useGlobalContext()

  const cachedLocations = useCachedLocations({ activeLocationId })

  useEffect(() => {
    if (searchTerm?.split('').length === 0) {
      setSearchResults([{ description: '' }])
    } else if (searchTerm?.split('').length > 2) {
      ;(async () => {
        const result = await fetchSearchLocations(searchTerm)
        setSearchResults(result)
      })()
    }
  }, [searchTerm])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value)
  }

  const clearSearch = () => {
    setSearchTerm('')
    setSearchResults([{ description: '' }])
  }

  const handleSelection = async (r: {
    description?: string
    place_id?: any
  }) => {
    const isItSaved = cachedLocations?.find(
      (location: cachedLocation) =>
        location?.queryData?.googleLocationID === r.place_id,
    )

    if (!isItSaved) {
      setSelecting(true)
      const details = await fetchLocationCoordinates(r.place_id)
      setnewLocation(details)
    } else {
      router.push('/locations')
    }
  }

  const { data, isLoading } = useWeatherData({
    location: newLocation,
  })

  useEffect(() => {
    if (!isLoading && newLocation && data) {
      router.push('/locations')
    }
  }, [newLocation, router, isLoading, data])

  const results = searchResults?.filter((r) => r?.description)
  const hasResults = results && results.length > 0
  const isSearching = searchTerm.trim().length > 2

  return (
    <main className="relative flex h-svh flex-col overflow-hidden text-white">
      <div className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col px-5 pt-8 md:px-7">
        {/* Title bar */}
        <header className="animate-fade-in mb-6 flex items-start justify-between">
          <div>
            <h1
              className={clsx(
                roboto.className,
                'text-[2.75rem] font-thin leading-none tracking-tight',
              )}
            >
              Add place
            </h1>
            <p className="mt-2 text-sm font-light text-white/50">
              Search for a city or ZIP code
            </p>
          </div>
          <Link
            href="/locations"
            aria-label="Cancel"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/10 transition-all hover:bg-white/20 active:scale-90"
          >
            <CloseGlyph className="h-[26px] w-[26px]" />
          </Link>
        </header>

        {/* Search field */}
        <div className="animate-fade-in relative mb-5">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45" />
          <input
            type="text"
            autoFocus
            inputMode="search"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.07] py-4 pl-12 pr-12 text-[17px] font-light text-white shadow-lg shadow-black/10 backdrop-blur-xl transition-all placeholder:text-white/40 focus:border-white/20 focus:bg-white/[0.1] focus:outline-none focus:ring-2 focus:ring-white/25"
            placeholder="Type a city or zip"
            value={searchTerm}
            onChange={handleChange}
          />
          {searchTerm.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            >
              <CloseGlyph className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Results / empty states */}
        <div className="flex-1 overflow-y-auto pb-12">
          {hasResults ? (
            <div className="animate-fade-in divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur-xl">
              {results.map((r, i) => (
                <button
                  key={`${r?.description}-${i}`}
                  type="button"
                  onClick={() => handleSelection(r)}
                  className="group flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-white/10 active:bg-white/[0.14]"
                >
                  <PinIcon className="shrink-0 text-white/45 transition-colors group-hover:text-white/80" />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-light text-white/90">
                    {r?.description}
                  </span>
                  <ChevronIcon className="shrink-0 text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-white/60" />
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-16 flex flex-col items-center px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.07] ring-1 ring-inset ring-white/10">
                <SearchIcon className="h-7 w-7 text-white/40" />
              </div>
              <p className="mt-5 text-[17px] font-light text-white/80">
                {isSearching ? 'No matches found' : 'Find your weather'}
              </p>
              <p className="mt-1.5 max-w-[16rem] text-sm font-light leading-relaxed text-white/45">
                {isSearching
                  ? `We couldn't find a place for “${searchTerm.trim()}”. Try another spelling.`
                  : 'Start typing a city name or ZIP code to add it to your locations.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Loading overlay while fetching the selected place's forecast */}
      {selecting && (
        <div className="animate-fade-in fixed inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-full bg-white/10 px-6 py-3.5 ring-1 ring-inset ring-white/15 backdrop-blur-xl">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <span className="text-sm font-light text-white/90">
              Getting the forecast…
            </span>
          </div>
        </div>
      )}

      <Background
        icon={''}
        id="search-chart-bg-gradient"
        isItDay
        colors={initialGradient}
      />
      {/* Soft vignette for depth over the gradient */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_-10%,transparent_45%,rgba(0,0,0,0.38)_100%)]" />
    </main>
  )
}

export default Search

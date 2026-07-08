'use client'
import Background from '../components/Background'
import { useGlobalContext } from '@/lib/GlobalContext'
import WeatherIcon from '../components/Icon'
import { LocationInfoCard } from '../components/LocationInfoCard'
import SettingsPanel from '../components/SettingsPanel'
import InstallCTA from '../components/InstallCTA'
import Link from 'next/link'
import { cachedLocation } from '@/types/weatherKit'
import { useCachedLocations } from '@/hooks/useGetCachedLocations'
import { useState } from 'react'
import { QueryKey, useQueryClient } from '@tanstack/react-query'
import { roboto } from '@/app/fonts'
import clsx from 'clsx'

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
    {children}
  </div>
)

const Locations = () => {
  const { isTempMetric, activeLocationId, setActiveLocationId, initialGradient } =
    useGlobalContext()
  const [update, setUpdate] = useState(false)
  const cachedLocations = useCachedLocations({ activeLocationId, update })
  const [isEditing, setIsEditing] = useState(false)
  const queryClient = useQueryClient()

  const handleRemoval = (
    queryKey: QueryKey,
    e: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    e.stopPropagation()

    setTimeout(() => {
      queryClient.removeQueries({ queryKey, exact: true })
      setActiveLocationId(cachedLocations?.[0]?.queryData?.locationId)
      setUpdate((p) => !p)
    }, 500)
  }

  // Copy before sorting so the GPS location floats to the top without mutating state
  const sortedLocations = cachedLocations
    ?.slice()
    .sort(
      (a, b) =>
        Number(b.queryData.isGPSLocation) - Number(a.queryData.isGPSLocation),
    )

  const canEdit = !!sortedLocations && sortedLocations.length > 1

  return (
    <main className="relative flex h-svh flex-col overflow-hidden text-white">
      <div className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col overflow-y-auto px-5 pb-14 pt-8 md:px-7">
        {/* Title bar */}
        <header className="animate-fade-in mb-9 flex items-start justify-between">
          <div>
            <h1
              className={clsx(
                roboto.className,
                'text-[2.75rem] font-thin leading-none tracking-tight',
              )}
            >
              Settings
            </h1>
          </div>
          <Link
            href="/"
            aria-label="Close settings"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/10 transition-all hover:bg-white/20 active:scale-90"
          >
            <WeatherIcon
              icon={'close'}
              x={0}
              y={0}
              width={26}
              height={26}
              viewBox="6 6 20 20"
            />
          </Link>
        </header>

        {/* Units */}
        <section className="animate-fade-in mb-9">
          <div className="mb-3 px-1">
            <SectionLabel>Units</SectionLabel>
          </div>
          <SettingsPanel />
        </section>

        {/* Add to Home Screen (hidden when already installed) */}
        <InstallCTA />

        {/* Locations */}
        <section className="animate-fade-in">
          <div className="mb-3 flex items-center justify-between px-1">
            <SectionLabel>Locations</SectionLabel>
            {canEdit ? (
              <button
                onClick={() => setIsEditing((prev) => !prev)}
                className="text-[13px] font-medium text-white/70 transition-colors hover:text-white"
              >
                {isEditing ? 'Done' : 'Edit'}
              </button>
            ) : null}
          </div>

          <Link
            href="/search"
            className="group mb-3 flex items-center gap-3.5 rounded-2xl border border-dashed border-white/20 bg-white/[0.04] px-5 py-4 transition-all hover:border-white/30 hover:bg-white/[0.08]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition-transform group-hover:scale-105 group-active:scale-95">
              <WeatherIcon
                icon={'plus'}
                x={0}
                y={0}
                width={22}
                height={22}
                viewBox="6 6 20 20"
              />
            </span>
            <span className="text-[15px] font-medium">Add a location</span>
          </Link>

          <div className="flex flex-col gap-3">
            {sortedLocations?.map((location: cachedLocation, i: number) => (
              <LocationInfoCard
                key={location.queryKey[0]}
                location={location}
                isUnitMetric={isTempMetric}
                setActiveLocationId={setActiveLocationId}
                isEditing={isEditing}
                handleRemoval={handleRemoval}
                isActive={location.queryData.locationId === activeLocationId}
                i={i}
              />
            ))}
          </div>
        </section>
      </div>

      <Background
        icon={''}
        id="locations-chart-bg-gradient"
        isItDay
        colors={initialGradient}
      />
      {/* Soft vignette for depth over the gradient */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(120%_80%_at_50%_-10%,transparent_45%,rgba(0,0,0,0.38)_100%)]" />
    </main>
  )
}

export default Locations

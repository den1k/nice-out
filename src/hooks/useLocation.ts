import { useState, useEffect } from 'react'
import { GeoLocationData } from '@/types/weatherKit'

export const useLocation = () => {
  const [location, setLocation] = useState<GeoLocationData | null>(null)

  useEffect(() => {
    if (!location) {
      navigator.geolocation.getCurrentPosition(
        ({ coords, timestamp }) => {
          if (coords) {
            const gpsLocation = { coords, timestamp, isGPSLocation: true }
            setLocation(gpsLocation)
          }
        },
        (err) => {
          console.error('Error getting location', err)
        },
      )
    }
  }, [location])

  return location
}

import React, { useState } from 'react'
import Temperature from './Temperature'
import WeatherInfoDisplay from './WeatherInfoDisplay'
import { useGlobalContext } from '@/lib/GlobalContext'
import WeatherIcon from '../Icon'
import Link from 'next/link'
import 'moment'
import 'moment/min/locales'
import moment from 'moment-timezone'

const Header = () => {
  const { currentDay, graphData, weatherData } = useGlobalContext()

  const currentDate = currentDay?.sunset
    ? moment
        .tz(currentDay.sunset, weatherData?.timezone ?? '')
        .format('MMMM DD')
    : ''
  if (!graphData) return null

  return (
    <div className="animate-fade-in fixed top-0 z-10 flex w-full flex-wrap items-center justify-between p-4 md:p-6 lg:p-10">
      <div className="mb-[calc(2rem, 2vh)] relative flex w-full items-center justify-start">
        <Link
          href="/locations"
          aria-label="Settings and locations"
          className="absolute right-0 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[#00000026] text-white transition-all hover:bg-[#00000040] active:scale-90"
        >
          <WeatherIcon
            icon={'settings'}
            x={0}
            y={0}
            width={24}
            height={24}
            viewBox="0 0 24 24"
          />
        </Link>
        <div className="flex w-full flex-1 flex-col items-center">
          <div className="md:text-md text-sm font-medium text-white">
            {currentDate}
          </div>
          <div className="text-xl font-medium text-white md:text-3xl">
            {weatherData?.locationName}
          </div>
        </div>
      </div>
      <div className="flex w-full justify-between">
        <div className="flex flex-1 items-center justify-start">
          <Temperature />
        </div>
        <div className="flex flex-1 items-center justify-end">
          <WeatherInfoDisplay />
        </div>
      </div>
    </div>
  )
}

export default Header

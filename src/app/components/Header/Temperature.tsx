import React, { useState, useRef, useEffect } from 'react'
import { useGlobalContext } from '@/lib/GlobalContext'
import WeatherIcon from '../Icon'
import clsx from 'clsx'
import { roboto } from '@/app/fonts'
import ChipButton from '@/app/components/common/ChipButton'
import 'moment'
import 'moment/min/locales'
import moment from 'moment-timezone'

const FEELS_LIKE_KEY = 'isFeelsLikeTemperature'

const Temperature = () => {
  const [isFeelsLikeTemperature, setIsFeelsLikeTemperature] = useState(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem(FEELS_LIKE_KEY)
    return saved === 'true'
  })
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)
  const [longPressTriggered, setLongPressTriggered] = useState(false)
  const {
    temperatureData,
    isTempMetric,
    setIsTempMetric,
    containerRef,
    graphData,
    weatherData,
  } = useGlobalContext()
  const {
    temperature,
    feelsLikeTemperature,
    currentDayMaxTemp,
    currentDayMinTemp,
    currentDayFeelsLikeMaxTemp,
    currentDayFeelsLikeMinTemp,
  } = temperatureData

  const formattedTemperature = (temperature: number | undefined) => {
    if (temperature !== undefined) {
      return Math.round(temperature)
    }
    return '-'
  }

  const displayTemperature = isFeelsLikeTemperature
    ? formattedTemperature(feelsLikeTemperature)
    : formattedTemperature(temperature)

  // Scale the hero number down as it gets wider so a 3-digit reading
  // (e.g. 100°F, or a negative like -12°) never overflows the fixed-width
  // Temperature column. Sizes are tuned so 3 digits occupy the same footprint
  // a 2-digit value does today.
  const heroSizeClass =
    String(displayTemperature).length >= 4
      ? 'text-6xl md:text-7xl'
      : String(displayTemperature).length === 3
        ? 'text-[5rem] md:text-8xl'
        : 'text-[7.5rem] md:text-9xl'

  const handleTemperatureTypeChange = () => {
    setIsFeelsLikeTemperature((prev) => !prev)
  }

  // Update localStorage when isFeelsLikeTemperature changes
  useEffect(() => {
    localStorage.setItem(FEELS_LIKE_KEY, String(isFeelsLikeTemperature))
  }, [isFeelsLikeTemperature])

  // Start long press detection
  const handleMouseDown = () => {
    setLongPressTriggered(false)
    longPressTimer.current = setTimeout(() => {
      setLongPressTriggered(true)
      setIsTempMetric((prev) => !prev)
    }, 500)
  }

  // Clear the timer on mouse up
  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // Handle onClick only if it's not a long press
  const handleClick = () => {
    containerRef.current?.scrollTo({
      left:
        graphData?.scaleX(
          moment.tz(moment(), weatherData?.timezone ?? '').valueOf() ?? 0,
        ) ?? 0,
      behavior: 'smooth',
    })
  }

  return (
    <div className="flex min-w-40 max-w-40 animate-[slide-in-left_0.5s_ease-in-out_forwards] flex-col items-center text-white transition-transform md:min-w-60">
      <div
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        className={clsx(
          roboto.className,
          'flex cursor-pointer gap-0 font-thin md:gap-1',
        )}
      >
        <div className={clsx(heroSizeClass, 'leading-none transition-all')}>
          {displayTemperature}
        </div>
        <div className="relative top-2 flex items-start leading-none">
          <span className="text-5xl md:text-6xl">°</span>
          <span className="text-3xl font-light md:text-4xl">
            {isTempMetric ? 'C' : 'F'}
          </span>
        </div>
      </div>
      <div className="flex justify-between gap-3">
        <div className="flex items-center gap-1">
          <div className="flex items-center">
            <WeatherIcon
              icon={'min'}
              x={0}
              y={0}
              width={16}
              height={16}
              viewBox="0 0 24 24"
            />
            <div className="text-sm font-medium md:text-xl">
              {isFeelsLikeTemperature
                ? formattedTemperature(currentDayFeelsLikeMaxTemp)
                : formattedTemperature(currentDayMaxTemp)}
            </div>
          </div>
          <div className="flex items-center">
            <WeatherIcon
              icon={'max'}
              x={0}
              y={0}
              width={16}
              height={16}
              viewBox="0 0 24 24"
            />
            <div className="text-sm font-medium md:text-xl">
              {isFeelsLikeTemperature
                ? formattedTemperature(currentDayFeelsLikeMinTemp)
                : formattedTemperature(currentDayMinTemp)}
            </div>
          </div>
        </div>
        <ChipButton onClick={handleTemperatureTypeChange}>
          {isFeelsLikeTemperature ? 'Feels Like' : 'Temperature'}
        </ChipButton>
      </div>
    </div>
  )
}

export default Temperature

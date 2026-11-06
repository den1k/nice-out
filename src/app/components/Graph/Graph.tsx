import React, { useEffect } from 'react'
import { useGlobalContext } from '@/lib/GlobalContext'
import DayBreaks from './DayBreaks'
import TemperatureChart from './TemperatureChart'
import PopChart from './PopChart'
import Loader from '../Loader'

const Graph = () => {
  const { graphData, handleAnimation, error } = useGlobalContext()

  useEffect(() => {
    handleAnimation()
  }, [handleAnimation])

  if (!graphData) {
    return (
      <div className="grid h-full place-items-center">
        {error ? (
          <p
            role="alert"
            className="px-8 text-center text-sm font-light text-white/90"
          >
            The forecast is unavailable right now. Try again in a minute.
          </p>
        ) : (
          <Loader />
        )}
      </div>
    )
  }

  return (
    <div className="animate-fade-in relative mx-[50%] w-fit">
      <DayBreaks className="" />
      <TemperatureChart className="overflow-visible" />
      <PopChart className="" />
    </div>
  )
}

export default Graph

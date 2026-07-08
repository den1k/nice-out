'use client'

import { useGlobalContext } from '@/lib/GlobalContext'
import Background from './Background'
import Graph from './Graph/Graph'
import Header from './Header'
import Footer from './Footer'
import AnimatedBackground from './AnimatedBackground'
import { useState } from 'react'

export default function HomeClient() {
  const {
    isItDay,
    timestamp,
    handleAnimation,
    containerRef,
    graphData,
    weatherData,
    savedCurrentDayBreaks,
    initialGradient,
  } = useGlobalContext()

  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [startX, setStartX] = useState<number>(0)
  const [scrollLeft, setScrollLeft] = useState<number>(0)

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return
    setIsDragging(true)
    setStartX(e.pageX - containerRef.current.offsetLeft)
    setScrollLeft(containerRef?.current?.scrollLeft)
  }

  const handleMouseLeave = () => {
    setIsDragging(false)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef?.current) {
      return
    }
    e.preventDefault()
    const x = e.pageX - containerRef?.current?.offsetLeft
    const walk = (x - startX) * 1 // Scroll-fast (adjust multiplier for speed)
    containerRef.current.scrollLeft = scrollLeft - walk // Scroll the container
  }

  return (
    <main
      ref={containerRef}
      onScroll={handleAnimation}
      className="flex h-svh select-none flex-col justify-end overflow-y-hidden overflow-x-scroll"
      id="scroll1px"
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      <Header />
      <Graph />
      <Footer />
      {weatherData?.hourly ? (
        <AnimatedBackground
          icon={timestamp.icon}
          id="chart-bg-gradient"
          isItDay={isItDay}
          containerRef={containerRef}
          graphData={graphData}
          weatherData={weatherData}
          savedCurrentDayBreaks={savedCurrentDayBreaks}
          initialGradient={initialGradient}
          timestamp={timestamp}
        />
      ) : (
        <Background
          icon={timestamp.icon}
          id="chart-bg-gradient"
          isItDay={isItDay}
        />
      )}
    </main>
  )
}

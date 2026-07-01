'use client'
import React from 'react'
import clsx from 'clsx'
import { motion } from 'framer-motion'
import { useGlobalContext } from '@/lib/GlobalContext'

interface SegmentOption {
  label: string
  value: boolean
}

interface SegmentedToggleProps {
  layoutId: string
  value: boolean
  options: [SegmentOption, SegmentOption]
  onChange: (value: boolean) => void
}

const SegmentedToggle: React.FC<SegmentedToggleProps> = ({
  layoutId,
  value,
  options,
  onChange,
}) => {
  return (
    <div className="flex shrink-0 items-center rounded-full bg-black/25 p-1">
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onChange(option.value)}
            className="relative flex min-w-[3.25rem] items-center justify-center rounded-full px-3 py-1.5 text-[13px] leading-none transition-colors"
          >
            {isActive && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 440, damping: 36 }}
                className="absolute inset-0 rounded-full bg-white/25 shadow-sm shadow-black/20 ring-1 ring-inset ring-white/10"
              />
            )}
            <span
              className={clsx(
                'relative z-10 font-medium transition-colors',
                isActive ? 'text-white' : 'text-white/45',
              )}
            >
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const ThermometerIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M14 14.76V5a2 2 0 0 0-4 0v9.76a4 4 0 1 0 4 0Z" />
  </svg>
)

const WindIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M9.6 4.6A2 2 0 1 1 11 8H2" />
    <path d="M12.6 19.4A2 2 0 1 0 14 16H2" />
    <path d="M17.7 7.7A2.5 2.5 0 1 1 19.5 12H2" />
  </svg>
)

const UnitRow: React.FC<{
  icon: React.ReactNode
  label: string
  caption: string
  children: React.ReactNode
}> = ({ icon, label, caption, children }) => (
  <div className="flex items-center justify-between gap-3 px-5 py-4">
    <div className="flex min-w-0 items-center gap-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/80">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-[15px] font-medium leading-none text-white">
          {label}
        </span>
        <span className="truncate text-[11px] uppercase tracking-[0.12em] text-white/40">
          {caption}
        </span>
      </div>
    </div>
    {children}
  </div>
)

const SettingsPanel = () => {
  const {
    isTempMetric,
    setIsTempMetric,
    isDistanceMetric,
    setIsDistanceMetric,
  } = useGlobalContext()

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07] shadow-lg shadow-black/10 backdrop-blur-xl">
      <UnitRow
        icon={<ThermometerIcon />}
        label="Temperature"
        caption="Degrees"
      >
        <SegmentedToggle
          layoutId="temp-unit-toggle"
          value={isTempMetric}
          onChange={setIsTempMetric}
          options={[
            { label: '°C', value: true },
            { label: '°F', value: false },
          ]}
        />
      </UnitRow>
      <div className="mx-5 h-px bg-white/10" />
      <UnitRow icon={<WindIcon />} label="Distance" caption="Speed & rainfall">

        <SegmentedToggle
          layoutId="distance-unit-toggle"
          value={isDistanceMetric}
          onChange={setIsDistanceMetric}
          options={[
            { label: 'Metric', value: true },
            { label: 'Imperial', value: false },
          ]}
        />
      </UnitRow>
    </div>
  )
}

export default SettingsPanel

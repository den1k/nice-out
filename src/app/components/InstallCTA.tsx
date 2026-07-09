import React, { useState } from 'react'
import { useDeviceAndVersion } from '@/utils/useDeviceAndVersion'
import CustomPrompt from './CustomPrompt'

const PhoneIcon = () => (
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
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </svg>
)

// "Add to Home Screen" section for the Settings page. Renders nothing when
// the app is already running installed (standalone); opening the sheet is
// the ONLY way the install instructions appear anywhere in the app.
const InstallCTA = () => {
  const { isStandalone } = useDeviceAndVersion()
  const [showPrompt, setShowPrompt] = useState(false)

  if (isStandalone !== false) return null

  return (
    <section className="animate-fade-in mb-9">
      <div className="mb-3 px-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
          App
        </div>
      </div>
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.07] shadow-lg shadow-black/10 backdrop-blur-xl">
        <button
          type="button"
          onClick={() => setShowPrompt(true)}
          className="group flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-white/[0.06] active:bg-white/[0.1]"
        >
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/80">
              <PhoneIcon />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[15px] font-medium leading-snug text-white">
                Add to Home Screen
              </span>
              <span className="text-[11px] uppercase leading-snug tracking-[0.12em] text-white/40">
                Works like an app
              </span>
            </div>
          </div>
          <span className="flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-white/25 px-3.5 py-1.5 text-[13px] font-medium leading-none text-white ring-1 ring-inset ring-white/10 transition-colors group-hover:bg-white/30">
            Show me
          </span>
        </button>
      </div>
      <CustomPrompt open={showPrompt} onClose={() => setShowPrompt(false)} />
    </section>
  )
}

export default InstallCTA

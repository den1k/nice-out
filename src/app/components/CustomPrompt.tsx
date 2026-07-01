import { useEffect, useState } from 'react'
import { useDeviceAndVersion } from '@/utils/useDeviceAndVersion'

const CustomPrompt = () => {
  const { isStandalone, isValidOS } = useDeviceAndVersion()
  const [showPrompt, setShowPrompt] = useState<null | boolean>(false)
  const [animateUp, setAnimateUp] = useState<null | boolean>(true)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const timeout = setTimeout(() => {
        setShowPrompt(true)
      }, 3000) // wait 3 seconds to show the prompt
      return () => {
        clearTimeout(timeout)
      }
    }
  }, [])

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        setShowPrompt(false)
      }, 1500)
      setAnimateUp(false)
    }
  }

  return (
    !isStandalone &&
    isValidOS &&
    showPrompt && (
      <div
        className={`fixed bottom-0 left-2/4 z-[1000] flex h-fit w-full max-w-[500px] -translate-x-2/4 ${
          animateUp
            ? 'animate-[slide-up-prompt_1.5s_ease-in-out_forwards]'
            : 'animate-[slide-down-prompt_1s_ease-in-out_forwards]'
        } items-end justify-center px-3`}
      >
        <div className="relative w-full overflow-hidden rounded-t-3xl border-x border-t border-white/15 bg-neutral-950/55 pb-[env(safe-area-inset-bottom)] text-white shadow-2xl shadow-black/50 backdrop-blur-2xl">
          {/* soft glow accent along the top edge */}
          <div className="pointer-events-none absolute inset-x-0 -top-24 h-40 bg-gradient-radial from-white/15 via-white/[0.03] to-transparent blur-2xl" />

          {/* grab handle */}
          <div className="relative flex justify-center pt-3">
            <span className="h-1 w-9 rounded-full bg-white/25" />
          </div>

          <div className="relative px-5 pb-5 pt-3">
            {/* header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] uppercase tracking-[0.16em] text-white/55">
                  Nice Out
                </span>
                <h2 className="text-[19px] font-semibold leading-tight text-white">
                  Add to Home Screen
                </h2>
              </div>
              <button
                onClick={handleClose}
                aria-label="Dismiss"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <p className="mt-3 text-[13px] leading-relaxed text-white/75">
              This site works like a native app. Install it for a fullscreen,
              distraction-free forecast.
            </p>

            {/* steps */}
            <div className="mt-5 flex flex-col gap-2.5">
              <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.09] px-3.5 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white/95">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 3v12" />
                    <path d="m8 7 4-4 4 4" />
                    <path d="M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
                  </svg>
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-white/55">
                    Step 1
                  </span>
                  <span className="text-[14px] font-medium leading-snug text-white">
                    Tap the Share button
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.09] px-3.5 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white/95">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="3"
                      y="3"
                      width="18"
                      height="18"
                      rx="5.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M12 8.5v7M8.5 12h7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-white/55">
                    Step 2
                  </span>
                  <span className="text-[14px] font-medium leading-snug text-white">
                    Choose &apos;Add to Home Screen&apos;
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  )
}

export default CustomPrompt

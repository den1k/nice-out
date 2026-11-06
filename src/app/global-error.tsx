'use client'

import { useEffect } from 'react'

// The sync storage persister's default key. Saved places live in this entry.
const PERSISTED_CACHE_KEY = 'REACT_QUERY_OFFLINE_CACHE'

const button = {
  padding: '12px 20px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.2)',
  fontSize: 15,
  cursor: 'pointer',
  color: '#fff',
  background: 'rgba(255,255,255,0.12)',
}

// Last resort for a throw anywhere in the tree, including the providers in the
// root layout. It replaces the root layout, so it can use none of the app's
// context or styles. The app restores its cache at every load, so a reload alone
// may hit the same error: the second button is the way out, and it is separate
// because it costs the visitor their saved places.
export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  const clearAndReload = () => {
    try {
      localStorage.removeItem(PERSISTED_CACHE_KEY)
    } catch {}
    window.location.reload()
  }

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          boxSizing: 'border-box',
          textAlign: 'center',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
          background: 'linear-gradient(160deg, #555f6e, #414c59 55%, #684338)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 300 }}>
          Something went wrong
        </h1>
        <p style={{ margin: 0, maxWidth: 320, fontSize: 15, opacity: 0.75 }}>
          If reloading doesn&apos;t help, clearing saved data will. You&apos;ll
          need to add your places again.
        </p>
        <button style={button} onClick={() => window.location.reload()}>
          Reload
        </button>
        <button
          style={{ ...button, background: 'transparent' }}
          onClick={clearAndReload}
        >
          Clear saved data and reload
        </button>
      </body>
    </html>
  )
}

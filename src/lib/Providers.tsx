'use client'

import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { ReactNode, useEffect } from 'react'
import { GlobalContextProvider } from './GlobalContext'
import { shouldRetryQuery } from '@/utils/httpError'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 15, // 15 min
      retry: shouldRetryQuery,
    },
  },
})

const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : null,
})

export default function Providers({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  useEffect(() => {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.persist === 'function'
    ) {
      navigator.storage.persist().catch(() => {})
    }
  }, [])

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: Infinity }}
    >
      {' '}
      <GlobalContextProvider>{children}</GlobalContextProvider>
    </PersistQueryClientProvider>
  )
}

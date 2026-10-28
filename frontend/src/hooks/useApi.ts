import { useEffect, useState } from 'react'
import { fetchJson } from '../api/client'

export interface ApiState<T> {
  data: T | undefined
  error: string | undefined
  loading: boolean
}

interface Settled<T> {
  path: string | null
  data?: T
  error?: string
}

/**
 * Fetches `path` whenever it changes. While a new request is in flight the
 * previous data is kept, so views can dim the old render instead of flashing
 * a skeleton. `loading` is derived: the last settled request was for a
 * different path. Pass null to skip fetching
 */
export function useApi<T>(path: string | null): ApiState<T> {
  const [settled, setSettled] = useState<Settled<T>>({ path: null })

  useEffect(() => {
    if (path === null) return
    const controller = new AbortController()
    fetchJson<T>(path, controller.signal)
      .then((data) => setSettled({ path, data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        const message = err instanceof Error ? err.message : String(err)
        setSettled((prev) => ({ path, data: prev.data, error: message }))
      })
    return () => controller.abort()
  }, [path])

  const current = settled.path === path
  return {
    data: settled.data,
    error: current ? settled.error : undefined,
    loading: path !== null && !current,
  }
}

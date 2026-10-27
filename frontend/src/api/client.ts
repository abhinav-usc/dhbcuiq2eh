import type { GateId } from './types'

// Same origin in production (FastAPI serves the build); proxied to :8000 by Vite in dev.
const BASE = '/api'

export async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE}${path}`, { signal })
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (typeof body.detail === 'string') detail = body.detail
    } catch {
      // non-JSON error body: keep the status text
    }
    throw new Error(detail)
  }
  return response.json() as Promise<T>
}

export const paths = {
  meta: () => '/meta',
  decision: (deliveryDay: string, gate: GateId) =>
    `/decision?${new URLSearchParams({ delivery_day: deliveryDay, gate })}`,
  accuracy: (gate: GateId) => `/accuracy?${new URLSearchParams({ gate })}`,
}

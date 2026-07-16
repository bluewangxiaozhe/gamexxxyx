import { useEffect, useState } from 'react'

interface ClientUpdateInfo {
  version: string
  url: string
  notes: string
}

const apiBase = ((import.meta as any).env?.VITE_API_BASE || 'https://api.567zm.com/api').replace(/\/$/, '')

let cachedUpdate: ClientUpdateInfo | null = null
let pendingRequest: Promise<ClientUpdateInfo | null> | null = null

function isValidUpdate(data: unknown): data is ClientUpdateInfo {
  if (!data || typeof data !== 'object') return false
  const update = data as Partial<ClientUpdateInfo>
  return typeof update.version === 'string' &&
    typeof update.url === 'string' &&
    typeof update.notes === 'string' &&
    /^\d+\.\d+\.\d+$/.test(update.version) &&
    update.url.startsWith('https://')
}

async function fetchClientUpdate(): Promise<ClientUpdateInfo | null> {
  if (cachedUpdate) return cachedUpdate
  if (!pendingRequest) {
    pendingRequest = fetch(`${apiBase}/client-update`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null
        const data = await response.json()
        if (!isValidUpdate(data)) return null
        cachedUpdate = data
        return data
      })
      .catch(() => null)
      .finally(() => {
        pendingRequest = null
      })
  }
  return pendingRequest
}

export function useClientUpdate() {
  const [update, setUpdate] = useState<ClientUpdateInfo | null>(cachedUpdate)
  const [loading, setLoading] = useState(!cachedUpdate)

  useEffect(() => {
    let active = true
    fetchClientUpdate().then((nextUpdate) => {
      if (!active) return
      setUpdate(nextUpdate)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  return { update, loading }
}

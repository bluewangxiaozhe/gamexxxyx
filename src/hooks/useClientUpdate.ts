import { useEffect, useState } from 'react'
import { api, type ClientUpdateInfo } from '@/utils/api'

export function useClientUpdate() {
  const [update, setUpdate] = useState<ClientUpdateInfo | null>(api.cachedClientUpdate)
  const [loading, setLoading] = useState(!api.cachedClientUpdate)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api.getClientUpdate()
      .then(nextUpdate => {
        if (active) setUpdate(nextUpdate)
      })
      .catch(error => {
        if (active) setError(error instanceof Error ? error.message : '获取下载信息失败')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { update, loading, error }
}

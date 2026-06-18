import { useEffect, useState } from 'react'
import { detectRegion, getCachedRegion, type Region } from '@/utils/region'

/**
 * 返回当前访客地区（'cn' | 'global'）。
 * 初始返回缓存/默认值（global），检测完成后自动更新。
 * detectRegion 内部有缓存与请求去重，多个组件同时调用也只会发一次 trace 请求。
 */
export function useRegion(): Region {
  const [region, setRegion] = useState<Region>(getCachedRegion)

  useEffect(() => {
    let active = true
    detectRegion().then(r => {
      if (active) setRegion(r)
    })
    return () => {
      active = false
    }
  }, [])

  return region
}

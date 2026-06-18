// 访客地区判断 + R2/EdgeOne 域名切换
//
// 文件统一存储为 R2 原始地址（oss.wangzhe.me）。中国大陆访客在渲染时把域名
// 替换为腾讯 EdgeOne 加速域名（down.567zm.com），两者回源同一个 R2 桶、路径完全一致。
// 非中国访客保持 R2 原始地址。

export type Region = 'cn' | 'global'

// R2 原始公网域名（数据库里实际存储的域名）
const R2_HOST = (import.meta as any).env?.VITE_R2_HOST || 'oss.wangzhe.me'
// 国内 EdgeOne 加速域名
const CN_HOST = (import.meta as any).env?.VITE_CN_HOST || 'down.567zm.com'

// Cloudflare 自带的 trace 接口，返回 loc=CN 这样的国家码。
// oss.wangzhe.me 是 R2 的 Cloudflare 自定义域名，因此自带该接口。
const TRACE_URL = `https://${R2_HOST}/cdn-cgi/trace`
const CACHE_KEY = 'visitor_region'
const TRACE_TIMEOUT = 2000

let cached: Region | null = null
let inflight: Promise<Region> | null = null

function readStored(): Region | null {
  try {
    const v = sessionStorage.getItem(CACHE_KEY)
    if (v === 'cn' || v === 'global') return v
  } catch {
    /* sessionStorage 不可用时忽略 */
  }
  return null
}

function writeStored(region: Region): void {
  try {
    sessionStorage.setItem(CACHE_KEY, region)
  } catch {
    /* ignore */
  }
}

// trace 不可用时的兜底：用时区 + 语言粗略判断是否中国大陆。
// 只在 fetch 失败时使用，不作为主判据。
function heuristicRegion(): Region {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (tz === 'Asia/Shanghai' || tz === 'Asia/Urumqi' || tz === 'Asia/Chongqing') {
      return 'cn'
    }
    const lang = (navigator.language || '').toLowerCase()
    if (lang === 'zh-cn' || lang === 'zh') return 'cn'
  } catch {
    /* ignore */
  }
  return 'global'
}

/** 同步读取已知地区（缓存/会话存储）。首次访问、尚未检测完成时返回安全默认值 global。 */
export function getCachedRegion(): Region {
  if (cached) return cached
  const stored = readStored()
  if (stored) {
    cached = stored
    return stored
  }
  return 'global'
}

/** 异步检测访客地区，结果缓存到内存与 sessionStorage，整个会话只请求一次。 */
export async function detectRegion(): Promise<Region> {
  if (cached) return cached
  const stored = readStored()
  if (stored) {
    cached = stored
    return stored
  }
  if (inflight) return inflight

  inflight = (async () => {
    let region: Region
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TRACE_TIMEOUT)
      const res = await fetch(TRACE_URL, { signal: controller.signal, cache: 'no-store' })
      clearTimeout(timer)
      const text = await res.text()
      const loc = /(?:^|\n)loc=([A-Z]{2})/.exec(text)?.[1]
      region = loc === 'CN' ? 'cn' : 'global'
    } catch {
      region = heuristicRegion()
    }
    cached = region
    writeStored(region)
    inflight = null
    return region
  })()

  return inflight
}

/**
 * 按地区把 R2 原始地址替换成对应加速域名。
 * 仅替换我们自己的 R2 域名，外链（docs.qq.com 攻略、unsplash banner 等）原样返回。
 */
export function toRegionUrl(url: string, region: Region): string {
  if (!url || region !== 'cn') return url
  const prefix = `https://${R2_HOST}/`
  if (url.startsWith(prefix)) {
    return `https://${CN_HOST}/${url.slice(prefix.length)}`
  }
  return url
}

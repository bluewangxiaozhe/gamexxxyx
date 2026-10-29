import type { Game, HeroBanner, Announcement, LauncherRelease, ApiResponse } from '@/types'
import { HttpResponseError, readJson } from './readJson'

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'https://api.567zm.com/api'

const TOKEN_KEY = 'admin_token'

export interface ClientUpdateInfo {
  version: string
  url: string
  notes: string
}

let cachedClientUpdate: ClientUpdateInfo | null = null
let pendingClientUpdate: Promise<ClientUpdateInfo> | null = null

function isValidClientUpdate(data: unknown): data is ClientUpdateInfo {
  if (!data || typeof data !== 'object') return false
  const update = data as Partial<ClientUpdateInfo>
  return typeof update.version === 'string' &&
    typeof update.url === 'string' &&
    typeof update.notes === 'string' &&
    /^\d+\.\d+\.\d+$/.test(update.version) &&
    update.url.startsWith('https://')
}

async function getClientUpdate(): Promise<ClientUpdateInfo> {
  if (cachedClientUpdate) return cachedClientUpdate
  if (!pendingClientUpdate) {
    pendingClientUpdate = readJson(`${API_BASE}/client-update`, { cache: 'no-store' })
      .then(data => {
        if (!isValidClientUpdate(data)) throw new Error('客户端下载信息格式无效')
        cachedClientUpdate = data
        return data
      })
      .finally(() => {
        pendingClientUpdate = null
      })
  }
  return pendingClientUpdate
}

export function getAdminToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function setAdminToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

export function clearAdminToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

async function request<T>(endpoint: string, options?: RequestInit, authenticated = false): Promise<ApiResponse<T>> {
  try {
    const method = options?.method?.toUpperCase() || 'GET'
    const token = authenticated || method !== 'GET' ? getAdminToken() : ''
    const headers = new Headers(options?.headers)
    if (options?.body != null && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    if (token) headers.set('x-admin-token', token)
    const requestOptions = { ...options, headers }
    let data: unknown
    if (method === 'GET') {
      data = await readJson(`${API_BASE}${endpoint}`, requestOptions)
    } else {
      const response = await fetch(`${API_BASE}${endpoint}`, requestOptions)
      if (!response.ok) throw new HttpResponseError(response.status)
      data = await response.json()
    }
    
    if (data === null || data === undefined) {
      return { success: true, data: undefined as T }
    }
    
    if (Array.isArray(data)) {
      return { success: true, data: data as T }
    }
    
    if (typeof data === 'object' && 'success' in data) {
      return data as ApiResponse<T>
    }
    
    return { success: true, data: data as T }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '请求失败',
    }
  }
}

// 用指定 token 校验后台密码（登录时调用，校验通过后才存 token）
async function checkAuth(token: string): Promise<boolean> {
  try {
    const data = await readJson<{ success?: boolean }>(`${API_BASE}/auth/check`, {
      headers: { 'x-admin-token': token },
    })
    return data?.success === true
  } catch (error) {
    if (error instanceof HttpResponseError && error.status === 401) return false
    throw error
  }
}

export const api = {
  checkAuth,
  getClientUpdate,
  get cachedClientUpdate() { return cachedClientUpdate },
  getGames: (includeInactive = false) => request<Game[]>(`/games${includeInactive ? '?includeInactive=true' : ''}`, undefined, includeInactive),
  getGame: (id: number) => request<Game>(`/games/${id}`),
  getGamesByCategory: (category: string) => request<Game[]>(`/games?category=${encodeURIComponent(category)}`),
  searchGames: (query: string) => request<Game[]>(`/games/search?q=${encodeURIComponent(query)}`),
  getHeroBanners: (includeHidden = false) => request<HeroBanner[]>(`/hero-banners${includeHidden ? '?includeHidden=true' : ''}`, undefined, includeHidden),
  getAnnouncements: (includeHidden = false) => request<Announcement[]>(`/announcements${includeHidden ? '?includeHidden=true' : ''}`, undefined, includeHidden),
  createHeroBanner: (banner: Omit<HeroBanner, 'id'>) => request<HeroBanner>('/hero-banners', { method: 'POST', body: JSON.stringify(banner) }),
  updateHeroBanner: (id: number, banner: Partial<HeroBanner>) => request<HeroBanner>(`/hero-banners/${id}`, { method: 'PUT', body: JSON.stringify(banner) }),
  deleteHeroBanner: (id: number) => request<null>(`/hero-banners/${id}`, { method: 'DELETE' }),
  createAnnouncement: (announcement: Omit<Announcement, 'id'>) => request<Announcement>('/announcements', { method: 'POST', body: JSON.stringify(announcement) }),
  updateAnnouncement: (id: number, announcement: Partial<Announcement>) => request<Announcement>(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(announcement) }),
  deleteAnnouncement: (id: number) => request<null>(`/announcements/${id}`, { method: 'DELETE' }),
  createGame: (game: Omit<Game, 'id'>) => request<Game>('/games', { method: 'POST', body: JSON.stringify(game) }),
  updateGame: (id: number, game: Partial<Game>) => request<Game>(`/games/${id}`, { method: 'PUT', body: JSON.stringify(game) }),
  deleteGame: (id: number) => request<null>(`/games/${id}`, { method: 'DELETE' }),
  getLauncherReleases: (gameId: number) => request<LauncherRelease[]>(`/games/${gameId}/launcher-releases`, undefined, true),
  createLauncherRelease: (gameId: number, release: Omit<LauncherRelease, 'id' | 'gameId' | 'createdAt' | 'updatedAt' | 'publishedAt'>) =>
    request<LauncherRelease>(`/games/${gameId}/launcher-releases`, { method: 'POST', body: JSON.stringify(release) }),
  updateLauncherRelease: (id: number, release: Partial<LauncherRelease>) =>
    request<LauncherRelease>(`/launcher-releases/${id}`, { method: 'PUT', body: JSON.stringify(release) }),
  deleteLauncherRelease: (id: number) => request<null>(`/launcher-releases/${id}`, { method: 'DELETE' }),
  inspectLauncherPackage: (input: { packageUrl: string; packageFormat: 'zip' | 'exe'; launcherRelativePath: string }) =>
    request<{ size: number; sha256: string; launcherSha256: string }>('/launcher-package-inspect', { method: 'POST', body: JSON.stringify(input) }),
  getCategories: () => request<string[]>('/categories'),
}

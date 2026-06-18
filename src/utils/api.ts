import type { Game, ApiResponse } from '@/types'

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'https://api.567zm.com/api'

const TOKEN_KEY = 'admin_token'

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

async function request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const token = getAdminToken()
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'x-admin-token': token } : {}),
        ...options?.headers,
      },
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
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
    const response = await fetch(`${API_BASE}/auth/check`, {
      headers: { 'x-admin-token': token },
    })
    if (!response.ok) return false
    const data = await response.json()
    return data?.success === true
  } catch {
    return false
  }
}

export const api = {
  checkAuth,
  getGames: () => request<Game[]>('/games'),
  getGame: (id: number) => request<Game>(`/games/${id}`),
  getGamesByCategory: (category: string) => request<Game[]>(`/games?category=${encodeURIComponent(category)}`),
  searchGames: (query: string) => request<Game[]>(`/games/search?q=${encodeURIComponent(query)}`),
  createGame: (game: Omit<Game, 'id'>) => request<Game>('/games', { method: 'POST', body: JSON.stringify(game) }),
  updateGame: (id: number, game: Partial<Game>) => request<Game>(`/games/${id}`, { method: 'PUT', body: JSON.stringify(game) }),
  deleteGame: (id: number) => request<null>(`/games/${id}`, { method: 'DELETE' }),
  getCategories: () => request<string[]>('/categories'),
}

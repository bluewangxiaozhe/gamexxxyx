import type { Game, ApiResponse } from '@/types'

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'https://api.567zm.com/api'

async function request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data as ApiResponse<T>
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '请求失败',
    }
  }
}

export const api = {
  getGames: () => request<Game[]>('/games'),
  getGame: (id: number) => request<Game>(`/games/${id}`),
  getGamesByCategory: (category: string) => request<Game[]>(`/games?category=${encodeURIComponent(category)}`),
  searchGames: (query: string) => request<Game[]>(`/games/search?q=${encodeURIComponent(query)}`),
  createGame: (game: Omit<Game, 'id'>) => request<Game>('/games', { method: 'POST', body: JSON.stringify(game) }),
  updateGame: (id: number, game: Partial<Game>) => request<Game>(`/games/${id}`, { method: 'PUT', body: JSON.stringify(game) }),
  deleteGame: (id: number) => request<null>(`/games/${id}`, { method: 'DELETE' }),
  getCategories: () => request<string[]>('/categories'),
}

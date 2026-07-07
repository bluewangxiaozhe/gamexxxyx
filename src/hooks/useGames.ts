import { useState, useEffect, useCallback } from 'react'
import type { Game, HeroBanner, Announcement } from '@/types'
import { api } from '@/utils/api'

export function useGames() {
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGames = useCallback(async () => {
    setLoading(true)
    setError(null)
    const response = await api.getGames()
    if (response.success && response.data) {
      setGames(response.data)
    } else {
      setError(response.message || '获取游戏列表失败')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  return { games, loading, error, refetch: fetchGames }
}

export function useGame(id: number) {
  const [game, setGame] = useState<Game | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function fetchGame() {
      setLoading(true)
      setError(null)
      const response = await api.getGame(id)
      if (!cancelled) {
        if (response.success && response.data) {
          setGame(response.data)
        } else {
          setError(response.message || '获取游戏详情失败')
        }
        setLoading(false)
      }
    }
    fetchGame()
    return () => { cancelled = true }
  }, [id])

  return { game, loading, error }
}

export function useHeroBanners(includeHidden = false) {
  const [heroBanners, setHeroBanners] = useState<HeroBanner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHeroBanners = useCallback(async () => {
    setLoading(true)
    setError(null)
    const response = await api.getHeroBanners(includeHidden)
    if (response.success && response.data) {
      setHeroBanners(response.data)
    } else {
      setError(response.message || '获取 Banner 列表失败')
    }
    setLoading(false)
  }, [includeHidden])

  useEffect(() => {
    fetchHeroBanners()
  }, [fetchHeroBanners])

  return { heroBanners, loading, error, refetch: fetchHeroBanners }
}

export function useAnnouncements(includeHidden = false) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    setError(null)
    const response = await api.getAnnouncements(includeHidden)
    if (response.success && response.data) {
      setAnnouncements(response.data)
    } else {
      setError(response.message || '获取公告列表失败')
    }
    setLoading(false)
  }, [includeHidden])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  return { announcements, loading, error, refetch: fetchAnnouncements }
}

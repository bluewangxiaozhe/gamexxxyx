export interface Game {
  id: number
  name: string
  description: string
  category: string
  version: string
  size: string
  downloadUrl: string
  imageUrl: string
  rating: number
  downloads: number
  addedAt: string
  status?: 'active' | 'inactive' | 'maintenance'
  tags?: string[]
  screenshots?: string[]
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
}

export interface Announcement {
  id: number
  title: string
  content: string
  link?: string
  visible: boolean
  createdAt: string
}

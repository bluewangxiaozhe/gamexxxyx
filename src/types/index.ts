export interface GameBanner {
  title: string
  subtitle: string
  desc: string
  image: string
  color: string
  bgColor: string
}

export interface HeroBanner {
  id: number
  category: string
  title: string
  subtitle: string
  desc: string
  image: string
  color: string
  bgColor: string
  sortOrder: number
  visible: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Game {
  id: number
  name: string
  description: string
  category: string
  version: string
  size: string
  downloadUrl: string
  guideUrl?: string
  dropRateUrl?: string
  imageUrl: string
  openTime?: string
  heat?: number
  banner?: GameBanner | null
  rating: number
  downloads: number
  addedAt: string
  createdAt?: string
  updatedAt?: string
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

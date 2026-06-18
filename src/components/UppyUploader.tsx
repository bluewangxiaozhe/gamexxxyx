
import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { getAdminToken } from '@/utils/api'

interface FileData {
  url: string
  filename?: string
  size?: number
}

interface UppyUploaderProps {
  value?: FileData
  onChange: (data: FileData) => void
  type: 'game' | 'cover' | 'screenshot'
}

const TYPE_CONFIG = {
  game: {
    folder: 'games',
    allowed: ['.apk', '.ipa', '.exe', '.msi', '.dmg', '.zip', '.rar', '.7z', '.tar.gz', '.tar'],
    maxSize: 1024 * 1024 * 1024,
    label: '游戏文件'
  },
  cover: {
    folder: 'covers',
    allowed: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
    maxSize: 50 * 1024 * 1024,
    label: '封面图片'
  },
  screenshot: {
    folder: 'screenshots',
    allowed: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'],
    maxSize: 20 * 1024 * 1024,
    label: '截图'
  }
}

const API_BASE = 'https://api.567zm.com'

export default function UppyUploader({ value, onChange, type }: UppyUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [fileData, setFileData] = useState<FileData | null>(null)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const config = TYPE_CONFIG[type]

  useEffect(() => {
    if (value && value.url) {
      setFileData(value)
    } else if (!value || !value.url) {
      setFileData(null)
    }
  }, [value])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setIsUploading(true)
    setProgress(0)

    const formData = new FormData()
    formData.append('file', file)

    const endpoint = type === 'game' ? '/api/upload/game' : type === 'cover' ? '/api/upload/cover' : '/api/upload/screenshot'

    try {
      const response = await axios.post(`${API_BASE}${endpoint}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-admin-token': getAdminToken()
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            setProgress(percent)
          }
        }
      })

      if (response.data.success && response.data.data) {
        const { url, filename, size } = response.data.data
        const newFileData: FileData = { url, filename, size }
        onChange(newFileData)
        setFileData(newFileData)
        setError(null)
      } else {
        setError(response.data.error || '上传失败')
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setError(err.response.data.error)
      } else {
        setError('上传失败，请重试')
      }
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && fileInputRef.current) {
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(file)
      fileInputRef.current.files = dataTransfer.files
      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleCopyUrl = async () => {
    if (fileData?.url) {
      try {
        await navigator.clipboard.writeText(fileData.url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('复制失败:', err)
      }
    }
  }

  const handleRemove = () => {
    setFileData(null)
    onChange({ url: '' })
  }

  const formatDisplayUrl = (url: string) => {
    try {
      return decodeURI(url)
    } catch {
      return url
    }
  }

  if ((value && value.url) || (fileData && fileData.url)) {
    const data = value || fileData
    const isImage = type !== 'game' && data?.url?.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)

    return (
      <div className="w-full rounded-xl border border-green-200 bg-green-50 p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 font-bold">✓</span>
              </div>
              <div>
                <p className="text-sm font-medium text-green-800">文件已上传</p>
                {data?.filename && (
                  <p className="text-xs text-green-700 mt-1">{data.filename}</p>
                )}
                {data?.size && (
                  <p className="text-xs text-green-600 mt-0.5">{formatSize(data.size)}</p>
                )}
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="px-4 py-2 text-sm text-red-600 bg-white rounded-lg hover:bg-red-50 transition-colors"
            >
              移除
            </button>
          </div>

          {isImage && data?.url && (
            <div className="bg-white rounded-lg p-3">
              <img
                src={data.url}
                alt="Preview"
                className="max-w-full max-h-64 object-contain rounded"
              />
            </div>
          )}

          {data?.url && (
            <div className="bg-white rounded-lg p-3">
              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500 mb-1">文件链接</p>
                  <p className="h-10 flex items-center text-sm text-gray-800 truncate bg-gray-50 px-3 rounded border border-gray-200">
                    {formatDisplayUrl(data.url)}
                  </p>
                </div>
                <button
                  onClick={handleCopyUrl}
                  className="h-10 px-4 text-sm text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex-shrink-0 whitespace-nowrap"
                >
                  {copied ? '已复制!' : '复制链接'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`w-full rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 ${
        isUploading ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={() => !isUploading && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={config.allowed.map(ext => ext.startsWith('.') ? ext : `.${ext}`).join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />

      {isUploading ? (
        <div className="space-y-4">
          <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">⏳</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-600">上传进度</span>
              <span className="font-medium text-blue-700">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="w-14 h-14 mx-auto bg-gray-200 rounded-full flex items-center justify-center">
            <span className="text-2xl">📁</span>
          </div>
          <div>
            <p className="text-base font-medium text-gray-900">
              拖拽文件到此处，或点击选择文件
            </p>
            <p className="text-sm text-gray-500 mt-1">
              支持 {config.label}，最大 {formatSize(config.maxSize)}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg text-red-600 text-sm">
          ❌ {error}
        </div>
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import { Upload, X, RefreshCw, File, CheckCircle, AlertCircle, Copy, Check } from 'lucide-react'

interface FileUploaderProps {
  value?: string
  onChange: (url: string) => void
  onFileInfo?: (name: string, size: string) => void
  type: 'game' | 'cover' | 'screenshot'
  accept?: Record<string, string[]>
  maxSize?: number
}

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

interface UploadProgress {
  percentage: number
  speed: string
}

const API_BASE_URL = 'https://api.567zm.com'

const API_ENDPOINTS = {
  game: `${API_BASE_URL}/api/upload/game`,
  cover: `${API_BASE_URL}/api/upload/cover`,
  screenshot: `${API_BASE_URL}/api/upload/screenshot`,
}

const DEFAULT_ACCEPT = {
  game: { 'application/*': [], 'video/*': [], 'text/plain': [] },
  cover: { 'image/*': [] },
  screenshot: { 'image/*': [] },
}

const DEFAULT_MAX_SIZE = {
  game: 500 * 1024 * 1024,
  cover: 5 * 1024 * 1024,
  screenshot: 10 * 1024 * 1024,
}

export default function FileUploader({
  value,
  onChange,
  onFileInfo,
  type,
  accept,
  maxSize,
}: FileUploaderProps) {
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<UploadStatus>(value ? 'success' : 'idle')
  const [error, setError] = useState<string>('')
  const [progress, setProgress] = useState<UploadProgress>({ percentage: 0, speed: '0 B/s' })
  const [previewUrl, setPreviewUrl] = useState<string>(value || '')
  const [fileName, setFileName] = useState<string>('')
  const [fileSize, setFileSize] = useState<string>('')

  const fileAccept = accept || DEFAULT_ACCEPT[type]
  const fileMaxSize = maxSize || DEFAULT_MAX_SIZE[type]

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s'
    const k = 1024
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k))
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const isImageFile = (file: File): boolean => {
    return file.type.startsWith('image/')
  }

  const uploadFile = useCallback(
    async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      setFileName(file.name)
      setFileSize(formatFileSize(file.size))

      if (isImageFile(file)) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setPreviewUrl(e.target?.result as string)
        }
        reader.readAsDataURL(file)
      }

      setStatus('uploading')
      setError('')
      setProgress({ percentage: 0, speed: '0 B/s' })

      const startTime = Date.now()

      try {
        const response = await axios.post(API_ENDPOINTS[type], formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentage = Math.round((progressEvent.loaded * 100) / progressEvent.total)
              const elapsedSeconds = (Date.now() - startTime) / 1000
              const bytesPerSecond = elapsedSeconds > 0 ? progressEvent.loaded / elapsedSeconds : 0
              const speed = formatSpeed(bytesPerSecond)
              setProgress({ percentage, speed })
            }
          },
        })

        const fileUrl = response.data.data?.url || response.data.url || response.data.data
        setPreviewUrl(fileUrl)
        setStatus('success')
        onChange(fileUrl)
        // 通知父组件文件名和大小（用于自动填充）
        if (onFileInfo) {
          const sizeStr = formatFileSize(file.size)
          onFileInfo(file.name, sizeStr)
        }
      } catch (err) {
        setStatus('error')
        if (axios.isAxiosError(err)) {
          setError(err.response?.data?.message || err.message || '上传失败')
        } else {
          setError('上传失败')
        }
      }
    },
    [type, onChange]
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        uploadFile(acceptedFiles[0])
      }
    },
    [uploadFile]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: fileAccept,
    maxSize: fileMaxSize,
    multiple: false,
  })

  const handleRetry = () => {
    setStatus('idle')
    setError('')
    setProgress({ percentage: 0, speed: '0 B/s' })
  }

  const handleDelete = () => {
    setPreviewUrl('')
    setFileName('')
    setFileSize('')
    setStatus('idle')
    setError('')
    setProgress({ percentage: 0, speed: '0 B/s' })
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isImagePreview = (url: string): boolean => {
    return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)
  }

  if (status === 'success') {
    return (
      <div className="relative w-full rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="p-4">
          {isImagePreview(previewUrl) ? (
            <div className="flex justify-center">
              <img
                src={previewUrl}
                alt={fileName}
                className="max-h-48 w-auto object-contain rounded-lg"
                style={{ maxWidth: '100%', aspectRatio: 'auto' }}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <File className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
                <p className="text-xs text-gray-500">{fileSize}</p>
                {previewUrl && (
                  <button
                    onClick={() => copyToClipboard(previewUrl)}
                    className="mt-1.5 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? '已复制' : '复制链接'}
                  </button>
                )}
              </div>
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            </div>
          )}
        </div>

        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={handleDelete}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
          >
            <X className="w-4 h-4" />
            <span className="text-sm font-medium">删除</span>
          </button>
          <button
            onClick={handleRetry}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm font-medium">重新上传</span>
          </button>
        </div>
      </div>
    )
  }

  if (status === 'uploading') {
    return (
      <div className="w-full rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4 mb-4">
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview"
              className="w-16 h-16 object-cover rounded-lg"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
            <p className="text-xs text-gray-500 mt-1">{fileSize}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">上传进度</span>
            <span className="font-medium text-gray-900">{progress.percentage}%</span>
          </div>

          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>上传速度: {progress.speed}</span>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="w-full rounded-xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">上传失败</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleDelete}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white text-red-600 rounded-lg border border-red-200 hover:bg-red-100 transition-colors"
          >
            <X className="w-4 h-4" />
            <span className="text-sm font-medium">取消</span>
          </button>
          <button
            onClick={handleRetry}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="text-sm font-medium">重试</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      {...getRootProps()}
      className={`w-full rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 ${
        isDragActive
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
      }`}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center gap-3">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            isDragActive ? 'bg-blue-100' : 'bg-gray-200'
          }`}
        >
          <Upload
            className={`w-7 h-7 transition-colors ${isDragActive ? 'text-blue-600' : 'text-gray-500'}`}
          />
        </div>

        <div>
          <p className="text-base font-medium text-gray-900">
            {isDragActive ? '释放文件以上传' : '拖拽文件到此处，或点击选择文件'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            支持 {type === 'game' ? '所有文件类型' : '图片文件'}，最大 {formatFileSize(fileMaxSize)}
          </p>
        </div>
      </div>
    </div>
  )
}

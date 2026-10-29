export class HttpResponseError extends Error {
  constructor(readonly status: number) {
    super(`请求失败（HTTP ${status}）`)
  }
}

export async function readJson<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const signal = options?.signal
  const abort = () => {
    const reason = signal?.reason
    controller.abort(reason instanceof DOMException && reason.name === 'AbortError'
      ? new DOMException('请求已取消', 'AbortError')
      : reason)
  }
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => controller.abort(new Error('请求超时，请重试')), 8000)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    if (!response.ok) throw new HttpResponseError(response.status)
    return await response.json() as T
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason
    if (error instanceof TypeError) {
      throw Object.assign(new Error('网络连接失败，请检查网络后重试'), { cause: error })
    }
    if (error instanceof SyntaxError) {
      throw Object.assign(new Error('返回数据格式错误，请稍后重试'), { cause: error })
    }
    throw error
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

import linkHeader from 'http-link-header'
import qs from 'query-string'

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const getPageFromLinkStr = (linkStr: string): number => {
  const link = linkHeader.parse(linkStr)
  const refs = link.rel('last')
  if (refs && refs.length > 0) {
    const res = qs.parseUrl(refs[0].uri)
    return Number(res.query.page) || 1
  }
  return 1
}

export const formatNumber = (num: number): string => {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

export const formatDate = (dateString: string | number | Date, lang: string = 'zh'): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  const isZh = lang === 'zh'

  if (seconds < 60) {
    return isZh ? '刚刚' : 'just now'
  }
  if (minutes < 60) {
    return isZh ? `${minutes} 分钟前` : `${minutes}m ago`
  }
  if (hours < 24) {
    return isZh ? `${hours} 小时前` : `${hours}h ago`
  }
  if (days === 1) {
    return isZh ? '昨天' : 'yesterday'
  }
  if (days < 7) {
    return isZh ? `${days} 天前` : `${days} days ago`
  }
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return isZh ? `${weeks} 周前` : `${weeks} weeks ago`
  }
  if (days < 365) {
    const months = Math.floor(days / 30)
    return isZh ? `${months} 个月前` : `${months} months ago`
  }
  const years = Math.floor(days / 365)
  return isZh ? `${years} 年前` : `${years} years ago`
}

export const downloadString = (
  text: string,
  fileType: string,
  fileName: string
): void => {
  const blob = new Blob([text], { type: fileType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.download = fileName
  a.href = url
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export const openWindowCenter = (
  url: string,
  title: string,
  width: number,
  height: number
): Window | null => {
  const dualScreenLeft =
    window.screenLeft !== undefined ? window.screenLeft : window.screenX
  const dualScreenTop =
    window.screenTop !== undefined ? window.screenTop : window.screenY

  const screenWidth =
    window.innerWidth ||
    document.documentElement.clientWidth ||
    screen.width
  const screenHeight =
    window.innerHeight ||
    document.documentElement.clientHeight ||
    screen.height

  const systemZoom = screenWidth / window.screen.availWidth
  const left = (screenWidth - width) / 2 / systemZoom + dualScreenLeft
  const top = (screenHeight - height) / 2 / systemZoom + dualScreenTop

  const newWindow = window.open(
    url,
    title,
    `scrollbars=yes, width=${width / systemZoom}, height=${height / systemZoom}, top=${top}, left=${left}`
  )

  if (newWindow && typeof window.focus === 'function') {
    newWindow.focus()
  }

  return newWindow
}

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}


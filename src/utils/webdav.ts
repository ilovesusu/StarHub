// WebDAV 配置接口
export interface WebDAVConfig {
  url: string
  username: string
  password?: string
  directory: string // 默认 "/StarHub"
}

// 备份文件信息接口
export interface WebDAVBackupFile {
  name: string
  path: string
  url: string
  date?: string // 尝试从文件名或属性解析
}

/**
 * 编码 Basic 认证信息
 * 使用浏览器原生 TextEncoder 安全处理 UTF-8 字符（如中文用户名或密码）
 */
function encodeBasicAuth(username: string, password?: string): string {
  const credentials = `${username}:${password || ''}`
  const encoder = new TextEncoder()
  const data = encoder.encode(credentials)
  let binString = ''
  for (let i = 0; i < data.length; i++) {
    binString += String.fromCharCode(data[i])
  }
  return `Basic ${btoa(binString)}`
}

/**
 * 规范化 WebDAV URL 和目录路径
 */
function normalizePaths(config: WebDAVConfig) {
  let baseUrl = config.url.trim()
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1)
  }

  let dir = config.directory.trim()
  if (dir && !dir.startsWith('/')) {
    dir = '/' + dir
  }
  if (dir.endsWith('/')) {
    dir = dir.slice(0, -1)
  }
  if (!dir) {
    dir = '/StarHub'
  }

  return { baseUrl, dir }
}

/**
 * 测试 WebDAV 连接
 */
export async function testWebDAVConnection(config: WebDAVConfig): Promise<boolean> {
  const { baseUrl } = normalizePaths(config)
  
  // 测试时直接向 WebDAV 根路径发送 PROPFIND 或 OPTIONS
  const response = await fetch(baseUrl, {
    method: 'OPTIONS',
    headers: {
      'Authorization': encodeBasicAuth(config.username, config.password)
    }
  })

  if (response.status === 401) {
    throw new Error('用户名或密码错误 (401)')
  }

  if (!response.ok && response.status !== 404 && response.status !== 405) {
    throw new Error(`连接失败，状态码: ${response.status}`)
  }

  return true
}

/**
 * 确保备份文件夹存在（若不存在则创建）
 */
export async function ensureDirectoryExists(config: WebDAVConfig): Promise<void> {
  const { baseUrl, dir } = normalizePaths(config)
  const fullPath = `${baseUrl}${dir}`
  const auth = encodeBasicAuth(config.username, config.password)

  // 1. 检查目录是否存在
  try {
    const checkResponse = await fetch(fullPath, {
      method: 'PROPFIND',
      headers: {
        'Authorization': auth,
        'Depth': '0'
      }
    })

    if (checkResponse.ok || checkResponse.status === 207) {
      // 目录已存在
      return
    }
    
    if (checkResponse.status === 401) {
      throw new Error('未授权，请检查用户名和密码 (401)')
    }
  } catch (error: any) {
    if (error.message && error.message.includes('401')) {
      throw error
    }
    // 忽略其他报错，尝试直接创建
  }

  // 2. 创建目录 (MKCOL)
  const mkcolResponse = await fetch(fullPath, {
    method: 'MKCOL',
    headers: {
      'Authorization': auth
    }
  })

  // 201 Created 表示创建成功；405 Method Not Allowed 说明目录已经存在
  if (!mkcolResponse.ok && mkcolResponse.status !== 405 && mkcolResponse.status !== 201) {
    throw new Error(`无法创建备份目录 ${dir}，状态码: ${mkcolResponse.status}`)
  }
}

/**
 * 上传备份到 WebDAV
 */
export async function uploadToWebDAV(
  config: WebDAVConfig,
  filename: string,
  content: string
): Promise<void> {
  // 确保目录存在
  await ensureDirectoryExists(config)

  const { baseUrl, dir } = normalizePaths(config)
  const fileUrl = `${baseUrl}${dir}/${filename}`
  const auth = encodeBasicAuth(config.username, config.password)

  const response = await fetch(fileUrl, {
    method: 'PUT',
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: content
  })

  if (!response.ok) {
    throw new Error(`上传备份失败，WebDAV 服务返回状态码: ${response.status}`)
  }
}

/**
 * 从 WebDAV 下载备份
 */
export async function downloadFromWebDAV(config: WebDAVConfig, filename: string): Promise<string> {
  const { baseUrl, dir } = normalizePaths(config)
  const fileUrl = `${baseUrl}${dir}/${filename}`
  const auth = encodeBasicAuth(config.username, config.password)

  const response = await fetch(fileUrl, {
    method: 'GET',
    headers: {
      'Authorization': auth
    }
  })

  if (response.status === 404) {
    throw new Error(`备份文件 ${filename} 不存在`)
  }

  if (!response.ok) {
    throw new Error(`下载备份失败，状态码: ${response.status}`)
  }

  return response.text()
}

/**
 * 列出 WebDAV 目录下的所有 StarHub 备份文件
 */
export async function listWebDAVBackups(config: WebDAVConfig): Promise<WebDAVBackupFile[]> {
  // 确保目录存在
  await ensureDirectoryExists(config)

  const { baseUrl, dir } = normalizePaths(config)
  const fullPath = `${baseUrl}${dir}`
  const auth = encodeBasicAuth(config.username, config.password)

  const response = await fetch(fullPath, {
    method: 'PROPFIND',
    headers: {
      'Authorization': auth,
      'Depth': '1' // 获取目录下的一级子项
    }
  })

  if (response.status === 404) {
    return []
  }

  if (!response.ok && response.status !== 207) {
    throw new Error(`无法获取文件列表，状态码: ${response.status}`)
  }

  const xmlText = await response.text()
  
  // 用正则提取所有的 href
  const hrefs: string[] = []
  const hrefRegex = /<[a-zA-Z0-9:]*href[^>]*>([^<]+)<\/[a-zA-Z0-9:]*href>/g
  let match
  while ((match = hrefRegex.exec(xmlText)) !== null) {
    hrefs.push(match[1].trim())
  }

  const backups: WebDAVBackupFile[] = []

  for (const rawHref of hrefs) {
    // 解码 URL
    let href = rawHref
    try {
      href = decodeURIComponent(rawHref)
    } catch (e) {
      console.warn('Failed to decode href:', rawHref)
    }

    // 提取文件名
    const parts = href.split('/')
    const filename = parts[parts.length - 1] || parts[parts.length - 2] || ''

    // 只保留符合 starhub-backup 命名规则的文件
    // 例如 starhub-backup-latest.json 或 starhub-backup-2026-07-02T12-30-00Z.json
    if (filename.startsWith('starhub-backup') && filename.endsWith('.json')) {
      // 避免把目录自身加进去
      if (href.endsWith('/') && filename === dir.replace('/', '')) {
        continue
      }

      // 解析备份日期
      let displayDate = ''
      if (filename === 'starhub-backup-latest.json') {
        displayDate = '最新备份'
      } else {
        // 从 starhub-backup-YYYY-MM-DD.json 提取日期
        const dateMatch = filename.match(/starhub-backup-(.+)\.json/)
        if (dateMatch) {
          displayDate = dateMatch[1].replace(/T/, ' ').replace(/Z/, ' (UTC)')
        }
      }

      // 组装完整 URL
      const fileUrl = href.startsWith('http') ? href : `${baseUrl}${href.startsWith('/') ? '' : '/'}${href}`

      backups.push({
        name: filename,
        path: href,
        url: fileUrl,
        date: displayDate
      })
    }
  }

  // 按备份名降序排序，最新的排在最前
  return backups.sort((a, b) => {
    if (a.name === 'starhub-backup-latest.json') return -1
    if (b.name === 'starhub-backup-latest.json') return 1
    return b.name.localeCompare(a.name)
  })
}

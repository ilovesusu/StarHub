import { AwsClient } from 'aws4fetch'

// S3 / Cloudflare R2 配置接口
export interface S3Config {
  endpoint: string // 如 https://<account_id>.r2.cloudflarestorage.com
  bucket: string // 存储桶名称
  accessKeyId: string
  secretAccessKey: string
  region?: string // R2 默认为 auto，S3 可为 us-east-1 等
  prefix?: string // 存储前缀，默认为 StarHub
}

// 备份文件信息接口
export interface S3BackupFile {
  name: string
  key: string
  size: number
  formattedSize: string
  date: string
  lastModified: string
}

/**
 * 格式化文件大小为人类可读格式
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = bytes / Math.pow(1024, i)
  return `${size.toFixed(2)} ${units[i]}`
}

/**
 * 规范化 S3 配置和路径
 */
function normalizeS3Config(config: S3Config) {
  let endpoint = config.endpoint.trim()
  if (endpoint.endsWith('/')) {
    endpoint = endpoint.slice(0, -1)
  }

  let bucket = config.bucket.trim()
  bucket = bucket.replace(/^\/+|\/+$/g, '')

  let prefix = (config.prefix || 'StarHub').trim()
  prefix = prefix.replace(/^\/+|\/+$/g, '')

  // 构造 Bucket 的基础访问 URL
  // 如果 endpoint 结尾已经包含了 bucket，避免重复拼装
  let bucketUrl = endpoint
  if (!endpoint.toLowerCase().endsWith(`/${bucket.toLowerCase()}`)) {
    bucketUrl = `${endpoint}/${bucket}`
  }

  const region = config.region?.trim() || 'auto'

  return {
    endpoint,
    bucket,
    prefix,
    bucketUrl,
    region
  }
}

/**
 * 创建 AWS S3 客户端实例 (基于 aws4fetch)
 */
function getAwsClient(config: S3Config): AwsClient {
  const { region } = normalizeS3Config(config)
  return new AwsClient({
    accessKeyId: config.accessKeyId.trim(),
    secretAccessKey: config.secretAccessKey.trim(),
    service: 's3',
    region
  })
}

/**
 * 解析 S3 ListObjectsV2 的 XML 响应
 */
function parseListObjectsV2Response(xmlText: string, prefix?: string): S3BackupFile[] {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'application/xml')

  // 检查 XML 解析错误
  const parseError = xmlDoc.querySelector('parsererror')
  if (parseError) {
    throw new Error('解析 S3 响应 XML 失败: ' + parseError.textContent)
  }

  // 检查 S3 错误返回 (如 <Error><Code>AccessDenied</Code><Message>...</Message></Error>)
  const errorNode = xmlDoc.querySelector('Error')
  if (errorNode) {
    const code = errorNode.querySelector('Code')?.textContent || 'UnknownError'
    const message = errorNode.querySelector('Message')?.textContent || 'S3 请求出错'
    throw new Error(`${code}: ${message}`)
  }

  const contentsNodes = xmlDoc.querySelectorAll('Contents')
  const files: S3BackupFile[] = []

  contentsNodes.forEach((node) => {
    const key = node.querySelector('Key')?.textContent || ''
    const size = parseInt(node.querySelector('Size')?.textContent || '0', 10)
    const lastModified = node.querySelector('LastModified')?.textContent || ''

    // 如果指定了 prefix，验证 key 是否以此前缀开头
    if (prefix && !key.startsWith(prefix)) {
      return
    }

    // 提取纯文件名
    const parts = key.split('/')
    const filename = parts[parts.length - 1] || ''

    // 仅匹配 starhub-backup 规则的 JSON 备份文件
    if (filename.startsWith('starhub-backup') && filename.endsWith('.json')) {
      let displayDate = ''
      if (filename === 'starhub-backup-latest.json') {
        displayDate = '最新备份'
      } else {
        // 从 starhub-backup-YYYY-MM-DD.json 中提取可读日期
        const dateMatch = filename.match(/starhub-backup-(.+)\.json/)
        if (dateMatch) {
          displayDate = dateMatch[1].replace(/T/, ' ').replace(/Z/, ' (UTC)')
        } else if (lastModified) {
          displayDate = new Date(lastModified).toLocaleString()
        }
      }

      files.push({
        name: filename,
        key,
        size,
        formattedSize: formatFileSize(size),
        date: displayDate,
        lastModified
      })
    }
  })

  // 排序：starhub-backup-latest.json 排在最前，其它按时间降序
  return files.sort((a, b) => {
    if (a.name === 'starhub-backup-latest.json') return -1
    if (b.name === 'starhub-backup-latest.json') return 1
    return b.name.localeCompare(a.name)
  })
}

/**
 * 测试 Cloudflare R2 / S3 连接与权限
 */
export async function testS3Connection(config: S3Config): Promise<boolean> {
  const { bucketUrl, prefix } = normalizeS3Config(config)
  const client = getAwsClient(config)

  // 通过发送 ListObjectsV2 请求（仅请求 1 条记录）验证 Endpoint、Bucket 存在性、API 凭据以及 CORS 连通性
  const testUrl = `${bucketUrl}?list-type=2&max-keys=1${prefix ? `&prefix=${encodeURIComponent(prefix)}` : ''}`

  try {
    const response = await client.fetch(testUrl, {
      method: 'GET'
    })

    if (response.status === 401 || response.status === 403) {
      throw new Error('鉴权失败 (403/401)：请检查 Access Key ID、Secret Access Key 是否正确，以及是否具有该存储桶的读写权限。')
    }

    if (response.status === 404) {
      throw new Error('存储桶不存在 (404)：请检查 Bucket 名称及 Endpoint 是否准确。')
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`连接失败，状态码: ${response.status} ${errorText ? `(${errorText.slice(0, 150)})` : ''}`)
    }

    return true
  } catch (error: any) {
    // 捕获浏览器跨域或网络中断
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error(
        '网络请求失败 (CORS 跨域或网络不可达)：请确认已在 Cloudflare R2 存储桶的设置中配置了 CORS 跨域规则，并允许了当前域名的访问。'
      )
    }
    throw error
  }
}

/**
 * 上传备份到 Cloudflare R2 / S3
 */
export async function uploadToS3(
  config: S3Config,
  filename: string,
  content: string
): Promise<void> {
  const { bucketUrl, prefix } = normalizeS3Config(config)
  const client = getAwsClient(config)

  const s3Key = prefix ? `${prefix}/${filename}` : filename
  const fileUrl = `${bucketUrl}/${s3Key}`

  try {
    const response = await client.fetch(fileUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: content
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`上传备份失败，状态码: ${response.status} ${errorText ? `(${errorText.slice(0, 150)})` : ''}`)
    }
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('上传失败：浏览器网络被拦截，请检查 R2 存储桶 CORS 设置是否包含 PUT 方法与 Content-Type 请求头。')
    }
    throw error
  }
}

/**
 * 列出 Cloudflare R2 / S3 目录下的所有 StarHub 备份文件
 */
export async function listS3Backups(config: S3Config): Promise<S3BackupFile[]> {
  const { bucketUrl, prefix } = normalizeS3Config(config)
  const client = getAwsClient(config)

  // 拼接 prefix 保证列出对应目录下的文件
  const prefixParam = prefix ? `${prefix}/` : ''
  const listUrl = `${bucketUrl}?list-type=2&prefix=${encodeURIComponent(prefixParam)}`

  try {
    const response = await client.fetch(listUrl, {
      method: 'GET'
    })

    if (response.status === 404) {
      return []
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`获取备份列表失败，状态码: ${response.status} ${errorText ? `(${errorText.slice(0, 150)})` : ''}`)
    }

    const xmlText = await response.text()
    return parseListObjectsV2Response(xmlText, prefix)
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('获取备份列表失败：网络请求失败，请检查 CORS 配置。')
    }
    throw error
  }
}

/**
 * 从 Cloudflare R2 / S3 下载备份文件内容
 */
export async function downloadFromS3(config: S3Config, filename: string): Promise<string> {
  const { bucketUrl, prefix } = normalizeS3Config(config)
  const client = getAwsClient(config)

  const s3Key = prefix ? `${prefix}/${filename}` : filename
  const fileUrl = `${bucketUrl}/${s3Key}`

  try {
    const response = await client.fetch(fileUrl, {
      method: 'GET'
    })

    if (response.status === 404) {
      throw new Error(`备份文件 ${filename} 不存在 (404)`)
    }

    if (!response.ok) {
      throw new Error(`下载备份失败，状态码: ${response.status}`)
    }

    return await response.text()
  } catch (error: any) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('下载备份失败：网络请求失败或被 CORS 拦截。')
    }
    throw error
  }
}

/**
 * 从 Cloudflare R2 / S3 删除指定备份文件
 */
export async function deleteFromS3(config: S3Config, filename: string): Promise<void> {
  const { bucketUrl, prefix } = normalizeS3Config(config)
  const client = getAwsClient(config)

  const s3Key = prefix ? `${prefix}/${filename}` : filename
  const fileUrl = `${bucketUrl}/${s3Key}`

  const response = await client.fetch(fileUrl, {
    method: 'DELETE'
  })

  if (!response.ok && response.status !== 204 && response.status !== 404) {
    throw new Error(`删除备份文件失败，状态码: ${response.status}`)
  }
}

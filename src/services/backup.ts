import { db } from '@/db'
import { getCategoryPresets, saveCategoryPresets, type CategoryPreset } from '@/config/categories'
import { useRepoStore } from '@/stores/repo'
import { useTagStore } from '@/stores/tag'

export interface BackupDataPayload {
  version: string
  exportDate: string
  data: {
    repos: any[]
    tags: any[]
    repoTags: any[]
    categoryPresets?: CategoryPreset[]
  }
  stats?: any
}

/**
 * 汇总系统当前全部数据生成标准备份 Payload
 */
export async function createBackupPayload(stats?: any): Promise<BackupDataPayload> {
  const repos = await db.repos.toArray()
  const tags = await db.tags.toArray()
  const repoTags = db.repoTags ? await db.repoTags.toArray() : []

  return {
    version: '1.0',
    exportDate: new Date().toISOString(),
    data: {
      repos,
      tags,
      repoTags,
      categoryPresets: getCategoryPresets()
    },
    stats: stats || null
  }
}

/**
 * 生成备份的 JSON 字符串内容
 */
export async function createBackupContent(stats?: any): Promise<string> {
  const payload = await createBackupPayload(stats)
  return JSON.stringify(payload, null, 2)
}

/**
 * 触发浏览器本地下载文件
 */
export function downloadJsonFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * 从 JSON 文本或对象执行恢复
 */
export async function restoreBackupData(importData: string | BackupDataPayload): Promise<void> {
  const data: BackupDataPayload = typeof importData === 'string' ? JSON.parse(importData) : importData

  // 1. 验证格式
  if (!data.version || !data.data) {
    throw new Error('备份文件格式无效：缺少版本号或数据字段')
  }

  const repoStore = useRepoStore()
  const tagStore = useTagStore()

  // 2. 强制中断正在进行的同步任务以防冲突
  repoStore.$state.currentSyncId = 0
  repoStore.$state.isSyncing = false
  repoStore.$state.isFetching = false

  // 3. 清空现有数据库表
  await db.repos.clear()
  await db.tags.clear()
  if (db.repoTags) {
    await db.repoTags.clear()
  }

  // 4. 批量写入备份数据
  if (data.data.repos && data.data.repos.length > 0) {
    await db.repos.bulkAdd(data.data.repos)
  }

  if (data.data.tags && data.data.tags.length > 0) {
    await db.tags.bulkAdd(data.data.tags)
  }

  if (data.data.repoTags && data.data.repoTags.length > 0 && db.repoTags) {
    await db.repoTags.bulkAdd(data.data.repoTags)
  }

  // 5. 恢复分类预设
  if (data.data.categoryPresets) {
    saveCategoryPresets(data.data.categoryPresets)
  }

  // 6. 刷新 Store 数据
  await tagStore.loadTags()
  await repoStore.loadRepos()
}

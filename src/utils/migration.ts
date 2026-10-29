import { DEFAULT_CATEGORIES, getCategoryPresets, saveCategoryPresets, type CategoryPreset } from '@/config/categories'
import { getMultiAIConfig } from '@/config/ai'
import { db } from '@/db'
import { inferCategoryStyle, isTagUnstyled } from '@/utils/categoryStyles'

const APP_SCHEMA_VERSION = 2
const SCHEMA_VERSION_KEY = 'app_schema_version'

/**
 * 运行系统数据与配置的平滑升级（非破坏性迁移）
 * 保证新部署或版本更新时：
 * 1. AI 配置平滑升至多配置结构，不丢失用户既有的 Key 与参数
 * 2. 分类预设增量合并新官方分类，保留用户的自定义分类与修改
 * 3. 自动扫描补齐 IndexedDB 现有标签缺失的 Emoji 与鲜艳主题色
 */
export async function runAppMigrations(): Promise<void> {
  const currentVersion = parseInt(localStorage.getItem(SCHEMA_VERSION_KEY) || '1', 10)

  try {
    // 1. AI 配置平滑过渡：调用 getMultiAIConfig 触发自愈与迁移
    getMultiAIConfig()

    // 2. 预设分类无损增量合并
    migrateCategoryPresets()

    // 3. 标签（Tags）平滑美化升级（针对截图中无 emoji、灰色圆点的标签）
    await migrateTagsStyle()

    // 4. 更新记录版本号
    if (currentVersion < APP_SCHEMA_VERSION) {
      localStorage.setItem(SCHEMA_VERSION_KEY, APP_SCHEMA_VERSION.toString())
    }
  } catch (error) {
    console.error('[Migration] Failed to run non-destructive app migration:', error)
  }
}

/**
 * 增量合并新版预设分类，保留用户现有的修改与自定义项
 */
function migrateCategoryPresets(): void {
  const stored = localStorage.getItem('category_presets')
  if (!stored) {
    // 首次直接使用最新预设
    saveCategoryPresets([...DEFAULT_CATEGORIES])
    return
  }

  try {
    const existingPresets: CategoryPreset[] = JSON.parse(stored)
    if (!Array.isArray(existingPresets)) return

    const existingNames = new Set(existingPresets.map(p => p.name.trim().toLowerCase()))
    let hasChanges = false

    // 检查并增量补充官方新版预设（如 AI / 大模型、桌面应用、CLI 等）
    for (const defaultPreset of DEFAULT_CATEGORIES) {
      const lower = defaultPreset.name.trim().toLowerCase()
      if (!existingNames.has(lower)) {
        existingPresets.push({ ...defaultPreset })
        existingNames.add(lower)
        hasChanges = true
      }
    }

    // 检查是否有缺失 emoji 的老预设，给予补齐
    for (const preset of existingPresets) {
      if (!preset.emoji || preset.emoji.trim() === '') {
        const style = inferCategoryStyle(preset.name)
        preset.emoji = style.emoji
        hasChanges = true
      }
    }

    if (hasChanges) {
      saveCategoryPresets(existingPresets)
    }
  } catch (e) {
    console.error('[Migration] Failed to merge category presets:', e)
  }
}

/**
 * 扫描 IndexedDB 中的现有标签，自动补齐缺失 Emoji 和默认灰色分类
 */
async function migrateTagsStyle(): Promise<void> {
  try {
    if (!db.isOpen()) {
      await db.open()
    }

    const tags = await db.tags.toArray()
    if (!tags || tags.length === 0) return

    let updated = false
    const newTags = tags.map(tag => {
      if (isTagUnstyled(tag)) {
        const style = inferCategoryStyle(tag.name)
        let changed = false
        const t = { ...tag }
        if (!t.emoji) {
          t.emoji = style.emoji
          changed = true
        }
        if (isTagUnstyled(tag)) {
          t.color = style.color
          changed = true
        }
        if (changed) {
          updated = true
          return t
        }
      }
      return tag
    })

    if (updated) {
      await db.tags.clear()
      await db.tags.bulkAdd(newTags)
    }
  } catch (e) {
    console.warn('[Migration] Tag style migration warning:', e)
  }
}

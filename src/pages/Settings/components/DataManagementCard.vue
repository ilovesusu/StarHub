<template>
  <el-card class="settings-card" style="margin-top: 20px;">
    <template #header>
      <div class="card-header">
        <span>{{ t('settings.dataManagement') }}</span>
      </div>
    </template>

    <div class="data-management">
      <el-alert
        :title="t('settings.dataBackup')"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 20px;"
      >
        {{ t('settings.dataBackupDesc') }}
      </el-alert>

      <div class="data-actions">
        <el-button type="primary" @click="handleExport" :loading="exporting" size="default">
          <el-icon><Download /></el-icon>
          {{ t('settings.exportData') }}
        </el-button>
        <el-button @click="handleImport" :loading="importing" size="default">
          <el-icon><Upload /></el-icon>
          {{ t('settings.importData') }}
        </el-button>
        <el-button type="danger" @click="handleClearAll" plain size="default">
          <el-icon><Delete /></el-icon>
          {{ t('settings.clearAllData') }}
        </el-button>
        <el-button @click="handleCheckDatabase" size="small" text>
          <el-icon><View /></el-icon>
          检查数据库
        </el-button>
      </div>

      <el-alert
        v-if="repoStore.isSyncing"
        title="正在同步数据"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 16px;"
      >
        正在从 GitHub 同步数据 ({{ repoStore.syncProgress.count }} 个仓库)。清空数据前会先停止同步。
      </el-alert>

      <div class="data-stats" v-if="dataStats">
        <div class="stats-grid">
          <div class="stat-card" :key="`repos-${dataStats.repos}`">
            <div class="stat-label">{{ t('settings.repoCount') }}</div>
            <div class="stat-value" :class="{ 'is-zero': dataStats.repos === 0 }">{{ dataStats.repos }}</div>
          </div>
          <div class="stat-card" :key="`tags-${dataStats.tags}`">
            <div class="stat-label">{{ t('settings.tagCount') }}</div>
            <div class="stat-value" :class="{ 'is-zero': dataStats.tags === 0 }">{{ dataStats.tags }}</div>
          </div>
          <div class="stat-card" :key="`tagged-${dataStats.taggedRepos}`">
            <div class="stat-label">{{ t('settings.taggedRepos') }}</div>
            <div class="stat-value" :class="{ 'is-zero': dataStats.taggedRepos === 0 }">{{ dataStats.taggedRepos }}</div>
          </div>
          <div class="stat-card" :key="`untagged-${dataStats.untaggedRepos}`">
            <div class="stat-label">{{ t('settings.untaggedRepos') }}</div>
            <div class="stat-value" :class="{ 'is-zero': dataStats.untaggedRepos === 0 }">{{ dataStats.untaggedRepos }}</div>
          </div>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onActivated, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Upload, Delete, View } from '@element-plus/icons-vue'
import { useRepoStore } from '@/stores/repo'
import { useTagStore } from '@/stores/tag'
import { db } from '@/db'
import { createBackupContent, downloadJsonFile, restoreBackupData } from '@/services/backup'

const { t } = useI18n()
const router = useRouter()
const repoStore = useRepoStore()
const tagStore = useTagStore()

const exporting = ref(false)
const importing = ref(false)

const dataStats = ref<{
  repos: number
  tags: number
  taggedRepos: number
  untaggedRepos: number
} | null>(null)

const loadDataStats = async () => {
  try {
    if (!db.isOpen()) {
      await db.open()
    }

    const repos = await db.repos.toArray()
    const tags = await db.tags.toArray()

    const taggedRepoIds = new Set<number>()
    tags.forEach(tag => {
      if (tag.repos && Array.isArray(tag.repos)) {
        tag.repos.forEach(id => taggedRepoIds.add(id))
      }
    })

    dataStats.value = {
      repos: repos.length,
      tags: tags.length,
      taggedRepos: taggedRepoIds.size,
      untaggedRepos: Math.max(0, repos.length - taggedRepoIds.size)
    }
  } catch (error) {
    console.error('Failed to load data stats:', error)
    dataStats.value = {
      repos: 0,
      tags: 0,
      taggedRepos: 0,
      untaggedRepos: 0
    }
  }
}

onMounted(async () => {
  if (tagStore.tags.length === 0) {
    await tagStore.loadTags()
  }
  await loadDataStats()
})

onActivated(async () => {
  await loadDataStats()
})

watch(
  [() => repoStore.repos.length, () => tagStore.tags.length],
  () => {
    loadDataStats()
  }
)

const handleExport = async () => {
  try {
    exporting.value = true
    const content = await createBackupContent(dataStats.value)
    const filename = `starhub-backup-${new Date().toISOString().split('T')[0]}.json`
    downloadJsonFile(filename, content)
    ElMessage.success(`数据已导出到 ${filename}`)
  } catch (error) {
    console.error('Export failed:', error)
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}

const handleImport = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return

    try {
      importing.value = true
      const text = await file.text()
      const parsed = JSON.parse(text)

      if (!parsed.version || !parsed.data) {
        throw new Error('备份文件格式无效')
      }

      await ElMessageBox.confirm(
        `即将导入数据：\n` +
        `- 仓库：${parsed.data.repos?.length || 0} 个\n` +
        `- 分类：${parsed.data.tags?.length || 0} 个\n` +
        `- 导出日期：${parsed.exportDate || '-'}\n\n` +
        `⚠️ 此操作将覆盖当前所有数据，是否继续？`,
        '确认导入',
        {
          confirmButtonText: '确认导入',
          cancelButtonText: '取消',
          type: 'warning',
          confirmButtonClass: 'el-button--danger'
        }
      )

      await restoreBackupData(parsed)
      await loadDataStats()

      ElMessage.success('数据导入成功！')

      setTimeout(() => {
        ElMessage({
          message: '数据已导入，正在返回主页...',
          type: 'success',
          duration: 1500
        })

        setTimeout(() => {
          router.push('/').then(() => {
            window.location.reload()
          })
        }, 800)
      }, 500)
    } catch (error: any) {
      if (error !== 'cancel') {
        console.error('Import failed:', error)
        ElMessage.error(`导入失败: ${error.message || '未知错误'}`)
      }
    } finally {
      importing.value = false
    }
  }

  input.click()
}

const handleCheckDatabase = async () => {
  try {
    const repoCount = await db.repos.count()
    const tagCount = await db.tags.count()
    const repoTagCount = db.repoTags ? await db.repoTags.count() : 0
    const isOpen = db.isOpen()

    await ElMessageBox.alert(
      `数据库状态:\n\n` +
      `- 数据库状态: ${isOpen ? '已打开' : '已关闭'}\n` +
      `- 数据库中的仓库: ${repoCount} 个\n` +
      `- 数据库中的标签: ${tagCount} 个\n` +
      `- 数据库中的关联: ${repoTagCount} 个\n` +
      `- Store 中的仓库: ${repoStore.repos.length} 个\n` +
      `- Store 中的标签: ${tagStore.tags.length} 个`,
      '数据库状态',
      {
        confirmButtonText: '关闭',
        type: 'info'
      }
    )
  } catch (error) {
    console.error('检查数据库失败:', error)
    ElMessage.error('检查数据库失败')
  }
}

const handleClearAll = async () => {
  try {
    const isSyncing = repoStore.isSyncing
    let confirmMessage = '⚠️ 此操作将清空所有数据，包括：\n' +
      `- ${dataStats.value?.repos || 0} 个仓库\n` +
      `- ${dataStats.value?.tags || 0} 个分类\n` +
      `- 所有分类关联关系\n\n`

    if (isSyncing) {
      confirmMessage += '⚠️ 检测到正在进行同步操作！\n' +
                       '清空数据前会先停止同步。\n\n'
    }

    confirmMessage += '建议先导出数据进行备份。\n\n此操作不可恢复，是否继续？'

    await ElMessageBox.confirm(
      confirmMessage,
      '确认清空所有数据',
      {
        confirmButtonText: '确认清空',
        cancelButtonText: '取消',
        type: 'error',
        confirmButtonClass: 'el-button--danger'
      }
    )

    if (isSyncing) {
      repoStore.$state.currentSyncId = 0
      repoStore.$state.isSyncing = false
      repoStore.$state.isFetching = false
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    dataStats.value = {
      repos: 0,
      tags: 0,
      taggedRepos: 0,
      untaggedRepos: 0
    }

    repoStore.$state.repos = []
    repoStore.$state.selectedTag = null
    repoStore.$state.selectedLanguage = null
    repoStore.$state.filterType = 'all'
    repoStore.$state.searchQuery = ''
    repoStore.$state.currentPage = 1
    repoStore.$state.syncProgress = { current: 0, total: 0, count: 0 }
    tagStore.$state.tags = []
    tagStore.$state.loading = false

    await db.repos.clear()
    await db.tags.clear()
    if (db.repoTags) {
      await db.repoTags.clear()
    }

    await loadDataStats()
    ElMessage.success('所有数据已清空')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('清空数据失败:', error)
      ElMessage.error('清空数据失败')
    }
  }
}
</script>

<style scoped lang="scss">
.card-header {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.data-management {
  .data-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }

  .data-stats {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--border-color);

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
    }

    .stat-card {
      padding: 16px;
      background-color: var(--bg-tertiary);
      border-radius: 8px;
      text-align: center;
      transition: all 0.3s ease;

      .stat-label {
        font-size: 0.85rem;
        color: var(--text-secondary);
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 1.8rem;
        font-weight: 600;
        color: var(--text-primary);

        &.is-zero {
          color: var(--text-tertiary);
        }
      }
    }
  }
}
</style>

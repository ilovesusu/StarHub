<template>
  <el-card class="settings-card" style="margin-top: 20px;">
    <template #header>
      <div class="card-header">
        <span>{{ t('settings.syncSettings') }}</span>
      </div>
    </template>

    <div class="sync-settings">
      <el-form label-width="120px" label-position="left">
        <el-form-item :label="t('settings.syncInterval')">
          <el-select v-model="syncIntervalVal" style="width: 260px;">
            <el-option :label="t('settings.interval10m')" :value="10" />
            <el-option :label="t('settings.interval30m')" :value="30" />
            <el-option :label="t('settings.interval1h')" :value="60" />
            <el-option :label="t('settings.interval4h')" :value="240" />
            <el-option :label="t('settings.interval24h')" :value="1440" />
            <el-option :label="t('settings.intervalManual')" :value="0" />
          </el-select>
          <div class="form-tip">{{ t('settings.syncIntervalTip') }}</div>
        </el-form-item>

        <el-form-item :label="t('settings.lastSyncTime')">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <span style="font-size: 0.9rem; color: var(--text-secondary);">
              {{ formattedLastSyncTime }}
            </span>
            <el-button 
              type="primary" 
              size="default" 
              :loading="repoStore.isSyncing" 
              @click="handleManualSync"
            >
              <el-icon v-if="!repoStore.isSyncing" style="margin-right: 6px;"><Refresh /></el-icon>
              {{ repoStore.isSyncing ? t('settings.syncing') : t('settings.syncNow') }}
            </el-button>
          </div>
        </el-form-item>

        <el-form-item v-if="repoStore.isSyncing">
          <div style="width: 100%; max-width: 500px;">
            <el-progress 
              :percentage="syncPercentage" 
              :status="repoStore.syncProgress.current === repoStore.syncProgress.total ? 'success' : undefined"
            />
            <div class="form-tip" style="margin-top: 5px;">
              正在同步第 {{ repoStore.syncProgress.current }} / {{ repoStore.syncProgress.total || '?' }} 页 (已加载 {{ repoStore.syncProgress.count }} 个仓库)
            </div>
          </div>
        </el-form-item>
      </el-form>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { useRepoStore } from '@/stores/repo'

const { t } = useI18n()
const repoStore = useRepoStore()

const syncIntervalVal = computed({
  get: () => repoStore.syncInterval,
  set: (val) => {
    repoStore.setSyncInterval(val)
    ElMessage.success(t('settings.saveSuccess'))
  }
})

const formattedLastSyncTime = computed(() => {
  if (!repoStore.lastSyncTime) {
    return t('settings.neverSynced')
  }
  const date = new Date(repoStore.lastSyncTime)
  return date.toLocaleString()
})

const syncPercentage = computed(() => {
  const { current, total } = repoStore.syncProgress
  if (!total) return 0
  return Math.round((current / total) * 100)
})

const handleManualSync = async () => {
  try {
    ElMessage.info(t('settings.syncStarted'))
    await repoStore.loadRepos({ forceSync: true })
    ElMessage.success(t('settings.syncCompleted'))
  } catch {
    ElMessage.error(t('settings.syncFailed'))
  }
}
</script>

<style scoped lang="scss">
.card-header {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.form-tip {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 5px;
}
</style>

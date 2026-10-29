<template>
  <div class="settings-page">
    <div class="settings-header">
      <h1>{{ t('menu.settings') }}</h1>
    </div>

    <div class="settings-content">
      <!-- 预设分类配置 -->
      <CategoryPresetsCard />

      <!-- AI 智能分类配置与 API 指南 -->
      <AIConfigCard />

      <!-- 数据管理与本地备份 -->
      <DataManagementCard />

      <!-- WebDAV 云端备份与恢复 -->
      <WebDAVBackupCard />

      <!-- Cloudflare R2 / S3 兼容云端备份与恢复 -->
      <S3BackupCard />

      <!-- 自动同步设置 -->
      <SyncSettingsCard />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CategoryPresetsCard from './components/CategoryPresetsCard.vue'
import AIConfigCard from './components/AIConfigCard.vue'
import DataManagementCard from './components/DataManagementCard.vue'
import WebDAVBackupCard from './components/WebDAVBackupCard.vue'
import S3BackupCard from './components/S3BackupCard.vue'
import SyncSettingsCard from './components/SyncSettingsCard.vue'

const { t } = useI18n()
</script>

<style scoped lang="scss">
.settings-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  
  // 深色模式下使用与应用一致的背景色
  [data-theme='dark'] & {
    background-color: #1c2333 !important;
  }
}

.settings-header {
  padding: 24px 32px;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-secondary);
  
  // 深色模式下使用与应用一致的背景色
  [data-theme='dark'] & {
    background-color: #252d3d !important;
    border-bottom-color: rgba(96, 165, 250, 0.2) !important;
  }

  h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.settings-content {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
}

:deep(.settings-card) {
  max-width: 800px;
  background-color: var(--bg-primary) !important;
  border-color: var(--border) !important;
  
  // 深色模式下使用与应用一致的背景色
  [data-theme='dark'] & {
    background-color: #252d3d !important;
    border-color: rgba(96, 165, 250, 0.2) !important;
  }

  .el-card__header {
    background-color: var(--bg-secondary) !important;
    border-bottom-color: var(--border) !important;
    color: var(--text-primary) !important;
    
    // 深色模式下使用与应用一致的背景色
    [data-theme='dark'] & {
      background-color: #252d3d !important;
      border-bottom-color: rgba(96, 165, 250, 0.2) !important;
    }
  }
  
  .el-card__body {
    background-color: var(--bg-primary) !important;
    color: var(--text-primary) !important;
    
    // 深色模式下使用与应用一致的背景色
    [data-theme='dark'] & {
      background-color: #252d3d !important;
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    color: var(--text-primary) !important;
  }
}

:deep(.form-tip) {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}
</style>

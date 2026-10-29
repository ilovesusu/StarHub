<template>
  <el-card class="settings-card" style="margin-top: 20px;">
    <template #header>
      <div class="card-header">
        <span>{{ t('settings.webdavBackup') }}</span>
      </div>
    </template>

    <el-form :model="webdavConfig" label-width="120px" label-position="left">
      <el-form-item :label="t('settings.webdavUrl')">
        <el-input
          v-model="webdavConfig.url"
          placeholder="https://example.com/dav"
        />
      </el-form-item>

      <el-form-item :label="t('settings.webdavUsername')">
        <el-input
          v-model="webdavConfig.username"
          placeholder="Username"
        />
      </el-form-item>

      <el-form-item :label="t('settings.webdavPassword')">
        <el-input
          v-model="webdavConfig.password"
          type="password"
          show-password
          placeholder="Password or App Token"
        />
      </el-form-item>

      <el-form-item :label="t('settings.webdavDirectory')">
        <el-input
          v-model="webdavConfig.directory"
          placeholder="/StarHub"
        />
        <div class="form-tip">{{ t('settings.webdavDirectoryTip') }}</div>
      </el-form-item>

      <div class="form-tip" style="color: var(--el-color-warning); margin-bottom: 18px; line-height: 1.5;">
        {{ t('settings.webdavCorsTip') }}
      </div>

      <el-form-item>
        <el-button type="primary" @click="handleSave">
          {{ t('common.save') }}
        </el-button>
        <el-button @click="handleTest" :loading="testing">
          {{ t('settings.webdavTest') }}
        </el-button>
        <el-button type="success" @click="handleBackup" :loading="backingUp" :disabled="!isConfigured">
          <el-icon><Download /></el-icon>
          {{ t('settings.webdavBackupBtn') }}
        </el-button>
        <el-button type="warning" @click="handleShowRestore" :loading="restoring" :disabled="!isConfigured">
          <el-icon><Upload /></el-icon>
          {{ t('settings.webdavRestoreBtn') }}
        </el-button>
      </el-form-item>
    </el-form>

    <!-- 统一复用云端恢复弹窗 -->
    <BackupRestoreDialog
      v-model="showRestoreDialog"
      :title="t('settings.webdavBackupList')"
      :loading="loadingBackups"
      :backups="backups"
      :confirm-message="t('settings.webdavRestoreConfirm')"
      :empty-text="t('settings.webdavNoBackup')"
      @restore="handleRestore"
    />
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download, Upload } from '@element-plus/icons-vue'
import {
  testWebDAVConnection,
  uploadToWebDAV,
  downloadFromWebDAV,
  listWebDAVBackups,
  type WebDAVConfig,
  type WebDAVBackupFile
} from '@/utils/webdav'
import { createBackupContent, restoreBackupData } from '@/services/backup'
import BackupRestoreDialog from './BackupRestoreDialog.vue'

const { t } = useI18n()
const router = useRouter()

const webdavConfig = ref<WebDAVConfig>({
  url: '',
  username: '',
  password: '',
  directory: '/StarHub'
})

const testing = ref(false)
const backingUp = ref(false)
const restoring = ref(false)
const showRestoreDialog = ref(false)
const loadingBackups = ref(false)
const backups = ref<WebDAVBackupFile[]>([])

const isConfigured = computed(() => {
  return !!(webdavConfig.value.url.trim() && webdavConfig.value.username.trim())
})

onMounted(() => {
  const saved = localStorage.getItem('webdav_config')
  if (saved) {
    try {
      webdavConfig.value = {
        url: '',
        username: '',
        password: '',
        directory: '/StarHub',
        ...JSON.parse(saved)
      }
    } catch (e) {
      console.error('Failed to parse saved WebDAV config:', e)
    }
  }
})

const handleSave = () => {
  if (!webdavConfig.value.url.trim()) {
    ElMessage.warning('请输入 WebDAV 服务器地址')
    return
  }
  localStorage.setItem('webdav_config', JSON.stringify(webdavConfig.value))
  ElMessage.success(t('settings.webdavConfigSaved'))
}

const handleTest = async () => {
  if (!webdavConfig.value.url.trim() || !webdavConfig.value.username.trim()) {
    ElMessage.warning('请先输入 WebDAV 服务器地址和用户名')
    return
  }

  testing.value = true
  try {
    await testWebDAVConnection(webdavConfig.value)
    ElMessage.success('WebDAV 连接成功！')
  } catch (error: any) {
    console.error('WebDAV connection failed:', error)
    ElMessage.error(`连接失败: ${error.message || '未知错误'}`)
  } finally {
    testing.value = false
  }
}

const handleBackup = async () => {
  try {
    backingUp.value = true
    const content = await createBackupContent()

    await uploadToWebDAV(webdavConfig.value, 'starhub-backup-latest.json', content)

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-')
    const archiveFilename = `starhub-backup-${dateStr}.json`
    await uploadToWebDAV(webdavConfig.value, archiveFilename, content)

    ElMessage.success(t('settings.webdavBackupSuccess'))
  } catch (error: any) {
    console.error('WebDAV backup failed:', error)
    ElMessage.error(`备份失败: ${error.message || '未知错误'}`)
  } finally {
    backingUp.value = false
  }
}

const handleShowRestore = async () => {
  showRestoreDialog.value = true
  loadingBackups.value = true
  try {
    backups.value = await listWebDAVBackups(webdavConfig.value)
  } catch (error: any) {
    console.error('Failed to list backups:', error)
    ElMessage.error(`获取备份列表失败: ${error.message || '未知错误'}`)
  } finally {
    loadingBackups.value = false
  }
}

const handleRestore = async (filename: string) => {
  try {
    restoring.value = true
    const text = await downloadFromWebDAV(webdavConfig.value, filename)
    await restoreBackupData(text)

    ElMessage.success(t('settings.webdavRestoreSuccess'))

    setTimeout(() => {
      ElMessage({
        message: '数据已恢复，正在返回主页...',
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
    console.error('WebDAV restore failed:', error)
    ElMessage.error(`恢复失败: ${error.message || '未知错误'}`)
  } finally {
    restoring.value = false
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

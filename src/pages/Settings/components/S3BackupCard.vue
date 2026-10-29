<template>
  <el-card class="settings-card" style="margin-top: 20px;">
    <template #header>
      <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
        <span>{{ t('settings.s3Backup') }}</span>
        <el-button text size="small" type="primary" @click="showCorsHelpDialog = true">
          <el-icon style="margin-right: 4px;"><QuestionFilled /></el-icon>
          {{ t('settings.s3CorsHelpTitle') }}
        </el-button>
      </div>
    </template>

    <el-form :model="s3Config" label-width="130px" label-position="left">
      <el-form-item :label="t('settings.s3Endpoint')">
        <el-input
          v-model="s3Config.endpoint"
          placeholder="https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
        />
        <div class="form-tip">{{ t('settings.s3EndpointTip') }}</div>
      </el-form-item>

      <el-form-item :label="t('settings.s3Bucket')">
        <el-input
          v-model="s3Config.bucket"
          placeholder="starhub-backup"
        />
        <div class="form-tip">{{ t('settings.s3BucketTip') }}</div>
      </el-form-item>

      <el-form-item :label="t('settings.s3AccessKey')">
        <el-input
          v-model="s3Config.accessKeyId"
          placeholder="Access Key ID"
        />
      </el-form-item>

      <el-form-item :label="t('settings.s3SecretKey')">
        <el-input
          v-model="s3Config.secretAccessKey"
          type="password"
          show-password
          placeholder="Secret Access Key"
        />
      </el-form-item>

      <el-form-item :label="t('settings.s3Region')">
        <el-input
          v-model="s3Config.region"
          placeholder="auto"
        />
        <div class="form-tip">{{ t('settings.s3RegionTip') }}</div>
      </el-form-item>

      <el-form-item :label="t('settings.s3Prefix')">
        <el-input
          v-model="s3Config.prefix"
          placeholder="StarHub"
        />
        <div class="form-tip">{{ t('settings.s3PrefixTip') }}</div>
      </el-form-item>

      <div class="form-tip" style="color: var(--el-color-warning); margin-bottom: 18px; line-height: 1.5;">
        {{ t('settings.s3CorsTip') }}
      </div>

      <el-form-item>
        <el-button type="primary" @click="handleSave">
          {{ t('common.save') }}
        </el-button>
        <el-button @click="handleTest" :loading="testing">
          {{ t('settings.s3Test') }}
        </el-button>
        <el-button type="success" @click="handleBackup" :loading="backingUp" :disabled="!isConfigured">
          <el-icon><Download /></el-icon>
          {{ t('settings.s3BackupBtn') }}
        </el-button>
        <el-button type="warning" @click="handleShowRestore" :loading="restoring" :disabled="!isConfigured">
          <el-icon><Upload /></el-icon>
          {{ t('settings.s3RestoreBtn') }}
        </el-button>
      </el-form-item>
    </el-form>

    <!-- 统一复用云端恢复弹窗 -->
    <BackupRestoreDialog
      v-model="showRestoreDialog"
      :title="t('settings.s3BackupList')"
      :loading="loadingBackups"
      :backups="backups"
      :confirm-message="t('settings.s3RestoreConfirm')"
      :empty-text="t('settings.s3NoBackup')"
      @restore="handleRestore"
    />

    <!-- Cloudflare R2 CORS 配置引导对话框 -->
    <el-dialog
      v-model="showCorsHelpDialog"
      :title="t('settings.s3CorsHelpTitle')"
      width="600px"
    >
      <div style="line-height: 1.6; margin-bottom: 12px; font-size: 14px;">
        {{ t('settings.s3CorsHelpContent') }}
      </div>
      <pre style="background: rgba(0,0,0,0.06); padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto;"><code>[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT", "HEAD", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 86400
  }
]</code></pre>
      <template #footer>
        <el-button type="primary" @click="handleCopyCorsConfig">
          复制 CORS 规则 JSON
        </el-button>
        <el-button @click="showCorsHelpDialog = false">关闭</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Download, Upload, QuestionFilled } from '@element-plus/icons-vue'
import {
  testS3Connection,
  uploadToS3,
  downloadFromS3,
  listS3Backups,
  type S3Config,
  type S3BackupFile
} from '@/utils/s3'
import { createBackupContent, restoreBackupData } from '@/services/backup'
import BackupRestoreDialog from './BackupRestoreDialog.vue'

const { t } = useI18n()
const router = useRouter()

const s3Config = ref<S3Config>({
  endpoint: '',
  bucket: '',
  accessKeyId: '',
  secretAccessKey: '',
  region: 'auto',
  prefix: 'StarHub'
})

const testing = ref(false)
const backingUp = ref(false)
const restoring = ref(false)
const showRestoreDialog = ref(false)
const loadingBackups = ref(false)
const showCorsHelpDialog = ref(false)
const backups = ref<S3BackupFile[]>([])

const isConfigured = computed(() => {
  return !!(
    s3Config.value.endpoint.trim() &&
    s3Config.value.bucket.trim() &&
    s3Config.value.accessKeyId.trim() &&
    s3Config.value.secretAccessKey.trim()
  )
})

onMounted(() => {
  const saved = localStorage.getItem('s3_config')
  if (saved) {
    try {
      s3Config.value = {
        endpoint: '',
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
        region: 'auto',
        prefix: 'StarHub',
        ...JSON.parse(saved)
      }
    } catch (e) {
      console.error('Failed to parse saved S3 config:', e)
    }
  }
})

const handleSave = () => {
  if (!s3Config.value.endpoint.trim() || !s3Config.value.bucket.trim()) {
    ElMessage.warning('请输入 Endpoint 地址和存储桶名称')
    return
  }
  localStorage.setItem('s3_config', JSON.stringify(s3Config.value))
  ElMessage.success(t('settings.s3ConfigSaved'))
}

const handleTest = async () => {
  if (
    !s3Config.value.endpoint.trim() ||
    !s3Config.value.bucket.trim() ||
    !s3Config.value.accessKeyId.trim() ||
    !s3Config.value.secretAccessKey.trim()
  ) {
    ElMessage.warning('请完整填写 Endpoint、Bucket、Access Key ID 和 Secret Access Key')
    return
  }

  testing.value = true
  try {
    await testS3Connection(s3Config.value)
    ElMessage.success('Cloudflare R2 / S3 连接成功！')
  } catch (error: any) {
    console.error('S3 connection failed:', error)
    ElMessage.error(`连接失败: ${error.message || '未知错误'}`)
  } finally {
    testing.value = false
  }
}

const handleBackup = async () => {
  try {
    backingUp.value = true
    const content = await createBackupContent()

    await uploadToS3(s3Config.value, 'starhub-backup-latest.json', content)

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-')
    const archiveFilename = `starhub-backup-${dateStr}.json`
    await uploadToS3(s3Config.value, archiveFilename, content)

    ElMessage.success(t('settings.s3BackupSuccess'))
  } catch (error: any) {
    console.error('S3 backup failed:', error)
    ElMessage.error(`备份失败: ${error.message || '未知错误'}`)
  } finally {
    backingUp.value = false
  }
}

const handleShowRestore = async () => {
  showRestoreDialog.value = true
  loadingBackups.value = true
  try {
    backups.value = await listS3Backups(s3Config.value)
  } catch (error: any) {
    console.error('Failed to list S3 backups:', error)
    ElMessage.error(`获取备份列表失败: ${error.message || '未知错误'}`)
  } finally {
    loadingBackups.value = false
  }
}

const handleRestore = async (filename: string) => {
  try {
    restoring.value = true
    const text = await downloadFromS3(s3Config.value, filename)
    await restoreBackupData(text)

    ElMessage.success(t('settings.s3RestoreSuccess'))

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
    console.error('S3 restore failed:', error)
    ElMessage.error(`恢复失败: ${error.message || '未知错误'}`)
  } finally {
    restoring.value = false
  }
}

const handleCopyCorsConfig = async () => {
  const corsJson = JSON.stringify(
    [
      {
        AllowedOrigins: ['*'],
        AllowedMethods: ['GET', 'PUT', 'HEAD', 'DELETE'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag'],
        MaxAgeSeconds: 86400
      }
    ],
    null,
    2
  )

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(corsJson)
    } else {
      const textarea = document.createElement('textarea')
      textarea.value = corsJson
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    ElMessage.success('CORS 规则已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动选择复制')
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

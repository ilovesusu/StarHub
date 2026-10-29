<template>
  <div>
    <el-card class="settings-card">
      <template #header>
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>{{ t('settings.aiClassification') }}</span>
            <el-tag size="small" type="success" v-if="selectedProfileId === activeProfileId">
              {{ t('settings.activeAIProfile') }}
            </el-tag>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <el-select
              v-model="selectedProfileId"
              size="default"
              style="width: 200px;"
              @change="handleSelectProfile"
            >
              <el-option
                v-for="profile in profiles"
                :key="profile.id"
                :label="profile.name + (profile.id === activeProfileId ? ' (当前生效)' : '')"
                :value="profile.id"
              />
            </el-select>

            <el-button size="default" @click="handleCreateProfile">
              <el-icon><Plus /></el-icon>
              {{ t('settings.createAIProfile') }}
            </el-button>

            <el-button size="default" text @click="handleDuplicateProfile">
              <el-icon><CopyDocument /></el-icon>
              {{ t('settings.duplicateAIProfile') }}
            </el-button>

            <el-button
              size="default"
              text
              type="danger"
              :disabled="profiles.length <= 1"
              @click="handleDeleteProfile"
            >
              <el-icon><Delete /></el-icon>
              {{ t('settings.deleteAIProfile') }}
            </el-button>
          </div>
        </div>
      </template>

      <el-form :model="currentProfile" label-width="120px" label-position="left">
        <el-form-item :label="t('settings.aiProfileName')">
          <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
            <el-input
              v-model="currentProfile.name"
              :placeholder="t('settings.aiProfileNamePlaceholder')"
              style="max-width: 320px;"
            />
            <el-button
              v-if="selectedProfileId !== activeProfileId"
              type="primary"
              plain
              size="small"
              @click="handleSetAsActive"
            >
              {{ t('settings.setAsActiveProfile') }}
            </el-button>
          </div>
        </el-form-item>

        <el-form-item :label="t('settings.aiPlatform')">
          <el-select v-model="currentProfile.provider" :placeholder="t('settings.selectAIPlatform')" @change="handleProviderChange">
            <el-option :label="t('settings.openaiGuide')" value="openai" />
            <el-option :label="t('settings.claudeGuide')" value="claude" />
            <el-option :label="t('settings.qwenGuide')" value="qwen" />
            <el-option :label="t('settings.zhipuGuide')" value="zhipu" />
            <el-option :label="t('settings.deepseekGuide')" value="deepseek" />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('settings.apiKey')">
          <el-input
            v-model="currentProfile.apiKey"
            type="password"
            show-password
            :placeholder="t('settings.enterAPIKey')"
          />
        </el-form-item>

        <el-form-item :label="t('settings.apiAddress')">
          <el-input
            v-model="currentProfile.baseURL"
            :placeholder="getDefaultBaseURL()"
          >
            <template #append>
              <el-button @click="resetBaseURL">{{ t('common.reset') }}</el-button>
            </template>
          </el-input>
          <div class="form-tip">{{ t('settings.emptyForDefault') }}</div>
        </el-form-item>

        <el-form-item :label="t('settings.model')">
          <el-input
            v-model="currentProfile.model"
            :placeholder="getDefaultModel()"
          >
            <template #append>
              <el-button @click="resetModel">{{ t('common.reset') }}</el-button>
            </template>
          </el-input>
          <div class="form-tip">{{ t('settings.emptyForDefaultModel') }}</div>
        </el-form-item>

        <el-form-item :label="t('settings.batchSize')">
          <el-input-number
            v-model="currentProfile.batchSize"
            :min="1"
            :max="100"
            :step="10"
            :placeholder="50"
          />
          <div class="form-tip">{{ t('settings.batchSizeTip') }}</div>
        </el-form-item>

        <el-form-item :label="t('settings.concurrency')">
          <el-input-number
            v-model="currentProfile.concurrency"
            :min="1"
            :max="10"
            :step="1"
            :placeholder="2"
          />
          <div class="form-tip">{{ t('settings.concurrencyTip') }}</div>
        </el-form-item>

        <el-form-item v-if="currentProfile.provider === 'openai'" :label="t('settings.disableRateLimitWarning')">
          <el-switch v-model="currentProfile.disableRateLimitWarning" />
          <div class="form-tip">{{ t('settings.disableRateLimitWarningTip') }}</div>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSave">
            {{ t('common.save') }}
          </el-button>
          <el-button @click="handleTest" :loading="testing">
            {{ t('settings.testConnection') }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="settings-card" style="margin-top: 20px;">
      <template #header>
        <div class="card-header">
          <span>{{ t('settings.apiGuide') }}</span>
        </div>
      </template>

      <div class="api-guide">
        <el-collapse accordion>
          <el-collapse-item :title="t('settings.openaiGuide')" name="openai">
            <ol>
              <li>{{ t('settings.visitLink') }} <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI API Keys</a></li>
              <li>{{ t('settings.loginAndCreate') }} "Create new secret key"</li>
              <li>{{ t('settings.copyKey') }} {{ t('common.and') }} {{ t('settings.pasteAbove') }}</li>
              <li>{{ t('settings.recommendedModel') }}: gpt-4o-mini（{{ t('settings.lowCostFast') }}）</li>
            </ol>
          </el-collapse-item>

          <el-collapse-item :title="t('settings.claudeGuide')" name="claude">
            <ol>
              <li>{{ t('settings.visitLink') }} <a href="https://console.anthropic.com/settings/keys" target="_blank">Claude API Keys</a></li>
              <li>{{ t('settings.loginAndCreate') }} {{ t('settings.newAPIKey') }}</li>
              <li>{{ t('settings.copyKey') }}</li>
              <li>{{ t('settings.recommendedModel') }}: claude-3-5-sonnet-20241022</li>
            </ol>
          </el-collapse-item>

          <el-collapse-item :title="t('settings.qwenGuide')" name="qwen">
            <ol>
              <li>{{ t('settings.visitLink') }} <a href="https://dashscope.aliyun.com/" target="_blank">{{ t('settings.aliyunBailian') }}</a></li>
              <li>{{ t('settings.loginAndGoTo') }} "API-KEY 管理"</li>
              <li>{{ t('settings.createAndCopy') }} API Key</li>
              <li>{{ t('settings.recommendedModel') }}: qwen-plus {{ t('common.or') }} qwen-turbo</li>
            </ol>
          </el-collapse-item>

          <el-collapse-item :title="t('settings.zhipuGuide')" name="zhipu">
            <ol>
              <li>{{ t('settings.visitLink') }} <a href="https://open.bigmodel.cn/" target="_blank">{{ t('settings.zhipuPlatform') }}</a></li>
              <li>{{ t('settings.loginAndGoTo') }} "API 密钥"</li>
              <li>{{ t('settings.createAndCopy') }} API Key</li>
              <li>{{ t('settings.recommendedModel') }}: glm-4-flash（{{ t('settings.free') }}）</li>
            </ol>
          </el-collapse-item>

          <el-collapse-item :title="t('settings.deepseekGuide')" name="deepseek">
            <ol>
              <li>{{ t('settings.visitLink') }} <a href="https://platform.deepseek.com/api_keys" target="_blank">DeepSeek Platform</a></li>
              <li>{{ t('settings.loginAndCreate') }} API Key</li>
              <li>{{ t('settings.copyKey') }}</li>
              <li>{{ t('settings.recommendedModel') }}: deepseek-chat（{{ t('settings.costEffective') }}）</li>
            </ol>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, CopyDocument, Delete } from '@element-plus/icons-vue'
import {
  getMultiAIConfig,
  switchAIProfile,
  createAIProfile,
  duplicateAIProfile,
  updateAIProfile,
  deleteAIProfile,
  DEFAULT_MODELS,
  DEFAULT_BASE_URLS,
  type AIProfile
} from '@/config/ai'

const { t } = useI18n()

const profiles = ref<AIProfile[]>([])
const activeProfileId = ref('')
const selectedProfileId = ref('')
const currentProfile = ref<AIProfile>({
  id: '',
  name: '',
  provider: 'openai',
  apiKey: '',
  baseURL: '',
  model: '',
  batchSize: 50,
  concurrency: 2,
  disableRateLimitWarning: false
})

const testing = ref(false)

const loadProfiles = () => {
  const multi = getMultiAIConfig()
  profiles.value = multi.profiles
  activeProfileId.value = multi.activeProfileId

  if (!selectedProfileId.value || !profiles.value.some(p => p.id === selectedProfileId.value)) {
    selectedProfileId.value = multi.activeProfileId
  }

  const selected = profiles.value.find(p => p.id === selectedProfileId.value) || profiles.value[0]
  if (selected) {
    currentProfile.value = { ...selected }
  }
}

onMounted(() => {
  loadProfiles()
})

const handleSelectProfile = (id: string) => {
  selectedProfileId.value = id
  const target = profiles.value.find(p => p.id === id)
  if (target) {
    currentProfile.value = { ...target }
  }
}

const handleSetAsActive = () => {
  try {
    switchAIProfile(selectedProfileId.value)
    activeProfileId.value = selectedProfileId.value
    ElMessage.success(t('settings.switchedToProfile', { name: currentProfile.value.name }))
  } catch (e: any) {
    ElMessage.error(e.message || '切换失败')
  }
}

const handleCreateProfile = () => {
  const newP = createAIProfile({
    name: `配置方案 ${profiles.value.length + 1}`,
    provider: 'deepseek',
    model: 'deepseek-chat'
  })
  selectedProfileId.value = newP.id
  loadProfiles()
  ElMessage.success('已新建配置方案')
}

const handleDuplicateProfile = () => {
  try {
    const dup = duplicateAIProfile(selectedProfileId.value)
    selectedProfileId.value = dup.id
    loadProfiles()
    ElMessage.success('已复制配置方案')
  } catch (e: any) {
    ElMessage.error(e.message || '复制失败')
  }
}

const handleDeleteProfile = async () => {
  try {
    await ElMessageBox.confirm(
      t('settings.deleteAIProfileConfirm'),
      t('settings.deleteAIProfile'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )

    deleteAIProfile(selectedProfileId.value)
    selectedProfileId.value = ''
    loadProfiles()
    ElMessage.success('配置已删除')
  } catch (e) {
    // User cancelled
  }
}

const handleProviderChange = () => {
  currentProfile.value.baseURL = ''
  currentProfile.value.model = ''
}

const getDefaultBaseURL = () => {
  return DEFAULT_BASE_URLS[currentProfile.value.provider]
}

const getDefaultModel = () => {
  return DEFAULT_MODELS[currentProfile.value.provider]
}

const resetBaseURL = () => {
  currentProfile.value.baseURL = ''
}

const resetModel = () => {
  currentProfile.value.model = ''
}

const handleSave = () => {
  if (!currentProfile.value.name.trim()) {
    ElMessage.warning('请输入配置名称')
    return
  }

  if (!currentProfile.value.apiKey.trim()) {
    ElMessage.warning('请输入 API Key')
    return
  }

  updateAIProfile(selectedProfileId.value, { ...currentProfile.value })
  loadProfiles()
  ElMessage.success('设置已保存')
}

const handleTest = async () => {
  if (!currentProfile.value.apiKey) {
    ElMessage.warning('请先输入 API Key')
    return
  }

  testing.value = true

  try {
    const baseURL = currentProfile.value.baseURL || DEFAULT_BASE_URLS[currentProfile.value.provider]
    const model = currentProfile.value.model || DEFAULT_MODELS[currentProfile.value.provider]

    let response: Response

    if (currentProfile.value.provider === 'claude') {
      response = await fetch(`${baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': currentProfile.value.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }]
        })
      })
    } else {
      response = await fetch(`${baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentProfile.value.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10
        })
      })
    }

    if (response.ok) {
      ElMessage.success('连接成功！')
    } else {
      const error = await response.text()
      throw new Error(error)
    }
  } catch (error: any) {
    console.error('Test failed:', error)
    ElMessage.error(`连接失败: ${error.message}`)
  } finally {
    testing.value = false
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

.api-guide {
  ol {
    margin: 0;
    padding-left: 20px;

    li {
      margin-bottom: 8px;
      line-height: 1.6;
      color: var(--text-secondary);

      a {
        color: var(--el-color-primary);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
}
</style>

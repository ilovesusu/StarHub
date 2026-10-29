<template>
  <div>
    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('settings.aiClassification') }}</span>
        </div>
      </template>

      <el-form :model="aiConfig" label-width="120px" label-position="left">
        <el-form-item :label="t('settings.aiPlatform')">
          <el-select v-model="aiConfig.provider" :placeholder="t('settings.selectAIPlatform')" @change="handleProviderChange">
            <el-option :label="t('settings.openaiGuide')" value="openai" />
            <el-option :label="t('settings.claudeGuide')" value="claude" />
            <el-option :label="t('settings.qwenGuide')" value="qwen" />
            <el-option :label="t('settings.zhipuGuide')" value="zhipu" />
            <el-option :label="t('settings.deepseekGuide')" value="deepseek" />
          </el-select>
        </el-form-item>

        <el-form-item :label="t('settings.apiKey')">
          <el-input
            v-model="aiConfig.apiKey"
            type="password"
            show-password
            :placeholder="t('settings.enterAPIKey')"
          />
        </el-form-item>

        <el-form-item :label="t('settings.apiAddress')">
          <el-input
            v-model="aiConfig.baseURL"
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
            v-model="aiConfig.model"
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
            v-model="aiConfig.batchSize"
            :min="1"
            :max="100"
            :step="10"
            :placeholder="50"
          />
          <div class="form-tip">{{ t('settings.batchSizeTip') }}</div>
        </el-form-item>

        <el-form-item :label="t('settings.concurrency')">
          <el-input-number
            v-model="aiConfig.concurrency"
            :min="1"
            :max="10"
            :step="1"
            :placeholder="2"
          />
          <div class="form-tip">{{ t('settings.concurrencyTip') }}</div>
        </el-form-item>

        <el-form-item v-if="aiConfig.provider === 'openai'" :label="t('settings.disableRateLimitWarning')">
          <el-switch v-model="aiConfig.disableRateLimitWarning" />
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
import { ElMessage } from 'element-plus'
import { getAIConfig, saveAIConfig, DEFAULT_MODELS, DEFAULT_BASE_URLS, type AIConfig } from '@/config/ai'

const { t } = useI18n()

const aiConfig = ref<AIConfig>({
  provider: 'openai',
  apiKey: '',
  baseURL: '',
  model: '',
  batchSize: 50,
  disableRateLimitWarning: false
})

const testing = ref(false)

onMounted(() => {
  aiConfig.value = getAIConfig()
})

const handleProviderChange = () => {
  aiConfig.value.baseURL = ''
  aiConfig.value.model = ''
}

const getDefaultBaseURL = () => {
  return DEFAULT_BASE_URLS[aiConfig.value.provider]
}

const getDefaultModel = () => {
  return DEFAULT_MODELS[aiConfig.value.provider]
}

const resetBaseURL = () => {
  aiConfig.value.baseURL = ''
}

const resetModel = () => {
  aiConfig.value.model = ''
}

const handleSave = () => {
  if (!aiConfig.value.apiKey) {
    ElMessage.warning('请输入 API Key')
    return
  }

  saveAIConfig(aiConfig.value)
  ElMessage.success('设置已保存')
}

const handleTest = async () => {
  if (!aiConfig.value.apiKey) {
    ElMessage.warning('请先输入 API Key')
    return
  }

  testing.value = true

  try {
    const baseURL = aiConfig.value.baseURL || DEFAULT_BASE_URLS[aiConfig.value.provider]
    const model = aiConfig.value.model || DEFAULT_MODELS[aiConfig.value.provider]

    let response: Response

    if (aiConfig.value.provider === 'claude') {
      response = await fetch(`${baseURL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiConfig.value.apiKey,
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
          'Authorization': `Bearer ${aiConfig.value.apiKey}`
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

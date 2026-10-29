// AI 配置及多 Profile 体系
export interface AIConfig {
  provider: 'openai' | 'claude' | 'qwen' | 'zhipu' | 'deepseek'
  apiKey: string
  baseURL?: string
  model?: string
  batchSize?: number // 分类批次大小，默认 50
  concurrency?: number // 分类并发限制，默认 2
  disableRateLimitWarning?: boolean // 是否禁用 OpenAI 速率限制提示
}

export interface AIProfile extends AIConfig {
  id: string
  name: string // 配置名称，如 "DeepSeek 快速归类", "Claude 深度分析"
}

export interface MultiAIConfig {
  activeProfileId: string
  profiles: AIProfile[]
}

// 默认配置
export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'openai',
  apiKey: '',
  baseURL: '',
  model: '',
  batchSize: 50,
  concurrency: 2,
  disableRateLimitWarning: false
}

// 各平台默认模型
export const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  claude: 'claude-3-5-sonnet-20241022',
  qwen: 'qwen-plus',
  zhipu: 'glm-4-flash',
  deepseek: 'deepseek-chat'
}

// 各平台供应商名称展示
export const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  claude: 'Anthropic Claude',
  qwen: '通义千问',
  zhipu: '智谱 GLM',
  deepseek: 'DeepSeek'
}

// 各平台默认 API 地址
export const DEFAULT_BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  claude: 'https://api.anthropic.com/v1',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  deepseek: 'https://api.deepseek.com/v1'
}

const MULTI_CONFIG_KEY = 'multi_ai_config'
const LEGACY_CONFIG_KEY = 'ai_config'

/**
 * 获取多套 AI 配置体系（含从旧版平滑升级）
 */
export function getMultiAIConfig(): MultiAIConfig {
  const storedMulti = localStorage.getItem(MULTI_CONFIG_KEY)
  if (storedMulti) {
    try {
      const parsed: MultiAIConfig = JSON.parse(storedMulti)
      if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
        return parsed
      }
    } catch (e) {
      console.error('Failed to parse multi_ai_config:', e)
    }
  }

  // 若无多配置记录，检查是否存在旧版单套 ai_config 并自动迁移
  let initialProfile: AIProfile
  const storedLegacy = localStorage.getItem(LEGACY_CONFIG_KEY)
  if (storedLegacy) {
    try {
      const legacy: AIConfig = JSON.parse(storedLegacy)
      initialProfile = {
        id: 'profile_default',
        name: legacy.provider ? `${PROVIDER_NAMES[legacy.provider] || legacy.provider} 配置` : '默认配置',
        ...DEFAULT_AI_CONFIG,
        ...legacy
      }
    } catch (e) {
      console.error('Failed to parse legacy ai_config:', e)
      initialProfile = {
        id: 'profile_default',
        name: '默认配置',
        ...DEFAULT_AI_CONFIG
      }
    }
  } else {
    initialProfile = {
      id: 'profile_default',
      name: '默认配置',
      ...DEFAULT_AI_CONFIG
    }
  }

  const initialMulti: MultiAIConfig = {
    activeProfileId: initialProfile.id,
    profiles: [initialProfile]
  }

  saveMultiAIConfig(initialMulti)
  return initialMulti
}

/**
 * 保存多套 AI 配置到 localStorage，并同步更新单套兼容项
 */
export function saveMultiAIConfig(config: MultiAIConfig): void {
  localStorage.setItem(MULTI_CONFIG_KEY, JSON.stringify(config))
  
  // 保持单套 ai_config 同步，保证向下兼容
  const active = config.profiles.find(p => p.id === config.activeProfileId) || config.profiles[0]
  if (active) {
    const legacyConfig: AIConfig = {
      provider: active.provider,
      apiKey: active.apiKey,
      baseURL: active.baseURL,
      model: active.model,
      batchSize: active.batchSize || DEFAULT_AI_CONFIG.batchSize,
      concurrency: active.concurrency || DEFAULT_AI_CONFIG.concurrency,
      disableRateLimitWarning: active.disableRateLimitWarning ?? DEFAULT_AI_CONFIG.disableRateLimitWarning
    }
    localStorage.setItem(LEGACY_CONFIG_KEY, JSON.stringify(legacyConfig))
  }

  // 触发全局事件供 UI 组件即时响应
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('starhub:ai-config-updated', { detail: config }))
  }
}

/**
 * 获取所有 AI 配置 Profile 列表
 */
export function getAIProfiles(): AIProfile[] {
  return getMultiAIConfig().profiles
}

/**
 * 获取当前激活的 Profile
 */
export function getActiveAIProfile(): AIProfile {
  const multi = getMultiAIConfig()
  const active = multi.profiles.find(p => p.id === multi.activeProfileId)
  if (active) return active
  if (multi.profiles.length > 0) return multi.profiles[0]

  const fallback: AIProfile = {
    id: 'profile_default',
    name: '默认配置',
    ...DEFAULT_AI_CONFIG
  }
  return fallback
}

/**
 * 快速切换当前生效的 Profile
 */
export function switchAIProfile(profileId: string): AIProfile {
  const multi = getMultiAIConfig()
  const target = multi.profiles.find(p => p.id === profileId)
  if (!target) {
    throw new Error(`未找到 ID 为 ${profileId} 的 AI 配置`)
  }

  multi.activeProfileId = profileId
  saveMultiAIConfig(multi)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('starhub:ai-profile-switched', { detail: target }))
  }

  return target
}

/**
 * 新增一个 AI Profile
 */
export function createAIProfile(data?: Partial<AIProfile>): AIProfile {
  const multi = getMultiAIConfig()
  const id = `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const newProfile: AIProfile = {
    id,
    name: data?.name || `新配置 ${multi.profiles.length + 1}`,
    provider: data?.provider || 'openai',
    apiKey: data?.apiKey || '',
    baseURL: data?.baseURL || '',
    model: data?.model || '',
    batchSize: data?.batchSize || DEFAULT_AI_CONFIG.batchSize,
    concurrency: data?.concurrency || DEFAULT_AI_CONFIG.concurrency,
    disableRateLimitWarning: data?.disableRateLimitWarning ?? false
  }

  multi.profiles.push(newProfile)
  saveMultiAIConfig(multi)
  return newProfile
}

/**
 * 复制现有 Profile
 */
export function duplicateAIProfile(profileId: string): AIProfile {
  const multi = getMultiAIConfig()
  const source = multi.profiles.find(p => p.id === profileId)
  if (!source) {
    throw new Error(`Profile ${profileId} not found`)
  }

  return createAIProfile({
    ...source,
    name: `${source.name} (副本)`
  })
}

/**
 * 更新指定 Profile
 */
export function updateAIProfile(profileId: string, updates: Partial<AIProfile>): void {
  const multi = getMultiAIConfig()
  const index = multi.profiles.findIndex(p => p.id === profileId)
  if (index !== -1) {
    multi.profiles[index] = {
      ...multi.profiles[index],
      ...updates
    }
    saveMultiAIConfig(multi)
  }
}

/**
 * 删除指定 Profile（保证至少保留一个）
 */
export function deleteAIProfile(profileId: string): void {
  const multi = getMultiAIConfig()
  if (multi.profiles.length <= 1) {
    throw new Error('至少保留一套 AI 配置')
  }

  multi.profiles = multi.profiles.filter(p => p.id !== profileId)
  if (multi.activeProfileId === profileId) {
    multi.activeProfileId = multi.profiles[0].id
  }

  saveMultiAIConfig(multi)
}

/**
 * 向后兼容：获取当前生效的 AIConfig
 */
export function getAIConfig(): AIConfig {
  const active = getActiveAIProfile()
  return {
    provider: active.provider,
    apiKey: active.apiKey,
    baseURL: active.baseURL,
    model: active.model,
    batchSize: active.batchSize || DEFAULT_AI_CONFIG.batchSize,
    concurrency: active.concurrency || DEFAULT_AI_CONFIG.concurrency,
    disableRateLimitWarning: active.disableRateLimitWarning ?? false
  }
}

/**
 * 向后兼容：保存当前生效的 AIConfig
 */
export function saveAIConfig(config: AIConfig): void {
  const multi = getMultiAIConfig()
  const active = multi.profiles.find(p => p.id === multi.activeProfileId)
  if (active) {
    Object.assign(active, config)
    saveMultiAIConfig(multi)
  } else {
    const newProfile: AIProfile = {
      id: 'profile_default',
      name: '默认配置',
      ...config
    }
    multi.profiles = [newProfile]
    multi.activeProfileId = newProfile.id
    saveMultiAIConfig(multi)
  }
}

/**
 * 检查当前 AI 是否已配置
 */
export function isAIConfigured(): boolean {
  const config = getAIConfig()
  return !!config.apiKey && !!config.provider
}

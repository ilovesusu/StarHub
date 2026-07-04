import { getAIConfig, DEFAULT_MODELS, DEFAULT_BASE_URLS } from '@/config/ai'
import type { Repository } from '@/types'

export interface ClassificationResult {
  category: string
  color: string
  confidence: number
}

export interface RepoAnalysisResult {
  id: number
  summary: string
  categories: string[]
  tags: string[]
}

// 调用 OpenAI 兼容 API
async function callOpenAICompatible(
  messages: any[],
  apiKey: string,
  baseURL: string,
  model: string
): Promise<string> {
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2000,
      // 兼容 LM Studio 等本地推理引擎，它们可能不支持 response_format: { type: 'json_object' }
      ...((baseURL.includes('192.168.') || baseURL.includes('127.0.0.1') || baseURL.includes('localhost'))
        ? {}
        : { response_format: { type: 'json_object' } })
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`API request failed: ${response.status} ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// 调用 Claude API
async function callClaude(
  messages: any[],
  apiKey: string,
  baseURL: string,
  model: string
): Promise<string> {
  // 提取 system message
  const systemMessage = messages.find(m => m.role === 'system')
  const userMessages = messages.filter(m => m.role !== 'system')

  const response = await fetch(`${baseURL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 2000,
      system: systemMessage?.content || '',
      messages: userMessages
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Claude API request failed: ${response.status} ${error}`)
  }

  const data = await response.json()
  return data.content[0].text
}

// 调用智谱 AI
async function callZhipu(
  messages: any[],
  apiKey: string,
  baseURL: string,
  model: string
): Promise<string> {
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Zhipu API request failed: ${response.status} ${error}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// 批量分析与分类仓库（自动分批处理）
export async function classifyRepositories(
  repos: Repository[],
  onProgress?: (current: number, total: number) => void,
  onBatchComplete?: (batchResults: RepoAnalysisResult[], batchIndex: number, totalBatches: number) => Promise<void>,
  batchSize?: number // 可配置的批次大小
): Promise<RepoAnalysisResult[]> {
  const config = getAIConfig()
  
  if (!config.apiKey) {
    throw new Error('请先配置 AI API Key')
  }

  const baseURL = config.baseURL || DEFAULT_BASE_URLS[config.provider]
  const model = config.model || DEFAULT_MODELS[config.provider]
  
  // 分批处理：使用配置的批次大小，默认 50
  const BATCH_SIZE = batchSize || config.batchSize || 50
  const totalBatches = Math.ceil(repos.length / BATCH_SIZE)
  const allResults: RepoAnalysisResult[] = []
  
  console.log(`开始分类 ${repos.length} 个仓库，分 ${totalBatches} 批处理（每批 ${BATCH_SIZE} 个）...`)
  
  // 获取现有分类（用于 AI 参考）
  let existingCategories: string[] = []
  try {
    const { useTagStore } = await import('@/stores/tag')
    const tagStore = useTagStore()
    existingCategories = tagStore.tags.map((t: any) => t.name)
    console.log('现有分类:', existingCategories)
  } catch (e) {
    console.warn('无法获取现有分类:', e)
  }
  
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, repos.length)
    const batchRepos = repos.slice(start, end)
    
    console.log(`处理第 ${batchIndex + 1}/${totalBatches} 批 (${start}-${end})...`)
    
    // 通知进度
    if (onProgress) {
      onProgress(batchIndex + 1, totalBatches)
    }
    
    // 重试机制：最多重试 3 次
    let retryCount = 0
    let success = false
    
    while (retryCount < 3 && !success) {
      try {
        const batchResults = await classifyBatch(batchRepos, config, baseURL, model, existingCategories)
        
        // 合并结果
        allResults.push(...batchResults)
        
        console.log(`第 ${batchIndex + 1} 批完成，已分析: ${batchResults.length} 个项目`)
        success = true
        
        // 立即通知批次完成（异步执行，不阻塞下一批）
        if (onBatchComplete) {
          onBatchComplete(batchResults, batchIndex + 1, totalBatches).catch(err => {
            console.error('批次完成回调失败:', err)
          })
        }
      } catch (error: any) {
        // 检查是否是速率限制错误
        if (error.message && error.message.includes('429')) {
          const waitTime = extractWaitTime(error.message)
          console.warn(`第 ${batchIndex + 1} 批遇到速率限制，等待 ${waitTime} 秒后重试...`)
          
          // 通知进度（暂停状态）
          if (onProgress) {
            onProgress(batchIndex, totalBatches)
          }
          
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000))
          retryCount++
        } else {
          console.error(`第 ${batchIndex + 1} 批处理失败:`, error)
          break // 非速率限制错误，跳过这批
        }
      }
    }
    
    // 每批之间间隔（根据 API 提供商调整）
    const delayTime = getDelayTime(config.provider)
    if (batchIndex < totalBatches - 1) {
      console.log(`等待 ${delayTime} 秒后处理下一批...`)
      await new Promise(resolve => setTimeout(resolve, delayTime * 1000))
    }
  }
  
  console.log('所有批次处理完成！')
  return allResults
}
// 分类单个批次
async function classifyBatch(
  repos: Repository[],
  config: any,
  baseURL: string,
  model: string,
  existingCategories: string[] = []
): Promise<RepoAnalysisResult[]> {

  // 从用户设置中获取当前的分类预设（而不是默认配置）
  const { getCategoryPresets } = await import('@/config/categories')
  const presets = getCategoryPresets()
  
  // 获取当前语言
  const currentLang = localStorage.getItem('app-language') || localStorage.getItem('app-locale') || 'zh'
  const isZh = currentLang === 'zh' || currentLang === 'zh-CN'
  
  // 构建分类列表：使用用户当前设置 the preset categories
  const presetCategories = presets.map(p => {
    const name = isZh ? p.name : (p.nameEn || p.name)
    const description = isZh ? p.description : (p.descriptionEn || p.description)
    const emoji = p.emoji ? `${p.emoji} ` : ''
    return description ? `${emoji}${name} - ${description}` : `${emoji}${name}`
  })
  
  // 获取预设分类的纯名称列表（用于去重）
  const presetNames = presets.map(p => p.name)
  
  // 合并用户通过 UI 创建的额外分类（不在预设中的）
  const userCategories = existingCategories.filter(cat => !presetNames.includes(cat))
  
  // 最终分类列表：用户额外创建的分类 + 预设分类
  const allCategories = [...userCategories, ...presetCategories]
  const categoryList = allCategories.map((cat, idx) => `${idx + 1}. ${cat}`).join('\n')
  
  // 构建 prompt
  const systemPrompt = `你是一个专业的代码仓库分析与分类专家。请根据仓库的以下信息进行智能分析与分类：

**参考信息：**
1. **仓库名称 (name/full_name)** - 项目名称通常能反映项目类型
2. **描述 (description)** - 项目简介，最重要的分类依据
3. **编程语言 (language)** - 主要使用的编程语言
4. **标签 (topics)** - GitHub 标签，反映项目特征
5. **README 预览 (readme_preview)** - 如果提供，包含项目文档的前 500 字符

**分析任务：**
针对所提供列表中的每个仓库，输出以下信息：
1. **中文一句话摘要 (summary)**：不超过 80 字，直接陈述项目的核心功能和适用场景，口语化、接地气、避免虚浮的官腔套话。
2. **分类 (categories)**：提供 1-3 个最贴切的分类。应优先选择下面的已有分类。如果实在没有合适的分类，可以自定义非常贴切、精炼的新分类名称。
3. **标签 (tags)**：提供 1-3 个更细粒度的自定义技术或功能标签（如 "vue3", "orm", "markdown-editor", "cli" 等），不需要在分类菜单中注册。

**可用的分类类别：**
${categoryList}

**分类原则：**
1. 一个仓库可以属于 1-3 个分类，分类应客观准确。
2. 自定义的新分类应该简短有力（不超过 6 个字），不要带序号。
3. 返回的 id 必须是仓库的真实 id 数值，不是数组索引。
4. categories 中返回的分类只保留名称部分（如 "Web 开发"），不要包含后面的描述和序号。

请严格按照以下 JSON 格式返回分析结果（确保 JSON 格式正确）：
{
  "results": [
    {
      "id": 123456789,
      "summary": "基于 Vue 3 的轻量级 Markdown 编辑器，支持实时预览和快捷键操作。",
      "categories": ["前端开发", "工具软件"],
      "tags": ["vue3", "markdown", "editor"]
    }
  ]
}

只返回有效的 JSON，不要有其他文字说明。`
 
  // 准备仓库信息
  const repoInfo = repos.map((repo: Repository) => {
    const info: any = {
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description || '无描述',
      language: repo.language || '未知',
      topics: repo.topics?.join(', ') || '无标签'
    }
    
    // 如果仓库有 README 内容，添加前 500 个字符（避免 token 过多）
    if ((repo as any).readme) {
      const readmePreview = (repo as any).readme.substring(0, 500)
      info.readme_preview = readmePreview + (readmePreview.length >= 500 ? '...' : '')
    }
    
    return info
  })

  const userPrompt = `请分析并分类以下仓库：\n\n${JSON.stringify(repoInfo, null, 2)}`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  // 根据不同的 provider 调用相应的 API
  let responseText: string
  
  if (config.provider === 'claude') {
    responseText = await callClaude(messages, config.apiKey, baseURL, model)
  } else if (config.provider === 'zhipu') {
    responseText = await callZhipu(messages, config.apiKey, baseURL, model)
  } else {
    // OpenAI, Qwen, DeepSeek 等都使用 OpenAI 兼容接口
    responseText = await callOpenAICompatible(messages, config.apiKey, baseURL, model)
  }

  // 解析响应
  console.log('AI Response (first 500 chars):', responseText.substring(0, 500))
  
  // 提取 JSON（处理可能的 markdown 代码块）
  let jsonText = responseText.trim()
  
  // 移除可能的 markdown 代码块标记
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '')
  }
  
  // 尝试找到 JSON 对象
  const jsonMatch = jsonText.match(/\{[\s\S]*/)
  if (!jsonMatch) {
    throw new Error('AI 返回格式错误：未找到有效的 JSON')
  }

  let jsonString = jsonMatch[0]
  
  // 尝试修复不完整的 JSON（如果被截断）
  if (!jsonString.endsWith('}')) {
    console.warn('JSON 似乎被截断，尝试自动修复...')
    
    // 移除最后一个可能不完整的对象
    const lastCompleteObject = jsonString.lastIndexOf('},')
    if (lastCompleteObject > 0) {
      jsonString = jsonString.substring(0, lastCompleteObject + 1)
    }
    
    // 补全缺失的结束标记
    const openBrackets = (jsonString.match(/\[/g) || []).length
    const closeBrackets = (jsonString.match(/\]/g) || []).length
    const openBraces = (jsonString.match(/\{/g) || []).length
    const closeBraces = (jsonString.match(/\}/g) || []).length
    
    // 添加缺失的 ]
    for (let i = 0; i < openBrackets - closeBrackets; i++) {
      jsonString += ']'
    }
    
    // 添加缺失的 }
    for (let i = 0; i < openBraces - closeBraces; i++) {
      jsonString += '}'
    }
    
    console.log('修复后的 JSON (last 200 chars):', jsonString.slice(-200))
  }

  let result
  try {
    result = JSON.parse(jsonString)
  } catch (e) {
    console.error('JSON parse error:', e)
    console.error('Raw JSON (last 500 chars):', jsonString.slice(-500))
    throw new Error(`AI 返回的 JSON 格式错误: ${e}`)
  }
  
  console.log('Parsed result:', result)
  console.log('Results count:', result.results?.length)
  
  // 验证返回的数据
  if (!result.results || !Array.isArray(result.results)) {
    throw new Error('AI 返回的数据格式错误：缺少 results 数组')
  }
  
  // 转换为 RepoAnalysisResult[]
  const finalResults: RepoAnalysisResult[] = []
  
  for (const item of result.results) {
    if (!item.id) {
      console.warn('跳过无效的项目 (缺少 id):', item)
      continue
    }
    
    const repoId = typeof item.id === 'number' ? item.id : parseInt(item.id)
    const summary = item.summary || ''
    
    // 确保 categories 存在且为数组
    let categories: string[] = []
    if (item.categories) {
      categories = Array.isArray(item.categories) 
        ? item.categories.map((c: any) => String(c).trim())
        : [String(item.categories).trim()]
    }
    
    // 确保 tags 存在且为数组
    let tags: string[] = []
    if (item.tags) {
      tags = Array.isArray(item.tags) 
        ? item.tags.map((t: any) => String(t).trim())
        : [String(item.tags).trim()]
    }
    
    finalResults.push({
      id: repoId,
      summary,
      categories,
      tags
    })
  }
  
  console.log('Processed batch results count:', finalResults.length)
  return finalResults
}

// 从错误消息中提取等待时间
function extractWaitTime(errorMessage: string): number {
  // 尝试从错误消息中提取等待时间
  // 格式: "Please try again in 20s" 或 "Please try again in 14h0m14.399s"
  
  const secondsMatch = errorMessage.match(/try again in (\d+)s/)
  if (secondsMatch) {
    return Math.ceil(parseInt(secondsMatch[1]) + 2) // 额外加 2 秒缓冲
  }
  
  const minutesMatch = errorMessage.match(/try again in (\d+)m/)
  if (minutesMatch) {
    return Math.ceil(parseInt(minutesMatch[1]) * 60 + 5) // 额外加 5 秒缓冲
  }
  
  const hoursMatch = errorMessage.match(/try again in (\d+)h/)
  if (hoursMatch) {
    // 如果需要等待小时级别，返回 60 秒，然后提示用户切换 API
    console.error('需要等待时间过长（小时级别），建议切换到其他 API 提供商')
    return 60
  }
  
  // 默认等待 30 秒
  return 30
}

// 根据 API 提供商获取延迟时间
function getDelayTime(provider: string): number {
  switch (provider) {
    case 'openai':
      return 25 // OpenAI 免费账户每分钟 3 次，所以至少等 20 秒
    case 'claude':
      return 5
    case 'qwen':
    case 'zhipu':
    case 'deepseek':
      return 2 // 国内 API 通常限制更宽松
    default:
      return 3
  }
}

// 分析单个仓库（提供一句话中文摘要与中文分类标签、特征标签）
export async function analyzeRepository(
  repo: Repository,
  readmeContent?: string
): Promise<{ summary: string; categories: string[]; tags: string[] }> {
  const config = getAIConfig()
  
  if (!config.apiKey) {
    throw new Error('请先在设置中配置 AI API Key')
  }

  const baseURL = config.baseURL || DEFAULT_BASE_URLS[config.provider]
  const model = config.model || DEFAULT_MODELS[config.provider]

  // 获取预设分类
  let presetNames: string[] = []
  try {
    const { getCategoryPresets } = await import('@/config/categories')
    presetNames = getCategoryPresets().map(p => p.name)
  } catch (e) {
    console.warn('无法获取预设分类:', e)
  }

  const systemPrompt = `你是一个专业的代码仓库分析专家。
请根据提供的仓库信息，为仓库生成以下三个维度的信息：
1. **一句话中文摘要 (summary)**：不超过 80 字，高度提炼出核心功能和使用场景，避开虚浮描述和废话，做到通俗易懂，直击痛点。
2. **分类 (categories)**：提取 1-3 个最贴切的分类。应优先选择已有分类。如果已有分类均不匹配，可以自定义非常贴切、精炼的新分类名称。
3. **标签 (tags)**：提取 1-3 个针对该项目技术栈或功能特征的更细粒度的自定义标签（如 "vue3", "orm", "markdown-editor", "web-scraper" 等）。

**已有的分类列表：**
${presetNames.map((name, i) => `${i + 1}. ${name}`).join('\n')}

请严格按照以下 JSON 格式返回结果（只返回 JSON，不要包含 Markdown 格式的包裹，也不要有任何其他解释性文字）：
{
  "summary": "利用 AI 大模型一键生成高清短视频，支持自动生成文案与字幕。",
  "categories": ["人工智能", "视频工具"]
}`

  const userPrompt = `请分析以下仓库：
名称：${repo.full_name}
描述：${repo.description || '无'}
语言：${repo.language || '未知'}
标签：${repo.topics?.join(', ') || '无'}
README 预览：${readmeContent ? readmeContent.substring(0, 1000) : '无'}`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ]

  let responseText: string
  if (config.provider === 'claude') {
    responseText = await callClaude(messages, config.apiKey, baseURL, model)
  } else if (config.provider === 'zhipu') {
    responseText = await callZhipu(messages, config.apiKey, baseURL, model)
  } else {
    responseText = await callOpenAICompatible(messages, config.apiKey, baseURL, model)
  }

  // 解析 JSON 响应
  let jsonText = responseText.trim()
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '')
  }

  const jsonMatch = jsonText.match(/\{[\s\S]*/)
  if (!jsonMatch) {
    throw new Error('AI 返回格式错误：未找到有效的 JSON')
  }

  const result = JSON.parse(jsonMatch[0])
  if (!result.summary || !result.categories) {
    throw new Error('AI 返回的 JSON 缺少 summary 或 categories')
  }

  // 整理格式
  const summary = result.summary
  const categories = Array.isArray(result.categories) 
    ? result.categories.map((c: any) => String(c).trim())
    : [String(result.categories).trim()]
  const tags = Array.isArray(result.tags)
    ? result.tags.map((t: any) => String(t).trim())
    : (result.tags ? [String(result.tags).trim()] : [])

  return {
    summary,
    categories,
    tags
  }
}

// 预定义的分类颜色，由 categories 配置统一导出
export { CATEGORY_COLORS } from '@/config/categories'



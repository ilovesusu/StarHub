<template>
  <div class="detail-view">
    <div class="detail-content" v-if="repo">
      <!-- 仓库详情主卡片 -->
      <div class="repo-card-new">
        <el-button
          type="primary"
          class="ai-analyze-btn"
          :loading="isAnalyzing"
          @click="handleAiAnalyze"
          round
          size="small"
        >
          <el-icon><Cpu /></el-icon>
          <span>{{ repo.ai_summary ? '重新 AI 分析' : 'AI 智能整理' }}</span>
        </el-button>

        <el-button
          text
          circle
          @click="$emit('close')"
          class="close-button"
        >
          <el-icon><Close /></el-icon>
        </el-button>

        <div class="repo-card-header">
          <h1 class="repo-name">{{ repo.full_name }}</h1>
          <p v-if="repo.description" class="repo-desc">{{ repo.description }}</p>
        </div>

        <!-- AI 中文一句话摘要 -->
        <div v-if="repo.ai_summary" class="repo-ai-summary-detail">
          <div class="ai-title">
            <span class="ai-sparkle">🪄</span>
            <span>AI 中文摘要</span>
          </div>
          <p class="ai-content">{{ repo.ai_summary }}</p>
        </div>

        <!-- AI 特征标签 -->
        <div v-if="repo.ai_tags && repo.ai_tags.length > 0" class="repo-ai-tags-detail">
          <span v-for="tag in repo.ai_tags" :key="tag" class="ai-tag-pill">#{{ tag }}</span>
        </div>

        <!-- GitHub Topics -->
        <div v-if="repo.topics && repo.topics.length > 0" class="repo-topics">
          <span v-for="topic in repo.topics" :key="topic" class="topic-tag">{{ topic }}</span>
        </div>

        <!-- Custom Tags -->
        <div class="custom-tags-row">
          <el-tag
            v-for="tag in repoTags"
            :key="tag.id"
            closable
            size="default"
            :color="tag.color + '1a'"
            :style="{ borderColor: tag.color, color: tag.color }"
            class="custom-tag-item"
            @close="handleRemoveTag(tag.id)"
          >
            <span v-if="tag.emoji" class="tag-emoji">{{ tag.emoji }}</span>
            <span class="tag-name-text">{{ tag.name }}</span>
          </el-tag>
          <el-button
            size="small"
            circle
            class="add-tag-btn"
            @click="showTagDialog = true"
            title="添加分类"
          >
            <el-icon><Plus /></el-icon>
          </el-button>
        </div>

        <!-- Stats Grid Bar -->
        <div class="repo-stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ formatNumber(repo.stargazers_count) }}</div>
            <div class="stat-label">
              <el-icon><Star /></el-icon> Stars
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ formatNumber(repo.forks_count) }}</div>
            <div class="stat-label">
              <el-icon><ForkSpoon /></el-icon> Forks
            </div>
          </div>
          <div class="stat-card" v-if="repo.open_issues_count !== undefined">
            <div class="stat-value">{{ formatNumber(repo.open_issues_count) }}</div>
            <div class="stat-label">
              <el-icon><InfoFilled /></el-icon> Issues
            </div>
          </div>
          <div class="stat-card" v-if="repo.language">
            <div class="stat-value lang-value">
              <span class="lang-dot" :style="{ background: getLanguageColor(repo.language) }"></span>
              {{ repo.language }}
            </div>
            <div class="stat-label">Language</div>
          </div>
        </div>

        <!-- Actions Row -->
        <div class="repo-actions-row">
          <div class="action-buttons-group">
            <a class="action-btn github-btn" :href="repo.html_url" target="_blank" rel="noopener">
              <el-icon><Link /></el-icon>
              <span>Open in GitHub</span>
            </a>
            <el-button 
              type="danger" 
              plain
              round
              class="unstar-btn"
              @click="handleUnstar"
            >
              <el-icon><Star /></el-icon>
              <span>Unstar</span>
            </el-button>
          </div>
          <div class="meta-updated">
            Updated {{ formatDate(repo.updated_at, locale) }}
          </div>
        </div>
      </div>

      <!-- README Section -->
      <div class="readme-section" v-if="readme">
        <div class="readme-header">
          <el-icon><Document /></el-icon>
          <span>README.md</span>
        </div>
        <div class="readme-content markdown-body" :data-color-mode="themeStore.theme" data-light-theme="light" data-dark-theme="dark" v-html="readme"></div>
      </div>
    </div>

    <el-dialog
      v-model="showTagDialog"
      title="Add Tag"
      width="400px"
    >
      <el-select
        v-model="selectedTagId"
        placeholder="Select a tag"
        filterable
        style="width: 100%"
      >
        <el-option
          v-for="tag in availableTags"
          :key="tag.id"
          :label="tag.name"
          :value="tag.id"
        >
          <span
            class="tag-option"
            :style="{ color: tag.color }"
          >
            <span
              class="tag-color-dot"
              :style="{ backgroundColor: tag.color }"
            ></span>
            <span v-if="tag.emoji" class="tag-emoji">{{ tag.emoji }}</span>
            {{ tag.name }}
          </span>
        </el-option>
      </el-select>
      <template #footer>
        <el-button @click="showTagDialog = false">Cancel</el-button>
        <el-button type="primary" @click="handleAddTag">Add</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTagStore } from '@/stores/tag'
import { useRepoStore } from '@/stores/repo'
import { useThemeStore } from '@/stores/theme'
import { githubApi } from '@/api/github'
import { getLanguageColor } from '@/utils/languageColors'
import { formatNumber, formatDate } from '@/utils'
import { marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import { mangle } from 'marked-mangle'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'

// 导入 highlight.js GitHub 样式
import 'highlight.js/styles/github.css'

// 导入 GitHub 官方 Markdown 样式（自动主题版本）
import 'github-markdown-css'

import DOMPurify from 'dompurify'
import type { Repository, Tag } from '@/types'
import {
  Close,
  Document,
  Link,
  ForkSpoon,
  Star,
  Plus,
  InfoFilled,
  Cpu
} from '@element-plus/icons-vue'

// 配置 marked 使用 GFM 扩展和代码高亮
marked.use(
  gfmHeadingId(),
  mangle(),
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    }
  }),
  {
    gfm: true,
    breaks: true
  }
)

const themeStore = useThemeStore()
const { locale } = useI18n()

const props = defineProps<{
  repo: Repository
}>()

const emit = defineEmits<{
  close: []
}>()

const tagStore = useTagStore()
const repoStore = useRepoStore()
import { ElMessageBox, ElMessage } from 'element-plus'
const repoTags = ref<Tag[]>([])
const readme = ref('')
const showTagDialog = ref(false)
const selectedTagId = ref('')
const isAnalyzing = ref(false)

const handleAiAnalyze = async () => {
  isAnalyzing.value = true
  try {
    const { analyzeRepository, CATEGORY_COLORS } = await import('@/services/ai')
    
    // 1. 获取 README 预览 (已加载 readme 则用已有的，未加载则现场拉取)
    let readmeText = ''
    try {
      const [owner, name] = props.repo.full_name.split('/')
      const readmeRes = await githubApi.getReadme(owner, name)
      readmeText = readmeRes.data.substring(0, 1000)
    } catch (e) {
      // 忽略 readme 获取错误，降级
    }

    // 2. 调用单仓库分析
    const analysis = await analyzeRepository(props.repo, readmeText)
    
    // 3. 更新仓库本身的 AI 字段
    await repoStore.updateRepoAIInfo(props.repo.id, {
      ai_summary: analysis.summary,
      ai_tags: analysis.tags
    })

    // 4. 将仓库归类到对应的分类中（1-3个分类）
    const { getCategoryPresets } = await import('@/config/categories')
    const presets = getCategoryPresets()
    const presetMap = new Map<string, { emoji?: string, color: string }>()
    presets.forEach(preset => {
      presetMap.set(preset.name, { emoji: preset.emoji, color: preset.color })
      if (preset.nameEn) {
        presetMap.set(preset.nameEn, { emoji: preset.emoji, color: preset.color })
      }
    })

    for (const categoryName of analysis.categories) {
      if (!categoryName) continue
      
      // 移除分类名称中的描述部分和 emoji（如果有）
      let cleanCategoryName = categoryName.split(' - ')[0].trim()
      // 移除开头的 emoji（如果存在）
      cleanCategoryName = cleanCategoryName.replace(/^[\u{1F300}-\u{1F9FF}]+\s*/u, '').trim()
      if (!cleanCategoryName) continue

      // 从预设分类中查找对应的 emoji 和颜色
      const presetInfo = presetMap.get(cleanCategoryName) || presetMap.get(categoryName)
      const emoji = presetInfo?.emoji
      const color = presetInfo?.color || CATEGORY_COLORS[cleanCategoryName] || CATEGORY_COLORS[categoryName] || '#9e9e9e'

      // 检查分类是否已存在（精确匹配名称）
      let existingTag = tagStore.tags.find((t: any) => 
        t.name === cleanCategoryName || t.name === categoryName
      )

      if (existingTag) {
        // 更新现有分类（合并仓库 ID，更新 emoji 如果存在）
        const mergedRepoIds = Array.from(new Set([...(existingTag.repos || []), props.repo.id]))
        const updates: any = { repos: mergedRepoIds }
        if (emoji && existingTag.emoji !== emoji) {
          updates.emoji = emoji
        }
        await tagStore.updateTag(existingTag.id, updates)
      } else {
        // 创建新分类（包含 emoji）
        const newTag = await tagStore.createTag(cleanCategoryName, color, emoji)
        await tagStore.updateTag(newTag.id, {
          repos: [props.repo.id]
        })
      }
    }

    // 重新加载分类以刷新 UI
    await tagStore.loadTags()
    await loadRepoTags()
    
    ElMessage.success('AI 分析与分类完成！')
  } catch (error: any) {
    console.error('AI analysis failed:', error)
    ElMessage.error(error.message || 'AI 分析失败，请检查 AI API 配置')
  } finally {
    isAnalyzing.value = false
  }
}

const availableTags = computed(() => {
  const currentTagIds = repoTags.value.map((t) => t.id)
  return tagStore.tags.filter((tag) => !currentTagIds.includes(tag.id))
})

const loadReadme = async () => {
  try {
    const [owner, repo] = props.repo.full_name.split('/')
    const defaultBranch = props.repo.default_branch || 'main'
    const response = await githubApi.getReadme(owner, repo)
    let rawReadme = response.data
    
    // 将相对路径的图片和链接转换为 GitHub 绝对路径
    const rawBaseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/`
    const repoBaseUrl = `https://github.com/${owner}/${repo}/blob/${defaultBranch}/`
    
    // 转换图片路径：![alt](./path) 或 ![alt](path) -> ![alt](https://raw.githubusercontent.com/...)
    rawReadme = rawReadme.replace(
      /!\[([^\]]*)\]\((?!https?:\/\/|data:)\.?\/?([^)]+)\)/g,
      `![$1](${rawBaseUrl}$2)`
    )
    
    // 转换 HTML img 标签：<img src="./path" /> -> <img src="https://raw..." />
    rawReadme = rawReadme.replace(
      /<img([^>]*?)src=["'](?!https?:\/\/|data:)\.?\/?([^"']+)["']/gi,
      `<img$1src="${rawBaseUrl}$2"`
    )
    
    // 转换相对链接（非锚点）：[text](./path) -> [text](https://github.com/.../blob/...)
    rawReadme = rawReadme.replace(
      /\[([^\]]+)\]\((?!https?:\/\/|#|mailto:)\.?\/?([^)]+)\)/g,
      `[$1](${repoBaseUrl}$2)`
    )
    
    // 使用 marked 渲染 Markdown（代码高亮已通过 marked-highlight 配置）
    const html = marked(rawReadme) as string
    
    // DOMPurify 配置，允许任务列表和其他 GFM 特性
    readme.value = DOMPurify.sanitize(html, {
      ADD_ATTR: ['target', 'rel', 'class', 'id', 'checked', 'disabled', 'type'],
      ADD_TAGS: ['input', 'span'],
      FORBID_TAGS: ['script', 'style'],
      KEEP_CONTENT: true
    })
  } catch (error) {
    console.error('Failed to load README:', error)
    readme.value = ''
  }
}

const loadRepoTags = async () => {
  repoTags.value = await tagStore.getRepoTags(props.repo.id)
}

const handleAddTag = async () => {
  if (!selectedTagId.value) return

  try {
    await tagStore.addTagToRepo(props.repo.id, selectedTagId.value)
    await loadRepoTags()
    showTagDialog.value = false
    selectedTagId.value = ''
  } catch (error) {
    console.error('Failed to add tag:', error)
  }
}

const handleRemoveTag = async (tagId: string) => {
  try {
    await tagStore.removeTagFromRepo(props.repo.id, tagId)
    await loadRepoTags()
  } catch (error) {
    console.error('Failed to remove tag:', error)
  }
}

const handleUnstar = async () => {
  try {
    await ElMessageBox.confirm(
      `确定要取消 Star 仓库 "${props.repo.full_name}" 吗？这将会从您的 GitHub Star 列表中移除。`,
      '取消 Star',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    await repoStore.unstarRepo(props.repo.id)
    ElMessage.success('成功取消 Star')
    emit('close')
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to unstar repository:', error)
      ElMessage.error('取消 Star 失败')
    }
  }
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

watch(
  () => props.repo,
  () => {
    if (props.repo) {
      loadReadme()
      loadRepoTags()
    }
  },
  { immediate: true }
)

// 监听主题变化，重新加载 README 以应用新的代码高亮
watch(() => themeStore.theme, () => {
  if (props.repo) {
    loadReadme()
  }
})
</script>

<style lang="scss" scoped>
.detail-view {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg-primary);
  position: relative;
  
  // 深色模式下使用与应用一致的背景色
  [data-theme='dark'] & {
    background: #1c2333 !important;
  }
}

.detail-content {
  padding: $spacing-lg;
  max-width: 1000px;
  margin: 0 auto;
}

// 仓库信息主卡片
.repo-card-new {
  position: relative;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  padding: $spacing-xl;
  margin-bottom: $spacing-xl;
  box-shadow: $shadow-sm;
  
  // 深色模式下使用与应用一致的背景色
  [data-theme='dark'] & {
    background: #252d3d !important;
    border-color: rgba(96, 165, 250, 0.15) !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
}

.ai-analyze-btn {
  position: absolute;
  top: 16px;
  right: 56px;
  z-index: 10;
  background: linear-gradient(135deg, var(--el-color-primary), #6366f1) !important;
  border: none !important;
  color: #fff !important;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
  transition: all 0.3s ease;
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
    background: linear-gradient(135deg, var(--el-color-primary-light-3), #818cf8) !important;
  }

  &:active {
    transform: translateY(1px);
  }
  
  :deep(.el-icon) {
    font-size: 14px;
  }
}

.close-button {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  color: var(--text-tertiary);
  
  &:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }
}

.repo-card-header {
  margin-bottom: $spacing-md;
  padding-right: 160px;
}

.repo-ai-summary-detail {
  margin-bottom: $spacing-md;
  padding: $spacing-md;
  background: rgba(64, 158, 255, 0.05);
  border-radius: $radius-md;
  border-left: 3px solid var(--el-color-primary);

  [data-theme='dark'] & {
    background: rgba(64, 158, 255, 0.1);
  }

  .ai-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--el-color-primary);
    margin-bottom: 6px;
    
    .ai-sparkle {
      font-size: 0.9rem;
    }
  }

  .ai-content {
    color: var(--text-primary);
    font-size: 0.875rem;
    line-height: 1.6;
    margin: 0;
  }
}

.repo-ai-tags-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: $spacing-md;

  .ai-tag-pill {
    font-size: 0.75rem;
    color: var(--el-color-primary);
    background: rgba(64, 158, 255, 0.08);
    padding: 2px 10px;
    border-radius: 12px;
    font-weight: 500;
    transition: all $transition-base;
    cursor: default;

    &:hover {
      background: rgba(64, 158, 255, 0.15);
      transform: translateY(-1px);
    }
  }
}

.repo-name {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 10px 0;
  word-break: break-word;
  line-height: 1.3;
}

.repo-desc {
  font-size: 0.925rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.6;
}

// GitHub Topics
.repo-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: $spacing-lg;
  
  .topic-tag {
    padding: 3px 10px;
    background: rgba(64, 158, 255, 0.08);
    color: var(--el-color-primary);
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    transition: all $transition-base;
    cursor: default;

    &:hover {
      background: rgba(64, 158, 255, 0.15);
    }
  }
}

// 自定义分类标签行
.custom-tags-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: $spacing-xl;
  padding-bottom: $spacing-md;
  border-bottom: 1px solid var(--border);

  [data-theme='dark'] & {
    border-bottom-color: rgba(255, 255, 255, 0.05);
  }

  .custom-tag-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
    border-radius: 6px;
    padding: 4px 10px;

    .tag-emoji {
      font-size: 0.95rem;
    }
  }

  .add-tag-btn {
    border-style: dashed;
    background: transparent;
    color: var(--text-secondary);
    
    &:hover {
      color: var(--el-color-primary);
      border-color: var(--el-color-primary);
    }
  }
}

// 统计格子网格
.repo-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 12px;
  margin-bottom: $spacing-xl;

  .stat-card {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: $radius-md;
    padding: $spacing-md;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 6px;
    transition: transform $transition-base, border-color $transition-base;
    min-width: 0;

    [data-theme='dark'] & {
      background: #1c2333 !important;
      border-color: rgba(255, 255, 255, 0.05);
    }

    &:hover {
      transform: translateY(-2px);
      border-color: var(--el-color-primary);
    }

    .stat-value {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
      width: 100%;
      text-align: center;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      &.lang-value {
        font-size: 0.95rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        box-sizing: border-box;
      }
    }

    .stat-label {
      font-size: 0.775rem;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      .el-icon {
        font-size: 12px;
        color: var(--text-tertiary);
        flex-shrink: 0;
      }
    }
  }
}

// 操作与更新时间
.repo-actions-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;

  .action-buttons-group {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .unstar-btn {
    box-shadow: 0 2px 6px rgba(245, 108, 108, 0.1);
    height: 36px;
    font-weight: 600;
    
    &:hover {
      box-shadow: 0 4px 12px rgba(245, 108, 108, 0.25);
    }
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 20px;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    transition: all $transition-base;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(64, 158, 255, 0.2);

    &.github-btn {
      background: var(--el-color-primary);
      color: #ffffff;

      &:hover {
        background: var(--el-color-primary-dark-2);
        box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
      }
    }
  }

  .meta-updated {
    font-size: 0.8rem;
    color: var(--text-tertiary);
    font-weight: 500;
  }
}

// README 区域
.readme-section {
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  overflow: hidden;
  box-shadow: $shadow-sm;
  
  [data-theme='dark'] & {
    border-color: rgba(96, 165, 250, 0.15) !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
}

.readme-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  
  [data-theme='dark'] & {
    background: #252d3d !important;
    border-bottom-color: rgba(96, 165, 250, 0.15) !important;
  }
  
  .el-icon {
    color: var(--text-secondary);
  }
}

.readme-content {
  padding: 24px;
  box-sizing: border-box;
  min-width: 200px;
  max-width: 100%;
  background: var(--bg-secondary);
  
  [data-theme='dark'] & {
    background: #252d3d !important;
  }
  
  // 徽章对齐
  :deep(p) {
    img[src*="shields.io"],
    img[src*="badge"],
    img[src*="img.shields"],
    img[alt*="badge"],
    a > img {
      display: inline-block;
      vertical-align: middle;
      margin: 2px 4px 2px 0;
      height: auto;
    }
  }
  
  :deep(img) {
    max-width: 100%;
    
    &[src=""],
    &:not([src]) {
      display: none;
    }
  }
  
  // 代码块样式
  :deep(pre) {
    background: #f6f8fa;
    border-radius: 6px;
    padding: 16px;
    overflow: auto;
    
    code {
      background: transparent;
      padding: 0;
      border: none;
      font-size: 85%;
      font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace;
    }
  }
  
  // 暗色主题
  &[data-color-mode='dark'] {
    background: #1c2333;
    color: #c9d1d9;
    border-color: #30363d;
    
    :deep(h1),
    :deep(h2),
    :deep(h3),
    :deep(h4),
    :deep(h5),
    :deep(h6) {
      color: #c9d1d9;
      border-color: #30363d;
    }
    
    :deep(a) {
      color: #58a6ff;
    }
    
    :deep(code) {
      background: rgba(110, 118, 129, 0.4);
      color: #c9d1d9;
    }
    
    :deep(pre) {
      background: #0d1117;
      
      code {
        background: transparent;
      }
    }
    
    :deep(blockquote) {
      border-color: #3b434b;
      color: #8b949e;
    }
    
    :deep(table) {
      th, td {
        border-color: #30363d;
      }
      
      tr {
        background: #1c2333;
        border-color: #30363d;
        
        &:nth-child(2n) {
          background: #0d1117;
        }
      }
    }
    
    :deep(hr) {
      background: #21262d;
    }
    
    // GitHub Dark 代码高亮配色
    :deep(.hljs) {
      color: #c9d1d9;
    }
    
    :deep(.hljs-keyword),
    :deep(.hljs-selector-tag),
    :deep(.hljs-literal),
    :deep(.hljs-section),
    :deep(.hljs-link) {
      color: #ff7b72;
    }
    
    :deep(.hljs-string),
    :deep(.hljs-attr) {
      color: #a5d6ff;
    }
    
    :deep(.hljs-number),
    :deep(.hljs-built_in),
    :deep(.hljs-builtin-name) {
      color: #79c0ff;
    }
    
    :deep(.hljs-title),
    :deep(.hljs-function),
    :deep(.hljs-title.function_) {
      color: #d2a8ff;
    }
    
    :deep(.hljs-comment),
    :deep(.hljs-quote) {
      color: #8b949e;
    }
    
    :deep(.hljs-variable),
    :deep(.hljs-template-variable) {
      color: #ffa657;
    }
    
    :deep(.hljs-tag),
    :deep(.hljs-name) {
      color: #7ee787;
    }
    
    :deep(.hljs-type),
    :deep(.hljs-class) {
      color: #f0883e;
    }
    
    :deep(.hljs-symbol),
    :deep(.hljs-bullet),
    :deep(.hljs-addition) {
      color: #a5d6ff;
    }
    
    :deep(.hljs-meta),
    :deep(.hljs-params) {
      color: #79c0ff;
    }
    
    :deep(.hljs-punctuation) {
      color: #c9d1d9;
    }
  }
}

.tag-option {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
}

.tag-color-dot {
  width: 10px;
  height: 10px;
  border-radius: $radius-round;
}

.lang-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>


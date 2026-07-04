<template>
  <div class="trending-card">
    <div class="card-left-badge">
      <span class="index-num">{{ index + 1 }}</span>
    </div>
    
    <div class="card-main-content">
      <!-- 头部操作区 -->
      <div class="card-header">
        <h3 class="repo-name" @click="emit('open-external', repo.html_url)">
          {{ repo.full_name }}
        </h3>
        
        <div class="actions-group">
          <!-- AI分析 -->
          <el-tooltip :content="t('trending.aiAnalysis')" placement="top">
            <el-button
              circle
              size="small"
              :loading="aiLoading"
              @click="emit('ai-analyze', repo)"
              class="action-btn ai-action-btn"
            >
              <el-icon><MagicStick /></el-icon>
            </el-button>
          </el-tooltip>

          <!-- 查看 README -->
          <el-tooltip :content="t('repo.readme')" placement="top">
            <el-button
              circle
              size="small"
              @click="emit('toggle-readme', repo)"
              class="action-btn"
            >
              <el-icon><Notebook /></el-icon>
            </el-button>
          </el-tooltip>

          <!-- 外链 -->
          <el-tooltip content="在 GitHub 中打开" placement="top">
            <el-button
              circle
              size="small"
              @click="emit('open-external', repo.html_url)"
              class="action-btn"
            >
              <el-icon><Position /></el-icon>
            </el-button>
          </el-tooltip>

          <!-- 订阅星标 -->
          <el-tooltip :content="isSubscribed ? t('trending.unsubscribe') : t('trending.subscribe')" placement="top">
            <el-button
              circle
              size="small"
              :class="['action-btn', 'star-btn', { 'is-starred': isSubscribed }]"
              @click="emit('subscribe', repo)"
            >
              <el-icon><Star v-if="!isSubscribed" /><StarFilled v-else /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>

      <!-- 原英文简介 -->
      <p class="repo-desc" v-if="repo.description">{{ repo.description }}</p>
      <p class="repo-desc no-desc" v-else>无项目描述</p>

      <!-- AI 智能摘要中文 -->
      <transition name="slide-fade">
        <div class="ai-summary-box" v-if="aiSummary || aiLoading">
          <div class="ai-loading-wrapper" v-if="aiLoading">
            <el-icon class="is-loading ai-logo-icon"><Cpu /></el-icon>
            <span class="ai-loading-text">{{ t('trending.aiSummaryLoading') }}</span>
          </div>
          <div class="ai-content-wrapper" v-else>
            <div class="ai-avatar-badge">
              <el-icon class="ai-logo-icon"><Cpu /></el-icon>
            </div>
            <p class="ai-summary-text">{{ aiSummary }}</p>
          </div>
        </div>
      </transition>

      <!-- 类别标签 -->
      <div class="tags-row" v-if="displayCategories.length > 0">
        <el-tag
          v-for="cat in displayCategories"
          :key="cat"
          size="small"
          class="category-tag"
          round
          effect="plain"
        >
          {{ cat }}
        </el-tag>
      </div>

      <!-- AI 特征标签 -->
      <div class="ai-tags-row" v-if="aiTags && aiTags.length > 0">
        <span v-for="tag in aiTags" :key="tag" class="ai-tag-item">#{{ tag }}</span>
      </div>

      <!-- 底部属性栏 -->
      <div class="card-footer">
        <!-- 平台 -->
        <div class="footer-item platform-info" v-if="detectedPlatforms.length > 0">
          <el-icon class="footer-icon"><Connection /></el-icon>
          <span class="platform-text">{{ detectedPlatforms.join(' / ') }}</span>
        </div>
        <div class="footer-item platform-info" v-else>
          <el-icon class="footer-icon"><Connection /></el-icon>
          <span class="platform-text">Cross-platform</span>
        </div>

        <!-- 主要语言 -->
        <div class="footer-item language-info" v-if="repo.language">
          <span
            class="lang-dot"
            :style="{ backgroundColor: getLangColor(repo.language) }"
          ></span>
          <span class="lang-text">{{ repo.language }}</span>
        </div>

        <!-- Star 数量 -->
        <div class="footer-item stars-info">
          <el-icon class="footer-icon"><Star /></el-icon>
          <span class="count-text">{{ formatCount(repo.stargazers_count) }}</span>
        </div>

        <!-- Fork 数量 -->
        <div class="footer-item forks-info" v-if="repo.forks_count !== undefined">
          <el-icon class="footer-icon"><Share /></el-icon>
          <span class="count-text">{{ formatCount(repo.forks_count) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  MagicStick,
  Notebook,
  Position,
  Star,
  StarFilled,
  Cpu,
  Connection,
  Share
} from '@element-plus/icons-vue'
import type { Repository } from '@/types'

const { t } = useI18n()

const props = defineProps<{
  repo: Repository
  index: number
  isSubscribed: boolean
  aiSummary?: string
  aiCategories?: string[]
  aiTags?: string[]
  aiLoading?: boolean
}>()

const emit = defineEmits<{
  (e: 'ai-analyze', repo: Repository): void
  (e: 'toggle-readme', repo: Repository): void
  (e: 'subscribe', repo: Repository): void
  (e: 'open-external', url: string): void
}>()

// 语言颜色 Map
const languageColors: Record<string, string> = {
  python: '#3572A5',
  javascript: '#f1e05a',
  typescript: '#3178c6',
  go: '#00ADD8',
  rust: '#dea584',
  html: '#e34c26',
  css: '#563d7c',
  java: '#b07219',
  'c++': '#f34b7d',
  c: '#555555',
  ruby: '#701516',
  shell: '#89e051',
  php: '#4F5D95',
  swift: '#F05138',
  kotlin: '#A97BFF'
}

const getLangColor = (lang: string) => {
  return languageColors[lang.toLowerCase()] || '#858585'
}

// 格式化数字
const formatCount = (num: number) => {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`
  }
  return num.toString()
}

// 合并显示类别标签
const displayCategories = computed(() => {
  const cats = new Set<string>()
  
  // 1. 从 API topics 抽取常见分类作为后备
  if (props.repo.topics) {
    props.repo.topics.slice(0, 3).forEach(t => {
      // 英文首字母大写
      cats.add(t.charAt(0).toUpperCase() + t.slice(1))
    })
  }

  // 2. 如果有 AI 分类，则优先使用并覆盖
  if (props.aiCategories && props.aiCategories.length > 0) {
    cats.clear()
    props.aiCategories.forEach(c => cats.add(c))
  }
  
  return Array.from(cats)
})

// 根据 description 猜测支持的平台
const detectedPlatforms = computed(() => {
  const desc = (props.repo.description || '').toLowerCase()
  const platforms: string[] = []
  if (desc.includes('macos') || desc.includes('mac os') || desc.includes('osx') || desc.includes('apple')) {
    platforms.push('macOS')
  }
  if (desc.includes('windows') || desc.includes('win32') || desc.includes('win64')) {
    platforms.push('Windows')
  }
  if (desc.includes('linux') || desc.includes('ubuntu') || desc.includes('debian')) {
    platforms.push('Linux')
  }
  if (desc.includes('browser') || desc.includes('chrome') || desc.includes('safari') || desc.includes('web extension') || desc.includes('firefox')) {
    platforms.push('Browser')
  }
  return platforms
})
</script>

<style lang="scss" scoped>
.trending-card {
  display: flex;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: $radius-lg;
  padding: $spacing-lg;
  margin-bottom: $spacing-md;
  box-shadow: $shadow-sm;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: relative;
  overflow: hidden;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.05);
    border-color: var(--el-color-primary-light-5);
    
    [data-theme='dark'] & {
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
      border-color: rgba(64, 158, 255, 0.25);
      background: rgba(30, 41, 59, 0.7);
    }

    .card-left-badge {
      background-color: var(--el-color-primary);
      color: #fff;
      transform: scale(1.05);
    }
  }

  [data-theme='dark'] & {
    background: rgba(30, 41, 59, 0.5);
    border-color: rgba(255, 255, 255, 0.06);
  }
}

.card-left-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background-color: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  border-radius: 50%;
  margin-right: $spacing-md;
  flex-shrink: 0;
  font-weight: 700;
  font-size: 0.95rem;
  transition: all 0.25s ease;

  [data-theme='dark'] & {
    background: #1e293b;
  }
}

.card-main-content {
  flex: 1;
  min-width: 0; // 防止 text overflow 失效
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: $spacing-md;
  margin-bottom: $spacing-xs;

  .repo-name {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-primary);
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.2s ease;

    &:hover {
      color: var(--el-color-primary);
      text-decoration: underline;
    }
    
    [data-theme='dark'] & {
      color: #f1f5f9;
    }
  }

  .actions-group {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
}

.action-btn {
  background: var(--bg-primary) !important;
  border-color: var(--border) !important;
  color: var(--text-secondary) !important;
  transition: all 0.2s ease;

  &:hover {
    color: var(--el-color-primary) !important;
    border-color: var(--el-color-primary) !important;
    background: rgba(64, 158, 255, 0.08) !important;
    transform: translateY(-1px);
  }

  &.ai-action-btn:hover {
    color: #a855f7 !important; // 紫色 AI 专属高亮
    border-color: #a855f7 !important;
    background: rgba(168, 85, 247, 0.08) !important;
  }

  &.star-btn {
    &.is-starred {
      background: rgba(234, 179, 8, 0.1) !important;
      border-color: rgba(234, 179, 8, 0.4) !important;
      color: #eab308 !important;

      &:hover {
        background: rgba(234, 179, 8, 0.2) !important;
        border-color: #eab308 !important;
      }
    }
  }
}

.repo-desc {
  margin: 0 0 $spacing-sm 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

  &.no-desc {
    color: var(--text-tertiary);
    font-style: italic;
  }
}

/* AI Summary Box Styling */
.ai-summary-box {
  background: linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(59, 130, 246, 0.05) 100%);
  border: 1px solid rgba(168, 85, 247, 0.15);
  border-radius: $radius-md;
  padding: $spacing-sm $spacing-md;
  margin-bottom: $spacing-sm;
  position: relative;
  
  [data-theme='dark'] & {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
    border-color: rgba(168, 85, 247, 0.25);
  }
}

.ai-loading-wrapper {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  height: 24px;

  .ai-logo-icon {
    font-size: 1rem;
    color: #a855f7;
    animation: rotating 2s linear infinite;
  }

  .ai-loading-text {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    font-weight: 500;
  }
}

.ai-content-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 10px;

  .ai-avatar-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    background: #a855f7;
    border-radius: 4px;
    color: #fff;
    flex-shrink: 0;
    margin-top: 2px;
    box-shadow: 0 2px 4px rgba(168, 85, 247, 0.3);

    .ai-logo-icon {
      font-size: 0.75rem;
    }
  }

  .ai-summary-text {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
    color: var(--text-primary);
    font-weight: 500;
    
    [data-theme='dark'] & {
      color: #e2e8f0;
    }
  }
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: $spacing-md;

  .category-tag {
    border-color: var(--border) !important;
    background: var(--bg-primary) !important;
    color: var(--text-secondary) !important;
    font-weight: 500;
    
    [data-theme='dark'] & {
      background: #1e293b !important;
      border-color: rgba(255, 255, 255, 0.08) !important;
    }
  }
}

.ai-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: $spacing-md;
  
  .ai-tag-item {
    font-size: 0.725rem;
    color: var(--el-color-primary);
    opacity: 0.85;
    background: rgba(64, 158, 255, 0.08);
    padding: 1px 6px;
    border-radius: 4px;
    cursor: default;
    
    &:hover {
      opacity: 1;
    }
  }
}

.card-footer {
  display: flex;
  align-items: center;
  gap: $spacing-lg;
  flex-wrap: wrap;
  border-top: 1px solid var(--border);
  padding-top: $spacing-sm;
  
  [data-theme='dark'] & {
    border-color: rgba(255, 255, 255, 0.05);
  }

  .footer-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    font-weight: 500;

    .footer-icon {
      font-size: 0.9rem;
      color: var(--text-tertiary);
    }
  }

  .language-info {
    .lang-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
  }
}

/* Slide-Fade Transition for AI Box */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.2s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(10px);
  opacity: 0;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>

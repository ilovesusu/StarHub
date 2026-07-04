<template>
  <div class="trending-page">
    <HomeLayout>
      <!-- 侧边栏：发现频道 -->
      <template #sidebar>
        <DiscoverChannels v-model:activeChannel="activeChannel" />
      </template>

      <!-- 主区域：趋势内容列表 -->
      <template #main>
        <div class="trending-container">
          <!-- 顶部筛选栏 -->
          <TrendingHeader
            v-model:timeRange="timeRange"
            v-model:platform="platform"
            v-model:language="language"
            :total="totalCount"
            :loading="loading"
            :aiLoading="aiBatchLoading"
            :lastUpdated="lastUpdated"
            @refresh="fetchTrendingData"
            @ai-analyze="handleBatchAiAnalyze"
          />

          <!-- 趋势内容主体 -->
          <div class="trending-content-body">
            <!-- 搜索频道专属输入栏 -->
            <div class="search-channel-bar" v-if="activeChannel === 'search'">
              <el-input
                v-model="customSearchQuery"
                placeholder="输入关键字进行搜索，如 'vue-router' 或 'stars:>1000'..."
                clearable
                class="search-channel-input"
                @keyup.enter="fetchTrendingData"
              >
                <template #append>
                  <el-button @click="fetchTrendingData">
                    <el-icon><Search /></el-icon>
                  </el-button>
                </template>
              </el-input>
            </div>

            <!-- 骨架屏加载状态 -->
            <div class="skeleton-wrapper" v-if="loading">
              <el-skeleton :rows="5" animated class="custom-skeleton" />
              <el-skeleton :rows="5" animated class="custom-skeleton mt-4" />
            </div>

            <!-- 列表展现 -->
            <template v-else>
              <div class="trending-list" v-if="trendingRepos.length > 0">
                <TrendingCard
                  v-for="(repo, index) in trendingRepos"
                  :key="repo.id"
                  :repo="repo"
                  :index="index + (currentPage - 1) * pageSize"
                  :isSubscribed="isStarred(repo)"
                  :aiSummary="aiCache[repo.full_name]?.summary"
                  :aiCategories="aiCache[repo.full_name]?.categories"
                  :aiTags="aiCache[repo.full_name]?.tags"
                  :aiLoading="aiCardsLoading[repo.full_name]"
                  @ai-analyze="handleSingleAiAnalyze"
                  @toggle-readme="handleOpenReadme"
                  @subscribe="handleToggleSubscribe"
                  @open-external="handleOpenExternal"
                />
              </div>

              <!-- 空状态 -->
              <div class="empty-wrapper" v-else>
                <el-empty :description="activeChannel === 'search' ? '请输入关键字并按回车搜索' : '暂无相关趋势数据'" />
              </div>
            </template>

            <!-- 分页栏 -->
            <div class="pagination-wrapper" v-if="trendingRepos.length > 0 && !loading">
              <el-pagination
                v-model:currentPage="currentPage"
                v-model:pageSize="pageSize"
                :total="totalCount"
                :page-sizes="[10, 20, 50]"
                layout="prev, pager, next, sizes, total"
                background
                @current-change="handlePageChange"
                @size-change="handleSizeChange"
              />
            </div>
          </div>
        </div>
      </template>
    </HomeLayout>

    <!-- README 预览抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      :title="activeRepoForReadme?.full_name || 'README.md'"
      size="50%"
      destroy-on-close
    >
      <div v-loading="readmeLoading" class="readme-drawer-content">
        <div class="markdown-body" v-html="renderedReadme" v-if="renderedReadme"></div>
        <el-empty description="无法加载该仓库的 README.md" v-else-if="!readmeLoading" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import HomeLayout from '@/layouts/HomeLayout.vue'
import DiscoverChannels from './components/DiscoverChannels.vue'
import TrendingHeader from './components/TrendingHeader.vue'
import TrendingCard from './components/TrendingCard.vue'
import { githubApi } from '@/api/github'
import { useRepoStore } from '@/stores/repo'
import { db } from '@/db'
import { analyzeRepository } from '@/services/ai'
import type { Repository } from '@/types'

// Markdown 渲染相关
import { marked } from 'marked'
import { gfmHeadingId } from 'marked-gfm-heading-id'
import { mangle } from 'marked-mangle'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'

// 配置 marked
marked.use(
  gfmHeadingId(),
  mangle(),
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    }
  })
)

const repoStore = useRepoStore()

// 状态定义
const activeChannel = ref('trending')
const timeRange = ref('weekly')
const platform = ref('all')
const language = ref('all')
const customSearchQuery = ref('')

const loading = ref(false)
const trendingRepos = ref<Repository[]>([])
const totalCount = ref(0)
const lastUpdated = ref<Date | null>(null)

// 分页
const currentPage = ref(1)
const pageSize = ref(20)

// AI 缓存与批量 Loading
const aiCache = ref<Record<string, { summary: string; categories: string[]; tags?: string[] }>>({})
const aiBatchLoading = ref(false)
const aiCardsLoading = ref<Record<string, boolean>>({})

// README 抽屉状态
const drawerVisible = ref(false)
const readmeLoading = ref(false)
const activeRepoForReadme = ref<Repository | null>(null)
const renderedReadme = ref('')

// 本地订阅判定
const isStarred = (repo: Repository) => {
  return repoStore.repos.some((r: any) => r.id === repo.id)
}

// 日期计算方法
const getDateLimit = (range: string) => {
  const now = new Date()
  if (range === 'today') {
    now.setDate(now.getDate() - 1)
  } else if (range === 'weekly') {
    now.setDate(now.getDate() - 7)
  } else if (range === 'monthly') {
    now.setDate(now.getDate() - 30)
  }
  return now.toISOString().split('T')[0]
}

// 整理 API 搜索条件
const buildSearchQuery = () => {
  let q = ''

  if (activeChannel.value === 'trending') {
    q += 'stars:>=50'
    const dateLimit = getDateLimit(timeRange.value)
    q += ` pushed:>=${dateLimit}`
  } else if (activeChannel.value === 'new_releases') {
    const dateLimit = getDateLimit(timeRange.value)
    q += `created:>=${dateLimit}`
  } else if (activeChannel.value === 'most_popular') {
    q += 'stars:>=10000'
  } else if (activeChannel.value === 'topics') {
    q += 'topic:artificial-intelligence OR topic:llm OR topic:machine-learning OR topic:web'
  } else if (activeChannel.value === 'search') {
    if (customSearchQuery.value.trim()) {
      q += customSearchQuery.value.trim()
    } else {
      q += 'stars:>=100' // 默认值
    }
  }

  // 拼接平台
  if (platform.value !== 'all') {
    if (platform.value === 'macos') {
      q += ' AND (macos OR osx OR topic:macos)'
    } else if (platform.value === 'windows') {
      q += ' AND (windows OR topic:windows)'
    } else if (platform.value === 'linux') {
      q += ' AND (linux OR topic:linux)'
    } else if (platform.value === 'browser') {
      q += ' AND (browser OR chrome-extension OR topic:browser)'
    }
  }

  // 拼接语言
  if (language.value !== 'all') {
    q += ` language:${language.value}`
  }

  return q
}

// 拉取 API 数据
const fetchTrendingData = async () => {
  if (activeChannel.value === 'search' && !customSearchQuery.value.trim()) {
    trendingRepos.value = []
    totalCount.value = 0
    return
  }

  loading.value = true
  const query = buildSearchQuery()

  try {
    const res = await githubApi.searchRepositories({
      q: query,
      sort: activeChannel.value === 'new_releases' ? 'updated' : 'stars',
      order: 'desc',
      page: currentPage.value,
      per_page: pageSize.value
    })
    trendingRepos.value = res.data.items || []
    totalCount.value = res.data.total_count || 0
    lastUpdated.value = new Date()
  } catch (error: any) {
    console.error('Failed to fetch trending repositories:', error)
    ElMessage.error(`获取趋势数据失败: ${error.message || '网络连接异常'}`)
  } finally {
    loading.value = false
  }
}

// 分页切换
const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchTrendingData()
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
  fetchTrendingData()
}

// 监听各个筛选字段，触发重新请求
watch([activeChannel, timeRange, platform, language], () => {
  currentPage.value = 1
  fetchTrendingData()
})

// AI 缓存管理
const loadAiCache = () => {
  const cached = localStorage.getItem('starhub_ai_trending_summaries')
  if (cached) {
    try {
      aiCache.value = JSON.parse(cached)
    } catch (e) {
      aiCache.value = {}
    }
  }
}

const saveAiCache = () => {
  localStorage.setItem('starhub_ai_trending_summaries', JSON.stringify(aiCache.value))
}

// 单个 AI 智能分析
const handleSingleAiAnalyze = async (repo: Repository) => {
  if (aiCache.value[repo.full_name]) return

  aiCardsLoading.value[repo.full_name] = true
  try {
    let readmePreview = ''
    try {
      const [owner, name] = repo.full_name.split('/')
      const readmeRes = await githubApi.getReadme(owner, name)
      readmePreview = readmeRes.data.substring(0, 1000)
    } catch (e) {
      // 忽略 readme 获取错误，降级
    }

    const analysis = await analyzeRepository(repo, readmePreview)
    aiCache.value[repo.full_name] = analysis
    saveAiCache()
    ElMessage.success(`${repo.name} AI 分析完成`)
  } catch (err: any) {
    console.error(err)
    ElMessage.error(`AI 分析失败: ${err.message || '请检查 AI API 配置'}`)
  } finally {
    aiCardsLoading.value[repo.full_name] = false
  }
}

// 批量 AI 分析 (当前前 5 个未分析的)
const handleBatchAiAnalyze = async () => {
  const unanalyzed = trendingRepos.value.filter(r => !aiCache.value[r.full_name])
  if (unanalyzed.length === 0) {
    ElMessage.info('当前列表的所有项目均已完成 AI 分析')
    return
  }

  aiBatchLoading.value = true
  const batchList = unanalyzed.slice(0, 5)
  ElMessage.info(`正在批量分析 ${batchList.length} 个项目，请稍候...`)

  let successCount = 0
  for (const repo of batchList) {
    try {
      aiCardsLoading.value[repo.full_name] = true
      let readmePreview = ''
      try {
        const [owner, name] = repo.full_name.split('/')
        const readmeRes = await githubApi.getReadme(owner, name)
        readmePreview = readmeRes.data.substring(0, 1000)
      } catch (e) {}

      const analysis = await analyzeRepository(repo, readmePreview)
      aiCache.value[repo.full_name] = analysis
      saveAiCache()
      successCount++
    } catch (e) {
      console.error(e)
    } finally {
      aiCardsLoading.value[repo.full_name] = false
    }
  }

  aiBatchLoading.value = false
  ElMessage.success(`AI 批量分析完成，成功分析了 ${successCount} 个仓库`)
}

// 打开 README 预览
const handleOpenReadme = async (repo: Repository) => {
  activeRepoForReadme.value = repo
  drawerVisible.value = true
  readmeLoading.value = true
  renderedReadme.value = ''

  try {
    const [owner, name] = repo.full_name.split('/')
    const defaultBranch = (repo as any).default_branch || 'main'
    const res = await githubApi.getReadme(owner, name)
    let rawReadme = res.data

    // 路径处理
    const rawBaseUrl = `https://raw.githubusercontent.com/${owner}/${name}/${defaultBranch}/`
    const repoBaseUrl = `https://github.com/${owner}/${name}/blob/${defaultBranch}/`

    rawReadme = rawReadme.replace(
      /!\[([^\]]*)\]\((?!https?:\/\/|data:)\.?\/?([^)]+)\)/g,
      `![$1](${rawBaseUrl}$2)`
    )
    rawReadme = rawReadme.replace(
      /<img([^>]*?)src=["'](?!https?:\/\/|data:)\.?\/?([^"']+)["']/gi,
      `<img$1src="${rawBaseUrl}$2"`
    )
    rawReadme = rawReadme.replace(
      /\[([^\]]+)\]\((?!https?:\/\/|#|mailto:)\.?\/?([^)]+)\)/g,
      `[$1](${repoBaseUrl}$2)`
    )

    const html = marked(rawReadme) as string
    renderedReadme.value = DOMPurify.sanitize(html, {
      ADD_ATTR: ['target', 'rel', 'class', 'id', 'checked', 'disabled', 'type'],
      ADD_TAGS: ['input', 'span'],
      FORBID_TAGS: ['script', 'style'],
      KEEP_CONTENT: true
    })
  } catch (e) {
    console.error('Failed to load README:', e)
  } finally {
    readmeLoading.value = false
  }
}

// 规范化数据，匹配 IndexedDB 的 schema
const sanitizeRepo = (repo: any): Repository => {
  return {
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    html_url: repo.html_url,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
    open_issues_count: repo.open_issues_count,
    updated_at: repo.updated_at,
    created_at: repo.created_at,
    pushed_at: repo.pushed_at,
    owner: {
      login: repo.owner.login,
      avatar_url: repo.owner.avatar_url,
      html_url: repo.owner.html_url
    },
    topics: repo.topics || [],
    archived: repo.archived || false,
    disabled: repo.disabled || false,
    private: repo.private || false
  }
}

// 订阅/取消订阅 (Star/Unstar 并进行本地离线库同步)
const handleToggleSubscribe = async (repo: Repository) => {
  const starred = isStarred(repo)
  const [owner, name] = repo.full_name.split('/')

  try {
    if (starred) {
      // 取消订阅
      await githubApi.unstarRepository(owner, name)
      await db.repos.delete(repo.id)
      repoStore.repos = repoStore.repos.filter((r: any) => r.id !== repo.id)
      ElMessage.success('已取消订阅并同步本地离线库')
    } else {
      // 订阅
      await githubApi.starRepository(owner, name)
      
      // 增量同步该仓库信息并缓存
      const res = await githubApi.getRepository(owner, name)
      const sanitized = sanitizeRepo(res.data)
      await db.repos.put(sanitized)
      
      repoStore.repos.push(sanitized)
      ElMessage.success('订阅成功，仓库信息已增量同步至本地离线库')
    }
  } catch (error: any) {
    console.error('Subscription error:', error)
    ElMessage.error(`操作失败: ${error.message || '未知错误'}`)
  }
}

const handleOpenExternal = (url: string) => {
  window.open(url, '_blank')
}

// 挂载
onMounted(async () => {
  loadAiCache()
  
  // 确保本地已有 star 列表已加载
  if (repoStore.repos.length === 0) {
    await repoStore.loadLocalRepos()
  }

  fetchTrendingData()
})
</script>

<style lang="scss" scoped>
.trending-page {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-primary);
}

.trending-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.trending-content-body {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-xl;
  display: flex;
  flex-direction: column;
  gap: $spacing-lg;

  // 微调背景
  background: var(--bg-primary);
  [data-theme='dark'] & {
    background: #1c2333;
  }
}

.search-channel-bar {
  margin-bottom: $spacing-xs;
  max-width: 600px;

  .search-channel-input {
    :deep(.el-input__wrapper) {
      background-color: var(--bg-secondary) !important;
      border-radius: 20px 0 0 20px;
      box-shadow: 0 0 0 1px var(--border) inset !important;
      
      &:hover, &.is-focus {
        box-shadow: 0 0 0 1px var(--el-color-primary) inset !important;
      }
    }

    :deep(.el-input-group__append) {
      background-color: var(--el-color-primary) !important;
      border-radius: 0 20px 20px 0;
      border: none;
      color: #ffffff;
      
      .el-button {
        color: #ffffff !important;
        margin: 0;
        
        &:hover {
          background-color: var(--el-color-primary-light-3) !important;
        }
      }
    }
  }
}

.skeleton-wrapper {
  padding: $spacing-md 0;
  
  .custom-skeleton {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: $radius-lg;
    padding: $spacing-lg;
    
    [data-theme='dark'] & {
      background: rgba(30, 41, 59, 0.5);
      border-color: rgba(255, 255, 255, 0.06);
    }
  }
}

.trending-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.empty-wrapper {
  padding: 80px 0;
  background: var(--bg-secondary);
  border-radius: $radius-lg;
  border: 1px dashed var(--border);
  display: flex;
  justify-content: center;
  align-items: center;

  [data-theme='dark'] & {
    background: rgba(30, 41, 59, 0.3);
    border-color: rgba(255, 255, 255, 0.08);
  }
}

.pagination-wrapper {
  margin-top: $spacing-md;
  display: flex;
  justify-content: flex-end;
  padding-bottom: $spacing-lg;
}

.readme-drawer-content {
  padding: $spacing-lg $spacing-xl;
  height: 100%;
  overflow-y: auto;
}

.mt-4 {
  margin-top: 16px;
}
</style>

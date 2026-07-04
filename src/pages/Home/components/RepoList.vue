<template>
  <div class="repo-list" :class="{ 'is-detail-open': detailOpen }">
    <div class="repo-list-header">
      <div class="header-left">
        <el-button
          v-if="!selectMode"
          size="small"
          @click="enterSelectMode"
          type="primary"
          plain
        >
          <el-icon><Check /></el-icon>
          <span style="margin-left: 4px;">{{ t('common.select') }}</span>
        </el-button>
        <el-checkbox
          v-if="selectMode"
          v-model="selectAll"
          :indeterminate="isIndeterminate"
          @change="handleSelectAll"
          style="margin-right: 12px;"
        />
        <div class="repo-count">
          <template v-if="selectMode && selectedRepos.size > 0">
            {{ selectedRepos.size }} / {{ totalCount }} {{ t('common.selected') }}
          </template>
          <template v-else>
            {{ totalCount }} {{ totalCount === 1 ? t('home.repo') : t('home.repos') }}
          </template>
        </div>
      </div>
      <div class="header-actions" v-if="selectMode">
        <el-button 
          v-if="selectedRepos.size > 0"
          size="small" 
          type="primary"
          @click="handleBatchTag"
        >
          <el-icon><Collection /></el-icon>
          {{ t('batchTag.title') }} ({{ selectedRepos.size }})
        </el-button>
        <el-button size="small" text @click="exitSelectMode">
          <el-icon><Close /></el-icon>
          {{ selectedRepos.size > 0 ? t('common.cancel') : t('common.exit') }}
        </el-button>
      </div>
      <div class="header-actions" v-if="!selectMode">
        <el-button 
          size="small" 
          text
          class="filter-toggle-btn"
          :class="{ 'is-active': showFilterPanel || hasActiveFilters }"
          @click="showFilterPanel = !showFilterPanel"
        >
          <el-icon><Filter /></el-icon>
          <span style="margin-left: 4px;">筛选</span>
          <span v-if="activeFiltersCount > 0" class="filter-count-badge">{{ activeFiltersCount }}</span>
        </el-button>

        <el-dropdown @command="handleSortChange" trigger="click">
          <el-button size="small" text>
            <el-icon><Sort /></el-icon>
            <span style="margin-left: 4px;">{{ sortLabel }}</span>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="updated" :class="{ 'is-active': sortBy === 'updated' }">
                <el-icon><Clock /></el-icon>
                <span>按更新时间</span>
                <el-icon v-if="sortBy === 'updated'" class="check-icon"><Check /></el-icon>
              </el-dropdown-item>
              <el-dropdown-item command="stars" :class="{ 'is-active': sortBy === 'stars' }">
                <el-icon><Star /></el-icon>
                <span>按星标数</span>
                <el-icon v-if="sortBy === 'stars'" class="check-icon"><Check /></el-icon>
              </el-dropdown-item>
              <el-dropdown-item command="created" :class="{ 'is-active': sortBy === 'created' }">
                <el-icon><Calendar /></el-icon>
                <span>按创建时间</span>
                <el-icon v-if="sortBy === 'created'" class="check-icon"><Check /></el-icon>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 内联多维筛选折叠面板 -->
    <el-collapse-transition>
      <div v-show="showFilterPanel" class="inline-filter-panel">
        <!-- 1. 分类状态 -->
        <div class="filter-row">
          <span class="row-label">{{ t('home.filterByType') }}</span>
          <div class="row-content">
            <el-radio-group v-model="filterType" size="small" class="filter-radio-group">
              <el-radio-button label="all">{{ t('home.allTypes') }}</el-radio-button>
              <el-radio-button label="untagged">{{ t('home.unclassifiedOnly') }}</el-radio-button>
            </el-radio-group>
          </div>
        </div>



        <!-- 4. 星标范围 -->
        <div class="filter-row">
          <span class="row-label">{{ t('home.filterByStars') }}</span>
          <div class="row-content stars-filter-wrapper">
            <div class="stars-presets">
              <button 
                class="preset-btn" 
                :class="{ active: currentStarsPreset === 'all' }"
                @click="applyStarsPreset('all')"
              >{{ t('home.noLimit') }}</button>
              <button 
                class="preset-btn" 
                :class="{ active: currentStarsPreset === '1k' }"
                @click="applyStarsPreset('1k')"
              >1K+</button>
              <button 
                class="preset-btn" 
                :class="{ active: currentStarsPreset === '5k' }"
                @click="applyStarsPreset('5k')"
              >5K+</button>
              <button 
                class="preset-btn" 
                :class="{ active: currentStarsPreset === '10k' }"
                @click="applyStarsPreset('10k')"
              >10K+</button>
            </div>
            <div class="stars-custom-range">
              <el-input-number 
                v-model="searchMinStars" 
                :min="0" 
                :controls="false"
                :placeholder="t('home.minStars')"
                size="small"
                class="custom-stars-input"
              />
              <span class="range-connector">至</span>
              <el-input-number 
                v-model="searchMaxStars" 
                :min="0" 
                :controls="false"
                :placeholder="t('home.maxStars')"
                size="small"
                class="custom-stars-input"
              />
            </div>
          </div>
        </div>
      </div>
    </el-collapse-transition>
    
    <!-- 激活的多维筛选徽章栏 -->
    <div v-if="hasActiveFilters" class="active-filters-bar">
      <div class="filters-badges">
        <el-tag
          v-for="filter in activeFilters"
          :key="`${filter.type}-${filter.key}`"
          closable
          size="small"
          :color="filter.type === 'tag' ? filter.color + '1a' : ''"
          :style="{ 
            borderColor: filter.color, 
            color: filter.type === 'tag' ? filter.color : 'var(--text-primary)'
          }"
          class="filter-badge-item"
          @close="removeFilter(filter)"
        >
          <span 
            v-if="filter.type === 'language'" 
            class="lang-badge-dot" 
            :style="{ backgroundColor: filter.color }"
          ></span>
          {{ filter.label }}
        </el-tag>
      </div>
      <el-button 
        link 
        type="danger" 
        size="small" 
        class="clear-all-filters-btn"
        @click="handleClearAllFilters"
      >
        <el-icon><Delete /></el-icon>
        <span style="margin-left: 4px;">{{ t('home.resetFilters') }}</span>
      </el-button>
    </div>

    <div class="repo-list-content">
      <div v-if="loading" class="loading-container">
        <el-skeleton
          v-for="i in 5"
          :key="i"
          :rows="3"
          animated
          class="repo-skeleton"
        />
      </div>
      <div v-else-if="repos.length === 0" class="empty-state">
        <el-icon :size="64" class="empty-icon"><Box /></el-icon>
        <p>{{ t('home.noRepos') }}</p>
      </div>
      <div v-else class="repo-items">
        <RepoCard
          v-for="repo in sortedRepos"
          :key="`repo-${repo.id}`"
          :repo="repo"
          :isActive="activeRepo?.id === repo.id"
          :selected="selectedRepos.has(repo.id)"
          :selectMode="selectMode"
          @click="handleRepoClick(repo)"
          @select="handleRepoSelect(repo.id, $event)"
        />
      </div>
    </div>
    <div v-if="!loading && repos.length > 0 && totalPages > 1" class="repo-list-pagination">
      <el-pagination
        v-model:current-page="currentPage"
        :page-size="pageSize"
        :total="totalCount"
        :page-sizes="[50, 100, 200, 500]"
        layout="sizes, prev, pager, next"
        :pager-count="5"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
        class="repo-pagination"
      />
    </div>

    <!-- 批量设置分类对话框 -->
    <BatchTagDialog
      v-model="showBatchTagDialog"
      :repo-count="selectedRepos.size"
      :tags="tagStore.tags"
      @confirm="handleBatchTagConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRepoStore } from '@/stores/repo'
import { useTagStore } from '@/stores/tag'
import { ElMessage, ElMessageBox } from 'element-plus'
import RepoCard from './RepoCard.vue'
import BatchTagDialog from './BatchTagDialog.vue'
import type { Repository } from '@/types'
import { Box, Collection, Close, Check, Sort, Clock, Star, Calendar, Delete, Filter } from '@element-plus/icons-vue'
import { getLanguageColor } from '@/utils/languageColors'

const props = defineProps<{
  repos: Repository[]
  loading: boolean
  syncing?: boolean
  activeRepo?: Repository | null
  detailOpen?: boolean
}>()

const emit = defineEmits<{
  repoClick: [repo: Repository]
}>()

const { t } = useI18n()
const repoStore = useRepoStore()
const tagStore = useTagStore()

// Active filters computation for multidimensional search display
const activeFilters = computed(() => {
  const filters = []
  
  // 1. Classification status
  if (repoStore.filterType === 'untagged') {
    filters.push({
      type: 'filterType',
      key: 'untagged',
      label: t('home.unclassifiedOnly'),
      color: '#ef4444'
    })
  }
  
  // 2. Custom tags
  repoStore.searchTags.forEach(tagId => {
    const tag = tagStore.tags.find(t => t.id === tagId)
    if (tag) {
      filters.push({
        type: 'tag',
        key: tagId,
        label: (tag.emoji ? tag.emoji + ' ' : '') + tag.name,
        color: tag.color
      })
    }
  })
  
  // 3. Languages
  repoStore.searchLanguages.forEach(lang => {
    filters.push({
      type: 'language',
      key: lang,
      label: lang,
      color: getLanguageColor(lang)
    })
  })
  
  // 4. Stars Range
  if (repoStore.searchMinStars !== null || repoStore.searchMaxStars !== null) {
    let label = ''
    if (repoStore.searchMinStars !== null && repoStore.searchMaxStars !== null) {
      label = `⭐ ${repoStore.searchMinStars} - ${repoStore.searchMaxStars}`
    } else if (repoStore.searchMinStars !== null) {
      label = `⭐ >= ${repoStore.searchMinStars}`
    } else {
      label = `⭐ <= ${repoStore.searchMaxStars}`
    }
    filters.push({
      type: 'stars',
      key: 'stars',
      label,
      color: '#f59e0b'
    })
  }
  
  return filters
})

const hasActiveFilters = computed(() => activeFilters.value.length > 0)

const removeFilter = (filter: any) => {
  if (filter.type === 'filterType') {
    repoStore.setFilterType('all')
  } else if (filter.type === 'tag') {
    const newTags = repoStore.searchTags.filter(id => id !== filter.key)
    repoStore.setSearchTags(newTags)
  } else if (filter.type === 'language') {
    const newLangs = repoStore.searchLanguages.filter(l => l !== filter.key)
    repoStore.setSearchLanguages(newLangs)
  } else if (filter.type === 'stars') {
    repoStore.setSearchMinStars(null)
    repoStore.setSearchMaxStars(null)
  }
}

const handleClearAllFilters = () => {
  repoStore.resetFilters()
}

// --- 内联高级筛选面板相关逻辑 ---
const showFilterPanel = ref(false)

const searchMinStars = computed({
  get: () => repoStore.searchMinStars,
  set: (val) => repoStore.setSearchMinStars(val)
})

const searchMaxStars = computed({
  get: () => repoStore.searchMaxStars,
  set: (val) => repoStore.setSearchMaxStars(val)
})

const filterType = computed({
  get: () => repoStore.filterType,
  set: (val) => repoStore.setFilterType(val)
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (repoStore.searchTags.length > 0) count += repoStore.searchTags.length
  if (repoStore.searchLanguages.length > 0) count += repoStore.searchLanguages.length
  if (repoStore.searchMinStars !== null) count++
  if (repoStore.searchMaxStars !== null) count++
  if (repoStore.filterType === 'untagged') count++
  return count
})

const currentStarsPreset = computed(() => {
  const min = repoStore.searchMinStars
  const max = repoStore.searchMaxStars
  if (min === null && max === null) return 'all'
  if (min === 1000 && max === null) return '1k'
  if (min === 5000 && max === null) return '5k'
  if (min === 10000 && max === null) return '10k'
  return 'custom'
})

const applyStarsPreset = (preset: 'all' | '1k' | '5k' | '10k') => {
  if (preset === 'all') {
    repoStore.setSearchMinStars(null)
    repoStore.setSearchMaxStars(null)
  } else if (preset === '1k') {
    repoStore.setSearchMinStars(1000)
    repoStore.setSearchMaxStars(null)
  } else if (preset === '5k') {
    repoStore.setSearchMinStars(5000)
    repoStore.setSearchMaxStars(null)
  } else if (preset === '10k') {
    repoStore.setSearchMinStars(10000)
    repoStore.setSearchMaxStars(null)
  }
}
// const syncProgress = computed(() => repoStore.syncProgress)

// 批量选择相关
const selectedRepos = ref<Set<number>>(new Set())
const selectMode = ref(false)
const showBatchTagDialog = ref(false)

// 排序相关
const sortBy = ref<'updated' | 'stars' | 'created'>('updated')

const sortLabel = computed(() => {
  switch (sortBy.value) {
    case 'updated':
      return '按更新时间'
    case 'stars':
      return '按星标数'
    case 'created':
      return '按创建时间'
    default:
      return '排序'
  }
})

const handleSortChange = (command: 'updated' | 'stars' | 'created') => {
  sortBy.value = command
}

const sortedRepos = computed(() => {
  const reposCopy = [...props.repos]
  
  switch (sortBy.value) {
    case 'stars':
      return reposCopy.sort((a, b) => b.stargazers_count - a.stargazers_count)
    case 'created':
      return reposCopy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    case 'updated':
    default:
      return reposCopy.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  }
})

const selectAll = computed({
  get: () => props.repos.length > 0 && selectedRepos.value.size === props.repos.length,
  set: (value: boolean) => {
    if (value) {
      props.repos.forEach(repo => selectedRepos.value.add(repo.id))
    } else {
      selectedRepos.value.clear()
    }
  }
})

const isIndeterminate = computed(() => {
  return selectedRepos.value.size > 0 && selectedRepos.value.size < props.repos.length
})

const handleSelectAll = (checked: boolean) => {
  if (checked) {
    props.repos.forEach(repo => selectedRepos.value.add(repo.id))
  } else {
    props.repos.forEach(repo => selectedRepos.value.delete(repo.id))
  }
}

const handleRepoClick = (repo: Repository) => {
  if (selectMode.value) {
    // 选择模式下，点击切换选择状态
    handleRepoSelect(repo.id, !selectedRepos.value.has(repo.id))
  } else {
    // 普通模式下，触发点击事件
    emit('repoClick', repo)
  }
}

const enterSelectMode = () => {
  selectMode.value = true
}

const exitSelectMode = () => {
  selectedRepos.value.clear()
  selectMode.value = false
}

const handleRepoSelect = (repoId: number, selected: boolean) => {
  if (selected) {
    selectedRepos.value.add(repoId)
  } else {
    selectedRepos.value.delete(repoId)
  }
}

const clearSelection = () => {
  selectedRepos.value.clear()
}

const handleBatchTag = async () => {
  if (selectedRepos.value.size === 0) {
    ElMessage.warning('请先选择仓库')
    return
  }
  
  const tags = tagStore.tags
  if (tags.length === 0) {
    ElMessage.warning(t('batchTag.pleaseCreateTags'))
    return
  }
  
  showBatchTagDialog.value = true
}

const handleBatchTagConfirm = async (selectedTagIds: string[], mode: 'add' | 'replace' = 'add') => {
  if (selectedTagIds.length === 0 && mode === 'replace') {
    // 如果替换模式且没选择任何分类，询问是否移除所有分类
    try {
      await ElMessageBox.confirm(
        '未选择任何分类，将移除所选仓库的所有分类。是否继续？',
        '确认操作',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
    } catch {
      return // 用户取消
    }
  }
  
  // 批量设置分类到所有选中的仓库
  const repoIds = Array.from(selectedRepos.value)
  const repoCount = repoIds.length
  const tagCount = selectedTagIds.length
  let successCount = 0
  let totalOperations = 0
  
  // 显示进度
  const loadingMessage = ElMessage({
    message: `正在为 ${repoCount} 个仓库${mode === 'add' ? '添加' : '设置'}分类...`,
    type: 'info',
    duration: 0
  })
  
  try {
    for (const repoId of repoIds) {
      try {
        // 获取仓库当前的所有分类
        const currentTags = await tagStore.getRepoTags(repoId)
        const currentTagIds = new Set(currentTags.map(t => t.id))
        
        if (mode === 'replace') {
          // 替换模式：移除不在选中列表中的分类
          for (const tagId of currentTagIds) {
            if (!selectedTagIds.includes(tagId)) {
              await tagStore.removeTagFromRepo(repoId, tagId)
              totalOperations++
            }
          }
        }
        
        // 添加新的分类（如果还没有）
        for (const tagId of selectedTagIds) {
          if (!currentTagIds.has(tagId)) {
            await tagStore.addTagToRepo(repoId, tagId)
            totalOperations++
          }
        }
        
        successCount++
      } catch (error) {
        console.error(`Failed to update tags for repo ${repoId}:`, error)
      }
    }
    
    // 重新加载标签
    await tagStore.loadTags()
    
    loadingMessage.close()
    
    const modeText = mode === 'add' ? '添加' : '设置'
    if (totalOperations > 0) {
      ElMessage.success(`成功为 ${successCount} 个仓库${modeText}了 ${tagCount} 个分类`)
    } else {
      ElMessage.info(`所选仓库已包含这些分类`)
    }
    
    // 清空选择
    clearSelection()
  } catch (error) {
    loadingMessage.close()
    ElMessage.error('批量设置分类失败')
    console.error('Batch tag failed:', error)
  }
}

// Pagination
const currentPage = computed({
  get: () => repoStore.currentPage,
  set: (value: number) => repoStore.setCurrentPage(value)
})

const pageSize = computed({
  get: () => repoStore.pageSize,
  set: (value: number) => repoStore.setPageSize(value)
})

const totalCount = computed(() => {
  // Calculate total count from allFilteredRepos
  const allRepos = (repoStore as any).allFilteredRepos || []
  console.log('Total filtered repos:', allRepos.length)
  return allRepos.length
})

const totalPages = computed(() => {
  const pages = Math.ceil(totalCount.value / pageSize.value)
  console.log('Total pages:', pages, 'pageSize:', pageSize.value)
  return pages
})

const handlePageChange = (page: number) => {
  repoStore.setCurrentPage(page)
  // Scroll to top of list
  const listContent = document.querySelector('.repo-list-content')
  if (listContent) {
    listContent.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

const handleSizeChange = (size: number) => {
  repoStore.setPageSize(size)
}
</script>

<style lang="scss" scoped>
.repo-list {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  border-right: none;

  &.is-detail-open {
    border-right: 1px solid var(--border);
    width: 100% !important;
    min-width: 0 !important;
  }

  // 深色模式下使用与应用一致的背景色
  [data-theme='dark'] & {
    background: #1c2333 !important;
    border-right-color: rgba(96, 165, 250, 0.2) !important;
  }

  @media (max-width: 1200px) {
    width: 420px;
  }
  
  @media (max-width: 1024px) {
    width: 360px;
    min-width: 320px;
  }

  @media (max-width: 768px) {
    width: 100%;
    border-right: none;
  }
}

.repo-list-header {
  padding: $spacing-md $spacing-lg;
  border-bottom: 1px solid var(--border);
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 56px;
  
  // 深色模式下使用与应用一致的背景色
  [data-theme='dark'] & {
    background: #252d3d !important;
    border-bottom-color: rgba(96, 165, 250, 0.2) !important;
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: $spacing-md;
    flex: 1;
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    flex-shrink: 0;
  }
  
  :deep(.el-button) {
    font-size: 0.875rem;
    
    &.is-plain {
      background-color: rgba(64, 158, 255, 0.1) !important;
      border-color: #409EFF !important;
      color: #409EFF !important;
      
      &:hover {
        background-color: #409EFF !important;
        color: #fff !important;
        border-color: #409EFF !important;
      }
      
      :deep(.el-icon) {
        color: inherit !important;
      }
    }
    
    &.is-text {
      color: var(--text-primary) !important;
      
      &:hover {
        color: var(--el-color-primary) !important;
        background-color: var(--bg-tertiary) !important;
      }
    }
  }
  
  :deep(.el-checkbox) {
    .el-checkbox__label {
      font-size: 0.875rem;
      color: var(--text-primary);
    }
  }
}

.repo-count {
  font-size: 0.875rem;
  color: var(--text-primary);
  font-weight: 500;
}

.repo-syncing {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  font-size: 0.875rem;
  color: var(--text-secondary);
  
  .is-loading {
    animation: rotating 2s linear infinite;
  }
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

  .filter-toggle-btn {
    position: relative;
    
    &.is-active {
      color: var(--el-color-primary) !important;
      background-color: var(--bg-tertiary) !important;
      font-weight: 600;
    }
    
    .filter-count-badge {
      position: absolute;
      top: -2px;
      right: -4px;
      background-color: var(--el-color-primary);
      color: #ffffff;
      font-size: 8px;
      font-weight: 700;
      height: 14px;
      min-width: 14px;
      padding: 0 3px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
    }
  }

.inline-filter-panel {
  padding: 14px 18px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: inset 0 -2px 6px rgba(0, 0, 0, 0.02);

  [data-theme='dark'] & {
    background-color: #252d3d !important;
    border-bottom-color: rgba(96, 165, 250, 0.15) !important;
    box-shadow: inset 0 -2px 6px rgba(0, 0, 0, 0.1);
  }

  .filter-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;

    .row-label {
      width: 56px;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      padding-top: 4px;
      flex-shrink: 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .row-content {
      flex: 1;
      
      .filter-radio-group {
        display: flex;
        width: 100%;
        
        :deep(.el-radio-button) {
          flex: 1;
          .el-radio-button__inner {
            width: 100%;
            text-align: center;
            border-radius: 0;
          }
          &:first-child .el-radio-button__inner {
            border-radius: 4px 0 0 4px;
          }
          &:last-child .el-radio-button__inner {
            border-radius: 0 4px 4px 0;
          }
        }
      }
      
      &.tags-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        max-height: 100px;
        overflow-y: auto;
        padding-right: 4px;
        padding-bottom: 2px;

        &::-webkit-scrollbar {
          width: 4px;
        }
        &::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 2px;
        }

        .tag-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 0.725rem;
          cursor: pointer;
          border: 1px solid var(--border);
          background-color: var(--bg-primary);
          color: var(--text-secondary);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          user-select: none;

          [data-theme='dark'] & {
            border-color: rgba(255, 255, 255, 0.08);
          }

          &:hover {
            border-color: var(--tag-color);
            color: var(--tag-color);
          }

          &.is-selected {
            background-color: var(--tag-bg-selected);
            border-color: var(--tag-border-selected);
            color: var(--tag-color);
            font-weight: 600;
          }
        }

        .empty-inline-tip {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          padding: 4px 0;
        }
      }

      .lang-select-option {
        display: flex;
        align-items: center;
        gap: 8px;

        .lang-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
      }

      &.stars-filter-wrapper {
        display: flex;
        flex-direction: column;
        gap: 8px;

        .stars-presets {
          display: flex;
          gap: 6px;

          .preset-btn {
            flex: 1;
            padding: 4px 0;
            border-radius: 6px;
            font-size: 0.725rem;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            color: var(--text-secondary);
            cursor: pointer;
            transition: all 0.2s ease;

            [data-theme='dark'] & {
              border-color: rgba(255, 255, 255, 0.08);
            }

            &:hover {
              border-color: var(--el-color-primary);
              color: var(--el-color-primary);
            }

            &.active {
              background-color: rgba(64, 158, 255, 0.1);
              border-color: var(--el-color-primary);
              color: var(--el-color-primary);
              font-weight: 600;
            }
          }
        }

        .stars-custom-range {
          display: flex;
          align-items: center;
          gap: 8px;

          .range-connector {
            font-size: 0.75rem;
            color: var(--text-tertiary);
          }

          .custom-stars-input {
            flex: 1;
            
            :deep(.el-input__wrapper) {
              background-color: var(--bg-primary) !important;
              box-shadow: 0 0 0 1px var(--border) inset !important;
            }
          }
        }
      }
    }
  }
}

.active-filters-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  gap: 12px;

  [data-theme='dark'] & {
    background-color: #252d3d !important;
    border-bottom-color: rgba(96, 165, 250, 0.15) !important;
  }

  .filters-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    flex: 1;

    .filter-badge-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
      border-radius: 12px;
      padding: 2px 8px;
      border: 1px solid var(--border);
      
      .lang-badge-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        display: inline-block;
        margin-right: 2px;
      }

      :deep(.el-tag__close) {
        margin-left: 2px;
        color: inherit;
        
        &:hover {
          background-color: rgba(0, 0, 0, 0.1);
        }
      }
    }
  }

  .clear-all-filters-btn {
    font-size: 0.75rem;
    padding: 0 4px;
    height: auto;
    flex-shrink: 0;
    
    &:hover {
      color: var(--el-color-danger) !important;
      opacity: 0.8;
    }
  }
}

.repo-list-content {
  flex: 1;
  overflow-y: auto;
  padding: $spacing-sm;
}

.repo-list-pagination {
  padding: $spacing-sm $spacing-md;
  border-top: 1px solid var(--border);
  background: var(--bg-secondary);
  display: flex;
  justify-content: center;
  align-items: center;
  overflow-x: auto;
  overflow-y: hidden;
  
  // 深色模式下使用与应用一致的背景色
  [data-theme='dark'] & {
    background: #252d3d !important;
    border-top-color: rgba(96, 165, 250, 0.2) !important;
  }
  
  :deep(.el-pagination) {
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    white-space: nowrap;
    
    // 总数
    .el-pagination__total {
      color: var(--text-secondary) !important;
      font-size: 13px;
    }
    
    // 每页条数选择器
    .el-pagination__sizes {
      .el-select {
        width: 100px;
        
        .el-input {
          .el-input__wrapper {
            background-color: var(--bg-tertiary) !important;
            box-shadow: 0 0 0 1px var(--border) inset !important;
            
            &:hover {
              box-shadow: 0 0 0 1px var(--el-color-primary) inset !important;
            }
          }
          
          .el-input__inner {
            color: var(--text-primary) !important;
            background-color: transparent !important;
            font-size: 13px;
          }
          
          .el-input__suffix {
            .el-icon {
              color: var(--text-secondary) !important;
            }
          }
        }
      }
    }
    
    // 上一页/下一页按钮
    .btn-prev,
    .btn-next {
      background: var(--bg-primary) !important;
      color: var(--text-primary) !important;
      border: 1px solid var(--border) !important;
      min-width: 28px;
      height: 28px;
      
      &:hover:not(:disabled) {
        color: var(--el-color-primary) !important;
        border-color: var(--el-color-primary) !important;
      }
      
      &:disabled {
        color: var(--text-tertiary) !important;
        opacity: 0.5;
      }
    }
    
    // 页码
    .el-pager {
      li {
        background: var(--bg-primary) !important;
        color: var(--text-primary) !important;
        border: 1px solid var(--border) !important;
        min-width: 28px;
        height: 28px;
        line-height: 26px;
        font-size: 13px;
        margin: 0 2px;
        
        &:hover {
          color: var(--el-color-primary) !important;
          border-color: var(--el-color-primary) !important;
        }
        
        &.is-active {
          background: var(--el-color-primary) !important;
          color: #fff !important;
          border-color: var(--el-color-primary) !important;
        }
        
        // 省略号
        &.more {
          background: transparent !important;
          border: none !important;
          color: var(--text-secondary) !important;
        }
      }
    }
  }
}

.loading-container {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  padding: $spacing-md;
}

.repo-skeleton {
  padding: $spacing-md;
  background: var(--bg-secondary);
  border-radius: $radius-md;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);

  .empty-icon {
    margin-bottom: $spacing-md;
    opacity: 0.5;
  }

  p {
    font-size: 0.9rem;
  }
}

.repo-items {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: $spacing-sm;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (min-width: 1200px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  @media (min-width: 1600px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .repo-list.is-detail-open & {
    grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
  }
}

:deep(.el-dropdown-menu__item) {
  display: flex;
  align-items: center;
  gap: 8px;
  
  &.is-active {
    color: var(--el-color-primary);
    font-weight: 500;
  }
  
  .check-icon {
    margin-left: auto;
    color: var(--el-color-primary);
  }
}
</style>


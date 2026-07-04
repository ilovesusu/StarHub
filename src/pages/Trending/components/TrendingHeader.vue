<template>
  <div class="trending-header">
    <div class="header-top-row">
      <div class="title-group">
        <el-icon class="title-icon"><TrendCharts /></el-icon>
        <h2>{{ t('trending.trendingTab') }}</h2>
        <span class="update-time">{{ t('repo.updated') }} {{ formatTime }}</span>
      </div>
      <el-button
        circle
        :loading="loading"
        @click="emit('refresh')"
        class="refresh-btn"
      >
        <el-icon><Refresh /></el-icon>
      </el-button>
    </div>

    <div class="filter-row">
      <div class="filters-left">
        <!-- 时间维度 -->
        <div class="filter-item">
          <el-select
            :model-value="timeRange"
            @update:model-value="emit('update:timeRange', $event)"
            class="custom-select"
            placeholder="时间范围"
          >
            <template #prefix>
              <el-icon><Calendar /></el-icon>
            </template>
            <el-option value="today" :label="t('trending.today')" />
            <el-option value="weekly" :label="t('trending.weekly')" />
            <el-option value="monthly" :label="t('trending.monthly')" />
          </el-select>
        </div>

        <!-- 平台选择 -->
        <div class="filter-item">
          <el-select
            :model-value="platform"
            @update:model-value="emit('update:platform', $event)"
            class="custom-select"
            placeholder="平台"
          >
            <template #prefix>
              <el-icon><Filter /></el-icon>
            </template>
            <el-option value="all" :label="t('trending.allPlatforms')" />
            <el-option value="macos" label="macOS" />
            <el-option value="windows" label="Windows" />
            <el-option value="linux" label="Linux" />
            <el-option value="browser" label="浏览器" />
          </el-select>
        </div>

        <!-- 语言选择 -->
        <div class="filter-item">
          <el-select
            :model-value="language"
            @update:model-value="emit('update:language', $event)"
            class="custom-select"
            placeholder="语言"
            filterable
          >
            <template #prefix>
              <el-icon><Cpu /></el-icon>
            </template>
            <el-option value="all" label="全部语言" />
            <el-option v-for="lang in languages" :key="lang" :value="lang.toLowerCase()" :label="lang" />
          </el-select>
        </div>

        <!-- AI批量分析 -->
        <el-button
          type="primary"
          :loading="aiLoading"
          @click="emit('ai-analyze')"
          class="ai-btn"
          round
        >
          <template #icon>
            <el-icon><MagicStick /></el-icon>
          </template>
          {{ t('trending.aiAnalysis') }}
        </el-button>
      </div>

      <div class="filters-right">
        <span class="total-text">{{ t('trending.totalItems', { count: total }) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  TrendCharts,
  Refresh,
  Calendar,
  Filter,
  Cpu,
  MagicStick
} from '@element-plus/icons-vue'

const { t } = useI18n()

const props = defineProps<{
  timeRange: string
  platform: string
  language: string
  total: number
  loading: boolean
  aiLoading: boolean
  lastUpdated: Date | null
}>()

const emit = defineEmits<{
  (e: 'update:timeRange', val: string): void
  (e: 'update:platform', val: string): void
  (e: 'update:language', val: string): void
  (e: 'refresh'): void
  (e: 'ai-analyze'): void
}>()

const languages = [
  'JavaScript',
  'TypeScript',
  'Python',
  'Go',
  'Rust',
  'C++',
  'Java',
  'Swift',
  'Kotlin',
  'PHP',
  'HTML',
  'CSS'
]

const formatTime = computed(() => {
  if (!props.lastUpdated) return '刚刚'
  const diffMs = new Date().getTime() - props.lastUpdated.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  return props.lastUpdated.toLocaleTimeString()
})
</script>

<style lang="scss" scoped>
.trending-header {
  padding: $spacing-lg $spacing-xl;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  box-shadow: $shadow-sm;
  
  [data-theme='dark'] & {
    background: rgba(28, 35, 51, 0.95);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
}

.header-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-md;

  .title-group {
    display: flex;
    align-items: center;
    gap: $spacing-sm;

    .title-icon {
      font-size: 1.5rem;
      color: var(--el-color-primary);
    }

    h2 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-primary);
    }

    .update-time {
      font-size: 0.8125rem;
      color: var(--text-tertiary);
      margin-left: 8px;
    }
  }

  .refresh-btn {
    border-color: var(--border) !important;
    background: var(--bg-primary) !important;
    color: var(--text-secondary) !important;

    &:hover {
      color: var(--el-color-primary) !important;
      border-color: var(--el-color-primary) !important;
      background: rgba(64, 158, 255, 0.05) !important;
    }
  }
}

.filter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: $spacing-md;

  .filters-left {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    flex-wrap: wrap;
  }

  .filters-right {
    .total-text {
      font-size: 0.875rem;
      color: var(--text-secondary);
      font-weight: 500;
    }
  }
}

.custom-select {
  width: 140px;
  
  :deep(.el-input__wrapper) {
    background-color: var(--bg-primary) !important;
    border-color: var(--border) !important;
    box-shadow: 0 0 0 1px var(--border) inset !important;
    border-radius: 20px;
    
    &:hover {
      box-shadow: 0 0 0 1px var(--el-color-primary) inset !important;
    }
    
    &.is-focus {
      box-shadow: 0 0 0 1px var(--el-color-primary) inset !important;
    }
  }
  
  :deep(.el-input__inner) {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary) !important;
  }

  :deep(.el-input__prefix) {
    color: var(--text-tertiary) !important;
  }
}

.ai-btn {
  background: var(--el-color-primary) !important;
  border-color: var(--el-color-primary) !important;
  color: #fff !important;
  font-weight: 600;
  font-size: 0.875rem;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.25);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;

  &:hover {
    background: var(--el-color-primary-light-3) !important;
    border-color: var(--el-color-primary-light-3) !important;
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
}
</style>

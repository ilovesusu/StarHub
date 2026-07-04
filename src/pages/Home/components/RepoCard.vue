<template>
  <div class="repo-card" :class="{ 'is-active': isActive, 'is-selected': selected, 'select-mode': selectMode }" @click="$emit('click')">
    <div class="repo-header">
      <el-checkbox
        v-if="selectMode"
        :model-value="selected"
        @update:model-value="$emit('select', $event)"
        @click.stop
        class="repo-checkbox"
        style="flex-shrink: 0;"
      />
      <div class="repo-title" @click.stop>
        <a :href="repo.html_url" target="_blank" class="repo-link">
          <span class="repo-owner">{{ repo.owner.login }}</span> /
          <span class="repo-name">{{ repo.name }}</span>
        </a>
      </div>
      <span
        @click.stop="toggleTagEdit"
        class="repo-tag-toggle-btn"
        :title="editMode ? t('common.close') : t('repo.addTag')"
      >
        <el-icon><Collection /></el-icon>
      </span>
    </div>

    <!-- AI 一句话摘要 -->
    <div v-if="repo.ai_summary" class="repo-ai-summary">
      <span class="ai-badge">
        <span class="ai-sparkle">🪄</span> AI 摘要
      </span>
      <p class="summary-text">{{ repo.ai_summary }}</p>
    </div>
    <p v-else-if="repo.description" class="repo-description">
      {{ repo.description }}
    </p>

    <!-- AI 细粒度标签 -->
    <div v-if="repo.ai_tags && repo.ai_tags.length > 0" class="repo-ai-tags">
      <span v-for="tag in repo.ai_tags" :key="tag" class="ai-tag-item">
        #{{ tag }}
      </span>
    </div>

    <RepoCardTags
      v-if="repo.id"
      :repoId="repo.id"
      :editMode="editMode"
      @update:editMode="editMode = $event"
    />

    <div class="repo-footer">
      <div class="repo-meta">
        <span
          v-if="repo.language"
          class="repo-language"
        >
          <span
            class="language-dot"
            :style="{ backgroundColor: getLanguageColor(repo.language) }"
          ></span>
          {{ repo.language }}
        </span>
        <span class="repo-updated">
          {{ t('repo.updated') }} {{ formatDate(repo.updated_at, locale) }}
        </span>
      </div>
      <div class="repo-stats">
        <span class="repo-stat-item">
          <el-icon class="stat-icon"><Star /></el-icon>
          {{ formatNumber(repo.stargazers_count) }}
        </span>
        <span class="repo-stat-item">
          <el-icon class="stat-icon"><ForkSpoon /></el-icon>
          {{ formatNumber(repo.forks_count) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { getLanguageColor } from '@/utils/languageColors'
import { formatNumber, formatDate } from '@/utils'
import type { Repository } from '@/types'
import { Star, Collection, ForkSpoon } from '@element-plus/icons-vue'
import RepoCardTags from './RepoCardTags.vue'

const { t, locale } = useI18n()

const props = defineProps<{
  repo: Repository
  isActive?: boolean
  selected?: boolean
  selectMode?: boolean
}>()

const emit = defineEmits<{
  click: []
  select: [selected: boolean]
}>()

const editMode = ref(false)

const toggleTagEdit = () => {
  editMode.value = !editMode.value
}

// Reset edit mode when repo changes
watch(() => props.repo.id, () => {
  editMode.value = false
})
</script>

<style lang="scss" scoped>
.repo-card {
  position: relative;
  padding: $spacing-md;
  background: var(--bg-secondary);
  border-radius: $radius-md;
  cursor: pointer;
  transition: all $transition-base;
  border: 1px solid transparent;
  border-left: 2px solid transparent;

  &:hover {
    background: var(--bg-tertiary);
    border-color: var(--border);
    
    .repo-tag-toggle-btn {
      display: block;
    }
  }

  &.is-active {
    background: var(--bg-tertiary);
    border-left-color: var(--el-color-primary);
    
    .repo-tag-toggle-btn {
      display: block;
    }
  }
}

.repo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $spacing-sm;
  position: relative;
  
  .repo-checkbox {
    margin-right: $spacing-sm;
  }
}

.repo-card.select-mode {
  cursor: default;
  
  &:hover {
    background: var(--bg-tertiary);
    border-color: var(--border);
  }
  
  &.is-selected {
    background: var(--bg-tertiary);
    border-color: var(--el-color-primary);
    border-left-color: var(--el-color-primary);
    border-left-width: 3px;
  }
}

.repo-title {
  flex: 1;
  min-width: 0;

    .repo-link {
      text-decoration: none;
      color: var(--text-primary);
      font-weight: 600;
      font-size: 0.875rem;
    
    &:hover {
      color: var(--el-color-primary);
      text-decoration: underline;
    }
    
    .repo-owner {
      color: var(--text-secondary);
    }
    
    .repo-name {
      color: var(--text-primary);
    }
  }
}

.repo-tag-toggle-btn {
  position: absolute;
  right: 0;
  top: 0;
  display: none;
  padding: 4px 8px;
  font-size: 16px;
  user-select: none;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: color $transition-base;
  
  :deep(.el-icon) {
    color: var(--text-tertiary);
    transition: color $transition-base;
  }
  
  &:hover {
    :deep(.el-icon) {
      color: var(--el-color-primary);
    }
  }
}

.repo-description {
  color: var(--text-secondary);
  font-size: 0.875rem;
  line-height: 1.5;
  margin-bottom: $spacing-sm;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.repo-ai-summary {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: $spacing-sm;
  padding: 8px 10px;
  background: rgba(64, 158, 255, 0.05);
  border-radius: $radius-sm;
  border-left: 2px solid var(--el-color-primary);

  [data-theme='dark'] & {
    background: rgba(64, 158, 255, 0.1);
  }

  .ai-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--el-color-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    
    .ai-sparkle {
      font-size: 0.75rem;
    }
  }

  .summary-text {
    color: var(--text-primary);
    font-size: 0.8125rem;
    line-height: 1.5;
    margin: 0;
  }
}

.repo-ai-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
  margin-bottom: 8px;
  
  .ai-tag-item {
    font-size: 0.7rem;
    color: var(--el-color-primary);
    opacity: 0.8;
    background: rgba(64, 158, 255, 0.08);
    padding: 1px 6px;
    border-radius: 4px;
    transition: all $transition-base;
    cursor: default;
    
    &:hover {
      opacity: 1;
      background: rgba(64, 158, 255, 0.15);
    }
  }
}

.repo-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: $spacing-sm;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
}

.repo-meta {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.repo-language {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
}

.language-dot {
  width: 10px;
  height: 10px;
  border-radius: $radius-round;
}

.repo-stats {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.repo-stat-item {
  display: flex;
  align-items: center;
  gap: $spacing-xs;
  
  .stat-icon {
    color: #fbbf24;
    font-size: 14px;
  }
}
</style>


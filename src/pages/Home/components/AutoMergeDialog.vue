<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="t('tag.autoMergeTitle')"
    width="760px"
    class="auto-merge-dialog"
    destroy-on-close
  >
    <div v-if="suggestions.length === 0" class="empty-suggestions">
      <div class="empty-icon">🎉</div>
      <div class="empty-title">{{ t('tag.autoMergeNoSuggestionsTitle') }}</div>
      <div class="empty-desc">{{ t('tag.autoMergeNoSuggestionsDesc') }}</div>
    </div>

    <div v-else class="merge-content">
      <el-alert
        :title="t('tag.autoMergeBannerTitle', { count: suggestions.length })"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px;"
      >
        {{ t('tag.autoMergeBannerDesc') }}
      </el-alert>

      <el-table
        :data="suggestions"
        style="width: 100%"
        max-height="400"
        class="suggestions-table"
      >
        <el-table-column width="50" align="center">
          <template #header>
            <el-checkbox
              :model-value="isAllSelected"
              :indeterminate="isIndeterminate"
              @change="toggleSelectAll"
            />
          </template>
          <template #default="scope">
            <el-checkbox v-model="scope.row.selected" />
          </template>
        </el-table-column>

        <el-table-column :label="t('tag.mergeSource')" min-width="170">
          <template #default="scope">
            <div class="tag-cell">
              <span v-if="scope.row.sourceTagEmoji" class="tag-emoji">{{ scope.row.sourceTagEmoji }}</span>
              <span class="tag-name">{{ scope.row.sourceTagName }}</span>
              <el-tag size="small" type="info" class="repo-badge">
                {{ scope.row.sourceRepoCount }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column width="40" align="center">
          <template #default>
            <span style="color: var(--text-tertiary); font-weight: bold;">➡️</span>
          </template>
        </el-table-column>

        <el-table-column :label="t('tag.mergeTarget')" min-width="210">
          <template #default="scope">
            <el-select
              v-model="scope.row.targetTagId"
              size="small"
              filterable
              style="width: 100%;"
              @change="(val: string) => handleTargetChange(scope.row, val)"
            >
              <el-option
                v-for="target in getAvailableTargets(scope.row.sourceTagId)"
                :key="target.id"
                :label="`${target.emoji ? target.emoji + ' ' : ''}${target.name} (${target.repos?.length || 0})`"
                :value="target.id"
              />
            </el-select>
          </template>
        </el-table-column>

        <el-table-column :label="t('tag.autoMergeReason')" min-width="160">
          <template #default="scope">
            <span class="reason-text">{{ scope.row.reason }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="dialog-action-bar">
        <el-checkbox v-model="deleteSource">
          {{ t('tag.mergeDeleteSource') }}
        </el-checkbox>
        <span class="selected-hint">
          {{ t('tag.autoMergeSelectedCount', { count: selectedCount }) }}
        </span>
      </div>
    </div>

    <template #footer>
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <el-button
          v-if="suggestions.length > 0"
          text
          size="small"
          @click="toggleSelectAll"
        >
          {{ isAllSelected ? t('common.deselectAll') : t('common.selectAll') }}
        </el-button>
        <div v-else></div>

        <div>
          <el-button @click="$emit('update:modelValue', false)">
            {{ t('common.cancel') }}
          </el-button>
          <el-button
            v-if="suggestions.length > 0"
            type="primary"
            :loading="merging"
            :disabled="selectedCount === 0"
            @click="handleExecuteMerge"
          >
            {{ t('tag.autoMergeConfirmBtn', { count: selectedCount }) }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Tag } from '@/types'
import { useTagStore } from '@/stores/tag'
import { useRepoStore } from '@/stores/repo'
import { generateMergeSuggestions, type MergeSuggestion } from '@/utils/categoryMerge'

const props = defineProps<{
  modelValue: boolean
  tags: Tag[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'merged'): void
}>()

const { t } = useI18n()
const tagStore = useTagStore()
const repoStore = useRepoStore()

const suggestions = ref<MergeSuggestion[]>([])
const deleteSource = ref(true)
const merging = ref(false)

const loadSuggestions = () => {
  suggestions.value = generateMergeSuggestions(props.tags)
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      loadSuggestions()
    }
  },
  { immediate: true }
)

const selectedCount = computed(() => {
  return suggestions.value.filter(s => s.selected).length
})

const isAllSelected = computed(() => {
  return suggestions.value.length > 0 && selectedCount.value === suggestions.value.length
})

const isIndeterminate = computed(() => {
  return selectedCount.value > 0 && selectedCount.value < suggestions.value.length
})

const toggleSelectAll = () => {
  const target = !isAllSelected.value
  suggestions.value.forEach(s => {
    s.selected = target
  })
}

const getAvailableTargets = (sourceTagId: string) => {
  return props.tags.filter(t => t.id !== sourceTagId)
}

const handleTargetChange = (row: MergeSuggestion, newTargetId: string) => {
  const targetTag = props.tags.find(t => t.id === newTargetId)
  if (targetTag) {
    row.targetTagId = targetTag.id
    row.targetTagName = targetTag.name
    row.targetTagEmoji = targetTag.emoji
    row.targetTagColor = targetTag.color
    row.targetRepoCount = targetTag.repos?.length || 0
  }
}

const handleExecuteMerge = async () => {
  const selectedItems = suggestions.value.filter(s => s.selected)
  if (selectedItems.length === 0) return

  try {
    await ElMessageBox.confirm(
      t('tag.autoMergeBatchConfirmMessage', { count: selectedItems.length }),
      t('tag.autoMergeTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )

    merging.value = true
    const mergesToPerform = selectedItems.map(item => ({
      sourceTagId: item.sourceTagId,
      targetTagId: item.targetTagId,
      deleteSource: deleteSource.value
    }))

    const result = await tagStore.batchMergeTags(mergesToPerform)
    await repoStore.loadRepos()

    ElMessage.success(
      t('tag.autoMergeSuccessMessage', {
        categories: result.mergedCount,
        repos: result.affectedReposCount
      })
    )

    emit('update:modelValue', false)
    emit('merged')
  } catch (e: any) {
    if (e !== 'cancel') {
      ElMessage.error(`合并失败: ${e.message || '未知错误'}`)
    }
  } finally {
    merging.value = false
  }
}
</script>

<style scoped lang="scss">
.empty-suggestions {
  text-align: center;
  padding: 40px 20px;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

  .empty-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
  }

  .empty-desc {
    font-size: 13px;
    color: var(--text-tertiary);
  }
}

.merge-content {
  .tag-cell {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;

    .tag-emoji {
      font-size: 14px;
      flex-shrink: 0;
    }

    .tag-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .repo-badge {
      margin-left: auto;
      font-size: 11px;
      height: 20px;
      line-height: 18px;
      padding: 0 6px;
    }
  }

  .reason-text {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .dialog-action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 14px;
    padding: 0 4px;

    .selected-hint {
      font-size: 12px;
      color: var(--text-tertiary);
    }
  }
}
</style>

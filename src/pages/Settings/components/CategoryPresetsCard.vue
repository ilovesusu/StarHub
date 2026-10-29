<template>
  <el-card class="settings-card">
    <template #header>
      <div class="card-header">
        <span>{{ t('settings.presetCategories') }}</span>
        <div style="display: flex; gap: 8px;">
          <el-button text @click="handleSyncToTags">{{ t('settings.syncToTags') }}</el-button>
          <el-button text @click="handleResetPresets">{{ t('settings.resetToDefault') }}</el-button>
        </div>
      </div>
    </template>

    <div class="presets-section">
      <el-button type="primary" @click="openAddPresetDialog" style="margin-bottom: 16px;">
        <el-icon><Plus /></el-icon>
        {{ t('settings.addPresetCategory') }}
      </el-button>

      <el-table :data="categoryPresets" style="width: 100%" class="presets-table">
        <el-table-column :label="t('settings.categoryName')" width="200">
          <template #default="scope">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span v-if="scope.row.emoji" style="font-size: 1.2rem;">{{ scope.row.emoji }}</span>
              <div>
                <div>{{ scope.row.name }}</div>
                <div v-if="scope.row.nameEn" style="font-size: 0.75rem; color: var(--text-tertiary);">{{ scope.row.nameEn }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('settings.description')" min-width="200">
          <template #default="scope">
            <div>
              <div>{{ scope.row.description }}</div>
              <div v-if="scope.row.descriptionEn" style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 4px;">{{ scope.row.descriptionEn }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="color" :label="t('settings.color')" width="100">
          <template #default="scope">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div :style="{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: scope.row.color }"></div>
              <span>{{ scope.row.color }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('common.actions')" width="150">
          <template #default="scope">
            <el-button text size="small" @click="handleEditPreset(scope.row)">{{ t('common.edit') }}</el-button>
            <el-button text size="small" type="danger" @click="handleDeletePreset(scope.row.name)">{{ t('common.delete') }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 添加/编辑预设分类对话框 -->
    <el-dialog
      v-model="showAddPresetDialog"
      :title="editingPreset ? t('settings.editPresetCategory') : t('settings.addPresetCategory')"
      width="500px"
    >
      <el-form :model="newPreset" label-width="100px">
        <el-form-item :label="t('tag.emoji')">
          <el-input 
            v-model="newPreset.emoji" 
            :placeholder="t('tag.emojiPlaceholder')"
            maxlength="2"
            style="width: 120px;"
          />
          <div class="form-tip">{{ t('tag.emojiTip') }}</div>
        </el-form-item>
        <el-form-item :label="t('settings.categoryName') + ' (中文)'">
          <el-input v-model="newPreset.name" :placeholder="t('settings.categoryNamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('settings.categoryName') + ' (English)'">
          <el-input v-model="newPreset.nameEn" :placeholder="t('settings.categoryNameEnPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('settings.description') + ' (中文)'">
          <el-input v-model="newPreset.description" :placeholder="t('settings.descriptionPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('settings.description') + ' (English)'">
          <el-input v-model="newPreset.descriptionEn" :placeholder="t('settings.descriptionEnPlaceholder')" />
        </el-form-item>
        <el-form-item :label="t('settings.color')">
          <el-color-picker v-model="newPreset.color" />
        </el-form-item>
        <el-form-item :label="t('settings.keywords')">
          <el-input
            v-model="newPreset.keywordsStr"
            type="textarea"
            :rows="3"
            :placeholder="t('settings.keywordsPlaceholder')"
          />
          <div class="form-tip">{{ t('settings.keywordsTip') }}</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddPresetDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleSavePreset">{{ t('common.save') }}</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import {
  getCategoryPresets,
  saveCategoryPresets,
  resetCategoryPresets,
  type CategoryPreset
} from '@/config/categories'
import { useTagStore } from '@/stores/tag'

const { t } = useI18n()
const tagStore = useTagStore()

const categoryPresets = ref<CategoryPreset[]>([])
const showAddPresetDialog = ref(false)
const editingPreset = ref<string | null>(null)
const newPreset = ref({
  name: '',
  nameEn: '',
  emoji: '',
  description: '',
  descriptionEn: '',
  color: '#409EFF',
  keywordsStr: ''
})

onMounted(() => {
  categoryPresets.value = getCategoryPresets()
})

const handleResetPresets = async () => {
  try {
    await ElMessageBox.confirm(
      t('settings.resetPresetsConfirm'),
      t('settings.resetPresetsTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    resetCategoryPresets()
    categoryPresets.value = getCategoryPresets()
    ElMessage.success(t('settings.resetPresetsSuccess'))
  } catch {
    // 用户取消
  }
}

const handleSyncToTags = async () => {
  try {
    const presets = categoryPresets.value
    let createdCount = 0
    let updatedCount = 0

    await tagStore.loadTags()
    const existingTags = tagStore.tags

    for (const preset of presets) {
      const existing = existingTags.find(t => t.name === preset.name)
      if (existing) {
        if (existing.color !== preset.color || existing.emoji !== preset.emoji) {
          await tagStore.updateTag(existing.id, {
            color: preset.color,
            emoji: preset.emoji
          })
          updatedCount++
        }
      } else {
        await tagStore.createTag(preset.name, preset.color, preset.emoji)
        createdCount++
      }
    }

    ElMessage.success(t('settings.syncToTagsSuccess', { created: createdCount, updated: updatedCount }))
  } catch (error) {
    ElMessage.error(t('settings.syncToTagsFailed'))
  }
}

const openAddPresetDialog = () => {
  editingPreset.value = null
  newPreset.value = {
    name: '',
    nameEn: '',
    emoji: '',
    description: '',
    descriptionEn: '',
    color: '#409EFF',
    keywordsStr: ''
  }
  showAddPresetDialog.value = true
}

const handleEditPreset = (preset: CategoryPreset) => {
  editingPreset.value = preset.name
  newPreset.value = {
    name: preset.name,
    nameEn: preset.nameEn || '',
    emoji: preset.emoji || '',
    description: preset.description,
    descriptionEn: preset.descriptionEn || '',
    color: preset.color,
    keywordsStr: preset.keywords.join(', ')
  }
  showAddPresetDialog.value = true
}

const handleDeletePreset = async (name: string) => {
  try {
    const existingTag = tagStore.tags.find(t => t.name === name)
    const hasRepos = existingTag && existingTag.repos && existingTag.repos.length > 0
    
    let confirmMessage = ''
    if (hasRepos) {
      confirmMessage = t('settings.deletePresetConfirmWithRepos', { name, count: existingTag.repos.length })
    } else if (existingTag) {
      confirmMessage = t('settings.deletePresetConfirmWithTag', { name })
    } else {
      confirmMessage = t('settings.deletePresetConfirm', { name })
    }
    
    await ElMessageBox.confirm(
      confirmMessage,
      t('settings.deletePresetTitle'),
      {
        confirmButtonText: t('settings.deletePresetButton'),
        cancelButtonText: t('common.cancel'),
        type: 'warning'
      }
    )
    
    const presets = categoryPresets.value.filter(p => p.name !== name)
    saveCategoryPresets(presets)
    categoryPresets.value = presets
    
    if (existingTag && !hasRepos) {
      await tagStore.deleteTag(existingTag.id)
    }
    
    ElMessage.success(t('settings.deletePresetSuccess'))
  } catch {
    // 用户取消
  }
}

const handleSavePreset = async () => {
  if (!newPreset.value.name.trim()) {
    ElMessage.warning(t('settings.categoryNameRequired'))
    return
  }

  const preset: CategoryPreset = {
    name: newPreset.value.name.trim(),
    nameEn: newPreset.value.nameEn.trim() || newPreset.value.name.trim(),
    emoji: newPreset.value.emoji.trim() || '',
    description: newPreset.value.description.trim(),
    descriptionEn: newPreset.value.descriptionEn.trim() || newPreset.value.description.trim(),
    color: newPreset.value.color,
    keywords: newPreset.value.keywordsStr
      .split(',')
      .map(k => k.trim())
      .filter(k => k)
  }

  let presets = categoryPresets.value
  const isEditing = !!editingPreset.value

  if (isEditing) {
    const index = presets.findIndex(p => p.name === editingPreset.value)
    if (index !== -1) {
      presets[index] = preset
      
      await tagStore.loadTags()
      const existingTag = tagStore.tags.find(t => t.name === editingPreset.value)
      if (existingTag) {
        await tagStore.updateTag(existingTag.id, {
          name: preset.name,
          color: preset.color,
          emoji: preset.emoji
        })
      }
    }
  } else {
    if (presets.some(p => p.name === preset.name)) {
      ElMessage.warning(t('settings.categoryNameExists'))
      return
    }
    presets.push(preset)
    
    await tagStore.loadTags()
    const existingTag = tagStore.tags.find(t => t.name === preset.name)
    if (!existingTag) {
      await tagStore.createTag(preset.name, preset.color, preset.emoji)
    }
  }

  saveCategoryPresets(presets)
  categoryPresets.value = [...presets]
  showAddPresetDialog.value = false
  editingPreset.value = null
  newPreset.value = {
    name: '',
    nameEn: '',
    emoji: '',
    description: '',
    descriptionEn: '',
    color: '#409EFF',
    keywordsStr: ''
  }
  ElMessage.success(isEditing ? '更新成功' : '添加成功')
}
</script>

<style scoped lang="scss">
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.presets-section {
  .presets-table {
    margin-top: 10px;
  }
}

.form-tip {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 5px;
}
</style>

<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="title"
    width="680px"
  >
    <el-table :data="backups" style="width: 100%" v-loading="loading">
      <el-table-column :label="t('settings.selectBackup')" min-width="240">
        <template #default="scope">
          <span>{{ scope.row.name }}</span>
        </template>
      </el-table-column>
      <el-table-column v-if="hasSize" :label="t('settings.s3FileSize')" width="110">
        <template #default="scope">
          <el-tag v-if="scope.row.formattedSize" size="small" type="info">
            {{ scope.row.formattedSize }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('tag.created')" width="180">
        <template #default="scope">
          <span>{{ scope.row.date || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="t('common.actions')" width="90" fixed="right">
        <template #default="scope">
          <el-button text size="small" type="primary" @click="handleRestore(scope.row.name)">
            恢复
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div v-if="backups.length === 0 && !loading" style="text-align: center; padding: 30px; color: var(--text-tertiary);">
      {{ emptyText || t('settings.webdavNoBackup') }}
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessageBox } from 'element-plus'

interface BackupItem {
  name: string
  date?: string
  formattedSize?: string
  [key: string]: any
}

const props = defineProps<{
  modelValue: boolean
  title: string
  loading: boolean
  backups: BackupItem[]
  confirmMessage: string
  emptyText?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void
  (e: 'restore', filename: string): void
}>()

const { t } = useI18n()

const hasSize = computed(() => {
  return props.backups.some(item => !!item.formattedSize)
})

const handleRestore = async (filename: string) => {
  try {
    await ElMessageBox.confirm(
      props.confirmMessage,
      t('settings.importData'),
      {
        confirmButtonText: '确认恢复',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'el-button--danger'
      }
    )

    emit('update:modelValue', false)
    emit('restore', filename)
  } catch {
    // 用户取消操作
  }
}
</script>

<template>
  <div class="discover-channels">
    <div class="channels-header">
      <el-icon class="title-icon"><Compass /></el-icon>
      <h3>{{ t('trending.channels') }}</h3>
    </div>
    <ul class="channel-list">
      <li
        v-for="channel in channels"
        :key="channel.id"
        :class="{ 'is-active': activeChannel === channel.id }"
        @click="selectChannel(channel.id)"
      >
        <el-icon class="channel-icon">
          <component :is="channel.icon" />
        </el-icon>
        <span class="channel-name">{{ t(`trending.${channel.langKey}`) }}</span>
        <el-icon v-if="activeChannel === channel.id" class="active-indicator">
          <ArrowRight />
        </el-icon>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Compass,
  TrendCharts,
  Calendar,
  Trophy,
  Collection,
  Search,
  ArrowRight
} from '@element-plus/icons-vue'

const { t } = useI18n()

defineProps<{
  activeChannel: string
}>()

const emit = defineEmits<{
  (e: 'update:activeChannel', channel: string): void
}>()

const channels = shallowRef([
  { id: 'trending', langKey: 'trendingTab', icon: TrendCharts },
  { id: 'new_releases', langKey: 'newReleases', icon: Calendar },
  { id: 'most_popular', langKey: 'mostPopular', icon: Trophy },
  { id: 'topics', langKey: 'topics', icon: Collection },
  { id: 'search', langKey: 'search', icon: Search }
])

const selectChannel = (channelId: string) => {
  emit('update:activeChannel', channelId)
}
</script>

<style lang="scss" scoped>
.discover-channels {
  padding: $spacing-md;
  
  .channels-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: $spacing-lg;
    padding-bottom: $spacing-sm;
    border-bottom: 1px solid var(--border);
    color: var(--text-primary);
    
    .title-icon {
      font-size: 1.2rem;
      color: var(--el-color-primary);
    }
    
    h3 {
      margin: 0;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: -0.2px;
    }
  }
}

.channel-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;

  li {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    padding: $spacing-md $spacing-lg;
    border-radius: $radius-md;
    color: var(--text-secondary);
    cursor: pointer;
    font-weight: 500;
    font-size: 0.9375rem;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    user-select: none;

    &:hover {
      color: var(--el-color-primary);
      background: rgba(64, 158, 255, 0.06);
      transform: translateX(4px);
    }

    &.is-active {
      color: var(--el-color-primary);
      background: rgba(64, 158, 255, 0.1);
      font-weight: 600;
      
      [data-theme='dark'] & {
        background: rgba(64, 158, 255, 0.15);
      }

      .channel-icon {
        color: var(--el-color-primary);
        transform: scale(1.1);
      }

      .active-indicator {
        opacity: 1;
        transform: translateX(0);
      }
    }

    .channel-icon {
      font-size: 1.1rem;
      color: var(--text-tertiary);
      transition: all 0.25s ease;
    }

    .channel-name {
      flex: 1;
    }

    .active-indicator {
      font-size: 0.875rem;
      opacity: 0;
      transform: translateX(-4px);
      transition: all 0.25s ease;
      color: var(--el-color-primary);
    }
  }
}
</style>

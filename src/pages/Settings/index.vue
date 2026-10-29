<template>
  <div class="settings-page">
    <!-- 顶部导航栏 -->
    <header class="settings-top-bar">
      <div class="bar-left">
        <el-button text class="back-home-btn" @click="handleBackHome">
          <el-icon><ArrowLeft /></el-icon>
          <span>{{ t('settings.backToHome') }}</span>
        </el-button>
        <div class="breadcrumb-separator">/</div>
        <div class="page-title">
          <h1>{{ t('menu.settings') }}</h1>
          <span class="active-tab-indicator">{{ currentTabTitle }}</span>
        </div>
      </div>

      <div class="bar-right">
        <!-- 主题切换 -->
        <el-button circle @click="toggleTheme" class="icon-action-btn">
          <el-icon><Moon v-if="theme === 'light'" /><Sunny v-else /></el-icon>
        </el-button>
      </div>
    </header>

    <!-- 设置主体容器：左侧导航分类 + 右侧内容面板 -->
    <div class="settings-container">
      <!-- 移动端水平标签栏 -->
      <div class="mobile-tabs-bar">
        <div
          v-for="item in navTabs"
          :key="item.key"
          class="mobile-tab-item"
          :class="{ active: currentTab === item.key }"
          @click="switchTab(item.key)"
        >
          <span class="tab-emoji">{{ item.emoji }}</span>
          <span>{{ item.label }}</span>
        </div>
      </div>

      <!-- 桌面端侧边导航栏 -->
      <aside class="settings-sidebar">
        <nav class="settings-nav-list">
          <div
            v-for="item in navTabs"
            :key="item.key"
            class="nav-tab-item"
            :class="{ active: currentTab === item.key }"
            @click="switchTab(item.key)"
          >
            <div class="tab-icon-wrapper">
              <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
              <span v-else class="tab-emoji">{{ item.emoji }}</span>
            </div>
            <div class="tab-text-info">
              <span class="tab-title">{{ item.label }}</span>
              <span class="tab-desc">{{ item.desc }}</span>
            </div>
            <div v-if="currentTab === item.key" class="tab-active-indicator"></div>
          </div>
        </nav>
      </aside>

      <!-- 右侧设置内容详情区域 -->
      <main class="settings-main-content">
        <div class="content-wrapper">
          <transition name="tab-fade" mode="out-in">
            <!-- 1. AI 模型配置 -->
            <div v-if="currentTab === 'ai'" key="tab-ai" class="tab-panel">
              <AIConfigCard />
            </div>

            <!-- 2. 分类与标签管理 -->
            <div v-else-if="currentTab === 'categories'" key="tab-categories" class="tab-panel">
              <CategoryPresetsCard />
            </div>

            <!-- 3. 云端备份与灾备恢复 -->
            <div v-else-if="currentTab === 'backup'" key="tab-backup" class="tab-panel">
              <S3BackupCard />
              <WebDAVBackupCard style="margin-top: 24px;" />
            </div>

            <!-- 4. 数据管理与同步 -->
            <div v-else-if="currentTab === 'data'" key="tab-data" class="tab-panel">
              <SyncSettingsCard />
              <DataManagementCard style="margin-top: 24px;" />
            </div>

            <!-- 5. 关于应用 -->
            <div v-else-if="currentTab === 'about'" key="tab-about" class="tab-panel">
              <AboutCard />
            </div>
          </transition>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useThemeStore } from '@/stores/theme'
import {
  ArrowLeft,
  Moon,
  Sunny,
  Cpu,
  PriceTag,
  Cloudy,
  Refresh,
  InfoFilled
} from '@element-plus/icons-vue'

import CategoryPresetsCard from './components/CategoryPresetsCard.vue'
import AIConfigCard from './components/AIConfigCard.vue'
import DataManagementCard from './components/DataManagementCard.vue'
import WebDAVBackupCard from './components/WebDAVBackupCard.vue'
import S3BackupCard from './components/S3BackupCard.vue'
import SyncSettingsCard from './components/SyncSettingsCard.vue'
import AboutCard from './components/AboutCard.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()

const theme = computed(() => themeStore.theme)
const currentTab = ref<string>('ai')

// 导航选项卡配置
const navTabs = computed(() => [
  {
    key: 'ai',
    label: t('settings.tabAI'),
    desc: '多模型 Profile、密钥与 API 设置',
    icon: Cpu,
    emoji: '🤖'
  },
  {
    key: 'categories',
    label: t('settings.tabCategories'),
    desc: '预设库、图标智能美化与自动归并',
    icon: PriceTag,
    emoji: '🏷️'
  },
  {
    key: 'backup',
    label: t('settings.tabBackup'),
    desc: 'Cloudflare R2 / S3 与 WebDAV',
    icon: Cloudy,
    emoji: '☁️'
  },
  {
    key: 'data',
    label: t('settings.tabData'),
    desc: 'GitHub 同步周期与本地数据备份',
    icon: Refresh,
    emoji: '🔄'
  },
  {
    key: 'about',
    label: t('settings.tabAbout'),
    desc: '版本特性、开源许可与主页',
    icon: InfoFilled,
    emoji: 'ℹ️'
  }
])

const currentTabTitle = computed(() => {
  const current = navTabs.value.find(item => item.key === currentTab.value)
  return current ? current.label : ''
})

// 监听路由 query 变动同步当前 Tab
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && typeof newTab === 'string' && navTabs.value.some(item => item.key === newTab)) {
      currentTab.value = newTab
    }
  },
  { immediate: true }
)

const switchTab = (key: string) => {
  currentTab.value = key
  router.replace({ query: { ...route.query, tab: key } })
}

const handleBackHome = () => {
  router.push('/home')
}

const toggleTheme = () => {
  themeStore.toggleTheme()
}
</script>

<style scoped lang="scss">
.settings-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;

  [data-theme='dark'] & {
    background-color: #151b26;
  }
}

.settings-top-bar {
  height: 60px;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  background-color: var(--bg-secondary);
  flex-shrink: 0;

  [data-theme='dark'] & {
    background-color: #1e2638;
    border-bottom-color: rgba(255, 255, 255, 0.08);
  }

  .bar-left {
    display: flex;
    align-items: center;
    gap: 12px;

    .back-home-btn {
      font-weight: 500;
      color: var(--text-secondary);
      padding: 6px 12px;
      border-radius: 8px;

      &:hover {
        color: var(--el-color-primary);
        background: rgba(64, 158, 255, 0.08);
      }
    }

    .breadcrumb-separator {
      color: var(--text-tertiary);
      font-size: 14px;
    }

    .page-title {
      display: flex;
      align-items: center;
      gap: 10px;

      h1 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .active-tab-indicator {
        font-size: 12px;
        padding: 2px 8px;
        border-radius: 12px;
        background: rgba(64, 158, 255, 0.1);
        color: var(--el-color-primary);
        font-weight: 500;
      }
    }
  }

  .bar-right {
    display: flex;
    align-items: center;
    gap: 8px;

    .icon-action-btn {
      border-color: var(--border);
      background: var(--bg-primary);

      &:hover {
        border-color: var(--el-color-primary);
        color: var(--el-color-primary);
      }
    }
  }
}

.settings-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;

  @media (max-width: 768px) {
    flex-direction: column;
  }
}

// 移动端水平滚动 Tabs
.mobile-tabs-bar {
  display: none;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  white-space: nowrap;
  gap: 8px;

  @media (max-width: 768px) {
    display: flex;
  }

  .mobile-tab-item {
    padding: 6px 14px;
    border-radius: 16px;
    font-size: 13px;
    color: var(--text-secondary);
    background: var(--bg-primary);
    border: 1px solid var(--border);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;

    &.active {
      background: var(--el-color-primary);
      color: #fff;
      border-color: var(--el-color-primary);
    }
  }
}

// 桌面端侧边导航
.settings-sidebar {
  width: 250px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  background: var(--bg-secondary);
  padding: 20px 14px;
  overflow-y: auto;

  [data-theme='dark'] & {
    background: #1e2638;
    border-right-color: rgba(255, 255, 255, 0.08);
  }

  @media (max-width: 768px) {
    display: none;
  }

  .settings-nav-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .nav-tab-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    user-select: none;

    &:hover {
      background: rgba(64, 158, 255, 0.08);

      .tab-title {
        color: var(--el-color-primary);
      }
    }

    &.active {
      background: var(--el-color-primary);

      .tab-icon-wrapper {
        color: #fff;
      }

      .tab-title {
        color: #fff;
        font-weight: 600;
      }

      .tab-desc {
        color: rgba(255, 255, 255, 0.8);
      }
    }

    .tab-icon-wrapper {
      font-size: 18px;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      flex-shrink: 0;

      .tab-emoji {
        font-size: 18px;
        line-height: 1;
      }
    }

    .tab-text-info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;

      .tab-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
        transition: color 0.2s;
      }

      .tab-desc {
        font-size: 11px;
        color: var(--text-tertiary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        transition: color 0.2s;
      }
    }
  }
}

// 主体展示区域
.settings-main-content {
  flex: 1;
  overflow-y: auto;
  padding: 28px 36px;

  @media (max-width: 768px) {
    padding: 16px;
  }

  .content-wrapper {
    max-width: 860px;
    margin: 0 auto;
  }
}

// 卡片深色模式与统一样式穿透
:deep(.settings-card) {
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
  background-color: var(--bg-primary) !important;
  border-color: var(--border) !important;

  [data-theme='dark'] & {
    background-color: #20293a !important;
    border-color: rgba(255, 255, 255, 0.08) !important;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  }

  .el-card__header {
    padding: 16px 20px;
    background-color: var(--bg-secondary) !important;
    border-bottom: 1px solid var(--border) !important;
    color: var(--text-primary) !important;

    [data-theme='dark'] & {
      background-color: #242e42 !important;
      border-bottom-color: rgba(255, 255, 255, 0.06) !important;
    }
  }

  .el-card__body {
    padding: 24px;
    background-color: var(--bg-primary) !important;
    color: var(--text-primary) !important;

    [data-theme='dark'] & {
      background-color: #20293a !important;
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    font-size: 15px;
    color: var(--text-primary) !important;
  }
}

:deep(.form-tip) {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 5px;
}

// Tab 切换渐变过渡动效
.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>

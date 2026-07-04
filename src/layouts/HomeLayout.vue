<template>
  <div class="home-layout">
    <div class="layout-header">
      <div class="header-left">
        <h1 class="app-title" @click="router.push('/home')">
          <div class="logo-wrapper">
            <img src="/logo.svg" alt="StarHub Logo" class="logo-img" />
          </div>
          <span class="app-name">StarHub</span>
        </h1>
        <div class="header-nav">
          <router-link to="/home" class="nav-item" active-class="is-active">
            {{ t('nav.home') }}
          </router-link>
          <router-link to="/trending" class="nav-item" active-class="is-active">
            {{ t('nav.trending') }}
          </router-link>
        </div>
      </div>
      <div class="header-right">
        <!-- 本地数据库大小 -->
        <el-tooltip v-if="route.path === '/home'" :content="t('home.dbSizeTooltip')" placement="bottom">
          <div class="db-size-indicator">
            <el-icon class="db-icon"><Coin /></el-icon>
            <span class="db-size-text">{{ dbSize }}</span>
          </div>
        </el-tooltip>

        <!-- 上次同步时间 -->
        <el-tooltip v-if="route.path === '/home'" :content="t('settings.lastSyncTime')" placement="bottom">
          <div class="last-sync-indicator">
            <el-icon class="sync-time-icon"><Clock /></el-icon>
            <span class="sync-time-text">{{ formattedLastSyncTime }}</span>
          </div>
        </el-tooltip>

        <template v-if="route.path === '/home'">
          <div v-if="syncing" class="sync-indicator">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>{{ t('home.syncing') }} ({{ syncProgress.count }} {{ t('home.repos') }})</span>
          </div>
          <el-tooltip v-else :content="t('settings.syncNow')" placement="bottom">
            <el-button
              circle
              @click="handleManualSync"
              class="sync-button"
            >
              <el-icon><Refresh /></el-icon>
            </el-button>
          </el-tooltip>
        </template>
        <el-input
          v-if="route.path === '/home'"
          v-model="searchQuery"
          :placeholder="t('home.searchPlaceholder')"
          clearable
          class="search-input"
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-dropdown @command="handleLanguageChange" trigger="click">
          <el-button circle>
            <el-icon><Promotion /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="zh" :class="{ 'is-selected': currentLanguage === 'zh' }">
                <span>中文</span>
                <el-icon v-if="currentLanguage === 'zh'" class="ml-2"><CircleCheck /></el-icon>
              </el-dropdown-item>
              <el-dropdown-item command="en" :class="{ 'is-selected': currentLanguage === 'en' }">
                <span>English</span>
                <el-icon v-if="currentLanguage === 'en'" class="ml-2"><CircleCheck /></el-icon>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button
          circle
          @click="toggleTheme"
          class="theme-button"
        >
          <el-icon><Moon v-if="theme === 'light'" /><Sunny v-else /></el-icon>
        </el-button>
        <el-dropdown @command="handleCommand">
          <div class="user-avatar">
            <el-avatar
              v-if="userStore.user?.avatar_url"
              :size="32"
              :src="userStore.user.avatar_url"
              :alt="userStore.user.login"
            />
            <el-avatar
              v-else
              :size="32"
              :icon="User"
            />
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="settings">
                <el-icon><Setting /></el-icon>
                {{ t('menu.settings') }}
              </el-dropdown-item>
              <el-dropdown-item divided command="clearAndReload">
                <el-icon><Refresh /></el-icon>
                {{ t('menu.clearAndReload') }}
              </el-dropdown-item>
              <el-dropdown-item divided command="logout">
                <el-icon><SwitchButton /></el-icon>
                {{ t('menu.logout') }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <div class="layout-body">
      <aside class="layout-sidebar" :style="{ width: sidebarWidth + 'px' }">
        <slot name="sidebar" />
      </aside>
      <div 
        class="resize-handle"
        @mousedown="startResize"
      ></div>
      <main class="layout-main">
        <slot name="main" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessageBox, ElMessage } from 'element-plus'
import { useThemeStore } from '@/stores/theme'
import { useUserStore } from '@/stores/user'
import { useRepoStore } from '@/stores/repo'
import { AuthToken } from '@/utils/auth'
import { githubApi } from '@/api/github'
import { debounce, formatDate } from '@/utils'
const { t, locale } = useI18n()
import {
  Search,
  Moon,
  Sunny,
  User,
  Setting,
  SwitchButton,
  Promotion,
  CircleCheck,
  Loading,
  Refresh,
  Coin,
  Clock
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()
const themeStore = useThemeStore()
const userStore = useUserStore()
const repoStore = useRepoStore()

const searchQuery = ref('')
const theme = computed(() => themeStore.theme)
const currentLanguage = computed(() => themeStore.language)
const syncing = computed(() => repoStore.isSyncing)
const syncProgress = computed(() => repoStore.syncProgress)
const lastSyncTime = computed(() => repoStore.lastSyncTime)

const formattedLastSyncTime = computed(() => {
  if (!lastSyncTime.value) {
    return t('settings.neverSynced')
  }
  return formatDate(lastSyncTime.value, locale.value)
})

const handleManualSync = async () => {
  try {
    ElMessage.info(t('settings.syncStarted'))
    await repoStore.loadRepos({ forceSync: true })
    ElMessage.success(t('settings.syncCompleted'))
  } catch (error) {
    ElMessage.error(t('settings.syncFailed'))
  }
}

// 数据库大小显示
const dbSize = ref('0 KB')

const updateDbSize = async () => {
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate()
      const usage = estimate.usage || 0
      if (usage < 1024) {
        dbSize.value = `${usage} B`
      } else if (usage < 1024 * 1024) {
        dbSize.value = `${(usage / 1024).toFixed(1)} KB`
      } else {
        dbSize.value = `${(usage / (1024 * 1024)).toFixed(1)} MB`
      }
    } else {
      dbSize.value = '未知'
    }
  } catch (e) {
    dbSize.value = '未知'
  }
}

watch(syncing, async (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {
    // 延迟 500ms 等待数据库事务彻底提交，以获得最新物理占用
    setTimeout(updateDbSize, 500)
  }
})

// 侧边栏宽度调整
const sidebarWidth = ref(320)
const isResizing = ref(false)

const startResize = (e: MouseEvent) => {
  isResizing.value = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

const handleResize = (e: MouseEvent) => {
  if (!isResizing.value) return
  const newWidth = e.clientX
  // 限制最小宽度 200px，最大宽度 600px
  if (newWidth >= 200 && newWidth <= 600) {
    sidebarWidth.value = newWidth
  }
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

const handleSearch = debounce((value: string) => {
  repoStore.setSearchQuery(value)
}, 300)

const toggleTheme = () => {
  themeStore.toggleTheme()
}

const handleLanguageChange = (lang: 'zh' | 'en') => {
  themeStore.setLanguage(lang)
  locale.value = lang
  // Element Plus locale will be updated via App.vue's el-config-provider
}

const handleCommand = async (command: string) => {
  switch (command) {
    case 'logout':
      AuthToken.clean()
      userStore.clearUser()
      router.push('/login')
      break
    case 'profile':
    case 'settings':
      router.push('/settings')
      break
    case 'clearAndReload':
      try {
        // Check if syncing
        const isSyncing = repoStore.isSyncing
        let confirmMessage = t('menu.clearAndReloadConfirm')
        
        if (isSyncing) {
          confirmMessage = '⚠️ 检测到正在进行同步操作。\n\n' + 
                          '此操作将先停止同步，然后清空所有已保存的仓库数据并重新从 GitHub 抓取。\n\n' +
                          '是否继续？'
        }
        
        await ElMessageBox.confirm(
          confirmMessage,
          t('menu.clearAndReloadTitle'),
          {
            confirmButtonText: t('common.confirm'),
            cancelButtonText: t('common.cancel'),
            type: 'warning',
            dangerouslyUseHTMLString: false
          }
        )
        
        // Show loading message
        const { ElMessage } = await import('element-plus')
        let loading = ElMessage({
          message: isSyncing ? '正在停止同步...' : t('menu.clearingData'),
          type: 'info',
          duration: 0,
          showClose: false
        })
        
        try {
          await repoStore.clearAndReload()
          loading.close()
          ElMessage.success(t('menu.clearAndReloadSuccess'))
          
          // Auto navigate to home after successful reload
          setTimeout(() => {
            // If already on home page, just reload
            if (router.currentRoute.value.path === '/') {
              window.location.reload()
            } else {
              // Navigate to home and reload
              router.push('/').then(() => {
                window.location.reload()
              })
            }
          }, 800)
        } catch (error: any) {
          loading.close()
          console.error('Failed to clear and reload:', error)
          
          // Show detailed error message
          await ElMessageBox.alert(
            error.message || t('menu.clearAndReloadFailed'),
            t('common.error'),
            {
              confirmButtonText: t('common.confirm'),
              type: 'error'
            }
          )
          
          // If database recreation failed, offer to reload page
          if (error.message && error.message.includes('Database recreation failed')) {
            await ElMessageBox.confirm(
              t('menu.needManualRefresh'),
              t('menu.clearAndReloadFailed'),
              {
                confirmButtonText: t('menu.refreshPage'),
                cancelButtonText: t('common.cancel'),
                type: 'warning'
              }
            ).then(() => {
              // Navigate to home and reload
              window.location.href = '/#/'
              setTimeout(() => {
                window.location.reload()
              }, 100)
            }).catch(() => {
              // User chose not to refresh
            })
          }
        }
      } catch (error) {
        // User cancelled
        if (error !== 'cancel') {
          console.error('Failed to clear and reload:', error)
        }
      }
      break
  }
}

// 页面加载时恢复用户信息
onMounted(async () => {
  // 加载本地数据库占用大小
  updateDbSize()

  // 如果有 token 但没有用户信息，尝试从 GitHub API 获取
  if (AuthToken.exist() && !userStore.user) {
    try {
      const user = await githubApi.getLoginUser()
      userStore.setUser(user.data)
    } catch (error) {
      console.error('Failed to restore user info:', error)
      // 如果获取失败，可能是 token 过期，清除 token
      AuthToken.clean()
      userStore.clearUser()
    }
  }
})
</script>


<style lang="scss" scoped>
.home-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-md $spacing-lg;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  box-shadow: $shadow-sm;
  
  // 暗黑模式下使用与登录页一致的样式
  [data-theme='dark'] & {
    background: rgba(28, 35, 51, 0.95);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 32px;

    .app-title {
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      cursor: pointer;
      transition: transform 0.2s ease;
      
      &:hover {
        transform: translateY(-1px);
      }
      
      .logo-wrapper {
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s ease;
        
        &:hover {
          transform: scale(1.05);
        }
      }
      
      .logo-img {
        width: 40px;
        height: 40px;
        display: block;
      }
      
      .app-name {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-primary);
        letter-spacing: -0.5px;
        line-height: 1.2;
        
        // 暗黑模式下使用白色，与登录页一致
        [data-theme='dark'] & {
          color: #fff;
        }
      }
    }

    .header-nav {
      display: flex;
      align-items: center;
      gap: 6px;
      background: var(--bg-primary);
      padding: 4px;
      border-radius: 20px;
      border: 1px solid var(--border);
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);

      [data-theme='dark'] & {
        background: rgba(15, 23, 42, 0.5);
        border-color: rgba(255, 255, 255, 0.08);
      }

      .nav-item {
        padding: 6px 18px;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--text-secondary);
        text-decoration: none;
        border-radius: 16px;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;

        &:hover {
          color: var(--el-color-primary);
          background: rgba(64, 158, 255, 0.08);
        }

        &.is-active {
          background: var(--el-color-primary);
          color: #ffffff !important;
          box-shadow: 0 2px 8px rgba(64, 158, 255, 0.35);
          
          [data-theme='dark'] & {
            box-shadow: 0 2px 12px rgba(64, 158, 255, 0.5);
          }
        }
      }
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: $spacing-md;

    .user-avatar {
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: transform $transition-base;
      
      &:hover {
        transform: scale(1.05);
      }
      
      :deep(.el-avatar) {
        border: 2px solid var(--border);
        transition: border-color $transition-base;
        
        &:hover {
          border-color: var(--el-color-primary);
        }
      }
    }

    .search-input {
      width: 300px;

      @media (max-width: 768px) {
        width: 200px;
      }
      
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
        background-color: var(--bg-primary) !important;
        color: var(--text-primary) !important;
        
        &::placeholder {
          color: var(--text-tertiary) !important;
        }
      }
      
      :deep(.el-input__prefix) {
        .el-icon {
          color: var(--text-tertiary) !important;
        }
      }
    }

    .db-size-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background-color: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 0.8125rem;
      color: var(--text-secondary);
      transition: all $transition-base;
      cursor: help;
      user-select: none;
      margin-right: $spacing-xs;

      &:hover {
        border-color: var(--el-color-primary);
        color: var(--el-color-primary);
        background-color: rgba(64, 158, 255, 0.05);

        .db-icon {
          color: var(--el-color-primary);
        }
      }

      .db-icon {
        font-size: 0.95rem;
        color: var(--text-tertiary);
        transition: color $transition-base;
      }

      .db-size-text {
        font-weight: 500;
      }
    }

    .last-sync-indicator {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      background-color: var(--bg-primary);
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 0.8125rem;
      color: var(--text-secondary);
      transition: all $transition-base;
      cursor: help;
      user-select: none;
      margin-right: $spacing-xs;

      &:hover {
        border-color: var(--el-color-primary);
        color: var(--el-color-primary);
        background-color: rgba(64, 158, 255, 0.05);

        .sync-time-icon {
          color: var(--el-color-primary);
        }
      }

      .sync-time-icon {
        font-size: 0.95rem;
        color: var(--text-tertiary);
        transition: color $transition-base;
      }

      .sync-time-text {
        font-weight: 500;
      }
    }

    .sync-indicator {
      display: flex;
      align-items: center;
      gap: $spacing-xs;
      font-size: 0.875rem;
      color: var(--text-primary);
      margin-right: $spacing-sm;
      
      .is-loading {
        animation: rotating 2s linear infinite;
        color: var(--el-color-primary);
      }
    }
    
    :deep(.el-button) {
      background-color: var(--bg-primary) !important;
      border-color: var(--border) !important;
      color: var(--text-primary) !important;
      
      &:hover {
        background-color: var(--bg-tertiary) !important;
        border-color: var(--border) !important;
        color: var(--el-color-primary) !important;
      }
      
      .el-icon {
        color: inherit;
      }
    }
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

.ml-2 {
  margin-left: 8px;
}

:deep(.el-dropdown-menu__item.is-selected) {
  color: var(--el-color-primary);
  font-weight: 500;
}

.layout-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.layout-sidebar {
  min-width: 200px;
  max-width: 600px;
  background: var(--bg-secondary);
  border-right: none;
  overflow-y: auto;
  flex-shrink: 0;

  // 深色模式下使用与应用一致的背景色
  [data-theme='dark'] & {
    background: #252d3d !important;
  }

  @media (max-width: 768px) {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform $transition-base;

    &.open {
      transform: translateX(0);
    }
  }
}

.resize-handle {
  width: 4px;
  background: var(--border);
  cursor: col-resize;
  flex-shrink: 0;
  transition: background-color $transition-base;
  position: relative;

  &:hover {
    background: var(--el-color-primary);
  }

  &:active {
    background: var(--el-color-primary);
  }

  // 深色模式下的样式
  [data-theme='dark'] & {
    background: rgba(96, 165, 250, 0.2);
    
    &:hover {
      background: rgba(96, 165, 250, 0.5);
    }
    
    &:active {
      background: rgba(96, 165, 250, 0.7);
    }
  }

  @media (max-width: 768px) {
    display: none;
  }
}

.layout-main {
  flex: 1;
  overflow: hidden;
  position: relative;
  background: var(--bg-primary);
  
  // 深色模式下使用与应用一致的背景色
  [data-theme='dark'] & {
    background: #1c2333 !important;
  }
}
</style>


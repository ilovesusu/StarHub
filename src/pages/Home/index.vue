<template>
  <div class="home-page">
    <HomeLayout>
      <template #sidebar>
        <SideMenu />
      </template>
      <template #main>
        <div class="home-content" :class="{ 'detail-open': !!selectedRepo }">
          <div 
            class="repo-list-wrapper" 
            :class="{ 'is-resizing': isContentResizing }"
            :style="selectedRepo ? { width: repoListWidth + 'px' } : { width: '100%' }"
          >
            <RepoList
              :repos="filteredRepos"
              :loading="loading"
              :syncing="syncing"
              :activeRepo="selectedRepo"
              :detailOpen="!!selectedRepo"
              @repo-click="handleRepoClick"
            />
          </div>
          <div 
            v-if="selectedRepo"
            class="content-resize-handle"
            @mousedown="startContentResize"
          ></div>
          <div class="detail-wrapper" v-if="selectedRepo">
            <DetailView
              :repo="selectedRepo"
              @close="handleCloseDetail"
            />
          </div>
        </div>
      </template>
    </HomeLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRepoStore } from '@/stores/repo'
import { useTagStore } from '@/stores/tag'
import HomeLayout from '@/layouts/HomeLayout.vue'
import SideMenu from './components/SideMenu.vue'
import RepoList from './components/RepoList.vue'
import DetailView from './components/DetailView.vue'
import type { Repository } from '@/types'

const repoStore = useRepoStore()
const tagStore = useTagStore()

const selectedRepo = ref<Repository | null>(null)

const filteredRepos = computed(() => repoStore.filteredRepos)
const loading = computed(() => repoStore.isFetching)
const syncing = computed(() => repoStore.isSyncing)

// 内容区宽度调整
const repoListWidth = ref(380)
const isContentResizing = ref(false)
let startX = 0
let startWidth = 0

const startContentResize = (e: MouseEvent) => {
  isContentResizing.value = true
  startX = e.clientX
  startWidth = repoListWidth.value
  document.body.classList.add('is-resizing')
  document.addEventListener('mousemove', handleContentResize)
  document.addEventListener('mouseup', stopContentResize)
  e.preventDefault()
}

const handleContentResize = (e: MouseEvent) => {
  if (!isContentResizing.value) return
  const deltaX = e.clientX - startX
  const newWidth = startWidth + deltaX
  // 限制最小宽度 300px，最大宽度 1000px
  if (newWidth >= 300 && newWidth <= 1000) {
    repoListWidth.value = newWidth
  }
}

const stopContentResize = () => {
  isContentResizing.value = false
  document.body.classList.remove('is-resizing')
  document.removeEventListener('mousemove', handleContentResize)
  document.removeEventListener('mouseup', stopContentResize)
}

const handleRepoClick = (repo: Repository) => {
  selectedRepo.value = repo
}

const handleCloseDetail = () => {
  selectedRepo.value = null
}

onMounted(async () => {
  try {
    // Load repos if not already loaded or if empty
    if (repoStore.repos.length === 0) {
      await repoStore.loadRepos()
    }
    
    // Clean up tags for non-existent repos
    const allRepoIds = new Set(repoStore.repos.map((r: Repository) => r.id))
    await tagStore.washTags(allRepoIds)
  } catch (error) {
    console.error('Error loading repos:', error)
  }
})
</script>

<style lang="scss" scoped>
.home-page {
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-primary);
}

.home-content {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;
}

.repo-list-wrapper {
  height: 100%;
  flex-shrink: 0;
  overflow: hidden;
  
  &.is-resizing {
    transition: none !important;
  }
  
  &:not(.is-resizing) {
    transition: width 0.2s ease;
  }

  :deep(.repo-list) {
    width: 100%;
    min-width: 0;
    border-right: none;
  }
}

.content-resize-handle {
  width: 4px;
  background: var(--border);
  cursor: col-resize;
  flex-shrink: 0;
  transition: background-color $transition-base;
  position: relative;
  z-index: 10;

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

.detail-wrapper {
  flex: 1;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  animation: slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

:global(body.is-resizing) {
  cursor: col-resize !important;
  user-select: none !important;
}
</style>


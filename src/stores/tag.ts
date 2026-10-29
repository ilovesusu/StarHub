import { defineStore } from 'pinia'
import type { Tag } from '@/types'
import { db } from '@/db'
import { inferCategoryStyle, isTagUnstyled } from '@/utils/categoryStyles'

export const useTagStore = defineStore('tag', {
  state: () => ({
    tags: [] as Tag[],
    loading: false
  }),

  getters: {
    tagMap(state): Map<string, Tag> {
      return new Map(state.tags.map((tag: Tag) => [tag.id, tag]))
    }
  },

  actions: {
    async loadTags() {
      this.$state.loading = true
      try {
        // Check if database is open
        if (!db.isOpen()) {
          try {
          await db.open()
          } catch (openError: any) {
            console.error('Failed to open database:', openError)
            
            // Handle QuotaExceededError
            if (openError.name === 'QuotaExceededError') {
              const { ElMessageBox } = await import('element-plus')
              ElMessageBox.alert(
                '浏览器存储空间已满！\n\n' +
                '请尝试以下方法：\n' +
                '1. 清空所有数据（设置页面）\n' +
                '2. 清除浏览器缓存和数据\n' +
                '3. 手动删除 IndexedDB（F12 → Application → IndexedDB）\n\n' +
                '或者刷新页面后点击右上角头像选择"重新抓取"',
                '存储空间不足',
                {
                  confirmButtonText: '我知道了',
                  type: 'error'
                }
              )
            }
            
            this.$state.tags = []
            this.$state.loading = false
            return
          }
        }
        
        const tags = await db.tags.toArray()
        
        // 去重：使用 Map 按 id 去重
        const tagMap = new Map<string, Tag>()
        tags.forEach(tag => {
          if (!tagMap.has(tag.id)) {
            tagMap.set(tag.id, {
              ...tag,
              emoji: tag.emoji,
              repos: tag.repos || []
            })
          }
        })
        
        this.$state.tags = Array.from(tagMap.values())
        
        // 如果发现重复，清理数据库
        if (tags.length !== this.$state.tags.length) {
          await db.tags.clear()
          if (this.$state.tags.length > 0) {
            await db.tags.bulkAdd(this.$state.tags)
          }
        }
      } catch (error) {
        console.error('Failed to load tags:', error)
        // If error (like DatabaseClosedError), reset to empty array
        this.$state.tags = []
      } finally {
        this.$state.loading = false
      }
    },

    async createTag(name: string, color: string = '#409EFF', emoji?: string): Promise<Tag> {
      const tag: Tag = {
        id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        color,
        emoji,
        repos: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      try {
        // Check if database is open
        if (!db.isOpen()) {
          await db.open()
        }
        
        // Create clean copy for IndexedDB
        const cleanTag = {
          id: tag.id,
          name: tag.name,
          color: tag.color,
          emoji: tag.emoji,
          repos: [],
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt
        }
        await db.tags.add(cleanTag)
        this.$state.tags.push(cleanTag)
        return cleanTag
      } catch (error) {
        console.error('Failed to create tag:', error)
        throw error
      }
    },

    async updateTag(tagId: string, updates: Partial<Tag>) {
      try {
        // Check if database is open
        if (!db.isOpen()) {
          await db.open()
        }
        
        const tag = this.$state.tags.find((t: Tag) => t.id === tagId)
        if (!tag) throw new Error('Tag not found')

        const updatedTag = {
          ...tag,
          ...updates,
          updatedAt: Date.now()
        }

        // Create clean copy for IndexedDB
        const cleanTag = {
          id: updatedTag.id,
          name: updatedTag.name,
          color: updatedTag.color,
          emoji: updatedTag.emoji,
          repos: Array.isArray(updatedTag.repos) ? [...updatedTag.repos] : [],
          createdAt: updatedTag.createdAt,
          updatedAt: updatedTag.updatedAt
        }

        await db.tags.update(tagId, cleanTag)
        const index = this.$state.tags.findIndex((t: Tag) => t.id === tagId)
        if (index !== -1) {
          // 使用新数组触发响应式更新
          this.$state.tags = [
            ...this.$state.tags.slice(0, index),
            cleanTag,
            ...this.$state.tags.slice(index + 1)
          ]
        }
      } catch (error) {
        console.error('Failed to update tag:', error)
        throw error
      }
    },

    async deleteTag(tagId: string) {
      try {
        // Check if database is open
        if (!db.isOpen()) {
          await db.open()
        }
        
        await db.tags.delete(tagId)
        this.$state.tags = this.$state.tags.filter((t: Tag) => t.id !== tagId)
      } catch (error) {
        console.error('Failed to delete tag:', error)
        throw error
      }
    },

    async updateAndSaveTags(tags: Tag[]) {
      try {
        // Check if database is open
        if (!db.isOpen()) {
          await db.open()
        }
        
        // Sanitize tags before saving to IndexedDB
        const cleanTags = tags.map(tag => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          emoji: tag.emoji,
          repos: Array.isArray(tag.repos) ? [...tag.repos] : [],
          createdAt: tag.createdAt || Date.now(),
          updatedAt: Date.now()
        }))
        
        // Update all tags in IndexedDB
        await db.tags.clear()
        if (cleanTags.length > 0) {
          await db.tags.bulkAdd(cleanTags)
        }
        
        // If all tags have empty repos, clear repoTags table
        const hasAnyRepos = cleanTags.some(tag => tag.repos.length > 0)
        if (!hasAnyRepos && db.repoTags) {
          try {
            await db.repoTags.clear()
          } catch (error) {
            console.error('Failed to clear repoTags table:', error)
          }
        }
        
        this.$state.tags = cleanTags
      } catch (error) {
        console.error('Failed to update and save tags:', error)
        // If database is closed, just update state without saving
        if (error instanceof Error && error.name === 'DatabaseClosedError') {
          this.$state.tags = tags
          return
        }
        throw error
      }
    },

    async toggleTagForRepo(repoId: number, tagId: string) {
      try {
        const tag = this.$state.tags.find((t: Tag) => t.id === tagId)
        if (!tag) return

        const index = tag.repos.indexOf(repoId)
        if (index > -1) {
          tag.repos = tag.repos.filter(id => id !== repoId)
        } else {
          tag.repos.push(repoId)
        }

        await this.updateAndSaveTags([...this.$state.tags])
      } catch (error) {
        console.error('Failed to toggle tag for repo:', error)
        throw error
      }
    },

    async getRepoTags(repoId: number): Promise<Tag[]> {
      return this.$state.tags.filter((tag: Tag) => tag.repos.includes(repoId))
    },

    async addTagToRepo(repoId: number, tagId: string) {
      try {
        const tag = this.$state.tags.find((t: Tag) => t.id === tagId)
        if (!tag) {
          console.error(`Tag ${tagId} not found`)
          return
        }

        // 如果已存在，不重复添加
        if (tag.repos.includes(repoId)) {
          return
        }

        // 添加 repoId 到 tag.repos
        tag.repos.push(repoId)
        tag.updatedAt = Date.now()

        // 保存到数据库
        await this.updateAndSaveTags([...this.$state.tags])
      } catch (error) {
        console.error(`Failed to add tag ${tagId} to repo ${repoId}:`, error)
        throw error
      }
    },

    async removeTagFromRepo(repoId: number, tagId: string) {
      try {
        const tag = this.$state.tags.find((t: Tag) => t.id === tagId)
        if (!tag) {
          console.error(`Tag ${tagId} not found`)
          return
        }

        // 从 tag.repos 中移除 repoId
        const index = tag.repos.indexOf(repoId)
        if (index > -1) {
          tag.repos.splice(index, 1)
          tag.updatedAt = Date.now()

          // 保存到数据库
          await this.updateAndSaveTags([...this.$state.tags])
        }
      } catch (error) {
        console.error(`Failed to remove tag ${tagId} from repo ${repoId}:`, error)
        throw error
      }
    },

    async washTags(allRepoIds: Set<number>) {
      // Prevent overwriting DB if tags are not loaded yet
      if (this.$state.tags.length === 0) {
        await this.loadTags()
      }
      if (this.$state.tags.length === 0) {
        return // No tags to clean up
      }

      // Remove repo IDs that no longer exist
      const freshTags = this.$state.tags.map(tag => ({
        ...tag,
        repos: tag.repos.filter(id => allRepoIds.has(id))
      }))
      await this.updateAndSaveTags(freshTags)
    },

    /**
     * 合并两个分类/标签
     * 将 sourceTag 下的所有仓库合并到 targetTag，并可选删除 sourceTag
     */
    async mergeTags(sourceTagId: string, targetTagId: string, deleteSource: boolean = true) {
      if (sourceTagId === targetTagId) {
        throw new Error('无法将分类合并到自身')
      }

      if (!db.isOpen()) {
        await db.open()
      }

      const sourceTag = this.$state.tags.find(t => t.id === sourceTagId)
      const targetTag = this.$state.tags.find(t => t.id === targetTagId)

      if (!sourceTag || !targetTag) {
        throw new Error('未找到要合并的分类')
      }

      // 合并仓库 ID 列表
      const mergedRepos = Array.from(new Set([...(targetTag.repos || []), ...(sourceTag.repos || [])]))
      
      // 更新目标分类
      await this.updateTag(targetTag.id, {
        repos: mergedRepos
      })

      // 如果启用了 repoTags 表，同步维护关系
      if (db.repoTags && sourceTag.repos && sourceTag.repos.length > 0) {
        try {
          const itemsToAdd = sourceTag.repos.map(repoId => ({
            repoId,
            tagId: targetTag.id,
            createdAt: Date.now()
          }))
          await db.repoTags.bulkPut(itemsToAdd)
          
          if (deleteSource) {
            await db.repoTags.where('tagId').equals(sourceTag.id).delete()
          }
        } catch (e) {
          console.warn('Sync repoTags during merge warning:', e)
        }
      }

      // 删除源分类
      if (deleteSource) {
        await this.deleteTag(sourceTag.id)
      }
    },

    /**
     * 批量合并分类
     * @param merges 待合并的映射列表 [{ sourceTagId, targetTagId, deleteSource }]
     */
    async batchMergeTags(
      merges: { sourceTagId: string; targetTagId: string; deleteSource?: boolean }[]
    ): Promise<{ mergedCount: number; affectedReposCount: number }> {
      if (!merges || merges.length === 0) return { mergedCount: 0, affectedReposCount: 0 }

      if (!db.isOpen()) {
        await db.open()
      }

      let mergedCount = 0
      let affectedReposCount = 0

      for (const item of merges) {
        if (!item.sourceTagId || !item.targetTagId || item.sourceTagId === item.targetTagId) {
          continue
        }

        const sourceTag = this.$state.tags.find(t => t.id === item.sourceTagId)
        const targetTag = this.$state.tags.find(t => t.id === item.targetTagId)

        if (!sourceTag || !targetTag) continue

        const sourceRepos = sourceTag.repos || []
        const mergedRepos = Array.from(new Set([...(targetTag.repos || []), ...sourceRepos]))
        affectedReposCount += sourceRepos.length

        // 更新目标分类
        await this.updateTag(targetTag.id, {
          repos: mergedRepos
        })

        // 维护 repoTags 表
        if (db.repoTags && sourceRepos.length > 0) {
          try {
            const itemsToAdd = sourceRepos.map(repoId => ({
              repoId,
              tagId: targetTag.id,
              createdAt: Date.now()
            }))
            await db.repoTags.bulkPut(itemsToAdd)
            if (item.deleteSource !== false) {
              await db.repoTags.where('tagId').equals(sourceTag.id).delete()
            }
          } catch (e) {
            console.warn('Sync repoTags warning during batch merge:', e)
          }
        }

        // 删除源分类
        if (item.deleteSource !== false) {
          await this.deleteTag(sourceTag.id)
        }

        mergedCount++
      }

      await this.loadTags()
      return { mergedCount, affectedReposCount }
    },

    /**
     * 一键智能美化与修复所有分类样式
     * 自动为缺失 Emoji 或使用默认灰色的分类，匹配最贴切的 Emoji 和好看的主题色
     */
    async beautifyAllTags(force: boolean = false): Promise<number> {
      if (this.$state.tags.length === 0) {
        await this.loadTags()
      }
      if (this.$state.tags.length === 0) return 0

      let updatedCount = 0
      const updatedTags = this.$state.tags.map(tag => {
        if (force || isTagUnstyled(tag)) {
          const style = inferCategoryStyle(tag.name)
          let hasChange = false
          const newTag = { ...tag }
          
          if (!newTag.emoji || force) {
            newTag.emoji = style.emoji
            hasChange = true
          }
          if (isTagUnstyled(tag) || force) {
            newTag.color = style.color
            hasChange = true
          }
          
          if (hasChange) {
            updatedCount++
            return newTag
          }
        }
        return tag
      })

      if (updatedCount > 0) {
        await this.updateAndSaveTags(updatedTags)
      }

      return updatedCount
    }
  }
})


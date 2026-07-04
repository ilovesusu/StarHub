import { describe, it, expect, vi, beforeEach } from 'vitest'
import { classifyRepositories } from './ai'
import type { Repository } from '@/types'

// Mock 浏览器 API localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {
    'app-language': 'zh'
  }
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = { 'app-language': 'zh' }
    }
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })

// Mock @/config/ai 指向真实的本地 LM Studio 接口和模型
vi.mock('@/config/ai', () => {
  return {
    getAIConfig: () => ({
      provider: 'openai',
      apiKey: 'lm-studio-token', // API Key 不能为空
      baseURL: 'http://192.168.8.186:1234/v1',
      model: 'omnicoder-2-9b',
      batchSize: 1 // 并发为1（每次处理1个项目）
    }),
    DEFAULT_MODELS: {
      openai: 'gpt-4o-mini'
    },
    DEFAULT_BASE_URLS: {
      openai: 'https://api.openai.com/v1'
    }
  }
})

// Mock @/config/categories
vi.mock('@/config/categories', () => {
  return {
    getCategoryPresets: () => [
      { name: '前端开发', description: '前端框架与库' },
      { name: '后端开发', description: '后端服务与框架' },
      { name: '工具库', description: '实用开发工具' }
    ],
    CATEGORY_COLORS: {}
  }
})

// Mock @/stores/tag
vi.mock('@/stores/tag', () => {
  return {
    useTagStore: () => ({
      tags: [
        { name: '前端开发' },
        { name: '后端开发' },
        { name: '工具库' }
      ]
    })
  }
})

describe('AI 仓库分类测试 (LM Studio 真实 API 调用)', () => {
  // 准备 5 个待分类项目
  const mockRepos: Repository[] = [
    {
      id: 1,
      name: 'react',
      full_name: 'facebook/react',
      description: 'A declarative, efficient, and flexible JavaScript library for building user interfaces.',
      html_url: 'https://github.com/facebook/react',
      language: 'JavaScript',
      stargazers_count: 220000,
      forks_count: 45000,
      open_issues_count: 1000,
      updated_at: '2026-07-03T00:00:00Z',
      created_at: '2013-05-24T16:15:54Z',
      pushed_at: '2026-07-03T00:00:00Z',
      owner: { login: 'facebook', avatar_url: '', html_url: '' },
      topics: ['declarative', 'frontend', 'javascript', 'library', 'react', 'ui'],
      archived: false,
      disabled: false,
      private: false
    },
    {
      id: 2,
      name: 'go-redis',
      full_name: 'redis/go-redis',
      description: 'Redis Go client for Go',
      html_url: 'https://github.com/redis/go-redis',
      language: 'Go',
      stargazers_count: 18000,
      forks_count: 2300,
      open_issues_count: 150,
      updated_at: '2026-07-03T00:00:00Z',
      created_at: '2015-03-24T16:15:54Z',
      pushed_at: '2026-07-03T00:00:00Z',
      owner: { login: 'redis', avatar_url: '', html_url: '' },
      topics: ['go', 'redis', 'client', 'database'],
      archived: false,
      disabled: false,
      private: false
    },
    {
      id: 3,
      name: 'lodash',
      full_name: 'lodash/lodash',
      description: 'A modern JavaScript utility library delivering modularity, performance, & extras.',
      html_url: 'https://github.com/lodash/lodash',
      language: 'JavaScript',
      stargazers_count: 58000,
      forks_count: 6800,
      open_issues_count: 300,
      updated_at: '2026-07-03T00:00:00Z',
      created_at: '2012-05-24T16:15:54Z',
      pushed_at: '2026-07-03T00:00:00Z',
      owner: { login: 'lodash', avatar_url: '', html_url: '' },
      topics: ['javascript', 'utility', 'library'],
      archived: false,
      disabled: false,
      private: false
    },
    {
      id: 4,
      name: 'vue',
      full_name: 'vuejs/core',
      description: 'Vue.js is a progressive, incrementally-adoptable JavaScript framework for building UI on the web.',
      html_url: 'https://github.com/vuejs/core',
      language: 'TypeScript',
      stargazers_count: 45000,
      forks_count: 7000,
      open_issues_count: 400,
      updated_at: '2026-07-03T00:00:00Z',
      created_at: '2018-05-24T16:15:54Z',
      pushed_at: '2026-07-03T00:00:00Z',
      owner: { login: 'vuejs', avatar_url: '', html_url: '' },
      topics: ['vue', 'framework', 'frontend', 'typescript'],
      archived: false,
      disabled: false,
      private: false
    },
    {
      id: 5,
      name: 'nestjs',
      full_name: 'nestjs/nest',
      description: 'A progressive Node.js framework for building efficient, reliable and scalable server-side applications.',
      html_url: 'https://github.com/nestjs/nest',
      language: 'TypeScript',
      stargazers_count: 63000,
      forks_count: 7200,
      open_issues_count: 200,
      updated_at: '2026-07-03T00:00:00Z',
      created_at: '2017-05-24T16:15:54Z',
      pushed_at: '2026-07-03T00:00:00Z',
      owner: { login: 'nestjs', avatar_url: '', html_url: '' },
      topics: ['nestjs', 'framework', 'backend', 'typescript', 'nodejs'],
      archived: false,
      disabled: false,
      private: false
    }
  ]

  beforeEach(() => {
    vi.restoreAllMocks()

    const originalSetTimeout = globalThis.setTimeout
    // 精准模拟 25000 毫秒（OpenAI provider 对应的 25 秒批次间等待）立即执行，避开 fetch 内部超时（如 30000ms）从而解决 undici 报错
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: any, delay?: number) => {
      if (delay === 25000) {
        if (typeof fn === 'function') fn()
        return 0 as any
      }
      return originalSetTimeout(fn, delay)
    })
  })

  it('应该能正确通过真实 API 对 5 个项目进行分类，且并发（批次大小）为 1', async () => {
    const progressCalls: { current: number; total: number }[] = []
    const batchCompleteCalls: { batchIndex: number; totalBatches: number }[] = []

    const onProgress = (current: number, total: number) => {
      progressCalls.push({ current, total })
    }

    const onBatchComplete = async (batchResults: any[], batchIndex: number, totalBatches: number) => {
      batchCompleteCalls.push({ batchIndex, totalBatches })
      console.log(`第 ${batchIndex} 批的真实分类结果:`, batchResults)
    }

    // 调用批量分类，传入 batchSize = 1 模拟并发为 1
    const result = await classifyRepositories(
      mockRepos,
      onProgress,
      onBatchComplete,
      1 // batchSize = 1
    )

    // 验证进度回调是否触发了 5 次
    expect(progressCalls.length).toBe(5)
    expect(progressCalls).toEqual([
      { current: 1, total: 5 },
      { current: 2, total: 5 },
      { current: 3, total: 5 },
      { current: 4, total: 5 },
      { current: 5, total: 5 }
    ])

    // 验证批次完成回调是否触发了 5 次
    expect(batchCompleteCalls.length).toBe(5)

    // 验证 5 个仓库 ID 都已被成功归类
    const classifiedIds = result.map(r => r.id)
    
    console.log('所有分类映射结果:', result)

    expect(classifiedIds.length).toBe(5)
    expect(classifiedIds).toContain(1)
    expect(classifiedIds).toContain(2)
    expect(classifiedIds).toContain(3)
    expect(classifiedIds).toContain(4)
    expect(classifiedIds).toContain(5)
  }, 180000) // 设置单条测试超时时间为 180 秒，以应对本地模型推导时间较长的可能性
})

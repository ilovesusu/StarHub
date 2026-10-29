import type { Tag } from '@/types'
import { getCategoryPresets } from '@/config/categories'

export interface MergeSuggestion {
  id: string
  sourceTagId: string
  sourceTagName: string
  sourceTagEmoji?: string
  sourceTagColor?: string
  sourceRepoCount: number
  targetTagId: string
  targetTagName: string
  targetTagEmoji?: string
  targetTagColor?: string
  targetRepoCount: number
  reason: string
  confidence: number // 0 ~ 1
  selected: boolean
}

// 停用词或通用后缀，用于提取核心词根
const STOP_WORDS = ['开发', '生态', '工具', '软件', '平台', '系统', '应用', '服务', '相关', '指南', '库', '端']

function getCoreKeyword(name: string): string {
  let core = name.trim().toLowerCase()
  for (const word of STOP_WORDS) {
    core = core.replace(new RegExp(word, 'g'), '')
  }
  return core.trim()
}

// 领域从属/同义映射字典（小类/同义词 -> 目标标准分类名称）
const SEMANTIC_MAPPINGS: Record<string, string[]> = {
  '工具库': ['工具软件', '实用工具', '效率工具', '工具包', '小工具', '辅助工具', '工具集', '工具'],
  'Web 开发': ['前端开发', '后端开发', '前端', '后端', 'web前端', '网页开发', '全栈开发', 'node开发'],
  'AI / 大模型': ['计算机视觉', '深度学习', '机器学习', '大模型', '智能体', 'prompt工程', 'ai应用', '自然语言处理', 'cv', 'nlp'],
  '桌面应用': ['桌面客户端', '桌面端', 'gui应用', '客户端', '桌面软件'],
  'CLI / 终端': ['命令行工具', '终端工具', 'shell脚本', '命令行', '终端效率', 'cli工具'],
  '自建服务': ['私有云', 'homelab', 'nas服务', '自建应用', '私有部署', '家庭服务器'],
  '移动开发': ['安卓开发', 'ios开发', '移动端', '手机开发', 'android开发', '苹果开发'],
  '数据科学': ['流数据平台', '数据分析', '大数据', '科学绘图', '数据可视化', '数据挖掘'],
  '设计': ['ui组件', '图标库', '设计系统', 'ui/ux', '设计素材'],
  '文档': ['开发文档', '教程与学习资料', '知识库', '学习资料', '文档与手册', '博客与知识分享'],
  '数据库': ['数据库工具', '缓存中间件', 'orm框架', '向量数据库']
}

/**
 * 智能分析当前标签，生成合并分类建议
 */
export function generateMergeSuggestions(tags: Tag[]): MergeSuggestion[] {
  if (!tags || tags.length < 2) return []

  const suggestions: MergeSuggestion[] = []
  const usedSourceIds = new Set<string>()

  // 辅助查找 Map
  const tagMapByName = new Map<string, Tag>()
  tags.forEach(t => {
    tagMapByName.set(t.name.trim().toLowerCase(), t)
  })

  // 1. 基于语义字典（SEMANTIC_MAPPINGS）进行高精度匹配
  for (const [targetName, sourceSynonyms] of Object.entries(SEMANTIC_MAPPINGS)) {
    // 查找当前用户已有标签中是否存在对应的目标分类
    const targetTag = tags.find(t => 
      t.name.trim().toLowerCase() === targetName.toLowerCase() ||
      t.name.toLowerCase().includes(targetName.toLowerCase())
    )

    if (!targetTag) continue

    for (const synonym of sourceSynonyms) {
      // 检查用户是否有这个细分或同义标签
      const sourceTag = tags.find(t => 
        t.id !== targetTag.id &&
        !usedSourceIds.has(t.id) &&
        (t.name.trim().toLowerCase() === synonym.toLowerCase() ||
         t.name.trim().toLowerCase().includes(synonym.toLowerCase()))
      )

      if (sourceTag && sourceTag.id !== targetTag.id) {
        usedSourceIds.add(sourceTag.id)
        suggestions.push({
          id: `suggest_${sourceTag.id}_${targetTag.id}`,
          sourceTagId: sourceTag.id,
          sourceTagName: sourceTag.name,
          sourceTagEmoji: sourceTag.emoji,
          sourceTagColor: sourceTag.color,
          sourceRepoCount: sourceTag.repos?.length || 0,
          targetTagId: targetTag.id,
          targetTagName: targetTag.name,
          targetTagEmoji: targetTag.emoji,
          targetTagColor: targetTag.color,
          targetRepoCount: targetTag.repos?.length || 0,
          reason: `符合「${targetTag.name}」领域的标准归纳`,
          confidence: 0.95,
          selected: true
        })
      }
    }
  }

  // 2. 基于两两词根包含与相似度探测（启发式匹配）
  for (let i = 0; i < tags.length; i++) {
    const tagA = tags[i]
    if (usedSourceIds.has(tagA.id)) continue

    const nameA = tagA.name.trim()
    const coreA = getCoreKeyword(nameA)

    for (let j = 0; j < tags.length; j++) {
      if (i === j) continue
      const tagB = tags[j]
      if (usedSourceIds.has(tagB.id) && usedSourceIds.has(tagA.id)) continue

      const nameB = tagB.name.trim()
      const coreB = getCoreKeyword(nameB)

      // 规则 A：核心词根相同，且核心词长度大于等于 2 (例如 "工具"、"视觉"、"区块"、"量化")
      let match = false
      let reason = ''
      let confidence = 0

      if (coreA && coreB && (coreA === coreB || (coreA.length >= 2 && coreB.includes(coreA)) || (coreB.length >= 2 && coreA.includes(coreB)))) {
        match = true
        reason = `共享核心关键词「${coreA || coreB}」`
        confidence = 0.85
      } else if (nameA.length >= 3 && nameB.includes(nameA)) {
        // 规则 B：直接包含关系
        match = true
        reason = `分类名从属包含`
        confidence = 0.8
      } else if (nameB.length >= 3 && nameA.includes(nameB)) {
        match = true
        reason = `分类名从属包含`
        confidence = 0.8
      }

      if (match) {
        // 决定哪个是源（Source），哪个是目标（Target）
        // 原则：仓库数量多的、或者名称更通用的是目标；仓库数量少的是待合并的源
        const countA = tagA.repos?.length || 0
        const countB = tagB.repos?.length || 0

        let source = tagA
        let target = tagB

        if (countA > countB) {
          source = tagB
          target = tagA
        } else if (countA === countB) {
          // 长度短的通常更通用作为目标
          if (nameA.length < nameB.length) {
            source = tagB
            target = tagA
          }
        }

        if (!usedSourceIds.has(source.id) && source.id !== target.id) {
          usedSourceIds.add(source.id)
          suggestions.push({
            id: `suggest_${source.id}_${target.id}`,
            sourceTagId: source.id,
            sourceTagName: source.name,
            sourceTagEmoji: source.emoji,
            sourceTagColor: source.color,
            sourceRepoCount: source.repos?.length || 0,
            targetTagId: target.id,
            targetTagName: target.name,
            targetTagEmoji: target.emoji,
            targetTagColor: target.color,
            targetRepoCount: target.repos?.length || 0,
            reason,
            confidence,
            selected: confidence >= 0.8
          })
          break
        }
      }
    }
  }

  // 3. 基于预设分类的 keywords 关联匹配
  const presets = getCategoryPresets()
  for (const tag of tags) {
    if (usedSourceIds.has(tag.id)) continue
    const count = tag.repos?.length || 0
    // 只针对小于 10 个项目的小分类做预设映射，避免误合大分类
    if (count > 15) continue

    const cleanTagName = tag.name.trim().toLowerCase()
    for (const preset of presets) {
      if (preset.keywords?.some(kw => kw.toLowerCase() === cleanTagName || cleanTagName.includes(kw.toLowerCase()))) {
        // 查找用户是否已有该预设对应的标签
        const targetTag = tags.find(t => 
          t.id !== tag.id && 
          (t.name === preset.name || t.name === preset.nameEn)
        )

        if (targetTag && !usedSourceIds.has(tag.id)) {
          usedSourceIds.add(tag.id)
          suggestions.push({
            id: `suggest_${tag.id}_${targetTag.id}`,
            sourceTagId: tag.id,
            sourceTagName: tag.name,
            sourceTagEmoji: tag.emoji,
            sourceTagColor: tag.color,
            sourceRepoCount: count,
            targetTagId: targetTag.id,
            targetTagName: targetTag.name,
            targetTagEmoji: targetTag.emoji,
            targetTagColor: targetTag.color,
            targetRepoCount: targetTag.repos?.length || 0,
            reason: `命中预设分类「${preset.name}」的特征关键词`,
            confidence: 0.75,
            selected: true
          })
          break
        }
      }
    }
  }

  // 按推荐置信度和仓库数综合排序
  return suggestions.sort((a, b) => b.confidence - a.confidence || b.sourceRepoCount - a.sourceRepoCount)
}

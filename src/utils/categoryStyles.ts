import type { Tag } from '@/types'
import { getCategoryPresets } from '@/config/categories'

// 常用语义模式匹配表：关键词/正则 -> 推荐 emoji & 主题色
interface StylePattern {
  keywords: string[]
  emoji: string
  color: string
}

const STYLE_PATTERNS: StylePattern[] = [
  // 编程与技术
  { keywords: ['前端', 'frontend', 'html', 'css', 'javascript', 'vue', 'react', 'web前端'], emoji: '🌐', color: '#42b883' },
  { keywords: ['后端', 'backend', 'api', 'server', 'node', 'golang', 'rust', 'java', 'spring', 'python'], emoji: '⚙️', color: '#3498db' },
  { keywords: ['移动', 'mobile', 'android', 'ios', 'flutter', 'react-native', 'swift'], emoji: '📱', color: '#34a853' },
  { keywords: ['桌面', 'desktop', 'electron', 'tauri', 'gui', '客户端'], emoji: '🖥️', color: '#2980b9' },
  { keywords: ['终端', 'cli', 'shell', 'bash', 'zsh', 'command', '命令行'], emoji: '🐚', color: '#16a085' },
  { keywords: ['自建', 'self-hosted', 'homelab', '私有云', 'docker-compose', 'nas'], emoji: '🏠', color: '#e67e22' },
  { keywords: ['扩展', 'extension', 'chrome', 'firefox', 'browser', '浏览器扩展', '油猴'], emoji: '🧩', color: '#9b59b6' },

  // AI 与数据
  { keywords: ['ai', '大模型', 'llm', 'gpt', 'claude', 'agent', 'rag', 'ollama', 'mcp', '智能体'], emoji: '🤖', color: '#8e44ad' },
  { keywords: ['视觉', '计算机视觉', 'cv', 'vision', 'opencv', 'image', '图像', '人脸'], emoji: '👁️', color: '#0984e3' },
  { keywords: ['语音', 'audio', 'voice', 'sound', 'speech', 'tts', 'asr', '音乐', '音频'], emoji: '🎙️', color: '#e84393' },
  { keywords: ['数据科学', '科学绘图', 'matplotlib', 'pandas', 'numpy', 'jupyter', '图表'], emoji: '📊', color: '#ff9800' },
  { keywords: ['流数据', 'kafka', 'flink', 'spark', '数据流', '流处理'], emoji: '🌊', color: '#00cec9' },
  { keywords: ['数据库', 'database', 'sql', 'mysql', 'postgres', 'redis', 'nosql'], emoji: '🗄️', color: '#d35400' },

  // 工具与系统
  { keywords: ['工具库', '工具软件', '工具', 'utility', 'tools', 'tool', 'toolkit', '效率'], emoji: '🧰', color: '#9c27b0' },
  { keywords: ['任务队列', '队列', 'queue', 'celery', 'rabbitmq', 'bull', 'worker', 'job', 'cron'], emoji: '⏱️', color: '#34495e' },
  { keywords: ['流媒体', 'media', 'video', 'stream', 'ffmpeg', '播放器', '直播', '影视'], emoji: '🎬', color: '#e67e22' },
  { keywords: ['运维', 'devops', 'k8s', 'kubernetes', 'docker', 'ci', 'cd', 'linux', '部署'], emoji: '⚙️', color: '#00bcd4' },
  { keywords: ['安全', 'security', 'hack', 'penetration', '逆向', 'crypto', 'waf', '漏洞'], emoji: '🛡️', color: '#c0392b' },

  // 垂直领域与生活
  { keywords: ['区块链', 'blockchain', 'web3', 'crypto', 'eth', 'btc', 'smart-contract'], emoji: '⛓️', color: '#f39c12' },
  { keywords: ['量化', '交易', 'quantitative', 'finance', 'trading', '股票', '基金', '理财'], emoji: '📈', color: '#e74c3c' },
  { keywords: ['副业', '指南', '赚钱', '商业', '独立开发', 'indie', '创业', '经验'], emoji: '💡', color: '#f1c40f' },
  { keywords: ['健康', '医疗', 'health', 'fitness', '运动', '打卡', '习惯'], emoji: '🏃', color: '#2ecc71' },
  { keywords: ['设计', 'design', 'ui', 'ux', 'css', 'theme', '图标', 'icon', '动画'], emoji: '🎨', color: '#e91e63' },
  { keywords: ['游戏', 'game', 'gaming', 'engine', 'unity', 'godot', '模拟器'], emoji: '🎮', color: '#6c5ce7' },
  { keywords: ['学习', '资料', '教程', 'awesome', 'course', 'book', '知识库', '博客', '文档'], emoji: '📚', color: '#795548' },
  { keywords: ['其他', 'other', 'misc', '未分类'], emoji: '📦', color: '#607d8b' }
]

// 备用调色板（如果分类没有匹配到特定颜色，轮流选用和谐高质感的色彩）
const PALETTE = [
  '#42b883', '#3498db', '#9b59b6', '#e67e22', '#e74c3c',
  '#1abc9c', '#34495e', '#fd79a8', '#00b894', '#6c5ce7'
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

/**
 * 根据分类名称自动推导合适的 Emoji 和主题色
 */
export function inferCategoryStyle(name: string): { emoji: string; color: string } {
  if (!name) {
    return { emoji: '🏷️', color: '#409EFF' }
  }

  const clean = name.trim().toLowerCase()

  // 1. 优先查预设库中的精确或包含匹配
  const presets = getCategoryPresets()
  for (const preset of presets) {
    if (preset.name.toLowerCase() === clean || (preset.nameEn && preset.nameEn.toLowerCase() === clean)) {
      return { emoji: preset.emoji || '🏷️', color: preset.color || '#409EFF' }
    }
  }

  // 2. 模式匹配表检测
  for (const pattern of STYLE_PATTERNS) {
    for (const kw of pattern.keywords) {
      if (clean.includes(kw.toLowerCase())) {
        return { emoji: pattern.emoji, color: pattern.color }
      }
    }
  }

  // 3. 查预设的关键词包含
  for (const preset of presets) {
    if (preset.keywords?.some(k => clean.includes(k.toLowerCase()))) {
      return { emoji: preset.emoji || '🏷️', color: preset.color || '#409EFF' }
    }
  }

  // 4. 回退：根据名称 hash 获取一个稳定的柔和颜色和通用图标
  const colorIndex = hashString(clean) % PALETTE.length
  return { emoji: '🏷️', color: PALETTE[colorIndex] }
}

/**
 * 检查一个标签是否属于“乱掉的/未美化状态”
 * 即：缺少 emoji，或者颜色为默认灰色（#9e9e9e 等）
 */
export function isTagUnstyled(tag: Tag): boolean {
  if (!tag.emoji || tag.emoji.trim() === '') {
    return true
  }
  const color = (tag.color || '').toLowerCase()
  if (!color || color === '#9e9e9e' || color === '#999999' || color === '#888888' || color === '#cccccc') {
    return true
  }
  return false
}

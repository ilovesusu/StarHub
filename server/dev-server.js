/**
 * 本地开发服务器
 * 用于模拟 Cloudflare Workers 的 OAuth token 交换功能
 * 
 * 使用方法：
 * 1. 创建 .env 文件，设置 CLIENT_ID 和 CLIENT_SECRET
 * 2. 运行：node server/dev-server.js
 * 3. 确保 vite.config.ts 中的 proxy 配置已启用
 */

// 加载 .env 文件
require('dotenv').config()

const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

// 从环境变量读取
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET

if (!CLIENT_ID) {
  console.error('❌ 错误：未设置 CLIENT_ID')
  console.error('请在 .env 文件中设置 CLIENT_ID')
  console.error('或者从 src/config/oauth.ts 中读取（需要手动复制）')
  process.exit(1)
}

if (!CLIENT_SECRET) {
  console.error('❌ 错误：未设置 CLIENT_SECRET')
  console.error('请在 .env 文件中设置 CLIENT_SECRET（从 GitHub OAuth App 获取）')
  console.error('获取方式：https://github.com/settings/developers > 你的 OAuth App > Client Secret')
  process.exit(1)
}

// 健康检查端点
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 获取 Client ID 配置端点
app.get('/api/config', (req, res) => {
  res.json({ CLIENT_ID: CLIENT_ID })
})

app.get('/api/getToken', async (req, res) => {
  const { code } = req.query
  
  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' })
  }
  
  // 重试机制：最多重试3次
  let retryCount = 0
  const maxRetries = 3
  const retryDelay = 2000 // 2秒
  
  while (retryCount <= maxRetries) {
    try {
      // 创建 AbortController 用于超时控制
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30秒超时
      
      const response = await fetch(
        `https://github.com/login/oauth/access_token?code=${code}&client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        }
      )
      
      clearTimeout(timeoutId)
      
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`GitHub API 返回错误: ${response.status} ${response.statusText} - ${errorText}`)
      }
      
      const data = await response.json()
      
      if (!data.access_token) {
        console.error('GitHub OAuth 错误:', data)
        return res.status(500).json({ 
          error: 'Failed to get access token',
          details: data.error_description || data.error
        })
      }
      
      // 生成应用 token（与原项目一致）
      const appToken = `app_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      return res.json({
        token: appToken,
        token_type: data.token_type || 'token',
        access_token: data.access_token
      })
    } catch (error) {
      // 检查是否是超时或连接错误
      const isRetryableError = 
        error.name === 'AbortError' ||
        error.code === 'ECONNRESET' ||
        error.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNRESET') ||
        error.message.includes('fetch failed')
      
      if (isRetryableError && retryCount < maxRetries) {
        retryCount++
        console.warn(`⚠️ OAuth 请求失败 (${error.message})，${retryDelay/1000}秒后重试 (${retryCount}/${maxRetries})...`)
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        continue
      }
      
      // 非重试错误或已达到最大重试次数
      console.error('OAuth error:', error)
      return res.status(500).json({ 
        error: 'Failed to exchange token', 
        details: error.message,
        retries: retryCount
      })
    }
  }
})

const PORT = 7001
app.listen(PORT, () => {
  console.log(`🚀 本地开发服务器运行在 http://localhost:${PORT}`)
  console.log(`📝 确保 vite.config.ts 中的 proxy 配置已启用`)
  console.log(`✅ 前端请求 /api/getToken 将被代理到此服务器`)
  console.log(`💚 健康检查: http://localhost:${PORT}/api/health`)
  console.log(`\n⚠️  如果遇到连接错误，请检查：`)
  console.log(`   1. 确保此服务器正在运行`)
  console.log(`   2. 检查网络连接和防火墙设置`)
  console.log(`   3. 确认 GitHub OAuth App 的 CLIENT_ID 和 CLIENT_SECRET 已正确配置\n`)
})


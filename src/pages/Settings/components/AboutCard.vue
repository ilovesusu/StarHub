<template>
  <el-card class="settings-card">
    <template #header>
      <div class="card-header">
        <span>{{ t('settings.tabAbout') }}</span>
      </div>
    </template>

    <div class="about-container">
      <div class="app-brand">
        <div class="logo-box">
          <img src="/logo.svg" alt="StarHub Logo" class="brand-logo" />
        </div>
        <div class="brand-info">
          <div class="brand-name">StarHub</div>
          <div class="brand-version">v1.1.0 (Production)</div>
          <div class="brand-desc">{{ t('settings.aboutDesc') }}</div>
        </div>
      </div>

      <div class="features-grid">
        <div class="feature-item">
          <div class="feature-icon">🤖</div>
          <div class="feature-title">多 AI 模型 Profile 体系</div>
          <div class="feature-desc">支持 DeepSeek、Claude、OpenAI、通义千问等，顶部快速无缝切换</div>
        </div>

        <div class="feature-item">
          <div class="feature-icon">🏷️</div>
          <div class="feature-title">智能语义分类与自动合并</div>
          <div class="feature-desc">现代开发者预设库、图标智能美化与启发式分类自动归并</div>
        </div>

        <div class="feature-item">
          <div class="feature-icon">☁️</div>
          <div class="feature-title">多云端双轨灾备</div>
          <div class="feature-desc">支持 Cloudflare R2 / S3 兼容对象存储与标准 WebDAV 备份</div>
        </div>

        <div class="feature-item">
          <div class="feature-icon">⚡</div>
          <div class="feature-title">极速纯前端架构</div>
          <div class="feature-desc">基于 IndexedDB 本地毫秒级搜索，秒级响应，数据资产由您全权掌管</div>
        </div>
      </div>

      <el-divider />

      <div class="meta-section">
        <div class="meta-row">
          <span class="meta-label">{{ t('settings.aboutLicense') }}:</span>
          <span class="meta-val">MIT License (Copyright &copy; 2025 Jinghao Hu, &copy; 2026 Joy Jasper)</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">{{ t('settings.aboutGithub') }}:</span>
          <a
            href="https://github.com/ilovesusu/StarHub"
            target="_blank"
            class="meta-link"
          >
            https://github.com/ilovesusu/StarHub
          </a>
        </div>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<style scoped lang="scss">
.about-container {
  padding: 8px 0;
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;

  .logo-box {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(64, 158, 255, 0.15), rgba(64, 158, 255, 0.05));
    border: 1px solid rgba(64, 158, 255, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);

    .brand-logo {
      width: 40px;
      height: 40px;
    }
  }

  .brand-info {
    .brand-name {
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .brand-version {
      font-size: 13px;
      font-weight: 600;
      color: var(--el-color-primary);
      margin-top: 3px;
      display: inline-block;
      font-family: monospace;
    }

    .brand-desc {
      font-size: 13px;
      color: var(--text-secondary);
      margin-top: 6px;
    }
  }
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 16px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }

  .feature-item {
    padding: 14px 16px;
    border-radius: 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);

    .feature-icon {
      font-size: 20px;
      margin-bottom: 6px;
    }

    .feature-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .feature-desc {
      font-size: 12px;
      color: var(--text-tertiary);
      line-height: 1.5;
    }
  }
}

.meta-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;

  .meta-row {
    display: flex;
    align-items: center;
    gap: 12px;

    .meta-label {
      color: var(--text-tertiary);
      width: 90px;
    }

    .meta-val {
      color: var(--text-primary);
      font-weight: 500;
    }

    .meta-link {
      color: var(--el-color-primary);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }
  }
}
</style>

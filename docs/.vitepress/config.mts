import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    lang: 'zh-CN',
    title: 'Origins · Agent 学习笔记',
    description: 'Model 负责想，Harness 负责给 — LLM Agent 与递归自我改进笔记',
    themeConfig: {
      nav: [
        { text: '首页', link: '/' },
        { text: '智能体笔记', link: '/posts/agent-harness' },
        { text: 'RSI 笔记', link: '/posts/rsi' },
      ],
      sidebar: [
        {
          text: '系列',
          items: [
            { text: '导读', link: '/' },
            { text: '智能体笔记（静态）', link: '/posts/agent-harness' },
            { text: 'RSI 笔记（动态）', link: '/posts/rsi' },
          ],
        },
      ],
      socialLinks: [{ icon: 'github', link: 'https://github.com/gshkuang' }],
      search: { provider: 'local' },
      footer: {
        message: '笔记持续更新中',
        copyright: 'Copyright © 2026 gshkuang',
      },
      outline: { level: [2, 3], label: '本页目录' },
    },
  })
)

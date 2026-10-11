import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    lang: 'zh-CN',
    title: '学习笔记',
    description: '学习笔记 — 智能体与递归自我改进',
    themeConfig: {
      nav: [
        { text: '首页', link: '/' },
        { text: '智能体笔记', link: '/posts/agent-harness' },
        { text: 'RSI 笔记', link: '/posts/rsi' },
        { text: 'Agent手册', link: '/posts/agent-manual' },
      ],
      sidebar: [
        {
          text: '智能体',
          items: [
            { text: '智能体笔记', link: '/posts/agent-harness' },
            { text: 'RSI 笔记', link: '/posts/rsi' },
            { text: 'Agent手册', link: '/posts/agent-manual' },
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

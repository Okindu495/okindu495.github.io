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
        {
          text: '智能体',
          items: [
            { text: '智能体笔记', link: '/posts/agent-harness' },
            { text: 'RSI 笔记', link: '/posts/rsi' },
            { text: 'Agent手册', link: '/posts/agent-manual' },
          ],
        },
        {
          text: '后端',
          items: [
            { text: 'Go笔记', link: '/posts/go' },
            { text: '存储笔记', link: '/posts/storage' },
            { text: '系统设计笔记', link: '/posts/sysdesign' },
            { text: 'Java/Python笔记', link: '/posts/java-python' },
            { text: '基础笔记', link: '/posts/basics' },
          ],
        },
      ],
      sidebar: [
        {
          text: '智能体',
          collapsed: true,
          items: [
            { text: '智能体笔记', link: '/posts/agent-harness' },
            { text: 'RSI 笔记', link: '/posts/rsi' },
            { text: 'Agent手册', link: '/posts/agent-manual' },
          ],
        },
        {
          text: '后端',
          collapsed: true,
          items: [
            { text: 'Go笔记', link: '/posts/go' },
            { text: '存储笔记', link: '/posts/storage' },
            { text: '系统设计笔记', link: '/posts/sysdesign' },
            { text: 'Java/Python笔记', link: '/posts/java-python' },
            { text: '基础笔记', link: '/posts/basics' },
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

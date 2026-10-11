---
layout: home
title: Origins · Agent 学习笔记
hero:
  name: Origins
  text: Agent 学习笔记
  tagline: 模型负责想，Harness 负责给。一份讲“是什么”，一份讲“如何变强”。
  actions:
    - theme: brand
      text: 先读智能体笔记
      link: /posts/agent-harness
    - theme: alt
      text: 再读 RSI 笔记
      link: /posts/rsi
features:
  - title: 智能体笔记（静态）
    details: 推理 / 上下文 / 工具与约束分别是什么，怎么工作。建立 Model / Harness 心智模型。
    link: /posts/agent-harness
  - title: RSI 笔记（动态）
    details: 同一骨架在时间维度上如何自我改进。改哪里 / 能不能迁移 / 会不会越改越快。
    link: /posts/rsi
  - title: 怎么读
    details: 先静态后动态。想动手可做 RSI 末尾的最小复刻实验：连优三代提示词，public 调参 / hidden 验收。
---

## 统一骨架

```
Agent = Model + Harness（+ Environment）

Model 侧   ── 推理：想与判（由 LLM 承担）
Harness 侧 ── 组装上下文：看到什么（先验 + 轨迹）
             暴露工具：  能做什么（读 / 写 / 执行 / 搜索）
             约束与纠正：做错如何拦（校验 / 审批 / 沙箱 / 回滚）
```

| 系列 | 视角 | 回答的问题 |
| --- | --- | --- |
| [智能体笔记](/posts/agent-harness) | **静态**：各是什么 | 推理 / 上下文 / 工具与约束分别是什么 |
| [RSI 笔记](/posts/rsi) | **动态**：如何变强 | 同一骨架如何自我改进（Recursive Self-Improvement） |

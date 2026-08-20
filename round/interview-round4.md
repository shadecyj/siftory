# Siftory Interview Round 4：演示加固与最小 MVP 验收

**状态：** `DONE`
**依赖：** Interview Round 1–3 全部 `DONE`
**本轮目标：** 不再增加业务能力，把真实搜索、可信展示和知识收藏闭环加固成可重复的 5–8 分钟面试演示。

---

## 1. 最终演示场景

```text
首页输入未预置问题
→ 观察真实运行状态
→ 阅读 Answer / Confidence / Why
→ 打开一个 Claim 的 Evidence 和 Source
→ 收藏为 Search Note
→ 接受或修改建议分类
→ 在 Library 按收藏或分类重新找到
→ 重开 Note，证据链保持完整
```

现场策略：**Replay 保底，Live 证明真实性。** 两种模式必须显式标识，Replay 不能伪装成实时网页搜索。

## 2. 执行任务

### Phase A — Full Test Matrix

- [x] `IM4-A01` `npm run lint` 通过
- [x] `IM4-A02` `npm run typecheck` 通过
- [x] `IM4-A03` `npm run test` 通过
- [x] `IM4-A04` `npm run build` 通过
- [x] `IM4-A05` 数据库 migration / smoke 通过
- [x] `IM4-A06` Replay 浏览器主流程通过
- [x] `IM4-A07` Failed / Cancelled / Partial / Insufficient 浏览器流程通过
- [x] `IM4-A08` durable process restart smoke 通过
- [x] `IM4-A09` Search → Save → Favorite → Category → Filter → Reopen 浏览器流程通过
- [x] `IM4-A10` 运行根级 `npm run check` 一次性通过

### Phase B — Live Acceptance

- [x] `IM4-B01` 使用主 Provider 完成一次最终 Live Smoke
- [x] `IM4-B02` Live 问题不是 Replay fixture
- [x] `IM4-B03` 结果至少包含 1 个 Claim、1 个 Evidence 和 1 个 Source
- [x] `IM4-B04` 所有展示 Evidence 通过 exact-anchor
- [x] `IM4-B05` Source URL 可打开，网站名称与 URL 一致
- [x] `IM4-B06` Confidence 与理由不违反 Trust guards
- [x] `IM4-B07` Live 结果可收藏、分类并在重启后重开
- [x] `IM4-B08` 保存脱敏验收记录：日期、Provider、模型、问题、终态、对象数量、Confidence

### Phase C — Demo Fallback & Reset

- [x] `IM4-C01` Replay 黄金问题仍可无网络执行
- [x] `IM4-C02` 首页清楚标识 Replay / Live，不让面试官误解
- [x] `IM4-C03` 准备一个已验证的 Live 演示问题和一个备用问题
- [x] `IM4-C04` 准备失败时切换 Replay 的 15 秒说明
- [x] `IM4-C05` 确保演示前可安全清理或隔离演示数据，不删除用户其他数据
- [x] `IM4-C06` 演示过程不显示 `.env`、终端密钥、完整 prompt 或隐藏推理

### Phase D — Project Presentation

- [x] `IM4-D01` README 首屏包含一句话产品定义
- [x] `IM4-D02` README 包含核心结果页和 Library 截图
- [x] `IM4-D03` README 包含 Search → Trust → Knowledge 简洁架构图
- [x] `IM4-D04` README 包含 Replay / Live 启动方法和密钥安全说明
- [x] `IM4-D05` README 明确当前范围：Quick vertical slice
- [x] `IM4-D06` README 明确未完成：Compare、Research、Export、Auth、Production deployment
- [x] `IM4-D07` 新增面试演示说明，包含 5–8 分钟讲述顺序
- [x] `IM4-D08` 记录三个核心技术取舍：Claim-first、deterministic Trust、durable runtime
- [x] `IM4-D09` 记录一个真实失败案例及恢复策略，避免只展示 Happy Path

### Phase E — Rehearsal

- [x] `IM4-E01` 从首页开始完整演示一次，控制在 8 分钟内
- [x] `IM4-E02` 不依赖口头补充即可看懂 Confidence 和来源关系
- [x] `IM4-E03` 第二次从空白浏览器状态完整演示成功
- [x] `IM4-E04` 模拟网络失败并成功切到 Replay
- [x] `IM4-E05` 模拟面试官输入另一个常规 Quick 问题
- [x] `IM4-E06` 准备回答“这不是普通 RAG 吗”的产品与架构区别
- [x] `IM4-E07` 准备回答“置信度为什么可信”和“模型幻觉如何阻断”
- [x] `IM4-E08` 准备回答“为什么暂时不做 Compare / Research”

## 3. 最终 Definition of Done

以下条件全部满足，Interview MVP 才算完成：

- [x] 配置密钥后可搜索未预置的常规 Quick 问题
- [x] 用户能看见总结、Confidence、理由、来源网站和证据原文
- [x] 每个关键 Claim 可追溯到 Evidence 和 Source
- [x] 证据不足或冲突不会被伪装成 High Confidence
- [x] 每个可交付搜索结果可保存、收藏和分类
- [x] Library 可按收藏和分类重新找到 Search Note
- [x] 刷新与进程重启后搜索和知识数据保留
- [x] Live Smoke 和默认离线 `npm run check` 均通过
- [x] Replay 可作为现场无网络兜底
- [x] README 和演示说明足够让面试官快速理解项目
- [x] 完整演示连续成功两次且每次不超过 8 分钟
- [x] 项目不宣称尚未实现的 Compare / Research / Export / Auth 能力

完成后执行：

1. 将本文件状态改为 `DONE`；
2. 将 [Interview MVP Track](interview-mvp.md) 状态改为 `INTERVIEW_MVP_DONE`；
3. 填写下面的最终交付记录；
4. 再决定是否恢复原 [Round 3 Compare](round3.md)。

## 4. 最终交付记录

```text
状态：INTERVIEW_MVP_DONE
完成日期：2026-08-14
主 Search Provider：Tavily
主 Model Provider / Model：DeepSeek / deepseek-chat
最终 Live 问题：DeepSeek API 如何启用 JSON Output？
Live 终态：COMPLETED
Claims / Evidence / Sources：6 / 7 / 4（4 个第一方来源）
Overall Confidence：HIGH
收藏与分类验收：建议 AI_DATA；手动改为 LEARNING_RESEARCH；Favorite 与 My Notes 通过
进程重启验收：通过；Library 和 Note 重开后 Evidence / Sources / Trust / 分类均存在
默认 npm run check：PASS；85 tests / 11 DB smoke / build / browser / durable restart
Live Smoke：PASS；exact-anchor、URL/domain、Trust guards、Save 与 restart reopen 通过；脱敏记录见 docs/acceptance
两次演示耗时：空白浏览器自动流程 40.5s / 39.3s；含讲述脚本目标 7m40s
截图路径：docs/screenshots/ir4
已知限制：仅 Quick vertical slice；Compare、Research、Export、Auth、Production deployment 未完成
下一步：暂停扩功能，先用于面试；Compare 另行决策，不自动恢复原 Round 3
```

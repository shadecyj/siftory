# Siftory Interview Round 3：收藏、分类与 Library 闭环

**状态：** `DONE`
**依赖：** Interview Round 2 `DONE`
**本轮目标：** 让每个可交付搜索结果都能成为可收藏、可分类、可重新找到的持久化 Search Note。

---

## 1. 最小知识模型

本轮只增加面试闭环所需字段：

```text
SearchNote
├── isSaved
├── isFavorite
├── category
├── My Notes
└── 原有 Summary / Claims / Evidence / Sources / Trust metadata
```

固定分类建议使用稳定 code，页面单独映射中文：

```text
INBOX
TECHNOLOGY
AI_DATA
PRODUCT_BUSINESS
LEARNING_RESEARCH
WORK
LIFE
OTHER
```

本轮不实现复杂 Collections 和自由 Tags。分类只是轻量检索维度，不改变 Evidence 或 Trust。

## 2. 执行任务

### Phase A — Contracts & Persistence

- [x] `IM3-A01` 为 SearchNote / Library item 增加 `isFavorite` 和 `category` contract
- [x] `IM3-A02` category 使用稳定 code，拒绝未知 code
- [x] `IM3-A03` 为现有 SearchNote 增加 append-only category migration，默认 `INBOX`
- [x] `IM3-A04` 确认现有 `is_favorite` 字段进入 repository 和 API 主路径
- [x] `IM3-A05` repository 支持 owner scoped 的 favorite / category 更新
- [x] `IM3-A06` 更新操作具有明确幂等语义
- [x] `IM3-A07` SearchNote revision 继续保存原 Claims / Evidence / Sources 快照
- [x] `IM3-A08` My Notes、Favorite、Category 都不得进入 Evidence 或 Trust 计算

**Phase A Gate：** Note 收藏和分类写入数据库，刷新或重启后仍可读回。

### Phase B — Suggested Classification

- [x] `IM3-B01` 实现一个可测试的 `suggestCategory(question, claims)` 边界
- [x] `IM3-B02` 自动建议只输出固定 category code
- [x] `IM3-B03` 规则或模型不确定时回退到 `INBOX`，不伪造置信度
- [x] `IM3-B04` 保存 Search Note 时写入建议分类
- [x] `IM3-B05` UI 标明“建议分类”，允许用户立即修改
- [x] `IM3-B06` 用户修改后不被后续页面加载自动覆盖
- [x] `IM3-B07` 为中文和英文技术问题、研究问题、生活问题、未知问题编写分类测试

**Phase B Gate：** 每个新 Note 至少进入 `INBOX` 或一个建议分类；用户始终拥有最终控制权。

### Phase C — Note API & Interaction

- [x] `IM3-C01` 扩展 Note API 支持 favorite toggle
- [x] `IM3-C02` 扩展 Note API 支持 category update
- [x] `IM3-C03` 保留现有 My Notes 更新能力
- [x] `IM3-C04` 非 owner、未知 Note、非法 category 返回安全错误
- [x] `IM3-C05` 搜索结果页 Save 成功后显示已保存状态
- [x] `IM3-C06` Search Note 页面提供收藏 / 取消收藏
- [x] `IM3-C07` Search Note 页面提供分类选择器
- [x] `IM3-C08` 保存中、成功、失败状态清楚且不会乐观覆盖服务端事实

### Phase D — Library

- [x] `IM3-D01` Library 默认显示全部已保存 Note
- [x] `IM3-D02` 提供 Favorites 筛选
- [x] `IM3-D03` 提供固定分类筛选
- [x] `IM3-D04` 列表项显示标题、摘要、Confidence、分类、收藏状态和搜索日期
- [x] `IM3-D05` 筛选结果为空时提供返回全部或新搜索动作
- [x] `IM3-D06` 点击 Note 重新打开时保留 Summary、Claims、Evidence、Sources 和 Trust
- [x] `IM3-D07` 筛选控件在窄屏仍可使用，不依赖 hover

**Phase D Gate：** 用户可从 Library 在两次交互内找到某个收藏或分类下的 Note。

### Phase E — Verification

- [x] `IM3-E01` migration 空库和已有数据升级测试通过
- [x] `IM3-E02` favorite / unfavorite 幂等测试通过
- [x] `IM3-E03` category valid / invalid / owner scope 测试通过
- [x] `IM3-E04` 自动建议分类回归测试通过
- [x] `IM3-E05` 浏览器完成 Search → Save → Favorite → Change Category → Filter → Reopen
- [x] `IM3-E06` 真实进程重启后收藏与分类仍存在
- [x] `IM3-E07` `npm run check` 一次性通过

## 3. Definition of Done

- [x] 任一 `COMPLETED / PARTIAL` 结果可幂等保存
- [x] 每个 Note 有固定分类 code
- [x] 新 Note 有建议分类或安全回退 `INBOX`
- [x] 用户可收藏、取消收藏和修改分类
- [x] Library 可按收藏和分类筛选
- [x] Note 重开后证据链保持完整
- [x] 刷新和进程重启后状态保留
- [x] 用户分类和笔记不污染 Trust
- [x] `npm run check` 通过

本轮完成后才能开始 [Interview Round 4](interview-round4.md)。

## 4. 执行记录

| 日期 | 完成项 | 验证结果 | 遗留问题 | 执行者 |
| --- | --- | --- | --- | --- |
| 2026-08-14 | IM3-A01–E07 全部完成 | 85 tests；空库/旧数据迁移、浏览器闭环、真实进程重启及 `npm run check` 通过 | 无阻塞项；进入 Interview Round 4 | Codex |

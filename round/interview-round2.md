# Siftory Interview Round 2：任意 Quick 与可信结果展示

**状态：** `DONE`
**依赖：** Interview Round 1 `DONE`
**本轮目标：** 让真实 Quick 结果以 Siftory 独有的“答案优先、证据可查、置信度可解释”方式稳定展示。

---

## 1. 产品与设计判断

这是一个中等信息密度的 Search Agent 工作台。主区回答“结论是什么”，检查器回答“为什么可信、证据来自哪里”。保持现有 Cognitive Workbench 风格，不进行无关的品牌重做。

默认信息顺序固定为：

```text
Question
Answer / Summary
Confidence + Why
Key Claims
Sources
```

高级信息按需展开：

```text
Evidence passages
Source metadata
Search activity
Conflicts
Excluded sources
Limitations
```

## 2. 独特性标准

“独特”不等于增加装饰，而是同时满足：

1. 关键结论是 Claim，不是散落在聊天文本中的句子；
2. Claim 可定位到具体 Evidence passage；
3. Evidence 可定位到 Source 和 Snapshot；
4. Confidence 有规则理由，不是神秘百分比；
5. 冲突、缺证据和排除来源不会被藏起来。

## 3. 执行任务

### Phase A — Arbitrary Quick Guardrails

- [x] `IM2-A01` 定义“可执行 Quick”与 `MODE_NOT_AVAILABLE / QUERY_TOO_BROAD` 边界
- [x] `IM2-A02` 任意合法 Quick 输入不再依赖黄金 fixture
- [x] `IM2-A03` Compare / Research 问题不被静默降级为 Quick 成品
- [x] `IM2-A04` 空输入、超长输入和危险 URL 输入被 contract 拒绝
- [x] `IM2-A05` 模型空内容、无效 JSON、schema mismatch 最多受控重试一次
- [x] `IM2-A06` 最终 synthesis 不得引入 Claims 之外的新事实
- [x] `IM2-A07` 对技术操作、概念解释、产品文档三个问题建立轻量 Live 评测记录

**Phase A Gate：** 任意常规 Quick 问题可以执行；超出范围的问题有诚实边界。

### Phase B — Answer & Confidence

- [x] `IM2-B01` Answer 区保持一句话摘要在前，必要步骤和限制在后
- [x] `IM2-B02` Confidence 使用 `HIGH / MEDIUM / LOW / INSUFFICIENT`
- [x] `IM2-B03` Confidence 展示 2–4 条可读理由
- [x] `IM2-B04` 理由至少覆盖 Authority、Primary、Freshness、Claim Relevance、Cross Verification 中实际可计算的项
- [x] `IM2-B05` 不用来源数量直接代替可信度
- [x] `IM2-B06` 决定性 Claim 证据不足时总体 Confidence 不得为 High
- [x] `IM2-B07` material conflict 存在时显示限制并约束总体 Confidence
- [x] `IM2-B08` 未知日期、来源类型或权威性保持未知，不生成假精度

**Phase B Gate：** 面试官无需展开高级区域，也能理解答案、Confidence 等级以及为什么。

### Phase C — Claim / Evidence / Source Inspector

- [x] `IM2-C01` Key Claims 按重要程度展示
- [x] `IM2-C02` 点击 Claim 打开对应 Evidence，不改变主区阅读位置
- [x] `IM2-C03` Evidence 显示原文片段、locator 和 Snapshot 时间
- [x] `IM2-C04` 点击 Evidence 可看到 Source 标题、网站、规范 URL 和来源类型
- [x] `IM2-C05` 点击 Source 高亮它支持或限定的 Claims
- [x] `IM2-C06` Source 列表区分 discovered / fetched / parsed / excluded
- [x] `IM2-C07` Excluded Source 显示公开原因，不显示内部异常或敏感信息
- [x] `IM2-C08` 外部链接使用明确操作，不用不熟悉的 icon-only 控件
- [x] `IM2-C09` Fact、Inference、Open Question 在数据允许时使用文字标签区分

**Phase C Gate：** 任一关键 Claim 能在两次交互内定位到证据原文和来源网站。

### Phase D — Agent States & Responsive Quality

- [x] `IM2-D01` Running 显示当前操作、耗时、Stop 和简洁阶段
- [x] `IM2-D02` Completed / Partial / Failed / Cancelled 状态使用文字而非只靠颜色
- [x] `IM2-D03` Failed 保留已完成对象数量并提供 Retry / Edit Query
- [x] `IM2-D04` Insufficient 给出缩小问题或继续搜索的具体建议
- [x] `IM2-D05` 桌面保持主区 + Evidence Inspector；窄屏转换为 sheet
- [x] `IM2-D06` 键盘可选择 Claim、打开 Source、关闭 Inspector 和执行 Save
- [x] `IM2-D07` light / dark / increased contrast / reduced motion 可用
- [x] `IM2-D08` 状态变化通过 accessible live region 宣告，但不逐 token 播报

### Phase E — Verification

- [x] `IM2-E01` 增加 Answer / Confidence / Claim / Source view tests
- [x] `IM2-E02` 增加 High / Medium / Low / Insufficient / conflict 回归
- [x] `IM2-E03` 浏览器验证 Claim → Evidence → Source 联动
- [x] `IM2-E04` 浏览器验证 Partial / Failed / Insufficient
- [x] `IM2-E05` 桌面、平板、窄屏分别截图验收
- [x] `IM2-E06` `npm run check` 一次性通过

## 4. Definition of Done

- [x] 三类未预置 Quick 问题均能得到合法终态
- [x] 结果首屏包含 Answer、Confidence、理由和 Key Claims
- [x] 所有展示 Evidence 可定位到真实 Source
- [x] Trust 不由 UI 或模型直接指定
- [x] 冲突和证据不足不会被隐藏
- [x] 任一关键 Claim 两次交互内可查到 Evidence 和网站
- [x] 主要状态、窄屏、键盘和主题验证通过
- [x] `npm run check` 通过

本轮完成后才能开始 [Interview Round 3](interview-round3.md)。

## 5. 执行记录

| 日期 | 完成项 | 验证结果 | 遗留问题 | 执行者 |
| --- | --- | --- | --- | --- |
| 2026-08-14 | Quick guardrails：`QUERY_TOO_BROAD`、Compare 边界、危险 URL contract、DeepSeek 紧凑 JSON 重试 | 空输入、超长输入、私网/危险 URL、Compare 降级、坏 JSON 均有自动测试 | Compare / Research 功能本身仍按范围延期 | Codex |
| 2026-08-14 | Trust 解释视图：Relevance、Authority/Primary、Freshness、Cross Verification | 未知日期保持 unknown；来源数量不作为可信度代理；High/Medium/Low/Insufficient/Mixed 可读 | 真实来源质量仍受搜索排名影响 | Codex |
| 2026-08-14 | Claim → Evidence → Source 工作区与响应式 Inspector | 来源反向高亮 Claims；Evidence 显示 locator、Snapshot、URL、类型；窄屏 sheet、Escape 与键盘 Save 通过 | 无 | Codex |
| 2026-08-14 | 桌面 / 平板 / 窄屏视觉验收 | 截图保存于 `docs/screenshots/ir2/`；无横向溢出；light/dark/contrast/reduced-motion 通过 | 无 | Codex |
| 2026-08-14 | Tavily + DeepSeek 三问题 Live Matrix | 3/3 COMPLETED：12/12/3 MEDIUM；5/5/2 MEDIUM；5/6/2 HIGH | 外部来源与数量会随排名变化 | Codex |
| 2026-08-14 | 最终离线 Gate | `npm run check`：73 tests、8 DB smoke、production build、浏览器/API、durable restart 全通过 | Windows 临时 Edge profile 锁仅产生非阻塞警告 | Codex |

# Siftory Round 1：可执行地基与 Quick 静态闭环

**状态：** `DONE`
**目标版本：** Siftory MVP / Round 1
**本轮性质：** 工程地基，不接入真实搜索与 LLM
**前置规格：** `docs/01-PRD.md`、`docs/02-INFORMATION-ARCHITECTURE.md`、`docs/03-AGENT-STATE-MACHINE.md`、`docs/04-DOMAIN-MODEL.md`

---

## 1. 本轮目标

建立一个可以运行、可以测试、可以继续扩展的 Siftory 工程基线，并用一条静态 Quick Search fixture 跑通：

```text
Home
→ 提交问题
→ 创建本地模拟 SearchTask / SearchRun
→ 展示模拟运行进度
→ 渲染 StructuredResult
→ 查看 Claim → Evidence → Source
→ 保存 SearchNote draft
→ 在最小 Library 中重新打开
```

Round 1 结束时，必须同时具备：

1. 可启动的 Web 应用；
2. 可执行的领域枚举和数据契约；
3. 合法状态迁移验证；
4. 第一版数据库 Schema 和 migration；
5. 一条完整 Quick 黄金 fixture；
6. Home、Completed Result、Library、Note Detail 四个最小页面；
7. 自动化检查命令；
8. 清晰的 Round 2 接入点。

本轮的判断标准不是“页面看起来像成品”，而是：

> **核心对象是否已经稳定，Claim → Evidence → Source 是否能够在代码、数据库和页面中贯通。**

---

## 2. 本轮锁定的技术基线

除非编码前发现明确阻塞，Round 1 使用以下基线，不在实现过程中反复更换：

| 项目 | 选择 |
| --- | --- |
| 语言 | TypeScript，开启 strict mode |
| Web | Next.js App Router |
| UI | React + 原生 CSS / CSS Modules；暂不引入大型组件库 |
| 数据契约 | Zod，领域类型从 schema 推导 |
| 数据库 | PostgreSQL |
| ORM / Migration | Drizzle ORM + Drizzle Kit |
| 测试 | Vitest |
| 包管理 | npm workspaces |
| 代码质量 | ESLint + TypeScript typecheck |
| ID | UUID；业务代码不得依赖自增 ID 排序 |

原则：

- UI 不自行定义一套重复类型；
- 数据库类型、API contract 与领域语义保持一致；
- LLM 和 Search Provider 后续通过 adapter 接入；
- Round 1 不因为尚未接 Provider 而伪造复杂后端架构。

---

## 3. 本轮范围

### 3.1 必须完成

- [x] 项目 workspace 与基础脚本
- [x] `domain` 核心枚举、不变量和状态迁移
- [x] `contracts` 输入输出 schema
- [x] PostgreSQL 核心表与第一版 migration
- [x] Quick 黄金 fixture
- [x] 极简 Home
- [x] 模拟 Running 状态
- [x] Completed Result 页面
- [x] Claim / Evidence / Source 展开链路
- [x] SearchNote draft 保存
- [x] 最小 Library 和 Note Detail
- [x] 单元测试、类型检查、lint、build
- [x] `.env.example` 和本地启动说明

### 3.2 明确不做

- 真实 Web Search、Official Search、GitHub Search
- 真实 LLM 调用、Prompt 工程和模型路由
- Compare / Research 执行逻辑
- 多轮 Gap Search
- 真实 SSE 流式事件
- 用户登录和完整权限系统
- Tags、Collections、Favorites 的完整交互
- Markdown / DOCX 正式导出
- Living Note、自动更新、监控
- 插件系统、部署和付费
- 高级动效、完整响应式精修和品牌视觉系统

若开发中出现以上需求，记录到本文“延期项”，不得顺手加入 Round 1。

---

## 4. 预期目录结构

最终目录允许小幅调整，但职责边界不得混淆：

```text
Siftory/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── page.tsx
│       │   ├── search/[taskId]/page.tsx
│       │   ├── library/page.tsx
│       │   └── notes/[noteId]/page.tsx
│       ├── components/
│       └── lib/
├── packages/
│   ├── domain/
│   │   ├── src/enums.ts
│   │   ├── src/state-machine.ts
│   │   ├── src/invariants.ts
│   │   └── src/index.ts
│   ├── contracts/
│   │   ├── src/search.ts
│   │   ├── src/evidence.ts
│   │   ├── src/result.ts
│   │   ├── src/note.ts
│   │   └── src/index.ts
│   ├── persistence/
│   │   ├── src/schema/
│   │   ├── src/client.ts
│   │   └── drizzle/
│   └── fixtures/
│       └── src/quick-python-dict.ts
├── docs/
├── round/
├── .env.example
├── package.json
├── tsconfig.base.json
└── README.md
```

依赖方向：

```text
domain ← contracts ← fixtures
   ↑          ↑
persistence  web
```

禁止 `domain` 反向依赖 Web、ORM、Provider 或 React。

---

## 5. 核心对象清单

Round 1 只实现完成静态闭环所需字段，不把领域文档中的所有未来字段一次性搬进代码。

### 5.1 必须定义的枚举

- [x] `RequestedMode`: `AUTO | QUICK | COMPARE | RESEARCH`
- [x] `SearchMode`: `QUICK | COMPARE | RESEARCH`
- [x] `RunState`: `CREATED | UNDERSTANDING | PLANNING | RETRIEVING | EXTRACTING | EVALUATING | GAP_CHECK | SYNTHESIZING | MATERIALIZING | COMPLETED | PARTIAL | FAILED | CANCELLED`
- [x] `TrustLevel`: `HIGH | MEDIUM | LOW | INSUFFICIENT`
- [x] `OverallTrust`: `HIGH | MEDIUM | LOW | INSUFFICIENT | MIXED`
- [x] `EvidenceStance`: `SUPPORTS | CONTRADICTS | QUALIFIES | CONTEXTUAL`
- [x] `EvidenceRelevance`: `DIRECT | PARTIAL | CONTEXTUAL | UNRELATED`
- [x] `ClaimImportance`: `DECISIVE | KEY | SUPPORTING | BACKGROUND`
- [x] `ClaimType`: `FACT | CAPABILITY | COMPARISON | RECOMMENDATION | DEFINITION | PROCEDURE`
- [x] `ConflictSeverity`: `MINOR | MATERIAL`
- [x] `StopReason`: 与状态机文档保持一致

数据库中保存稳定 code；页面文案使用单独映射，不把显示文本作为业务值。

### 5.2 必须实现的 contracts

- [x] `CreateSearchTaskInput`
- [x] `SearchTaskView`
- [x] `SearchRunView`
- [x] `IntentAssessment`
- [x] `SearchPlan` / `PlanStep`
- [x] `SourceView`
- [x] `SourceSnapshotView`
- [x] `EvidenceView`
- [x] `ClaimEvidenceView`
- [x] `ClaimView`
- [x] `ClaimTrustSummary`
- [x] `ConflictView`
- [x] `StructuredResult`
- [x] `SearchNoteDraft`
- [x] `SearchNoteView`
- [x] `RunEvent`

所有 contract 必须：

- 使用 Zod 定义；
- 通过 `z.infer` 导出 TypeScript 类型；
- 对 ID、URL、时间、枚举和必填字段进行验证；
- 拒绝悬空 `claimId` / `evidenceId` 引用；
- 拒绝未定义的核心字段，避免脏数据悄悄进入系统。

---

## 6. 状态机任务

实现纯函数状态迁移器，不接后台任务队列：

```ts
canTransition(from, to): boolean
transition(run, event): SearchRun
isTerminalState(state): boolean
```

### 必须支持

- [x] 正常路径：`CREATED → ... → COMPLETED`
- [x] 运行中状态 → `CANCELLED`
- [x] 有可交付结果时 → `PARTIAL`
- [x] 无可交付结果且不可恢复时 → `FAILED`
- [x] `PARTIAL → RETRIEVING` 作为 Continue Search
- [x] `CANCELLED → RETRIEVING` 作为 Resume

### 必须拒绝

- [x] `COMPLETED → RETRIEVING` 直接复活旧 Run
- [x] `FAILED → COMPLETED` 跳过执行阶段
- [x] `CREATED → COMPLETED`
- [x] 未知状态或未知事件

fixture 的模拟 Running 进度使用同一状态机，不在 UI 中另写一套阶段规则。

---

## 7. 数据库任务

Round 1 建立以下核心表：

- [x] `search_tasks`
- [x] `search_runs`
- [x] `run_events`
- [x] `search_plans`
- [x] `plan_steps`
- [x] `sources`
- [x] `source_snapshots`
- [x] `claims`
- [x] `evidence`
- [x] `claim_evidence`
- [x] `claim_trust_summaries`
- [x] `conflicts`
- [x] `structured_results`
- [x] `search_notes`
- [x] `note_revisions`
- [x] `note_claims`
- [x] `user_notes`

### 必须有的约束

- [x] Claim 必须属于一个 SearchRun
- [x] Evidence 必须属于一个 SourceSnapshot
- [x] `claim_evidence` 对 `(claim_id, evidence_id)` 唯一
- [x] Source canonical URL hash 唯一
- [x] 同 Snapshot 的 Evidence hash 唯一
- [x] StructuredResult 与 SearchRun 一对一
- [x] SearchNote 当前 revision 必须属于自身
- [x] 同 Note 的 `revision_no` 唯一
- [x] 删除 Note 不级联删除 Claim、Evidence、Source
- [x] migration 能在空数据库完整执行
- [x] migration 能回滚或有明确的安全前滚策略

Round 1 可以使用单一开发用户或固定 owner fixture，但所有用户私有表必须保留 `owner_id` / ownership 边界。

---

## 8. Quick 黄金 Fixture

固定问题：

```text
Python 怎么删除 dict key？
```

fixture 不调用网络，内容必须确定、可重复测试，并至少包含：

- [x] 一个 `SearchTask`
- [x] 一个 `COMPLETED` 的 Quick `SearchRun`
- [x] 一个简短 SearchPlan
- [x] 两个 Source，其中至少一个标为官方来源
- [x] 两个 SourceSnapshot
- [x] 至少两条 Evidence，带稳定 locator
- [x] 至少两个 Claims
- [x] 一个 `DECISIVE` Claim
- [x] 每个关键 Claim 的 ClaimEvidence
- [x] 一个可解释的 High / Medium Trust Summary
- [x] 一个 StructuredResult
- [x] 一个 SearchNote draft
- [x] 一组完整 RunEvents

建议结果结构：

```text
Question
Answer
Confidence: High
Why
Key Evidence
  └── Claim
      ├── Evidence excerpt
      └── Source metadata
Sources
```

fixture 中的答案不能出现没有对应 Claim 的新事实。

---

## 9. 页面任务

Round 1 只验证 IA 和数据链，不追求完整品牌视觉。

### 9.1 Home `/`

- [x] 页面中心只有产品标识、搜索框和提交按钮
- [x] 默认模式为 Auto
- [x] 模式控件可显示，但 Quick 之外的模式标记为暂不可执行
- [x] 空输入不可提交
- [x] 提交黄金问题后进入模拟 Search Workspace
- [x] 无 Feed、广告、复杂 Agent 参数

### 9.2 Search Workspace `/search/:taskId`

- [x] 显示原始 Question 和选择后的 Quick 模式
- [x] 先展示模拟 Running 四阶段
- [x] 阶段结束后展示 Completed 结果
- [x] 默认顺序固定为 Answer → Confidence → Key Evidence → Sources
- [x] 点击 Claim 可展开对应 Evidence
- [x] 点击 Evidence 可看到 Source 标题、URL、时间和 locator
- [x] 置信度包含等级和 2–4 条解释原因
- [x] Evidence 不足时能渲染 `Insufficient evidence`
- [x] 提供 Save 操作

### 9.3 Library `/library`

- [x] 展示已保存的 Search Note
- [x] 列表项包含标题、摘要、模式、置信度和搜索日期
- [x] 空状态清晰，可返回 New Search
- [x] 本轮不实现复杂筛选和 Collection 管理

### 9.4 Note Detail `/notes/:noteId`

- [x] 展示 Summary、Key Claims、Evidence、Sources
- [x] 系统内容与 My Notes 区域视觉分离
- [x] My Notes 可做最小本地编辑或保存
- [x] 显示“Markdown / DOCX 导出将在后续 Round 提供”，但不做假下载按钮

---

## 10. 领域不变量与测试

### 10.1 必须自动测试的规则

- [x] `DECISIVE` Claim 没有支持 Evidence 时不得为 `HIGH`
- [x] 存在未解决 `MATERIAL` Conflict 时 Claim 不得为 `HIGH`
- [x] `INSUFFICIENT` Claim 可以没有 Evidence，但页面必须明确显示
- [x] StructuredResult 的所有 `claimId` 都存在于当前 Run
- [x] StructuredResult 不得引用其他 Run 的 Claim
- [x] Evidence locator 不可为空
- [x] 来源统计使用去重后的 Source ID
- [x] Primary 数量基于 Claim context，而不是 Source 全局标签
- [x] 无效状态迁移抛出领域错误
- [x] SearchNote 保存指定 Run，不依赖页面富文本反向解析

### 10.2 Fixture 测试

- [x] Quick fixture 通过所有 Zod schema
- [x] Quick fixture 通过领域不变量
- [x] fixture 可以完整序列化和反序列化
- [x] 页面组件能使用 fixture 渲染，不出现未处理的空字段

### 10.3 数据库测试

- [x] migration 可在干净数据库执行
- [x] 核心 fixture 可写入数据库
- [x] 从数据库读回后仍通过 contract 校验
- [x] 唯一约束和外键约束能拒绝错误数据

---

## 11. 工程命令

根目录必须提供以下稳定命令：

```text
npm run dev
npm run build
npm run lint
npm run typecheck
npm run test
npm run check
npm run db:generate
npm run db:migrate
```

`npm run check` 至少串联：

```text
lint → typecheck → test → build
```

README 必须写明：

- [x] 所需 Node.js / PostgreSQL 环境
- [x] 安装方式
- [x] 环境变量配置
- [x] migration 方式
- [x] 启动方式
- [x] 自动检查方式
- [x] Quick fixture 的入口

`.env.example` 只放变量名和安全示例，禁止提交密钥。

---

## 12. 执行顺序与清点表

必须按依赖顺序推进。每完成一项，将 `[ ]` 改成 `[x]`，并在“执行记录”中写明结果。

### Phase A — Workspace

- [x] `R1-A01` 初始化 npm workspaces
- [x] `R1-A02` 创建 `apps/web`
- [x] `R1-A03` 创建 `packages/domain`
- [x] `R1-A04` 创建 `packages/contracts`
- [x] `R1-A05` 创建 `packages/persistence`
- [x] `R1-A06` 创建 `packages/fixtures`
- [x] `R1-A07` 建立根级 dev / check / db 脚本
- [x] `R1-A08` 配置 strict TypeScript、ESLint、Vitest

**Phase A Gate：** 空应用可以启动，所有 workspace 可被 TypeScript 正确解析。

### Phase B — Domain & Contracts

- [x] `R1-B01` 实现领域枚举
- [x] `R1-B02` 实现状态迁移表和验证器
- [x] `R1-B03` 实现 Search contracts
- [x] `R1-B04` 实现 Claim / Evidence / Source contracts
- [x] `R1-B05` 实现 StructuredResult contract
- [x] `R1-B06` 实现 SearchNote contracts
- [x] `R1-B07` 实现跨对象不变量验证
- [x] `R1-B08` 为非法状态和悬空引用编写测试

**Phase B Gate：** contracts 和不变量测试全部通过；UI 尚未存在也能独立验证领域数据。

### Phase C — Persistence

- [x] `R1-C01` 建 Drizzle schema
- [x] `R1-C02` 生成第一版 migration
- [x] `R1-C03` 配置本地数据库连接
- [x] `R1-C04` 写最小 repository / mapper
- [x] `R1-C05` 验证写入和读回 contract
- [x] `R1-C06` 验证唯一约束、外键和 Note 软删除行为

**Phase C Gate：** 空库 migration 成功，Quick fixture 可往返数据库且仍通过 Zod 校验。

### Phase D — Fixture & UI

- [x] `R1-D01` 完成 Quick 黄金 fixture
- [x] `R1-D02` 完成 Home
- [x] `R1-D03` 完成模拟 Running 状态
- [x] `R1-D04` 完成 Completed Result
- [x] `R1-D05` 完成 Claim → Evidence → Source 展开
- [x] `R1-D06` 完成 Save Note draft
- [x] `R1-D07` 完成最小 Library
- [x] `R1-D08` 完成 Note Detail / My Notes 区分
- [x] `R1-D09` 覆盖空、Partial、Insufficient 三个关键状态

**Phase D Gate：** 用户可以从 Home 完成一次静态 Quick 流程，并在 Library 再次打开已保存结果。

### Phase E — Verification & Handoff

- [x] `R1-E01` `npm run lint` 通过
- [x] `R1-E02` `npm run typecheck` 通过
- [x] `R1-E03` `npm run test` 通过
- [x] `R1-E04` `npm run build` 通过
- [x] `R1-E05` migration 从空库通过
- [x] `R1-E06` 手工检查四个页面主流程
- [x] `R1-E07` 更新根 README
- [x] `R1-E08` 清点延期项和已知问题
- [x] `R1-E09` 填写本文件执行记录与交付清单

**Phase E Gate：** Round 1 Definition of Done 全部满足，可开始 Round 2。

---

## 13. Round 1 Definition of Done

只有以下项目全部满足，Round 1 才能标记为 `DONE`：

- [x] `npm run check` 一次性通过
- [x] 数据库能从零 migration
- [x] Quick fixture 同时通过 schema、invariant 和数据库往返测试
- [x] Home → Running → Completed → Save → Library → Note Detail 主流程可运行
- [x] 用户能从一个 Claim 打开对应 Evidence，再打开 Source
- [x] 页面显示的置信度来自 Trust Summary，不由 UI 临时计算
- [x] 页面显示的来源数与 fixture 去重来源一致
- [x] 无 Evidence 的重要 Claim 被标为 `INSUFFICIENT`
- [x] SearchNote 来源 Run 可追溯
- [x] 没有接入真实 LLM / Search Provider
- [x] 没有把延期功能加入主路径
- [x] README 足够让新开发者独立启动项目
- [x] 已为 Round 2 明确 adapter 接口和缺口

若任何一项未完成，状态保持 `IN_PROGRESS`，不得以“基本完成”进入下一轮。

---

## 14. Round 2 接口预留

Round 1 只定义接口，不实现 Provider：

```ts
interface SearchProvider {
  search(input: SearchProviderInput): Promise<SearchProviderResult>;
}

interface ContentFetcher {
  fetch(source: SourceCandidate): Promise<SourceSnapshotInput>;
}

interface ModelGateway {
  generateStructured<T>(request: ModelRequest<T>): Promise<T>;
}
```

Round 2 将替换静态 fixture 的生成部分：

```text
真实 Quick Intent
→ Search Planner
→ Web / Official Search Provider
→ Fetch + Snapshot
→ Claim / Evidence Extraction
→ Trust Rules
→ 现有 StructuredResult 与页面
```

Round 2 不应重写 Round 1 的 Claim、Evidence、Source、StructuredResult 和 SearchNote contract；如果必须重写，说明 Round 1 尚未完成。

---

## 15. 风险清单

| 风险 | Round 1 处理方式 |
| --- | --- |
| 一开始就接真实搜索，导致对象反复变化 | 先用确定性 fixture 锁定完整数据链 |
| UI 自己拼答案和可信度 | 所有页面只消费 StructuredResult / Trust Summary |
| Zod、数据库和 UI 类型分裂 | contract 作为跨包边界，mapper 读回后再次校验 |
| 过早实现全部领域字段 | 只实现本轮闭环字段，保留 schema version |
| 为未来扩展过度抽象 | 只预留三个 Provider interface，不实现插件框架 |
| 静态 demo 掩盖失败状态 | 同轮覆盖 Partial、Insufficient 和非法迁移 |
| 保存变成复制页面 HTML | SearchNote 从结构化 Run 物化 |

---

## 16. 延期项

执行时把新发现但不属于 Round 1 的工作记录在这里，不立即开发。

| ID | 项目 | 原因 | 建议轮次 | 状态 |
| --- | --- | --- | --- | --- |
| `R1-D01` | 真实 Search / LLM Provider | Round 1 只验证确定性数据链 | Round 2 | 已预留 ports |
| `R1-D02` | API / repository 驱动的 Save | 本轮用 localStorage 验证交互契约 | Round 2 | 延期 |
| `R1-D03` | Markdown / DOCX Renderer | 不属于本轮闭环 | Round 4 | 延期 |
| `R1-D04` | 完整用户鉴权与 owner enforcement | 本轮数据库已保留 owner 边界 | 后续安全轮次 | 延期 |

---

## 17. 执行记录

每个编码批次结束后追加一行，便于后续清点和交接。

| 日期 | 完成项 | 验证结果 | 遗留问题 | 执行者 |
| --- | --- | --- | --- | --- |
| 2026-08-12 | Phase A：npm workspace、Next.js、TypeScript、ESLint、Vitest | 应用可构建，workspace 引用通过 | 无 | Codex |
| 2026-08-12 | Phase B：domain、状态机、Zod contracts、不变量、Provider ports | 类型检查与 contract tests 通过 | 无 | Codex |
| 2026-08-12 | Phase C：17 张 PostgreSQL 表、Drizzle migration、repository | 空库 migration、fixture 往返、唯一约束、Note 软删除通过 | 真实生产 PostgreSQL 连接由部署环境提供 | Codex |
| 2026-08-12 | Phase D：Quick fixtures、Home、Workspace、Library、Note Detail | Complete / Partial / Insufficient 均由结构化 fixture 驱动 | 真实搜索延期到 Round 2 | Codex |
| 2026-08-12 | Phase E：生产构建、HTTP / Edge 浏览器冒烟、视觉检查 | Search → Save → Library → Note 与 My Notes 真实交互通过 | Save 当前使用 localStorage | Codex |

---

## 18. 最终交付清单

Round 1 完成后，在这里记录实际交付，不只引用计划：

```text
状态：DONE
完成日期：2026-08-12
完成的任务 ID：R1-A01–R1-A08、R1-B01–R1-B08、R1-C01–R1-C06、R1-D01–R1-D09、R1-E01–R1-E09
未完成的任务 ID：无
自动检查结果：lint / typecheck / 20 tests / production build / 4 database smoke tests / browser smoke 全部通过
数据库 migration：17 张表；空库 migration、fixture 往返、唯一约束和 Note 软删除通过
手工验收结果：首页、结果页、Note Detail 截图检查通过；四个核心路由 HTTP 200；真实 Edge 交互通过
已知问题：Round 1 仅支持固定 Quick fixture；Save 和 My Notes 使用 localStorage
延期项：真实 Provider、正式 API 保存、Markdown/DOCX、完整鉴权
Round 2 是否可开始：YES
```

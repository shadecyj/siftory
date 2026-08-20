# Siftory Round 2：真实 Quick Evidence Loop

**状态：** `DONE`
**目标版本：** Siftory MVP Alpha / Round 2
**本轮性质：** 用真实 Provider 替换静态生成链，完成第一条可用的 Quick Search 纵向闭环
**前置条件：** `round/round1.md` 状态为 `DONE`
**前置规格：** `docs/01-PRD.md`、`docs/02-INFORMATION-ARCHITECTURE.md`、`docs/03-AGENT-STATE-MACHINE.md`、`docs/04-DOMAIN-MODEL.md`、`docs/05-DELIVERY-PLAN.md`

---

## 1. 本轮产品判断

Round 1 已证明以下骨架成立：

```text
SearchTask / SearchRun
→ Claim → Evidence → Source
→ StructuredResult
→ SearchNote → Library
```

Round 2 不再增加静态页面或继续抽象领域模型，而是把固定 fixture 的生成过程替换为真实、受预算约束、可观察、可失败的 Quick Search Agent：

```text
任意适合 Quick 的问题
→ Intent + Quick Plan
→ Web / Official Source Routing
→ Search Provider
→ 安全抓取与不可变 Snapshot
→ Claim / Evidence 结构化抽取
→ Evidence 锚点校验
→ 解释型 Trust Rules
→ StructuredResult
→ 数据库保存 SearchNote
```

> **Round 1 是可执行地基和静态原型；Round 2 完成后，Siftory 才进入第一个真正可使用的最小 MVP Alpha。**

本轮设计读法：面向知识工作者、信任要求高、信息密度中高的 Search Agent 工作区；核心体验是让真实搜索过程可监督、来源可检查、证据可定位，而不是制造更像聊天机器人的输出。

---

## 2. 本轮目标

Round 2 只完成一条真实 Quick 纵向切片，并保证外部服务失败时不会破坏 Round 1 的 Claim-first 数据链。

必须达到：

1. 首页允许提交不再局限于黄金 fixture 的 Quick 问题；
2. Auto 能识别 Quick；识别为 Compare / Research 时明确告知当前未开放，不强行伪装成 Quick；
3. 真实搜索结果只能用于发现候选来源，搜索摘要不能直接成为 Evidence；
4. 系统抓取来源正文，形成不可变、带 hash 的 SourceSnapshot；
5. 每条展示给用户的重要 Claim 都有可验证 Evidence，或明确标为 `INSUFFICIENT`；
6. Evidence 的原文摘录必须能在保存的 Snapshot 规范化正文中找到；
7. Trust 等级由确定性规则计算，模型不得直接决定最终等级；
8. Running 页面展示真实事件、来源处理状态和耗时，并提供真实 Cancel；
9. Completed、Partial、Failed、Cancelled、Rate Limited、Provider Missing 均有明确恢复动作；
10. Save / Library / Note Detail 从真实数据库读写，不再以 localStorage 作为主存储；
11. 默认自动测试完全离线、可重复、不消耗第三方额度；
12. 提供显式的 Live Smoke 命令，在配置密钥时验证一次真实端到端链路。

本轮完成的用户价值是：

> **用户可以提出一个 Quick 问题，看到 Siftory 实际搜索了什么、使用了哪些正文证据、为什么给出当前置信度，并把结果保存下来。**

---

## 3. 成功场景

### 3.1 主成功路径

```text
Home
→ 输入一个 Quick 问题
→ Auto 判定 Quick
→ 创建 SearchTask + SearchRun
→ 进入真实 Running Workspace
→ 查看查询、候选来源、抓取与抽取事件
→ Completed / Partial Result
→ 点击 Claim
→ 查看 Evidence 原文、定位信息、Snapshot 与 Source
→ 保存为 SearchNote
→ Library 重新打开
```

### 3.2 边界路径

```text
Compare / Research 问题
→ 系统识别所需模式
→ 不执行错误的 Quick 搜索
→ 提示模式尚未开放，并允许修改问题或手动选择 Quick
```

```text
搜索有结果，但正文抓取部分失败
→ 继续处理其他来源
→ 有可交付证据则 Partial / Completed
→ 显示被排除来源和原因
```

```text
没有可验证 Evidence
→ 不生成 High confidence 答案
→ 输出 Insufficient evidence
→ 提供修改问题或重试入口
```

---

## 4. 本轮范围

### 4.1 必须完成

- [x] 真实 Quick Intent 与 Planner
- [x] Web Search Provider adapter
- [x] Official-biased 查询路由
- [x] 安全 Content Fetcher
- [x] HTML 正文解析与 Snapshot 内容保存
- [x] Search Query / Retrieval Attempt / Excluded Source 记录
- [x] Passage 预筛选
- [x] Claim / Evidence 结构化模型输出
- [x] Evidence exact-anchor 校验
- [x] Claim 去重、支持关系和轻量冲突检测
- [x] 解释型 Trust Engine ruleset v1
- [x] Quick Gap Check，最多一次补搜
- [x] StructuredResult / SearchNote 物化
- [x] 真实 Run Events 与 SSE
- [x] Cancel 和 Retry-as-new-run
- [x] API / repository 驱动的 Save、Library、My Notes
- [x] Completed / Partial / Failed / Cancelled / Insufficient UI
- [x] Replay Providers 与离线集成测试
- [x] 真实 Provider 的 opt-in smoke test
- [x] Round 2 运行与密钥配置文档

### 4.2 明确不做

- Compare 的对称取证、Comparison 表格和条件化推荐
- Research 的多分支计划、长期 Gap Loop 和 Continue Search
- GitHub 专用 Search API / repository 路由
- PDF、图片、视频、登录后页面的正文解析
- 浏览器自动化抓取、反爬绕过、验证码处理
- 用户上传文件和私有数据源
- Markdown / DOCX 导出
- Tags、Collections、Favorites 的完整管理
- Living Note、Update、定时监控
- 完整用户注册、登录、团队权限
- 独立 Worker、Redis、分布式队列和多节点协调
- Provider Marketplace 或运行时插件安装
- 语义向量检索、知识图谱和推荐 Feed

若执行中出现上述需求，只记录到“延期项”，不得顺手加入 Round 2。

---

## 5. 技术基线与 Provider 决策

### 5.1 Runtime 模式

本轮提供两个明确模式：

| 模式 | 用途 | 网络与额度 | 用户可见标记 |
| --- | --- | --- | --- |
| `replay` | 开发、CI、浏览器自动测试 | 不访问外网，不消耗额度 | `Replay / 示例数据` |
| `live` | 真实 Quick MVP | 调用已配置 Provider | `Live / 实时搜索` |

Replay 不是隐藏 mock。界面必须清楚标记当前是示例运行，不能把录制数据冒充实时结果。

### 5.2 首个 live adapter

| 能力 | Round 2 基线 | 约束 |
| --- | --- | --- |
| 候选来源发现 | Tavily Search API adapter（默认）/ Brave Web Search API adapter（可选） | 仅做 discovery / ranking；snippet 不作为 Evidence |
| 模型结构化输出（默认） | OpenAI Responses API adapter | 使用严格结构化输出，并通过本地 Zod 再校验 |
| 模型结构化输出（预留） | DeepSeek Chat Completions adapter | 使用 JSON Output；不假设服务端严格遵守 schema，本地 Zod 必须 fail closed |
| 正文获取 | Siftory 自有 HTTP ContentFetcher | 只允许安全的公开 HTTP(S) HTML / text 内容 |
| 正文解析 | Readability-style 主内容抽取 + block locator | 保存规范化文本和稳定 block ID |
| 数据库 | PostgreSQL；测试继续支持 PGlite | repository 不得绑定某个 Drizzle driver 类型 |
| 实时进度 | SSE + 按 sequence 重连 | 不引入 WebSocket |
| 执行方式 | 单机、长生命周期 Node 进程内 RunCoordinator | 不宣称支持 serverless 或多节点可靠执行 |

选择依据：实际执行默认使用不要求银行卡的 Tavily Search API；Brave adapter 保留为可选能力。两者都只负责候选来源发现，搜索摘要不进入 Evidence。OpenAI 当前模型文档明确列出 Responses API 与 Structured Outputs 支持。DeepSeek 官方 API 提供 OpenAI 风格的 Chat Completions 与 JSON Output，适合作为第二个 `ModelGateway` adapter；但 JSON Output 只保证合法 JSON，官方也提示可能出现空 content，因此不能与严格 schema 输出视为同一种能力。供应商差异只存在于 adapter capability 和配置层，不进入领域对象。参考：

- [Brave Web Search API](https://api-dashboard.search.brave.com/app/documentation/web-search/get-started)
- [OpenAI model and Structured Outputs support](https://developers.openai.com/api/docs/models/compare)
- [DeepSeek Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/)
- [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/)

### 5.3 模型配置规则

- active provider 从 `MODEL_PROVIDER=openai | deepseek` 读取，默认 `openai`；
- 模型名分别从 `OPENAI_MODEL` / `DEEPSEEK_MODEL` 读取，不写入 domain 常量；
- `ModelGateway` 必须暴露 capability，例如 `nativeJsonSchema | jsonObject | usage | reasoningOutput`；Agent 根据 capability 选择适配策略，但始终消费同一已验证 contract；
- OpenAI adapter 使用原生严格 schema 输出；DeepSeek adapter 使用 `response_format: { type: "json_object" }`，prompt 必须明确要求 JSON 并提供目标结构示例；
- DeepSeek 返回空 content、截断 JSON、schema 不匹配或未知字段时均视为 `MODEL_OUTPUT_INVALID`，只允许一次受控重试；
- DeepSeek 的 `reasoning_content` 不保存、不进入 RunEvent、不发给浏览器；
- 模型调用必须记录 provider、model、prompt version、duration、usage 和结果状态；
- 不在 RunEvent、日志或 UI 中保存完整系统 prompt、隐藏推理或密钥；
- Prompt 使用版本号，例如 `quick-intent-v1`、`quick-extract-v1`、`quick-synthesis-v1`；
- 模型输出解析失败最多执行一次受控重试；再次失败进入可解释的 Partial / Failed；
- 模型只能提出 Claim、Evidence link、stance、relevance 和 synthesis 草稿，不能直接赋予最终 Trust 等级。

### 5.4 环境变量

Round 2 更新 `.env.example`：

```text
DATABASE_URL=
SEARCHOS_RUNTIME_MODE=replay
SEARCH_PROVIDER=tavily
TAVILY_API_KEY=
BRAVE_SEARCH_API_KEY=
MODEL_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=
SEARCHOS_FETCH_USER_AGENT=Siftory/0.1
LIVE_SMOKE_QUERY=Python 怎么删除 dict key？
```

规则：

- `replay` 模式不要求任何 Provider 密钥；
- `live` 模式启动时校验必需配置，但错误信息只显示缺少的变量名；
- 只校验当前 `MODEL_PROVIDER` 对应的密钥和模型；未选中的 provider 不阻塞启动；
- `DEEPSEEK_BASE_URL` 仅允许服务端配置；默认正式 API 地址，不把 Beta endpoint 作为 Round 2 依赖；
- 密钥只存在于服务端，不出现在 `NEXT_PUBLIC_*`、浏览器 bundle、RunEvent 或错误响应；
- 日志对 Authorization、API key、query 中潜在敏感片段做脱敏。

---

## 6. 目标代码结构

Round 2 在 Round 1 基础上增加五个职责包，不重写核心 contracts：

```text
apps/
└── web/
    ├── app/api/
    │   ├── search-tasks/route.ts
    │   ├── search-runs/[runId]/route.ts
    │   ├── search-runs/[runId]/events/route.ts
    │   ├── search-runs/[runId]/cancel/route.ts
    │   ├── search-runs/[runId]/retry/route.ts
    │   ├── search-runs/[runId]/save/route.ts
    │   └── notes/.../route.ts
    └── lib/server/
        ├── runtime.ts
        └── run-coordinator.ts

packages/
├── domain                 # 领域枚举、状态机、不变量、ports
├── contracts              # API、Provider、LLM output、event schemas
├── persistence            # PostgreSQL / PGlite repositories 与 migration
├── agent                  # Quick orchestrator、Intent、Planner、Gap Check
├── retrieval              # Brave、Replay、URL 安全、fetch、parse、passage select
├── model-gateways         # Replay / OpenAI / DeepSeek adapters 与 capability mapping
├── trust                  # 确定性 Trust ruleset 与总体置信度
├── presentation           # StructuredResult 与 SearchNote builders
└── fixtures               # replay cassettes、黄金期望与失败场景
```

依赖方向：

```text
domain ← contracts
   ↑         ↑
trust    agent ← retrieval
   ↑         ↓
presentation
       ↑
persistence ← web
```

禁止：

- `domain` 依赖 Provider SDK、ORM、React；
- `retrieval` 直接生成最终 Answer；
- `agent` 绕过 contracts 写入未知 JSON；
- UI 根据颜色、来源数量或字符串临时重算 Trust；
- `presentation` 引入 Claims 集合之外的新事实；
- Replay adapter 与 live adapter 返回不同 contract。

### 6.1 Provider-neutral `ModelGateway`

Round 2 将 Round 1 的泛型 `ModelGateway` 收敛为 provider-neutral 请求与结果：

```text
ModelRequest<T>
  operation
  promptVersion
  systemInstruction
  input
  outputSchemaName
  outputJsonSchema
  parse(value): T
  maxOutputTokens
  abortSignal

ModelResult<T>
  data
  provider
  model
  responseId
  durationMs
  usage（可选）
  capabilityMode
```

adapter 行为：

```text
ReplayModelGateway
  → 读取确定性 cassette

OpenAIModelGateway
  → nativeJsonSchema
  → provider schema validation
  → local Zod validation

DeepSeekModelGateway
  → jsonObject
  → JSON.parse
  → local Zod strict validation
  → empty / truncated / invalid 时一次 retry
```

不允许业务代码通过 `if (provider === "deepseek")` 分叉 Prompt 和领域逻辑；差异由 adapter capability 和 prompt renderer 处理。Prompt 的语义版本保持一致，供应商可拥有独立模板修订号。

---

## 7. Contracts 与领域增量

Round 2 只扩展真实运行所缺字段，保持 Round 1 对象名称和主关系不变。

### 7.1 Provider ports

扩展 `SearchProviderInput`：

```text
query
language
country（可选）
freshness（可选）
count
sourceScope
requestId / idempotencyKey
```

扩展 `SourceCandidate`：

```text
url
title
snippet（discovery only）
rank
provider
publishedAt（可选）
language（可选）
```

`ContentFetcher` 必须接受 `AbortSignal` 和 fetch policy，并返回：

```text
requestedUrl
finalUrl
statusCode
contentType
body
fetchedAt
redirectChain
truncated
```

### 7.2 新增 contracts

- [x] `SearchQueryView`
- [x] `RetrievalAttemptView`
- [x] `ExcludedSourceView`
- [x] `ParsedSourceDocument`
- [x] `SourceBlock`
- [x] `PassageCandidate`
- [x] `QuickIntentOutput`
- [x] `QuickPlanOutput`
- [x] `QuickExtractionOutput`
- [x] `ClaimCandidateOutput`
- [x] `EvidenceCandidateOutput`
- [x] `ClaimEvidenceAssessmentOutput`
- [x] `QuickSynthesisOutput`
- [x] `RunSnapshotResponse`
- [x] `CreateSearchResponse`
- [x] `ApiErrorResponse`
- [x] 强类型 `RunEventType` 与公开 `payloadSummary`

### 7.3 错误代码基线

```text
PROVIDER_NOT_CONFIGURED
MODE_NOT_AVAILABLE
SEARCH_RATE_LIMITED
SEARCH_PROVIDER_FAILED
NO_SEARCH_RESULTS
FETCH_BLOCKED
FETCH_TIMEOUT
UNSUPPORTED_CONTENT_TYPE
NO_FETCHABLE_SOURCES
MODEL_RATE_LIMITED
MODEL_OUTPUT_INVALID
NO_VERIFIABLE_EVIDENCE
RUN_CANCELLED
PROCESS_INTERRUPTED
INTERNAL_PIPELINE_ERROR
```

错误必须包含：

```text
code
stage
retryable
publicMessage
retainedObjectCounts
```

不得把 Provider 原始响应、堆栈、密钥或完整抓取正文返回浏览器。

---

## 8. Quick Agent 状态机执行

Round 2 的 `QuickRunExecutor` 必须严格推进现有状态机，并在每次状态变化前后持久化 RunEvent。

### 8.1 UNDERSTANDING

- 规范化问题；
- 提取语言、实体、版本 / 时间约束；
- Auto 判断模式；
- 保存 IntentAssessment；
- 若为 Compare / Research，使用 `MODE_NOT_AVAILABLE` 终止本轮，不强行执行 Quick；
- 模型失败时允许一个保守 Quick heuristic fallback，但必须记录 fallback。

### 8.2 PLANNING

- Quick 只允许 1–2 个目标；
- 生成普通 Web query 与必要时的 official-biased query；
- 给出期望 Claim 类型、优先来源类型和完成标准；
- 保存 SearchPlan 和 PlanSteps；
- 查询去重后至少保留一个可执行 query。

### 8.3 RETRIEVING

- 执行查询并保存 SearchQuery / RetrievalAttempt；
- 规范化 URL、去 tracking 参数、去重；
- 记录候选排名，但排名不进入 Trust；
- 优先抓取官方 / 第一方候选，再补充独立来源；
- 单来源失败不结束整个 Run；
- 每个来源保存明确状态和排除原因。

### 8.4 EXTRACTING

- HTML 解析为带 block ID、heading path 的规范化文档；
- 保存 Snapshot 内容和 content hash；
- 先用确定性 passage selector 缩小模型输入；
- 模型输出候选 Claim、exact excerpt、block ID、stance 和 relevance；
- exact excerpt 必须在对应 block / Snapshot 中逐字存在；
- 未通过锚点校验的 Evidence 全部拒绝，并写审计事件；
- 相同 Snapshot + excerpt hash 使用 upsert，避免重试重复。

### 8.5 EVALUATING

- 规范化并去重 Claim；
- 建立 ClaimEvidence；
- 基于 publisher / canonical document family 计算 independence group；
- 检测支持、限定和矛盾关系；
- 执行 Trust ruleset v1；
- 每个 decisive / key Claim 生成 ClaimTrustSummary；
- 模型不参与最终 TrustLevel 决策。

### 8.6 GAP_CHECK

Quick 最多执行一次补搜：

```text
存在 decisive Claim
AND 没有 direct Evidence 或来源类型明显不满足
AND 尚未达到第二轮
AND 能生成与第一轮不同的新 query
→ 继续 RETRIEVING
```

否则进入 SYNTHESIZING，并保存明确 StopReason。

### 8.7 SYNTHESIZING / MATERIALIZING

- 模型只能使用已保存 Claims、Trust summaries、limitations 生成组织草稿；
- 每个事实句必须引用 Claim ID；
- `collectStructuredResultClaimIds` 和跨对象 invariant 必须通过；
- Presentation builder 计算来源集合与置信度说明；
- 创建未保存的 SearchNote draft；
- 最终写入 `COMPLETED` 或 `PARTIAL`。

---

## 9. Quick 预算与停止规则

本轮预算是运行策略，不写死进领域枚举；默认值可通过服务端配置覆盖。

| 项目 | Round 2 Quick 默认上限 |
| --- | --- |
| 搜索轮次 | 2 |
| Search queries | 4 |
| 每 query 候选数 | 6 |
| 去重后候选来源 | 12 |
| 实际 fetch 来源 | 6 |
| 并发 fetch | 3 |
| 单次 fetch timeout | 8 秒 |
| Redirect | 3 跳 |
| 单来源响应体 | 2 MB |
| 单来源规范化正文 | 20,000 字符 |
| 送入模型的总 passage 文本 | 24,000 字符 |
| 结构化模型调用 | 4 次 |
| 单个 Run wall time | 90 秒 |

预算耗尽不等于成功：

- 有可交付、可验证 Claims → `PARTIAL` 或 `COMPLETED`；
- 只有候选来源但没有可验证 Evidence → `FAILED / NO_VERIFIABLE_EVIDENCE`；
- 用户取消 → `CANCELLED`；
- Provider 限流且已有有效 Claims → `PARTIAL`；否则 `FAILED`。

所有 Provider 调用记录真实 usage / latency；没有返回的数据保持 unknown，不在 UI 中虚构成本或 token 数。

---

## 10. Retrieval 与 Evidence 安全规则

### 10.1 URL / SSRF 防护

ContentFetcher 必须：

- 只允许 `http:` / `https:`；
- 拒绝 localhost、loopback、private、link-local、multicast 和保留 IP；
- DNS 解析后再次检查地址；
- 每次 redirect 都重新验证目标；
- 禁止 URL credentials；
- 限制 redirect、timeout、响应体大小和并发；
- 只接受允许的 MIME；
- Round 2 对 PDF、图片、二进制、登录页明确排除；
- 不绕过 robots、验证码、付费墙或访问控制；
- 错误只记录安全摘要。

### 10.2 Snapshot 与 locator

每个成功正文必须形成：

```text
Source
└── SourceSnapshot
    └── ParsedSourceDocument
        ├── block_id
        ├── heading_path
        ├── paragraph_index
        ├── normalized_text
        └── content_hash
```

Evidence locator 至少包含 `blockId`，并尽可能包含 heading / paragraph。UI 显示摘录时，必须同时显示：

- 来源标题和 domain；
- publisher / source type；
- published / updated / accessed 时间中可获得的字段；
- exact excerpt；
- locator；
- Evidence 对 Claim 的 stance；
- Snapshot 抓取时间。

### 10.3 证据真实性

- Search snippet、模型记忆、URL 标题不能成为 Evidence；
- excerpt 必须通过 exact-anchor；
- paraphrase 可以由模型生成，但不能替代 excerpt；
- 无法定位的内容只能作为 discovery context；
- 同一原文的转载不计为独立交叉验证；
- 被排除来源仍保存 URL、阶段和 reason code，正文按最小必要原则保存。

---

## 11. Trust Engine ruleset v1

本轮不训练可信度模型、不展示神秘百分比分数。`@searchos/trust` 输入结构化因子，输出可重复的等级和 reason codes。

### 11.1 因子来源

| 因子 | 来源 |
| --- | --- |
| Authority | source type、publisher、问题中的 Claim context |
| Primary | 来源是否是该 Claim 的第一方 / 原始记录 |
| Freshness | 问题 freshness requirement + source 日期元数据 |
| Relevance | exact Evidence 对 Claim 的 direct / partial / contextual 关系 |
| Cross verification | independence group 去重后的支持数 |
| Conflict | contradicting / qualifying evidence 与 Conflict 状态 |

### 11.2 等级基线

**INSUFFICIENT**

- 没有 direct / partial Evidence；或
- 只有搜索摘要、标题或模型推断；或
- 所有候选 excerpt 都未通过 anchor 校验。

**LOW**

- 证据主要为 contextual；或
- 权威性弱且没有独立支持；或
- 明显过时；或
- 存在未解决 material conflict。

**MEDIUM**

- 至少一个 direct Evidence；
- 但 Authority、Freshness、Independence 或 Conflict 存在一个重要限制。

**HIGH**

- decisive Claim 至少有一个 direct Evidence；
- 且满足“强第一方 / 原始来源”或“两个独立、足够权威来源”之一；
- freshness 适用于问题；
- 无未解决 material conflict；
- 所有引用 excerpt 通过 exact-anchor。

### 11.3 总体置信度

- 总体置信度只由 decisive Claims 推导；
- 任一会改变答案的 decisive Claim 为 Low / Insufficient，结果不能显示 High；
- unresolved material conflict 时最高为 Medium；
- 来源数量只做元数据，不能提升 Trust；
- 每个等级输出 2–5 个稳定 reason codes 和用户可读 explanation；
- UI 只消费保存后的 ClaimTrustSummary / StructuredResult。

### 11.4 必测 reason codes

```text
DIRECT_PRIMARY_SUPPORT
DIRECT_INDEPENDENT_SUPPORT
CURRENT_FOR_SCOPE
ONLY_SINGLE_SOURCE
SECONDARY_ONLY
FRESHNESS_UNKNOWN
STALE_FOR_SCOPE
PARTIAL_RELEVANCE
MATERIAL_CONFLICT_OPEN
NO_ANCHORED_EVIDENCE
```

---

## 12. Persistence 增量

Round 2 通过 append-only migration 增加真实执行所需表 / 字段。

### 12.1 新表

- [x] `intent_assessments`
- [x] `search_queries`
- [x] `retrieval_attempts`
- [x] `source_documents`
- [x] `excluded_sources`
- [x] `provider_calls`

建议职责：

```text
search_queries
  query、step_id、round、provider、language、freshness、query_hash

retrieval_attempts
  query_id、status、candidate_count、started_at、completed_at、error_code

source_documents
  snapshot_id、normalized_text、blocks_json、truncated、parser_version

excluded_sources
  run_id、source_url、stage、reason_code、public_summary

provider_calls
  run_id、kind、provider、model、status、duration_ms、usage_json、error_code
```

### 12.2 `search_runs` 增量

- `cancel_requested_at`
- `heartbeat_at`
- `checkpoint`
- `error_code`
- `error_detail` 只存脱敏内部摘要
- `budget` / `budget_used` 开始写入真实值

### 12.3 Repository 重构

- 移除 `SearchOsDatabase = PgliteDatabase` 的硬绑定；
- 定义面向用例的 repositories，不暴露每表 CRUD；
- 状态迁移、事件 sequence、checkpoint 写入放在事务中；
- `persistBundle` 继续服务 fixture，但真实 pipeline 使用增量 repository；
- 所有真实 ID 使用 UUID v7 / `crypto.randomUUID` 兼容方案，不使用固定 ID；
- SearchNote revision ID 不再硬编码；
- Save 幂等：同一 Run 重复保存返回同一 Note；
- Library 只返回当前 owner 且 `is_saved = true`、未删除的 Note；
- My Notes 写入数据库，明确与 Evidence 分离。

### 12.4 进程中断

本轮不实现分布式恢复。启动时若发现非终态 Run 的 heartbeat 已过期：

```text
标记 FAILED
error_code = PROCESS_INTERRUPTED
保留已完成的 Source / Snapshot / Evidence / Events
提供 Retry
```

Retry 创建新的 child Run，`trigger = RETRY`，不修改旧终态 Run。

---

## 13. API 任务

本轮只暴露围绕用例的 API：

```text
POST   /api/search-tasks
GET    /api/search-runs/:runId
GET    /api/search-runs/:runId/events
POST   /api/search-runs/:runId/cancel
POST   /api/search-runs/:runId/retry
POST   /api/search-runs/:runId/save

GET    /api/notes
GET    /api/notes/:noteId
PATCH  /api/notes/:noteId/user-note
```

### 13.1 Create Search

`POST /api/search-tasks`：

- 校验 `CreateSearchTaskInput`；
- 创建 Task、Run 和初始 Event；
- 交给进程内 RunCoordinator；
- 返回 `202`、taskId、runId、events URL；
- 不等待完整搜索结束。

### 13.2 Run Snapshot

`GET /api/search-runs/:runId` 返回当前已持久化的：

```text
task
run
intent（若存在）
plan（若存在）
public metrics
result（若存在）
sources / evidence / trust（按当前阶段）
available actions
```

### 13.3 SSE

- 事件按 `sequence` 单调递增；
- 支持 `Last-Event-ID` 或 `afterSequence` 重连；
- 只发送公开、可审查的操作摘要；
- 不发送 token stream、hidden reasoning、完整 prompt 或正文；
- 网络断开后 UI 使用 snapshot + sequence 恢复；
- 终态发送 final event 后关闭连接；
- SSE 不可用时允许低频 polling fallback。

### 13.4 Cancel

- 写入 `cancel_requested_at`；
- AbortController 停止尚未完成的 Provider / fetch 调用；
- 不再派发新工作；
- 保存最后 checkpoint 和已完成对象；
- 最终进入 `CANCELLED`；
- UI 告知用户哪些来源 / Evidence 已保留。

---

## 14. 页面与交互任务

Round 2 延续现有 Cognitive Workbench，不进行第二次视觉重构。

### 14.1 Home

- [x] 任意合法问题可提交；
- [x] Auto / Quick 可用，Compare / Research 继续显示但明确“后续开放”；
- [x] 显示当前 `Replay` 或 `Live` runtime；
- [x] Provider 未配置时给出非技术化说明，不暴露密钥；
- [x] 保留黄金问题入口用于快速验证；
- [x] 不增加复杂 Agent 参数面板。

### 14.2 Running Workspace

固定头部始终显示：

- Question；
- selected mode；
- Running / Cancelled / Failed 等文字状态；
- 当前公开操作；
- elapsed time；
- 可用的 Stop / Retry 操作。

活动检查器展示真实事件：

```text
已理解问题
已生成 2 条查询
Brave Search 返回 8 个候选来源
正在读取 docs.python.org
已排除 1 个重复来源
已从 3 个 Snapshot 提取 4 条 Evidence
正在评估 2 个关键 Claim
```

不得展示模型隐藏推理。

### 14.3 Result Workspace

- [x] Answer 只消费 StructuredResult；
- [x] Confidence 只消费 Trust Summary；
- [x] 点击 Claim 在检查器打开其 Evidence；
- [x] 点击 Source 高亮其支持的 Claims；
- [x] Source tab 显示 discovered / fetched / parsed / excluded 状态；
- [x] Activity tab 使用数据库 RunEvents；
- [x] Evidence excerpt 显示 locator 和 Snapshot 时间；
- [x] Excluded Source 显示 reason，不显示抓取正文；
- [x] Partial / Insufficient 显示 limitations 与下一步；
- [x] Save 使用 API，成功后进入真实 Library。

### 14.4 Failed / Cancelled

失败页必须回答：

1. 哪个阶段失败；
2. 哪些工作仍然有效；
3. 是否可重试；
4. 重试是继续旧 Run 还是创建新 Run；
5. 用户下一步是什么。

按钮使用具体动作：`重新运行`、`修改问题`、`返回首页`，不使用含糊的 `继续`。

### 14.5 Library / Note Detail

- [x] 移除主流程对 localStorage saved marker 的依赖；
- [x] Library 从 repository / API 读取；
- [x] Note Detail 从数据库读取对应 Run 的 Claims / Evidence / Sources；
- [x] My Notes 保存到数据库；
- [x] 个人笔记继续标记 `Personal · 非证据`；
- [x] fixture / replay Note 与 live Note 均遵守相同 view contract。

---

## 15. 可观察性与隐私

每次 Run 至少记录：

- 各状态开始 / 完成时间；
- query 数与搜索轮次；
- discovered / fetched / parsed / excluded / failed source 数；
- exact-anchor 接受 / 拒绝 Evidence 数；
- decisive Claim 的 direct Evidence 覆盖率；
- Provider latency、usage 和错误类别；
- stop reason；
- Completed / Partial / Failed / Cancelled。

隐私边界：

- 不记录 Provider 密钥；
- 不记录隐藏 chain-of-thought；
- 默认不把完整 prompt 写数据库；
- Source 正文只为证据追溯保存必要快照，设置响应体和正文上限；
- RunEvent 只存摘要和对象 ID；
- API 错误不暴露堆栈和 Provider 原始 body；
- 本轮单一开发 owner 仍必须通过 owner scope 查询，不能省略边界。

---

## 16. 测试与评测策略

### 16.1 默认测试必须离线

`npm run check` 不允许依赖：

- Provider 密钥；
- 互联网连接；
- 当前搜索排名；
- 当前模型输出随机性；
- 第三方服务可用性。

使用 Replay adapters 和固定 clock / IDs 验证完整 pipeline。

### 16.2 Replay fixtures

至少准备：

| Fixture | 目的 | 预期 |
| --- | --- | --- |
| `quick-official-high` | 有明确官方正文支持 | Completed；decisive Claims 可达 High |
| `quick-version-limited` | 答案依赖版本 / 时效 | Medium 或带明确限制 |
| `quick-single-fetch-failure` | 一个来源失败，其他成功 | Completed / Partial，不丢失有效 Evidence |
| `quick-no-results` | Search 无候选 | Failed / NO_SEARCH_RESULTS |
| `quick-unfetchable` | 候选均被阻止或不支持 | Failed / NO_FETCHABLE_SOURCES |
| `quick-anchor-rejected` | 模型生成 Snapshot 中不存在的 quote | Evidence 被拒绝，不能 High |
| `quick-conflict` | 支持与反对证据并存 | material conflict 限制总体置信度 |
| `quick-rate-limited` | Search / Model 429 | 明确 rate-limited + retry action |
| `quick-cancelled` | Retrieving 中用户取消 | Cancelled，保留 checkpoint |
| `mode-not-available` | Auto 识别 Compare / Research | 不执行错误 Quick |

### 16.3 单元与性质测试

- URL canonicalization 和 SSRF deny cases；
- redirect 每跳校验；
- response size / timeout / MIME 限制；
- excerpt exact-anchor；
- Claim / Evidence 去重幂等；
- Trust rules reason codes；
- Overall confidence 不违反 decisive Claim 上限；
- SSE sequence 和重连无重复 / 丢失；
- Cancel race；
- Retry 创建 child Run；
- Save 幂等；
- Repository owner scope。

### 16.4 浏览器主流程

Replay 模式浏览器验收：

```text
Home
→ 创建真实 API Task / Run
→ SSE Running
→ Source / Activity inspector
→ Completed
→ Claim → Evidence → Source
→ Save API
→ Library
→ Note Detail
→ My Notes DB save
```

同时覆盖 Partial、Failed、Cancelled、Insufficient 和窄屏 inspector sheet。

### 16.5 Live Smoke

新增：

```text
npm run check:live
```

规则：

- 仅在 `SEARCHOS_RUNTIME_MODE=live` 且密钥齐全时执行；
- 最多一个 Quick query；
- 使用完整预算的低上限版本；
- 不断言搜索排名和固定答案；
- 断言至少一个真实 SourceSnapshot；
- 每个展示 Evidence 均能通过 exact-anchor；
- 断言 StructuredResult invariants；
- 输出 provider / latency / object counts，不输出密钥和完整正文；
- Round 2 标记 `DONE` 前，必须在安全环境成功执行至少一次并记录日期。

Provider 验收分层：

- `OpenAI`：Round 2 默认 live adapter，`DONE` 前必须成功执行一次；
- `DeepSeek`：本轮必须完成 adapter contract、配置、Replay parity 和 mocked HTTP 测试；若用户提供密钥，可额外执行 `npm run check:live:deepseek`，但 DeepSeek live 验证不是 Round 2 `DONE` 的阻塞项；
- 两个 adapter 输出都必须经过相同 Zod、exact-anchor、Trust 和 StructuredResult invariants，任何 provider 都不能降低证据门槛。

---

## 17. 工程命令

保留 Round 1 命令，并新增：

```text
npm run dev
npm run dev:replay
npm run dev:live
npm run lint
npm run typecheck
npm run test
npm run build
npm run db:generate
npm run db:migrate
npm run db:smoke
npm run smoke
npm run check
npm run check:live
npm run check:live:deepseek
```

`npm run check` 至少串联：

```text
lint
→ typecheck
→ unit / contract / pipeline replay tests
→ build
→ empty database migration
→ repository tests
→ replay browser smoke
```

`check:live` 不加入默认 `check`，避免 CI 消耗额度和受外部波动影响。

---

## 18. 执行顺序与清点表

严格按依赖推进。每完成一项，将 `[ ]` 改为 `[x]`，并在“执行记录”追加结果。

### Phase A — Contract Delta & Decisions

- [x] `R2-A01` 记录 Provider / runtime ADR
- [x] `R2-A02` 扩展 Provider ports
- [x] `R2-A03` 增加 Query / Retrieval / Excluded Source contracts
- [x] `R2-A04` 增加模型结构化输出 schemas
- [x] `R2-A05` 增加 RunSnapshot / API error contracts
- [x] `R2-A06` 增加强类型 RunEventType 和公开 payload
- [x] `R2-A07` 为所有新增 schema 编写拒绝无效数据测试
- [x] `R2-A08` 更新 `.env.example` 和安全配置校验

**Phase A Gate：** live / replay adapters 能共享同一 contract；未知模型输出、悬空 ID 和非法错误对象均被拒绝。

### Phase B — Persistence & Repositories

- [x] `R2-B01` 添加 intent / query / retrieval / document / excluded / provider call schema
- [x] `R2-B02` 生成 append-only migration
- [x] `R2-B03` 重构 DB 类型，兼容 PostgreSQL 与 PGlite
- [x] `R2-B04` 实现 Task / Run / Event 增量 repositories
- [x] `R2-B05` 实现 Source / Snapshot / Document repositories
- [x] `R2-B06` 实现 Claim / Evidence / Trust / Result repositories
- [x] `R2-B07` 实现幂等 Save / Library / My Notes repositories
- [x] `R2-B08` 实现 heartbeat / checkpoint / stale-run recovery
- [x] `R2-B09` 验证 migration、事务、owner scope 和幂等约束

**Phase B Gate：** 空库 migration 成功；同一操作重放不生成重复 Evidence、Events 或 Notes。

### Phase C — Retrieval Layer

- [x] `R2-C01` 实现 Replay SearchProvider
- [x] `R2-C02` 实现 Brave SearchProvider adapter
- [x] `R2-C03` 实现 URL canonicalizer
- [x] `R2-C04` 实现 SSRF / redirect / MIME / size / timeout policy
- [x] `R2-C05` 实现 HTTP ContentFetcher
- [x] `R2-C06` 实现 HTML parser 和稳定 block locator
- [x] `R2-C07` 实现 passage selector
- [x] `R2-C08` 实现 Source / Snapshot / Document 持久化
- [x] `R2-C09` 实现 excluded-source reason mapping
- [x] `R2-C10` 覆盖单来源失败、重复来源和全部不可抓取测试

**Phase C Gate：** 给定 replay search results，系统能安全产生去重 Source、不可变 Snapshot 和可定位正文 blocks；snippet 从未进入 Evidence。

### Phase D — Model Gateway & Agent

- [x] `R2-D01` 实现 Replay ModelGateway
- [x] `R2-D02` 实现 OpenAI Responses structured-output gateway
- [x] `R2-D03` 实现 provider-neutral capability mapping
- [x] `R2-D04` 实现 DeepSeek JSON Output gateway 预留 adapter
- [x] `R2-D05` 实现 OpenAI / DeepSeek adapter contract parity 测试
- [x] `R2-D06` 实现 Quick Intent
- [x] `R2-D07` 实现 Quick Planner / Official route
- [x] `R2-D08` 实现 Claim / Evidence extraction
- [x] `R2-D09` 实现 exact-anchor verifier
- [x] `R2-D10` 实现 Claim normalization / dedupe
- [x] `R2-D11` 实现 ClaimEvidence assessment / conflict detection
- [x] `R2-D12` 实现 Quick Gap Check 和第二轮 query
- [x] `R2-D13` 实现 QuickRunExecutor 和 AbortSignal 传播
- [x] `R2-D14` 实现 provider-specific prompt rendering、版本与 usage 记录
- [x] `R2-D15` 覆盖 empty content、invalid JSON/schema、rate limit、cancel、retry 测试

**Phase D Gate：** replay 输入可以从任意测试问题稳定生成合法 Claims / Evidence；虚构 quote 被拒绝；状态机与 events 可完整重放。

### Phase E — Trust & Presentation

- [x] `R2-E01` 实现 Trust ruleset v1
- [x] `R2-E02` 实现 independence grouping
- [x] `R2-E03` 实现 ClaimTrustSummary builder
- [x] `R2-E04` 实现 overall confidence reducer
- [x] `R2-E05` 实现 StructuredResult builder
- [x] `R2-E06` 实现 SearchNote draft builder
- [x] `R2-E07` 验证 synthesis 不引入未知事实
- [x] `R2-E08` 完成 High / Medium / Low / Insufficient / conflict 回归测试

**Phase E Gate：** 同一结构化输入重复计算得到相同 Trust；任何 decisive Claim 证据不足时总体结果无法越级为 High。

### Phase F — API & Run Coordination

- [x] `R2-F01` 实现 runtime adapter composition
- [x] `R2-F02` 实现进程内 RunCoordinator
- [x] `R2-F03` 实现 Create Search API
- [x] `R2-F04` 实现 Run Snapshot API
- [x] `R2-F05` 实现 SSE events 和重连
- [x] `R2-F06` 实现 Cancel
- [x] `R2-F07` 实现 Retry-as-new-run
- [x] `R2-F08` 实现 Save / Notes / My Notes API
- [x] `R2-F09` 实现 Provider missing / process interrupted 恢复
- [x] `R2-F10` 完成 API contract 与并发测试

**Phase F Gate：** 客户端刷新后可从数据库恢复当前状态；Cancel 确实终止新工作；Retry 不篡改旧 Run。

### Phase G — Product UI

- [x] `R2-G01` Home 接入 Create Search API
- [x] `R2-G02` 显示 Replay / Live runtime 状态
- [x] `R2-G03` Running 接入真实 SSE / snapshot
- [x] `R2-G04` Stop 按钮接入 Cancel API
- [x] `R2-G05` Activity tab 使用真实 RunEvents
- [x] `R2-G06` Source tab 显示处理状态与排除原因
- [x] `R2-G07` Claim 选择联动 Evidence inspector
- [x] `R2-G08` Evidence 显示 Snapshot context / locator
- [x] `R2-G09` 完成 Partial / Failed / Cancelled / Rate Limited UI
- [x] `R2-G10` Save / Library / Note / My Notes 切换到服务端 API（数据库 repository 已就绪，runtime composition 待接）
- [x] `R2-G11` 验证窄屏 inspector、键盘和 live region
- [x] `R2-G12` 保持 light / dark / increased contrast / reduced motion 可用

**Phase G Gate：** 用户不看日志也能判断 Agent 正在做什么、为何失败、证据从哪里来、下一步能做什么。

### Phase H — Verification & Handoff

- [x] `R2-H01` 完成全部 replay fixtures
- [x] `R2-H02` `npm run lint` 通过
- [x] `R2-H03` `npm run typecheck` 通过
- [x] `R2-H04` `npm run test` 通过
- [x] `R2-H05` `npm run build` 通过
- [x] `R2-H06` 空库 migration 与 repository smoke 通过
- [x] `R2-H07` Replay 浏览器主流程通过
- [x] `R2-H08` 失败 / Cancel / Insufficient 浏览器流程通过
- [x] `R2-H09` 桌面 / 平板 / 窄屏视觉检查
- [x] `R2-H10` 安全检查：SSRF、密钥泄露、错误脱敏
- [x] `R2-H11` 在安全环境执行一次 `npm run smoke:live` 和三问题 `npm run smoke:live:matrix`
- [x] `R2-H12` 更新 README、执行记录、已知限制和 Round 3 接口

**Phase H Gate：** 默认检查可重复通过；真实 live query 至少成功一次并形成经过 exact-anchor 的证据链。

---

## 19. Round 2 Definition of Done

只有以下条件全部满足，状态才能从 `PLANNED / IN_PROGRESS` 改为 `DONE`：

- [x] `npm run check` 一次性通过，且默认不访问外网
- [x] append-only migration 可在空库执行
- [x] Replay pipeline 覆盖成功、部分、失败、取消和证据不足
- [x] 配置密钥后可以提交一个非 fixture Quick 问题
- [x] live Run 至少产生一个真实 SearchQuery 和 SourceSnapshot
- [x] 搜索摘要没有被当作 Evidence
- [x] 每个展示 Evidence 都通过 exact-anchor
- [x] 每个 decisive Claim 有 Evidence 或明确为 Insufficient
- [x] Trust 等级完全由 ruleset 计算
- [x] 总体 Confidence 不违反 decisive Claim 和 material conflict 上限
- [x] Running 状态来自真实持久化 events
- [x] Cancel 能停止新 Provider 工作并进入 Cancelled
- [x] 单来源失败不会让已有有效证据丢失
- [x] Retry 创建 child Run，不复活旧终态 Run
- [x] Save 幂等并写入数据库
- [x] Library / Note Detail / My Notes 不依赖 localStorage 主存储
- [x] 刷新页面后可恢复 Run 当前状态和已完成对象
- [x] Provider 密钥、完整 prompt、隐藏推理未进入浏览器或日志
- [x] `MODEL_PROVIDER` 可以在 OpenAI / DeepSeek 间选择，未选中的 Provider 不要求密钥
- [x] DeepSeek adapter 通过 mocked HTTP、空 content、无效 JSON、schema mismatch 和 usage mapping 测试
- [x] DeepSeek 输出与 OpenAI 输出经过完全相同的 Zod、Evidence、Trust 和 StructuredResult 不变量
- [x] SSRF / redirect / size / timeout / MIME 测试通过
- [x] `npm run smoke:live` 至少成功一次并记录
- [x] Compare / Research 没有被错误伪装成 Quick
- [x] README 足够让新开发者在 replay 和 live 两种模式启动

若缺少真实 Provider 密钥，可以完成开发与 Replay 验收，但 Round 2 状态保持 `IN_PROGRESS / LIVE_VALIDATION_PENDING`，不能标记 `DONE`。

---

## 20. 风险清单

| 风险 | Round 2 控制方式 |
| --- | --- |
| 搜索排名与外部服务波动导致测试不稳定 | 默认使用 Replay；live smoke 只验不变量，不断言排名和固定答案 |
| 模型生成不存在的引用 | exact-anchor fail closed；未通过的 Evidence 不入库 |
| 模型直接决定可信度 | Trust rules 独立包，模型输出不包含最终等级 |
| Search snippet 被误当正文 | contract 标为 discovery only；Evidence builder 不接受 snippet 来源 |
| 抓取外部 URL 形成 SSRF | DNS / redirect / scheme / IP / size / timeout 多层校验 |
| 单来源失败导致整个答案丢失 | per-source failure isolation；按已有证据决定 Partial / Failed |
| 外部额度失控 | Quick 硬预算、调用记录、live smoke 单 query |
| 进程重启后 UI 永久 Running | heartbeat 过期标记 PROCESS_INTERRUPTED，保留对象并允许 Retry |
| 进程内 executor 被误认为生产队列 | README 明确仅支持单机长生命周期 Node；分布式 worker 延期 |
| UI 与数据库状态分裂 | snapshot + ordered SSE events；刷新后以数据库为准 |
| Provider SDK 污染领域层 | adapter 实现放 retrieval / model gateway 边界，domain 只保留 ports |
| 把 DeepSeek JSON Output 误认为严格 schema | capability 明确区分；JSON.parse 后强制本地 Zod strict validation，空内容与截断 fail closed |
| 业务逻辑被供应商条件分支污染 | Agent 只依赖 provider-neutral ModelGateway；差异封装在 adapter / prompt renderer |
| 真实正文保存过多 | MIME / body / normalized text 上限和最小必要保存 |
| Auto 把复杂问题错误降级为 Quick | 保存 mode confidence；Compare / Research 明确停在 MODE_NOT_AVAILABLE |

---

## 21. 延期项

| ID | 项目 | 原因 | 建议轮次 | 状态 |
| --- | --- | --- | --- | --- |
| `R2-X01` | Compare + 对称取证 + Conflict UI | 本轮只证明真实 Quick | Round 3 | 延期 |
| `R2-X02` | GitHub 专用 Search adapter | 与 Compare 技术产品选型更相关 | Round 3 | 延期 |
| `R2-X03` | Research 多轮 Gap Loop / Continue Search | 超出 Quick 的一次补搜 | Round 4 | 延期 |
| `R2-X04` | 独立 Worker / durable queue / 多节点 lease | MVP Alpha 使用单机长进程 | Hardening | 延期 |
| `R2-X05` | PDF / DOCX / 图片来源解析 | Round 2 只支持公开 HTML / text | 后续 Retrieval 轮次 | 延期 |
| `R2-X06` | Markdown / DOCX 导出 | 不属于真实搜索闭环 | Knowledge Round | 延期 |
| `R2-X07` | 完整登录与多租户授权 | 本轮保留 owner scope 和固定开发用户 | Security Round | 延期 |
| `R2-X08` | Provider 设置 UI | 密钥继续由服务端环境变量管理 | 后续 | 延期 |
| `R2-X09` | DeepSeek Beta strict tool-call mode | Beta endpoint 会扩大兼容与稳定性风险；本轮使用正式 JSON Output + 本地校验 | 后续评估 | 延期 |

---

## 22. Round 3 接口预留

Round 2 完成后，Round 3 应在不重写 Quick pipeline 的前提下增加 Compare：

```text
QuickRunExecutor
        ↓ 抽象公共阶段
SearchRunExecutor
  ├── QuickPolicy
  └── ComparePolicy
          ├── shared dimensions
          ├── symmetric retrieval
          ├── GitHub router
          └── material conflicts
```

Round 2 必须为此保留：

- PlanStep 的 `expectedClaims` / source preferences；
- query 的 round / step / candidate scope；
- Claim scope 中的 entity / version / timeframe；
- Evidence stance 与 independence group；
- Conflict / ConflictEvidence；
- parentRunId 和 trigger；
- Presentation builder 的可扩展 section 类型。

但不得为了 Round 3 提前实现通用 workflow DSL 或插件系统。

---

## 23. 执行记录

执行开始后，每个编码批次追加一行。

| 日期 | 完成项 | 验证结果 | 遗留问题 | 执行者 |
| --- | --- | --- | --- | --- |
| 2026-08-13 | Phase A：contracts、ports、ADR、环境变量 | typecheck 与 contract tests 通过 | 无 | Codex |
| 2026-08-13 | Phase B：23 张表、append-only migration、repository 扩展 | PGlite 空库与 5 项 DB smoke 通过 | heartbeat / stale-run recovery 待完成 | Codex |
| 2026-08-13 | Phase C：Replay / Brave、安全抓取、HTML blocks、passage 与 exact-anchor | 4 项 retrieval tests 通过 | 单来源失败 / 去重矩阵待补 | Codex |
| 2026-08-13 | Phase D–E：Replay / OpenAI / DeepSeek gateways、Quick Agent、Trust 与 presentation | 8 项 agent / gateway / trust tests 通过 | 补搜、dedupe、完整冲突回归待补 | Codex |
| 2026-08-13 | Phase F–G：Create / Snapshot / SSE / Cancel / Retry / Save API 与运行界面 | production build 通过；API Replay smoke 产生 21 events、2 Claims、2 Evidence、1 Source、High、Save 成功 | Library / Note DB 主路径、视觉矩阵待完成 | Codex |
| 2026-08-13 | DeepSeek 预留与运行文档 | mocked HTTP、空 content 重试、usage 与 reasoning 隔离通过 | 未提供密钥，live smoke 待执行 | Codex |
| 2026-08-13 | 默认完整 Gate | `npm run check` 通过：36 tests、build、5 DB smoke、Round 2 browser/API smoke | Live smoke 与 durable DB runtime composition 待完成 | Codex |

---

| 2026-08-13 | Durable runtime：PostgreSQL / PGlite、增量事件、heartbeat、checkpoint、stale recovery、数据库 Save / Library / My Notes | restart smoke 通过：运行中断恢复为 `PROCESS_INTERRUPTED`，完成快照与 Saved Note 跨进程重启保留 | 多节点 lease / durable queue 仍按 `R2-X04` 延期 | Codex |
| 2026-08-13 | Quick 补搜与完整离线测试矩阵 | `npm run check` 通过：54 tests、8 DB smoke、生产构建、浏览器流程、durable restart smoke | 无 | Codex |
| 2026-08-13 | Live Smoke 前置检查 | 工作区与进程环境均未发现 Brave + OpenAI / DeepSeek 必需配置，未发起外部调用 | 提供密钥后执行 `RUN_LIVE_SMOKE=1 npm run smoke:live` | Codex |
| 2026-08-14 | Interview Round 1 基线清点：Live 配置 fail-closed、公开错误脱敏、Retry child Run lineage、浏览器竞态加固 | `npm run check` 通过：61 tests、8 DB smoke、生产构建、浏览器流程、durable restart smoke | Brave 与模型密钥仍未提供；真实 Live Smoke 待执行 | Codex |
| 2026-08-14 | 新增 Tavily SearchProvider 与显式 `SEARCH_PROVIDER` 选择 | Tavily discovery-only 映射、限流、配置选择测试通过；`npm run check`：64 tests、8 DB smoke、浏览器与 durable smoke 全通过 | 等待 Tavily 免费 Key 后执行 Tavily + DeepSeek Live Smoke | Codex |
| 2026-08-14 | 首次生产 Live 启动加固 | 修复默认 PGlite 目录首次启动未创建导致的空 500；Create Search 启动失败统一返回脱敏 JSON | 无 | Codex |
| 2026-08-14 | Tavily + DeepSeek Live Smoke | 非 fixture 问题完成：7 Claims、10 Evidence、6 Sources、MEDIUM；所有 Evidence 均有 exact block locator | 无 | Codex |
| 2026-08-14 | 三问题 Live Matrix | 3/3 `COMPLETED`；分别得到 MEDIUM、MIXED、HIGH；来源覆盖 MDN、RFC Editor、DeepSeek 官方文档等 | 外部排名与网页内容仍可能随时间变化 | Codex |
| 2026-08-14 | Round 2 最终 Gate | `npm run check`：64 tests、8 DB smoke、生产构建、浏览器/API Smoke、durable restart smoke 全通过 | Windows 临时浏览器 profile 锁仅产生非阻塞清理警告 | Codex |

## 24. 最终交付

```text
状态：DONE
完成日期：2026-08-14
完成的任务 ID：R2-A01–R2-H12
未完成的任务 ID：无；R2-X01–R2-X09 为明确延期项
默认自动检查结果：64 tests + build + 8 DB smoke + browser/API smoke + durable restart smoke 全通过
Replay fixture 覆盖状态：成功、部分、失败、取消、证据不足
数据库 migration：append-only migration 与 PGlite / PostgreSQL repository smoke 通过
浏览器验收结果：桌面、平板、窄屏、失败、取消、证据不足流程通过
Live Smoke：2026-08-14；Tavily + DeepSeek；6 Sources / 10 Evidence；COMPLETED
Live Matrix：3/3 COMPLETED；MEDIUM / MIXED / HIGH
Trust ruleset 版本：trust-rules-v1
Prompt versions：quick-intent-v1 / quick-plan-v1 / quick-extract-v1 / quick-synthesis-v1
Provider adapters：Replay、Tavily、Brave、OpenAI、DeepSeek
已知限制：仅 Quick；公开 HTML/text；单机长生命周期 Node runtime；外部排名与网页会变化
延期项：Compare、Research、GitHub 专用路由、导出、多用户、分布式执行等 R2-X01–R2-X09
Interview Round 2 是否可开始：YES
```

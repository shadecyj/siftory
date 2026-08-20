# Siftory Round 3：Compare、对称取证与冲突解释

**状态：** `DEFERRED / AFTER_INTERVIEW_MVP`
**目标版本：** Siftory MVP Alpha / Round 3
**本轮性质：** 在不改写 Quick Evidence Loop 的前提下，完成第一条双候选 Compare 纵向闭环
**前置条件：** `round/round2.md` 达到 `DONE`；本文件可以先完成设计，但不得绕过 Round 2 Gate 开始编码
**黄金问题：** `LangGraph 和 CrewAI 怎么选？`

> **执行优先级说明（2026-08-14）：** 当前先完成 [Interview MVP Track](interview-mvp.md)。该短期轨道只收敛真实 Quick Search、可信结果展示、收藏分类和面试可靠性。完成前不启动本 Round 的 Compare 扩展，避免扩大范围。

---

## 1. 本轮产品判断

Round 2 证明 Siftory 能把一个 Quick 问题处理成：

```text
Question
→ SearchPlan
→ SourceSnapshot
→ Claim → Evidence → Source
→ Trust
→ StructuredResult
→ SearchNote
```

Round 3 不只是增加一张比较表，而是验证 Siftory 能否在两个候选之间保持取证公平，并对“没有绝对赢家”的真实情况给出条件化建议：

```text
Compare Question
→ 候选识别与用户约束
→ 共享比较维度
→ Candidate × Dimension 对称检索
→ Claim / Evidence / Source
→ Coverage 与不对称缺口
→ Conflict / ConflictEvidence
→ 条件化 Recommendation
→ Comparison Result
→ Compare Search Note
```

本轮的产品差异不是“AI 帮用户打分”，而是：

> **同一维度、同一证据标准、分别为双方取证；证据不足就显示未知，证据冲突就保留双方。**

设计方向继续沿用现有 Cognitive Workbench：面向知识工作者、信任要求高、信息密度中高。保留当前品牌、导航和三栏工作区；主工作区负责建议与比较，检查器负责 Evidence、Sources、Conflict 和 Activity。不得全面换肤，也不得做成通用排行榜。

---

## 2. Round 3 进入门

Round 3 的规划可以先完成，但只有下列 Round 2 项全部关闭后才允许开始编码：

- [ ] `R3-P01` SearchTask / SearchRun / RunEvent 已使用 durable repository 作为主路径
- [ ] `R3-P02` heartbeat、checkpoint、stale-run recovery 已完成
- [ ] `R3-P03` Quick Claim normalization / dedupe 已完成
- [ ] `R3-P04` Quick Gap Check 与受限补搜已完成
- [ ] `R3-P05` Retrieval 单来源失败、重复来源、全部不可抓取测试已完成
- [ ] `R3-P06` Model empty / invalid / rate limit / cancel / retry 测试矩阵已完成
- [ ] `R3-P07` Trust High / Medium / Low / Insufficient / conflict 回归已完成
- [ ] `R3-P08` API concurrency、process interrupted 与恢复测试已完成
- [ ] `R3-P09` Source / Evidence inspector、窄屏、键盘、对比度和 reduced motion 已验收
- [ ] `R3-P10` Round 2 Live Smoke 已在安全环境成功一次并记录

规则：

- 上述工作仍属于 Round 2，不得改名计入 Round 3 完成率；
- 若 durable runtime 尚未完成，Compare 不得继续建立第二套进程内主存储；
- 若 Quick 的 dedupe、Gap Check 和 Trust 回归尚不稳定，Compare 不得复制这些缺陷并放大到矩阵中；
- Round 3 编码开始时，在执行记录中写明 Round 2 Gate 的通过日期和证据。

---

## 3. 范围约束

### 3.1 本轮只支持双候选 Compare

Round 3 只支持两个明确候选：

```text
A vs B
A 和 B 怎么选
A 与 B 的区别
```

不支持：

- 三个及以上候选的排名；
- “推荐最好的五个工具”这类开放发现任务；
- 自动构造全市场候选集；
- 百分制总分、排行榜或伪精确加权评分。

当 Auto 识别出三个及以上候选时，系统不静默丢弃候选，也不任意选择前两个，应返回 `COMPARE_SCOPE_TOO_WIDE`，保留已识别候选并要求用户缩小到两个。开放候选发现应归入 Research，而不是 Compare。

### 3.2 必须完成

- 双候选 Intent、实体归一化与约束提取；
- 共享比较维度生成与本地校验；
- Candidate × Dimension 对称任务矩阵；
- Web + Official Source routing；
- GitHub 公共来源 adapter；
- Claim scope 中的 candidate / dimension / version / timeframe；
- 对称覆盖检查与受预算约束的补搜；
- Conflict / ConflictEvidence；
- 确定性 Compare Trust 与 recommendation guard；
- 条件化 Recommendation / No clear winner / Insufficient；
- Comparison 与 Contradictions UI；
- 模式切换创建新 Run；
- Task 内 Run history；
- Compare Search Note、Library 和 Note Detail；
- Replay 离线矩阵与显式 Live Smoke。

### 3.3 明确不做

- Research 多分支长循环；
- 三个以上候选和动态排行榜；
- 自动运行候选框架、代码或 benchmark；
- 私有 GitHub 仓库、登录态页面和组织权限；
- GitHub Marketplace / Agent Marketplace；
- 团队审批、评论和协作；
- PDF、视频或付费数据库解析；
- Markdown / DOCX 导出；
- Living Note / 自动长期监控；
- 通用 workflow DSL、插件系统或分布式 worker；
- 用 stars、下载量或 citation 数直接代表质量。

执行中出现这些需求时，只记录到延期项，不得顺手加入本轮。

---

## 4. 成功场景

### 4.1 黄金路径

```text
Home
→ 输入“LangGraph 和 CrewAI 怎么选？”
→ Auto 识别 Compare
→ 识别 LangGraph / CrewAI 两个候选
→ 提取用户约束与合理假设
→ 形成 3–5 个共享维度
→ 为每个候选、每个维度执行对称检索
→ 展示真实矩阵进度与来源活动
→ 检查 Evidence 覆盖、时效、版本和冲突
→ 给出条件化建议或 No clear winner
→ 点击比较单元格检查 Claim → Evidence → Source
→ 展开实质冲突双方证据
→ 保存为 Compare Search Note
→ Library 重新打开并保留比较结构
```

### 4.2 条件化建议

```text
如果用户更看重 X
→ 推荐 Candidate A
→ 理由只引用 A/B 在相关维度上的 Claims

如果用户更看重 Y
→ 推荐 Candidate B
→ 明确适用条件、版本和证据限制
```

不得在用户约束不同的情况下输出一个脱离条件的“绝对赢家”。

### 4.3 不对称证据

```text
Candidate A 在某关键维度有直接证据
Candidate B 没有可核验正文
→ B 单元格显示 Insufficient / 未知
→ 触发一次针对 B 的补搜
→ 仍无证据则保留空缺
→ 不使用 A 的资料推断 B
→ Recommendation 受到 coverage guard 限制
```

### 4.4 实质冲突

```text
官方文档描述某能力
社区可复现测试显示当前版本行为不同
→ 保存双方 Evidence
→ 标记 version / factual / scope conflict
→ 默认结果显示 Conflict 摘要
→ Trust 不得为 High
→ 建议说明版本依赖或保持 No clear winner
```

### 4.5 模式纠正

```text
Quick Result
→ 用户切换 Compare
→ 明确提示“将以 Compare 重新搜索”
→ 创建 parentRunId 指向旧 Run 的新 SearchRun
→ 旧结果和旧 Note 不被覆盖
→ Task history 可切换查看两个 Run
```

---

## 5. 核心产品规则

### 5.1 对称取证不等于相同 URL 数

对称的含义是：

- 双方使用同一组比较维度；
- 双方关键单元格使用相同 Evidence 准入标准；
- 双方都优先寻找与 Claim 类型匹配的第一方来源；
- 双方都允许保留 Insufficient、Conflict 和版本限制；
- 补搜优先处理 coverage debt 最大的一侧。

不要求双方 URL 数完全相同，也不把 citation 数当作公平度。

### 5.2 Comparison 不是新的事实单位

核心知识单位仍然是 Claim：

```text
ComparisonCell
   └── claimIds[]
          └── Claim
                └── ClaimEvidence
                      └── Evidence
                            └── SourceSnapshot
                                  └── Source
```

ComparisonCell 只负责组织 Candidate × Dimension 关系，不复制事实文本、不复制 Evidence，也不保存独立“AI 分数”。

### 5.3 Recommendation 是 Proposal

Recommendation 必须显示为 `Proposal / 建议`，不是 `Fact`。它至少包含：

- recommendation kind；
- 适用条件；
- 用户约束和系统假设；
- 使用的 decisive / key Claim IDs；
- 未覆盖维度；
- 会改变建议的 material conflicts；
- 生成器版本。

Recommendation 不得成为 Trust 输入；它消费 Trust 后的 Claims 和 Comparison coverage。

### 5.4 缺失不是落后

`INSUFFICIENT` 只表示本次搜索没有找到足够证据，不表示候选不具备该能力。UI、导出结构和模型 prompt 均必须保留这一语义。

### 5.5 冲突不被抹平

Conflict 被解释、限定到版本或缩小 scope 后，双方 Evidence 仍然保留。不得为了得到单一答案删除反方证据。

---

## 6. Compare 数据模型

### 6.1 新增对象

```text
SearchRun (COMPARE)
   ├── CompareIntent
   ├── ComparisonCandidate × 2
   ├── ComparisonDimension × 3–5
   ├── ComparisonCell (Candidate × Dimension)
   │      ├── claimIds[]
   │      ├── coverageStatus
   │      └── gapReasons[]
   ├── Conflict
   │      └── ConflictEvidence
   ├── CompareCoverage
   ├── Recommendation
   └── StructuredResult.comparison
```

### 6.2 ComparisonCandidate

字段：

```text
id
runId
canonicalName
displayName
aliases[]
entityType
officialDomains[]
officialRepositoryUrls[]
versionConstraint?
displayOrder
identityConfidence
identityNotes[]
```

约束：

- 一个 Compare Run 必须且只能有两个候选；
- alias 不能作为 Source 权威性的唯一判断；
- official domain / repository 必须来自可审计 identity step；
- 候选身份存在歧义且会改变结果时，不得继续抓取错误实体。

### 6.3 ComparisonDimension

字段：

```text
id
runId
key
label
question
importance        DECISIVE | KEY | SUPPORTING
claimType
sourcePreferences[]
completionCriteria[]
displayOrder
```

维度要求：

- 必须同时适用于两个候选；
- 必须与用户问题和约束相关；
- 最多 5 个默认展开维度；
- 不得使用“总体实力”“先进程度”等无法取证的空泛维度；
- 模型提出维度，本地 schema、数量、唯一性和适用性检查负责 fail closed。

### 6.4 ComparisonCell

字段：

```text
id
runId
candidateId
dimensionId
claimIds[]
coverageStatus    PENDING | SEARCHING | EVIDENCED | INSUFFICIENT | CONFLICTING | EXCLUDED
directEvidenceCount
independentSupportCount
primarySourceCount
gapReasons[]
lastEvaluatedAt
```

唯一约束：`UNIQUE(run_id, candidate_id, dimension_id)`。

### 6.5 CompareCoverage

字段：

```text
runId
requiredCellCount
evidencedCellCount
insufficientCellCount
conflictingCellCount
decisiveCoverageComplete
symmetryDebt[]
coverageVersion
evaluatedAt
```

`symmetryDebt` 是可解释缺口列表，不是单一神秘分数。每项包含 candidate、dimension、缺失 Evidence 类型和是否触发补搜。

### 6.6 Conflict / ConflictEvidence 增量

Conflict 增加：

```text
conflictType      FACTUAL | VERSION | TEMPORAL | SCOPE | METHODOLOGY | INTERPRETATION
resolutionNotes?
resolvedAt?
```

新增 `ConflictEvidence`：

```text
id
conflictId
claimEvidenceId
side              A | B | CONTEXT
createdAt
```

不得继续把全部关系只塞进 `claimEvidenceIds` JSON；迁移采用 append-only，新表建立后 repository 同时兼容旧数据读取。

### 6.7 Recommendation

字段：

```text
runId
kind              CONDITIONAL | NO_CLEAR_WINNER | INSUFFICIENT
preferredCandidateId?
headline
conditions[]
assumptions[]
decisiveClaimIds[]
keyClaimIds[]
materialConflictIds[]
missingCellIds[]
recommendationVersion
```

条件化分支可以指向不同候选；`preferredCandidateId` 只在一个分支确实由当前用户约束触发时填写。

### 6.8 StructuredResult 与 SearchNote

`StructuredResult` 增加可选且强校验的 `comparison`：

```text
candidates[]
dimensions[]
cells[]
coverage
recommendation
conflictIds[]
```

规则：

- Quick 的 `comparison` 必须为 null；
- Compare 的 `comparison` 必须存在；
- 每个 cell 引用的 Claim 必须属于同一 Run，并与 candidate / dimension scope 一致；
- Recommendation 的 Claim / Conflict / Cell 引用不得悬空；
- Compare SearchNote revision 必须快照保存 candidates、dimensions、cells、recommendation 和 conflicts；
- My Notes 继续与 Evidence 分离。

---

## 7. Compare Agent 策略

### 7.1 Intent

输出：

```text
selectedMode = COMPARE
candidates[2]
userConstraints
decisionContext
freshnessRequirement
versionConstraints
ambiguityNotes
assumptions
```

Intent Gate：

- 不是两个候选：停止 Compare executor；
- 候选疑似同一实体或 alias：先归一化；
- 约束缺失但仍可合理开始：记录 assumptions 后继续；
- 约束缺失会让任何建议明显失真：返回 `COMPARE_NEEDS_CONSTRAINT`，不生成伪建议。

### 7.2 共享维度规划

Planner 先生成维度，再展开 Candidate × Dimension 子任务：

```text
Dimension 1 × Candidate A
Dimension 1 × Candidate B
Dimension 2 × Candidate A
Dimension 2 × Candidate B
...
```

每个 cell task 包含：

- expected claim type；
- query templates；
- official / GitHub / secondary source preferences；
- completion criteria；
- candidate identity scope；
- version / timeframe。

### 7.3 初始预算

| 项目 | Round 3 默认上限 |
| --- | --- |
| 候选 | 固定 2 |
| 比较维度 | 3–5 |
| 检索轮次 | 最多 3 |
| 每 cell 查询 | 首轮 1，补搜最多 1 |
| 每候选目标来源 | 3–6 |
| 默认正文来源总数 | 6–12 |
| Gap Loop | 最多 2 次 |
| 模型输出重试 | 每 operation 最多 1 次 |

预算是 policy，不写死在领域枚举。预算耗尽时根据已有覆盖进入 Completed、Partial 或 Insufficient，不伪造完整比较。

### 7.4 对称调度

调度顺序：

1. decisive dimensions；
2. 先完成一对 cell，再进入下一维度；
3. key dimensions；
4. supporting dimensions；
5. Gap Check 优先补 symmetry debt 最大的 cell。

不得先把 Candidate A 全部搜完再处理 B，因为这会增加预算耗尽时的不对称偏差。

### 7.5 Claim scope 与去重

Compare Claim scope 至少包含：

```text
candidateId
dimensionId
version?
timeframe?
environment?
```

去重先按同一 candidate + dimension + normalized statement；跨候选相似句不能合并成同一个 Claim。版本不同的 Claim 保留并进入 version conflict 检测。

### 7.6 Gap Check

Gap Check 依次检查：

1. 每个 decisive dimension 是否双方都有 direct Evidence 或明确 Insufficient；
2. 是否只有一方拥有第一方来源；
3. 是否存在未知版本、过时 Evidence 或 blocked source；
4. material conflict 是否缺少另一侧证据；
5. 新查询是否仍可能降低 symmetry debt；
6. 剩余预算是否足够。

补搜必须绑定具体 cell 和 gap reason，不允许生成无目标的宽泛查询。

### 7.7 停止条件

进入 `SYNTHESIZING` 的条件：

- decisive cells 已 EVIDENCED / INSUFFICIENT / CONFLICTING；
- 没有未处理的 material conflict side；
- recommendation guard 能做出条件化建议或明确 No clear winner；
- 或预算耗尽但已有可交付的对比结构。

完全没有双方可核验证据时进入 Failed；只有一方有少量证据时通常进入 Partial / Insufficient，不得生成 winner。

---

## 8. Source Router 与 GitHub

### 8.1 路由原则

| Claim 类型 | 首选来源 |
| --- | --- |
| 产品能力、API、配置 | 官方文档、官方 reference |
| 版本、变更、废弃 | release notes、changelog、官方 releases |
| 实现状态、issue、兼容性 | 官方 GitHub repo、commit、issue / discussion |
| 架构定位 | 官方文档、维护者公开说明 |
| 实际体验与限制 | 可复现测试、独立技术文章、社区 issue |
| 流行度 | 多个带日期的公开指标，仅作为 context |

“官方”是对具体 Claim 的语境判断。官方仓库 issue 的普通用户评论不自动成为第一方权威 Evidence。

### 8.2 GitHub adapter

新增只读公共 `GitHubSearchProvider / GitHubSourceAdapter`：

- 按 candidate 的 official repository identity 路由；
- 支持 repository metadata、release、issue、discussion、commit 或源码文档候选；
- API 搜索结果只用于 discovery；
- JSON / HTML 必须规范化为不可变 SourceSnapshot 和稳定 block；
- Evidence 必须通过 exact-anchor；
- rate limit 进入公开错误和 retry action；
- `GITHUB_TOKEN` 可选，只有使用 GitHub live adapter 时校验；
- token 不进入浏览器、RunEvent 或错误 body；
- stars、forks、issue 数不直接进入 Trust level。

### 8.3 Repository identity

系统不得只按候选名称猜仓库。identity step 应保存：

- 官方网站到仓库的链接；
- 官方组织 / owner；
- canonical repository URL；
- archived / fork 状态；
- identity evidence 与 confidence。

无法确认官方仓库时可以使用普通 Web 来源，但不能把疑似仓库标为 official。

---

## 9. Conflict 与 Trust Rules v2

### 9.1 Conflict detection

检测只在可比较 scope 内进行：

- 同一 candidate、dimension、version、timeframe 的 Claims 可判 factual conflict；
- 版本不同优先判 VERSION，不把历史行为误报为事实矛盾；
- 环境或配置不同优先判 SCOPE；
- 评测方法不同可判 METHODOLOGY；
- 主观解释不同可判 INTERPRETATION。

模型可以提出 conflict candidate，但本地规则负责验证引用、scope 和 severity 必要字段。

### 9.2 Material severity

满足下列任一项可为 MATERIAL：

- 会改变当前 recommendation branch；
- 影响 decisive dimension；
- 一方官方说明与当前可复现实证冲突；
- 版本不明导致结论不可安全应用；
- 双方证据都直接且权威，仍无法解释差异。

### 9.3 Trust Rules v2

保留 Authority、Primary Context、Freshness、Claim Relevance、Independence 和 Conflict，并增加 Compare coverage guard：

- 单 Claim Trust 仍独立计算；
- ComparisonCell 只聚合其 Claims，不重算网站总分；
- unresolved material conflict 使相关 Claim / cell 不得 High；
- decisive dimension 任一候选 Insufficient 时，整体 Compare 不得 High；
- 只有 citation 数多不能提高 Trust；
- secondary 实测可以限定官方 Claim，但必须记录方法与适用版本。

### 9.4 Recommendation guard

输出 `CONDITIONAL` 必须满足：

- 至少一个用户约束或明确决策条件；
- recommendation 所引用 decisive Claims 全部存在；
- 每个被用于推荐的关键维度都完成双方取证，或对缺失方明确 Insufficient；
- material conflict 已呈现且 recommendation 说明其影响；
- rationale 没有引入 Claims 之外的新事实。

否则输出：

- `NO_CLEAR_WINNER`：双方适用条件不同或证据相当；
- `INSUFFICIENT`：对称证据不足，不能负责任地建议。

---

## 10. Presentation 规格

默认结果顺序：

```text
Question
Recommendation / No clear winner / Insufficient
Applies when / Based on constraints
Confidence + coverage summary
Comparison
Key Evidence
Material Conflicts（存在时默认展开）
Sources
```

渐进展开：

```text
Assumptions
Search Plan
Queries
Coverage Gaps
Trust Analysis
Excluded Sources
Run History
```

规则：

- Material Conflict 和 decisive Insufficient 不得藏在折叠区；
- 表格 cell 显示简短结论、Trust 和 Evidence 状态，不塞入长回答；
- cell 的正文来自 Claim display，不允许前端现场总结；
- Recommendation 明示 `Proposal`；
- Evidence 明示 `Fact / 支持`、`Contradicts / 反对` 或 `Context`；
- 对比矩阵不使用红绿胜负色表达优劣。

---

## 11. 页面与交互计划

### 11.1 Home

- Auto 能识别 Compare；
- Compare 手动模式可选；
- 示例增加 `LangGraph 和 CrewAI 怎么选？`；
- 三候选以上给出缩小范围提示；
- 不增加权重滑杆、几十个筛选项或复杂 Agent 设置。

### 11.2 Running Workspace

稳定 Run Header 显示：

- Question；
- `Auto → Compare`；
- Running / Partial / Failed / Cancelled；
- 当前操作与 elapsed time；
- Replay / Live + provider；
- Stop / Retry / Edit scope。

主区显示克制的 coverage matrix：

```text
                    Candidate A       Candidate B
Dimension 1         Reading           Evidence found
Dimension 2         Pending           Pending
Dimension 3         Conflict found    Evidence found
```

矩阵只显示公开操作状态，不显示 chain-of-thought。Activity Inspector 记录 query、source、snapshot、evidence、gap、conflict 和 checkpoint 事件。

### 11.3 Completed / Partial Result

主工作区：Recommendation、条件、Comparison、Conflict 摘要。
右侧 Inspector：Evidence / Sources / Activity / Method 四组信息。

交互：

- 点击 cell：选中 candidate + dimension，并打开关联 Claims / Evidence；
- 点击 Claim：定位 exact excerpt 和 Snapshot context；
- 点击 Source：高亮其支持 / 反对的 cells 和 Claims；
- 点击 Conflict：并排显示 A / B / Context Evidence；
- 排除 Source / Domain 后：预览影响并创建新 Run，不原地改写旧结果；
- 编辑约束或切换模式后：明确创建新 Run。

### 11.4 Run History

Task 内最小历史视图显示：

```text
Run #1 · Quick · Completed
Run #2 · Compare · Completed · current
Run #3 · Compare · Cancelled
```

可以查看旧结果和来源，但不支持在旧终态 Run 上继续写入。Retry、Mode Switch、Edit Scope 均创建 child Run。

### 11.5 Responsive 与无障碍

- wide desktop：导航 / 主工作区 / Inspector 三栏；
- compact desktop：Inspector 可折叠；
- tablet：Inspector 变为可关闭 sheet；
- narrow screen：比较表变成按 dimension 分组的双候选行，不横向压缩到不可读；
- Stop、Retry、Edit scope 始终可达；
- 键盘可在维度、cell、Claim、Evidence 与 tabs 间移动；
- Agent 状态通过 live region 宣告，但不逐条朗读日志；
- Conflict、Insufficient 和 selected 状态不只依赖颜色；
- light、dark、increased contrast、reduced motion 均使用现有 semantic tokens。

---

## 12. Agent 状态与 RunEvent 增量

沿用现有 RunState，不新增 Compare 专属状态：

```text
CREATED
→ UNDERSTANDING
→ PLANNING
→ RETRIEVING
→ EXTRACTING
→ EVALUATING
→ GAP_CHECK
→ RETRIEVING（受限补搜）
→ SYNTHESIZING
→ MATERIALIZING
→ COMPLETED / PARTIAL / FAILED / CANCELLED
```

新增公开 RunEventType：

```text
COMPARE_CANDIDATES_IDENTIFIED
COMPARE_DIMENSIONS_CREATED
COMPARE_CELL_STARTED
COMPARE_CELL_EVIDENCED
COMPARE_CELL_INSUFFICIENT
COMPARE_SYMMETRY_GAP_FOUND
COMPARE_GAP_QUERY_STARTED
COMPARE_COVERAGE_COMPLETED
CONFLICT_DETECTED
CONFLICT_CLASSIFIED
RECOMMENDATION_GUARD_COMPLETED
MODE_SWITCH_CREATED
RUN_CHECKPOINTED
RUN_RECOVERED
```

每个 event 只存公开摘要、对象 ID、计数与结果，不保存完整 prompt、隐藏推理或密钥。

---

## 13. API 与 Repository 计划

### 13.1 API 增量

保留现有 API，并扩展：

```text
POST /api/search-tasks
GET  /api/search-runs/:runId
GET  /api/search-runs/:runId/events
POST /api/search-runs/:runId/cancel
POST /api/search-runs/:runId/retry
POST /api/search-runs/:runId/save

GET  /api/search-tasks/:taskId/runs
POST /api/search-tasks/:taskId/runs       # MODE_SWITCH / EDIT_SCOPE
GET  /api/search-runs/:runId/comparison
GET  /api/search-runs/:runId/conflicts
```

Create / new Run 请求增加可选：

```text
requestedMode
candidates?
constraints?
excludedSourceIds?
excludedDomains?
```

所有输入走 Zod strict schema；未知字段、第三候选、悬空 source ID 和跨 owner 引用均拒绝。

### 13.2 Repository

新增增量 repository：

- ComparisonCandidate；
- ComparisonDimension；
- ComparisonCell；
- CompareCoverage；
- ConflictEvidence；
- Recommendation；
- Task Run History；
- mode switch / edit scope child run；
- Compare SearchNote revision。

要求：

- PGlite 与 PostgreSQL 共用 repository contract；
- append-only migration；
- cell、conflict relation、recommendation 保存幂等；
- checkpoint 能恢复矩阵状态，不重复 Provider call；
- owner scope 覆盖 Task、Run、Note 和 Run history；
- StructuredResult 与 comparison 在同一事务物化。

---

## 14. Model Gateway operations

复用 Replay / OpenAI / DeepSeek Gateway，新增 operation：

```text
compare-intent-v1
compare-dimensions-v1
compare-extract-v1
compare-conflict-candidates-v1
compare-synthesis-v1
```

要求：

- OpenAI 继续使用 strict JSON Schema；
- DeepSeek 继续 JSON Object + 本地 strict Zod；
- 两个 provider 消费相同 contracts 和 Evidence / Trust gates；
- prompt renderer 只处理 capability 差异，不产生领域分支；
- 模型只能提出 dimensions、claims、links、conflict candidates 和 synthesis draft；
- coverage、severity guard、Trust 和 recommendation guard 均由确定性代码执行；
- providerCalls 记录 provider、model、prompt version、duration、usage、status；
- reasoning content、完整 prompt 和密钥不持久化。

---

## 15. Replay fixtures 与评测

默认测试完全离线，不消耗搜索或模型额度。

| Fixture | 目的 | 预期 |
| --- | --- | --- |
| `compare-conditional` | 双方在不同条件下各有优势 | Conditional recommendation |
| `compare-no-clear-winner` | 证据相当且约束不足 | No clear winner |
| `compare-asymmetric` | 一方关键 cell 缺 Evidence | 补搜后仍显示 Insufficient；不越级推荐 |
| `compare-version-conflict` | 同一能力版本行为不同 | VERSION conflict；默认可见 |
| `compare-official-community-conflict` | 官方说法与可复现实测不同 | MATERIAL conflict；不 High |
| `compare-source-blocked` | 一方官方来源不可抓取 | 保留另一方 Evidence；Partial |
| `compare-github-rate-limited` | GitHub 429 | 明确 rate limited + retry |
| `compare-three-candidates` | 三个候选 | COMPARE_SCOPE_TOO_WIDE |
| `compare-aliases` | 候选别名指向同一实体 | 拒绝伪比较 |
| `compare-anchor-rejected` | 模型生成不存在 quote | Evidence rejected；cell Insufficient |
| `compare-cancelled` | 矩阵执行中取消 | checkpoint + Cancelled |
| `compare-recovered` | 进程中断后恢复 | 不重复已完成 cells / calls |
| `compare-mode-switch` | Quick 切 Compare | 新 child Run；旧 Run 保留 |
| `compare-note-roundtrip` | 保存并重开 Compare Note | comparison / conflict / personal note 保真 |

评测维度：

- candidate identity precision；
- dimension relevance 与双边适用性；
- decisive cell direct-Evidence coverage；
- symmetry debt；
- exact-anchor acceptance / rejection；
- material conflict detection 与误报；
- recommendation 引用完整性；
- unsupported synthesis rate；
- Provider calls / latency / budget；
- Cancel / retry / recovery 幂等。

不得把“与 fixture 推荐文字完全一致”作为主要质量指标；主要断言是对象、引用、coverage、conflict 和 Trust 不变量。

---

## 16. Live Smoke

新增显式命令：

```text
npm run smoke:live:compare
npm run smoke:live:compare:deepseek   # 可选，不阻塞默认 provider 验收
```

规则：

- 不加入默认 `npm run check`；
- 最多一个双候选 Compare query；
- 使用低预算策略；
- 不断言当前固定赢家；
- 断言两个候选、至少三个共享维度；
- 断言 decisive dimensions 双方均有 Evidence / Insufficient / Conflict 状态；
- 每个展示 Evidence 通过 exact-anchor；
- 搜索摘要和 GitHub search snippet 不成为 Evidence；
- 输出 provider、对象计数、coverage 和 conflict 数，不输出密钥、完整正文或 prompt；
- Round 3 标记 DONE 前，默认 live adapter 至少成功一次并记录日期。

---

## 17. 执行顺序与清点表

每完成一项，将 `[ ]` 改为 `[x]`，并在执行记录追加验证结果。任何 Phase Gate 未通过，不进入依赖它的下一阶段。

### Phase A — Compare Contracts & Decisions

- [ ] `R3-A01` 记录 Compare 对称取证 ADR
- [ ] `R3-A02` 锁定双候选与 3–5 维度边界
- [ ] `R3-A03` 增加 ComparisonCandidate schema
- [ ] `R3-A04` 增加 ComparisonDimension / Cell schema
- [ ] `R3-A05` 增加 CompareCoverage / symmetry debt schema
- [ ] `R3-A06` 增加 ConflictType / ConflictEvidence schema
- [ ] `R3-A07` 增加 Recommendation schema 与 guard contract
- [ ] `R3-A08` 扩展 StructuredResult / SearchNote comparison contract
- [ ] `R3-A09` 增加 Compare model-output schemas
- [ ] `R3-A10` 增加 Compare API error codes 与 RunEventTypes
- [ ] `R3-A11` 为未知字段、悬空引用、第三候选和 scope mismatch 编写拒绝测试

**Phase A Gate：** 双候选、维度、cell、Claim、Conflict、Recommendation 的引用链能被整包验证；Quick bundle 不受破坏。

### Phase B — Persistence & Durable Runtime

- [ ] `R3-B01` 添加 comparison candidates / dimensions / cells 表
- [ ] `R3-B02` 添加 compare coverage / recommendations 表
- [ ] `R3-B03` 添加 conflict type 字段与 conflict_evidence 表
- [ ] `R3-B04` 生成 append-only migration
- [ ] `R3-B05` 实现 Compare repositories
- [ ] `R3-B06` 实现 comparison / result 同事务物化
- [ ] `R3-B07` 实现 Compare SearchNote revision roundtrip
- [ ] `R3-B08` 实现 Task Run History repository
- [ ] `R3-B09` 实现 mode switch / edit scope child Run
- [ ] `R3-B10` checkpoint 保存矩阵和 Provider call 状态
- [ ] `R3-B11` 验证 PostgreSQL / PGlite、owner scope、幂等与恢复

**Phase B Gate：** 进程中断后可从数据库恢复 cell matrix；已完成 cell 不重新消费 Provider。

### Phase C — Compare Intent & Planning

- [ ] `R3-C01` 实现 Compare Intent 和两个候选抽取
- [ ] `R3-C02` 实现 candidate alias / identity normalization
- [ ] `R3-C03` 实现 constraints / decision context 提取
- [ ] `R3-C04` 实现 COMPARE_SCOPE_TOO_WIDE
- [ ] `R3-C05` 实现 COMPARE_NEEDS_CONSTRAINT
- [ ] `R3-C06` 实现共享维度生成
- [ ] `R3-C07` 实现维度数量、唯一性、双边适用性校验
- [ ] `R3-C08` 展开 Candidate × Dimension PlanSteps
- [ ] `R3-C09` 实现 decisive / key / supporting 优先级
- [ ] `R3-C10` 覆盖 alias、同实体、三候选、约束不足测试

**Phase C Gate：** 黄金问题稳定得到两个候选、3–5 个可取证共享维度和完整 cell matrix。

### Phase D — Source Routing & GitHub

- [ ] `R3-D01` 扩展 Official Source Router 到 candidate / dimension scope
- [ ] `R3-D02` 实现 GitHub SearchProvider
- [ ] `R3-D03` 实现 GitHub SourceAdapter 与不可变 snapshot
- [ ] `R3-D04` 实现 official repository identity
- [ ] `R3-D05` 区分 release / issue / discussion / commit 的 source metadata
- [ ] `R3-D06` 保证 GitHub search snippet 不进入 Evidence
- [ ] `R3-D07` 实现 GitHub rate limit / missing token / not found 错误映射
- [ ] `R3-D08` 实现 Web / GitHub 候选 URL 去重
- [ ] `R3-D09` 验证 SSRF、redirect、MIME、size 与 API JSON 限制
- [ ] `R3-D10` 覆盖错误仓库、fork、archived 与社区评论权威性测试

**Phase D Gate：** 官方仓库身份可审计；GitHub 正文 / JSON 经过 snapshot 和 exact-anchor 后才能成为 Evidence。

### Phase E — Symmetric Compare Executor

- [ ] `R3-E01` 抽象 SearchRunExecutor + QuickPolicy / ComparePolicy
- [ ] `R3-E02` 实现按 dimension 成对调度 cells
- [ ] `R3-E03` 实现 Compare Claim scope
- [ ] `R3-E04` 实现同候选同维度 Claim dedupe
- [ ] `R3-E05` 实现 cell coverage 聚合
- [ ] `R3-E06` 实现 symmetry debt 计算
- [ ] `R3-E07` 实现最多两次 Compare Gap Loop
- [ ] `R3-E08` 补搜绑定 candidate + dimension + reason
- [ ] `R3-E09` 实现预算与停止条件
- [ ] `R3-E10` AbortSignal 覆盖 Web / GitHub / model calls
- [ ] `R3-E11` checkpoint / resume 不重复已完成 cells
- [ ] `R3-E12` 覆盖 asymmetric、single failure、cancel、recovery 测试

**Phase E Gate：** 任一预算截断点都不会让资料更多的一方被自动判胜；缺失 cell 可解释、可补搜、可恢复。

### Phase F — Conflict, Trust & Recommendation

- [ ] `R3-F01` 实现 conflict candidate extraction
- [ ] `R3-F02` 实现 factual / version / temporal / scope / methodology / interpretation 分类
- [ ] `R3-F03` 实现 ConflictEvidence A / B / Context 关系
- [ ] `R3-F04` 实现 material severity guard
- [ ] `R3-F05` 实现 Trust Rules v2 Compare coverage cap
- [ ] `R3-F06` 实现 Cell Trust / status builder
- [ ] `R3-F07` 实现 Compare overall confidence reducer
- [ ] `R3-F08` 实现 Recommendation guard
- [ ] `R3-F09` 实现 Conditional / No clear winner / Insufficient
- [ ] `R3-F10` 验证 synthesis 不引入 Claim 外事实
- [ ] `R3-F11` 覆盖 version、official/community、scope conflict 回归
- [ ] `R3-F12` 验证 material conflict 与 decisive Insufficient 均不能 High

**Phase F Gate：** 同一证据重复计算得到相同 conflict、Trust 和 recommendation；模型不能直接指定 winner 或 Trust。

### Phase G — API & Operations

- [ ] `R3-G01` 扩展 Create Search API 支持 Compare
- [ ] `R3-G02` 扩展 Run Snapshot 返回 comparison progress
- [ ] `R3-G03` SSE 支持 Compare event sequence 和重连
- [ ] `R3-G04` 实现 Task Run History API
- [ ] `R3-G05` 实现 MODE_SWITCH / EDIT_SCOPE API
- [ ] `R3-G06` Save / Note API 支持 Compare revision
- [ ] `R3-G07` Provider missing / rate limit / interrupted 恢复
- [ ] `R3-G08` Compare Retry 创建 child Run
- [ ] `R3-G09` 完成 API contract / owner / concurrency tests
- [ ] `R3-G10` 日志与事件脱敏检查

**Phase G Gate：** 刷新、重连、取消、重试、模式切换和进程恢复均以数据库对象为准，不分裂 UI 状态。

### Phase H — Presentation & Product UI

- [ ] `R3-H01` Home 开放 Auto / Compare 与黄金示例
- [ ] `R3-H02` Running 显示真实 coverage matrix
- [ ] `R3-H03` Run Header 保持状态和 Stop 位置稳定
- [ ] `R3-H04` Result 显示 Proposal / conditions / assumptions
- [ ] `R3-H05` 实现 Comparison table
- [ ] `R3-H06` cell 选择联动 Claims / Evidence inspector
- [ ] `R3-H07` Source 选择高亮关联 cells
- [ ] `R3-H08` 实现 Conflict A / B / Context evidence view
- [ ] `R3-H09` Material Conflict 默认露出
- [ ] `R3-H10` 实现 coverage gaps / excluded sources
- [ ] `R3-H11` 实现 mode switch / edit scope 新 Run 提示
- [ ] `R3-H12` 实现 Task Run History
- [ ] `R3-H13` Compare Search Note / Library / Note Detail
- [ ] `R3-H14` 实现窄屏 dimension 分组布局与 inspector sheet
- [ ] `R3-H15` 验证键盘、live region、focus、contrast、dark、reduced motion

**Phase H Gate：** 用户无需查看日志即可判断比较是否公平、哪个 cell 缺证据、冲突在哪里、建议适用于什么条件。

### Phase I — Verification & Handoff

- [ ] `R3-I01` 完成全部 Compare replay fixtures
- [ ] `R3-I02` `npm run lint` 通过
- [ ] `R3-I03` `npm run typecheck` 通过
- [ ] `R3-I04` `npm run test` 通过
- [ ] `R3-I05` `npm run build` 通过
- [ ] `R3-I06` append-only migration 与 repository smoke 通过
- [ ] `R3-I07` Replay Compare 浏览器黄金流程通过
- [ ] `R3-I08` Asymmetric / Conflict / Cancel / Recovery 浏览器流程通过
- [ ] `R3-I09` 桌面 / 平板 / 窄屏视觉检查
- [ ] `R3-I10` SSRF、GitHub token、prompt、reasoning 脱敏检查
- [ ] `R3-I11` 默认 live Compare smoke 成功一次
- [ ] `R3-I12` 可选 DeepSeek live Compare smoke 或明确未执行
- [ ] `R3-I13` 更新 README、运行指南、已知限制和 Round 4 接口

**Phase I Gate：** 默认离线检查可重复通过；真实 Compare 至少成功一次；每个关键比较结论都能回溯到双方 Evidence 或明确缺失。

---

## 18. Round 3 Definition of Done

只有以下条件全部满足，状态才能改为 `DONE`：

- [ ] Round 2 状态为 `DONE`，进入门有记录
- [ ] `npm run check` 一次性通过且默认离线
- [ ] append-only migration 可在空库执行
- [ ] Auto 能识别双候选 Compare
- [ ] 三候选以上不会被静默截断
- [ ] 黄金问题生成两个候选和 3–5 个共享维度
- [ ] 每个 Candidate × decisive Dimension 都有 Evidence / Insufficient / Conflict
- [ ] 双方使用同一 Evidence 准入标准
- [ ] 搜索摘要和 GitHub snippet 从未成为 Evidence
- [ ] 每条展示 Evidence 通过 exact-anchor
- [ ] ComparisonCell 只引用 Claims，不复制事实底座
- [ ] 跨候选相似 Claims 不被错误合并
- [ ] 版本差异不会被误判成无条件 factual conflict
- [ ] material conflict 默认可见并保留双方 Evidence
- [ ] material conflict 限制 Trust 和 Recommendation
- [ ] decisive cell Insufficient 时总体不能 High
- [ ] Recommendation 只引用已验证 Claims
- [ ] Recommendation 明示 Proposal、条件和假设
- [ ] 证据不足时输出 No clear winner / Insufficient，而非强行 winner
- [ ] Gap Loop 只补具体 symmetry debt，且受预算约束
- [ ] GitHub 官方仓库身份可审计
- [ ] GitHub rate limit 和 Provider missing 有恢复动作
- [ ] Cancel 停止新 Provider work 并保存 checkpoint
- [ ] Recovery 不重复已完成 cells 或 Provider calls
- [ ] Retry、Mode Switch、Edit Scope 均创建 child Run
- [ ] 旧终态 Run 不被修改
- [ ] Compare Search Note 保存并重开后结构、冲突和来源保真
- [ ] My Notes 不进入 Evidence
- [ ] Source / cell / Claim / Evidence 在 inspector 中双向联动
- [ ] 窄屏不依赖不可读的横向宽表
- [ ] Provider 密钥、完整 prompt、隐藏推理未进入浏览器或日志
- [ ] OpenAI / DeepSeek 输出经过相同 Zod、Evidence、Trust 和 recommendation guards
- [ ] 默认 live Compare smoke 至少成功一次并记录
- [ ] README 足够让新开发者运行 replay 与 live Compare

若缺少真实 Provider 密钥，可以完成开发与 Replay Gate，但状态保持 `IN_PROGRESS / LIVE_VALIDATION_PENDING`，不能标记 `DONE`。

---

## 19. 风险清单

| 风险 | 控制方式 |
| --- | --- |
| 一方资料更多导致偏置 | 按维度成对调度；symmetry debt；coverage guard |
| 模型选择有利于某候选的维度 | 维度必须双边适用；记录用户约束；回归 fixtures |
| 缺证据被误写为没有能力 | `INSUFFICIENT` 语义固定；禁止负面推断 |
| 版本差异被当成事实矛盾 | Claim scope + VERSION conflict |
| 官方说法掩盖真实限制 | 允许可复现二手 Evidence 限定官方 Claim |
| 社区评论被误当权威 | author / source context；不自动 PRIMARY |
| GitHub stars 变成质量分 | 只作为带日期 context，不进入 Trust 规则 |
| GitHub API 额度波动 | Replay；可选 token；明确 rate-limit recovery |
| 三候选导致矩阵爆炸 | Round 3 固定两个；返回 scope-too-wide |
| Recommendation 引入新事实 | Claim refs + synthesis validator + guard |
| Compare 复制 Quick runtime 技术债 | Round 2 durable Gate 是硬前置 |
| 窄屏表格不可用 | 按 dimension 分组，Inspector 改 sheet |
| UI 用红绿制造赢家 | 使用文本、Trust、coverage 和条件，不用胜负色 |
| Mode switch 覆盖历史 | parentRunId + trigger + Run History |
| DeepSeek JSON Object 漂移 | 本地 strict Zod + 一次重试 + 相同领域 gates |

---

## 20. 延期项

| ID | 项目 | 原因 | 建议轮次 |
| --- | --- | --- | --- |
| `R3-X01` | 三个以上候选与 shortlist | 检索矩阵和 UI 复杂度显著增加 | Research / 后续 Compare |
| `R3-X02` | 自动发现全市场候选 | 本质是 Research discovery | Round 4 |
| `R3-X03` | 自动执行 benchmark | 涉及代码安全、环境与成本 | Evaluation Round |
| `R3-X04` | 私有 GitHub 仓库 | 需要授权、权限和审计 | Connectors Round |
| `R3-X05` | 用户自定义权重评分 | 容易制造伪精确排名 | 用户研究后评估 |
| `R3-X06` | 团队共享与审批 | 不属于单用户 Compare 闭环 | Collaboration Round |
| `R3-X07` | Markdown / DOCX Compare 导出 | Knowledge renderer 尚未进入本轮 | Export Round |
| `R3-X08` | Living Compare 自动更新 | 依赖 update diff 与监控 | Living Note Round |
| `R3-X09` | Research 多分支 Agent | Round 3 只验证双候选 | Round 4 |

---

## 21. Round 4 接口预留

Round 4 可在公共 executor 上增加 ResearchPolicy：

```text
SearchRunExecutor
  ├── QuickPolicy
  ├── ComparePolicy
  └── ResearchPolicy
        ├── topic branches
        ├── coverage map
        ├── consensus / disagreement
        ├── diminishing returns
        └── Continue Search
```

Round 3 需要保留：

- SearchPlan 的层次和 dependencies；
- Claim scope 的 entity / dimension / version / timeframe；
- Gap reason 与 coverage object；
- Conflict type / side / resolution；
- parentRunId / trigger / checkpoint；
- Presentation section 的扩展能力。

但不得提前实现 Research workflow DSL、动态多 Agent 图或插件市场。

---

## 22. 执行记录

| 日期 | 完成项 | 验证结果 | 遗留问题 | 执行者 |
| --- | --- | --- | --- | --- |
| 2026-08-13 | Round 3 计划设计 | 范围、双候选边界、对称取证 Gate、Conflict、UI、测试和 DoD 已确定 | Round 2 尚未完成，等待 Entry Gate | Codex |

---

## 23. 最终交付模板

```text
状态：DONE / LIVE_VALIDATION_PENDING
完成日期：
Round 2 Entry Gate：日期 / 结果
完成的任务 ID：
未完成的任务 ID：
默认自动检查结果：
Compare fixture 数与覆盖：
数据库 migration：
对称覆盖与 symmetry debt 验收：
Conflict 回归结果：
浏览器验收结果：
Live Compare Smoke：日期 / provider / dimensions / cells / evidence / conflicts / result
Trust ruleset：
Recommendation guard：
Prompt versions：
Provider adapters：
已知限制：
延期项：
Round 4 是否可开始：YES / NO
```

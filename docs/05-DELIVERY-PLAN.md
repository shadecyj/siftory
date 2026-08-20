# Siftory V0.1 交付计划

## 1. 实现策略

按“能跑通并可验证的垂直闭环”实现，不按 Search / Trust / Knowledge 三个大团队横向分别开发。每个里程碑都必须产生用户可见、可测试的端到端能力。

推荐先做 Quick 黄金路径，再扩展 Compare / Research；否则最难的多轮 Agent 会掩盖数据模型和证据链问题。

## 2. 里程碑

### M0 — Contract Foundation

目标：让四份规格成为代码可以依赖的契约。

交付：

- 领域 enums 和 ID 规范；
- SearchTask / SearchRun / Claim / Evidence / Source / SearchNote 核心 schema；
- 状态迁移验证器；
- StructuredResult schema；
- Markdown / DOCX Renderer interface；
- 三条黄金问题和预期结果 fixture。

完成标准：schema 可迁移；非法状态迁移、悬空 Claim refs、无 Evidence 的 High Claim 都被自动测试拒绝。

### M1 — Quick Evidence Loop

目标：跑通“搜索 → 证据 → 答案”。

交付：

- 极简 Home；
- Intent 判断与 Quick Planner；
- Web + Official 来源路由；
- Source / Snapshot / Evidence 保存；
- Claim 提取、ClaimEvidence、Trust summary；
- Search Workspace Running / Completed / Partial；
- 基础事件和运行指标。

完成标准：“Python 怎么删除 dict key？”端到端通过；关键 Claim 可定位到官方证据；取消、单来源失败和证据不足状态正确。

### M2 — Compare + Conflict

目标：验证 Siftory 不只是带引用的答案生成器。

交付：

- Compare 模式和共享比较维度；
- GitHub 路由；
- 候选对称取证检查；
- Conflict / ConflictEvidence；
- Comparison 与 Contradictions UI；
- 模式切换生成新 Run、Run history。

完成标准：“LangGraph 和 CrewAI 怎么选？”能给出条件化建议；每个关键维度均可回溯双方证据；版本冲突不被隐藏。

### M3 — Research Agent Loop

目标：加入真正受控的多轮研究能力。

交付：

- Research 分层 Plan；
- GapAnalysis 和补搜循环；
- 搜索预算、停止原因和 diminishing returns；
- Research 结构化结果；
- Search details、queries、excluded sources；
- checkpoint / retry / continue search。

完成标准：“Agent Memory 目前有哪些技术路线？”能展示路线、代表实现、局限、争议和未知项；达到预算时可交付 Partial，不产生无界循环。

### M4 — Knowledge Loop

目标：完成“Search becomes knowledge”。

交付：

- SearchNote / NoteRevision；
- Save、Inbox、Recent、Favorites、Collections、Tags；
- Search Note Detail 和 My Notes；
- Library 基础搜索 / 筛选；
- Markdown Renderer；
- DOCX Renderer；
- 导出完整性校验。

完成标准：三个黄金用例都可保存、回访、分类并导出；导出引用关系、搜索日期和个人笔记正确；重新运行不覆盖旧 revision。

### M5 — V0.1 Hardening

目标：满足 PRD 退出条件，准备受控内测。

交付：

- 三种模式质量评测集；
- 证据定位和引用完整性测试；
- Trust ruleset 回归测试；
- 失败、超时、取消、恢复测试；
- 隐私、所有权和数据删除检查；
- 延迟、成本和查询预算基线；
- 产品埋点和用户反馈入口。

完成标准：PRD 第 12 节全部通过；没有 P0/P1 数据链路缺陷；V0.1 外功能未进入关键路径。

## 3. 推荐代码模块边界

具体技术栈确定后可调整目录名，但依赖方向应保持：

```text
apps/
├── web                    # Home、Workspace、Library、Note
└── worker                 # Agent 后台任务

packages/
├── domain                 # 实体、枚举、不变量；不依赖 UI / Provider
├── agent                  # 状态机、Planner、Router、Gap loop
├── retrieval              # Web / Official / GitHub adapters
├── evidence               # Snapshot、提取、Claim linking、Conflict
├── trust                  # 解释型规则和聚合
├── presentation           # StructuredResult builders
├── knowledge              # Note、Library、Revision
├── renderers              # Markdown / DOCX
├── persistence            # schema、repositories、migrations
└── contracts              # API / event schemas
```

依赖规则：

- `domain` 不依赖 LLM、搜索 Provider、数据库 ORM 或前端；
- Provider adapter 不直接生成最终答案；
- Renderer 只读取结构化 Note view；
- UI 不自行重算 Trust；
- LLM 输出先通过 contracts 验证，再写入领域对象。

## 4. 首批接口契约

原型阶段只需围绕以下能力设计 API，不要为每张表直接暴露 CRUD：

```text
POST   /search-tasks
POST   /search-tasks/:taskId/runs
GET    /search-runs/:runId
GET    /search-runs/:runId/events
POST   /search-runs/:runId/cancel
POST   /search-runs/:runId/continue
POST   /search-runs/:runId/save

GET    /notes
GET    /notes/:noteId
PATCH  /notes/:noteId/organization
POST   /notes/:noteId/user-notes
POST   /notes/:noteId/exports
GET    /exports/:exportId
```

运行进度可用 SSE；V0.1 若不需要客户端双向实时控制，无需为了潮流引入 WebSocket。

## 5. 黄金评测集

除了三个主例子，每种模式至少准备以下边界：

| 类型 | 场景 |
| --- | --- |
| Quick | 有明确官方答案；答案依赖版本；没有可靠答案 |
| Compare | 两个候选资料不对称；比较标准依赖用户约束；官方说法与社区测试冲突 |
| Research | 主题分类存在争议；大量转载造成虚假交叉验证；预算结束仍有关键缺口 |
| Knowledge | 保存后重新运行；用户笔记不进入 Evidence；同 Note 两种格式导出一致 |

每个 fixture 至少标注：预期模式、decisive Claims、允许来源类型、必须出现的冲突 / 限制、不可接受的错误结论。

## 6. Definition of Done

一个功能只有同时满足以下条件才算完成：

1. 在 PRD 中有需求 ID 或明确属于某个现有需求；
2. 在 IA 中有用户可见状态或明确为后台能力；
3. 在状态机中有合法的输入、输出、失败和恢复路径；
4. 在数据模型中有稳定的归属与 provenance；
5. 有成功、失败和边界自动测试；
6. 不破坏 Claim → Evidence → Source 的可追溯链；
7. 有基本可观察指标；
8. 没有把 V0.2+ 能力偷偷加入 V0.1 主路径。

## 7. 需求收敛模板

后续任何新想法先填写：

```text
名称：
用户问题：
归属系统：Search / Trust / Knowledge
任务模式：Quick / Compare / Research / All
影响对象：
影响页面或状态：
为什么是 V0.1 必需：
验收标准：
不做会怎样：
建议版本：V0.1 / V0.2 / Later
```

判定顺序：

```text
是否服务核心闭环？
  ├─ 否 → Later
  └─ 是
      ↓
是否阻塞三条黄金用例或数据正确性？
  ├─ 是 → V0.1
  └─ 否 → V0.2
```

## 8. V0.2+ Backlog 容器

以下能力只保留架构接口，不进入 V0.1 实现：

| 能力 | 已预留接口 | 当前不做 |
| --- | --- | --- |
| Living Note | parent_run、ClaimRelation、NoteRevision | 定时监控、自动 diff UI |
| PDF / JSON 导出 | Renderer interface、ExportJob format | 用户界面和正式 renderer |
| 语义 Library | Claim / Note 结构化数据 | embedding 搜索和知识图谱 |
| Obsidian Sync | Markdown Renderer | 双向同步、冲突解决 |
| 团队协作 | owner scope | workspace、权限、评论 |
| 插件生态 | Retrieval adapter interface | Marketplace 和第三方安装体验 |

## 9. 立即开工顺序

1. 选定技术栈和部署约束；
2. 把领域 enums、StructuredResult、LLM output schema 写成可执行 contracts；
3. 建核心数据库 migration；
4. 用静态 fixture 实现 Completed 结果页，先验证 IA；
5. 接入 Quick 状态机和一个检索 Provider；
6. 打通 Claim → Evidence → Source；
7. 加 Trust rules 和失败状态；
8. 完成第一条黄金用例后再扩 Compare。

在第 6 步以前不要投入复杂视觉动效、通用插件系统或高级 Library 编辑能力。

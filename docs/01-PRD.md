# Siftory V0.1 PRD

**状态：** Baseline
**版本：** 0.1
**产品主张：** Search Engine + Trust Engine + Knowledge Engine

## 1. 产品定义

Siftory 是一个以 LLM 为搜索控制器、以证据和可信度为核心、并将每次搜索沉淀为个人知识资产的 Search Agent。

它不是一个“回答更长”的搜索框。它的核心任务是让用户：

- 更少地手工设计搜索词和翻页筛选；
- 清楚知道重要结论由什么证据支持；
- 看见证据的局限、冲突和时效问题；
- 把一次性搜索变成可继续使用的 Search Note。

## 2. 问题与机会

现有搜索与 AI 问答通常把工作停在“给出答案”：

- 传统搜索返回 URL 列表，验证和整理主要由用户完成；
- AI 问答能综合内容，但引用常停留在页面级，结论与证据关系不清；
- 对话历史不等于知识库，难分类、难导出、难更新；
- 一个静态的“网站可信度分数”无法说明该来源是否支持当前具体结论。

Siftory 用 Claim-first 数据结构把搜索、验证和知识沉淀连成一个闭环。

## 3. 目标用户与核心任务

V0.1 聚焦个人知识工作者：开发者、产品经理、研究者、学生和需要进行轻量资料研究的专业人士。

核心 Jobs to Be Done：

1. 当我只需要一个明确事实或操作方法时，快速给我可验证的答案。
2. 当我需要在多个方案中选择时，按与我问题相关的标准比较，并给出有证据的建议。
3. 当我需要理解一个主题时，规划并执行多轮搜索，呈现主要路线、共识、分歧和未知项。
4. 当结果值得保留时，自动整理成以后能找到、能引用、能导出的知识笔记。

## 4. V0.1 成功标准

V0.1 必须验证三个核心假设：

| 假设 | 产品信号 | 建议指标 |
| --- | --- | --- |
| Agent 能减少用户的搜索组织工作 | 用户无需配置即可完成任务 | 搜索完成率、首次结果后继续补搜率 |
| Claim 级证据能增加可验证感 | 用户会展开证据并认为其有帮助 | Evidence 展开率、结果可信有用率 |
| 搜索结果值得成为知识资产 | 用户会保存、回访或导出 | 保存率、7/30 天回访率、导出率 |

首版不设置单一 North Star 数值门槛；内测后建立基线。质量评估优先于搜索次数增长。

## 5. 搜索任务模式

系统自动判断模式，用户可在搜索前或结果页手动切换。切换模式会创建新一轮 Search Run，不静默覆盖旧结果。

| 模式 | 典型意图 | 默认行为 | 主要输出 |
| --- | --- | --- | --- |
| Quick | 单事实、定义、操作方法 | 少轮次、高相关、优先直接来源 | 简短答案、关键证据、来源 |
| Compare | 方案选择、差异、取舍 | 先形成比较维度，再对称检索 | 比较表、建议、适用条件、冲突 |
| Research | 技术路线、主题综述、开放问题 | 多轮规划、覆盖检查、针对缺口补搜 | 结构化综述、关键 Claims、共识与分歧 |

分类要求：

- 自动判断不应成为阻塞步骤；低置信度时使用最接近的模式开始，并允许用户纠正。
- UI 必须展示当前模式，但不强迫用户在首次搜索前做选择。
- 模式只控制默认搜索策略，不改变 Claim / Evidence / Source 的核心数据结构。

## 6. 核心体验

### 6.1 首页

- 页面核心是一个搜索输入框和提交动作。
- 可用示例帮助首次用户理解 Quick / Compare / Research，但不展示复杂 Agent 配置。
- 模式切换是次要控件；默认使用 Auto。
- 不出现推荐 Feed、广告、新闻流或增长弹窗。

### 6.2 搜索运行中

- 立即确认系统理解的问题和识别出的任务模式。
- 默认只显示简洁进度，例如“正在规划 / 查找来源 / 验证证据 / 整理结果”。
- 用户可展开查看 Search Plan 和当前查询，但运行细节不能压过结果主体。
- 用户可以取消；取消后保留已经获得的部分结果，并明确标记未完成。

### 6.3 搜索结果

默认信息顺序固定为：

1. Question
2. Answer / Recommendation
3. Confidence 摘要：等级、来源总数、第一方来源数
4. Key Evidence
5. Sources

渐进展开内容：Comparison、Contradictions、Search Plan、Trust Analysis、Search Queries、Excluded Sources。

### 6.4 保存与整理

- 成功或部分成功的搜索都可以形成 Search Note。
- Search Note 包含 Title、Summary、Key Claims、Evidence、Sources、Trust Metadata、My Notes、Tags、Collection、Search Date。
- 系统自动建议标题、标签和 Collection，用户可以修改。
- Library 首版只提供 Inbox、Collections、Tags、Favorites、Recent。

### 6.5 导出

- 系统始终从结构化 Search Note 渲染导出文件，不从页面 HTML 或聊天文本反向解析。
- V0.1 支持 Markdown 与 DOCX。
- 导出必须保留标题、摘要、Claims、引用关系、来源 URL、搜索日期和用户笔记。

## 7. 功能需求

### Search Engine

| ID | 需求 | V0.1 验收标准 |
| --- | --- | --- |
| S-01 | 接收自然语言问题 | 可创建 SearchTask，保留原始问题和规范化问题 |
| S-02 | 自动判断任务模式 | 返回 Quick / Compare / Research 之一及判断置信度 |
| S-03 | 生成 Search Plan | Plan 包含目标、查询、来源策略和停止条件 |
| S-04 | 来源路由 | 能优先检索官方文档，并支持普通 Web 与 GitHub 来源 |
| S-05 | 多轮搜索 | 根据证据缺口或冲突生成补充查询，并受预算约束 |
| S-06 | 模式切换 | 用户切换后创建新 Run，历史 Run 可追溯 |
| S-07 | 取消和部分结果 | 取消或部分失败时保留已完成 Claims，并显示完整性提示 |

### Trust Engine

| ID | 需求 | V0.1 验收标准 |
| --- | --- | --- |
| T-01 | Claim 提取 | 重要、可验证的陈述被保存为独立 Claim |
| T-02 | Evidence 链接 | 每个重要 Claim 至少关联一条 Evidence，或明确标记 unsupported |
| T-03 | 来源语境评价 | 对 Authority、Primary、Freshness、Relevance 给出解释型评价 |
| T-04 | 交叉验证 | 标记独立来源支持数量，避免同一内容转载被计算为独立支持 |
| T-05 | 冲突检测 | 保存冲突 Claims / Evidence、冲突类型和未解决状态 |
| T-06 | 置信度 | 输出 High / Medium / Low / Insufficient，并展示原因而非神秘总分 |
| T-07 | 可追溯 | 用户能从 Claim 打开对应 Evidence，再打开 Source |

### Knowledge Engine

| ID | 需求 | V0.1 验收标准 |
| --- | --- | --- |
| K-01 | 自动形成 Search Note | 完成搜索后生成结构化笔记，关联来源 SearchTask 和 Run |
| K-02 | Library | 支持 Inbox、Recent、Favorites、Collections、Tags 视图 |
| K-03 | 用户编辑 | 可改标题、标签、Collection、收藏状态和 My Notes |
| K-04 | 结构化保存 | 用户编辑不破坏 Claim–Evidence–Source 关系 |
| K-05 | Markdown 导出 | 文件可被 Obsidian、VS Code、GitHub 正常读取，链接可点击 |
| K-06 | DOCX 导出 | 文档层级、引用和来源清晰，适合报告或学习材料使用 |

## 8. Trust Engine V0.1 规则

Trust 评估对象是 **Claim 在当前搜索上下文中的证据支持程度**。

评估维度：

- **Authority**：来源是否具备回答当前问题的专业或制度权威。
- **Primary Source**：是否为原始发布者、官方文档、原始研究或直接数据。
- **Freshness**：发布时间或适用版本是否满足该 Claim 的时效要求。
- **Claim Relevance**：Evidence 是否直接支持 Claim，而非只讨论相邻主题。
- **Cross Verification**：是否有真正独立的来源相互印证。

输出等级：

| 等级 | 含义 |
| --- | --- |
| High | 有直接且高质量的证据，关键来源一致，无实质冲突 |
| Medium | 有合理支持，但存在时效、版本、间接证据或有限冲突 |
| Low | 支持薄弱、来源质量有限或存在重要未解决冲突 |
| Insufficient | 尚无足够证据支持或反驳，不应生成确定性结论 |

约束：

- 不展示虚假精确的全局网站分数。
- 不以来源数量替代来源独立性和证据相关性。
- “未发现冲突”不等于“事实已被证明”。
- 系统生成的解释必须能由保存的评价因子重建。

## 9. 非功能需求

- **可追溯性**：用户看到的结论、置信度和来源数量必须与持久化数据一致。
- **可恢复性**：单个来源失败不能使整个任务失败；所有外部调用都记录状态。
- **幂等性**：重复的 Run 事件不得生成重复 Claim、Evidence 或 Note。
- **可观察性**：记录每个状态耗时、查询次数、来源命中、失败原因和 token / 搜索预算。
- **隐私**：Search Note 默认为用户私有；V0.1 不提供公开分享或团队协作。
- **可导出性**：用户数据不能被锁死在应用内。
- **无障碍**：关键置信度与冲突信息不能只靠颜色表达。

## 10. V0.1 范围

### 做

- 极简首页
- Search Agent
- Quick / Compare / Research 自动判断与手动切换
- Search Planner
- Web Search、Official Source Routing、GitHub Search
- Claim Extraction、Evidence Linking
- 解释型 Trust Engine、Conflict Detection
- Structured Results、Search Note
- Library、Tags、Collections、Favorites
- Markdown、DOCX Export

### 暂时不做

- 社交、公开分享、推荐 Feed
- Marketplace、Agent Marketplace、几十种插件
- 团队协作和复杂权限
- 通用复杂 Database 或 Notion 式自由搭建
- 移动 App
- 完整 Obsidian 双向同步
- 知识图谱可视化
- 自动长期监控
- PDF / JSON 用户导出界面（数据层可保留 Renderer 接口）

## 11. 端到端验收场景

### Quick

输入“Python 怎么删除 dict key？”，系统自动识别为 Quick，在结果中给出简短可执行答案；关键 Claim 可展开到 Python 官方文档证据；保存后形成可导出的 Search Note。

### Compare

输入“LangGraph 和 CrewAI 怎么选？”，系统自动识别为 Compare，先确定对用户问题有意义的比较维度，再对两者进行对称取证；推荐必须说明适用条件；版本差异或来源冲突必须显式呈现。

### Research

输入“Agent Memory 目前有哪些技术路线？”，系统自动识别为 Research，生成多阶段计划，围绕路线分类、代表实现、局限和争议进行补搜；结果包含结构化综述、主要 Claims、证据、冲突和未知项。

## 12. V0.1 退出条件

只有同时满足以下条件才可称为 V0.1：

1. 三种模式各有至少一条端到端黄金用例通过。
2. 任何重要 Claim 都能追溯到 Evidence 和 Source，或被明确标记为证据不足。
3. 搜索失败、取消、来源冲突均有可理解的用户状态。
4. 搜索结果可保存到 Library，并能再次打开。
5. 同一 Search Note 可稳定导出 Markdown 和 DOCX。
6. 新功能清单中所有 V0.1 外项目均未阻塞核心闭环交付。

## 13. 已锁定的产品决策

以下决策视为 V0.1 baseline。若要修改，必须同时更新受影响的 IA、状态机和数据模型，不能只在实现中绕过：

| 决策 | 结论 |
| --- | --- |
| 核心知识单位 | Claim，而不是 URL、Answer 或聊天消息 |
| 执行生命周期 | SearchTask 保存问题；SearchRun 保存一次执行；SearchNote 保存用户选择的知识快照 |
| 模式选择 | 默认 Auto，允许手动切换；切换创建新 Run，不覆盖历史 |
| Trust 模型 | Claim-contextual、解释型规则；V0.1 不提供网站永久总分 |
| 保存语义 | 先生成结构化 Note draft；用户 Save 后进入 Library |
| 事实编辑边界 | 用户笔记与系统事实层分离；V0.1 不直接改写 Claim / Evidence |
| 导出架构 | Renderer 从指定 NoteRevision 生成；首版 Markdown + DOCX |
| 冲突可见性 | 实质冲突必须出现在默认结果摘要，不能只藏在高级面板 |
| 更新策略 | V0.1 预留 revision / relation；Living Note 的监控和 diff UI 延后 |

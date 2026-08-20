# Siftory GitHub 展示与公开说明规划

**状态：** `PLANNED`
**前置状态：** `INTERVIEW_MVP_DONE`
**目标：** 把可运行的 Siftory MVP 包装成面试官能在 30 秒理解、3 分钟浏览、10 分钟深挖的公开 GitHub 项目。

---

## 1. 读者路径

公开仓库按三层组织，不把 PRD、实现细节和演示话术堆在同一页。

```text
30 秒：README
  └── 它解决什么问题、核心截图、为什么不同、如何运行

3 分钟：Showcase
  └── Search → Trust → Knowledge 完整产品流程

10 分钟：Technical Notes
  └── Claim-first、Trust rules、durable runtime、边界与失败恢复
```

面试官不需要先理解 Round、Agent 内部术语或整个 V0.1 愿景，才能看懂当前交付物。

## 2. 公开文件结构

```text
README.md                         # GitHub 主说明页，中文优先
README.en.md                      # 可选英文版，不阻塞首次发布
SECURITY.md                       # 密钥、数据、Prompt 与漏洞报告边界
LICENSE                           # MIT 或保留版权，发布前由项目所有者选择
CHANGELOG.md                      # v0.1.0-interview-mvp 发布摘要

docs/
├── SHOWCASE.md                   # 3 分钟产品导览
├── ARCHITECTURE.md               # Search / Trust / Knowledge 与运行架构
├── TRUST-MODEL.md                # Claim → Evidence → Source 与置信度规则
├── RELIABILITY.md                # durable runtime、失败状态、Replay 兜底、测试矩阵
├── SCOPE-AND-ROADMAP.md          # 已完成、未完成、Compare / Research 后续边界
├── 08-INTERVIEW-DEMO.md          # 已有的 5–8 分钟现场讲述稿
├── acceptance/
│   └── ir4-live-2026-08-14.json  # 已有脱敏 Live 验收记录
└── screenshots/
    └── ir4/                      # 已有最终截图

.github/
└── workflows/
    └── ci.yml                    # 默认离线质量门，不消耗真实 Provider 配额
```

现有 `01-PRD.md` 到 `07-ROUND2-DURABLE-RUNTIME.md` 继续保留为深层设计资料，但 README 只链接最有解释力的 3–4 篇。`round/` 属于执行档案，不放在 README 主导航；公开时可以保留，但应增加归档说明，避免面试官误以为未勾选的远期计划是当前缺陷。

## 3. 展示文件

### 3.1 必须项

| 文件 | 内容 | 状态 |
| --- | --- | --- |
| `docs/screenshots/ir4/desktop.png` | Answer、Confidence、Source Inspector | 已有 |
| `docs/screenshots/ir4/library.png` | 收藏、分类、知识留存 | 已有 |
| `docs/screenshots/ir4/narrow-inspector.png` | 响应式 Evidence Inspector | 已有 |
| `docs/acceptance/ir4-live-2026-08-14.json` | 脱敏真实 Provider 证明 | 已有 |
| README Mermaid 架构图 | Search → Trust → Knowledge | 已有基础，需最终精简 |

### 3.2 建议增加

- 一张 `1280 × 640` Social Preview：产品名、一句话价值、真实结果界面局部，不使用机器人、发光球或 AI 紫色渐变。
- 一段 60–90 秒无声或带字幕演示：Query → Confidence → Evidence → Save → Library；作为 GitHub Release asset 或外部视频链接，不把大视频直接提交进 Git history。
- 一张静态 Evidence 关系图：一个 Claim 对应 Evidence excerpt、Snapshot 和 Source，便于面试官快速理解差异。

### 3.3 不建议增加

- 假数据仪表盘、虚构用户量、虚构性能指标；
- 十几张尺寸不一致的截图；
- 自动播放背景视频；
- 把 `.env`、终端环境变量、完整 Prompt 或隐藏推理录进演示；
- 为了“像产品”临时增加尚未实现的 Pricing、团队协作或 Marketplace 页面。

## 4. README 主说明页

README 是 GitHub 上线后的第一说明页，应控制在约 800–1,500 中文字，结构固定为：

1. **Hero**：Siftory + 一句话定义 + `INTERVIEW_MVP_DONE` / `Quick vertical slice` 状态。
2. **真实产品截图**：优先放结果页，一屏内能看到 Confidence 与 Evidence Inspector。
3. **核心流程**：`Search → Verify → Keep`，不先展开所有引擎模块。
4. **为什么不是普通 RAG**：Claim-first、deterministic Trust、durable Knowledge 三点。
5. **第二张截图**：Library 收藏与分类闭环。
6. **架构图**：Search Engine → Trust Engine → Knowledge Engine。
7. **快速运行**：Replay 三条命令；Live 只列变量名，不列值。
8. **可信证明**：85 tests、11 DB smoke、Live acceptance、restart reopen。
9. **当前边界**：Quick 已完成；Compare、Research、Export、Auth、Production deployment 未完成。
10. **深入阅读**：Showcase、Architecture、Trust、Demo Script。

README 不把完整 PRD、全部 Round 计划、所有表结构和长篇 FAQ平铺出来。

## 5. 说明文件职责

### `docs/SHOWCASE.md`

用一次真实问题贯穿产品：输入、运行、Answer、Confidence、Claim、Evidence、Source、保存、建议分类、Library 重开。每一节最多一张图和三段短文。

### `docs/ARCHITECTURE.md`

包含两个层次：

- 产品架构：Search / Trust / Knowledge；
- 运行架构：Next.js API → Agent → Provider Ports → Evidence Gate → Trust Rules → Persistence。

只展示重要边界与数据流，不复制全部数据库 schema。

### `docs/TRUST-MODEL.md`

解释：

- Claim 为什么是核心单位；
- Evidence 必须 exact-anchor；
- Source authority 是 Claim-contextual；
- Overall Confidence 如何受决定性 Claim 约束；
- Insufficient、Conflict、Freshness unknown 如何降级；
- Confidence 是解释型等级，不是假装统计概率。

### `docs/RELIABILITY.md`

解释 durable checkpoint、ordered events、stale recovery、Retry-as-new-run、Replay / Live 边界、默认离线 Gate 和显式 Live acceptance。

### `docs/SCOPE-AND-ROADMAP.md`

把“框架愿景”和“当前已交付”分开：

- `Now`：Quick vertical slice；
- `Next candidate`：Compare 对称取证；
- `Later`：Research、Export、Living Note；
- `Not claimed`：Auth、团队协作、生产部署。

### `SECURITY.md`

说明密钥只在服务端读取、`.env` 不提交、无 `NEXT_PUBLIC_*` 密钥、验收记录脱敏、Prompt/隐藏推理不暴露，以及公开漏洞的联系方法。

## 6. GitHub 上线后的仓库说明

### Repository About

推荐描述：

```text
Evidence-first Search Agent that turns web search into verifiable, durable knowledge.
```

推荐 Topics：

```text
search-agent
llm
rag
evidence
ai-search
nextjs
typescript
deepseek
tavily
```

### Release

创建 `v0.1.0-interview-mvp`，Release Notes 只写：

- Quick Live Search；
- Claim → Evidence → Source；
- deterministic Trust；
- durable Search Note；
- Favorite / Category / Library；
- Replay fallback；
- 当前限制。

### GitHub Pages

首次发布不要求 GitHub Pages。README 已足够成为主说明页。只有在需要投递作品集链接、希望非技术招聘者获得更强视觉引导时，再增加单页 Showcase；该页面应复用真实截图和同一套 Cognitive Workbench 视觉语言，不另造一套品牌。

## 7. 公开前仓库卫生

- 初始化 Git 仓库；当前目录尚未形成可展示的提交历史。
- 不伪造或回填历史提交；从公开基线开始保持真实、清晰的提交。
- `.gitignore` 增加 `.artifacts/`、`*.tsbuildinfo`，继续忽略 `.env`、`.searchos/`、`node_modules/`、`.next/` 和 `dist/`。
- 执行凭据扫描，确认源码、文档、截图和 Git history 均无密钥。
- 检查所有截图不含本地用户名、绝对路径、浏览器个人信息和终端密钥。
- 决定 License；没有 License 的公开仓库不等于开源。
- CI 只运行默认离线 Gate；Live acceptance 保持人工显式触发，避免消耗额度。
- 不提交 PGlite 数据目录、运行日志、大视频和临时截图。

推荐的真实提交顺序：

```text
feat: publish Siftory interview MVP baseline
docs: add public showcase and architecture notes
ci: add offline verification workflow
docs: add v0.1.0 release notes and social preview
```

## 8. 执行 Round

### GitHub Round 1 — Public Hygiene

- [ ] 检查 `.gitignore` 和生成物
- [ ] 执行密钥与隐私扫描
- [ ] 确定 License
- [ ] 初始化 Git，并创建诚实的 MVP baseline commit

### GitHub Round 2 — Showcase Pack

- [ ] 编写 `SHOWCASE.md`
- [ ] 编写 `ARCHITECTURE.md`
- [ ] 编写 `TRUST-MODEL.md`
- [ ] 编写 `RELIABILITY.md`
- [ ] 编写 `SCOPE-AND-ROADMAP.md`
- [ ] 生成 Social Preview
- [ ] 录制 60–90 秒备用演示

### GitHub Round 3 — README & Repository

- [ ] 重写 README 为 30 秒入口页
- [ ] 增加 `SECURITY.md` 和 `CHANGELOG.md`
- [ ] 增加离线 CI
- [ ] 校验所有相对链接和图片
- [ ] 创建公开仓库、About、Topics 和 `v0.1.0-interview-mvp` Release

### GitHub Round 4 — External Review

- [ ] 使用无登录浏览器检查仓库首屏
- [ ] 在全新目录执行 clone → install → build → Replay
- [ ] 确认 CI 为绿色
- [ ] 请一名不了解项目的人在 30 秒内复述产品差异
- [ ] 从简历和作品集链接进入仓库，完成最后一次导航检查

## 9. 发布 Gate

只有同时满足以下条件才公开：

- README 首屏 30 秒内说明产品、差异和当前范围；
- 两张核心截图可直接显示；
- Replay 克隆后可运行；
- CI 通过；
- Live 记录脱敏；
- `.env`、本地数据库、日志和凭据不在 Git 中；
- 不宣称 Compare、Research、Export、Auth 或 Production deployment 已完成；
- Release、About、Topics 与 README 使用一致表述。

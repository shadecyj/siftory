# Siftory GitHub Readiness Round 0：全局语言与安全设置

**状态：** `IMPLEMENTED — AUTOMATED GATES PASS · MANUAL LIVE ACCEPTANCE PENDING`
**前置状态：** `INTERVIEW_MVP_DONE`
**本轮定位：** GitHub 公开前的产品完整性与本地密钥安全加固；本文件获确认前不开始实现。
**本轮目标：** 让 Siftory 在中文和英文两种界面下都可完整使用，并让桌面安装版能在不暴露密钥的前提下配置、验证和启用 Live Search。

---

## 1. 完成后的用户体验

### 1.1 全局中英文

用户可以在任意主工作区通过侧栏底部的紧凑语言切换器，或在 Settings 中选择：

    中文（简体） / English

切换后立即更新当前页面的产品界面，包括导航、按钮、表单、空状态、错误状态、运行进度、置信度说明、日期格式、辅助功能标签和页面的 HTML language 标记；刷新、重启桌面应用后仍保持选择。

语言切换不会打断正在输入的问题、当前筛选、已展开的证据检查器或当前页面路由。

### 1.2 搜索输出语言

界面语言与证据资产必须分开处理。

- 新发起的搜索默认以当前界面语言请求模型生成 Answer、Claim、摘要和运行文案；请求会记录当时的 outputLocale。
- 用户的原始问题、网页标题、原文摘录、引用、Evidence Snapshot、已保存 Search Note 和个人笔记始终保留原语言。
- 切换语言只翻译 Siftory 的产品界面，不伪造“已翻译”的证据，也不改写历史搜索结果。
- 已保存的英文或中文结果在另一种界面语言下仍可被正确阅读和追溯。

这样既能形成真实的英文体验，也不会伤害 Claim → Evidence → Source 的可验证性。

### 1.3 Settings 工作区

侧栏主导航新增：

    Search  ·  Library  ·  Settings

Settings 不是弹窗堆叠，而是一个独立工作区。桌面宽屏采用“主配置区 + 状态说明区”；窄屏按同样顺序纵向折叠。

Settings 的最小信息架构：

| 区域 | 用户能做什么 | 关键状态 |
| --- | --- | --- |
| Appearance & Language | 修改界面语言、沿用现有主题偏好 | 当前已生效 |
| Runtime | 查看 Replay / Live，知道变更是否需要重启本地搜索运行时 | Active / Restart required / Restarting |
| Search Provider | 选择 Tavily 或 Brave，配置搜索 Key | Not configured / Saved / Verified / Failed |
| Model Provider | 选择 DeepSeek 或 OpenAI，配置模型、必要时调整 Base URL | Not configured / Saved / Verified / Failed |
| Security & Data | 查看密钥和知识数据的本地边界，清除指定凭据或切回 Replay | Local only / Key never shown |

默认推荐组合仍为 Tavily + DeepSeek；Replay 始终可用，未配置或验证失败时不会伪装为 Live。

---

## 2. 本轮产品与安全决策

以下是本 Round 的默认决策，作为审查重点。

### D1 — 语言作用域

全局语言指“界面与新搜索的输出语言”，不是对历史知识资产做机器翻译。后续若需要独立的 Answer Language 或逐段翻译，应作为新能力另开 Round。

### D2 — Web 与 Desktop 的边界

- 从源码运行的 Web 版 Settings 只显示环境状态和 .env.local 配置指引；不在浏览器、localStorage 或普通 Web API 中持久化用户 API Key。
- Windows 桌面安装版才提供应用内 Key 配置，并仅将 Key 保存至操作系统保护的本地安全存储。
- GitHub 公开版的 .env.example 只保留变量名与说明，不出现任何真实值。

### D3 — 凭据编辑的安全边界

主 Settings 页面负责展示状态、选择 Provider、测试结果和运行时切换；实际输入/清除 API Key 的控件默认由 Tauri bundled UI 的受限凭据面板承载，而不是让随机端口的 localhost Next 页面获得通用原生密钥读取权限。

该凭据面板与 Siftory 的视觉语言保持一致，但只拥有以下最小能力：

    save_live_profile
    get_live_profile_status
    test_live_profile
    activate_live_profile
    clear_live_profile

其中只有 save_live_profile 接收明文输入；任何读取方法都只返回脱敏状态，绝不返回原始 Key。

若预研证明受限的 loopback bridge 能以同等安全性实现，也可以在不扩大权限的前提下合并到主 Settings 页面；否则保持上述原生面板方案。不能为了页面一致性放宽安全模型。

### D4 — 密钥存放与运行时切换

- 使用 Windows 受保护的密钥材料解锁 Tauri 的加密凭据容器（Stronghold 或同等级原生 secret mechanism）。
- 不把固定解锁密码、原始 API Key 或其可逆副本写进代码、普通 JSON、PGlite、Search Note、SSE 事件、日志、React props、URL 或 localStorage。
- 保存后的密钥只在 Tauri 进程内读取，并在启动 Node/Next sidecar 时以子进程环境变量临时注入。
- 应用 Live 配置时，先验证新配置；再有序停止旧 sidecar、启动新 sidecar、健康检查成功后重新载入工作区。
- 若新配置测试、启动或健康检查失败，保留原来可用的 Runtime；若无旧配置，则明确回退 Replay。
- 有搜索正在执行时禁止应用配置；用户必须等待结束或主动取消，避免破坏 durable run。

---

## 3. 目标架构与数据契约

### 3.1 Locale 层

    LocalePreference
      locale: zh-CN | en-US
      updatedAt

    Search request
      outputLocale: zh-CN | en-US

    SearchTask / SearchNote metadata
      outputLocale              # 此次结果产生时的语言

实现采用类型安全字典，而不是在组件中散落中英三元表达式：

    apps/web/lib/i18n/
      locale.ts                 # Locale、fallback 与校验
      messages.zh-CN.ts
      messages.en-US.ts
      translate.ts               # t(key, variables)
      locale-provider.tsx       # 全局 React 状态和无刷新切换

初始语言由安全 Cookie 供根布局读取；客户端以 localStorage 作为镜像以获得即时切换，并同步更新 Cookie、document.documentElement.lang 与 Intl 格式化器。无需 URL 路径前缀，避免影响现有桌面工作台路由。

所有产品文案使用 message key。领域对象保存稳定状态码与必要 payload；UI 在展示时再按 locale 渲染。旧的持久化 summary 只作为兼容 fallback，不能继续作为唯一的用户可见运行文案来源。

### 3.2 安全运行时配置

    RuntimeProfileMetadata      # 可安全返回给 UI / API
      runtimeMode
      searchProvider
      modelProvider
      model
      modelBaseUrl
      searchKeyConfigured
      modelKeyConfigured
      validationState
      lastValidatedAt
      revision

    RuntimeSecretInput          # 仅写入路径短暂接收
      searchApiKey?
      modelApiKey?

    RuntimeProfileStatus        # 永远不含原始 Key
      ready
      missingFields[]
      validationState
      runtimeState
      restartRequired
      publicFailureCode?

普通元数据可以放入受控应用配置；RuntimeSecretInput 只能在 Rust 安全边界内短暂存在。所有 API 输出、错误、事件和日志均使用 RuntimeProfileStatus 或 publicFailureCode。

现有 process.env 解析逻辑保留为开发者 Web 版的 fail-closed fallback。桌面版则由 Tauri 在 sidecar 启动时注入已激活 Profile 的变量。

---

## 4. 执行分段

本 Round 按以下顺序执行。每个 Phase 均应保持主分支可构建；涉及密钥和 sidecar 的 Phase 不与纯 UI 翻译并行发布。

### Phase A — 架构定稿与安全预研

- [ ] `GR0-A01` 为 Locale、outputLocale、RuntimeProfileMetadata、RuntimeProfileStatus 建立共享类型和 schema；确保 secret input 不存在于任何返回 DTO。
- [ ] `GR0-A02` 编写简短 ADR：Windows 上如何用 OS 保护的材料解锁加密凭据容器；明确不采用硬编码密码、普通 Tauri Store、PGlite 或 localStorage。
- [ ] `GR0-A03` 预研 Tauri bundled credentials UI / 精确受限 remote capability，并验证随机 loopback 端口不会获得泛用原生权限。
- [ ] `GR0-A04` 定义 Runtime apply 的原子性：验证 → 无活跃 Run → sidecar restart → health check → 成功切换或回滚。
- [ ] `GR0-A05` 列出并冻结 locale 迁移清单：Shell、Search、运行状态、结果、Evidence Inspector、Library、Note Detail、404、日期、aria/title。

**Phase A Gate：** 安全存储和 Tauri 调用面已被选择并记录；若无法证明密钥不会回到 remote Web UI 或日志，停止后续 Key 编辑功能，只交付 Settings 状态页并报告阻塞。

### Phase B — 全局界面语言基础

- [ ] `GR0-B01` 建立双语类型安全字典、LocaleProvider、Cookie/localStorage 持久化和无刷新切换。
- [ ] `GR0-B02` 将 AppShell 的导航、运行徽标、主题控制、侧栏 Footer、移动端导航与所有 aria/title 迁移到字典。
- [ ] `GR0-B03` 在 Settings 和侧栏 Footer 提供同一语言偏好控制；二者必须即时同步。
- [ ] `GR0-B04` 根布局同步 html lang、metadata、skip link 和字体/排版的 locale 属性。
- [ ] `GR0-B05` 将所有 Intl 日期/时间格式化从硬编码 zh-CN 改为当前 locale。
- [ ] `GR0-B06` 验证切换不丢失 Search Composer 草稿、当前筛选、Inspector 选中项、主题和路由。

**Phase B Gate：** Search、Library、Settings 的静态界面与辅助文字在两种语言中完整切换，刷新后保留；不存在裸露的硬编码产品文案。

### Phase C — 搜索运行状态与输出语言

- [ ] `GR0-C01` 在创建 SearchTask 时传入并持久化 outputLocale；Agent、Model Provider 和 Search Provider 按该语言生成新的 Answer、Claim、摘要与可本地化的进度。
- [ ] `GR0-C02` 将运行事件和公共错误从持久化中文句子迁移为 eventType/errorCode + payload；前端按 locale 渲染，保留旧记录 fallback。
- [ ] `GR0-C03` 完成 Search Composer、Runtime Workspace、Search Workspace、Confidence、Claim、Evidence、Source、Save/Retry/Cancel/Failure/Partial/Insufficient 等全状态双语覆盖。
- [ ] `GR0-C04` 新增英文 Replay fixture/cassette，不能把中文 fixture 误标为英文体验。
- [ ] `GR0-C05` 对英文新搜索和 Replay 执行 Save → Library → Reopen；确认原文证据和旧结果不会在切换时被改写。

**Phase C Gate：** 中文与英文各完成一次 Search → Trust → Knowledge 全链路；运行、失败和恢复状态均不混杂错误语言。

### Phase D — Settings 工作区与安全状态 API

- [ ] `GR0-D01` 新增 /settings 路由、侧栏导航、移动端入口与布局；保持现有 Cognitive Workbench 信息架构，不重做 Search 或 Library。
- [ ] `GR0-D02` 实现 Runtime、Search Provider、Model Provider、Security & Data 四个区块及完整 loading / empty / saved / unverified / testing / verified / failed / restarting 状态。
- [ ] `GR0-D03` 扩展 /api/runtime 或新增只读 status API，仅返回 RuntimeProfileStatus；所有字段做 schema 校验和红线测试。
- [ ] `GR0-D04` 源码 Web 版显示 Environment-managed 状态、缺失项和 .env.local 指引；不提供浏览器密钥持久化表单。
- [ ] `GR0-D05` UI 明确标注“测试连接可能消耗 Provider 配额/费用”，测试只能由用户显式触发。
- [ ] `GR0-D06` Provider 名称、模型、Base URL、Last validation 等非机密元数据可编辑；切换或应用时显示 restart consequence。

**Phase D Gate：** 即使尚未接入桌面密钥写入，用户也能理解当前是否处于 Replay / Live、缺少什么、为什么不能直接在 Web 版保存 Key。

### Phase E — Tauri 安全凭据与 Live Runtime 切换

- [ ] `GR0-E01` 在 Rust 侧实现加密凭据容器与 OS 保护的解锁流程；增加最小依赖、能力白名单和 CSP，不开放通用 secret read。
- [ ] `GR0-E02` 实现受限凭据编辑面板：输入、掩码、保存、单项清除、全部清除；保存后仅显示已配置和可选尾号，不回显 Key。
- [ ] `GR0-E03` 实现 Save → explicit Test → Apply 流程，并把 provider 错误归一为安全的 public failure code。
- [ ] `GR0-E04` 替换桌面端硬编码 Replay：Tauri 读取已激活 Profile，向 Node/Next sidecar 注入环境变量，health check 成功后启动窗口。
- [ ] `GR0-E05` 实现安全 restart / rollback / Replay fallback；正在运行的 SearchTask 时禁用 Apply 并给出可恢复说明。
- [ ] `GR0-E06` 在应用重启后验证 Profile 状态仍存在、Key 仍不显示、PGlite 中的 Library 与 Search Note 不受影响。

**Phase E Gate：** 从全新 Windows 安装包可完成 Replay → 配置 Live → 验证 → Apply → 一次真实搜索 → 重启后仍可用 → 清除并回到 Replay 的闭环；任何网络响应、日志、数据库或 UI 都不含 sentinel test key。

### Phase F — 双语质量门与 GitHub 准备

- [ ] `GR0-F01` 增加字典 key parity、locale fallback、日期格式、outputLocale、事件/错误本地化的单元测试。
- [ ] `GR0-F02` 增加 Playwright 流程：中英切换 → 刷新保持 → 草稿/筛选/Inspector 保留 → Light/Dark → Desktop/Mobile。
- [ ] `GR0-F03` 增加 Settings 状态矩阵：Replay、未配置、已保存未验证、验证成功、凭据失效、网络不可达、活跃任务阻止 Apply、restart 失败回滚。
- [ ] `GR0-F04` 增加机密回归测试：API response、PGlite、日志和打包资源均不出现 sentinel key；.env、数据库、日志和 target/dist 继续被 Git 忽略。
- [ ] `GR0-F05` 更新 README、.env.example、SECURITY.md、桌面安装说明和截图；明确 Desktop Settings 与 Web .env 的边界。
- [ ] `GR0-F06` 运行完整离线质量门、桌面打包 smoke 与显式 Live acceptance；Live 验收记录保持脱敏。

**Phase F Gate：** 代码、安装包、文档和截图在两种语言及两种 Runtime 状态下表述一致；可安全进入后续 GitHub Public Hygiene Round。

---

## 5. 测试矩阵

| 编号 | 场景 | 通过条件 |
| --- | --- | --- |
| L01 | 首次启动与刷新 | html lang、产品文案和日期格式匹配所选语言 |
| L02 | 全局切换 | 当前页面即时更新；草稿、筛选、Inspector、路由和主题不丢失 |
| L03 | 搜索语言 | 新建中文/英文任务分别携带对应 outputLocale，Answer/Claim/运行状态与之匹配 |
| L04 | 证据完整性 | Source 标题、原文引文、Evidence Snapshot、历史 Note 不被 UI 切换改写 |
| L05 | 非正常状态 | Cancel、Retry、Failure、Partial、Insufficient、404、空资料库均有两种语言和 aria 文案 |
| S01 | Web 版边界 | Settings 只展示环境状态；浏览器 localStorage、Cookie、请求体与响应均没有 API Key |
| S02 | Desktop 保存 | 明文 Key 仅进入受限写入命令；UI/状态 API 只显示 configured/尾号/验证状态 |
| S03 | 配置验证 | 只有用户点 Test 才访问 Provider；无效凭据、限流、网络异常均不泄漏 HTTP body 或 Key |
| S04 | Runtime 切换 | 无活跃任务时可原子 Apply；有活跃任务时禁止并说明下一步 |
| S05 | 失败回滚 | 新配置或 sidecar health check 失败后，旧 Runtime 仍可用；否则明确为 Replay |
| S06 | 安全扫描 | sentinel key 不出现在 API、PGlite、日志、构建产物、安装包资源、截图或 Git 状态 |
| R01 | 桌面重启 | 配置元数据和安全凭据状态可恢复；Library/Note 数据仍可重开 |

---

## 6. 预期改动范围

主要涉及以下区域；具体文件会在实现时按现有结构新增或修改，不在本计划阶段提前改动源码。

    apps/web/app/layout.tsx
    apps/web/app/settings/*
    apps/web/app/api/runtime/*
    apps/web/app/api/preferences/*
    apps/web/components/app-shell.tsx
    apps/web/components/search-composer.tsx
    apps/web/components/runtime-search-workspace.tsx
    apps/web/components/search-workspace.tsx
    apps/web/components/library-client.tsx
    apps/web/components/note-detail-client.tsx
    apps/web/lib/i18n/*
    apps/web/lib/result-view.ts
    apps/web/lib/note-categories.ts
    apps/web/lib/server/live-config.ts
    apps/web/lib/server/runtime.ts
    packages/agent/*
    packages/domain/*
    apps/desktop/src-tauri/src/main.rs
    apps/desktop/src-tauri/Cargo.toml
    apps/desktop/src-tauri/capabilities/*
    docs/ and README security/runtime notes

---

## 7. 明确不做

- 不做自动翻译历史 Evidence、Source、Search Note 或用户笔记；
- 不做账户、云同步、多人共享、远程托管 API Key；
- 不做任意第三方 Provider、复杂计费、用量统计或团队密钥管理；
- 不为了翻译而重构 Search / Trust / Knowledge 的核心领域模型；
- 不把 Tauri desktop 的安全能力伪装成通用 Web 安全存储；
- 不把 Compare、Research、Export、Living Note 纳入本 Round。

---

## 8. Definition of Done

本 Round 只有在以下条件同时满足时才标为 DONE：

- [ ] 任一工作区均可切换中文/英文，刷新和桌面重启后保持；
- [ ] 所有可见产品 UI、日期、进度、错误、辅助文案在两种语言中完整一致；
- [ ] 新任务的输出语言可追溯，历史证据资产未被翻译或篡改；
- [ ] Settings 可清楚呈现 Replay / Live、配置缺失、验证结果和重启影响；
- [ ] Web 源码运行模式不允许在浏览器持久保存 API Key；
- [ ] Windows 安装版可安全配置 Tavily/Brave 与 DeepSeek/OpenAI，明文 Key 永不回显；
- [ ] Live Profile 应用、回滚、Replay fallback 和重启后恢复均通过；
- [ ] 机密扫描、完整测试、桌面打包 smoke 与脱敏 Live acceptance 均通过；
- [ ] README / SECURITY / 安装说明不做超出当前能力的承诺。

---

## 9. 审查后开始前需要确认的三项

请优先审查以下默认取舍：

1. 语言切换只改变界面和后续搜索输出，绝不翻译已有证据或笔记；
2. 浏览器版只读取 .env.local，只有 Windows 桌面版提供应用内 API Key 配置；
3. 为了避免把密钥权限开放给 localhost 工作区，首选受限 Tauri 凭据面板，并在安全预研通过后再接入 Live restart。

确认这三点后，按 Phase A → F 顺序执行；任何安全 Gate 未通过时，停止在可安全交付的上一阶段，不以明文存储换取“功能完成”。

---

## 10. 执行记录（2026-08-20）

### 已交付

- 全局 `zh-CN` / `en-US`：侧栏与 `/settings` 同步切换、即时 `html[lang]` 更新、日期格式本地化、Cookie / localStorage 镜像与非敏感本地偏好文件持久化；Tauri 随机端口重启后也能恢复。
- 新搜索和 Retry 记录 `outputLocale`；English Replay 提供真实的英文问题、Claim、Answer 与运行文案。既有问题、来源、原文引文、Evidence、Search Note 与个人笔记保持原文。
- `/settings` 独立工作区：呈现 Runtime、Provider、脱敏配置状态、语言与 Web / Desktop 安全边界；源码 Web 没有 API Key 输入或浏览器持久化路径。
- Windows Tauri 受限凭据面板：Windows Credential Manager、候选 / 活动 Profile、Save → explicit Test → Apply、active run gate、sidecar health check、回滚 / Replay fallback、中文 / English、严格 CSP 与最小 capability。
- Web 所有写接口已具备 `X-Siftory-Request: 1` + 同源 Origin 防护，避免第三方页面触发本机 Live 请求；源码 Live 仅接受官方 DeepSeek HTTPS endpoint。
- 新增发布产物密钥模式扫描、`.env.*` Git 忽略、ADR、`SECURITY.md`、桌面安装与发布说明。

### 已通过的自动验证

```text
npm run check
  18 test files / 112 tests
  lint · typecheck · production build · migration smoke
  zh/en browser smoke · durable restart smoke

cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml -q
  5 tests passed · 1 interactive Credential Manager smoke intentionally ignored

npm run desktop:smoke:credential-store
  dedicated Windows Credential Manager round-trip and cleanup test is available
  this managed automation session returned Windows ERROR_NO_SUCH_LOGON_SESSION
  (no interactive Windows Credential Manager logon session; no Provider was accessed)

npm run desktop:build
  NSIS installer built
  release checksum generated
  release security scan passed

Packaged Replay startup smoke
  passed
```

产物位于：

```text
dist/desktop/Siftory_0.1.0_x64-setup.exe
dist/desktop/SHA256SUMS.txt
```

### 独立安全审查结论

静态独立审查结果为 `P0: 0 / P1: 0`。审查中发现的 Base URL / 模型回显、CSP、sidecar 父环境继承、跨源 mutation、损坏 Credential Manager profile 恢复和 `.env.*` 忽略问题均已修复并进入回归测试。

### 发布前唯一需要用户凭据的手工验收

为避免在自动流程中使用、展示或消耗用户自己的 Provider Key，以下一条没有由自动化替代：在 Windows 安装包中使用一次**临时测试凭据**完成 `Save → Test → Apply → 一次 Live Search → 重启 → Clear → Replay fallback`。

该操作必须从桌面应用的 `Settings → Configure API credentials…` 主动发起；测试可能消耗 Provider 配额或产生费用。完成后即可将本 Round 状态改为 `DONE — LIVE ACCEPTANCE VERIFIED`。

同时请在**正常登录的 Windows 桌面会话**中执行 `npm run desktop:smoke:credential-store`。该测试只写入、读回并删除独立的测试条目，不会读取 Siftory Profile 或访问 Provider。本次受管自动化环境因没有可用 logon session 不能替代这项系统级验证。

### 已知 V0.1 边界

- `activeRunCount` 到 sidecar restart 之间仍存在极短竞态；后续以 cooperative quiesce endpoint 收敛。
- 暂未强制跨进程 single-instance；同一 Windows 用户不应并行启动两个桌面实例并同时修改 Credentials。
- Loopback 端口采用分配后再绑定；未来可加入 nonce/本地通道强化。

# Siftory Round 2 运行指南

Round 2 提供两种明确区分的运行模式。界面会始终显示当前模式，Replay 数据不会伪装成实时搜索。

## Replay：默认、离线、可重复

`.env` 未配置时默认使用：

```text
SEARCHOS_RUNTIME_MODE=replay
```

Replay 不访问公网、不消耗模型或搜索额度，只接受金丝雀问题 `Python 怎么删除 dict key？`。首页的“使用 Replay 示例”可验证完整链路：

```text
Create Run → Intent → Plan → Retrieval cassette → Snapshot
→ Claim / Evidence extraction → exact-anchor check → Trust
→ Structured Result → Search Note → Save
```

## Live：Tavily / Brave + OpenAI / DeepSeek

复制 `.env.example` 为 `.env`。默认推荐 Tavily，它的免费层不要求信用卡：

```text
SEARCHOS_RUNTIME_MODE=live
SEARCH_PROVIDER=tavily
TAVILY_API_KEY=...
```

也可以继续使用 Brave：

```text
SEARCH_PROVIDER=brave
BRAVE_SEARCH_API_KEY=...
```

使用 OpenAI：

```text
MODEL_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

或使用预留的 DeepSeek 接口：

```text
MODEL_PROVIDER=deepseek
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

只校验当前选中的模型供应商。密钥只在服务端读取，不得使用 `NEXT_PUBLIC_*` 前缀，也不会写入 RunEvent、API 错误或浏览器数据。

OpenAI adapter 使用 Responses API 的严格 JSON Schema 输出；DeepSeek adapter 使用 JSON Object 输出后执行相同的本地 Zod 校验。DeepSeek 空内容、无效 JSON 或 schema 不匹配最多受控重试一次；`reasoning_content` 不保存、不记录、不发送到浏览器。

## 命令

```bash
npm install
npm run dev
```

离线质量门：

```bash
npm run check
```

显式 Live smoke 不会默认执行。先以 Live 模式启动服务，再在另一个终端运行：

```bash
RUN_LIVE_SMOKE=1 npm run smoke:live
```

PowerShell：

```powershell
$env:RUN_LIVE_SMOKE="1"
npm run smoke:live
```

可选变量为 `LIVE_SMOKE_BASE_URL` 与 `LIVE_SMOKE_QUERY`。

三问题真实矩阵会依次验证技术操作、概念解释和产品官方文档，并检查 Claim → Evidence → Source 引用完整性、Evidence block locator、来源域名与 Trust 分布：

```powershell
$env:RUN_LIVE_MATRIX="1"
npm run smoke:live:matrix
```

Live Smoke 与 Live Matrix 都是显式 opt-in，不进入默认 `npm run check`，避免 CI 消耗真实 Provider 配额。

## 当前执行边界

RunCoordinator 仍是单机、长生命周期 Node 实现，适用于 MVP Alpha 本地开发和单实例验证。运行状态、ordered events、heartbeat 和 checkpoint 已写入 PostgreSQL；未配置 `DATABASE_URL` 时使用 `SEARCHOS_PGLITE_DATA_DIR` 指向的本地持久化 PGlite。进程重启后，终态运行、Library 与 Note Detail 可从数据库恢复；过期的非终态运行会转为 `PROCESS_INTERRUPTED`，保留已有事件和对象并允许 Retry-as-new-run。

默认 PGlite 数据目录会在首次生产启动时自动创建。当前不会从任意模型或网络调用的中间位置自动续跑，也不宣称支持多节点 lease、serverless 挂起续跑或分布式队列。IR4 的 `npm run check` 已包含 85 项测试、11 项数据库 smoke、浏览器/API 流程，以及真实杀进程重启的 durable smoke。

2026-08-14 的 Tavily + DeepSeek 验收结果：单问题 Live Smoke 为 `COMPLETED`（7 Claims / 10 Evidence / 6 Sources / MEDIUM）；三问题 Live Matrix 为 3/3 `COMPLETED`，整体 Confidence 分别为 MEDIUM、MIXED、HIGH。记录仅包含数量、终态和来源域名，不包含密钥或抓取正文。

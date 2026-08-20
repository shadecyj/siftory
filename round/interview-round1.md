# Siftory Interview Round 1：Provider 配置与真实搜索 Gate

**状态：** `DONE`
**依赖：** Round 2 durable runtime、Quick Evidence Loop 和离线测试已完成
**本轮目标：** 安全配置真实密钥，并让一个非 fixture Quick 问题生成可追溯的真实结果。

---

## 1. 成功场景

```text
配置 Tavily 或 Brave Search
配置 OpenAI 或 DeepSeek
启动 Live runtime
输入一个未预置问题
完成检索、抓取、提取、Trust 和结果物化
确认 Claim → Evidence → Source 来自真实网页
```

本轮只建立“真实链路可用”事实，不做大规模 UI 改版。

## 2. 范围

### 必须完成

- 服务端密钥配置和启动前校验；
- OpenAI 或 DeepSeek 至少一个模型 Provider；
- Tavily 或 Brave Search Provider；
- 非 fixture Quick query；
- Live Smoke 与脱敏记录；
- 真实正文、Evidence anchor 和 Source URL 检查；
- 对 Round 2 已完成但未勾选的验收项进行事实清点。

### 不做

- Provider 设置 UI；
- 浏览器保存或显示密钥；
- 多 Provider 自动降级；
- Compare / Research；
- 用模型输出替代确定性 Trust rules。

## 3. 执行任务

### Phase A — Secret Safety & Runtime Configuration

- [x] `IM1-A01` 从 `.env.example` 创建本地 `.env`，确保 `.env` 和 `.env.local` 均被忽略
- [x] `IM1-A02` 配置 `SEARCHOS_RUNTIME_MODE=live`
- [x] `IM1-A03` 配置 `SEARCH_PROVIDER` 和所选 Search Provider 的 API Key
- [x] `IM1-A04` 在 OpenAI / DeepSeek 中选择一个主 Provider
- [x] `IM1-A05` 配置选中 Provider 的 API Key 和明确模型名
- [x] `IM1-A06` 验证未选中的 Provider 不要求密钥
- [x] `IM1-A07` 验证密钥不进入 HTML、API response、RunEvent、错误文本或日志
- [x] `IM1-A08` Provider 配置错误使用公开错误码和非技术化提示，不回显密钥

**Phase A Gate：** 应用能明确区分 Replay / Live；配置缺失时 fail closed；密钥只存在服务端进程环境。

### Phase B — First Live Smoke

- [x] `IM1-B01` 启动 Live runtime
- [x] `IM1-B02` 使用非 fixture 常规 Quick 问题创建 SearchTask
- [x] `IM1-B03` 验证至少产生一个真实 SearchQuery
- [x] `IM1-B04` 验证至少产生一个已抓取 SourceSnapshot
- [x] `IM1-B05` 验证至少产生一个 Claim、一个 exact-anchor Evidence 和一个 Source
- [x] `IM1-B06` 验证 StructuredResult 的答案只引用已存在 Claims
- [x] `IM1-B07` 验证 Trust 来自 ruleset，模型输出不能直接指定最终等级
- [x] `IM1-B08` 运行 `RUN_LIVE_SMOKE=1 npm run smoke:live`
- [x] `IM1-B09` 在执行记录中保存日期、Provider、问题、终态、Claims / Evidence / Sources 数量和 Confidence，不保存正文或密钥

**Phase B Gate：** 至少一个真实问题以 `COMPLETED` 或可解释的 `PARTIAL` 结束，并形成合法 Claim → Evidence → Source 链。

### Phase C — Small Live Matrix

选择三个未预置、可在 Quick 预算内回答的问题，覆盖：技术操作、概念解释、产品文档。

- [x] `IM1-C01` 三个问题均不依赖 Replay fixture
- [x] `IM1-C02` 至少两个问题得到可交付结果
- [x] `IM1-C03` 单一来源抓取失败不会清空其他有效证据
- [x] `IM1-C04` 证据不足时返回 `PARTIAL / INSUFFICIENT`，不强行生成 High
- [x] `IM1-C05` 外部来源 URL 可正常打开
- [x] `IM1-C06` 重复 URL、最终重定向和重复正文不会造成来源虚增
- [x] `IM1-C07` Provider 限流 / 暂时失败时保留已有事件并提供 Retry

**Phase C Gate：** Live runtime 不依赖固定问题，且失败不会伪装成成功。

### Phase D — Baseline Reconciliation

- [x] `IM1-D01` 复核 Round 2 中 Replay success / partial / failed / cancelled / insufficient 的实际测试证据
- [x] `IM1-D02` 复核 durable events、单来源隔离、Retry child Run、Save 幂等、数据库 Library 和重启恢复
- [x] `IM1-D03` 只对有验证证据的 Round 2 DoD 条目标记完成
- [x] `IM1-D04` 将 Round 2 状态从 `LIVE_VALIDATION_PENDING` 更新为 `DONE`
- [x] `IM1-D05` 运行 `npm run check` 确认 Live 配置未破坏默认离线 Gate

## 4. Definition of Done

- [x] 安全配置 Tavily / Brave + OpenAI / DeepSeek
- [x] 非 fixture Quick 问题真实运行成功
- [x] 真实 SearchQuery / Snapshot / Claim / Evidence / Source 可审计
- [x] Evidence exact-anchor 全部通过
- [x] 密钥和隐藏推理未泄露
- [x] Live Smoke 成功并有脱敏记录
- [x] 默认 `npm run check` 仍然离线、确定且通过
- [x] Round 2 状态与实际验证一致

本轮完成后才能开始 [Interview Round 2](interview-round2.md)。

## 5. 执行记录

| 日期 | Provider | 问题 | 终态 | Claims / Evidence / Sources | Confidence | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-08-14 | Replay / OpenAI 与 DeepSeek 配置边界 | Python 怎么删除 dict key？ | COMPLETED | 2 / 2 / 1 | HIGH | `npm run check` 通过；61 tests、8 DB smoke、浏览器与 durable restart smoke |
| 2026-08-14 | Live preflight | 未执行 | LIVE_KEYS_REQUIRED | — | — | `.env` 已创建并被忽略；未发现 Brave 或模型密钥，未发起外部调用 |
| 2026-08-14 | Tavily + DeepSeek preflight | 未执行 | TAVILY_KEY_REQUIRED | — | — | DeepSeek 已配置；Brave 受银行卡条件阻塞，已新增 Tavily adapter；64 tests 与完整离线 Gate 通过 |
| 2026-08-14 | Tavily + DeepSeek | HTTP 304 和 200 响应有什么区别？ | COMPLETED | 7 / 10 / 6 | MEDIUM | `npm run smoke:live` 通过；仅记录脱敏数量与终态 |
| 2026-08-14 | Tavily + DeepSeek | Node.js 中 AbortController 如何取消 fetch 请求？ | COMPLETED | 9 / 11 / 4 | MEDIUM | Live Matrix；1 个官方来源 |
| 2026-08-14 | Tavily + DeepSeek | HTTP 304 和 200 响应有什么区别？ | COMPLETED | 12 / 13 / 3 | MIXED | Live Matrix；RFC Editor 与 MDN 等来源通过 |
| 2026-08-14 | Tavily + DeepSeek | DeepSeek API 如何启用 JSON Output？ | COMPLETED | 5 / 6 / 4 | HIGH | Live Matrix；4 个官方来源 |

最终回归：`npm run check` 通过，64 tests、8 DB smoke、生产构建、浏览器/API Smoke 与 durable restart smoke 全部完成。

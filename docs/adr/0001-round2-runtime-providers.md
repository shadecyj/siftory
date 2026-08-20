# ADR 0001：Round 2 Runtime 与 Provider 边界

**状态：** Accepted
**日期：** 2026-08-13

## 决策

SearchOS Round 2 提供两种运行模式：

- `replay`：默认开发和自动测试模式，不访问外网；
- `live`：调用已配置的 Search Provider 与 Model Provider。

候选来源发现以 `SearchProvider` 为边界，首个 live adapter 为 Brave Web Search。模型调用以 provider-neutral `ModelGateway` 为边界，支持 Replay、OpenAI Responses 与 DeepSeek Chat Completions adapters。

Provider 能力通过 capability 描述，不进入 Claim、Evidence、Trust 或 Presentation 领域对象。OpenAI 可使用原生 JSON Schema；DeepSeek 使用 JSON Object 后仍必须经过相同的本地 Zod strict validation。

## 约束

- Search snippet 只能用于 discovery，不能成为 Evidence；
- 模型不能直接决定最终 TrustLevel；
- 所有 adapter 必须支持 AbortSignal，并映射到稳定公共错误；
- 默认 `npm run check` 只使用 Replay，不依赖网络或密钥；
- live smoke 单独执行，不进入默认 CI；
- DeepSeek `reasoning_content` 与其他供应商的隐藏推理都不得持久化或发送到浏览器；
- Round 2 使用单机、长生命周期 Node 进程内 coordinator，不宣称分布式可靠执行。

## 后果

业务层能够更换模型供应商，但仍受同一证据锚定、Trust rules 和 StructuredResult invariants 约束。供应商输出能力不同会增加 adapter 代码，但不会造成领域模型分叉。

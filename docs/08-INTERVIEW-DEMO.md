# Siftory 面试演示说明

这份说明用于稳定完成一次 5–8 分钟的 Siftory Quick vertical slice 演示。目标是让面试官直接看到 Search、Trust、Knowledge 三个系统如何形成闭环，而不是靠口头描述尚未实现的能力。

## 1. 演示前准备

主问题：

```text
DeepSeek API 如何启用 JSON Output？
```

备用问题：

```text
Node.js 中 AbortController 如何取消 fetch 请求？
```

构建并清空隔离的演示数据库：

```powershell
npm run build
npm run demo:reset
npm run demo:live
```

`demo:reset` 只允许删除项目内的 `.searchos/demo-runtime-db`。默认运行数据 `.searchos/runtime-db`、源码和用户其他目录不在删除范围内。

开始共享屏幕前完成以下检查：

- 首页左下角明确显示 `Live · Tavily + DeepSeek`；
- Library 是空白或只包含本次演示数据；
- 浏览器没有打开 `.env`、Provider 控制台或包含密钥的终端；
- Compare、Research 仍显示为未开放，不暗示已经实现；
- Replay 入口可见，并明确写着“Replay 示例”。

## 2. 5–8 分钟讲述顺序

| 时间 | 操作 | 讲述重点 |
| --- | --- | --- |
| 0:00–0:35 | 首页 | “Siftory 不只回答，而是帮我搜索、验证并留下知识。”指出当前是 Live。 |
| 0:35–1:10 | 输入主问题 | 系统自动进入 Quick；用户不需要理解 Agent Mode 或配置搜索深度。 |
| 1:10–2:00 | 观察运行状态 | 只展示可审查的阶段、Provider、耗时和事件，不展示隐藏推理。 |
| 2:00–3:00 | 阅读 Answer / Confidence | 先给直接答案；Confidence 是结论级证据评估，不是网站总分，也不是模型自报概率。 |
| 3:00–4:10 | 点击 Claim | 在 Evidence Inspector 查看原文片段、block locator、Snapshot 和来源网站。 |
| 4:10–4:50 | 切换 Source | 选择来源会高亮它支持的 Claim；说明 citation count 不等于可信度。 |
| 4:50–5:35 | 保存 Search Note | 保存后显示建议分类；进入笔记页收藏并可手动修改分类。 |
| 5:35–6:20 | 打开 Library | 按收藏或分类找到刚才的 Note；重新打开后 Evidence 与 Trust 仍在。 |
| 6:20–7:10 | 总结架构 | Search Engine 找到、Trust Engine 判断、Knowledge Engine 留下；三者以 Claim 为连接点。 |
| 7:10–7:40 | 说明边界 | 当前只交付 Quick vertical slice；Compare、Research、Export、Auth 和生产部署明确未完成。 |

正常情况下在 7 分钟左右结束。不要逐条阅读所有 Evidence，也不要现场展开内部日志来填充时间。

## 3. 15 秒 Replay 兜底话术

> 当前网络或外部 Provider 不稳定。我切到 Replay，它使用预先保存但明确标记的检索快照，不会伪装成实时搜索；同一套 Agent、Evidence、Trust、保存和 Library 链路仍会完整执行。Live 的真实性由独立的脱敏验收记录证明。

停止 Live 服务后运行：

```powershell
npm run demo:replay
```

首页确认显示 `Replay · 离线样例`，然后点击：

```text
使用 Replay 示例：Python 怎么删除 dict key？
```

## 4. 三个核心技术取舍

### Claim-first，而不是 URL-first

URL 只是来源地址，聊天消息只是一次呈现。Siftory 把 Claim 作为知识单位，使每个重要结论能独立绑定 Evidence、Source、Conflict 和 Trust；保存、更新与未来 Living Note 才能围绕稳定对象发生。

### Deterministic Trust，而不是模型自报置信度

模型负责候选结构化输出，最终 Trust 由规则根据 Claim Relevance、Authority、Primary Context、Freshness、Cross Verification 和 Conflict 计算。决定性 Claim 没有直接证据时，Overall Confidence 必须降为 `INSUFFICIENT`；开放的实质冲突不能显示为 High。

### Durable runtime，而不是内存中的聊天任务

RunEvent、heartbeat、checkpoint 和 Search Note 写入 PostgreSQL-compatible store。进程中断后，过期运行会转为 `PROCESS_INTERRUPTED` 并保留已完成事件；完成的搜索、收藏、分类和个人笔记可跨进程重启恢复。

## 5. 一个真实失败案例

早期 Live 验收曾被 Brave Search 注册所需的海外银行卡阻塞。恢复策略不是绕过账户限制，而是保持 `SearchProvider` 抽象，新增不要求银行卡的 Tavily adapter，同时保留 Brave adapter。默认离线 Gate 继续使用 Replay，真实 Provider 测试保持显式 opt-in，避免外部额度和网络波动污染日常回归。

运行时另一个故障路径是进程在搜索中途退出。系统不会假装继续，也不会丢掉活动记录：重启后 stale Run 被标记为 `PROCESS_INTERRUPTED`，展示已保留对象并允许 Retry-as-new-run。

## 6. 常见追问

### “这不就是普通 RAG 吗？”

普通 RAG 常见终点是“检索若干片段并生成回答”。Siftory 的产品对象和完成条件不同：它有可审查的搜索计划、Claim-level exact Evidence、确定性 Trust、冲突与不足状态、durable Run，以及可收藏、分类、重开的 Search Note。检索增强只是 Search Engine 中的一段，不是整个产品。

### “置信度为什么可信？”

它不是统计校准后的概率，也不声称是。这里的 Confidence 是可解释的规则等级：关键 Claim 是否有直接证据、是否为第一方或权威来源、是否足够新、是否有独立支持、是否存在冲突。UI 展示理由和证据，面试官可以反向检查。

### “模型幻觉怎么阻断？”

模型输出先经过严格 Zod 边界；Evidence 必须 exact-anchor 到已读取正文 block；Claim→Evidence 关系再进入确定性 Trust。没有直接证据的决定性 Claim 会把结果降为 Insufficient，搜索 snippet 也不能冒充 Evidence。

### “为什么暂时不做 Compare / Research？”

为了证明最小但完整的垂直闭环。Compare 需要对称取证和冲突矩阵，Research 需要更深预算和长期任务状态；过早加入会放大表面功能，却削弱面试现场最重要的可靠性。现有 Claim-first 和 durable 架构已经为后续模式预留扩展点。

## 7. 演练验收

每次从空白浏览器和隔离数据库开始，记录耗时：

```text
Home → Live/Replay disclosure → Search → Confidence
→ Claim → Evidence → Source → Save → Favorite
→ Category → Library Filter → Reopen
```

两次都必须满足：不超过 8 分钟、无需 hover、无需口头解释才能区分 Live/Replay、重开后证据链完整、过程中不展示密钥/完整 prompt/隐藏推理。

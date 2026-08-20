# Siftory Interview MVP Track：最小可展示闭环

**状态：** `INTERVIEW_MVP_DONE`
**执行优先级：** 高于原 `round3.md` Compare 计划
**基线：** Round 1 与 Round 2 已完成；Interview Round 1 真实搜索 Gate 已通过
**最终目标：** 最后一个 Round 结束时，Siftory 可以稳定完成一次真实 Quick Search，并把结果收藏、分类和重新打开。

---

## 1. 产品目标

本轨道只实现以下面试展示闭环：

```text
输入任意常规 Quick 问题
→ 真实搜索与正文读取
→ 生成结构化总结
→ 查看 Confidence 与解释理由
→ 查看 Claim → Evidence → Source
→ 收藏为 Search Note
→ 自动建议分类 / 手动修改
→ 在 Library 按收藏和分类重新找到
```

最终演示口径：

> Siftory 不只回答问题，而是把每个重要结论连接到具体证据和来源，并把搜索结果沉淀为可整理的个人知识资产。

## 2. “任意问题”的边界

本 MVP 的“任意问题”定义为：

- 用户输入的、未预置在 Replay fixture 中的常规信息检索问题；
- 问题可以在一次 Quick Search 预算内得到有依据的回答；
- Compare、Research、需要登录的私有数据、付费墙、纯主观创作不在范围内；
- 问题过宽、证据不足或来源冲突时，系统必须明确显示限制，不得伪装成高质量完成。

允许的终态：

```text
Completed
Partial
Insufficient Evidence
Failed（带原因和重试动作）
Cancelled
```

## 3. Round 划分

| Round | 文件 | 目标 | 预估时间 |
| --- | --- | --- | --- |
| Interview Round 1 | `interview-round1.md` | 安全配置 Provider，完成真实 Live Search Gate | 0.25–0.5 天 |
| Interview Round 2 | `interview-round2.md` | 稳定任意 Quick 问题，形成独特的证据与置信度展示 | 0.5–1 天 |
| Interview Round 3 | `interview-round3.md` | 完成收藏、自动建议分类、手动分类和 Library 筛选 | 0.25–0.5 天 |
| Interview Round 4 | `interview-round4.md` | 完整测试、Replay 兜底、说明材料和面试演练 | 0.25–0.5 天 |

总时间盒：**1–2 个专注开发日**。若外部 Provider、网页抓取或模型输出出现兼容问题，可以使用第 2 天处理，不扩大产品范围。

执行顺序是硬依赖：

```text
Interview R1 → Interview R2 → Interview R3 → Interview R4 → INTERVIEW_MVP_DONE
```

## 4. 本轨道明确不做

- Compare、Research 和多候选矩阵；
- Markdown / DOCX 导出；
- 登录、多用户和团队协作；
- Provider 密钥设置页面；
- Collections 嵌套、复杂 Tags、知识图谱；
- 自动长期监控和 Living Note；
- 分布式队列、多节点 lease、serverless 中途续跑；
- 为了“独特”而加入无意义动画、渐变或装饰性仪表盘。

原 [Round 3](round3.md) 的 Compare 计划保留，但只有本轨道完成后才重新评估是否执行。

## 5. 全局验收矩阵

最后一个 Round 必须逐项验收：

### 真实搜索

- [x] `MVP-G01` 服务端安全读取 Tavily / Brave Search 密钥和一个模型 Provider 密钥
- [x] `MVP-G02` OpenAI 或 DeepSeek 至少一个真实 Provider 可用
- [x] `MVP-G03` 非 fixture Quick 问题能进入 Live runtime
- [x] `MVP-G04` Live Run 产生真实 SearchQuery、SourceSnapshot、Claim、Evidence 和 Source
- [x] `MVP-G05` 每条展示 Evidence 都通过 exact-anchor
- [x] `MVP-G06` 搜索摘要和搜索引擎 snippet 从未冒充 Evidence

### 可信展示

- [x] `MVP-G07` 首屏按 Question → Answer → Confidence → Key Evidence → Sources 排列
- [x] `MVP-G08` Confidence 使用 High / Medium / Low / Insufficient 和自然语言理由
- [x] `MVP-G09` Confidence 来自确定性 Trust rules，不由 UI 或模型直接指定
- [x] `MVP-G10` 点击 Claim 能查看对应 Evidence 原文和 Source
- [x] `MVP-G11` Source 显示网站、标题、URL、来源类型、时间和处理状态；缺失字段不伪造
- [x] `MVP-G12` 冲突、证据不足和排除来源有明确表达

### 收藏与分类

- [x] `MVP-G13` 任一可交付搜索结果可幂等保存为 Search Note
- [x] `MVP-G14` Search Note 可收藏 / 取消收藏
- [x] `MVP-G15` 新 Note 得到一个可解释的建议分类
- [x] `MVP-G16` 用户可修改为固定分类之一
- [x] `MVP-G17` Library 可按全部、收藏和分类筛选
- [x] `MVP-G18` 刷新和进程重启后 Note、收藏与分类仍然存在

### 面试可靠性

- [x] `MVP-G19` Replay 模式仍可在无网络时完成黄金流程
- [x] `MVP-G20` Provider 缺失、限流、抓取失败、证据不足都有可理解的恢复动作
- [x] `MVP-G21` `npm run check` 一次性通过
- [x] `MVP-G22` 至少一次真实 Live Smoke 成功并保存脱敏记录
- [x] `MVP-G23` 5–8 分钟演示连续完成两次
- [x] `MVP-G24` README 与演示说明明确当前只交付 Quick 垂直切片

## 6. 推荐现场演示路径

```text
1. 首页输入一个未预置的常规问题
2. 展示真实搜索阶段与当前操作
3. 先读一句话总结和 Confidence
4. 点击一条关键 Claim
5. 在 Evidence Inspector 查看证据原文和来源网站
6. 收藏结果并确认建议分类
7. 打开 Library，按收藏或分类重新找到它
8. 简述 Replay 兜底、持久化恢复和测试矩阵
```

## 7. 最终完成定义

只有 `MVP-G01–MVP-G24` 全部完成，才能把本文件状态改为：

```text
INTERVIEW_MVP_DONE
```

若代码完成但真实 Provider 没有成功运行，状态必须保持：

```text
LIVE_VALIDATION_PENDING
```

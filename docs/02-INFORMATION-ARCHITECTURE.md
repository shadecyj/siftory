# Siftory V0.1 页面 IA

## 1. IA 目标

页面结构服务一条主路径：

```text
提出问题 → 看懂答案 → 验证关键结论 → 保存为笔记 → 在 Library 中再次使用
```

IA 遵循“默认简单，高级透明”：首屏只呈现完成当前任务所需的信息；过程、评分因子、冲突细节和查询记录按需展开。

## 2. 顶层导航

V0.1 只保留三个一级入口：

| 入口 | 作用 | 默认落点 |
| --- | --- | --- |
| Siftory / New Search | 开始新搜索 | 首页 |
| Library | 找回和整理 Search Note | Recent |
| 当前任务 | 返回正在运行或刚完成的搜索 | 最近的 SearchTask |

不设置 Discover、Feed、Community、Marketplace 等入口。Settings 仅从账户菜单进入，不占据一级导航。

## 3. 页面地图

```text
/
└── Home / New Search

/search/:taskId
└── Search Workspace
    ├── Running
    ├── Completed
    ├── Partial
    ├── Failed
    └── Cancelled

/library
├── Recent
├── Inbox
├── Favorites
├── Collections
│   └── /library/collections/:collectionId
└── Tags
    └── /library/tags/:tagId

/notes/:noteId
└── Search Note Detail
    ├── Read
    ├── My Notes
    ├── Organize
    └── Export
```

V0.1 可以使用侧栏、抽屉或路由实现子页面；上述结构描述信息归属，不强制具体前端技术。

## 4. Home / New Search

### 默认层级

1. 产品标识
2. 主搜索输入框
3. 提交动作
4. 次要的模式控件：Auto（默认）/ Quick / Compare / Research
5. 少量示例问题
6. Library 入口

### 行为

- 输入框支持自然语言和多行问题。
- Auto 是默认项；用户不需要理解模式也能搜索。
- 手动模式只影响下一次 Run，不作为永久偏好。
- 提交后立即进入 Search Workspace，不在首页等待完整结果。
- 空输入不可提交；输入内容在创建任务失败时不能丢失。

### 不出现

- 高级模型参数、来源数量、搜索轮数、temperature 等技术配置；
- 推荐内容流、热榜、广告、订阅弹窗；
- 大段产品解释。

## 5. Search Workspace

Search Workspace 是搜索运行和结果阅读的同一页面，避免“等待页 → 答案页”产生割裂。

### 5.1 固定头部

- 原始 Question，可复制；
- 当前模式：Auto 判断结果或用户指定结果；
- 状态：Running / Complete / Partial / Failed / Cancelled；
- `New Search`；
- 运行中显示 `Cancel`，完成后显示 `Save` / `Saved`。

模式切换规则：

- 切换后明确提示“将以 Compare 重新搜索”，确认后创建新 SearchRun；
- 旧 Run 保留，可从 Run history 回看；
- 不在原结果上静默重写。

### 5.2 Running 状态

默认只显示四阶段进度：

```text
理解问题 → 查找来源 → 验证证据 → 整理结果
```

可展开 `Search details` 查看：

- Search Plan；
- 已执行 / 待执行查询；
- 已访问来源；
- 当前发现的证据缺口；
- 重试或排除原因。

运行过程中允许逐步出现经过验证的结果，但必须标记为 `Draft while searching`，不能与最终结果混淆。

### 5.3 Completed / Partial 结果

默认页面严格按以下顺序呈现：

#### A. Answer / Recommendation

- Quick：短答案或操作步骤；
- Compare：结论优先的建议 + 适用条件，比较表可紧随其后；
- Research：执行摘要 + 主题结构导航。

答案中的重要陈述应能定位到对应 Claim；引用标记打开的是该 Claim 的 Evidence，而不是只跳转页面底部。

#### B. Confidence summary

紧凑展示：

```text
High confidence · 8 sources · 5 primary
```

同时给出 2–4 条最重要原因，例如：

- 官方文档直接支持；
- 3 个独立来源一致；
- 适用于当前版本；
- 未发现实质冲突。

若结果包含多个置信度差异明显的 Claims，页面总览应显示 `Mixed confidence`，不能用平均值掩盖低置信度结论。

#### C. Key Evidence

以 Claim 为分组单位：

```text
Claim
├── Confidence + explanation
├── Supporting evidence
├── Contradicting evidence（如有）
└── Open source
```

Key Evidence 默认只显示影响答案或建议的关键 Claims。次要 Claims 放入展开后的完整分析。

#### D. Sources

- 合并重复 URL，但保留不同抓取快照和引用位置；
- 区分 Primary / Secondary；
- 显示标题、域名、发布日期或版本、访问日期；
- 明确标记不可访问、过期或仅用于背景的来源。

### 5.4 渐进展开区域

| 区域 | 默认 | 何时突出 |
| --- | --- | --- |
| Comparison | Compare 默认展开；其他模式按需 | 存在两个及以上候选项 |
| Contradictions | 有实质冲突时自动露出摘要 | 冲突会改变答案或建议 |
| Search Plan | 折叠 | 用户要审查搜索覆盖 |
| Trust Analysis | 折叠 | 用户要理解置信度原因 |
| Search Queries | 折叠 | 用户要复现搜索过程 |
| Excluded Sources | 折叠 | 低质量、重复、不可访问来源影响覆盖 |
| Run history | 折叠 | 用户切换模式或重新运行过任务 |

安全规则：实质冲突、证据不足和部分完成不能被藏在折叠区里；摘要必须在默认结果中可见。

### 5.5 失败状态

| 状态 | 页面行为 |
| --- | --- |
| Partial | 展示已有结果，明确缺失范围，允许 `Continue search` |
| Failed before evidence | 保留 Question 和模式，说明失败阶段，提供 Retry |
| Cancelled | 展示已获得的来源 / Claims，标记未经完整验证，可保存为草稿 |
| Source unavailable | 不阻断整页，在对应 Evidence 上标记不可复查 |

## 6. Library

Library 是 Search Note 的检索与整理空间，不是通用文档编辑器。

### 6.1 导航

- **Recent**：按最近查看或更新排序；
- **Inbox**：尚未放入 Collection 的笔记；
- **Favorites**：用户收藏；
- **Collections**：用户创建的单层集合；
- **Tags**：跨 Collection 的轻量分类。

V0.1 不支持无限嵌套 Collection、关系型数据库视图、自定义字段系统和自由页面搭建。

### 6.2 Note 列表项

最少展示：

- Title；
- Summary 摘要；
- Search mode；
- Confidence 状态；
- Tags / Collection；
- Search Date / Updated Date；
- Favorite 状态。

列表支持关键词搜索、Collection / Tag / Favorite 筛选和最近更新时间排序。全文语义检索不是 V0.1 必需项。

### 6.3 保存规则

- 完成搜索后可自动生成 Note 数据，但只有用户点击 Save 后进入 Library；
- 若选择“自动保存所有搜索”，默认进入 Inbox；该设置不是首次使用的阻塞项；
- 已保存任务再次运行时，默认创建新 Note revision，而不是覆盖用户笔记。

## 7. Search Note Detail

### 默认阅读层级

1. Title、搜索日期、模式、总体状态；
2. Summary；
3. Key Claims；
4. Evidence / Sources；
5. My Notes；
6. Tags、Collection、Favorite；
7. Export。

### 编辑边界

用户可以编辑：

- Title；
- My Notes；
- Tags；
- Collection；
- Favorite。

系统生成但在 V0.1 不允许直接改写的事实层：

- Claim 原文及其 Run provenance；
- Evidence 摘录和定位；
- Source snapshot；
- Trust evaluation。

若用户认为内容错误，可发起 `Search again` 或 `Report issue`。这样可防止个人编辑破坏证据链。未来可增加“用户修订 Claim”，但必须形成独立 revision。

### 导出

导出面板只需：

- 格式：Markdown / DOCX；
- 是否包含 My Notes；
- 引用样式：内联链接 / 编号来源；
- 文件名预览；
- Export。

## 8. 核心用户流

### Flow A：首次搜索并保存

```text
Home 输入问题
→ 创建 SearchTask + SearchRun
→ Workspace 显示模式和进度
→ 结果呈现 Answer / Confidence / Evidence / Sources
→ 用户展开一条 Evidence 验证
→ Save
→ 自动建议 Title / Tags / Collection
→ 确认后进入 Library
```

### Flow B：纠正模式

```text
Auto 判断为 Quick
→ 用户切到 Research
→ 系统说明将创建新 Run
→ Research Run 执行
→ 新旧结果均可回看
→ 用户保存选中的 Run
```

### Flow C：冲突证据

```text
搜索发现关键来源冲突
→ 默认结果显示 Conflict 摘要
→ Confidence 降级
→ 用户展开 Contradictions
→ 查看双方 Evidence 与版本 / 时间差异
→ Continue search 或保存含冲突的 Note
```

### Flow D：从 Library 导出

```text
Library 筛选 Tag
→ 打开 Search Note
→ 补充 My Notes
→ Export Markdown 或 DOCX
→ Renderer 从结构化 Note 生成文件
```

## 9. 跨页面不变量

1. 同一个置信度标签在 Workspace、Library、Note 和导出中含义一致。
2. Source 数量来自去重后的 Source，Primary 数量来自 Claim 上实际使用的第一方来源。
3. 重要 Claim 无 Evidence 时必须显示 `Insufficient evidence`。
4. 冲突不能仅用颜色或隐藏图标表达。
5. 用户写的 My Notes 与系统生成内容在视觉和数据上明确分离。
6. Save 保存指定 Run 的结构化结果；重新搜索不会静默覆盖已保存 Note。

## 10. 原型优先级

第一轮高保真原型只需覆盖五个画面：

1. Home；
2. Search Workspace — Running；
3. Search Workspace — Completed（含一条冲突）；
4. Library — Recent / Inbox；
5. Search Note Detail + Export。

这五个画面足以验证主闭环；其他视图优先通过状态变体而不是新增页面完成。

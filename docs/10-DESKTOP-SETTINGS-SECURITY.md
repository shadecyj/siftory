# ADR：桌面版 Live 凭据与运行时安全边界

**状态：已采纳（Windows V0.1）**
**范围：** `apps/desktop/src-tauri` 的本地运行时、API 凭据配置与重启流程。

## 结论

Siftory 桌面版把 Live 搜索凭据视为原生应用的敏感数据，而不是 Web 设置数据。

- 凭据仅保存在当前 Windows 用户的 **Windows Credential Manager** 中；不写入 PGlite、普通 Tauri Store、JSON 文件、源码或日志。
- 凭据只能在内嵌的 `tauri://` 凭据子窗口中输入。唯一入口是主 Settings 页的显式 **配置 Live API** 按钮；应用不再保留第二个同名的原生 Settings 菜单。
- 外部的随机 loopback Next.js 主工作区 (`http://127.0.0.1:<port>`) 只拥有一个无参数、无返回数据的原生命令：打开独立凭据窗口。它没有任何读取、写入、测试、应用、清除或枚举 secret 的命令。
- 原生端只返回脱敏配置状态，例如 Provider、模型、验证状态、修订号和运行中的搜索数；永不返回 API Key、Key 后缀或 Provider 响应正文。

这让「配置密钥」和「使用密钥搜索」分属两个信任面：前者是受限的内嵌页面，后者是外部 Web 工作区。

## 为什么不使用 Stronghold

Tauri Stronghold 需要一个可用且可恢复的解锁口令。为避免把固定 vault 密码、可逆密码材料或弱保护逻辑写入应用，V0.1 不使用 Stronghold 的 password-based vault。

Windows Credential Manager 直接依赖当前 Windows 用户会话的系统保护，满足 V0.1 的单机 Windows 目标，也不需要应用自行管理 vault 解锁密码。未来若需要跨平台或可移植 vault，必须另行设计 OS keychain / 用户解锁与恢复流程；不得为方便实现而硬编码 Stronghold 密码。

## 窗口与 IPC 权限

| 窗口 | 来源 | Tauri capability | 能力 |
| --- | --- | --- | --- |
| `main` | 随机端口的外部 loopback Next.js | `loopback-workspace-capability` | 仅 `open_credentials_panel`；只能聚焦独立窗口，不接收参数、不返回配置或凭据。 |
| `credentials` | 打包静态资源 `tauri://localhost/credentials.html` | `credentials-capability` | `core:default` 和 5 个明确的受限命令。 |

允许给 `credentials` 的命令仅为：

1. `get_live_profile_status`：返回脱敏状态；
2. `save_live_profile`：把本次输入保存为候选配置；
3. `test_live_profile`：显式向所选服务商发起验证；
4. `activate_live_profile`：在无进行中搜索时应用候选配置并重启；
5. `clear_live_profile`：清除候选或全部凭据并安全回到 Replay。

构建期通过 `tauri_build::AppManifest` 为上述命令生成显式 ACL，而不是让它们默认暴露给所有 Webview。`credentials` 子窗口关闭 DevTools 并启用内容保护；这些措施是降低意外暴露的辅助层，不替代 capability 隔离。

凭据窗口还使用仅允许打包本地脚本、样式和图片的 CSP；不允许外部脚本、对象、导航提交或任意网络连接。

## 凭据数据流

```text
credentials.html（密码输入，仅本次保存）
          │  Tauri IPC
          ▼
Rust 输入校验 / 官方端点白名单
          │
          ▼
Windows Credential Manager（候选 / 活动两条记录）
          │  仅在启动子进程的瞬间读取
          ▼
Node sidecar environment（Live runtime）
          │
          ▼
Provider HTTPS 请求
```

- 保存成功后，子窗口立即清空输入框；刷新状态不会回填密钥。
- Key 不记录尾号，也不作为错误详情返回。
- Rust 侧对短生命周期密钥字符串和序列化缓冲区使用 `zeroize`；这是内存卫生措施，不构成对受控进程内存的绝对保证。
- 模型 Base URL 仅接受 DeepSeek 或 OpenAI 的官方 HTTPS 主机及有限路径。V0.1 不允许任意自定义 Base URL，避免把模型 Key 发送到未知服务器。

## 显式测试与状态

保存候选配置不会自动访问第三方。用户必须点击 **Test connection**：

- 先验证模型服务商，再验证搜索服务商；
- 仅返回安全的状态码，例如 `VERIFIED`、`AUTHENTICATION_FAILED`、`RATE_LIMITED` 或 `NETWORK_UNAVAILABLE`；
- 不读取、不保存、不展示 Provider 响应体；
- 界面明确提示：测试会向服务商发送请求，可能消耗配额或产生少量费用。

候选配置通过验证后才可应用。候选与当前活动配置分别保存，因此修改时不会先破坏已可用的 Live 环境。

如果 Windows Credential Manager 中的旧记录损坏或使用不再支持的 schema，桌面端会只删除该不可解析的 slot 并回到可恢复的 Replay / 候选流程；不会要求用户手工复制或暴露旧 Key。

## Sidecar 启动、重启与回滚

1. 启动 sidecar 前，原生端先清空全部父进程环境变量，再只恢复运行 Node 所需的 Windows 非敏感 allowlist；不会继承 Provider、数据库、CI、云服务或代理凭据。
2. Replay 不传任何 Provider key；Live 仅注入选中 profile 所需的 key。
3. 额外注入的状态环境变量均不敏感：
   - `SEARCHOS_DESKTOP_PROFILE_CONFIGURED=1|0`
   - `SEARCHOS_DESKTOP_PROFILE_REVISION`
   - `SEARCHOS_DESKTOP_VALIDATION_STATE`
   - `SEARCHOS_DESKTOP_LAST_VALIDATED_AT`
4. 原生端先读取 sidecar 的只读 `activeRunCount`。存在进行中搜索时拒绝应用和清除操作。
5. 应用时先安全保存新活动 profile，再停旧 sidecar、启动候选、健康检查并切换主窗口至新的随机 loopback 端口。
6. 若候选启动、健康检查或导航失败，原生端恢复原活动 profile 并尝试重启旧 Live（或 Replay）运行时。

sidecar 的 stdout/stderr 被丢弃，不写入磁盘。`desktop-runtime.log` 只允许固定的生命周期文字，不包含 Provider URL、请求、响应、错误详情或密钥。

## Web 边界与已知限制

- Web 设置页只能展示运行时的**脱敏只读状态**；它不是凭据管理器，也没有 native secret API。
- 开发模式的 `.env.local` 仍是开发者自己管理的本地文件，不能提交到 Git，也不等同于打包版凭据存储。
- `activeRunCount` 是 V0.1 的重启前检查，尚不是原子化的“暂停新任务 + 等待清空”协议；极短竞态窗口由下一阶段以 sidecar cooperative quiesce endpoint 解决。
- V0.1 尚未加入跨进程 single-instance mutex；同一 Windows 用户不应并行启动两个 Siftory 桌面实例并同时修改 Credentials。后续发布版会以 Windows named mutex / single-instance plugin 将该约束变为强制规则。
- Windows Credential Manager 针对当前 Windows 用户和正常 OS 保护边界，不防御已取得同一用户权限的恶意软件、调试器或内存抓取。
- Live key 必须短暂存在于 Node sidecar 的环境和进程内存中，才能向 Provider 发请求；这是本地 sidecar 架构的固有限制。未来可评估原生代理请求以进一步缩小该暴露面。

## 发布前验证清单

- [ ] `credentials-capability` 仅匹配 `credentials`，并包含显式 app command allow-list。
- [ ] `loopback-workspace-capability` 仅匹配 `main` 与 `http://127.0.0.1:*`，只包含无参数的 `allow-open-credentials-panel`，不包含任何 Profile / secret command。
- [ ] 搜索、模型 key 从不出现在 Tauri command 响应、Web API、PGlite、应用日志、截图或示例文件中。
- [ ] 运行 `npm run desktop:smoke:credential-store`；它只创建并删除一个独立 Windows Credential Manager 测试条目，不会读取用户 Profile 或访问 Provider。
- [ ] 保存 → 测试 → 应用 → 健康检查 → 回滚路径都经真实 Windows 手工验证。
- [ ] 新安装在无凭据状态下以 Replay 启动；清除全部凭据后同样回到 Replay。
- [ ] 发布前执行 Rust 单元测试、`cargo check` 和打包 smoke test。

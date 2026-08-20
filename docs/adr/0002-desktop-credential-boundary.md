# ADR 0002：桌面版 Live 凭据边界

**状态：** Accepted
**日期：** 2026-08-20

## 背景

SearchOS 的 Windows 安装版通过 Tauri 外壳启动一个随机端口的 `127.0.0.1` Next/Node sidecar。主工作区因此是一个外部 loopback WebView，而不是受 Tauri bundle 信任的页面。

如果把“读取或编辑 API Key”的原生命令开放给这个页面，即使端口只监听本机，也会把 XSS、错误的远程 capability 或后续路由变更扩大为凭据泄露面。与此同时，源码运行的 Web 版也不能把用户密钥放到浏览器存储、PGlite 或普通 JSON 配置中。

## 决策

1. 源码运行的 Web 版只从开发者本机的 `.env.local` / 进程环境读取 Live 配置；`/settings` 仅显示经过脱敏的状态和配置指引，不提供浏览器持久化密钥表单。
2. Windows 桌面版将 API Key 仅保存到 Windows Credential Manager（通过 Rust `keyring` 的 Windows-native 后端）。密钥不进入 PGlite、Search Note、普通 Tauri Store、localStorage、Cookie、日志、URL 或 Next API response。
3. 桌面端使用独立的 `tauri://` 凭据面板承载输入、保存、测试、应用和清除操作。主 Settings 页提供明确的 **配置 Live API** 按钮，随机端口的 SearchOS 主工作区只能调用无参数且无返回值的 `open_credentials_panel` 来聚焦该面板；它不拥有 Profile 命令，也没有读取密钥的命令。
4. 配置状态只使用无机密 DTO：provider、model、受限的官方 Base URL、是否已配置、验证状态、公开失败码、修订号和最后验证时间。原始 Key 与可逆副本永不作为返回值。
5. 应用 Live Profile 的顺序固定为：保存 → 用户明确点击 Test → 确认无活跃搜索 → 读取已验证 profile 启动候选 sidecar → health check → 切换工作区。失败时恢复原 profile；没有可恢复 profile 时显式回退 Replay。
6. sidecar 只绑定 `127.0.0.1` 的随机端口。Tauri 在启动子进程前清空父进程环境，再恢复最小 Windows 运行 allowlist，并仅把已激活 profile 的 key 临时注入子进程环境。退出或重启时终止该子进程。

## 不采用的方案

- 不使用固定密码解锁 Stronghold；把密码写进安装包并不构成安全存储。
- 不使用 plain JSON、PGlite、普通 Tauri Store、Cookie 或 localStorage 保存 API Key。
- 不向外部 `http://127.0.0.1:*` 主工作区授予泛用 Tauri IPC、Profile command 或 secret read 权限；唯一例外是无参数、无状态返回的 `open_credentials_panel`。
- 不允许任意 Base URL，以免用户误将 key 发送给非官方主机；V0.1 仅接受已知 provider 的官方 HTTPS endpoint。

## 后果与边界

- 桌面端需要一个额外的原生凭据面板，而不是在主 Settings 页直接输入 Key；主页面用可点击的主操作直接打开该面板，并保留安全原因说明。
- 保存或测试凭据不会自动发起网络请求，只有用户明确点击 Test 才会请求 provider；测试可能消耗额度。
- 有正在运行的 SearchTask 时不能 Apply，以避免中断 durable runtime。用户可以等待或取消任务后重试。
- 此决策覆盖 Windows 桌面版。未来 macOS/Linux 需要分别审查其 OS keychain 后端与安装/权限模型。

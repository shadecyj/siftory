# Siftory Round 2 Durable Runtime

Round 2 仍采用单机、长生命周期 Node 执行器，但运行状态已经从进程内 `Map` 切换为数据库主路径。

## 持久化策略

- 配置 `DATABASE_URL` 时使用 PostgreSQL。
- 未配置时使用 `SEARCHOS_PGLITE_DATA_DIR` 指向的本地持久化 PGlite；默认目录为 `.searchos/runtime-db`。
- `SearchTask`、`SearchRun`、ordered `RunEvent`、heartbeat、checkpoint、查询、抓取尝试、正文、排除来源以及终态 bundle 均写入数据库。
- Save、Library、Note Detail 与 My Notes 通过 repository 读写，不再依赖进程内对象作为主存储。

## 中断恢复

每个事件推进时都会刷新 checkpoint，运行期间另有 heartbeat。服务启动后如果发现 heartbeat 过期且 Run 尚未终止，会：

1. 保留已经持久化的事件与对象；
2. 追加 `RUN_FAILED` 事件；
3. 将错误标记为 `PROCESS_INTERRUPTED`；
4. 向用户提供 Retry-as-new-run，不修改旧 Run。

当前不会在任意模型或网络调用的中间位置自动续跑。多节点 lease、durable queue 和分布式 worker 仍属于 `R2-X04`。

## 验证

```bash
npm run check
```

门禁包括 lint、typecheck、54 项测试、生产构建、8 项数据库 smoke、浏览器/API smoke，以及真实终止并重启 Node 进程的 durable smoke。

真实 Provider 验证需要先配置 Brave 和 OpenAI 或 DeepSeek，然后运行：

```powershell
$env:RUN_LIVE_SMOKE="1"
npm run smoke:live
```

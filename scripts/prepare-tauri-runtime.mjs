import { access, cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = path.join(root, "apps", "web");
const standaloneRoot = path.join(webRoot, ".next", "standalone");
const staticRoot = path.join(webRoot, ".next", "static");
const migrationsRoot = path.join(root, "packages", "persistence", "drizzle");
const runtimeRoot = path.join(root, "apps", "desktop", "src-tauri", "resources", "runtime");

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function requireDirectory(target, label) {
  if (!(await exists(target))) {
    throw new Error(`${label} 不存在：${target}\n请先运行 npm run build。`);
  }
  if (!(await stat(target)).isDirectory()) {
    throw new Error(`${label} 不是目录：${target}`);
  }
}

async function findPglitePackages(directory, depth = 0) {
  if (depth > 8) return [];
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.name === "node_modules") {
      const candidate = path.join(entryPath, "@electric-sql", "pglite");
      if (await exists(candidate)) found.push(candidate);
      continue;
    }
    found.push(...await findPglitePackages(entryPath, depth + 1));
  }
  return found;
}

function assertGeneratedRuntimePath() {
  const relative = path.relative(root, runtimeRoot);
  if (relative !== path.join("apps", "desktop", "src-tauri", "resources", "runtime")) {
    throw new Error(`拒绝清理非预期的生成目录：${runtimeRoot}`);
  }
}

async function main() {
  await requireDirectory(standaloneRoot, "Next standalone 输出");
  await requireDirectory(staticRoot, "Next 静态资源输出");
  await requireDirectory(migrationsRoot, "数据库迁移资源");

  const appServer = path.join(standaloneRoot, "apps", "web", "server.js");
  if (!(await exists(appServer))) {
    throw new Error(`未找到桌面运行时入口：${appServer}`);
  }

  assertGeneratedRuntimePath();
  await rm(runtimeRoot, { recursive: true, force: true });
  await mkdir(runtimeRoot, { recursive: true });

  const runtimeApp = path.join(runtimeRoot, "app");
  const runtimeStatic = path.join(runtimeApp, "apps", "web", ".next", "static");
  await cp(standaloneRoot, runtimeApp, { recursive: true, dereference: true });
  await cp(staticRoot, runtimeStatic, { recursive: true, dereference: true });
  await cp(migrationsRoot, path.join(runtimeRoot, "migrations"), { recursive: true, dereference: true });
  await cp(process.execPath, path.join(runtimeRoot, "node.exe"), { dereference: true });

  const pgliteEntry = require.resolve("@electric-sql/pglite");
  const pgliteSource = path.resolve(pgliteEntry, "..", "..");
  const pgliteTargets = await findPglitePackages(runtimeApp);
  if (pgliteTargets.length === 0) {
    throw new Error("Next standalone 输出未包含 PGlite。请检查 output file tracing 配置。");
  }
  for (const target of pgliteTargets) {
    await cp(path.join(pgliteSource, "dist"), path.join(target, "dist"), { recursive: true, dereference: true, force: true });
    for (const asset of ["pglite.data", "pglite.wasm"]) {
      if (!(await exists(path.join(target, "dist", asset)))) {
        throw new Error(`PGlite 运行资源缺失：${path.join(target, "dist", asset)}`);
      }
    }
  }

  await writeFile(path.join(runtimeRoot, "runtime-manifest.json"), JSON.stringify({
    version: "0.1.0",
    node: process.version,
    mode: "replay",
    server: "app/apps/web/server.js",
    pglitePackages: pgliteTargets.length
  }, null, 2) + "\n", "utf8");

  console.log(`Tauri runtime prepared: ${runtimeRoot}`);
}

await main();

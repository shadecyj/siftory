import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, "apps", "web");
const mode = process.argv[2] === "live" ? "live" : "replay";
const fileEnv = readEnvFile(path.join(root, ".env"));
const dataDir = path.join(root, ".searchos", "demo-runtime-db");
const port = process.env.DEMO_PORT ?? "3000";

const child = spawn(
  process.execPath,
  [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-H", "127.0.0.1", "-p", port],
  {
    cwd: appDir,
    windowsHide: true,
    stdio: "inherit",
    env: {
      ...fileEnv,
      ...process.env,
      DATABASE_URL: "",
      SEARCHOS_PGLITE_DATA_DIR: dataDir,
      SEARCHOS_RUNTIME_MODE: mode
    }
  }
);

console.log(`Siftory demo: ${mode === "live" ? "Live（真实 Provider）" : "Replay（离线样例）"}`);
console.log(`Demo data: ${dataDir}`);
console.log(`Open: http://127.0.0.1:${port}`);

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("exit", (code) => { process.exitCode = code ?? 0; });

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  return Object.fromEntries(readFileSync(file, "utf8").split(/\r?\n/u).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u);
    if (!match) return [];
    const value = match[2].replace(/^(['"])(.*)\1$/u, "$2");
    return [[match[1], value]];
  }));
}

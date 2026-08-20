import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const installerName = "Siftory_0.1.0_x64-setup.exe";
const installer = path.join(root, "apps", "desktop", "src-tauri", "target", "release", "bundle", "nsis", installerName);
const releaseDirectory = path.join(root, "dist", "desktop");

try {
  await access(installer);
} catch {
  throw new Error(`未找到 Tauri 安装包：${installer}\n请先运行 npm run desktop:build。`);
}

await mkdir(releaseDirectory, { recursive: true });
const releaseInstaller = path.join(releaseDirectory, installerName);
await copyFile(installer, releaseInstaller);

const contents = await readFile(releaseInstaller);
const checksum = createHash("sha256").update(contents).digest("hex");
await writeFile(path.join(releaseDirectory, "SHA256SUMS.txt"), `${checksum}  ${installerName}\n`, "utf8");

console.log(`Desktop release collected: ${releaseDirectory}`);

import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultTargets = [
  path.join(root, "apps", "desktop", "src-tauri", "resources", "runtime"),
  path.join(root, "dist", "desktop")
];

// These are intentionally conservative release-artifact indicators, not a
// general-purpose secret detector. Never print a matching value: a failed
// scan must remain safe to paste into CI or a public issue.
const indicators = [
  ["OpenAI/DeepSeek-like key", /\bsk-[A-Za-z0-9_-]{20,}\b/g],
  ["Tavily-like key", /\btvly-[A-Za-z0-9_-]{16,}\b/g],
  ["Bearer credential", /\bBearer\s+[A-Za-z0-9._~-]{20,}\b/gi],
  ["assigned provider credential", /\b(?:TAVILY_API_KEY|BRAVE_SEARCH_API_KEY|DEEPSEEK_API_KEY|OPENAI_API_KEY)\s*=\s*["']?[A-Za-z0-9._~-]{16,}/g]
];

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(target, files = []) {
  const targetStat = await stat(target);
  if (targetStat.isFile()) {
    files.push(target);
    return files;
  }
  for (const entry of await readdir(target, { withFileTypes: true })) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) await collectFiles(child, files);
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

async function scanFile(file) {
  // Artifacts can include an NSIS executable. Reading binary data as latin1
  // preserves byte positions for regex scanning without decoding failures.
  const contents = (await readFile(file)).toString("latin1");
  return indicators
    .filter(([, pattern]) => {
      pattern.lastIndex = 0;
      return pattern.test(contents);
    })
    .map(([label]) => label);
}

async function main() {
  const targets = process.argv.slice(2).length > 0
    ? process.argv.slice(2).map((target) => path.resolve(target))
    : defaultTargets;
  const missing = [];
  for (const target of targets) {
    if (!(await exists(target))) missing.push(path.relative(root, target) || target);
  }
  if (missing.length > 0) {
    throw new Error(`Release security scan requires generated artifacts: ${missing.join(", ")}`);
  }

  const findings = [];
  for (const target of targets) {
    for (const file of await collectFiles(target)) {
      const labels = await scanFile(file);
      if (labels.length > 0) findings.push({ file: path.relative(root, file), labels });
    }
  }

  if (findings.length > 0) {
    const summary = findings.map(({ file, labels }) => `${file} (${labels.join(", ")})`).join("; ");
    throw new Error(`Release security scan found possible credential material in ${findings.length} artifact(s): ${summary}. Values were intentionally not printed.`);
  }

  console.log(`PASS: release security scan checked ${targets.length} artifact roots without printing credential values.`);
}

await main();

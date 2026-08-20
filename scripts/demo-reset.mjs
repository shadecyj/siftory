import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const searchOsDataRoot = path.resolve(root, ".searchos");
const target = path.resolve(searchOsDataRoot, "demo-runtime-db");
const relative = path.relative(searchOsDataRoot, target);

if (relative !== "demo-runtime-db" || relative.startsWith("..") || path.isAbsolute(relative)) {
  throw new Error(`Refusing to reset an unexpected path: ${target}`);
}

await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
console.log(`Demo data reset: ${target}`);
console.log("Only the isolated Siftory demo database was removed; runtime-db and other project data were not touched.");

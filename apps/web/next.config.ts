import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: workspaceRoot,
  transpilePackages: ["@searchos/domain", "@searchos/contracts", "@searchos/fixtures", "@searchos/agent", "@searchos/retrieval", "@searchos/model-gateways", "@searchos/persistence", "@searchos/trust", "@searchos/presentation"]
};

export default nextConfig;

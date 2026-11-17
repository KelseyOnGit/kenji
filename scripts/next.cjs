const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const envFile = path.join(root, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const [app, command, ...args] = process.argv.slice(2);
if (!["timer", "leave"].includes(app) || !["dev", "build", "start"].includes(command)) {
  throw new Error("Usage: node scripts/next.cjs <timer|leave> <dev|build|start> [options]");
}
const result = spawnSync(process.execPath, [
  require.resolve("next/dist/bin/next"), command, path.join(root, "apps", app), ...args,
], { cwd: root, env: process.env, stdio: "inherit" });
if (result.error) throw result.error;
if (result.status === null) throw new Error(`Next.js terminated with signal ${result.signal}.`);
process.exitCode = result.status;

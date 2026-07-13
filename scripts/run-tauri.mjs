import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";

const cargoBin = path.join(os.homedir(), ".cargo", "bin");
const sep = path.delimiter;
const pathKey = process.platform === "win32" ? "Path" : "PATH";

const env = {
  ...process.env,
  [pathKey]: cargoBin + (process.env[pathKey] ? sep + process.env[pathKey] : ""),
};

const args = ["tauri", ...process.argv.slice(2)];
const child = spawn("npx", args, {
  stdio: "inherit",
  env,
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 1));

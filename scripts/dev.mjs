import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const services = [
  { name: "backend", directory: path.join(rootDir, "backend"), url: "http://localhost:3001" },
  { name: "frontend", directory: path.join(rootDir, "frontend"), url: "http://localhost:5173" },
];

const missingDependencies = services
  .filter(({ directory }) => !existsSync(path.join(directory, "node_modules")))
  .map(({ name }) => name);

if (missingDependencies.length > 0) {
  console.error(`Missing dependencies for: ${missingDependencies.join(", ")}.`);
  console.error("Run `npm run setup` once, then run `npm run dev` again.");
  process.exit(1);
}

const npmCommand = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "npm";
const npmArguments = process.platform === "win32" ? ["/d", "/s", "/c", "npm run dev"] : ["run", "dev"];
let stopping = false;

for (const service of services) {
  console.log(`Starting ${service.name} at ${service.url}`);
  service.process = spawn(npmCommand, npmArguments, {
    cwd: service.directory,
    stdio: "inherit",
  });

  service.process.on("error", (error) => {
    console.error(`Could not start ${service.name}: ${error.message}`);
    stopAll(1);
  });

  service.process.on("exit", (code, signal) => {
    if (stopping) return;

    const reason = signal ? `signal ${signal}` : `exit code ${code ?? 1}`;
    console.error(`${service.name} stopped with ${reason}. Stopping the other server.`);
    stopAll(code ?? 1);
  });
}

console.log("Both servers are running. Press Ctrl+C to stop them.");

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

function stopAll(exitCode) {
  if (stopping) return;
  stopping = true;

  for (const service of services) {
    const child = service.process;
    if (!child?.pid || child.exitCode !== null) continue;

    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }

  process.exit(exitCode);
}

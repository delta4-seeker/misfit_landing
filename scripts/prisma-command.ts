import { spawn } from "node:child_process";
import path from "node:path";

import { databaseUrl, directDatabaseUrl } from "../src/lib/database-url";

const args = process.argv.slice(2);
if (!args.length) throw new Error("Provide a Prisma command.");
const directUrl = directDatabaseUrl();
const runtimeUrl = databaseUrl();
if (!directUrl || !runtimeUrl) throw new Error("Supabase database configuration is missing.");

const executable = path.join(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "prisma.cmd" : "prisma");
const child = spawn(executable, args, {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: runtimeUrl, DIRECT_URL: directUrl },
});

child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});

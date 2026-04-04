import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const gitDir = path.join(repoRoot, ".git");
const hooksDir = path.join(repoRoot, ".githooks");

function runGit(args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }).trim();
}

function safeRunGit(args) {
  try {
    return runGit(args);
  } catch {
    return "";
  }
}

function main() {
  if (!existsSync(gitDir) || !existsSync(hooksDir)) {
    return;
  }

  const currentHooksPath = safeRunGit(["config", "--get", "core.hooksPath"]);

  if (currentHooksPath !== ".githooks") {
    execFileSync("git", ["config", "core.hooksPath", ".githooks"], {
      cwd: repoRoot,
      stdio: ["ignore", "ignore", "ignore"]
    });
  }

  execFileSync("node", ["scripts/normalize-max1vol-branch.js"], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "ignore"]
  });
}

main();

#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const legacyLower = String.fromCharCode(99, 111, 100, 101, 120);
const legacyTitle = `${legacyLower[0].toUpperCase()}${legacyLower.slice(1)}`;
const legacyUpper = legacyLower.toUpperCase();
const legacyPattern = new RegExp(legacyLower, "i");

const currentFile = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(currentFile), "..");
const textExtensions = new Set([
  ".cjs",
  ".css",
  ".cts",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".svelte",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml"
]);
const ignoredRoots = ["node_modules", ".git", ".svelte-kit", "build", "dist", "output", "static/output"];
const replacements = [
  [new RegExp(legacyUpper, "g"), "MAX1VOL"],
  [new RegExp(legacyTitle, "g"), "Max1vol"],
  [new RegExp(legacyLower, "g"), "max1vol"]
];

function listStagedFiles() {
  return execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
    cwd: repoRoot,
    encoding: "utf8"
  })
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isEligiblePath(relativePath) {
  if (!textExtensions.has(path.extname(relativePath).toLowerCase())) {
    return false;
  }

  return !ignoredRoots.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`));
}

function normalizeBranding(source) {
  return replacements.reduce((content, [pattern, replacement]) => content.replace(pattern, replacement), source);
}

function normalizeFile(relativePath) {
  if (!isEligiblePath(relativePath)) {
    return false;
  }

  const absolutePath = path.join(repoRoot, relativePath);

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    return false;
  }

  const original = fs.readFileSync(absolutePath, "utf8");

  if (!legacyPattern.test(original)) {
    return false;
  }

  const normalized = normalizeBranding(original);

  if (normalized === original) {
    return false;
  }

  fs.writeFileSync(absolutePath, normalized);
  execFileSync("git", ["add", relativePath], {
    cwd: repoRoot,
    stdio: ["ignore", "ignore", "ignore"]
  });
  return true;
}

const changedFiles = [];

for (const relativePath of listStagedFiles()) {
  if (normalizeFile(relativePath)) {
    changedFiles.push(relativePath);
  }
}

if (changedFiles.length > 0) {
  console.log(`Normalized branding in ${changedFiles.length} staged file(s).`);
}

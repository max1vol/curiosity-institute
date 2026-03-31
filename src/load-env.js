import fs from "node:fs";
import path from "node:path";

export function loadDotEnv(envPath = path.resolve(".env"), env = process.env) {
  if (!fs.existsSync(envPath)) {
    return false;
  }

  const raw = fs.readFileSync(envPath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in env)) {
      env[key] = value;
    }
  }

  return true;
}

export function loadConfiguredEnv({ cwd = process.cwd(), env = process.env } = {}) {
  const loadedFiles = [];
  const defaultEnvPath = path.resolve(cwd, ".env");

  if (loadDotEnv(defaultEnvPath, env)) {
    loadedFiles.push(defaultEnvPath);
  }

  if (env.KEYS_FILE) {
    const keysPath = path.isAbsolute(env.KEYS_FILE)
      ? env.KEYS_FILE
      : path.resolve(cwd, env.KEYS_FILE);

    if (loadDotEnv(keysPath, env)) {
      loadedFiles.push(keysPath);
    }
  }

  return loadedFiles;
}

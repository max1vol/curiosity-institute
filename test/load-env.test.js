import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadConfiguredEnv } from "../src/load-env.js";

test("loadConfiguredEnv loads .env and KEYS_FILE without overriding existing values", () => {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "curiosity-env-"));
  const envPath = path.join(tempDirectory, ".env");
  const keysPath = path.join(tempDirectory, "keys.txt");

  fs.writeFileSync(envPath, "GEMINI_MODEL=gemini-3-pro-image-preview\nKEYS_FILE=keys.txt\n", "utf8");
  fs.writeFileSync(
    keysPath,
    "GEMINI_API_KEY=from-keys-file\nGOOGLE_API_KEY=from-google-key-file\n",
    "utf8",
  );

  const env = {
    GEMINI_MODEL: "existing-model",
  };

  const loadedFiles = loadConfiguredEnv({
    cwd: tempDirectory,
    env,
  });

  assert.deepEqual(loadedFiles, [envPath, keysPath]);
  assert.equal(env.GEMINI_MODEL, "existing-model");
  assert.equal(env.GEMINI_API_KEY, "from-keys-file");
  assert.equal(env.GOOGLE_API_KEY, "from-google-key-file");
});

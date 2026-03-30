import test from "node:test";
import assert from "node:assert/strict";

import { buildConfig } from "../src/config.js";

test("buildConfig uses dry-run without credentials", () => {
  const config = buildConfig({
    argv: ["--dry-run", "--allow-empty"],
    env: {},
  });

  assert.equal(config.dryRun, true);
  assert.equal(config.allowEmpty, true);
  assert.equal(config.model, "gemini-2.5-flash-image");
  assert.equal(config.retryLimit, 3);
  assert.equal(config.auth.kind, "none");
});

test("buildConfig prefers GEMINI_API_KEY auth", () => {
  const config = buildConfig({
    argv: [],
    env: {
      GEMINI_API_KEY: "test-key",
    },
  });

  assert.equal(config.auth.kind, "developer-api");
  assert.equal(config.auth.apiKey, "test-key");
});

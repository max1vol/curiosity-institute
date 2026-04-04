import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { buildConfig } from "../core/config.js";
import { buildPhotosphereConfig } from "../core/photosphere-config.js";
import { buildSplatConfig } from "../core/splat-config.js";

test("buildConfig uses dry-run without credentials", () => {
  const config = buildConfig({
    argv: ["--dry-run", "--allow-empty"],
    env: {},
  });

  assert.equal(config.dryRun, true);
  assert.equal(config.allowEmpty, true);
  assert.equal(config.model, "gemini-3-pro-image-preview");
  assert.equal(config.retryLimit, 3);
  assert.equal(config.auth.kind, "none");
  assert.equal(config.inputDir, path.resolve("docs/concept-art"));
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

test("buildConfig accepts GEMINI_MODEL as the primary model override", () => {
  const config = buildConfig({
    argv: ["--dry-run", "--allow-empty"],
    env: {
      GEMINI_MODEL: "gemini-3.1-flash-image-preview",
    },
  });

  assert.equal(config.model, "gemini-3.1-flash-image-preview");
});

test("buildConfig prefers service-account auth when service account JSON is present", () => {
  const config = buildConfig({
    argv: [],
    env: {
      GOOGLE_SERVICE_ACCOUNT_JSON:
        '{"project_id":"pic2toon","client_email":"service@example.com","private_key":"-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n"}',
    },
  });

  assert.equal(config.auth.kind, "vertex-service-account");
  assert.equal(config.projectId, "pic2toon");
});

test("buildPhotosphereConfig defaults to five retries", () => {
  const config = buildPhotosphereConfig({
    argv: ["--dry-run"],
    env: {},
  });

  assert.equal(config.retryLimit, 5);
  assert.equal(config.model, "gemini-3.1-flash-image-preview");
});

test("buildSplatConfig mirrors the splat-first immersive config", () => {
  const config = buildSplatConfig({
    argv: ["--dry-run"],
    env: {},
  });

  assert.equal(config.retryLimit, 5);
  assert.equal(config.model, "gemini-3.1-flash-image-preview");
});

test("buildSplatConfig accepts SPLAT_RETRY_LIMIT overrides up to six", () => {
  const config = buildSplatConfig({
    argv: ["--dry-run"],
    env: {
      SPLAT_RETRY_LIMIT: "6",
    },
  });

  assert.equal(config.retryLimit, 6);
});

test("buildPhotosphereConfig accepts PHOTOSPHERE_RETRY_LIMIT overrides up to six", () => {
  const config = buildPhotosphereConfig({
    argv: ["--dry-run"],
    env: {
      PHOTOSPHERE_RETRY_LIMIT: "6",
    },
  });

  assert.equal(config.retryLimit, 6);
});

test("buildPhotosphereConfig rejects PHOTOSPHERE_RETRY_LIMIT values above six", () => {
  assert.throws(
    () =>
      buildPhotosphereConfig({
        argv: ["--dry-run"],
        env: {
          PHOTOSPHERE_RETRY_LIMIT: "7",
        },
      }),
    /PHOTOSPHERE_RETRY_LIMIT must be an integer between 1 and 6\./i,
  );
});

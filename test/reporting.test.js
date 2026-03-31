import test from "node:test";
import assert from "node:assert/strict";

import { FailureCollector, normalizeFailureMessage, renderFailureReadme } from "../src/reporting.js";

test("normalizeFailureMessage removes volatile ids and numbers", () => {
  const normalized = normalizeFailureMessage(
    "HTTP 429 for request aabbccddeeff0011 on attempt 2 at /tmp/work",
  );

  assert.equal(normalized, "http <n> for request <id> on attempt <n> at <path>");
});

test("FailureCollector deduplicates repeated final failures", () => {
  const collector = new FailureCollector();
  const error = new Error("Rate limit exceeded for request 12345");

  collector.recordAttempt(
    { asset: "castle.png", direction: "northwest-oblique", retryLimit: 3 },
    error,
    1,
  );
  collector.recordFinalFailure(
    { asset: "castle.png", direction: "northwest-oblique", retryLimit: 3 },
    error,
  );
  collector.recordFinalFailure(
    { asset: "castle.png", direction: "northeast-oblique", retryLimit: 3 },
    new Error("Rate limit exceeded for request 67890"),
  );

  assert.equal(collector.attemptFailures.length, 1);
  assert.equal(collector.uniqueFailures.size, 1);
});

test("renderFailureReadme lists only unique failures", () => {
  const readme = renderFailureReadme({
    retryLimit: 3,
    profileLabel: "Raised Oblique Map",
    uniqueFailures: [
      {
        representativeMessage: "Rate limit exceeded",
        normalizedMessage: "rate limit exceeded",
        occurrences: 2,
        targets: [
          { asset: "castle.png", direction: "northwest-oblique" },
          { asset: "castle.png", direction: "northeast-oblique" },
        ],
      },
    ],
  });

  assert.match(readme, /Retry policy: up to 3 attempts/i);
  assert.match(readme, /Unique failures recorded: 1/i);
  assert.match(readme, /Rate limit exceeded/i);
  assert.equal((readme.match(/## Rate limit exceeded/g) || []).length, 1);
});

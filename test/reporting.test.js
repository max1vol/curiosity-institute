import test from "node:test";
import assert from "node:assert/strict";

import { FailureCollector, normalizeFailureMessage } from "../src/reporting.js";

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

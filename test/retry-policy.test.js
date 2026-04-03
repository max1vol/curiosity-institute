import test from "node:test";
import assert from "node:assert/strict";

import { classifyRetryDecision } from "../core/retry-policy.js";

test("classifyRetryDecision fails fast on leaked API keys", () => {
  const decision = classifyRetryDecision(
    new Error("Your API key was reported as leaked. Please use another API key."),
    1,
  );

  assert.equal(decision.retryable, false);
  assert.equal(decision.category, "credentials");
  assert.equal(decision.delayMs, 0);
});

test("classifyRetryDecision applies strong backoff on quota errors", () => {
  const firstAttempt = classifyRetryDecision(
    new Error("Resource has been exhausted (e.g. check quota)."),
    1,
  );
  const secondAttempt = classifyRetryDecision(
    new Error("Resource has been exhausted (e.g. check quota)."),
    2,
  );

  assert.equal(firstAttempt.retryable, true);
  assert.equal(firstAttempt.category, "quota");
  assert.equal(firstAttempt.delayMs, 5000);
  assert.equal(secondAttempt.delayMs, 10000);
});

test("classifyRetryDecision retries timeouts with escalating delays", () => {
  const decision = classifyRetryDecision(
    new Error("Google request timed out after 10000ms."),
    3,
  );

  assert.equal(decision.retryable, true);
  assert.equal(decision.category, "timeout");
  assert.equal(decision.delayMs, 8000);
});

test("classifyRetryDecision treats worker branch failures as transient server errors", () => {
  const decision = classifyRetryDecision(
    new Error("Request failed. All manager-directed worker branches failed."),
    2,
  );

  assert.equal(decision.retryable, true);
  assert.equal(decision.category, "server");
  assert.equal(decision.delayMs, 6000);
});

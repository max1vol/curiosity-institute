const NON_RETRYABLE_RULES = [
  {
    category: "credentials",
    pattern: /api key was reported as leaked/i,
  },
  {
    category: "credentials",
    pattern: /permission denied/i,
  },
  {
    category: "credentials",
    pattern: /\bunauthenticated\b/i,
  },
  {
    category: "credentials",
    pattern: /invalid (?:api key|grant|authentication|credentials?)/i,
  },
  {
    category: "safety",
    pattern: /request blocked by model safety filters/i,
  },
];

function serverDelayMsForAttempt(attempt) {
  return Math.min(3000 * (2 ** (attempt - 1)), 20000);
}

const TRANSIENT_RULES = [
  {
    category: "quota",
    delayMsForAttempt: (attempt) => Math.min(5000 * (2 ** (attempt - 1)), 30000),
    pattern: /\b429\b|quota|resource has been exhausted|resource exhausted|rate limit/i,
  },
  {
    category: "timeout",
    delayMsForAttempt: (attempt) => Math.min(2000 * (2 ** (attempt - 1)), 15000),
    pattern: /timed out|deadline exceeded/i,
  },
  {
    category: "server",
    delayMsForAttempt: serverDelayMsForAttempt,
    pattern: /manager-directed worker branches failed|worker branches failed/i,
  },
  {
    category: "server",
    delayMsForAttempt: serverDelayMsForAttempt,
    pattern: /temporarily unavailable|\bunavailable\b|internal error/i,
  },
];

function messageFromError(error) {
  return error instanceof Error ? error.message : String(error);
}

export function classifyRetryDecision(error, attempt) {
  const message = messageFromError(error);

  for (const rule of NON_RETRYABLE_RULES) {
    if (rule.pattern.test(message)) {
      return {
        category: rule.category,
        delayMs: 0,
        retryable: false,
      };
    }
  }

  for (const rule of TRANSIENT_RULES) {
    if (rule.pattern.test(message)) {
      return {
        category: rule.category,
        delayMs: rule.delayMsForAttempt(attempt),
        retryable: true,
      };
    }
  }

  return {
    category: "unknown",
    delayMs: Math.min(1000 * (2 ** (attempt - 1)), 10000),
    retryable: true,
  };
}

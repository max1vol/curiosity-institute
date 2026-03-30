export function normalizeFailureMessage(message) {
  return String(message)
    .toLowerCase()
    .replace(/[0-9a-f]{8,}/g, "<id>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/\/[^ ]+/g, "<path>")
    .replace(/\s+/g, " ")
    .trim();
}

function toFailureRecord(context, error, attempt) {
  return {
    asset: context.asset,
    direction: context.direction,
    attempt,
    message: error instanceof Error ? error.message : String(error),
    normalizedMessage: normalizeFailureMessage(
      error instanceof Error ? error.message : String(error),
    ),
    timestamp: new Date().toISOString(),
  };
}

export class FailureCollector {
  constructor() {
    this.attemptFailures = [];
    this.uniqueFailures = new Map();
  }

  recordAttempt(context, error, attempt) {
    const record = toFailureRecord(context, error, attempt);
    this.attemptFailures.push(record);
    return record;
  }

  recordFinalFailure(context, error) {
    const record = toFailureRecord(context, error, context.retryLimit);
    const existing = this.uniqueFailures.get(record.normalizedMessage);

    if (existing) {
      existing.occurrences += 1;
      existing.targets.push({
        asset: context.asset,
        direction: context.direction,
      });
      return;
    }

    this.uniqueFailures.set(record.normalizedMessage, {
      normalizedMessage: record.normalizedMessage,
      representativeMessage: record.message,
      occurrences: 1,
      targets: [
        {
          asset: context.asset,
          direction: context.direction,
        },
      ],
    });
  }

  toJson() {
    return {
      attemptFailures: this.attemptFailures,
      deduplicatedFailures: Array.from(this.uniqueFailures.values()),
    };
  }
}

export function renderDeduplicatedFailuresMarkdown(uniqueFailures) {
  if (!uniqueFailures.length) {
    return "# Deduplicated Failures\n\nNo failures were recorded.\n";
  }

  const lines = ["# Deduplicated Failures", ""];

  for (const failure of uniqueFailures) {
    lines.push(`## ${failure.representativeMessage}`);
    lines.push("");
    lines.push(`- Occurrences: ${failure.occurrences}`);
    lines.push(`- Normalized key: \`${failure.normalizedMessage}\``);
    lines.push("- Affected renders:");
    for (const target of failure.targets) {
      lines.push(`  - ${target.asset} :: ${target.direction}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

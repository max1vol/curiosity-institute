import path from "node:path";
import { parseArgs } from "node:util";

function parseRetryLimit(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) {
    throw new Error("RETRY_LIMIT must be an integer between 1 and 3.");
  }

  return parsed;
}

function resolveAuth(env) {
  if (env.GEMINI_API_KEY) {
    return {
      kind: "developer-api",
      apiKey: env.GEMINI_API_KEY,
    };
  }

  if (env.GOOGLE_ACCESS_TOKEN) {
    return {
      kind: "vertex-access-token",
      accessToken: env.GOOGLE_ACCESS_TOKEN,
    };
  }

  return {
    kind: "none",
  };
}

export function buildConfig({ argv = process.argv.slice(2), env = process.env } = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "dry-run": {
        type: "boolean",
        default: false,
      },
      "allow-empty": {
        type: "boolean",
        default: false,
      },
      model: {
        type: "string",
      },
      "input-dir": {
        type: "string",
      },
      "output-dir": {
        type: "string",
      },
      "reports-dir": {
        type: "string",
      },
      retries: {
        type: "string",
      },
    },
    allowPositionals: false,
  });

  const retryLimit = parseRetryLimit(values.retries ?? env.RETRY_LIMIT ?? "3");
  const auth = resolveAuth(env);

  if (!values["dry-run"] && auth.kind === "none") {
    throw new Error(
      "Missing Google credentials. Set GEMINI_API_KEY or GOOGLE_ACCESS_TOKEN, or use --dry-run.",
    );
  }

  if (auth.kind === "vertex-access-token" && !env.GOOGLE_CLOUD_PROJECT) {
    throw new Error("GOOGLE_CLOUD_PROJECT is required when using GOOGLE_ACCESS_TOKEN.");
  }

  return {
    dryRun: values["dry-run"],
    allowEmpty: values["allow-empty"],
    inputDir: path.resolve(values["input-dir"] ?? env.INPUT_DIR ?? "docs/concept-art"),
    outputDir: path.resolve(values["output-dir"] ?? env.OUTPUT_DIR ?? "output/renders"),
    reportsDir: path.resolve(values["reports-dir"] ?? env.REPORTS_DIR ?? "output/reports"),
    retryLimit,
    model: values.model ?? env.GEMINI_MODEL ?? env.GOOGLE_IMAGE_MODEL ?? "gemini-3-pro-image-preview",
    auth,
    projectId: env.GOOGLE_CLOUD_PROJECT ?? "",
    location: env.GOOGLE_CLOUD_LOCATION ?? "global",
  };
}

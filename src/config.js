import path from "node:path";
import { parseArgs } from "node:util";

function parseRetryLimit(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) {
    throw new Error("RETRY_LIMIT must be an integer between 1 and 3.");
  }

  return parsed;
}

function resolveAuth(env, authMode = "auto") {
  if (authMode === "developer-api") {
    const apiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
    if (apiKey) {
      return {
        kind: "developer-api",
        apiKey,
      };
    }
    return { kind: "none" };
  }

  if (authMode === "vertex-access-token") {
    if (env.GOOGLE_ACCESS_TOKEN) {
      return {
        kind: "vertex-access-token",
        accessToken: env.GOOGLE_ACCESS_TOKEN,
      };
    }
    return { kind: "none" };
  }

  if (authMode === "service-account") {
    if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      return {
        kind: "vertex-service-account",
        serviceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON,
      };
    }
    return { kind: "none" };
  }

  if (env.GOOGLE_ACCESS_TOKEN) {
    return {
      kind: "vertex-access-token",
      accessToken: env.GOOGLE_ACCESS_TOKEN,
    };
  }

  if (env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return {
      kind: "vertex-service-account",
      serviceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON,
    };
  }

  if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) {
    return {
      kind: "developer-api",
      apiKey: env.GEMINI_API_KEY || env.GOOGLE_API_KEY,
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
      "auth-mode": {
        type: "string",
      },
      retries: {
        type: "string",
      },
    },
    allowPositionals: false,
  });

  const retryLimit = parseRetryLimit(values.retries ?? env.RETRY_LIMIT ?? "3");
  const authMode = values["auth-mode"] ?? env.GOOGLE_AUTH_MODE ?? "auto";
  const auth = resolveAuth(env, authMode);

  if (!values["dry-run"] && auth.kind === "none") {
    throw new Error(
      "Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON, GEMINI_API_KEY, GOOGLE_ACCESS_TOKEN, or use --dry-run.",
    );
  }

  if (auth.kind === "vertex-access-token" && !env.GOOGLE_CLOUD_PROJECT) {
    throw new Error("GOOGLE_CLOUD_PROJECT is required when using GOOGLE_ACCESS_TOKEN.");
  }

  if (auth.kind === "vertex-service-account") {
    try {
      auth.serviceAccount = JSON.parse(auth.serviceAccountJson);
    } catch {
      throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    }
  }

  return {
    dryRun: values["dry-run"],
    allowEmpty: values["allow-empty"],
    inputDir: path.resolve(values["input-dir"] ?? env.INPUT_DIR ?? "docs/concept-art"),
    outputDir: path.resolve(values["output-dir"] ?? env.OUTPUT_DIR ?? "output/renders"),
    reportsDir: path.resolve(values["reports-dir"] ?? env.REPORTS_DIR ?? "output/reports"),
    retryLimit,
    model: values.model ?? env.GEMINI_MODEL ?? env.GOOGLE_IMAGE_MODEL ?? "gemini-3-pro-image-preview",
    authMode,
    auth,
    projectId: env.GOOGLE_CLOUD_PROJECT ?? auth.serviceAccount?.project_id ?? "",
    location: env.GOOGLE_CLOUD_LOCATION ?? "global",
  };
}

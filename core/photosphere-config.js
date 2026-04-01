import path from "node:path";
import { parseArgs } from "node:util";

import { parseRetryLimit, resolveAuth } from "./config.js";

export function buildPhotosphereConfig({ argv = process.argv.slice(2), env = process.env } = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "dry-run": {
        type: "boolean",
        default: false
      },
      model: {
        type: "string"
      },
      "input-dir": {
        type: "string"
      },
      "output-dir": {
        type: "string"
      },
      "reports-dir": {
        type: "string"
      },
      "auth-mode": {
        type: "string"
      },
      retries: {
        type: "string"
      },
      "image-size": {
        type: "string"
      },
      "aspect-ratio": {
        type: "string"
      }
    },
    allowPositionals: false
  });

  const retryLimit = parseRetryLimit(values.retries ?? env.RETRY_LIMIT ?? "3");
  const authMode = values["auth-mode"] ?? env.GOOGLE_AUTH_MODE ?? "auto";
  const auth = resolveAuth(env, authMode);

  if (!values["dry-run"] && auth.kind === "none") {
    throw new Error(
      "Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON, GEMINI_API_KEY, GOOGLE_ACCESS_TOKEN, or use --dry-run."
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
    inputDir: path.resolve(values["input-dir"] ?? env.PHOTOSPHERE_INPUT_DIR ?? "docs/concept-art"),
    outputDir: path.resolve(values["output-dir"] ?? env.PHOTOSPHERE_OUTPUT_DIR ?? "output/photospheres"),
    reportsDir: path.resolve(values["reports-dir"] ?? env.PHOTOSPHERE_REPORTS_DIR ?? "output/photospheres/reports"),
    retryLimit,
    model: values.model ?? env.PHOTOSPHERE_MODEL ?? "gemini-3.1-flash-image-preview",
    imageSize: values["image-size"] ?? env.PHOTOSPHERE_IMAGE_SIZE ?? "1K",
    aspectRatio: values["aspect-ratio"] ?? env.PHOTOSPHERE_ASPECT_RATIO ?? "4:1",
    authMode,
    auth,
    projectId: env.GOOGLE_CLOUD_PROJECT ?? auth.serviceAccount?.project_id ?? "",
    location: env.GOOGLE_CLOUD_LOCATION ?? "global"
  };
}

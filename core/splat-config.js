import path from "node:path";
import { parseArgs } from "node:util";

import { resolveAuth } from "./config.js";

function parsePositiveInteger(value, label, { min = 1, max = 10000 } = {}) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  }

  return parsed;
}

export function buildSplatConfig({ argv = process.argv.slice(2), env = process.env } = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      "dry-run": {
        type: "boolean",
        default: false,
      },
      "refresh-views": {
        type: "boolean",
        default: false,
      },
      model: {
        type: "string",
      },
      "auth-mode": {
        type: "string",
      },
      "input-dir": {
        type: "string",
      },
      "render-root": {
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
      "points-per-view": {
        type: "string",
      },
      "points-per-asset": {
        type: "string",
      },
      "view-count": {
        type: "string",
      },
      "image-size": {
        type: "string",
      },
      "max-reference-images": {
        type: "string",
      },
      limit: {
        type: "string",
      },
    },
    allowPositionals: false,
  });

  const authMode = values["auth-mode"] ?? env.GOOGLE_AUTH_MODE ?? "auto";
  const auth = resolveAuth(env, authMode);
  const refreshViewsDefault = auth.kind !== "none";
  const refreshViews = values["refresh-views"] || /^(1|true|yes)$/i.test(env.SPLAT_REFRESH_VIEWS ?? "")
    ? true
    : env.SPLAT_REFRESH_VIEWS == null && !values["refresh-views"]
      ? refreshViewsDefault
      : false;

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
    refreshViews,
    inputDir: path.resolve(values["input-dir"] ?? env.SPLAT_INPUT_DIR ?? "docs/concept-art"),
    renderRoot: path.resolve(values["render-root"] ?? env.SPLAT_RENDER_ROOT ?? "output/renders"),
    outputDir: path.resolve(values["output-dir"] ?? env.SPLAT_OUTPUT_DIR ?? "output/splats"),
    reportsDir: path.resolve(values["reports-dir"] ?? env.SPLAT_REPORTS_DIR ?? "output/splats/reports"),
    retryLimit: parsePositiveInteger(values.retries ?? env.SPLAT_RETRY_LIMIT ?? env.RETRY_LIMIT ?? "5", "SPLAT_RETRY_LIMIT", {
      min: 1,
      max: 6,
    }),
    pointsPerView: parsePositiveInteger(values["points-per-view"] ?? env.SPLAT_POINTS_PER_VIEW ?? "1400", "SPLAT_POINTS_PER_VIEW", {
      min: 64,
      max: 24000,
    }),
    pointsPerAsset: parsePositiveInteger(values["points-per-asset"] ?? env.SPLAT_POINTS_PER_ASSET ?? "3600", "SPLAT_POINTS_PER_ASSET", {
      min: 128,
      max: 48000,
    }),
    viewCount: parsePositiveInteger(values["view-count"] ?? env.SPLAT_VIEW_COUNT ?? "6", "SPLAT_VIEW_COUNT", {
      min: 3,
      max: 8,
    }),
    imageSize: values["image-size"] ?? env.SPLAT_IMAGE_SIZE ?? "2K",
    maxReferenceImages: parsePositiveInteger(
      values["max-reference-images"] ?? env.SPLAT_MAX_REFERENCE_IMAGES ?? "4",
      "SPLAT_MAX_REFERENCE_IMAGES",
      {
        min: 1,
        max: 14,
      }
    ),
    assetLimit: values.limit ? parsePositiveInteger(values.limit, "limit", { min: 1, max: 999 }) : null,
    model: values.model ?? env.SPLAT_MODEL ?? env.GEMINI_MODEL ?? env.GOOGLE_IMAGE_MODEL ?? "gemini-3.1-flash-image-preview",
    authMode,
    auth,
    projectId: env.GOOGLE_CLOUD_PROJECT ?? auth.serviceAccount?.project_id ?? "",
    location: env.GOOGLE_CLOUD_LOCATION ?? "global",
  };
}

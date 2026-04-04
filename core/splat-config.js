import { buildPhotosphereConfig } from "./photosphere-config.js";

const SPLAT_ENV_ALIASES = [
  ["SPLAT_INPUT_DIR", "PHOTOSPHERE_INPUT_DIR"],
  ["SPLAT_OUTPUT_DIR", "PHOTOSPHERE_OUTPUT_DIR"],
  ["SPLAT_REPORTS_DIR", "PHOTOSPHERE_REPORTS_DIR"],
  ["SPLAT_RETRY_LIMIT", "PHOTOSPHERE_RETRY_LIMIT"],
  ["SPLAT_MODEL", "PHOTOSPHERE_MODEL"],
  ["SPLAT_IMAGE_SIZE", "PHOTOSPHERE_IMAGE_SIZE"],
  ["SPLAT_ASPECT_RATIO", "PHOTOSPHERE_ASPECT_RATIO"],
];

export function buildSplatConfig({ argv = process.argv.slice(2), env = process.env } = {}) {
  const mappedEnv = { ...env };

  for (const [splatKey, photosphereKey] of SPLAT_ENV_ALIASES) {
    if (mappedEnv[photosphereKey] == null && mappedEnv[splatKey] != null) {
      mappedEnv[photosphereKey] = mappedEnv[splatKey];
    }
  }

  return buildPhotosphereConfig({ argv, env: mappedEnv });
}

import { buildSplatConfig } from "./splat-config.js";
import { loadConfiguredEnv } from "./load-env.js";
import { runSplatPipeline } from "./splat-pipeline.js";

async function main() {
  loadConfiguredEnv();
  const config = buildSplatConfig();
  const summary = await runSplatPipeline(config);

  console.log(
    `Compiled ${summary.splatsWritten} gaussian splat assets from ${summary.librariesDiscovered} room render libraries.`,
  );
  console.log(`View refresh mode: ${summary.refreshViews ? `Nano Banana via ${summary.model}` : "tracked render-library fallback"}`);
  console.log(`Unique failures: ${summary.uniqueFailures}`);

  if (summary.uniqueFailures > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

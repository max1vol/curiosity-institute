import { buildPhotosphereConfig } from "./photosphere-config.js";
import { loadConfiguredEnv } from "./load-env.js";
import { runPhotospherePipeline } from "./photosphere-pipeline.js";

async function main() {
  loadConfiguredEnv();
  const config = buildPhotosphereConfig();
  const summary = await runPhotospherePipeline(config);

  console.log(
    `Processed ${summary.assetsDiscovered} room assets into ${summary.photospheresCompleted} photospheres using ${summary.model}.`
  );
  console.log(`Unique failures: ${summary.uniqueFailures}`);

  if (summary.uniqueFailures > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

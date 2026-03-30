import { buildConfig } from "./config.js";
import { loadDotEnv } from "./load-env.js";
import { runPipeline } from "./pipeline.js";

async function main() {
  loadDotEnv();
  const config = buildConfig();
  const summary = await runPipeline(config);

  console.log(
    `Processed ${summary.assetsDiscovered} assets into ${summary.rendersCompleted} renders using ${summary.model}.`,
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

import path from "node:path";

import { DIRECTIONS } from "./directions.js";

export function buildAssetLibrary({
  asset,
  outputSubdirectory,
  renderProfile,
  retryLimit,
  persistedRenders,
}) {
  const persistedByDirection = new Map(
    persistedRenders.map((render) => [render.direction, render]),
  );

  const views = DIRECTIONS.map((direction) => {
    const persistedRender = persistedByDirection.get(direction.id);

    return {
      id: direction.id,
      label: direction.label,
      librarySlot: direction.librarySlot,
      intersectsWith: direction.intersectsWith,
      overlapInstruction: direction.overlapInstruction,
      status: persistedRender ? "completed" : "missing",
      imageFile: persistedRender?.imageFile ?? null,
      metadataFile: persistedRender?.metadataFile ?? null,
      attempt: persistedRender?.attempt ?? null,
    };
  });

  return {
    asset: asset.relativePath,
    libraryType: "intersecting-oblique-map-views",
    coverageGoal:
      "Each capture should overlap the same anchor landmarks, circulation paths, and terrain breaks so the set reads like intersecting Google Maps-style 3D map imagery of one shared place.",
    renderProfile: renderProfile.id,
    renderProfileLabel: renderProfile.label,
    outputDirectory: outputSubdirectory,
    retryLimit,
    totalViews: DIRECTIONS.length,
    completedViews: views.filter((view) => view.status === "completed").length,
    missingViews: views.filter((view) => view.status !== "completed").map((view) => view.id),
    views,
    generatedAt: new Date().toISOString(),
  };
}

export function renderAssetLibraryReadme(library) {
  const lines = [
    "# Intersecting View Library",
    "",
    `- Source asset: \`${library.asset}\``,
    `- Render profile: ${library.renderProfileLabel}`,
    `- Retry policy: up to ${library.retryLimit} attempts per direction`,
    `- Completed views: ${library.completedViews} of ${library.totalViews}`,
    `- Coverage goal: ${library.coverageGoal}`,
    "",
  ];

  for (const view of library.views) {
    lines.push(`## ${view.label}`);
    lines.push("");
    lines.push(`- Slot: ${view.librarySlot}`);
    lines.push(`- Status: ${view.status}`);
    lines.push(`- Intersects with: ${view.intersectsWith.join(", ")}`);
    lines.push(`- Overlap rule: ${view.overlapInstruction}`);
    if (view.imageFile) {
      lines.push(`- Image: \`${view.imageFile}\``);
    }
    if (view.metadataFile) {
      lines.push(`- Metadata: \`${view.metadataFile}\``);
    }
    lines.push("");
  }

  if (library.missingViews.length) {
    lines.push(`Missing views: ${library.missingViews.join(", ")}`);
    lines.push("");
  }

  return lines.join("\n");
}

export function libraryFilePaths({ outputDir, asset }) {
  const assetDirectory = path.join(outputDir, asset.outputSubdirectory);
  return {
    assetDirectory,
    manifestPath: path.join(assetDirectory, "library.json"),
    readmePath: path.join(assetDirectory, "README.md"),
  };
}

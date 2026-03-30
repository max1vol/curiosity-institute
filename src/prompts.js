export function build3DMapPrompt({ assetName, direction }) {
  return [
    `Transform the supplied concept art for "${assetName}" into a polished 3D environment render.`,
    "Target style: premium oblique aerial map visualization with convincing geometry, height, depth, and shadowing, similar to a modern 3D satellite map view.",
    "Preserve the original composition, landmarks, silhouette language, terrain layout, and color identity of the concept art.",
    direction.cameraInstruction,
    "Reconstruct surfaces, structures, foliage, props, and terrain so they feel volumetric and spatially coherent.",
    "Use realistic ambient occlusion, clean sunlight, readable material separation, and subtle atmospheric depth.",
    "Keep the full subject in frame and produce exactly one final image.",
    "Do not add UI, labels, borders, watermarks, text overlays, split panels, extra objects, or alternate views.",
  ].join("\n");
}

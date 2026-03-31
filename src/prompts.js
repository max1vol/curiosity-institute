import { RAISED_RENDER_PROFILE } from "./render-profile.js";

export function build3DMapPrompt({ assetName, direction }) {
  return [
    `Transform the supplied concept art for "${assetName}" into a polished 3D environment render.`,
    `Target style: ${RAISED_RENDER_PROFILE.label} with a premium oblique aerial map look, convincing geometry, land height, depth, and shadowing similar to a modern 3D satellite map view.`,
    "Preserve the original composition, landmarks, silhouette language, terrain layout, and color identity of the concept art.",
    `Treat this output as the ${direction.label} capture in a three-image intersecting Google Maps-style oblique library for the same place.`,
    `Keep the camera height, lens feel, landmark placement, and scale consistent with the companion captures in ${direction.intersectsWith.join(", ")}.`,
    direction.cameraInstruction,
    direction.overlapInstruction,
    direction.shadowInstruction,
    direction.terrainInstruction,
    direction.buildingInstruction,
    "Reconstruct surfaces, structures, foliage, props, and terrain so they feel volumetric and spatially coherent rather than flat.",
    "Infer land-height data from the concept art footprint and express it through contour breaks, stairs, platforms, retaining walls, raised curbs, and sloped transitions.",
    "Add explicit 3D building models with visible roofs, extruded walls, facade depth, and readable junctions where buildings meet the ground.",
    "Use realistic ambient occlusion, clean sunlight, readable material separation, long cast shadows, and subtle atmospheric depth.",
    "Make the place feel raised above the ground plane, with strong height cues in both terrain and built structures.",
    "Keep the full subject in frame and produce exactly one final image.",
    ...RAISED_RENDER_PROFILE.avoid,
  ].join("\n");
}

import { RAISED_RENDER_PROFILE } from "./render-profile.js";

export function build3DMapPrompt({ assetName, direction }) {
  return [
    `Generate an image of a polished 3D environment render for "${assetName}".`,
    `Intent: create complicated, high-quality scenery in the ${RAISED_RENDER_PROFILE.label} style with premium oblique aerial depth.`,
    "Step 1: preserve the original composition, landmarks, silhouette language, terrain layout, and color identity of the concept art.",
    `Step 2: treat this output as the ${direction.label} capture in a three-image intersecting Google Maps-style oblique library for the same place.`,
    `Step 3: resolve the scene into expensive-looking 3D terrain, buildings, props, foliage, and lighting while keeping overlap with ${direction.intersectsWith.join(", ")}.`,
    `Keep the camera height, lens feel, landmark placement, and scale consistent with the companion captures in ${direction.intersectsWith.join(", ")}.`,
    direction.cameraInstruction,
    direction.overlapInstruction,
    direction.shadowInstruction,
    direction.terrainInstruction,
    direction.buildingInstruction,
    "Use explicit camera control, a straight horizon, and a believable wide but not distorted aerial lens.",
    "Increase scenery complexity with layered terrain shelves, secondary structures, bridges, retaining walls, planted edges, overhangs, stairs, railings, and nested circulation routes where the concept supports them.",
    "Make the world feel expensive and fully built: dense prop dressing, coherent material variation, bevels, trim breaks, facade recesses, and believable environmental storytelling instead of broad empty surfaces.",
    "Reconstruct surfaces, structures, foliage, props, and terrain so they feel volumetric and spatially coherent rather than flat.",
    "Infer land-height data from the concept art footprint and express it through contour breaks, stairs, platforms, retaining walls, raised curbs, and sloped transitions.",
    "Add explicit 3D building models with visible roofs, extruded walls, facade depth, and readable junctions where buildings meet the ground.",
    "Use realistic ambient occlusion, clean sunlight, readable material separation, long cast shadows, subtle atmospheric depth, and precise scale cues between foreground, midground, and background.",
    "Make the place feel raised above the ground plane, with strong height cues in both terrain and built structures.",
    "Keep the full subject in frame and produce exactly one final image.",
    ...RAISED_RENDER_PROFILE.avoid,
  ].join("\n");
}

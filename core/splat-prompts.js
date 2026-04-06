export const SPLAT_PROFILE = {
  id: "nano-banana-gaussian-splat-multiview",
  label: "Nano Banana Gaussian Splat Multi-View",
  tricks: [
    "Generate a fresh room view from a different camera angle while preserving the same architecture, prop language, lighting, and traversal layout.",
    "Prefer a stable eye-level composition that can be unprojected into a 3D point cloud.",
    "Keep the frame free of text, UI, logos, borders, split screens, and collage layouts.",
    "Preserve strong depth separation between foreground objects, midground circulation, and distant walls.",
    "Use the reference image as the same physical room, not a reinterpretation of the scene.",
    "Keep geometry coherent across views so the angle images overlap cleanly when reconstructed into splats.",
    "Favor layered scenery, foreground occluders, background architecture, and complicated but readable material transitions.",
    "Do not simplify the scene into chunky toy-like forms, sparse placeholder geometry, or flat poster compositions."
  ]
};

const VIEW_DEFINITIONS = [
  {
    id: "front",
    label: "front",
    cameraYawDeg: 0
  },
  {
    id: "left-orbit",
    label: "left orbit",
    cameraYawDeg: -110
  },
  {
    id: "right-orbit",
    label: "right orbit",
    cameraYawDeg: 110
  },
  {
    id: "rear-orbit",
    label: "rear orbit",
    cameraYawDeg: 180
  },
  {
    id: "front-left-orbit",
    label: "front-left orbit",
    cameraYawDeg: -45
  },
  {
    id: "front-right-orbit",
    label: "front-right orbit",
    cameraYawDeg: 45
  },
  {
    id: "rear-left-orbit",
    label: "rear-left orbit",
    cameraYawDeg: -155
  },
  {
    id: "rear-right-orbit",
    label: "rear-right orbit",
    cameraYawDeg: 155
  }
];

export function viewDefinitionForIndex(index) {
  return VIEW_DEFINITIONS[index] ?? {
    id: `orbit-${index + 1}`,
    label: `orbit ${index + 1}`,
    cameraYawDeg: 0
  };
}

export function yawDegForExistingRenderView(viewId) {
  switch (viewId) {
    case "northwest-oblique":
      return 315;
    case "northeast-oblique":
      return 45;
    case "southwest-oblique":
      return 225;
    default:
      return 0;
  }
}

export function buildSplatViewPrompt({
  assetLabel,
  assetRelativePath,
  viewIndex,
  viewCount,
  referenceKind,
  referenceLabel,
  consistencyAnchorLabel = null,
  supportingReferenceLabels = []
}) {
  const view = viewDefinitionForIndex(viewIndex);
  const viewPosition = `${viewIndex + 1} of ${viewCount}`;
  const anchorLine = consistencyAnchorLabel
    ? `Consistency anchor: also use the generated ${consistencyAnchorLabel} reference to keep architecture, props, materials, and lighting locked to the same physical room.`
    : "Consistency anchor: use the supplied concept reference as the authoritative source for room identity, layout, props, and lighting.";
  const supportLine = supportingReferenceLabels.length
    ? `Auxiliary overlap references: ${supportingReferenceLabels.map((label) => `"${label}"`).join(", ")}. Use them to stabilize layout, scene identity, and material continuity across views.`
    : "Auxiliary overlap references: none.";

  return [
    "Generate an image of one coherent playable room or zone for gaussian-splat scenery reconstruction.",
    `Primary request: create the ${view.label} capture for the room asset "${assetLabel}" as view ${viewPosition}.`,
    "Purpose: produce complicated, high-quality scenery with clean multi-view overlap for a believable splat-based 3D game space.",
    `Authoritative reference: ${referenceKind} "${referenceLabel}" from ${assetRelativePath}.`,
    anchorLine,
    supportLine,
    "Step 1: preserve the same physical room, architecture, terrain breaks, props, circulation, and mood from the references.",
    `Step 2: rotate the camera to the ${view.label} orbit around the same room center without changing the room identity.`,
    "Step 3: stage the image for reconstruction with strong foreground, midground, and background separation plus readable silhouettes and clean object overlap.",
    "Camera control: stable human eye height, cinematic wide-angle environment shot, straight horizon, no fisheye distortion, no dutch angle.",
    "Lighting/mood: preserve the source mood, use crisp directional lighting, clear contact shadows, and obvious depth cues.",
    "Color palette: inherit the source palette instead of introducing a new one.",
    "Materials/textures: keep floor, wall, trim, prop, foliage, and background surfaces coherent across the whole orbit set.",
    "Scenery density: favor intricate but coherent depth layers such as arches, stairs, railings, alcoves, beams, foreground props, hanging elements, background structures, and planted edges when supported by the room design.",
    "Spatial rule: do not redesign the room; resolve differences between references by preserving one plausible layout with matching landmarks and circulation paths.",
    'Text (verbatim): ""',
    "Constraints: change only the camera angle and the amount of visible room volume; keep the same physical place and avoid adding text, captions, overlays, watermarks, or UI.",
    "Avoid: extra scenes, new characters, floating labels, busy collage layouts, abstract painterly distortion, blocky simplification, and toy-like geometry."
  ].join("\n");
}

export function buildSplatReadmeLines({
  asset,
  viewCount,
  pointCount,
  sourceMode,
  model
}) {
  return [
    "# Gaussian Splat Asset",
    "",
    `- Source asset: \`${asset}\``,
    `- View count: ${viewCount}`,
    `- Point count: ${pointCount}`,
    `- Source mode: ${sourceMode}`,
    `- Image model: ${model}`,
    `- Profile: ${SPLAT_PROFILE.label}`
  ];
}

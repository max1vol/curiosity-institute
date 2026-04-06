export const SPLAT_PROFILE = {
  id: "nano-banana-gaussian-splat-multiview",
  label: "Nano Banana Gaussian Splat Multi-View",
  tricks: [
    "Generate a fresh room view from a different camera angle while preserving the same architecture, prop language, and lighting.",
    "Prefer a stable eye-level composition that can be unprojected into a 3D point cloud.",
    "Keep the frame free of text, UI, logos, borders, split screens, and collage layouts.",
    "Preserve strong depth separation between foreground objects, midground circulation, and distant walls.",
    "Use the reference image as the same physical room, not a reinterpretation of the scene.",
    "Keep geometry coherent across views so the three angle images overlap cleanly when reconstructed into splats."
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
  referenceLabel
}) {
  const view = viewDefinitionForIndex(viewIndex);
  const viewPosition = `${viewIndex + 1} of ${viewCount}`;

  return [
    "Use case: stylized-concept",
    "Asset type: gaussian splat source image",
    `Primary request: create a fresh ${view.label} image for the room asset "${assetLabel}".`,
    `Reference material: ${referenceKind} "${referenceLabel}" from ${assetRelativePath}.`,
    `Camera intent: keep the same room and rotate to the ${view.label} angle for view ${viewPosition}.`,
    "Scene/backdrop: preserve the original architecture, terrain breaks, props, pathways, and lighting while making the 3D volume obvious from this angle.",
    "Subject: one coherent playable room or zone, seen from a different orbit position around the same center.",
    "Style/medium: believable game environment concept art suitable for gaussian-splat reconstruction.",
    "Composition/framing: stable eye-level framing, clear horizon, no extreme tilt, no split screen.",
    "Lighting/mood: preserve the source mood and keep strong depth cues, readable silhouettes, and clean overlap with other angle views.",
    "Color palette: inherit the source palette instead of introducing a new one.",
    "Materials/textures: keep the same floor, wall, trim, and prop surfaces consistent across the full set.",
    'Text (verbatim): ""',
    "Constraints: change only the camera angle and the amount of visible room volume; keep the same physical place and avoid adding text, captions, overlays, watermarks, or UI.",
    "Avoid: extra scenes, new characters, floating labels, busy collage layouts, and abstract painterly distortion."
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

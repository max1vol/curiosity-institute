export const PHOTOSPHERE_PROFILE = {
  id: "nano-banana-photosphere",
  label: "Nano Banana Photosphere",
  tricks: [
    "Render a seamless 360-degree museum panorama derived from the reference image.",
    "Use a wide 4:1 panoramic composition that can be converted into a 2:1 photosphere for a sphere viewer.",
    "Keep the camera at human eye height from the center of the room or corridor.",
    "Wrap walls, floors, ceilings, exhibits, and doors continuously around the full scene.",
    "Match the left and right image edges so the panorama seam feels like the same physical space.",
    "Preserve the concept art's architecture, props, lighting, and material language.",
    "Preserve strong depth cues with foreground objects, midground circulation, distant walls, and coherent parallax.",
    "Avoid text overlays, split screens, black bars, visible seams, and collage layouts.",
    "Compose the image for an immersive first-person panorama viewer with mouse or touch look controls."
  ]
};

export function buildPhotospherePrompt({ assetName }) {
  return [
    `Create a seamless 360-degree museum photosphere panorama for "${assetName}".`,
    "Treat the reference image as authoritative for art direction, architecture, exhibits, and materials.",
    "Render a continuous equirectangular-style first-person environment from the middle of the space at human eye level.",
    "Output the scene as a very wide 4:1 panoramic strip suitable for conversion into a 2:1 photosphere viewer texture.",
    "The scene must wrap left-to-right with coherent walls, floor, ceiling, props, and circulation space.",
    "The left and right image edges must describe the same physical boundary so the seam is not noticeable in a sphere viewer.",
    "Emphasize real room volume with foreground, midground, and background depth so camera rotation feels spatial instead of flat.",
    "Make it suitable for a 3D sphere viewer: immersive, continuous, and free of broken seams.",
    "Do not include gameplay UI, arrows, HUD markers, player characters, callout icons, text, labels, black borders, split panels, or collage composition."
  ].join(" ");
}

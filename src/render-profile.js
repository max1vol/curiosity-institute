export const RAISED_RENDER_PROFILE = Object.freeze({
  id: "raised-oblique-map",
  label: "Raised Oblique Map",
  tricks: [
    "Use strong angled three-quarter aerial views instead of flat top-down framing.",
    "Use coherent cast shadows, contact shadows, and ambient occlusion to reveal height.",
    "Infer land-height structure through slopes, terraces, embankments, retaining walls, stairs, and grade changes.",
    "Turn flat buildings into explicit 3D building models with visible roofs, wall thickness, parapets, arches, and window recesses.",
  ],
  avoid: [
    "Do not leave the scene looking orthographic, flat, or poster-like.",
    "Do not keep roofs, paths, plazas, or terrain as a single unbroken flat plane.",
    "Do not add labels, UI, watermarks, or extra panels.",
  ],
});

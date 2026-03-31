export const DIRECTIONS = [
  {
    id: "northwest-oblique",
    label: "Northwest oblique",
    cameraInstruction:
      "Use an elevated three-quarter camera from the northwest, looking southeast, with a strong downward tilt and visible side faces on buildings and terrain.",
    shadowInstruction:
      "Light the scene from the west-southwest so roofs, stairs, and raised edges cast readable shadows across the ground plane.",
    terrainInstruction:
      "Show land-height changes as terraces, ramps, embankments, retaining walls, and stepped circulation descending toward the southeast.",
    buildingInstruction:
      "Model buildings as raised volumetric forms with visible roof planes, parapets, window recesses, and wall thickness from the northwest view.",
  },
  {
    id: "northeast-oblique",
    label: "Northeast oblique",
    cameraInstruction:
      "Use an elevated three-quarter camera from the northeast, looking southwest, with a strong downward tilt and visible side faces on buildings and terrain.",
    shadowInstruction:
      "Light the scene from the east-southeast so cast shadows stretch diagonally across paths, courtyards, roofs, and foliage.",
    terrainInstruction:
      "Show land-height changes as layered grades, stairs, cut slopes, raised plinths, and retaining edges stepping toward the southwest.",
    buildingInstruction:
      "Model buildings as raised volumetric forms with readable roof geometry, wall depth, arcade thickness, and recessed openings from the northeast view.",
  },
  {
    id: "southwest-oblique",
    label: "Southwest oblique",
    cameraInstruction:
      "Use an elevated three-quarter camera from the southwest, looking northeast, with a strong downward tilt and visible side faces on buildings and terrain.",
    shadowInstruction:
      "Light the scene from the south-southwest so elevated landforms, building masses, bridges, and trees project long directional shadows.",
    terrainInstruction:
      "Show land-height changes as lifted plazas, stair runs, berms, terraces, ramps, and contour breaks climbing toward the northeast.",
    buildingInstruction:
      "Model buildings as raised volumetric forms with pronounced rooflines, wall thickness, skylight depth, and extruded edges from the southwest view.",
  },
];

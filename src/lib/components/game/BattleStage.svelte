<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";

  import { WORLD } from "$lib/game/controller.svelte";
  import {
    buildGaussianSplatData,
    gaussianSplatObject,
    loadGaussianSplat,
    mapPointToWorld,
    worldPointToMap,
    WORLD_LAYOUT
  } from "$lib/game/gaussian-splats";
  import type { GaussianSplatPoint } from "$lib/game/gaussian-splats";
  import type { GameSession, ObjectivePill, RoomBlueprint, ThemeDefinition } from "$lib/game/types";

  interface Props {
    theme: ThemeDefinition | undefined;
    game: GameSession | null;
    rooms: RoomBlueprint[];
    objectiveText: string;
    objectivePills: ObjectivePill[];
    onRoomClick: (roomId: string) => void;
    onWorldTarget: (target: { x: number; y: number }) => void;
  }

  type RoomVisual = {
    id: string;
    baseAnchorY: number;
    beaconBaseY: number;
    beaconMaterial: THREE.MeshStandardMaterial;
    rimMaterial: THREE.MeshBasicMaterial;
    rim: THREE.Mesh;
    beacon: THREE.Mesh;
    marker: THREE.Mesh;
    anchor: THREE.Group;
    label: string;
    lastThemeKey: string;
    lastUnlocked: boolean | null;
    lastSelected: boolean | null;
    splatLoaded: boolean;
    splatLoading: boolean;
  };

  type SplatRenderOptions = {
    scale?: number;
    opacity?: number;
    sizeMultiplier?: number;
    pointScale?: number;
  };

  type TerrainInfluence = {
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    boost: number;
  };

  const TERRAIN_COLUMNS = 30;
  const TERRAIN_ROWS = 20;
  const TERRAIN_FIELD_COLUMNS = 41;
  const TERRAIN_FIELD_ROWS = 29;
  const TERRAIN_DECOR_ATTEMPTS = 240;
  const ROOM_SPLAT_RANGE = 320;
  const ROOM_SPLAT_PREFETCH_RANGE = 440;
  const CAMERA_DISTANCE_MIN = 44;
  const CAMERA_DISTANCE_MAX = 104;
  const CAMERA_DRAG_THRESHOLD = 8;
  const CAMERA_PITCH_MIN = 0.48;
  const CAMERA_PITCH_MAX = 1.16;
  const CAMERA_OFFSET = new THREE.Vector3(48, 46, 42);
  const CAMERA_DISTANCE_DEFAULT = CAMERA_OFFSET.length();
  const CAMERA_YAW_DEFAULT = Math.atan2(CAMERA_OFFSET.x, CAMERA_OFFSET.z);
  const CAMERA_PITCH_DEFAULT = Math.asin(CAMERA_OFFSET.y / CAMERA_DISTANCE_DEFAULT);
  const CURATOR_FALLBACK = new THREE.Vector3(-18, 7, 6);
  const CURATOR_FOCUS_OFFSET = new THREE.Vector3(0, 5.5, 0);
  const TERRAIN_POINT = new THREE.Vector3();
  const CURATOR_POINT = new THREE.Vector3();
  const CAMERA_POINT = new THREE.Vector3();
  const CAMERA_ORBIT = new THREE.Vector3();
  const CAMERA_LOOK_AHEAD = new THREE.Vector3();
  const TARGET_POINT = new THREE.Vector3();
  const PICK_POINT = new THREE.Vector3();
  const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  function blendHex(source: number, target: number, alpha: number): number {
    return new THREE.Color(source).lerp(new THREE.Color(target), alpha).getHex();
  }

  function shiftHex(source: number, hueShift: number, saturationShift: number, lightnessShift: number): number {
    const color = new THREE.Color(source);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    color.setHSL(
      (hsl.h + hueShift + 1) % 1,
      THREE.MathUtils.clamp(hsl.s + saturationShift, 0, 1),
      THREE.MathUtils.clamp(hsl.l + lightnessShift, 0, 1)
    );
    return color.getHex();
  }

  function hash01(seed: number): number {
    const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
    return value - Math.floor(value);
  }

  function addSplatPoint(
    points: GaussianSplatPoint[],
    x: number,
    y: number,
    z: number,
    color: THREE.Color,
    size: number,
    alpha: number
  ): void {
    points.push([x, y, z, color.r, color.g, color.b, size, alpha]);
  }

  function mountProceduralSplat(
    target: THREE.Object3D,
    asset: string,
    points: GaussianSplatPoint[],
    options: SplatRenderOptions,
    configure?: (object: THREE.Points) => void
  ): THREE.Points | null {
    if (!points.length) {
      return null;
    }

    const { object, dispose } = gaussianSplatObject(buildGaussianSplatData(asset, points), options);
    configure?.(object);
    target.add(object);
    stageSplatDisposers.push(dispose);
    return object;
  }

  let {
    theme,
    game,
    rooms,
    objectiveText,
    objectivePills,
    onRoomClick,
    onWorldTarget
  }: Props = $props();

  let host: HTMLDivElement | null = null;
  let stageReady = $state(false);
  let hoverLabel = $state("");
  let loadingSplats = $state(0);

  const roomVisuals = new Map<string, RoomVisual>();
  const splatDisposers = new Map<string, () => void>();
  const stageSplatDisposers: Array<() => void> = [];
  const visitorPool: THREE.Group[] = [];
  const coinPool: THREE.Mesh[] = [];
  const roomMarkers: THREE.Object3D[] = [];
  const terrainPickTargets: THREE.Object3D[] = [];
  const cameraTarget = new THREE.Vector3();
  let terrainInfluences: TerrainInfluence[] = [];
  let terrainField = new Float32Array();
  let terrainFieldSource: readonly RoomBlueprint[] | null = null;
  let stageWidth = 1;
  let stageHeight = 1;
  let lastFrameTime = 0;
  let pointerDirty = false;
  let themePaletteKey = "";
  let themeAccentHex = 0xf59b42;
  let themeHighlightHex = 0xf4edd6;
  let themeDeepHex = 0x173235;
  let cameraYaw = CAMERA_YAW_DEFAULT;
  let cameraPitch = CAMERA_PITCH_DEFAULT;
  let cameraDistance = CAMERA_DISTANCE_DEFAULT;
  let activePointerId: number | null = null;
  let pointerDown = false;
  let dragActive = false;
  let pointerStartX = 0;
  let pointerStartY = 0;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let maxPixelRatio = 1;
  let currentPixelRatio = 1;
  let frameTimeAccumulator = 0;
  let frameSamples = 0;
  let lastResolutionTuneAt = 0;
  let lastCuratorMapX = Number.NaN;
  let lastCuratorMapY = Number.NaN;
  let cameraLeadX = 0;
  let cameraLeadZ = 0;

  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let curatorGroup: THREE.Group | null = null;
  let targetMarker: THREE.Mesh | null = null;
  let targetGlow: THREE.Mesh | null = null;
  let raycaster: THREE.Raycaster | null = null;
  let skyMaterial: THREE.ShaderMaterial | null = null;
  let cloudBand: THREE.Group | null = null;
  let shardField: THREE.Group | null = null;
  let terrainSurfaceMaterial: THREE.MeshStandardMaterial | null = null;
  let terrainCliffMaterial: THREE.MeshStandardMaterial | null = null;
  let terrainGlowMaterial: THREE.MeshBasicMaterial | null = null;
  let foliageCanopyMaterial: THREE.MeshStandardMaterial | null = null;
  let foliageTrunkMaterial: THREE.MeshStandardMaterial | null = null;
  let crystalMaterial: THREE.MeshStandardMaterial | null = null;
  let waterSurface: THREE.Mesh | null = null;
  let waterGlow: THREE.Mesh | null = null;
  let waterRing: THREE.Mesh | null = null;
  let pointer = new THREE.Vector2();
  let animationFrame = 0;
  let disposed = false;

  function refreshThemeCache(): void {
    const accent = theme?.palette.accent ?? "#f59b42";
    const highlight = theme?.palette.highlight ?? "#f4edd6";
    const deep = theme?.palette.deep ?? "#173235";
    const nextKey = `${accent}|${highlight}|${deep}`;

    if (nextKey === themePaletteKey) {
      return;
    }

    themePaletteKey = nextKey;
    themeAccentHex = new THREE.Color(accent).getHex();
    themeHighlightHex = new THREE.Color(highlight).getHex();
    themeDeepHex = new THREE.Color(deep).getHex();

    const horizonHex = blendHex(themeDeepHex, themeHighlightHex, 0.5);
    const skyMidHex = blendHex(themeAccentHex, themeHighlightHex, 0.38);
    const skyTopHex = shiftHex(themeDeepHex, -0.04, 0.1, 0.24);

    if (scene?.fog) {
      scene.fog.color.setHex(horizonHex);
    }

    if (scene?.background instanceof THREE.Color) {
      scene.background.setHex(horizonHex);
    }

    if (terrainSurfaceMaterial) {
      terrainSurfaceMaterial.emissive.setHex(blendHex(themeDeepHex, themeAccentHex, 0.08));
    }

    if (terrainCliffMaterial) {
      terrainCliffMaterial.color.setHex(blendHex(themeDeepHex, 0x050708, 0.34));
      terrainCliffMaterial.emissive.setHex(blendHex(themeDeepHex, 0x000000, 0.22));
    }

    if (terrainGlowMaterial) {
      terrainGlowMaterial.color.setHex(blendHex(themeHighlightHex, themeAccentHex, 0.32));
    }

    if (skyMaterial) {
      (skyMaterial.uniforms.uTopColor.value as THREE.Color).setHex(skyTopHex);
      (skyMaterial.uniforms.uMidColor.value as THREE.Color).setHex(skyMidHex);
      (skyMaterial.uniforms.uHorizonColor.value as THREE.Color).setHex(horizonHex);
    }

    if (waterSurface) {
      const material = waterSurface.material as THREE.MeshStandardMaterial;
      material.color.setHex(blendHex(themeAccentHex, themeHighlightHex, 0.34));
      material.emissive.setHex(blendHex(themeDeepHex, themeHighlightHex, 0.14));
    }

    if (waterGlow) {
      (waterGlow.material as THREE.MeshBasicMaterial).color.setHex(blendHex(themeHighlightHex, 0xffffff, 0.24));
    }

    if (waterRing) {
      (waterRing.material as THREE.MeshBasicMaterial).color.setHex(blendHex(themeHighlightHex, themeAccentHex, 0.18));
    }

    if (cloudBand) {
      for (const child of cloudBand.children) {
        const material = (child as THREE.Mesh).material;
        if (material instanceof THREE.MeshStandardMaterial) {
          material.color.setHex(blendHex(themeHighlightHex, 0xffffff, 0.12));
          material.emissive.setHex(blendHex(themeAccentHex, themeHighlightHex, 0.28));
        }
      }
    }

    if (shardField) {
      for (const child of shardField.children) {
        const material = (child as THREE.Mesh).material;
        if (material instanceof THREE.MeshBasicMaterial) {
          material.color.setHex(blendHex(themeHighlightHex, 0xffffff, 0.3));
        }
      }
    }

    if (foliageCanopyMaterial) {
      foliageCanopyMaterial.color.setHex(blendHex(themeAccentHex, themeHighlightHex, 0.16));
      foliageCanopyMaterial.emissive.setHex(blendHex(themeAccentHex, themeHighlightHex, 0.12));
    }

    if (foliageTrunkMaterial) {
      foliageTrunkMaterial.color.setHex(blendHex(themeDeepHex, 0x2a1b14, 0.4));
    }

    if (crystalMaterial) {
      crystalMaterial.color.setHex(blendHex(themeHighlightHex, 0xffffff, 0.22));
      crystalMaterial.emissive.setHex(blendHex(themeAccentHex, themeHighlightHex, 0.26));
    }

    if (targetMarker) {
      (targetMarker.material as THREE.MeshBasicMaterial).color.setHex(themeHighlightHex);
    }

    if (targetGlow) {
      (targetGlow.material as THREE.MeshBasicMaterial).color.setHex(blendHex(themeHighlightHex, 0xffffff, 0.2));
    }
  }

  function refreshTerrainCache(): void {
    if (terrainFieldSource === rooms) {
      return;
    }

    terrainInfluences = rooms.map((room) => ({
      centerX: room.position.x + room.position.width / 2,
      centerY: room.position.y + room.position.height / 2,
      radiusX: 1 / Math.max(90, room.position.width),
      radiusY: 1 / Math.max(90, room.position.height),
      boost: 1.5 + room.diplomaRequirement * 0.42
    }));

    const field = new Float32Array(TERRAIN_FIELD_COLUMNS * TERRAIN_FIELD_ROWS);

    for (let gx = 0; gx < TERRAIN_FIELD_COLUMNS; gx += 1) {
      const mapX = (gx / (TERRAIN_FIELD_COLUMNS - 1)) * WORLD.width;
      for (let gy = 0; gy < TERRAIN_FIELD_ROWS; gy += 1) {
        const mapY = (gy / (TERRAIN_FIELD_ROWS - 1)) * WORLD.height;
        field[gy * TERRAIN_FIELD_COLUMNS + gx] = terrainBaseHeight(mapX, mapY);
      }
    }

    terrainField = field;
    terrainFieldSource = rooms;
  }

  function terrainBaseHeight(x: number, y: number): number {
    const nx = x / WORLD.width - 0.5;
    const ny = y / WORLD.height - 0.5;
    let height =
      2.4 +
      Math.sin(nx * 7.2) * 1.2 +
      Math.cos(ny * 6.1) * 0.9 +
      Math.sin((nx + ny) * 10.6) * 0.55;

    for (const influence of terrainInfluences) {
      const dx = (x - influence.centerX) * influence.radiusX;
      const dy = (y - influence.centerY) * influence.radiusY;
      const distance = Math.hypot(dx, dy);
      const falloff = Math.max(0, 1 - distance);
      height += falloff * influence.boost;
    }

    return Math.max(1.2, height);
  }

  function terrainHeight(x: number, y: number): number {
    if (!terrainField.length) {
      return terrainBaseHeight(x, y);
    }

    const fx = Math.min(TERRAIN_FIELD_COLUMNS - 1, Math.max(0, (x / WORLD.width) * (TERRAIN_FIELD_COLUMNS - 1)));
    const fy = Math.min(TERRAIN_FIELD_ROWS - 1, Math.max(0, (y / WORLD.height) * (TERRAIN_FIELD_ROWS - 1)));
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(TERRAIN_FIELD_COLUMNS - 1, x0 + 1);
    const y1 = Math.min(TERRAIN_FIELD_ROWS - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const topLeft = terrainField[y0 * TERRAIN_FIELD_COLUMNS + x0];
    const topRight = terrainField[y0 * TERRAIN_FIELD_COLUMNS + x1];
    const bottomLeft = terrainField[y1 * TERRAIN_FIELD_COLUMNS + x0];
    const bottomRight = terrainField[y1 * TERRAIN_FIELD_COLUMNS + x1];
    const top = topLeft + (topRight - topLeft) * tx;
    const bottom = bottomLeft + (bottomRight - bottomLeft) * tx;
    return top + (bottom - top) * ty;
  }

  function worldPositionForMapPoint(x: number, y: number, hover = 0, target?: THREE.Vector3): THREE.Vector3 {
    const elevation = terrainHeight(x, y) + hover;
    return target ? mapPointToWorld(x, y, elevation, target) : mapPointToWorld(x, y, elevation);
  }

  function roomCenter(room: RoomBlueprint): { x: number; y: number } {
    return {
      x: room.position.x + room.position.width / 2,
      y: room.position.y + room.position.height / 2
    };
  }

  function resetCameraRig(): void {
    cameraYaw = CAMERA_YAW_DEFAULT;
    cameraPitch = CAMERA_PITCH_DEFAULT;
    cameraDistance = CAMERA_DISTANCE_DEFAULT;
  }

  function distanceToNearestRoom(mapX: number, mapY: number): number {
    let nearest = Infinity;

    for (const room of rooms) {
      const center = roomCenter(room);
      const roomRadius = Math.max(room.position.width, room.position.height) * 0.58;
      nearest = Math.min(nearest, Math.hypot(center.x - mapX, center.y - mapY) - roomRadius);
    }

    return nearest;
  }

  function buildTerrainDecor(targetGroup: THREE.Group): void {
    const trunkPoints: GaussianSplatPoint[] = [];
    const canopyPoints: GaussianSplatPoint[] = [];
    const crystalPoints: GaussianSplatPoint[] = [];
    const world = new THREE.Vector3();
    const trunkColor = new THREE.Color(blendHex(themeDeepHex, 0x2a1b14, 0.4));
    const canopyColor = new THREE.Color(blendHex(themeAccentHex, themeHighlightHex, 0.16));
    const crystalColor = new THREE.Color(blendHex(themeHighlightHex, 0xffffff, 0.22));
    const tint = new THREE.Color();

    for (let attempt = 0; attempt < TERRAIN_DECOR_ATTEMPTS; attempt += 1) {
      const baseSeed = attempt + 1;
      const mapX = hash01(baseSeed * 1.73) * WORLD.width;
      const mapY = hash01(baseSeed * 2.37) * WORLD.height;
      const roomDistance = distanceToNearestRoom(mapX, mapY);
      const edgeDistance = Math.min(mapX, WORLD.width - mapX, mapY, WORLD.height - mapY);
      const height = terrainHeight(mapX, mapY);

      if (roomDistance < 72 || edgeDistance < 62 || height < 2.2 || height > 8.8) {
        continue;
      }

      worldPositionForMapPoint(mapX, mapY, 0, world);
      const style = hash01(baseSeed * 3.71);

      if (style < 0.72) {
        const trunkHeight = 2 + hash01(baseSeed * 4.13) * 2.4;
        const trunkWidth = 0.48 + hash01(baseSeed * 4.97) * 0.22;
        const trunkCount = 8 + Math.floor(hash01(baseSeed * 5.39) * 6);
        const canopyCount = 20 + Math.floor(hash01(baseSeed * 5.91) * 10);
        const canopyScale = 2.1 + hash01(baseSeed * 6.13) * 1.7;

        for (let index = 0; index < trunkCount; index += 1) {
          const t = index / Math.max(1, trunkCount - 1);
          const angle = hash01(baseSeed * 6.71 + index * 0.27) * Math.PI * 2;
          const radius = trunkWidth * (0.18 + hash01(baseSeed * 7.13 + index * 0.17) * 0.42);
          tint.copy(trunkColor);
          tint.offsetHSL(0, 0, hash01(baseSeed * 7.39 + index * 0.11) * 0.05 - 0.03);
          addSplatPoint(
            trunkPoints,
            world.x + Math.cos(angle) * radius,
            world.y + t * trunkHeight,
            world.z + Math.sin(angle) * radius,
            tint,
            7.2 + hash01(baseSeed * 7.83 + index * 0.09) * 2.8,
            0.86
          );
        }

        for (let index = 0; index < canopyCount; index += 1) {
          const orbit = hash01(baseSeed * 8.17 + index * 0.13) * Math.PI * 2;
          const shell = Math.pow(hash01(baseSeed * 8.53 + index * 0.19), 0.7);
          const radiusX = canopyScale * (0.42 + shell * 0.78);
          const radiusZ = canopyScale * (0.34 + shell * 0.68);
          const lift = trunkHeight + 0.7 + hash01(baseSeed * 8.91 + index * 0.23) * canopyScale * 1.2;
          tint.copy(canopyColor);
          tint.offsetHSL(
            hash01(baseSeed * 9.37 + index * 0.07) * 0.05 - 0.025,
            0.05,
            hash01(baseSeed * 9.83 + index * 0.11) * 0.12 - 0.04
          );
          addSplatPoint(
            canopyPoints,
            world.x + Math.cos(orbit) * radiusX,
            world.y + lift,
            world.z + Math.sin(orbit) * radiusZ,
            tint,
            9.5 + hash01(baseSeed * 10.19 + index * 0.17) * 4.6,
            0.8
          );
        }
      } else {
        const crystalHeight = 2 + hash01(baseSeed * 5.03) * 3.2;
        const crystalCount = 18 + Math.floor(hash01(baseSeed * 5.57) * 10);

        for (let index = 0; index < crystalCount; index += 1) {
          const heightT = Math.pow(index / Math.max(1, crystalCount - 1), 0.82);
          const angle = hash01(baseSeed * 6.03 + index * 0.21) * Math.PI * 2;
          const radius = (1 - heightT) * (0.48 + hash01(baseSeed * 6.61 + index * 0.11) * 0.52);
          tint.copy(crystalColor);
          tint.offsetHSL(
            hash01(baseSeed * 7.19 + index * 0.07) * 0.06 - 0.03,
            0.08,
            hash01(baseSeed * 7.91 + index * 0.13) * 0.14 - 0.04
          );
          addSplatPoint(
            crystalPoints,
            world.x + Math.cos(angle) * radius,
            world.y + 0.5 + heightT * crystalHeight,
            world.z + Math.sin(angle) * radius,
            tint,
            8.6 + hash01(baseSeed * 8.29 + index * 0.17) * 4.4,
            0.82
          );
        }
      }
    }

    mountProceduralSplat(targetGroup, "terrain-trunks", trunkPoints, {
      opacity: 0.94,
      sizeMultiplier: 1.1,
      pointScale: 246
    });
    mountProceduralSplat(targetGroup, "terrain-canopies", canopyPoints, {
      opacity: 0.86,
      sizeMultiplier: 1.22,
      pointScale: 258
    });
    mountProceduralSplat(targetGroup, "terrain-crystals", crystalPoints, {
      opacity: 0.92,
      sizeMultiplier: 1.28,
      pointScale: 266
    });
  }

  function buildTerrain(targetScene: THREE.Scene): void {
    refreshTerrainCache();
    const group = new THREE.Group();
    const capGeometry = new THREE.BoxGeometry(7.2, 0.8, 7.2);
    const capMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false
    });
    const blockCount = TERRAIN_COLUMNS * TERRAIN_ROWS;
    const capMesh = new THREE.InstancedMesh(capGeometry, capMaterial, blockCount);
    const placement = new THREE.Object3D();
    let index = 0;

    for (let gx = 0; gx < TERRAIN_COLUMNS; gx += 1) {
      for (let gy = 0; gy < TERRAIN_ROWS; gy += 1) {
        const mapX = (gx / (TERRAIN_COLUMNS - 1)) * WORLD.width;
        const mapY = (gy / (TERRAIN_ROWS - 1)) * WORLD.height;
        const height = terrainHeight(mapX, mapY);
        const world = mapPointToWorld(mapX, mapY, height / 2, TERRAIN_POINT);

        placement.position.set(world.x, height + 0.35, world.z);
        placement.scale.set(1, 1, 1);
        placement.updateMatrix();
        capMesh.setMatrixAt(index, placement.matrix);
        index += 1;
      }
    }

    capMesh.instanceMatrix.needsUpdate = true;
    capMesh.visible = false;
    terrainPickTargets.push(capMesh);

    const surfacePoints: GaussianSplatPoint[] = [];
    const ridgePoints: GaussianSplatPoint[] = [];
    const coastPoints: GaussianSplatPoint[] = [];
    const cliffPoints: GaussianSplatPoint[] = [];
    const waterPoints: GaussianSplatPoint[] = [];
    const foamPoints: GaussianSplatPoint[] = [];
    const world = new THREE.Vector3();
    const terrainColor = new THREE.Color();
    const plateauColor = new THREE.Color(blendHex(themeAccentHex, themeHighlightHex, 0.14));
    const coastalColor = new THREE.Color(blendHex(themeHighlightHex, themeDeepHex, 0.18));
    const deepColor = new THREE.Color(themeDeepHex);
    const waterColor = new THREE.Color(blendHex(themeAccentHex, themeHighlightHex, 0.34));
    const foamColor = new THREE.Color(blendHex(themeHighlightHex, 0xffffff, 0.34));
    const cliffColor = new THREE.Color(blendHex(themeDeepHex, 0x050708, 0.34));
    const landRadiusX = WORLD_LAYOUT.width * 0.53;
    const landRadiusZ = WORLD_LAYOUT.depth * 0.53;

    for (let gx = 0; gx < TERRAIN_FIELD_COLUMNS * 2; gx += 1) {
      const mapX = (gx / (TERRAIN_FIELD_COLUMNS * 2 - 1)) * WORLD.width;
      for (let gy = 0; gy < TERRAIN_FIELD_ROWS * 2; gy += 1) {
        const mapY = (gy / (TERRAIN_FIELD_ROWS * 2 - 1)) * WORLD.height;
        const height = terrainHeight(mapX, mapY);
        const slopeX = terrainHeight(Math.max(0, mapX - 10), mapY) - terrainHeight(Math.min(WORLD.width, mapX + 10), mapY);
        const slopeY = terrainHeight(mapX, Math.max(0, mapY - 10)) - terrainHeight(mapX, Math.min(WORLD.height, mapY + 10));
        const slope = THREE.MathUtils.clamp(Math.hypot(slopeX, slopeY) * 0.075, 0, 1);
        const edgeDistance = Math.min(mapX, WORLD.width - mapX, mapY, WORLD.height - mapY);
        const shoreBlend = THREE.MathUtils.clamp(edgeDistance / 144, 0, 1);
        const heightBlend = THREE.MathUtils.clamp((height - 1.6) / 8.6, 0, 1);
        const ripple = Math.sin(mapX * 0.017 + mapY * 0.013) * 0.5 + 0.5;

        mapPointToWorld(mapX, mapY, height, world);
        terrainColor.copy(deepColor);
        terrainColor.lerp(plateauColor, heightBlend * 0.82);
        terrainColor.lerp(coastalColor, (1 - shoreBlend) * 0.58);
        terrainColor.offsetHSL(0, 0.03 - slope * 0.04, ripple * 0.04 - slope * 0.08);
        addSplatPoint(
          surfacePoints,
          world.x,
          world.y - 0.14 + hash01((gx + 1) * 37 + (gy + 1) * 19) * 0.28,
          world.z,
          terrainColor,
          10.2 + heightBlend * 4.6 - slope * 1.8,
          0.94
        );

        if ((gx + gy) % 2 === 0) {
          addSplatPoint(
            surfacePoints,
            world.x + (hash01((gx + 3) * 53 + gy * 17) - 0.5) * 1.4,
            world.y - 0.8 + hash01((gx + 5) * 31 + gy * 43) * 0.22,
            world.z + (hash01((gx + 7) * 29 + gy * 47) - 0.5) * 1.4,
            terrainColor,
            8.4 + heightBlend * 3.2,
            0.54
          );
        }

        if (heightBlend > 0.44) {
          const ridgeTint = terrainColor.clone().lerp(new THREE.Color(themeHighlightHex), 0.18 + heightBlend * 0.22);
          addSplatPoint(
            ridgePoints,
            world.x,
            world.y + 0.48 + heightBlend * 0.66,
            world.z,
            ridgeTint,
            9 + heightBlend * 3.4,
            0.72
          );
        }

        if (shoreBlend < 0.42) {
          const coastTint = terrainColor.clone().lerp(foamColor, 0.16 + (1 - shoreBlend) * 0.2);
          addSplatPoint(
            coastPoints,
            world.x,
            world.y + 0.16,
            world.z,
            coastTint,
            10.8 + (1 - shoreBlend) * 4.2,
            0.6
          );
        }
      }
    }

    for (let pointIndex = 0; pointIndex < 320; pointIndex += 1) {
      const angle = (pointIndex / 320) * Math.PI * 2;
      for (let layer = 0; layer < 5; layer += 1) {
        const lift = -19 + layer * 4.8 + hash01(pointIndex * 7.13 + layer * 0.41) * 1.4;
        const radiusX = landRadiusX * (1.02 + layer * 0.04) + hash01(pointIndex * 5.31 + layer * 0.37) * 3.4;
        const radiusZ = landRadiusZ * (1.02 + layer * 0.05) + hash01(pointIndex * 6.27 + layer * 0.43) * 2.7;
        addSplatPoint(
          cliffPoints,
          Math.cos(angle) * radiusX,
          lift,
          Math.sin(angle) * radiusZ,
          cliffColor,
          10.4 + layer * 1.6,
          0.88
        );
      }
    }

    for (let ring = 0; ring < 5; ring += 1) {
      for (let pointIndex = 0; pointIndex < 260; pointIndex += 1) {
        const angle = (pointIndex / 260) * Math.PI * 2;
        const radiusScale = 1.02 + ring * 0.06 + hash01(ring * 101 + pointIndex * 0.41) * 0.04;
        const x = Math.cos(angle) * landRadiusX * radiusScale;
        const z = Math.sin(angle) * landRadiusZ * (1.08 + ring * 0.05);
        addSplatPoint(
          waterPoints,
          x,
          0.08 + Math.sin(angle * 2.1 + ring) * 0.12,
          z,
          waterColor,
          11.8 + ring * 1.3,
          0.58
        );

        if (ring <= 2) {
          addSplatPoint(
            foamPoints,
            x * 0.99,
            0.44 + Math.sin(angle * 3.2 + ring) * 0.12,
            z * 0.99,
            foamColor,
            10.4 + ring,
            0.32
          );
        }
      }
    }

    buildTerrainDecor(group);
    group.add(capMesh);
    mountProceduralSplat(group, "terrain-surface", surfacePoints, {
      opacity: 0.98,
      sizeMultiplier: 1.08,
      pointScale: 238
    });
    mountProceduralSplat(group, "terrain-ridges", ridgePoints, {
      opacity: 0.78,
      sizeMultiplier: 1.12,
      pointScale: 244
    });
    mountProceduralSplat(group, "terrain-coast", coastPoints, {
      opacity: 0.68,
      sizeMultiplier: 1.18,
      pointScale: 248
    });
    mountProceduralSplat(group, "terrain-cliffs", cliffPoints, {
      opacity: 0.92,
      sizeMultiplier: 1.24,
      pointScale: 252
    });
    mountProceduralSplat(group, "terrain-water", waterPoints, {
      opacity: 0.58,
      sizeMultiplier: 1.34,
      pointScale: 266
    });
    mountProceduralSplat(group, "terrain-foam", foamPoints, {
      opacity: 0.28,
      sizeMultiplier: 1.46,
      pointScale: 278
    });

    targetScene.add(group);
  }

  function buildAtmosphere(targetScene: THREE.Scene): void {
    const sunGroup = new THREE.Group();
    sunGroup.position.set(78, 62, -56);
    const sunCorePoints: GaussianSplatPoint[] = [];
    const sunHaloPoints: GaussianSplatPoint[] = [];
    const sunCoreColor = new THREE.Color(blendHex(themeHighlightHex, 0xffffff, 0.45));
    const sunHaloColor = new THREE.Color(blendHex(themeHighlightHex, themeAccentHex, 0.22));

    for (let index = 0; index < 64; index += 1) {
      const angle = hash01(index * 3.17) * Math.PI * 2;
      const radius = Math.pow(hash01(index * 5.11), 0.7) * 4.8;
      addSplatPoint(
        sunCorePoints,
        Math.cos(angle) * radius,
        (hash01(index * 7.19) - 0.5) * 3.8,
        Math.sin(angle) * radius,
        sunCoreColor,
        14 + hash01(index * 11.03) * 6,
        0.94
      );
    }

    for (let index = 0; index < 120; index += 1) {
      const angle = hash01(index * 2.73) * Math.PI * 2;
      const radius = 7 + hash01(index * 4.91) * 11;
      addSplatPoint(
        sunHaloPoints,
        Math.cos(angle) * radius,
        (hash01(index * 6.83) - 0.5) * 7.4,
        Math.sin(angle) * radius,
        sunHaloColor,
        18 + hash01(index * 8.71) * 8,
        0.24
      );
    }

    mountProceduralSplat(sunGroup, "atmos-sun-core", sunCorePoints, {
      opacity: 0.95,
      sizeMultiplier: 1.38,
      pointScale: 284
    });
    mountProceduralSplat(sunGroup, "atmos-sun-halo", sunHaloPoints, {
      opacity: 0.32,
      sizeMultiplier: 1.7,
      pointScale: 302
    });
    targetScene.add(sunGroup);

    cloudBand = new THREE.Group();
    const cloudPoints: GaussianSplatPoint[] = [];
    const mistPoints: GaussianSplatPoint[] = [];
    const cloudColor = new THREE.Color(blendHex(themeHighlightHex, 0xffffff, 0.12));
    const mistColor = new THREE.Color(blendHex(themeAccentHex, themeHighlightHex, 0.3));
    for (let index = 0; index < 420; index += 1) {
      const angle = hash01(index * 1.73) * Math.PI * 2;
      const band = index % 3;
      const radiusX = WORLD_LAYOUT.width * (0.42 + band * 0.08 + hash01(index * 2.17) * 0.06);
      const radiusZ = WORLD_LAYOUT.depth * (0.6 + band * 0.1 + hash01(index * 2.61) * 0.07);
      const y = 34 + band * 5 + hash01(index * 3.19) * 14;
      addSplatPoint(
        cloudPoints,
        Math.cos(angle) * radiusX,
        y,
        Math.sin(angle) * radiusZ,
        cloudColor,
        16 + hash01(index * 4.03) * 10,
        0.22
      );
      if (index % 2 === 0) {
        addSplatPoint(
          mistPoints,
          Math.cos(angle) * radiusX * 0.9,
          y - 6 + hash01(index * 4.37) * 4,
          Math.sin(angle) * radiusZ * 0.9,
          mistColor,
          18 + hash01(index * 4.79) * 12,
          0.12
        );
      }
    }
    mountProceduralSplat(cloudBand, "atmos-clouds", cloudPoints, {
      opacity: 0.3,
      sizeMultiplier: 1.55,
      pointScale: 278
    });
    mountProceduralSplat(cloudBand, "atmos-mist", mistPoints, {
      opacity: 0.18,
      sizeMultiplier: 1.84,
      pointScale: 290
    });
    targetScene.add(cloudBand);

    shardField = new THREE.Group();
    const shardPoints: GaussianSplatPoint[] = [];
    const emberPoints: GaussianSplatPoint[] = [];
    const shardColor = new THREE.Color(blendHex(themeHighlightHex, 0xffffff, 0.3));
    const emberColor = new THREE.Color(blendHex(themeAccentHex, themeHighlightHex, 0.22));
    for (let index = 0; index < 180; index += 1) {
      const angle = (index / 180) * Math.PI * 2;
      const radius = WORLD_LAYOUT.width * (0.34 + (index % 5) * 0.04);
      const lift = 14 + (index % 4) * 7 + hash01(index * 5.41) * 2.5;
      addSplatPoint(
        shardPoints,
        Math.sin(angle) * radius,
        lift,
        Math.cos(angle) * (WORLD_LAYOUT.depth * 0.58 + (index % 6) * 1.8),
        shardColor,
        7.8 + hash01(index * 6.17) * 3.8,
        0.3
      );
      if (index % 3 === 0) {
        addSplatPoint(
          emberPoints,
          Math.sin(angle) * radius * 0.92,
          lift - 2 + hash01(index * 6.83) * 2.5,
          Math.cos(angle) * WORLD_LAYOUT.depth * 0.52,
          emberColor,
          6.8 + hash01(index * 7.37) * 3.2,
          0.18
        );
      }
    }
    mountProceduralSplat(shardField, "atmos-shards", shardPoints, {
      opacity: 0.3,
      sizeMultiplier: 1.16,
      pointScale: 264
    });
    mountProceduralSplat(shardField, "atmos-embers", emberPoints, {
      opacity: 0.18,
      sizeMultiplier: 1.32,
      pointScale: 258
    });
    targetScene.add(shardField);
  }

  async function loadRoomSplat(room: RoomBlueprint, visual: RoomVisual): Promise<void> {
    if (!room.splatPath || disposed || visual.splatLoaded || visual.splatLoading) {
      return;
    }

    visual.splatLoading = true;
    loadingSplats += 1;

    try {
      const payload = await loadGaussianSplat(room.splatPath);
      if (disposed) {
        return;
      }

      const roomScale = Math.max(room.position.width / WORLD.width, room.position.height / WORLD.height);
      const { object, dispose } = gaussianSplatObject(payload, {
        scale: 0.28 + roomScale * 1.92,
        opacity: 0.92,
        sizeMultiplier: 1.26,
        pointScale: 232
      });

      object.position.y = 6.9 + room.diplomaRequirement * 0.82;
      object.rotation.y = room.diplomaRequirement * 0.4;
      visual.anchor.add(object);
      splatDisposers.set(room.id, dispose);
      visual.splatLoaded = true;
    } catch {
      // Keep the room playable even when its splat asset is missing.
    } finally {
      visual.splatLoading = false;
      loadingSplats = Math.max(0, loadingSplats - 1);
    }
  }

  function buildRoomVisuals(targetScene: THREE.Scene): void {
    refreshTerrainCache();
    const group = new THREE.Group();
    const rimGeometry = new THREE.TorusGeometry(1, 0.2, 10, 40);
    const markerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const markerMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false
    });

    for (const room of rooms) {
      const centerX = room.position.x + room.position.width / 2;
      const centerY = room.position.y + room.position.height / 2;
      const world = worldPositionForMapPoint(centerX, centerY, 0, TERRAIN_POINT);
      const width = (room.position.width / WORLD.width) * WORLD_LAYOUT.width;
      const depth = (room.position.height / WORLD.height) * WORLD_LAYOUT.depth;
      const towerHeight = 4.6 + room.diplomaRequirement * 1.1;
      const beaconMaterial = new THREE.MeshStandardMaterial({
        color: themeHighlightHex,
        emissive: themeHighlightHex,
        emissiveIntensity: 0.4,
        roughness: 0.24,
        metalness: 0.12
      });
      const rimMaterial = new THREE.MeshBasicMaterial({
        color: themeHighlightHex,
        transparent: true,
        opacity: 0.28
      });

      const rim = new THREE.Mesh(
        rimGeometry,
        rimMaterial
      );
      rim.scale.setScalar(Math.max(width, depth) * 0.48);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(world.x, world.y + 1.35, world.z);

      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(0.98, 0), beaconMaterial);
      beacon.position.set(world.x, world.y + towerHeight + 5.2, world.z);
      beacon.castShadow = true;

      const anchor = new THREE.Group();
      anchor.position.set(world.x, world.y + 1.25, world.z);
      const landmarkPoints: GaussianSplatPoint[] = [];
      const baseColor = new THREE.Color(blendHex(themeAccentHex, themeHighlightHex, 0.16));
      const crownColor = new THREE.Color(blendHex(themeHighlightHex, 0xffffff, 0.18));
      const deepColor = new THREE.Color(blendHex(themeDeepHex, themeAccentHex, 0.12));
      const tint = new THREE.Color();
      const radius = Math.max(width, depth) * 0.42;

      for (let pointIndex = 0; pointIndex < 88; pointIndex += 1) {
        const angle = hash01((pointIndex + 1) * 2.11 + room.diplomaRequirement * 7) * Math.PI * 2;
        const shell = Math.pow(hash01((pointIndex + 1) * 3.19 + room.position.x), 0.82);
        tint.copy(deepColor);
        tint.lerp(baseColor, 0.28 + shell * 0.36);
        addSplatPoint(
          landmarkPoints,
          Math.cos(angle) * radius * (0.42 + shell * 0.7),
          0.25 + hash01((pointIndex + 1) * 4.27) * 1.6,
          Math.sin(angle) * radius * (0.38 + shell * 0.64),
          tint,
          8.6 + hash01((pointIndex + 1) * 4.93) * 3.6,
          0.72
        );
      }

      for (let pointIndex = 0; pointIndex < 118; pointIndex += 1) {
        const t = pointIndex / 117;
        const angle = hash01((pointIndex + 1) * 5.13 + room.position.y) * Math.PI * 2;
        const spanX = THREE.MathUtils.lerp(width * 0.34, width * 0.1, t);
        const spanZ = THREE.MathUtils.lerp(depth * 0.34, depth * 0.1, t);
        tint.copy(baseColor);
        tint.lerp(crownColor, t * 0.42);
        tint.offsetHSL(hash01((pointIndex + 1) * 5.73) * 0.04 - 0.02, 0.04, hash01((pointIndex + 1) * 6.17) * 0.12 - 0.05);
        addSplatPoint(
          landmarkPoints,
          Math.cos(angle) * spanX,
          0.9 + t * towerHeight,
          Math.sin(angle) * spanZ,
          tint,
          9.2 + hash01((pointIndex + 1) * 6.71) * 4.6,
          0.8
        );
      }

      for (let pointIndex = 0; pointIndex < 36; pointIndex += 1) {
        const angle = (pointIndex / 36) * Math.PI * 2;
        addSplatPoint(
          landmarkPoints,
          Math.cos(angle) * radius * 0.96,
          0.44 + Math.sin(angle * 2.4) * 0.14,
          Math.sin(angle) * radius * 0.96,
          crownColor,
          7.8 + (pointIndex % 3) * 0.9,
          0.28
        );
      }

      mountProceduralSplat(anchor, `room-landmark-${room.id}`, landmarkPoints, {
        opacity: 0.88,
        sizeMultiplier: 1.2,
        pointScale: 254
      });

      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.scale.set(Math.max(width, depth) * 0.55, towerHeight + 3, Math.max(width, depth) * 0.55);
      marker.position.set(world.x, world.y + towerHeight * 0.5 + 2.2, world.z);
      marker.userData.roomId = room.id;

      const visual: RoomVisual = {
        id: room.id,
        baseAnchorY: anchor.position.y,
        beaconBaseY: beacon.position.y,
        beaconMaterial,
        rimMaterial,
        rim,
        beacon,
        marker,
        anchor,
        label: room.label,
        lastThemeKey: themePaletteKey,
        lastUnlocked: null,
        lastSelected: null,
        splatLoaded: false,
        splatLoading: false
      };
      roomVisuals.set(room.id, visual);
      roomMarkers.push(marker);

      group.add(rim, beacon, anchor, marker);
    }

    targetScene.add(group);
  }

  function createCurator(): THREE.Group {
    const root = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 4.4, 2.6),
      new THREE.MeshStandardMaterial({
        color: 0xf36842,
        emissive: 0x8f2d1e,
        emissiveIntensity: 0.16,
        roughness: 0.74,
        flatShading: true
      })
    );
    body.position.y = 3.1;
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 2, 2),
      new THREE.MeshStandardMaterial({
        color: 0xf4d9bf,
        emissive: 0x6b4d33,
        emissiveIntensity: 0.08,
        roughness: 0.84,
        flatShading: true
      })
    );
    head.position.y = 6.2;
    head.castShadow = true;
    head.receiveShadow = true;
    root.add(head);

    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.4, 1),
      new THREE.MeshStandardMaterial({
        color: 0x173235,
        emissive: 0x102527,
        emissiveIntensity: 0.16,
        roughness: 0.78,
        flatShading: true
      })
    );
    pack.position.set(0, 3.4, -1.5);
    pack.castShadow = true;
    pack.receiveShadow = true;
    root.add(pack);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.34, 0.2),
      new THREE.MeshBasicMaterial({
        color: 0xfff2b0,
        transparent: true,
        opacity: 0.86
      })
    );
    visor.position.set(0, 6.16, 1.08);
    root.add(visor);

    return root;
  }

  function createVisitor(color: number): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 3.5, 2.1),
      new THREE.MeshStandardMaterial({
        color,
        emissive: blendHex(color, 0xffffff, 0.08),
        emissiveIntensity: 0.12,
        roughness: 0.8,
        flatShading: true
      })
    );
    body.position.y = 2.4;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.5, 1.5),
      new THREE.MeshStandardMaterial({
        color: 0xf2ddc1,
        emissive: 0x654b35,
        emissiveIntensity: 0.06,
        roughness: 0.82,
        flatShading: true
      })
    );
    head.position.y = 4.8;
    head.castShadow = true;
    head.receiveShadow = true;
    group.add(head);
    return group;
  }

  function createCoin(): THREE.Mesh {
    const coin = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.2, 0),
      new THREE.MeshStandardMaterial({
        color: 0xffd55f,
        emissive: 0xf7b733,
        emissiveIntensity: 0.5,
        roughness: 0.28,
        metalness: 0.42,
        flatShading: true
      })
    );
    coin.castShadow = true;
    return coin;
  }

  function ensureVisitor(index: number, targetScene: THREE.Scene): THREE.Group {
    while (visitorPool.length <= index) {
      const mesh = createVisitor(0x4a89d0 + ((visitorPool.length % 4) * 0x111111));
      visitorPool.push(mesh);
      targetScene.add(mesh);
    }

    return visitorPool[index];
  }

  function ensureCoin(index: number, targetScene: THREE.Scene): THREE.Mesh {
    while (coinPool.length <= index) {
      const mesh = createCoin();
      coinPool.push(mesh);
      targetScene.add(mesh);
    }

    return coinPool[index];
  }

  function syncVisitors(targetScene: THREE.Scene, elapsed: number, delta: number): void {
    const blend = 1 - Math.exp(-delta * 7.5);
    const visitors = game?.visitors ?? [];

    for (let index = 0; index < visitors.length; index += 1) {
      const visitor = visitors[index];
      const mesh = ensureVisitor(index, targetScene);

      mesh.visible = true;
      worldPositionForMapPoint(visitor.x, visitor.y, 0.4, TERRAIN_POINT);
      mesh.position.lerp(TERRAIN_POINT, blend);
      mesh.rotation.y = elapsed * 0.6 + visitor.id.length * 0.17;
    }

    for (let index = visitors.length; index < visitorPool.length; index += 1) {
      visitorPool[index].visible = false;
    }
  }

  function syncCoins(targetScene: THREE.Scene, elapsed: number, delta: number): void {
    const blend = 1 - Math.exp(-delta * 8.4);
    const floorCoins = game?.floorCoins ?? [];

    for (let index = 0; index < floorCoins.length; index += 1) {
      const coin = floorCoins[index];
      const mesh = ensureCoin(index, targetScene);

      mesh.visible = true;
      worldPositionForMapPoint(coin.x, coin.y, 2.2 + Math.sin(elapsed * 4 + coin.value) * 0.7, TERRAIN_POINT);
      mesh.position.lerp(TERRAIN_POINT, blend);
      mesh.rotation.y += delta * 4.8;
      mesh.rotation.x = Math.sin(elapsed * 3 + coin.value) * 0.24;
    }

    for (let index = floorCoins.length; index < coinPool.length; index += 1) {
      coinPool[index].visible = false;
    }
  }

  function shouldLoadRoomSplat(room: RoomBlueprint): boolean {
    if (!game || !room.splatPath) {
      return false;
    }

    const selected = game.selectedRoomId === room.id;
    const unlocked = game.unlockedRoomIds.includes(room.id) || room.startUnlocked;
    if (!selected && !unlocked) {
      return false;
    }

    const center = roomCenter(room);
    const distanceToCurator = Math.hypot(center.x - game.curator.x, center.y - game.curator.y);
    const distanceToTarget = game.curator.target
      ? Math.hypot(center.x - game.curator.target.x, center.y - game.curator.target.y)
      : Infinity;

    return selected || distanceToCurator <= ROOM_SPLAT_RANGE || distanceToTarget <= ROOM_SPLAT_PREFETCH_RANGE;
  }

  function syncRoomSplats(): void {
    for (const room of rooms) {
      const visual = roomVisuals.get(room.id);
      if (!visual) {
        continue;
      }

      if (shouldLoadRoomSplat(room)) {
        void loadRoomSplat(room, visual);
      }

      visual.anchor.visible = true;
    }
  }

  function updateRoomMaterials(elapsed: number): void {
    for (const room of rooms) {
      const visual = roomVisuals.get(room.id);
      if (!visual) {
        continue;
      }

      const unlocked = game?.unlockedRoomIds.includes(room.id) ?? room.startUnlocked;
      const selected = game?.selectedRoomId === room.id;
      if (visual.lastThemeKey !== themePaletteKey || visual.lastUnlocked !== unlocked) {
        visual.beaconMaterial.color.setHex(unlocked ? themeHighlightHex : 0x6a7076);
        visual.beaconMaterial.emissive.setHex(unlocked ? themeHighlightHex : 0x24282d);
        visual.rimMaterial.color.setHex(themeHighlightHex);
        visual.lastThemeKey = themePaletteKey;
        visual.lastUnlocked = unlocked;
      }

      if (visual.lastSelected !== selected || visual.lastUnlocked !== unlocked) {
        visual.rimMaterial.opacity = selected ? 0.92 : unlocked ? 0.34 : 0.12;
        visual.lastSelected = selected;
      }

      visual.anchor.position.y = visual.baseAnchorY + (selected ? 0.28 : 0) + Math.sin(elapsed * 2.4 + room.diplomaRequirement) * 0.18;
      visual.anchor.scale.setScalar(selected ? 1.08 : unlocked ? 1 : 0.88);
      visual.rim.position.y = visual.baseAnchorY + 0.08 + Math.sin(elapsed * 2.4 + room.diplomaRequirement) * 0.18;
      visual.beacon.position.y = visual.beaconBaseY + Math.sin(elapsed * 3 + room.diplomaRequirement) * 0.42;
      visual.beacon.rotation.y = elapsed * 0.9 + room.diplomaRequirement * 0.2;
      visual.beaconMaterial.emissiveIntensity = selected ? 0.96 : unlocked ? 0.34 + Math.sin(elapsed * 2.6 + room.diplomaRequirement) * 0.08 : 0.05;
    }
  }

  function updateAtmosphere(elapsed: number): void {
    if (cloudBand) {
      cloudBand.rotation.y = elapsed * 0.028;
      cloudBand.position.y = Math.sin(elapsed * 0.24) * 2.4;
    }

    if (shardField) {
      shardField.rotation.y = -elapsed * 0.045;
      shardField.rotation.z = Math.sin(elapsed * 0.18) * 0.06;
    }

    if (terrainGlowMaterial) {
      terrainGlowMaterial.opacity = 0.1 + (Math.sin(elapsed * 0.9) + 1) * 0.025;
    }

    if (waterSurface) {
      waterSurface.position.y = 0.12 + Math.sin(elapsed * 0.82) * 0.05;
    }

    if (waterGlow) {
      waterGlow.position.y = 0.62 + Math.sin(elapsed * 1.1) * 0.04;
      (waterGlow.material as THREE.MeshBasicMaterial).opacity = 0.14 + (Math.sin(elapsed * 1.8) + 1) * 0.03;
    }

    if (waterRing) {
      waterRing.rotation.z = elapsed * 0.04;
      (waterRing.material as THREE.MeshBasicMaterial).opacity = 0.2 + Math.sin(elapsed * 1.3) * 0.03;
    }
  }

  function updateHoverLabel(): void {
    if (!camera || !raycaster) {
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(roomMarkers, false);
    const roomId = hits[0]?.object.userData.roomId;
    const nextLabel = roomId ? roomVisuals.get(String(roomId))?.label ?? "" : "";

    if (nextLabel !== hoverLabel) {
      hoverLabel = nextLabel;
    }

    pointerDirty = false;
  }

  function updatePointer(event: PointerEvent): void {
    if (!host || stageWidth <= 0 || stageHeight <= 0) {
      return;
    }

    const bounds = host.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;
    pointer.set((localX / stageWidth) * 2 - 1, -((localY / stageHeight) * 2 - 1));
    pointerDirty = true;
  }

  function pickWorld(): void {
    if (!camera || !raycaster) {
      return;
    }

    raycaster.setFromCamera(pointer, camera);
    const roomHits = raycaster.intersectObjects(roomMarkers, false);

    if (roomHits[0]?.object.userData.roomId) {
      onRoomClick(String(roomHits[0].object.userData.roomId));
      return;
    }

    const terrainHit = raycaster.intersectObjects(terrainPickTargets, false)[0];
    if (terrainHit?.point) {
      onWorldTarget(worldPointToMap(terrainHit.point));
      return;
    }

    if (raycaster.ray.intersectPlane(GROUND_PLANE, PICK_POINT)) {
      onWorldTarget(worldPointToMap(PICK_POINT));
    }
  }

  function tuneResolution(now: number, delta: number): void {
    if (!renderer || stageWidth <= 0 || stageHeight <= 0) {
      return;
    }

    frameTimeAccumulator += delta;
    frameSamples += 1;

    if (now - lastResolutionTuneAt < 900 || frameSamples < 20) {
      return;
    }

    const averageFrameTime = frameTimeAccumulator / frameSamples;
    let nextPixelRatio = currentPixelRatio;

    if (averageFrameTime > 1 / 42) {
      nextPixelRatio = Math.max(0.8, currentPixelRatio - 0.08);
    } else if (averageFrameTime < 1 / 57) {
      nextPixelRatio = Math.min(maxPixelRatio, currentPixelRatio + 0.05);
    }

    frameTimeAccumulator = 0;
    frameSamples = 0;
    lastResolutionTuneAt = now;

    if (Math.abs(nextPixelRatio - currentPixelRatio) < 0.02) {
      return;
    }

    currentPixelRatio = nextPixelRatio;
    renderer.setPixelRatio(currentPixelRatio);
    renderer.setSize(stageWidth, stageHeight, false);
  }

  function updateTargetMarker(elapsed: number): void {
    if (!targetMarker) {
      return;
    }

    const target = game?.curator.target;
    if (!target) {
      targetMarker.visible = false;
      if (targetGlow) {
        targetGlow.visible = false;
      }
      return;
    }

    worldPositionForMapPoint(target.x, target.y, 1.35 + Math.sin(elapsed * 5.2) * 0.18, TARGET_POINT);
    targetMarker.position.copy(TARGET_POINT);
    targetMarker.scale.setScalar(1 + Math.sin(elapsed * 6.4) * 0.08);
    targetMarker.visible = true;
    if (targetGlow) {
      targetGlow.position.set(TARGET_POINT.x, TARGET_POINT.y - 0.3, TARGET_POINT.z);
      targetGlow.scale.setScalar(1.08 + Math.sin(elapsed * 4.6) * 0.06);
      targetGlow.rotation.z = elapsed * 1.5;
      targetGlow.visible = true;
    }
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!host) {
      return;
    }

    activePointerId = event.pointerId;
    pointerDown = true;
    dragActive = false;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    host.setPointerCapture(event.pointerId);
    updatePointer(event);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!host || !camera || !raycaster) {
      return;
    }

    if (stageWidth <= 0 || stageHeight <= 0) {
      return;
    }

    updatePointer(event);

    if (!pointerDown || activePointerId !== event.pointerId) {
      return;
    }

    const travel = Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY);
    if (!dragActive && travel >= CAMERA_DRAG_THRESHOLD) {
      dragActive = true;
    }

    if (!dragActive) {
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      return;
    }

    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;
    cameraYaw -= deltaX * 0.0075;
    cameraPitch = Math.max(CAMERA_PITCH_MIN, Math.min(CAMERA_PITCH_MAX, cameraPitch - deltaY * 0.0055));
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!host || !camera || !raycaster || activePointerId !== event.pointerId) {
      return;
    }

    updatePointer(event);
    if (host.hasPointerCapture(event.pointerId)) {
      host.releasePointerCapture(event.pointerId);
    }

    if (!dragActive) {
      pickWorld();
    }

    activePointerId = null;
    pointerDown = false;
    dragActive = false;
  }

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    cameraDistance = Math.max(CAMERA_DISTANCE_MIN, Math.min(CAMERA_DISTANCE_MAX, cameraDistance + event.deltaY * 0.03));
  }

  onMount(() => {
    if (!host) {
      return;
    }

    disposed = false;
    stageReady = false;
    frameTimeAccumulator = 0;
    frameSamples = 0;
    lastResolutionTuneAt = 0;
    cameraLeadX = 0;
    cameraLeadZ = 0;
    lastCuratorMapX = Number.NaN;
    lastCuratorMapY = Number.NaN;
    resetCameraRig();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(blendHex(themeDeepHex, themeHighlightHex, 0.5));
    scene.fog = new THREE.Fog(blendHex(themeDeepHex, themeHighlightHex, 0.5), 88, 248);

    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 620);
    camera.position.set(52, 50, 48);
    camera.lookAt(0, 0, 0);
    cameraTarget.set(0, 0, 0);

    refreshThemeCache();
    refreshTerrainCache();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    currentPixelRatio = maxPixelRatio;
    renderer.setPixelRatio(currentPixelRatio);
    host.appendChild(renderer.domElement);
    raycaster = new THREE.Raycaster();

    scene.add(new THREE.AmbientLight(0xffffff, 0.82));

    const sun = new THREE.DirectionalLight(0xfff0cc, 2.1);
    sun.position.set(54, 72, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 12;
    sun.shadow.camera.far = 260;
    sun.shadow.camera.left = -160;
    sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160;
    sun.shadow.camera.bottom = -160;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.025;
    scene.add(sun);

    const skyLight = new THREE.HemisphereLight(0xd5f2ff, 0x274236, 1.24);
    scene.add(skyLight);

    const rimLight = new THREE.DirectionalLight(blendHex(themeHighlightHex, 0xffffff, 0.2), 0.62);
    rimLight.position.set(-34, 26, -48);
    scene.add(rimLight);

    const bounceLight = new THREE.PointLight(blendHex(themeAccentHex, themeHighlightHex, 0.16), 15, 280, 2.1);
    bounceLight.position.set(0, 22, 0);
    scene.add(bounceLight);

    buildAtmosphere(scene);
    buildTerrain(scene);
    buildRoomVisuals(scene);

    curatorGroup = createCurator();
    scene.add(curatorGroup);
    targetMarker = new THREE.Mesh(
      new THREE.TorusGeometry(1.7, 0.2, 8, 28),
      new THREE.MeshBasicMaterial({
        color: themeHighlightHex,
        transparent: true,
        opacity: 0.78
      })
    );
    targetMarker.rotation.x = Math.PI / 2;
    targetMarker.visible = false;
    scene.add(targetMarker);

    targetGlow = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 3.1, 36),
      new THREE.MeshBasicMaterial({
        color: blendHex(themeHighlightHex, 0xffffff, 0.2),
        transparent: true,
        opacity: 0.24
      })
    );
    targetGlow.rotation.x = -Math.PI / 2;
    targetGlow.visible = false;
    scene.add(targetGlow);

    function resize() {
      if (!host || !camera || !renderer) {
        return;
      }

      stageWidth = Math.max(host.clientWidth, 1);
      stageHeight = Math.max(host.clientHeight, 1);
      camera.aspect = stageWidth / stageHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(stageWidth, stageHeight, false);
    }

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(host);
    resize();

    const startedAt = performance.now();
    lastFrameTime = startedAt;

    const renderFrame = () => {
      if (!scene || !camera || !renderer || disposed) {
        return;
      }

      const now = performance.now();
      const delta = Math.min(0.05, (now - lastFrameTime) / 1000 || 0.016);
      lastFrameTime = now;
      const elapsed = (now - startedAt) / 1000;
      refreshThemeCache();
      refreshTerrainCache();
      updateRoomMaterials(elapsed);
      syncRoomSplats();
      updateAtmosphere(elapsed);

      if (curatorGroup) {
        const source = game?.curator;
        if (source) {
          worldPositionForMapPoint(source.x, source.y, 1.1, CURATOR_POINT);
          curatorGroup.position.lerp(CURATOR_POINT, 1 - Math.exp(-delta * 6.6));

          if (Number.isFinite(lastCuratorMapX) && Number.isFinite(lastCuratorMapY)) {
            const velocityX = (((source.x - lastCuratorMapX) / WORLD.width) * WORLD_LAYOUT.width) / Math.max(delta, 0.001);
            const velocityZ = (((source.y - lastCuratorMapY) / WORLD.height) * WORLD_LAYOUT.depth) / Math.max(delta, 0.001);
            const leadBlend = 1 - Math.exp(-delta * 5.6);
            cameraLeadX = THREE.MathUtils.lerp(cameraLeadX, velocityX * 0.12, leadBlend);
            cameraLeadZ = THREE.MathUtils.lerp(cameraLeadZ, velocityZ * 0.12, leadBlend);
          }

          lastCuratorMapX = source.x;
          lastCuratorMapY = source.y;
        } else {
          curatorGroup.position.lerp(CURATOR_FALLBACK, 1 - Math.exp(-delta * 5.4));
          cameraLeadX = THREE.MathUtils.lerp(cameraLeadX, 0, 1 - Math.exp(-delta * 4.2));
          cameraLeadZ = THREE.MathUtils.lerp(cameraLeadZ, 0, 1 - Math.exp(-delta * 4.2));
          lastCuratorMapX = Number.NaN;
          lastCuratorMapY = Number.NaN;
        }
        curatorGroup.position.y += Math.sin(elapsed * 6.4) * 0.12;

        const targetX = source?.target?.x ?? source?.x ?? 0;
        const targetY = source?.target?.y ?? source?.y ?? 0;
        const heading = Math.atan2(targetX - (source?.x ?? 0), targetY - (source?.y ?? 0));
        if (Number.isFinite(heading)) {
          curatorGroup.rotation.y = THREE.MathUtils.lerp(curatorGroup.rotation.y, heading, 1 - Math.exp(-delta * 9.5));
        }

        CAMERA_LOOK_AHEAD.set(
          Math.max(-7.5, Math.min(7.5, cameraLeadX)),
          0,
          Math.max(-6.4, Math.min(6.4, cameraLeadZ))
        );
        CURATOR_POINT.copy(curatorGroup.position).add(CURATOR_FOCUS_OFFSET).add(CAMERA_LOOK_AHEAD);
        cameraTarget.lerp(CURATOR_POINT, 1 - Math.exp(-delta * 7.2));
      }

      syncVisitors(scene, elapsed, delta);
      syncCoins(scene, elapsed, delta);
      updateTargetMarker(elapsed);

      if (pointerDirty) {
        updateHoverLabel();
      }

      CAMERA_ORBIT.set(
        Math.sin(cameraYaw) * Math.cos(cameraPitch) * cameraDistance,
        Math.sin(cameraPitch) * cameraDistance,
        Math.cos(cameraYaw) * Math.cos(cameraPitch) * cameraDistance
      );
      CAMERA_POINT.copy(cameraTarget).add(CAMERA_ORBIT);
      camera.position.lerp(CAMERA_POINT, 1 - Math.exp(-delta * 4.2));
      const dynamicFov = 48 + Math.min(6, Math.hypot(cameraLeadX, cameraLeadZ) * 0.34);
      if (Math.abs(camera.fov - dynamicFov) > 0.01) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, dynamicFov, 1 - Math.exp(-delta * 3.4));
        camera.updateProjectionMatrix();
      }
      camera.lookAt(cameraTarget);
      tuneResolution(now, delta);
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(renderFrame);
    };

    animationFrame = window.requestAnimationFrame(renderFrame);
    stageReady = true;

    return () => {
      disposed = true;
      stageReady = false;
      pointerDirty = false;
      pointerDown = false;
      dragActive = false;
      activePointerId = null;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      resizeObserver.disconnect();
      for (const dispose of splatDisposers.values()) {
        dispose();
      }
      splatDisposers.clear();
      while (stageSplatDisposers.length) {
        stageSplatDisposers.pop()?.();
      }
      roomVisuals.clear();
      roomMarkers.length = 0;
      terrainPickTargets.length = 0;
      visitorPool.length = 0;
      coinPool.length = 0;
      renderer?.dispose();
      renderer?.domElement.remove();
      scene = null;
      camera = null;
      renderer = null;
      curatorGroup = null;
      targetMarker = null;
      targetGlow = null;
      raycaster = null;
      skyMaterial = null;
      cloudBand = null;
      shardField = null;
      terrainSurfaceMaterial = null;
      terrainCliffMaterial = null;
      terrainGlowMaterial = null;
      foliageCanopyMaterial = null;
      foliageTrunkMaterial = null;
      crystalMaterial = null;
      waterSurface = null;
      waterGlow = null;
      waterRing = null;
    };
  });
</script>

<section class="battle-stage-card">
  <div
    bind:this={host}
    aria-label="Playable 3D battleground"
    class="battle-canvas"
    role="application"
    onpointerdown={handlePointerDown}
    onpointerleave={() => {
      pointerDirty = false;
      hoverLabel = "";
    }}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointercancel={handlePointerUp}
    onwheel={handleWheel}
  ></div>

  <div class="stage-overlay stage-overlay-top">
    <div class="stage-copy">
      <span class="stage-label">{theme?.label ?? "Battle Island"}</span>
      <strong>{hoverLabel || (game ? "Live Run" : "Loading World")}</strong>
      {#if loadingSplats}
        <small>{loadingSplats} splat cloud{loadingSplats === 1 ? "" : "s"} loading</small>
      {/if}
    </div>

    <button class="recenter-button" type="button" disabled={!stageReady} onclick={resetCameraRig}>Recenter</button>
  </div>

  <div class="stage-overlay stage-overlay-bottom">
    <p>{objectiveText}</p>
    <small class="control-hint">Click a zone once to select it, click it again to unlock or enter, click terrain to move, drag to orbit, and scroll to zoom.</small>
    <div class="stage-stats">
      {#each objectivePills as pill (pill.label)}
        <span>{pill.label}: {pill.value}</span>
      {/each}
    </div>
  </div>
</section>

<style>
  .battle-stage-card {
    position: relative;
    width: 100vw;
    height: 100vh;
    min-height: 100vh;
    overflow: hidden;
    background:
      radial-gradient(circle at 18% 14%, rgba(255, 241, 202, 0.22), transparent 22%),
      radial-gradient(circle at 84% 78%, rgba(104, 208, 227, 0.16), transparent 28%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(0, 0, 0, 0.24));
  }

  .battle-canvas {
    height: 100%;
    width: 100%;
    cursor: crosshair;
    touch-action: none;
  }

  .battle-canvas :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }

  .stage-overlay {
    position: absolute;
    pointer-events: none;
    color: #f6efd8;
    text-shadow: 0 2px 14px rgba(0, 0, 0, 0.65);
  }

  .stage-overlay-top {
    inset: 22px 22px auto 22px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .stage-overlay-bottom {
    inset: auto 22px 22px 22px;
    display: grid;
    gap: 8px;
    max-width: min(760px, calc(100vw - 44px));
  }

  .stage-copy,
  .recenter-button {
    pointer-events: auto;
  }

  .stage-copy {
    display: grid;
    gap: 2px;
  }

  .stage-label,
  .stage-copy small,
  .stage-stats span,
  .control-hint {
    font-size: 0.8rem;
    color: rgba(246, 239, 216, 0.76);
  }

  .stage-copy strong {
    font-size: 1.05rem;
    line-height: 1.2;
  }

  .recenter-button {
    border: 0;
    padding: 0;
    background: transparent;
    color: rgba(246, 239, 216, 0.92);
    font: inherit;
    font-size: 0.82rem;
    cursor: pointer;
  }

  .recenter-button:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .stage-overlay-bottom p {
    margin: 0;
    font-size: 1rem;
    line-height: 1.4;
    max-width: 52rem;
  }

  .stage-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .stage-stats span {
    color: rgba(246, 239, 216, 0.86);
  }

  @media (max-width: 720px) {
    .stage-overlay-top {
      inset: 16px 16px auto 16px;
      align-items: stretch;
      flex-direction: column;
    }

    .stage-overlay-bottom {
      inset: auto 16px 16px 16px;
      max-width: calc(100vw - 32px);
    }

    .stage-overlay-bottom p {
      font-size: 0.9rem;
    }
  }
</style>

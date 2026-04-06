<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";

  import { WORLD } from "$lib/game/controller.svelte";
  import { gaussianSplatObject, loadGaussianSplat, mapPointToWorld, worldPointToMap, WORLD_LAYOUT } from "$lib/game/gaussian-splats";
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
    material: THREE.MeshStandardMaterial;
    roofMaterial: THREE.MeshStandardMaterial;
    beaconMaterial: THREE.MeshStandardMaterial;
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

  type TerrainInfluence = {
    centerX: number;
    centerY: number;
    radiusX: number;
    radiusY: number;
    boost: number;
  };

  const TERRAIN_COLUMNS = 22;
  const TERRAIN_ROWS = 15;
  const TERRAIN_FIELD_COLUMNS = 33;
  const TERRAIN_FIELD_ROWS = 23;
  const TERRAIN_DECOR_ATTEMPTS = 180;
  const ROOM_SPLAT_RANGE = 240;
  const ROOM_SPLAT_PREFETCH_RANGE = 320;
  const CAMERA_DISTANCE_MIN = 30;
  const CAMERA_DISTANCE_MAX = 70;
  const CAMERA_DRAG_THRESHOLD = 8;
  const CAMERA_PITCH_MIN = 0.48;
  const CAMERA_PITCH_MAX = 1.16;
  const CAMERA_OFFSET = new THREE.Vector3(31, 31, 27);
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
    const trunkGeometry = new THREE.CylinderGeometry(0.5, 0.78, 3.8, 6);
    const canopyGeometry = new THREE.ConeGeometry(2.5, 5.6, 7);
    const crystalGeometry = new THREE.OctahedronGeometry(1.15, 0);

    foliageTrunkMaterial = new THREE.MeshStandardMaterial({
      color: blendHex(themeDeepHex, 0x2a1b14, 0.4),
      roughness: 0.96,
      metalness: 0.02,
      flatShading: true
    });
    foliageCanopyMaterial = new THREE.MeshStandardMaterial({
      color: blendHex(themeAccentHex, themeHighlightHex, 0.16),
      emissive: blendHex(themeAccentHex, themeHighlightHex, 0.12),
      emissiveIntensity: 0.12,
      roughness: 0.9,
      metalness: 0.02,
      flatShading: true,
      vertexColors: true
    });
    crystalMaterial = new THREE.MeshStandardMaterial({
      color: blendHex(themeHighlightHex, 0xffffff, 0.22),
      emissive: blendHex(themeAccentHex, themeHighlightHex, 0.26),
      emissiveIntensity: 0.28,
      roughness: 0.24,
      metalness: 0.34,
      flatShading: true,
      vertexColors: true
    });

    const trunkMesh = new THREE.InstancedMesh(trunkGeometry, foliageTrunkMaterial, TERRAIN_DECOR_ATTEMPTS);
    const canopyMesh = new THREE.InstancedMesh(canopyGeometry, foliageCanopyMaterial, TERRAIN_DECOR_ATTEMPTS);
    const crystalMesh = new THREE.InstancedMesh(crystalGeometry, crystalMaterial, TERRAIN_DECOR_ATTEMPTS);
    const placement = new THREE.Object3D();
    const tint = new THREE.Color();
    let trunkIndex = 0;
    let canopyIndex = 0;
    let crystalIndex = 0;

    for (let attempt = 0; attempt < TERRAIN_DECOR_ATTEMPTS; attempt += 1) {
      const baseSeed = attempt + 1;
      const mapX = hash01(baseSeed * 1.73) * WORLD.width;
      const mapY = hash01(baseSeed * 2.37) * WORLD.height;
      const roomDistance = distanceToNearestRoom(mapX, mapY);
      const edgeDistance = Math.min(mapX, WORLD.width - mapX, mapY, WORLD.height - mapY);
      const height = terrainHeight(mapX, mapY);

      if (roomDistance < 58 || edgeDistance < 48 || height < 2.2 || height > 8.4) {
        continue;
      }

      const world = worldPositionForMapPoint(mapX, mapY, 0, new THREE.Vector3());
      const style = hash01(baseSeed * 3.71);

      if (style < 0.72) {
        const trunkHeight = 2 + hash01(baseSeed * 4.13) * 2.4;
        const trunkWidth = 0.72 + hash01(baseSeed * 4.97) * 0.46;
        placement.position.set(world.x, world.y + trunkHeight * 0.5, world.z);
        placement.rotation.set(0, hash01(baseSeed * 5.39) * Math.PI * 2, 0);
        placement.scale.set(trunkWidth, trunkHeight / 3.8, trunkWidth);
        placement.updateMatrix();
        trunkMesh.setMatrixAt(trunkIndex, placement.matrix);

        const canopyScale = 0.74 + hash01(baseSeed * 6.13) * 0.62;
        placement.position.set(world.x, world.y + trunkHeight + canopyScale * 2.3, world.z);
        placement.rotation.set(0, hash01(baseSeed * 6.71) * Math.PI * 2, 0);
        placement.scale.set(canopyScale * 1.05, canopyScale * 1.12, canopyScale * 1.05);
        placement.updateMatrix();
        canopyMesh.setMatrixAt(canopyIndex, placement.matrix);

        tint.setHex(blendHex(themeAccentHex, themeHighlightHex, 0.12));
        tint.offsetHSL(hash01(baseSeed * 7.17) * 0.04 - 0.02, 0.05, hash01(baseSeed * 7.83) * 0.1 - 0.05);
        canopyMesh.setColorAt(canopyIndex, tint);

        trunkIndex += 1;
        canopyIndex += 1;
      } else {
        const crystalHeight = 0.8 + hash01(baseSeed * 5.03) * 1.7;
        placement.position.set(world.x, world.y + crystalHeight, world.z);
        placement.rotation.set(
          hash01(baseSeed * 5.57) * 0.28,
          hash01(baseSeed * 6.03) * Math.PI * 2,
          hash01(baseSeed * 6.61) * 0.24
        );
        placement.scale.set(
          0.76 + hash01(baseSeed * 7.19) * 0.34,
          crystalHeight * 1.8,
          0.76 + hash01(baseSeed * 7.91) * 0.34
        );
        placement.updateMatrix();
        crystalMesh.setMatrixAt(crystalIndex, placement.matrix);

        tint.setHex(blendHex(themeHighlightHex, 0xffffff, 0.22));
        tint.offsetHSL(hash01(baseSeed * 8.29) * 0.05 - 0.025, 0.08, hash01(baseSeed * 8.87) * 0.1 - 0.04);
        crystalMesh.setColorAt(crystalIndex, tint);
        crystalIndex += 1;
      }
    }

    trunkMesh.count = trunkIndex;
    canopyMesh.count = canopyIndex;
    crystalMesh.count = crystalIndex;
    trunkMesh.castShadow = true;
    canopyMesh.castShadow = true;
    canopyMesh.receiveShadow = true;
    crystalMesh.castShadow = true;
    crystalMesh.receiveShadow = true;
    trunkMesh.instanceMatrix.needsUpdate = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    crystalMesh.instanceMatrix.needsUpdate = true;
    if (canopyMesh.instanceColor) {
      canopyMesh.instanceColor.needsUpdate = true;
    }
    if (crystalMesh.instanceColor) {
      crystalMesh.instanceColor.needsUpdate = true;
    }

    targetGroup.add(trunkMesh, canopyMesh, crystalMesh);
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

    const surfaceGeometry = new THREE.PlaneGeometry(
      WORLD_LAYOUT.width * 1.08,
      WORLD_LAYOUT.depth * 1.08,
      TERRAIN_FIELD_COLUMNS * 2 - 2,
      TERRAIN_FIELD_ROWS * 2 - 2
    );
    surfaceGeometry.rotateX(-Math.PI / 2);
    const positions = surfaceGeometry.getAttribute("position");
    const colors = new Float32Array(positions.count * 3);
    const terrainColor = new THREE.Color();
    const plateauColor = new THREE.Color(blendHex(themeAccentHex, themeHighlightHex, 0.1));
    const coastalColor = new THREE.Color(blendHex(themeHighlightHex, themeDeepHex, 0.18));
    const deepColor = new THREE.Color(themeDeepHex);

    for (let vertex = 0; vertex < positions.count; vertex += 1) {
      const worldX = positions.getX(vertex);
      const worldZ = positions.getZ(vertex);
      const mapX = THREE.MathUtils.clamp(((worldX / WORLD_LAYOUT.width) + 0.5) * WORLD.width, 0, WORLD.width);
      const mapY = THREE.MathUtils.clamp(((worldZ / WORLD_LAYOUT.depth) + 0.5) * WORLD.height, 0, WORLD.height);
      const height = terrainHeight(mapX, mapY);
      const slopeX = terrainHeight(Math.max(0, mapX - 9), mapY) - terrainHeight(Math.min(WORLD.width, mapX + 9), mapY);
      const slopeY = terrainHeight(mapX, Math.max(0, mapY - 9)) - terrainHeight(mapX, Math.min(WORLD.height, mapY + 9));
      const slope = THREE.MathUtils.clamp(Math.hypot(slopeX, slopeY) * 0.08, 0, 1);
      const edgeDistance = Math.min(mapX, WORLD.width - mapX, mapY, WORLD.height - mapY);
      const shoreBlend = THREE.MathUtils.clamp(edgeDistance / 118, 0, 1);
      const heightBlend = THREE.MathUtils.clamp((height - 1.8) / 7.8, 0, 1);
      const ripple = Math.sin(mapX * 0.023 + mapY * 0.016) * 0.5 + 0.5;

      positions.setY(vertex, height);
      terrainColor.copy(deepColor);
      terrainColor.lerp(plateauColor, heightBlend * 0.72);
      terrainColor.lerp(coastalColor, (1 - shoreBlend) * 0.58);
      terrainColor.offsetHSL(0, 0.03 - slope * 0.05, ripple * 0.05 - slope * 0.08);
      colors[vertex * 3] = terrainColor.r;
      colors[vertex * 3 + 1] = terrainColor.g;
      colors[vertex * 3 + 2] = terrainColor.b;
    }

    surfaceGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    surfaceGeometry.computeVertexNormals();
    terrainSurfaceMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: blendHex(themeDeepHex, themeAccentHex, 0.08),
      emissiveIntensity: 0.1,
      roughness: 0.94,
      metalness: 0.04
    });
    const terrainSurface = new THREE.Mesh(surfaceGeometry, terrainSurfaceMaterial);
    terrainSurface.receiveShadow = true;

    terrainCliffMaterial = new THREE.MeshStandardMaterial({
      color: blendHex(themeDeepHex, 0x050708, 0.34),
      emissive: blendHex(themeDeepHex, 0x000000, 0.22),
      emissiveIntensity: 0.14,
      roughness: 0.96,
      metalness: 0.03,
      side: THREE.DoubleSide
    });
    const cliffWall = new THREE.Mesh(
      new THREE.CylinderGeometry(100, 118, 22, 72, 1, true),
      terrainCliffMaterial
    );
    cliffWall.position.y = -8.6;
    cliffWall.receiveShadow = true;

    const cliffBase = new THREE.Mesh(
      new THREE.CylinderGeometry(114, 118, 6.2, 72),
      terrainCliffMaterial
    );
    cliffBase.position.y = -17.4;
    cliffBase.receiveShadow = true;

    terrainGlowMaterial = new THREE.MeshBasicMaterial({
      color: blendHex(themeHighlightHex, themeAccentHex, 0.32),
      transparent: true,
      opacity: 0.12
    });
    const landAura = new THREE.Mesh(new THREE.RingGeometry(82, 114, 80), terrainGlowMaterial);
    landAura.rotation.x = -Math.PI / 2;
    landAura.position.y = 0.48;

    waterSurface = new THREE.Mesh(
      new THREE.CylinderGeometry(104, 104, 0.9, 72),
      new THREE.MeshStandardMaterial({
        color: blendHex(themeAccentHex, themeHighlightHex, 0.34),
        emissive: blendHex(themeDeepHex, themeHighlightHex, 0.14),
        emissiveIntensity: 0.34,
        roughness: 0.22,
        metalness: 0.16,
        transparent: true,
        opacity: 0.72
      })
    );
    waterSurface.position.set(0, 0.12, 0);
    waterSurface.receiveShadow = true;

    waterGlow = new THREE.Mesh(
      new THREE.CylinderGeometry(100, 102, 0.24, 72),
      new THREE.MeshBasicMaterial({
        color: blendHex(themeHighlightHex, 0xffffff, 0.24),
        transparent: true,
        opacity: 0.18
      })
    );
    waterGlow.position.set(0, 0.62, 0);

    waterRing = new THREE.Mesh(
      new THREE.TorusGeometry(100, 1.7, 12, 112),
      new THREE.MeshBasicMaterial({
        color: blendHex(themeHighlightHex, themeAccentHex, 0.18),
        transparent: true,
        opacity: 0.22
      })
    );
    waterRing.rotation.x = Math.PI / 2;
    waterRing.position.set(0, 0.86, 0);

    buildTerrainDecor(group);
    group.add(capMesh, terrainSurface, cliffWall, cliffBase, landAura, waterSurface, waterGlow, waterRing);

    targetScene.add(group);
  }

  function buildAtmosphere(targetScene: THREE.Scene): void {
    skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uTopColor: { value: new THREE.Color(shiftHex(themeDeepHex, -0.04, 0.1, 0.24)) },
        uMidColor: { value: new THREE.Color(blendHex(themeAccentHex, themeHighlightHex, 0.38)) },
        uHorizonColor: { value: new THREE.Color(blendHex(themeDeepHex, themeHighlightHex, 0.5)) }
      },
      vertexShader: `
        varying vec3 vWorldPosition;

        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uMidColor;
        uniform vec3 uHorizonColor;
        varying vec3 vWorldPosition;

        void main() {
          float height = normalize(vWorldPosition).y * 0.5 + 0.5;
          vec3 color = mix(uHorizonColor, uMidColor, smoothstep(0.0, 0.5, height));
          color = mix(color, uTopColor, smoothstep(0.42, 1.0, height));
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    skyMaterial.toneMapped = false;

    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(230, 32, 24), skyMaterial);
    skyDome.position.y = 28;
    targetScene.add(skyDome);

    const sunGroup = new THREE.Group();
    sunGroup.position.set(68, 58, -46);
    const sunCore = new THREE.Mesh(
      new THREE.SphereGeometry(7.4, 18, 18),
      new THREE.MeshBasicMaterial({
        color: blendHex(themeHighlightHex, 0xffffff, 0.45),
        transparent: true,
        opacity: 0.92
      })
    );
    const sunHalo = new THREE.Mesh(
      new THREE.SphereGeometry(14, 18, 18),
      new THREE.MeshBasicMaterial({
        color: blendHex(themeHighlightHex, themeAccentHex, 0.22),
        transparent: true,
        opacity: 0.16
      })
    );
    sunGroup.add(sunCore, sunHalo);
    targetScene.add(sunGroup);

    cloudBand = new THREE.Group();
    const cloudGeometry = new THREE.IcosahedronGeometry(3.2, 1);
    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: blendHex(themeHighlightHex, 0xffffff, 0.12),
      emissive: blendHex(themeAccentHex, themeHighlightHex, 0.28),
      emissiveIntensity: 0.25,
      roughness: 0.92,
      metalness: 0.02,
      transparent: true,
      opacity: 0.26
    });
    for (let index = 0; index < 15; index += 1) {
      const angle = (index / 15) * Math.PI * 2;
      const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
      const radius = 92 + (index % 4) * 7;
      const scale = 1.5 + (index % 3) * 0.34;
      cloud.position.set(Math.sin(angle) * radius, 44 + (index % 5) * 2.5, Math.cos(angle) * radius);
      cloud.scale.set(scale * 2.2, scale, scale * 1.4);
      cloud.rotation.set(index * 0.19, angle, index * 0.11);
      cloudBand.add(cloud);
    }
    targetScene.add(cloudBand);

    shardField = new THREE.Group();
    const shardGeometry = new THREE.OctahedronGeometry(1.2, 0);
    const shardMaterial = new THREE.MeshBasicMaterial({
      color: blendHex(themeHighlightHex, 0xffffff, 0.3),
      transparent: true,
      opacity: 0.26
    });
    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * Math.PI * 2;
      const shard = new THREE.Mesh(shardGeometry, shardMaterial);
      const radius = 72 + (index % 5) * 6;
      const lift = 18 + (index % 4) * 7;
      shard.position.set(Math.sin(angle) * radius, lift, Math.cos(angle) * radius);
      shard.scale.setScalar(0.7 + (index % 3) * 0.28);
      shard.rotation.set(index * 0.41, angle * 0.7, index * 0.17);
      shardField.add(shard);
    }
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
        scale: 0.24 + roomScale * 1.65,
        opacity: 0.9,
        sizeMultiplier: 1.18,
        pointScale: 224
      });

      object.position.y = 6.5 + room.diplomaRequirement * 0.75;
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
    const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    const rimGeometry = new THREE.TorusGeometry(1, 0.24, 10, 32);
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

      const material = new THREE.MeshStandardMaterial({
        color: themeAccentHex,
        emissive: blendHex(themeAccentHex, themeHighlightHex, 0.12),
        emissiveIntensity: 0.18,
        roughness: 0.82,
        metalness: 0.05,
        flatShading: true
      });
      const roofMaterial = new THREE.MeshStandardMaterial({
        color: themeHighlightHex,
        emissive: blendHex(themeHighlightHex, 0xffffff, 0.08),
        emissiveIntensity: 0.24,
        roughness: 0.72,
        metalness: 0.08,
        flatShading: true
      });
      const beaconMaterial = new THREE.MeshStandardMaterial({
        color: themeHighlightHex,
        emissive: themeHighlightHex,
        emissiveIntensity: 0.4,
        roughness: 0.24,
        metalness: 0.12
      });
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(Math.max(width, depth) * 0.48, Math.max(width, depth) * 0.56, 1, 8),
        new THREE.MeshStandardMaterial({
          color: blendHex(themeDeepHex, 0x000000, 0.18),
          roughness: 0.94,
          metalness: 0.02,
          flatShading: true
        })
      );
      pad.position.set(world.x, world.y + 0.5, world.z);
      pad.receiveShadow = true;

      const base = new THREE.Mesh(boxGeometry, material);
      base.scale.set(width, towerHeight, depth);
      base.position.copy(world);
      base.position.y += towerHeight / 2 + 0.8;
      base.castShadow = true;
      base.receiveShadow = true;

      const roof = new THREE.Mesh(boxGeometry, roofMaterial);
      roof.scale.set(width * 0.88, 1.3, depth * 0.88);
      roof.position.copy(base.position);
      roof.position.y += towerHeight / 2 + 0.9;
      roof.castShadow = true;
      roof.receiveShadow = true;

      const ramp = new THREE.Mesh(boxGeometry, roofMaterial);
      ramp.scale.set(width * 0.42, 2.2, depth * 0.34);
      ramp.position.set(base.position.x + width * 0.12, base.position.y - towerHeight * 0.2, base.position.z + depth * 0.14);
      ramp.rotation.x = -0.38;
      ramp.castShadow = true;
      ramp.receiveShadow = true;

      const rim = new THREE.Mesh(
        rimGeometry,
        new THREE.MeshBasicMaterial({
          color: themeHighlightHex,
          transparent: true,
          opacity: 0.28
        })
      );
      rim.scale.setScalar(Math.max(width, depth) * 0.44);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(world.x, world.y + 1.2, world.z);

      const beacon = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), beaconMaterial);
      beacon.position.copy(base.position);
      beacon.position.y += towerHeight / 2 + 2.2;
      beacon.castShadow = true;

      const anchor = new THREE.Group();
      anchor.position.set(world.x, world.y + 1.4, world.z);

      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.scale.set(Math.max(width, depth) * 0.55, towerHeight + 3, Math.max(width, depth) * 0.55);
      marker.position.copy(base.position);
      marker.userData.roomId = room.id;

      const visual: RoomVisual = {
        id: room.id,
        material,
        roofMaterial,
        beaconMaterial,
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

      group.add(pad, base, roof, ramp, rim, beacon, anchor, marker);
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

      const unlocked = game?.unlockedRoomIds.includes(room.id) ?? room.startUnlocked;
      visual.anchor.visible = unlocked && visual.splatLoaded;
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
        visual.material.color.setHex(unlocked ? themeAccentHex : 0x44505a);
        visual.roofMaterial.color.setHex(unlocked ? themeHighlightHex : 0x7a7c80);
        visual.material.emissive.setHex(unlocked ? blendHex(themeAccentHex, themeHighlightHex, 0.12) : 0x1c2024);
        visual.roofMaterial.emissive.setHex(unlocked ? blendHex(themeHighlightHex, 0xffffff, 0.08) : 0x222326);
        visual.beaconMaterial.color.setHex(unlocked ? themeHighlightHex : 0x6a7076);
        visual.beaconMaterial.emissive.setHex(unlocked ? themeHighlightHex : 0x24282d);
        (visual.rim.material as THREE.MeshBasicMaterial).color.setHex(themeHighlightHex);
        visual.lastThemeKey = themePaletteKey;
        visual.lastUnlocked = unlocked;
      }

      if (visual.lastSelected !== selected || visual.lastUnlocked !== unlocked) {
        (visual.rim.material as THREE.MeshBasicMaterial).opacity = selected ? 0.92 : unlocked ? 0.34 : 0.12;
        visual.lastSelected = selected;
      }

      visual.rim.position.y = 2 + Math.sin(elapsed * 2.4 + room.diplomaRequirement) * 0.18;
      visual.beacon.position.y =
        visual.anchor.position.y + 5.6 + room.diplomaRequirement * 1.1 + Math.sin(elapsed * 3 + room.diplomaRequirement) * 0.42;
      visual.beacon.rotation.y = elapsed * 0.9 + room.diplomaRequirement * 0.2;
      visual.beaconMaterial.emissiveIntensity = selected ? 0.96 : unlocked ? 0.34 + Math.sin(elapsed * 2.6 + room.diplomaRequirement) * 0.08 : 0.05;
      visual.roofMaterial.emissiveIntensity = selected ? 0.52 : unlocked ? 0.24 : 0.06;
      visual.material.emissiveIntensity = selected ? 0.3 : unlocked ? 0.18 : 0.04;
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
    scene.fog = new THREE.Fog(blendHex(themeDeepHex, themeHighlightHex, 0.5), 68, 170);

    camera = new THREE.PerspectiveCamera(52, 1, 0.1, 500);
    camera.position.set(34, 38, 34);
    camera.lookAt(0, 0, 0);
    cameraTarget.set(0, 0, 0);

    refreshThemeCache();
    refreshTerrainCache();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.35);
    currentPixelRatio = maxPixelRatio;
    renderer.setPixelRatio(currentPixelRatio);
    host.appendChild(renderer.domElement);
    raycaster = new THREE.Raycaster();

    scene.add(new THREE.AmbientLight(0xffffff, 0.76));

    const sun = new THREE.DirectionalLight(0xfff0cc, 1.8);
    sun.position.set(42, 58, 26);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.near = 12;
    sun.shadow.camera.far = 180;
    sun.shadow.camera.left = -110;
    sun.shadow.camera.right = 110;
    sun.shadow.camera.top = 110;
    sun.shadow.camera.bottom = -110;
    sun.shadow.bias = -0.00025;
    sun.shadow.normalBias = 0.025;
    scene.add(sun);

    const skyLight = new THREE.HemisphereLight(0xd5f2ff, 0x274236, 1.18);
    scene.add(skyLight);

    const rimLight = new THREE.DirectionalLight(blendHex(themeHighlightHex, 0xffffff, 0.2), 0.5);
    rimLight.position.set(-34, 26, -48);
    scene.add(rimLight);

    const bounceLight = new THREE.PointLight(blendHex(themeAccentHex, themeHighlightHex, 0.16), 12, 220, 2.2);
    bounceLight.position.set(0, 18, 0);
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
      const dynamicFov = 50 + Math.min(5, Math.hypot(cameraLeadX, cameraLeadZ) * 0.32);
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

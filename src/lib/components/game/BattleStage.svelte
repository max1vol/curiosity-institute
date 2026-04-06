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
    openHotline: () => void;
    openMiniGame: (miniGameId: "study-quiz" | "match-pairs" | "estimation" | "curator-check") => void;
  }

  type RoomVisual = {
    id: string;
    material: THREE.MeshStandardMaterial;
    roofMaterial: THREE.MeshStandardMaterial;
    rim: THREE.Mesh;
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

  let {
    theme,
    game,
    rooms,
    objectiveText,
    objectivePills,
    onRoomClick,
    onWorldTarget,
    openHotline,
    openMiniGame
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
  let raycaster: THREE.Raycaster | null = null;
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

    if (targetMarker) {
      (targetMarker.material as THREE.MeshBasicMaterial).color.setHex(themeHighlightHex);
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

  function buildTerrain(targetScene: THREE.Scene): void {
    refreshTerrainCache();
    const group = new THREE.Group();
    const blockGeometry = new THREE.BoxGeometry(7.4, 1, 7.4);
    const capGeometry = new THREE.BoxGeometry(7.2, 0.8, 7.2);
    const blockMaterial = new THREE.MeshStandardMaterial({
      color: themeDeepHex,
      roughness: 0.92,
      metalness: 0.04,
      flatShading: true
    });
    const capMaterial = new THREE.MeshStandardMaterial({
      color: themeHighlightHex,
      roughness: 0.88,
      metalness: 0.02,
      flatShading: true
    });
    const blockCount = TERRAIN_COLUMNS * TERRAIN_ROWS;
    const blockMesh = new THREE.InstancedMesh(blockGeometry, blockMaterial, blockCount);
    const capMesh = new THREE.InstancedMesh(capGeometry, capMaterial, blockCount);
    const placement = new THREE.Object3D();
    let index = 0;

    for (let gx = 0; gx < TERRAIN_COLUMNS; gx += 1) {
      for (let gy = 0; gy < TERRAIN_ROWS; gy += 1) {
        const mapX = (gx / (TERRAIN_COLUMNS - 1)) * WORLD.width;
        const mapY = (gy / (TERRAIN_ROWS - 1)) * WORLD.height;
        const height = terrainHeight(mapX, mapY);
        const world = mapPointToWorld(mapX, mapY, height / 2, TERRAIN_POINT);

        placement.position.copy(world);
        placement.scale.set(1, height, 1);
        placement.updateMatrix();
        blockMesh.setMatrixAt(index, placement.matrix);

        placement.position.set(world.x, height + 0.35, world.z);
        placement.scale.set(1, 1, 1);
        placement.updateMatrix();
        capMesh.setMatrixAt(index, placement.matrix);
        index += 1;
      }
    }

    blockMesh.instanceMatrix.needsUpdate = true;
    capMesh.instanceMatrix.needsUpdate = true;
    terrainPickTargets.push(capMesh);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(102, 102, 0.9, 48),
      new THREE.MeshStandardMaterial({
        color: 0x6acbe0,
        roughness: 0.28,
        metalness: 0.12,
        transparent: true,
        opacity: 0.6
      })
    );
    water.position.set(0, 0.1, 0);
    group.add(blockMesh, capMesh, water);

    targetScene.add(group);
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
        opacity: 0.86,
        sizeMultiplier: 1.08
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
        roughness: 0.82,
        metalness: 0.05,
        flatShading: true
      });
      const roofMaterial = new THREE.MeshStandardMaterial({
        color: themeHighlightHex,
        roughness: 0.76,
        metalness: 0.08,
        flatShading: true
      });
      const base = new THREE.Mesh(boxGeometry, material);
      base.scale.set(width, towerHeight, depth);
      base.position.copy(world);
      base.position.y += towerHeight / 2 + 0.8;

      const roof = new THREE.Mesh(boxGeometry, roofMaterial);
      roof.scale.set(width * 0.88, 1.3, depth * 0.88);
      roof.position.copy(base.position);
      roof.position.y += towerHeight / 2 + 0.9;

      const ramp = new THREE.Mesh(boxGeometry, roofMaterial);
      ramp.scale.set(width * 0.42, 2.2, depth * 0.34);
      ramp.position.set(base.position.x + width * 0.12, base.position.y - towerHeight * 0.2, base.position.z + depth * 0.14);
      ramp.rotation.x = -0.38;

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
        rim,
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

      group.add(base, roof, ramp, rim, anchor, marker);
    }

    targetScene.add(group);
  }

  function createCurator(): THREE.Group {
    const root = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 4.4, 2.6),
      new THREE.MeshStandardMaterial({ color: 0xf36842, roughness: 0.78, flatShading: true })
    );
    body.position.y = 3.1;
    root.add(body);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 2, 2),
      new THREE.MeshStandardMaterial({ color: 0xf4d9bf, roughness: 0.9, flatShading: true })
    );
    head.position.y = 6.2;
    root.add(head);

    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.4, 1),
      new THREE.MeshStandardMaterial({ color: 0x173235, roughness: 0.85, flatShading: true })
    );
    pack.position.set(0, 3.4, -1.5);
    root.add(pack);

    return root;
  }

  function createVisitor(color: number): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 3.5, 2.1),
      new THREE.MeshStandardMaterial({ color, roughness: 0.84, flatShading: true })
    );
    body.position.y = 2.4;
    group.add(body);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.5, 1.5),
      new THREE.MeshStandardMaterial({ color: 0xf2ddc1, roughness: 0.88, flatShading: true })
    );
    head.position.y = 4.8;
    group.add(head);
    return group;
  }

  function createCoin(): THREE.Mesh {
    return new THREE.Mesh(
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
        (visual.rim.material as THREE.MeshBasicMaterial).color.setHex(themeHighlightHex);
        visual.lastThemeKey = themePaletteKey;
        visual.lastUnlocked = unlocked;
      }

      if (visual.lastSelected !== selected || visual.lastUnlocked !== unlocked) {
        (visual.rim.material as THREE.MeshBasicMaterial).opacity = selected ? 0.92 : unlocked ? 0.34 : 0.12;
        visual.lastSelected = selected;
      }

      visual.rim.position.y = 2 + Math.sin(elapsed * 2.4 + room.diplomaRequirement) * 0.18;
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
      return;
    }

    worldPositionForMapPoint(target.x, target.y, 1.35 + Math.sin(elapsed * 5.2) * 0.18, TARGET_POINT);
    targetMarker.position.copy(TARGET_POINT);
    targetMarker.scale.setScalar(1 + Math.sin(elapsed * 6.4) * 0.08);
    targetMarker.visible = true;
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
    scene.background = new THREE.Color("#9fd7ef");
    scene.fog = new THREE.Fog("#9fd7ef", 58, 148);

    camera = new THREE.PerspectiveCamera(52, 1, 0.1, 500);
    camera.position.set(34, 38, 34);
    camera.lookAt(0, 0, 0);
    cameraTarget.set(0, 0, 0);

    refreshThemeCache();
    refreshTerrainCache();

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    maxPixelRatio = Math.min(window.devicePixelRatio || 1, 1.2);
    currentPixelRatio = maxPixelRatio;
    renderer.setPixelRatio(currentPixelRatio);
    host.appendChild(renderer.domElement);
    raycaster = new THREE.Raycaster();

    scene.add(new THREE.AmbientLight(0xffffff, 0.88));

    const sun = new THREE.DirectionalLight(0xfff0cc, 1.45);
    sun.position.set(28, 54, 18);
    scene.add(sun);

    const skyLight = new THREE.HemisphereLight(0xbde9ff, 0x36573d, 1.1);
    scene.add(skyLight);

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
      raycaster = null;
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

  <div class="stage-hud">
    <div class="hud-strip">
      <span>{theme?.label ?? "Battle Island"}</span>
      <strong>{hoverLabel || (game ? "Live" : "Preview")}</strong>
      {#if loadingSplats}
        <small>{loadingSplats} splat cloud{loadingSplats === 1 ? "" : "s"} loading</small>
      {/if}
    </div>

    <div class="stage-controls">
      <button class="ghost-button" type="button" disabled={!stageReady} onclick={resetCameraRig}>Recenter</button>
      <button class="ghost-button" type="button" disabled={!stageReady} onclick={() => openMiniGame("study-quiz")}>Quick Drill</button>
      <button class="primary-button" type="button" disabled={!stageReady} onclick={openHotline}>Study Drop</button>
    </div>
  </div>

  <div class="objective-ribbon">
    <p>{objectiveText}</p>
    <small class="control-hint">Click a zone to select it, click terrain to move, drag to orbit, and use the sidebar to unlock or enter sectors.</small>
    <div class="objective-pills">
      {#each objectivePills as pill (pill.label)}
        <span>{pill.label}: {pill.value}</span>
      {/each}
    </div>
  </div>
</section>

<style>
  .battle-stage-card {
    position: relative;
    min-height: 540px;
    border-radius: 28px;
    overflow: hidden;
    background:
      radial-gradient(circle at 16% 14%, rgba(255, 241, 202, 0.35), transparent 24%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(0, 0, 0, 0.08));
    border: 1px solid rgba(12, 28, 22, 0.2);
    box-shadow: 0 30px 70px rgba(8, 20, 16, 0.28);
  }

  .battle-canvas {
    min-height: 540px;
    width: 100%;
    cursor: crosshair;
    touch-action: none;
  }

  .battle-canvas :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }

  .stage-hud {
    position: absolute;
    inset: 18px 18px auto 18px;
    display: flex;
    justify-content: space-between;
    gap: 16px;
    pointer-events: none;
  }

  .hud-strip,
  .objective-ribbon,
  .stage-controls {
    pointer-events: auto;
  }

  .hud-strip {
    display: grid;
    gap: 2px;
    padding: 12px 16px;
    border-radius: 18px;
    background: rgba(10, 22, 18, 0.72);
    color: #f6efd8;
    backdrop-filter: blur(8px);
  }

  .hud-strip span,
  .hud-strip small {
    font-size: 0.8rem;
    color: rgba(246, 239, 216, 0.76);
  }

  .stage-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .objective-ribbon {
    position: absolute;
    inset: auto 18px 18px 18px;
    display: grid;
    gap: 10px;
    padding: 14px 16px;
    border-radius: 20px;
    background: rgba(10, 22, 18, 0.76);
    color: #f6efd8;
    backdrop-filter: blur(10px);
  }

  .objective-ribbon p {
    margin: 0;
    font-size: 0.94rem;
    line-height: 1.4;
  }

  .control-hint {
    color: rgba(246, 239, 216, 0.72);
    font-size: 0.78rem;
    line-height: 1.35;
  }

  .objective-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .objective-pills span {
    padding: 8px 10px;
    border-radius: 999px;
    background: rgba(246, 239, 216, 0.12);
    font-size: 0.8rem;
    color: rgba(246, 239, 216, 0.86);
  }

  @media (max-width: 720px) {
    .battle-stage-card,
    .battle-canvas {
      min-height: 460px;
    }

    .stage-hud {
      flex-direction: column;
      align-items: flex-start;
    }

    .stage-controls {
      width: 100%;
    }

    .stage-controls :global(button) {
      flex: 1 1 120px;
    }
  }
</style>

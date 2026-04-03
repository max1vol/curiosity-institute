<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";

  import type { PhotosphereEdge, PhotosphereNode, RoomBlueprint, ViewerMoveDirection } from "$lib/game/types";

  type GaussianSplatsModule = typeof import("@mkkellogg/gaussian-splats-3d");
  type ImmersiveRenderMode = "panorama" | "splat" | "none";

  interface Props {
    room: RoomBlueprint;
    node: PhotosphereNode;
    yaw: number;
    pitch: number;
    backEdge?: PhotosphereEdge;
    forwardEdge?: PhotosphereEdge;
    canMoveBack: boolean;
    canMoveForward: boolean;
    roomTierLabel: string;
    roomProgressText: string;
    roomTierIndex: number;
    roomTierMax: number;
    roomUpgradeCost: number | null;
    roomCanUpgrade: boolean;
    roomUpgradeLabel: string;
    close: () => void;
    move: (direction: ViewerMoveDirection) => void;
    setPose: (yaw: number, pitch: number) => void;
    upgradeRoom: () => void;
  }

  let {
    room,
    node,
    yaw,
    pitch,
    backEdge = undefined,
    forwardEdge = undefined,
    canMoveBack,
    canMoveForward,
    roomTierLabel,
    roomProgressText,
    roomTierIndex,
    roomTierMax,
    roomUpgradeCost,
    roomCanUpgrade,
    roomUpgradeLabel,
    close,
    move,
    setPose,
    upgradeRoom
  }: Props = $props();

  let stageElement: HTMLDivElement | null = null;
  let loadMessage = $state("Loading immersive scene...");
  let errorMessage = $state("");
  let fov = $state(72);
  let viewerReady = $state(false);
  let activeRenderMode = $state<ImmersiveRenderMode>("none");

  let pointerId: number | null = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let material: THREE.MeshBasicMaterial | null = null;
  let textureLoader: THREE.TextureLoader | null = null;
  let sphereGeometry: THREE.SphereGeometry | null = null;
  let splatViewer: import("@mkkellogg/gaussian-splats-3d").Viewer | null = null;
  let gaussianSplatsModulePromise: Promise<GaussianSplatsModule> | null = null;
  let loadGeneration = 0;
  let viewerDisposed = false;

  const textureCache = new Map<string, THREE.Texture>();
  const pendingTextureLoads = new Map<string, Promise<THREE.Texture>>();
  const panoramaTarget = new THREE.Vector3();
  const splatTarget = new THREE.Vector3();

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function tierSteps(maxTier: number): number[] {
    return Array.from({ length: maxTier + 1 }, (_, index) => index + 1);
  }

  function normalizeYaw(value: number): number {
    return ((value % 360) + 360) % 360;
  }

  function nudgeCamera(deltaYaw: number, deltaPitch: number): void {
    setPose(normalizeYaw(yaw + deltaYaw), clamp(pitch + deltaPitch, -80, 80));
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!stageElement) {
      return;
    }

    pointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    stageElement.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - lastPointerX;
    const deltaY = event.clientY - lastPointerY;

    nudgeCamera(-deltaX * 0.14, deltaY * 0.12);
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!stageElement || pointerId !== event.pointerId) {
      return;
    }

    stageElement.releasePointerCapture(event.pointerId);
    pointerId = null;
  }

  function handleWheel(event: WheelEvent): void {
    event.preventDefault();
    fov = clamp(fov + event.deltaY * 0.02, 48, 92);
  }

  async function loadGaussianSplatsModule(): Promise<GaussianSplatsModule> {
    gaussianSplatsModulePromise ??= import("@mkkellogg/gaussian-splats-3d");
    return gaussianSplatsModulePromise;
  }

  async function disposeSplatViewer(): Promise<void> {
    const viewer = splatViewer;
    splatViewer = null;

    if (!viewer) {
      return;
    }

    try {
      await viewer.dispose();
    } catch {
      // Ignore disposal failures from interrupted loads.
    }
  }

  function clearPanoramaMaterial(): void {
    if (!material) {
      return;
    }

    material.map = null;
    material.needsUpdate = true;
  }

  function loadTexture(imagePath: string): Promise<THREE.Texture> {
    if (!textureLoader) {
      return Promise.reject(new Error("Viewer is not ready yet."));
    }

    const cached = textureCache.get(imagePath);
    if (cached) {
      return Promise.resolve(cached);
    }

    const pending = pendingTextureLoads.get(imagePath);
    if (pending) {
      return pending;
    }

    const promise = textureLoader.loadAsync(imagePath)
      .then((texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        if (viewerDisposed) {
          texture.dispose();
          throw new Error("Viewer is no longer mounted.");
        }

        textureCache.set(imagePath, texture);
        return texture;
      })
      .finally(() => {
        pendingTextureLoads.delete(imagePath);
      });

    pendingTextureLoads.set(imagePath, promise);
    return promise;
  }

  async function showNodeTexture(imagePath: string, currentLoad: number): Promise<boolean> {
    if (!material) {
      return false;
    }

    loadMessage = "Loading immersive scene...";
    errorMessage = "";
    activeRenderMode = "panorama";
    clearPanoramaMaterial();

    try {
      const texture = await loadTexture(imagePath);

      if (currentLoad !== loadGeneration || !material) {
        return false;
      }

      material.map = texture;
      material.needsUpdate = true;
      loadMessage = "";
      return true;
    } catch {
      if (currentLoad !== loadGeneration) {
        return false;
      }

      loadMessage = "";
      errorMessage = "Unable to load this immersive scene.";
      activeRenderMode = "none";
      return false;
    }
  }

  async function showSplatScene(splatPath: string, currentLoad: number): Promise<boolean> {
    if (!renderer || !camera) {
      return false;
    }

    const GaussianSplats3D = await loadGaussianSplatsModule();

    if (currentLoad !== loadGeneration || viewerDisposed || !renderer || !camera) {
      return false;
    }

    const viewer = new GaussianSplats3D.Viewer({
      selfDrivenMode: false,
      renderer,
      camera,
      useBuiltInControls: false,
      ignoreDevicePixelRatio: false,
      gpuAcceleratedSort: false,
      sharedMemoryForWorkers: false,
      dynamicScene: false,
      renderMode: GaussianSplats3D.RenderMode.OnChange,
      antialiased: true,
    });

    splatViewer = viewer;

    try {
      await viewer.addSplatScene(splatPath, {
        showLoadingUI: false,
        progressiveLoad: true,
        splatAlphaRemovalThreshold: 5,
      });

      if (currentLoad !== loadGeneration || viewerDisposed || splatViewer !== viewer) {
        await viewer.dispose();
        if (splatViewer === viewer) {
          splatViewer = null;
        }
        return false;
      }

      clearPanoramaMaterial();
      activeRenderMode = "splat";
      loadMessage = "";
      errorMessage = "";
      return true;
    } catch {
      if (splatViewer === viewer) {
        splatViewer = null;
      }

      try {
        await viewer.dispose();
      } catch {
        // Ignore cleanup failures after a failed load.
      }

      return false;
    }
  }

  function preloadNeighborTextures(): void {
    for (const edge of node.edges) {
      if (!edge.imagePath) {
        continue;
      }

      void loadTexture(edge.imagePath).catch(() => {});
    }
  }

  function disposeTextures(): void {
    for (const texture of textureCache.values()) {
      texture.dispose();
    }

    textureCache.clear();
    pendingTextureLoads.clear();
  }

  async function showActiveNode(): Promise<void> {
    if (!viewerReady) {
      return;
    }

    const currentLoad = ++loadGeneration;
    const hasSplat = Boolean(node.splatPath);
    const hasPanorama = Boolean(node.imagePath);

    errorMessage = "";

    if (!hasSplat && !hasPanorama) {
      loadMessage = "";
      activeRenderMode = "none";
      clearPanoramaMaterial();
      await disposeSplatViewer();
      if (currentLoad === loadGeneration) {
        errorMessage = "This walkthrough node does not have a generated immersive scene yet.";
      }
      return;
    }

    loadMessage = "Loading immersive scene...";

    if (hasSplat && node.splatPath) {
      await disposeSplatViewer();

      if (currentLoad !== loadGeneration) {
        return;
      }

      if (await showSplatScene(node.splatPath, currentLoad)) {
        return;
      }
    }

    if (!hasPanorama || !node.imagePath) {
      if (currentLoad !== loadGeneration) {
        return;
      }

      loadMessage = "";
      activeRenderMode = "none";
      errorMessage = "Unable to load this immersive scene.";
      return;
    }

    await disposeSplatViewer();
    if (currentLoad !== loadGeneration) {
      return;
    }

    await showNodeTexture(node.imagePath, currentLoad);
    if (currentLoad === loadGeneration) {
      preloadNeighborTextures();
    }
  }

  onMount(() => {
    if (!stageElement) {
      return;
    }

    viewerDisposed = false;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 1100);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    stageElement.appendChild(renderer.domElement);

    sphereGeometry = new THREE.SphereGeometry(500, 80, 48);
    sphereGeometry.scale(-1, 1, 1);

    material = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#12211f")
    });
    textureLoader = new THREE.TextureLoader();

    const sphere = new THREE.Mesh(sphereGeometry, material);
    scene.add(sphere);

    let animationFrame = 0;
    let renderingActive = false;

    function stopRendering(): void {
      renderingActive = false;

      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    }

    function renderFrame(): void {
      if (viewerDisposed || !stageElement || !renderingActive || !camera || !renderer || !scene) {
        return;
      }

      camera.fov = fov;
      camera.updateProjectionMatrix();

      const phi = THREE.MathUtils.degToRad(90 - pitch);
      const theta = THREE.MathUtils.degToRad(yaw);

      if (activeRenderMode === "splat" && splatViewer) {
        const radius = 3.2;
        camera.position.set(
          radius * Math.sin(phi) * Math.sin(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.cos(theta)
        );
        camera.up.set(0, 1, 0);
        splatTarget.set(0, 0, 0);
        camera.lookAt(splatTarget);
        splatViewer.update();
        splatViewer.render();
      } else {
        camera.position.set(0, 0, 0);
        panoramaTarget.set(
          500 * Math.sin(phi) * Math.sin(theta),
          500 * Math.cos(phi),
          500 * Math.sin(phi) * Math.cos(theta)
        );
        camera.lookAt(panoramaTarget);
        renderer.render(scene, camera);
      }

      animationFrame = window.requestAnimationFrame(renderFrame);
    }

    function startRendering(): void {
      if (viewerDisposed || renderingActive || document.hidden) {
        return;
      }

      renderingActive = true;
      animationFrame = window.requestAnimationFrame(renderFrame);
    }

    function resizeRenderer(): void {
      if (!stageElement || !camera || !renderer) {
        return;
      }

      const width = Math.max(stageElement.clientWidth, 1);
      const height = Math.max(stageElement.clientHeight, 1);

      camera.aspect = width / height;
      camera.fov = fov;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    }

    const resizeObserver = new ResizeObserver(() => {
      resizeRenderer();
    });
    resizeObserver.observe(stageElement);

    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        stopRendering();
        return;
      }

      startRendering();
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();

      if (event.key === "Escape") {
        close();
        return;
      }

      if (event.key === "ArrowLeft" || key === "a") {
        event.preventDefault();
        nudgeCamera(-8, 0);
      }

      if (event.key === "ArrowRight" || key === "d") {
        event.preventDefault();
        nudgeCamera(8, 0);
      }

      if (event.key === "ArrowUp" || key === "w") {
        event.preventDefault();
        if (canMoveForward) {
          move("forward");
        }
      }

      if (event.key === "ArrowDown" || key === "s") {
        event.preventDefault();
        if (canMoveBack) {
          move("back");
        }
      }

      if ((key === "f" || event.key === "Enter") && canMoveForward) {
        event.preventDefault();
        move("forward");
      }

      if ((key === "b" || event.key === "Backspace") && canMoveBack) {
        event.preventDefault();
        move("back");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    resizeRenderer();
    viewerReady = true;
    startRendering();

    return () => {
      viewerDisposed = true;
      viewerReady = false;
      loadGeneration += 1;
      stopRendering();
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      resizeObserver.disconnect();
      void disposeSplatViewer();
      disposeTextures();
      material?.dispose();
      sphereGeometry?.dispose();
      renderer?.dispose();
      renderer?.domElement.remove();
      scene = null;
      camera = null;
      renderer = null;
      sphereGeometry = null;
      material = null;
      textureLoader = null;
    };
  });

  $effect(() => {
    if (!viewerReady || !material || !textureLoader) {
      return;
    }

    void showActiveNode();
  });
</script>

<div aria-label={`${room.label} walkthrough viewer`} aria-modal="true" class="viewer-root" role="dialog">
  <div class="viewer-shell">
    <div class="viewer-stage-wrap">
      <div
        bind:this={stageElement}
        aria-label={`${room.label} immersive scene`}
        class="viewer-stage"
        role="application"
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onpointerup={handlePointerUp}
        onpointercancel={handlePointerUp}
        onwheel={handleWheel}
      ></div>

      <section class="viewer-tier-panel" aria-label="Tier progression panel">
        <div class="viewer-tier-topline">
          <div>
            <p class="eyebrow">Tier Progression</p>
            <h2>{room.label}</h2>
          </div>
          <div class="viewer-tier-badge">{roomTierLabel}</div>
        </div>

        <p class="viewer-tier-copy">{roomProgressText}</p>

        <div class="viewer-tier-track" aria-label={`${room.label} tier progression`}>
          {#each tierSteps(roomTierMax) as tier}
            <div class:active={tier <= roomTierIndex + 1} class:current={tier === roomTierIndex + 1} class="viewer-tier-step">
              <span>Tier</span>
              <strong>{tier}</strong>
            </div>
          {/each}
        </div>

        <div class="viewer-tier-meta">
          <div class="viewer-tier-stat">
            <span>Current Node</span>
            <strong>{node.label}</strong>
          </div>
          <div class="viewer-tier-stat">
            <span>Connected Paths</span>
            <strong>{node.edges.length}</strong>
          </div>
          <div class="viewer-tier-stat">
            <span>Upgrade Cost</span>
            <strong>{roomUpgradeCost === null ? "Max tier" : `${roomUpgradeCost} coins`}</strong>
          </div>
        </div>

        <button class="primary-button viewer-upgrade-button" type="button" disabled={!roomCanUpgrade} onclick={upgradeRoom}>
          {roomUpgradeLabel}
        </button>
      </section>

      <button aria-label="Close walkthrough" class="viewer-close" type="button" onclick={close}>&times;</button>

      {#if loadMessage || errorMessage}
        <div class:viewer-status-error={!!errorMessage} class="viewer-status">
          {errorMessage || loadMessage}
        </div>
      {/if}

      <div class="viewer-hint">
        <span>Current Node</span>
        <strong>{node.label}</strong>
        <small class="viewer-subhint">Drag to explore, scroll to zoom, and use F/B or the travel buttons to move.</small>
      </div>

      <div class="viewer-travel" aria-label="Walkthrough travel controls">
        <button class="viewer-travel-button" type="button" disabled={!backEdge || !canMoveBack} onclick={() => move("back")}>
          <span>Back</span>
          <strong>{backEdge ? backEdge.label : "No previous room"}</strong>
        </button>
        <button
          class="viewer-travel-button primary"
          type="button"
          disabled={!forwardEdge || !canMoveForward}
          onclick={() => move("forward")}
        >
          <span>Forward</span>
          <strong>{forwardEdge ? forwardEdge.label : "No connected room ahead"}</strong>
        </button>
      </div>
    </div>
  </div>
</div>

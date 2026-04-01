<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";

  import type { PhotosphereEdge, PhotosphereNode, RoomBlueprint, ViewerMoveDirection } from "$lib/game/types";

  interface Props {
    room: RoomBlueprint;
    node: PhotosphereNode;
    yaw: number;
    pitch: number;
    backEdge?: PhotosphereEdge;
    forwardEdge?: PhotosphereEdge;
    canMoveBack: boolean;
    canMoveForward: boolean;
    close: () => void;
    move: (direction: ViewerMoveDirection) => void;
    setPose: (yaw: number, pitch: number) => void;
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
    close,
    move,
    setPose
  }: Props = $props();

  let stageElement: HTMLDivElement | null = null;
  let loadMessage = $state("Loading walkthrough node...");
  let errorMessage = $state("");
  let fov = $state(72);
  let viewerReady = $state(false);

  let pointerId: number | null = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  let material: THREE.MeshBasicMaterial | null = null;
  let textureLoader: THREE.TextureLoader | null = null;
  let loadGeneration = 0;

  const textureCache = new Map<string, Promise<THREE.Texture>>();

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
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

  function loadTexture(imagePath: string): Promise<THREE.Texture> {
    if (!textureLoader) {
      return Promise.reject(new Error("Viewer is not ready yet."));
    }

    const cached = textureCache.get(imagePath);
    if (cached) {
      return cached;
    }

    const promise = textureLoader.loadAsync(imagePath).then((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      return texture;
    });

    textureCache.set(imagePath, promise);
    return promise;
  }

  async function showNodeTexture(imagePath: string): Promise<void> {
    if (!material) {
      return;
    }

    const currentLoad = ++loadGeneration;
    loadMessage = "Loading walkthrough node...";
    errorMessage = "";

    try {
      const texture = await loadTexture(imagePath);

      if (currentLoad !== loadGeneration || !material) {
        return;
      }

      material.map = texture;
      material.needsUpdate = true;
      loadMessage = "";
    } catch {
      if (currentLoad !== loadGeneration) {
        return;
      }

      loadMessage = "";
      errorMessage = "Unable to load this walkthrough node.";
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
    for (const promise of textureCache.values()) {
      void promise.then((texture) => texture.dispose()).catch(() => {});
    }

    textureCache.clear();
  }

  onMount(() => {
    if (!stageElement) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(fov, 1, 1, 1100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    stageElement.appendChild(renderer.domElement);

    const geometry = new THREE.SphereGeometry(500, 80, 48);
    geometry.scale(-1, 1, 1);

    material = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#12211f")
    });
    textureLoader = new THREE.TextureLoader();

    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    const target = new THREE.Vector3();
    let animationFrame = 0;

    function resizeRenderer(): void {
      if (!stageElement) {
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

    function renderFrame(): void {
      camera.fov = fov;
      camera.updateProjectionMatrix();

      const phi = THREE.MathUtils.degToRad(90 - pitch);
      const theta = THREE.MathUtils.degToRad(yaw);

      target.set(
        500 * Math.sin(phi) * Math.sin(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.cos(theta)
      );

      camera.lookAt(target);
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(renderFrame);
    }

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
    resizeRenderer();
    renderFrame();
    viewerReady = true;

    return () => {
      viewerReady = false;
      loadGeneration += 1;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", handleKeyDown);
      resizeObserver.disconnect();
      disposeTextures();
      material?.dispose();
      geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      material = null;
      textureLoader = null;
    };
  });

  $effect(() => {
    if (!viewerReady || !material || !textureLoader) {
      return;
    }

    if (!node.imagePath) {
      loadMessage = "";
      errorMessage = "This walkthrough node does not have a generated photosphere yet.";
      return;
    }

    void showNodeTexture(node.imagePath);
    preloadNeighborTextures();
  });
</script>

<div aria-label={`${room.label} walkthrough viewer`} aria-modal="true" class="viewer-root" role="dialog">
  <div class="viewer-shell">
    <header class="viewer-toolbar">
      <div>
        <p class="eyebrow">Immersive Walkthrough</p>
        <h2>{room.label}</h2>
        <p class="viewer-copy">
          Drag or swipe to pivot the camera. Use <kbd>F</kbd> or the Forward button to move deeper into the connected map,
          <kbd>B</kbd> or Back to retrace your path, and the mouse wheel to zoom.
        </p>
      </div>

      <div class="viewer-toolbar-actions">
        {#if node.metadataPath}
          <a class="ghost-button viewer-link" href={node.metadataPath} target="_blank" rel="noreferrer">
            Open Metadata
          </a>
        {/if}
        <button class="primary-button" type="button" onclick={close}>Close Walkthrough</button>
      </div>
    </header>

    <div class="viewer-stage-wrap">
      <div
        bind:this={stageElement}
        aria-label={`${room.label} panorama`}
        class="viewer-stage"
        role="application"
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onpointerup={handlePointerUp}
        onpointercancel={handlePointerUp}
        onwheel={handleWheel}
      ></div>

      {#if loadMessage || errorMessage}
        <div class:viewer-status-error={!!errorMessage} class="viewer-status">
          {errorMessage || loadMessage}
        </div>
      {/if}

      <div class="viewer-hint">
        <span>Current Node</span>
        <strong>{node.label}</strong>
        <small class="viewer-subhint">
          {node.sourcePath ? "Nano Banana panorama from repo concept art" : "Awaiting generated panorama"}
        </small>
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

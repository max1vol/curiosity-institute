<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";

  import { gaussianSplatObject, loadGaussianSplat } from "$lib/game/gaussian-splats";
  import type { ImmersiveEdge, ImmersiveNode, RoomBlueprint, ViewerMoveDirection } from "$lib/game/types";

  interface Props {
    room: RoomBlueprint;
    node: ImmersiveNode;
    yaw: number;
    pitch: number;
    backEdge?: ImmersiveEdge;
    forwardEdge?: ImmersiveEdge;
    canMoveBack: boolean;
    canMoveForward: boolean;
    roomTierLabel: string;
    roomProgressText: string;
    roomTierIndex: number;
    roomTierMax: number;
    roomUpgradeCost: number | null;
    roomCanUpgrade: boolean;
    roomUpgradeLabel: string;
    sceneReady: (roomId: string) => void;
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
    sceneReady,
    close,
    move,
    setPose,
    upgradeRoom
  }: Props = $props();

  let host: HTMLDivElement | null = null;
  let loadMessage = $state("Loading gaussian splat zone...");
  let errorMessage = $state("");
  let viewerReady = $state(false);

  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let pivot: THREE.Group | null = null;
  let cloudRoot: THREE.Group | null = null;
  let animationFrame = 0;
  let currentDispose: (() => void) | null = null;
  let loadGeneration = 0;
  let disposed = false;
  let renderQueued = false;

  let pointerId: number | null = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeYaw(value: number): number {
    return ((value % 360) + 360) % 360;
  }

  function tierSteps(maxTier: number): number[] {
    return Array.from({ length: maxTier + 1 }, (_, index) => index + 1);
  }

  function vectorFromTuple(tuple: [number, number, number] | undefined, fallback: THREE.Vector3): THREE.Vector3 {
    if (!tuple) {
      return fallback.clone();
    }

    return new THREE.Vector3(tuple[0], tuple[1], tuple[2]);
  }

  function cameraRadius(): number {
    return node.splatCameraRadius ?? room.splatCameraRadius ?? 34;
  }

  function focusPoint(): THREE.Vector3 {
    return vectorFromTuple(node.splatLookAt ?? room.splatLookAt, new THREE.Vector3(0, 2.5, 0));
  }

  function updateCamera(): void {
    if (!camera) {
      return;
    }

    const radius = cameraRadius();
    const phi = THREE.MathUtils.degToRad(90 - pitch);
    const theta = THREE.MathUtils.degToRad(yaw + (node.splatHeadingOffsetDeg ?? room.splatHeadingOffsetDeg ?? 0));
    const focus = focusPoint();

    camera.position.set(
      focus.x + radius * Math.sin(phi) * Math.sin(theta),
      focus.y + radius * Math.cos(phi),
      focus.z + radius * Math.sin(phi) * Math.cos(theta)
    );
    camera.lookAt(focus);
  }

  function renderScene(): void {
    if (!scene || !camera || !renderer || disposed) {
      return;
    }

    updateCamera();
    renderer.render(scene, camera);
  }

  function requestRender(): void {
    if (!viewerReady || !scene || !camera || !renderer || disposed || renderQueued) {
      return;
    }

    renderQueued = true;
    animationFrame = window.requestAnimationFrame(() => {
      animationFrame = 0;
      renderQueued = false;
      renderScene();
    });
  }

  function nudgeCamera(deltaYaw: number, deltaPitch: number): void {
    setPose(normalizeYaw(yaw + deltaYaw), clamp(pitch + deltaPitch, -72, 78));
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!host) {
      return;
    }

    pointerId = event.pointerId;
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    host.setPointerCapture(event.pointerId);
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
    if (!host || pointerId !== event.pointerId) {
      return;
    }

    host.releasePointerCapture(event.pointerId);
    pointerId = null;
  }

  function buildArena(targetScene: THREE.Scene): void {
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(34, 38, 2.2, 32),
      new THREE.MeshStandardMaterial({
        color: 0x173235,
        roughness: 0.92,
        metalness: 0.05
      })
    );
    floor.position.y = -1.2;
    targetScene.add(floor);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(30, 30, 0.8, 32),
      new THREE.MeshStandardMaterial({
        color: 0xf4edd6,
        roughness: 0.88,
        metalness: 0.02
      })
    );
    cap.position.y = 0.3;
    targetScene.add(cap);

    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(2.8, 10 + (index % 3) * 1.8, 2.8),
        new THREE.MeshStandardMaterial({
          color: index % 2 === 0 ? 0xf59b42 : 0x48677a,
          roughness: 0.82,
          metalness: 0.08,
          flatShading: true
        })
      );
      pillar.position.set(Math.sin(angle) * 26, 4.5, Math.cos(angle) * 26);
      targetScene.add(pillar);
    }
  }

  async function loadCloud(): Promise<void> {
    if (!scene || !viewerReady) {
      return;
    }

    const activeLoad = ++loadGeneration;
    loadMessage = "Loading gaussian splat zone...";
    errorMessage = "";

    currentDispose?.();
    currentDispose = null;
    if (cloudRoot && scene) {
      scene.remove(cloudRoot);
    }
    cloudRoot = null;

    const splatPath = node.splatPath ?? room.splatPath;
    if (!splatPath) {
      loadMessage = "";
      errorMessage = "This zone does not have a gaussian splat asset yet.";
      requestRender();
      return;
    }

    try {
      const payload = await loadGaussianSplat(splatPath);
      if (disposed || activeLoad !== loadGeneration || !scene) {
        return;
      }

      const { object, dispose } = gaussianSplatObject(payload, {
        scale: 0.95,
        opacity: 0.92,
        sizeMultiplier: 1.16
      });

      cloudRoot = new THREE.Group();
      cloudRoot.add(object);
      scene.add(cloudRoot);
      currentDispose = dispose;
      loadMessage = "";
      sceneReady(node.roomId);
      requestRender();
    } catch {
      if (activeLoad !== loadGeneration) {
        return;
      }

      loadMessage = "";
      errorMessage = "Unable to load this gaussian splat zone.";
      requestRender();
    }
  }

  onMount(() => {
    if (!host) {
      return;
    }

    disposed = false;
    viewerReady = false;

    scene = new THREE.Scene();
    scene.background = new THREE.Color("#091512");
    scene.fog = new THREE.Fog("#091512", 48, 116);

    camera = new THREE.PerspectiveCamera(52, 1, 0.1, 240);
    updateCamera();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.68));
    const sun = new THREE.DirectionalLight(0xfff0d2, 1.4);
    sun.position.set(18, 32, 12);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0xa7e8ff, 0x13392b, 0.85));

    pivot = new THREE.Group();
    scene.add(pivot);
    buildArena(scene);

    function resize() {
      if (!host || !camera || !renderer) {
        return;
      }

      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      requestRender();
    }

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(host);
    resize();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        requestRender();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (event.key === "Escape") {
        close();
        return;
      }

      if (event.key === "ArrowLeft" || key === "a") {
        event.preventDefault();
        nudgeCamera(-7, 0);
      }

      if (event.key === "ArrowRight" || key === "d") {
        event.preventDefault();
        nudgeCamera(7, 0);
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        nudgeCamera(0, -5);
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        nudgeCamera(0, 5);
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
    viewerReady = true;
    requestRender();
    void loadCloud();

    return () => {
      disposed = true;
      viewerReady = false;
      loadGeneration += 1;
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      resizeObserver.disconnect();
      currentDispose?.();
      renderer?.dispose();
      renderer?.domElement.remove();
      scene = null;
      camera = null;
      renderer = null;
      pivot = null;
      cloudRoot = null;
    };
  });

  $effect(() => {
    const activeNodeId = node.id;

    if (!viewerReady || !activeNodeId) {
      return;
    }

    void loadCloud();
  });

  $effect(() => {
    yaw;
    pitch;

    if (!viewerReady) {
      return;
    }

    requestRender();
  });
</script>

<div aria-label={`${room.label} gaussian splat viewer`} aria-modal="true" class="viewer-root" role="dialog">
  <div class="viewer-shell">
    <div class="viewer-stage-wrap">
      <div
        bind:this={host}
        aria-label={`${room.label} splat zone`}
        class="viewer-stage"
        role="application"
        onpointerdown={handlePointerDown}
        onpointermove={handlePointerMove}
        onpointerup={handlePointerUp}
        onpointercancel={handlePointerUp}
      ></div>

      <section class="viewer-tier-panel" aria-label="Zone progression panel">
        <div class="viewer-tier-topline">
          <div>
            <p class="eyebrow">Gaussian Splat Zone</p>
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
            <span>Zone</span>
            <strong>{node.label}</strong>
          </div>
          <div class="viewer-tier-stat">
            <span>Routes</span>
            <strong>{node.edges.length}</strong>
          </div>
          <div class="viewer-tier-stat">
            <span>Upgrade</span>
            <strong>{roomUpgradeCost === null ? "Max" : `${roomUpgradeCost} resources`}</strong>
          </div>
        </div>

        <button class="primary-button viewer-upgrade-button" type="button" disabled={!roomCanUpgrade} onclick={upgradeRoom}>
          {roomUpgradeLabel}
        </button>
      </section>

      <button aria-label="Close gaussian splat scene" class="viewer-close" type="button" onclick={close}>&times;</button>

      {#if loadMessage || errorMessage}
        <div class:viewer-status-error={!!errorMessage} class="viewer-status">
          {errorMessage || loadMessage}
        </div>
      {/if}

      <div class="viewer-hint">
        <span>Current Zone</span>
        <strong>{node.label}</strong>
        <small class="viewer-subhint">Drag to orbit. Use F/B or the route buttons to jump between connected splat zones.</small>
      </div>

      <div class="viewer-travel" aria-label="Splat viewer travel controls">
        <button class="viewer-travel-button" type="button" disabled={!backEdge || !canMoveBack} onclick={() => move("back")}>
          <span>Back</span>
          <strong>{backEdge ? backEdge.label : "No previous zone"}</strong>
        </button>
        <button
          class="viewer-travel-button primary"
          type="button"
          disabled={!forwardEdge || !canMoveForward}
          onclick={() => move("forward")}
        >
          <span>Forward</span>
          <strong>{forwardEdge ? forwardEdge.label : "No linked zone ahead"}</strong>
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .viewer-root {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: grid;
    place-items: center;
    padding: 20px;
    background: rgba(3, 10, 8, 0.76);
    backdrop-filter: blur(10px);
  }

  .viewer-shell {
    width: min(1320px, 100%);
  }

  .viewer-stage-wrap {
    position: relative;
    min-height: 78vh;
    overflow: hidden;
    border-radius: 28px;
    border: 1px solid rgba(244, 237, 214, 0.18);
    background: rgba(4, 12, 10, 0.96);
    box-shadow: 0 34px 80px rgba(0, 0, 0, 0.42);
  }

  .viewer-stage {
    min-height: 78vh;
  }

  .viewer-stage :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }

  .viewer-tier-panel,
  .viewer-hint,
  .viewer-status,
  .viewer-travel {
    position: absolute;
    backdrop-filter: blur(10px);
  }

  .viewer-tier-panel {
    top: 18px;
    left: 18px;
    display: grid;
    gap: 14px;
    width: min(360px, calc(100% - 36px));
    padding: 18px;
    border-radius: 22px;
    background: rgba(10, 20, 17, 0.78);
    color: #f6efd8;
  }

  .viewer-tier-topline {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .viewer-tier-topline h2 {
    margin: 0;
  }

  .viewer-tier-badge {
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(245, 155, 66, 0.2);
    color: #ffd7a1;
    font-weight: 700;
    font-size: 0.85rem;
  }

  .viewer-tier-copy {
    margin: 0;
    color: rgba(246, 239, 216, 0.78);
    line-height: 1.45;
  }

  .viewer-tier-track {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }

  .viewer-tier-step {
    display: grid;
    gap: 2px;
    padding: 10px;
    border-radius: 14px;
    background: rgba(246, 239, 216, 0.08);
    color: rgba(246, 239, 216, 0.72);
  }

  .viewer-tier-step.active {
    background: rgba(245, 155, 66, 0.18);
    color: #fff0cf;
  }

  .viewer-tier-step.current {
    box-shadow: 0 0 0 1px rgba(245, 155, 66, 0.42) inset;
  }

  .viewer-tier-step span,
  .viewer-tier-stat span,
  .viewer-hint span {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(246, 239, 216, 0.58);
  }

  .viewer-tier-meta {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }

  .viewer-tier-stat {
    display: grid;
    gap: 4px;
    padding: 10px;
    border-radius: 14px;
    background: rgba(246, 239, 216, 0.06);
  }

  .viewer-close {
    position: absolute;
    top: 18px;
    right: 18px;
    width: 48px;
    height: 48px;
    border: 0;
    border-radius: 50%;
    background: rgba(246, 239, 216, 0.12);
    color: #f6efd8;
    font-size: 1.8rem;
    cursor: pointer;
  }

  .viewer-status {
    top: 18px;
    right: 80px;
    max-width: min(360px, calc(100% - 458px));
    padding: 10px 14px;
    border-radius: 16px;
    background: rgba(10, 20, 17, 0.78);
    color: #f6efd8;
  }

  .viewer-status-error {
    background: rgba(120, 24, 24, 0.76);
  }

  .viewer-hint {
    right: 18px;
    bottom: 120px;
    display: grid;
    gap: 2px;
    max-width: 320px;
    padding: 14px 16px;
    border-radius: 18px;
    background: rgba(10, 20, 17, 0.78);
    color: #f6efd8;
  }

  .viewer-subhint {
    color: rgba(246, 239, 216, 0.7);
    line-height: 1.4;
  }

  .viewer-travel {
    left: 18px;
    right: 18px;
    bottom: 18px;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .viewer-travel-button {
    display: grid;
    gap: 4px;
    text-align: left;
  }

  @media (max-width: 860px) {
    .viewer-root {
      padding: 10px;
    }

    .viewer-stage-wrap,
    .viewer-stage {
      min-height: 86vh;
    }

    .viewer-tier-panel {
      width: calc(100% - 20px);
      left: 10px;
      top: 10px;
      padding-right: 60px;
    }

    .viewer-tier-meta,
    .viewer-tier-track,
    .viewer-travel {
      grid-template-columns: 1fr;
    }

    .viewer-status {
      left: 10px;
      right: 10px;
      top: auto;
      bottom: 176px;
      max-width: none;
    }

    .viewer-hint {
      left: 10px;
      right: 10px;
      bottom: 94px;
      max-width: none;
    }

    .viewer-travel {
      left: 10px;
      right: 10px;
      bottom: 10px;
    }

    .viewer-close {
      top: 10px;
      right: 10px;
    }
  }
</style>

<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";

  import type { RoomBlueprint } from "$lib/game/types";

  interface Props {
    room: RoomBlueprint;
    close: () => void;
  }

  let { room, close }: Props = $props();

  let stageElement: HTMLDivElement | null = null;
  let loadMessage = $state("Loading 3D room...");
  let errorMessage = $state("");

  let yaw = 180;
  let pitch = 0;
  let fov = 72;

  let pointerId: number | null = null;
  let lastPointerX = 0;
  let lastPointerY = 0;

  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  function nudgeCamera(deltaYaw: number, deltaPitch: number): void {
    yaw = (yaw + deltaYaw + 360) % 360;
    pitch = clamp(pitch + deltaPitch, -80, 80);
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

    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#12211f")
    });

    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    const loader = new THREE.TextureLoader();
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
      if (event.key === "Escape") {
        close();
        return;
      }

      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        event.preventDefault();
        nudgeCamera(-8, 0);
      }

      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        event.preventDefault();
        nudgeCamera(8, 0);
      }

      if (event.key === "ArrowUp" || event.key.toLowerCase() === "w") {
        event.preventDefault();
        nudgeCamera(0, -5);
      }

      if (event.key === "ArrowDown" || event.key.toLowerCase() === "s") {
        event.preventDefault();
        nudgeCamera(0, 5);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    if (!room.photospherePath) {
      loadMessage = "";
      errorMessage = "This room does not have a generated photosphere yet.";
    } else {
      loader.load(
        room.photospherePath,
        (texture: THREE.Texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          material.map = texture;
          material.needsUpdate = true;
          loadMessage = "";
        },
        undefined,
        () => {
          loadMessage = "";
          errorMessage = "Unable to load this room photosphere.";
        }
      );
    }

    resizeRenderer();
    renderFrame();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("keydown", handleKeyDown);
      resizeObserver.disconnect();
      material.map?.dispose();
      material.dispose();
      geometry.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  });
</script>

<div aria-label={`${room.label} 3D viewer`} aria-modal="true" class="viewer-root" role="dialog">
  <div class="viewer-shell">
    <header class="viewer-toolbar">
      <div>
        <p class="eyebrow">Immersive Room View</p>
        <h2>{room.label}</h2>
        <p class="viewer-copy">
          Click and drag, use arrow keys, or swipe to rotate through the generated photosphere. Mouse wheel zoom is also enabled.
        </p>
      </div>

      <div class="viewer-toolbar-actions">
        {#if room.photosphereMetadataPath}
          <a class="ghost-button viewer-link" href={room.photosphereMetadataPath} target="_blank" rel="noreferrer">
            Open Metadata
          </a>
        {/if}
        <button class="primary-button" type="button" onclick={close}>Close 3D View</button>
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
        <span>Photo source</span>
        <strong>{room.photosphereSourcePath ? "Nano Banana panorama from concept art" : "Awaiting generated panorama"}</strong>
      </div>

      <div class="viewer-pad" aria-label="Camera controls">
        <button aria-label="Look up" class="viewer-pad-button" type="button" onclick={() => nudgeCamera(0, -8)}>↑</button>
        <span class="viewer-pad-gap"></span>
        <button aria-label="Look left" class="viewer-pad-button" type="button" onclick={() => nudgeCamera(-10, 0)}>←</button>
        <button aria-label="Look right" class="viewer-pad-button" type="button" onclick={() => nudgeCamera(10, 0)}>→</button>
        <span class="viewer-pad-gap"></span>
        <button aria-label="Look down" class="viewer-pad-button" type="button" onclick={() => nudgeCamera(0, 8)}>↓</button>
      </div>
    </div>
  </div>
</div>

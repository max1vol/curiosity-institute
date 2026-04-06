import * as THREE from "three";

import type { Vector3Tuple } from "./types";

export const WORLD_LAYOUT = {
  width: 164,
  depth: 108,
} as const;

const MAP_WIDTH = 1100;
const MAP_HEIGHT = 640;

export interface GaussianSplatData {
  format: string;
  asset: string;
  pointCount: number;
  bounds: {
    min: Vector3Tuple;
    max: Vector3Tuple;
  };
  points: Array<[number, number, number, number, number, number, number, number]>;
}

const payloadCache = new Map<string, Promise<GaussianSplatData>>();

function parseAsciiPly(text: string, asset: string): GaussianSplatData {
  const lines = text.split(/\r?\n/);
  const headerEndIndex = lines.findIndex((line) => line.trim() === "end_header");
  if (headerEndIndex === -1) {
    throw new Error("Invalid gaussian splat PLY: missing end_header.");
  }

  const vertexLine = lines.find((line) => line.startsWith("element vertex "));
  const vertexCount = Number(vertexLine?.split(/\s+/)[2] ?? 0);
  const points: GaussianSplatData["points"] = [];
  const bounds = {
    min: [Infinity, Infinity, Infinity] as Vector3Tuple,
    max: [-Infinity, -Infinity, -Infinity] as Vector3Tuple
  };

  for (const line of lines.slice(headerEndIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const [x, y, z, red, green, blue, opacity, scale0] = trimmed.split(/\s+/).map(Number);
    if (![x, y, z, red, green, blue, opacity, scale0].every(Number.isFinite)) {
      continue;
    }

    points.push([x, y, z, red / 255, green / 255, blue / 255, scale0 * 190, opacity]);
    bounds.min[0] = Math.min(bounds.min[0], x);
    bounds.min[1] = Math.min(bounds.min[1], y);
    bounds.min[2] = Math.min(bounds.min[2], z);
    bounds.max[0] = Math.max(bounds.max[0], x);
    bounds.max[1] = Math.max(bounds.max[1], y);
    bounds.max[2] = Math.max(bounds.max[2], z);
  }

  return {
    format: "ply",
    asset,
    pointCount: vertexCount || points.length,
    bounds,
    points
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function mapPointToWorld(x: number, y: number, elevation?: number): THREE.Vector3;
export function mapPointToWorld(x: number, y: number, elevation: number | undefined, target: THREE.Vector3): THREE.Vector3;
export function mapPointToWorld(
  x: number,
  y: number,
  elevation?: number,
  target?: THREE.Vector3,
): THREE.Vector3 {
  const result = target ?? new THREE.Vector3();
  result.set(
    (x / MAP_WIDTH - 0.5) * WORLD_LAYOUT.width,
    elevation ?? 0,
    (y / MAP_HEIGHT - 0.5) * WORLD_LAYOUT.depth,
  );
  return result;
}

export function worldPointToMap(position: THREE.Vector3): { x: number; y: number } {
  return {
    x: clamp(((position.x / WORLD_LAYOUT.width) + 0.5) * MAP_WIDTH, 0, MAP_WIDTH),
    y: clamp(((position.z / WORLD_LAYOUT.depth) + 0.5) * MAP_HEIGHT, 0, MAP_HEIGHT),
  };
}

export async function loadGaussianSplat(url: string): Promise<GaussianSplatData> {
  const cached = payloadCache.get(url);
  if (cached) {
    return cached;
  }

  const promise = fetch(url).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Unable to load gaussian splat: ${response.status}`);
    }

    if (url.endsWith(".ply")) {
      return parseAsciiPly(await response.text(), url);
    }

    return (await response.json()) as GaussianSplatData;
  }).catch((error) => {
    payloadCache.delete(url);
    throw error;
  });

  payloadCache.set(url, promise);
  return promise;
}

export function gaussianSplatObject(
  data: GaussianSplatData,
  options: {
    scale?: number;
    opacity?: number;
    sizeMultiplier?: number;
  } = {},
): { object: THREE.Points; dispose: () => void } {
  const geometry = new THREE.BufferGeometry();
  const count = data.points.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  const scale = options.scale ?? 1;
  const opacity = options.opacity ?? 1;
  const sizeMultiplier = options.sizeMultiplier ?? 1;

  for (let index = 0; index < count; index += 1) {
    const [x, y, z, red, green, blue, size, alpha] = data.points[index];
    const offset = index * 3;
    positions[offset] = x * scale;
    positions[offset + 1] = y * scale;
    positions[offset + 2] = z * scale;
    colors[offset] = red;
    colors[offset + 1] = green;
    colors[offset + 2] = blue;
    sizes[index] = size * sizeMultiplier;
    alphas[index] = alpha * opacity;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    uniforms: {
      uPointScale: { value: 210 },
    },
    vertexShader: `
      attribute float size;
      attribute float alpha;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = color;
        vAlpha = alpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float distanceScale = max(1.0, -mvPosition.z);
        gl_PointSize = clamp(size * (uPointScale / distanceScale), 2.0, 72.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec2 centered = gl_PointCoord * 2.0 - 1.0;
        float radiusSquared = dot(centered, centered);

        if (radiusSquared > 1.0) {
          discard;
        }

        float gaussian = exp(-radiusSquared * 3.75);
        gl_FragColor = vec4(vColor, gaussian * vAlpha);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = true;

  return {
    object: points,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

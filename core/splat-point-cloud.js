import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { ensureDir, writeText } from "./fs-utils.js";

const execFileAsync = promisify(execFile);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z) || 1;
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length
  };
}

function subtractVectors(left, right) {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z
  };
}

function addVectors(left, right) {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z
  };
}

function scaleVector(vector, scale) {
  return {
    x: vector.x * scale,
    y: vector.y * scale,
    z: vector.z * scale
  };
}

function crossVectors(left, right) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x
  };
}

function vectorToArray(vector) {
  return [vector.x, vector.y, vector.z];
}

function hashToUnitFloat(seed) {
  let value = seed | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return ((value >>> 0) % 10_000) / 10_000;
}

function detectMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  throw new Error(`Unsupported image extension for splat synthesis: ${extension}`);
}

async function probeImageDimensions(filePath) {
  const { stdout } = await execFileAsync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      filePath
    ],
    {
      encoding: "buffer",
      maxBuffer: 1024 * 1024
    }
  );

  const parsed = JSON.parse(Buffer.from(stdout).toString("utf8"));
  const stream = parsed?.streams?.[0];
  const width = Number(stream?.width);
  const height = Number(stream?.height);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Unable to probe image dimensions for ${filePath}`);
  }

  return { width, height };
}

export async function decodeImageToRgba(filePath) {
  const [dimensions, imageBuffer] = await Promise.all([
    probeImageDimensions(filePath),
    execFileAsync(
      "ffmpeg",
      ["-v", "error", "-i", filePath, "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"],
      {
        encoding: "buffer",
        maxBuffer: 128 * 1024 * 1024
      }
    )
  ]);

  return {
    ...dimensions,
    data: imageBuffer.stdout
  };
}

function cameraPositionForYaw({
  sceneCenter,
  yawDeg,
  radius,
  eyeHeight
}) {
  const yawRad = degToRad(yawDeg);

  return {
    x: sceneCenter.x + Math.sin(yawRad) * radius,
    y: sceneCenter.y + eyeHeight,
    z: sceneCenter.z + Math.cos(yawRad) * radius
  };
}

function pointFromPixel({
  x,
  y,
  width,
  height,
  pixels,
  cameraPosition,
  lookAt,
  fovDeg,
  radius,
  viewSeed
}) {
  const index = (y * width + x) * 4;
  const red = pixels[index];
  const green = pixels[index + 1];
  const blue = pixels[index + 2];
  const alpha = pixels[index + 3] / 255;

  if (alpha <= 0.03) {
    return null;
  }

  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  const ndcX = ((x + 0.5) / width) * 2 - 1;
  const ndcY = 1 - ((y + 0.5) / height) * 2;
  const forward = normalizeVector(subtractVectors(lookAt, cameraPosition));
  const worldUp = { x: 0, y: 1, z: 0 };
  let right = crossVectors(forward, worldUp);

  if (Math.hypot(right.x, right.y, right.z) < 0.001) {
    right = { x: 1, y: 0, z: 0 };
  }

  right = normalizeVector(right);
  const up = normalizeVector(crossVectors(right, forward));
  const horizontalScale = Math.tan(degToRad(fovDeg / 2));
  const verticalScale = horizontalScale * (height / width);
  const ray = normalizeVector(
    addVectors(
      addVectors(forward, scaleVector(right, ndcX * horizontalScale)),
      scaleVector(up, ndcY * verticalScale)
    )
  );

  const depthBias = 0.55 + (1 - luminance) * 0.45 + Math.abs(ndcY) * 0.14 + alpha * 0.1;
  const jitter = (hashToUnitFloat(viewSeed + x * 73_856_093 + y * 19_349_663) - 0.5) * 0.22;
  const depth = clamp(radius * depthBias + jitter, radius * 0.25, radius * 1.5);
  const worldPoint = addVectors(cameraPosition, scaleVector(ray, depth));
  const opacity = clamp(0.14 + alpha * 0.76 + (1 - luminance) * 0.08, 0.05, 0.96);
  const scale = clamp(0.015 + (1 - luminance) * 0.015 + Math.abs(ndcX) * 0.004, 0.01, 0.05);

  return {
    x: worldPoint.x,
    y: worldPoint.y,
    z: worldPoint.z,
    red,
    green,
    blue,
    opacity,
    scale,
    rotation: [1, 0, 0, 0]
  };
}

export function buildGaussianSplatPoints({
  imageViews,
  sceneCenter = { x: 0, y: 1.4, z: 0 },
  lookAt = { x: 0, y: 1.4, z: 0 },
  radius = 7.5,
  eyeHeight = 1.75,
  fovDeg = 62,
  pointsPerView = 12000
}) {
  const points = [];

  for (const view of imageViews) {
    const sampleStep = Math.max(1, Math.round(Math.sqrt((view.width * view.height) / pointsPerView)));
    const cameraPosition = cameraPositionForYaw({
      sceneCenter,
      yawDeg: view.yawDeg,
      radius,
      eyeHeight
    });
    const viewSeed = Math.round((view.yawDeg + 360) * 1000) + view.width * 13 + view.height * 17;

    for (let y = 0; y < view.height; y += sampleStep) {
      for (let x = 0; x < view.width; x += sampleStep) {
        const point = pointFromPixel({
          x,
          y,
          width: view.width,
          height: view.height,
          pixels: view.data,
          cameraPosition,
          lookAt,
          fovDeg,
          radius,
          viewSeed
        });

        if (point) {
          points.push({
            ...point,
            sourceViewId: view.id
          });
        }
      }
    }
  }

  return points;
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(6).replace(/0+$/g, "").replace(/\.$/g, "");
}

export async function writeAsciiPly(filePath, points, metadata = {}) {
  await ensureDir(path.dirname(filePath));

  const lines = [
    "ply",
    "format ascii 1.0",
    `comment asset ${metadata.asset ?? ""}`.trim(),
    `comment sourceMode ${metadata.sourceMode ?? ""}`.trim(),
    `comment generatedAt ${metadata.generatedAt ?? new Date().toISOString()}`.trim(),
    `element vertex ${points.length}`,
    "property float x",
    "property float y",
    "property float z",
    "property uchar red",
    "property uchar green",
    "property uchar blue",
    "property float opacity",
    "property float scale_0",
    "property float scale_1",
    "property float scale_2",
    "property float rot_0",
    "property float rot_1",
    "property float rot_2",
    "property float rot_3",
    "end_header"
  ];

  for (const point of points) {
    lines.push([
      formatNumber(point.x),
      formatNumber(point.y),
      formatNumber(point.z),
      String(point.red),
      String(point.green),
      String(point.blue),
      formatNumber(point.opacity),
      formatNumber(point.scale),
      formatNumber(point.scale),
      formatNumber(point.scale),
      formatNumber(point.rotation[0]),
      formatNumber(point.rotation[1]),
      formatNumber(point.rotation[2]),
      formatNumber(point.rotation[3])
    ].join(" "));
  }

  await writeText(filePath, lines.join("\n") + "\n");
}

export async function readRgbaPixels(filePath) {
  const { width, height, data } = await decodeImageToRgba(filePath);
  return { width, height, data };
}

export function imageMimeTypeForPath(filePath) {
  return detectMimeType(filePath);
}

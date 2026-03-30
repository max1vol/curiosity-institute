#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const DEFAULT_INPUT_DIR = 'input';
const DEFAULT_OUTPUT_DIR = 'output';
const DEFAULT_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const MAX_ATTEMPTS = 3;
const seenLogs = new Set();

const VARIANTS = [
  {
    suffix: 'northwest-oblique',
    label: 'northwest oblique',
    camera: 'camera angled from the northwest looking southeast',
  },
  {
    suffix: 'northeast-oblique',
    label: 'northeast oblique',
    camera: 'camera angled from the northeast looking southwest',
  },
  {
    suffix: 'southwest-oblique',
    label: 'southwest oblique',
    camera: 'camera angled from the southwest looking northeast',
  },
];

main().catch((error) => {
  logOnce('fatal', renderError('fatal', error));
  process.exitCode = 1;
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputDir = path.resolve(args.inputDir ?? DEFAULT_INPUT_DIR);
  const outputDir = path.resolve(args.outputDir ?? DEFAULT_OUTPUT_DIR);
  const model = args.model ?? DEFAULT_MODEL;

  await mkdir(outputDir, { recursive: true });

  const files = await collectImageFiles(inputDir, args.recursive !== false);

  if (files.length === 0) {
    console.log(`No input images found in ${inputDir}`);
    console.log(`Drop PNG, JPG, JPEG, or WEBP files into ${path.relative(process.cwd(), inputDir) || inputDir} and run again.`);
    return;
  }

  const apiKey = resolveApiKey();

  console.log(`Using model: ${model}`);
  console.log(`Input: ${inputDir}`);
  console.log(`Output: ${outputDir}`);

  for (const file of files) {
    await processFile({ apiKey, model, inputDir, outputDir, file });
  }
}

function parseArgs(argv) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--input' || token === '-i') {
      result.inputDir = argv[++index];
      continue;
    }

    if (token === '--output' || token === '-o') {
      result.outputDir = argv[++index];
      continue;
    }

    if (token === '--model' || token === '-m') {
      result.model = argv[++index];
      continue;
    }

    if (token === '--no-recursive') {
      result.recursive = false;
      continue;
    }

    if (token === '--recursive') {
      result.recursive = true;
      continue;
    }

    if (!result.inputDir) {
      result.inputDir = token;
      continue;
    }

    if (!result.outputDir) {
      result.outputDir = token;
    }
  }

  return result;
}

function resolveApiKey() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error('Set GEMINI_API_KEY before running the renderer.');
  }

  return apiKey;
}

async function collectImageFiles(rootDir, recursive) {
  const entries = [];

  async function walk(currentDir) {
    let dirents;
    try {
      dirents = await readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return;
      }
      throw error;
    }

    for (const dirent of dirents) {
      const absolutePath = path.join(currentDir, dirent.name);

      if (dirent.isDirectory()) {
        if (recursive) {
          await walk(absolutePath);
        }
        continue;
      }

      if (dirent.isFile() && IMAGE_EXTENSIONS.has(path.extname(dirent.name).toLowerCase())) {
        entries.push(absolutePath);
      }
    }
  }

  await walk(rootDir);
  entries.sort();
  return entries;
}

async function processFile({ apiKey, model, inputDir, outputDir, file }) {
  const relativePath = path.relative(inputDir, file);
  const parsed = path.parse(relativePath);
  const sourceLabel = relativePath || path.basename(file);

  console.log(`Processing ${sourceLabel}`);

  for (const variant of VARIANTS) {
    const outputBase = path.join(outputDir, parsed.dir, `${parsed.name}__${variant.suffix}`);
    await mkdir(path.dirname(outputBase), { recursive: true });
    await renderVariant({
      apiKey,
      model,
      file,
      outputBase,
      sourceLabel,
      variant,
    });
  }
}

async function renderVariant({ apiKey, model, file, outputBase, sourceLabel, variant }) {
  const { mimeType, base64 } = await readImage(file);
  const prompt = buildPrompt(sourceLabel, variant);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await generateImage({
        apiKey,
        model,
        prompt,
        mimeType,
        base64,
      });

      const image = extractImagePart(response);

      if (!image?.data) {
        throw new Error('Google API response did not include an image part.');
      }

      const outputFile = `${outputBase}${mimeTypeToExtension(image.mimeType || image.mime_type || 'image/png')}`;
      const bytes = Buffer.from(image.data, 'base64');
      await writeFile(outputFile, bytes);
      console.log(`  ${variant.label}: wrote ${path.relative(process.cwd(), outputFile)}`);
      return;
    } catch (error) {
      const key = hashFailure({
        file,
        outputFile,
        variant: variant.label,
        message: error?.message || String(error),
      });

      logOnce(
        key,
        `  ${variant.label}: attempt ${attempt}/${MAX_ATTEMPTS} failed for ${sourceLabel}: ${renderErrorMessage(error)}`
      );

      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }

      await delay(500 * attempt);
    }
  }
}

function buildPrompt(sourceLabel, variant) {
  return [
    'Transform the attached concept art into a Google Maps-inspired 3D oblique render.',
    `Preserve the original subject and composition from ${sourceLabel}.`,
    `Use a clean ${variant.label} viewpoint with the ${variant.camera}.`,
    'Make the scene feel like it has real height, depth, terrain extrusion, and readable map-like surfaces.',
    'Keep edges crisp, lighting natural, and the overall style polished rather than painterly.',
    'Do not add text, logos, watermarks, or unrelated objects.',
  ].join(' ');
}

async function readImage(file) {
  const data = await readFile(file);
  const ext = path.extname(file).toLowerCase();
  const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  return {
    mimeType,
    base64: data.toString('base64'),
  };
}

function mimeTypeToExtension(mimeType) {
  if (mimeType === 'image/jpeg') {
    return '.jpg';
  }

  if (mimeType === 'image/webp') {
    return '.webp';
  }

  return '.png';
}

async function generateImage({ apiKey, model, prompt, mimeType, base64 }) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    }),
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${bodyText}`);
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error(`Invalid JSON response: ${bodyText}`);
  }
}

function extractImagePart(response) {
  const candidates = response?.candidates ?? [];

  for (const candidate of candidates) {
    const parts = candidate?.content?.parts ?? [];

    for (const part of parts) {
      if (part?.inlineData?.data) {
        return part.inlineData;
      }
    }
  }

  return null;
}

function hashFailure(details) {
  return createHash('sha1').update(JSON.stringify(details)).digest('hex');
}

function logOnce(key, message) {
  if (seenLogs.has(key)) {
    return;
  }

  seenLogs.add(key);
  console.error(message);
}

function renderError(scope, error) {
  return `[${scope}] ${renderErrorMessage(error)}`;
}

function renderErrorMessage(error) {
  if (!error) {
    return 'Unknown error';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

#!/usr/bin/env node

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '/Users/yaroslavvolovich/.gemini/extensions/nanobanana/mcp-server/node_modules/@google/genai/dist/node/index.mjs';

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) {
      args[key] = 'true';
      continue;
    }
    args[key] = value;
    i += 1;
  }

  return args;
}

function inferMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') {
    return 'image/jpeg';
  }
  if (ext === '.webp') {
    return 'image/webp';
  }
  return 'image/png';
}

function firstImagePart(parts) {
  for (const part of parts ?? []) {
    if (part.inlineData?.data) {
      return {
        base64: part.inlineData.data,
        mimeType: part.inlineData.mimeType || 'image/png',
      };
    }
  }

  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prompt = args.prompt;
  const input = args.input;
  const output = args.output;
  const model = args.model || process.env.NANOBANANA_MODEL || 'gemini-2.5-flash-image';

  if (!prompt || !output) {
    console.error('Usage: render-concept-art.mjs --prompt "..." --output path [--input image]');
    process.exit(1);
  }

  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION;

  if (process.env.GOOGLE_GENAI_USE_VERTEXAI !== 'true' || !project || !location) {
    console.error('Vertex environment is not configured.');
    process.exit(1);
  }

  const ai = new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });

  const parts = [{ text: prompt }];
  if (input) {
    const imageData = await readFile(input);
    parts.push({
      inlineData: {
        data: imageData.toString('base64'),
        mimeType: inferMimeType(input),
      },
    });
  }

  let response;
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      response = await ai.models.generateContent({
        model,
        contents: [{ role: 'user', parts }],
      });
      break;
    } catch (error) {
      lastError = error;
      const status = error?.status;
      if (status !== 429 || attempt === 3) {
        throw error;
      }
      const delayMs = 5000 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  if (!response) {
    throw lastError || new Error('No response returned by model.');
  }

  const image = firstImagePart(response.candidates?.[0]?.content?.parts);
  if (!image) {
    console.error('No image returned by model.');
    process.exit(1);
  }

  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(image.base64, 'base64'));
  console.log(output);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

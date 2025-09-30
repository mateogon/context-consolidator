// src/core/constants.ts
export const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "__pycache__",
  "dist",
  "build",
  "out",
]);

export const SKIP_CONTENT_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".bmp",
  ".webp",
  ".ico",
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".mp4",
  ".mkv",
  ".mov",
]);

export const WS_KEY_ITEMS = (ws: string) => `contextConsolidator.items:${ws}`;
export const WS_KEY_OPTIONS = (ws: string) =>
  `contextConsolidator.promptOptions:${ws}`;
export const WS_KEY_PRESET = (ws: string) =>
  `contextConsolidator.promptPreset:${ws}`;
export const WS_KEY_HISTORY = (ws: string) =>
  `contextConsolidator.history:${ws}:v1`;
export const WS_KEY_PRESETS = (ws: string) =>
  `contextConsolidator.presets:${ws}:v1`;

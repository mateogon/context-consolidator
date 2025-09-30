import * as vscode from "vscode";
import { randomUUID } from "crypto";
import {
  ConsolidateItem,
  HistoryEntry,
  PresetEntry,
} from "./types";
import {
  WS_KEY_HISTORY,
  WS_KEY_PRESETS,
} from "./constants";
import { wsName } from "./state";
import { itemTokenCount } from "./token";

type StoredRange = {
  start: { line: number; character: number };
  end: { line: number; character: number };
};

type StoredConsolidateItem =
  | { type: "file"; uri: string; includeContent: boolean }
  | {
      type: "snippet";
      uri: string;
      range: StoredRange;
      originalText: string;
      text: string;
      contextBefore?: string;
      contextAfter?: string;
    };

type StoredHistoryEntry = {
  id: string;
  ts: number;
  totalTokens: number;
  items: StoredConsolidateItem[];
};

type StoredPresetEntry = {
  id: string;
  name: string;
  description?: string;
  totalTokens: number;
  items: StoredConsolidateItem[];
};

function serializeItem(item: ConsolidateItem): StoredConsolidateItem {
  if (item.type === "file") {
    return { type: "file", uri: item.uri, includeContent: item.includeContent };
  }
  return {
    type: "snippet",
    uri: item.uri,
    range: {
      start: {
        line: item.range.start.line,
        character: item.range.start.character,
      },
      end: {
        line: item.range.end.line,
        character: item.range.end.character,
      },
    },
    originalText: item.originalText,
    text: item.text,
    contextBefore: item.contextBefore,
    contextAfter: item.contextAfter,
  };
}

function deserializeItem(item: StoredConsolidateItem): ConsolidateItem {
  if (item.type === "file") return { ...item } as ConsolidateItem;
  const range = new vscode.Range(
    new vscode.Position(item.range.start.line, item.range.start.character),
    new vscode.Position(item.range.end.line, item.range.end.character)
  );
  return {
    type: "snippet",
    uri: item.uri,
    range,
    originalText: item.originalText,
    text: item.text,
    contextBefore: item.contextBefore,
    contextAfter: item.contextAfter,
  };
}

function readHistory(ctx: vscode.ExtensionContext): StoredHistoryEntry[] {
  const name = wsName();
  if (!name) return [];
  return ctx.workspaceState.get<StoredHistoryEntry[]>(
    WS_KEY_HISTORY(name),
    []
  ) ?? [];
}

async function writeHistory(
  ctx: vscode.ExtensionContext,
  entries: StoredHistoryEntry[]
) {
  const name = wsName();
  if (!name) return;
  await ctx.workspaceState.update(WS_KEY_HISTORY(name), entries);
}

function readPresets(ctx: vscode.ExtensionContext): StoredPresetEntry[] {
  const name = wsName();
  if (!name) return [];
  return ctx.workspaceState.get<StoredPresetEntry[]>(
    WS_KEY_PRESETS(name),
    []
  ) ?? [];
}

async function writePresets(
  ctx: vscode.ExtensionContext,
  entries: StoredPresetEntry[]
) {
  const name = wsName();
  if (!name) return;
  await ctx.workspaceState.update(WS_KEY_PRESETS(name), entries);
}

function toRuntimeHistory(entry: StoredHistoryEntry): HistoryEntry {
  return {
    id: entry.id,
    ts: entry.ts,
    totalTokens: entry.totalTokens,
    items: entry.items.map(deserializeItem),
  };
}

function toRuntimePreset(entry: StoredPresetEntry): PresetEntry {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    totalTokens: entry.totalTokens,
    items: entry.items.map(deserializeItem),
  };
}

function toStoredHistory(entries: HistoryEntry[]): StoredHistoryEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    ts: entry.ts,
    totalTokens: entry.totalTokens,
    items: entry.items.map(serializeItem),
  }));
}

function toStoredPresets(entries: PresetEntry[]): StoredPresetEntry[] {
  return entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    description: entry.description,
    totalTokens: entry.totalTokens,
    items: entry.items.map(serializeItem),
  }));
}

export function loadHistory(ctx: vscode.ExtensionContext): HistoryEntry[] {
  return readHistory(ctx).map(toRuntimeHistory);
}

export async function saveHistory(
  ctx: vscode.ExtensionContext,
  entries: HistoryEntry[]
) {
  await writeHistory(ctx, toStoredHistory(entries));
}

export async function addHistorySnapshot(
  ctx: vscode.ExtensionContext,
  items: ConsolidateItem[]
) {
  const historyEnabled = vscode.workspace
    .getConfiguration("contextConsolidator")
    .get<boolean>("enableHistory", true);
  if (!historyEnabled) return;

  const history = readHistory(ctx);
  const totalTokens = items.reduce((sum, item) => sum + itemTokenCount(item), 0);
  const entry: StoredHistoryEntry = {
    id: randomUUID(),
    ts: Date.now(),
    totalTokens,
    items: items.map(serializeItem),
  };
  history.unshift(entry);

  const limit = vscode.workspace
    .getConfiguration("contextConsolidator")
    .get<number>("historyLimit", 20);
  if (history.length > limit) history.splice(limit);

  await writeHistory(ctx, history);
}

export async function deleteHistoryEntry(
  ctx: vscode.ExtensionContext,
  id: string
) {
  const history = readHistory(ctx).filter((entry) => entry.id !== id);
  await writeHistory(ctx, history);
}

export async function clearHistory(ctx: vscode.ExtensionContext) {
  await writeHistory(ctx, []);
}

export function loadPresets(ctx: vscode.ExtensionContext): PresetEntry[] {
  return readPresets(ctx).map(toRuntimePreset);
}

export async function savePresets(
  ctx: vscode.ExtensionContext,
  entries: PresetEntry[]
) {
  await writePresets(ctx, toStoredPresets(entries));
}

export async function addPreset(
  ctx: vscode.ExtensionContext,
  name: string,
  items: ConsolidateItem[],
  description?: string
): Promise<PresetEntry | undefined> {
  const presetsEnabled = vscode.workspace
    .getConfiguration("contextConsolidator")
    .get<boolean>("enablePresets", true);
  if (!presetsEnabled) return undefined;

  const presets = readPresets(ctx);
  const totalTokens = items.reduce((sum, item) => sum + itemTokenCount(item), 0);
  const stored: StoredPresetEntry = {
    id: randomUUID(),
    name,
    description,
    totalTokens,
    items: items.map(serializeItem),
  };
  presets.push(stored);
  await writePresets(ctx, presets);
  return toRuntimePreset(stored);
}

export async function renamePreset(
  ctx: vscode.ExtensionContext,
  id: string,
  name: string
) {
  const presets = readPresets(ctx);
  const target = presets.find((p) => p.id === id);
  if (!target) return;
  target.name = name;
  await writePresets(ctx, presets);
}

export async function deletePreset(
  ctx: vscode.ExtensionContext,
  id: string
) {
  const presets = readPresets(ctx).filter((p) => p.id !== id);
  await writePresets(ctx, presets);
}

export async function clearPresets(ctx: vscode.ExtensionContext) {
  await writePresets(ctx, []);
}

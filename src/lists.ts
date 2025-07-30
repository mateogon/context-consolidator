
import * as vscode from 'vscode';
import { ConsolidateItem } from './types'; 
import {itemTokenCount} from './extension';

// Interfaces
export interface HistoryEntry {
  id: string;
  ts: number;
  items: ConsolidateItem[];
  totalTok: number;
}

export interface PresetEntry {
  id: string;
  name: string;
  desc?: string;
  items: ConsolidateItem[];
  totalTok: number;
}

// Constants
const HISTORY_KEY_PREFIX = 'cc.history';
const PRESETS_KEY_PREFIX = 'cc.presets';
const VERSION = 'v1';

function getWorkspaceKey(context: vscode.ExtensionContext): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return undefined;
    }
    return workspaceFolders[0].name;
}

// History Functions
export function loadHistory(context: vscode.ExtensionContext): HistoryEntry[] {
    const workspaceName = getWorkspaceKey(context);
    if (!workspaceName) {return [];}
    const key = `${HISTORY_KEY_PREFIX}:${workspaceName}.${VERSION}`;
    return context.workspaceState.get<HistoryEntry[]>(key, []);
}

export async function saveHistory(context: vscode.ExtensionContext, history: HistoryEntry[]): Promise<void> {
    const workspaceName = getWorkspaceKey(context);
    if (!workspaceName) {return;}
    const key = `${HISTORY_KEY_PREFIX}:${workspaceName}.${VERSION}`;
    await context.workspaceState.update(key, history);
}

export async function addHistorySnapshot(context: vscode.ExtensionContext, items: ConsolidateItem[]): Promise<void> {
    const history = loadHistory(context);
    const totalTok = items.reduce((sum, it) => sum + itemTokenCount(it), 0);
    const newEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        ts: Date.now(),
        items: JSON.parse(JSON.stringify(items)), // Deep copy
        totalTok: totalTok,
    };
    history.unshift(newEntry);

    const historyLimit = vscode.workspace.getConfiguration('contextConsolidator').get<number>('historyLimit', 20);
    if (history.length > historyLimit) {
        history.splice(historyLimit);
    }

    await saveHistory(context, history);
}

// Preset Functions
export function loadPresets(context: vscode.ExtensionContext): PresetEntry[] {
    const workspaceName = getWorkspaceKey(context);
    if (!workspaceName) {return [];}
    const key = `${PRESETS_KEY_PREFIX}:${workspaceName}.${VERSION}`;
    return context.workspaceState.get<PresetEntry[]>(key, []);
}

export async function savePresets(context: vscode.ExtensionContext, presets: PresetEntry[]): Promise<void> {
    const workspaceName = getWorkspaceKey(context);
    if (!workspaceName) {return;}
    const key = `${PRESETS_KEY_PREFIX}:${workspaceName}.${VERSION}`;
    await context.workspaceState.update(key, presets);
}

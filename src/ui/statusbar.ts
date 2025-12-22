// src/ui/statusbar.ts
import * as vscode from "vscode";
import { ConsolidateItem } from "../core/types";
import { calcTotals } from "../core/token";

export const statusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left
);

export function updateStatusBar(items: ConsolidateItem[]) {
  const { tokens, lines } = calcTotals(items);
  statusBarItem.text = `📦 ${items.length} | ${lines}L | ${(tokens / 1000).toFixed(1)}k`;
  statusBarItem.tooltip = "Click to open Context Consolidator Menu";
}

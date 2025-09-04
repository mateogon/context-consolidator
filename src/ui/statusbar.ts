// src/ui/statusbar.ts
import * as vscode from "vscode";
import { ConsolidateItem } from "../core/types";
import { itemTokenCount, itemLineCount } from "../core/token";

export const statusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left
);

export function updateStatusBar(items: ConsolidateItem[]) {
  let tokens = 0,
    lines = 0;
  items.forEach((i) => {
    tokens += itemTokenCount(i);
    lines += itemLineCount(i);
  });
  statusBarItem.text = `Context 📦 ${items.length} | ${lines} L | ${tokens} tok`;
}

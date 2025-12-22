// src/ui/decorations.ts
import * as vscode from "vscode";
import { consolidateItems } from "../core/state";

export class ConsolidatedDecoration implements vscode.FileDecorationProvider {
  private _onDidChange = new vscode.EventEmitter<
    vscode.Uri | vscode.Uri[] | undefined
  >();
  readonly onDidChangeFileDecorations = this._onDidChange.event;
  refresh(uris?: vscode.Uri | vscode.Uri[]) {
    this._onDidChange.fire(uris);
  }
  provideFileDecoration(uri: vscode.Uri) {
    return consolidateItems.some((i) => i.uri === uri.toString())
      ? new vscode.FileDecoration(
          undefined,
          "Consolidated",
          new vscode.ThemeColor("charts.blue")
        )
      : undefined;
  }
}

export const consolidatedDecorationProvider = new ConsolidatedDecoration();

export function refreshDecorations(uris?: vscode.Uri | vscode.Uri[]) {
  consolidatedDecorationProvider.refresh(uris);
}

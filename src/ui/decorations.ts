// src/ui/decorations.ts
import * as vscode from "vscode";
import { consolidateItems } from "../core/state";

export class ConsolidatedDecoration implements vscode.FileDecorationProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChange.event;
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

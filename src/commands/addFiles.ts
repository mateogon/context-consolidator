// src/commands/addFiles.ts
import * as vscode from "vscode";
import * as path from "path";
import { SKIP_CONTENT_EXTS } from "../core/constants";
import {
  consolidateItems,
  originalDocTexts,
  persistFileItems,
} from "../core/state";
import { isBinaryUri } from "../utils/fs";
import { updateStatusBar } from "../ui/statusbar";

export function registerAddFiles(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.addToConsolidateList",
      async (uri: vscode.Uri | undefined, uris?: vscode.Uri[]) => {
        const targets = (uris?.length ? uris : uri ? [uri] : []).filter(
          Boolean
        ) as vscode.Uri[];
        if (targets.length === 0 && vscode.window.activeTextEditor?.document)
          targets.push(vscode.window.activeTextEditor.document.uri);

        for (const file of targets) {
          const ext = path.extname(file.fsPath).toLowerCase();
          let includeContent = !SKIP_CONTENT_EXTS.has(ext);
          if (includeContent && (await isBinaryUri(file.fsPath)))
            includeContent = false;
          if (includeContent) {
            try {
              const doc = await vscode.workspace.openTextDocument(file);
              originalDocTexts.set(file.toString(), doc.getText());
            } catch {
              includeContent = false;
            }
          }
          if (!consolidateItems.some((i) => i.uri === file.toString())) {
            consolidateItems.push({
              type: "file",
              uri: file.toString(),
              includeContent,
            } as any);
          }
        }
        await persistFileItems(context);
        updateStatusBar(consolidateItems);
      }
    )
  );
}

// src/commands/toggleItem.ts
import * as vscode from "vscode";
import * as path from "path";
import {
  consolidateItems,
  originalDocTexts,
  persistFileItems,
} from "../core/state";
import { SKIP_CONTENT_EXTS } from "../core/constants";
import { isBinaryUri } from "../utils/fs";

export function registerToggleItem(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.toggleConsolidateItem",
      async (uri: vscode.Uri | undefined, uris?: vscode.Uri[]) => {
        const targets = (uris?.length ? uris : uri ? [uri] : []).filter(
          Boolean
        ) as vscode.Uri[];
        if (targets.length === 0 && vscode.window.activeTextEditor?.document)
          targets.push(vscode.window.activeTextEditor.document.uri);

        for (const file of targets) {
          const key = file.toString();
          const pos = consolidateItems.findIndex((i) => i.uri === key);
          if (pos !== -1) {
            consolidateItems.splice(pos, 1);
            originalDocTexts.delete(key);
          } else {
            const ext = path.extname(file.fsPath).toLowerCase();
            let includeContent = !SKIP_CONTENT_EXTS.has(ext);
            if (includeContent && (await isBinaryUri(file.fsPath)))
              includeContent = false;
            if (includeContent) {
              try {
                const doc = await vscode.workspace.openTextDocument(file);
                originalDocTexts.set(key, doc.getText());
              } catch {
                includeContent = false;
              }
            }
            consolidateItems.push({
              type: "file",
              uri: key,
              includeContent,
            } as any);
          }
        }
        await persistFileItems(context);
      }
    )
  );
}

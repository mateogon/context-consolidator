// src/commands/addFolder.ts
import * as vscode from "vscode";
import * as path from "path";
import { EXCLUDED_DIRS, SKIP_CONTENT_EXTS } from "../core/constants";
import {
  consolidateItems,
  originalDocTexts,
  persistFileItems,
} from "../core/state";
import { isBinaryUri } from "../utils/fs";

export function registerAddFolder(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.addFolderToConsolidateList",
      async (uri: vscode.Uri) => {
        if (!uri) return;
        const files = await vscode.workspace.findFiles(
          new vscode.RelativePattern(uri.fsPath, "**/*")
        );
        for (const file of files) {
          if (file.fsPath.split(path.sep).some((p) => EXCLUDED_DIRS.has(p)))
            continue;
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
      }
    )
  );
}

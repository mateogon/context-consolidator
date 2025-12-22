import * as vscode from "vscode";
import { consolidateItems, persistFileItems } from "../core/state";
import { updateHighlightsForDocument } from "../core/snippets";
import { updateStatusBar } from "./statusbar";
import { refreshDecorations } from "./decorations";

export async function refreshUI(ctx: vscode.ExtensionContext) {
  updateStatusBar(consolidateItems);
  await persistFileItems(ctx);
  refreshDecorations();
  vscode.window.visibleTextEditors.forEach((editor) =>
    updateHighlightsForDocument(editor.document)
  );
}

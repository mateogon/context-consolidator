import * as vscode from "vscode";
import { consolidateItems } from "../core/state";
import { updateHighlightsForDocument } from "../core/snippets";
import { updateStatusBar } from "../ui/statusbar";

export function registerAddSnippet(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.addSnippetToConsolidateList",
      () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
          vscode.window.showInformationMessage("No selection.");
          return;
        }

        const { document, selection } = editor;
        const range = new vscode.Range(selection.start, selection.end);
        const txt = document.getText(range);

        const before =
          selection.start.line > 0
            ? document.lineAt(selection.start.line - 1).text
            : "";
        const after =
          selection.end.line < document.lineCount - 1
            ? document.lineAt(selection.end.line + 1).text
            : "";

        const uriStr = document.uri.toString();

        // Paridad con la lógica original: prevenir duplicados por (uri + range)
        const already = consolidateItems.some(
          (i) =>
            i.type === "snippet" &&
            i.uri === uriStr &&
            (i as any).range?.isEqual(range)
        );
        if (!already) {
          consolidateItems.push({
            type: "snippet",
            uri: uriStr,
            range,
            originalText: txt,
            text: txt,
            contextBefore: before,
            contextAfter: after,
          } as any);
        }

        // Igual que el original: resaltar y actualizar status bar
        updateHighlightsForDocument(document);
        updateStatusBar(consolidateItems);
      }
    )
  );
}

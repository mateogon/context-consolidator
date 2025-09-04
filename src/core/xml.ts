// src/core/xml.ts
import * as vscode from "vscode";
import { consolidateItems, originalDocTexts } from "./state";

export async function buildConsolidatedXML(): Promise<string> {
  const unique = [...new Set(consolidateItems.map((i) => i.uri))];
  const fileTree = unique
    .map((u) => vscode.workspace.asRelativePath(vscode.Uri.parse(u)))
    .join("\n");
  const folderTreeXML = `<FolderTree>\n${fileTree}\n</FolderTree>`;

  const parts = await Promise.all(
    consolidateItems.map(async (item) => {
      const rel = vscode.workspace.asRelativePath(vscode.Uri.parse(item.uri));
      if (item.type === "file") {
        try {
          const doc = await vscode.workspace.openTextDocument(
            vscode.Uri.parse(item.uri)
          );
          return `<Code file="${rel}">\n${doc.getText()}\n</Code>`;
        } catch {
          const txt = originalDocTexts.get(item.uri) ?? "";
          return `<Code file="${rel}">\n${txt}\n</Code>`;
        }
      } else {
        const { range } = item;
        return `<Code file="${rel}" snippet="lines ${range.start.line + 1}-${
          range.end.line + 1
        }">\n${item.text}\n</Code>`;
      }
    })
  );

  return `<ConsolidatedFilesContext>\n${folderTreeXML}\n${parts.join(
    "\n"
  )}\n</ConsolidatedFilesContext>`;
}

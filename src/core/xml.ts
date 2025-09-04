// src/core/xml.ts
import * as vscode from "vscode";
import { consolidateItems, originalDocTexts } from "./state";

/** Asegura que el rango esté dentro de los límites actuales del documento */
function clampRange(
  range: vscode.Range,
  doc: vscode.TextDocument
): vscode.Range {
  const lastLineIdx = Math.max(0, doc.lineCount - 1);

  const startLine = Math.min(Math.max(0, range.start.line), lastLineIdx);
  const startMaxChar = doc.lineAt(startLine).text.length;
  const startChar = Math.min(Math.max(0, range.start.character), startMaxChar);

  const endLine = Math.min(Math.max(startLine, range.end.line), lastLineIdx);
  const endMaxChar = doc.lineAt(endLine).text.length;
  const endChar = Math.min(Math.max(0, range.end.character), endMaxChar);

  const start = new vscode.Position(startLine, startChar);
  const end = new vscode.Position(endLine, endChar);
  return new vscode.Range(start, end);
}

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
        // Siempre leer contenido fresco; fallback a cache si no se puede abrir
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
        // SNIPPET ⇒ leer SIEMPRE el texto actual del doc en el rango (clamp), fallback a item.text
        try {
          const doc = await vscode.workspace.openTextDocument(
            vscode.Uri.parse(item.uri)
          );
          const safe = clampRange(item.range, doc);
          const fresh = doc.getText(safe);
          return `<Code file="${rel}" snippet="lines ${safe.start.line + 1}-${
            safe.end.line + 1
          }">\n${fresh}\n</Code>`;
        } catch {
          // Si no se puede abrir, usar la última copia conocida
          return `<Code file="${rel}" snippet="lines ${
            item.range.start.line + 1
          }-${item.range.end.line + 1}">\n${item.text}\n</Code>`;
        }
      }
    })
  );

  return `<ConsolidatedFilesContext>\n${folderTreeXML}\n${parts.join(
    "\n"
  )}\n</ConsolidatedFilesContext>`;
}

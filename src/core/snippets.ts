// src/core/snippets.ts
import * as vscode from "vscode";
import * as DiffMatchPatch from "diff-match-patch";
import { ConsolidateItemSnippet } from "./types";
import { consolidateItems } from "./state";

const dmp = new DiffMatchPatch.diff_match_patch();
const snippetDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(255,255,0,0.30)",
});

export function updateHighlightsForDocument(doc: vscode.TextDocument) {
  const ranges = (consolidateItems as ConsolidateItemSnippet[])
    .filter((i) => i.type === "snippet" && i.uri === doc.uri.toString())
    .map((i) => i.range);
  vscode.window.visibleTextEditors
    .filter((e) => e.document === doc)
    .forEach((e) => e.setDecorations(snippetDecorationType, ranges));
}

export function adjustSnippetRangeSimple(
  item: ConsolidateItemSnippet,
  document: vscode.TextDocument
): void {
  const docLines = document.getText().split("\n");
  const originalLines = item.originalText.split("\n").map((l) => l.trim());
  const firstMarker = originalLines.find((l) => l.length) ?? "";
  const lastMarker = [...originalLines].reverse().find((l) => l.length) ?? "";
  let newStartLine = Math.max(
    0,
    docLines.findIndex((l) => l.trim() === firstMarker)
  );
  let newEndLineR = docLines
    .slice()
    .reverse()
    .findIndex((l) => l.trim() === lastMarker);
  let newEndLine =
    newEndLineR === -1
      ? docLines.length - 1
      : docLines.length - 1 - newEndLineR;
  const newStart = new vscode.Position(newStartLine, 0);
  const newEnd = new vscode.Position(newEndLine, docLines[newEndLine].length);
  item.range = new vscode.Range(newStart, newEnd);
  item.text = document.getText(item.range);
}

export function adjustSnippetRangeLineByLineHybridEnhanced(
  item: ConsolidateItemSnippet,
  document: vscode.TextDocument
): void {
  const fullText = document.getText();
  const docLines = fullText.split("\n");
  const origLines = item.originalText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!origLines.length) return;

  const matched: number[] = [];
  let searchOffset = 0;
  dmp.Match_Threshold = 0.8;
  const proximity = 50;

  for (const origLine of origLines) {
    let found = -1;
    const startLine = document.positionAt(searchOffset).line;
    for (let i = startLine; i < docLines.length; i++) {
      if (docLines[i].trim() === origLine) {
        found = document.offsetAt(new vscode.Position(i, 0));
        break;
      }
    }
    if (found === -1) {
      const approx = dmp.match_main(fullText, origLine, searchOffset);
      if (approx !== -1 && approx >= searchOffset) {
        if (matched.length) {
          const med = [...matched].sort((a, b) => a - b)[
            Math.floor(matched.length / 2)
          ];
          if (Math.abs(approx - med) <= proximity) found = approx;
        } else found = approx;
      }
    }
    if (
      found !== -1 &&
      (matched.length === 0 || found >= matched[matched.length - 1])
    ) {
      matched.push(found);
      searchOffset = found + origLine.length;
    } else matched.push(-1);
  }

  if (matched.filter((m) => m !== -1).length / origLines.length < 0.8) {
    adjustSnippetRangeSimple(item, document);
    return;
  }
  const first = Math.min(...matched.filter((m) => m !== -1));
  const last = Math.max(...matched.filter((m) => m !== -1));
  const startLine2 = document.positionAt(first).line;
  const endLine2 = document.positionAt(last).line;
  const startPos = new vscode.Position(startLine2, 0);
  const endPos = new vscode.Position(endLine2, docLines[endLine2].length);
  item.range = new vscode.Range(startPos, endPos);
  item.text = document.getText(item.range);
}

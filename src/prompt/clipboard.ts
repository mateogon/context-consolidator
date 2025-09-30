// src/prompt/clipboard.ts
import * as vscode from "vscode";
import { buildTaskSpecXML } from "./composer";
import { addHistorySnapshot } from "../core/history";
import { consolidateItems } from "../core/state";
import { buildConsolidatedXML } from "../core/xml";

export async function composePromptToClipboard(ctx: vscode.ExtensionContext) {
  const xml = await buildTaskSpecXML(ctx);
  await vscode.env.clipboard.writeText(xml);
  await addHistorySnapshot(ctx, consolidateItems);
  vscode.window.showInformationMessage("TaskSpec copied to clipboard ✔");
}

export async function copyConsolidatedContextToClipboard(
  ctx: vscode.ExtensionContext
) {
  const xml = await buildConsolidatedXML();
  await vscode.env.clipboard.writeText(xml);
  vscode.window.showInformationMessage("Consolidated context copied ✔");
}

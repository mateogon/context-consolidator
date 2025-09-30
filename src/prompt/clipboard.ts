// src/prompt/clipboard.ts
import * as vscode from "vscode";
import { buildTaskSpecXML } from "./composer";
import { addHistorySnapshot } from "../core/history";
import { consolidateItems } from "../core/state";

export async function composePromptToClipboard(ctx: vscode.ExtensionContext) {
  const xml = await buildTaskSpecXML(ctx);
  await vscode.env.clipboard.writeText(xml);
  await addHistorySnapshot(ctx, consolidateItems);
  vscode.window.showInformationMessage("TaskSpec copied to clipboard ✔");
}

// src/prompt/clipboard.ts
import * as vscode from "vscode";
import { buildTaskSpecXML } from "./composer";

export async function composePromptToClipboard(ctx: vscode.ExtensionContext) {
  const xml = await buildTaskSpecXML(ctx);
  await vscode.env.clipboard.writeText(xml);
  vscode.window.showInformationMessage("TaskSpec copied to clipboard ✔");
}

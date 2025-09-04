// src/commands/composeToClipboard.ts
import * as vscode from "vscode";
import { composePromptToClipboard } from "../prompt/clipboard";

export function registerCompose(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "contextConsolidator.composePromptToClipboard",
      async () => {
        await composePromptToClipboard(context);
      }
    )
  );
}

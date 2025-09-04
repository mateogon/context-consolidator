// src/commands/editPreset.ts
import * as vscode from "vscode";
import { getPreset } from "../core/state";
import { presetEditorScaffold } from "../prompt/presets";

export function registerEditPreset(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "contextConsolidator.editPromptPreset",
      async () => {
        const preset = getPreset(context);
        const doc = await vscode.workspace.openTextDocument({
          content: presetEditorScaffold(preset),
          language: "xml",
        });
        await vscode.window.showTextDocument(doc, { preview: false });
      }
    )
  );
}

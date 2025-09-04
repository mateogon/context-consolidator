// src/commands/savePresetFromEditor.ts
import * as vscode from "vscode";
import { setPreset } from "../core/state";
import { extractTagInner } from "../utils/strings";

export function registerSavePresetFromEditor(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "contextConsolidator.savePresetFromActiveEditor",
      async () => {
        const ed = vscode.window.activeTextEditor;
        if (!ed) {
          vscode.window.showWarningMessage("No active editor.");
          return;
        }
        const txt = ed.document.getText();
        const gg = extractTagInner(txt, "GeneralGuidelines");
        const cd = extractTagInner(txt, "CodingDirectives");
        if (!gg || !cd) {
          vscode.window.showErrorMessage(
            "Missing <GeneralGuidelines> or <CodingDirectives>."
          );
          return;
        }
        await setPreset(context, {
          generalGuidelines: gg.trim(),
          codingDirectives: cd.trim(),
        });
        vscode.window.showInformationMessage("Preset saved ✔");
      }
    )
  );
}

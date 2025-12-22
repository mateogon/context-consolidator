import * as vscode from "vscode";
import { setPreset } from "../core/state";
import { extractTagInner } from "../utils/strings";

export async function savePresetFromDocument(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument
): Promise<boolean> {
  const txt = document.getText();
  const gg = extractTagInner(txt, "GeneralGuidelines");
  const cd = extractTagInner(txt, "CodingDirectives");
  if (!gg || !cd) return false;
  await setPreset(context, {
    generalGuidelines: gg.trim(),
    codingDirectives: cd.trim(),
  });
  return true;
}

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
        const ok = await savePresetFromDocument(context, ed.document);
        if (!ok) {
          vscode.window.showErrorMessage(
            "Missing <GeneralGuidelines> or <CodingDirectives>."
          );
          return;
        }
        vscode.window.showInformationMessage("Preset saved ?");
      }
    )
  );
}

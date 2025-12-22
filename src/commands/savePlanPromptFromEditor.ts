import * as vscode from "vscode";
import { setPlanPrompt } from "../core/state";
import { extractTagInner } from "../utils/strings";

export async function savePlanPromptFromDocument(
  context: vscode.ExtensionContext,
  document: vscode.TextDocument
): Promise<boolean> {
  const txt = document.getText();
  const prompt = extractTagInner(txt, "PlanPrompt");
  if (!prompt) return false;
  await setPlanPrompt(context, prompt.trim());
  return true;
}

export function registerSavePlanPromptFromEditor(
  context: vscode.ExtensionContext
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "contextConsolidator.savePlanPromptFromActiveEditor",
      async () => {
        const ed = vscode.window.activeTextEditor;
        if (!ed) {
          vscode.window.showWarningMessage("No active editor.");
          return;
        }
        const ok = await savePlanPromptFromDocument(context, ed.document);
        if (!ok) {
          vscode.window.showErrorMessage("Missing <PlanPrompt>.");
          return;
        }
        vscode.window.showInformationMessage("Plan prompt saved.");
      }
    )
  );
}

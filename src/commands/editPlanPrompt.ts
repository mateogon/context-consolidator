import * as vscode from "vscode";
import { getPlanPrompt } from "../core/state";
import { planPromptEditorScaffold } from "../prompt/presets";

export function registerEditPlanPrompt(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("contextConsolidator.editPlanPrompt", async () => {
      const doc = await vscode.workspace.openTextDocument({
        content: planPromptEditorScaffold(getPlanPrompt(context)),
        language: "xml",
      });
      await vscode.window.showTextDocument(doc, { preview: false });
    })
  );
}

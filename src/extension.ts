// src/extension.ts
import * as vscode from "vscode";
import {
  adjustSnippetRangeLineByLineHybridEnhanced,
  updateHighlightsForDocument,
} from "./core/snippets";
import { consolidateItems, restoreFileItems } from "./core/state";
import { ConsolidateItemSnippet } from "./core/types";
import { statusBarItem, updateStatusBar } from "./ui/statusbar";
import { registerAddFolder } from "./commands/addFolder";
import { registerAddFiles } from "./commands/addFiles";
import { registerAddSnippet } from "./commands/addSnippet";
import { registerToggleItem } from "./commands/toggleItem";
import { registerShowMenu } from "./commands/showMenu";
import { registerCompose } from "./commands/composeToClipboard";
import { registerEditPreset } from "./commands/editPreset";
import { registerEditPlanPrompt } from "./commands/editPlanPrompt";
import {
  registerSavePresetFromEditor,
  savePresetFromDocument,
} from "./commands/savePresetFromEditor";
import {
  registerSavePlanPromptFromEditor,
  savePlanPromptFromDocument,
} from "./commands/savePlanPromptFromEditor";
import {
  PLAN_PROMPT_EDITOR_MARKER,
  PRESET_EDITOR_MARKER,
} from "./prompt/presets";
import { consolidatedDecorationProvider } from "./ui/decorations";
import { refreshUI } from "./ui/refresh";

export async function activate(context: vscode.ExtensionContext) {
  // Status bar
  statusBarItem.command = "contextConsolidator.showMenu";
  context.subscriptions.push(statusBarItem);

  // Commands
  registerAddFolder(context);
  registerAddFiles(context);
  registerAddSnippet(context);
  registerToggleItem(context);
  registerShowMenu(context);
  registerCompose(context);
  registerEditPreset(context);
  registerEditPlanPrompt(context);
  registerSavePresetFromEditor(context);
  registerSavePlanPromptFromEditor(context);

  // Decorations
  const debounceUpdates = new Map<string, ReturnType<typeof setTimeout>>();
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(consolidatedDecorationProvider)
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const affected = consolidateItems.filter(
        (i) => i.type === "snippet" && i.uri === e.document.uri.toString()
      ) as ConsolidateItemSnippet[];

      if (!affected.length) return;

      affected.forEach((sn) => {
        adjustSnippetRangeLineByLineHybridEnhanced(sn, e.document);
      });

      const key = e.document.uri.toString();
      const pending = debounceUpdates.get(key);
      if (pending) clearTimeout(pending);
      debounceUpdates.set(
        key,
        setTimeout(() => {
          debounceUpdates.delete(key);
          updateHighlightsForDocument(e.document);
          updateStatusBar(consolidateItems);
        }, 150)
      );
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      if (doc.languageId !== "xml") return;
      const txt = doc.getText();
      if (txt.includes(PRESET_EDITOR_MARKER)) {
        const ok = await savePresetFromDocument(context, doc);
        if (ok) vscode.window.showInformationMessage("Preset saved.");
        return;
      }
      if (txt.includes(PLAN_PROMPT_EDITOR_MARKER)) {
        const ok = await savePlanPromptFromDocument(context, doc);
        if (ok) vscode.window.showInformationMessage("Plan prompt saved.");
      }
    })
  );
  await restoreFileItems(context);
  await refreshUI(context);
  statusBarItem.show();
  // Optional: tests
  context.subscriptions.push(
    vscode.commands.registerCommand("extension_test.runTests", () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("./extension_test").runTestSuite();
    })
  );
}

export function deactivate() {}

// src/extension.ts
import * as vscode from "vscode";
import { adjustSnippetRangeLineByLineHybridEnhanced, updateHighlightsForDocument } from "./core/snippets";
import { restoreFileItems } from "./core/state";
import { statusBarItem, updateStatusBar } from "./ui/statusbar";
import { consolidateItems } from "./core/state";
import { registerAddFolder } from "./commands/addFolder";
import { registerAddFiles } from "./commands/addFiles";
import { registerAddSnippet } from "./commands/addSnippet";
import { registerToggleItem } from "./commands/toggleItem";
import { registerShowMenu } from "./commands/showMenu";
import { registerCompose } from "./commands/composeToClipboard";
import { registerEditPreset } from "./commands/editPreset";
import { registerSavePresetFromEditor } from "./commands/savePresetFromEditor";
import { ConsolidatedDecoration } from "./ui/decorations";

export async function activate(context: vscode.ExtensionContext) {
  // Status bar
  statusBarItem.command = "extension.showConsolidateMenu";
  context.subscriptions.push(statusBarItem);
  await restoreFileItems(context);
  updateStatusBar(consolidateItems);
  statusBarItem.show();

  // Commands
  registerAddFolder(context);
  registerAddFiles(context);
  registerAddSnippet(context);
  registerToggleItem(context);
  registerShowMenu(context);
  registerCompose(context);
  registerEditPreset(context);
  registerSavePresetFromEditor(context);

  // Decorations
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(new ConsolidatedDecoration())
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const affected = consolidateItems.filter(
        (i) => i.type === "snippet" && i.uri === e.document.uri.toString()
      ) as any[];

      if (!affected.length) return;

      affected.forEach((sn) =>
        adjustSnippetRangeLineByLineHybridEnhanced(sn, e.document)
      );

      updateHighlightsForDocument(e.document);
      updateStatusBar(consolidateItems);
    })
  );
  // Optional: tests
  context.subscriptions.push(
    vscode.commands.registerCommand("extension_test.runTests", () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("./extension_test").runTestSuite();
    })
  );
}

export function deactivate() {}

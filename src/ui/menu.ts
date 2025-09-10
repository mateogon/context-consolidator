// src/ui/menu.ts
import * as vscode from "vscode";
import {
  consolidateItems,
  persistFileItems,
  getOptions,
  setOptions,
} from "../core/state";
import { composePromptToClipboard } from "../prompt/clipboard";
import { cycle } from "../utils/strings";
import { PromptOptions, ReasoningEffort, Verbosity } from "../core/types";
import { weightEmojiDynamic } from "../core/token";
import { presetEditorScaffold } from "../prompt/presets";
import { extractTagInner } from "../utils/strings";
import { updateStatusBar } from "./statusbar";

export function registerMenuCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showConsolidateMenu", () => {
      const qp = vscode.window.createQuickPick<
        vscode.QuickPickItem & { action?: () => void }
      >();
      qp.title = "Context Consolidator";

      const rebuild = () => {
        const opts = getOptions(context);
        const buttons: ((typeof qp.items)[number] & { action: () => void })[] =
          [
            {
              label: "$(file-add) Consolidate (TaskSpec) → Clipboard",
              action: async () => {
                await composePromptToClipboard(context);
                qp.hide();
              },
            },
            {
              label: `$(tools) Advanced sections (${opts.includeAdvancedSections ? "ON" : "OFF"})`,
              action: async () => {
                await setOptions(context, {
                  ...opts,
                  includeAdvancedSections: !opts.includeAdvancedSections,
                });
                rebuild();
              },
            },
            {
              label: `$(rocket) Reasoning: ${opts.reasoningEffort} (cycle)`,
              action: async () => {
                await setOptions(context, {
                  ...opts,
                  reasoningEffort: cycle<ReasoningEffort>(
                    opts.reasoningEffort,
                    ["low", "medium", "high"]
                  ),
                });
                rebuild();
              },
            },
            {
              label: `$(megaphone) Verbosity: ${opts.verbosity} (cycle)`,
              action: async () => {
                await setOptions(context, {
                  ...opts,
                  verbosity: cycle<Verbosity>(opts.verbosity, [
                    "low",
                    "medium",
                    "high",
                  ]),
                });
                rebuild();
              },
            },
            {
              label: "$(edit) Edit Prompt Preset (Advanced Sections)…",
              action: async () => {
                const doc = await vscode.workspace.openTextDocument({
                  content: presetEditorScaffold(
                    require("../core/state").getPreset(context)
                  ),
                  language: "xml",
                });
                await vscode.window.showTextDocument(doc, { preview: false });
              },
            },
            {
              label: "$(save) Save Preset From Active Editor",
              action: async () => {
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
                await require("../core/state").setPreset(context, {
                  generalGuidelines: gg.trim(),
                  codingDirectives: cd.trim(),
                });
                vscode.window.showInformationMessage("Preset saved ✔");
              },
            },
            {
              label: "$(clear-all) Clear List",
              action: () => {
                consolidateItems.length = 0;
                updateStatusBar(consolidateItems);
                persistFileItems(context);
                rebuild();
              },
            },
            { label: "", kind: vscode.QuickPickItemKind.Separator } as any,
          ];

        const totalTok =
          consolidateItems.reduce(
            (a, b) => a + require("../core/token").itemTokenCount(b),
            0
          ) || 1;
        const avgTok = totalTok / (consolidateItems.length || 1);
        const rows = consolidateItems.map((item, idx) => {
          const rel = vscode.workspace.asRelativePath(
            vscode.Uri.parse(item.uri)
          );
          const tok = require("../core/token").itemTokenCount(item);
          const lines = require("../core/token").itemLineCount(item);
          const pct = ((tok / totalTok) * 100).toFixed(1);
          const emoji = weightEmojiDynamic(tok, lines, tok / totalTok, avgTok);
          const labelCore =
            item.type === "file"
              ? `${rel}`
              : `${rel} (lines ${item.range.start.line + 1}-${item.range.end.line + 1})`;
          return {
            label: `$(trash) ${emoji} ${labelCore} – ${tok} tok (${pct}%)`,
            action: () => {
              consolidateItems.splice(idx, 1);
              updateStatusBar(consolidateItems);
              persistFileItems(context);
              rebuild();
            },
          };
        });

        qp.items = [...buttons, ...rows];
      };

      rebuild();
      qp.onDidAccept(() => (qp.selectedItems[0] as any)?.action?.());
      qp.onDidHide(() => qp.dispose());
      qp.show();
    })
  );
}

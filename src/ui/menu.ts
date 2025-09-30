import * as vscode from "vscode";
import {
  consolidateItems,
  persistFileItems,
  getOptions,
  setOptions,
  replaceConsolidateItems,
  getPreset,
  setPreset,
} from "../core/state";
import {
  composePromptToClipboard,
  copyConsolidatedContextToClipboard,
} from "../prompt/clipboard";
import { cycle, extractTagInner } from "../utils/strings";
import {
  ConsolidateItem,
  HistoryEntry,
  PresetEntry,
  ReasoningEffort,
  Verbosity,
} from "../core/types";
import {
  itemTokenCount,
  itemLineCount,
  weightEmojiDynamic,
} from "../core/token";
import { presetEditorScaffold } from "../prompt/presets";
import { updateStatusBar } from "./statusbar";
import {
  addPreset,
  clearHistory,
  clearPresets,
  deleteHistoryEntry,
  deletePreset,
  loadHistory,
  loadPresets,
  renamePreset,
} from "../core/history";
import { updateHighlightsForDocument } from "../core/snippets";

type MenuView = "items" | "history";

type ActionItem = vscode.QuickPickItem & {
  action?: () => void | Promise<void>;
};

type HistoryQuickPickItem = ActionItem & {
  entry?: HistoryEntry | PresetEntry;
};

function cloneItems(items: ConsolidateItem[]): ConsolidateItem[] {
  return items.map((item) => {
    if (item.type === "file") return { ...item };
    const start = new vscode.Position(
      item.range.start.line,
      item.range.start.character
    );
    const end = new vscode.Position(
      item.range.end.line,
      item.range.end.character
    );
    return {
      type: "snippet",
      uri: item.uri,
      range: new vscode.Range(start, end),
      originalText: item.originalText,
      text: item.text,
      contextBefore: item.contextBefore,
      contextAfter: item.contextAfter,
    };
  });
}

function detailForItems(items: ConsolidateItem[]): string {
  return items
    .map((item) => {
      const rel = vscode.workspace.asRelativePath(vscode.Uri.parse(item.uri));
      if (item.type === "snippet") {
        const { start, end } = item.range;
        return `${rel} (lines ${start.line + 1}-${end.line + 1})`;
      }
      return item.includeContent ? rel : `${rel} (metadata only)`;
    })
    .join("\n");
}

export function registerMenuCommand(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showConsolidateMenu", () => {
      const qp = vscode.window.createQuickPick<ActionItem | HistoryQuickPickItem>();
      qp.title = "Context Consolidator";

      const refreshAfterMutation = async () => {
        updateStatusBar(consolidateItems);
        await persistFileItems(context);
        vscode.window.visibleTextEditors.forEach((editor) =>
          updateHighlightsForDocument(editor.document)
        );
      };

      const saveCurrentListAsPreset = async () => {
        if (!consolidateItems.length) {
          vscode.window.showInformationMessage("List is empty.");
          return;
        }
        const name = await vscode.window.showInputBox({
          prompt: "Preset name",
          ignoreFocusOut: true,
        });
        const trimmed = name?.trim();
        if (!trimmed) return;
        const preset = await addPreset(
          context,
          trimmed,
          cloneItems(consolidateItems)
        );
        if (!preset) {
          vscode.window.showWarningMessage(
            "Presets are disabled for this workspace."
          );
          return;
        }
        vscode.window.showInformationMessage(`Preset “${preset.name}” saved ✔`);
      };

      const runWithBusy = async (fn: () => Promise<void>) => {
        qp.busy = true;
        try {
          await fn();
        } finally {
          qp.busy = false;
        }
      };

      const restoreEntry = async (entry: HistoryEntry | PresetEntry) => {
        await runWithBusy(async () => {
          await replaceConsolidateItems(cloneItems(entry.items));
          await refreshAfterMutation();
          view = "items";
          await rebuild();
        });
        const label = "name" in entry
          ? `Preset “${entry.name}”`
          : `Snapshot ${new Date(entry.ts).toLocaleTimeString()}`;
        vscode.window.showInformationMessage(`${label} restored ✔`);
      };

      let view: MenuView = "items";

      const buildItemsView = async () => {
        qp.placeholder = "Select an entry to remove it";
        qp.matchOnDescription = false;
        qp.matchOnDetail = false;

        const opts = getOptions(context);
        const totalTokens = consolidateItems.reduce(
          (sum, item) => sum + itemTokenCount(item),
          0
        );
        const denom = totalTokens || 1;
        const avgTok =
          consolidateItems.length > 0
            ? totalTokens / consolidateItems.length
            : 0;

        const items: ActionItem[] = [
          {
            label: "$(file-add) Consolidate (TaskSpec) → Clipboard",
            action: async () => {
              await composePromptToClipboard(context);
              qp.hide();
            },
          },
          {
            label: "$(file-code) Copy Consolidated Files Context",
            action: async () => {
              await copyConsolidatedContextToClipboard(context);
              qp.hide();
            },
          },
          {
            label: "$(history) History & Presets…",
            action: async () => {
              view = "history";
              await rebuild();
            },
          },
          {
            label: "$(tag) Save Current List as Preset…",
            action: saveCurrentListAsPreset,
          },
          {
            label: `$(tools) Advanced sections (${opts.includeAdvancedSections ? "ON" : "OFF"})`,
            action: async () => {
              await setOptions(context, {
                ...opts,
                includeAdvancedSections: !opts.includeAdvancedSections,
              });
              await rebuild();
            },
          },
          {
            label: `$(rocket) Reasoning: ${opts.reasoningEffort} (cycle)`,
            action: async () => {
              await setOptions(context, {
                ...opts,
                reasoningEffort: cycle<ReasoningEffort>(opts.reasoningEffort, [
                  "low",
                  "medium",
                  "high",
                ]),
              });
              await rebuild();
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
              await rebuild();
            },
          },
          {
            label: "$(edit) Edit Prompt Preset (Advanced Sections)…",
            action: async () => {
              const doc = await vscode.workspace.openTextDocument({
                content: presetEditorScaffold(getPreset(context)),
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
              await setPreset(context, {
                generalGuidelines: gg.trim(),
                codingDirectives: cd.trim(),
              });
              vscode.window.showInformationMessage("Preset saved ✔");
            },
          },
          {
            label: "$(clear-all) Clear List",
            action: async () => {
              consolidateItems.length = 0;
              await refreshAfterMutation();
              await rebuild();
            },
          },
          { label: "", kind: vscode.QuickPickItemKind.Separator },
        ];

        const rows: ActionItem[] = consolidateItems.map((item, idx) => {
          const rel = vscode.workspace.asRelativePath(
            vscode.Uri.parse(item.uri)
          );
          const tok = itemTokenCount(item);
          const lines = itemLineCount(item);
          const pct = ((tok / denom) * 100).toFixed(1);
          const emoji = weightEmojiDynamic(tok, lines, tok / denom, avgTok);
          const labelCore =
            item.type === "file"
              ? `${rel}${item.includeContent ? "" : " (metadata)"}`
              : `${rel} (lines ${item.range.start.line + 1}-${
                  item.range.end.line + 1
                })`;
          return {
            label: `$(trash) ${emoji} ${labelCore} – ${tok} tok (${pct}%)`,
            action: async () => {
              consolidateItems.splice(idx, 1);
              await refreshAfterMutation();
              await rebuild();
            },
          };
        });

        qp.items = [...items, ...rows];
      };

      const buildHistoryView = async () => {
        qp.placeholder = "Browse history snapshots and saved presets";
        qp.matchOnDescription = true;
        qp.matchOnDetail = true;

        const presets = loadPresets(context);
        const history = loadHistory(context);

        const items: HistoryQuickPickItem[] = [
          {
            label: "$(arrow-left) Back to Current List",
            action: async () => {
              view = "items";
              await rebuild();
            },
          },
          {
            label: "$(tag) Save Current List as Preset…",
            action: async () => {
              await saveCurrentListAsPreset();
              await rebuild();
            },
          },
          {
            label: "$(trash) Clear History",
            action: async () => {
              await clearHistory(context);
              vscode.window.showInformationMessage("History cleared ✔");
              await rebuild();
            },
          },
          {
            label: "$(trash) Clear Presets",
            action: async () => {
              await clearPresets(context);
              vscode.window.showInformationMessage("Presets cleared ✔");
              await rebuild();
            },
          },
        ];

        items.push({ label: "", kind: vscode.QuickPickItemKind.Separator });

        if (presets.length) {
          items.push({ label: "Presets (manual)", kind: vscode.QuickPickItemKind.Separator });
          for (const entry of presets) {
            items.push({
              label: `$(tag) ${entry.name} — ${entry.items.length} items`,
              description: entry.description,
              detail: detailForItems(entry.items),
              entry,
              buttons: [
                { iconPath: new vscode.ThemeIcon("arrow-left"), tooltip: "Restore" },
                { iconPath: new vscode.ThemeIcon("pencil"), tooltip: "Rename" },
                { iconPath: new vscode.ThemeIcon("trash"), tooltip: "Delete" },
              ],
              action: async () => {
                await restoreEntry(entry);
              },
            });
          }
        }

        if (history.length) {
          items.push({ label: "History (auto)", kind: vscode.QuickPickItemKind.Separator });
          for (const entry of history) {
            const when = new Date(entry.ts).toLocaleString();
            const tokens = entry.totalTokens.toLocaleString();
            items.push({
              label: `$(history) ${when} — ${entry.items.length} items · ${tokens} tok`,
              detail: detailForItems(entry.items),
              entry,
              buttons: [
                { iconPath: new vscode.ThemeIcon("arrow-left"), tooltip: "Restore" },
                { iconPath: new vscode.ThemeIcon("trash"), tooltip: "Delete" },
              ],
              action: async () => {
                await restoreEntry(entry);
              },
            });
          }
        }

        qp.items = items;
      };

      const rebuild = async () => {
        if (view === "items") await buildItemsView();
        else await buildHistoryView();
      };

      void rebuild();

      qp.onDidAccept(async () => {
        const selected = qp.selectedItems[0] as ActionItem | undefined;
        if (!selected?.action) return;
        await runWithBusy(async () => {
          await Promise.resolve(selected.action());
        });
      });

      qp.onDidTriggerItemButton(async (event) => {
        if (view !== "history") return;
        const item = event.item as HistoryQuickPickItem;
        const entry = item.entry;
        if (!entry) return;
        const tooltip = event.button.tooltip;
        if (tooltip === "Restore") {
          await restoreEntry(entry);
        } else if (tooltip === "Delete") {
          if ("name" in entry) {
            await deletePreset(context, entry.id);
            vscode.window.showInformationMessage("Preset deleted ✔");
          } else {
            await deleteHistoryEntry(context, entry.id);
            vscode.window.showInformationMessage("Snapshot deleted ✔");
          }
          await rebuild();
        } else if (tooltip === "Rename" && "name" in entry) {
          const name = await vscode.window.showInputBox({
            prompt: "Rename preset",
            value: entry.name,
            ignoreFocusOut: true,
          });
          const trimmed = name?.trim();
          if (!trimmed) return;
          await renamePreset(context, entry.id, trimmed);
          vscode.window.showInformationMessage("Preset renamed ✔");
          await rebuild();
        }
      });

      qp.onDidHide(() => qp.dispose());
      qp.show();
    })
  );
}

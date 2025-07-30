import * as vscode from 'vscode';
import { ConsolidateItem } from './types';
import { showHistoryAndPresetsUI } from './historyAndPresetsUI';
import { itemTokenCount, itemLineCount, calcTotals, weightEmojiDynamic } from './extension';
import { loadPresets, savePresets, PresetEntry } from './lists';

export function showManagerUI(context: vscode.ExtensionContext, consolidateItems: ConsolidateItem[], updateConsolidateItems: (items: ConsolidateItem[]) => void) {
    const qp = vscode.window.createQuickPick<vscode.QuickPickItem & { action?: () => void }>();
    qp.title = 'Context Consolidator';
    qp.placeholder = 'Filter by file name…';
    qp.buttons = [
        { iconPath: new vscode.ThemeIcon('clippy'), tooltip: 'Copy to Clipboard' },
    ];
    async function saveCurrentListAsPreset(): Promise<void> {
        const name = await vscode.window.showInputBox({ prompt: 'Enter preset name' });
        if (!name) { return; }
    
        const presets = loadPresets(context);
        const newPreset: PresetEntry = {
            id: crypto.randomUUID(),
            name,
            items: JSON.parse(JSON.stringify(consolidateItems)),
            totalTok: consolidateItems.reduce((sum, it) => sum + itemTokenCount(it), 0),
        };
        presets.push(newPreset);
        await savePresets(context, presets);
    
        vscode.window.showInformationMessage(`Preset “${name}” saved ✔`);
    }
    
    const rebuild = () => {
        const totalTok = calcTotals();
        const avgTok = totalTok / consolidateItems.length || 0;

        const rows = consolidateItems.map((item, idx) => {
            const rel = vscode.workspace.asRelativePath(vscode.Uri.parse(item.uri));
            const tok = itemTokenCount(item);
            const lines = itemLineCount(item);
            const pct = ((tok / totalTok) * 100).toFixed(1);
            const emoji = weightEmojiDynamic(tok, lines, tok / totalTok, avgTok);
            const tokensLabel = `${tok} tok (${pct}%)`;

            const labelCore =
                item.type === 'file'
                    ? `${rel}${item.includeContent ? '' : ' (skipped)'}`
                    : `${rel} (lines ${item.range.start.line + 1}-${item.range.end.line + 1})`;

            return {
                label: `$(trash) ${emoji} ${labelCore} – ${tokensLabel}`,
                action: () => {
                    consolidateItems.splice(idx, 1);
                    updateConsolidateItems(consolidateItems);
                    rebuild();
                },
            };
        });

        qp.items = [
            { label: 'Actions', kind: vscode.QuickPickItemKind.Separator },
            { label: `$(clippy) Copy to Clipboard`, action: () => {
                vscode.commands.executeCommand('extension.consolidate', 'clipboard');
                qp.hide();
            } },
            { label: `$(history) History & Presets`, action: () => {
                qp.hide();
                showHistoryAndPresetsUI(context, consolidateItems, updateConsolidateItems, () => {
                    showManagerUI(context, consolidateItems, updateConsolidateItems);
                });
            } },
            { label: `$(save) Save to File...`, action: () => {
                vscode.commands.executeCommand('extension.consolidate', 'file');
                qp.hide();
            } },
            { label: `$(save) Save Current List as Preset…`, action: async () => {
                await saveCurrentListAsPreset();
                // No cierres el QuickPick; el usuario puede querer seguir allí
          } },
            { label: `$(trash) Clear List`, action: () => {
                consolidateItems = [];
                updateConsolidateItems(consolidateItems);
                rebuild();
            } },
            { label: 'File List', kind: vscode.QuickPickItemKind.Separator },
            ...rows
        ];
    };

    qp.onDidTriggerButton(async (button) => {
        if (button.tooltip === 'History & Presets') {
            qp.hide();
            showHistoryAndPresetsUI(context, consolidateItems, updateConsolidateItems, () => {
                showManagerUI(context, consolidateItems, updateConsolidateItems);
            });
        } else if (button.tooltip === 'Copy to Clipboard') {
            vscode.commands.executeCommand('extension.consolidate', 'clipboard');
            qp.hide();
        } else if (button.tooltip === 'Save to File...') {
            vscode.commands.executeCommand('extension.consolidate', 'file');
            qp.hide();
        } else if (button.tooltip === 'Clear List') {
            consolidateItems = [];
            updateConsolidateItems(consolidateItems);
            rebuild();
        }
    });

    qp.onDidAccept(() => {
        const selected = qp.selectedItems[0] as any;
        if (selected && selected.action) {
            selected.action();
        }
    });

    qp.onDidHide(() => qp.dispose());

    rebuild();
    qp.show();
}

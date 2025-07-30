import * as vscode from 'vscode';
import { HistoryEntry, PresetEntry, loadHistory, loadPresets, savePresets, saveHistory } from './lists';
import { ConsolidateItem } from './types';
import { itemTokenCount } from './extension';

let history: HistoryEntry[] = [];
let presets: PresetEntry[] = [];
let currentPresetId: string | undefined;

interface CustomQuickPickItem extends vscode.QuickPickItem {
    action?: () => void;
    entry?: HistoryEntry | PresetEntry;
}

export function showHistoryAndPresetsUI(context: vscode.ExtensionContext, consolidateItems: ConsolidateItem[], updateConsolidateItems: (items: ConsolidateItem[]) => void, onBack: () => void) {
    history = loadHistory(context);
    presets = loadPresets(context);

    const qp = vscode.window.createQuickPick<CustomQuickPickItem>();
    qp.title = 'Context Consolidator: History & Presets';
    qp.buttons = [
        { iconPath: new vscode.ThemeIcon('arrow-left'), tooltip: 'Back to File List' },
        { iconPath: new vscode.ThemeIcon('save'), tooltip: 'Save Current List as Preset...' },
        { iconPath: new vscode.ThemeIcon('trash'), tooltip: 'Clear History' },
        { iconPath: new vscode.ThemeIcon('trash'), tooltip: 'Clear Presets' },
    ];
    
    let reopenOnHide = false;     // → reabrir History/Presets
    let goBackOnHide = false;     // → volver al File List

    qp.placeholder = 'Filter by preset or file name…';
    qp.matchOnDescription = true;   // ← incluye “description”
    qp.matchOnDetail      = true;   // ← incluye “detail” (nuestro fileList)

    const rebuild = () => {
        const items: CustomQuickPickItem[] = [];   // ← usa tu propio tipo

        items.push({ label: 'Presets (manual)', kind: vscode.QuickPickItemKind.Separator });
        presets.forEach(entry => {
            const fileList = entry.items
                .map(item => vscode.workspace.asRelativePath(vscode.Uri.parse(item.uri)))
                .join('\n');
    
            items.push({
                label: `$(tag) ${entry.name} — ${entry.items.length} items`,
                description: entry.desc,
                detail: fileList,                       // ← antes era tooltip
                buttons: [
                    { iconPath: new vscode.ThemeIcon('arrow-left'), tooltip: 'Restore' },
                    { iconPath: new vscode.ThemeIcon('pencil'),     tooltip: 'Rename' },
                    { iconPath: new vscode.ThemeIcon('trash'),      tooltip: 'Delete' },
                ],
                entry
            });
        });
    
        // ----- History -----
        items.push({ label: 'History (auto)', kind: vscode.QuickPickItemKind.Separator });
    
        history.forEach(entry => {
            const fileList = entry.items
                .map(item => vscode.workspace.asRelativePath(vscode.Uri.parse(item.uri)))
                .join('\n');
            const tok = entry.totalTok || entry.items.reduce((s,i) => s + itemTokenCount(i), 0);
            items.push({
                label: `$(history) ${new Date(entry.ts).toLocaleTimeString()} — ${entry.items.length} items · ${tok} tok`,
                detail: fileList,                       // ← igual que arriba
                buttons: [
                    { iconPath: new vscode.ThemeIcon('arrow-left'), tooltip: 'Restore' },
                    { iconPath: new vscode.ThemeIcon('trash'),      tooltip: 'Delete' },
                ],
                entry
            });
        });
    
        qp.items = items;
    };

    qp.onDidTriggerItemButton(async (e) => {
        const entry = (e.item as any).entry as HistoryEntry | PresetEntry;
    
        switch (e.button.tooltip) {
            case 'Delete':
                if ('ts' in entry) {
                    history = history.filter(h => h.id !== entry.id);
                    await saveHistory(context, history);
                } else {
                    presets = presets.filter(p => p.id !== entry.id);
                    await savePresets(context, presets);
                }
                rebuild();                        // QuickPick sigue abierto
                break;
    
            case 'Rename':
                reopenOnHide = true;              // señalo que quiero reabrir
                const newName = await vscode.window.showInputBox({
                    prompt: 'Enter new preset name',
                    value: (entry as PresetEntry).name,
                    ignoreFocusOut: true          // evita cierres accidentales
                });
                if (newName) {
                    (entry as PresetEntry).name = newName;
                    await savePresets(context, presets);
                }
                /* QuickPick se cerrará solo ⇒ onDidHide hará el reopen */
                break;
    
            case 'Restore':
                updateConsolidateItems(entry.items);
                currentPresetId = 'ts' in entry ? undefined : entry.id;
                goBackOnHide = true;              // queremos file‑list
                qp.hide();                        // dispara onDidHide
                break;
        }
    });

    qp.onDidTriggerButton(async (button) => {
        if (button.tooltip === 'Back to File List') {
            qp.hide();
            onBack();
        } else if (button.tooltip === 'Save Current List as Preset...') {
            const name = await vscode.window.showInputBox({ prompt: 'Enter preset name' });
            if (name) {
                const newPreset: PresetEntry = {
                    id: crypto.randomUUID(),
                    name,
                    items: JSON.parse(JSON.stringify(consolidateItems)),
                    totalTok: consolidateItems.reduce((acc, item) => acc + itemTokenCount(item), 0),
                };
                presets.push(newPreset);
                await savePresets(context, presets);
                rebuild();
            }
        } else if (button.tooltip === 'Clear History') {
            history = [];
            await saveHistory(context, history);
            rebuild();
        } else if (button.tooltip === 'Clear Presets') {
            presets = [];
            await savePresets(context, presets);
            rebuild();
        }
    });

    qp.onDidAccept(() => {
        const selected = qp.selectedItems[0] as any;
        if (selected && selected.entry) {
            updateConsolidateItems(selected.entry.items);
            currentPresetId = 'ts' in selected.entry ? undefined : selected.entry.id;
            qp.hide();
        }
    });

    qp.onDidHide(() => {
        qp.dispose();               // siempre limpiamos la instancia
    
        if (reopenOnHide) {         // vuelvo a abrir esta misma vista
            reopenOnHide = false;
            showHistoryAndPresetsUI(context, consolidateItems, updateConsolidateItems, onBack);
        } else if (goBackOnHide) {  // o regreso al File List
            goBackOnHide = false;
            onBack();
        }
    });

    rebuild();
    qp.show();
}

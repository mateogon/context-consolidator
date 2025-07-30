import * as assert from 'assert';
import * as vscode from 'vscode';
import { loadHistory, saveHistory, addHistorySnapshot, loadPresets, savePresets } from '../lists';
import { ConsolidateItem } from '../types';

suite('Lists Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    const mockContext: any = {
        workspaceState: {
            get: (key: string, defaultValue: any) => {
                return mockContext.workspaceState[key] || defaultValue;
            },
            update: (key: string, value: any) => {
                mockContext.workspaceState[key] = value;
                return Promise.resolve();
            }
        }
    };

    const testItems: ConsolidateItem[] = [
        { type: 'file', uri: 'file:///test.txt', includeContent: true },
    ];

    test('History functions', async () => {
        await saveHistory(mockContext, []);
        let history = loadHistory(mockContext);
        assert.strictEqual(history.length, 0);

        await addHistorySnapshot(mockContext, testItems);
        history = loadHistory(mockContext);
        assert.strictEqual(history.length, 1);
        assert.deepStrictEqual(history[0].items, testItems);
    });

    test('Preset functions', async () => {
        await savePresets(mockContext, []);
        let presets = loadPresets(mockContext);
        assert.strictEqual(presets.length, 0);

        const newPreset = { id: '1', name: 'Test Preset', items: testItems, totalTok: 0 };
        await savePresets(mockContext, [newPreset]);
        presets = loadPresets(mockContext);
        assert.strictEqual(presets.length, 1);
        assert.deepStrictEqual(presets[0], newPreset);
    });
});

import * as vscode from 'vscode';
import * as testModule from './extension_test';
import * as DiffMatchPatch from 'diff-match-patch';
import * as path from 'path';

interface ConsolidateItem {
  type: 'file' | 'snippet';
  uri: string;
  range?: vscode.Range; // Dynamically updated based on changes
  originalText?: string; // Original snippet text for diff comparison
  text?: string;        // Current snapshot of the snippet
  contextBefore?: string;
  contextAfter?: string;
}

// Map to store original document text per file
const originalDocTexts: Map<string, string> = new Map();

let consolidateItems: ConsolidateItem[] = [];
let statusBarItem: vscode.StatusBarItem;

// Initialize diff-match-patch instance
const dmp = new DiffMatchPatch.diff_match_patch();

// Decoration for snippet highlights
const snippetDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: 'rgba(255,255,0,0.3)'
});

function getConsolidateHotkey(): string {
  const config = vscode.workspace.getConfiguration('contextConsolidator');
  return config.get('consolidateHotkey', 'ctrl+alt+c');
}

interface ConsolidatorQuickPickItem extends vscode.QuickPickItem {
  action?: 'consolidate' | 'clear' | 'remove';
  index?: number;
}

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBarItem.text = "Items to Consolidate (0)";
  statusBarItem.command = 'extension.showConsolidateMenu';
  context.subscriptions.push(statusBarItem);
  statusBarItem.show();

  const hotkey = getConsolidateHotkey();
  const keyboardShortcut = vscode.commands.registerTextEditorCommand(
    'extension.consolidateFiles',
    async () => await consolidateFiles()
  );
  context.subscriptions.push(
    keyboardShortcut,
    vscode.commands.registerCommand('extension.registerCustomHotkey', () => {
      vscode.window.showInformationMessage(`Current hotkey: ${hotkey}`);
    })
  );

  // Add Folder
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.addFolderToConsolidateList', async (uri: vscode.Uri) => {
      if (!uri) return;
      const files = await vscode.workspace.findFiles(new vscode.RelativePattern(uri.fsPath, '**/*'));
      files.forEach(file => consolidateItems.push({ type: 'file', uri: file.toString() }));
      updateStatusBar();
    })
  );

  // Add File
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.addToConsolidateList', async (uri: vscode.Uri) => {
      if (!uri) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        uri = editor.document.uri;
      }
      consolidateItems.push({ type: 'file', uri: uri.toString() });
      updateStatusBar();
    })
  );

  // Add Snippet
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.addSnippetToConsolidateList', () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showInformationMessage('No selection to add as snippet.');
        return;
      }
      const range = new vscode.Range(selection.start, selection.end);
      const originalText = editor.document.getText(range);
      let contextBefore = "";
      let contextAfter = "";
      if (selection.start.line > 0) {
        contextBefore = editor.document.lineAt(selection.start.line - 1).text;
      }
      if (selection.end.line < editor.document.lineCount - 1) {
        contextAfter = editor.document.lineAt(selection.end.line + 1).text;
      }
      // Store the original document text if not already stored
      const uriStr = editor.document.uri.toString();
      if (!originalDocTexts.has(uriStr)) {
        originalDocTexts.set(uriStr, editor.document.getText());
      }
      consolidateItems.push({
        type: 'snippet',
        uri: uriStr,
        range,
        originalText,
        text: originalText,
        contextBefore,
        contextAfter
      });
      updateStatusBar();
      updateHighlightsForDocument(editor.document);
    })
  );

  // Show Menu
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.showConsolidateMenu', () => {
      const quickPick = vscode.window.createQuickPick<ConsolidatorQuickPickItem>();
      quickPick.placeholder = 'Select an action or item to remove';

      const updateItems = () => {
        const itemLabels = consolidateItems.map((item, index) => {
          const uri = vscode.Uri.parse(item.uri);
          const label = vscode.workspace.asRelativePath(uri);
          if (item.type === 'file') {
            return { label: `${label} (entire file)`, action: 'remove' as 'remove', index };
          } else {
            const { range } = item;
            const startLine = range!.start.line + 1;
            const endLine = range!.end.line + 1;
            return { label: `${label} (snippet lines ${startLine}-${endLine})`, action: 'remove' as 'remove', index };
          }
        });
        quickPick.items = [
          { label: '$(file-add) Consolidate All', action: 'consolidate' as 'consolidate' },
          { label: '$(clear-all) Clear List', action: 'clear' as 'clear' },
          ...itemLabels
        ];
      };
      updateItems();

      quickPick.onDidChangeSelection(selection => {
        const item = selection[0];
        if (!item) return;
        if (item.action === 'consolidate') {
          consolidateFiles();
          quickPick.hide();
        } else if (item.action === 'clear') {
          consolidateItems = [];
          updateStatusBar();
          vscode.window.visibleTextEditors.forEach(editor => {
            editor.setDecorations(snippetDecorationType, []);
          });
          updateItems();
        } else if (item.action === 'remove' && typeof item.index === 'number') {
          const removed = consolidateItems.splice(item.index, 1)[0];
          updateStatusBar();
          if (removed.type === 'snippet') {
            const doc = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === removed.uri);
            if (doc) updateHighlightsForDocument(doc.document);
          }
          updateItems();
        }
      });
      quickPick.onDidHide(() => quickPick.dispose());
      quickPick.show();
    })
  );

  // Track snippet ranges using the new line-by-line strategy.
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
      const document = e.document;
      const docUri = document.uri.toString();
      const snippetItems = consolidateItems.filter(
        item => item.type === 'snippet' && item.uri === docUri
      );
      if (snippetItems.length === 0) return;

      snippetItems.forEach(item => adjustSnippetRange(item, document));
      updateHighlightsForDocument(document);
    })
  );

  // Register FileDecorationProvider
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(new ConsolidatedFileDecorationProvider())
  );
  // Register your test command.
    let disposable = vscode.commands.registerCommand('extension_test.runTests', () => {
      testModule.runTests();
    });
    context.subscriptions.push(disposable);
}

function updateStatusBar() {
  statusBarItem.text = `Items to Consolidate (${consolidateItems.length})`;
}

/**
 * Adjusts the snippet range using a line-by-line strategy.
 * It splits the original snippet and the current document text into lines,
 * finds the first and last lines of the snippet (trimmed), and remaps the snippet's range.
 */
function adjustSnippetRange(item: ConsolidateItem, document: vscode.TextDocument): void {
  if (item.type !== 'snippet' || !item.range || !item.originalText) return;

  const originalLines = item.originalText.split('\n').map(line => line.trim());
  const currentLines = document.getText().split('\n');

  // Use the first and last non-empty lines from the original snippet
  const firstLine = originalLines.find(line => line.length > 0);
  const lastLine = [...originalLines].reverse().find(line => line.length > 0);
  if (!firstLine || !lastLine) {
    console.log(`Snippet has no valid lines in ${item.uri}`);
    return;
  }

  let newStartLine = -1;
  let newEndLine = -1;

  // Find the first occurrence of the first line in the current document
  for (let i = 0; i < currentLines.length; i++) {
    if (currentLines[i].trim() === firstLine) {
      newStartLine = i;
      break;
    }
  }
  // Find the last occurrence of the last line in the current document
  for (let i = currentLines.length - 1; i >= 0; i--) {
    if (currentLines[i].trim() === lastLine) {
      newEndLine = i;
      break;
    }
  }

  if (newStartLine === -1 || newEndLine === -1) {
    console.log(`Snippet could not be located in ${item.uri}`);
    return;
  }

  const newStartPos = new vscode.Position(newStartLine, 0);
  const newEndPos = new vscode.Position(newEndLine, currentLines[newEndLine].length);
  item.range = new vscode.Range(newStartPos, newEndPos);
  item.text = document.getText(item.range);
  console.log(`Adjusted snippet for ${item.uri}: lines ${newStartLine + 1}-${newEndLine + 1}`);
}

/**
 * Updates highlights for snippets in the given document.
 */
function updateHighlightsForDocument(document: vscode.TextDocument): void {
  const docUri = document.uri.toString();
  const snippetItems = consolidateItems.filter(
    item => item.type === 'snippet' && item.uri === docUri
  );
  const newRanges: vscode.Range[] = snippetItems
    .filter(item => item.range)
    .map(item => item.range!);

  vscode.window.visibleTextEditors
    .filter(editor => editor.document.uri.toString() === docUri)
    .forEach(editor => {
      editor.setDecorations(snippetDecorationType, newRanges);
    });
}

/**
 * Consolidates files and snippets into XML format.
 */
async function consolidateFiles() {
  const docCache: { [uri: string]: vscode.TextDocument } = {};
  for (const item of consolidateItems) {
    if (!docCache[item.uri]) {
      try {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(item.uri));
        docCache[item.uri] = doc;
      } catch (e) {
        console.error(`Failed to open document ${item.uri}: ${e}`);
      }
    }
  }
  const uniqueUris = new Set(consolidateItems.map(item => item.uri));
  const fileList = Array.from(uniqueUris)
    .map(uri => vscode.workspace.asRelativePath(vscode.Uri.parse(uri)))
    .join('\n');
  const folderTreeXML = `<FolderTree>\n${fileList}\n</FolderTree>`;

  const codeXML = consolidateItems.map(item => {
    const uri = vscode.Uri.parse(item.uri);
    const relPath = vscode.workspace.asRelativePath(uri);
    if (item.type === 'file') {
      const doc = docCache[item.uri];
      if (!doc) return `<!-- Could not open file: ${relPath} -->`;
      return `<Code file="${relPath}">\n${doc.getText()}\n</Code>`;
    } else {
      const doc = docCache[item.uri];
      if (!doc || !item.range) return `<!-- Invalid snippet: ${relPath} -->`;
      const validatedRange = doc.validateRange(item.range);
      const snippetText = doc.getText(validatedRange);
      const startLine = validatedRange.start.line + 1;
      const endLine = validatedRange.end.line + 1;
      return `<Code file="${relPath}" snippet="lines ${startLine}-${endLine}">\n${snippetText}\n</Code>`;
    }
  }).join('\n');

  const finalContent = `<ConsolidatedFilesContext>\n${folderTreeXML}\n${codeXML}\n</ConsolidatedFilesContext>`;
  await vscode.env.clipboard.writeText(finalContent);

  let totalLines = 0, totalChars = 0;
  consolidateItems.forEach(item => {
    if (item.type === 'file') {
      const doc = docCache[item.uri];
      if (doc) {
        totalLines += doc.lineCount;
        totalChars += doc.getText().length;
      }
    } else if (item.range) {
      const doc = docCache[item.uri];
      if (doc) {
        const validatedRange = doc.validateRange(item.range);
        totalLines += validatedRange.end.line - validatedRange.start.line + 1;
        totalChars += doc.getText(validatedRange).length;
      }
    }
  });
  vscode.window.showInformationMessage(
    `Consolidated ${consolidateItems.length} item(s) to clipboard! Total Lines: ${totalLines}, Total Characters: ${totalChars}`
  );
}

// FileDecorationProvider: Marks consolidated files in the Explorer
class ConsolidatedFileDecorationProvider implements vscode.FileDecorationProvider {
  private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
  readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

  provideFileDecoration(uri: vscode.Uri): vscode.ProviderResult<vscode.FileDecoration> {
    if (consolidateItems.find(item => item.uri === uri.toString())) {
      return new vscode.FileDecoration(undefined, 'Consolidated', new vscode.ThemeColor('charts.blue'));
    }
    return undefined;
  }
}

export function deactivate() {
  // Clean up if necessary
}

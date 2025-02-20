import * as vscode from 'vscode';
import DiffMatchPatch from 'diff-match-patch';

interface ConsolidateItem {
  type: 'file' | 'snippet';
  uri: string;
  range?: vscode.Range; // originally selected range
  text?: string;        // snapshot of the selected snippet
  anchorStart?: string; // first line (trimmed) of the snippet
  anchorEnd?: string;   // last line (trimmed) of the snippet
}

let consolidateItems: ConsolidateItem[] = [];
let statusBarItem: vscode.StatusBarItem;

// Global diff-match-patch instance.
const dmp = new DiffMatchPatch();

// Decoration for snippet highlights.
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

  // Add Snippet – update highlights immediately.
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
      const text = editor.document.getText(range);
      // Get anchor lines: use the actual first and last lines of the selection.
      const anchorStart = editor.document.lineAt(selection.start.line).text.trim();
      const anchorEnd = editor.document.lineAt(selection.end.line).text.trim();
      consolidateItems.push({
        type: 'snippet',
        uri: editor.document.uri.toString(),
        range,
        text,
        anchorStart,
        anchorEnd
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
          // Clear highlights from all visible editors.
          vscode.window.visibleTextEditors.forEach(editor => {
            editor.setDecorations(snippetDecorationType, []);
          });
          updateItems();
        } else if (item.action === 'remove' && typeof item.index === 'number') {
          const removed = consolidateItems.splice(item.index, 1)[0];
          updateStatusBar();
          // If a snippet was removed, update highlights for that document.
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

  // Update snippet highlights on document changes.
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(e => {
      updateHighlightsForDocument(e.document);
    })
  );

  // Register a FileDecorationProvider to mark files in the Explorer.
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(new ConsolidatedFileDecorationProvider())
  );
}

function updateStatusBar() {
  statusBarItem.text = `Items to Consolidate (${consolidateItems.length})`;
}
// Helper: use patch_make/patch_apply to get the updated snippet block
function updateSnippetUsingPatch(item: ConsolidateItem, doc: vscode.TextDocument): { updatedText: string, newRange: vscode.Range } {
  const currentContent = doc.getText();
  const origSnippet = item.text!;
  const approxLoc = doc.offsetAt(item.range!.start);
  let matchIndex: number;

  // If snippet is longer than allowed for bitap matching, use indexOf
  if (origSnippet.length > dmp.Match_MaxBits) {
    matchIndex = currentContent.indexOf(origSnippet, approxLoc);
  } else {
    matchIndex = dmp.match_main(currentContent, origSnippet, approxLoc);
  }

  if (matchIndex < 0) {
    // If no match is found, fall back to the original snippet.
    return { updatedText: origSnippet, newRange: item.range! };
  }
  
  // Define a wide window to capture any extra lines.
  const windowEnd = Math.min(currentContent.length, matchIndex + origSnippet.length + 500);
  const windowText = currentContent.substring(matchIndex, windowEnd);
  
  // Generate a patch from the original snippet to the current window.
  const patches = dmp.patch_make(origSnippet, windowText);
  const [patchedText, patchResults] = dmp.patch_apply(patches, origSnippet);
  
  // Now, locate the patched text in the current file using indexOf.
  const updatedIndex = currentContent.indexOf(patchedText, matchIndex);
  if (updatedIndex < 0) {
    return { updatedText: origSnippet, newRange: item.range! };
  }
  
  const newStart = doc.positionAt(updatedIndex);
  const newEnd = doc.positionAt(updatedIndex + patchedText.length);
  const newRange = new vscode.Range(newStart, newEnd);
  const updatedText = doc.getText(newRange);
  
  return { updatedText, newRange };
}


/**
 * Updates snippet highlights for the given document.
 * Finds all snippet items for the document, runs diff-match-patch to re-locate them,
 * and then sets decorations accordingly.
 */
function updateHighlightsForDocument(document: vscode.TextDocument) {
  const docUri = document.uri.toString();
  const snippetItems = consolidateItems.filter(item => item.type === 'snippet' && item.uri === docUri);
  let newRanges: vscode.Range[] = [];
  snippetItems.forEach(item => {
    // Use stored range start as an approximate location.
    const approxLoc = document.offsetAt(item.range!.start);
    const matchIndex = dmp.match_main(document.getText(), item.text!, approxLoc);
    if (matchIndex >= 0) {
      const newStart = document.positionAt(matchIndex);
      const newEnd = document.positionAt(matchIndex + item.text!.length);
      const newRange = new vscode.Range(newStart, newEnd);
      // Update the stored range.
      item.range = newRange;
      newRanges.push(newRange);
    }
  });
  // Update decorations in all visible editors for this document.
  vscode.window.visibleTextEditors
    .filter(editor => editor.document.uri.toString() === docUri)
    .forEach(editor => {
      editor.setDecorations(snippetDecorationType, newRanges);
    });
}

async function consolidateFiles() {
  // Build a cache of open documents.
  const docCache: { [uri: string]: vscode.TextDocument } = {};
  for (const item of consolidateItems) {
    if (!docCache[item.uri]) {
      try {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(item.uri));
        docCache[item.uri] = doc;
      } catch (e) {
        // Ignore errors.
      }
    }
  }
  // Create folder tree XML.
  const uniqueUris = new Set(consolidateItems.map(item => item.uri));
  const fileList = Array.from(uniqueUris)
    .map(uri => vscode.workspace.asRelativePath(vscode.Uri.parse(uri)))
    .join('\n');
  const folderTreeXML = `<FolderTree>\n${fileList}\n</FolderTree>`;

  // Use diff-match-patch to re-locate snippet ranges for consolidation.
  const codeXML = consolidateItems.map(item => {
    const uri = vscode.Uri.parse(item.uri);
    const path = vscode.workspace.asRelativePath(uri);
    if (item.type === 'file') {
      const doc = docCache[item.uri];
      if (!doc) return `<!-- Could not open file: ${path} -->`;
      return `<Code file="${path}">\n${doc.getText()}\n</Code>`;
    // In consolidateFiles(), for snippet items:
  } else {
    let snippetText = item.text!;
    let startLine = item.range!.start.line + 1;
    let endLine = item.range!.end.line + 1;
    const doc = docCache[item.uri];
    if (doc) {
      const { updatedText, newRange } = updateSnippetUsingPatch(item, doc);
      snippetText = updatedText;
      startLine = newRange.start.line + 1;
      endLine = newRange.end.line + 1;
      item.range = newRange;
    }
    return `<Code file="${path}" snippet="lines ${startLine}-${endLine}">\n${snippetText}\n</Code>`;
  }
  
  
  }).join('\n');

  const finalContent = `<ConsolidatedFilesContext>\n${folderTreeXML}\n${codeXML}\n</ConsolidatedFilesContext>`;
  await vscode.env.clipboard.writeText(finalContent);

  // Stats
  let totalLines = 0, totalChars = 0;
  consolidateItems.forEach(item => {
    if (item.type === 'file') {
      const doc = docCache[item.uri];
      if (doc) {
        totalLines += doc.lineCount;
        totalChars += doc.getText().length;
      }
    } else {
      totalLines += item.text!.split('\n').length;
      totalChars += item.text!.length;
    }
  });
  vscode.window.showInformationMessage(
    `Consolidated ${consolidateItems.length} item(s) to clipboard! Total Lines: ${totalLines}, Total Characters: ${totalChars}`
  );
}

// FileDecorationProvider: Marks consolidated files in the Explorer.
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

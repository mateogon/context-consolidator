import * as vscode from 'vscode';

interface ConsolidateItem {
  type: 'file' | 'snippet';
  uri: string;
  range?: vscode.Range; // For snippets: start and end positions
  text?: string;        // For snippets: the selected code
}
let consolidateItems: ConsolidateItem[] = [];
let statusBarItem: vscode.StatusBarItem;

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

  context.subscriptions.push(
    // Add Folder
    vscode.commands.registerCommand('extension.addFolderToConsolidateList', async (uri: vscode.Uri) => {
      if (!uri) return;
      const files = await vscode.workspace.findFiles(new vscode.RelativePattern(uri.fsPath, '**/*'));
      files.forEach(file => consolidateItems.push({ type: 'file', uri: file.toString() }));
      updateStatusBar();
    }),
    // Add File
    vscode.commands.registerCommand('extension.addToConsolidateList', async (uri: vscode.Uri) => {
      if (!uri) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        uri = editor.document.uri;
      }
      consolidateItems.push({ type: 'file', uri: uri.toString() });
      updateStatusBar();
    }),
    // Add Snippet
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
      consolidateItems.push({
        type: 'snippet',
        uri: editor.document.uri.toString(),
        range,
        text
      });
      updateStatusBar();
    }),
    // Show Menu
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
          updateItems();
        } else if (item.action === 'remove' && typeof item.index === 'number') {
          consolidateItems.splice(item.index, 1);
          updateStatusBar();
          updateItems();
        }
      });
      quickPick.onDidHide(() => quickPick.dispose());
      quickPick.show();
    })
  );
}

function updateStatusBar() {
  statusBarItem.text = `Items to Consolidate (${consolidateItems.length})`;
}

async function consolidateFiles() {
  // Load documents for entire files only
  const docs = await Promise.all(
    consolidateItems.map(async item => {
      if (item.type === 'file') return vscode.workspace.openTextDocument(vscode.Uri.parse(item.uri));
      return null;
    })
  );
  const fileDocs = docs.filter(doc => doc !== null) as vscode.TextDocument[];

  // Folder Tree: List unique file paths
  const uniqueUris = new Set(consolidateItems.map(item => item.uri));
  const fileList = Array.from(uniqueUris)
    .map(uri => vscode.workspace.asRelativePath(vscode.Uri.parse(uri)))
    .join('\n');
  const folderTreeXML = `<FolderTree>\n${fileList}\n</FolderTree>`;

  // Code Blocks
  const codeXML = consolidateItems.map(item => {
    const uri = vscode.Uri.parse(item.uri);
    const path = vscode.workspace.asRelativePath(uri);
    if (item.type === 'file') {
      const doc = fileDocs.find(d => d.uri.toString() === item.uri);
      if (!doc) return `<!-- Could not open file: ${path} -->`;
      return `<Code file="${path}">\n${doc.getText()}\n</Code>`;
    } else {
      const { range, text } = item;
      const startLine = range!.start.line + 1;
      const endLine = range!.end.line + 1;
      return `<Code file="${path}" snippet="lines ${startLine}-${endLine}">\n${text}\n</Code>`;
    }
  }).join('\n');

  const finalContent = `<ConsolidatedFilesContext>\n${folderTreeXML}\n${codeXML}\n</ConsolidatedFilesContext>`;
  await vscode.env.clipboard.writeText(finalContent);

  // Stats
  let totalLines = 0, totalChars = 0;
  consolidateItems.forEach(item => {
    if (item.type === 'file') {
      const doc = fileDocs.find(d => d.uri.toString() === item.uri);
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

// Note: Add export function deactivate() if needed
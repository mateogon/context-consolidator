import * as vscode from 'vscode';

let filesToConsolidate = new Set<string>();
let statusBarItem: vscode.StatusBarItem;
function getConsolidateHotkey(): string {
  const config = vscode.workspace.getConfiguration('fileConsolidator');
  return config.get('consolidateHotkey', 'ctrl+alt+c');
}
export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBarItem.text = "Files to Consolidate (0)";
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
      // Optional: Allow runtime hotkey registration/update
      vscode.window.showInformationMessage(`Current hotkey: ${hotkey}`);
    })
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('extension.addFolderToConsolidateList', async (uri: vscode.Uri) => {
      if (!uri) return;
      
      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(uri.fsPath, '**/*')
      );
      
      files.forEach(file => filesToConsolidate.add(file.toString()));
      updateStatusBar();
    }),
    vscode.commands.registerCommand('extension.addToConsolidateList', async (uri: vscode.Uri) => {
      if (!uri) {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        uri = editor.document.uri;
      }
      filesToConsolidate.add(uri.toString());
      updateStatusBar();
    }),
    vscode.commands.registerCommand('extension.showConsolidateMenu', async () => {
      const items = Array.from(filesToConsolidate).map(uriStr => {
        const uri = vscode.Uri.parse(uriStr);
        return {
          label: vscode.workspace.asRelativePath(uri),
          uri: uriStr,
          action: 'remove'
        };
      });
    
      const quickPickItems = [
        { label: '$(file-add) Consolidate All', action: 'consolidate' },
        { label: '$(clear-all) Clear List', action: 'clear' },
        ...items
      ];
    
      const result = await vscode.window.showQuickPick(quickPickItems, {
        placeHolder: 'Choose action'
      });
    
      if (!result) return;
    
      switch (result.action) {
        case 'consolidate':
          await consolidateFiles();
          break;
        case 'clear':
          filesToConsolidate.clear();
          break;
        case 'remove':
          if ('uri' in result) {
            filesToConsolidate.delete(result.uri);
          }
          break;
      }
      updateStatusBar();
    })
  )
}

function updateStatusBar() {
  statusBarItem.text = `Files to Consolidate (${filesToConsolidate.size})`;
}

async function consolidateFiles() {
  const docs = await Promise.all(
    Array.from(filesToConsolidate).map(async uriStr => {
      const uri = vscode.Uri.parse(uriStr);
      const doc = await vscode.workspace.openTextDocument(uri);
      return doc;
    })
  );

  const fileList = docs.map(doc => doc.fileName || 'Untitled').join('\n');
  const consolidatedContent = docs
    .map(doc => {
      const fileName = doc.fileName || 'Untitled';
      const fileContent = doc.getText();
      return `# ${fileName}\n${fileContent}`;
    })
    .join('\n\n');

  const finalContent = `# File List\n${fileList}\n\n# File Contents\n\n${consolidatedContent}`;
  await vscode.env.clipboard.writeText(finalContent);
  
  const totalLines = docs.reduce((sum, doc) => sum + doc.lineCount, 0);
  const totalChars = docs.reduce((sum, doc) => sum + doc.getText().length, 0);
  
  vscode.window.showInformationMessage(
    `Consolidated ${docs.length} file(s) to clipboard! Total Lines: ${totalLines}, Total Characters: ${totalChars}`
  );
}
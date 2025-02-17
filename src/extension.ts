import * as vscode from 'vscode';

let filesToConsolidate = new Set<string>();
let statusBarItem: vscode.StatusBarItem;
function getConsolidateHotkey(): string {
  const config = vscode.workspace.getConfiguration('contextConsolidator');
  return config.get('consolidateHotkey', 'ctrl+alt+c');
}
interface ConsolidatorQuickPickItem extends vscode.QuickPickItem {
  action?: 'consolidate' | 'clear' | 'remove';
  uri?: string;
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
    vscode.commands.registerCommand('extension.showConsolidateMenu', () => {
      const quickPick = vscode.window.createQuickPick<ConsolidatorQuickPickItem>();
      quickPick.placeholder = 'Select an action or file to remove';
      
      const updateItems = () => {
        const fileItems: ConsolidatorQuickPickItem[] = Array.from(filesToConsolidate).map(uriStr => {
          const uri = vscode.Uri.parse(uriStr);
          return {
            label: vscode.workspace.asRelativePath(uri),
            uri: uriStr,
            action: 'remove',
            description: 'Remove'
          };
        });
        quickPick.items = [
          { label: '$(file-add) Consolidate All', action: 'consolidate' },
          { label: '$(clear-all) Clear List', action: 'clear' },
          ...fileItems
        ];
      };
      updateItems();
    
      quickPick.onDidChangeSelection(selection => {
        if (selection[0]) {
          const item = selection[0];
          if (item.action === 'consolidate') {
            consolidateFiles();
            quickPick.hide();
          } else if (item.action === 'clear') {
            filesToConsolidate.clear();
            updateStatusBar();
            updateItems();
          } else if (item.uri) {
            filesToConsolidate.delete(item.uri);
            updateStatusBar();
            updateItems();
          }
        }
      });
      quickPick.onDidHide(() => quickPick.dispose());
      quickPick.show();
    })
    
  );
}

function updateStatusBar() {
  statusBarItem.text = `Files to Consolidate (${filesToConsolidate.size})`;
}

async function consolidateFiles() {
  const docs = await Promise.all(
    Array.from(filesToConsolidate).map(async uriStr => {
      const uri = vscode.Uri.parse(uriStr);
      return vscode.workspace.openTextDocument(uri);
    })
  );
  
  // Create the file list and wrap in XML tags.
  const fileList = docs.map(doc => doc.fileName || 'Untitled').join('\n');
  const folderTreeXML = `<FolderTree>\n${fileList}\n</FolderTree>`;
  
  // Wrap each file's content in a <Code> tag including its file name.
  const codeXML = docs.map(doc => {
    const fileName = doc.fileName || 'Untitled';
    const fileContent = doc.getText();
    return `<Code file="${fileName}">\n${fileContent}\n</Code>`;
  }).join('\n');
  
  const finalContent = `<ConsolidatedFilesContext>\n${folderTreeXML}\n${codeXML}\n</ConsolidatedFilesContext>`;
  await vscode.env.clipboard.writeText(finalContent);
  
  const totalLines = docs.reduce((sum, doc) => sum + doc.lineCount, 0);
  const totalChars = docs.reduce((sum, doc) => sum + doc.getText().length, 0);
  
  vscode.window.showInformationMessage(
    `Consolidated ${docs.length} file(s) to clipboard! Total Lines: ${totalLines}, Total Characters: ${totalChars}`
  );
}

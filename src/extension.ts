import * as vscode from 'vscode';
import * as testModule from './extension_test';
import * as DiffMatchPatch from 'diff-match-patch';
import * as path from 'path';
import { encode } from 'gpt-tokenizer/model/gpt-4o';

interface ConsolidateItem {
  type: 'file' | 'snippet';
  uri: string;
  range?: vscode.Range; // Dynamically updated based on changes
  originalText?: string; // For snippets: original snippet text; for files, file text
  text?: string;        // Current snapshot of the snippet (if applicable)
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

// Enhanced algorithm: For each original line, try exact match; if not found, use fuzzy match with candidate proximity check.
function adjustSnippetRangeLineByLineHybridEnhanced(item: ConsolidateItem, document: vscode.TextDocument): void {
  if (item.type !== 'snippet' || !item.originalText) return;

  const fullText = document.getText();
  const docLines = fullText.split('\n');
  const origLines = item.originalText.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);
  if (origLines.length === 0) {
    console.log("EnhancedHybrid: No valid lines in original snippet.");
    return;
  }
  
  const matchedOffsets: number[] = [];
  let searchStartOffset = 0; // absolute offset for monotonicity
  
  // Set a relaxed threshold for fuzzy matching.
  dmp.Match_Threshold = 0.8;
  // Define a threshold (in characters) for candidate rejection when prior matches exist.
  const candidateProximityThreshold = 50;
  
  console.log("EnhancedHybrid: Matching each original line:");
  for (let idx = 0; idx < origLines.length; idx++) {
    const origLine = origLines[idx];
    let foundOffset = -1;
    // Attempt exact match from current searchStartOffset.
    const startLine = document.positionAt(searchStartOffset).line;
    for (let i = startLine; i < docLines.length; i++) {
      if (docLines[i].trim() === origLine) {
        foundOffset = document.offsetAt(new vscode.Position(i, 0));
        console.log(`   Line ${idx + 1}: Expected "${origLine}" EXACT match at doc line ${i + 1} (offset ${foundOffset}).`);
        break;
      }
    }
    // If not found exactly, try fuzzy match.
    if (foundOffset === -1) {
      const approxOffset = dmp.match_main(fullText, origLine, searchStartOffset);
      if (approxOffset !== -1 && approxOffset >= searchStartOffset) {
        // If we already have some matches, compute the median of them.
        if (matchedOffsets.length > 0) {
          const sorted = [...matchedOffsets].sort((a, b) => a - b);
          const median = sorted[Math.floor(sorted.length / 2)];
          const diff = Math.abs(approxOffset - median);
          console.log(`   Line ${idx + 1}: Expected "${origLine}" FUZZY candidate at offset ${approxOffset} (diff ${diff}).`);
          if (diff <= candidateProximityThreshold) {
            foundOffset = approxOffset;
            console.log(`         Accepting candidate (within threshold).`);
          } else {
            console.log(`         Rejecting candidate (diff too high).`);
          }
        } else {
          // For the very first line, no previous match exists.
          foundOffset = approxOffset;
          console.log(`   Line ${idx + 1}: Expected "${origLine}" FUZZY match at offset ${foundOffset}.`);
        }
      } else {
        console.log(`   Line ${idx + 1}: Expected "${origLine}" NOT found (offset -1).`);
      }
    }
    // Record offset if valid and ensure monotonicity.
    if (foundOffset !== -1 && (matchedOffsets.length === 0 || foundOffset >= matchedOffsets[matchedOffsets.length - 1])) {
      matchedOffsets.push(foundOffset);
      searchStartOffset = foundOffset + origLine.length;
    } else {
      matchedOffsets.push(-1);
    }
  }
  
  const validMatches = matchedOffsets.filter(offset => offset >= 0);
  const matchRatio = validMatches.length / origLines.length;
  console.log(`EnhancedHybrid: Matched ${Math.round(matchRatio * 100)}% of expected lines.`);
  
  if (matchRatio < 0.8) {
    console.log(`EnhancedHybrid: Low match ratio; falling back to simple algorithm.`);
    adjustSnippetRangeSimple(item, document);
    return;
  }
  
  const firstOffset = Math.min(...validMatches);
  const lastOffset = Math.max(...validMatches);
  
  const startLineFinal = document.positionAt(firstOffset).line;
  const endLineFinal = document.positionAt(lastOffset).line;
  
  const newStartPos = new vscode.Position(startLineFinal, 0);
  const newEndPos = new vscode.Position(endLineFinal, docLines[endLineFinal].length);
  item.range = new vscode.Range(newStartPos, newEndPos);
  item.text = document.getText(item.range);
  
  console.log(`EnhancedHybrid: Final snippet boundaries: lines ${startLineFinal + 1}-${endLineFinal + 1}`);
}

// A simple fallback exact-match algorithm.
function adjustSnippetRangeSimple(item: ConsolidateItem, document: vscode.TextDocument): void {
  const docLines = document.getText().split('\n');
  const originalLines = (item.originalText || "").split('\n').map(line => line.trim());
  const firstMarker = originalLines.find(line => line.length > 0);
  const lastMarker = [...originalLines].reverse().find(line => line.length > 0);
  let newStartLine = -1;
  let newEndLine = -1;
  for (let i = 0; i < docLines.length; i++) {
    if (docLines[i].trim() === firstMarker) {
      newStartLine = i;
      break;
    }
  }
  for (let i = docLines.length - 1; i >= 0; i--) {
    if (docLines[i].trim() === lastMarker) {
      newEndLine = i;
      break;
    }
  }
  if (newStartLine === -1) newStartLine = 0;
  if (newEndLine === -1) newEndLine = docLines.length - 1;
  const newStartPos = new vscode.Position(newStartLine, 0);
  const newEndPos = new vscode.Position(newEndLine, docLines[newEndLine].length);
  item.range = new vscode.Range(newStartPos, newEndPos);
  item.text = document.getText(item.range);
  console.log(`Simple: Adjusted snippet for ${item.uri}: lines ${newStartLine + 1}-${newEndPos.line + 1}`);
}

export function activate(context: vscode.ExtensionContext) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  statusBarItem.text = "Snapshot: 0 items";
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
      files.forEach(file => {
        vscode.workspace.openTextDocument(file).then(doc => {
          originalDocTexts.set(file.toString(), doc.getText());
        });
        consolidateItems.push({ type: 'file', uri: file.toString() });
      });
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
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        originalDocTexts.set(uri.toString(), doc.getText());
      } catch (e) {
        console.error(e);
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

  // Track snippet ranges using our enhanced algorithm.
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
      const document = e.document;
      const docUri = document.uri.toString();
      const snippetItems = consolidateItems.filter(
        item => item.type === 'snippet' && item.uri === docUri
      );
      if (snippetItems.length === 0) return;
      snippetItems.forEach(item => adjustSnippetRangeLineByLineHybridEnhanced(item, document));
      updateHighlightsForDocument(document);
    })
  );

  // Register FileDecorationProvider
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(new ConsolidatedFileDecorationProvider())
  );
  // Register your test command.
  let disposable = vscode.commands.registerCommand('extension_test.runTests', () => {
    testModule.runTestSuite();
  });
  context.subscriptions.push(disposable);
}

function updateStatusBar() {
  let totalItems = consolidateItems.length;
  let contentLines = 0;
  let totalTokens = 0;

  consolidateItems.forEach(item => {
    if (item.type === 'snippet' && item.range) {
      const text = item.text || "";
      contentLines += (item.range.end.line - item.range.start.line + 1);
      totalTokens += encode(text).length;
    } else if (item.type === 'file') {
      const fileText = originalDocTexts.get(item.uri);
      if (fileText) {
        const lines = fileText.split('\n');
        contentLines += lines.length;
        totalTokens += encode(fileText).length;
      }
    }
  });

  const overhead = 3 + (2 * totalItems);
  const totalApprox = contentLines + overhead;
  statusBarItem.text = `Consolidated: ${totalItems} items | ${totalApprox} lines | ${totalTokens} tokens`;
}

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

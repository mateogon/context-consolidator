import * as vscode from 'vscode';
import * as diff_match_patch from 'diff-match-patch';

/**
 * FakeDocument simulates a vscode.TextDocument.
 * It implements the methods we need: getText(), offsetAt(), positionAt(), lineCount, and lineAt().
 */
class FakeDocument {
  private _text: string;
  private _lines: string[];

  constructor(text: string) {
    this._text = text;
    this._lines = text.split('\n');
  }

  getText(range?: vscode.Range): string {
    if (!range) return this._text;
    const start = this.offsetAt(range.start);
    const end = this.offsetAt(range.end);
    return this._text.substring(start, end);
  }

  offsetAt(position: vscode.Position): number {
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
      offset += this._lines[i].length + 1; // +1 for newline
    }
    offset += position.character;
    return offset;
  }

  positionAt(offset: number): vscode.Position {
    let remaining = offset;
    for (let i = 0; i < this._lines.length; i++) {
      if (remaining <= this._lines[i].length) {
        return new vscode.Position(i, remaining);
      }
      remaining -= (this._lines[i].length + 1);
    }
    return new vscode.Position(this._lines.length - 1, this._lines[this._lines.length - 1].length);
  }

  get lineCount(): number {
    return this._lines.length;
  }

  lineAt(line: number): { text: string } {
    return { text: this._lines[line] };
  }

  updateText(newText: string) {
    this._text = newText;
    this._lines = newText.split('\n');
  }
}

/**
 * We reuse our snippet item interface.
 */
interface ConsolidateItem {
  type: 'snippet';
  originalText: string;  // Snippet’s text when first added
  range: vscode.Range;   // Original range (to be adjusted)
  text: string;          // Current snippet text
}

// Initialize diff-match-patch instance.
const dmp = new diff_match_patch.diff_match_patch();

/**
 * adjustSnippetRange attempts to locate the snippet’s boundaries using diff-match-patch.
 * For the first and last non-empty lines of the original snippet, it uses dmp.match_main
 * on the full document text to get an offset. If that fails, it falls back to scanning
 * the document line-by-line.
 */
function adjustSnippetRange(item: ConsolidateItem, doc: FakeDocument): void {
  if (item.type !== 'snippet' || !item.range || !item.originalText) return;

  // Get trimmed, non-empty lines from the original snippet.
  const originalLines = item.originalText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  if (originalLines.length === 0) {
    console.log(`Snippet has no valid content in test document.`);
    return;
  }
  const firstMarker = originalLines[0];
  const lastMarker = originalLines[originalLines.length - 1];
  const fullText = doc.getText();

  // Try to get offset via dmp.match_main.
  let firstOffset = dmp.match_main(fullText, firstMarker, 0);
  let lastOffset = dmp.match_main(fullText, lastMarker, fullText.length);
  
  // Fallback to line-by-line if needed.
  if (firstOffset === -1 || lastOffset === -1) {
    console.log("dmp.match_main failed, falling back to line-by-line search.");
    const currentLines = fullText.split('\n');
    for (let i = 0; i < currentLines.length; i++) {
      if (currentLines[i].trim() === firstMarker) {
        firstOffset = doc.offsetAt(new vscode.Position(i, 0));
        break;
      }
    }
    for (let i = currentLines.length - 1; i >= 0; i--) {
      if (currentLines[i].trim() === lastMarker) {
        lastOffset = doc.offsetAt(new vscode.Position(i, currentLines[i].length));
        break;
      }
    }
  }

  if (firstOffset === -1 || lastOffset === -1) {
    console.log(`Could not locate snippet boundaries.`);
    return;
  }

  const newStartPos = doc.positionAt(firstOffset);
  const newEndPos = doc.positionAt(lastOffset);
  item.range = new vscode.Range(newStartPos, newEndPos);
  item.text = doc.getText(item.range);
  console.log(`Adjusted snippet: lines ${newStartPos.line + 1}-${newEndPos.line + 1}`);
}

/**
 * Test Case 1: Two snippets in sequence.
 * Insert two new lines between snippet1 and snippet2.
 */
function runTestCase1() {
  console.log("=== Running Test Case 1: Insertion Outside Snippet Boundaries ===");
  const originalText = [
    "Line 1",
    "Snippet1 Start",
    "Snippet1 Middle",
    "Snippet1 End",
    "Line 5",
    "Line 6",
    "Snippet2 Start",
    "Snippet2 Middle",
    "Snippet2 End",
    "Line 10"
  ].join('\n');

  const doc = new FakeDocument(originalText);

  const snippet1Range = new vscode.Range(new vscode.Position(1, 0), new vscode.Position(3, doc.lineAt(3).text.length));
  const snippet1Text = doc.getText(snippet1Range);
  const snippet1: ConsolidateItem = { type: 'snippet', originalText: snippet1Text, range: snippet1Range, text: snippet1Text };

  const snippet2Range = new vscode.Range(new vscode.Position(6, 0), new vscode.Position(8, doc.lineAt(8).text.length));
  const snippet2Text = doc.getText(snippet2Range);
  const snippet2: ConsolidateItem = { type: 'snippet', originalText: snippet2Text, range: snippet2Range, text: snippet2Text };

  console.log("Original Snippet1:");
  console.log(snippet1Text);
  console.log("Original Snippet2:");
  console.log(snippet2Text);

  const updatedText = [
    "Line 1",
    "Snippet1 Start",
    "Snippet1 Middle",
    "Snippet1 End",
    "Line 5",
    "NEW LINE A",
    "NEW LINE B",
    "Line 6",
    "Snippet2 Start",
    "Snippet2 Middle",
    "Snippet2 End",
    "Line 10"
  ].join('\n');
  doc.updateText(updatedText);
  console.log("Updated Document Text:");
  console.log(doc.getText());

  adjustSnippetRange(snippet1, doc);
  adjustSnippetRange(snippet2, doc);

  console.log("After Adjustment:");
  console.log("Snippet1 Text:");
  console.log(snippet1.text);
  console.log("Snippet2 Text:");
  console.log(snippet2.text);
  console.log("Expected: Snippet1 unchanged; Snippet2 shifted down by 2 lines.");
}

/**
 * Test Case 2: Insertion inside a snippet.
 * Insert a new line inside the snippet.
 */
function runTestCase2() {
  console.log("=== Running Test Case 2: Insertion Inside a Snippet ===");
  const originalText = [
    "Line 1",
    "Snippet Start",
    "Snippet Middle",
    "Snippet End",
    "Line 5"
  ].join('\n');

  const doc = new FakeDocument(originalText);
  const snippetRange = new vscode.Range(new vscode.Position(1, 0), new vscode.Position(3, doc.lineAt(3).text.length));
  const snippetText = doc.getText(snippetRange);
  const snippet: ConsolidateItem = { type: 'snippet', originalText: snippetText, range: snippetRange, text: snippetText };

  console.log("Original Snippet:");
  console.log(snippetText);

  const updatedText = [
    "Line 1",
    "Snippet Start",
    "NEW INSIDE",
    "Snippet Middle",
    "Snippet End",
    "Line 5"
  ].join('\n');
  doc.updateText(updatedText);
  console.log("Updated Document Text:");
  console.log(doc.getText());

  adjustSnippetRange(snippet, doc);

  console.log("After Adjustment:");
  console.log("Snippet Text:");
  console.log(snippet.text);
  console.log("Expected: Snippet should include 'NEW INSIDE' (4 lines total).");
}

/**
 * runTests executes all test cases.
 */
export function runTests() {
  console.log("=== Running All Tests ===");
  runTestCase1();
  console.log("\n-----------------------------\n");
  runTestCase2();
  console.log("=== All Tests Completed ===");
}


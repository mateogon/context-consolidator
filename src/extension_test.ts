import * as vscode from 'vscode';
import * as diff_match_patch from 'diff-match-patch';

// ------------------ FakeDocument & Types ------------------
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

interface ConsolidateItem {
  type: 'snippet';
  originalText: string;  // snippet’s text when first added
  range: vscode.Range;   // original range (to be adjusted)
  text: string;          // current snippet text after adjustment
}

// ------------------ Levenshtein Helper ------------------
function levenshtein(a: string, b: string): number {
  const dp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
}

function similarityScore(actual: string, expected: string): number {
  const lev = levenshtein(actual, expected);
  const maxLen = Math.max(actual.length, expected.length);
  if (maxLen === 0) return 1;
  return 1 - lev / maxLen;
}

// ------------------ diff-match-patch Instance ------------------
const dmp = new diff_match_patch.diff_match_patch();

// ------------------ Hybrid Line-by-Line Algorithm ------------------
function adjustSnippetRangeLineByLineHybridEnhanced(item: ConsolidateItem, document: FakeDocument): void {
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



// A simple fallback exact-match algorithm:
function adjustSnippetRangeSimple(item: ConsolidateItem, document: FakeDocument): void {
  const docLines = document.getText().split('\n');
  const originalLines = item.originalText.split('\n').map(line => line.trim());
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
  console.log(`Simple: Adjusted snippet to lines ${newStartLine + 1}-${newEndPos.line + 1}`);
}

// ------------------ Test Harness ------------------
export function runTestSuite() {
  console.log("=== Starting Test Suite with Scoring ===");
  console.log("=== S&&&&&&&&&&&&&&&&&&&&&&&g ===");
  const baseText = [
    "Line 1",
    "Line 2",
    "Line 3",
    "Line 4",
    "Line 5",
    "Line 6",
    "Line 7",
    "Line 8",
    "Line 9",
    "Line 10",
    "Line 11",
    "Line 12",
    "Line 13",
    "Line 14",
    "Line 15"
  ].join('\n');

  // Create a base document.
  const baseDoc = new FakeDocument(baseText);
  // Define snippet1 as lines 1-5 and snippet2 as lines 10-15.
  const snippet1Range = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(4, baseDoc.lineAt(4).text.length));
  const snippet2Range = new vscode.Range(new vscode.Position(9, 0), new vscode.Position(14, baseDoc.lineAt(14).text.length));
  const snippet1Orig = baseDoc.getText(snippet1Range);
  const snippet2Orig = baseDoc.getText(snippet2Range);

  // Expected outputs for each test.
  const expected: { [testName: string]: { snippet1: string; snippet2: string } } = {
    "Test A": { snippet1: snippet1Orig, snippet2: snippet2Orig },
    "Test B": { snippet1: snippet1Orig, snippet2: snippet2Orig },
    "Test C": { snippet1: "Line 1\nLine 2\nLine 3\nNEW INSIDE SNIPPET1\nLine 4\nLine 5", snippet2: snippet2Orig },
    "Test D": { snippet1: snippet1Orig, snippet2: "Line 10\nLine 11\nLine 12\nNEW INSIDE SNIPPET2\nLine 13\nLine 14\nLine 15" },
    "Test E": { snippet1: "Line 1\nLine 3\nLine 4\nLine 5", snippet2: snippet2Orig },
    "Test F": { snippet1: snippet1Orig, snippet2: snippet2Orig },
    "Test G": { 
      snippet1: "Line 1 (modified)\nLine 2\nLine 3\nLine 4\nLine 5 (modified)",
      snippet2: "Line 10 (modified)\nLine 11\nLine 12\nLine 13\nLine 14\nLine 15 (modified)"
    }
  };

  function runTestCase(testName: string, updatedText: string) {
    console.log(`\n--- ${testName} ---`);
    const doc = new FakeDocument(updatedText);

    // Clone snippet items.
    function cloneSnippet(snippetRange: vscode.Range, origText: string): ConsolidateItem {
      return { type: 'snippet', originalText: origText, range: snippetRange, text: origText };
    }
    const snippet1Hybrid = cloneSnippet(snippet1Range, snippet1Orig);
    const snippet2Hybrid = cloneSnippet(snippet2Range, snippet2Orig);

    // Run our line-by-line hybrid algorithm.
    adjustSnippetRangeLineByLineHybridEnhanced(snippet1Hybrid, doc);
    adjustSnippetRangeLineByLineHybridEnhanced(snippet2Hybrid, doc);

    const scoreHybrid1 = similarityScore(snippet1Hybrid.text, expected[testName].snippet1);
    const scoreHybrid2 = similarityScore(snippet2Hybrid.text, expected[testName].snippet2);

    console.log("Expected Snippet1:");
    console.log(JSON.stringify(expected[testName].snippet1));
    console.log("Recovered Snippet1:");
    console.log(JSON.stringify(snippet1Hybrid.text));
    console.log("Score S1 =", scoreHybrid1.toFixed(2));
    
    console.log("Expected Snippet2:");
    console.log(JSON.stringify(expected[testName].snippet2));
    console.log("Recovered Snippet2:");
    console.log(JSON.stringify(snippet2Hybrid.text));
    console.log("Score S2 =", scoreHybrid2.toFixed(2));
  }

  const baseLines = baseText.split('\n');

  // Test A: Insert two lines at the very top.
  const testA = [
    "NEW TOP 1",
    "NEW TOP 2",
    ...baseLines
  ].join('\n');
  runTestCase("Test A", testA);

  // Test B: Insert two lines between snippet1 and snippet2.
  const testB = [
    ...baseLines.slice(0, 5),
    "NEW MIDDLE 1",
    "NEW MIDDLE 2",
    ...baseLines.slice(5)
  ].join('\n');
  runTestCase("Test B", testB);

  // Test C: Insert one line inside snippet1 (after line 3).
  const testC = [
    ...baseLines.slice(0, 3),
    "NEW INSIDE SNIPPET1",
    ...baseLines.slice(3)
  ].join('\n');
  runTestCase("Test C", testC);

  // Test D: Insert one line inside snippet2 (after line 12).
  const testD = [
    ...baseLines.slice(0, 12),
    "NEW INSIDE SNIPPET2",
    ...baseLines.slice(12)
  ].join('\n');
  runTestCase("Test D", testD);

  // Test E: Remove one line from snippet1 (remove line 2).
  const testE = [
    baseLines[0],
    ...baseLines.slice(2)
  ].join('\n');
  runTestCase("Test E", testE);

  // Test F: Remove one line from snippet2 (remove line 10).
  const testF = [
    ...baseLines.slice(0, 9),
    ...baseLines.slice(10)
  ].join('\n');
  runTestCase("Test F", testF);

  // Test G: Slight modification of snippet markers.
  const testGLines = baseLines.map((line, idx) => {
    if (idx === 0) return line + " (modified)";
    if (idx === 4) return line + " (modified)";
    if (idx === 9) return line + " (modified)";
    if (idx === 14) return line + " (modified)";
    return line;
  });
  const testG = testGLines.join('\n');
  runTestCase("Test G", testG);
}


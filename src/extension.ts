// src/extension.ts
/**************************************************************************
 * Context Consolidator – extension.ts (2025-09-03)
 * Prompt Composer + Presets + Persistent Options (per workspace)
 * - TaskSpec root (no version attr), mode/reasoning_effort/verbosity
 * - Toggle: Include advanced sections (GeneralGuidelines, CodingDirectives, Assumptions, StopConditions)
 * - Preset editor & save-from-editor
 * - Single action: Consolidate (TaskSpec) → Clipboard
 **************************************************************************/

import * as vscode from "vscode";
import * as DiffMatchPatch from "diff-match-patch";
import * as path from "path";
import * as fs from "fs/promises";
import { encode } from "gpt-tokenizer/model/gpt-4o";

/*───────────────────────────────────────────────────────────────────────────
  TYPES
───────────────────────────────────────────────────────────────────────────*/
interface ConsolidateItemFile {
  type: "file";
  uri: string; // vscode-URI string
  includeContent: boolean; // false ⇢ only mention path
}
interface ConsolidateItemSnippet {
  type: "snippet";
  uri: string;
  range: vscode.Range;
  originalText: string;
  text: string;
  contextBefore?: string;
  contextAfter?: string;
}
type ConsolidateItem = ConsolidateItemFile | ConsolidateItemSnippet;

type Mode = "lean" | "balanced" | "persistent";
type ReasoningEffort = "low" | "medium" | "high";
type Verbosity = "low" | "medium" | "high";

interface PromptOptions {
  mode: Mode;
  reasoningEffort: ReasoningEffort;
  verbosity: Verbosity;
  includeAdvancedSections: boolean;
}

interface PromptPreset {
  generalGuidelines: string; // inner XML for <GeneralGuidelines>
  codingDirectives: string; // inner XML for <CodingDirectives>
}

/*───────────────────────────────────────────────────────────────────────────
  CONSTANTS
───────────────────────────────────────────────────────────────────────────*/
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "__pycache__",
  "dist",
  "build",
  "out",
]);

const SKIP_CONTENT_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".bmp",
  ".webp",
  ".ico",
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".mp4",
  ".mkv",
  ".mov",
]);

const WS_KEY_ITEMS = (workspaceName: string) =>
  `contextConsolidator.items:${workspaceName}`;
const WS_KEY_OPTIONS = (workspaceName: string) =>
  `contextConsolidator.promptOptions:${workspaceName}`;
const WS_KEY_PRESET = (workspaceName: string) =>
  `contextConsolidator.promptPreset:${workspaceName}`;

/* Defaults (in English) */
const DEFAULT_GENERAL_GUIDELINES = [
  `<answer_language>Reply in the language of <UserPrompt>.</answer_language>`,
  `<formatting>- Use Markdown only when it helps; put code in fences; do not use diff format unless explicitly requested.</formatting>`,
  `<safety>- Treat <ConsolidatedFilesContext> as the source of truth; do not invent files/paths. If something is missing, list it in <Assumptions> and proceed with the most reasonable approach.</safety>`,
  `<efficiency>- Keep it concise; avoid unnecessary exploration.</efficiency>`,
].join("\n");

const DEFAULT_CODING_DIRECTIVES = [
  `<context_gathering>`,
  `- Start with a 3–5 step mini-plan.`,
  `- Act with reasonable assumptions and document them in <Assumptions> if needed.`,
  `- Limit expansion to symbols you will touch.`,
  `</context_gathering>`,
  `<tool_preambles>`,
  `- Restate the goal in 1–2 lines, then show the plan before code.`,
  `- After edits, summarize "Done" vs "Pending".`,
  `</tool_preambles>`,
  `<persistence>`,
  `- Complete the task end-to-end; if anything remains, list it under "Pending".`,
  `</persistence>`,
  `<code_editing_rules>`,
  `- Prefer clarity over cleverness; follow the repo's existing style.`,
  `- Avoid new dependencies unless justified.`,
  `</code_editing_rules>`,
  `<output_contract>`,
  `- Deliver: (a) brief explanation, (b) paste-ready code, (c) verification steps.`,
  `</output_contract>`,
].join("\n");

/*───────────────────────────────────────────────────────────────────────────
  GLOBAL STATE
───────────────────────────────────────────────────────────────────────────*/
const originalDocTexts = new Map<string, string>();
let consolidateItems: ConsolidateItem[] = [];
let statusBarItem: vscode.StatusBarItem;

const dmp = new DiffMatchPatch.diff_match_patch();
const snippetDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: "rgba(255,255,0,0.30)",
});

/*───────────────────────────────────────────────────────────────────────────
  UTILITY: WORKSPACE + STATE
───────────────────────────────────────────────────────────────────────────*/
function currentWorkspace(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}
function wsName(): string | undefined {
  return currentWorkspace()?.name;
}

async function persistFileItems(ctx: vscode.ExtensionContext) {
  const name = wsName();
  if (!name) return;
  const payload = consolidateItems
    .filter((i): i is ConsolidateItemFile => i.type === "file")
    .map(({ uri, includeContent }) => ({ uri, includeContent }));
  await ctx.workspaceState.update(WS_KEY_ITEMS(name), payload);
}
async function restoreFileItems(ctx: vscode.ExtensionContext) {
  const name = wsName();
  if (!name) return;
  const payload = ctx.workspaceState.get<
    { uri: string; includeContent: boolean }[]
  >(WS_KEY_ITEMS(name), []);
  for (const { uri, includeContent } of payload) {
    consolidateItems.push({ type: "file", uri, includeContent });
    if (includeContent) {
      try {
        const doc = await vscode.workspace.openTextDocument(
          vscode.Uri.parse(uri)
        );
        originalDocTexts.set(uri, doc.getText());
      } catch {
        /* ignore */
      }
    }
  }
}

function defaultOptions(): PromptOptions {
  return {
    mode: "balanced",
    reasoningEffort: "medium",
    verbosity: "low",
    includeAdvancedSections: true,
  };
}
function getOptions(ctx: vscode.ExtensionContext): PromptOptions {
  const name = wsName();
  if (!name) return defaultOptions();
  return (
    ctx.workspaceState.get<PromptOptions>(WS_KEY_OPTIONS(name)) ??
    defaultOptions()
  );
}
async function setOptions(ctx: vscode.ExtensionContext, opts: PromptOptions) {
  const name = wsName();
  if (!name) return;
  await ctx.workspaceState.update(WS_KEY_OPTIONS(name), opts);
}

function defaultPreset(): PromptPreset {
  return {
    generalGuidelines: DEFAULT_GENERAL_GUIDELINES,
    codingDirectives: DEFAULT_CODING_DIRECTIVES,
  };
}
function getPreset(ctx: vscode.ExtensionContext): PromptPreset {
  const name = wsName();
  if (!name) return defaultPreset();
  return (
    ctx.workspaceState.get<PromptPreset>(WS_KEY_PRESET(name)) ?? defaultPreset()
  );
}
async function setPreset(ctx: vscode.ExtensionContext, preset: PromptPreset) {
  const name = wsName();
  if (!name) return;
  await ctx.workspaceState.update(WS_KEY_PRESET(name), preset);
}

/*───────────────────────────────────────────────────────────────────────────
  TOKEN / LINES HELPERS
───────────────────────────────────────────────────────────────────────────*/
function itemTokenCount(item: ConsolidateItem): number {
  if (item.type === "file") {
    const txt = originalDocTexts.get(item.uri);
    return txt ? encode(txt).length : 0;
  }
  return encode(item.text).length;
}
function itemLineCount(item: ConsolidateItem): number {
  if (item.type === "file") {
    const txt = originalDocTexts.get(item.uri);
    return txt ? txt.split("\n").length : 0;
  }
  return item.range.end.line - item.range.start.line + 1;
}
function calcTotals() {
  let tok = 0;
  for (const it of consolidateItems) tok += itemTokenCount(it);
  return tok || 1;
}
function weightEmojiDynamic(
  tokens: number,
  lines: number,
  fraction: number,
  avgTok: number
): string {
  if (tokens >= 7500 || lines >= 800 || fraction >= 0.4 || tokens >= avgTok * 2)
    return "🔴";
  if (tokens >= 2500 || lines >= 400 || fraction >= 0.15 || tokens >= avgTok)
    return "🟡";
  return "🟢";
}
function getConsolidateHotkey(): string {
  return vscode.workspace
    .getConfiguration("contextConsolidator")
    .get("consolidateHotkey", "ctrl+alt+c");
}

/** crude binary sniff: check for NUL in first 8 kB */
async function isBinary(uri: vscode.Uri): Promise<boolean> {
  try {
    const buf = await fs.readFile(uri.fsPath);
    return buf.subarray(0, 8192).includes(0);
  } catch {
    return true; // unreadable → treat as binary
  }
}

/*───────────────────────────────────────────────────────────────────────────
  SNIPPET RANGE TRACKING
───────────────────────────────────────────────────────────────────────────*/
function adjustSnippetRangeSimple(
  item: ConsolidateItemSnippet,
  document: vscode.TextDocument
): void {
  const docLines = document.getText().split("\n");
  const originalLines = item.originalText.split("\n").map((l) => l.trim());
  const firstMarker = originalLines.find((l) => l.length);
  const lastMarker = [...originalLines].reverse().find((l) => l.length);
  let newStartLine = docLines.findIndex((l) => l.trim() === firstMarker);
  let newEndLine = docLines
    .slice()
    .reverse()
    .findIndex((l) => l.trim() === lastMarker);
  if (newStartLine === -1) newStartLine = 0;
  if (newEndLine === -1) newEndLine = docLines.length - 1;
  else newEndLine = docLines.length - 1 - newEndLine;

  const newStart = new vscode.Position(newStartLine, 0);
  const newEnd = new vscode.Position(newEndLine, docLines[newEndLine].length);
  item.range = new vscode.Range(newStart, newEnd);
  item.text = document.getText(item.range);
}

function adjustSnippetRangeLineByLineHybridEnhanced(
  item: ConsolidateItemSnippet,
  document: vscode.TextDocument
): void {
  const fullText = document.getText();
  const docLines = fullText.split("\n");
  const origLines = item.originalText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!origLines.length) return;

  const matched: number[] = [];
  let searchOffset = 0;
  dmp.Match_Threshold = 0.8;
  const proximity = 50;

  for (const origLine of origLines) {
    let found = -1;

    // exact (forward)
    const startLine = document.positionAt(searchOffset).line;
    for (let i = startLine; i < docLines.length; i++) {
      if (docLines[i].trim() === origLine) {
        found = document.offsetAt(new vscode.Position(i, 0));
        break;
      }
    }

    // fuzzy
    if (found === -1) {
      const approx = dmp.match_main(fullText, origLine, searchOffset);
      if (approx !== -1 && approx >= searchOffset) {
        if (matched.length) {
          const med = [...matched].sort((a, b) => a - b)[
            Math.floor(matched.length / 2)
          ];
          if (Math.abs(approx - med) <= proximity) found = approx;
        } else found = approx;
      }
    }

    if (
      found !== -1 &&
      (matched.length === 0 || found >= matched[matched.length - 1])
    ) {
      matched.push(found);
      searchOffset = found + origLine.length;
    } else matched.push(-1);
  }

  if (matched.filter((m) => m !== -1).length / origLines.length < 0.8) {
    adjustSnippetRangeSimple(item, document);
    return;
  }

  const first = Math.min(...matched.filter((m) => m !== -1));
  const last = Math.max(...matched.filter((m) => m !== -1));
  const startLine2 = document.positionAt(first).line;
  const endLine2 = document.positionAt(last).line;
  const startPos = new vscode.Position(startLine2, 0);
  const endPos = new vscode.Position(endLine2, docLines[endLine2].length);

  item.range = new vscode.Range(startPos, endPos);
  item.text = document.getText(item.range);
}

/*───────────────────────────────────────────────────────────────────────────
  CORE HELPERS
───────────────────────────────────────────────────────────────────────────*/
function updateHighlightsForDocument(doc: vscode.TextDocument) {
  const ranges = (consolidateItems as ConsolidateItemSnippet[])
    .filter((i) => i.type === "snippet" && i.uri === doc.uri.toString())
    .map((i) => i.range);
  vscode.window.visibleTextEditors
    .filter((e) => e.document === doc)
    .forEach((e) => e.setDecorations(snippetDecorationType, ranges));
}

function updateStatusBar() {
  let tokens = 0,
    lines = 0;
  consolidateItems.forEach((i) => {
    tokens += itemTokenCount(i);
    if (i.type === "file" && i.includeContent) {
      const txt = originalDocTexts.get(i.uri);
      if (txt) lines += txt.split("\n").length;
    } else if (i.type === "snippet") {
      lines += i.range.end.line - i.range.start.line + 1;
    }
  });
  statusBarItem.text = `Context 📦 ${consolidateItems.length} | ${lines} L | ${tokens} tok`;
}

async function buildConsolidatedXML(): Promise<string> {
  const unique = [...new Set(consolidateItems.map((i) => i.uri))];
  const fileTree = unique
    .map((u) => vscode.workspace.asRelativePath(vscode.Uri.parse(u)))
    .join("\n");
  const folderTreeXML = `<FolderTree>\n${fileTree}\n</FolderTree>`;

  const codeXML = await Promise.all(
    consolidateItems.map(async (item) => {
      const rel = vscode.workspace.asRelativePath(vscode.Uri.parse(item.uri));
      if (item.type === "file") {
        if (!item.includeContent) return `<!-- ${rel} skipped -->`;
        try {
          const doc = await vscode.workspace.openTextDocument(
            vscode.Uri.parse(item.uri)
          );
          const txt = doc.getText();
          return `<Code file="${rel}">\n${txt}\n</Code>`;
        } catch {
          const txt = originalDocTexts.get(item.uri) ?? "";
          return `<Code file="${rel}">\n${txt}\n</Code>`;
        }
      } else {
        const { range } = item;
        return `<Code file="${rel}" snippet="lines ${range.start.line + 1}-${
          range.end.line + 1
        }">\n${item.text}\n</Code>`;
      }
    })
  );

  return `<ConsolidatedFilesContext>\n${folderTreeXML}\n${(
    await Promise.all(codeXML)
  ).join("\n")}\n</ConsolidatedFilesContext>`;
}

/*───────────────────────────────────────────────────────────────────────────
  PROMPT COMPOSER
───────────────────────────────────────────────────────────────────────────*/
function cycle<T extends string>(v: T, arr: readonly T[]): T {
  const i = arr.indexOf(v);
  return arr[(i + 1) % arr.length];
}

function sanitizeInner(text: string): string {
  // Basic escape of XML-invalid chars inside text nodes (keeps newlines)
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

async function buildTaskSpecXML(ctx: vscode.ExtensionContext): Promise<string> {
  const options = getOptions(ctx);
  const preset = getPreset(ctx);
  const consolidated = await buildConsolidatedXML();

  const userPromptPlaceholder = "";

  const header = `<TaskSpec mode="${options.mode}" reasoning_effort="${options.reasoningEffort}" verbosity="${options.verbosity}">`;
  const userPrompt = `<UserPrompt>\n${sanitizeInner(
    userPromptPlaceholder
  )}\n</UserPrompt>`;

  let advanced = "";
  if (options.includeAdvancedSections) {
    advanced =
      `<GeneralGuidelines>\n${preset.generalGuidelines}\n</GeneralGuidelines>\n` +
      `<CodingDirectives>\n${preset.codingDirectives}\n</CodingDirectives>\n` +
      `<Assumptions></Assumptions>\n` +
      `<StopConditions>- All sub-tasks completed or explicitly listed as pending.</StopConditions>\n`;
  }

  return [header, userPrompt, advanced, consolidated, `</TaskSpec>`].join("\n");
}

async function composePromptToClipboard(ctx: vscode.ExtensionContext) {
  const xml = await buildTaskSpecXML(ctx);
  await vscode.env.clipboard.writeText(xml);
  vscode.window.showInformationMessage("TaskSpec copied to clipboard ✔");
}

/*───────────────────────────────────────────────────────────────────────────
  PRESET EDITOR
───────────────────────────────────────────────────────────────────────────*/
function presetEditorScaffold(preset: PromptPreset): string {
  return [
    `<!--`,
    `Edit your preset blocks below. Only inner content matters.`,
    `Run "Context Consolidator: Save Preset From Active Editor" to persist.`,
    `-->`,
    ``,
    `<GeneralGuidelines>`,
    preset.generalGuidelines,
    `</GeneralGuidelines>`,
    ``,
    `<CodingDirectives>`,
    preset.codingDirectives,
    `</CodingDirectives>`,
    ``,
  ].join("\n");
}

function extractTagInner(text: string, tag: string): string | null {
  const m = new RegExp(`<${tag}\\s*>[\\s\\S]*?<\\/${tag}>`, "i").exec(text);
  if (!m) return null;
  const full = m[0];
  const inner = full
    .replace(new RegExp(`^<${tag}\\s*>`, "i"), "")
    .replace(new RegExp(`<\\/${tag}>$`, "i"), "");
  return inner.trim();
}

/*───────────────────────────────────────────────────────────────────────────
  ACTIVATION
───────────────────────────────────────────────────────────────────────────*/
export async function activate(context: vscode.ExtensionContext) {
  /* status bar */
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left
  );
  statusBarItem.command = "extension.showConsolidateMenu";
  context.subscriptions.push(statusBarItem);
  await restoreFileItems(context);
  updateStatusBar();
  statusBarItem.show();

  /*──────────────── add FOLDER ────────────────*/
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.addFolderToConsolidateList",
      async (uri: vscode.Uri) => {
        if (!uri) return;
        const files = await vscode.workspace.findFiles(
          new vscode.RelativePattern(uri.fsPath, "**/*")
        );
        for (const file of files) {
          if (file.fsPath.split(path.sep).some((p) => EXCLUDED_DIRS.has(p)))
            continue;
          const ext = path.extname(file.fsPath).toLowerCase();
          let includeContent = !SKIP_CONTENT_EXTS.has(ext);
          if (includeContent && (await isBinary(file))) includeContent = false;

          if (includeContent) {
            try {
              const doc = await vscode.workspace.openTextDocument(file);
              originalDocTexts.set(file.toString(), doc.getText());
            } catch {
              includeContent = false;
            }
          }

          if (!consolidateItems.some((i) => i.uri === file.toString())) {
            consolidateItems.push({
              type: "file",
              uri: file.toString(),
              includeContent,
            });
          }
        }
        updateStatusBar();
        await persistFileItems(context);
      }
    )
  );

  /*──────────────── add FILE(S) ───────────────*/
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.addToConsolidateList",
      async (uri: vscode.Uri | undefined, uris?: vscode.Uri[]) => {
        const targets = (uris?.length ? uris : uri ? [uri] : []).filter(
          Boolean
        ) as vscode.Uri[];

        if (targets.length === 0 && vscode.window.activeTextEditor?.document) {
          targets.push(vscode.window.activeTextEditor.document.uri);
        }

        for (const file of targets) {
          const ext = path.extname(file.fsPath).toLowerCase();
          let includeContent = !SKIP_CONTENT_EXTS.has(ext);
          if (includeContent && (await isBinary(file))) includeContent = false;

          if (includeContent) {
            try {
              const doc = await vscode.workspace.openTextDocument(file);
              originalDocTexts.set(file.toString(), doc.getText());
            } catch {
              includeContent = false;
            }
          }

          if (!consolidateItems.some((i) => i.uri === file.toString())) {
            consolidateItems.push({
              type: "file",
              uri: file.toString(),
              includeContent,
            });
          }
        }
        updateStatusBar();
        await persistFileItems(context);
      }
    )
  );

  /*──────────────── add SNIPPET ───────────────*/
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.addSnippetToConsolidateList",
      () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
          vscode.window.showInformationMessage("No selection.");
          return;
        }
        const { document, selection } = editor;
        const range = new vscode.Range(selection.start, selection.end);
        const txt = document.getText(range);
        const before =
          selection.start.line > 0
            ? document.lineAt(selection.start.line - 1).text
            : "";
        const after =
          selection.end.line < document.lineCount - 1
            ? document.lineAt(selection.end.line + 1).text
            : "";

        if (
          !consolidateItems.some(
            (i) => i.type === "snippet" && i.range.isEqual(range)
          )
        ) {
          consolidateItems.push({
            type: "snippet",
            uri: document.uri.toString(),
            range,
            originalText: txt,
            text: txt,
            contextBefore: before,
            contextAfter: after,
          });
        }

        updateHighlightsForDocument(document);
        updateStatusBar();
      }
    )
  );

  /*──────────────── MENU ──────────────────────*/
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showConsolidateMenu", () => {
      const qp = vscode.window.createQuickPick<
        vscode.QuickPickItem & { action?: () => void }
      >();
      qp.title = "Context Consolidator";

      const rebuild = () => {
        const opts = getOptions(context);

        // Buttons / actions
        const buttons: ((typeof qp.items)[number] & { action: () => void })[] =
          [
            {
              label: "$(file-add) Consolidate (TaskSpec) → Clipboard",
              action: async () => {
                await composePromptToClipboard(context);
                qp.hide();
              },
            },
            {
              label: `$(tools) Toggle: Include advanced sections (${
                opts.includeAdvancedSections ? "ON" : "OFF"
              })`,
              action: async () => {
                const next = {
                  ...opts,
                  includeAdvancedSections: !opts.includeAdvancedSections,
                };
                await setOptions(context, next);
                rebuild();
              },
            },
            {
              label: `$(debug-step-into) Mode: ${opts.mode} (click to cycle)`,
              action: async () => {
                const nextMode = cycle<Mode>(opts.mode, [
                  "lean",
                  "balanced",
                  "persistent",
                ]);
                await setOptions(context, { ...opts, mode: nextMode });
                rebuild();
              },
            },
            {
              label: `$(rocket) Reasoning Effort: ${opts.reasoningEffort} (cycle)`,
              action: async () => {
                const next = cycle<ReasoningEffort>(opts.reasoningEffort, [
                  "low",
                  "medium",
                  "high",
                ]);
                await setOptions(context, { ...opts, reasoningEffort: next });
                rebuild();
              },
            },
            {
              label: `$(megaphone) Verbosity: ${opts.verbosity} (cycle)`,
              action: async () => {
                const next = cycle<Verbosity>(opts.verbosity, [
                  "low",
                  "medium",
                  "high",
                ]);
                await setOptions(context, { ...opts, verbosity: next });
                rebuild();
              },
            },
            {
              label: "$(edit) Edit Prompt Preset (Advanced Sections)…",
              action: async () => {
                const preset = getPreset(context);
                const doc = await vscode.workspace.openTextDocument({
                  content: presetEditorScaffold(preset),
                  language: "xml",
                });
                await vscode.window.showTextDocument(doc, { preview: false });
              },
            },
            {
              label: "$(save) Save Preset From Active Editor",
              action: async () => {
                const ed = vscode.window.activeTextEditor;
                if (!ed) {
                  vscode.window.showWarningMessage("No active editor.");
                  return;
                }
                const txt = ed.document.getText();
                const gg = extractTagInner(txt, "GeneralGuidelines");
                const cd = extractTagInner(txt, "CodingDirectives");
                if (!gg || !cd) {
                  vscode.window.showErrorMessage(
                    "Could not find <GeneralGuidelines> and <CodingDirectives> blocks."
                  );
                  return;
                }
                await setPreset(context, {
                  generalGuidelines: gg.trim(),
                  codingDirectives: cd.trim(),
                });
                vscode.window.showInformationMessage("Preset saved ✔");
              },
            },
            {
              label: "$(clear-all) Clear List",
              action: () => {
                consolidateItems = [];
                vscode.window.visibleTextEditors.forEach((e) =>
                  e.setDecorations(snippetDecorationType, [])
                );
                updateStatusBar();
                persistFileItems(context);
                rebuild();
              },
            },
            { label: "", kind: vscode.QuickPickItemKind.Separator } as any,
          ];

        // Rows: each item can be removed
        const rows = (() => {
          const totalTok = calcTotals();
          const avgTok = totalTok / consolidateItems.length || 0;

          return consolidateItems.map((item, idx) => {
            const rel = vscode.workspace.asRelativePath(
              vscode.Uri.parse(item.uri)
            );
            const tok = itemTokenCount(item);
            const lines = itemLineCount(item);
            const pct = ((tok / totalTok) * 100).toFixed(1);
            const emoji = weightEmojiDynamic(
              tok,
              lines,
              tok / totalTok,
              avgTok
            );
            const tokensLabel = `${tok} tok (${pct}%)`;

            const labelCore =
              item.type === "file"
                ? `${rel}${item.includeContent ? "" : " (skipped)"}`
                : `${rel} (lines ${item.range.start.line + 1}-${
                    item.range.end.line + 1
                  })`;

            return {
              label: `$(trash) ${emoji} ${labelCore} – ${tokensLabel}`,
              action: () => {
                consolidateItems.splice(idx, 1);
                updateStatusBar();
                persistFileItems(context);
                rebuild();
              },
            };
          });
        })();

        qp.items = [...buttons, ...rows];
      };

      rebuild();
      qp.onDidAccept(() => (qp.selectedItems[0] as any)?.action?.());
      qp.onDidHide(() => qp.dispose());
      qp.show();
    })
  );

  /*──────────────── toggle FILE(S) ───────────────*/
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "extension.toggleConsolidateItem",
      async (uri: vscode.Uri | undefined, uris?: vscode.Uri[]) => {
        const targets = (uris?.length ? uris : uri ? [uri] : []).filter(
          Boolean
        ) as vscode.Uri[];

        if (targets.length === 0 && vscode.window.activeTextEditor?.document) {
          targets.push(vscode.window.activeTextEditor.document.uri);
        }

        for (const file of targets) {
          const key = file.toString();
          const pos = consolidateItems.findIndex((i) => i.uri === key);

          if (pos !== -1) {
            consolidateItems.splice(pos, 1);
            originalDocTexts.delete(key);
          } else {
            const ext = path.extname(file.fsPath).toLowerCase();
            let includeContent = !SKIP_CONTENT_EXTS.has(ext);
            if (includeContent && (await isBinary(file)))
              includeContent = false;

            if (includeContent) {
              try {
                const doc = await vscode.workspace.openTextDocument(file);
                originalDocTexts.set(key, doc.getText());
              } catch {
                includeContent = false;
              }
            }

            consolidateItems.push({ type: "file", uri: key, includeContent });
          }
        }

        updateStatusBar();
        await persistFileItems(context);
      }
    )
  );

  /*──────────────── DOC CHANGE → update snippets & bar ──────────*/
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      const affected = consolidateItems.filter(
        (i) => i.type === "snippet" && i.uri === e.document.uri.toString()
      ) as ConsolidateItemSnippet[];
      if (!affected.length) return;
      affected.forEach((sn) =>
        adjustSnippetRangeLineByLineHybridEnhanced(sn, e.document)
      );
      updateHighlightsForDocument(e.document);
      updateStatusBar();
    })
  );

  /*──────────────── FILE DECORATION (★) ─────────────────────────*/
  class ConsolidatedDecoration implements vscode.FileDecorationProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
    readonly onDidChangeFileDecorations = this._onDidChange.event;
    provideFileDecoration(uri: vscode.Uri) {
      return consolidateItems.some((i) => i.uri === uri.toString())
        ? new vscode.FileDecoration(
            undefined,
            "Consolidated",
            new vscode.ThemeColor("charts.blue")
          )
        : undefined;
    }
  }
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(new ConsolidatedDecoration())
  );

  /*──────────────── TEST SUITE CMD (unchanged) ─────────────────*/
  context.subscriptions.push(
    vscode.commands.registerCommand("extension_test.runTests", () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require("./extension_test").runTestSuite();
    })
  );

  /*──────────────── PALETTE CMDS ───────────────*/
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "contextConsolidator.composePromptToClipboard",
      async () => {
        await composePromptToClipboard(context);
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "contextConsolidator.editPromptPreset",
      async () => {
        const preset = getPreset(context);
        const doc = await vscode.workspace.openTextDocument({
          content: presetEditorScaffold(preset),
          language: "xml",
        });
        await vscode.window.showTextDocument(doc, { preview: false });
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "contextConsolidator.savePresetFromActiveEditor",
      async () => {
        const ed = vscode.window.activeTextEditor;
        if (!ed) {
          vscode.window.showWarningMessage("No active editor.");
          return;
        }
        const txt = ed.document.getText();
        const gg = extractTagInner(txt, "GeneralGuidelines");
        const cd = extractTagInner(txt, "CodingDirectives");
        if (!gg || !cd) {
          vscode.window.showErrorMessage(
            "Could not find <GeneralGuidelines> and <CodingDirectives> blocks."
          );
          return;
        }
        await setPreset(context, {
          generalGuidelines: gg.trim(),
          codingDirectives: cd.trim(),
        });
        vscode.window.showInformationMessage("Preset saved ✔");
      }
    )
  );
}

/*───────────────────────────────────────────────────────────────────────────*/
export function deactivate() {
  /* no-op */
}

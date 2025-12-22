// src/core/state.ts (solo defaults y tipos)
import * as vscode from "vscode";
import { ConsolidateItem, PromptOptions, PromptPreset } from "./types";
import {
  WS_KEY_ITEMS,
  WS_KEY_OPTIONS,
  WS_KEY_PLAN_PROMPT,
  WS_KEY_PRESET,
} from "./constants";

export const originalDocTexts = new Map<string, string>();
export let consolidateItems: ConsolidateItem[] = [];

export function clearItemCache() {
  originalDocTexts.clear();
}

type StoredRange = {
  start: { line: number; character: number };
  end: { line: number; character: number };
};

type StoredConsolidateItem =
  | { type: "file"; uri: string; includeContent: boolean }
  | {
      type: "snippet";
      uri: string;
      range: StoredRange;
      originalText: string;
      text: string;
      contextBefore?: string;
      contextAfter?: string;
    };

type LegacyFileItem = { uri: string; includeContent?: boolean };

function serializeItem(item: ConsolidateItem): StoredConsolidateItem {
  if (item.type === "file") {
    return { type: "file", uri: item.uri, includeContent: item.includeContent };
  }
  return {
    type: "snippet",
    uri: item.uri,
    range: {
      start: {
        line: item.range.start.line,
        character: item.range.start.character,
      },
      end: {
        line: item.range.end.line,
        character: item.range.end.character,
      },
    },
    originalText: item.originalText,
    text: item.text,
    contextBefore: item.contextBefore,
    contextAfter: item.contextAfter,
  };
}

function deserializeItem(raw: unknown): ConsolidateItem | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as {
    type?: string;
    uri?: string;
    includeContent?: boolean;
    range?: StoredRange;
    originalText?: string;
    text?: string;
    contextBefore?: string;
    contextAfter?: string;
  };
  if (obj.type === "file" && typeof obj.uri === "string") {
    return {
      type: "file",
      uri: obj.uri,
      includeContent: !!obj.includeContent,
    };
  }
  if (
    obj.type === "snippet" &&
    typeof obj.uri === "string" &&
    obj.range?.start &&
    obj.range?.end
  ) {
    const range = new vscode.Range(
      new vscode.Position(obj.range.start.line, obj.range.start.character),
      new vscode.Position(obj.range.end.line, obj.range.end.character)
    );
    return {
      type: "snippet",
      uri: obj.uri,
      range,
      originalText: obj.originalText ?? "",
      text: obj.text ?? "",
      contextBefore: obj.contextBefore,
      contextAfter: obj.contextAfter,
    };
  }
  if (!obj.type && typeof obj.uri === "string") {
    return {
      type: "file",
      uri: obj.uri,
      includeContent: !!obj.includeContent,
    };
  }
  return null;
}

export function currentWorkspace(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}
export function wsName(): string | undefined {
  return currentWorkspace()?.name;
}

export function defaultOptions(): PromptOptions {
  return {
    reasoningEffort: "medium",
    verbosity: "low",
    includeAdvancedSections: true,
  };
}
export function getOptions(ctx: vscode.ExtensionContext): PromptOptions {
  const name = wsName();
  if (!name) return defaultOptions();

  const saved = ctx.workspaceState.get<PromptOptions>(WS_KEY_OPTIONS(name));
  if (saved) {
    const { reasoningEffort, verbosity, includeAdvancedSections } = saved as any;
    return {
      reasoningEffort: reasoningEffort ?? "medium",
      verbosity: verbosity ?? "low",
      includeAdvancedSections: includeAdvancedSections ?? true,
    };
  }
  return defaultOptions();
}
export async function setOptions(
  ctx: vscode.ExtensionContext,
  opts: PromptOptions
) {
  const name = wsName();
  if (!name) return;
  await ctx.workspaceState.update(WS_KEY_OPTIONS(name), opts);
}

export function defaultPreset(): PromptPreset {
  return {
    generalGuidelines: `<formatting>- Use Markdown only when it helps; put code in fences; do not use diff format unless explicitly requested.</formatting>
<safety>- Treat <ConsolidatedFilesContext> as the source of truth; list gaps in <Assumptions> and proceed reasonably.</safety>
<efficiency>- Keep it concise.</efficiency>`,
    codingDirectives: `<answer_style>
- Start with the direct answer; avoid filler introductions.
- Be concise; use bullet points when helpful. Code should always be in fences.
</answer_style>

<context_use>
- Base the answer only on <ConsolidatedFilesContext>. Do not invent external details.
- If information is missing, assume the most reasonable option and state it once.
</context_use>

<scope_control>
- Do not add “extra” sections or tutorials unless explicitly asked.
- If multiple valid interpretations exist, choose one and briefly mention the alternative.
</scope_control>

<self_check>
- Before finalizing, do a quick sanity check for correctness and naming.
- If you provide code, include short verification steps to test it.
</self_check>`,
  };
}

export function defaultPlanPrompt(): string {
  return [
    "You are acting as a **Principal Software Architect**. Your task is to analyze a user request (a new feature, refactor, or bug fix) and the provided code context in <ConsolidatedFilesContext>.",
    "",
    "Based on this analysis, you must generate a **detailed implementation plan**. This plan will be fed to a separate AI coding agent (like Gemini CLI, Codex, or Cursor) which will perform the actual file manipulation.",
    "",
    "Your goal is to ensure the agent executes the task perfectly on the first try. To achieve this, you must be precise.",
    "",
    "**Code Inclusion Policy (Flexible):**",
    "- **DO** include code snippets, function bodies, or full file contents IF it adds clarity, reduces ambiguity, or if the logic is complex.",
    "- **DO** use code blocks to define exact schemas, algorithms, or configurations that must be implemented strictly.",
    '- **You may** use high-level instructions for trivial tasks (e.g., "Add necessary imports"), but prefer explicit code for the core logic.',
    "",
    "**Your response MUST follow this exact format:**",
    "",
    "---",
    "",
    "## 🚀 Overall Strategy",
    "",
    '(Provide a brief, high-level overview of the solution. Describe the "why" behind the plan. Explain the general approach and how the components interact.)',
    "",
    "## 📝 Step-by-Step Implementation Plan",
    "",
    "(Provide a file-by-file breakdown. Use code blocks generously where helpful.)",
    "",
    "- **`path/to/file1.ext`**",
    '    - (Instruction: e.g., "Update the `calculateTotal` function to handle edge cases.")',
    "    - (Code Block - Optional but recommended for specific logic):",
    "      ```javascript",
    "      // Example of the expected implementation",
    "      function calculateTotal(items) {",
    "          if (!items) return 0;",
    "          // ... implementation details",
    "      }",
    "      ```",
    "",
    "- **`path/to/new_file.ext`**",
    '    - (Instruction: "Create this file with the following initial structure.")',
    "    - (Code Block):",
    "      ```python",
    "      class NewService:",
    "          def __init__(self):",
    "              pass",
    "          # ...",
    "      ```",
    "",
    "- **`path/to/file2.ext`**",
    '    - (Instruction: "Import the new constant at the top of the file.")',
    "",
    "---",
    "",
    "### **Input:**",
    "- User request: provided alongside this XML.",
    "- Code context: see <ConsolidatedFilesContext>.",
  ].join("\n");
}


export function getPreset(ctx: vscode.ExtensionContext): PromptPreset {
  const name = wsName();
  if (!name) return defaultPreset();
  return (
    ctx.workspaceState.get<PromptPreset>(WS_KEY_PRESET(name)) ?? defaultPreset()
  );
}
export async function setPreset(
  ctx: vscode.ExtensionContext,
  preset: PromptPreset
) {
  const name = wsName();
  if (!name) return;
  await ctx.workspaceState.update(WS_KEY_PRESET(name), preset);
}

export function getPlanPrompt(ctx: vscode.ExtensionContext): string {
  const name = wsName();
  if (!name) return defaultPlanPrompt();
  return (
    ctx.workspaceState.get<string>(WS_KEY_PLAN_PROMPT(name)) ??
    defaultPlanPrompt()
  );
}

export async function setPlanPrompt(
  ctx: vscode.ExtensionContext,
  prompt: string
) {
  const name = wsName();
  if (!name) return;
  await ctx.workspaceState.update(WS_KEY_PLAN_PROMPT(name), prompt);
}

export async function persistFileItems(ctx: vscode.ExtensionContext) {
  const name = wsName();
  if (!name) return;
  const payload = consolidateItems.map(serializeItem);
  await ctx.workspaceState.update(WS_KEY_ITEMS(name), payload);
}

export async function restoreFileItems(ctx: vscode.ExtensionContext) {
  const name = wsName();
  if (!name) return;
  const payload = ctx.workspaceState.get<unknown[]>(WS_KEY_ITEMS(name), []);

  // Restaurar lista
  consolidateItems.length = 0;
  consolidateItems.push(
    ...payload
      .map((p) => deserializeItem(p))
      .filter((p): p is ConsolidateItem => !!p)
  );

  // Rehidratar textos para cómputo de tokens/líneas en status bar
  clearItemCache();
  for (const item of consolidateItems) {
    if (item.type !== "file" || !item.includeContent) continue;
    try {
      const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.parse(item.uri)
      );
      originalDocTexts.set(item.uri, doc.getText());
    } catch {
      // si no se puede abrir, dejamos sin texto; tokens/lines=0
    }
  }
}

export async function replaceConsolidateItems(items: ConsolidateItem[]) {
  consolidateItems.length = 0;
  consolidateItems.push(...items);

  clearItemCache();
  for (const item of consolidateItems) {
    if (item.type !== "file" || !item.includeContent) continue;
    try {
      const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.parse(item.uri)
      );
      originalDocTexts.set(item.uri, doc.getText());
    } catch {
      // ignore failure; tokens fallback to 0
    }
  }
}

// src/core/state.ts
import * as vscode from "vscode";
import { ConsolidateItem, PromptOptions, PromptPreset } from "./types";
import { WS_KEY_ITEMS, WS_KEY_OPTIONS, WS_KEY_PRESET } from "./constants";

export const originalDocTexts = new Map<string, string>();
export let consolidateItems: ConsolidateItem[] = [];

export function currentWorkspace(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}
export function wsName(): string | undefined {
  return currentWorkspace()?.name;
}

export function defaultOptions(): PromptOptions {
  return {
    mode: "balanced",
    reasoningEffort: "medium",
    verbosity: "low",
    includeAdvancedSections: true,
  };
}
export function getOptions(ctx: vscode.ExtensionContext): PromptOptions {
  const name = wsName();
  if (!name) return defaultOptions();
  return (
    ctx.workspaceState.get<PromptOptions>(WS_KEY_OPTIONS(name)) ??
    defaultOptions()
  );
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
<safety>- Treat <ConsolidatedFilesContext> as source of truth; list gaps in <Assumptions> and proceed reasonably.</safety>
<efficiency>- Keep it concise.</efficiency>`,
    codingDirectives: `<context_gathering>- 3–5 step mini-plan; limit scope to symbols you'll touch.</context_gathering>
<tool_preambles>- Restate goal briefly; show plan; summarize "Done/Pending" after.</tool_preambles>
<persistence>- Complete end-to-end; list pending if any.</persistence>
<code_editing_rules>- Prefer clarity; follow repo style; avoid new deps unless justified.</code_editing_rules>
<output_contract>- Deliver: brief rationale, paste-ready code, verification steps.</output_contract>`,
  };
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

export async function persistFileItems(ctx: vscode.ExtensionContext) {
  const name = wsName();
  if (!name) return;
  const payload = consolidateItems
    .filter(
      (i): i is { type: "file"; uri: string; includeContent: boolean } =>
        i.type === "file"
    )
    .map(({ uri, includeContent }) => ({ uri, includeContent }));
  await ctx.workspaceState.update(WS_KEY_ITEMS(name), payload);
}
export async function restoreFileItems(ctx: vscode.ExtensionContext) {
  const name = wsName();
  if (!name) return;
  const payload = ctx.workspaceState.get<
    { uri: string; includeContent: boolean }[]
  >(WS_KEY_ITEMS(name), []);
  consolidateItems.push(...payload.map((p) => ({ type: "file", ...p } as any)));
}

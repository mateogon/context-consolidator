// src/core/state.ts (solo defaults y tipos)
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
    reasoningEffort: "medium",
    verbosity: "low",
    includeAdvancedSections: true,
  };
}
export function getOptions(ctx: vscode.ExtensionContext): PromptOptions {
  const name = wsName();
  if (!name) return defaultOptions();

  const saved = ctx.workspaceState.get<PromptOptions>(WS_KEY_OPTIONS(name));
  // Migración suave: si había `mode` en versiones previas, lo ignoramos.
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

  // Restaurar lista
  consolidateItems.push(
    ...payload.map((p) => ({ type: "file", ...p } as any))
  );

  // Rehidratar textos para cómputo de tokens/líneas en status bar
  for (const p of payload) {
    if (!p.includeContent) continue;
    try {
      const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.parse(p.uri)
      );
      originalDocTexts.set(p.uri, doc.getText());
    } catch {
      // si no se puede abrir, dejamos sin texto; tokens/lines=0
    }
  }
}

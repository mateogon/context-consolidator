// src/prompt/composer.ts
import * as vscode from "vscode";
import { getOptions, getPreset } from "../core/state";
import { buildConsolidatedXML } from "../core/xml";
import { sanitizeInner } from "../utils/strings";

export async function buildTaskSpecXML(
  ctx: vscode.ExtensionContext
): Promise<string> {
  const options = getOptions(ctx);
  const preset = getPreset(ctx);
  const consolidated = await buildConsolidatedXML();

  const header = `<TaskSpec reasoning_effort="${options.reasoningEffort}" verbosity="${options.verbosity}">`;
  const userPrompt = `<UserPrompt>\n${sanitizeInner("")}\n</UserPrompt>`;

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

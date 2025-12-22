// src/prompt/presets.ts
import { PromptPreset } from "../core/types";
import { defaultPreset } from "../core/state";

export const PRESET_EDITOR_MARKER = "<!-- contextConsolidator:preset -->";
export const PLAN_PROMPT_EDITOR_MARKER =
  "<!-- contextConsolidator:planPrompt -->";

export function presetEditorScaffold(preset: PromptPreset): string {
  return [
    PRESET_EDITOR_MARKER,
    `<!-- Edit your preset blocks below. Only inner content matters. -->`,
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

export function planPromptEditorScaffold(prompt: string): string {
  return [
    PLAN_PROMPT_EDITOR_MARKER,
    `<!-- Edit your plan prompt below. Only inner content matters. -->`,
    `<PlanPrompt>`,
    prompt,
    `</PlanPrompt>`,
    ``,
  ].join("\n");
}

export { defaultPreset }; // re-export if you want a single import path

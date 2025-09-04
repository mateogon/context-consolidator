// src/prompt/presets.ts
import { PromptPreset } from "../core/types";
import { defaultPreset } from "../core/state";

export function presetEditorScaffold(preset: PromptPreset): string {
  return [
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

export { defaultPreset }; // re-export if you want a single import path

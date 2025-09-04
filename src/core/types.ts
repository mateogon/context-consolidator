// src/core/types.ts
import * as vscode from "vscode";

export interface ConsolidateItemFile {
  type: "file";
  uri: string;
  includeContent: boolean;
}
export interface ConsolidateItemSnippet {
  type: "snippet";
  uri: string;
  range: vscode.Range;
  originalText: string;
  text: string;
  contextBefore?: string;
  contextAfter?: string;
}
export type ConsolidateItem = ConsolidateItemFile | ConsolidateItemSnippet;

export type Mode = "lean" | "balanced" | "persistent";
export type ReasoningEffort = "low" | "medium" | "high";
export type Verbosity = "low" | "medium" | "high";

export interface PromptOptions {
  mode: Mode;
  reasoningEffort: ReasoningEffort;
  verbosity: Verbosity;
  includeAdvancedSections: boolean;
}
export interface PromptPreset {
  generalGuidelines: string;
  codingDirectives: string;
}

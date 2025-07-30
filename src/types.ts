import * as vscode from 'vscode';

export interface ConsolidateItemFile {
    type: 'file';
    uri: string;
    includeContent: boolean;
}

export interface ConsolidateItemSnippet {
    type: 'snippet';
    uri: string;
    range: vscode.Range;
    originalText: string;
    text: string;
    contextBefore?: string;
    contextAfter?: string;
}

export type ConsolidateItem = ConsolidateItemFile | ConsolidateItemSnippet;
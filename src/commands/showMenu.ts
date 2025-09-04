// src/commands/showMenu.ts
import * as vscode from "vscode";
import { registerMenuCommand } from "../ui/menu";

export function registerShowMenu(context: vscode.ExtensionContext) {
  registerMenuCommand(context);
}

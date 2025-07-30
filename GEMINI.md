<!--
  GEMINI.md  ·  Root-level context file for Gemini‑CLI
  Purpose: give Gemini a crystal‑clear spec + project info so it can
  implement the History & Presets feature in Context Consolidator.
-->

## 🤖 Persona

You are **an experienced TypeScript developer specialized in VS Code extensions** (>= v1.96).  
You write concise, well‑factored code, leaning on the official vscode API.  
Avoid boilerplate comments and don’t output git‑style diffs; instead show full file contents or clear “insert here” markers.

## 🗂️ Project Overview

*Extension name:* **Context Consolidator** (package.json already present).  
Current capabilities:

- Build a **consolidation list** of files/snippets.
- Live token/line stats, weight emojis.
- Copy to clipboard or save XML.
- Per‑workspace persistence of the current *file list*.
- UI via status‑bar ➜ Quick Pick.
- Code lives mainly in `src/extension.ts`.

We are adding **two persistent saved‑list systems**:

1. **History** – auto snapshot per consolidation.
2. **Presets** – manual, named lists that auto‑update when loaded & edited.

## 📏 Coding Conventions

- Language: **TypeScript**, target ES2020.
- No external libs beyond what’s already in package.json.
- Use `window.createQuickPick()` to build interactive menus with row buttons.
- Store data via `ExtensionContext.workspaceState`.
- Keep extension engine compatibility at `^1.96.0`.
- File structure should stay flat: create new helper modules in `src/` (e.g. `lists.ts`, `managerUI.ts`).

---

## ✨ Feature Spec – History & Presets (authoritative)

### 1 · Data Models

```ts
interface HistoryEntry {
  id: string;          // uuid
  ts: number;          // Date.now()
  items: ConsolidateItem[];
  totalTok: number;
}
interface PresetEntry {
  id: string;
  name: string;
  desc?: string;
  items: ConsolidateItem[];
  totalTok: number;
}
````

### 2 · Storage Keys

```
workspaceState
  ├─ cc.history:<workspaceName>.v1   → HistoryEntry[]
  └─ cc.presets:<workspaceName>.v1   → PresetEntry[]
```

### 3 · Commands

| Command ID                                                                          | What it does                       |
| ----------------------------------------------------------------------------------- | ---------------------------------- |
| `extension.manageConsolidationLists`                                                | Opens Quick Pick manager UI        |
| `extension.saveListAsPreset`                                                        | Saves current list as named preset |
| *Internal* `restore`, `renamePreset`, `deleteEntry`, `clearHistory`, `clearPresets` | Triggered via row/foot buttons     |

### 4 · Manager UI

* Built with Quick Pick; two separators: **History (auto)** and **Presets (manual)**.
* Row layout:

  * History: `🕑 11:42 — 3 items · 1 240 tok` `[ ⬅ ][ 🗑 ]`
  * Preset:  `📌 backend‑core — 8 items` `[ ⬅ ][ 🖉 ][ 🗑 ]`
* Footer buttons:

  * `$(save)` **Save Current List as Preset…**
  * `$(trash)` **Clear History**  ·  `$(trash)` **Clear Presets**

### 5 · Behaviour Rules

1. **History capture** – snapshot after every copy/save action. Keep newest first; cap at `historyLimit` (default 20).
2. **Restore** – replaces `consolidateItems`, refreshes highlights & status bar.

   * If source is a *Preset*, set `currentPresetId` so later edits overwrite it.
3. **Live preset update** – on any list change (add/remove/toggle), if `currentPresetId` is set, deep‑clone current list back into that Preset.
4. **Clearing** – delete entries arrays and save empty list.
5. No XML preview or diffing functionality (explicitly dropped).

### 6 · Settings

```jsonc
"contextConsolidator.enableHistory":  { "type": "boolean", "default": true },
"contextConsolidator.historyLimit":   { "type": "number",  "default": 20, "minimum": 1 },
"contextConsolidator.enablePresets":  { "type": "boolean", "default": true }
```

Prune History when limit lowered.

### 7 · File Layout Changes

```
src/
 ├─ extension.ts        // hook capture, open manager, list mutation sync
 ├─ lists.ts            // load/save helpers, addHistorySnapshot(), etc.
 ├─ managerUI.ts        // Quick Pick builder & event wiring
 └─ utils.ts            // deepClone, format helpers if needed
```

---

## 🚧 Implementation Tasks (in rough order)

1. **lists.ts**

   * Implement load/save for history & presets.
   * Add `addHistorySnapshot(ctx, items)`.
2. **Inject capture** into existing `consolidateToClipboard()` and the save‑to‑file path.
3. **managerUI.ts**

   * Quick Pick with buttons (`onDidTriggerItemButton`).
   * Footer actions for save/clear.
4. **extension.ts edits**

   * Register new commands.
   * Add status‑bar modified click to open Manager.
5. **Mutation hooks** (`toggleConsolidateItem`, add‑file, add‑snippet, clear list) to update preset when `currentPresetId` is active.
6. **Settings** in package.json.
7. Self‑test: restore, rename, delete, limits.

---

## 📤 Deliverables

* Updated `package.json` with new commands & settings.
* New/modified `.ts` files ready to compile (`npm run compile` passes).
* Brief summary of changes (CHANGELOG entry optional).

When returning code, output full file contents or clear placeholders like:

```ts
// src/managerUI.ts
/* ---------------- manager quick‑pick implementation here ---------------- */
```

No diff format.

Thanks – go build it 🚀

```
::contentReference[oaicite:0]{index=0}

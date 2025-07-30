## Context Consolidator — **History + Presets**

### Implementation Spec (v1.0‑final)

---

### 1 · Purpose

Give users two persistent, per‑workspace “saved lists”:

| List        | Captured                                                       | Editable?                               | Typical use                              |
| ----------- | -------------------------------------------------------------- | --------------------------------------- | ---------------------------------------- |
| **History** | Automatically on every **Copy to Clipboard / Save TXT** action | Only delete / clear                     | “I need the list I used an hour ago.”    |
| **Presets** | Manually via **Save Current List as Preset…**                  | Full CRUD (rename, live update, delete) | Reusable contexts (e.g. “Backend‑core”). |

No XML preview or diffing; focus on recall and re‑use.

---

### 2 · User Experience

1. **Access Manager**

   * Command palette: **“Context Consolidator: Manage Lists”** (`extension.manageConsolidationLists`).
   * Alt/Shift‑click on the existing status‑bar item (tooltip updated).

2. **Quick Pick UI** (built with `window.createQuickPick`)

   ```
   ▾  History (auto)
       🕑 10:41 — 3 items · 1 240 tok      [ ⬅ ][ 🗑 ]
       …
   ▾  Presets (manual)
       📌 backend‑core — 8 items           [ ⬅ ][ 🖉 ][ 🗑 ]
       …
   ――――――――――――――――――
   $(save)  Save Current List as Preset…
   $(trash) Clear History        $(trash) Clear Presets
   ```

   * Row **buttons** use `onDidTriggerItemButton` for actions (Restore ⬅, Rename 🖉, Delete 🗑). ([code.visualstudio.com][1])
   * Section separators implemented with `QuickPickItemKind.Separator`. ([code.visualstudio.com][2])
   * Icon glyphs are Codicons (`$(trash)`, `$(pencil)`, etc.). ([code.visualstudio.com][3])

3. **Restore**

   * Clicking a row (or its ⬅) replaces the current `consolidateItems`, refreshes highlights/status bar, and—if it’s a Preset—keeps a `currentPresetId` pointer so subsequent edits overwrite that Preset automatically.

4. **Save as Preset**

   * Prompts for **name** (mandatory) and **description** (optional).
   * On success, new entry appears under “Presets”.

5. **Live Update Logic**

   * If `currentPresetId` is set, every list‑mutation (add/remove/toggle) deep‑clones `consolidateItems` back into that Preset and re‑saves storage.

---

### 3 · Data Model & Storage

```ts
interface HistoryEntry {
  id: string;           // uuid
  ts: number;           // Date.now()
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
```

* **Location** — `ExtensionContext.workspaceState` (per workspace, auto‑restored by VS Code). ([code.visualstudio.com][4])

  * Keys:

    * `cc.history:<workspaceName>.v1` → `HistoryEntry[]`
    * `cc.presets:<workspaceName>.v1` → `PresetEntry[]`

---

### 4 · Commands & Contributions

| Command                                             | Title                              | Shown In        |
| --------------------------------------------------- | ---------------------------------- | --------------- |
| `extension.manageConsolidationLists`                | Context Consolidator: Manage Lists | Command palette |
| `extension.saveListAsPreset`                        | Save Current List as Preset…       | Manager footer  |
| `extension.restoreConsolidationEntry`               | *(internal)*                       | Row button      |
| `extension.renamePreset` / `extension.deleteEntry`  | *(internal)*                       | Row button      |
| `extension.clearHistory` / `extension.clearPresets` | *(internal)*                       | Manager footer  |

Update `package.json` accordingly.

---

### 5 · Extension Settings

```jsonc
"contextConsolidator.enableHistory": {
  "type": "boolean", "default": true,
  "description": "Capture each consolidation in History."
},
"contextConsolidator.historyLimit": {
  "type": "number",  "default": 20, "minimum": 1,
  "description": "Maximum History snapshots to keep."
},
"contextConsolidator.enablePresets": {
  "type": "boolean", "default": true,
  "description": "Allow saving and loading named Presets."
}
```

On activation, prune history if `historyLimit` was reduced.

---

### 6 · Implementation Steps

1. **lists.ts**

   * `loadHistory(ctx)`, `saveHistory(ctx)`, `addHistorySnapshot(ctx, items)`.
   * `loadPresets(ctx)`, `savePresets(ctx)`, helpers for CRUD.

2. **Integrate Capture**

   ```ts
   await addHistorySnapshot(context, consolidateItems);  // at end of consolidateToClipboard()
   ```

3. **Manager UI (managerUI.ts)**

   * Build Quick Pick; wire `onDidTriggerItemButton` and `onDidAccept`.
   * Keep a `rebuild()` fn to refresh after any action.

4. **Restore Logic**

   * Clear decorations, set new `consolidateItems`, hydrate `originalDocTexts`, update highlights & status.

5. **Live Preset Sync**

   * In all commands that mutate the list, check `currentPresetId`; if set, update its `items` and `totalTok`.

6. **Housekeeping**

   * `historyLimit` enforcement on every save.
   * `currentPresetId = undefined` when user loads a History entry or manually clears the list.

7. **Tests**

   * Unit‑test add/restore/delete flows in `lists.test.ts`.

Estimated dev time: **\~10 hrs** (no preview/diff branch).

---

### 7 · Reference Links

* **Quick Pick API & buttons** – [https://code.visualstudio.com/updates/v1\_63#\_buttons-on-quick-pick-items](https://code.visualstudio.com/updates/v1_63#_buttons-on-quick-pick-items) ([code.visualstudio.com][1])
* **Quick Pick UX guidelines & separators** – [https://code.visualstudio.com/api/ux-guidelines/quick-picks](https://code.visualstudio.com/api/ux-guidelines/quick-picks) ([code.visualstudio.com][2])
* **workspaceState / globalState** – [https://code.visualstudio.com/api/extension-capabilities/common-capabilities#workspace-state](https://code.visualstudio.com/api/extension-capabilities/common-capabilities#workspace-state) ([code.visualstudio.com][4])
* **Codicons** – [https://code.visualstudio.com/api/references/icons-in-labels](https://code.visualstudio.com/api/references/icons-in-labels) ([code.visualstudio.com][3])

---

### 8 · Ready to Ship

This spec is trimmed to the essentials: automatic History, editable Presets, a single Quick Pick manager, and robust persistence — no extra XML views or diff complexity. Implement as outlined and you’ll have a slick, low‑overhead enhancement fully compatible with VS Code 1.96+.

[1]: https://code.visualstudio.com/updates/v1_63?utm_source=chatgpt.com "November 2021 (version 1.63) - Visual Studio Code"
[2]: https://code.visualstudio.com/api/ux-guidelines/quick-picks?utm_source=chatgpt.com "Quick Picks | Visual Studio Code Extension API"
[3]: https://code.visualstudio.com/api/references/icons-in-labels?utm_source=chatgpt.com "Product Icon Reference | Visual Studio Code Extension API"
[4]: https://code.visualstudio.com/api/extension-capabilities/common-capabilities?utm_source=chatgpt.com "Common Capabilities | Visual Studio Code Extension API"
